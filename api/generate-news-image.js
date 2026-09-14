import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const {
      prompt,
      ratio = "9:16",
      sceneId = "",
      title = "",
    } = req.body || {};

    // Check prompt
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({
        success: false,
        error: "prompt is required",
      });
    }

    // Check Gemini API Key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Only allow these two ratios
    const aspectRatio = ratio === "16:9" ? "16:9" : "9:16";

    /*
     * Important:
     * The generated image must follow the news/article scene.
     * Do not invent information that is not in the source.
     */
    const instruction = `
Create a realistic editorial news visual for a Myanmar news presentation.

Source scene title:
${title || sceneId || "News Scene"}

Scene visual requirement:
${prompt}

Aspect ratio:
${aspectRatio}

STRICT NEWS ACCURACY RULES:
- Depict ONLY information supported by the supplied scene description.
- Do NOT invent facts.
- Do NOT invent people.
- Do NOT invent names.
- Do NOT invent numbers.
- Do NOT invent locations.
- Do NOT invent dates.
- Do NOT invent organizations.
- Do NOT add events that are not described.
- Do NOT add fake evidence.
- Do NOT add misleading details.

IMAGE RULES:
- No captions.
- No headlines.
- No subtitles.
- No logos.
- No platform watermarks.
- No fake news text.
- No fake newspaper text.
- No extra written information.
- Professional editorial/news photography style.
- Documentary realism.
- Natural lighting.
- Realistic composition.
- Clear subject matching the scene.
- The visual must directly correspond to the supplied news scene.

Generate one clean professional news visual.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: instruction,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts =
      response?.candidates?.[0]?.content?.parts || [];

    // Find generated image
    const imagePart = parts.find(
      (part) => part?.inlineData?.data
    );

    if (!imagePart) {
      throw new Error("No image returned by Gemini");
    }

    const mimeType =
      imagePart.inlineData.mimeType || "image/png";

    const imageData =
      `data:${mimeType};base64,${imagePart.inlineData.data}`;

    return res.status(200).json({
      success: true,
      sceneId,
      ratio: aspectRatio,
      imageData,
    });

  } catch (error) {
    console.error(
      "generate-news-image error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Image generation failed",
    });
  }
}
