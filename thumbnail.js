export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      title = "",
      prompt = "",
      aspectRatio = "16:9"
    } = req.body || {};

    if (!title && !prompt) {
      return res.status(400).json({
        error: "Title or prompt is required"
      });
    }

    if (!["16:9", "9:16"].includes(aspectRatio)) {
      return res.status(400).json({
        error: "Invalid aspect ratio"
      });
    }

    // API Key ကို Frontend မှာမထားဘဲ Vercel Environment Variable ကနေယူမယ်
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_PRO_DIALOGUE_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Gemini API key is not configured"
      });
    }

    const model = "gemini-2.5-flash-image";

    const finalPrompt = `
Create a professional, eye-catching video thumbnail.

Aspect ratio: ${aspectRatio}

Main topic/title:
${title}

Visual style:
${prompt}

Requirements:
- Cinematic and professional composition
- Strong focal subject
- High contrast and attractive lighting
- Designed for mobile viewing
- Make the main subject immediately understandable
- Leave suitable visual space for title text
- No random logos
- No watermark
- Make the image visually dramatic and engaging
`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
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
                  text: finalPrompt
                }
              ]
            }
          ],
          generationConfig: {
            responseModalities: ["IMAGE"]
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Thumbnail Error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini image generation failed"
      });
    }

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    const imagePart = parts.find(
      (part) => part.inlineData
    );

    if (!imagePart?.inlineData?.data) {
      return res.status(502).json({
        error: "No image was returned by Gemini"
      });
    }

    return res.status(200).json({
      imageBase64: imagePart.inlineData.data,
      mimeType:
        imagePart.inlineData.mimeType ||
        "image/png"
    });

  } catch (error) {
    console.error("Thumbnail API Error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Thumbnail generation failed"
    });
  }
}
