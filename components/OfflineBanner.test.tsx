import { render, screen, fireEvent } from "@testing-library/react";
import OfflineBanner from "@/components/OfflineBanner";
import { I18nProvider } from "@/app/lib/i18n/I18nProvider";

function renderBanner(ui: React.ReactElement) {
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe("OfflineBanner", () => {
  it("announces the offline state", () => {
    renderBanner(<OfflineBanner isOnline={false} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
  });

  it("accepts the legacy isOffline prop", () => {
    renderBanner(<OfflineBanner isOffline />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows reconnecting status", () => {
    renderBanner(<OfflineBanner isOnline syncStatus="reconnecting" />);
    expect(screen.getByRole("status")).toHaveTextContent(/reconnecting/i);
  });

  it("shows syncing status", () => {
    renderBanner(<OfflineBanner isOnline syncStatus="syncing" />);
    expect(screen.getByRole("status")).toHaveTextContent(/syncing/i);
  });

  it("shows synced status", () => {
    renderBanner(<OfflineBanner isOnline syncStatus="synced" />);
    expect(screen.getByRole("status")).toHaveTextContent(/synced/i);
  });

  it("shows sync failed with a retry action", () => {
    const onRetry = jest.fn();
    renderBanner(<OfflineBanner isOnline syncStatus="failed" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/sync failed/i);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
