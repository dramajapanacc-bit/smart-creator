export default async function handler(req, res) {
    const { text, lang } = req.query;

    if (!text) {
        return res.status(400).json({ error: "Text is required" });
    }

    try {
        const targetLang = lang || 'my';
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${targetLang}&client=tw-ob`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
            }
        });

        if (!response.ok) throw new Error('TTS Fetch Failed');

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

