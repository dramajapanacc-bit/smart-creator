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
        error: "GEMINI_API_KEY is missing in Vercel Environment Variables."
      });
    }

    if (!story) {
      return res.status(400).json({
        ok: false,
        error: "Main story is required."
      });
    }

    // ==============================
    // DIALOGUE
    // ==============================

    let dialogueRule = `
Create 2-4 short, natural Myanmar Burmese spoken lines.
Use natural conversational Myanmar Burmese.
Keep each line short enough for a short video.
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

Do not create additional dialogue.
`;
    }

    // ==============================
    // CHARACTER CONTINUITY
    // ==============================

    const continuity = `
CHARACTER CONTINUITY:

Use anthropomorphic Fruit Head characters.

The characters MUST have:
- Fruit-shaped head
- Human-like face
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
- Same identity

IMPORTANT:
Do NOT make them normal humans.
Do NOT make them ordinary fruit.
Keep the fruit head + human body design.
`;

    // ==============================
    // PROMPT
    // ==============================

    let prompt = "";

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
PREVIOUS EPISODE:
${previous}
` : ""}

MAIN STORY:
${story}

Create TWO outputs.

PHOTO PROMPT:
Create a cinematic still-image prompt.

Include:
- Fruit Head character
- Fruit type
- Face
- Human body
- Clothing
- Environment
- Background
- Lighting
- Camera composition
- Visual style
- Character consistency

The PHOTO PROMPT must NOT contain dialogue.
It must describe a still image only.

FLOW VIDEO PROMPT:
Create a short video prompt using the same character.

Include:
- Character actions
- Facial expressions
- Body movement
- Camera movement
- Environment
- Myanmar Burmese dialogue
- Speaker names
- Natural voice
- Accurate lip-sync
- Ambient sound

${dialogueRule}

Return EXACTLY:

PHOTO PROMPT:
[photo prompt]

FLOW VIDEO PROMPT:
[video prompt]
`;

    } else {

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
PREVIOUS EPISODE:
${previous}
` : ""}

MAIN STORY:
${story}

Create separate Google Veo VIDEO PROMPTS.

RULES:

1. Each scene is exactly 10 seconds.
2. Each scene must be 900 characters or less.
3. VIDEO PROMPT ONLY.
4. No photo prompt.
5. Keep the same Fruit Head character.
6. Keep the same fruit type.
7. Keep the same face.
8. Keep the same clothing.
9. Keep the same identity.
10. Include natural Myanmar Burmese dialogue when enabled.
11. Dialogue must be short enough for 10 seconds.
12. Include accurate lip-sync.
13. No subtitles.
14. No logo.
15. No watermark.
16. Use cinematic camera movement.
17. Cover the entire story across the scenes.
18. Do not repeat the whole story in every scene.

${dialogueRule}

Return EXACTLY:

SCENE 1 — 10 SEC
[video prompt]

SCENE 2 — 10 SEC
[video prompt]

SCENE 3 — 10 SEC
[video prompt]

Continue until the whole story is covered.
`;
    }

    // ==============================
    // GEMINI MODELS
    // ==============================

    const models = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite"
    ];

    let finalData = null;
    let lastStatus = 0;
    let lastError = "";

    // ==============================
    // TRY MODELS
    // ==============================

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
                temperature: 0.7,
                maxOutputTokens: 6000
              }
            })
          }
        );

        const data = await response.json();

        if (response.ok) {
          finalData = data;
          break;
        }

        lastStatus = response.status;

        lastError =
          data?.error?.message ||
          `Gemini returned HTTP ${response.status}`;

        console.error(
          `Gemini model ${model} failed:`,
          lastStatus,
          lastError
        );

        // Try the next model
        continue;

      } catch (error) {

        lastError =
          error?.message ||
          "Network error while connecting to Gemini.";

        console.error(
          `Gemini model ${model} exception:`,
          lastError
        );

        continue;
      }
    }

    // ==============================
    // NO MODEL WORKED
    // ==============================

    if (!finalData) {

      let message = lastError;

      if (lastStatus === 400) {
        message =
          `Gemini API 400 Error: ${lastError}`;
      }

      if (lastStatus === 401) {
        message =
          `Gemini API 401 Error: API key is invalid or unauthorized. ${lastError}`;
      }

      if (lastStatus === 403) {
        message =
          `Gemini API 403 Error: API key/project does not have permission. ${lastError}`;
      }

      if (lastStatus === 404) {
        message =
          `Gemini API 404 Error: Model not found. ${lastError}`;
      }

      if (lastStatus === 429) {
        message =
          `Gemini API 429 Error: Quota/rate limit or temporary high demand. ${lastError}`;
      }

      if (lastStatus >= 500) {
        message =
          `Gemini server error ${lastStatus}: ${lastError}`;
      }

      return res.status(503).json({
        ok: false,
        error: message,
        status: lastStatus
      });
    }

    // ==============================
    // GET TEXT
    // ==============================

    const text =
      finalData?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim() || "";

    if (!text) {

      const finishReason =
        finalData?.candidates?.[0]?.finishReason || "";

      return res.status(500).json({
        ok: false,
        error:
          `Gemini returned no text. Finish reason: ${finishReason || "unknown"}`
      });
    }

    // ==============================
    // FLOW AI
    // ==============================

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

        veoCharacters: flowVideoPrompt.length,

        scenes: []
      });
    }

    // ==============================
    // VEO SCENES
    // ==============================

    const scenes = [];

    const regex =
      /SCENE\s*(\d+)\s*[—-]\s*10\s*SEC\s*([\s\S]*?)(?=SCENE\s*\d+\s*[—-]\s*10\s*SEC|$)/gi;

    let match;

    while ((match = regex.exec(text)) !== null) {

      let scenePrompt =
        match[2]
          .replace(/\s+/g, " ")
          .trim();

      // Maximum 900 characters
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

    // ==============================
    // FALLBACK
    // ==============================

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

    // ==============================
    // FINAL RESPONSE
    // ==============================

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

    console.error("FRUIT DIALOGUE ERROR:", error);

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Unexpected server error."
    });
  }
}
