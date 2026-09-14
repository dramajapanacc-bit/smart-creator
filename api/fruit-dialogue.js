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
      episode = "",
      previous = "",
      mood = "Funny comedy",
      ratio = "16:9",
      ai = "veo",
      dialogueMode = "auto",
      dialogue = ""
    } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in Vercel."
      });
    }

    if (!character || !story) {
      return res.status(400).json({
        error: "Character and story are required."
      });
    }

    const isFlow = ai === "flow";

    const languageRules = `
SPOKEN LANGUAGE RULES:
- Spoken dialogue MUST be natural Standard Myanmar Burmese.
- Use a neutral Central Myanmar / Yangon-style Burmese accent.
- DO NOT use Rakhine accent or Rakhine dialect.
- DO NOT use Shan, Mon, Karen, or other regional dialect pronunciation.
- Pronounce Burmese words clearly and naturally like a native speaker from central Myanmar.
- The character must speak exactly the Burmese words written in the dialogue.
- Do not translate the dialogue into English.
- Do not romanize Burmese.
- Do not invent a different dialect.
`;

    let prompt = "";

    if (isFlow) {
      prompt = `
Create two production-ready prompts for an AI video generator.

CHARACTER:
${character}

STORY:
${story}

EPISODE:
${episode || "Episode 1"}

PREVIOUS CONTEXT:
${previous || "None"}

MOOD:
${mood}

ASPECT RATIO:
${ratio}

DIALOGUE MODE:
${dialogueMode}

USER DIALOGUE:
${dialogue || "Create natural dialogue yourself."}

${languageRules}

IMPORTANT:
The characters MUST be anthropomorphic fruit characters.
Their heads must actually look like fruit while their bodies are human-like.
Do not turn them into normal human characters.

Create exactly these two outputs:

PHOTO PROMPT:
Create a concise image-generation prompt describing the fruit characters, appearance, clothing, environment, lighting, camera framing and visual style.
Do NOT include dialogue in the PHOTO PROMPT.

FLOW VIDEO PROMPT:
Create one concise video-generation prompt directly usable in Flow.
Include the character action and natural Burmese spoken dialogue.
Use only very short Burmese dialogue.
Use at most ONE short spoken sentence per character.
The dialogue should be short enough to finish naturally within the clip.
Do not add subtitles, captions, text, logos or watermarks.
Do not include explanations or meta instructions outside the actual video prompt.

Return exactly:

PHOTO PROMPT:
...

FLOW VIDEO PROMPT:
...
`;

    } else {
      prompt = `
Create production-ready Google Veo video prompts for a fruit-head comedy story.

CHARACTER:
${character}

STORY:
${story}

EPISODE:
${episode || "Episode 1"}

PREVIOUS CONTEXT:
${previous || "None"}

MOOD:
${mood}

ASPECT RATIO:
${ratio}

DIALOGUE MODE:
${dialogueMode}

USER DIALOGUE:
${dialogue || "Create natural dialogue yourself."}

${languageRules}

VERY IMPORTANT VEO SPEECH RULES:

1. Split the story into separate scenes.
2. Every scene MUST be exactly 10 seconds.
3. Each scene must contain only ONE very short Burmese spoken line.
4. The spoken line should normally be about 3-8 Burmese words.
5. Never create long Burmese sentences.
6. The character MUST finish the entire spoken line within the first 5 seconds.
7. After the dialogue finishes, the character should only perform facial expressions, reactions or physical action.
8. Do NOT stretch the Burmese pronunciation.
9. Do NOT add unnecessary pauses between Burmese words.
10. Do NOT repeat the dialogue.
11. Do NOT continue speaking after the sentence is complete.
12. Use neutral Standard Myanmar Burmese with a Central Myanmar / Yangon-style accent.
13. ABSOLUTELY NO RAKHINE ACCENT OR RAKHINE DIALECT.
14. The written Burmese dialogue must be spoken exactly as written.
15. Do not translate Burmese dialogue into English.
16. Do not romanize Burmese.
17. Do not add subtitles, captions, text, logos or watermarks.

IMPORTANT CHARACTER RULE:
The characters are anthropomorphic fruits.
Their heads must visibly be fruit-shaped.
They have human-like bodies, arms and legs.
Do NOT turn them into ordinary human characters.

Keep each complete scene prompt under 850 characters so the final prompt stays safely below Veo's 900-character limit.

Use this exact format:

SCENE 1 — 10 SEC
[concise visual action]. [Character] says in natural Standard Myanmar Burmese with a neutral Yangon/Central Myanmar accent: "SHORT BURMESE DIALOGUE". The character finishes speaking within the first 5 seconds, then continues the physical action or reaction.

SCENE 2 — 10 SEC
[concise visual action]. [Character] says in natural Standard Myanmar Burmese with a neutral Yangon/Central Myanmar accent: "SHORT BURMESE DIALOGUE". The character finishes speaking within the first 5 seconds, then continues the physical action or reaction.

Continue until the whole story is covered.

Do not put multiple long dialogue lines into one scene.
`;

    }

    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash"
    ];

    let lastError = null;
    let result = null;

    for (const model of models) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
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
                maxOutputTokens: 6000
              }
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          lastError = data;
          continue;
        }

        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim() || "";

        if (!text) {
          lastError = {
            error: "Gemini returned an empty response."
          };
          continue;
        }

        result = text;
        break;

      } catch (err) {
        lastError = {
          error: err.message
        };
      }
    }

    if (!result) {
      return res.status(500).json({
        error: "Gemini API failed.",
        details: lastError
      });
    }

    if (isFlow) {
      const photoMatch = result.match(
        /PHOTO PROMPT\s*:\s*([\s\S]*?)(?=FLOW VIDEO PROMPT\s*:|$)/i
      );

      const flowMatch = result.match(
        /FLOW VIDEO PROMPT\s*:\s*([\s\S]*)/i
      );

      const photoPrompt = photoMatch
        ? photoMatch[1].trim()
        : "";

      const flowVideoPrompt = flowMatch
        ? flowMatch[1].trim()
        : result.trim();

      return res.status(200).json({
        success: true,
        ai: "flow",
        photoPrompt,
        flowVideoPrompt
      });
    }

    // ---------------------------------------
    // VEO SCENE PARSER
    // ---------------------------------------

    const sceneRegex =
      /SCENE\s*(\d+)\s*[—-]\s*10\s*SEC([\s\S]*?)(?=SCENE\s*\d+\s*[—-]\s*10\s*SEC|$)/gi;

    const scenes = [];
    let match;

    while ((match = sceneRegex.exec(result)) !== null) {
      let sceneNumber = Number(match[1]);
      let sceneText = match[2].trim();

      if (!sceneText) continue;

      /*
       * Safety cleanup.
       * Keep each scene comfortably below 900 characters.
       * We prefer cutting at sentence boundaries rather than
       * cutting through the Burmese dialogue.
       */

      if (sceneText.length > 850) {
        const possible = sceneText.slice(0, 850);

        const sentenceEnd = Math.max(
          possible.lastIndexOf("။"),
          possible.lastIndexOf("."),
          possible.lastIndexOf("”"),
          possible.lastIndexOf('"')
        );

        if (sentenceEnd > 500) {
          sceneText = possible.slice(0, sentenceEnd + 1);
        } else {
          sceneText = possible;
        }
      }

      scenes.push({
        scene: sceneNumber,
        duration: "10 sec",
        prompt: `SCENE ${sceneNumber} — 10 SEC\n${sceneText}`
      });
    }

    // Fallback if Gemini did not follow scene format
    if (scenes.length === 0) {
      let fallback = result.trim();

      if (fallback.length > 850) {
        fallback = fallback.slice(0, 850);
      }

      scenes.push({
        scene: 1,
        duration: "10 sec",
        prompt: `SCENE 1 — 10 SEC\n${fallback}`
      });
    }

    return res.status(200).json({
      success: true,
      ai: "veo",
      scenes,
      veoVideoPrompt: scenes
        .map(item => item.prompt)
        .join("\n\n")
    });

  } catch (error) {
    console.error("fruit-dialogue error:", error);

    return res.status(500).json({
      error: "Server error.",
      details: error.message
    });
  }
}
