import { NextResponse } from 'next/server';

export const maxDuration = 30;

/**
 * Wraps raw 16-bit mono PCM (24kHz from Gemini TTS) in a standard 44-byte WAV header
 * so every mobile & desktop browser plays it natively via Blob URL / HTMLAudioElement.
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20);  // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }

    const { text } = await request.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    // Clean text for smooth natural Hebrew narration
    const cleanText = text
      .replace(/[*_`#]/g, '')
      .replace(/₪/g, ' שקלים ')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 700);

    if (!cleanText) {
      return NextResponse.json({ error: 'Empty text' }, { status: 400 });
    }

    const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
    const res = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `הקרא בעברית טבעית, ברורה, נעימה ואנושית:\n${cleanText}` }]
          }
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore'
              }
            }
          }
        }
      })
    });

    if (!res.ok) {
      const errTxt = await res.text();
      console.warn('Gemini TTS error:', res.status, errTxt.slice(0, 200));
      return NextResponse.json({ error: 'TTS unavailable' }, { status: 502 });
    }

    const data = await res.json();
    const inlineAudio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineAudio?.data) {
      return NextResponse.json({ error: 'No audio returned' }, { status: 502 });
    }

    const rawBytes = Buffer.from(inlineAudio.data, 'base64');
    const mime: string = inlineAudio.mimeType || '';
    const isPcm = mime.includes('pcm') || mime.includes('L16') || !mime.includes('wav');
    const outputBuffer = isPcm ? pcmToWav(rawBytes, 24000, 1, 16) : rawBytes;

    return new NextResponse(new Uint8Array(outputBuffer), {
      status: 200,
      headers: {
        'Content-Type': isPcm ? 'audio/wav' : mime,
        'Cache-Control': 'no-store'
      }
    });
  } catch (err: any) {
    console.error('Assistant TTS route error:', err);
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
  }
}
