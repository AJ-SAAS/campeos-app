"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useSubscription } from "@/lib/firebase/useSubscription";

// Light, hairline-bordered nav — Cloudflare's own left nav is a quiet
// white column, not a dark slab, so this moved off bg-slate entirely.
// Collapses to a bottom tab bar below md: a fixed sidebar column doesn't
// fit a phone screen, and a hamburger drawer hides navigation behind an
// extra tap for what's only four destinations — a bottom bar keeps them
// one tap away, which is the standard mobile pattern for this count.
//
// The builder uses this same sidebar (so the app feels like one app, not
// two), with `inBuilder`: full width on wide screens, icons only between
// lg and xl where the timeline needs the room, hidden below lg, and no
// mobile top/bottom bars (the builder has its own mobile header).
export function Sidebar({
  active,
  inBuilder = false,
}: {
  active: "dashboard" | "campaigns" | "offers" | "winning-copy" | "buyer-insights" | "settings" | null;
  inBuilder?: boolean;
}) {
  const { user, loading, signIn, signOut } = useAuth();
  const { sub, loading: subLoading, active: subActive } = useSubscription();
  const [authError, setAuthError] = useState<string | null>(null);

  async function handleSignIn() {
    setAuthError(null);
    try {
      await signIn();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed.");
    }
  }

  return (
    <>
      <aside
        className={`${
          inBuilder ? "hidden lg:flex lg:w-[72px] xl:w-60 group/side" : "hidden md:flex w-60"
        } shrink-0 bg-paper border-r border-line text-slate flex-col p-4 gap-7 overflow-y-auto`}
        data-compact={inBuilder ? "lg" : undefined}
      >
        <Link href="/dashboard" className="px-1" aria-label="Campeos home">
          {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
          <img
            src="/logo-lockup.png"
            alt="Campeos"
            className={`h-8 w-auto object-contain ${inBuilder ? "hidden xl:block" : ""}`}
          />
          {inBuilder && (
            // eslint-disable-next-line @next/next/no-img-element -- local /public asset
            <img src="/logo-mark.png" alt="" className="xl:hidden w-9 h-9 object-contain -ml-1" />
          )}
        </Link>

        <nav aria-label="Main" className="flex flex-col gap-1">
          <NavItem href="/dashboard" label="Dashboard" active={active === "dashboard"}>
            <GridIcon />
          </NavItem>
          <NavItem href="/campaigns" label="Campaigns" active={active === "campaigns"}>
            <CampaignsIcon />
          </NavItem>
          <NavItem href="/offers" label="Offers" active={active === "offers"}>
            <OffersIcon />
          </NavItem>
          <NavItem href="/winning-copy" label="Winning copy" active={active === "winning-copy"}>
            <TrophyIcon />
          </NavItem>
          <NavItem href="/buyer-insights" label="Buyer insights" active={active === "buyer-insights"}>
            <BarsIcon />
          </NavItem>
          <NavItem href="/settings" label="Settings" active={active === "settings"}>
            <GearIcon />
          </NavItem>
        </nav>

        <div className="flex-grow" />

        <div className={`flex flex-col gap-2 px-2 py-2.5 border-t border-line ${inBuilder ? "hidden xl:flex" : ""}`}>
          {loading ? (
            <div className="text-sm text-muted">Loading...</div>
          ) : user ? (
            <>
              {/* Name + plan on their own row, so they get the sidebar's
                  full width to truncate against instead of fighting
                  "Settings"/"Sign out" for space — that crowding used to
                  push the plan link onto a second line that visually ran
                  into the border below it. */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-ivory flex items-center justify-center overflow-hidden shrink-0">
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <PersonIcon />
                  )}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="text-sm font-medium truncate">{user.displayName ?? user.email}</div>
                  {!subLoading && (
                    <Link
                      href="/billing"
                      className={`text-xs truncate block ${subActive ? "text-muted" : "text-clay font-semibold"}`}
                    >
                      {subActive ? `${planLabel(sub?.plan)} plan` : "No plan · Pick one"}
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 pl-[46px]">
                <Link href="/billing" className="text-xs text-muted font-medium">
                  Billing
                </Link>
                <button onClick={() => signOut()} className="text-xs text-muted font-medium">
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex flex-col gap-1.5">
              <button
                onClick={handleSignIn}
                className="w-full flex items-center justify-center gap-2 min-h-11 rounded-[10px] bg-gradient-to-r from-clay to-pink text-white text-sm font-semibold"
              >
                Sign in with Google
              </button>
              {authError && (
                <div className="text-xs text-dangerFg leading-snug px-1">{authError}</div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar: logo + account, since the bottom bar below only
          has room for the four nav destinations. */}
      {!inBuilder && (
      <>
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-line bg-paper">
        <div className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
          <img src="/logo-lockup.png" alt="Campeos" className="h-8 w-auto object-contain" />
        </div>
        {!loading && (
          user ? (
            <div className="flex items-center gap-3">
              <Link href="/settings" aria-label="Settings" className="text-muted">
                <GearIcon />
              </Link>
              <button onClick={() => signOut()} className="text-xs text-muted font-medium">
                Sign out
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              className="text-xs font-semibold px-3 h-8 rounded-full bg-gradient-to-r from-clay to-pink text-white"
            >
              Sign in
            </button>
          )
        )}
      </header>

      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch justify-around h-16 bg-paper border-t border-line pb-[env(safe-area-inset-bottom)]"
      >
        <MobileNavItem href="/dashboard" label="Dashboard" active={active === "dashboard"}>
          <GridIcon />
        </MobileNavItem>
        <MobileNavItem href="/campaigns" label="Campaigns" active={active === "campaigns"}>
          <CampaignsIcon />
        </MobileNavItem>
        <MobileNavItem href="/offers" label="Offers" active={active === "offers"}>
          <OffersIcon />
        </MobileNavItem>
        <MobileNavItem href="/winning-copy" label="Winning copy" active={active === "winning-copy"}>
          <TrophyIcon />
        </MobileNavItem>
        <MobileNavItem href="/buyer-insights" label="Insights" active={active === "buyer-insights"}>
          <BarsIcon />
        </MobileNavItem>
      </nav>
      </>
      )}
    </>
  );
}

function NavItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`flex items-center gap-3 min-h-11 px-3 rounded-[10px] text-sm group-data-[compact=lg]/side:max-xl:justify-center group-data-[compact=lg]/side:max-xl:px-0 ${
        active
          ? "bg-ivory text-slate font-semibold"
          : "text-muted font-medium hover:bg-ivory"
      }`}
    >
      <span className="shrink-0">{children}</span>
      <span className="group-data-[compact=lg]/side:max-xl:hidden">{label}</span>
    </Link>
  );
}

function MobileNavItem({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${
        active ? "text-clay" : "text-faint"
      }`}
    >
      {children}
      {label}
    </Link>
  );
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function CampaignsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="12" r="2" />
      <path d="M7 6h4c3 0 4 2 4 4M7 18h4c3 0 4-2 4-4" />
    </svg>
  );
}
function OffersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 3 7v6c0 5 4 8.5 9 9 5-.5 9-4 9-9V7z" /><path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />
    </svg>
  );
}
function BarsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
    </svg>
  );
}
function planLabel(plan: "starter" | "pro" | null | undefined): string {
  if (plan === "starter") return "Starter";
  if (plan === "pro") return "Pro";
  return "";
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A9089" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </svg>
  );
}
