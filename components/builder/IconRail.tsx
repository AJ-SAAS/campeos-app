import Link from "next/link";

// The narrow icon-only nav on the left of the Campaign Builder. Light
// theme to match the rest of the redesign (was a dark slab). Hidden
// below lg — on a phone, someone deep in building one campaign doesn't
// need the full nav rail; the builder page's own mobile header carries
// a back-to-dashboard link instead, which is what they actually need.
export function IconRail() {
  return (
    <nav aria-label="Main" className="hidden lg:flex w-[72px] shrink-0 bg-paper border-r border-line flex-col items-center py-3.5 gap-1.5">
      <Link href="/dashboard" aria-label="Campeos home" className="mb-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
        <img src="/logo-mark.png" alt="" className="w-9 h-9 rounded-[10px] object-contain" />
      </Link>
      <RailIcon href="/dashboard" label="Dashboard">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </RailIcon>
      <RailIcon href="/builder" label="Campaigns" active>
        <circle cx="5" cy="6" r="2" /><circle cx="5" cy="18" r="2" /><circle cx="19" cy="12" r="2" />
        <path d="M7 6h4c3 0 4 2 4 4M7 18h4c3 0 4-2 4-4" />
      </RailIcon>
      <RailIcon href="/winning-copy" label="Winning copy">
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8" />
      </RailIcon>
      <RailIcon href="/buyer-insights" label="Buyer insights">
        <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />
      </RailIcon>
    </nav>
  );
}

function RailIcon({
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
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`w-11 h-11 rounded-xl flex items-center justify-center ${
        active ? "bg-ivory text-clay" : "text-faint hover:bg-ivory"
      }`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </Link>
  );
}
