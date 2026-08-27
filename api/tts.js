export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { text, voice } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "မြန်မာစာ ထည့်ပေးပါ။"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY မတွေ့ပါ။"
      });
    }

    // Gemini TTS Voice ၅ ခု
    const allowedVoices = [
      "Zephyr",
      "Puck",
      "Charon",
      "Kore",
      "Leda"
    ];

    const selectedVoice =
      allowedVoices.includes(voice)
        ? voice
        : "Zephyr";

    const prompt =
      "Speak the following text in Burmese Myanmar language. " +
      "Use natural and clear Burmese pronunciation. " +
      "Speak only the provided text. " +
      "Do not translate or explain.\n\n" +
      String(text).trim();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],

          generationConfig: {
            responseModalities: ["AUDIO"],

            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice
                }
              }
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API Error:",
        JSON.stringify(data)
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini TTS Error ဖြစ်နေပါသည်။"
      });
    }

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    let audioBase64 = null;

    for (const part of parts) {
      if (part?.inlineData?.data) {
        audioBase64 =
          part.inlineData.data;
        break;
      }
    }

    if (!audioBase64) {
      console.error(
        "Gemini Response:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error:
          "Gemini မှ Audio မပြန်လာပါ။"
      });
    }

    const pcmBuffer =
      Buffer.from(
        audioBase64,
        "base64"
      );

    if (!pcmBuffer.length) {
      return res.status(500).json({
        error:
          "Audio data အလွတ်ဖြစ်နေပါသည်။"
      });
    }

    // PCM → WAV
    const sampleRate = 24000;
    const channels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = 2;

    const blockAlign =
      channels * bytesPerSample;

    const byteRate =
      sampleRate * blockAlign;

    const wavHeader =
      Buffer.alloc(44);

    wavHeader.write("RIFF", 0);

    wavHeader.writeUInt32LE(
      36 + pcmBuffer.length,
      4
    );

    wavHeader.write("WAVE", 8);

    wavHeader.write("fmt ", 12);

    wavHeader.writeUInt32LE(
      16,
      16
    );

    wavHeader.writeUInt16LE(
      1,
      20
    );

    wavHeader.writeUInt16LE(
      channels,
      22
    );

    wavHeader.writeUInt32LE(
      sampleRate,
      24
    );

    wavHeader.writeUInt32LE(
      byteRate,
      28
    );

    wavHeader.writeUInt16LE(
      blockAlign,
      32
    );

    wavHeader.writeUInt16LE(
      bitsPerSample,
      34
    );

    wavHeader.write("data", 36);

    wavHeader.writeUInt32LE(
      pcmBuffer.length,
      40
    );

    const wavBuffer =
      Buffer.concat([
        wavHeader,
        pcmBuffer
      ]);

    res.setHeader(
      "Content-Type",
      "audio/wav"
    );

    res.setHeader(
      "Content-Length",
      wavBuffer.length
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res
      .status(200)
      .send(wavBuffer);

  } catch (error) {
    console.error(
      "TTS Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "အသံထုတ်ရာတွင် Error ဖြစ်နေပါသည်။"
    });
  }
}
