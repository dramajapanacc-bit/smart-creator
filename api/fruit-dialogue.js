export default async function handler(req, res) {
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
      episode = "Episode 1",
      mood = "funny comedy"
    } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "GEMINI_API_KEY is missing"
      });
    }

    if (!story.trim()) {
      return res.status(400).json({
        ok: false,
        error: "Main story is required"
      });
    }

    const prompt = `
You are creating VIDEO-ONLY prompts for Google Veo.

IMPORTANT:
Create a continuous story divided into 10-second scenes.

The user will generate each scene separately in Veo.

Every scene must continue naturally from the previous scene.

CHARACTER:
${character}

EPISODE:
${episode}

MOOD:
${mood}

MAIN STORY:
${story}

RULES:

1. VIDEO ONLY.
2. No image prompt.
3. No subtitles.
4. No UI.
5. No logos.
6. No watermark.
7. Aspect ratio 9:16.
8. Keep EXACT character continuity in every scene.
9. Keep the same fruit type, face, eyes, mouth, body proportions, hairstyle, clothing and colors.
10. Characters must be anthropomorphic fruit-headed humans.
11. Divide the story into short 10-second scenes.
12. Each scene must contain only the action that can realistically happen within 10 seconds.
13. Each scene must have short natural Myanmar Burmese dialogue.
14. Use 1-3 short spoken lines per scene.
15. Dialogue must match the correct character.
16. Natural Burmese speaking voice.
17. Accurate Burmese lip sync.
18. Funny facial expressions and physical reactions.
19. Cinematic camera movement.
20. Do NOT repeat the entire story inside every scene.
21. Each scene prompt must be under 900 characters.
22. Do not create image prompts.
23. Do not add explanations outside the scene prompts.

OUTPUT FORMAT:

SCENE 1 — 10 SEC
[VIDEO PROMPT]

SCENE 2 — 10 SEC
[VIDEO PROMPT]

SCENE 3 — 10 SEC
[VIDEO PROMPT]

Continue until the whole story is completed.

Each scene must be independently usable in Veo while maintaining continuity with the previous scene.
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
            temperature: 0.8,
            maxOutputTokens: 5000
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
        ?.map(p => p.text || "")
        .join("")
        .trim();

    if (!text) {
      return res.status(500).json({
        ok: false,
        error: "Gemini returned empty result"
      });
    }

    // Extract individual 10-second scenes
    const sceneRegex =
      /SCENE\s*(\d+)\s*[—-]\s*10\s*SEC\s*([\s\S]*?)(?=SCENE\s*\d+\s*[—-]\s*10\s*SEC|$)/gi;

    const scenes = [];
    let match;

    while ((match = sceneRegex.exec(text)) !== null) {
      let scenePrompt = match[2]
        .trim()
        .replace(/\s+/g, " ");

      // Hard safety limit for Veo
      if (scenePrompt.length > 900) {
        scenePrompt = scenePrompt.slice(0, 900).trim();
      }

      scenes.push({
        scene: Number(match[1]),
        duration: 10,
        prompt: scenePrompt,
        characters: scenePrompt.length
      });
    }

    // Fallback if Gemini did not follow the format
    if (!scenes.length) {
      let fallback = text
        .replace(/\s+/g, " ")
        .trim();

      if (fallback.length > 900) {
        fallback = fallback.slice(0, 900).trim();
      }

      scenes.push({
        scene: 1,
        duration: 10,
        prompt: fallback,
        characters: fallback.length
      });
    }

    return res.status(200).json({
      ok: true,
      scenes,
      totalScenes: scenes.length,
      totalDuration: scenes.length * 10
    });

  } catch (error) {
    console.error("fruit-dialogue error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message || "Server error"
    });
  }
}
