"use client";

import { useEffect, useRef, useState } from "react";
import type { Orb, OrbMood, OrbOptions } from "@/lib/mascot/orb";
import { MascotStatic } from "./MascotStatic";

interface MascotProps extends Omit<OrbOptions, "reducedMotion"> {
  mood?: OrbMood;
  /** Width and height in px. The orb is square. */
  size?: number;
  /** Make it hop whenever this number changes (not on the first render). */
  hopKey?: number;
  /** Pass false to stop drawing, e.g. when the orb is hidden behind something. */
  active?: boolean;
  /** Read out by screen readers. Leave out when the orb is just decoration. */
  label?: string;
  className?: string;
}

// The live 3D mascot. Three.js (~600 KB) is only downloaded when one of
// these is on screen, and until it's ready (or if the browser can't do
// WebGL) a flat picture is shown instead, so nothing ever looks empty.
//
// Keep the number of live orbs on a page small (one or two). Every one is
// its own WebGL context, and browsers only allow around 16. For lots of
// small avatars use <MascotStatic />.
export function Mascot({
  mood = "idle",
  size = 120,
  hopKey,
  active = true,
  label,
  className,
  interactive = false,
  follow = true,
  alive = true,
  restless = true,
  glow = true,
  ring = false,
  fit = 1,
}: MascotProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<Orb | null>(null);
  const moodRef = useRef(mood);
  const aliveRef = useRef(alive);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [onScreen, setOnScreen] = useState(true);

  moodRef.current = mood;
  aliveRef.current = alive;

  // Build the orb once Three.js has loaded. Rebuilt only if a setting that
  // can't be changed on the fly (see createOrb) changes.
  useEffect(() => {
    let cancelled = false;
    let orb: Orb | null = null;
    (async () => {
      try {
        const [T, { createOrb }] = await Promise.all([import("three"), import("@/lib/mascot/orb")]);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        const reducedMotion = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        orb = createOrb(T, canvas, { interactive, follow, restless, glow, ring, fit, alive: aliveRef.current, reducedMotion });
        orb.setMood(moodRef.current);
        orbRef.current = orb;
        setStatus("ready");
      } catch {
        // No WebGL, or the library failed to load: keep the flat picture.
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      orbRef.current = null;
      orb?.dispose();
    };
  }, [interactive, follow, restless, glow, ring, fit]);

  useEffect(() => {
    orbRef.current?.setMood(mood);
  }, [mood, status]);

  useEffect(() => {
    orbRef.current?.setAlive(alive);
  }, [alive, status]);

  // Hop when hopKey changes. The first value is the starting point, not a hop.
  const lastHop = useRef(hopKey);
  useEffect(() => {
    if (hopKey !== lastHop.current) {
      lastHop.current = hopKey;
      orbRef.current?.hop();
    }
  }, [hopKey]);

  // Follow the wrapper's size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => orbRef.current?.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Don't draw frames nobody can see.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    orbRef.current?.setPaused(!active || !onScreen);
  }, [active, onScreen, status]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", width: size, height: size, flex: "none" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {status !== "ready" && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
          <MascotStatic size={Math.round(size * 0.62)} mood={mood} />
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: status === "failed" ? "none" : "block",
          opacity: status === "ready" ? 1 : 0,
          transition: "opacity .3s ease",
          touchAction: interactive ? "pan-y" : "auto",
          pointerEvents: interactive ? "auto" : "none",
        }}
      />
    </div>
  );
}
