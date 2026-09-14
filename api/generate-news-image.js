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
      prompt = "",
      ratio = "9:16",
      sceneId = "",
      title = ""
    } = req.body || {};

    if (!prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: "Image prompt is required"
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

    const aspectRatio =
      ratio === "16:9" ? "16:9" : "9:16";

    const instruction = `
Create a professional editorial news visual for a Myanmar news presentation.

News title:
${title || "News"}

Scene:
${sceneId || "News Scene"}

Visual description:
${prompt}

Aspect ratio:
${aspectRatio}

STRICT RULES:
- Follow ONLY the supplied scene description.
- Do NOT invent facts.
- Do NOT add people, places, numbers, organizations or events that are not supported.
- Do NOT add captions.
- Do NOT add headlines.
- Do NOT add logos.
- Do NOT add watermarks.
- Do NOT add fake text.
- Make the image realistic and suitable for a professional news presentation.
- Natural lighting.
- Documentary/editorial realism.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: instruction,
      config: {
        responseModalities: ["TEXT", "IMAGE"]
      }
    });

    const parts =
      response?.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(
      part => part?.inlineData?.data
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
      imageData,
      mimeType
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
        "News image generation failed"
    });
  }
}
