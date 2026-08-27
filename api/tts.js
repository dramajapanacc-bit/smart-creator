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
    error: "GEMINI_API_KEY မတွေ့ပါ။ Vercel Environment Variables မှာ ထည့်ပါ။"
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

const inputText =
  "Speak the following transcript in natural Burmese Myanmar language. " +
  "Do not translate it. " +
  "Do not explain it. " +
  "Only speak the transcript.\n\n" +
  String(text).trim();

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
    JSON.stringify(data, null, 2)
  );

  return res.status(response.status).json({
    error:
      data?.error?.message ||
      "Gemini API Error ဖြစ်နေပါသည်။"
  });
}

console.log(
  "Gemini response:",
  JSON.stringify(data, null, 2)
);

/*
  Gemini Interactions API
  Audio ကို output_audio.data ထဲမှာ ပြန်ပေးပါတယ်။
*/

let audioBase64 =
  data?.output_audio?.data;

/*
  တချို့ response structure တွေမှာ
  output_audio မဟုတ်ဘဲ output array ထဲက
  audio block ဖြစ်နိုင်တဲ့အတွက် fallback ရှာပါ။
*/

if (!audioBase64 && Array.isArray(data?.outputs)) {
  for (const item of data.outputs) {
    if (
      item?.type === "audio" &&
      item?.data
    ) {
      audioBase64 = item.data;
      break;
    }

    if (
      item?.type === "audio" &&
      item?.audio?.data
    ) {
      audioBase64 = item.audio.data;
      break;
    }
  }
}

if (!audioBase64 && Array.isArray(data?.output)) {
  for (const item of data.output) {
    if (
      item?.type === "audio" &&
      item?.data
    ) {
      audioBase64 = item.data;
      break;
    }

    if (
      item?.type === "audio" &&
      item?.audio?.data
    ) {
      audioBase64 = item.audio.data;
      break;
    }
  }
}

if (!audioBase64) {
  console.error(
    "NO AUDIO IN GEMINI RESPONSE:",
    JSON.stringify(data, null, 2)
  );

  return res.status(500).json({
    error:
      "Gemini response ထဲမှာ Audio မပါလာပါ။ Vercel Logs ကိုစစ်ရန်လိုပါသည်။"
  });
}

const pcmBuffer = Buffer.from(
  audioBase64,
  "base64"
);

if (!pcmBuffer.length) {
  return res.status(500).json({
    error:
      "Gemini Audio data အလွတ်ဖြစ်နေပါသည်။"
  });
}

/*
  Gemini TTS PCM:
  24,000 Hz
  16-bit
  Mono
*/

const channels = 1;
const sampleRate = 24000;
const bitsPerSample = 16;
const blockAlign =
  channels * (bitsPerSample / 8);

const byteRate =
  sampleRate * blockAlign;

const wavHeader = Buffer.alloc(44);

wavHeader.write("RIFF", 0);

wavHeader.writeUInt32LE(
  36 + pcmBuffer.length,
  4
);

wavHeader.write("WAVE", 8);

wavHeader.write("fmt ", 12);

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

const wavBuffer = Buffer.concat([
  wavHeader,
  pcmBuffer
]);

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
