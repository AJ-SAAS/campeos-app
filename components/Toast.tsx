"use client";

// A small pill at the bottom of the screen that confirms something happened.
// The page that shows it decides when it goes away (see useToast).

export interface ToastMessage {
  text: string;
  tone: "ok" | "error";
}

export function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;
  const ok = toast.tone === "ok";
  return (
    <div
      role="status"
      aria-live="polite"
      className="toast-in fixed left-1/2 bottom-24 md:bottom-6 z-[70] flex items-center gap-2.5 max-w-[92vw] rounded-full bg-slate text-white pl-2.5 pr-4 py-2.5 shadow-[0_18px_40px_-12px_rgba(19,23,26,0.5)]"
    >
      <span
        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${ok ? "bg-[#22C55E]" : "bg-[#EF4444]"}`}
        aria-hidden="true"
      >
        {ok ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        )}
      </span>
      <span className="text-[14px] font-semibold truncate">{toast.text}</span>
    </div>
  );
}
