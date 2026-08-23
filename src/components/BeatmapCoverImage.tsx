import React, { useState } from 'react';
import { Beatmap } from '../types/beatmap';
import { Disc, Music } from 'lucide-react';

interface BeatmapCoverImageProps {
  beatmap: Beatmap;
  className?: string;
  alt?: string;
}

export const BeatmapCoverImage: React.FC<BeatmapCoverImageProps> = ({
  beatmap,
  className = '',
  alt,
}) => {
  // Step: 0 = primary cover, 1 = card, 2 = legacy thumbLarge, 3 = legacy thumb, 4 = procedural fallback
  const [errorStep, setErrorStep] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  const fallbackUrls = [
    beatmap.covers?.cover,
    beatmap.covers?.card,
    `https://b.ppy.sh/thumb/${beatmap.beatmapsetId}l.jpg`,
    `https://b.ppy.sh/thumb/${beatmap.beatmapsetId}.jpg`,
  ].filter(Boolean) as string[];

  const handleError = () => {
    if (errorStep < fallbackUrls.length - 1) {
      setErrorStep((prev) => prev + 1);
    } else {
      setErrorStep(fallbackUrls.length); // Switch to procedural fallback
    }
  };

  // If all image URLs failed, render a stylized procedural album artwork
  if (errorStep >= fallbackUrls.length) {
    // Generate deterministic hue based on beatmapset ID / title
    const hash = (beatmap.beatmapsetId * 997 + beatmap.title.length * 37) % 360;
    const gradient = `linear-gradient(135deg, hsl(${hash}, 70%, 18%) 0%, hsl(${(hash + 60) % 360}, 60%, 8%) 100%)`;

    return (
      <div
        className={`relative w-full h-full flex flex-col justify-between p-3 overflow-hidden select-none ${className}`}
        style={{ background: gradient }}
      >
        {/* Background Vinyl Ring Watermark */}
        <div className="absolute -right-6 -bottom-6 opacity-20 pointer-events-none">
          <Disc className="w-32 h-32 text-white animate-spin-slow" />
        </div>

        {/* Top Watermark */}
        <div className="flex items-center space-x-1 opacity-50 z-10">
          <Music className="w-3.5 h-3.5 text-pink-400" />
          <span className="text-[10px] font-mono tracking-widest text-slate-300 uppercase">osu! Beatmap</span>
        </div>

        {/* Center Title / Artist Preview */}
        <div className="z-10 my-auto text-center px-2">
          <p className="font-extrabold text-sm md:text-base text-white line-clamp-1 drop-shadow-md tracking-wide">
            {beatmap.title}
          </p>
          <p className="text-xs text-pink-300 line-clamp-1 drop-shadow opacity-90">
            {beatmap.artist}
          </p>
        </div>

        {/* Bottom subtle detail */}
        <div className="z-10 flex justify-between items-center text-[10px] font-mono text-slate-400 opacity-60">
          <span>{beatmap.bpm} BPM</span>
          <span>[{beatmap.version}]</span>
        </div>
      </div>
    );
  }

  const currentSrc = fallbackUrls[errorStep];

  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-950 ${className}`}>
      {/* Skeleton loading background */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-900 animate-pulse flex items-center justify-center">
          <Disc className="w-6 h-6 text-slate-700 animate-spin-slow" />
        </div>
      )}

      <img
        src={currentSrc}
        alt={alt || `${beatmap.artist} - ${beatmap.title}`}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={handleError}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
