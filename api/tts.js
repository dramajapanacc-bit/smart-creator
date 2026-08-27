export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const { text } = req.body;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'စာသားထည့်ပါ။' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: text }]
            }
          ],
          generationConfig: {
            audioConfig: {
              voice: 'Zephyr',
              languageCode: 'my-MM',
            }
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Gemini API error: ${response.status}` });
    }

    const data = await response.json();
    const audioBase64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioBase64) {
      return res.status(500).json({ error: 'အသံဒေတာမရှိပါ။' });
    }

    const audioBuffer = Buffer.from(audioBase64, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);

  } catch (error) {
    console.error('TTS Error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
}
