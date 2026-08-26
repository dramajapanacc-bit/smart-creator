export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const {
      text,
      voice = 'thiha',
      speed = 1,
      pitch = 0
    } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: 'မြန်မာစာ ထည့်ပေးပါ။'
      });
    }

    const apiKey = process.env.FREETTS_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'FREETTS_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကို စစ်ပါ။'
      });
    }

    const cleanText = String(text).trim();

    if (cleanText.length > 1000) {
      return res.status(400).json({
        error: 'Free API အတွက် တစ်ကြိမ်လျှင် စာလုံး 1000 အထိသာ စမ်းသပ်နိုင်ပါသည်။'
      });
    }

    /*
      IMPORTANT:
      FreeTTS API က voice parameter အဖြစ်
      voice catalog ထဲက ShortName ကို လက်ခံပါတယ်။

      အောက်က voice ID တွေကို
      Burmese voice catalog နဲ့ကိုက်အောင် သုံးထားပါတယ်။
    */

    const selectedVoice =
      voice === 'nilar'
        ? 'my-MM-NilarNeural'
        : 'my-MM-ThihaNeural';

    /*
      UI speed:
      0.5x - 2.0x

      API rate:
      -50% to +100%
    */

    const speedNumber = Number(speed);

    let rate = 0;

    if (Number.isFinite(speedNumber)) {
      rate = Math.round((speedNumber - 1) * 100);
    }

    rate = Math.max(-50, Math.min(100, rate));

    const rateValue =
      `${rate >= 0 ? '+' : ''}${rate}%`;

    const pitchNumber = Number(pitch);

    const safePitch =
      Number.isFinite(pitchNumber)
        ? Math.max(-20, Math.min(20, Math.round(pitchNumber)))
        : 0;

    const pitchValue =
      `${safePitch >= 0 ? '+' : ''}${safePitch}Hz`;

    console.log('FreeTTS request:', {
      voice: selectedVoice,
      rate: rateValue,
      pitch: pitchValue,
      length: cleanText.length
    });

    /*
      1. Generate speech
    */

    const generateResponse = await fetch(
      'https://freetts.org/api/v1/tts',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },

        body: JSON.stringify({
          text: cleanText,
          voice: selectedVoice,
          rate: rateValue,
          pitch: pitchValue,
          output_format: 'mp3'
        })
      }
    );

    const generateData =
      await generateResponse.json();

    if (!generateResponse.ok) {
      console.error(
        'FreeTTS Generate Error:',
        generateData
      );

      return res.status(
        generateResponse.status >= 400 &&
        generateResponse.status < 500
          ? generateResponse.status
          : 500
      ).json({
        error:
          generateData?.error ||
          generateData?.message ||
          'FreeTTS မှ အသံထုတ်မရပါ။'
      });
    }

    const fileId =
      generateData?.file_id;

    if (!fileId) {
      console.error(
        'FreeTTS missing file_id:',
        generateData
      );

      return res.status(500).json({
        error: 'FreeTTS မှ audio file ID မရပါ။'
      });
    }

    /*
      2. Download generated MP3
    */

    const audioResponse =
      await fetch(
        `https://freetts.org/api/audio/${encodeURIComponent(fileId)}`
      );

    if (!audioResponse.ok) {
      const errorText =
        await audioResponse.text();

      console.error(
        'FreeTTS Audio Error:',
        audioResponse.status,
        errorText
      );

      return res.status(500).json({
        error: 'MP3 အသံဖိုင် ရယူမရပါ။'
      });
    }

    const audioBuffer =
      Buffer.from(
        await audioResponse.arrayBuffer()
      );

    if (!audioBuffer.length) {
      return res.status(500).json({
        error: 'Audio file အလွတ်ဖြစ်နေပါသည်။'
      });
    }

    /*
      3. Send MP3 to browser
    */

    res.setHeader(
      'Content-Type',
      'audio/mpeg'
    );

    res.setHeader(
      'Content-Disposition',
      'inline; filename="YanNaing-Myanmar-Voice.mp3"'
    );

    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    return res.status(200).send(
      audioBuffer
    );

  } catch (error) {

    console.error(
      'TTS Server Error:',
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        'Myanmar Voice ထုတ်ရာတွင် Server Error ဖြစ်နေပါသည်။'
    });
  }
}
