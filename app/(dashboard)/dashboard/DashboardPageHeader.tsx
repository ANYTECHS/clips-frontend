/**
 * DashboardPageHeader - Server component for static page header
 * Extracted from dashboard/page.tsx for better performance
 */
export default function DashboardPageHeader() {
  return (
    <div className="px-6 sm:px-8 pt-2">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] sm:text-[32px] font-extrabold text-white tracking-tight">Dashboard</h1>
        <p className="text-[14px] text-muted">Overview of your earnings, clips, and platform performance</p>
      </div>
    </div>
  );
}
