import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      text,
      style = "professional",
      voice = "Kore"
    } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "News script is required"
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured"
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    const prompt = `
You are a professional Myanmar news presenter.

Read the following Myanmar news script and present it naturally.

Presentation style:
${style}

Voice:
${voice}

STRICT RULES:
- Speak natural standard Myanmar Burmese.
- Clear pronunciation.
- Professional news presenter delivery.
- Do not shout.
- Do not scream.
- Do not mumble.
- Do not add information.
- Do not change facts.
- Do not invent names, dates, numbers or locations.
- Keep the exact meaning of the supplied script.
- Use natural pauses between sentences.
- Serious and professional news tone.
- No dramatic acting unless explicitly requested.

NEWS SCRIPT:
${text}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: prompt,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice
            }
          }
        }
      }
    });

    const parts =
      response?.candidates?.[0]?.content?.parts || [];

    const audioPart = parts.find(
      part => part?.inlineData?.data
    );

    if (!audioPart) {
      throw new Error("No audio returned by Gemini");
    }

    const mimeType =
      audioPart.inlineData.mimeType || "audio/wav";

    const audioData =
      `data:${mimeType};base64,${audioPart.inlineData.data}`;

    return res.status(200).json({
      success: true,
      audioData,
      mimeType
    });

  } catch (error) {
    console.error("news-voice error:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "News voice generation failed"
    });
  }
}
