// A small confetti burst for "Mark as winner". No packages: a few
// colored bits are made on the page, animated with the browser's own
// animate(), and removed when they finish. Skipped for anyone who has
// "reduce motion" turned on.

export interface ConfettiPiece {
  /** Where the piece ends up, in px from where it started. */
  dx: number;
  dy: number;
  /** Highest point it reaches on the way (negative = up). */
  rise: number;
  rotate: number;
  width: number;
  height: number;
  color: string;
  duration: number;
  round: boolean;
}

const COLORS = ["#F5B700", "#FF6B8B", "#7C5CFF", "#2BB673", "#3AA0FF", "#FF8A3D"];

/** Random pieces for one burst. `rand` is injectable so tests are stable. */
export function confettiPieces(count = 26, rand: () => number = Math.random): ConfettiPiece[] {
  return Array.from({ length: count }, () => {
    const angle = rand() * Math.PI * 2;
    const spread = 40 + rand() * 70;
    const size = 5 + rand() * 4;
    return {
      dx: Math.cos(angle) * spread,
      dy: 30 + rand() * 60, // they all end up falling a little
      rise: -(30 + rand() * 50),
      rotate: (rand() - 0.5) * 720,
      width: size,
      height: size * (rand() < 0.5 ? 1 : 0.6),
      color: COLORS[Math.floor(rand() * COLORS.length)],
      duration: 800 + rand() * 500,
      round: rand() < 0.3,
    };
  });
}

/** Bursts confetti from the middle of `origin` (usually the button that was clicked). */
export function burstConfetti(origin: HTMLElement | null): void {
  if (typeof window === "undefined" || typeof document === "undefined" || !origin) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (typeof origin.animate !== "function") return;

  const rect = origin.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden";
  document.body.appendChild(layer);

  const pieces = confettiPieces();
  let remaining = pieces.length;
  const cleanup = () => {
    remaining -= 1;
    if (remaining <= 0) layer.remove();
  };

  for (const p of pieces) {
    const el = document.createElement("span");
    el.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:${p.width}px;height:${p.height}px;background:${p.color};border-radius:${p.round ? "50%" : "1px"};will-change:transform,opacity`;
    layer.appendChild(el);
    const anim = el.animate(
      [
        { transform: "translate(-50%,-50%) rotate(0deg)", opacity: 1 },
        {
          transform: `translate(calc(-50% + ${p.dx * 0.6}px), calc(-50% + ${p.rise}px)) rotate(${p.rotate * 0.5}deg)`,
          opacity: 1,
          offset: 0.4,
        },
        {
          transform: `translate(calc(-50% + ${p.dx}px), calc(-50% + ${p.dy}px)) rotate(${p.rotate}deg)`,
          opacity: 0,
        },
      ],
      { duration: p.duration, easing: "cubic-bezier(0.2, 0.7, 0.4, 1)", fill: "forwards" }
    );
    anim.onfinish = cleanup;
    anim.oncancel = cleanup;
  }
}
