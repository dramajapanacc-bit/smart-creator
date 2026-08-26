export default async function handler(req, res) {
  // POST request ပဲ လက်ခံမယ်
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    });
  }

  const { videoUrl } = req.body || {};
  const apiKey = process.env.GEMINI_API_KEY;

  // Gemini API Key မရှိရင်
  if (!apiKey) {
    return res.status(500).json({
      error: 'Gemini API Key မရှိပါ။ Vercel Environment Variables တွင် GEMINI_API_KEY ထည့်ပါ။'
    });
  }

  // Movie name / link မရှိရင်
  if (!videoUrl || !String(videoUrl).trim()) {
    return res.status(400).json({
      error: 'Movie Name သို့မဟုတ် Movie Link ထည့်ပေးပါ။'
    });
  }

  const input = String(videoUrl).trim();

  const prompt = `
သင်သည် မြန်မာဘာသာဖြင့် YouTube / TikTok Movie Recap Voiceover Script ရေးပေးသော AI ဖြစ်သည်။

User ထည့်ထားသော Movie Name သို့မဟုတ် Movie Link:
"${input}"

ဒီအချက်အလက်ကို အခြေခံပြီး ပရိသတ်စိတ်ဝင်စားအောင် မြန်မာ Movie Recap Script ရေးပေးပါ။

လိုက်နာရမည့်အချက်များ -

1. မြန်မာဘာသာဖြင့် သဘာဝကျကျ ရေးပါ။
2. ဇာတ်လမ်းကို အစ → အလယ် → အဆုံး အစဉ်လိုက် ရေးပါ။
3. ဇာတ်ကောင်များနှင့် အရေးကြီးသောဖြစ်ရပ်များကို မလိုအပ်ဘဲ မချန်ထားပါနှင့်။
4. YouTube / TikTok Voiceover အတွက် နားထောင်လို့ကောင်းသော narration style အသုံးပြုပါ။
5. စိတ်ဝင်စားစရာကောင်းအောင် suspense နှင့် storytelling ကို သဘာဝကျစွာ အသုံးပြုပါ။
6. ဇာတ်လမ်းအချက်အလက်ကို မသေချာပါက မတီထွင်ပါနှင့်။
7. အလွန်တိုသော summary မရေးပါနှင့်။
8. Script ကို စာပိုဒ်များခွဲပြီး ဖတ်ရလွယ်အောင် ရေးပါ။
9. Output သည် အများဆုံး 5000 characters ခန့် ဖြစ်ရမည်။
10. Intro / Outro ကို အလွန်ရှည်မရေးပါနှင့်။
11. "ဒီကားက..." စသည့် သဘာဝကျသော Movie Recap narration ဖြင့် စတင်နိုင်သည်။
12. Markdown code block မသုံးပါနှင့်။ Script စာသားကို တိုက်ရိုက်ပြန်ပေးပါ။

ယခု Movie Recap Voiceover Script ကို ရေးပေးပါ။
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
            temperature: 0.8,
            maxOutputTokens: 8000
          }
        })
      }
    );

    const data = await response.json();

    // Gemini API error
    if (!response.ok) {
      console.error('Gemini API Error:', data);

      const apiError =
        data?.error?.message ||
        'Gemini API မှ အမှားတစ်ခု ပြန်လည်ရရှိခဲ့ပါသည်။';

      return res.status(response.status >= 400 ? response.status : 500).json({
        error: apiError
      });
    }

    // Script ကို ရယူမယ်
    const script =
      data?.candidates?.[0]?.content?.parts
        ?.map(part => part.text || '')
        .join('')
        .trim();

    if (!script) {
      console.error('Gemini Empty Response:', data);

      return res.status(500).json({
        error: 'Gemini မှ Script မပြန်ပေးနိုင်ပါ။ နောက်တစ်ကြိမ် ထပ်ကြိုးစားပါ။'
      });
    }

    // 5000 characters ထက်ကျော်ရင်
    // စာကြောင်းအဆုံးမှာပဲ ဖြတ်မယ်
    let finalScript = script;

    if (finalScript.length > 5000) {
      const shortened = finalScript.slice(0, 5000);
      const lastBreak = Math.max(
        shortened.lastIndexOf('။'),
        shortened.lastIndexOf('\n'),
        shortened.lastIndexOf('!')
      );

      finalScript =
        lastBreak > 4000
          ? shortened.slice(0, lastBreak + 1)
          : shortened;
    }

    return res.status(200).json({
      script: finalScript
    });

  } catch (error) {
    console.error('Server Error:', error);

    return res.status(500).json({
      error: 'Server ချိတ်ဆက်မှု အဆင်မပြေပါ။ ခဏနေပြီး ပြန်ကြိုးစားပါ။'
    });
  }
}
