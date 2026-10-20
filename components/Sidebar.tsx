"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useSubscription } from "@/lib/firebase/useSubscription";
import { GetStartedWidget } from "@/components/GetStartedWidget";
import { getBusinessProfile, saveBusinessProfile } from "@/lib/firebase/businessProfile";
import { listOffers, Offer } from "@/lib/firebase/offers";

// The one sidebar for every signed-in page (approved "Campeos dashboard"
// design): logo, offer switcher, nav, and the person at the bottom, which
// opens Settings (billing and sign out live there now).
//
// Below md it becomes a top bar plus a bottom tab bar. The builder uses
// it too, with `inBuilder`: full width on wide screens, icons only
// between lg and xl, hidden below lg, no mobile bars (the builder has its
// own mobile header).

type Active = "dashboard" | "campaigns" | "offers" | "winning-copy" | "buyer-insights" | "settings" | null;

export function Sidebar({ active, inBuilder = false }: { active: Active; inBuilder?: boolean }) {
  const { user, loading, signIn } = useAuth();
  const { sub, loading: subLoading, active: subActive } = useSubscription();

  return (
    <>
      <aside
        className={`${
          inBuilder ? "hidden lg:flex lg:w-[72px] xl:w-[248px] group/side" : "hidden md:flex w-[248px]"
        } shrink-0 bg-paper border-r border-[#F0F0F0] text-slate flex-col px-4 py-6 gap-5 overflow-y-auto`}
        data-compact={inBuilder ? "lg" : undefined}
      >
        <Link href="/dashboard" className="px-1.5" aria-label="Campeos home">
          {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
          <img src="/logo-lockup.png" alt="Campeos" className={`h-[26px] w-auto object-contain ${inBuilder ? "hidden xl:block" : ""}`} />
          {inBuilder && (
            // eslint-disable-next-line @next/next/no-img-element -- local /public asset
            <img src="/logo-mark.png" alt="" className="xl:hidden w-9 h-9 object-contain -ml-1" />
          )}
        </Link>

        {user && (
          <div className={inBuilder ? "hidden xl:block" : ""}>
            <OfferSwitcher uid={user.uid} />
          </div>
        )}

        <nav aria-label="Main" className="flex flex-col gap-0.5">
          <NavItem href="/dashboard" label="Home" active={active === "dashboard"}><GridIcon /></NavItem>
          <NavItem href="/campaigns" label="Campaigns" active={active === "campaigns"}><CampaignsIcon /></NavItem>
          <NavItem href="/offers" label="Offers" active={active === "offers"}><OffersIcon /></NavItem>
          <NavItem href="/winning-copy" label="Winning copy" active={active === "winning-copy"}><TrophyIcon /></NavItem>
          <NavItem href="/buyer-insights" label="Buyer insights" active={active === "buyer-insights"}><BarsIcon /></NavItem>
          <NavItem href="/settings" label="Settings" active={active === "settings"}><GearIcon /></NavItem>
        </nav>

        <div className="flex-grow" />

        {loading ? null : user ? (
          <Link
            href="/settings"
            title="Your account"
            className="flex items-center gap-2.5 pt-3 px-1.5 border-t border-[#F0F0F0] rounded-none hover:opacity-80 group-data-[compact=lg]/side:max-xl:justify-center group-data-[compact=lg]/side:max-xl:px-0"
          >
            <Avatar photo={user.photoURL} name={user.displayName ?? user.email ?? ""} />
            <span className="flex-grow min-w-0 group-data-[compact=lg]/side:max-xl:hidden">
              <span className="block text-sm font-semibold truncate">{user.displayName ?? user.email}</span>
              {!subLoading && (
                <span className={`flex items-center gap-1.5 text-[13px] ${subActive ? "text-muted" : "text-clay font-semibold"}`}>
                  {subActive && <span className="w-1.5 h-1.5 rounded-full bg-lime" />}
                  {subActive ? `${sub?.plan === "pro" ? "Pro" : "Starter"} plan` : "No plan · Pick one"}
                </span>
              )}
            </span>
          </Link>
        ) : (
          <button
            onClick={() => signIn().catch(() => {})}
            className="w-full min-h-11 rounded-xl bg-slate text-white text-sm font-semibold"
          >
            Sign in
          </button>
        )}
      </aside>

      {!inBuilder && (
        <>
          {user && <GetStartedWidget />}
          <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-[#F0F0F0] bg-paper">
            <Link href="/dashboard" aria-label="Campeos home">
              {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
              <img src="/logo-lockup.png" alt="Campeos" className="h-6 w-auto object-contain" />
            </Link>
            {user && (
              <Link href="/settings" aria-label="Settings" className="w-10 h-10 flex items-center justify-center text-muted">
                <Avatar photo={user.photoURL} name={user.displayName ?? user.email ?? ""} small />
              </Link>
            )}
          </header>
          <nav
            aria-label="Main"
            className="md:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch justify-around h-16 bg-paper border-t border-[#F0F0F0] pb-[env(safe-area-inset-bottom)]"
          >
            <MobileNavItem href="/dashboard" label="Home" active={active === "dashboard"}><GridIcon /></MobileNavItem>
            <MobileNavItem href="/campaigns" label="Campaigns" active={active === "campaigns"}><CampaignsIcon /></MobileNavItem>
            <MobileNavItem href="/offers" label="Offers" active={active === "offers"}><OffersIcon /></MobileNavItem>
            <MobileNavItem href="/winning-copy" label="Winners" active={active === "winning-copy"}><TrophyIcon /></MobileNavItem>
            <MobileNavItem href="/buyer-insights" label="Insights" active={active === "buyer-insights"}><BarsIcon /></MobileNavItem>
          </nav>
        </>
      )}
    </>
  );
}

/**
 * Shows the offer the agent works from (businessProfiles/{uid}) and lets
 * you switch to another saved offer. Switching updates the business
 * profile, which is what the agent reads as "what I already know".
 */
function OfferSwitcher({ uid }: { uid: string }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getBusinessProfile(uid).then((p) => setCurrent(p?.name || null)).catch(() => {});
    listOffers(uid).then(setOffers).catch(() => {});
  }, [uid]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function pick(o: Offer) {
    setOpen(false);
    setCurrent(o.name);
    await saveBusinessProfile(uid, {
      name: o.name,
      price: o.price,
      audience: o.audience,
      whatTheyGet: o.whatTheyGet,
      tone: o.tone,
      readingLevel: o.readingLevel,
      fromName: o.fromName ?? "",
    }).catch(() => {});
  }

  const label = current || "Add your offer";
  const initial = current ? current.trim().slice(0, 1).toUpperCase() : "+";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-full flex items-center gap-2.5 min-h-12 px-2.5 py-2 rounded-xl border border-[#ECEAF0] bg-paper text-left hover:bg-[#FAFAFA]"
      >
        <span className="shrink-0 w-7 h-7 rounded-lg bg-[#F3EEFF] text-[#5B21B6] text-xs font-bold flex items-center justify-center">
          {initial}
        </span>
        <span className="flex-grow min-w-0 text-sm font-semibold truncate">{label}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B6577" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div role="menu" className="absolute z-40 left-0 right-0 mt-1.5 p-1.5 rounded-xl border border-[#ECEAF0] bg-paper shadow-[0_20px_40px_-20px_rgba(23,19,31,.35)] animate-step-in">
          {offers.length > 0 && (
            <div className="px-2.5 pt-1.5 pb-1 font-mono text-[10px] uppercase tracking-wider text-faint">Your offers</div>
          )}
          {offers.map((o) => (
            <button
              key={o.id}
              role="menuitem"
              onClick={() => pick(o)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm hover:bg-[#F5F5F5]"
            >
              <span className="flex-grow truncate">{o.name}</span>
              {o.name === current && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12l5 5 9-10" />
                </svg>
              )}
            </button>
          ))}
          <Link role="menuitem" href="/offers" className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-semibold text-clay hover:bg-[#F5F5F5]">
            + New offer
          </Link>
        </div>
      )}
    </div>
  );
}

function Avatar({ photo, name, small }: { photo: string | null; name: string; small?: boolean }) {
  const size = small ? "w-8 h-8 text-[11px]" : "w-9 h-9 text-[13px]";
  const initials = name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${size} shrink-0 rounded-full flex items-center justify-center text-white font-bold`}
      style={{ background: "linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)" }}
    >
      {initials || "?"}
    </span>
  );
}

function NavItem({ href, label, active, children }: { href: string; label: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      title={label}
      className={`flex items-center gap-3 min-h-11 px-3 rounded-[10px] text-[15px] group-data-[compact=lg]/side:max-xl:justify-center group-data-[compact=lg]/side:max-xl:px-0 ${
        active ? "bg-[#F5F5F5] text-slate font-semibold" : "text-[#5B5566] hover:bg-[#FAFAFA] hover:text-slate"
      }`}
    >
      <span className="shrink-0">{children}</span>
      <span className="group-data-[compact=lg]/side:max-xl:hidden">{label}</span>
    </Link>
  );
}

function MobileNavItem({ href, label, active, children }: { href: string; label: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${active ? "text-slate" : "text-faint"}`}
    >
      {children}
      {label}
    </Link>
  );
}

const ICON = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function GridIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" />
    </svg>
  );
}
function CampaignsIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="12" r="2.5" /><circle cx="6" cy="18" r="2.5" />
      <path d="M8.5 6H12a3 3 0 0 1 3 3v.5M8.5 18H12a3 3 0 0 0 3-3v-.5" />
    </svg>
  );
}
function OffersIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M20 12l-8 8-8-8V4h8z" /><circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  );
}
function TrophyIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M12 13v4M8 20h8" />
    </svg>
  );
}
function BarsIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" />
    </svg>
  );
}
function GearIcon() {
  return (
    <svg {...ICON} aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}
