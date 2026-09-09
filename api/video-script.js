export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  // OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // POST only
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
      fileName,
      mimeType
    } = req.body || {};

    // Check file name
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

    // ==========================================
    // 1. Wait for Gemini Video File to become ACTIVE
    // ==========================================

    const fileInfoUrl =
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${encodeURIComponent(apiKey)}`;

    let file = null;

    const maxWait = 120000; // 2 minutes
    const interval = 3000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < maxWait) {

      const fileResponse = await fetch(fileInfoUrl);

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();

        console.error(
          "Gemini file info error:",
          errorText
        );

        return res.status(fileResponse.status).json({
          error:
            errorText ||
            "Gemini video file အချက်အလက်ကို မရယူနိုင်ပါ။"
        });
      }

      file = await fileResponse.json();

      const state = file?.state;

      // Video ready
      if (state === "ACTIVE") {
        break;
      }

      // Video processing failed
      if (state === "FAILED") {
        return res.status(500).json({
          error:
            "Gemini က Video ကို process လုပ်၍မရပါ။"
        });
      }

      // Still processing
      await new Promise(resolve =>
        setTimeout(resolve, interval)
      );
    }

    // ==========================================
    // 2. Check ACTIVE
    // ==========================================

    if (!file || file.state !== "ACTIVE") {
      return res.status(408).json({
        error:
          "Video processing အချိန်ကြာနေပါတယ်။ ခဏစောင့်ပြီး ထပ်စမ်းပါ။"
      });
    }

    // ==========================================
    // 3. Check Gemini File URI
    // ==========================================

    if (!file.uri) {
      return res.status(500).json({
        error:
          "Gemini video URI မရပါ။"
      });
    }

    // ==========================================
    // 4. Myanmar Recap Prompt
    // ==========================================

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
- Beginning
- Middle
- Ending

Then write a natural Myanmar-language movie recap narration script based ONLY on what actually happens in the uploaded video.

Requirements:

- Write naturally in Burmese Myanmar.
- Follow the story in chronological order.
- Explain important scenes clearly.
- Include important characters and their actions.
- Include important conflicts and consequences.
- Include important discoveries.
- Include the ending if the ending is shown.
- Do not invent any event.
- Do not guess missing information.
- Do not add information that cannot be supported by the video.
- Do not include timestamps.
- Do not use markdown headings.
- Do not use bullet points.
- Do not explain what you are doing.
- Do not add an introduction about AI.
- Do not add an ending explanation.
- Write as a natural YouTube Myanmar movie recap voice-over.
- Make the narration smooth and easy to listen to.
- Remove unnecessary repetition.
- Output ONLY the Myanmar recap narration script.
- Keep the script under 5000 Burmese characters.

Start directly with the story.
`;

    // ==========================================
    // 5. Ask Gemini to generate Recap Script
    // ==========================================

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

                    file_uri:
                      file.uri
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

    // ==========================================
    // 6. IMPORTANT: Correct response check
    // ==========================================

    if (!generateResponse.ok) {

      const errorText =
        await generateResponse.text();

      console.error(
        "Gemini generate error:",
        errorText
      );

      return res.status(
        generateResponse.status || 500
      ).json({
        error:
          errorText ||
          "Gemini AI က Script ရေး၍မရပါ။"
      });
    }

    // ==========================================
    // 7. Read Gemini response
    // ==========================================

    const result =
      await generateResponse.json();

    const parts =
      result?.candidates?.[0]?.content?.parts || [];

    const script =
      parts
        .map(part => part?.text || "")
        .join("")
        .trim();

    // ==========================================
    // 8. Check Script
    // ==========================================

    if (!script) {

      console.error(
        "Gemini returned no script:",
        JSON.stringify(result)
      );

      return res.status(500).json({
        error:
          "Gemini က Script ပြန်မပေးပါ။ Video ကို ထပ်စမ်းကြည့်ပါ။"
      });
    }

    // ==========================================
    // 9. SUCCESS
    // ==========================================

    return res.status(200).json({
      success: true,
      script: script
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
