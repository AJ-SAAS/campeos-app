import { META_PIXEL_ID } from "./config";
import { buildPurchaseEvent } from "./payload";

// Sends one event to Meta's Conversions API. Server only: the token never
// reaches the browser. Returns instead of throwing, because a Meta outage
// must never get in the way of a paying customer.

const GRAPH = "https://graph.facebook.com/v21.0";

export async function sendEventToMeta(event: ReturnType<typeof buildPurchaseEvent>): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.META_CAPI_TOKEN;
  if (!token) return { ok: false, error: "META_CAPI_TOKEN is not set." };

  const body: Record<string, unknown> = { data: [event] };
  const testCode = process.env.META_TEST_EVENT_CODE;
  if (testCode) body.test_event_code = testCode;

  try {
    const res = await fetch(`${GRAPH}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Meta ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Meta request failed." };
  }
}
