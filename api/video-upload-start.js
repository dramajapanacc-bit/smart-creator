export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
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
        error: "GEMINI_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကို စစ်ပါ။"
      });
    }

    const {
      fileName,
      size,
      mimeType
    } = req.body || {};

    if (!fileName || !size || !mimeType) {
      return res.status(400).json({
        error: "Video file information မပြည့်စုံပါ။"
      });
    }

    if (!mimeType.startsWith("video/")) {
      return res.status(400).json({
        error: "Video file မဟုတ်ပါ။"
      });
    }

    if (Number(size) <= 0) {
      return res.status(400).json({
        error: "Video file အလွတ်ဖြစ်နေပါတယ်။"
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(size),
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          file: {
            display_name: fileName
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(response.status).json({
        error: errorText || "Gemini upload session ဖန်တီး၍မရပါ။"
      });
    }

    const uploadUrl =
      response.headers.get("x-goog-upload-url");

    if (!uploadUrl) {
      return res.status(500).json({
        error: "Gemini upload URL မရပါ။"
      });
    }

    return res.status(200).json({
      uploadUrl
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        error?.message ||
        "Video upload session error ဖြစ်နေပါတယ်။"
    });
  }
}
