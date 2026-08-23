class BeatmapPreviewPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentBeatmapsetId: number | null = null;
  private isPlaying: boolean = false;
  private listeners: Set<(isPlaying: boolean, beatmapsetId: number | null) => void> = new Set();
  private volume: number = 0.5;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.volume = this.volume;
      this.audio.onended = () => this.handleEnd();
      this.audio.onerror = () => this.handleEnd();
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
    this.notify();
  }

  public play(beatmapsetId: number, previewUrl?: string) {
    if (!this.audio) return;

    if (this.currentBeatmapsetId === beatmapsetId && this.isPlaying) {
      this.pause();
      return;
    }

    const url = previewUrl || `https://b.ppy.sh/preview/${beatmapsetId}.mp3`;

    this.audio.pause();
    this.audio.src = url;
    this.currentBeatmapsetId = beatmapsetId;
    this.isPlaying = true;
    this.notify();

    this.audio.play().catch((err) => {
      console.warn('Audio preview playback blocked or failed:', err);
      this.isPlaying = false;
      this.currentBeatmapsetId = null;
      this.notify();
    });
  }

  public pause() {
    if (this.audio) {
      this.audio.pause();
    }
    this.isPlaying = false;
    this.currentBeatmapsetId = null;
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
