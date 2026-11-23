import { NextResponse } from 'next/server';
import { normalizeTextForHebrewTTS } from '@/components/common/AssistantEngine/assistantTtsUtils';
import { getPersonaById } from '@/components/common/AssistantEngine/assistantPersonas';

export const maxDuration = 30;

/**
 * Wraps raw 24kHz 16-bit mono PCM bytes from Gemini Neural TTS into a standard RIFF WAV buffer
 * so every browser (iOS Safari, Android Chrome, Desktop) plays it natively via HTMLAudioElement.
 */
function pcm24kMonoToWav(pcmBuffer: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function splitHebrewIntoTtsChunks(text: string, maxLen = 175): string[] {
  const sentences = text.split(/(?<=[.!?\n])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;

    if ((current ? `${current} ${trimmed}` : trimmed).length <= maxLen) {
      current = current ? `${current} ${trimmed}` : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length <= maxLen) {
        current = trimmed;
      } else {
        const words = trimmed.split(/\s+/);
        current = '';
        for (const w of words) {
          if ((current ? `${current} ${w}` : w).length <= maxLen) {
            current = current ? `${current} ${w}` : w;
          } else {
            if (current) chunks.push(current);
            current = w;
          }
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function POST(request: Request) {
  const tStart = Date.now();
  try {
    const { text, voiceId } = await request.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const cleanText = normalizeTextForHebrewTTS(text);
    if (!cleanText) {
      return NextResponse.json({ error: 'Empty text' }, { status: 400 });
    }

    const persona = getPersonaById(voiceId);
    const geminiApiKey = process.env.GEMINI_API_KEY;

    // ENGINE #1: Gemini 2.5 Flash Neural TTS — 4 Distinct Voices (Dana/Shimrit/Avi/Asaf)
    if (geminiApiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `קרא בקול ישראלי טבעי, חם וברור בעברית בלבד (ללא תוספות):\n${cleanText}`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: persona.geminiVoiceName,
                    },
                  },
                },
              },
            }),
          }
        );

        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const inlineAudio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (inlineAudio?.data) {
            const rawBytes = Buffer.from(inlineAudio.data, 'base64');
            const mime: string = String(inlineAudio.mimeType || 'audio/L16;rate=24000');
            const isWavOrMp3 = mime.includes('wav') || mime.includes('mpeg') || mime.includes('mp3');
            const outputBuf = isWavOrMp3 ? rawBytes : pcm24kMonoToWav(rawBytes, 24000);
            const contentType = isWavOrMp3 ? mime : 'audio/wav';

            return new NextResponse(new Uint8Array(outputBuf), {
              status: 200,
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'no-store',
                'X-TTS-Engine': `gemini-tts-${persona.id}-${persona.geminiVoiceName}`,
                'X-TTS-Total-Ms': String(Date.now() - tStart),
              },
            });
          }
        } else {
          const errText = await geminiRes.text();
          console.warn(`Gemini TTS (${persona.geminiVoiceName}) fallback triggered:`, geminiRes.status, errText.slice(0, 160));
        }
      } catch (gemErr) {
        console.warn('Gemini TTS error, falling back to Google he-IL:', gemErr);
      }
    }

    // FALLBACK ENGINE: Google he-IL MP3 (guarantees 0% silent failure if Gemini TTS is busy)
    try {
      const chunks = splitHebrewIntoTtsChunks(cleanText, 175);
      if (chunks.length > 0) {
        const mp3Buffers = await Promise.all(
          chunks.map(async (chunk) => {
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=iw&client=tw-ob&q=${encodeURIComponent(chunk)}`;
            const res = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });
            if (!res.ok) throw new Error(`Google he-IL TTS status ${res.status}`);
            const arr = await res.arrayBuffer();
            return Buffer.from(arr);
          })
        );

        const combinedMp3 = Buffer.concat(mp3Buffers);
        if (combinedMp3.length > 200) {
          return new NextResponse(new Uint8Array(combinedMp3), {
            status: 200,
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'no-store',
              'X-TTS-Engine': 'google-he-il-fallback',
              'X-TTS-Total-Ms': String(Date.now() - tStart),
            },
          });
        }
      }
    } catch (fallbackErr) {
      console.warn('Fallback he-IL TTS error:', fallbackErr);
    }

    return NextResponse.json({ error: 'TTS unavailable' }, { status: 502 });
  } catch (err: any) {
    console.error('Assistant TTS route error:', err);
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
  }
}
