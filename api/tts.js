export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      text,
      voice = "Kore",
      emotion = "natural",
      speed = 0,
      pitch = 0,
      pro = false,
      quality = "standard",
      longText = false,
      enhance = true
    } = req.body || {};

    // ==========================================
    // TEXT VALIDATION
    // ==========================================

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "မြန်မာစာ ထည့်ပေးပါ။"
      });
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_PRO_DIALOGUE_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error:
          "Gemini API Key မတွေ့ပါ။ Vercel Environment Variables ကိုစစ်ပါ။"
      });
    }

    // ==========================================
    // TEXT CLEANING
    // ==========================================

    const maxCharacters =
      pro && longText ? 10000 : 5000;

    const cleanText = String(text)
      .normalize("NFC")
      .trim()
      .slice(0, maxCharacters);

    if (!cleanText) {
      return res.status(400).json({
        error: "မြန်မာစာ မတွေ့ပါ။"
      });
    }

    // ==========================================
    // VOICE
    // ==========================================

    const validVoices = [
      "Zephyr",
      "Puck",
      "Charon",
      "Kore",
      "Leda"
    ];

    const selectedVoice =
      validVoices.includes(String(voice))
        ? String(voice)
        : "Kore";

    // ==========================================
    // EMOTION
    // ==========================================

    const emotionInstructions = {
      natural: `
Natural conversational Myanmar narration.
Speak calmly, clearly and naturally.
Do not sound like an announcer.
Do not shout.
`,

      happy: `
Warm and cheerful Myanmar conversational voice.
Sound friendly and natural.
Do not shout.
`,

      sad: `
Soft and emotional Myanmar conversational voice.
Speak gently and clearly.
Do not over-act.
`,

      angry: `
Firm Myanmar conversational voice.
Use controlled anger, not screaming.
Keep every Burmese word understandable.
`,

      excited: `
Energetic Myanmar conversational voice.
Sound excited but keep pronunciation clear.
Do not scream.
`,

      serious: `
Serious and confident Myanmar narration.
Speak clearly at a controlled volume.
Do not sound robotic.
`,

      calm: `
Calm, smooth Myanmar conversational narration.
Clear pronunciation and relaxed delivery.
`,

      whisper: `
Very soft Myanmar speech.
Keep every word understandable.
Do not distort the pronunciation.
`,

      dramatic: `
Dramatic Myanmar narration.
Use emotional expression and controlled emphasis.
Do not shout.
Keep pronunciation clear.
`
    };

    const selectedEmotion =
      emotionInstructions[String(emotion)] ||
      emotionInstructions.natural;

    // ==========================================
    // SPEED
    // ==========================================

    const speedNumber = Math.max(
      -5,
      Math.min(5, Number(speed) || 0)
    );

    let speedInstruction = `
Use a normal conversational speaking speed.
`;

    if (speedNumber <= -3) {
      speedInstruction = `
Speak slowly and clearly.
Leave a short natural pause between sentences.
`;
    } else if (speedNumber === -2) {
      speedInstruction = `
Speak slightly slowly and very clearly.
`;
    } else if (speedNumber === -1) {
      speedInstruction = `
Speak slightly slower than normal.
`;
    } else if (speedNumber === 1) {
      speedInstruction = `
Speak slightly faster than normal while keeping every word clear.
`;
    } else if (speedNumber === 2) {
      speedInstruction = `
Speak moderately fast but keep Burmese pronunciation clear.
`;
    } else if (speedNumber >= 3) {
      speedInstruction = `
Speak quickly but never sacrifice Burmese pronunciation clarity.
`;
    }

    // ==========================================
    // PITCH
    // ==========================================

    const pitchNumber = Math.max(
      -5,
      Math.min(5, Number(pitch) || 0)
    );

    let pitchInstruction = `
Use a natural comfortable voice pitch.
`;

    if (pitchNumber <= -3) {
      pitchInstruction = `
Use a slightly deep, natural voice.
Do not make the voice unnaturally low.
`;
    } else if (pitchNumber === -2) {
      pitchInstruction = `
Use a moderately lower natural voice.
`;
    } else if (pitchNumber === -1) {
      pitchInstruction = `
Use a slightly lower natural voice.
`;
    } else if (pitchNumber === 1) {
      pitchInstruction = `
Use a slightly higher natural voice.
`;
    } else if (pitchNumber === 2) {
      pitchInstruction = `
Use a moderately higher natural voice.
`;
    } else if (pitchNumber >= 3) {
      pitchInstruction = `
Use a slightly higher natural voice.
Do not make it cartoon-like.
`;
    }

    // ==========================================
    // QUALITY
    // ==========================================

    const qualityInstruction =
      pro && quality === "ultra"
        ? "Prioritize maximum available clarity and natural speech."
        : pro && quality === "hd"
        ? "Prioritize high speech clarity and clean pronunciation."
        : "Prioritize clear natural speech.";

    // ==========================================
    // BURMESE PRONUNCIATION RULES
    // ==========================================

    const burmeseRules = `
CRITICAL MYANMAR SPEECH RULES:

- Speak STANDARD Myanmar Burmese.
- Use neutral Yangon / central Myanmar pronunciation.
- Do NOT use Rakhine/Arakanese pronunciation.
- Do NOT use regional dialect pronunciation.
- Do NOT use regional vocabulary.
- Do NOT use a foreign accent.
- Do NOT speak English-style Burmese.
- Do NOT turn Burmese words into strange phonetic sounds.
- Do NOT shout.
- Do NOT sing.
- Do NOT chant.
- Do NOT exaggerate every syllable.
- Do NOT mumble.
- Do NOT speak too fast.
- Pronounce each Burmese word clearly.
- Preserve Burmese consonants, vowels and tones naturally.
- Use natural Myanmar sentence rhythm.
- Use short natural pauses at "၊" and "။".
- Preserve question intonation for "?".
- Preserve emotional punctuation naturally.
- Do not add words.
- Do not remove words.
- Do not summarize.
- Do not translate.
- Do not rewrite the meaning.
- Do not read the instructions.
- Speak ONLY the supplied Myanmar text.
`;

    // ==========================================
    // TTS PROMPT
    // ==========================================

    const prompt = `
You are a professional Myanmar Burmese voice narrator.

Your task is ONLY to speak the supplied Myanmar text.

${burmeseRules}

VOICE STYLE:
${selectedEmotion}

SPEED:
${speedInstruction}

PITCH:
${pitchInstruction}

QUALITY:
${qualityInstruction}

${enhance ? `
PRONUNCIATION ENHANCEMENT:
- Make Burmese pronunciation clean and understandable.
- Keep natural conversational rhythm.
- Separate words clearly enough to understand.
- Avoid robotic or distorted pronunciation.
- Keep the same meaning and exact wording.
` : ""}

${pro && longText ? `
LONG NARRATION:
- Maintain the same voice character throughout.
- Maintain consistent pronunciation.
- Keep the narration continuous and natural.
` : ""}

IMPORTANT:
The text below is the ONLY text you should speak.
Do not speak anything before it.
Do not speak anything after it.

--- START MYANMAR TEXT ---
${cleanText}
--- END MYANMAR TEXT ---
`;

    // ==========================================
    // GEMINI TTS MODEL
    // ==========================================

    const model =
      "gemini-2.5-flash-preview-tts";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // ==========================================
    // REQUEST
    // ==========================================

    const geminiResponse = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
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
          responseModalities: ["AUDIO"],

          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice
              }
            }
          }
        }
      })
    });

    const data =
      await geminiResponse.json();

    // ==========================================
    // API ERROR
    // ==========================================

    if (!geminiResponse.ok) {
      console.error(
        "GEMINI TTS ERROR:",
        JSON.stringify(data, null, 2)
      );

      return res.status(
        geminiResponse.status || 500
      ).json({
        error:
          data?.error?.message ||
          "Gemini TTS API Error ဖြစ်နေပါသည်။"
      });
    }

    // ==========================================
    // FIND AUDIO
    // ==========================================

    const parts =
      data?.candidates?.[0]
        ?.content
        ?.parts || [];

    let audioBase64 = null;

    for (const part of parts) {
      const inlineData =
        part?.inlineData ||
        part?.inline_data;

      if (
        inlineData &&
        inlineData.data
      ) {
        audioBase64 =
          inlineData.data;
        break;
      }
    }

    if (!audioBase64) {
      console.error(
        "NO AUDIO:",
        JSON.stringify(data, null, 2)
      );

      return res.status(500).json({
        error:
          "Gemini မှ Audio မပြန်လာပါ။"
      });
    }

    // ==========================================
    // BASE64 → PCM
    // ==========================================

    const pcmBuffer =
      Buffer.from(
        audioBase64,
        "base64"
      );

    if (!pcmBuffer.length) {
      return res.status(500).json({
        error:
          "Gemini Audio Data အလွတ်ဖြစ်နေပါသည်။"
      });
    }

    // ==========================================
    // PCM FORMAT
    // Gemini TTS RAW PCM
    // ==========================================

    const channels = 1;
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const bytesPerSample = 2;

    const byteRate =
      sampleRate *
      channels *
      bytesPerSample;

    const blockAlign =
      channels *
      bytesPerSample;

    // ==========================================
    // WAV HEADER
    // ==========================================

    const wavHeader =
      Buffer.alloc(44);

    wavHeader.write(
      "RIFF",
      0
    );

    wavHeader.writeUInt32LE(
      36 + pcmBuffer.length,
      4
    );

    wavHeader.write(
      "WAVE",
      8
    );

    wavHeader.write(
      "fmt ",
      12
    );

    wavHeader.writeUInt32LE(
      16,
      16
    );

    wavHeader.writeUInt16LE(
      1,
      20
    );

    wavHeader.writeUInt16LE(
      channels,
      22
    );

    wavHeader.writeUInt32LE(
      sampleRate,
      24
    );

    wavHeader.writeUInt32LE(
      byteRate,
      28
    );

    wavHeader.writeUInt16LE(
      blockAlign,
      32
    );

    wavHeader.writeUInt16LE(
      bitsPerSample,
      34
    );

    wavHeader.write(
      "data",
      36
    );

    wavHeader.writeUInt32LE(
      pcmBuffer.length,
      40
    );

    // ==========================================
    // FINAL WAV
    // ==========================================

    const wavBuffer =
      Buffer.concat([
        wavHeader,
        pcmBuffer
      ]);

    // ==========================================
    // RESPONSE
    // ==========================================

    res.setHeader(
      "Content-Type",
      "audio/wav"
    );

    res.setHeader(
      "Content-Length",
      String(wavBuffer.length)
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="YNT-TTS-Myanmar.wav"'
    );

    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate"
    );

    return res
      .status(200)
      .send(wavBuffer);

  } catch (error) {

    console.error(
      "YNT TTS SERVER ERROR:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "TTS Server Error ဖြစ်နေပါသည်။"
    });
  }
}
