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

    /*
      မြန်မာနာမည် → Gemini built-in voice
    */

    const voiceMap = {
      "ဘိုဘို": "Kore",
      "ညဏ်လင်း": "Puck",
      "ကောင်းမြတ်": "Charon",
      "ကြယ်ဇင်": "Aoede",
      "လမင်း": "Leda"
    };

    const selectedVoice =
      voiceMap[voice] || "Puck";

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
                  text:
                    "Speak ONLY in Burmese Myanmar language. " +
                    "Do not translate the text into English. " +
                    "Read the Burmese text naturally and clearly. " +
                    "Use a natural narration style. " +
                    "Do not add any extra words.\n\n" +
                    String(text).trim()
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

      return res.status(500).json({
        error:
          data?.error?.message ||
          "Gemini TTS API Error ဖြစ်နေပါသည်။"
      });
    }

    const audioBase64 =
      data?.candidates?.[0]
        ?.content?.parts?.[0]
        ?.inlineData?.data;

    if (!audioBase64) {
      console.error(
        "Gemini response:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error: "Gemini မှ Audio ပြန်မပေးပါ။"
      });
    }

    const pcmBuffer = Buffer.from(
      audioBase64,
      "base64"
    );

    /*
      Gemini TTS PCM
      24kHz / 16-bit / Mono
    */

    const wavHeader = Buffer.alloc(44);

    wavHeader.write("RIFF", 0);

    wavHeader.writeUInt32LE(
      36 + pcmBuffer.length,
      4
    );

    wavHeader.write("WAVE", 8);
    wavHeader.write("fmt ", 12);

    wavHeader.writeUInt32LE(16, 16);

    // PCM
    wavHeader.writeUInt16LE(1, 20);

    // Mono
    wavHeader.writeUInt16LE(1, 22);

    // Sample rate
    wavHeader.writeUInt32LE(
      24000,
      24
    );

    // Byte rate
    wavHeader.writeUInt32LE(
      24000 * 2,
      28
    );

    // Block align
    wavHeader.writeUInt16LE(2, 32);

    // 16-bit
    wavHeader.writeUInt16LE(16, 34);

    wavHeader.write("data", 36);

    wavHeader.writeUInt32LE(
      pcmBuffer.length,
      40
    );

    const wavBuffer = Buffer.concat([
      wavHeader,
      pcmBuffer
    ]);

    res.setHeader(
      "Content-Type",
      "audio/wav"
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="Myanmar-Voice.wav"'
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
        "Myanmar Voice ထုတ်ရာတွင် Error ဖြစ်နေပါသည်။"
    });
  }
}
