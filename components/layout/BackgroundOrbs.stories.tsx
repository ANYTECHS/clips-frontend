import type { Meta, StoryObj } from "@storybook/react";
import BackgroundOrbs from "./BackgroundOrbs";

const meta: Meta<typeof BackgroundOrbs> = {
  title: "Layout/BackgroundOrbs",
  component: BackgroundOrbs,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "subtle", "upload", "onboarding"],
      description: "Visual variant for the background orbs",
    },
  },
};

export default meta;
type Story = StoryObj<typeof BackgroundOrbs>;

export const Default: Story = {
  args: {
    variant: "default",
  },
  parameters: {
    docs: {
      description: {
        story: "Default variant with two brand-colored orbs. Used across most dashboard pages.",
      },
    },
  },
};

export const Subtle: Story = {
  args: {
    variant: "subtle",
  },
  parameters: {
    docs: {
      description: {
        story: "Subtle variant with reduced opacity. Used for settings, recovery, and share pages.",
      },
    },
  },
};

export const Upload: Story = {
  args: {
    variant: "upload",
  },
  parameters: {
    docs: {
      description: {
        story: "Upload variant with green accent color. Used on the upload page.",
      },
    },
  },
};

export const Onboarding: Story = {
  args: {
    variant: "onboarding",
  },
  parameters: {
    docs: {
      description: {
        story: "Onboarding variant with enhanced glow. Used during user onboarding flow.",
      },
    },
  },
};

// Demo wrapper to show orbs in context
const DemoWrapper = ({ variant }: { variant: "default" | "subtle" | "upload" | "onboarding" }) => (
  <div className="min-h-screen bg-background text-white font-sans relative overflow-hidden">
    <BackgroundOrbs variant={variant} />
    <div className="relative z-10 p-8">
      <h1 className="text-2xl font-bold mb-4">BackgroundOrbs Demo</h1>
      <p className="text-muted-foreground">Variant: {variant}</p>
    </div>
  </div>
);

export const DefaultWithContext: Story = {
  render: () => <DemoWrapper variant="default" />,
  parameters: {
    docs: {
      description: {
        story: "Default variant shown in a typical page context.",
      },
    },
  },
};

export const SubtleWithContext: Story = {
  render: () => <DemoWrapper variant="subtle" />,
  parameters: {
    docs: {
      description: {
        story: "Subtle variant shown in a typical page context.",
      },
    },
  },
};
