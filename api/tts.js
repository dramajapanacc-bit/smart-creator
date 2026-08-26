export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  try {
    const { text } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({
        error: 'Text is required'
      });
    }

    const cleanText = String(text).trim();

    // Google Translate TTS
    const url =
      'https://translate.google.com/translate_tts' +
      '?ie=UTF-8' +
      '&client=tw-ob' +
      '&tl=my' +
      '&q=' +
      encodeURIComponent(cleanText);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error('Google TTS Error:', response.status, errorText);

      return res.status(500).json({
        error: `TTS request failed (${response.status})`
      });
    }

    const audioBuffer = Buffer.from(
      await response.arrayBuffer()
    );

    if (!audioBuffer.length) {
      return res.status(500).json({
        error: 'Audio file is empty'
      });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="myanmar-voice.mp3"'
    );
    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    return res.status(200).send(audioBuffer);

  } catch (error) {
    console.error('TTS Error:', error);

    return res.status(500).json({
      error: 'Myanmar Voice ထုတ်ရာတွင် အမှားဖြစ်နေပါသည်။'
    });
  }
}
