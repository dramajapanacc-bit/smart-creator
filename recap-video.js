export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { videoUrl } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Gemini API Key မရှိပါ။ Vercel တွင် ထည့်ပါ။' });
  }

  if (!videoUrl) {
    return res.status(400).json({ error: 'အချက်အလက် ထည့်ရန် လိုအပ်ပါသည်။' });
  }

  const prompt = `User မှ ဤအချက်အလက်ကို ပေးထားပါသည်: "${videoUrl}". 
  အကယ်၍ ၎င်းသည် ရုပ်ရှင်အမည် သို့မဟုတ် ဗီဒီယိုလင့်ခ်ဖြစ်ပါက၊ ထိုဇာတ်လမ်းကို အခြေခံ၍ ပရိသတ်ကို ဖမ်းစားနိုင်ပြီး စိတ်လှုပ်ရှားစရာကောင်းသော မြန်မာ Movie Recap Voiceover Script တစ်ခုကို ဇာတ်လမ်းအစ၊ အလယ်၊ အဆုံး စီးဆင်းမှု ကောင်းမွန်စွာဖြင့် အခန်းဆက် ခွဲခြားကာ အသေးစိတ် ရေးပေးပါ။`;

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
      return res.status(500).json({ error: 'AI မှ စာသား ထုတ်မပေးနိုင်ပါ။' });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Server ချိတ်ဆက်မှု အဆင်မပြေပါ။' });
  }
}
