import { redirect } from "next/navigation";

// The root URL used to be a separate "day one" onboarding screen
// (Start.dc.html) with no agent on it, while /dashboard had the real
// agent panel — two different home experiences, confusing to land on
// the wrong one. The dashboard is the one true home now. This is a
// server-side redirect, so it happens before anything renders.
//
// The old onboarding screen's "Learn my site" field was never wired to
// a real crawler anyway (see the dashboard's agent, which actually
// works). If a dedicated first-time-user onboarding flow gets built
// later, it belongs inside the agent conversation itself, not as a
// second, separate page.
export default function Home() {
  redirect("/dashboard");
}
