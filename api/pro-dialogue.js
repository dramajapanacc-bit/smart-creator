const VOICES = [
  "Zephyr",
  "Puck",
  "Charon",
  "Kore",
  "Leda"
];

const MODEL = "gemini-2.5-flash-preview-tts";

const MAX_DIALOGUE_LENGTH = 10000;
const MAX_LINES_PER_GENERATE = 10;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pcmToWav(pcmBuffer) {
  const sampleRate = 24000;
  const channels = 1;
  const bitsPerSample = 16;

  const byteRate =
    sampleRate * channels * bitsPerSample / 8;

  const blockAlign =
    channels * bitsPerSample / 8;

  const buffer = Buffer.alloc(44 + pcmBuffer.length);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + pcmBuffer.length, 4);
  buffer.write("WAVE", 8);

  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  buffer.write("data", 36);
  buffer.writeUInt32LE(pcmBuffer.length, 40);

  pcmBuffer.copy(buffer, 44);

  return buffer;
}

function isQuotaError(message) {
  const text = String(message || "").toLowerCase();

  return (
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("resource exhausted") ||
    text.includes("429")
  );
}

function getRetryDelay(message) {
  const text = String(message || "");

  const match =
    text.match(/retry in\s+([\d.]+)s/i);

  if (match) {
    const seconds = Number(match[1]);

    if (Number.isFinite(seconds)) {
      return Math.min(
        Math.max(seconds * 1000, 1000),
        15000
      );
    }
  }

  return RETRY_DELAY_MS;
}

async function generateLine(text, voice, apiKey) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text:
              `Speak the following dialogue naturally in Burmese. ` +
              `Keep the exact meaning and words. ` +
              `Do not add extra words.\n\n${text}`
          }
        ]
      }
    ],

    generationConfig: {
      responseModalities: ["AUDIO"],

      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voice
          }
        }
      }
    }
  };

  let lastError = "Gemini TTS Error";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          data?.error?.message ||
          "Gemini TTS Error";

        lastError = errorMessage;

        // Quota / rate limit
        if (isQuotaError(errorMessage)) {
          if (attempt < MAX_RETRIES) {
            const delay =
              getRetryDelay(errorMessage);

            await sleep(delay);
            continue;
          }

          throw new Error(
            "GEMINI_QUOTA_EXCEEDED"
          );
        }

        throw new Error(errorMessage);
      }

      const audio =
        data?.candidates?.[0]?.content?.parts?.find(
          part =>
            part?.inlineData?.data
        )?.inlineData?.data;

      if (!audio) {
        throw new Error(
          "Gemini က Audio Data ပြန်မပေးပါ။"
        );
      }

      return Buffer.from(audio, "base64");

    } catch (error) {
      lastError =
        error?.message ||
        "Gemini TTS Error";

      if (
        lastError ===
        "GEMINI_QUOTA_EXCEEDED"
      ) {
        throw error;
      }

      if (
        isQuotaError(lastError) &&
        attempt < MAX_RETRIES
      ) {
        const delay =
          getRetryDelay(lastError);

        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw new Error(lastError);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({
        error: "Method Not Allowed"
      });
  }

  try {
    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res
        .status(500)
        .json({
          error:
            "GEMINI_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကို စစ်ပါ။"
        });
    }

    const {
      dialogue,
      speaker1Voice,
      speaker2Voice,
      speaker3Voice,
      speaker3Enabled
    } = req.body || {};

    // -----------------------------
    // Basic validation
    // -----------------------------

    if (
      !dialogue ||
      typeof dialogue !== "string"
    ) {
      return res
        .status(400)
        .json({
          error:
            "Dialogue စာသားထည့်ပါ။"
        });
    }

    if (
      dialogue.length >
      MAX_DIALOGUE_LENGTH
    ) {
      return res
        .status(400)
        .json({
          error:
            "Pro Dialogue သည် စာလုံး 10,000 အထိသာ ခွင့်ပြုထားပါသည်။"
        });
    }

    // -----------------------------
    // Validate voices
    // -----------------------------

    if (
      !VOICES.includes(
        speaker1Voice
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Speaker 1 Voice မမှန်ပါ။"
        });
    }

    if (
      !VOICES.includes(
        speaker2Voice
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Speaker 2 Voice မမှန်ပါ။"
        });
    }

    if (
      speaker3Enabled &&
      !VOICES.includes(
        speaker3Voice
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Speaker 3 Voice မမှန်ပါ။"
        });
    }

    // -----------------------------
    // Parse dialogue
    // -----------------------------

    const lines =
      dialogue
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);

    if (!lines.length) {
      return res
        .status(400)
        .json({
          error:
            "Dialogue စာသားမရှိပါ။"
        });
    }

    // Prevent accidental huge request count
    if (
      lines.length >
      MAX_LINES_PER_GENERATE
    ) {
      return res
        .status(400)
        .json({
          error:
            `တစ်ကြိမ် Generate လုပ်ရာတွင် Speaker line ${MAX_LINES_PER_GENERATE} ကြောင်းအထိသာ ခွင့်ပြုထားပါသည်။`
        });
    }

    const parsed = [];

    for (const line of lines) {
      const match =
        line.match(
          /^Speaker\s*([123])\s*:\s*(.+)$/i
        );

      if (!match) {
        return res
          .status(400)
          .json({
            error:
              "Format မမှန်ပါ။ Speaker 1: စာသား ပုံစံဖြင့် ထည့်ပါ။"
          });
      }

      const speaker =
        Number(match[1]);

      const text =
        match[2].trim();

      if (!text) {
        return res
          .status(400)
          .json({
            error:
              `Speaker ${speaker} စာသားမရှိပါ။`
          });
      }

      if (
        speaker === 3 &&
        !speaker3Enabled
      ) {
        return res
          .status(400)
          .json({
            error:
              "Speaker 3 ကိုအသုံးပြုရန် Add Speaker 3 ကိုဖွင့်ပါ။"
          });
      }

      let voice;

      if (speaker === 1) {
        voice = speaker1Voice;
      } else if (speaker === 2) {
        voice = speaker2Voice;
      } else {
        voice = speaker3Voice;
      }

      parsed.push({
        speaker,
        voice,
        text
      });
    }

    // -----------------------------
    // Generate audio
    // -----------------------------

    const audioParts = [];

    for (const item of parsed) {
      try {
        const pcm =
          await generateLine(
            item.text,
            item.voice,
            apiKey
          );

        audioParts.push(pcm);

      } catch (error) {
        if (
          error?.message ===
          "GEMINI_QUOTA_EXCEEDED"
        ) {
          return res
            .status(429)
            .json({
              error:
                "Gemini API quota ပြည့်နေပါပြီ။ ခဏစောင့်ပြီး ပြန်စမ်းပါ။"
            });
        }

        throw error;
      }
    }

    // -----------------------------
    // Combine PCM
    // -----------------------------

    const totalLength =
      audioParts.reduce(
        (sum, part) =>
          sum + part.length,
        0
      );

    if (totalLength <= 0) {
      return res
        .status(500)
        .json({
          error:
            "Audio Data မရရှိပါ။"
        });
    }

    const combinedPcm =
      Buffer.alloc(
        totalLength
      );

    let offset = 0;

    for (const part of audioParts) {
      part.copy(
        combinedPcm,
        offset
      );

      offset += part.length;
    }

    // -----------------------------
    // PCM -> WAV
    // -----------------------------

    const wav =
      pcmToWav(
        combinedPcm
      );

    res.setHeader(
      "Content-Type",
      "audio/wav"
    );

    res.setHeader(
      "Content-Length",
      wav.length
    );

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="YNT-Pro-Dialogue.wav"'
    );

    return res
      .status(200)
      .send(wav);

  } catch (error) {
    console.error(
      "PRO DIALOGUE ERROR:",
      error
    );

    if (
      error?.message ===
      "GEMINI_QUOTA_EXCEEDED"
    ) {
      return res
        .status(429)
        .json({
          error:
            "Gemini API quota ပြည့်နေပါပြီ။ ခဏစောင့်ပြီး ပြန်စမ်းပါ။"
        });
    }

    return res
      .status(500)
      .json({
        error:
          error?.message ||
          "Pro Multi-Voice Generate Error ဖြစ်နေပါတယ်။"
      });
  }
}
