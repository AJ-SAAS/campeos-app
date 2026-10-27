"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Campaign } from "@/lib/firebase/campaigns";

// One older version of a campaign, with a delete that feels finished.
//
// Delete asks first, right in the row (no browser pop-up). On "Delete" the
// real deletion starts at once, and the row shows a green "Deleted" with a
// check that draws itself, then folds away. The page only drops the row
// after the fold, so a fast delete can't cut the animation short. If the
// delete fails, the row opens back up and the page says so.

const FLASH_MS = 750;
const FOLD_MS = 380;

type Phase = "idle" | "confirm" | "removing" | "folding";

export function OlderVersionRow({
  campaign,
  onDelete,
  onRemoved,
}: {
  campaign: Campaign;
  /** Deletes it for real. Resolves true when it worked. */
  onDelete: (c: Campaign) => Promise<boolean>;
  /** Called once the row has folded away and the delete worked. */
  onRemoved: (c: Campaign) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  async function confirmDelete() {
    setPhase("removing");
    const done = onDelete(campaign);
    await wait(FLASH_MS);
    if (!alive.current) return;
    setPhase("folding");
    await wait(FOLD_MS);
    if (!alive.current) return;
    if (await done) onRemoved(campaign);
    else if (alive.current) setPhase("idle");
  }

  const date = campaign.createdAt
    ? campaign.createdAt.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "older";
  const folded = phase === "folding";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: folded ? "0fr" : "1fr",
        opacity: folded ? 0 : 1,
        transition: `grid-template-rows ${FOLD_MS}ms cubic-bezier(.4,0,.2,1), opacity ${FOLD_MS * 0.8}ms ease`,
      }}
    >
      <div style={{ overflow: "hidden", minHeight: 0 }}>
        {phase === "removing" || phase === "folding" ? (
          <div
            className="flex items-center gap-3 pl-[50px] pr-[22px] py-2.5 text-sm font-semibold text-[#166534]"
            style={{ background: "#ECFDF3", animation: "del-flash .6s ease both" }}
            role="status"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="del-check-circle" cx="12" cy="12" r="11" fill="#22C55E" />
              <path className="del-check-path" d="M7 12.5l3.5 3.5L17 9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Deleted
          </div>
        ) : phase === "confirm" ? (
          <div className="flex items-center gap-3 pl-[50px] pr-[22px] py-2.5 bg-[#FEF2F2] text-sm">
            <span className="flex-grow min-w-0 truncate font-semibold text-[#991B1B]">
              Delete this version from {date}? This can&apos;t be undone.
            </span>
            <button
              onClick={() => setPhase("idle")}
              className="shrink-0 h-8 px-3 rounded-lg border border-[#ECEAF0] bg-paper text-xs font-semibold"
            >
              Keep
            </button>
            <button
              onClick={confirmDelete}
              className="shrink-0 h-8 px-3 rounded-lg bg-[#DC2626] text-white text-xs font-semibold hover:bg-[#B91C1C]"
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 pl-[50px] pr-[22px] py-2.5 bg-[#FAFAFA] text-sm">
            <Link href={`/builder?id=${campaign.id}`} className="flex-grow min-w-0 truncate hover:underline">
              {campaign.title}
              <span className="text-muted"> · {date}</span>
            </Link>
            <button
              onClick={() => setPhase("confirm")}
              className="shrink-0 h-8 px-3 rounded-lg border border-[#ECEAF0] bg-paper text-xs font-semibold text-dangerFg hover:border-dangerFg"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
