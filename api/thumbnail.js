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

    if (!title.trim()) {
      return res.status(400).json({
        error: "Movie Name ထည့်ပါ။"
      });
    }

    const hfToken = process.env.HF_TOKEN;

    if (!hfToken) {
      return res.status(500).json({
        error: "HF_TOKEN မတွေ့ပါ။"
      });
    }

    const size =
      aspectRatio === "9:16"
        ? "720x1280"
        : "1280x720";

    const finalPrompt = `
${title}
${prompt || "MrBeast viral YouTube thumbnail, cinematic movie recap, ultra realistic, shocked face, dramatic red and blue lighting, giant yellow title area, high contrast"}

Aspect ratio: ${aspectRatio}
Image size: ${size}
    `;

    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-dev",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          inputs: finalPrompt
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({
        error: text
      });
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader("Content-Type", "image/png");
    return res.status(200).send(buffer);

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}
