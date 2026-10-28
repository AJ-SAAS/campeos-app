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

/** Where we remember, in this browser, that Eos has already opened by
 * itself for this person. */
export const AUTO_OPEN_KEY = "campeos:eos-opened";

/** Eos opens by itself once, the first time someone lands on Home. After
 * that it stays closed until they open it. No saved note (or no storage to
 * keep one) means "don't": better silent than popping up every visit. */
export function shouldAutoOpen(storedFlag: string | null, canRemember: boolean): boolean {
  return canRemember && !storedFlag;
}

/** Eos opens by itself on Home, and stays closed everywhere else. */
export function opensAutomatically(pathname: string | null): boolean {
  return pathname === "/dashboard";
}
