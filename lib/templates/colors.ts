// One colour pair per campaign, used for its icon on the Campaigns page.
// Every campaign gets its own so the grid reads at a glance. The sales
// page (components/landing/LandingPage.jsx) uses the same pairs.
export const CAMPAIGN_COLORS: Record<string, [string, string]> = {
  "black-friday": ["#1F2937", "#7C3AED"],
  "cyber-monday": ["#0EA5E9", "#2563EB"],
  "holiday-sale": ["#EF4444", "#F97316"],
  "xmas-holidays": ["#16A34A", "#DC2626"],
  "valentines-day": ["#EC4899", "#F43F5E"],
  "flash-sale-48h": ["#F59E0B", "#EF4444"],
  "cart-close": ["#F97316", "#DB2777"],
  "cash-injection": ["#22C55E", "#0D9488"],
  "daily-deals": ["#EAB308", "#F97316"],
  webinar: ["#7C3AED", "#C026D3"],
  "social-blast-30": ["#D946EF", "#6366F1"],
  "app-launch-30": ["#3B82F6", "#06B6D4"],
  "product-launch": ["#6366F1", "#8B5CF6"],
  "mvp-launch": ["#14B8A6", "#3B82F6"],
  "mini-launch": ["#F43F5E", "#F59E0B"],
  "lead-magnet": ["#06B6D4", "#10B981"],
  giveaway: ["#F472B6", "#FBBF24"],
  "post-engagement": ["#A855F7", "#EC4899"],
  "ebook-low-ticket": ["#0891B2", "#4F46E5"],
  "physical-book-shipping": ["#B45309", "#F59E0B"],
  "book-a-call": ["#059669", "#84CC16"],
  "hand-raiser": ["#FB7185", "#E11D48"],
  "win-back": ["#8B5CF6", "#EC4899"],
  newsletter: ["#0EA5E9", "#6366F1"],
  "social-proof": ["#F59E0B", "#84CC16"],
  branding: ["#7C3AED", "#0EA5E9"],
  "audience-revival": ["#EA580C", "#FACC15"],
};

export function campaignGradient(id: string): string {
  const [a, b] = CAMPAIGN_COLORS[id] ?? ["#9B1FD6", "#E0109F"];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
