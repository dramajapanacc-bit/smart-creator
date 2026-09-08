export default async function handler(req, res) {
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
        error: "GEMINI_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကို စစ်ပါ။"
      });
    }

    const { fileName, size, mimeType } = req.body || {};

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

    const fileSize = Number(size);

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return res.status(400).json({
        error: "Video file size မမှန်ပါ။"
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",

        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(fileSize),
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

    const text = await response.text();

    if (!response.ok) {
      console.error("Gemini upload start error:", text);

      return res.status(response.status).json({
        error:
          text ||
          "Gemini upload session ဖန်တီး၍မရပါ။"
      });
    }

    const uploadUrl =
      response.headers.get("x-goog-upload-url");

    if (!uploadUrl) {
      console.error(
        "Gemini response headers:",
        [...response.headers.entries()]
      );

      return res.status(500).json({
        error:
          "Gemini upload URL မရပါ။ API response ကို စစ်ဆေးပါ။"
      });
    }

    return res.status(200).json({
      success: true,
      uploadUrl
    });

  } catch (error) {
    console.error(
      "video-upload-start error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Video upload session error ဖြစ်နေပါတယ်။"
    });
  }
}
