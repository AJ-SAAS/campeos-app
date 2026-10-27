"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { LOADING_STEPS, LOADING_STEP_MS, nextLoadingStep } from "@/lib/loadingSteps";

// What people see while we check who they are and load their account. It
// used to be a blank white page for up to ten seconds, which looked broken.
//
// Eos (the live 3D one) spins and looks busy while a few short lines walk
// through what is being got ready. There is no flat picture first: the page is
// plain white until the 3D one fades in, so nothing swaps or flickers. The
// words fade in after a moment so a fast load doesn't flash text.
//
// `steps` is the list of lines. Pages where the account's offers and
// campaigns don't exist yet (sign-in, onboarding) pass their own.
export function LoadingScreen({ steps = LOADING_STEPS }: { steps?: string[] }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (steps.length < 2) return;
    const t = setInterval(() => setStage((s) => nextLoadingStep(s, steps.length)), LOADING_STEP_MS);
    return () => clearInterval(t);
  }, [steps.length]);

  const line = steps[Math.min(stage, steps.length - 1)] ?? "";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif", color: "#17131F" }}
    >
      <style>{`
        @keyframes cps-ld-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        @keyframes cps-ld-line{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion:reduce){.cps-ld-line{animation:none !important}}
      `}</style>
      <div style={{ filter: "drop-shadow(0 10px 14px rgba(124,58,237,0.35))" }}>
        <Mascot noFlat size={150} fit={1.05} centered bubble={false} ring glow={false} restless={false} mood="thinking" spinKey={stage} label="Eos" style={{ margin: -14 }} />
      </div>
      <div style={{ textAlign: "center", opacity: 0, animation: "cps-ld-in .4s .5s ease forwards", minHeight: 52 }}>
        <div key={line} className="cps-ld-line" style={{ fontSize: 17, fontWeight: 600, animation: "cps-ld-line .35s ease both" }}>
          {line}...
        </div>
        {steps.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }} aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                style={{ width: i === stage ? 22 : 7, height: 7, borderRadius: 4, background: i <= stage ? "#7C3AED" : "#E3E1E8", transition: "width .3s ease, background .3s ease" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
