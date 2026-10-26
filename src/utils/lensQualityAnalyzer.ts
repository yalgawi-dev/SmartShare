export interface LensQualityMetrics {
  luminance: number;
  isLowLight: boolean;
  sharpness: number;
  isMotionDetected: boolean;
  isSmudgedOrBlurry: boolean;
}

export class LensQualityAnalyzer {
  private sampleCanvas: HTMLCanvasElement | null = null;
  private sampleCtx: CanvasRenderingContext2D | null = null;
  private prevFrameData: Uint8Array | null = null;
  private lowSharpnessCount = 0;

  constructor(private sampleWidth = 160, private sampleHeight = 120) {
    if (typeof document !== 'undefined') {
      this.sampleCanvas = document.createElement('canvas');
      this.sampleCanvas.width = this.sampleWidth;
      this.sampleCanvas.height = this.sampleHeight;
      this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    }
  }

  public analyzeFrame(video: HTMLVideoElement): LensQualityMetrics {
    if (!this.sampleCtx || !this.sampleCanvas || video.videoWidth === 0) {
      return {
        luminance: 128,
        isLowLight: false,
        sharpness: 100,
        isMotionDetected: false,
        isSmudgedOrBlurry: false
      };
    }

    this.sampleCtx.drawImage(video, 0, 0, this.sampleWidth, this.sampleHeight);
    const imgData = this.sampleCtx.getImageData(0, 0, this.sampleWidth, this.sampleHeight);
    const data = imgData.data;
    const len = data.length;

    let totalLuminance = 0;
    let pixelCount = 0;

    const gray = new Uint8Array(this.sampleWidth * this.sampleHeight);
    for (let i = 0; i < len; i += 4) {
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      totalLuminance += lum;
      gray[pixelCount++] = lum;
    }

    const avgLuminance = Math.round(totalLuminance / pixelCount);
    const isLowLight = avgLuminance < 45;

    let motionDiff = 0;
    if (this.prevFrameData && this.prevFrameData.length === gray.length) {
      for (let i = 0; i < gray.length; i += 4) {
        motionDiff += Math.abs(gray[i] - this.prevFrameData[i]);
      }
    }
    this.prevFrameData = gray;

    const avgMotionPerPixel = motionDiff / (pixelCount / 4);
    const isMotionDetected = avgMotionPerPixel > 12;

    let gradSum = 0;
    let gradCount = 0;
    const startX = Math.floor(this.sampleWidth * 0.15);
    const endX = Math.floor(this.sampleWidth * 0.85);
    const startY = Math.floor(this.sampleHeight * 0.15);
    const endY = Math.floor(this.sampleHeight * 0.85);

    for (let y = startY; y < endY; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const idx = y * this.sampleWidth + x;
        const diffX = Math.abs(gray[idx] - gray[idx + 1]);
        const diffY = Math.abs(gray[idx] - (gray[idx + this.sampleWidth] || gray[idx]));
        gradSum += (diffX + diffY);
        gradCount++;
      }
    }

    const sharpness = gradCount > 0 ? Math.round((gradSum / gradCount) * 10) / 10 : 50;

    if (!isLowLight && !isMotionDetected && sharpness < 14) {
      this.lowSharpnessCount++;
    } else {
      this.lowSharpnessCount = Math.max(0, this.lowSharpnessCount - 1);
    }

    const isSmudgedOrBlurry = this.lowSharpnessCount >= 3;

    return {
      luminance: avgLuminance,
      isLowLight,
      sharpness,
      isMotionDetected,
      isSmudgedOrBlurry
    };
  }

  public reset() {
    this.prevFrameData = null;
    this.lowSharpnessCount = 0;
  }
}