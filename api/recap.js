
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { text } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "Recap လုပ်မယ့်စာ ထည့်ပေးပါ။"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY မတွေ့ပါ။"
      });
    }

    const prompt = `
You are an expert movie/series recap writer.

Rewrite the following content into a clear, engaging Burmese Myanmar recap.

Rules:
- Write naturally in Burmese.
- Keep the important story events, characters, actions, conflicts and ending.
- Do not invent events that are not in the original text.
- Do not translate names unnecessarily.
- Make the narration suitable for a YouTube/movie recap voice-over.
- Use smooth, easy-to-listen Burmese sentences.
- Remove unnecessary repetition.
- Keep the story in the correct order.
- Do not add headings unless they are necessary.
- Output ONLY the recap text.

SOURCE:
${String(text).trim()}
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
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8000
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

      return res.status(500).json({
        error:
          data?.error?.message ||
          "Gemini Recap API Error ဖြစ်နေပါသည်။"
      });
    }

    const recap =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!recap) {
      console.error(
        "Gemini response:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error: "Gemini မှ Recap စာသား ပြန်မပေးပါ။"
      });
    }

    return res.status(200).json({
      recap: recap
    });

  } catch (error) {
    console.error(
      "Recap Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Recap ထုတ်ရာတွင် Error ဖြစ်နေပါသည်။"
    });
  }
}
