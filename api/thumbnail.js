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

    const size =
      aspectRatio === "9:16"
        ? { w: 720, h: 1280 }
        : { w: 1280, h: 720 };

    const style =
      prompt ||
      `MrBeast viral YouTube thumbnail,
       cinematic movie recap,
       ultra realistic,
       shocked face,
       dramatic red and blue lighting,
       giant yellow title area,
       high contrast,
       clickbait composition`;

    const finalPrompt = `${title}, ${style}`;

    const imageUrl =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?model=flux&width=${size.w}&height=${size.h}&enhance=true&nologo=true&seed=${Date.now()}`;

    return res.status(200).json({
      imageUrl
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message || "Thumbnail Generate Failed"
    });
  }
}
