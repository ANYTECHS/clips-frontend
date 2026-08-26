import type { Meta, StoryObj } from "@storybook/react";
import { MintConfigForm } from "./MintConfigForm";

const meta: Meta<typeof MintConfigForm> = {
  title: "Vault/MintConfigForm",
  component: MintConfigForm,
  tags: ["autodocs"],
  argTypes: {
    onSubmit: { action: "form_submitted" },
    onCancel: { action: "cancelled" },
    initialLimit: { control: "number" },
    isAssetMutable: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof MintConfigForm>;

export const Default: Story = {
  args: {
    initialLimit: 10000,
    isAssetMutable: true,
    isLoading: false,
    error: null,
  },
};

export const Loading: Story = {
  args: {
    initialLimit: 10000,
    isAssetMutable: true,
    isLoading: true,
    error: null,
  },
};

export const ErrorState: Story = {
  args: {
    initialLimit: 10000,
    isAssetMutable: true,
    isLoading: false,
    error: "Failed to validate asset trustline parameters. Please try again.",
  },
};
