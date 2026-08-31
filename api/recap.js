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

    const cleanText = String(text)
      .trim()
      .slice(0, 50000);

    const prompt = `
You are an expert Myanmar movie recap writer.

Rewrite the source below into a natural, engaging Burmese Myanmar movie recap script.

Rules:
- Write ONLY Burmese Myanmar narration.
- Keep the original story events in correct order.
- Keep important characters, actions, conflicts and ending.
- Do not invent events.
- Do not translate character names unnecessarily.
- Make the narration smooth and suitable for voice-over.
- Remove unnecessary repetition.
- Do not add explanations or comments.
- Output ONLY the final recap script.

SOURCE:
${cleanText}
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

      return res.status(
        response.status || 500
      ).json({
        error:
          data?.error?.message ||
          "Gemini Recap API Error ဖြစ်နေပါသည်။"
      });
    }

    const parts =
      data?.candidates?.[0]
        ?.content
        ?.parts || [];

    const recap = parts
      .map(part => part?.text || "")
      .join("")
      .trim();

    if (!recap) {
      console.error(
        "Gemini Empty Response:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error:
          "Gemini မှ Recap Script ပြန်မပေးပါ။"
      });
    }

    return res.status(200).json({
      script: recap
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
