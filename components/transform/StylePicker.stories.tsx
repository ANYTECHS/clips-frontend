import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { StylePicker } from "./StylePicker";
import type { TransformStyle } from "@/app/api/transform/styles/route";
import type { ApiResponse } from "@/app/api/types";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_STYLES: TransformStyle[] = [
  {
    name: "anime",
    label: "Anime",
    description: "Bold outlines, vivid colours, cel-shaded look",
    thumbnail: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&h=340&fit=crop",
    avgDurationSeconds: 45,
  },
  {
    name: "cinematic",
    label: "Cinematic",
    description: "Film grain, colour grading, anamorphic lens flares",
    thumbnail: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=600&h=340&fit=crop",
    avgDurationSeconds: 55,
  },
  {
    name: "sketch",
    label: "Sketch",
    description: "Pencil-drawn outlines with subtle paper texture",
    thumbnail: "https://images.unsplash.com/photo-1608501821300-4f99e58bba77?w=600&h=340&fit=crop",
    avgDurationSeconds: 38,
  },
  {
    name: "watercolor",
    label: "Watercolour",
    description: "Soft washes, blurred edges, painterly brush strokes",
    thumbnail: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&h=340&fit=crop",
    avgDurationSeconds: 50,
  },
  {
    name: "retro-vhs",
    label: "Retro VHS",
    description: "Scan lines, colour bleed, 80s tape-deck artefacts",
    thumbnail: "https://images.unsplash.com/photo-1596079890701-dd43bc7e46df?w=600&h=340&fit=crop",
    avgDurationSeconds: 35,
  },
  {
    name: "neon-noir",
    label: "Neon Noir",
    description: "High-contrast shadows with vivid neon accent lighting",
    thumbnail: "https://images.unsplash.com/photo-1518818419601-72c8673f5852?w=600&h=340&fit=crop",
    avgDurationSeconds: 60,
  },
];

// ─── Fetch mock helper ────────────────────────────────────────────────────────

/**
 * Returns a `fetch` stub that responds with the given payload for
 * `/api/transform/styles` requests. Storybook's `beforeEach` / `parameters`
 * can't stub `fetch` directly so we leverage the `loaders` + a global
 * override that is cleaned up after each story.
 */
function mockFetch(response: ApiResponse<TransformStyle[]>, delayMs = 0) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/transform/styles")) {
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return original(input, init);
  };
  // Return cleanup so callers can restore
  return () => {
    globalThis.fetch = original;
  };
}

// ─── Meta ─────────────────────────────────────────────────────────────────────

const meta: Meta<typeof StylePicker> = {
  title: "Transform/StylePicker",
  component: StylePicker,
  tags: ["autodocs"],
  argTypes: {
    onStyleSelect: { action: "style_selected" },
    onPreviewRequest: { action: "preview_requested" },
    disabled: { control: "boolean" },
    selectedStyle: {
      control: "select",
      options: [null, "anime", "cinematic", "sketch", "watercolor", "retro-vhs", "neon-noir"],
    },
  },
  args: {
    onStyleSelect: fn(),
    onPreviewRequest: fn(),
  },
  decorators: [
    (Story) => {
      // Default: mock a fast successful response so stories don't hit a real server
      const cleanup = mockFetch({ data: MOCK_STYLES, error: null });
      // Storybook v8 decorators run synchronously; we set fetch globally and
      // rely on cleanup being called when the story unmounts is not guaranteed.
      // The mock is intentionally leaky across stories within the same run —
      // individual stories override it via their own loaders.
      void cleanup; // suppress unused warning; each story overrides as needed
      return <Story />;
    },
  ],
};

export default meta;
type Story = StoryObj<typeof StylePicker>;

// ─── Stories ──────────────────────────────────────────────────────────────────

/**
 * Default — all 6 styles loaded, none selected.
 */
export const Default: Story = {
  args: {
    selectedStyle: null,
    disabled: false,
  },
  decorators: [
    (Story) => {
      mockFetch({ data: MOCK_STYLES, error: null });
      return <Story />;
    },
  ],
};

/**
 * Selected — "cinematic" card shows the selected state with the brand ring and checkmark.
 */
export const Selected: Story = {
  args: {
    selectedStyle: "cinematic",
    disabled: false,
  },
  decorators: [
    (Story) => {
      mockFetch({ data: MOCK_STYLES, error: null });
      return <Story />;
    },
  ],
};

/**
 * Disabled — all cards are greyed out and non-interactive, e.g. during active processing.
 */
export const Disabled: Story = {
  args: {
    selectedStyle: "anime",
    disabled: true,
  },
  decorators: [
    (Story) => {
      mockFetch({ data: MOCK_STYLES, error: null });
      return <Story />;
    },
  ],
};

/**
 * Loading — shows the skeleton grid while styles are being fetched.
 * Uses a 60-second artificial delay so the skeleton persists for inspection.
 */
export const Loading: Story = {
  args: {
    selectedStyle: null,
    disabled: false,
  },
  decorators: [
    (Story) => {
      mockFetch({ data: MOCK_STYLES, error: null }, 60_000);
      return <Story />;
    },
  ],
};

/**
 * Error — simulates a network failure; shows the error state with a retry button.
 */
export const ErrorState: Story = {
  name: "Error",
  args: {
    selectedStyle: null,
    disabled: false,
  },
  decorators: [
    (Story) => {
      const original = globalThis.fetch;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (url.includes("/api/transform/styles")) {
          throw new Error("Network request failed");
        }
        return original(input, init);
      };
      return <Story />;
    },
  ],
};

/**
 * Empty — the API returns an empty list; shows the empty state message.
 */
export const Empty: Story = {
  args: {
    selectedStyle: null,
    disabled: false,
  },
  decorators: [
    (Story) => {
      mockFetch({ data: [], error: null });
      return <Story />;
    },
  ],
};
