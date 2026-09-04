export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method Not Allowed"
    });
  }

  try {
    const {
      dialogue,
      speaker1Voice,
      speaker2Voice,
      speaker3Voice,
      speaker3Enabled
    } = req.body || {};

    if (!dialogue || typeof dialogue !== "string") {
      return res.status(400).json({
        error: "Dialogue စာသားထည့်ပါ။"
      });
    }

    const voices = [
      "Zephyr",
      "Puck",
      "Charon",
      "Kore",
      "Leda"
    ];

    if (!voices.includes(speaker1Voice)) {
      return res.status(400).json({
        error: "Speaker 1 Voice မမှန်ပါ။"
      });
    }

    if (!voices.includes(speaker2Voice)) {
      return res.status(400).json({
        error: "Speaker 2 Voice မမှန်ပါ။"
      });
    }

    if (
      speaker3Enabled &&
      !voices.includes(speaker3Voice)
    ) {
      return res.status(400).json({
        error: "Speaker 3 Voice မမှန်ပါ။"
      });
    }

    if (dialogue.length > 10000) {
      return res.status(400).json({
        error: "Pro Dialogue သည် စာလုံး 10,000 အထိသာ ခွင့်ပြုထားပါသည်။"
      });
    }

    const lines = dialogue
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      return res.status(400).json({
        error: "Dialogue စာသားမရှိပါ။"
      });
    }

    const parsed = [];

    for (const line of lines) {
      const match = line.match(
        /^Speaker\s*([123])\s*:\s*(.+)$/i
      );

      if (!match) {
        return res.status(400).json({
          error:
            "Dialogue format မမှန်ပါ။ Speaker 1: / Speaker 2: / Speaker 3: ပုံစံဖြင့် ထည့်ပါ။"
        });
      }

      const speakerNumber = Number(match[1]);
      const text = match[2].trim();

      if (!text) {
        return res.status(400).json({
          error:
            `Speaker ${speakerNumber} စာသားမရှိပါ။`
        });
      }

      if (
        speakerNumber === 3 &&
        !speaker3Enabled
      ) {
        return res.status(400).json({
          error:
            "Speaker 3 ကိုအသုံးပြုရန် Add Speaker 3 ကိုဖွင့်ပါ။"
        });
      }

      let voice;

      if (speakerNumber === 1) {
        voice = speaker1Voice;
      } else if (speakerNumber === 2) {
        voice = speaker2Voice;
      } else {
        voice = speaker3Voice;
      }

      parsed.push({
        speaker: speakerNumber,
        voice,
        text
      });
    }

    /*
      Step 2 မှာ Backend က Dialogue ကို
      မှန်ကန်တဲ့ Speaker / Voice အဖြစ် Parse လုပ်ပေးပါတယ်။

      Audio generation ကို Gemini TTS endpoint
      နဲ့ ဆက်သွယ်မယ့်အပိုင်းကို နောက် Step မှာ
      ချိတ်ပါမယ်။

      api/tts.js ကို မထိပါ။
    */

    return res.status(200).json({
      success: true,
      message: "Dialogue parsed successfully.",
      totalLines: parsed.length,
      speakers: parsed
    });

  } catch (error) {
    console.error("PRO DIALOGUE ERROR:", error);

    return res.status(500).json({
      error:
        error?.message ||
        "Pro Dialogue Backend Error ဖြစ်နေပါတယ်။"
    });
  }
}
