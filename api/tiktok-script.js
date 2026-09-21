export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const {
      productName = "",
      productDesc = "",
      productImage = "",
      tone = "energetic",
      sceneCount = 6,
      ratio = "9:16",
      ai = "flow"
    } = req.body || {};

    if (!productName.trim()) {
      return res.status(400).json({
        success: false,
        error: "Product name is required"
      });
    }

    if (!productDesc.trim()) {
      return res.status(400).json({
        success: false,
        error: "Product description is required"
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
    const totalScenes = Math.max(3, Math.min(6, Number(sceneCount) || 6));

    const toneDescriptions = {
      energetic: "high-energy, enthusiastic, upbeat TikTok sales presenter voice",
      trustworthy: "calm, expert, credible, reassuring product-expert voice",
      funny: "funny, relatable, playful, natural comedic timing",
      urgent: "urgent, excited, time-pressure, fear-of-missing-out tone"
    };

    const toneDesc = toneDescriptions[tone] || toneDescriptions.energetic;

    // =========================================================
    // PRODUCT VISUAL LOCK
    // =========================================================

    const hasPhoto =
      typeof productImage === "string" &&
      productImage.startsWith("data:image/");

    const productVisualLock = hasPhoto
      ? `
PRODUCT VISUAL LOCK:

A reference photo of the real product is attached to this request. Study it carefully.

Every PHOTO PROMPT and VIDEO PROMPT must describe the product with the EXACT same:
- color
- shape
- packaging
- label text
- logo
- material
- proportions

as shown in the reference photo.

Do NOT invent a different product design, color or packaging.
Do NOT swap it for a generic or imagined version of the product.
`
      : `
PRODUCT VISUAL LOCK:

No reference photo was supplied.

Design a realistic, plausible product appearance consistent with the product name and description.
Keep the SAME product appearance identical across every scene.
`;

    const continuityRules = `
SCENE CONTINUITY RULE:

Every scene must continue naturally from the previous scene.

Keep the same presenter, outfit, setting and product appearance consistent across all scenes
unless a scene change is naturally justified (for example a before/after demo).

Never restart or repeat the pitch from scratch mid-video.
`;

    const speechRules = `
STANDARD MYANMAR SPEECH RULE:

All spoken dialogue must be natural spoken Myanmar Burmese.

Use normal Myanmar conversational wording, ${toneDesc}.

Do NOT use:
- English dialogue
- romanized Burmese
- robotic or overly literary Burmese

Dialogue must sound like a real TikTok seller speaking naturally.

For a 10-second scene, keep dialogue SHORT — usually 1 short sentence or 2 very short sentences,
so it comfortably finishes speaking within 10 seconds with natural lip-sync.
`;

    const salesStructureRules = `
TIKTOK SHOP SALES STRUCTURE:

Scene 1 (0-10s): Strong scroll-stopping HOOK about this exact product — a question, a bold claim,
or a relatable problem the product solves. Never a generic greeting.

Middle scenes: Show and describe the product's real features and benefits, taken directly from
the product description below. Do not invent features that contradict the given description.

Final scene: Clear call-to-action — tell viewers to tap the TikTok Shop cart / yellow basket,
mention price or promotion if it was given in the description, and create urgency.
`;

    // =========================================================
    // PROMPT
    // =========================================================

    let prompt = "";

    if (isFlow) {
      prompt = `
You are an expert prompt writer for Google Flow AI, writing a TikTok Shop product-selling video script.

PRODUCT NAME:
${productName}

PRODUCT DESCRIPTION / KEY SELLING POINTS:
${productDesc}

SCRIPT TONE:
${tone} (${toneDesc})

ASPECT RATIO:
${ratio}

NUMBER OF SCENES:
${totalScenes} scenes, each exactly 10 seconds.

${productVisualLock}

${continuityRules}

${speechRules}

${salesStructureRules}

FLOW REQUIREMENTS:

Do NOT put dialogue inside PHOTO PROMPT. PHOTO PROMPT is only for the still reference image of the product/presenter.

VIDEO PROMPT MUST contain the exact spoken Myanmar dialogue for that scene, written into the prompt text itself,
so lip movement can match it.

The VIDEO PROMPT must describe: exact same product appearance, exact same presenter, environment, action,
camera movement, facial expression, natural body movement, natural lip-sync, spoken Myanmar dialogue,
cinematic realism, 10-second duration.

OUTPUT EXACTLY IN THIS FORMAT:

TITLE: <one short scroll-stopping hook line for the video>

FULL SCRIPT:
<the complete script as continuous readable text, scene by scene, including the dialogue lines>

SCENE 1
ACTION: <what happens/is shown in this scene>
DIALOGUE: <the exact Myanmar dialogue spoken in this scene>
PHOTO PROMPT: <...>
VIDEO PROMPT: <...>

SCENE 2
ACTION: ...
DIALOGUE: ...
PHOTO PROMPT: ...
VIDEO PROMPT: ...

Continue until all ${totalScenes} scenes are covered.

Do not add explanations. Do not add markdown tables. Return only the text in the exact format above.
`;
    } else {
      prompt = `
You are an expert Google Veo video prompt writer, writing a TikTok Shop product-selling video script.

PRODUCT NAME:
${productName}

PRODUCT DESCRIPTION / KEY SELLING POINTS:
${productDesc}

SCRIPT TONE:
${tone} (${toneDesc})

ASPECT RATIO:
${ratio}

NUMBER OF SCENES:
${totalScenes} scenes, each exactly 10 seconds.

${productVisualLock}

${continuityRules}

${speechRules}

${salesStructureRules}

VEO REQUIREMENTS:

Each scene's VIDEO PROMPT must be 900 characters or fewer.

Every scene must continue naturally from the previous scene.

Keep exact product appearance and presenter identity consistent.

Each VIDEO PROMPT must contain the exact spoken Myanmar dialogue for that scene, written into the prompt text itself.

Do not create a separate photo prompt — combine everything into one VIDEO PROMPT per scene, but ALSO
restate the dialogue separately in the DIALOGUE field below for clarity.

OUTPUT EXACTLY IN THIS FORMAT:

TITLE: <one short scroll-stopping hook line for the video>

FULL SCRIPT:
<the complete script as continuous readable text, scene by scene, including the dialogue lines>

SCENE 1
ACTION: <what happens/is shown in this scene>
DIALOGUE: <the exact Myanmar dialogue spoken in this scene>
VIDEO PROMPT: <...>

SCENE 2
ACTION: ...
DIALOGUE: ...
VIDEO PROMPT: ...

Continue until all ${totalScenes} scenes are covered.

No explanations.
`;
    }

    // =========================================================
    // GEMINI REQUEST (with optional reference photo)
    // =========================================================

    const parts = [{ text: prompt }];

    if (hasPhoto) {
      const match = productImage.match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
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
                  parts
                }
              ],
              generationConfig: {
                temperature: 0.85,
                maxOutputTokens: 6000
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
    // PARSE TITLE + FULL SCRIPT
    // =========================================================

    const titleMatch = result.match(/TITLE:\s*(.*)/i);
    const title = titleMatch ? titleMatch[1].trim() : productName;

    const fullScriptMatch = result.match(
      /FULL SCRIPT:\s*([\s\S]*?)(?=\s*SCENE\s*1\b)/i
    );
    const fullScript = fullScriptMatch ? fullScriptMatch[1].trim() : "";

    // =========================================================
    // PARSE SCENES
    // =========================================================

    const scenes = [];

    if (isFlow) {
      const sceneRegex =
        /SCENE\s*(\d+)\s*[\r\n]+ACTION:\s*([\s\S]*?)\s*DIALOGUE:\s*([\s\S]*?)\s*PHOTO PROMPT:\s*([\s\S]*?)\s*VIDEO PROMPT:\s*([\s\S]*?)(?=\s*SCENE\s*\d+\s*[\r\n]+ACTION:|$)/gi;

      let match;
      while ((match = sceneRegex.exec(result)) !== null) {
        scenes.push({
          scene: Number(match[1]),
          action: match[2].trim(),
          dialogue: match[3].trim(),
          photoPrompt: match[4].trim().replace(/^["']|["']$/g, ""),
          videoPrompt: match[5].trim().replace(/^["']|["']$/g, "")
        });
      }
    } else {
      const sceneRegex =
        /SCENE\s*(\d+)\s*[\r\n]+ACTION:\s*([\s\S]*?)\s*DIALOGUE:\s*([\s\S]*?)\s*VIDEO PROMPT:\s*([\s\S]*?)(?=\s*SCENE\s*\d+\s*[\r\n]+ACTION:|$)/gi;

      let match;
      while ((match = sceneRegex.exec(result)) !== null) {
        let videoPrompt = match[4].trim().replace(/^["']|["']$/g, "");
        if (videoPrompt.length > 900) {
          videoPrompt = videoPrompt.slice(0, 900).trim();
        }
        scenes.push({
          scene: Number(match[1]),
          action: match[2].trim(),
          dialogue: match[3].trim(),
          videoPrompt
        });
      }
    }

    // Fallback if parser misses the format
    if (!scenes.length) {
      let fallback = result.trim();
      scenes.push({
        scene: 1,
        action: "",
        dialogue: "",
        photoPrompt: fallback,
        videoPrompt: fallback.length > 900 ? fallback.slice(0, 900).trim() : fallback
      });
    }

    return res.status(200).json({
      success: true,
      ai: isFlow ? "flow" : "veo",
      title,
      fullScript:
        fullScript ||
        scenes
          .map(
            s =>
              `Scene ${s.scene}: ${s.action}${
                s.dialogue ? "\nDialogue: " + s.dialogue : ""
              }`
          )
          .join("\n\n"),
      scenes
    });

  } catch (error) {
    console.error("tiktok-script error:", error);

    return res.status(500).json({
      success: false,
      error: error?.message || "Server error"
    });
  }
}
