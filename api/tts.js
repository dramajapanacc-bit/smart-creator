export default async function handler(req, res) {

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Method not allowed"
        });
    }

    try {

        const {
            text,
            voice,
            emotion,
            speed,
            pitch
        } = req.body || {};

        if (!text || !String(text).trim()) {

            return res.status(400).json({
                error: "မြန်မာစာ ထည့်ပေးပါ။"
            });
        }

        const apiKey =
            process.env.GEMINI_API_KEY;

        if (!apiKey) {

            return res.status(500).json({
                error:
                    "GEMINI_API_KEY မတွေ့ပါ။"
            });
        }

        const allowedVoices = [
            "Zephyr",
            "Puck",
            "Charon",
            "Kore",
            "Leda"
        ];

        const selectedVoice =
            allowedVoices.includes(voice)
                ? voice
                : "Zephyr";

        const emotionMap = {

            natural:
                "natural, clear and neutral",

            happy:
                "happy, warm and cheerful",

            sad:
                "sad, gentle and emotional",

            angry:
                "angry and firm",

            excited:
                "excited, energetic and lively",

            serious:
                "serious, calm and authoritative",

            calm:
                "calm, smooth and relaxed",

            whisper:
                "soft and quiet, like a whisper",

            dramatic:
                "dramatic and expressive"
        };

        const selectedEmotion =
            emotionMap[emotion] ||
            emotionMap.natural;

        let speedInstruction =
            "normal speaking speed";

        const speedNumber =
            Number(speed) || 0;

        if (speedNumber <= -3) {

            speedInstruction =
                "speak very slowly";

        } else if (speedNumber === -2) {

            speedInstruction =
                "speak slowly";

        } else if (speedNumber === -1) {

            speedInstruction =
                "speak slightly slower than normal";

        } else if (speedNumber === 1) {

            speedInstruction =
                "speak slightly faster than normal";

        } else if (speedNumber === 2) {

            speedInstruction =
                "speak faster than normal";

        } else if (speedNumber >= 3) {

            speedInstruction =
                "speak very quickly";
        }

        let pitchInstruction =
            "use a natural pitch";

        const pitchNumber =
            Number(pitch) || 0;

        if (pitchNumber <= -3) {

            pitchInstruction =
                "use a noticeably lower pitch";

        } else if (pitchNumber === -2) {

            pitchInstruction =
                "use a lower pitch";

        } else if (pitchNumber === -1) {

            pitchInstruction =
                "use a slightly lower pitch";

        } else if (pitchNumber === 1) {

            pitchInstruction =
                "use a slightly higher pitch";

        } else if (pitchNumber === 2) {

            pitchInstruction =
                "use a higher pitch";

        } else if (pitchNumber >= 3) {

            pitchInstruction =
                "use a noticeably higher pitch";
        }

        const cleanText =
            String(text)
            .trim()
            .slice(0, 5000);

        const prompt =
`Generate speech audio.

Language: Burmese Myanmar.

Voice: ${selectedVoice}.

Style:
${selectedEmotion}.

Pacing:
${speedInstruction}.

Pitch:
${pitchInstruction}.

Speak ONLY the Burmese text below.
Do not translate it.
Do not explain it.
Do not read these instructions aloud.

TEXT TO SPEAK:
${cleanText}`;

        const model =
            "gemini-2.5-flash-preview-tts";

        const url =
            "https://generativelanguage.googleapis.com/v1beta/models/" +
            model +
            ":generateContent";

        const response =
            await fetch(
                url,
                {
                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json",

                        "x-goog-api-key":
                            apiKey
                    },

                    body:JSON.stringify({

                        contents:[
                            {
                                parts:[
                                    {
                                        text:
                                            prompt
                                    }
                                ]
                            }
                        ],

                        generationConfig:{

                            responseModalities:[
                                "AUDIO"
                            ],

                            speechConfig:{

                                voiceConfig:{

                                    prebuiltVoiceConfig:{
                                        voiceName:
                                            selectedVoice
                                    }

                                }

                            }

                        }

                    })
                }
            );

        const data =
            await response.json();

        if(!response.ok){

            console.error(
                "Gemini API Error:",
                JSON.stringify(data)
            );

            const apiMessage =
                data?.error?.message ||
                "Gemini TTS API Error ဖြစ်နေပါသည်။";

            return res.status(
                response.status >= 400 &&
                response.status < 600
                    ? response.status
                    : 500
            ).json({
                error: apiMessage
            });
        }

        const parts =
            data?.candidates?.[0]
                ?.content
                ?.parts || [];

        let audioBase64 = null;

        for(const part of parts){

            if(
                part?.inlineData?.data
            ){

                audioBase64 =
                    part.inlineData.data;

                break;
            }

            if(
                part?.inline_data?.data
            ){

                audioBase64 =
                    part.inline_data.data;

                break;
            }
        }

        if(!audioBase64){

            console.error(
                "Gemini response:",
                JSON.stringify(data)
            );

            return res.status(500).json({
                error:
                    "Gemini မှ Audio မပြန်လာပါ။"
            });
        }

        const pcmBuffer =
            Buffer.from(
                audioBase64,
                "base64"
            );

        if(!pcmBuffer.length){

            return res.status(500).json({
                error:
                    "Audio data အလွတ်ဖြစ်နေပါသည်။"
            });
        }

        /*
         * Gemini TTS:
         * 24000 Hz
         * Mono
         * 16-bit PCM
         */

        const channels = 1;
        const sampleRate = 24000;
        const bitsPerSample = 16;
        const bytesPerSample = 2;

        const byteRate =
            sampleRate *
            channels *
            bytesPerSample;

        const blockAlign =
            channels *
            bytesPerSample;

        const wavHeader =
            Buffer.alloc(44);

        wavHeader.write(
            "RIFF",
            0
        );

        wavHeader.writeUInt32LE(
            36 + pcmBuffer.length,
            4
        );

        wavHeader.write(
            "WAVE",
            8
        );

        wavHeader.write(
            "fmt ",
            12
        );

        wavHeader.writeUInt32LE(
            16,
            16
        );

        wavHeader.writeUInt16LE(
            1,
            20
        );

        wavHeader.writeUInt16LE(
            channels,
            22
        );

        wavHeader.writeUInt32LE(
            sampleRate,
            24
        );

        wavHeader.writeUInt32LE(
            byteRate,
            28
        );

        wavHeader.writeUInt16LE(
            blockAlign,
            32
        );

        wavHeader.writeUInt16LE(
            bitsPerSample,
            34
        );

        wavHeader.write(
            "data",
            36
        );

        wavHeader.writeUInt32LE(
            pcmBuffer.length,
            40
        );

        const wavBuffer =
            Buffer.concat([
                wavHeader,
                pcmBuffer
            ]);

        res.setHeader(
            "Content-Type",
            "audio/wav"
        );

        res.setHeader(
            "Content-Length",
            wavBuffer.length
        );

        res.setHeader(
            "Content-Disposition",
            'inline; filename="YanNaing-Gemini-TTS.wav"'
        );

        res.setHeader(
            "Cache-Control",
            "no-store"
        );

        return res
            .status(200)
            .send(wavBuffer);

    } catch(error) {

        console.error(
            "TTS Server Error:",
            error
        );

        return res.status(500).json({
            error:
                error?.message ||
                "TTS Server Error ဖြစ်နေပါသည်။"
        });
    }
              }
