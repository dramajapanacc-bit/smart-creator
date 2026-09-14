export default async function handler(req, res) {
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
        error: "GEMINI_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကိုစစ်ပါ။"
      });
    }

    const body = req.body || {};

    const character = String(body.character || "Fruit Head");
    const story = String(body.story || "");
    const episode = String(body.episode || "1");
    const previous = String(body.previous || "");
    const mood = String(body.mood || "cinematic");

    if (!story.trim()) {
      return res.status(400).json({
        error: "Main Story ထည့်ပေးပါ။"
      });
    }

    const prompt = `
You are a professional Myanmar dialogue writer.

Create a short natural Myanmar Burmese dialogue for a Fruit Head video.

CHARACTER:
${character}

EPISODE:
${episode}

MAIN STORY:
${story}

MOOD:
${mood}

PREVIOUS EPISODE CONTEXT:
${previous || "No previous episode context."}

IMPORTANT RULES:

1. Write ONLY the Myanmar dialogue.
2. Use standard natural Myanmar Burmese.
3. Create approximately 2 to 4 short spoken lines.
4. The dialogue must directly match the story and episode.
5. Make it sound like real Myanmar people speaking.
6. Use natural everyday Myanmar words.
7. Use natural pauses where appropriate.
8. Do not write explanations.
9. Do not write English translations.
10. Do not use markdown.
11. Do not use character descriptions.
12. Do not add "Dialogue:".
13. Do not use Thai language.
14. Do not use Rakhine dialect.
15. Do not use Chinese pronunciation.
16. Do not make the characters shout.
17. Keep the dialogue short enough for an AI video.
`;

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },

      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini Error:", data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });
    }

    const dialogue =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!dialogue) {
      console.error("Empty Gemini response:", data);

      return res.status(500).json({
        error: "Gemini က Dialogue မပြန်ပေးပါ။"
      });
    }

    return res.status(200).json({
      ok: true,
      dialogue: dialogue
    });

  } catch (error) {
    console.error("fruit-dialogue server error:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Server error ဖြစ်နေပါတယ်။"
    });
  }
}
