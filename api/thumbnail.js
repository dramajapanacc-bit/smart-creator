export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title = "", prompt = "", aspectRatio = "16:9" } = req.body || {};

    if (!title && !prompt) {
      return res.status(400).json({ error: "Title is required" });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "OPENAI_API_KEY not found" });
    }

    const finalPrompt = `
Create an ultra-viral YouTube Movie Recap thumbnail.

Movie title: ${title}

Extra style: ${prompt}

Requirements:
- Main character should be the biggest subject.
- Add a glowing RED circle around the main character's face.
- Add thick curved RED arrows pointing to the face.
- 2–4 supporting characters around the edges.
- Dramatic cinematic lighting.
- Teal & orange color grading.
- Smoke, sparks and explosions.
- Huge bold yellow title with black outline.
- MrBeast-style composition.
- ${aspectRatio} aspect ratio.
- No watermark.
`;

    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: finalPrompt,
          size: aspectRatio === "9:16" ? "1024x1792" : "1536x1024",
          quality: "high"
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || "Image generation failed"
      });
    }

    return res.status(200).json({
      imageBase64: data.data[0].b64_json,
      mimeType: "image/png"
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message || "Server error"
    });
  }
}
