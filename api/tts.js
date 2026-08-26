export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { text } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "မြန်မာစာ ထည့်ပေးပါ။"
      });
    }

    const apiKey = process.env.FREETTS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "FREETTS_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကို စစ်ပါ။"
      });
    }

    const cleanText = String(text).trim();

    if (cleanText.length > 5000) {
      return res.status(400).json({
        error: "စာလုံးရေ 5000 ထက် မကျော်ရပါ။"
      });
    }

    // Burmese Male Voice
    const voice = "my-MM-ThihaNeural";

    console.log("Using Burmese Voice:", voice);

    // Generate Burmese TTS
    const response = await fetch(
      "https://freetts.org/api/v1/tts",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey
        },

        body: JSON.stringify({
          text: cleanText,
          voice: voice,
          rate: "+0%",
          pitch: "+0Hz",
          output_format: "mp3"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("FreeTTS Error:", data);

      return res.status(response.status).json({
        error:
          data?.error ||
          data?.message ||
          "FreeTTS အသံထုတ်မရပါ။"
      });
    }

    const fileId = data?.file_id;

    if (!fileId) {
      console.error("No file_id:", data);

      return res.status(500).json({
        error: "FreeTTS မှ Audio File ID မရပါ။"
      });
    }

    console.log("Audio File ID:", fileId);

    // Download generated MP3
    const audioResponse = await fetch(
      `https://freetts.org/api/audio/${encodeURIComponent(fileId)}`
    );

    if (!audioResponse.ok) {
      return res.status(500).json({
        error: "Audio file ရယူမရပါ။"
      });
    }

    const audioBuffer = Buffer.from(
      await audioResponse.arrayBuffer()
    );

    if (!audioBuffer.length) {
      return res.status(500).json({
        error: "Audio file အလွတ်ဖြစ်နေပါသည်။"
      });
    }

    // MP3 only
    res.setHeader(
      "Content-Type",
      "audio/mpeg"
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="YanNaing-Myanmar-Voice.mp3"'
    );

    res.setHeader(
      "Content-Length",
      audioBuffer.length.toString()
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res
      .status(200)
      .send(audioBuffer);

  } catch (error) {

    console.error(
      "TTS Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Myanmar Voice ထုတ်ရာတွင် Server Error ဖြစ်နေပါသည်။"
    });
  }
}
