export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    // API Key မလိုဘဲ အခမဲ့ သုံးနိုင်သော TTS စနစ်
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=my&client=tw-ob`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error('Failed to fetch audio');
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('TTS Error:', error);
    return res.status(500).json({ error: 'Audio generation failed' });
  }
}
