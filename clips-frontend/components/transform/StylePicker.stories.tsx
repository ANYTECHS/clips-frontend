import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import StylePicker from "./StylePicker";
import type { TransformStyle, QuotaInfo } from "./StylePicker";

/* ─── Fixture: styles ─────────────────────────────────────────────────────────── */

const ALL_STYLES: TransformStyle[] = [
  {
    id: "anime",
    name: "Anime",
    thumbnailBefore: "https://placehold.co/200x88/101614/5A6F65?text=Before",
    thumbnailAfter: "https://placehold.co/200x88/FF6B9D/101614?text=Anime",
    avgDurationSeconds: 45,
    description: "Vivid cel-shading and bold outlines",
    accentColor: "#FF6B9D",
  },
  {
    id: "cinematic",
    name: "Cinematic",
    thumbnailBefore: "https://placehold.co/200x88/101614/5A6F65?text=Before",
    thumbnailAfter: "https://placehold.co/200x88/E2B04A/101614?text=Cinematic",
    avgDurationSeconds: 30,
    description: "Film-grade colour grading & letterbox",
    accentColor: "#E2B04A",
  },
  {
    id: "sketch",
    name: "Sketch",
    thumbnailBefore: "https://placehold.co/200x88/101614/5A6F65?text=Before",
    thumbnailAfter: "https://placehold.co/200x88/A0AEC0/101614?text=Sketch",
    avgDurationSeconds: 25,
    description: "Hand-drawn pencil & charcoal look",
    accentColor: "#A0AEC0",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    thumbnailBefore: "https://placehold.co/200x88/101614/5A6F65?text=Before",
    thumbnailAfter: "https://placehold.co/200x88/76C7F0/101614?text=Watercolor",
    avgDurationSeconds: 50,
    description: "Soft pigment bleeds on textured paper",
    accentColor: "#76C7F0",
  },
  {
    id: "retro-vhs",
    name: "Retro VHS",
    thumbnailBefore: "https://placehold.co/200x88/101614/5A6F65?text=Before",
    thumbnailAfter: "https://placehold.co/200x88/00E58F/101614?text=VHS",
    avgDurationSeconds: 20,
    description: "80s scan lines, glitch & chromatic aberration",
    accentColor: "#00E58F",
  },
  {
    id: "neon-noir",
    name: "Neon Noir",
    thumbnailBefore: "https://placehold.co/200x88/101614/5A6F65?text=Before",
    thumbnailAfter: "https://placehold.co/200x88/9D4EDD/101614?text=Neon+Noir",
    avgDurationSeconds: 40,
    description: "Rain-soaked streets with cyberpunk glow",
    accentColor: "#9D4EDD",
  },
];

/* ─── Fixture: quota states ───────────────────────────────────────────────────── */

const QUOTA_FREE_FULL: QuotaInfo = {
  remaining: 3,
  limit: 3,
  resetAt: "2025-08-01T00:00:00.000Z",
  unlimited: false,
};

const QUOTA_PRO_PARTIAL: QuotaInfo = {
  remaining: 27,
  limit: 50,
  resetAt: "2025-08-01T00:00:00.000Z",
  unlimited: false,
};

const QUOTA_PRO_LOW: QuotaInfo = {
  remaining: 2,
  limit: 50,
  resetAt: "2025-08-01T00:00:00.000Z",
  unlimited: false,
};

const QUOTA_EXHAUSTED: QuotaInfo = {
  remaining: 0,
  limit: 3,
  resetAt: "2025-08-01T00:00:00.000Z",
  unlimited: false,
};

const QUOTA_UNLIMITED: QuotaInfo = {
  remaining: null,
  limit: null,
  resetAt: null,
  unlimited: true,
};

/* ─── Meta ───────────────────────────────────────────────────────────────────── */

const meta = {
  title: "Transform/StylePicker",
  component: StylePicker,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component: [
          "Grid of AI transformation style preset cards.",
          "Selecting a card triggers a low-res preview before full processing.",
          "",
          "**Quota system:** A `QuotaBar` is displayed above the grid showing",
          "transforms remaining this month. When quota reaches 0 all unselected",
          "cards are disabled and an Upgrade Plan CTA appears.",
          "",
          "Styles are fetched from `GET /api/transform/styles`.",
          "Quota is fetched from `GET /api/transform`.",
        ].join("\n"),
      },
    },
  },
  tags: ["autodocs"],
  args: {
    onSelect: fn(),
    styles: ALL_STYLES,
    quota: QUOTA_PRO_PARTIAL,
  },
  argTypes: {
    selectedStyleId: {
      control: "select",
      options: [
        null,
        "anime",
        "cinematic",
        "sketch",
        "watercolor",
        "retro-vhs",
        "neon-noir",
      ],
      description: "Currently selected style ID (controlled)",
    },
    disabled: {
      control: "boolean",
      description: "Disable all cards (e.g. full processing is running)",
    },
  },
} satisfies Meta<typeof StylePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/* ─── Core interaction stories ───────────────────────────────────────────────── */

/** Default idle state — no style selected, pro quota with headroom. */
export const Default: Story = {
  args: {
    selectedStyleId: null,
    disabled: false,
    quota: QUOTA_PRO_PARTIAL,
  },
};

/** One card in the selected (post-preview) state. */
export const WithSelection: Story = {
  args: {
    selectedStyleId: "cinematic",
    disabled: false,
    quota: QUOTA_PRO_PARTIAL,
  },
};

/** All cards disabled — simulates full-processing in progress. */
export const Disabled: Story = {
  args: {
    selectedStyleId: null,
    disabled: true,
    quota: QUOTA_PRO_PARTIAL,
  },
};

/** Selected + disabled — style chosen, processing has started. */
export const SelectedAndDisabled: Story = {
  args: {
    selectedStyleId: "neon-noir",
    disabled: true,
    quota: QUOTA_PRO_PARTIAL,
  },
};

/* ─── Quota stories ──────────────────────────────────────────────────────────── */

/**
 * Free plan, full quota (3/3 remaining).
 * Bar is green, no CTA shown.
 */
export const QuotaFreePlanFull: Story = {
  name: "Quota — Free plan (3 / 3 remaining)",
  args: {
    selectedStyleId: null,
    disabled: false,
    quota: QUOTA_FREE_FULL,
  },
};

/**
 * Pro plan, partially consumed (27/50 remaining).
 * Bar is green with moderate fill.
 */
export const QuotaProPartial: Story = {
  name: "Quota — Pro plan (27 / 50 remaining)",
  args: {
    selectedStyleId: null,
    disabled: false,
    quota: QUOTA_PRO_PARTIAL,
  },
};

/**
 * Pro plan, critically low (2/50 remaining).
 * Bar turns red as a warning.
 */
export const QuotaProLow: Story = {
  name: "Quota — Pro plan (2 / 50 remaining, critical)",
  args: {
    selectedStyleId: null,
    disabled: false,
    quota: QUOTA_PRO_LOW,
  },
};

/**
 * Quota fully exhausted (0/3 on free plan).
 * All unselected cards are disabled, upgrade CTA banner appears above the grid,
 * and quota bar shows "Quota exhausted" in red.
 */
export const QuotaExhausted: Story = {
  name: "Quota — Exhausted (0 / 3, upgrade CTA shown)",
  args: {
    selectedStyleId: null,
    disabled: false,
    quota: QUOTA_EXHAUSTED,
  },
  parameters: {
    docs: {
      description: {
        story:
          "When all transforms are consumed the cards are blocked and a prominent "Upgrade Plan" CTA is shown.",
      },
    },
  },
};

/**
 * Quota exhausted but a style is already selected.
 * The selected card stays interactive (Apply style); all others remain disabled.
 */
export const QuotaExhaustedWithSelection: Story = {
  name: "Quota — Exhausted with existing selection",
  args: {
    selectedStyleId: "anime",
    disabled: false,
    quota: QUOTA_EXHAUSTED,
  },
};

/**
 * Enterprise plan — unlimited transforms.
 * Bar shows the infinity icon and "Unlimited transforms" label.
 */
export const QuotaUnlimited: Story = {
  name: "Quota — Enterprise (unlimited)",
  args: {
    selectedStyleId: null,
    disabled: false,
    quota: QUOTA_UNLIMITED,
  },
};

/* ─── Loading story ───────────────────────────────────────────────────────────── */

/**
 * Loading skeleton — no styles or quota prop, so both fetches are in-flight.
 * The quota bar skeleton and style card skeletons are shown.
 */
export const Loading: Story = {
  args: {
    styles: undefined,
    quota: undefined,
    selectedStyleId: null,
    disabled: false,
  },
  parameters: {
    fetchMock: {
      mocks: [
        {
          matcher: { url: "/api/transform/styles" },
          response: new Promise(() => {}),
        },
        {
          matcher: { url: "/api/transform" },
          response: new Promise(() => {}),
        },
      ],
    },
    docs: {
      description: {
        story:
          "Both the quota bar and card grid show skeleton placeholders while data is in-flight.",
      },
    },
  },
};

/* ─── Full-grid comparison ────────────────────────────────────────────────────── */

/** All 6 styles, interactive, with a healthy pro quota. */
export const AllStyles: Story = {
  args: {
    selectedStyleId: null,
    disabled: false,
    quota: QUOTA_PRO_PARTIAL,
  },
  render: (args) => (
    <div className="space-y-6">
      <p className="text-[13px] text-muted-foreground">
        All 6 V1 styles — click any card to see the preview flow.
      </p>
      <StylePicker {...args} />
    </div>
  ),
};

/* ─── Per-style isolation stories ────────────────────────────────────────────── */

export const AnimeStyle: Story = {
  args: { selectedStyleId: "anime", quota: QUOTA_PRO_PARTIAL },
};
export const CinematicStyle: Story = {
  args: { selectedStyleId: "cinematic", quota: QUOTA_PRO_PARTIAL },
};
export const SketchStyle: Story = {
  args: { selectedStyleId: "sketch", quota: QUOTA_PRO_PARTIAL },
};
export const WatercolorStyle: Story = {
  args: { selectedStyleId: "watercolor", quota: QUOTA_PRO_PARTIAL },
};
export const RetroVhsStyle: Story = {
  args: { selectedStyleId: "retro-vhs", quota: QUOTA_PRO_PARTIAL },
};
export const NeonNoirStyle: Story = {
  args: { selectedStyleId: "neon-noir", quota: QUOTA_PRO_PARTIAL },
};
