"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";

// Light, hairline-bordered nav — Cloudflare's own left nav is a quiet
// white column, not a dark slab, so this moved off bg-slate entirely.
// Collapses to a bottom tab bar below md: a fixed sidebar column doesn't
// fit a phone screen, and a hamburger drawer hides navigation behind an
// extra tap for what's only four destinations — a bottom bar keeps them
// one tap away, which is the standard mobile pattern for this count.
export function Sidebar({ active }: { active: "dashboard" | "campaigns" }) {
  const { user, loading, signIn, signOut } = useAuth();
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
      <aside className="hidden md:flex w-60 shrink-0 bg-paper border-r border-line text-slate flex-col p-4 gap-7">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-clay to-pink flex items-center justify-center">
            <LogoMark />
          </div>
          <div className="font-display text-xl font-semibold tracking-tight">
            Campeos
          </div>
        </div>

        <nav aria-label="Main" className="flex flex-col gap-1">
          <NavItem href="/dashboard" label="Dashboard" active={active === "dashboard"}>
            <GridIcon />
          </NavItem>
          <NavItem href="/builder" label="Campaigns" active={active === "campaigns"}>
            <CampaignsIcon />
          </NavItem>
          <NavItem href="#" label="Winning copy">
            <TrophyIcon />
          </NavItem>
          <NavItem href="#" label="Buyer insights">
            <BarsIcon />
          </NavItem>
        </nav>

        <div className="flex-grow" />

        <div className="flex items-center gap-2.5 px-2 py-2.5 border-t border-line">
          {loading ? (
            <div className="text-sm text-muted">Loading...</div>
          ) : user ? (
            <>
              <div className="w-9 h-9 rounded-full bg-ivory flex items-center justify-center overflow-hidden shrink-0">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  <PersonIcon />
                )}
              </div>
              <div className="flex-grow min-w-0 text-sm font-medium truncate">
                {user.displayName ?? user.email}
              </div>
              <button
                onClick={() => signOut()}
                className="text-xs text-muted font-medium shrink-0"
              >
                Sign out
              </button>
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
      <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-line bg-paper">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[8px] bg-gradient-to-br from-clay to-pink flex items-center justify-center">
            <LogoMark small />
          </div>
          <span className="font-display text-base font-semibold tracking-tight">Campeos</span>
        </div>
        {!loading && (
          user ? (
            <button onClick={() => signOut()} className="text-xs text-muted font-medium">
              Sign out
            </button>
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
        <MobileNavItem href="/builder" label="Campaigns" active={active === "campaigns"}>
          <CampaignsIcon />
        </MobileNavItem>
        <MobileNavItem href="#" label="Winning copy">
          <TrophyIcon />
        </MobileNavItem>
        <MobileNavItem href="#" label="Insights">
          <BarsIcon />
        </MobileNavItem>
      </nav>
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
      className={`flex items-center gap-3 min-h-11 px-3 rounded-[10px] text-sm ${
        active
          ? "bg-ivory text-slate font-semibold"
          : "text-muted font-medium hover:bg-ivory"
      }`}
    >
      {children}
      {label}
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

function LogoMark({ small }: { small?: boolean }) {
  const size = small ? 16 : 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="12" r="2" />
      <path d="M7 6h4c3 0 4 2 4 4M7 18h4c3 0 4-2 4-4" />
    </svg>
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
function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A9089" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </svg>
  );
}
