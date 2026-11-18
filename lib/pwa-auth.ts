// Keep the Safari/desktop Google popup flow intact. iOS Home Screen apps have
// separate browser storage, so their OAuth callback must stay on this origin.
export type BrowserAuthContext = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  navigatorStandalone?: boolean;
  displayModeStandalone: boolean;
  protocol: string;
  hostname: string;
};

export function sameOriginPwaAuthDomain(context: BrowserAuthContext, enabled: boolean): string | undefined {
  if (!enabled || context.protocol !== 'https:') return undefined;
  if (!context.displayModeStandalone && context.navigatorStandalone !== true) return undefined;
  const ios = /iPad|iPhone|iPod/i.test(context.userAgent) ||
    (context.platform === 'MacIntel' && (context.maxTouchPoints ?? 0) > 1);
  if (!ios) return undefined;

  // The domain is taken from the active site, not a query parameter or link.
  // Firebase must authorize this exact host before the PWA flow is enabled.
  const hostname = context.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(hostname)) return undefined;
  return hostname;
}

export function currentPwaAuthDomain(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const browser = window.navigator as Navigator & { standalone?: boolean };
  return sameOriginPwaAuthDomain({
    userAgent: browser.userAgent,
    platform: browser.platform,
    maxTouchPoints: browser.maxTouchPoints,
    navigatorStandalone: browser.standalone,
    displayModeStandalone: window.matchMedia?.('(display-mode: standalone)').matches ?? false,
    protocol: window.location.protocol,
    hostname: window.location.hostname,
  }, process.env.NEXT_PUBLIC_FIREBASE_PWA_REDIRECT === '1');
}

export function firebaseAuthHelperHost(raw: string | undefined): string | undefined {
  const host = raw?.trim().toLowerCase();
  // Never let a deployment environment turn this rewrite into a generic proxy.
  return host && /^[a-z0-9-]+\.firebaseapp\.com$/.test(host) ? host : undefined;
}
