export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body || {};

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

    const cleanText = String(text).trim();

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.1-flash-tts-preview",

          input:
            "Speak the following Burmese Myanmar text naturally and clearly. " +
            "Do not translate it. Speak only the Burmese text.\n\n" +
            cleanText,

          response_format: {
            type: "audio"
          },

          generation_config: {
            speech_config: [
              {
                voice: "Kore"
              }
            ]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(500).json({
        error:
          data?.error?.message ||
          "Gemini TTS API Error ဖြစ်နေပါသည်။"
      });
    }

    console.log(
      "Gemini response keys:",
      Object.keys(data || {})
    );

    const audioBase64 =
      data?.output_audio?.data;

    if (!audioBase64) {
      console.error(
        "No output_audio:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error: "Gemini မှ Audio ပြန်မပေးပါ။"
      });
    }

    const audioBuffer = Buffer.from(
      audioBase64,
      "base64"
    );

    if (!audioBuffer.length) {
      return res.status(500).json({
        error: "Audio data အလွတ်ဖြစ်နေပါသည်။"
      });
    }

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
    console.error(
      "TTS Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Gemini TTS Server Error ဖြစ်နေပါသည်။"
    });
  }
}
