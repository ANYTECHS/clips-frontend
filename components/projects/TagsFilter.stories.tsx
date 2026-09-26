import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "@storybook/test";
import { TagsFilter } from "./TagsFilter";

const meta: Meta<typeof TagsFilter> = {
  title: "Projects/TagsFilter",
  component: TagsFilter,
  tags: ["autodocs"],
  argTypes: {
    onTagsChange: { action: "tags_changed" },
    selectedTags: { control: "object" },
    availableTags: { control: "object" },
    placeholder: { control: "text" },
  },
};

export default meta;
type Story = StoryObj<typeof TagsFilter>;

const MOCK_TAGS = [
  "tutorial",
  "product",
  "broll",
  "reactions",
  "engagement",
  "hook",
  "technical",
  "education",
  "campaign-q4",
  "intro",
  "outro",
  "trending",
  "shorts",
  "long-form",
];

/**
 * Default: Empty selection with all available tags.
 */
export const Default: Story = {
  args: {
    selectedTags: [],
    onTagsChange: fn(),
    availableTags: MOCK_TAGS,
    placeholder: "Search or select tags...",
  },
};

/**
 * With some tags already selected.
 */
export const WithSelectedTags: Story = {
  args: {
    selectedTags: ["tutorial", "product"],
    onTagsChange: fn(),
    availableTags: MOCK_TAGS,
    placeholder: "Search or select tags...",
  },
};

/**
 * Near max capacity (9 out of 10 tags selected).
 */
export const NearMaxCapacity: Story = {
  args: {
    selectedTags: [
      "tutorial",
      "product",
      "broll",
      "reactions",
      "engagement",
      "hook",
      "technical",
      "education",
      "campaign-q4",
    ],
    onTagsChange: fn(),
    availableTags: MOCK_TAGS,
    placeholder: "Search or select tags...",
  },
};

/**
 * Max capacity: 10 tags selected (add button disabled).
 */
export const MaxCapacity: Story = {
  args: {
    selectedTags: [
      "tutorial",
      "product",
      "broll",
      "reactions",
      "engagement",
      "hook",
      "technical",
      "education",
      "campaign-q4",
      "trending",
    ],
    onTagsChange: fn(),
    availableTags: MOCK_TAGS,
    placeholder: "Search or select tags...",
  },
};

/**
 * Limited tag pool (useful for showing when most tags are already selected).
 */
export const LimitedTags: Story = {
  args: {
    selectedTags: ["tutorial", "product"],
    onTagsChange: fn(),
    availableTags: ["tutorial", "product", "broll", "reactions"],
    placeholder: "Search or select tags...",
  },
};

/**
 * Empty tag pool (no suggestions available).
 */
export const EmptyTags: Story = {
  args: {
    selectedTags: ["tutorial"],
    onTagsChange: fn(),
    availableTags: [],
    placeholder: "No available tags",
  },
};

/**
 * Custom placeholder text.
 */
export const CustomPlaceholder: Story = {
  args: {
    selectedTags: [],
    onTagsChange: fn(),
    availableTags: MOCK_TAGS,
    placeholder: "Filter by campaign, topic, or style...",
  },
};

/**
 * Interactive story for testing with callbacks.
 */
export const Interactive: Story = {
  args: {
    selectedTags: [],
    onTagsChange: fn(),
    availableTags: MOCK_TAGS,
    placeholder: "Search or select tags...",
  },
};
