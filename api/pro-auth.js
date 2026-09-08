export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  try {
    // Frontend က accessKey ပို့တာနဲ့ ကိုက်အောင် ပြင်ထားတယ်
    const { accessKey } = req.body || {};

    if (!accessKey) {
      return res.status(400).json({
        ok: false,
        error: "PRO Key ထည့်ပါ။"
      });
    }

    const proKey = process.env.YNT_PRO_KEY;

    if (!proKey) {
      console.error("YNT_PRO_KEY is not configured");

      return res.status(500).json({
        ok: false,
        error: "PRO system မပြင်ဆင်ရသေးပါ။ Vercel Environment Variables ကို စစ်ပါ။"
      });
    }

    if (accessKey !== proKey) {
      return res.status(401).json({
        ok: false,
        error: "PRO Key မှားနေပါတယ်။"
      });
    }

    return res.status(200).json({
      ok: true,
      pro: true,
      message: "PRO Access Granted"
    });

  } catch (error) {
    console.error("PRO Auth Error:", error);

    return res.status(500).json({
      ok: false,
      error: "PRO authentication မအောင်မြင်ပါ။"
    });
  }
}
