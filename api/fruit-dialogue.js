export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      character = "",
      story = "",
      episode = "",
      mood = "",
      previous = ""
    } = req.body || {};

    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "GEMINI_API_KEY is not configured in Vercel."
      });
    }

    const prompt = `
Create a short natural Myanmar-language dialogue for a fruit character video.

Character:
${character}

Story:
${story}

Episode:
${episode}

Mood:
${mood}

Previous dialogue:
${previous}

Requirements:
- Write only the dialogue.
- Use natural spoken Myanmar language.
- Keep it short and suitable for a short video.
- Do not add explanations.
- Do not use markdown.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
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
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(response.status).json({
        ok: false,
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });
    }

    const dialogue =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

    if (!dialogue) {
      return res.status(500).json({
        ok: false,
        error: "Gemini returned an empty dialogue."
      });
    }

    return res.status(200).json({
      ok: true,
      dialogue
    });

  } catch (error) {
    console.error("fruit-dialogue error:", error);

    return res.status(500).json({
      ok: false,
      error: error?.message || "Internal server error."
    });
  }
}
