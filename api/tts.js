export default async function handler(req, res) {
    const { text } = req.query;

    if (!text) {
        return res.status(400).json({ error: "Text is required" });
    }

    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=my&client=tw-ob`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('TTS fetch failed');
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(200).send(buffer);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
