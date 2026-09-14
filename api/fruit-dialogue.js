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

    const character = String(body.character || "Banana Head, Watermelon Head, Mango Head");
    const story = String(body.story || "");
    const episode = String(body.episode || "1");
    const previous = String(body.previous || "");
    const mood = String(body.mood || "Funny Comedy");

    if (!story.trim()) {
      return res.status(400).json({
        error: "Main Story ထည့်ပေးပါ။"
      });
    }

    const prompt = `
You are a professional AI video prompt writer specializing in funny anthropomorphic fruit characters.

Create THREE production-ready prompts from the story.

CHARACTERS:
${character}

EPISODE:
${episode}

MAIN STORY:
${story}

MOOD:
${mood}

PREVIOUS CONTEXT:
${previous || "None"}

IMPORTANT:

The characters are anthropomorphic fruits with fruit-shaped heads and expressive human-like faces.

Create exactly these THREE sections:

PHOTO PROMPT:
A production-ready image prompt for Flow AI.
Describe the fruit characters, appearance, location, action, facial expressions, lighting, camera and composition.
Do NOT include dialogue.
Do NOT include subtitles or text.

FLOW VIDEO PROMPT:
A production-ready video prompt for Flow AI.
Include character actions, camera movement, facial expressions and short natural Burmese dialogue.
The Burmese dialogue must be spoken by the correct character.
Use clear natural Burmese.
Include natural lip sync.
Keep dialogue short.
No subtitles.
No text on screen.

VEO VIDEO PROMPT:
A production-ready video prompt for Google Veo.
MUST be 900 characters or fewer.
Include the most important character actions, camera movement and short Burmese dialogue.
Use clear natural Burmese speech and accurate lip sync.
Keep the dialogue very short so the complete prompt stays under 900 characters.
No subtitles.
No text on screen.

VERY IMPORTANT FOR VEO:
The VEO VIDEO PROMPT MUST NEVER exceed 900 characters.
Count characters before returning it.
If it is too long, rewrite it shorter.
Do not remove the Burmese dialogue unless absolutely necessary.
Use concise English instructions and short Burmese dialogue.

OUTPUT FORMAT:

PHOTO PROMPT:
[photo prompt]

FLOW VIDEO PROMPT:
[flow video prompt]

VEO VIDEO PROMPT:
[veo prompt]

Do not add any explanation before or after these sections.
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
          maxOutputTokens: 1200
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

    let output =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!output) {
      console.error("Empty Gemini response:", data);

      return res.status(500).json({
        error: "Gemini က Prompt မပြန်ပေးပါ။"
      });
    }

    // --------------------------------------------------
    // Extract sections
    // --------------------------------------------------

    const photoMatch = output.match(
      /PHOTO PROMPT:\s*([\s\S]*?)(?=\n\s*FLOW VIDEO PROMPT:|$)/i
    );

    const flowMatch = output.match(
      /FLOW VIDEO PROMPT:\s*([\s\S]*?)(?=\n\s*VEO VIDEO PROMPT:|$)/i
    );

    const veoMatch = output.match(
      /VEO VIDEO PROMPT:\s*([\s\S]*)$/i
    );

    let photoPrompt = photoMatch
      ? photoMatch[1].trim()
      : "";

    let flowVideoPrompt = flowMatch
      ? flowMatch[1].trim()
      : "";

    let veoVideoPrompt = veoMatch
      ? veoMatch[1].trim()
      : "";

    // --------------------------------------------------
    // Fallback if Gemini formatting is imperfect
    // --------------------------------------------------

    if (!photoPrompt || !flowVideoPrompt || !veoVideoPrompt) {
      console.error("Invalid Gemini format:", output);

      return res.status(500).json({
        error: "Gemini Prompt format မမှန်ပါ။ ထပ်မံ Generate လုပ်ပါ။"
      });
    }

    // --------------------------------------------------
    // Remove accidental markdown code fences
    // --------------------------------------------------

    const clean = (text) => {
      return text
        .replace(/^```[a-zA-Z]*\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    };

    photoPrompt = clean(photoPrompt);
    flowVideoPrompt = clean(flowVideoPrompt);
    veoVideoPrompt = clean(veoVideoPrompt);

    // --------------------------------------------------
    // HARD 900 CHARACTER LIMIT FOR VEO
    // --------------------------------------------------

    if (veoVideoPrompt.length > 900) {
      const shortenPrompt = `
Shorten the following Google Veo video prompt to EXACTLY 900 characters or fewer.

Keep:
- Burmese dialogue
- Character identities
- Main action
- Natural Burmese speech
- Accurate lip sync
- Important camera movement
- Funny mood

Remove unnecessary descriptions.

Do NOT add explanations.
Return ONLY the shortened Veo prompt.

PROMPT:
${veoVideoPrompt}
`;

      const shortenResponse = await fetch(url, {
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
                  text: shortenPrompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500
          }
        })
      });

      const shortenData = await shortenResponse.json();

      if (shortenResponse.ok) {
        const shortened =
          shortenData?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

        if (shortened) {
          veoVideoPrompt = clean(shortened);
        }
      }
    }

    // --------------------------------------------------
    // FINAL SAFETY LIMIT
    // --------------------------------------------------

    if (veoVideoPrompt.length > 900) {
      veoVideoPrompt = veoVideoPrompt
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 900)
        .trim();
    }

    // --------------------------------------------------
    // Return all 3 prompts
    // --------------------------------------------------

    return res.status(200).json({
      ok: true,

      photoPrompt,

      flowVideoPrompt,

      veoVideoPrompt,

      veoCharacters: veoVideoPrompt.length,

      // Keep old frontend compatibility
      dialogue: `
PHOTO PROMPT:
${photoPrompt}

FLOW VIDEO PROMPT:
${flowVideoPrompt}

VEO VIDEO PROMPT:
${veoVideoPrompt}
`
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
