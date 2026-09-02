export const config = {
  api: {
    bodyParser: false,
  },
};

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function readableError(value) {
  if (!value) return "Unknown Error";

  if (typeof value === "string") return value;

  if (value instanceof Error) {
    return value.message || "Unknown Error";
  }

  if (typeof value === "object") {
    if (value.message) return String(value.message);
    if (value.detail) return readableError(value.detail);

    if (Array.isArray(value.detail)) {
      return value.detail
        .map((x) => {
          if (typeof x === "string") return x;
          if (x?.msg) return x.msg;
          return JSON.stringify(x);
        })
        .join("; ");
    }

    if (value.error) return readableError(value.error);

    try {
      return JSON.stringify(value);
    } catch {
      return "Unknown API Error";
    }
  }

  return String(value);
}

function getBoundary(contentType) {
  const match = contentType?.match(/boundary="?([^";]+)"?/i);
  return match ? match[1] : null;
}

function parseMultipart(buffer, boundary) {
  const fields = {};
  const files = [];

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  let position = 0;

  while (true) {
    const start = buffer.indexOf(boundaryBuffer, position);

    if (start === -1) break;

    const afterBoundary = start + boundaryBuffer.length;

    if (
      buffer[afterBoundary] === 45 &&
      buffer[afterBoundary + 1] === 45
    ) {
      break;
    }

    let partStart = afterBoundary;

    if (
      buffer[partStart] === 13 &&
      buffer[partStart + 1] === 10
    ) {
      partStart += 2;
    }

    const nextBoundary = buffer.indexOf(
      boundaryBuffer,
      partStart
    );

    if (nextBoundary === -1) break;

    let partEnd = nextBoundary;

    if (
      buffer[partEnd - 2] === 13 &&
      buffer[partEnd - 1] === 10
    ) {
      partEnd -= 2;
    }

    const part = buffer.subarray(partStart, partEnd);

    const headerEnd = part.indexOf(
      Buffer.from("\r\n\r\n")
    );

    if (headerEnd === -1) {
      position = nextBoundary;
      continue;
    }

    const headerText = part
      .subarray(0, headerEnd)
      .toString("utf8");

    const body = part.subarray(headerEnd + 4);

    const dispositionMatch = headerText.match(
      /Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i
    );

    if (!dispositionMatch) {
      position = nextBoundary;
      continue;
    }

    const fieldName = dispositionMatch[1];
    const filename = dispositionMatch[2];

    const typeMatch = headerText.match(
      /Content-Type:\s*([^\r\n]+)/i
    );

    const contentTypeValue = typeMatch
      ? typeMatch[1].trim()
      : "application/octet-stream";

    if (filename !== undefined) {
      files.push({
        fieldName,
        filename,
        contentType: contentTypeValue,
        buffer: Buffer.from(body),
      });
    } else {
      fields[fieldName] = body.toString("utf8");
    }

    position = nextBoundary;
  }

  return { fields, files };
}

async function readRequestBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, {
      error: "POST method only",
    });
  }

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return json(res, 500, {
        error: "ELEVENLABS_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကို စစ်ပါ။",
      });
    }

    const contentType =
      req.headers["content-type"] || "";

    if (
      !contentType.toLowerCase().includes("multipart/form-data")
    ) {
      return json(res, 400, {
        error: "multipart/form-data request လိုအပ်ပါတယ်။",
      });
    }

    const boundary = getBoundary(contentType);

    if (!boundary) {
      return json(res, 400, {
        error: "Multipart boundary မတွေ့ပါ။",
      });
    }

    const body = await readRequestBody(req);

    if (!body.length) {
      return json(res, 400, {
        error: "Upload data အလွတ်ဖြစ်နေပါတယ်။",
      });
    }

    const { fields, files } = parseMultipart(
      body,
      boundary
    );

    const name =
      String(fields.name || "").trim() ||
      "YNT Voice Clone";

    const audio =
      files.find(
        (file) =>
          file.fieldName === "file" ||
          file.fieldName === "files" ||
          file.fieldName === "files[]"
      ) || files[0];

    if (!audio) {
      return json(res, 400, {
        error: "Voice Sample ဖိုင် မတွေ့ပါ။",
      });
    }

    if (!audio.buffer || !audio.buffer.length) {
      return json(res, 400, {
        error: "Voice Sample ဖိုင်အလွတ်ဖြစ်နေပါတယ်။",
      });
    }

    if (audio.buffer.length > 25 * 1024 * 1024) {
      return json(res, 400, {
        error: "Voice Sample ကို 25MB အောက်ထားပါ။",
      });
    }

    const elevenForm = new FormData();

    const audioBlob = new Blob(
      [audio.buffer],
      {
        type:
          audio.contentType ||
          "audio/mpeg",
      }
    );

    /*
     * IMPORTANT:
     * ElevenLabs request schema မှာ files ကို
     * required file field အဖြစ်လက်ခံပါတယ်။
     *
     * လက်ရှိ API response က body.files missing
     * လို့ပြထားတာကြောင့် ဒီနေရာမှာ
     * "files" ကိုအသုံးပြုထားပါတယ်။
     */
    elevenForm.append(
      "files",
      audioBlob,
      audio.filename || "voice-sample.mp3"
    );

    elevenForm.append("name", name);

    const response = await fetch(
      "https://api.elevenlabs.io/v1/voices/add",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: elevenForm,
      }
    );

    const responseText =
      await response.text();

    let data = {};

    try {
      data = responseText
        ? JSON.parse(responseText)
        : {};
    } catch {
      data = {
        raw: responseText,
      };
    }

    if (!response.ok) {
      return json(res, response.status, {
        error: readableError(
          data?.detail ||
          data?.error ||
          data?.message ||
          data?.raw ||
          "ElevenLabs Voice Clone API Error"
        ),
      });
    }

    if (!data?.voice_id) {
      return json(res, 502, {
        error:
          "ElevenLabs က Voice ID မပြန်ပေးပါ။ Response: " +
          readableError(data),
      });
    }

    return json(res, 200, {
      success: true,
      voice_id: data.voice_id,
      requires_verification:
        data.requires_verification ?? false,
      name,
    });
  } catch (error) {
    return json(res, 500, {
      error:
        readableError(error) ||
        "Voice Clone Server Error ဖြစ်နေပါတယ်။",
    });
  }
}
