// Who emails are signed by. In order: the offer's own "Sign emails as"
// (each offer can have its own, e.g. an agency signing as each client),
// then the account default from Settings, then the first name on the
// login. Only ever a name the user gave or their account has: never an
// invented one, and never the full account name ("Grid King Moto").
export function firstName(displayName: string | null | undefined): string {
  return (displayName ?? "").trim().split(/\s+/)[0] ?? "";
}

export function resolveSignOff(
  offerFromName: string | null | undefined,
  defaultSignOff: string | null | undefined,
  displayName: string | null | undefined
): string | undefined {
  const pick = [offerFromName, defaultSignOff, firstName(displayName)].map((v) => (v ?? "").trim()).find(Boolean);
  return pick || undefined;
}
