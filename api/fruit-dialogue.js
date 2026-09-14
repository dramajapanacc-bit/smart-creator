export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      character = "",
      story = "",
      episode = "1",
      mood = "cinematic",
      previous = ""
    } = req.body || {};

    if (!story.trim()) {
      return res.status(400).json({
        error: "Main Story ထည့်ပေးပါ။"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY ကို Vercel Environment Variables ထဲမှာ ထည့်ပါ။"
      });
    }

    const prompt = `
You are a professional Myanmar movie dialogue writer.

Create natural spoken Myanmar Burmese dialogue based ONLY on the story information below.

CHARACTER:
${character || "Fruit Head"}

EPISODE:
${episode}

MOOD:
${mood}

PREVIOUS EPISODE:
${previous || "None"}

MAIN STORY:
${story}

IMPORTANT:
- Write the dialogue in natural standard Myanmar Burmese.
- Make the dialogue follow the story exactly.
- Do NOT change the main story.
- Do NOT invent unrelated events.
- Use the characters from the story.
- Create approximately 2–4 short dialogue lines.
- Each line must clearly identify the speaker.
- Dialogue should sound natural when spoken in a video.
- Keep each line short enough for AI video lip-sync.
- Match the selected mood.
- Use emotional delivery appropriate to the scene.
- If the scene is horror, make the speech tense and mysterious.
- If comedy, make it funny and natural.
- If sad, make it emotional.
- If romance, make it gentle and emotional.
- If action, make it energetic and urgent.
- If cinematic, make it dramatic and realistic.
- Do not use English unless it is a character name or absolutely necessary.
- Output ONLY the dialogue.
- Do not add explanations.
- Do not add markdown.
- Do not add quotation marks around every line.

Example format:

Fruit Head: ဒီနေရာမှာ ဘယ်သူရှိတာလဲ...
Unknown Voice: မင်း ဒီကို မလာသင့်ဘူး...
Fruit Head: ဘယ်သူလဲ။ ထွက်လာခဲ့။

Now create the Myanmar dialogue.
`;

    const model = "gemini-2.5-flash";

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const response = await fetch(endpoint, {
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
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 500
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Dialogue Error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Myanmar Dialogue AI Generate မအောင်မြင်ပါ။"
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!text) {
      return res.status(500).json({
        error: "AI က Dialogue မထုတ်ပေးနိုင်ပါ။"
      });
    }

    return res.status(200).json({
      ok: true,
      dialogue: text
    });

  } catch (error) {
    console.error("Fruit Dialogue Error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Myanmar Dialogue Generate မအောင်မြင်ပါ။"
    });
  }
}
