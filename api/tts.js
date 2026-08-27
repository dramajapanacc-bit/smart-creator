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

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "မြန်မာစာ ထည့်ပေးပါ။"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY မတွေ့ပါ။"
      });
    }

    // Gemini TTS voices
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

    // Emotion
    const emotions = {
      natural: "natural, clear and balanced",
      happy: "warm, happy and cheerful",
      sad: "soft, sad and emotional",
      angry: "angry and intense",
      excited: "excited and energetic",
      serious: "serious and professional",
      calm: "calm, soft and relaxed",
      whisper: "very soft and quiet",
      dramatic: "dramatic and expressive"
    };

    const selectedEmotion =
      emotions[emotion] || emotions.natural;

    // Speed
    let speedNumber = Number(speed);

    if (Number.isNaN(speedNumber)) {
      speedNumber = 0;
    }

    speedNumber = Math.max(
      -5,
      Math.min(5, speedNumber)
    );

    let speedText = "normal speaking speed";

    if (speedNumber <= -4) {
      speedText = "very slow speaking pace";
    } else if (speedNumber === -3) {
      speedText = "slow speaking pace";
    } else if (speedNumber === -2) {
      speedText = "slightly slow speaking pace";
    } else if (speedNumber === -1) {
      speedText = "slightly slower than normal";
    } else if (speedNumber === 1) {
      speedText = "slightly faster than normal";
    } else if (speedNumber === 2) {
      speedText = "fast speaking pace";
    } else if (speedNumber === 3) {
      speedText = "very fast speaking pace";
    } else if (speedNumber >= 4) {
      speedText = "extremely fast speaking pace";
    }

    // Pitch
    let pitchNumber = Number(pitch);

    if (Number.isNaN(pitchNumber)) {
      pitchNumber = 0;
    }

    pitchNumber = Math.max(
      -5,
      Math.min(5, pitchNumber)
    );

    let pitchText = "natural vocal pitch";

    if (pitchNumber <= -4) {
      pitchText = "very low vocal pitch";
    } else if (pitchNumber === -3) {
      pitchText = "low vocal pitch";
    } else if (pitchNumber === -2) {
      pitchText = "slightly low vocal pitch";
    } else if (pitchNumber === -1) {
      pitchText = "slightly lower vocal pitch";
    } else if (pitchNumber === 1) {
      pitchText = "slightly higher vocal pitch";
    } else if (pitchNumber === 2) {
      pitchText = "higher vocal pitch";
    } else if (pitchNumber === 3) {
      pitchText = "high vocal pitch";
    } else if (pitchNumber >= 4) {
      pitchText = "very high vocal pitch";
    }

    // TTS instruction
    const prompt = `
Speak the following text in Burmese (Myanmar) language.

Performance:
- Voice: ${selectedVoice}
- Emotion: ${selectedEmotion}
- Speaking pace: ${speedText}
- Vocal pitch: ${pitchText}
- Use natural Burmese pronunciation.
- Speak clearly and naturally.
- Do not translate the text.
- Do not explain anything.
- Do not read these instructions.
- Speak only the text under TEXT TO SPEAK.

TEXT TO SPEAK:
${String(text).trim()}
`;

    // Google Gemini Generate Content TTS API
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent";

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },

      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],

        generationConfig: {
          responseModalities: [
            "AUDIO"
          ],

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

    const data = await response.json();

    // Gemini API error
    if (!response.ok) {
      console.error(
        "Gemini API Error:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error:
          data?.error?.message ||
          "Gemini TTS API Error ဖြစ်နေပါသည်။"
      });
    }

    // Find audio inside Gemini response
    let audioBase64 = null;

    const parts =
      data?.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (
        part?.inlineData?.data
      ) {
        audioBase64 =
          part.inlineData.data;

        break;
      }
    }

    if (!audioBase64) {
      console.error(
        "Gemini response:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error:
          "Gemini က Audio ပြန်မပေးပါ။ API response ထဲမှာ audio data မတွေ့ပါ။"
      });
    }

    // Base64 -> PCM Buffer
    const pcmBuffer =
      Buffer.from(
        audioBase64,
        "base64"
      );

    if (!pcmBuffer.length) {
      return res.status(500).json({
        error:
          "Audio data အလွတ်ဖြစ်နေပါသည်။"
      });
    }

    // Gemini TTS PCM:
    // 24000 Hz
    // 16-bit
    // Mono

    const sampleRate = 24000;
    const channels = 1;
    const bitsPerSample = 16;

    const blockAlign =
      channels *
      bitsPerSample /
      8;

    const byteRate =
      sampleRate *
      blockAlign;

    // WAV Header
    const header =
      Buffer.alloc(44);

    header.write(
      "RIFF",
      0
    );

    header.writeUInt32LE(
      36 + pcmBuffer.length,
      4
    );

    header.write(
      "WAVE",
      8
    );

    header.write(
      "fmt ",
      12
    );

    header.writeUInt32LE(
      16,
      16
    );

    // PCM
    header.writeUInt16LE(
      1,
      20
    );

    // Mono
    header.writeUInt16LE(
      channels,
      22
    );

    // Sample rate
    header.writeUInt32LE(
      sampleRate,
      24
    );

    // Byte rate
    header.writeUInt32LE(
      byteRate,
      28
    );

    // Block align
    header.writeUInt16LE(
      blockAlign,
      32
    );

    // Bits
    header.writeUInt16LE(
      bitsPerSample,
      34
    );

    header.write(
      "data",
      36
    );

    header.writeUInt32LE(
      pcmBuffer.length,
      40
    );

    const wavBuffer =
      Buffer.concat([
        header,
        pcmBuffer
      ]);

    // Send WAV to website
    res.setHeader(
      "Content-Type",
      "audio/wav"
    );

    res.setHeader(
      "Content-Length",
      wavBuffer.length
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="YanNaing-Gemini-TTS.wav"'
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
        "Voice ထုတ်ရာတွင် Error ဖြစ်နေပါသည်။"
    });
  }
          }
