import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

export default async function handler(req, res) {
    const { text, voice } = req.query;

    if (!text) {
        return res.status(400).json({ error: "Text is required" });
    }

    try {
        const tts = new MsEdgeTTS();
        
        // မြန်မာ အမျိုးသားအသံ (my-MM-ThihaNeural) သို့မဟုတ် အမျိုးသမီးအသံ (my-MM-NilarNeural)
        const selectedVoice = voice || 'my-MM-ThihaNeural';

        await tts.setMetadata(selectedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBPS_MONO_MP3);
        
        const readable = tts.toStream(text);
        
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');

        readable.pipe(res);
    } catch (error) {
        // Fallback for edge-tts
        try {
            const targetVoice = voice || 'my-MM-ThihaNeural';
            const edgeUrl = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/single/tts?api-version=2023-03-01-preview`;
            
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Access-Control-Allow-Origin', '*');

            // Quick API fallback
            const response = await fetch(`https://api.streamelements.com/kappa/v2/speech?voice=my-MM-ThihaNeural&text=${encodeURIComponent(text)}`);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                return res.send(Buffer.from(arrayBuffer));
            }

            throw new Error("TTS Engine Error");
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}
