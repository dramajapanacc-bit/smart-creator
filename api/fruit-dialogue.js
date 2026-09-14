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

    // Myanmar Dialogue
    let dialogueRule = `
Create 2-4 short, natural Myanmar Burmese spoken lines.
Use standard Myanmar Burmese.
Make the speech sound natural and suitable for real human conversation.
Use accurate lip-sync.
`;

    if (dialogueMode === "none") {
      dialogueRule = `
No spoken dialogue.
Use only natural character reactions and environmental sounds.
`;
    }

    if (dialogueMode === "custom" && customDialogue) {
      dialogueRule = `
Use ONLY this Myanmar dialogue:
${customDialogue}

Do not invent additional spoken dialogue.
`;
    }

    // Character continuity
    const continuity = `
Character continuity:
Keep the EXACT SAME Fruit Head characters throughout the story.

The characters must be anthropomorphic fruit-headed human characters:
- Real fruit-shaped head
- Human-like face
- Human eyes
- Human mouth
- Human body
- Human arms and legs
- Same fruit type
- Same face
- Same clothing
- Same colors
- Same hairstyle
- Same body proportions

Do NOT turn them into normal humans.
Do NOT turn them into ordinary fruit without a human body.
`;

    // FLOW AI
    if (ai === "flow") {

      const prompt = `
You are a professional prompt writer for Flow AI.

Create TWO separate prompts.

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

IMPORTANT:

OUTPUT 1 — PHOTO PROMPT
Create a strong cinematic still-image prompt.

The PHOTO PROMPT must describe:
- Exact fruit-headed character
- Face
- Clothing
- Body
- Environment
- Background
- Lighting
- Camera composition
- Visual style
- Character consistency

The PHOTO PROMPT must NOT contain dialogue.
The PHOTO PROMPT must NOT describe video movement.

OUTPUT 2 — FLOW VIDEO PROMPT
Create a short video prompt based on the same character and scene.

The video prompt must contain:
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

Return EXACTLY this format:

PHOTO PROMPT:
[photo prompt]

FLOW VIDEO PROMPT:
[video prompt]
`;

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
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

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          error:
            data?.error?.message ||
            "Gemini API request failed"
        });
      }

      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("")
          .trim() || "";

      if (!text) {
        return res.status(500).json({
          ok: false,
          error: "Gemini returned empty result"
        });
      }

      const photoMatch = text.match(
        /PHOTO\s*PROMPT\s*:\s*([\s\S]*?)(?=FLOW\s*VIDEO\s*PROMPT\s*:|$)/i
      );

      const flowMatch = text.match(
        /FLOW\s*VIDEO\s*PROMPT\s*:\s*([\s\S]*)$/i
      );

      const photoPrompt = (
        photoMatch?.[1] || ""
      )
        .replace(/\s+/g, " ")
        .trim();

      const flowVideoPrompt = (
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

    // GOOGLE VEO
    const prompt = `
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

Create a series of separate 10-second Google Veo video prompts.

IMPORTANT RULES:

1. Every scene must be exactly one 10-second video.
2. Each scene must contain only actions that can realistically happen within 10 seconds.
3. Each scene must be MAXIMUM 900 characters.
4. Each scene must be directly usable in Google Veo.
5. Do not create a photo prompt.
6. Do not create image prompts.
7. Video prompts only.
8. Keep the exact same Fruit Head character throughout all scenes.
9. Do not change fruit type, face, clothing or identity.
10. Use natural cinematic movement.
11. Include natural Myanmar Burmese dialogue when dialogue is enabled.
12. Dialogue must be short enough for a 10-second scene.
13. Include accurate lip-sync.
14. Do not add subtitles.
15. Do not add logos.
16. Do not add watermark.
17. Do not repeat the entire story in every scene.
18. Cover the complete MAIN STORY across the scenes.

${dialogueRule}

Return EXACTLY:

SCENE 1 — 10 SEC
[video prompt]

SCENE 2 — 10 SEC
[video prompt]

SCENE 3 — 10 SEC
[video prompt]

Continue until the entire story is covered.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
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

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error:
          data?.error?.message ||
          "Gemini API request failed"
      });
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      return res.status(500).json({
        ok: false,
        error: "Gemini returned empty result"
      });
    }

    const scenes = [];

    const regex =
      /SCENE\s*(\d+)\s*[—-]\s*10\s*SEC\s*([\s\S]*?)(?=SCENE\s*\d+\s*[—-]\s*10\s*SEC|$)/gi;

    let match;

    while ((match = regex.exec(text)) !== null) {

      let scenePrompt = match[2]
        .replace(/\s+/g, " ")
        .trim();

      // HARD LIMIT: 900 characters
      if (scenePrompt.length > 900) {
        scenePrompt = scenePrompt
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

    // Fallback
    if (!scenes.length) {

      let scenePrompt = text
        .replace(/\s+/g, " ")
        .trim();

      if (scenePrompt.length > 900) {
        scenePrompt = scenePrompt
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

    return res.status(200).json({
      ok: true,

      photoPrompt: "",

      flowVideoPrompt: "",

      veoVideoPrompt: scenes[0].prompt,

      veoCharacters: scenes[0].prompt.length,

      scenes,

      totalScenes: scenes.length,

      totalDuration: scenes.length * 10
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      ok: false,
      error: error.message || "Server error"
    });
  }
}
