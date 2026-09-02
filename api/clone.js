export const config = {
  api: {
    bodyParser: false,
  },
};

function getBoundary(contentType) {
  const match = contentType.match(/boundary="?([^";]+)"?/i);
  return match ? match[1] : null;
}

function parseMultipart(buffer, boundary) {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const parts = [];

  let start = 0;

  while (true) {
    const index = buffer.indexOf(boundaryBuffer, start);

    if (index === -1) break;

    const nextStart = index + boundaryBuffer.length;

    if (buffer.slice(nextStart, nextStart + 2).toString() === "--") {
      break;
    }

    let partStart = nextStart;

    if (buffer.slice(partStart, partStart + 2).toString() === "\r\n") {
      partStart += 2;
    }

    const nextBoundary = buffer.indexOf(
      boundaryBuffer,
      partStart
    );

    if (nextBoundary === -1) break;

    let part = buffer.slice(
      partStart,
      nextBoundary
    );

    if (part.slice(-2).toString() === "\r\n") {
      part = part.slice(0, -2);
    }

    const headerEnd = part.indexOf(
      Buffer.from("\r\n\r\n")
    );

    if (headerEnd === -1) {
      start = nextBoundary;
      continue;
    }

    const headerText = part
      .slice(0, headerEnd)
      .toString("utf8");

    const body = part.slice(headerEnd + 4);

    const disposition = headerText.match(
      /Content-Disposition:[^\r\n]+/i
    );

    if (!disposition) {
      start = nextBoundary;
      continue;
    }

    const nameMatch = disposition[0].match(
      /name="([^"]+)"/i
    );

    const filenameMatch = disposition[0].match(
      /filename="([^"]*)"/i
    );

    const contentTypeMatch = headerText.match(
      /Content-Type:\s*([^\r\n]+)/i
    );

    parts.push({
      name: nameMatch
        ? nameMatch[1]
        : null,

      filename: filenameMatch
        ? filenameMatch[1]
        : null,

      contentType: contentTypeMatch
        ? contentTypeMatch[1].trim()
        : "application/octet-stream",

      data: body,
    });

    start = nextBoundary;
  }

  return parts;
}

/* -----------------------------------------
   Convert any API error into readable text
------------------------------------------ */

function readableError(error) {
  if (!error) {
    return "Voice Clone API Error";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "number" || typeof error === "boolean") {
    return String(error);
  }

  if (Array.isArray(error)) {
    return error
      .map(item => readableError(item))
      .filter(Boolean)
      .join(" | ");
  }

  if (typeof error === "object") {
    if (typeof error.message === "string") {
      return error.message;
    }

    if (typeof error.detail === "string") {
      return error.detail;
    }

    if (typeof error.error === "string") {
      return error.error;
    }

    if (typeof error.status === "string") {
      return error.status;
    }

    if (Array.isArray(error.errors)) {
      return error.errors
        .map(item => readableError(item))
        .filter(Boolean)
        .join(" | ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Voice Clone API Error";
    }
  }

  return String(error);
}

/* -----------------------------------------
   Main handler
------------------------------------------ */

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST method only",
    });
  }

  try {

    const apiKey =
      process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "ELEVENLABS_API_KEY မထည့်ရသေးပါ။",
      });
    }

    const contentType =
      req.headers["content-type"] || "";

    if (
      !contentType.includes(
        "multipart/form-data"
      )
    ) {
      return res.status(400).json({
        error:
          "multipart/form-data ဖြင့် audio file ပို့ပါ။",
      });
    }

    const boundary =
      getBoundary(contentType);

    if (!boundary) {
      return res.status(400).json({
        error:
          "Multipart boundary မတွေ့ပါ။",
      });
    }

    /* -----------------------------------------
       Read request body
    ------------------------------------------ */

    const chunks = [];

    for await (const chunk of req) {
      chunks.push(
        Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk)
      );
    }

    const body = Buffer.concat(chunks);

    if (!body.length) {
      return res.status(400).json({
        error:
          "Voice sample file မတွေ့ပါ။",
      });
    }

    /* -----------------------------------------
       Parse multipart form
    ------------------------------------------ */

    const parts =
      parseMultipart(
        body,
        boundary
      );

    const audio =
      parts.find(
        part =>
          part.name === "file" &&
          part.filename
      );

    const voiceNamePart =
      parts.find(
        part =>
          part.name === "name"
      );

    const voiceName =
      voiceNamePart
        ? voiceNamePart.data
            .toString("utf8")
            .trim()
        : "YNT Voice Clone";

    if (!audio) {
      return res.status(400).json({
        error:
          "Voice sample audio file ထည့်ပါ။",
      });
    }

    /* -----------------------------------------
       Allowed audio formats
    ------------------------------------------ */

    const allowedTypes = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/x-wav",
      "audio/wave",
      "audio/mp4",
      "audio/m4a",
      "audio/ogg",
      "audio/webm",
    ];

    const detectedType =
      (
        audio.contentType ||
        ""
      ).toLowerCase();

    if (
      detectedType &&
      detectedType !==
        "application/octet-stream" &&
      !allowedTypes.includes(
        detectedType
      )
    ) {
      return res.status(400).json({
        error:
          "MP3 / WAV / M4A / OGG / WEBM audio file သုံးပါ။",
      });
    }

    if (audio.data.length === 0) {
      return res.status(400).json({
        error:
          "Audio file အလွတ်ဖြစ်နေပါတယ်။",
      });
    }

    /* -----------------------------------------
       Create ElevenLabs form
    ------------------------------------------ */

    const form =
      new FormData();

    const audioBlob =
      new Blob(
        [audio.data],
        {
          type:
            detectedType ||
            "audio/mpeg",
        }
      );

    form.append(
      "name",
      voiceName ||
        "YNT Voice Clone"
    );

    form.append(
      "files[]",
      audioBlob,
      audio.filename ||
        "voice-sample.mp3"
    );

    /* -----------------------------------------
       Send to ElevenLabs
    ------------------------------------------ */

    const response =
      await fetch(
        "https://api.elevenlabs.io/v1/voices/add",
        {
          method: "POST",

          headers: {
            "xi-api-key":
              apiKey,
          },

          body: form,
        }
      );

    const responseType =
      response.headers.get(
        "content-type"
      ) || "";

    let result;

    if (
      responseType.includes(
        "application/json"
      )
    ) {
      result =
        await response.json();
    } else {
      const text =
        await response.text();

      result = {
        error: text,
      };
    }

    /* -----------------------------------------
       ElevenLabs error
    ------------------------------------------ */

    if (!response.ok) {

      const errorMessage =
        readableError(
          result?.detail ??
          result?.message ??
          result?.error ??
          result
        );

      console.error(
        "ELEVENLABS CLONE ERROR:",
        result
      );

      return res.status(
        response.status
      ).json({
        error:
          errorMessage ||
          "Voice Clone API Error",
      });
    }

    /* -----------------------------------------
       Check Voice ID
    ------------------------------------------ */

    if (!result?.voice_id) {

      console.error(
        "ELEVENLABS RESPONSE:",
        result
      );

      return res.status(500).json({
        error:
          "Voice ID မပြန်လာပါ။ ElevenLabs response ကို စစ်ဆေးပါ။",
        details:
          readableError(result),
      });
    }

    /* -----------------------------------------
       Success
    ------------------------------------------ */

    return res.status(200).json({

      success: true,

      voice_id:
        result.voice_id,

      requires_verification:
        result.requires_verification ||
        false,

      name:
        voiceName ||
        "YNT Voice Clone",

    });

  } catch (error) {

    console.error(
      "VOICE CLONE ERROR:",
      error
    );

    return res.status(500).json({

      error:
        readableError(error) ||
        "Voice Clone ပြုလုပ်ရာတွင် Error ဖြစ်နေပါတယ်။",

    });
  }
}
