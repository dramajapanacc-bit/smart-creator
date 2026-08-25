export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoUrl } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key မရှိပါ။ Vercel Environment Variables တွင် ထည့်ပါ။' });
  }

  if (!videoUrl) {
    return res.status(400).json({ error: 'ကျေးဇူးပြု၍ ဗီဒီယို လင့်ခ် ထည့်ပေးပါ။' });
  }

  // Gemini AI အတွက် ပိုမိုကောင်းမွန်သော မြန်မာ Movie Recap Prompt
  const prompt = `အောက်ပါ လင့်ခ် သို့မဟုတ် အကြောင်းအရာကို အခြေခံ၍ စိတ်ဝင်စားစရာကောင်းပြီး ပရိသတ်ကို ဖမ်းစားနိုင်သော မြန်မာ Movie Recap Voiceover Script တစ်ခုကို ရေးပေးပါ။ ဇာတ်လမ်းအစ၊ အလယ်၊ အဆုံး စီးဆင်းမှု ကောင်းမွန်အောင် အခန်းဆက် ခွဲခြားပြီး ရေးပေးပါ။ လင့်ခ် - ${videoUrl}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0].content.parts[0].text) {
      const script = data.candidates[0].content.parts[0].text;
      return res.status(200).json({ script });
    } else {
      return res.status(500).json({ error: 'AI မှ စာသား ထုတ်မပေးနိုင်ပါ။ ကျေးဇူးပြု၍ လင့်ခ်အမှန်ကို ထည့်ပါ။' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Server ချိတ်ဆက်မှု အဆင်မပြေပါ။' });
  }
}
