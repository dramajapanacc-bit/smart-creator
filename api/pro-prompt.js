export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { key, title = "", style = "", ratio = "16:9" } = req.body || {};

    const proKey = process.env.YNT_PRO_KEY;

    if (!proKey) {
      return res.status(500).json({
        error: "PRO system မပြင်ဆင်ရသေးပါ။"
      });
    }

    if (!key || key !== proKey) {
      return res.status(401).json({
        error: "PRO Access လိုအပ်ပါတယ်။"
      });
    }

    if (!title.trim()) {
      return res.status(400).json({
        error: "Movie Title ထည့်ပါ။"
      });
    }

    if (!["16:9", "9:16"].includes(ratio)) {
      return res.status(400).json({
        error: "Invalid ratio"
      });
    }

    const selectedStyle =
      style.trim() || "Cinematic";

    const ratioText =
      ratio === "9:16"
        ? "Vertical 9:16 composition for YouTube Shorts, TikTok and Reels."
        : "Widescreen 16:9 composition for YouTube Movie Recap.";

    const generatedPrompt = `
Create an ultra-viral ${ratio} movie recap thumbnail.

Movie Title:
"${title.trim()}"

Thumbnail Style:
${selectedStyle}

Composition:
${ratioText}

Automatically understand the meaning and theme of the movie title and create a background that perfectly matches the story.

Examples:
- Ocean / Sea → stormy ocean, shipwreck, underwater ruins
- Horror → haunted castle, blood moon, dark fog
- War → explosions, tanks, helicopters, battlefield
- Fantasy → magical kingdom, glowing creatures
- Action → intense chase, explosions, destruction
- Drama → emotional characters, cinematic environment

Requirements:

- ${ratioText}
- Main character should be the biggest subject.
- Strong facial expression.
- Add a glowing RED circle around the main character's face.
- Add 2–3 thick curved RED arrows pointing toward the face.
- Add 2–4 supporting characters.
- Dramatic cinematic lighting.
- High contrast.
- Teal and orange cinematic color grading.
- Smoke, sparks and atmosphere matching the movie story.
- Huge distressed YELLOW movie title.
- Thick BLACK outline around the title.
- Add "MOVIE RECAP" below the title.
- Hyper-detailed.
- Extremely click-worthy.
- Strong subject separation.
- Mobile-friendly composition.
- Professional YouTube thumbnail design.
- No watermark.
- No logo.
- No unnecessary UI elements.
- No borders.
- No random text.

Return only the final image-generation prompt.
`.trim();

    return res.status(200).json({
      ok: true,
      pro: true,
      prompt: generatedPrompt
    });

  } catch (error) {
    console.error("PRO Prompt Error:", error);

    return res.status(500).json({
      error: error?.message || "Prompt generation failed"
    });
  }
}
