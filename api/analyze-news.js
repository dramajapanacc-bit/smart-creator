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
      text = "",
      title = "",
      language = "my"
    } = req.body || {};

    if (!text.trim()) {
      return res.status(400).json({
        success: false,
        error: "News content is required"
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
You are a professional Myanmar news editor and news video storyboard writer.

Analyze ONLY the supplied news/article content.

IMPORTANT:
- Do NOT invent facts.
- Do NOT add information that is not in the source.
- Do NOT invent names, dates, numbers, locations, organizations or events.
- Keep the meaning faithful to the source.
- Write natural standard Myanmar Burmese.
- Avoid bookish Burmese.
- Make the narration sound like a professional Myanmar news presenter.
- Do not use shouting or exaggerated dramatic language.
- Divide the news into 4 to 10 logical scenes.
- Each scene must directly correspond to information in the source.
- Create a visual prompt for each scene that matches that scene.
- Visual prompts must NOT introduce unsupported facts.
- Do not put text, logos or watermarks inside generated visuals.

Return ONLY valid JSON.

JSON format:
{
  "success": true,
  "title": "...",
  "summary": "...",
  "hook": "...",
  "scenes": [
    {
      "id": 1,
      "title": "...",
      "description": "...",
      "imagePrompt": "...",
      "narration": "...",
      "duration": 5,
      "importance": "high"
    }
  ]
}

News title:
${title}

Source news:
${text}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const raw = response.text || "";

    let result;

    try {
      result = JSON.parse(raw);
    } catch (e) {
      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      result = JSON.parse(cleaned);
    }

    return res.status(200).json({
      success: true,
      title: result.title || title || "AI News",
      summary: result.summary || "",
      hook: result.hook || "",
      scenes: Array.isArray(result.scenes)
        ? result.scenes
        : []
    });

  } catch (error) {
    console.error("analyze-news error:", error);

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "News analysis failed"
    });
  }
}
