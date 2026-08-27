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

const prompt =
  "TTS the following transcript in natural Burmese Myanmar language. " +
  "Do not translate the text. " +
  "Do not explain anything. " +
  "Speak only the transcript.\n\n" +
  String(text).trim();

const response = await fetch(
  "https://generativelanguage.googleapis.com/v1beta/interactions",
  {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      "Api-Revision": "2026-05-20"
    },

    body: JSON.stringify({
      model: "gemini-3.1-flash-tts-preview",

      input: prompt,

      response_format: {
        type: "audio",
        delivery: "inline",
        mime_type: "audio/wav"
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
    "GEMINI ERROR:",
    JSON.stringify(data, null, 2)
  );

  return res.status(response.status).json({
    error:
      data?.error?.message ||
      "Gemini API Error ဖြစ်နေပါသည်။"
  });
}

console.log(
  "GEMINI STATUS:",
  data?.status
);

/*
 * Google Interactions API
 * Normal response:
 *
 * output_audio.data
 */

let audioBase64 =
  data?.output_audio?.data;

/*
 * Fallback:
 * output steps ထဲမှာ audio block ပါလာရင်
 * အဲဒီကနေယူမယ်။
 */

if (!audioBase64 && Array.isArray(data?.steps)) {
  for (const step of data.steps) {

    if (
      step?.delta?.type === "audio" &&
      step?.delta?.data
    ) {
      audioBase64 =
        step.delta.data;
      break;
    }

    if (
      step?.output_audio?.data
    ) {
      audioBase64 =
        step.output_audio.data;
      break;
    }
  }
}

/*
 * output array fallback
 */

if (!audioBase64 && Array.isArray(data?.output)) {
  for (const item of data.output) {

    if (
      item?.type === "audio" &&
      item?.data
    ) {
      audioBase64 =
        item.data;
      break;
    }

    if (
      item?.type === "audio" &&
      item?.audio?.data
    ) {
      audioBase64 =
        item.audio.data;
      break;
    }
  }
}

if (!audioBase64) {

  console.error(
    "NO AUDIO:",
    JSON.stringify(data, null, 2)
  );

  return res.status(500).json({
    error:
      "Gemini က Audio မပြန်ပေးသေးပါ။ Gemini response status: " +
      (data?.status || "unknown")
  });
}

const audioBuffer =
  Buffer.from(
    audioBase64,
    "base64"
  );

if (!audioBuffer.length) {
  return res.status(500).json({
    error:
      "Audio data အလွတ်ဖြစ်နေပါသည်။"
  });
}

/*
 * response_format က audio/wav ဖြစ်တဲ့အတွက်
 * Gemini ပြန်ပေးတဲ့ WAV ကို
 * ထပ်ပြီး WAV header မထည့်ပါ။
 */

res.setHeader(
  "Content-Type",
  "audio/wav"
);

res.setHeader(
  "Content-Length",
  audioBuffer.length
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
  .send(audioBuffer);

} catch (error) {

console.error(
  "SERVER ERROR:",
  error
);

return res.status(500).json({
  error:
    error?.message ||
    "TTS ထုတ်ရာတွင် Error ဖြစ်နေပါသည်။"
});

}
}
