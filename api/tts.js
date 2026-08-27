export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { text, voice = "Kore" } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "မြန်မာစာ ထည့်ပေးပါ။"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကို စစ်ပါ။"
      });
    }

    const cleanText = String(text).trim();

    if (cleanText.length > 5000) {
      return res.status(400).json({
        error: "စာလုံးရေ 5000 ထက် မကျော်ရပါ။"
      });
    }

    const allowedVoices = [
      "Kore",
      "Zephyr",
      "Puck",
      "Charon",
      "Fenrir",
      "Leda",
      "Orus",
      "Aoede"
    ];

    const selectedVoice = allowedVoices.includes(voice)
      ? voice
      : "Kore";

    console.log("Gemini TTS Voice:", selectedVoice);

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
          "Api-Revision": "2026-05-20"
        },

        body: JSON.stringify({
          model: "gemini-3.1-flash-tts-preview",

          input:
            "Read the following Burmese Myanmar text naturally and clearly. " +
            "Speak ONLY the text provided. Do not translate it into English. " +
            "Do not add any English words.\n\n" +
            cleanText,

          response_format: {
            type: "audio"
          },

          generation_config: {
            speech_config: [
              {
                voice: selectedVoice
              }
            ]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini TTS Error:", data);

      return res.status(500).json({
        error:
          data?.error?.message ||
          "Gemini TTS Error ဖြစ်နေပါသည်။"
      });
    }

    const audioBase64 =
      data?.output_audio?.data;

    if (!audioBase64) {
      console.error("No audio:", data);

      return res.status(500).json({
        error: "Gemini မှ Audio ပြန်မပေးပါ။"
      });
    }

    const audioBuffer =
      Buffer.from(audioBase64, "base64");

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

    return res.status(200).send(audioBuffer);

  } catch (error) {

    console.error("Gemini TTS Server Error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Gemini TTS Server Error ဖြစ်နေပါသည်။"
    });
  }
}
