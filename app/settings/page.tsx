"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useRequireAccess } from "@/lib/firebase/useRequireAccess";

// Account basics only, per the current scope — name, email, sign out,
// delete account. Plan/billing stays its own page (/billing), reached
// from the sidebar's plan link, same as before.
export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { ready } = useRequireAccess();
  const router = useRouter();

  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeleteAccount() {
    if (!user) return;
    setDeleting(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't delete your account.");
      await signOut();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setDeleting(false);
    }
  }

  if (!ready) {
    return <div className="min-h-screen bg-paper" />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-paper text-slate font-body">
      <div className="flex-grow flex flex-col md:flex-row min-h-0">
        <Sidebar active="settings" />

        <main className="flex-grow min-w-0 min-h-0 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 flex flex-col gap-8 pb-24 md:pb-10 max-w-xl">
          <div className="flex flex-col gap-1.5">
            <h1 className="font-display text-[28px] sm:text-[34px] font-semibold tracking-tight">
              Settings
            </h1>
            <p className="text-sm text-muted">Your account, in one place.</p>
          </div>

          {!user ? (
            <div className="px-4 py-4 text-sm text-muted border border-line rounded-2xl">
              Sign in to see your account.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-line divide-y divide-line overflow-hidden">
                <SettingsRow label="Name" value={user.displayName || "—"} />
                <SettingsRow label="Email" value={user.email || "—"} />
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="text-sm font-semibold">Account</h2>
                <button
                  onClick={() => signOut()}
                  className="self-start min-h-10 px-4 rounded-[10px] border border-line bg-paper text-sm font-semibold hover:bg-ivory"
                >
                  Sign out
                </button>
              </section>

              <section className="flex flex-col gap-3 pt-2">
                <h2 className="text-sm font-semibold text-dangerFg">Delete account</h2>
                <p className="text-sm text-muted leading-relaxed">
                  Permanently deletes your campaigns, offers, and saved copy. This
                  can&apos;t be undone. If you&apos;re on a paid plan, cancel it in{" "}
                  <a href="/billing" className="text-clay font-semibold">
                    Billing
                  </a>{" "}
                  first. Deleting your account here doesn&apos;t cancel it.
                </p>

                <label className="flex flex-col gap-1.5 max-w-xs">
                  <span className="text-xs font-semibold text-faint">
                    Type DELETE to confirm
                  </span>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="h-11 border border-line rounded-[10px] px-3 text-sm bg-paper"
                  />
                </label>

                {error && <div className="text-xs text-dangerFg">{error}</div>}

                <button
                  onClick={handleDeleteAccount}
                  disabled={confirmText !== "DELETE" || deleting}
                  className="self-start min-h-10 px-4 rounded-[10px] bg-dangerFg text-white text-sm font-semibold disabled:opacity-40"
                >
                  {deleting ? "Deleting..." : "Delete my account"}
                </button>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5">
      <span className="text-xs font-semibold text-faint">{label}</span>
      <span className="text-[15px] font-medium">{value}</span>
    </div>
  );
}
