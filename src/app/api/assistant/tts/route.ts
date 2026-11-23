import { NextResponse } from 'next/server';
import { cert } from 'firebase-admin/app';
import { normalizeTextForHebrewTTS } from '@/components/common/AssistantEngine/assistantTtsUtils';
import { getPersonaById } from '@/components/common/AssistantEngine/assistantPersonas';

export const maxDuration = 30;

// In-memory cache for GCP OAuth token & API-disabled cooldown (0ms overhead when disabled!)
let cachedGcpToken: { token: string; expiresAt: number } | null = null;
let gcpTtsCooldownUntil = 0;

async function getGcpAccessToken(): Promise<string | null> {
  if (cachedGcpToken && Date.now() < cachedGcpToken.expiresAt - 60_000) {
    return cachedGcpToken.token;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) return null;

  try {
    const credential = cert({ projectId, clientEmail, privateKey });
    const tok = await credential.getAccessToken();
    if (tok?.access_token) {
      cachedGcpToken = {
        token: tok.access_token,
        expiresAt: Date.now() + (tok.expires_in ? tok.expires_in * 1000 : 3000_000),
      };
      return tok.access_token;
    }
  } catch (err) {
    console.warn('GCP TTS token error:', err);
  }
  return null;
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

    // TIER 1 (~280-420ms!): Official Google Cloud Text-to-Speech (4 Native Israeli WaveNet Voices A/B/C/D)
    // Automatically activates with ZERO code/env changes as soon as Cloud TTS API is enabled on GCP project!
    if (Date.now() > gcpTtsCooldownUntil) {
      try {
        const accessToken = await getGcpAccessToken();
        if (accessToken) {
          const gcpRes = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              input: { text: cleanText },
              voice: {
                languageCode: 'he-IL',
                name: persona.gcpVoiceName,
              },
              audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: 1.05,
              },
            }),
          });

          if (gcpRes.ok) {
            const data = await gcpRes.json();
            if (data?.audioContent) {
              const mp3Buf = Buffer.from(data.audioContent, 'base64');
              return new NextResponse(new Uint8Array(mp3Buf), {
                status: 200,
                headers: {
                  'Content-Type': 'audio/mpeg',
                  'Cache-Control': 'no-store',
                  'X-TTS-Engine': `gcp-wavenet-${persona.id}-${persona.gcpVoiceName}`,
                  'X-TTS-Total-Ms': String(Date.now() - tStart),
                },
              });
            }
          } else if (gcpRes.status === 403) {
            // API not enabled yet on GCP project -> skip for 60s so Tier 2 runs in ~400ms with 0ms delay!
            gcpTtsCooldownUntil = Date.now() + 60_000;
          }
        }
      } catch (gcpErr) {
        console.warn('GCP Cloud TTS warning:', gcpErr);
      }
    }

    // TIER 2 (~400-500ms!): Ultra-Fast Parallel Israeli Hebrew MP3 (NEVER blocks for 6 seconds!)
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
              'X-TTS-Engine': 'google-he-il-fast',
              'X-TTS-Total-Ms': String(Date.now() - tStart),
            },
          });
        }
      }
    } catch (fastErr) {
      console.warn('Fast he-IL TTS warning:', fastErr);
    }

    return NextResponse.json({ error: 'TTS unavailable' }, { status: 502 });
  } catch (err: any) {
    console.error('Assistant TTS route error:', err);
    return NextResponse.json({ error: 'TTS failed' }, { status: 500 });
  }
}
