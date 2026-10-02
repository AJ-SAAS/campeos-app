import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";

// "Dashboard: in the works" — from Main.dc.html. Campaign list and the
// "going out next" schedule are mock data for now; they'll come from
// Firestore once auth + persistence are wired up (CLAUDE.md build order,
// step 6).
const campaignTypes = [
  { title: "48 hour flash sale", length: "2 days", description: "Warm up, open the sale, then a last chance push." },
  { title: "Product launch", length: "2 weeks", description: "Build interest, open the cart, close it with a deadline." },
  { title: "Webinar promo", length: "1 week", description: "Get signups, remind them, and follow up after." },
  { title: "Holiday sale", length: "4 days", description: "A seasonal deal with a clear start and end." },
];

const campaigns = [
  { name: "Fall Reset 48hr Flash Sale", type: "48 hour flash sale", status: "draft" as const, dates: "Sep 24 to Sep 26", progress: 100, note: "13 written, 3 need details" },
  { name: "Fall Webinar Promo", type: "Webinar promo", status: "live" as const, dates: "Sep 15 to Sep 22", progress: 62, note: "Day 5 of 8" },
  { name: "[Course name] Launch", type: "Product launch", status: "scheduled" as const, dates: "Oct 5 to Oct 19", progress: 100, note: "22 of 22 steps ready" },
  { name: "Black Friday Sale", type: "Holiday sale", status: "draft" as const, dates: "Nov 27 to Nov 30", progress: 30, note: "3 of 10 steps written" },
];

const upcoming = [
  { day: "Today", title: "Save your seat", campaign: "Fall Webinar Promo", time: "6:00 PM" },
  { day: "Today", title: "Reminder ad turns on", campaign: "Fall Webinar Promo", time: "8:00 PM" },
  { day: "Sunday", title: "2 days to go", campaign: "Fall Webinar Promo", time: "9:00 AM" },
  { day: "Sunday", title: "Bring your questions", campaign: "Fall Webinar Promo", time: "5:00 PM" },
  { day: "Monday", title: "The webinar is tomorrow", campaign: "Fall Webinar Promo", time: "9:00 AM" },
];

export default function Dashboard() {
  let lastDay = "";

  return (
    <div className="min-h-screen flex bg-ivory text-slate font-body">
      <Sidebar active="dashboard" />

      <main className="flex-grow min-w-0 px-12 py-10 flex flex-col gap-8">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1.5">
            <div className="font-mono text-xs uppercase tracking-wider text-faint">
              Saturday, Sep 26
            </div>
            <h1 className="font-display text-[40px] leading-tight font-semibold tracking-tight">
              Your campaigns
            </h1>
          </div>
          <Link
            href="/builder"
            className="inline-flex items-center gap-2 h-12 px-5 rounded-xl bg-clay text-white text-[15px] font-semibold"
          >
            <PlusIcon /> New campaign
          </Link>
        </div>

        <section aria-label="Start a campaign" className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl font-semibold">Start a campaign</h2>
            <div className="text-sm text-faint">Pick a type. Add your offer. We build the rest.</div>
          </div>
          <div className="grid grid-cols-5 gap-4">
            {campaignTypes.map((t) => (
              <Link
                key={t.title}
                href="/builder"
                className="flex flex-col gap-3 p-[18px] bg-white border border-[#DDD6C5] rounded-2xl"
              >
                <div className="h-10" aria-hidden="true" />
                <div className="flex flex-col gap-1">
                  <div className="font-display text-[17px] font-semibold">{t.title}</div>
                  <div className="font-mono text-xs text-faint">{t.length}</div>
                </div>
                <div className="text-[13px] leading-relaxed text-[#4F4B42]">{t.description}</div>
              </Link>
            ))}
            <Link
              href="/builder"
              className="flex flex-col gap-3 p-[18px] border-[1.5px] border-dashed border-faint rounded-2xl"
            >
              <div className="h-10 flex items-center">
                <div className="w-8 h-8 rounded-full border-[1.5px] border-muted flex items-center justify-center">
                  <PlusIcon small />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="font-display text-[17px] font-semibold">Start from scratch</div>
                <div className="font-mono text-xs text-faint">Any length</div>
              </div>
              <div className="text-[13px] leading-relaxed text-[#4F4B42]">Pick your own steps and timing.</div>
            </Link>
          </div>
        </section>

        <section aria-label="Campaigns and schedule" className="grid grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          <div className="bg-white border border-[#DDD6C5] rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4.5 border-b border-line">
              <h2 className="font-display text-lg font-semibold">Recent campaigns</h2>
              <div className="flex gap-1">
                <FilterButton active>All</FilterButton>
                <FilterButton>Ready</FilterButton>
                <FilterButton>Drafts</FilterButton>
              </div>
            </div>

            <div className="grid grid-cols-[2.2fr_1fr_1.3fr_1.5fr] gap-4 px-5 py-2.5 font-mono text-[11px] uppercase tracking-wider text-faint bg-[#FAF7F0]">
              <div>Campaign</div>
              <div>Status</div>
              <div>Sale dates</div>
              <div>Progress</div>
            </div>

            {campaigns.map((c, i) => (
              <Link
                key={c.name}
                href="/builder"
                className={`grid grid-cols-[2.2fr_1fr_1.3fr_1.5fr] gap-4 items-center px-5 py-4 ${
                  i < campaigns.length - 1 ? "border-b border-[#EFE9DB]" : ""
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="text-[15px] font-semibold">{c.name}</div>
                  <div className="text-[13px] text-faint">{c.type}</div>
                </div>
                <div>
                  <StatusPill status={c.status} />
                </div>
                <div className="font-mono text-xs text-[#4F4B42]">{c.dates}</div>
                <div className="flex flex-col gap-1.5">
                  <div className="h-1.5 rounded-full bg-line">
                    <div
                      className={`h-full rounded-full ${progressColor(c.status)}`}
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-faint">{c.note}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="bg-white border border-[#DDD6C5] rounded-2xl overflow-hidden">
            <div className="px-5 py-4.5 border-b border-line">
              <h2 className="font-display text-lg font-semibold">Going out next</h2>
            </div>
            <div className="pb-1">
              {upcoming.map((item, i) => {
                const showDay = item.day !== lastDay;
                lastDay = item.day;
                return (
                  <div key={i}>
                    {showDay && (
                      <div className="px-5 pt-3.5 pb-1 font-mono text-[11px] uppercase tracking-wider text-faint">
                        {item.day}
                      </div>
                    )}
                    <div className="flex items-center gap-3 px-5 py-2.5">
                      <div className="w-9 h-9 rounded-[10px] bg-[#E4EDF8] flex items-center justify-center shrink-0">
                        <ChannelIcon />
                      </div>
                      <div className="flex-grow min-w-0 flex flex-col gap-0.5">
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="text-xs text-faint">{item.campaign}</div>
                      </div>
                      <div className="font-mono text-xs text-[#4F4B42]">{item.time}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusPill({ status }: { status: "draft" | "live" | "scheduled" }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DFF0E8] text-[#1B6B4F] text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1B6B4F]" />
        Live
      </span>
    );
  }
  if (status === "scheduled") {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#E4EDF8] text-[#1F5FA6] text-xs font-semibold">
        Scheduled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#ECE8DC] text-muted text-xs font-semibold">
      Draft
    </span>
  );
}

function progressColor(status: "draft" | "live" | "scheduled") {
  if (status === "live") return "bg-[#1B6B4F]";
  if (status === "scheduled") return "bg-[#1F5FA6]";
  return "bg-muted";
}

function FilterButton({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <button
      aria-pressed={!!active}
      className={`min-h-9 px-3 rounded-lg text-[13px] font-semibold ${
        active ? "bg-slate text-white" : "text-[#4F4B42] font-medium"
      }`}
    >
      {children}
    </button>
  );
}

function PlusIcon({ small }: { small?: boolean }) {
  const size = small ? 16 : 18;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ChannelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F5FA6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" />
    </svg>
  );
}
