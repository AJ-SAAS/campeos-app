# Campeos

Campeos is a campaign builder for marketers who run webinars, flash sales, and
launches. A user gives their offer (or a website to learn it from), plus
optional "winning copy" and sales-call transcripts, and Campeos writes a full
campaign — every email, ad, and text — laid out on a timeline with suggested
send times.

The mockups for the dashboard and campaign builder screens are the source of
truth for layout and interaction. Ask for them if they aren't in the repo.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Firebase Auth + Firestore (accounts, offers, campaigns, steps)
- Claude API (Anthropic) for copy generation — server-side only, never from
  the browser
- Stripe (billing — added later, not in v1)
- Deployed on Vercel, domain bought and pointed through Cloudflare

## Folder rules

```
app/                    Next.js routes (App Router)
app/api/                Server routes. This is the ONLY place the Claude API
                        key is used. Never import it into a client component.
lib/templates/          One file per campaign type ("pocket"): webinar.ts,
                        flash-sale.ts, black-friday.ts. Each exports a
                        StepTemplate[] (see lib/templates/types.ts). Adding a
                        new campaign type means adding a file here — it
                        should never require touching the engine or the UI.
lib/engine/             Pure functions. buildTimeline() turns a template plus
                        a start date into real calendar dates and times. No
                        AI calls in here — this is deterministic date math,
                        and it should be fully unit-testable without hitting
                        an API.
lib/ai/                 Claude API client and prompt builders. One function
                        per job: generateStepCopy(), analyzeSalesCall(),
                        proposeAngles(). Each returns parsed, schema-checked
                        JSON — never raw text the UI has to parse itself.
components/             React components matching the mockups: Timeline,
                        StepCard, StepEditor, SetupPanel, AskCampeosBar.
scripts/                One-off scripts for testing prompt quality against
                        real offers. Not part of the app; run with
                        `npx tsx scripts/<name>.ts`.
```

## The copy rules (non-negotiable, apply to every prompt in lib/ai/)

These come directly from how Campeos is meant to work and what makes it
different from a generic AI chat. Do not relax them for convenience.

- **The AI never invents the campaign structure.** The step list, channel,
  timing, and sales angle come from the template in lib/templates/. The AI
  only writes the copy for a given step — subject lines, ad text, body copy —
  from the offer, the tone, and (when available) the user's winning copy and
  buyer-call insights.
- **Never invent facts.** No testimonials, no customer names, no results
  the user didn't provide. Missing facts become placeholders in [ALL CAPS],
  e.g. [CUSTOMER NAME], [RESULT]. This is the single most important rule —
  a campaign with a fabricated testimonial is worse than one with a blank.
- **Match the user's reading level and voice.** Plain words, short
  sentences, roughly a 5th-grade reading level unless the user's own pasted
  copy shows otherwise. No em dashes in generated marketing copy.
- **A "variation" changes one thing at a time.** When asked for variations
  on a step, generate options that each change a single element (angle,
  hook, length) and say what changed. Never reword five things at once —
  the user can't learn anything from that.
- **Cite where copy came from.** Every generated step should carry a
  `source` field: "campaign template," "your winning headline," or "call
  theme: <theme>." This is what proves Campeos isn't a blank ChatGPT prompt
  — surface it in the UI (see the mockup's "Built from" tag).

## Data model (Firestore, rough shape for v1)

```
users/{uid}
offers/{offerId}          { uid, name, price, audience, whatTheyGet, tone }
winners/{winnerId}        { uid, offerId?, text, channel, addedAt }
salesCalls/{callId}       { uid, offerId?, transcript, themes: [...], addedAt }
campaigns/{campaignId}    { uid, offerId, templateId, startDate, title, status }
campaigns/{campaignId}/steps/{stepId}
                          { templateStepId, channel, scheduledAt, title,
                            fields: { f1, f2, ... }, source, needsInput,
                            status: "draft" | "posted" }
```

Keep sales-call transcripts and any personal data out of client bundles —
read them only in server routes.

## Build order

Follow this order; don't jump ahead to UI polish before the engine works.

1. `lib/templates/types.ts` + `lib/templates/webinar.ts` — one real template,
   hand-written from the Sales Campaign Vault structure.
2. `lib/engine/buildTimeline.ts` — pure date math, unit tested.
3. `lib/ai/generateStepCopy.ts` — one Claude call per step, run in parallel,
   schema-checked with zod.
4. `scripts/test-templates.ts` — run the webinar template against 5 sample
   offers, read the output by hand before building any more UI.
5. UI: SetupPanel, Timeline, StepCard, StepEditor, AskCampeosBar — build
   against the mockups, backed by mock data first, then wired to the API
   route.
6. Firebase: auth, save/load campaigns.
7. Stripe billing (separate phase — do not start until 1–6 work end to end).

## Commands

```
npm install
npm run dev              # http://localhost:3000
npx tsx scripts/test-templates.ts    # sanity-check generated copy
```

## Deploy

- **Domain**: bought and managed through Cloudflare (registrar + DNS).
- **Hosting**: Vercel, connected to the GitHub repo — every push to `main`
  deploys automatically, every PR gets a preview URL. Point the Cloudflare
  domain at Vercel with a CNAME (Vercel's project settings give the exact
  record once the domain is added there).
- **Environment variables**: set in Vercel's project settings (Settings →
  Environment Variables), not committed. Same keys as `.env.local.example`:
  `ANTHROPIC_API_KEY`, the `NEXT_PUBLIC_FIREBASE_*` keys, and later the
  Stripe keys.
- **AI**: Claude API (Anthropic), called only from `app/api/*` routes. Get
  a key from console.anthropic.com → API Keys.
