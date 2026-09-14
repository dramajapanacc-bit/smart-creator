export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  try {
    const { text } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: "Text is required"
      });
    }

    const sentences = text
      .replace(/\r/g, "")
      .split(/(?<=[။!?])/)
      .map(s => s.trim())
      .filter(Boolean);

    const srt = [];
    let currentTime = 0;

    sentences.forEach((sentence, index) => {
      const duration = Math.max(
        2,
        Math.min(
          7,
          Math.ceil(sentence.length / 12)
        )
      );

      const start = formatTime(currentTime);
      const end = formatTime(currentTime + duration);

      srt.push(
        `${index + 1}\n${start} --> ${end}\n${sentence}\n`
      );

      currentTime += duration;
    });

    return res.status(200).json({
      success: true,
      srt: srt.join("\n"),
      duration: currentTime
    });

  } catch (error) {
    console.error("news-srt error:", error);

    return res.status(500).json({
      success: false,
      error: "SRT generation failed"
    });
  }
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(secs).padStart(2, "0") +
    ",000"
  );
}
