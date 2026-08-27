export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      text,
      voice,
      emotion,
      speed,
      pitch
    } = req.body || {};

    // -----------------------------
    // Check text
    // -----------------------------

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "မြန်မာစာ ထည့်ပေးပါ။"
      });
    }

    // -----------------------------
    // Gemini API Key
    // -----------------------------

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကိုစစ်ပါ။"
      });
    }

    // -----------------------------
    // Allowed Gemini voices
    // -----------------------------

    const allowedVoices = [
      "Zephyr",
      "Puck",
      "Charon",
      "Kore",
      "Leda"
    ];

    const selectedVoice =
      allowedVoices.includes(voice)
        ? voice
        : "Zephyr";

    // -----------------------------
    // Emotion
    // -----------------------------

    const emotionMap = {
      natural:
        "natural, clear and balanced",

      happy:
        "happy, warm and cheerful",

      sad:
        "sad, gentle and emotional",

      angry:
        "angry and intense",

      excited:
        "excited, energetic and lively",

      serious:
        "serious, confident and professional",

      calm:
        "calm, soft and relaxed",

      whisper:
        "very soft and quiet, almost whispering",

      dramatic:
        "dramatic, expressive and emotional"
    };

    const selectedEmotion =
      emotionMap[emotion] ||
      emotionMap.natural;

    // -----------------------------
    // Speed
    // -----------------------------

    let speedValue =
      Number(speed);

    if (Number.isNaN(speedValue)) {
      speedValue = 0;
    }

    speedValue =
      Math.max(
        -5,
        Math.min(5, speedValue)
      );

    let speedInstruction =
      "normal speaking speed";

    if (speedValue <= -4) {
      speedInstruction =
        "very slow speaking pace";
    } else if (speedValue === -3) {
      speedInstruction =
        "slow speaking pace";
    } else if (speedValue === -2) {
      speedInstruction =
        "slightly slow speaking pace";
    } else if (speedValue === -1) {
      speedInstruction =
        "slightly slower than normal";
    } else if (speedValue === 1) {
      speedInstruction =
        "slightly faster than normal";
    } else if (speedValue === 2) {
      speedInstruction =
        "faster speaking pace";
    } else if (speedValue === 3) {
      speedInstruction =
        "fast speaking pace";
    } else if (speedValue >= 4) {
      speedInstruction =
        "very fast speaking pace";
    }

    // -----------------------------
    // Pitch
    // -----------------------------

    let pitchValue =
      Number(pitch);

    if (Number.isNaN(pitchValue)) {
      pitchValue = 0;
    }

    pitchValue =
      Math.max(
        -5,
        Math.min(5, pitchValue)
      );

    let pitchInstruction =
      "natural vocal pitch";

    if (pitchValue <= -4) {
      pitchInstruction =
        "very low vocal pitch";
    } else if (pitchValue === -3) {
      pitchInstruction =
        "low vocal pitch";
    } else if (pitchValue === -2) {
      pitchInstruction =
        "slightly low vocal pitch";
    } else if (pitchValue === -1) {
      pitchInstruction =
        "slightly lower vocal pitch";
    } else if (pitchValue === 1) {
      pitchInstruction =
        "slightly higher vocal pitch";
    } else if (pitchValue === 2) {
      pitchInstruction =
        "higher vocal pitch";
    } else if (pitchValue === 3) {
      pitchInstruction =
        "high vocal pitch";
    } else if (pitchValue >= 4) {
      pitchInstruction =
        "very high vocal pitch";
    }

    // -----------------------------
    // TTS Prompt
    // -----------------------------

    const inputText = `
Generate speech audio.

Language:
Burmese (Myanmar).

Voice:
Use the selected Gemini voice naturally.

Style:
${selectedEmotion}.

Pacing:
${speedInstruction}.

Pitch:
${pitchInstruction}.

Important:
- Speak ONLY the Burmese text provided below.
- Do NOT translate the Burmese text.
- Do NOT explain anything.
- Do NOT read these instructions aloud.
- Use natural Burmese pronunciation.
- Speak clearly like a professional narrator.
- Keep the delivery natural and smooth.

TEXT TO SPEAK:
${String(text).trim()}
`;

    // -----------------------------
    // Gemini Interactions API
    // -----------------------------

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          model:
            "gemini-3.1-flash-tts-preview",

          input:
            inputText,

          response_format: {
            type: "audio"
          },

          generation_config: {
            speech_config: [
              {
                voice:
                  selectedVoice
              }
            ]
          }
        })
      }
    );

    // -----------------------------
    // Read Gemini response
    // -----------------------------

    const data =
      await response.json();

    if (!response.ok) {

      console.error(
        "Gemini API Error:",
        JSON.stringify(data)
      );

      return res.status(
        response.status >= 400 &&
        response.status < 600
          ? response.status
          : 500
      ).json({
        error:
          data?.error?.message ||
          "Gemini TTS API Error ဖြစ်နေပါသည်။"
      });
    }

    // -----------------------------
    // Get generated audio
    // -----------------------------

    const audioBase64 =
      data?.output_audio?.data;

    if (!audioBase64) {

      console.error(
        "Gemini response has no audio:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error:
          "Gemini response ထဲမှာ Audio မပါလာပါ။"
      });
    }

    // -----------------------------
    // Base64 -> Buffer
    // -----------------------------

    const pcmBuffer =
      Buffer.from(
        audioBase64,
        "base64"
      );

    if (!pcmBuffer.length) {

      return res.status(500).json({
        error:
          "Gemini Audio data အလွတ်ဖြစ်နေပါသည်။"
      });
    }

    // -----------------------------
    // PCM -> WAV
    //
    // Gemini TTS:
    // 24,000 Hz
    // 16-bit
    // Mono
    // -----------------------------

    const channels = 1;
    const sampleRate = 24000;
    const bitsPerSample = 16;
    const blockAlign =
      channels *
      bitsPerSample /
      8;

    const byteRate =
      sampleRate *
      blockAlign;

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

    // PCM format
    wavHeader.writeUInt16LE(
      1,
      20
    );

    // Mono
    wavHeader.writeUInt16LE(
      channels,
      22
    );

    // Sample rate
    wavHeader.writeUInt32LE(
      sampleRate,
      24
    );

    // Byte rate
    wavHeader.writeUInt32LE(
      byteRate,
      28
    );

    // Block align
    wavHeader.writeUInt16LE(
      blockAlign,
      32
    );

    // Bits per sample
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

    const wavBuffer =
      Buffer.concat([
        wavHeader,
        pcmBuffer
      ]);

    // -----------------------------
    // Send audio to website
    // -----------------------------

    res.setHeader(
      "Content-Type",
      "audio/wav"
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="YanNaing-Gemini-TTS.wav"'
    );

    res.setHeader(
      "Content-Length",
      wavBuffer.length
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res
      .status(200)
      .send(wavBuffer);

  } catch (error) {

    console.error(
      "TTS Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Myanmar Voice ထုတ်ရာတွင် Error ဖြစ်နေပါသည်။"
    });
  }
}
