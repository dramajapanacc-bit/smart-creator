export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const uploadUrl = req.query.uploadUrl;
    const offset = Number(req.query.offset || 0);
    const finalize = req.query.finalize === "1";
    const mimeType =
      req.headers["x-video-mime"] ||
      "video/mp4";

    if (!uploadUrl) {
      return res.status(400).json({
        error: "Gemini upload URL မပါပါ။"
      });
    }

    if (!Number.isFinite(offset) || offset < 0) {
      return res.status(400).json({
        error: "Upload offset မမှန်ပါ။"
      });
    }

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks);

    if (!body.length) {
      return res.status(400).json({
        error: "Video chunk အလွတ်ဖြစ်နေပါတယ်။"
      });
    }

    const command = finalize
      ? "upload, finalize"
      : "upload";

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "X-Goog-Upload-Offset": String(offset),
        "X-Goog-Upload-Command": command,
        "Content-Length": String(body.length),
        "Content-Type": mimeType
      },
      body
    });

    const responseText = await response.text();

    let data = {};

    try {
      data = JSON.parse(responseText || "{}");
    } catch {
      data = {};
    }

    if (!response.ok) {
      console.error(
        "Gemini chunk upload error:",
        responseText
      );

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          responseText ||
          "Gemini Video Upload Failed"
      });
    }

    return res.status(200).json({
      file: data.file || data,
      uploadedBytes:
        offset + body.length,
      finalized: finalize
    });

  } catch (error) {
    console.error(
      "video-upload-chunk error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Video Chunk Upload Error ဖြစ်နေပါတယ်။"
    });
  }
}
