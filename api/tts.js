export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { text, voice } = req.body || {};

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

    // Google Gemini TTS မူရင်း Voice ၅ ခု
    const allowedVoices = [
      "Zephyr",
      "Puck",
      "Charon",
      "Kore",
      "Leda"
    ];

    const selectedVoice = allowedVoices.includes(voice)
      ? voice
      : "Zephyr";

    const inputText =
      "TTS the following text in Burmese Myanmar language. " +
      "Speak only the provided text. " +
      "Do not translate it. " +
      "Use natural, clear Burmese pronunciation with a smooth narration style.\n\n" +
      String(text).trim();

    // Google ရဲ့ လက်ရှိ Gemini 3.1 TTS Interactions API
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          model: "gemini-3.1-flash-tts-preview",

          input: inputText,

          response_format: {
            type: "audio"
          },

          generation_config: {
            speech_config: [
              {
                voice: selectedVoice
              }
            ]
          }
        })
      }
    );

    const data = await response.json();

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

    /*
      Google Interactions API
      output_audio.data ထဲမှာ Base64 audio ရှိပါတယ်။
    */

    const audioBase64 =
      data?.output_audio?.data;

    if (!audioBase64) {
      console.error(
        "Gemini response:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        error: "Gemini မှ Audio ပြန်မပေးပါ။"
      });
    }

    const pcmBuffer = Buffer.from(
      audioBase64,
      "base64"
    );

    /*
      Gemini TTS Audio
      24kHz / 16-bit / Mono PCM
      PCM → WAV
    */

    const wavHeader = Buffer.alloc(44);

    wavHeader.write("RIFF", 0);

    wavHeader.writeUInt32LE(
      36 + pcmBuffer.length,
      4
    );

    wavHeader.write("WAVE", 8);
    wavHeader.write("fmt ", 12);

    // PCM format chunk size
    wavHeader.writeUInt32LE(16, 16);

    // PCM
    wavHeader.writeUInt16LE(1, 20);

    // Mono
    wavHeader.writeUInt16LE(1, 22);

    // Sample rate
    wavHeader.writeUInt32LE(
      24000,
      24
    );

    // Byte rate
    wavHeader.writeUInt32LE(
      24000 * 2,
      28
    );

    // Block align
    wavHeader.writeUInt16LE(2, 32);

    // Bits per sample
    wavHeader.writeUInt16LE(16, 34);

    wavHeader.write("data", 36);

    wavHeader.writeUInt32LE(
      pcmBuffer.length,
      40
    );

    const wavBuffer = Buffer.concat([
      wavHeader,
      pcmBuffer
    ]);

    res.setHeader(
      "Content-Type",
      "audio/wav"
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="Gemini-Myanmar-TTS.wav"'
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
