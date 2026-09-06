export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { title="", prompt="", aspectRatio="16:9" } = req.body || {};

  if (!title.trim()) {
    return res.status(400).json({ error: "Movie Name ထည့်ပါ။" });
  }

  const size = aspectRatio === "9:16"
    ? { w:720, h:1280 }
    : { w:1280, h:720 };

  const style = prompt || `
MrBeast viral YouTube thumbnail,
cinematic movie recap,
ultra realistic,
dramatic red and blue lighting,
high contrast,
shocked face,
big yellow title area`;

  const imageUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(title+", "+style)}?width=${size.w}&height=${size.h}&model=flux&nologo=true&enhance=true`;

  return res.status(200).json({
    imageUrl,
    mimeType:"image/jpeg"
  });
}
