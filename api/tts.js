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
      pitch = 0
    } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "မြန်မာစာ ထည့်ပေးပါ။"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကိုစစ်ပါ။"
      });
    }

    /*
     * ==========================================
     * LIMIT TEXT
     * ==========================================
     */

    const cleanText =
      String(text)
        .trim()
        .slice(0, 5000);


    /*
     * ==========================================
     * VALID VOICES
     * ==========================================
     */

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


    /*
     * ==========================================
     * EMOTION
     * ==========================================
     */

    const emotionMap = {

      natural:
        "Speak naturally with a clear neutral Myanmar narration style.",

      happy:
        "Speak warmly and happily with a cheerful expressive tone.",

      sad:
        "Speak gently with a sad and emotional tone.",

      angry:
        "Speak firmly with an angry and intense tone.",

      excited:
        "Speak with energetic and excited expression.",

      serious:
        "Speak seriously with a calm authoritative narration style.",

      calm:
        "Speak calmly, smoothly and naturally.",

      whisper:
        "Speak softly and quietly with a gentle whisper-like style.",

      dramatic:
        "Speak dramatically with strong emotional expression."
    };

    const selectedEmotion =
      emotionMap[emotion] ||
      emotionMap.natural;


    /*
     * ==========================================
     * SPEED
     * ==========================================
     */

    const speedNumber =
      Math.max(
        -5,
        Math.min(
          5,
          Number(speed) || 0
        )
      );

    let speedText =
      "Use a normal natural speaking pace.";

    if (speedNumber <= -3) {
      speedText =
        "Speak very slowly and clearly.";
    }
    else if (speedNumber === -2) {
      speedText =
        "Speak slowly and clearly.";
    }
    else if (speedNumber === -1) {
      speedText =
        "Speak slightly slower than normal.";
    }
    else if (speedNumber === 1) {
      speedText =
        "Speak slightly faster than normal.";
    }
    else if (speedNumber === 2) {
      speedText =
        "Speak faster than normal.";
    }
    else if (speedNumber >= 3) {
      speedText =
        "Speak very quickly while remaining understandable.";
    }


    /*
     * ==========================================
     * PITCH
     * ==========================================
     */

    const pitchNumber =
      Math.max(
        -5,
        Math.min(
          5,
          Number(pitch) || 0
        )
      );

    let pitchText =
      "Use a natural voice pitch.";

    if (pitchNumber <= -3) {
      pitchText =
        "Use a noticeably deeper and lower voice pitch.";
    }
    else if (pitchNumber === -2) {
      pitchText =
        "Use a lower voice pitch.";
    }
    else if (pitchNumber === -1) {
      pitchText =
        "Use a slightly lower voice pitch.";
    }
    else if (pitchNumber === 1) {
      pitchText =
        "Use a slightly higher voice pitch.";
    }
    else if (pitchNumber === 2) {
      pitchText =
        "Use a higher voice pitch.";
    }
    else if (pitchNumber >= 3) {
      pitchText =
        "Use a noticeably higher voice pitch.";
    }


    /*
     * ==========================================
     * TTS PROMPT
     * ==========================================
     */

    const prompt = `
Generate a Myanmar Burmese narration.

Voice:
Use the selected Gemini voice.

Style:
${selectedEmotion}

Pacing:
${speedText}

Pitch:
${pitchText}

Important:
- Speak only the Burmese text.
- Do not translate it.
- Do not explain anything.
- Do not read these instructions.
- Do not add extra words.
- Keep the Burmese pronunciation natural.
- Make it suitable for a movie recap narrator.

TEXT:
${cleanText}
`;


    /*
     * ==========================================
     * GEMINI TTS
     * ==========================================
     */

    const model =
      "gemini-2.5-flash-preview-tts";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;


    const geminiResponse =
      await fetch(
        url,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
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
                    voiceName:
                      selectedVoice
                  }

                }

              }

            }

          })
        }
      );


    /*
     * ==========================================
     * READ GEMINI RESPONSE
     * ==========================================
     */

    const data =
      await geminiResponse.json();


    if (!geminiResponse.ok) {

      console.error(
        "Gemini TTS ERROR:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      return res.status(
        geminiResponse.status || 500
      ).json({

        error:
          data?.error?.message ||
          "Gemini TTS API Error ဖြစ်နေပါသည်။",

        details:
          data?.error || null

      });
    }


    /*
     * ==========================================
     * FIND AUDIO
     * ==========================================
     */

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
        "NO AUDIO IN GEMINI RESPONSE:",
        JSON.stringify(
          data,
          null,
          2
        )
      );

      return res.status(500).json({

        error:
          "Gemini မှ Audio မပြန်လာပါ။",

        debug:
          data?.candidates ||
          data

      });
    }


    /*
     * ==========================================
     * BASE64 → PCM
     * ==========================================
     */

    const pcmBuffer =
      Buffer.from(
        audioBase64,
        "base64"
      );


    if (
      !pcmBuffer ||
      !pcmBuffer.length
    ) {

      return res.status(500).json({
        error:
          "Gemini Audio Data အလွတ်ဖြစ်နေပါသည်။"
      });
    }


    /*
     * ==========================================
     * PCM → WAV
     *
     * Gemini TTS PCM:
     * 24000 Hz
     * Mono
     * 16-bit
     * ==========================================
     */

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


    const wavBuffer =
      Buffer.concat([
        wavHeader,
        pcmBuffer
      ]);


    /*
     * ==========================================
     * RETURN AUDIO
     * ==========================================
     */

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
      'inline; filename="YNT-TTS.wav"'
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
