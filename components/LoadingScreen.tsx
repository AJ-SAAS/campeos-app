// What people see while we check who they are and load their account. It
// used to be a blank white page for up to ten seconds right after sign-up,
// which looked broken. The words fade in after a moment so a fast load
// doesn't flash text.
export function LoadingScreen({ message = "Setting up your account" }: { message?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: "#17131F" }}
    >
      <style>{`
        @keyframes cps-ld-spin{to{transform:rotate(360deg)}}
        @keyframes cps-ld-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.cps-ld *{animation-duration:.01ms !important}}
      `}</style>
      <svg className="cps-ld" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#9B1FD6" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true" style={{ animation: "cps-ld-spin .9s linear infinite" }}>
        <path d="M21 12a9 9 0 1 1-6.2-8.6" />
      </svg>
      <div style={{ textAlign: "center", opacity: 0, animation: "cps-ld-in .4s .5s ease forwards" }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{message}...</div>
        <div style={{ fontSize: 14, color: "#6B6577", marginTop: 4 }}>This only takes a few seconds.</div>
      </div>
    </div>
  );
}
