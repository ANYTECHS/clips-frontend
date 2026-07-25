import { NextResponse } from "next/server";

export interface TransformStyle {
  id: string;
  name: string;
  /** Public URL (or data URI) for the before thumbnail */
  thumbnailBefore: string;
  /** Public URL (or data URI) for the after thumbnail */
  thumbnailAfter: string;
  /** Estimated processing time in seconds */
  avgDurationSeconds: number;
  /** Short description shown on the card */
  description: string;
  /** Accent colour used for the selected-state ring and badge */
  accentColor: string;
}

/** V1 style presets */
const STYLES: TransformStyle[] = [
  {
    id: "anime",
    name: "Anime",
    thumbnailBefore: "/thumbnails/anime-before.jpg",
    thumbnailAfter: "/thumbnails/anime-after.jpg",
    avgDurationSeconds: 45,
    description: "Vivid cel-shading and bold outlines",
    accentColor: "#FF6B9D",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    thumbnailBefore: "/thumbnails/cinematic-before.jpg",
    thumbnailAfter: "/thumbnails/cinematic-after.jpg",
    avgDurationSeconds: 30,
    description: "Film-grade colour grading & letterbox",
    accentColor: "#E2B04A",
  },
  {
    id: "sketch",
    name: "Sketch",
    thumbnailBefore: "/thumbnails/sketch-before.jpg",
    thumbnailAfter: "/thumbnails/sketch-after.jpg",
    avgDurationSeconds: 25,
    description: "Hand-drawn pencil & charcoal look",
    accentColor: "#A0AEC0",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    thumbnailBefore: "/thumbnails/watercolor-before.jpg",
    thumbnailAfter: "/thumbnails/watercolor-after.jpg",
    avgDurationSeconds: 50,
    description: "Soft pigment bleeds on textured paper",
    accentColor: "#76C7F0",
  },
  {
    id: "retro-vhs",
    name: "Retro VHS",
    thumbnailBefore: "/thumbnails/retro-vhs-before.jpg",
    thumbnailAfter: "/thumbnails/retro-vhs-after.jpg",
    avgDurationSeconds: 20,
    description: "80s scan lines, glitch & chromatic aberration",
    accentColor: "#00E58F",
  },
  {
    id: "neon-noir",
    name: "Neon Noir",
    thumbnailBefore: "/thumbnails/neon-noir-before.jpg",
    thumbnailAfter: "/thumbnails/neon-noir-after.jpg",
    avgDurationSeconds: 40,
    description: "Rain-soaked streets with cyberpunk glow",
    accentColor: "#9D4EDD",
  },
];

/**
 * GET /api/transform/styles
 *
 * Returns the list of available AI transformation style presets.
 */
export async function GET() {
  return NextResponse.json({ styles: STYLES });
}
