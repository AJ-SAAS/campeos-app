import { MascotStatic } from "@/components/mascot/MascotStatic";

// What people see while we check who they are and load their account. It
// used to be a blank white page for up to ten seconds right after sign-up,
// which looked broken. The words fade in after a moment so a fast load
// doesn't flash text. The mascot here is the flat picture on purpose: this
// screen shows on every page load, and downloading the 3D library just to
// fill a one-second wait would make the wait longer.
export function LoadingScreen({ message = "Setting up your account" }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: "#17131F" }}
    >
      <style>{`
        @keyframes cps-ld-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes cps-ld-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.cps-ld{animation:none !important}}
      `}</style>
      <div className="cps-ld" style={{ animation: "cps-ld-bob 1.2s ease-in-out infinite", filter: "drop-shadow(0 10px 14px rgba(124,58,237,0.35))" }}>
        <MascotStatic size={76} />
      </div>
      <div style={{ textAlign: "center", opacity: 0, animation: "cps-ld-in .4s .5s ease forwards" }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{message}...</div>
        <div style={{ fontSize: 14, color: "#6B6577", marginTop: 4 }}>This only takes a few seconds.</div>
      </div>
    </div>
  );
}
