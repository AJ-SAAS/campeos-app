// Who may be tracked. Pure functions, so they are easy to test.
//
// United States: the Pixel is on until the person opts out (a notice plus
// an opt-out, which is how US privacy law works).
// Everywhere else (and when we cannot tell): the Pixel stays off until the
// person says yes.
//
// The choice lives in a first-party cookie, so the server can read it too.

export type Consent = "granted" | "denied" | null;

export const CONSENT_COOKIE = "cp_consent";
export const COUNTRY_COOKIE = "cp_country";
export const CONSENT_CHANGED_EVENT = "cp:consent-changed";

export function parseConsent(raw: string | null | undefined): Consent {
  return raw === "granted" || raw === "denied" ? raw : null;
}

/** Opt-out regions: US only for now. Unknown country counts as strict. */
export function isOptOutRegion(country: string | null | undefined): boolean {
  return (country ?? "").trim().toUpperCase() === "US";
}

/** May we load the Pixel and send ad events for this person? */
export function trackingAllowed(consent: Consent, country: string | null | undefined): boolean {
  if (consent === "denied") return false;
  if (consent === "granted") return true;
  return isOptOutRegion(country);
}

export function readCookie(name: string, cookieString: string): string | null {
  for (const part of cookieString.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
