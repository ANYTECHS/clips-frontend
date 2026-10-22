import type { Meta, StoryObj } from '@storybook/react';
import { TrustlineManagerView } from './TrustlineManager';

const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const NFT_ISSUER = 'GCKFBEIYV2U22IO2BJ4KVJOIP7XPWQGQFKKWXR6DOSJBV7STMAQSMTGG';

const trustlines = [
  { assetCode: 'USDC', assetIssuer: USDC_ISSUER, balance: '125.5000000', limit: '922337203685.4775807' },
  { assetCode: 'CLIPNFT', assetIssuer: NFT_ISSUER, balance: '0.0000000', limit: '1000.0000000' },
];

const meta: Meta<typeof TrustlineManagerView> = {
  title: 'Wallet/TrustlineManager',
  component: TrustlineManagerView,
  tags: ['autodocs'],
  args: {
    trustlines,
    onAdd: () => {},
    onRemove: () => {},
    onRefresh: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof TrustlineManagerView>;

/** Trustline list with asset code, issuer, balance and limit. */
export const List: Story = {};

export const Empty: Story = {
  args: { trustlines: [] },
};

export const LoadingList: Story = {
  args: { trustlines: [], isListLoading: true },
};

export const ListError: Story = {
  args: { trustlines: [], listError: 'Horizon returned HTTP 503' },
};

/** "Add Trustline" form open. */
export const AddForm: Story = {
  args: { defaultFormOpen: true },
};

/** Add operation in flight. */
export const Adding: Story = {
  args: { defaultFormOpen: true, isAdding: true, statusLabel: 'Signing…' },
};

/** Remove confirmation prompt for a zero-balance trustline. */
export const RemoveConfirmation: Story = {
  args: { defaultConfirmKey: `CLIPNFT:${NFT_ISSUER}` },
};

/** Remove confirmation blocked because the trustline still holds a balance. */
export const RemoveBlockedByBalance: Story = {
  args: { defaultConfirmKey: `USDC:${USDC_ISSUER}` },
};

/** Remove operation in flight. */
export const Removing: Story = {
  args: { removingKey: `CLIPNFT:${NFT_ISSUER}`, statusLabel: 'Submitting…' },
};
