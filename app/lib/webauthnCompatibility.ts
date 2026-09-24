export interface WebAuthnCompatibility {
  browserName: "safari" | "chrome" | "edge" | "firefox" | "unknown";
  isSafari: boolean;
  isIOS: boolean;
  isSecureContext: boolean;
  isSupported: boolean;
  fallbackMessage: string | null;
}

function getBrowserName(userAgent: string): WebAuthnCompatibility["browserName"] {
  if (/Edg\//.test(userAgent)) return "edge";
  if (/Firefox\//.test(userAgent)) return "firefox";
  if (/Chrome\//.test(userAgent) && !/Chromium|OPR\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent) && !/Chrome|Chromium|Edg|OPR\//.test(userAgent)) return "safari";
  return "unknown";
}

export function getWebAuthnCompatibility(options: {
  userAgent?: string;
  webAuthnSupported?: boolean;
  secureContext?: boolean;
} = {}): WebAuthnCompatibility {
  const userAgent =
    options.userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const browserName = getBrowserName(userAgent);
  const isSafari = browserName === "safari";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isLocalhost =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const isSecureContext =
    options.secureContext ??
    (typeof window === "undefined" ? true : window.isSecureContext || isLocalhost);
  const webAuthnSupported =
    options.webAuthnSupported ??
    (typeof window !== "undefined" && "PublicKeyCredential" in window);
  const isSupported = webAuthnSupported && isSecureContext;

  let fallbackMessage: string | null = null;
  if (!webAuthnSupported) {
    fallbackMessage = "Passkeys are not supported in this browser. Use Chrome, Edge, Firefox, or Safari 17+.";
  } else if (!isSecureContext) {
    fallbackMessage = "Passkeys require HTTPS or localhost. Use a secure ClipCash URL before connecting a passkey wallet.";
  } else if (isSafari) {
    fallbackMessage = "Safari requires iCloud Keychain, Touch ID, Face ID, or a security key to be enabled for passkeys.";
  }

  return {
    browserName,
    isSafari,
    isIOS,
    isSecureContext,
    isSupported,
    fallbackMessage,
  };
}

export function isSafariUserAgent(userAgent: string | null): boolean {
  return getBrowserName(userAgent ?? "") === "safari";
}
