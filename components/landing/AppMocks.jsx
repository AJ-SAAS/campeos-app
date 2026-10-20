'use client';

// Pictures of the app on the sales page, drawn to match the real screens:
// the dashboard (Today list, sales-date cards, agent beside it), the
// builder's sequence view (days, platform logos, status pills, on/off
// toggles, "3 messages" groups, the LIVE bar), the offer form and the
// agent. Plain DOM and the small logos in /public/brand, nothing heavy.
//
// The feature-card demos are driven by LandingPage's 700ms `tick`, which
// only runs while the features section is on screen. Reduced motion pins
// the tick at 17, so every demo below must look finished at tick 17.

/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { salesCalendar, upcomingSalesDates } from '@/lib/salesCalendar';

const INK = '#17131F';
const MUTED = '#5B5566';
const LINE = '#ECEAF0';
const GRAD = 'linear-gradient(90deg,#3B1FD1,#9B1FD6 55%,#E0109F)';
const GRAD_ICON = 'linear-gradient(135deg,#3B1FD1,#9B1FD6 55%,#FF00B8)';
const MONO = "'JetBrains Mono', monospace";

const STATUS = {
  Ready: { bg: '#DCFCE7', fg: '#166534' },
  'Needs input': { bg: '#FFEDD5', fg: '#9A3412' },
  'Not written': { bg: '#F2F1F5', fg: MUTED },
  'Writing...': { bg: '#F3EEFF', fg: '#5B21B6' },
  'Left out': { bg: '#F2F1F5', fg: '#8A8494' },
  Sent: { bg: '#F2F1F5', fg: MUTED },
};

export function Pill({ status }) {
  const s = STATUS[status] || STATUS['Not written'];
  return (
    <span style={{ flexShrink: 0, fontSize: '11px', fontWeight: 700, padding: '1px 7px', borderRadius: '999px', background: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>
      {status}
    </span>
  );
}

export function Logo({ p, size = 16 }) {
  if (p === 'sms') {
    return (
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, borderRadius: '5px', background: '#34C759' }}>
        <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" fill="#FFFFFF"><path d="M12 4C7 4 3 7.4 3 11.5c0 2.2 1.1 4.1 2.9 5.5L5 20.5l4-2c.9.3 1.9.4 3 .4 5 0 9-3.4 9-7.5S17 4 12 4z" /></svg>
      </span>
    );
  }
  return <img src={`/brand/${p}.png`} alt="" width={size} height={size} loading="lazy" style={{ width: size, height: size, objectFit: 'contain', display: 'block' }} />;
}

/** Overlapping logos, like the app's LogoStack. */
export function Logos({ list, size = 16 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: '8px', flexShrink: 0 }}>
      {list.map((p) => (
        <span key={p} style={{ marginLeft: '-8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size + 14, height: size + 14, borderRadius: '10px', background: '#FFFFFF', border: '1.5px solid #FFFFFF', boxShadow: `0 0 0 1px ${LINE}` }}>
          <Logo p={p} size={size} />
        </span>
      ))}
    </span>
  );
}

function Toggle({ on }) {
  return (
    <span aria-hidden="true" style={{ flexShrink: 0, position: 'relative', width: '30px', height: '18px', borderRadius: '999px', background: on ? INK : '#DAD7E0', transition: 'background .25s' }}>
      <span style={{ position: 'absolute', top: '2px', left: on ? '14px' : '2px', width: '14px', height: '14px', borderRadius: '50%', background: '#FFFFFF', transition: 'left .25s' }} />
    </span>
  );
}

function Spark({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
      <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
    </svg>
  );
}

function Window({ children, style }) {
  return (
    <div style={{ width: '100%', background: '#FFFFFF', border: '1px solid #E8E6EE', borderRadius: '20px', boxShadow: '0 24px 48px -34px rgba(23,19,31,.4)', overflow: 'hidden', textAlign: 'left', ...style }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sales dates (replaces the old single countdown box)                 */
/* ------------------------------------------------------------------ */

/** now is undefined until the page mounts: keep the space, show nothing. */
export function SalesDates({ now }) {
  if (!now) return <div style={{ height: '92px', margin: '56px auto 0' }} />;
  const upcoming = upcomingSalesDates(now);
  const list = upcoming.length ? upcoming : salesCalendar(now).slice(0, 1);
  if (!list.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${list.length > 1 ? 280 : 320}px, 1fr))`, gap: '12px', maxWidth: list.length > 1 ? '760px' : '420px', margin: '56px auto 0', textAlign: 'left' }}>
      {list.map((d) => (
        <a key={d.id} href="/auth?signup" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', borderRadius: '18px', background: '#FFFFFF', border: '1px solid #E8E4F0', textDecoration: 'none', color: INK }}>
          <span style={{ width: '56px', height: '56px', flexShrink: 0, borderRadius: '14px', background: '#F8F8F8', border: `1px solid ${LINE}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Newsreader, serif', fontWeight: 500, fontSize: '24px', lineHeight: 1, color: '#6D28D9' }}>{d.days}</span>
            <span style={{ fontFamily: MONO, fontSize: '8px', letterSpacing: '.1em', color: MUTED, marginTop: '2px' }}>{d.days === 1 ? 'DAY' : 'DAYS'}</span>
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '17px', fontWeight: 600 }}>{d.name}</span>
            <span style={{ display: 'block', fontSize: '14px', color: MUTED, marginTop: '2px' }}>
              {d.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
          </span>
          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', height: '36px', padding: '0 14px', borderRadius: '10px', background: INK, color: '#FFFFFF', fontSize: '14px', fontWeight: 600 }}>
            Plan it
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </a>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: the home dashboard                                            */
/* ------------------------------------------------------------------ */

const HERO_TODAY = [
  { time: '9:00 AM', logos: ['email'], title: "You're invited: free class", sub: 'Email · Webinar Launch', status: 'Sent' },
  { time: '12:00 PM', logos: ['sms'], title: 'Quick reminder', sub: 'Text message · Webinar Launch', status: 'Ready' },
  { time: '5:00 PM', logos: ['instagram', 'facebook', 'tiktok'], title: 'We go live soon', sub: 'Social post · Webinar Launch', swap: true },
  { time: '7:00 PM', logos: ['facebook'], title: 'Last seats ad', sub: 'Facebook ad · Webinar Launch', status: 'Needs input' },
];

const NAV_ICON = {
  Home: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  Campaigns: <><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="12" r="2" /><path d="M8 6h3a3 3 0 0 1 3 3v0a3 3 0 0 0 2 2.8M8 18h3a3 3 0 0 0 3-3v0a3 3 0 0 1 2-2.8" /></>,
  Offers: <><path d="M3 12V4h8l9 9-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" /></>,
  'Winning copy': <><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M12 13v4M9 20h6" /></>,
  'Buyer insights': <><path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" /></>,
};

function NavItem({ label, on }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '10px', background: on ? '#F2F1F5' : 'transparent', fontSize: '14px', fontWeight: on ? 600 : 400, color: on ? INK : MUTED }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{NAV_ICON[label]}</svg>
      {label}
    </div>
  );
}

function Row({ time, logos, title, sub, children, faded }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', borderTop: '1px solid #F5F4F7', opacity: faded ? 0.55 : 1 }}>
      <span className="cps-hx-time" style={{ width: '58px', flexShrink: 0, fontFamily: MONO, fontSize: '11px', color: MUTED }}>{time}</span>
      <span className="cps-hx-logos" style={{ width: '74px', flexShrink: 0, display: 'flex' }}><Logos list={logos} size={15} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        <span style={{ display: 'block', fontSize: '12px', color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
      </span>
      {children}
    </div>
  );
}

export function HeroApp({ now }) {
  const dates = now ? salesCalendar(now).slice(0, 2) : [];
  const day = now ? now.toLocaleDateString(undefined, { weekday: 'long' }).toUpperCase() : '';
  const dayShort = now ? `${now.toLocaleDateString(undefined, { weekday: 'short' })} ${now.getDate()}` : '';
  const hello = !now ? 'Good morning' : now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <div className="cps-tilt" style={{ position: 'relative', maxWidth: '1080px', margin: '56px auto 0', animationDelay: '.35s' }}>
      <Window style={{ borderRadius: '22px', boxShadow: '0 60px 120px -60px rgba(59,31,209,.45), 0 24px 48px -34px rgba(23,19,31,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 16px', borderBottom: `1px solid ${LINE}`, background: '#FCFCFD' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#E9E6EE' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#E9E6EE' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#E9E6EE' }} />
          <span style={{ flex: 1, textAlign: 'center', fontSize: '12px', color: '#8A8494' }}>campeos.com</span>
        </div>
        <div style={{ display: 'flex', minHeight: '440px' }}>
          {/* sidebar */}
          <div className="cps-hx-side" style={{ width: '190px', flexShrink: 0, borderRight: `1px solid ${LINE}`, padding: '18px 12px', flexDirection: 'column', gap: '2px' }}>
            <img src="/campeos-logo-full.png" alt="" style={{ height: '18px', width: 'auto', margin: '0 8px 18px', alignSelf: 'flex-start' }} />
            <NavItem label="Home" on />
            <NavItem label="Campaigns" />
            <NavItem label="Offers" />
            <NavItem label="Winning copy" />
            <NavItem label="Buyer insights" />
          </div>

          {/* main */}
          <div style={{ flex: 1, minWidth: 0, padding: '22px 22px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '.08em', color: MUTED, minHeight: '13px' }}>{day}</div>
              <div style={{ fontFamily: 'Newsreader, serif', fontWeight: 500, fontSize: '28px', letterSpacing: '-.02em', lineHeight: 1.1, marginTop: '2px' }}>{hello}, Sarah</div>
              <div style={{ fontSize: '13px', color: MUTED, marginTop: '4px' }}>3 messages go out today. 1 needs something from you.</div>
            </div>
            <div className="cps-hx-dates" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(dates.length ? dates : [null, null]).map((sd, i) => [sd ? sd.name : '', sd ? String(sd.days) : '', i === 0 ? 'Continue' : 'Plan it', i !== 0, i]).map(([n, d, cta, dark, k]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '14px', background: '#F8F8F8', border: '1px solid #F0F0F0' }}>
                  <span style={{ width: '36px', height: '36px', flexShrink: 0, borderRadius: '10px', background: '#FFFFFF', border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Newsreader, serif', fontSize: '16px' }}>{d}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
                  <span style={{ flexShrink: 0, fontSize: '12px', fontWeight: 600, padding: '5px 10px', borderRadius: '8px', background: dark ? INK : '#FFFFFF', color: dark ? '#FFFFFF' : INK, border: dark ? 'none' : '1px solid #E3E1E8' }}>{cta}</span>
                </div>
              ))}
            </div>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: '16px', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 18px' }}>
                <span style={{ fontSize: '15px', fontWeight: 600 }}>Today</span>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: MUTED }}>{dayShort}</span>
              </div>
              {HERO_TODAY.map((r) => (
                <Row key={r.title} {...r} faded={r.status === 'Sent'}>
                  {r.swap ? (
                    <span style={{ position: 'relative', display: 'inline-flex', justifyContent: 'flex-end', minWidth: '78px' }}>
                      <span className="cps-swapA" style={{ position: 'absolute', right: 0 }}><Pill status="Writing..." /></span>
                      <span className="cps-swapB"><Pill status="Ready" /></span>
                    </span>
                  ) : (
                    <Pill status={r.status} />
                  )}
                </Row>
              ))}
            </div>
          </div>

          {/* agent */}
          <div className="cps-hx-agent" style={{ width: '280px', flexShrink: 0, borderLeft: `1px solid ${LINE}`, flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '14px 16px', borderBottom: '1px solid #F0F0F0' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '8px', background: GRAD_ICON, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spark size={12} /></span>
              <span style={{ flex: 1, fontSize: '14px', fontWeight: 600 }}>Agent</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: '#15803D' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E' }} />Online</span>
            </div>
            <div style={{ flex: 1, background: '#FAFAFA', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ alignSelf: 'flex-end', maxWidth: '88%', padding: '9px 12px', borderRadius: '12px', background: INK, color: '#FFFFFF', fontSize: '13px', lineHeight: 1.45 }}>Fill in the last seats ad for me.</div>
              <div style={{ alignSelf: 'flex-start', maxWidth: '92%', padding: '9px 12px', borderRadius: '12px', background: '#FFFFFF', border: `1px solid ${LINE}`, fontSize: '13px', lineHeight: 1.45 }}>Done. I used your price and the Thursday 7 PM start. One thing left: add your seat count.</div>
            </div>
            <div style={{ padding: '10px 12px', borderTop: '1px solid #F0F0F0' }}>
              <div style={{ padding: '9px 12px', borderRadius: '10px', border: '1px solid #E3E1E8', fontSize: '12px', color: '#A39DAD' }}>Ask the agent...</div>
            </div>
          </div>
        </div>
      </Window>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campaign timeline: the builder's sequence view                      */
/* ------------------------------------------------------------------ */

// Writing order: 0 Mon email, 1-3 Tue group, 4 Wed ad, 5 Fri email, 6 Sat email.
const GROUP = [
  { logos: ['instagram', 'facebook'], title: 'Class is tomorrow', meta: '10:00 AM · Social post', needs: false },
  { logos: ['sms'], title: 'Save your seat', meta: '12:00 PM · Text', needs: true },
  { logos: ['email'], title: '24 hours to go', meta: '6:00 PM · Email', needs: false },
];

function DayRail({ label, live }) {
  return (
    <span className="cps-tl-rail" style={{ width: '52px', flexShrink: 0, paddingTop: '14px', fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: live ? '#9B1FD6' : INK, lineHeight: 1.3, whiteSpace: 'pre-line' }}>
      {label}
    </span>
  );
}

function StepCard({ logos, title, meta, status, on = true }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '14px', background: '#FFFFFF', border: `1px solid ${LINE}`, opacity: on ? 1 : 0.55, transition: 'opacity .25s' }}>
      <span className="cps-hx-logos" style={{ display: 'flex', flexShrink: 0 }}><Logos list={logos} size={15} /></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: on ? 'none' : 'line-through' }}>{title}</span>
          <span className="cps-hx-pill"><Pill status={on ? status : 'Left out'} /></span>
        </span>
        <span style={{ display: 'block', fontSize: '12px', color: MUTED, marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta}</span>
      </span>
      <Toggle on={on} />
    </div>
  );
}

export function TimelineMock({ tick }) {
  const T = (tick || 0) % 20;
  const ready = Math.max(0, Math.min(7, T - 3));
  const writing = T >= 3 && T < 10;
  const statusOf = (i, needs) => (ready > i ? (needs ? 'Needs input' : 'Ready') : writing && ready === i ? 'Writing...' : 'Not written');
  const open = T >= 11 && T < 16;
  const friOn = !(T >= 17);
  const total = friOn ? 7 : 6;
  const readyCount = Math.min(ready, total) - (ready >= 3 ? 1 : 0);
  const needsCount = ready >= 3 ? 1 : 0;

  return (
    <Window style={{ maxWidth: '600px' }}>
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-.01em' }}>Masterclass Live</span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', background: ready >= 7 ? '#DCFCE7' : '#F2F1F5', color: ready >= 7 ? '#166534' : MUTED }}>{ready >= 7 ? 'Live' : 'Draft'}</span>
        </div>
        <div style={{ fontSize: '13px', color: MUTED, marginTop: '3px' }}>Webinar launch · Goes live Thu 7:00 PM · $997</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 160px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ flex: 1, height: '5px', borderRadius: '999px', background: '#F0EEF4', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${(Math.max(0, readyCount) / total) * 100}%`, background: INK, borderRadius: '999px', transition: 'width .5s' }} />
            </span>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: MUTED, whiteSpace: 'nowrap' }}>{Math.max(0, readyCount)} of {total} ready</span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '10px', background: ready >= 7 ? INK : GRAD, color: '#FFFFFF', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {ready >= 7 ? 'Copy all' : writing ? 'Writing...' : 'Write 7 messages'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
          {[['email', 'Email'], ['sms', 'SMS'], ['facebook', 'Ads'], ['instagram', 'Social posts']].map(([p, n]) => (
            <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px 5px 6px', borderRadius: '999px', border: `1px solid ${LINE}`, background: '#FFFFFF', fontSize: '12px', fontWeight: 600 }}>
              <Logo p={p} size={14} />{n}
            </span>
          ))}
        </div>
      </div>

      <div className="cps-tl-list" style={{ padding: '6px 20px 18px', background: '#FCFCFD', display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: '8px', alignContent: 'start', height: '486px', overflow: 'hidden', WebkitMaskImage: 'linear-gradient(180deg,#000 82%,transparent)', maskImage: 'linear-gradient(180deg,#000 82%,transparent)' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <DayRail label={'MON\n3'} />
          <StepCard logos={['email']} title="You're invited" meta="9:00 AM · Email" status={statusOf(0)} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <DayRail label={'TUE\n4'} />
          <div style={{ flex: 1, minWidth: 0, borderRadius: '14px', background: '#FFFFFF', border: `1px solid ${LINE}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px' }}>
              <span className="cps-hx-logos" style={{ display: 'flex', flexShrink: 0 }}><Logos list={['instagram', 'sms', 'email']} size={15} /></span>
              <span style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                3 messages
                {ready >= 3 && <span className="cps-hx-pill" style={{ fontWeight: 600, color: '#9A3412', fontSize: '13px' }}> · 1 needs input</span>}
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A39DAD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }}><path d="M6 9l6 6 6-6" /></svg>
            </div>
            {open && (
              <div className="cps-fu" style={{ borderTop: '1px solid #F0F0F0', background: '#FCFCFD' }}>
                {GROUP.map((g, i) => (
                  <div key={g.title} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', borderTop: i ? '1px solid #F2F1F5' : 'none' }}>
                    <Logos list={g.logos} size={13} />
                    <span style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.title}</span>
                    <span className="cps-hx-pill" style={{ fontSize: '11px', color: MUTED, fontFamily: MONO }}>{g.meta.split(' · ')[0]}</span>
                    <Pill status={statusOf(i + 1, g.needs)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <DayRail label={'WED\n5'} />
          <StepCard logos={['facebook']} title="Last seats ad" meta="7:00 PM · Facebook ad" status={statusOf(4)} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '2px 0' }}>
          <span className="cps-tl-rail" style={{ width: '52px', flexShrink: 0 }} />
          <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 700, color: '#FFFFFF', background: GRAD, padding: '3px 9px', borderRadius: '999px', whiteSpace: 'nowrap' }}>LIVE · THU 7 PM</span>
          <span style={{ flex: 1, height: '2px', borderRadius: '2px', background: GRAD }} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <DayRail label={'FRI\n7'} />
          <StepCard logos={['email']} title="The replay is up" meta="9:00 AM · Email" status={statusOf(5)} on={friOn} />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <DayRail label={'SAT\n8'} />
          <StepCard logos={['email']} title="Doors close tonight" meta="8:00 PM · Email" status={statusOf(6)} />
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ */
/* Offers: the offer form                                              */
/* ------------------------------------------------------------------ */

function Field({ label, show, value, width }) {
  return (
    <>
      <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '12px' }}>{label}</div>
      <div style={{ marginTop: '6px', minHeight: '40px', padding: '10px 12px', borderRadius: '10px', border: `1px solid ${show ? '#D8CCF5' : '#E3E1E8'}`, background: '#FFFFFF', fontSize: '14px', width: width || '100%', transition: 'border-color .3s' }}>
        {show && <span className="cps-type">{value}</span>}
      </div>
    </>
  );
}

export function OfferMock({ v }) {
  return (
    <Window style={{ maxWidth: '420px', padding: '20px' }}>
      <div style={{ fontSize: '17px', fontWeight: 700 }}>New offer</div>
      <Field label="Offer name" show={v.oN} value="10 Clients in 30 Days" />
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: '0 0 120px' }}><Field label="Price" show={v.oP} value="$997" /></div>
        <div style={{ flex: 1, minWidth: 0 }}><Field label="Sign emails as" show={v.oP} value="Ajay" /></div>
      </div>
      <Field label="Who it's for" show={v.oW} value="Coaches stuck under $10K a month" />
      <Field label="What they get" show={v.oG} value="Done-for-you ads, or we keep working free" />
      <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '12px' }}>Tone</div>
      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
        {['Friendly', 'Bold', 'Calm'].map((t, i) => (
          <span key={t} style={{ padding: '6px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, background: i === 0 ? INK : '#FFFFFF', color: i === 0 ? '#FFFFFF' : INK, border: i === 0 ? `1px solid ${INK}` : '1px solid #E3E1E8' }}>{t}</span>
        ))}
      </div>
      <div style={{ marginTop: '16px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: '#FFFFFF', background: v.oT ? '#15803D' : INK, transform: v.oS ? 'scale(.97)' : 'none', transition: 'background .3s, transform .15s' }}>
        {v.oT ? (
          <span className="cps-pop" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
            Offer saved
          </span>
        ) : 'Save offer'}
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ */
/* The agent                                                           */
/* ------------------------------------------------------------------ */

function AgentBubble({ children, me }) {
  return (
    <div className="cps-fu" style={{ alignSelf: me ? 'flex-end' : 'flex-start', maxWidth: '86%', padding: '10px 14px', borderRadius: '14px', background: me ? INK : '#FFFFFF', color: me ? '#FFFFFF' : INK, border: me ? 'none' : `1px solid ${LINE}`, fontSize: '14px', lineHeight: 1.5 }}>
      {children}
    </div>
  );
}

function Typing() {
  return (
    <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '14px', background: '#FFFFFF', border: `1px solid ${LINE}`, fontSize: '14px', color: '#A39DAD', letterSpacing: '2px' }}>
      <span className="cps-dot">•</span><span className="cps-dot" style={{ animationDelay: '.2s' }}>•</span><span className="cps-dot" style={{ animationDelay: '.4s' }}>•</span>
    </div>
  );
}

export function AgentMock({ v }) {
  return (
    <div style={{ width: '100%', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
      <div style={{ flex: '1 1 300px', minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '.08em', color: MUTED }}>TRY ASKING</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
          {['Make the subject lines shorter', 'Add a last chance email', 'Rewrite it for 5th grade', 'Give me 3 new ad hooks'].map((c) => (
            <span key={c} style={{ padding: '9px 14px', borderRadius: '999px', border: '1px solid #E3E1E8', background: '#FFFFFF', fontSize: '14px', fontWeight: 500 }}>{c}</span>
          ))}
        </div>
      </div>
      <Window style={{ flex: '1 1 380px', minWidth: 0, maxWidth: '460px', marginLeft: 'auto', borderRadius: '22px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 18px', borderBottom: '1px solid #F0F0F0' }}>
          <span style={{ width: '30px', height: '30px', borderRadius: '9px', background: GRAD_ICON, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spark /></span>
          <span style={{ flex: 1, fontSize: '16px', fontWeight: 600 }}>Agent</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#15803D' }}><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E' }} />Online</span>
        </div>
        <div style={{ height: '330px', background: '#FAFAFA', padding: '18px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '10px', overflow: 'hidden' }}>
          {v.a1 && <AgentBubble me>Change the hook on the last seats ad.</AgentBubble>}
          {v.aD1 && <Typing />}
          {v.a2 && !v.a3 && <AgentBubble>Updating that now.</AgentBubble>}
          {v.aD2 && <Typing />}
          {v.a3 && <AgentBubble>Done. The ad now leads with the 30-day promise. The rest is the same.</AgentBubble>}
          {v.a4 && <AgentBubble me>Nice. Now make all the subject lines shorter.</AgentBubble>}
          {v.aD3 && <Typing />}
          {v.a5 && !v.a6 && <AgentBubble>On it. Shortening all 9 subject lines.</AgentBubble>}
          {v.aD4 && <Typing />}
          {v.a6 && <AgentBubble>Done. Every subject line is now 6 words or less.</AgentBubble>}
        </div>
        <div style={{ display: 'flex', gap: '8px', padding: '12px 14px', borderTop: '1px solid #F0F0F0' }}>
          <div style={{ flex: 1, padding: '11px 14px', borderRadius: '12px', border: '1px solid #E3E1E8', fontSize: '14px', color: '#A39DAD' }}>Tell the agent what to build or change...</div>
          <span style={{ width: '42px', height: '42px', flexShrink: 0, borderRadius: '12px', background: INK, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </span>
        </div>
      </Window>
    </div>
  );
}
