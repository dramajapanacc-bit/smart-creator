export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { videoBase64, mimeType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Gemini API Key စစ်ဆေးပါ၊ Vercel ထဲမှာ မရှိပါ။' });

  const prompt = "Watch this video clip carefully. Write an engaging Movie Recap Voiceover script in Myanmar language describing what happens in this scene.";

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: videoBase64
              }
            }
          ]
        }]
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      const script = data.candidates[0].content.parts[0].text;
      return res.status(200).json({ script });
    } else {
      return res.status(500).json({ error: 'AI မှ စာသား ထုတ်မပေးနိုင်ပါ။' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Video analysis မအောင်မြင်ပါ။' });
  }
}

