// Where the floating Eos button shows. Signed-in app pages only. Left out:
// Settings, sign-in, onboarding, the marketing and legal pages, and the
// Campaign Builder (which mounts its own, so Eos can edit the open campaign).

const SHOW_ON = ["/dashboard", "/campaigns", "/offers", "/buyer-insights", "/winning-copy", "/billing", "/daily"];

const matches = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + "/");

/** True when the global floating Eos belongs on this page. */
export function showsFloatingAgent(pathname: string | null): boolean {
  if (!pathname) return false;
  return SHOW_ON.some((p) => matches(pathname, p));
}

/** Eos opens by itself on Home, and stays closed everywhere else. */
export function opensAutomatically(pathname: string | null): boolean {
  return pathname === "/dashboard";
}
