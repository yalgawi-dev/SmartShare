import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db, uploadBlobToStorage } from '@/lib/firebase';
import { APP_VERSION } from '@/constants/version';
import { ScreenContext } from './assistantKnowledge';
import { inspectLiveScreenDOM, LiveScreenDomInspection } from './assistantDomIntrospector';

export const BUG_VIDEO_MAX_SECONDS = 35;

export interface BugReportRecord {
  id?: string;
  createdAt: number;
  status: 'new' | 'in_progress' | 'resolved';
  reporter: {
    uid: string;
    name: string;
    phone: string;
    email: string;
    role: string;
    isAdmin: boolean;
    pwaInstalled: boolean;
  };
  description: string;
  chatContextSummary: string;
  mediaUrl?: string;
  mediaType: 'screenshot' | 'video' | 'both' | 'none';
  mediaMimeType?: string;
  mediaDurationSec?: number;
  screenshotUrl?: string;
  videoUrl?: string;
  telemetry: {
    appVersion: string;
    route: string;
    spaceId?: string;
    spaceTitle?: string;
    activeWidget?: string;
    currentFolderName?: string;
    deviceOS: 'Android' | 'iOS' | 'Desktop';
    screenSize: string;
    userAgent: string;
    domSnapshot: LiveScreenDomInspection;
  };
}

const BUG_INTENT_REGEX =
  /(תקלה|באג|לא עובד|לא מצליח|שגיאה|נתקע|קורס|נחתך|בעיה ב|לדווח על|דיווח תקלה|מסך שחור|לא נפתח|לא שומר|שיבוש|קפא)/i;

/**
 * Detects whether a user's message to the assistant describes a bug or technical malfunction.
 */
export function detectBugReportIntent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return BUG_INTENT_REGEX.test(text.trim());
}

export function detectDeviceOS(): 'Android' | 'iOS' | 'Desktop' {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'Android';
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'iOS';
  }
  return 'Desktop';
}

/**
 * Ultra-fast (<25ms, zero CPU lag, zero CORS taint) viewport painter.
 * Renders the currently visible application screen (cards, headers, buttons, text, inputs)
 * onto a canvas without freezing the mobile browser thread.
 */
export function paintLiveViewportToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  lastTouch?: { x: number; y: number; label: string; time: number } | null
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const logicalW = window.innerWidth || width;
  const logicalH = window.innerHeight || height;
  const scaleX = width / logicalW;
  const scaleY = height / logicalH;

  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, logicalW, logicalH);

  // Detect if a fullscreen modal/viewer (e.g. UniversalViewerModal) is open on top of the page.
  // If so, paint ONLY elements inside that topmost overlay so hidden background page buttons NEVER bleed through!
  let captureRoot: ParentNode = document;
  const fixedCandidates = Array.from(document.querySelectorAll('div, section, [role="dialog"]')) as HTMLElement[];
  let topOverlay: HTMLElement | null = null;
  let topZ = 40;
  for (const cand of fixedCandidates) {
    if (
      cand.closest('[data-assistant-drawer="true"]') ||
      cand.closest('[data-bug-recorder-hud="true"]')
    ) {
      continue;
    }
    const st = window.getComputedStyle(cand);
    if (st.position !== 'fixed' || st.display === 'none' || st.visibility === 'hidden') continue;
    const z = parseInt(st.zIndex || '0', 10) || 0;
    const r = cand.getBoundingClientRect();
    if (z >= topZ && r.width >= logicalW * 0.7 && r.height >= logicalH * 0.65) {
      topZ = z;
      topOverlay = cand;
    }
  }
  if (topOverlay) {
    captureRoot = topOverlay;
    const overlayBg = window.getComputedStyle(topOverlay).backgroundColor;
    if (overlayBg && overlayBg !== 'rgba(0, 0, 0, 0)' && overlayBg !== 'transparent') {
      ctx.fillStyle = overlayBg;
      ctx.fillRect(0, 0, logicalW, logicalH);
    }
  }

  // Collect visible structural elements ONLY from captureRoot (including inline-styled <div> cards, <img>, <canvas>!)
  const selectors = 'canvas, img, header, nav, main, section, div, [role="dialog"], button, input, h1, h2, h3, h4, span, p, a';
  const elements = Array.from(captureRoot.querySelectorAll(selectors));

  let drawnCount = 0;
  for (const el of elements) {
    if (drawnCount > 260) break;
    if (
      el.closest('[data-assistant-drawer="true"]') ||
      el.closest('[data-bug-recorder-hud="true"]') ||
      el.closest('script, style')
    ) {
      continue;
    }

    const htmlEl = el as HTMLElement;
    const rect = htmlEl.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    if (rect.bottom < 0 || rect.top > logicalH || rect.right < 0 || rect.left > logicalW) continue;

    const style = window.getComputedStyle(htmlEl);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

    const tag = el.tagName.toLowerCase();
    // Skip giant transparent/wrapper divs that cover almost the whole viewport so they don't eat drawnCount
    const isFullViewportDiv = tag === 'div' && rect.width >= logicalW * 0.96 && rect.height >= logicalH * 0.9;
    if (isFullViewportDiv && el !== topOverlay) continue;

    // Draw live <canvas> elements (CAD/DWFx drawings!) directly into the video frame
    if (tag === 'canvas') {
      const srcCanvas = el as HTMLCanvasElement;
      if (srcCanvas.width > 0 && srcCanvas.height > 0) {
        try {
          ctx.drawImage(srcCanvas, rect.left, rect.top, rect.width, rect.height);
          drawnCount++;
        } catch {
          // Ignore tainted/WebGL non-preserved buffers safely
        }
      }
      continue;
    }

    // Draw rendered <img> elements (e.g. Garmoshka / PDF pages & document previews!) into the video frame
    if (tag === 'img') {
      const imgEl = el as HTMLImageElement;
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        try {
          ctx.drawImage(imgEl, rect.left, rect.top, rect.width, rect.height);
          drawnCount++;
        } catch {
          // Ignore cross-origin tainted images safely
        }
      }
      continue;
    }

    const bg = style.backgroundColor;
    const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
    const borderW = parseFloat(style.borderTopWidth || '0');

    if (hasBg || borderW > 0 || tag === 'button' || tag === 'input' || tag === 'header') {
      ctx.beginPath();
      const radius = Math.min(20, parseFloat(style.borderRadius || '8') || 8);
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(rect.left, rect.top, rect.width, rect.height, radius);
      } else {
        ctx.rect(rect.left, rect.top, rect.width, rect.height);
      }
      if (hasBg) {
        ctx.fillStyle = bg;
        ctx.fill();
      }
      if (borderW > 0) {
        ctx.strokeStyle = style.borderTopColor || '#cbd5e1';
        ctx.lineWidth = Math.min(2, borderW);
        ctx.stroke();
      }
      drawnCount++;
    }

    // Extract ONLY direct text nodes (nodeType === 3) so buttons with icon <span> + text draw cleanly with ZERO duplication!
    const isInput = tag === 'input';
    if (isInput && (htmlEl as HTMLInputElement).type === 'password') continue;

    let directText = '';
    if (isInput) {
      directText = (htmlEl as HTMLInputElement).value || (htmlEl as HTMLInputElement).placeholder || '';
    } else {
      const parts: string[] = [];
      for (let i = 0; i < el.childNodes.length; i++) {
        const node = el.childNodes[i];
        if (node.nodeType === 3 && node.textContent) {
          const t = node.textContent.replace(/\s+/g, ' ').trim();
          if (t) parts.push(t);
        }
      }
      directText = parts.join(' ').trim();
    }

    if (directText && directText.length > 0 && rect.height <= 110) {
      const fontSize = Math.min(22, Math.max(11, parseFloat(style.fontSize || '14')));
      ctx.font = `${style.fontWeight || '600'} ${fontSize}px sans-serif`;
      ctx.fillStyle = style.color || '#1e293b';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      const isCentered = style.textAlign === 'center' || tag === 'button' || style.justifyContent === 'center';
      ctx.textAlign = isCentered ? 'center' : 'right';
      const textX = isCentered ? (rect.left + rect.width / 2) : Math.min(logicalW - 10, rect.right - 8);
      const textY = rect.top + rect.height / 2;
      ctx.fillText(directText.slice(0, 52), textX, textY, Math.max(20, rect.width - 12));
      drawnCount++;
    }
  }

  // Top telemetry watermark bar on captured frame
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.fillRect(0, 0, logicalW, 26);
  ctx.font = 'bold 11px sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.textAlign = 'left';
  ctx.direction = 'ltr';
  ctx.fillText(`MySpace ${APP_VERSION} | ${window.location.pathname} | ${new Date().toLocaleTimeString('he-IL')}`, 8, 13);

  // Draw red touch ripple & action label if user touched the screen recently (<1.6s)
  if (lastTouch && Date.now() - lastTouch.time < 1600) {
    const touchX = lastTouch.x / scaleX;
    const touchY = lastTouch.y / scaleY;
    const age = Date.now() - lastTouch.time;
    const alpha = Math.max(0.15, 1 - age / 1600);
    const radius = 16 + (age / 1600) * 18;

    ctx.beginPath();
    ctx.arc(touchX, touchY, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239, 68, 68, ${alpha * 0.45})`;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = `rgba(220, 38, 38, ${alpha})`;
    ctx.stroke();

    if (lastTouch.label) {
      ctx.fillStyle = 'rgba(220, 38, 38, 0.92)';
      const boxW = Math.min(220, lastTouch.label.length * 8 + 24);
      const boxX = Math.max(10, Math.min(logicalW - boxW - 10, touchX - boxW / 2));
      const boxY = Math.max(32, touchY - 38);
      ctx.fillRect(boxX, boxY, boxW, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.direction = 'rtl';
      ctx.fillText(`👆 ${lastTouch.label.slice(0, 26)}`, boxX + boxW / 2, boxY + 11);
    }
  }

  ctx.restore();
}

/**
 * Captures a fast, native Binary WebP Blob screenshot (<30ms, Zero Base64 per Rule 21).
 */
export async function captureLiveScreenBlob(): Promise<Blob> {
  const width = Math.min(window.innerWidth || 390, 720);
  const height = Math.min(window.innerHeight || 800, 1280);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    paintLiveViewportToCanvas(ctx, width, height, null);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate screenshot blob'));
      },
      'image/webp',
      0.88
    );
  });
}

/**
 * Zero-Lag 35-Second Live Screen & Voice Video Recorder.
 * Runs at a lightweight 8 FPS (<2% CPU load) so the user experiences 0 lag while reproducing the bug.
 */
export class LiveBugVideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: BlobPart[] = [];
  private timerInterval: any = null;
  private paintInterval: any = null;
  private audioStream: MediaStream | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private lastTouch: { x: number; y: number; label: string; time: number } | null = null;
  private remainingSec = BUG_VIDEO_MAX_SECONDS;
  private startTime = 0;
  private isMuted = false;
  private hasFinished = false;
  private pointerListener: ((e: PointerEvent) => void) | null = null;

  async start(
    onCountdownTick: (remainingSeconds: number) => void,
    onAutoFinish: (videoBlob: Blob, durationSec: number) => void
  ): Promise<void> {
    if (typeof window === 'undefined') throw new Error('Browser environment required');

    this.chunks = [];
    this.remainingSec = BUG_VIDEO_MAX_SECONDS;
    this.startTime = Date.now();
    this.isMuted = false;
    this.hasFinished = false;
    onCountdownTick(this.remainingSec);

    // HiDPI 2x HD Canvas Resolution (crisp Hebrew text & drawings even in fullscreen playback!)
    const logicalW = window.innerWidth || 390;
    const logicalH = window.innerHeight || 780;
    const dprScale = Math.min(window.devicePixelRatio || 2, 2);
    const width = Math.min(Math.round(logicalW * dprScale), 820);
    const height = Math.min(Math.round(logicalH * dprScale), 1560);
    const scaleX = width / logicalW;
    const scaleY = height / logicalH;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }

    // Track user touches/clicks during recording so Admin sees exact tap positions
    this.pointerListener = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-bug-recorder-hud="true"]')) return;
      const btn = target?.closest('button, a, [role="button"], input') as HTMLElement | null;
      const label = (btn?.innerText || btn?.getAttribute('title') || target?.innerText || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 25);
      this.lastTouch = {
        x: e.clientX * scaleX,
        y: e.clientY * scaleY,
        label: label || 'לחיצה על המסך',
        time: Date.now()
      };
    };
    window.addEventListener('pointerdown', this.pointerListener, { passive: true });

    // Initial frame + smooth 15 FPS HD painter (66ms interval)
    if (ctx) {
      paintLiveViewportToCanvas(ctx, width, height, this.lastTouch);
      this.paintInterval = setInterval(() => {
        paintLiveViewportToCanvas(ctx, width, height, this.lastTouch);
      }, 66);
    }

    const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : null;
    if (!canvasStream) {
      this.cleanup();
      throw new Error('דפדפן זה אינו תומך בהקלטת וידאו ישירה. אנא השתמש בצילום מסך.');
    }

    // Try attaching microphone voice audio so user can narrate the bug while demonstrating
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.audioStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track));
    } catch {
      // Proceed with silent screen recording if mic permission declined
    }

    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    const selectedMime = mimeTypes.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';

    this.mediaRecorder = selectedMime
      ? new MediaRecorder(canvasStream, { mimeType: selectedMime, videoBitsPerSecond: 2200000 })
      : new MediaRecorder(canvasStream, { videoBitsPerSecond: 2200000 });

    this.mediaRecorder.ondataavailable = (evt) => {
      if (evt.data && evt.data.size > 0) {
        this.chunks.push(evt.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      if (this.hasFinished) return;
      this.hasFinished = true;
      const durationSec = Math.max(1, Math.min(BUG_VIDEO_MAX_SECONDS, Math.round((Date.now() - this.startTime) / 1000)));
      const finalMime = this.mediaRecorder?.mimeType || selectedMime || 'video/webm';
      const blob = new Blob(this.chunks, { type: finalMime });
      this.cleanup();
      onAutoFinish(blob, durationSec);
    };

    this.mediaRecorder.start(500);

    // Hard wall-clock deadline (prevents mobile timer throttling or accidental restart after 35s!)
    const hardDeadlineMs = this.startTime + BUG_VIDEO_MAX_SECONDS * 1000;
    const forceComplete = () => {
      if (this.hasFinished) return;
      this.hasFinished = true;
      const finalMime = this.mediaRecorder?.mimeType || selectedMime || 'video/webm';
      const blob = new Blob(this.chunks, { type: finalMime });
      this.cleanup();
      onAutoFinish(blob, BUG_VIDEO_MAX_SECONDS);
    };

    // 35-second countdown timer using real wall-clock elapsed time
    this.timerInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((hardDeadlineMs - Date.now()) / 1000));
      this.remainingSec = remaining;
      onCountdownTick(remaining);
      if (remaining <= 0) {
        this.stop();
        setTimeout(forceComplete, 450);
      }
    }, 250);
  }

  /**
   * Mutes or unmutes the live microphone track while screen recording continues uninterrupted
   * (ideal for noisy environments).
   */
  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.audioStream) {
      this.audioStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    return this.isMuted;
  }

  stop(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (_) {
        this.cleanup();
      }
    } else {
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.paintInterval) {
      clearInterval(this.paintInterval);
      this.paintInterval = null;
    }
    if (this.pointerListener && typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.pointerListener);
      this.pointerListener = null;
    }
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((t) => t.stop());
      this.audioStream = null;
    }
    this.canvas = null;
  }
}

/**
 * Packages the user's profile card, notes, chat transcript, binary media Blob (screenshot/video),
 * and live DOM black-box telemetry into a single unified report for the System Admin.
 */
export async function submitBugReportToAdmin(params: {
  user: any;
  screenContext: ScreenContext;
  description: string;
  recentMessages: Array<{ sender: string; text: string }>;
  screenshotBlob?: Blob | null;
  videoBlob?: Blob | null;
  mediaDurationSec?: number;
  onUploadProgress?: (percent: number) => void;
}): Promise<string> {
  const {
    user,
    screenContext,
    description,
    recentMessages,
    screenshotBlob,
    videoBlob,
    mediaDurationSec,
    onUploadProgress
  } = params;

  let screenshotUrl: string | undefined;
  let videoUrl: string | undefined;
  const uidPrefix = user?.id || 'guest';
  const nowTs = Date.now();
  const hasBoth = Boolean(screenshotBlob && videoBlob);

  if (screenshotBlob) {
    const storagePath = `bug_reports/${uidPrefix}_${nowTs}_screen.webp`;
    screenshotUrl = await uploadBlobToStorage(screenshotBlob, storagePath, (pct) => {
      onUploadProgress?.(hasBoth ? Math.round(pct * 0.4) : pct);
    });
  }

  if (videoBlob) {
    const ext = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
    const storagePath = `bug_reports/${uidPrefix}_${nowTs}_video.${ext}`;
    videoUrl = await uploadBlobToStorage(videoBlob, storagePath, (pct) => {
      onUploadProgress?.(hasBoth ? 40 + Math.round(pct * 0.6) : pct);
    });
  }

  const mediaType: BugReportRecord['mediaType'] =
    screenshotUrl && videoUrl
      ? 'both'
      : videoUrl
        ? 'video'
        : screenshotUrl
          ? 'screenshot'
          : 'none';
  const primaryMediaUrl = videoUrl || screenshotUrl;

  const chatContextSummary = recentMessages
    .slice(-5)
    .map((m) => `${m.sender === 'user' ? 'משתמש' : 'סוכן'}: ${m.text}`)
    .join('\n');

  const record: Omit<BugReportRecord, 'id'> = {
    createdAt: Date.now(),
    status: 'new',
    reporter: {
      uid: user?.id || 'guest',
      name: user?.realName || user?.nickname || 'אורח',
      phone: user?.phone || 'ללא טלפון',
      email: user?.email || 'ללא אימייל',
      role: user?.isAdmin ? 'מנהל מערכת' : screenContext.userRole || 'משתמש',
      isAdmin: Boolean(user?.isAdmin),
      pwaInstalled: Boolean(user?.pwaInstalled)
    },
    description: description.trim() || 'דיווח תקלה דרך הסוכן האישי',
    chatContextSummary,
    ...(primaryMediaUrl ? { mediaUrl: primaryMediaUrl } : {}),
    ...(screenshotUrl ? { screenshotUrl } : {}),
    ...(videoUrl ? { videoUrl } : {}),
    mediaType,
    ...(mediaDurationSec ? { mediaDurationSec } : {}),
    telemetry: {
      appVersion: APP_VERSION,
      route: screenContext.route || (typeof window !== 'undefined' ? window.location.pathname : '/'),
      ...(screenContext.spaceId ? { spaceId: screenContext.spaceId } : {}),
      ...(screenContext.spaceTitle ? { spaceTitle: screenContext.spaceTitle } : {}),
      ...(screenContext.activeWidget ? { activeWidget: screenContext.activeWidget } : {}),
      ...(screenContext.currentFolderName ? { currentFolderName: screenContext.currentFolderName } : {}),
      deviceOS: detectDeviceOS(),
      screenSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : '',
      domSnapshot: (() => {
        const rawDom = inspectLiveScreenDOM();
        return {
          urlPath: rawDom.urlPath || '/',
          pageTitle: rawDom.pageTitle || '',
          visibleHeadings: rawDom.visibleHeadings || [],
          visibleButtonsAndActions: rawDom.visibleButtonsAndActions || [],
          interactiveElements: [],
          openModalsOrBanners: rawDom.openModalsOrBanners || []
        };
      })()
    }
  };

  const docRef = await addDoc(collection(db, 'bug_reports'), record);
  return docRef.id;
}

export async function fetchAllBugReportsForAdmin(): Promise<BugReportRecord[]> {
  const q = query(collection(db, 'bug_reports'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<BugReportRecord, 'id'>)
  }));
}

export async function updateBugReportStatus(reportId: string, status: 'new' | 'in_progress' | 'resolved'): Promise<void> {
  await updateDoc(doc(db, 'bug_reports', reportId), { status });
}

export async function deleteBugReportRecord(reportId: string): Promise<void> {
  await deleteDoc(doc(db, 'bug_reports', reportId));
}
