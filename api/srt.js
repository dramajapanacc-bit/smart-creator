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
      mimeType = "video/mp4",
      mode = "sentence"
    } = req.body || {};

    if (!fileName) {
      return res.status(400).json({
        error: "Gemini video file name မရပါ။"
      });
    }

    if (!String(fileName).startsWith("files/")) {
      return res.status(400).json({
        error: "Gemini file name မမှန်ပါ။"
      });
    }

    // --------------------------------------------------
    // 1. Wait until Gemini video is ACTIVE
    // --------------------------------------------------

    const fileInfoUrl =
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${encodeURIComponent(apiKey)}`;

    let file = null;

    const maxWait = 180000;
    const interval = 3000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < maxWait) {
      const response = await fetch(fileInfoUrl);

      if (!response.ok) {
        const text = await response.text();

        return res.status(response.status).json({
          error: text || "Gemini video information မရပါ။"
        });
      }

      file = await response.json();

      if (file?.state === "ACTIVE") {
        break;
      }

      if (file?.state === "FAILED") {
        return res.status(500).json({
          error: "Gemini က Video ကို process လုပ်မရပါ။"
        });
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }

    if (!file || file.state !== "ACTIVE") {
      return res.status(408).json({
        error: "Video processing အချိန်ကြာနေပါတယ်။ ခဏစောင့်ပြီး ထပ်စမ်းပါ။"
      });
    }

    if (!file.uri) {
      return res.status(500).json({
        error: "Gemini video URI မရပါ။"
      });
    }

    // --------------------------------------------------
    // 2. Ask Gemini for Burmese subtitles + timestamps
    // --------------------------------------------------

    const styleInstruction =
      mode === "short"
        ? `
Use short, natural Burmese subtitle sentences.
Keep each subtitle concise and easy to read.
`
        : `
Use natural Burmese sentences.
Keep subtitle lines reasonably short for movie subtitles.
`;

    const prompt = `
You are a professional movie subtitle translator.

Watch and understand the ENTIRE uploaded video.

Your task:
1. Listen to the spoken dialogue / narration in the video.
2. Understand the meaning and context.
3. Translate the spoken content naturally into Myanmar Burmese.
4. Create accurate subtitle timing based on where the speech occurs.
5. Cover the entire video where meaningful speech occurs.

IMPORTANT:
- Do NOT invent dialogue.
- Do NOT summarize the movie.
- Translate what is actually spoken.
- Preserve the meaning and order of the original speech.
- Do not add explanations.
- Do not add speaker names unless clearly necessary.
- Do not include markdown.
- Do not use ``` code fences.
- Use Burmese Unicode.
- Each subtitle must have a start time and end time.
- Do not overlap subtitle times.
- Keep each subtitle readable.
- Prefer approximately 1.5 to 7 seconds per subtitle.
- Break long dialogue into multiple subtitle entries.
- Do not create thousands of tiny subtitles.

${styleInstruction}

RETURN ONLY VALID JSON.

Use exactly this format:

[
  {
    "start": 0.0,
    "end": 3.5,
    "text": "မြန်မာစာတန်းထိုး"
  },
  {
    "start": 3.5,
    "end": 7.2,
    "text": "နောက်စာကြောင်း"
  }
]

The "start" and "end" values MUST be seconds as numbers.

Make sure:
- start < end
- entries are ordered chronologically
- timestamps match the actual video speech
- text is Myanmar Burmese
- JSON is valid
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
          ],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();

      console.error(
        "Gemini SRT generation error:",
        errorText
      );

      return res.status(generateResponse.status).json({
        error:
          errorText ||
          "Gemini က SRT data ထုတ်မပေးနိုင်ပါ။"
      });
    }

    const result = await generateResponse.json();

    const parts =
      result?.candidates?.[0]?.content?.parts || [];

    let rawText = parts
      .map(part => part?.text || "")
      .join("")
      .trim();

    if (!rawText) {
      return res.status(500).json({
        error: "Gemini က Subtitle data ပြန်မပေးပါ။"
      });
    }

    // Remove accidental markdown fences
    rawText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let subtitles;

    try {
      subtitles = JSON.parse(rawText);
    } catch (error) {
      console.error("SRT JSON parse error:", rawText);

      return res.status(500).json({
        error: "AI subtitle data format မမှန်ပါ။ ထပ်စမ်းကြည့်ပါ။"
      });
    }

    if (!Array.isArray(subtitles)) {
      return res.status(500).json({
        error: "Subtitle list မမှန်ပါ။"
      });
    }

    // --------------------------------------------------
    // 3. Clean subtitle entries
    // --------------------------------------------------

    const cleaned = [];

    for (const item of subtitles) {
      const start = Number(item?.start);
      const end = Number(item?.end);
      const text = String(item?.text || "")
        .replace(/\r/g, "")
        .replace(/\n+/g, " ")
        .trim();

      if (!Number.isFinite(start)) continue;
      if (!Number.isFinite(end)) continue;
      if (!text) continue;
      if (end <= start) continue;

      cleaned.push({
        start,
        end,
        text
      });
    }

    cleaned.sort((a, b) => a.start - b.start);

    if (!cleaned.length) {
      return res.status(500).json({
        error: "အသုံးပြုနိုင်တဲ့ Subtitle မရရှိပါ။"
      });
    }

    // Prevent overlapping subtitles
    for (let i = 0; i < cleaned.length - 1; i++) {
      if (cleaned[i].end > cleaned[i + 1].start) {
        cleaned[i].end = cleaned[i + 1].start;
      }

      if (cleaned[i].end <= cleaned[i].start) {
        cleaned[i].end = cleaned[i].start + 0.5;
      }
    }

    // --------------------------------------------------
    // 4. Convert seconds -> SRT timestamp
    // --------------------------------------------------

    function srtTime(seconds) {
      seconds = Math.max(0, Number(seconds) || 0);

      const hours = Math.floor(seconds / 3600);

      const minutes = Math.floor(
        (seconds % 3600) / 60
      );

      const secs = Math.floor(seconds % 60);

      const milliseconds = Math.round(
        (seconds - Math.floor(seconds)) * 1000
      );

      let ms = milliseconds;

      let s = secs;
      let m = minutes;
      let h = hours;

      if (ms >= 1000) {
        ms = 0;
        s++;
      }

      if (s >= 60) {
        s = 0;
        m++;
      }

      if (m >= 60) {
        m = 0;
        h++;
      }

      return (
        String(h).padStart(2, "0") +
        ":" +
        String(m).padStart(2, "0") +
        ":" +
        String(s).padStart(2, "0") +
        "," +
        String(ms).padStart(3, "0")
      );
    }

    // --------------------------------------------------
    // 5. Build SRT
    // --------------------------------------------------

    const srt = cleaned
      .map((item, index) => {
        return (
          `${index + 1}\n` +
          `${srtTime(item.start)} --> ${srtTime(item.end)}\n` +
          `${item.text}\n`
        );
      })
      .join("\n")
      .trim();

    return res.status(200).json({
      success: true,
      count: cleaned.length,
      srt
    });

  } catch (error) {
    console.error("SRT API error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "SRT Generate ပြုလုပ်ရာတွင် အမှားဖြစ်နေပါတယ်။"
    });
  }
}
