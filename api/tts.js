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

    // Website က ပို့လာတဲ့ voice ကို စစ်ပေးမယ်
    const allowedVoices = {
      Kore: "Kore",
      Charon: "Charon",
      Orus: "Orus",
      Gacrux: "Gacrux",
      Sulafat: "Sulafat"
    };

    // မရွေးထားရင် Kore ကို default သုံးမယ်
    const selectedVoice =
      allowedVoices[voice] || "Kore";

    console.log(
      "Selected Gemini Voice:",
      selectedVoice
    );

    const cleanText =
      String(text).trim();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent",
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
                    "Do not speak English after the Burmese text. " +
                    "Read ONLY the provided Burmese text naturally, " +
                    "clearly and continuously.\n\n" +
                    cleanText
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

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API Error:",
        data
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
        error:
          "Gemini မှ Audio ပြန်မပေးပါ။"
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

    // Gemini TTS:
    // 24kHz / 16-bit / Mono PCM
    // PCM → WAV

    const wavHeader =
      Buffer.alloc(44);

    wavHeader.write(
      "RIFF",
      0
    );

    wavHeader.writeUInt32LE(
      36 + pcmBuffer.length,
      4
    );

    wavHeader.write(
      "WAVE",
      8
    );

    wavHeader.write(
      "fmt ",
      12
    );

    wavHeader.writeUInt32LE(
      16,
      16
    );

    wavHeader.writeUInt16LE(
      1,
      20
    );

    wavHeader.writeUInt16LE(
      1,
      22
    );

    wavHeader.writeUInt32LE(
      24000,
      24
    );

    wavHeader.writeUInt32LE(
      24000 * 2,
      28
    );

    wavHeader.writeUInt16LE(
      2,
      32
    );

    wavHeader.writeUInt16LE(
      16,
      34
    );

    wavHeader.write(
      "data",
      36
    );

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
      "Content-Disposition",
      'inline; filename="YanNaing-Myanmar-Voice.wav"'
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
