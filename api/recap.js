export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { fileUri, mimeType } = req.body || {};

    if (!fileUri) {
      return res.status(400).json({
        error: "Gemini Video File URI မရပါ။"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY မတွေ့ပါ။"
      });
    }

    const prompt = `
You are an expert movie recap writer.

Analyze the uploaded movie/video carefully and write a detailed Burmese Myanmar movie recap script.

Rules:
- Write naturally in Burmese Myanmar.
- Follow the story in chronological order.
- Include important characters and their actions.
- Include important events, conflicts, discoveries and consequences.
- Include the ending when it is shown in the video.
- Do not invent events.
- Do not guess information that is not supported by the video.
- Keep character names where appropriate.
- Make the narration smooth and suitable for YouTube movie recap voice-over.
- Remove unnecessary repetition.
- Do not add headings.
- Do not explain what you are doing.
- Output ONLY the Burmese recap script.

Start directly with the story.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
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
                },
                {
                  file_data: {
                    mime_type: mimeType || "video/mp4",
                    file_uri: fileUri
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 12000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Gemini Recap Error:",
        JSON.stringify(data)
      );

      return res.status(response.status || 500).json({
        error:
          data?.error?.message ||
          "Gemini Recap API Error ဖြစ်နေပါသည်။"
      });
    }

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    const script = parts
      .map(part => part?.text || "")
      .join("")
      .trim();

    if (!script) {
      return res.status(500).json({
        error:
          "Gemini မှ Recap Script ပြန်မပေးပါ။"
      });
    }

    return res.status(200).json({
      script
    });

  } catch (error) {
    console.error(
      "Recap Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Recap Server Error ဖြစ်နေပါသည်။"
    });
  }
}
