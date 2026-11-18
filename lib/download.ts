// Triggers a browser file-save, proxying cross-origin URLs if needed
function isSameOrigin(url: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const { origin } = new URL(url, window.location.href);
    return origin === window.location.origin;
  } catch {
    return false;
  }
}

function buildProxyUrl(remoteUrl: string, filename: string): string {
  const params = new URLSearchParams({
    url: remoteUrl,
    filename: filename.endsWith(".mp4") ? filename : `${filename}.mp4`,
  });
  return `/api/download?${params.toString()}`;
}

export function triggerDownload(url: string, filename: string): void {
  if (!url) return;
  const href = isSameOrigin(url) ? url : buildProxyUrl(url, filename);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename.endsWith(".mp4") ? filename : `${filename}.mp4`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
