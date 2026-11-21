import { NextResponse } from 'next/server';
import { normalizeTextForHebrewTTS } from '@/components/common/AssistantEngine/assistantTtsUtils';

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
  const tStart = Date.now();
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 });
    }

    const { text } = await request.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }

    const cleanText = normalizeTextForHebrewTTS(text);
    if (!cleanText) {
      return NextResponse.json({ error: 'Empty text' }, { status: 400 });
    }

    // Locked single ultra-fast model + streaming SSE endpoint (~500ms TTFB, ~1.1s total)
    // + temperature: 0 & seed: 42 & languageCode: 'he-IL' for 100% deterministic Israeli Hebrew voice
    const model = 'gemini-3.8-flash-lite-tts';
    const ttsUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const res = await fetch(ttsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: cleanText }]
          }
        ],
        generationConfig: {
          temperature: 0,
          seed: 42,
          responseModalities: ['AUDIO'],
          speechConfig: {
            languageCode: 'he-IL',
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore'
              }
            }
          }
        }
      })
    });

    if (!res.ok || !res.body) {
      const errTxt = await res.text().catch(() => '');
      console.warn(`Gemini TTS (${model}) error:`, res.status, errTxt.slice(0, 180));
      return NextResponse.json({ error: 'TTS stream failed' }, { status: 502 });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    const pcmChunks: Buffer[] = [];
    let tFirstChunk = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const inline = parsed?.candidates?.[0]?.content?.parts?.[0]?.inlineData;
          if (inline?.data) {
            if (!tFirstChunk) tFirstChunk = Date.now() - tStart;
            pcmChunks.push(Buffer.from(inline.data, 'base64'));
          }
        } catch {
          // Ignore malformed SSE keepalive line
        }
      }
    }

    if (pcmChunks.length === 0) {
      return NextResponse.json({ error: 'No audio frames returned' }, { status: 502 });
    }

    const rawPcm = Buffer.concat(pcmChunks);
    const wavBuffer = pcmToWav(rawPcm, 24000, 1, 16);
    const tTotal = Date.now() - tStart;

    return new NextResponse(new Uint8Array(wavBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
        'X-TTS-Model': model,
        'X-TTS-First-Chunk-Ms': String(tFirstChunk),
        'X-TTS-Total-Ms': String(tTotal)
      }
    });
  } catch (err: any) {
    console.error('Assistant TTS route error:', err);
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
  }
}
