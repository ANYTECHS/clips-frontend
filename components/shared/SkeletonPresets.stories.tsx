import type { Meta, StoryObj } from "@storybook/react";
import {
  AnalyticsPageSkeleton,
  BalanceCardSkeleton,
  ChartSkeleton,
  DashboardPageSkeleton,
  EarningsPageSkeleton,
  PageHeaderSkeleton,
  ProjectGridSkeleton,
  StatCardSkeleton,
  StatCardsSkeleton,
  SummaryCardSkeleton,
  SummaryCardsSkeleton,
  TableSkeleton,
  TransactionListSkeleton,
  WalletPageSkeleton,
} from "./SkeletonPresets";

const meta: Meta = {
  title: "Shared/SkeletonPresets",
  decorators: [
    (Story) => (
      <div className="bg-[#020D08] p-6 min-h-screen">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj;

export const PageHeader: Story = { render: () => <PageHeaderSkeleton /> };
export const StatCard: Story = { render: () => <StatCardSkeleton /> };
export const StatCards: Story = { render: () => <StatCardsSkeleton count={2} /> };
export const SummaryCard: Story = { render: () => <SummaryCardSkeleton /> };
export const SummaryCards: Story = { render: () => <SummaryCardsSkeleton count={2} /> };
export const Chart: Story = { render: () => <ChartSkeleton /> };
export const ProjectGrid: Story = { render: () => <ProjectGridSkeleton count={6} /> };
export const Table: Story = { render: () => <TableSkeleton rows={5} columns={4} /> };
export const BalanceCard: Story = { render: () => <BalanceCardSkeleton /> };
export const TransactionList: Story = { render: () => <TransactionListSkeleton rows={5} /> };

export const DashboardPage: Story = { render: () => <DashboardPageSkeleton /> };
export const AnalyticsPage: Story = { render: () => <AnalyticsPageSkeleton /> };
export const EarningsPage: Story = { render: () => <EarningsPageSkeleton /> };
export const WalletPage: Story = { render: () => <WalletPageSkeleton /> };

/** Mobile viewport: tables collapse to cards and stat cards stack. */
export const EarningsPageMobile: Story = {
  render: () => <EarningsPageSkeleton />,
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
