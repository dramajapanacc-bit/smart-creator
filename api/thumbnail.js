export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY မတွေ့ပါ။ Environment Variables ကို စစ်ပါ။"
      });
    }

    const {
      text,
      textColor,
      style,
      aspectRatio
    } = req.body || {};

    // =========================
    // CHECK TEXT
    // =========================

    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      return res.status(400).json({
        error: "Thumbnail စာသားထည့်ပါ။"
      });
    }

    // =========================
    // ASPECT RATIO
    // =========================

    const ratio =
      aspectRatio === "9:16"
        ? "9:16"
        : "16:9";

    // Gemini API protobuf enum value
    const apiAspectRatio =
      ratio === "9:16"
        ? "ASPECT_RATIO_NINE_BY_SIXTEEN"
        : "ASPECT_RATIO_SIXTEEN_BY_NINE";

    // =========================
    // DEFAULT SETTINGS
    // =========================

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
Create a professional AI-generated thumbnail.

EXACT THUMBNAIL TITLE:
"${text.trim()}"

TEXT COLOR:
${color}

DESIGN STYLE:
${design}

TARGET ASPECT RATIO:
${ratio}

IMPORTANT REQUIREMENTS:

- Create a professional YouTube/social media thumbnail.
- Make the main visual directly relevant to the title.
- Make the main subject large and clear.
- Use cinematic lighting.
- Use strong contrast.
- Make the requested title highly readable.
- Keep the title safely inside the image.
- Use the requested text color style.
- Do not add random text.
- Do not add random logos.
- Do not add watermarks.
- Do not add unnecessary small text.
- Make the composition look professionally designed.
- The final image should look like a real professional thumbnail.
`;

    // =========================
    // GEMINI IMAGE API
    // =========================

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent",
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
                  text: prompt
                }
              ]
            }
          ],

          generationConfig: {
            responseModalities: [
              "TEXT",
              "IMAGE"
            ],

            responseFormat: {
              image: {
                aspectRatio: apiAspectRatio
              }
            }
          }
        })
      }
    );

    // =========================
    // READ RESPONSE
    // =========================

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini Thumbnail Error:",
        JSON.stringify(data)
      );

      return res.status(
        response.status || 500
      ).json({
        error:
          data?.error?.message ||
          "Gemini Thumbnail API Error ဖြစ်နေပါသည်။"
      });
    }

    // =========================
    // FIND IMAGE
    // =========================

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    const imagePart =
      parts.find(
        (part) =>
          part?.inlineData?.data
      );

    if (!imagePart) {
      return res.status(500).json({
        error:
          "Gemini က Thumbnail ပုံပြန်မပေးပါ။"
      });
    }

    const imageMimeType =
      imagePart.inlineData.mimeType ||
      "image/png";

    const imageBase64 =
      imagePart.inlineData.data;

    // =========================
    // SUCCESS
    // =========================

    return res.status(200).json({
      success: true,

      image:
        `data:${imageMimeType};base64,${imageBase64}`,

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
        "Thumbnail ဖန်တီးရာတွင် Server Error ဖြစ်နေပါသည်။"
    });
  }
}
