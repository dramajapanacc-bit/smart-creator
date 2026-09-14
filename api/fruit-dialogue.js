export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      character = "",
      story = "",
      episode = "1",
      previous = "",
      mood = "funny comedy",
      ratio = "16:9",
      ai = "veo",
      dialogueMode = "auto",
      dialogue = ""
    } = req.body || {};

    if (!character.trim()) {
      return res.status(400).json({
        success: false,
        error: "Character is required"
      });
    }

    if (!story.trim()) {
      return res.status(400).json({
        success: false,
        error: "Story is required"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured"
      });
    }

    const isFlow = String(ai).toLowerCase() === "flow";

    // =========================================================
    // UNIVERSAL CHARACTER LOCK
    // =========================================================

    const characterLock = `
UNIVERSAL CHARACTER CONSISTENCY LOCK:

The character description supplied by the user is the MASTER CHARACTER DESIGN.

Keep the exact same:
- fruit head shape
- fruit color
- facial structure
- eyes
- eyebrows
- nose
- mouth
- body proportions
- arms
- hands
- legs
- shoes
- clothing
- clothing colors
- accessories
- age appearance
- body size
- visual identity

Do NOT redesign the character between scenes.

If multiple characters are present, lock EVERY character separately.

Do not replace fruit heads with normal human heads.

The characters must remain anthropomorphic fruit characters:
fruit-shaped head + human-like body + human-like arms and legs.

Only change pose, facial expression, movement and action when the story requires it.
`;

    const continuityRules = `
SCENE CONTINUITY RULE:

Every scene must continue naturally from the previous scene.

Scene 2 must feel like the immediate continuation of Scene 1.
Scene 3 must continue from Scene 2, and so on.

Never restart the story from the beginning.

Keep the same:
- characters
- clothing
- environment
- time of day
- lighting style
- cinematic style
- camera world
- visual identity

Only change the action/pose when the story progresses.

For every new scene, explicitly preserve the previous scene's character identity and environment.
`;

    const speechRules = `
STANDARD MYANMAR SPEECH RULE:

All spoken dialogue must be natural spoken Myanmar Burmese.

Use normal Myanmar conversational wording.

Do NOT use:
- English dialogue
- romanized Burmese
- strange machine-like Burmese
- overly formal written Burmese

Dialogue must sound like a real person speaking naturally.

For a 10-second scene, keep dialogue SHORT.

Usually 1 short sentence or 2 very short sentences.

The character must finish speaking naturally within the 10-second clip.

Use natural lip-sync.
`;

    // =========================================================
    // FLOW
    // =========================================================

    let prompt = "";

    if (isFlow) {
      prompt = `
You are an expert prompt writer for Google Flow AI.

Create a complete multi-scene story prompt package.

The user's story is:

${story}

MAIN CHARACTER DESIGN:
${character}

MOOD:
${mood}

ASPECT RATIO:
${ratio}

EPISODE:
${episode}

PREVIOUS STORY CONTEXT:
${previous || "None"}

DIALOGUE MODE:
${dialogueMode}

USER PROVIDED DIALOGUE:
${dialogue || "None"}

${characterLock}

${continuityRules}

${speechRules}

FLOW REQUIREMENTS:

Each scene must be exactly 10 seconds.

Break the story naturally into 10-second scenes.

Do NOT put dialogue inside PHOTO PROMPT.

PHOTO PROMPT is ONLY for creating the still image/reference image.

VIDEO PROMPT MUST contain the spoken Myanmar dialogue.

The VIDEO PROMPT must describe:
- exact same character
- exact same appearance
- environment
- action
- camera movement
- facial expression
- natural body movement
- natural lip-sync
- spoken Myanmar dialogue
- cinematic realism
- 10-second duration

IMPORTANT:

Scene 1 establishes the complete visual identity.

Scene 2 must explicitly continue from Scene 1.

Scene 2 PHOTO PROMPT must say that it is the SAME EXACT CHARACTER from Scene 1 and preserve the same appearance.

Scene 2 VIDEO PROMPT must continue the action directly from Scene 1.

Do the same for every later scene.

If a scene has no dialogue naturally, use a very short natural reaction sound or short Burmese line instead.

Do not create unnecessary dialogue.

OUTPUT FORMAT:

SCENE 1
PHOTO PROMPT:
...

VIDEO PROMPT:
...

SCENE 2
PHOTO PROMPT:
...

VIDEO PROMPT:
...

SCENE 3
PHOTO PROMPT:
...

VIDEO PROMPT:
...

Continue until the entire story is covered.

Do not add explanations.
Do not add markdown tables.
Return only the scene prompts.
`;
    } else {
      // =======================================================
      // VEO
      // =======================================================

      prompt = `
You are an expert Google Veo video prompt writer.

Create a complete multi-scene video prompt from this story.

STORY:
${story}

CHARACTER:
${character}

MOOD:
${mood}

ASPECT RATIO:
${ratio}

EPISODE:
${episode}

PREVIOUS STORY:
${previous || "None"}

DIALOGUE MODE:
${dialogueMode}

USER DIALOGUE:
${dialogue || "None"}

${characterLock}

${continuityRules}

${speechRules}

VEO REQUIREMENTS:

Create 10-second scenes.

Each scene MUST be 900 characters or fewer.

Every scene must continue naturally from the previous scene.

Keep exact character appearance and clothing consistent.

The character must remain an anthropomorphic fruit character.

Each scene may contain short natural Myanmar dialogue.

Dialogue must be inside the VIDEO PROMPT.

Do not create separate photo prompts.

OUTPUT EXACTLY:

SCENE 1:
...

SCENE 2:
...

SCENE 3:
...

Continue until the entire story is covered.

No explanations.
`;
    }

    // =========================================================
    // GEMINI MODEL FALLBACK
    // =========================================================

    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash"
    ];

    let result = null;
    let lastError = null;

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
                temperature: 0.8,
                maxOutputTokens: 7000
              }
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          lastError = data?.error?.message || `HTTP ${response.status}`;
          continue;
        }

        const text =
          data?.candidates?.[0]?.content?.parts
            ?.map(p => p.text || "")
            .join("")
            .trim();

        if (!text) {
          lastError = "AI returned empty response";
          continue;
        }

        result = text;
        break;
      } catch (err) {
        lastError = err.message;
      }
    }

    if (!result) {
      return res.status(500).json({
        success: false,
        error: lastError || "AI generation failed"
      });
    }

    // =========================================================
    // FLOW PARSER
    // =========================================================

    if (isFlow) {
      const scenes = [];

      const sceneRegex =
        /SCENE\s*(\d+)\s*[\r\n]+PHOTO PROMPT:\s*([\s\S]*?)\s*VIDEO PROMPT:\s*([\s\S]*?)(?=\s*SCENE\s*\d+\s*[\r\n]+PHOTO PROMPT:|$)/gi;

      let match;

      while ((match = sceneRegex.exec(result)) !== null) {
        const sceneNumber = Number(match[1]);

        const photoPrompt = match[2]
          .trim()
          .replace(/^["']|["']$/g, "");

        const videoPrompt = match[3]
          .trim()
          .replace(/^["']|["']$/g, "");

        if (photoPrompt || videoPrompt) {
          scenes.push({
            scene: sceneNumber,
            duration: "10 sec",
            photoPrompt,
            videoPrompt
          });
        }
      }

      // Fallback if parser misses the format
      if (!scenes.length) {
        scenes.push({
          scene: 1,
          duration: "10 sec",
          photoPrompt: result,
          videoPrompt: result
        });
      }

      return res.status(200).json({
        success: true,
        ai: "flow",
        scenes,

        // Compatibility with older frontend
        photoPrompt: scenes
          .map(s => `SCENE ${s.scene}\n${s.photoPrompt}`)
          .join("\n\n"),

        flowVideoPrompt: scenes
          .map(s => `SCENE ${s.scene}\n${s.videoPrompt}`)
          .join("\n\n")
      });
    }

    // =========================================================
    // VEO PARSER
    // =========================================================

    const scenes = [];

    const veoRegex =
      /SCENE\s*(\d+)\s*:\s*([\s\S]*?)(?=\s*SCENE\s*\d+\s*:|$)/gi;

    let match;

    while ((match = veoRegex.exec(result)) !== null) {
      const sceneNumber = Number(match[1]);

      let scenePrompt = match[2]
        .trim()
        .replace(/^["']|["']$/g, "");

      // Hard safety compression for Veo
      if (scenePrompt.length > 900) {
        scenePrompt = scenePrompt.slice(0, 900).trim();
      }

      scenes.push({
        scene: sceneNumber,
        duration: "10 sec",
        prompt: scenePrompt,
        characters: scenePrompt.length
      });
    }

    if (!scenes.length) {
      let fallback = result.trim();

      if (fallback.length > 900) {
        fallback = fallback.slice(0, 900).trim();
      }

      scenes.push({
        scene: 1,
        duration: "10 sec",
        prompt: fallback,
        characters: fallback.length
      });
    }

    return res.status(200).json({
      success: true,
      ai: "veo",
      scenes
    });

  } catch (error) {
    console.error("fruit-dialogue error:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Server error"
    });
  }
}
