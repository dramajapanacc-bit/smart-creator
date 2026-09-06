export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      title = "",
      prompt = "",
      aspectRatio = "16:9"
    } = req.body || {};

    if (!title.trim() && !prompt.trim()) {
      return res.status(400).json({
        error: "Movie Name ထည့်ပါ။"
      });
    }

    if (!["16:9", "9:16"].includes(aspectRatio)) {
      return res.status(400).json({
        error: "Invalid aspect ratio"
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_PRO_DIALOGUE_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY မထည့်ရသေးပါ။"
      });
    }

    const model = "gemini-2.5-flash-image";

    // Prompt မထည့်ရင် Auto Style
    const autoStyle = `
MrBeast style viral YouTube thumbnail,
cinematic movie recap,
ultra realistic,
dramatic red and blue lighting,
high contrast,
shocked facial expression,
big yellow title space,
clickbait composition,
professional YouTube thumbnail,
no watermark,
no logo
`;

    const finalPrompt = `
Create a ${aspectRatio} professional YouTube thumbnail.

Movie title:
${title}

Style:
${prompt.trim() || autoStyle}

Requirements:
- Ultra realistic
- Cinematic composition
- Strong focal subject
- Mobile friendly
- Leave space for bold title text
- No watermark
- No random logo
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
              parts: [{ text: finalPrompt }]
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
      return res.status(response.status).json({
        error: data?.error?.message || "Thumbnail Generate Failed"
      });
    }

    const imagePart =
      data?.candidates?.[0]?.content?.parts?.find(
        part => part.inlineData
      );

    if (!imagePart?.inlineData?.data) {
      return res.status(502).json({
        error: "Gemini က Image မပြန်ပေးပါ။"
      });
    }

    return res.status(200).json({
      imageBase64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || "image/png"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: err.message || "Thumbnail Generate Failed"
    });
  }
}
