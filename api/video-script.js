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
      mimeType
    } = req.body || {};

    if (!fileName) {
      return res.status(400).json({
        error: "Gemini file name မရပါ။"
      });
    }

    if (!fileName.startsWith("files/")) {
      return res.status(400).json({
        error: "Gemini file name မမှန်ပါ။"
      });
    }

    const fileInfoUrl =
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${encodeURIComponent(apiKey)}`;

    let file = null;

    const maxWait = 120000;
    const interval = 3000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < maxWait) {
      const fileResponse = await fetch(fileInfoUrl);

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();

        return res.status(fileResponse.status).json({
          error:
            errorText ||
            "Gemini video file အချက်အလက်ကို မရယူနိုင်ပါ။"
        });
      }

      file = await fileResponse.json();

      const state = file?.state;

      if (state === "ACTIVE") {
        break;
      }

      if (state === "FAILED") {
        return res.status(500).json({
          error: "Gemini က Video ကို process လုပ်၍မရပါ။"
        });
      }

      await new Promise(resolve =>
        setTimeout(resolve, interval)
      );
    }

    if (!file || file.state !== "ACTIVE") {
      return res.status(408).json({
        error:
          "Video processing အချိန်ကြာနေပါတယ်။ ခဏစောင့်ပြီး ထပ်စမ်းပါ။"
      });
    }

    if (!file.uri) {
      return res.status(500).json({
        error: "Gemini video URI မရပါ။"
      });
    }

    const prompt = `
You are an expert Myanmar movie recap narrator.

Analyze the entire uploaded video carefully.

Understand:
- Visual scenes
- Characters
- Dialogue
- Actions
- Relationships
- Important events
- Story progression
- Major conflicts
- Important details

Then write a natural Myanmar-language movie recap / narration script based ONLY on what actually happens in the video.

Requirements:
- Do not invent details.
- Do not guess missing information.
- Do not include timestamps.
- Do not use markdown headings.
- Do not use bullet points.
- Do not add explanations before or after the script.
- Write naturally for a Myanmar movie recap voice-over.
- Make the narration flow smoothly from beginning to end.
- Keep important story events.
- Output ONLY the narration script.
- Keep the script under 5000 Burmese characters.
`;

    const generateResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
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
                    mime_type:
                      file.mimeType ||
                      mimeType ||
                      "video/mp4",
                    file_uri: file.uri
                  }
                }
              ]
            }
          ]
        })
      }
    );

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();

      console.error(
        "Gemini generate error:",
        errorText
      );

      return res.status(generateResponse.status).json({
        error:
          errorText ||
          "Gemini AI က Script ရေး၍မရပါ။"
      });
    }

    const result = await generateResponse.json();

    const parts =
      result?.candidates?.[0]?.content?.parts || [];

    const script = parts
      .map(part => part?.text || "")
      .join("")
      .trim();

    if (!script) {
      return res.status(500).json({
        error:
          "Gemini က Script ပြန်မပေးပါ။ Video ကို ထပ်စမ်းကြည့်ပါ။"
      });
    }

    return res.status(200).json({
      script
    });

  } catch (error) {
    console.error(
      "video-script error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "AI Script ပြုလုပ်ရာတွင် အမှားဖြစ်နေပါတယ်။"
    });
  }
}
