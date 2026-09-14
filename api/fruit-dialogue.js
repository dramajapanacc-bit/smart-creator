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
        error: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    if (!story) {
      return res.status(400).json({
        ok: false,
        error: "Main story is required."
      });
    }

    // ==========================================
    // DIALOGUE
    // ==========================================

    let dialogueRule = `
Create 2-4 short, natural Myanmar Burmese spoken lines.
Use natural conversational Myanmar Burmese.
Keep dialogue short enough for the video duration.
Use accurate lip-sync.
`;

    if (dialogueMode === "none") {
      dialogueRule = `
NO SPOKEN DIALOGUE.
Use facial expressions, body reactions and environmental sounds only.
`;
    }

    if (dialogueMode === "custom" && customDialogue) {
      dialogueRule = `
Use ONLY this Myanmar Burmese dialogue:

${customDialogue}

Do not create additional spoken dialogue.
`;
    }

    // ==========================================
    // FRUIT HEAD CHARACTER CONTINUITY
    // ==========================================

    const continuity = `
CHARACTER DESIGN — VERY IMPORTANT:

The characters MUST be anthropomorphic Fruit Head characters.

They have:
- A real fruit-shaped head
- Human-like face
- Human eyes
- Human mouth
- Human body
- Human arms
- Human hands
- Human legs
- Human feet

Keep exactly the same:
- Fruit type
- Fruit color
- Face
- Eyes
- Mouth
- Hairstyle
- Clothing
- Body proportions
- Character identity

Do NOT turn the characters into normal humans.
Do NOT turn them into ordinary fruit.
The result MUST clearly look like a fruit head attached to a human-like body.
`;

    // ==========================================
    // CREATE PROMPT
    // ==========================================

    let prompt = "";

    // ==========================================
    // FLOW AI
    // ==========================================

    if (ai === "flow") {

      prompt = `
You are a professional prompt writer for Flow AI.

${continuity}

CHARACTER:
${character}

EPISODE:
${episode}

MOOD:
${mood}

ASPECT RATIO:
${ratio}

${episode > 1 ? `
PREVIOUS EPISODE CONTEXT:
${previous}
` : ""}

MAIN STORY:
${story}

Create EXACTLY TWO outputs.

--------------------------------
PHOTO PROMPT
--------------------------------

Create a cinematic still-image prompt.

Describe:
- Exact Fruit Head character
- Fruit type
- Face
- Human body
- Clothing
- Environment
- Background
- Lighting
- Camera angle
- Composition
- Visual style
- Character consistency

IMPORTANT:
The PHOTO PROMPT is for generating a still image.

Do NOT include:
- Dialogue
- Speech
- Lip-sync
- Video movement
- Scene duration

--------------------------------
FLOW VIDEO PROMPT
--------------------------------

Create a short video prompt using the exact same character.

Describe:
- Character actions
- Facial expressions
- Body movement
- Camera movement
- Environment
- Natural Myanmar Burmese dialogue
- Speaker names
- Natural voice
- Accurate lip-sync
- Ambient sound

${dialogueRule}

The video prompt must be directly usable in Flow AI.

Return EXACTLY:

PHOTO PROMPT:
[photo prompt]

FLOW VIDEO PROMPT:
[video prompt]
`;

    } else {

      // ==========================================
      // GOOGLE VEO
      // ==========================================

      prompt = `
You are a professional Google Veo video prompt writer.

${continuity}

CHARACTER:
${character}

EPISODE:
${episode}

MOOD:
${mood}

ASPECT RATIO:
${ratio}

${episode > 1 ? `
PREVIOUS EPISODE CONTEXT:
${previous}
` : ""}

MAIN STORY:
${story}

Create separate Google Veo VIDEO PROMPTS.

IMPORTANT RULES:

1. Every scene must be exactly 10 seconds.
2. Each scene must be 900 characters or less.
3. Video prompts ONLY.
4. Do NOT create a photo prompt.
5. Keep exactly the same Fruit Head character.
6. Keep the same fruit type.
7. Keep the same face.
8. Keep the same clothing.
9. Keep the same body design.
10. Keep the same identity.
11. Include natural Myanmar Burmese dialogue when enabled.
12. Dialogue must be short enough for a 10-second scene.
13. Include accurate lip-sync.
14. Use natural facial expressions.
15. Use believable body movement.
16. Use cinematic camera movement.
17. No subtitles.
18. No logos.
19. No watermark.
20. Do not repeat the entire story in every scene.
21. Cover the entire MAIN STORY across all scenes.
22. Each scene must be directly usable in Google Veo.

${dialogueRule}

Return EXACTLY:

SCENE 1 — 10 SEC
[video prompt]

SCENE 2 — 10 SEC
[video prompt]

SCENE 3 — 10 SEC
[video prompt]

Continue until the complete story is covered.
`;
    }

    // ==========================================
    // CURRENT GEMINI MODELS
    // ==========================================

    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash"
    ];

    let result = null;
    let lastStatus = 0;
    let lastError = "";

    // ==========================================
    // TRY GEMINI
    // ==========================================

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

        if (response.ok) {
          result = data;
          break;
        }

        lastStatus = response.status;

        lastError =
          data?.error?.message ||
          `Gemini ${model} returned HTTP ${response.status}`;

        console.error(
          "Gemini error:",
          model,
          lastStatus,
          lastError
        );

      } catch (error) {

        lastError =
          error?.message ||
          "Network error connecting to Gemini.";

        console.error(
          "Gemini connection error:",
          lastError
        );
      }
    }

    // ==========================================
    // BOTH MODELS FAILED
    // ==========================================

    if (!result) {

      let errorMessage = lastError;

      if (lastStatus === 400) {
        errorMessage =
          `Gemini 400 Error: ${lastError}`;
      } else if (lastStatus === 401) {
        errorMessage =
          `Gemini 401 Error: API Key is invalid. ${lastError}`;
      } else if (lastStatus === 403) {
        errorMessage =
          `Gemini 403 Error: API Key has no permission. ${lastError}`;
      } else if (lastStatus === 404) {
        errorMessage =
          `Gemini 404 Error: Model not available. ${lastError}`;
      } else if (lastStatus === 429) {
        errorMessage =
          `Gemini 429 Error: Quota/rate limit/high demand. ${lastError}`;
      } else if (lastStatus >= 500) {
        errorMessage =
          `Gemini ${lastStatus} Server Error: ${lastError}`;
      }

      return res.status(503).json({
        ok: false,
        error: errorMessage,
        status: lastStatus
      });
    }

    // ==========================================
    // READ GEMINI TEXT
    // ==========================================

    const text =
      result?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim() || "";

    if (!text) {

      return res.status(500).json({
        ok: false,
        error:
          "Gemini returned an empty response."
      });
    }

    // ==========================================
    // FLOW RESULT
    // ==========================================

    if (ai === "flow") {

      const photoMatch = text.match(
        /PHOTO\s*PROMPT\s*:\s*([\s\S]*?)(?=FLOW\s*VIDEO\s*PROMPT\s*:|$)/i
      );

      const flowMatch = text.match(
        /FLOW\s*VIDEO\s*PROMPT\s*:\s*([\s\S]*)$/i
      );

      const photoPrompt =
        (photoMatch?.[1] || "")
          .replace(/\s+/g, " ")
          .trim();

      const flowVideoPrompt =
        (flowMatch?.[1] || "")
          .replace(/\s+/g, " ")
          .trim();

      return res.status(200).json({

        ok: true,

        photoPrompt,

        flowVideoPrompt,

        veoVideoPrompt: "",

        veoCharacters:
          flowVideoPrompt.length,

        scenes: []

      });
    }

    // ==========================================
    // VEO RESULT
    // ==========================================

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

        scene:
          Number(match[1]),

        duration:
          10,

        prompt:
          scenePrompt,

        characters:
          scenePrompt.length

      });
    }

    // ==========================================
    // FALLBACK IF SCENES NOT DETECTED
    // ==========================================

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

        prompt:
          scenePrompt,

        characters:
          scenePrompt.length

      });
    }

    // ==========================================
    // FINAL VEO RESPONSE
    // ==========================================

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

    console.error(
      "FRUIT DIALOGUE ERROR:",
      error
    );

    return res.status(500).json({

      ok: false,

      error:
        error?.message ||
        "Unexpected server error."

    });
  }
}
