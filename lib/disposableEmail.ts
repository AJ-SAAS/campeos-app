// Throwaway inboxes people use to farm free AI writing. Checked on the sign-up
// page (friendly message) and again on the server before any paid AI call
// (lib/serverAuth.ts), because the browser check alone can be skipped.
// Not exhaustive on purpose: the real defence is email verification. This
// just closes the cheapest, most common doors.
const DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz",
  "sharklasers.com", "grr.la", "10minutemail.com", "10minutemail.net", "20minutemail.com",
  "tempmail.com", "temp-mail.org", "temp-mail.io", "tempmail.net", "tempmailo.com", "tempail.com",
  "throwawaymail.com", "trashmail.com", "trashmail.net", "yopmail.com", "yopmail.net", "yopmail.fr",
  "getnada.com", "nada.email", "maildrop.cc", "dispostable.com", "fakeinbox.com", "mailnesia.com",
  "mintemail.com", "mohmal.com", "mytemp.email", "spamgourmet.com", "spam4.me", "emailondeck.com",
  "burnermail.io", "discard.email", "discardmail.com", "moakt.com", "inboxkitten.com", "mailcatch.com",
  "mail.tm", "emailfake.com", "fakemail.net", "tmail.ws", "tmpmail.org", "tmpmail.net", "owlymail.com",
  "33mail.com", "anonbox.net", "byom.de", "dropmail.me", "e4ward.com", "gettempmail.com",
  "harakirimail.com", "incognitomail.org", "jetable.org", "mailforspam.com", "mailnull.com",
  "mvrht.net", "my10minutemail.com", "mytrashmail.com", "nowmymail.com", "put2.net", "rmqkr.net",
  "spambox.us", "temporaryemail.net", "tempinbox.com", "trbvm.com", "wegwerfmail.de", "zetmail.com",
]);

export function isDisposableEmail(email: string | null | undefined): boolean {
  const domain = (email ?? "").trim().toLowerCase().split("@")[1];
  if (!domain) return false;
  if (DOMAINS.has(domain)) return true;
  // sub.mailinator.com and friends
  return [...DOMAINS].some((d) => domain.endsWith(`.${d}`));
}
