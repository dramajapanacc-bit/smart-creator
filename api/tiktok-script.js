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
      tone = "standard",
      voice = "standard",
      voiceLabel = "Standard Myanmar Burmese",
      presenter = "🧠 Smart Auto Match",
      salesGoal = "TikTok Shop Conversion",
      adHook = "Hook → Product Demo → Benefits → CTA",
      cta = "အခုပဲ Order တင်လိုက်ပါ။",
      price = "",
      durationSeconds = 10,
      story = "",
      sceneCount = 1,
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
    const totalScenes = 1;
    const duration = 10;
    const selectedTone = String(voice || tone || "standard").toLowerCase();

    const toneDescriptions = {
      standard: "clear natural Central Myanmar Burmese, moderate pace",
      energetic: "high-energy, enthusiastic, upbeat TikTok sales presenter voice",
      trustworthy: "calm, expert, credible, reassuring product-expert voice",
      funny: "funny, relatable, playful, natural comedic timing",
      urgent: "urgent, excited, persuasive but truthful sales tone"
    };

    const toneDesc = toneDescriptions[selectedTone] || toneDescriptions.standard;

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
SMART CHARACTER AUTO-MATCH:
Presenter preference: ${presenter}.
If Smart Auto Match is selected, infer the category from product name, product description and reference photo. Choose the best fitting ad character automatically: beauty/skincare = polished beauty creator; fashion = stylish model; food/snacks = appetizing playful food-loving character or suitable presenter; home products = practical demonstrator; tech = modern tech reviewer; kids/pet items = friendly suitable mascot/presenter. Avoid random fruit-heads, oversized objects on heads, awkward costumes or unrelated characters. Character must naturally showcase the product.
Keep character, outfit, product design, environment and lighting consistent for the entire continuous take.
`;

    const speechRules = `
STANDARD MYANMAR SPEECH RULE:
Dialogue must be natural spoken Standard Myanmar Burmese with clear Central Myanmar pronunciation. Voice style: ${voiceLabel} (${toneDesc}). No Rakhine/regional accent, no English dialogue, no mumbling, no robotic or overly literary wording. Keep spoken dialogue short enough to finish within 10 seconds, ideally 15–25 Myanmar words.
`;

    const salesStructureRules = `
10-SECOND SALES STRUCTURE:
0–2 seconds: strong scroll-stopping hook and character/product reveal.
2–7 seconds: show one clear product demonstration and one or two verified benefits.
7–10 seconds: direct spoken CTA to tap the TikTok Shop yellow basket/cart.
Sales goal: ${salesGoal}. Ad flow: ${adHook}. CTA: ${cta}. Price/promotion: ${price || "not supplied; do not invent one"}.
Do not invent features, medical claims, certifications, discounts, scarcity or performance results not provided by the user.
`;

    let prompt = `
You are an expert Google Flow AI prompt engineer and high-converting TikTok Shop ad director.
Create ONE polished 10-second product advertisement, not a story, not a multi-scene video.

PRODUCT NAME: ${productName}
PRODUCT DESCRIPTION / VERIFIED KEY BENEFITS: ${productDesc}
PRICE / PROMOTION: ${price || "Not supplied"}
ASPECT RATIO: ${ratio}
TARGET: ${ai === "veo" ? "Google Veo" : "Google Flow AI"}

${productVisualLock}
${continuityRules}
${speechRules}
${salesStructureRules}

PHOTO PROMPT REQUIREMENTS:
Write one production-ready image prompt for a premium commercial still. Show the automatically selected best-fit character and the product clearly. Keep product design matched to reference photo if supplied. Use polished cinematic commercial lighting, attractive composition, believable materials, realistic hands, clear product visibility, vertical ${ratio}. No watermark or unnecessary text.

VIDEO PROMPT REQUIREMENTS:
Exactly 10 seconds, one continuous take, vertical ${ratio}, premium TikTok Shop commercial. Include timing (0–2s hook, 2–7s product demo, 7–10s CTA), character action, facial expression, natural product interaction, camera framing/movement, lighting, and the EXACT Myanmar dialogue inline in quotation marks for accurate lip-sync. The dialogue must be short enough for 10 seconds. Keep the entire videoPrompt under 900 characters. No scene changes, no subtitles, no on-screen UI, no random text, no watermark.

OUTPUT EXACTLY IN THIS FORMAT:
TITLE: <short Myanmar scroll-stopping hook>
FULL SCRIPT: <one concise spoken Myanmar script suitable for 10 seconds>
SCENE 1
ACTION: <single continuous action description>
DIALOGUE: <exact short Myanmar dialogue>
PHOTO PROMPT: <one still-image prompt>
VIDEO PROMPT: <one 10-second video prompt including the exact dialogue inline>

Return only this format. Do not add scene 2 or any explanation.
`;

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
