"use client";

import { forwardRef } from "react";
import { Mascot } from "@/components/mascot/Mascot";
import { AGENT_NAME } from "@/lib/brand";
import type { SetupStage } from "@/lib/onboarding/setupSteps";

interface Props {
  stages: SetupStage[];
  /** Index of the stage being worked on. Stages before it are done. */
  active: number;
  /** All work finished: show the finale. */
  done: boolean;
}

/**
 * Full-screen "setting up" view between the last onboarding question and
 * home. Eos works while a glass checklist ticks off the real steps.
 */
export const SettingUp = forwardRef<HTMLDivElement, Props>(function SettingUp({ stages, active, done }, orbRef) {
  return (
    <div className="cps-su" role="status" aria-live="polite">
      <div className="cps-su-aurora" aria-hidden="true" />
      <div className="cps-su-grid" aria-hidden="true" />
      <div className="cps-su-inner">
        <div ref={orbRef} className="cps-su-orb">
          <Mascot
            size={220}
            fit={0.95}
            centered
            ring={!done}
            glow
            restless={false}
            mood={done ? "happy" : "thinking"}
            hopKey={done ? 1 : 0}
            spinKey={done ? 100 : active}
            label={AGENT_NAME}
          />
        </div>
        <h1 className="cps-su-title">{done ? "You're all set" : `${AGENT_NAME} is setting things up`}</h1>
        <p className="cps-su-sub">{done ? "Taking you home..." : "Just a moment while I get your workspace ready."}</p>
        <ul className="cps-su-list">
          {stages.map((s, i) => {
            const state = done || i < active ? "done" : i === active ? "active" : "wait";
            return (
              <li key={s.id} className={`cps-su-row cps-su-${state}`}>
                <span className="cps-su-dot" aria-hidden="true">
                  {state === "done" ? "✓" : ""}
                </span>
                <span>{state === "done" ? s.doneLabel : s.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <style>{`
        .cps-su{position:fixed;inset:0;z-index:60;background:#0B0A1A;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:24px}
        .cps-su-aurora{position:absolute;inset:-20%;background:radial-gradient(40% 40% at 25% 30%,rgba(124,92,255,.45),transparent 70%),radial-gradient(35% 35% at 75% 25%,rgba(58,160,255,.35),transparent 70%),radial-gradient(45% 45% at 60% 80%,rgba(255,107,139,.28),transparent 70%);filter:blur(40px);animation:cps-su-drift 14s ease-in-out infinite alternate}
        .cps-su-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(60% 60% at 50% 45%,#000,transparent 80%);-webkit-mask-image:radial-gradient(60% 60% at 50% 45%,#000,transparent 80%)}
        .cps-su-inner{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;width:100%;max-width:420px}
        .cps-su-orb{width:220px;height:220px;margin-bottom:8px}
        .cps-su-title{font-size:26px;font-weight:700;letter-spacing:-.02em;margin:0;background:linear-gradient(90deg,#fff 0%,#C9BBFF 40%,#fff 80%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:cps-su-shine 3s linear infinite}
        .cps-su-sub{margin:8px 0 24px;font-size:15px;color:rgba(255,255,255,.65)}
        .cps-su-list{list-style:none;margin:0;padding:8px;width:100%;border-radius:18px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);text-align:left}
        .cps-su-row{display:flex;align-items:center;gap:12px;padding:11px 12px;font-size:15px;border-radius:12px;transition:color .3s,background .3s}
        .cps-su-wait{color:rgba(255,255,255,.4)}
        .cps-su-active{color:#fff;background:rgba(255,255,255,.08)}
        .cps-su-done{color:rgba(255,255,255,.85)}
        .cps-su-dot{flex:none;width:20px;height:20px;border-radius:50%;border:2px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0B0A1A}
        .cps-su-active .cps-su-dot{border-color:#C9BBFF;border-top-color:transparent;animation:cps-su-spin .8s linear infinite}
        .cps-su-done .cps-su-dot{background:#2BB673;border-color:#2BB673}
        @keyframes cps-su-spin{to{transform:rotate(360deg)}}
        @keyframes cps-su-shine{to{background-position:-200% 0}}
        @keyframes cps-su-drift{from{transform:translate3d(-3%,-2%,0) scale(1)}to{transform:translate3d(3%,2%,0) scale(1.12)}}
        @media (prefers-reduced-motion: reduce){
          .cps-su-aurora,.cps-su-title,.cps-su-active .cps-su-dot{animation:none !important}
        }
      `}</style>
    </div>
  );
});
