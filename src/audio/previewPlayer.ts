class BeatmapPreviewPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentBeatmapsetId: number | null = null;
  private isPlaying: boolean = false;
  private listeners: Set<(isPlaying: boolean, beatmapsetId: number | null) => void> = new Set();
  private volume: number = 0.5;
  private fallbackTried: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.crossOrigin = 'anonymous';
      this.audio.volume = this.volume;
      this.audio.onended = () => this.handleEnd();
      this.audio.onerror = () => this.handleError();
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  public subscribe(listener: (isPlaying: boolean, beatmapsetId: number | null) => void): () => void {
    this.listeners.add(listener);
    listener(this.isPlaying, this.currentBeatmapsetId);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.isPlaying, this.currentBeatmapsetId));
  }

  private handleEnd() {
    this.isPlaying = false;
    this.currentBeatmapsetId = null;
    this.fallbackTried = false;
    this.notify();
  }

  private handleError() {
    if (!this.audio || !this.currentBeatmapsetId || this.fallbackTried) {
      this.handleEnd();
      return;
    }

    // Try fallback URL if primary failed
    this.fallbackTried = true;
    const fallbackUrl = `https://catboy.best/preview/audio/${this.currentBeatmapsetId}`;
    console.warn(`Audio preview primary URL failed. Retrying with fallback: ${fallbackUrl}`);
    this.audio.src = fallbackUrl;
    this.audio.play().catch(() => this.handleEnd());
  }

  private sanitizeUrl(url?: string, beatmapsetId?: number): string {
    if (!url || typeof url !== 'string') {
      return `https://b.ppy.sh/preview/${beatmapsetId}.mp3`;
    }

    let clean = url.trim();
    // Fix double-prefixed protocol
    while (clean.startsWith('https:https://') || clean.startsWith('http:http://') || clean.startsWith('https://https://')) {
      clean = clean.replace(/^https?:(https?:\/\/)/, '$1');
    }

    if (clean.startsWith('//')) {
      clean = `https:${clean}`;
    }

    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      return `https://b.ppy.sh/preview/${beatmapsetId}.mp3`;
    }

    return clean;
  }

  public play(beatmapsetId: number, previewUrl?: string) {
    if (!this.audio) return;

    if (this.currentBeatmapsetId === beatmapsetId && this.isPlaying) {
      this.pause();
      return;
    }

    const cleanUrl = this.sanitizeUrl(previewUrl, beatmapsetId);
    this.fallbackTried = false;

    this.audio.pause();
    this.audio.src = cleanUrl;
    this.currentBeatmapsetId = beatmapsetId;
    this.isPlaying = true;
    this.notify();

    this.audio.play().catch((err) => {
      console.warn('Audio preview playback blocked or failed:', err);
      this.handleError();
    });
  }

  public pause() {
    if (this.audio) {
      this.audio.pause();
    }
    this.isPlaying = false;
    this.currentBeatmapsetId = null;
    this.fallbackTried = false;
    this.notify();
  }

  public getStatus() {
    return {
      isPlaying: this.isPlaying,
      currentBeatmapsetId: this.currentBeatmapsetId,
    };
  }
}

export const previewPlayer = new BeatmapPreviewPlayer();
