export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const {
      text,
      voice = "thiha",
      speed = 1,
      pitch = 0
    } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: "မြန်မာစာ ထည့်ပေးပါ။"
      });
    }

    const apiKey = process.env.FREETTS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "FREETTS_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကို စစ်ပါ။"
      });
    }

    const cleanText = String(text).trim();

    /*
     * Free API request limit
     */
    if (cleanText.length > 5000) {
      return res.status(400).json({
        error: "စာလုံးရေ 5000 ထက် မကျော်ရပါ။"
      });
    }

    /*
     * 1. FreeTTS voice list ကို အရင်ယူမယ်
     */
    const voicesResponse = await fetch(
      "https://freetts.org/api/voices"
    );

    if (!voicesResponse.ok) {
      return res.status(500).json({
        error: "FreeTTS Voice List ရယူမရပါ။"
      });
    }

    const voices = await voicesResponse.json();

    if (!Array.isArray(voices)) {
      return res.status(500).json({
        error: "FreeTTS Voice List ပုံစံမမှန်ပါ။"
      });
    }

    /*
     * Burmese voice တွေကို ရှာမယ်
     */
    const burmeseVoices = voices.filter((v) => {

      const locale =
        String(
          v.Locale ||
          v.locale ||
          ""
        ).toLowerCase();

      const localeName =
        String(
          v.LocaleName ||
          v.localeName ||
          ""
        ).toLowerCase();

      return (
        locale === "my-mm" ||
        locale.startsWith("my-") ||
        localeName.includes("burmese") ||
        localeName.includes("myanmar")
      );

    });

    if (!burmeseVoices.length) {
      console.error(
        "No Burmese voices found:",
        voices.slice(0, 10)
      );

      return res.status(500).json({
        error: "FreeTTS မှ Burmese Voice မတွေ့ပါ။"
      });
    }

    /*
     * Thiha / Nilar ကို ရှာမယ်
     */
    const searchName =
      voice === "nilar"
        ? "nilar"
        : "thiha";

    let selected = burmeseVoices.find((v) => {

      const shortName =
        String(
          v.ShortName ||
          v.shortName ||
          ""
        ).toLowerCase();

      const name =
        String(
          v.Name ||
          v.name ||
          ""
        ).toLowerCase();

      return (
        shortName.includes(searchName) ||
        name.includes(searchName)
      );

    });

    /*
     * မတွေ့ရင် gender နဲ့ fallback လုပ်မယ်
     */
    if (!selected) {

      if (voice === "nilar") {

        selected =
          burmeseVoices.find((v) =>
            String(
              v.Gender ||
              v.gender ||
              ""
            ).toLowerCase() === "female"
          );

      } else {

        selected =
          burmeseVoices.find((v) =>
            String(
              v.Gender ||
              v.gender ||
              ""
            ).toLowerCase() === "male"
          );

      }

    }

    if (!selected) {
      return res.status(500).json({
        error:
          "ရွေးထားသော Burmese Voice မတွေ့ပါ။"
      });
    }

    const selectedVoice =
      selected.ShortName ||
      selected.shortName;

    if (!selectedVoice) {
      return res.status(500).json({
        error:
          "Burmese Voice ID မရပါ။"
      });
    }

    console.log(
      "Selected Burmese Voice:",
      selectedVoice
    );

    /*
     * Speed
     */
    let speedNumber =
      Number(speed);

    if (!Number.isFinite(speedNumber)) {
      speedNumber = 1;
    }

    speedNumber =
      Math.max(
        0.5,
        Math.min(2, speedNumber)
      );

    const rate =
      Math.round(
        (speedNumber - 1) * 100
      );

    const rateValue =
      `${rate >= 0 ? "+" : ""}${rate}%`;

    /*
     * Pitch
     */
    let pitchNumber =
      Number(pitch);

    if (!Number.isFinite(pitchNumber)) {
      pitchNumber = 0;
    }

    pitchNumber =
      Math.max(
        -20,
        Math.min(20, pitchNumber)
      );

    const pitchValue =
      `${pitchNumber >= 0 ? "+" : ""}${Math.round(pitchNumber)}Hz`;

    /*
     * 2. Burmese Voice နဲ့ Generate
     */
    const generateResponse =
      await fetch(
        "https://freetts.org/api/v1/tts",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "x-api-key":
              apiKey
          },

          body: JSON.stringify({

            text:
              cleanText,

            voice:
              selectedVoice,

            rate:
              rateValue,

            pitch:
              pitchValue,

            output_format:
              "mp3"

          })
        }
      );

    const data =
      await generateResponse.json();

    if (!generateResponse.ok) {

      console.error(
        "FreeTTS Generate Error:",
        data
      );

      return res.status(
        generateResponse.status
      ).json({
        error:
          data?.error ||
          data?.message ||
          "FreeTTS အသံထုတ်မရပါ။"
      });

    }

    const fileId =
      data?.file_id;

    if (!fileId) {

      return res.status(500).json({
        error:
          "FreeTTS မှ Audio File ID မရပါ။"
      });

    }

    /*
     * 3. MP3 Download
     */
    const audioResponse =
      await fetch(
        `https://freetts.org/api/audio/${encodeURIComponent(fileId)}`
      );

    if (!audioResponse.ok) {

      return res.status(500).json({
        error:
          "MP3 အသံဖိုင် ရယူမရပါ။"
      });

    }

    const audioBuffer =
      Buffer.from(
        await audioResponse.arrayBuffer()
      );

    if (!audioBuffer.length) {

      return res.status(500).json({
        error:
          "Audio file အလွတ်ဖြစ်နေပါသည်။"
      });

    }

    res.setHeader(
      "Content-Type",
      "audio/mpeg"
    );

    res.setHeader(
      "Content-Disposition",
      'inline; filename="YanNaing-Myanmar-Voice.mp3"'
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
      "TTS Server Error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Myanmar Voice ထုတ်ရာတွင် Server Error ဖြစ်နေပါသည်။"
    });

  }
        }
