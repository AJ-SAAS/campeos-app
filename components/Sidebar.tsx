"use client";

import Link from "next/link";
import { useAuth } from "@/lib/firebase/AuthProvider";

// Matches the dark left sidebar in Start.dc.html / Main.dc.html.
// "active" picks which nav item is highlighted.
export function Sidebar({ active }: { active: "dashboard" | "campaigns" }) {
  const { user, loading, signIn, signOut } = useAuth();

  return (
    <aside className="w-60 shrink-0 bg-slate text-ivory flex flex-col p-4 gap-7">
      <div className="flex items-center gap-2.5 px-1">
        <div className="w-9 h-9 rounded-[10px] bg-clay flex items-center justify-center">
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

      <div className="flex items-center gap-2.5 px-2 py-2.5 border-t border-[#33312B]">
        {loading ? (
          <div className="text-sm text-[#CFCABB]">Loading...</div>
        ) : user ? (
          <>
            <div className="w-9 h-9 rounded-full bg-[#2E2C27] flex items-center justify-center overflow-hidden shrink-0">
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
              className="text-xs text-[#CFCABB] font-medium shrink-0"
            >
              Sign out
            </button>
          </>
        ) : (
          <button
            onClick={() => signIn()}
            className="w-full flex items-center justify-center gap-2 min-h-11 rounded-[10px] bg-[#2E2C27] text-sm font-semibold"
          >
            Sign in with Google
          </button>
        )}
      </div>
    </aside>
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
          ? "bg-[#2E2C27] text-white font-semibold"
          : "text-[#CFCABB] font-medium hover:bg-[#2E2C27]/60"
      }`}
    >
      {children}
      {label}
    </Link>
  );
}

function LogoMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CFCABB" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
    </svg>
  );
}
