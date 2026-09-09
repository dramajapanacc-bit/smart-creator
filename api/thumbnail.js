export default async function handler(req, res) {
  // =========================
  // CORS
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // =========================
    // POLLINATIONS API KEY
    // =========================
    const apiKey =
      process.env.POLLINATIONS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "POLLINATIONS_API_KEY မတွေ့ပါ။ Environment Variables ထဲ ထည့်ပါ။"
      });
    }

    // =========================
    // RECEIVE DATA
    // =========================
    const {
      text,
      textColor,
      style,
      aspectRatio
    } = req.body || {};

    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      return res.status(400).json({
        error: "Thumbnail စာသားထည့်ပါ။"
      });
    }

    const ratio =
      aspectRatio === "9:16"
        ? "9:16"
        : "16:9";

    const color =
      textColor ||
      "Neon Cyan and Bright Yellow";

    const design =
      style ||
      "Epic, dramatic, and cinematic with high contrast";

    // =========================
    // PROMPT
    // =========================
    const prompt = `
Create a professional YouTube thumbnail.

TITLE TEXT:
"${text.trim()}"

TEXT COLOR:
${color}

DESIGN STYLE:
${design}

ASPECT RATIO:
${ratio}

IMPORTANT:
- Make the title highly visible.
- Use large bold typography.
- Make the main subject large and clear.
- Use cinematic lighting.
- Use strong contrast.
- Make the composition professional.
- Make the image visually exciting.
- Keep the title away from the edges.
- Do not add random text.
- Do not add logos.
- Do not add watermarks.
- Make it suitable for a professional YouTube thumbnail.
`;

    // =========================
    // POLLINATIONS IMAGE API
    // =========================

    const encodedPrompt =
      encodeURIComponent(prompt);

    const imageUrl =
      `https://gen.pollinations.ai/image/${encodedPrompt}` +
      `?model=flux` +
      `&aspectRatio=${encodeURIComponent(ratio)}` +
      `&width=${ratio === "9:16" ? 768 : 1280}` +
      `&height=${ratio === "9:16" ? 1365 : 720}` +
      `&key=${encodeURIComponent(apiKey)}`;

    // =========================
    // FETCH IMAGE
    // =========================

    const imageResponse =
      await fetch(imageUrl);

    if (!imageResponse.ok) {
      const errorText =
        await imageResponse.text();

      console.error(
        "Pollinations Error:",
        errorText
      );

      return res.status(
        imageResponse.status || 500
      ).json({
        error:
          "Pollinations AI Thumbnail Generate မအောင်မြင်ပါ။ " +
          errorText
      });
    }

    // =========================
    // CONVERT IMAGE TO BASE64
    // =========================

    const arrayBuffer =
      await imageResponse.arrayBuffer();

    const buffer =
      Buffer.from(arrayBuffer);

    const mimeType =
      imageResponse.headers.get(
        "content-type"
      ) || "image/jpeg";

    const base64 =
      buffer.toString("base64");

    // =========================
    // SUCCESS
    // =========================

    return res.status(200).json({
      success: true,

      image:
        `data:${mimeType};base64,${base64}`,

      aspectRatio: ratio
    });

  } catch (error) {
    console.error(
      "Thumbnail Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "AI Thumbnail ဖန်တီးရာတွင် Server Error ဖြစ်နေပါသည်။"
    });
  }
}
