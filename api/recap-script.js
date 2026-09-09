// ============================================
// API Route: /api/recap-script (Vercel Compatible)
// ============================================

export default async function handler(req, res) {
  // CORS သတ်မှတ်ပါ
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    // Body ကနေ Data ယူပါ (File System မသုံးပါ)
    const { audioBase64, frames, language, style } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // Gemini Prompt ဆောက်ပါ
    const prompt = `
You are an expert scriptwriter. Analyze this video's audio and visual frames to create a Myanmar (Burmese) recap script.

Style: ${style || 'Myanmar Movie Recap'}

CRITICAL INSTRUCTIONS:
1. Listen to the audio carefully
2. Understand the story from the audio and frames
3. Create a natural, engaging Myanmar recap script
4. Use proper Myanmar language with correct grammar
5. Use short sentences for natural reading
6. Add proper punctuation (၊ and ။)
7. Start with a strong hook
8. Keep it suitable for voiceover (TTS)
9. Return ONLY the Myanmar script text
`;

    // Gemini API Payload ဆောက်ပါ
    const geminiPayload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "audio/wav", data: audioBase64 } },
          ...(frames || []).map(f => ({ 
            inlineData: { mimeType: "image/jpeg", data: f } 
          }))
        ]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      }
    };

    // Gemini API ကိုခေါ်ပါ
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload)
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return res.status(500).json({ error: 'Gemini API error: ' + errorText });
    }

    const data = await response.json();
    const script = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!script) {
      return res.status(500).json({ error: 'No script generated' });
    }

    return res.status(200).json({
      success: true,
      script: script.trim(),
      language: language || 'my-MM',
      style: style || 'Myanmar Movie Recap'
    });

  } catch (error) {
    console.error('Recap Script Error:', error);
    return res.status(500).json({ 
      error: 'Server error: ' + (error.message || 'Unknown error') 
    });
  }
}
