"use client";

import { LoadingScreen } from "@/components/LoadingScreen";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Sidebar } from "@/components/Sidebar";
import { PlanModal, usePlanSuggestion } from "@/components/PlanModal";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";
import { useSubscription } from "@/lib/firebase/useSubscription";
import { authFetch } from "@/lib/firebase/authFetch";
import { BusinessProfile, getBusinessProfile, saveBusinessProfile } from "@/lib/firebase/businessProfile";
import { FREQUENCIES, PLATFORMS, PlatformId, suggestedPlan } from "@/lib/onboarding/answers";
import { firstName } from "@/lib/signOff";

// Settings: everything about the account in one place. You, your plan
// and billing (Stripe's portal for card, invoices and cancelling), your
// business (the offer the agent knows, where you reach customers, how
// often you launch), sign out, and deleting the account.

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { ready } = useRequireAccess();
  const { sub, loading: subLoading, active } = useSubscription();
  const { plan: fit } = usePlanSuggestion();
  const router = useRouter();

  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [portalPending, setPortalPending] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [signOffDraft, setSignOffDraft] = useState("");

  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getBusinessProfile(user.uid)
      .then((p) => {
        setProfile(p);
        setSignOffDraft(p?.signOffName ?? "");
      })
      .catch(() => {});
  }, [user]);

  async function openPortal() {
    setBillingError(null);
    setPortalPending(true);
    try {
      const res = await authFetch("/api/stripe/portal", { method: "POST", body: "{}" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't open billing.");
      window.location.href = data.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Couldn't open billing.");
      setPortalPending(false);
    }
  }

  async function update(fields: Partial<BusinessProfile>, note: string) {
    if (!user || !profile) return;
    const next = { ...profile, ...fields };
    setProfile(next);
    try {
      await saveBusinessProfile(user.uid, {
        name: next.name,
        price: next.price,
        audience: next.audience,
        whatTheyGet: next.whatTheyGet,
        tone: next.tone,
        channels: next.channels,
        frequency: next.frequency,
        signOffName: next.signOffName,
        suggestedPlan: next.frequency ? suggestedPlan(next.frequency) : next.suggestedPlan,
      });
      setSaved(note);
      setTimeout(() => setSaved((s) => (s === note ? null : s)), 1800);
    } catch {
      setSaved("Couldn't save that. Try again.");
    }
  }

  function toggleChannel(id: PlatformId) {
    const current: string[] = profile?.channels?.length ? profile.channels : PLATFORMS.map((p) => p.id);
    const next = current.includes(id) ? current.filter((c) => c !== id) : [...current, id];
    if (next.length === 0) return; // keep at least one
    update({ channels: next }, "Saved. New campaigns write for these.");
  }

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await authFetch("/api/account/delete", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete your account.");
      await signOut();
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  if (!ready) return <LoadingScreen />;

  const provider = user?.providerData?.[0]?.providerId === "google.com" ? "Google" : "email and password";
  const planName = sub?.plan === "pro" ? "Pro" : "Starter";
  const yearly = sub?.interval === "yearly";
  const planPrice = sub?.plan === "pro" ? (yearly ? "$83" : "$99") : yearly ? "$33" : "$39";
  // No answer saved (accounts from before onboarding) means "every
  // channel", which is what the builder does in that case too.
  const channels: string[] = profile?.channels?.length ? profile.channels : PLATFORMS.map((p) => p.id);

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        <Sidebar active="settings" />

        <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-7 sm:px-8 lg:px-14 lg:py-10 pb-28 md:pb-14">
          <div className="max-w-[760px] flex flex-col gap-6">
            <PageHeader title="Settings">Your account, your plan and your business, in one place.</PageHeader>

            {user && (
              <>
                {/* You */}
                <Card>
                  <div className="flex flex-wrap items-center gap-4">
                    {user.photoURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.photoURL} alt="" className="w-14 h-14 rounded-full object-cover" />
                    ) : (
                      <span
                        className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold"
                        style={{ background: "linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)" }}
                      >
                        {(user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <div className="flex-[1_1_220px] min-w-0">
                      <div className="text-[18px] font-semibold truncate">{user.displayName || user.email}</div>
                      {user.displayName && <div className="text-[15px] text-muted truncate">{user.email}</div>}
                      <div className="text-[13px] text-faint mt-0.5">Signs in with {provider}</div>
                    </div>
                    <button
                      onClick={() => signOut().then(() => router.push("/"))}
                      className="h-11 px-4 rounded-xl border border-[#E3E1E8] text-[15px] font-semibold hover:bg-[#FAFAFA] inline-flex items-center gap-2"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </Card>

                {/* Plan and billing */}
                <Card title="Plan and billing">
                  {subLoading ? (
                    <div className="h-20 rounded-xl bg-[#F8F8F8] animate-pulse" />
                  ) : active ? (
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-[1_1_240px] min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[20px] font-semibold">{planName} plan</span>
                          <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534] text-[11px] font-bold">Active</span>
                        </div>
                        <div className="text-[15px] text-muted mt-0.5">{planPrice} a month{yearly ? ", billed yearly" : ""}. Change your card, see invoices or cancel anytime.</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href="/billing" className="h-11 px-4 rounded-xl border border-[#E3E1E8] text-[15px] font-semibold hover:bg-[#FAFAFA] inline-flex items-center">
                          Compare plans
                        </Link>
                        <button
                          onClick={openPortal}
                          disabled={portalPending}
                          className="h-11 px-4 rounded-xl bg-slate text-white text-[15px] font-semibold disabled:opacity-60"
                        >
                          {portalPending ? "Opening..." : "Manage billing"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-[1_1_240px] min-w-0">
                        <div className="text-[20px] font-semibold">No plan yet</div>
                        <div className="text-[15px] text-muted mt-0.5">
                          {fit === "pro"
                            ? "Pro fits how you launch, at $99 a month."
                            : "Starter fits most launches, at $39 a month."}{" "}
                          Cancel anytime.
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href="/billing" className="h-11 px-4 rounded-xl border border-[#E3E1E8] text-[15px] font-semibold hover:bg-[#FAFAFA] inline-flex items-center">
                          Compare plans
                        </Link>
                        <button
                          onClick={() => setPlanOpen(true)}
                          className="h-11 px-4 rounded-xl text-white text-[15px] font-bold"
                          style={{ background: "linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)" }}
                        >
                          Pick a plan
                        </button>
                      </div>
                    </div>
                  )}
                  {billingError && <div className="mt-3 px-4 py-3 rounded-xl bg-warnBg text-warnFg text-sm">{billingError}</div>}
                </Card>

                {/* Your business */}
                {profile && (
                  <Card title="Your business" right={saved ? <span className="text-[13px] text-[#15803D] font-semibold">{saved}</span> : null}>
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-[#F8F8F8] border border-[#F0F0F0]">
                        <div className="flex-[1_1_240px] min-w-0">
                          <div className="font-mono text-[11px] uppercase tracking-wider text-muted">The offer your agent knows</div>
                          <div className="text-[16px] font-semibold mt-1 truncate">{profile.name || "No offer yet"}</div>
                          <div className="text-sm text-muted truncate">
                            {[profile.price, profile.audience].filter(Boolean).join(" · ") || "Add who it's for and the price"}
                          </div>
                        </div>
                        <Link href="/offers" className="h-10 px-4 rounded-xl border border-[#E3E1E8] bg-paper text-sm font-semibold inline-flex items-center hover:bg-[#FAFAFA]">
                          Edit offers
                        </Link>
                      </div>

                      <div>
                        <label htmlFor="signoff" className="block text-[15px] font-semibold">Your sign-off name</label>
                        <div className="text-sm text-muted mt-0.5">
                          How your emails are signed. Each offer can use its own name too, set on the Offers page.
                        </div>
                        <input
                          id="signoff"
                          value={signOffDraft}
                          onChange={(e) => setSignOffDraft(e.target.value)}
                          onBlur={() => {
                            const v = signOffDraft.trim();
                            if (v !== (profile.signOffName ?? "")) update({ signOffName: v }, "Saved.");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          placeholder={firstName(user.displayName) || "Your name"}
                          className="mt-3 w-full max-w-[360px] h-12 px-4 rounded-xl border border-[#D4D1DB] bg-paper text-[15px] focus:outline-none focus:border-[#9B1FD6] focus:shadow-[0_0_0_4px_rgba(155,31,214,.12)]"
                        />
                      </div>

                      <div>
                        <div className="text-[15px] font-semibold">Where you reach customers</div>
                        <div className="text-sm text-muted mt-0.5">New campaigns write for these.</div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                          {PLATFORMS.map((p) => {
                            const on = channels.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => toggleChannel(p.id)}
                                aria-pressed={on}
                                className={`flex items-center gap-2.5 h-12 px-3 rounded-xl text-sm font-semibold transition-colors ${
                                  on ? "border-[1.5px] border-slate bg-paper text-slate" : "border border-[#EEEEF1] bg-[#FAFAFA] text-muted"
                                }`}
                              >
                                {p.icon ? (
                                  // eslint-disable-next-line @next/next/no-img-element -- local /public asset
                                  <img src={p.icon} alt="" className={`w-5 h-5 object-contain ${on ? "" : "grayscale opacity-50"}`} />
                                ) : (
                                  <span className={`w-5 h-5 rounded-md bg-[#34C759] ${on ? "" : "grayscale opacity-50"}`} />
                                )}
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[15px] font-semibold">How often you run a sale</div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {FREQUENCIES.map((f) => {
                            const on = profile.frequency === f.id;
                            return (
                              <button
                                key={f.id}
                                onClick={() => update({ frequency: f.id }, "Saved.")}
                                aria-pressed={on}
                                className={`h-10 px-4 rounded-full text-sm font-semibold ${
                                  on ? "bg-slate text-white" : "border border-[#E3E1E8] text-slate hover:bg-[#FAFAFA]"
                                }`}
                              >
                                {f.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Delete account */}
                <Card>
                  {!showDelete ? (
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex-[1_1_240px]">
                        <div className="text-[15px] font-semibold">Delete account</div>
                        <div className="text-sm text-muted mt-0.5">Deletes your campaigns, offers and saved copy for good.</div>
                      </div>
                      <button onClick={() => setShowDelete(true)} className="h-10 px-4 rounded-xl border border-[#F5C2C0] text-dangerFg text-sm font-semibold hover:bg-[#FEF3F2]">
                        Delete account
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="text-[15px] font-semibold text-dangerFg">Delete your account?</div>
                      <p className="text-sm text-muted leading-relaxed">
                        This deletes your campaigns, offers and saved copy, and can&apos;t be undone.
                        {active && " It doesn't cancel your plan, so cancel it in Manage billing first."}
                      </p>
                      <label className="flex flex-col gap-1.5 max-w-xs">
                        <span className="text-xs font-semibold text-muted">Type DELETE to confirm</span>
                        <input
                          type="text"
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          className="h-11 border border-[#D4D1DB] rounded-xl px-3 text-sm bg-paper"
                        />
                      </label>
                      {deleteError && <div className="text-sm text-dangerFg">{deleteError}</div>}
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeleteAccount}
                          disabled={confirmText !== "DELETE" || deleting}
                          className="h-10 px-4 rounded-xl bg-dangerFg text-white text-sm font-semibold disabled:opacity-40"
                        >
                          {deleting ? "Deleting..." : "Delete my account"}
                        </button>
                        <button onClick={() => { setShowDelete(false); setConfirmText(""); }} className="h-10 px-4 rounded-xl border border-[#E3E1E8] text-sm font-semibold">
                          Keep my account
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
      <PlanModal open={planOpen} onClose={() => setPlanOpen(false)} />
    </div>
  );
}

function Card({ title, right, children }: { title?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] border border-[#ECEAF0] p-5 sm:p-6">
      {title && (
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
