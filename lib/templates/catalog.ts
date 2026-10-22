// The full list of campaign "pockets" Campeos offers, for the /campaigns
// gallery card grid. This is display metadata only (title, description,
// grouping) — it's separate from the actual CampaignTemplate content in
// templates (see ./index.ts). A catalog entry can exist with
// `status: "soon"` long before its real template is written, so the
// gallery can show the full lineup while content gets filled in
// incrementally, same pattern as the dashboard's old placeholder pills.
//
// To make a "soon" campaign real: write lib/templates/<id>.ts (same id
// as its catalog entry), register it in ./index.ts's `templates` map,
// then flip this entry's status to "available". Nothing else changes —
// the gallery, the builder, and the saved-campaign lookup all key off
// this `id`.

// Categories are grouped by what the campaign is FOR — the decision a
// marketer is actually making ("I'm near a holiday," "I need cash fast,"
// "I'm launching something") — not an arbitrary core/extra/additional
// split (that's what this replaced; see the campaigns-mockup canvas for
// the mockup this was validated against).
export type CampaignCategory =
  | "seasonal"
  | "flash"
  | "launches"
  | "leadgen"
  | "highticket"
  | "retention";

export interface CatalogEntry {
  id: string;
  title: string;
  /** Rough campaign length shown on the card, e.g. "2 days", "Ongoing". */
  length: string;
  description: string;
  category: CampaignCategory;
  status: "available" | "soon";
}

export const categoryLabels: Record<CampaignCategory, string> = {
  seasonal: "Seasonal sales",
  flash: "Flash & urgency sales",
  launches: "Launches",
  leadgen: "Lead generation",
  highticket: "Sales calls & high-ticket",
  retention: "Retention & trust",
};

/** Display order for the /campaigns gallery sections. */
export const categoryOrder: CampaignCategory[] = [
  "seasonal",
  "flash",
  "launches",
  "leadgen",
  "highticket",
  "retention",
];

export const catalog: CatalogEntry[] = [
  // Seasonal sales
  {
    id: "black-friday",
    title: "Black Friday",
    length: "16 days",
    description: "Build trust and a waitlist, early access for the list, then a hard countdown to the deal.",
    category: "seasonal",
    status: "available",
  },
  {
    id: "cyber-monday",
    title: "Cyber Monday",
    length: "1 day",
    description: "A single hard-deadline push the Monday after Black Friday.",
    category: "seasonal",
    status: "available",
  },
  {
    id: "holiday-sale",
    title: "Holiday Sale",
    length: "4 days",
    description: "A seasonal deal with a clear start and end.",
    category: "seasonal",
    status: "available",
  },
  {
    id: "xmas-holidays",
    title: "Xmas Holidays Campaign",
    length: "1 week",
    description: "A festive seasonal push around Christmas.",
    category: "seasonal",
    status: "available",
  },
  {
    id: "valentines-day",
    title: "Valentine's Day Campaign",
    length: "1 week",
    description: "A seasonal push built around Valentine's Day.",
    category: "seasonal",
    status: "available",
  },

  // Flash & urgency sales
  {
    id: "flash-sale-48h",
    title: "48 Hour Flash Sale",
    length: "2 days",
    description: "Warm up, open the sale, then a last chance push.",
    category: "flash",
    status: "available",
  },
  {
    id: "cart-close",
    title: "Cart Close",
    length: "3 days",
    description: "The final push before your cart shuts for good.",
    category: "flash",
    status: "available",
  },
  {
    id: "cash-injection",
    title: "Cash Injection Campaign",
    length: "2 days",
    description: "A fast, short sale for when you need revenue now.",
    category: "flash",
    status: "available",
  },
  {
    id: "daily-deals",
    title: "Daily Deals Campaign",
    length: "1 week",
    description: "A new deal each day to keep buyers coming back.",
    category: "flash",
    status: "available",
  },

  // Launches
  {
    id: "webinar",
    title: "Webinar Launch",
    length: "2-3 weeks",
    description: "Fill seats for a live webinar, then convert registrants after.",
    category: "launches",
    status: "available",
  },
  {
    id: "social-blast-30",
    title: "30 Day Social Media Blast",
    length: "30 days",
    description: "A month of posts, videos and emails that build hype toward a big day you pick.",
    category: "launches",
    status: "available",
  },
  {
    id: "app-launch-30",
    title: "30 Day App Go-To-Market",
    length: "30 days",
    description: "Write your App Store listing, build a list, launch around day 14, then keep momentum.",
    category: "launches",
    status: "available",
  },
  {
    id: "product-launch",
    title: "Product Launch",
    length: "3 weeks",
    description: "Build interest, open the cart, close it with a deadline.",
    category: "launches",
    status: "available",
  },
  {
    id: "mvp-launch",
    title: "MVP Launch Campaign",
    length: "1 week",
    description: "Get early users onto a brand-new product.",
    category: "launches",
    status: "soon",
  },
  {
    id: "mini-launch",
    title: "Mini-Launch Campaign",
    length: "3 days",
    description: "A quick, low-lift launch for a small offer.",
    category: "launches",
    status: "available",
  },

  // Lead generation
  {
    id: "lead-magnet",
    title: "Lead Magnet Campaign",
    length: "2 weeks",
    description: "Turn a free resource into a steady stream of leads.",
    category: "leadgen",
    status: "available",
  },
  {
    id: "giveaway",
    title: "Giveaway Campaign",
    length: "1 week",
    description: "Grow your list fast with a giveaway or contest.",
    category: "leadgen",
    status: "available",
  },
  {
    id: "post-engagement",
    title: "Post Engagement Campaign",
    length: "3 days",
    description: "Turn a viral or high-reach post into leads.",
    category: "leadgen",
    status: "soon",
  },
  {
    id: "ebook-low-ticket",
    title: "Ebook Campaign",
    length: "1 week",
    description: "Sell a low-ticket ebook or guide straight through.",
    category: "leadgen",
    status: "available",
  },
  {
    id: "physical-book-shipping",
    title: "Physical Book + Free Shipping",
    length: "1 week",
    description: "Sell a free-plus-shipping book offer.",
    category: "leadgen",
    status: "soon",
  },

  // Sales calls & high-ticket
  {
    id: "book-a-call",
    title: "Book a Call Campaign",
    length: "1 week",
    description: "Fill your calendar with qualified sales calls.",
    category: "highticket",
    status: "available",
  },
  {
    id: "hand-raiser",
    title: "Hand-Raiser Campaign",
    length: "1 week",
    description: "Find your hottest leads before you pitch them.",
    category: "highticket",
    status: "available",
  },

  // Retention & trust
  {
    id: "win-back",
    title: "Win-Back",
    length: "1 week",
    description: "Re-engage past customers or leads who went cold.",
    category: "retention",
    status: "available",
  },
  {
    id: "newsletter",
    title: "Newsletter Campaign",
    length: "Ongoing",
    description: "A recurring send that keeps your list warm.",
    category: "retention",
    status: "soon",
  },
  {
    id: "social-proof",
    title: "Social Proof Campaign",
    length: "1 week",
    description: "Lead with testimonials and results to build trust.",
    category: "retention",
    status: "soon",
  },
  {
    id: "branding",
    title: "Branding Campaign",
    length: "2 weeks",
    description: "Build awareness and recognition, not an immediate sale.",
    category: "retention",
    status: "soon",
  },
];
