export const dynamic = "force-dynamic";

// TEMPORARY — delete this route once the Sentry integration is confirmed
// working in production. Visiting this URL deliberately throws so you
// can check it shows up in Sentry's Issues dashboard within a few
// seconds. Safe: it does nothing but throw, no side effects, not linked
// from anywhere in the app.
export async function GET() {
  throw new Error("Campeos Sentry test — confirms production error reporting is wired up correctly. Safe to trigger, safe to delete this route after confirming.");
}
