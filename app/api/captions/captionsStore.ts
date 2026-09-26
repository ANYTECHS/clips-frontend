import type { CaptionSegment, CaptionStyle } from "@/app/api/schemas/captions.schema";

export type CaptionStatus = "queued" | "processing" | "complete" | "error";

export interface ClipCaptions {
  clipId: string;
  userId: string;
  jobId?: string;
  status: CaptionStatus;
  language: string;
  detectedLanguage?: string;
  segments: CaptionSegment[];
  style: CaptionStyle;
  srtContent?: string;
  vttContent?: string;
  burnIntoExport: boolean;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

function segmentsToSrt(segments: CaptionSegment[]): string {
  return segments
    .map((seg, i) => {
      const start = msToSrtTime(seg.startMs);
      const end = msToSrtTime(seg.endMs);
      return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join("\n");
}

function segmentsToVtt(segments: CaptionSegment[]): string {
  const cues = segments
    .map((seg) => {
      const start = msToVttTime(seg.startMs);
      const end = msToVttTime(seg.endMs);
      return `${start} --> ${end}\n${seg.text}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${cues}\n`;
}

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(msRem).padStart(3, "0")}`;
}

function msToVttTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)}.${String(msRem).padStart(3, "0")}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const DEFAULT_STYLE: CaptionStyle = {
  fontStyle: "bold",
  position: "bottom",
};

const MOCK_SEGMENTS: CaptionSegment[] = [
  { id: "1", text: "Welcome to the show!", startMs: 0, endMs: 2200 },
  { id: "2", text: "Today we're diving deep.", startMs: 2200, endMs: 4800 },
  { id: "3", text: "This moment is pure gold.", startMs: 4800, endMs: 7200 },
];

class CaptionsStore {
  private captions = new Map<string, ClipCaptions>();

  private key(clipId: string, userId: string): string {
    return `${userId}:${clipId}`;
  }

  get(clipId: string, userId: string): ClipCaptions | undefined {
    return this.captions.get(this.key(clipId, userId));
  }

  upsert(data: Partial<ClipCaptions> & { clipId: string; userId: string }): ClipCaptions {
    const k = this.key(data.clipId, data.userId);
    const existing = this.captions.get(k);
    const now = new Date().toISOString();

    const segments = data.segments ?? existing?.segments ?? [];
    const record: ClipCaptions = {
      clipId: data.clipId,
      userId: data.userId,
      jobId: data.jobId ?? existing?.jobId,
      status: data.status ?? existing?.status ?? "complete",
      language: data.language ?? existing?.language ?? "auto",
      detectedLanguage: data.detectedLanguage ?? existing?.detectedLanguage,
      segments,
      style: data.style ?? existing?.style ?? DEFAULT_STYLE,
      srtContent: segments.length ? segmentsToSrt(segments) : existing?.srtContent,
      vttContent: segments.length ? segmentsToVtt(segments) : existing?.vttContent,
      burnIntoExport: data.burnIntoExport ?? existing?.burnIntoExport ?? true,
      errorMessage: data.errorMessage,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.captions.set(k, record);
    return record;
  }

  setGenerating(clipId: string, userId: string, jobId: string, language: string): ClipCaptions {
    return this.upsert({
      clipId,
      userId,
      jobId,
      status: "queued",
      language,
      segments: [],
      style: DEFAULT_STYLE,
      burnIntoExport: true,
    });
  }

  completeGeneration(
    clipId: string,
    userId: string,
    segments: CaptionSegment[],
    detectedLanguage?: string,
  ): ClipCaptions {
    return this.upsert({
      clipId,
      userId,
      status: "complete",
      segments,
      detectedLanguage,
      style: DEFAULT_STYLE,
      burnIntoExport: true,
    });
  }

  getByJobId(jobId: string): ClipCaptions | undefined {
    for (const record of this.captions.values()) {
      if (record.jobId === jobId) return record;
    }
    return undefined;
  }
}

export const captionsStore = new CaptionsStore();
