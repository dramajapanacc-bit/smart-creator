export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const { videoUrl } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY မတွေ့ပါ။ Vercel Environment Variables ကို စစ်ပါ။'
    });
  }

  if (!videoUrl || !String(videoUrl).trim()) {
    return res.status(400).json({
      error: 'Movie Name သို့မဟုတ် Movie Link ထည့်ပေးပါ။'
    });
  }

  const prompt = `
သင်သည် မြန်မာ YouTube/TikTok Movie Recap Script ရေးပေးသော AI ဖြစ်သည်။

User ထည့်ထားသော Movie Name သို့မဟုတ် Movie Link:
"${String(videoUrl).trim()}"

အဆိုပါ Movie ကိုအခြေခံ၍ မြန်မာဘာသာဖြင့် စိတ်ဝင်စားစရာကောင်းသော Movie Recap Voiceover Script ရေးပါ။

လိုက်နာရန် -

- ဇာတ်လမ်းကို အစ၊ အလယ်၊ အဆုံး အစဉ်လိုက် ရေးပါ။
- အရေးကြီးသော ဇာတ်ကောင်များနှင့် ဖြစ်ရပ်များကို ထည့်ပါ။
- YouTube Movie Recap Voiceover အတွက် သဘာဝကျသော မြန်မာစကားပြောပုံစံ အသုံးပြုပါ။
- Suspense နှင့် storytelling ကောင်းကောင်း ထည့်ပါ။
- ဇာတ်လမ်းအချက်အလက် မသေချာပါက မတီထွင်ပါနှင့်။
- အလွန်တိုသော summary မရေးပါနှင့်။
- Script ကို စာပိုဒ်များခွဲပြီး ဖတ်ရလွယ်အောင် ရေးပါ။
- အများဆုံး စာလုံး 5000 ခန့် ရေးပါ။
- Code block မသုံးပါနှင့်။
- Script စာသားကို တိုက်ရိုက်ပေးပါ။
`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: 8000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API Error:', data);

      return res.status(500).json({
        error:
          data?.error?.message ||
          'Gemini API Error ဖြစ်နေပါသည်။'
      });
    }

    const script =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('')
        .trim();

    if (!script) {
      console.error('Empty Gemini response:', data);

      return res.status(500).json({
        error: 'Gemini မှ Script ပြန်မပေးနိုင်ပါ။'
      });
    }

    return res.status(200).json({
      script: script.slice(0, 5000)
    });

  } catch (error) {
    console.error('Server Error:', error);

    return res.status(500).json({
      error: `Server Error: ${error.message}`
    });
  }
}
