class BeatmapPreviewPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentBeatmapsetId: number | null = null;
  private isPlaying: boolean = false;
  private listeners: Set<(isPlaying: boolean, beatmapsetId: number | null) => void> = new Set();
  private volume: number = 0.2;
  private fadeInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      // DO NOT set crossOrigin = 'anonymous' because b.ppy.sh CDN does not send CORS headers
      // and normal <audio> element playback does not require CORS.
      this.audio.volume = this.volume;
      this.audio.preload = 'none';

      this.audio.onended = () => {
        this.isPlaying = false;
        this.currentBeatmapsetId = null;
        this.notify();
      };

      this.audio.onerror = (e) => {
        console.warn('Audio preview load error:', e);
        this.isPlaying = false;
        this.currentBeatmapsetId = null;
        this.notify();
      };
    }
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio && !this.fadeInterval) {
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

  public pause() {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying = false;
    this.notify();
  }

  public toggle(beatmapsetId: number, previewUrl?: string) {
    if (this.currentBeatmapsetId === beatmapsetId && this.isPlaying) {
      this.pause();
    } else {
      this.play(beatmapsetId, previewUrl);
    }
  }

  public play(beatmapsetId: number, previewUrl?: string) {
    if (!this.audio) return;

    if (this.currentBeatmapsetId === beatmapsetId && this.isPlaying) {
      this.pause();
      return;
    }

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    // Official osu! preview CDN URL
    const streamUrl = previewUrl || `https://b.ppy.sh/preview/${beatmapsetId}.mp3`;

    try {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio.volume = 0.02; // Start very soft
      this.audio.src = streamUrl;
      this.currentBeatmapsetId = beatmapsetId;
      this.isPlaying = true;
      this.notify();

      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Smooth fade-in over 350ms to target volume
            const targetVol = this.volume;
            let currentVol = 0.02;
            const step = (targetVol - currentVol) / 7;
            this.fadeInterval = setInterval(() => {
              if (!this.audio || !this.isPlaying) {
                if (this.fadeInterval) clearInterval(this.fadeInterval);
                this.fadeInterval = null;
                return;
              }
              currentVol += step;
              if (currentVol >= targetVol) {
                this.audio.volume = targetVol;
                clearInterval(this.fadeInterval);
                this.fadeInterval = null;
              } else {
                this.audio.volume = Math.max(0.01, Math.min(1, currentVol));
              }
            }, 50);
          })
          .catch((err) => {
            console.warn('Audio play was interrupted or blocked by autoplay policy:', err);
            this.isPlaying = false;
            this.notify();
          });
      }
    } catch (err) {
      console.warn('Audio error during play():', err);
      this.isPlaying = false;
      this.notify();
    }
  }

  public getCurrentState(): { isPlaying: boolean; currentBeatmapsetId: number | null } {
    return {
      isPlaying: this.isPlaying,
      currentBeatmapsetId: this.currentBeatmapsetId,
    };
  }
}

export const previewPlayer = new BeatmapPreviewPlayer();
