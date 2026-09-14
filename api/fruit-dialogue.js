export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    const body = req.body || {};

    const character = String(body.character || "Fruit Head").trim();
    const story = String(body.story || "").trim();
    const episode = Math.max(1, Number(body.episode || 1));
    const previous = String(body.previous || "").trim();
    const mood = String(body.mood || "funny comedy").trim();
    const ratio = String(body.ratio || "9:16").trim();

    const ai = String(body.ai || "veo").toLowerCase();
    const dialogueMode = String(body.dialogueMode || "auto").toLowerCase();
    const customDialogue = String(body.dialogue || "").trim();

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "GEMINI_API_KEY is missing"
      });
    }

    if (!story) {
      return res.status(400).json({
        ok: false,
        error: "Main story is required"
      });
    }

    // =========================
    // DIALOGUE RULE
    // =========================

    let dialogueRule = `
Create 2-4 short, natural Myanmar Burmese spoken lines.
Use standard Myanmar Burmese.
Make the speech sound natural and conversational.
Use accurate lip-sync.
`;

    if (dialogueMode === "none") {
      dialogueRule = `
No spoken dialogue.
Use only natural facial reactions, body movement and environmental sounds.
`;
    }

    if (dialogueMode === "custom" && customDialogue) {
      dialogueRule = `
Use ONLY this Myanmar dialogue:

${customDialogue}

Do not invent additional spoken dialogue.
`;
    }

    // =========================
    // CHARACTER CONTINUITY
    // =========================

    const continuity = `
CHARACTER CONTINUITY:

The characters are anthropomorphic Fruit Head human characters.

They must have:
- Real fruit-shaped heads
- Human-like faces
- Human eyes
- Human mouth
- Human body
- Human arms
- Human legs
- Same fruit type
- Same face
- Same clothing
- Same colors
- Same hairstyle
- Same body proportions
- Same identity throughout every scene

IMPORTANT:
Do NOT turn them into normal humans.
Do NOT turn them into ordinary fruit.
Keep the fruit head + human body design.
`;

    // =========================
    // MAIN PROMPT
    // =========================

    let prompt = "";

    if (ai === "flow") {

      prompt = `
You are a professional Flow AI prompt writer.

${continuity}

Character:
${character}

Episode:
${episode}

Mood:
${mood}

Aspect ratio:
${ratio}

${episode > 1 ? `
Previous episode context:
${previous}
` : ""}

MAIN STORY:
${story}

Create TWO separate outputs.

OUTPUT 1 — PHOTO PROMPT

Create a cinematic still-image prompt.

Include:
- Exact Fruit Head character
- Face
- Fruit type
- Human body
- Clothing
- Environment
- Background
- Lighting
- Camera composition
- Visual style
- Character consistency

IMPORTANT:
The PHOTO PROMPT must contain NO dialogue.
The PHOTO PROMPT must describe a still image only.

OUTPUT 2 — FLOW VIDEO PROMPT

Create a short video prompt based on the same character and scene.

Include:
- Character action
- Facial expressions
- Body movement
- Camera movement
- Environment
- Natural Myanmar Burmese dialogue
- Speaker names
- Accurate lip-sync
- Natural voice
- Ambient sound

${dialogueRule}

Return exactly:

PHOTO PROMPT:
[photo prompt]

FLOW VIDEO PROMPT:
[video prompt]
`;

    } else {

      prompt = `
You are a professional Google Veo video prompt writer.

${continuity}

Character:
${character}

Episode:
${episode}

Mood:
${mood}

Aspect ratio:
${ratio}

${episode > 1 ? `
Previous episode context:
${previous}
` : ""}

MAIN STORY:
${story}

Create separate Google Veo video prompts.

IMPORTANT RULES:

1. Every scene is exactly 10 seconds.
2. Each scene must describe only actions that can happen in 10 seconds.
3. Each scene MUST be 900 characters or less.
4. Video prompts ONLY.
5. Do NOT create photo prompts.
6. Keep the same Fruit Head character in every scene.
7. Do not change fruit type.
8. Do not change face.
9. Do not change clothing.
10. Do not change identity.
11. Include natural Myanmar Burmese dialogue when enabled.
12. Dialogue must be short enough for a 10-second video.
13. Include accurate lip-sync.
14. No subtitles.
15. No logos.
16. No watermark.
17. Do not repeat the entire story in every scene.
18. Cover the complete story across all scenes.
19. Use cinematic camera movement.
20. Use natural facial expressions and body movement.

${dialogueRule}

Return exactly:

SCENE 1 — 10 SEC
[video prompt]

SCENE 2 — 10 SEC
[video prompt]

SCENE 3 — 10 SEC
[video prompt]

Continue until the complete story is covered.
`;
    }

    // =========================
    // GEMINI MODEL FALLBACK
    // =========================

    const models = [
      "gemini-3.8-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash"
    ];

    let data = null;
    let lastError = "";

    for (const model of models) {

      let success = false;

      for (let attempt = 1; attempt <= 2; attempt++) {

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
                  temperature: 0.75,
                  maxOutputTokens: 6000
                }
              })
            }
          );

          data = await response.json();

          if (response.ok) {
            success = true;
            break;
          }

          lastError =
            data?.error?.message ||
            `Gemini ${model} failed`;

          // Retry only temporary errors
          if (
            response.status === 429 ||
            response.status === 500 ||
            response.status === 502 ||
            response.status === 503 ||
            response.status === 504
          ) {
            await new Promise(resolve =>
              setTimeout(resolve, 1200 * attempt)
            );

            continue;
          }

          break;

        } catch (error) {

          lastError =
            error?.message ||
            "Gemini request failed";

          await new Promise(resolve =>
            setTimeout(resolve, 1000)
          );
        }
      }

      if (success) {
        break;
      }
    }

    // =========================
    // ALL MODELS FAILED
    // =========================

    if (
      !data ||
      !data?.candidates?.[0]?.content?.parts
    ) {

      return res.status(503).json({
        ok: false,
        error:
          "Gemini models are temporarily busy. Please try again in a moment.",
        details: lastError
      });
    }

    // =========================
    // GET GENERATED TEXT
    // =========================

    const text =
      data.candidates[0].content.parts
        .map(part => part.text || "")
        .join("")
        .trim();

    if (!text) {
      return res.status(500).json({
        ok: false,
        error: "Gemini returned empty result"
      });
    }

    // =========================
    // FLOW AI RESULT
    // =========================

    if (ai === "flow") {

      const photoMatch = text.match(
        /PHOTO\s*PROMPT\s*:\s*([\s\S]*?)(?=FLOW\s*VIDEO\s*PROMPT\s*:|$)/i
      );

      const flowMatch = text.match(
        /FLOW\s*VIDEO\s*PROMPT\s*:\s*([\s\S]*)$/i
      );

      const photoPrompt =
        (
          photoMatch?.[1] || ""
        )
          .replace(/\s+/g, " ")
          .trim();

      const flowVideoPrompt =
        (
          flowMatch?.[1] || text
        )
          .replace(/\s+/g, " ")
          .trim();

      return res.status(200).json({
        ok: true,
        photoPrompt,
        flowVideoPrompt,
        veoVideoPrompt: "",
        veoCharacters: flowVideoPrompt.length,
        scenes: []
      });
    }

    // =========================
    // VEO RESULT
    // =========================

    const scenes = [];

    const regex =
      /SCENE\s*(\d+)\s*[—-]\s*10\s*SEC\s*([\s\S]*?)(?=SCENE\s*\d+\s*[—-]\s*10\s*SEC|$)/gi;

    let match;

    while ((match = regex.exec(text)) !== null) {

      let scenePrompt =
        match[2]
          .replace(/\s+/g, " ")
          .trim();

      // HARD 900 CHARACTER LIMIT
      if (scenePrompt.length > 900) {
        scenePrompt =
          scenePrompt
            .slice(0, 900)
            .trim();
      }

      scenes.push({
        scene: Number(match[1]),
        duration: 10,
        prompt: scenePrompt,
        characters: scenePrompt.length
      });
    }

    // =========================
    // FALLBACK SCENE
    // =========================

    if (!scenes.length) {

      let scenePrompt =
        text
          .replace(/\s+/g, " ")
          .trim();

      if (scenePrompt.length > 900) {
        scenePrompt =
          scenePrompt
            .slice(0, 900)
            .trim();
      }

      scenes.push({
        scene: 1,
        duration: 10,
        prompt: scenePrompt,
        characters: scenePrompt.length
      });
    }

    // =========================
    // FINAL RESPONSE
    // =========================

    return res.status(200).json({
      ok: true,

      photoPrompt: "",

      flowVideoPrompt: "",

      veoVideoPrompt:
        scenes[0]?.prompt || "",

      veoCharacters:
        scenes[0]?.prompt?.length || 0,

      scenes,

      totalScenes:
        scenes.length,

      totalDuration:
        scenes.length * 10
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Server error"
    });
  }
}
