import type { Meta, StoryObj } from '@storybook/react';
import { AssetRow } from './AssetRow';

const meta: Meta<typeof AssetRow> = {
  title: 'Wallet/AssetRow',
  component: AssetRow,
  tags: ['autodocs'],
  argTypes: {
    network: {
      control: 'select',
      options: ['PUBLIC', 'TESTNET'],
    },
    pct: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
  },
};

export default meta;
type Story = StoryObj<typeof AssetRow>;

export const XLM: Story = {
  args: {
    code: 'XLM',
    balance: '1,250.0000000',
    usdValue: 187.5,
    usdDisplay: '$187.50',
    pct: 0.65,
    color: '#00E68A',
    network: 'PUBLIC',
  },
};

export const USDC: Story = {
  args: {
    code: 'USDC',
    balance: '500.0000000',
    usdValue: 500.0,
    usdDisplay: '$500.00',
    pct: 0.3,
    color: '#2775CA',
    issuer: 'GAQY2GAQLZXJV3AVHNGII4YWNEOXNFOSHNBZFM4IXYSH4Q5NKJQZVQL',
    network: 'PUBLIC',
  },
};

export const SmallAllocation: Story = {
  args: {
    code: 'CLIP',
    balance: '42.0000000',
    usdValue: 2.1,
    usdDisplay: '$2.10',
    pct: 0.05,
    color: '#8B5CF6',
    issuer: 'GBCLIP1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD',
    network: 'PUBLIC',
  },
};

export const Testnet: Story = {
  args: {
    code: 'XLM',
    balance: '9,999.9999999',
    usdValue: 0,
    usdDisplay: 'Testnet',
    pct: 1,
    color: '#F59E0B',
    network: 'TESTNET',
  },
};

export const NoIssuer: Story = {
  args: {
    code: 'XLM',
    balance: '250.0000000',
    usdValue: 37.5,
    pct: 0.4,
    color: '#00E68A',
    network: 'PUBLIC',
  },
};
