import type { OrbMood } from "@/lib/mascot/orb";

// A flat, lightweight version of the orb. Used where a live 3D orb would be
// too heavy (a small avatar next to every chat message), while the 3D one is
// still loading, and when the browser can't do WebGL. No JavaScript, no
// animation. Only "idle" and "happy" faces; anything else shows idle.
export function MascotStatic({
  size = 40,
  mood = "idle",
  className,
}: {
  size?: number;
  mood?: OrbMood;
  className?: string;
}) {
  const happy = mood === "happy" || mood === "love";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="cmo-body" cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#8a5cff" />
          <stop offset="0.55" stopColor="#3a1fb0" />
          <stop offset="1" stopColor="#12073a" />
        </radialGradient>
        <linearGradient id="cmo-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2d2ff" />
          <stop offset="1" stopColor="#8458ff" />
        </linearGradient>
        <linearGradient id="cmo-logo" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4021e0" />
          <stop offset="1" stopColor="#ff0aac" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#cmo-body)" />
      <circle cx="50" cy="50" r="46" fill="none" stroke="url(#cmo-rim)" strokeOpacity="0.55" strokeWidth="2" />
      <ellipse cx="50" cy="43" rx="30" ry="18" fill="#06021a" stroke="#8458ff" strokeWidth="1.6" />
      {happy ? (
        <g fill="none" stroke="#f6edff" strokeWidth="3.4" strokeLinecap="round">
          <path d="M33 47 Q40 38 47 47" />
          <path d="M53 47 Q60 38 67 47" />
        </g>
      ) : (
        <g fill="#f6edff">
          <ellipse cx="40" cy="43" rx="4.2" ry="7" />
          <ellipse cx="60" cy="43" rx="4.2" ry="7" />
        </g>
      )}
      <g fill="url(#cmo-logo)">
        <path d="M36 68 H70 L63 75 H30 Z" />
        <path d="M33 78 H62 L56 84 H27 Z" />
      </g>
    </svg>
  );
}
