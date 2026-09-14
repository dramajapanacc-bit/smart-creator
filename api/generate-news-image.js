import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const {
      prompt = "",
      ratio = "9:16",
      sceneId = "",
      title = "",
    } = req.body || {};

    if (!String(prompt).trim()) {
      return res.status(400).json({
        success: false,
        error: "prompt is required",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const aspectRatio =
      ratio === "16:9" ? "16:9" : "9:16";

    const instruction = `
Create one realistic professional editorial news visual.

News title:
${title || "News"}

Scene:
${sceneId || "News Scene"}

Visual requirement:
${prompt}

IMPORTANT:
- Follow ONLY the supplied scene description.
- Do not invent facts.
- Do not invent names, dates, numbers, places or organizations.
- Do not add unsupported people or events.
- No captions.
- No headlines.
- No subtitles.
- No logos.
- No watermarks.
- No fake text.
- Professional documentary/news photography.
- Natural lighting.
- Realistic composition.
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image",
      contents: instruction,
      config: {
        responseModalities: ["TEXT", "IMAGE"],

        responseFormat: {
          image: {
            aspectRatio: aspectRatio,
            imageSize: "1K",
          },
        },
      },
    });

    const parts =
      response?.candidates?.[0]?.content?.parts || [];

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
      mimeType,
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
