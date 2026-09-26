import type { CaptionSegment } from "@/app/api/schemas/captions.schema";

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function formatTime(ms: number, separator: "," | "."): string {
  const totalMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1_000);
  const milliseconds = totalMs % 1_000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${pad(milliseconds, 3)}`;
}

function ordered(segments: CaptionSegment[]): CaptionSegment[] {
  return [...segments].sort(
    (left, right) => left.startMs - right.startMs || left.endMs - right.endMs
  );
}

function cleanText(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

/** Build an SRT subtitle file from validated caption segments. */
export function segmentsToSrt(segments: CaptionSegment[]): string {
  return ordered(segments)
    .map((segment, index) => {
      const start = formatTime(segment.startMs, ",");
      const end = formatTime(segment.endMs, ",");
      return `${index + 1}\n${start} --> ${end}\n${cleanText(segment.text)}\n`;
    })
    .join("\n");
}

/** Build a WebVTT subtitle file from validated caption segments. */
export function segmentsToVtt(segments: CaptionSegment[]): string {
  const cues = ordered(segments)
    .map((segment) => {
      const start = formatTime(segment.startMs, ".");
      const end = formatTime(segment.endMs, ".");
      return `${start} --> ${end}\n${cleanText(segment.text)}`;
    })
    .join("\n\n");
  return `WEBVTT\n\n${cues}\n`;
}

export type SubtitleFormat = "srt" | "vtt";

export function buildSubtitleFile(segments: CaptionSegment[], format: SubtitleFormat): string {
  return format === "srt" ? segmentsToSrt(segments) : segmentsToVtt(segments);
}
