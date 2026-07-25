import { NextResponse } from "next/server";
import type { Clip } from "@/app/lib/types/clip";

/**
 * In-memory clip store — same no-database pattern used by the rest of the app.
 * Pre-seeded with representative data including clips that already have
 * AI transformations attached.
 */
export const clipsStore: Clip[] = [
  {
    id: "clip-001",
    title: "Epic Gaming Moment - Triple Kill",
    thumbnail: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop",
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    duration: "0:45",
    aiScore: 95,
    status: "ready_to_mint",
    rarity: "epic",
    transformations: [
      {
        style: "anime",
        styleLabel: "Anime",
        resultUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        jobId: "job_anime_001",
        createdAt: "2025-06-10T14:22:00Z",
      },
      {
        style: "neon-noir",
        styleLabel: "Neon Noir",
        resultUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        jobId: "job_neon_001",
        createdAt: "2025-06-12T09:05:00Z",
      },
    ],
  },
  {
    id: "clip-002",
    title: "Funny Cat Compilation",
    thumbnail: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=400&fit=crop",
    duration: "1:30",
    aiScore: 88,
    status: "queue",
    rarity: "rare",
    queuePosition: 5,
    transformations: [
      {
        style: "watercolor",
        styleLabel: "Watercolor",
        resultUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        jobId: "job_wc_001",
        createdAt: "2025-06-15T11:00:00Z",
      },
    ],
  },
  {
    id: "clip-003",
    title: "Tutorial: How to Code",
    thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=400&fit=crop",
    duration: "2:15",
    aiScore: 92,
    status: "minted",
    rarity: "legendary",
    floorPrice: 0.5,
    currentValue: 0.75,
    mintedDate: "2024-01-15",
    transformations: [],
  },
  {
    id: "clip-004",
    title: "Daily Vlog Entry",
    thumbnail: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&h=400&fit=crop",
    duration: "0:30",
    aiScore: 75,
    status: "ready_to_mint",
    rarity: "common",
    transformations: [],
  },
  {
    id: "clip-005",
    title: "Travel Vlog - Tokyo",
    thumbnail: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&h=400&fit=crop",
    duration: "3:00",
    aiScore: 85,
    status: "ready_to_mint",
    rarity: "uncommon",
    transformations: [
      {
        style: "cinematic",
        styleLabel: "Cinematic",
        resultUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        jobId: "job_cin_001",
        createdAt: "2025-06-18T16:30:00Z",
      },
    ],
  },
  {
    id: "clip-006",
    title: "Sports Highlight - Amazing Goal",
    thumbnail: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&h=400&fit=crop",
    duration: "0:15",
    aiScore: 98,
    status: "minted",
    rarity: "legendary",
    floorPrice: 1.2,
    currentValue: 1.5,
    mintedDate: "2024-02-20",
    transformations: [
      {
        style: "retro-vhs",
        styleLabel: "Retro VHS",
        resultUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        jobId: "job_vhs_001",
        createdAt: "2025-05-30T08:15:00Z",
      },
    ],
  },
  {
    id: "clip-007",
    title: "Music Cover - Acoustic",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
    duration: "0:30",
    aiScore: 90,
    status: "minted",
    rarity: "rare",
    floorPrice: 0.3,
    currentValue: 0.25,
    mintedDate: "2024-03-10",
    transformations: [],
  },
  {
    id: "clip-008",
    title: "Cooking Tutorial",
    thumbnail: "https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=400&fit=crop",
    duration: "5:00",
    aiScore: 82,
    status: "queue",
    rarity: "uncommon",
    queuePosition: 42,
    transformations: [
      {
        style: "sketch",
        styleLabel: "Sketch",
        resultUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
        jobId: "job_sketch_001",
        createdAt: "2025-06-20T13:45:00Z",
      },
    ],
  },
];

/**
 * GET /api/clips
 *
 * Returns all clips with their full transformation history.
 * Accepts an optional `?status=ready_to_mint|queue|minted` query param.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status") as Clip["status"] | null;

  const clips = statusFilter
    ? clipsStore.filter((c) => c.status === statusFilter)
    : clipsStore;

  return NextResponse.json({ clips });
}
