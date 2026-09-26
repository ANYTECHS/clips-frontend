"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play, Search, Trash2, Volume2 } from "lucide-react";

export type AudioCategory = "All" | "Upbeat" | "Chill" | "Cinematic" | "SFX";

export interface AudioTrack {
  id: string;
  title: string;
  category: Exclude<AudioCategory, "All">;
  duration: string;
  previewUrl: string;
  license: "Royalty-free";
}

export interface AudioPlacement {
  trackId: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export const AUDIO_TRACKS: AudioTrack[] = [
  { id: "pulse-drive", title: "Pulse Drive", category: "Upbeat", duration: "2:14", previewUrl: "https://cdn.pixabay.com/audio/2022/10/25/audio_946b8f2f3a.mp3", license: "Royalty-free" },
  { id: "neon-run", title: "Neon Run", category: "Upbeat", duration: "1:48", previewUrl: "https://cdn.pixabay.com/audio/2022/03/15/audio_3f9f5f3f8a.mp3", license: "Royalty-free" },
  { id: "quiet-current", title: "Quiet Current", category: "Chill", duration: "2:36", previewUrl: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3", license: "Royalty-free" },
  { id: "paper-sky", title: "Paper Sky", category: "Chill", duration: "2:02", previewUrl: "https://cdn.pixabay.com/audio/2022/08/23/audio_2dde668d46.mp3", license: "Royalty-free" },
  { id: "opening-light", title: "Opening Light", category: "Cinematic", duration: "2:52", previewUrl: "https://cdn.pixabay.com/audio/2022/03/10/audio_4a4b8b2a7d.mp3", license: "Royalty-free" },
  { id: "camera-click", title: "Camera Click", category: "SFX", duration: "0:02", previewUrl: "https://cdn.pixabay.com/audio/2022/03/10/audio_2d4e4b3d9b.mp3", license: "Royalty-free" },
  { id: "whoosh-pop", title: "Whoosh Pop", category: "SFX", duration: "0:04", previewUrl: "https://cdn.pixabay.com/audio/2022/03/15/audio_7e8c6e7c12.mp3", license: "Royalty-free" },
];

interface AudioLibraryProps {
  placements: AudioPlacement[];
  onPlacementsChange: (placements: AudioPlacement[]) => void;
}

export default function AudioLibrary({ placements, onPlacementsChange }: AudioLibraryProps) {
  const [category, setCategory] = useState<AudioCategory>("All");
  const [query, setQuery] = useState("");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const tracks = AUDIO_TRACKS.filter((track) => {
    const matchesCategory = category === "All" || track.category === category;
    return matchesCategory && track.title.toLowerCase().includes(query.toLowerCase());
  });

  const togglePreview = (track: AudioTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(track.previewUrl);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  const addTrack = (trackId: string) => {
    if (placements.some((placement) => placement.trackId === trackId)) return;
    onPlacementsChange([...placements, { trackId, volume: 80, fadeIn: 0, fadeOut: 0 }]);
  };

  const updatePlacement = (trackId: string, update: Partial<AudioPlacement>) => {
    onPlacementsChange(placements.map((placement) => placement.trackId === trackId ? { ...placement, ...update } : placement));
  };

  const removePlacement = (trackId: string) => {
    onPlacementsChange(placements.filter((placement) => placement.trackId !== trackId));
  };

  return (
    <div className="space-y-5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const trackId = event.dataTransfer.getData("audio-track-id"); if (trackId) addTrack(trackId); }}>
      <div className="space-y-3">
        <div className="rounded-lg border border-dashed border-brand/40 bg-brand/5 px-3 py-3 text-center text-xs text-brand/80" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const trackId = event.dataTransfer.getData("audio-track-id"); if (trackId) addTrack(trackId); }}>
          Drop audio here to place it on the timeline
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sounds and music" className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none focus:border-brand" />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(["All", "Upbeat", "Chill", "Cinematic", "SFX"] as AudioCategory[]).map((item) => (
            <button key={item} type="button" onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${category === item ? "bg-brand text-black" : "bg-white/5 text-white/60 hover:text-white"}`}>{item}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {tracks.map((track) => {
          const placement = placements.find((item) => item.trackId === track.id);
          return (
            <div key={track.id} draggable onDragStart={(event) => event.dataTransfer.setData("audio-track-id", track.id)} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => togglePreview(track)} aria-label={`${playingId === track.id ? "Pause" : "Preview"} ${track.title}`} className="rounded-full bg-brand/15 p-2 text-brand hover:bg-brand/25">
                  {playingId === track.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{track.title}</p><p className="text-[11px] text-white/45">{track.category} · {track.duration} · {track.license}</p></div>
                <button type="button" onClick={() => addTrack(track.id)} disabled={Boolean(placement)} className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:cursor-default disabled:opacity-40">{placement ? "On timeline" : "Add"}</button>
              </div>
              {placement && <div className="mt-3 space-y-2 border-t border-white/10 pt-3"><div className="flex items-center gap-2 text-xs text-white/60"><Volume2 className="h-3.5 w-3.5" /><span className="w-16">Volume {placement.volume}%</span><input aria-label={`${track.title} volume`} type="range" min="0" max="100" value={placement.volume} onChange={(event) => updatePlacement(track.id, { volume: Number(event.target.value) })} className="flex-1 accent-brand" /><button type="button" onClick={() => removePlacement(track.id)} aria-label={`Remove ${track.title} from timeline`} className="rounded p-1 text-white/40 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="grid grid-cols-2 gap-2"><label className="text-[11px] text-white/50">Fade in <input type="number" min="0" max="10" step="0.5" value={placement.fadeIn} onChange={(event) => updatePlacement(track.id, { fadeIn: Number(event.target.value) })} className="mt-1 w-full rounded bg-white/5 px-2 py-1 text-white" /></label><label className="text-[11px] text-white/50">Fade out <input type="number" min="0" max="10" step="0.5" value={placement.fadeOut} onChange={(event) => updatePlacement(track.id, { fadeOut: Number(event.target.value) })} className="mt-1 w-full rounded bg-white/5 px-2 py-1 text-white" /></label></div></div>}
            </div>
          );
        })}
        {!tracks.length && <div className="py-8 text-center text-sm text-white/45"><Music2 className="mx-auto mb-2 h-5 w-5" />No matching audio</div>}
      </div>
      <p className="text-[11px] text-white/40">Drag any track onto the timeline area, or use Add. Library audio is cleared when you remove it from the timeline.</p>
    </div>
  );
}
