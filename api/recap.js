export const config = {
  api: {
    bodyParser: false
  }
};

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", chunk => {
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", reject);
  });
}

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "GEMINI_API_KEY မတွေ့ပါ။"
      });
    }

    /*
     * ------------------------------------------------
     * READ VIDEO BODY
     * ------------------------------------------------
     */

    const body =
      await readRequestBody(req);

    if (!body || !body.length) {
      return res.status(400).json({
        error:
          "Video ဖိုင် မရရှိပါ။"
      });
    }

    /*
     * ------------------------------------------------
     * BASIC SIZE CHECK
     * ------------------------------------------------
     */

    const maxSize =
      4 * 1024 * 1024;

    if (body.length > maxSize) {

      return res.status(413).json({
        error:
          "ဒီ Vercel upload နည်းလမ်းမှာ Video ကို 4MB အောက်ထားရပါမယ်။ Movie အကြီးအတွက် Client → Gemini File API upload ကို သုံးရပါမယ်။"
      });

    }

    /*
     * ------------------------------------------------
     * MIME TYPE
     * ------------------------------------------------
     */

    const contentType =
      req.headers["content-type"] ||
      "video/mp4";

    let mimeType =
      "video/mp4";

    if (
      contentType.includes("video/")
    ) {
      mimeType =
        contentType
          .split(";")[0]
          .trim();
    }

    /*
     * ------------------------------------------------
     * GEMINI FILE API
     * ------------------------------------------------
     */

    const startResponse =
      await fetch(
        "https://generativelanguage.googleapis.com/upload/v1beta/files",
        {
          method: "POST",

          headers: {

            "x-goog-api-key":
              apiKey,

            "X-Goog-Upload-Protocol":
              "resumable",

            "X-Goog-Upload-Command":
              "start",

            "X-Goog-Upload-Header-Content-Length":
              String(body.length),

            "X-Goog-Upload-Header-Content-Type":
              mimeType,

            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            file: {
              display_name:
                "YNT-Movie-Recap"
            }
          })
        }
      );

    if (!startResponse.ok) {

      const errorText =
        await startResponse.text();

      console.error(
        "FILE START ERROR:",
        errorText
      );

      return res.status(500).json({
        error:
          "Gemini File Upload စတင်မရပါ။"
      });
    }

    const uploadUrl =
      startResponse.headers.get(
        "x-goog-upload-url"
      );

    if (!uploadUrl) {

      return res.status(500).json({
        error:
          "Gemini Upload URL မရပါ။"
      });
    }

    /*
     * ------------------------------------------------
     * UPLOAD VIDEO
     * ------------------------------------------------
     */

    const uploadResponse =
      await fetch(
        uploadUrl,
        {
          method: "POST",

          headers: {

            "Content-Length":
              String(body.length),

            "X-Goog-Upload-Offset":
              "0",

            "X-Goog-Upload-Command":
              "upload, finalize",

            "Content-Type":
              mimeType
          },

          body: body
        }
      );

    const fileData =
      await uploadResponse.json();

    if (!uploadResponse.ok) {

      console.error(
        "FILE UPLOAD ERROR:",
        JSON.stringify(fileData)
      );

      return res.status(500).json({
        error:
          fileData?.error?.message ||
          "Video Gemini ဆီ upload မရပါ။"
      });
    }

    const fileName =
      fileData?.file?.name;

    const fileUri =
      fileData?.file?.uri;

    if (!fileName || !fileUri) {

      console.error(
        "FILE RESPONSE:",
        JSON.stringify(fileData)
      );

      return res.status(500).json({
        error:
          "Gemini File URI မရပါ။"
      });
    }

    /*
     * ------------------------------------------------
     * WAIT FOR VIDEO PROCESSING
     * ------------------------------------------------
     */

    let state =
      fileData?.file?.state ||
      "PROCESSING";

    let currentFile =
      fileData.file;

    let attempts = 0;

    while (
      state === "PROCESSING" &&
      attempts < 30
    ) {

      await new Promise(
        resolve =>
          setTimeout(resolve, 3000)
      );

      const statusResponse =
        await fetch(
          `https://generativelanguage.googleapis.com/v1beta/${fileName}`,
          {
            method: "GET",

            headers: {
              "x-goog-api-key":
                apiKey
            }
          }
        );

      currentFile =
        await statusResponse.json();

      state =
        currentFile?.state ||
        currentFile?.file?.state;

      attempts++;
    }

    if (state !== "ACTIVE") {

      console.error(
        "FILE PROCESSING RESULT:",
        JSON.stringify(currentFile)
      );

      return res.status(500).json({
        error:
          "Gemini က Video ကို process မလုပ်နိုင်ပါ။ State: " +
          String(state)
      });
    }

    /*
     * ------------------------------------------------
     * CREATE RECAP
     * ------------------------------------------------
     */

    const prompt = `
You are an expert movie recap writer.

Watch and understand the entire uploaded movie/video.

Create a detailed Burmese Myanmar movie recap script.

Rules:

- Write naturally in Burmese Myanmar.
- Follow the actual video story in correct chronological order.
- Identify important characters and what they do.
- Include important events, conflicts, discoveries and consequences.
- Include the ending when it is available in the video.
- Do not invent events.
- Do not guess information that is not shown or supported by the video.
- Do not translate character names unnecessarily.
- Make the narration smooth and easy to listen to.
- Make it suitable for a YouTube movie recap voice-over.
- Remove unnecessary repetition.
- Do not add headings.
- Do not add explanations about being an AI.
- Output ONLY the final Burmese recap script.

Start directly with the story.
`;

    const generateResponse =
      await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "x-goog-api-key":
              apiKey
          },

          body: JSON.stringify({

            contents: [

              {
                parts: [

                  {
                    text:
                      prompt
                  },

                  {
                    file_data: {

                      mime_type:
                        mimeType,

                      file_uri:
                        fileUri
                    }
                  }

                ]
              }

            ],

            generationConfig: {

              temperature:
                0.7,

              maxOutputTokens:
                12000
            }

          })
        }
      );

    const result =
      await generateResponse.json();

    if (!generateResponse.ok) {

      console.error(
        "GEMINI RECAP ERROR:",
        JSON.stringify(result)
      );

      return res.status(
        generateResponse.status || 500
      ).json({

        error:
          result?.error?.message ||
          "Gemini Recap Error ဖြစ်နေပါသည်။"

      });
    }

    /*
     * ------------------------------------------------
     * EXTRACT SCRIPT
     * ------------------------------------------------
     */

    const parts =
      result?.candidates?.[0]
        ?.content
        ?.parts || [];

    const script =
      parts
        .map(
          part =>
            part?.text || ""
        )
        .join("")
        .trim();

    if (!script) {

      console.error(
        "EMPTY GEMINI RESULT:",
        JSON.stringify(result)
      );

      return res.status(500).json({
        error:
          "Gemini မှ Recap Script ပြန်မပေးပါ။"
      });
    }

    /*
     * ------------------------------------------------
     * RETURN
     * ------------------------------------------------
     */

    return res.status(200).json({

      script: script

    });

  } catch (error) {

    console.error(
      "YNT RECAP SERVER ERROR:",
      error
    );

    return res.status(500).json({

      error:
        error?.message ||
        "Movie Recap Server Error ဖြစ်နေပါသည်။"

    });

  }
}
