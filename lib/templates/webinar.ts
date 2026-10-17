import { CampaignTemplate } from "./types";

const shortLong = [
  { key: "headline", label: "Headline / subject", kind: "short" as const },
  { key: "body", label: "Body", kind: "long" as const },
];

const adFields = [
  { key: "headline", label: "Headline", kind: "short" as const },
  { key: "primaryText", label: "Primary text", kind: "long" as const },
];

const smsFields = [{ key: "body", label: "Text", kind: "long" as const }];

// A full-lifecycle webinar campaign: fill the room, get people to show up,
// then run an 11-day backend sequence that sells the offer. The backend
// sequence (every step in the consumption / consideration-connection /
// conversion / marketing-intel phases) is modeled directly on a real
// copywriter's own fill-in-the-blank template for exactly this kind of
// post-webinar follow-up — the structure, the phase objectives, and the
// named techniques below all come from that source, not invented from
// scratch. This is Campeos's first "blueprint" template: get this one
// right, and the same phase/technique/goals shape applies to every other
// campaign type.
export const webinarTemplate: CampaignTemplate = {
  id: "webinar",
  name: "Webinar launch",
  description:
    "Fill seats for a live webinar, then run a full 11-day backend sequence that turns registrants into buyers.",
  kind: "webinar",
  phases: [
    {
      id: "registration",
      name: "Registration",
      objective:
        "Turn cold and warm traffic into confirmed registrants before the room fills.",
    },
    {
      id: "live-event",
      name: "Live event",
      objective:
        "Get registered people to actually show up — most registrants never do, so these final touches carry real weight.",
    },
    {
      id: "consumption",
      name: "Consumption",
      objective:
        "Funnel registrants back to the replay. On average only 25-40% of registrants ever watch, so recovering that lost audience comes before anything else.",
    },
    {
      id: "consideration-connection",
      name: "Consideration & connection",
      objective:
        "Build personal rapport, credibility, and social proof so the direct ask in the next phase lands as trustworthy, not pushy.",
    },
    {
      id: "conversion",
      name: "Conversion",
      objective:
        "Make the direct ask. This is the one phase whose only job is maximizing sales.",
    },
    {
      id: "marketing-intel",
      name: "Marketing intel",
      objective:
        "Recover a few last-minute sales and learn exactly why everyone else didn't buy, in their own words.",
    },
  ],
  steps: [
    // --- Registration: 6 days out to day before ---
    {
      id: "ad-open",
      channel: "ad",
      anchor: "event",
      offsetHours: -144, // 6 days before
      title: "Registration ad",
      phaseId: "registration",
      purpose:
        "Cold traffic has never heard of this webinar and is mid-scroll, not looking for a solution. The ad's only job is to interrupt that scroll with a moment the reader recognizes as her own, then earn the registration — not to explain or sell the full program.",
      angle: "Pattern interrupt + open loop",
      goals: [
        "Stop the scroll with one specific, recognizable moment from her actual day, not a description of 'busy moms'",
        "Open a curiosity gap about what the fix looks like, without resolving it in the ad",
        "Get a first registration from someone who's never heard of you",
        "Earn the click without over-explaining the offer",
      ],
      persuasionElements: ["Audience: speak to what they already want", "Optimization: headline earns attention"],
      fields: adFields,
    },
    {
      id: "email-invite",
      channel: "email",
      anchor: "event",
      offsetHours: -120, // 5 days before
      title: "You're invited",
      phaseId: "registration",
      purpose:
        "The list already trusts you, so this is a plain, no-pressure invite — most of this list's registrations come from this one email.",
      angle: "Direct list invitation",
      goals: [
        "Tell the list the webinar exists",
        "Get the first wave of registrations from people who already trust you",
      ],
      persuasionElements: ["Audience: existing trust and attention", "Offer: what exactly is included"],
      fields: shortLong,
    },
    {
      id: "ad-retarget-registrants",
      channel: "ad",
      anchor: "event",
      offsetHours: -96, // 4 days before
      title: "Retargeting ad",
      phaseId: "registration",
      purpose:
        "Anyone who saw the first ad but didn't register already has some interest — this ad answers the hesitation that stopped them the first time.",
      angle: "Retargeting objection handling",
      goals: [
        "Bring back warm traffic that didn't convert the first time",
        "Handle the specific hesitation a second look usually reveals",
      ],
      persuasionElements: ["Objections: timing or trust", "Urgency: a real reason to act now"],
      fields: adFields,
    },
    {
      id: "email-whats-inside",
      channel: "email",
      anchor: "event",
      offsetHours: -72, // 3 days before
      title: "What you'll learn",
      phaseId: "registration",
      purpose:
        "A registration isn't a show-up — most registrants quietly ghost. This email's only job is to make missing the live session feel like a real loss, by previewing exactly what happens in it in terms specific enough to picture.",
      angle: "Specificity + future pacing",
      goals: [
        "Preview 3 concrete, nameable things she'll walk away with — each one a specific teachable moment or step, never a vague benefit like 'calmer mornings'",
        "Future-pace one moment from a morning after the method is working, specific enough she can picture herself in it",
        "Give registrants a concrete reason to clear their calendar for the exact date and time",
      ],
      persuasionElements: ["Desire: specific outcome preview", "Optimization: clarity on what they'll get"],
      fields: shortLong,
    },
    {
      id: "sms-save-seat",
      channel: "sms",
      anchor: "event",
      offsetHours: -48, // 2 days before
      title: "Save your seat text",
      phaseId: "registration",
      purpose:
        "A short text cuts through where email gets ignored — this catches anyone who registered but never confirmed they're actually coming.",
      angle: "Confirmation nudge",
      goals: [
        "Get an explicit yes from registrants who haven't engaged since signing up",
      ],
      persuasionElements: ["Urgency: confirm before spots go", "Optimization: friction reduction (one-word reply)"],
      fields: smsFields,
    },

    // --- Live event: day before through go-live ---
    {
      id: "email-story",
      channel: "email",
      anchor: "event",
      offsetHours: -30,
      title: "Why this matters now",
      phaseId: "live-event",
      purpose:
        "By the day before, generic reminders stop working. A story earns attention and gives people an emotional reason to show up tomorrow, not just a logistical one.",
      angle: "Pre-event urgency story",
      goals: [
        "Build urgency for tomorrow through a story, not a checklist",
        "Remind registrants why they signed up in the first place",
      ],
      persuasionElements: ["Story: before-and-after", "Stakes: cost of missing it"],
      fields: shortLong,
    },
    {
      id: "sms-tomorrow",
      channel: "sms",
      anchor: "event",
      offsetHours: -24,
      title: "Tomorrow reminder",
      phaseId: "live-event",
      purpose:
        "One more short nudge the day before — texts get read when inboxes don't.",
      angle: "Day-before reminder",
      goals: ["Keep the webinar top of mind the night before"],
      persuasionElements: ["Urgency: a real deadline, close now"],
      fields: smsFields,
    },
    {
      id: "email-today",
      channel: "email",
      anchor: "event",
      offsetHours: -3,
      title: "Starting soon",
      phaseId: "live-event",
      purpose:
        "This is the last email before doors open. The only job left is getting the join link in front of every registrant one more time.",
      angle: "Final-hour reminder",
      goals: [
        "Put the join link front and center one last time",
        "Catch anyone who forgot it was today",
      ],
      persuasionElements: ["Optimization: call to action front and center"],
      fields: shortLong,
    },
    {
      id: "sms-live-now",
      channel: "sms",
      anchor: "event",
      offsetHours: 0,
      title: "We're live",
      phaseId: "live-event",
      purpose:
        "The moment the webinar starts, a chunk of registrants are mid-scroll somewhere else. This catches them the second it matters.",
      angle: "Live-now urgency",
      goals: ["Catch registrants who forgot the moment it starts"],
      persuasionElements: ["Urgency: immediate, happening right now"],
      fields: smsFields,
    },

    // --- Consumption: funnel people back to the replay ---
    {
      id: "email-welcome",
      channel: "email",
      anchor: "event",
      offsetHours: 3,
      title: "Welcome + replay link",
      phaseId: "consumption",
      purpose:
        "40% or more of your paid leads never actually watch the webinar. This email's whole job is sending them back to the replay before anything else gets in the way.",
      angle: "Reciprocity opener",
      goals: [
        "Hand over the replay link immediately, no gatekeeping",
        "Get a reply to start a real conversation (and improve deliverability)",
        "Set up anticipation for the emails still to come",
      ],
      persuasionElements: ["Offer: hand over value immediately", "Audience: what they signed up expecting"],
      fields: shortLong,
    },
    {
      id: "ad-offer-open",
      channel: "ad",
      anchor: "event",
      offsetHours: 6,
      title: "Offer is open",
      phaseId: "consumption",
      purpose:
        "Warm traffic who engaged with the webinar already knows the offer exists — this is the moment to say it plainly instead of waiting for them to go looking.",
      angle: "Warm-traffic offer reveal",
      goals: [
        "Tell people who engaged with the webinar that the offer is live",
        "Make the next step obvious with no extra steps to find it",
      ],
      persuasionElements: ["Offer: core offer revealed plainly", "Audience: warm traffic already primed"],
      fields: adFields,
    },
    {
      id: "email-second-chance",
      channel: "email",
      anchor: "event",
      offsetHours: 27, // ~1 day after the welcome email
      title: "Did you catch the replay?",
      phaseId: "consumption",
      purpose:
        "A day later, most people still haven't watched. This is the second — not last — nudge back to the replay, with just enough social proof to make it worth the time.",
      angle: "Second-chance exposure",
      goals: [
        "Increase replay viewership from people who skipped it the first time",
        "Add light social proof to justify the time investment",
      ],
      persuasionElements: ["Pain: still stuck without the solution", "Proof: light social proof to justify the time"],
      fields: shortLong,
    },

    // --- Consideration & connection: rapport, credibility, social proof ---
    {
      id: "email-story-time",
      channel: "email",
      anchor: "event",
      offsetHours: 51, // ~1 day after email-second-chance
      title: "A confession",
      phaseId: "consideration-connection",
      purpose:
        "Nobody buys from a highlight reel. This is where the mask comes off — one real, specific moment of struggle, told honestly enough that the reader feels understood rather than marketed to, which makes the eventual offer feel earned instead of lucky.",
      angle: "Vulnerability + identification",
      goals: [
        "Admit to one specific, slightly embarrassing moment of the same struggle the reader has, not a vague 'I used to struggle too'",
        "Write it like a real person being honest, not a brand being relatable — no tidy lesson learned in the same breath as the confession",
        "Make the bond emotional, not just informational, before pointing anywhere near the offer",
        "Lead naturally back to the replay for anyone who hasn't seen it",
      ],
      persuasionElements: ["Story: protagonist's original situation and turning point", "Identity: who they'll become"],
      fields: shortLong,
    },
    {
      id: "email-paradigm-shift",
      channel: "email",
      anchor: "event",
      offsetHours: 75, // ~1 day after email-story-time
      title: "The ugly truth about [common belief]",
      phaseId: "consideration-connection",
      purpose:
        "Take something this audience already believes and flip it on its head. Shifting how someone thinks earns more influence than any single fact ever could.",
      angle: "Kill the sacred cow",
      goals: [
        "Name a common belief in this space and show why it's wrong",
        "Replace it with a clearer, truer way to think about the problem",
        "Position this offer as the one built around that truer model",
      ],
      persuasionElements: ["Objections: a wrong existing belief", "Solution: the unique mechanism, why this is different"],
      fields: shortLong,
    },
    {
      id: "email-social-proof",
      channel: "email",
      anchor: "event",
      offsetHours: 99, // ~1 day after email-paradigm-shift
      title: "Will this work for you?",
      phaseId: "consideration-connection",
      purpose:
        "By now the skeptical question isn't 'does this work' but 'will it work for me.' This email answers that with real results, not more claims.",
      angle: "FOMO via social proof stack",
      goals: [
        "Show results from more than one kind of person, not a single outlier",
        "Make clear the same path is open to this reader specifically",
        "Point straight at the next step for anyone who's convinced",
      ],
      persuasionElements: ["Proof: testimonials and case studies", "Desire: visualize the same result for themselves"],
      fields: shortLong,
    },

    // --- Conversion: the direct ask ---
    {
      id: "email-takeaway-selling",
      channel: "email",
      anchor: "event",
      offsetHours: 123, // ~1 day after email-social-proof
      title: "Who should NOT buy this",
      phaseId: "conversion",
      purpose:
        "Counterintuitively, telling people who this ISN'T for sells harder than telling everyone to buy. It filters for the right buyers and makes the ones who stay feel chosen, not sold to.",
      angle: "Takeaway selling",
      goals: [
        "Name 2-3 kinds of people who should NOT buy",
        "Make clear this isn't a fit for everyone, on purpose",
        "Let the right buyers self-select in, not be pushed in",
      ],
      persuasionElements: ["Risk: who it's not for, named explicitly", "Solution: fit and eligibility"],
      fields: shortLong,
    },
    {
      id: "email-faq",
      channel: "email",
      anchor: "event",
      offsetHours: 147, // ~1 day after email-takeaway-selling
      title: "Your questions, answered",
      phaseId: "conversion",
      purpose:
        "By this point the real objections are known and repeating. This email answers them directly instead of letting them sit unspoken and quietly kill the sale.",
      angle: "Objection-crushing FAQ",
      goals: [
        "Answer the specific questions people keep asking",
        "Close out the price objection with a direct comparison, not a dodge",
        "Leave one open door for anything not covered",
      ],
      persuasionElements: ["Objections: price, trust, timing, fit", "Risk: guarantee or terms, stated plainly"],
      fields: shortLong,
    },
    {
      id: "email-recap-offer",
      channel: "email",
      anchor: "event",
      offsetHours: 171, // ~1 day after email-faq
      title: "Quick recap: why you're here",
      phaseId: "conversion",
      purpose:
        "A short reminder of why they opted in, followed by the clearest, shortest version of the offer you can write. No new information, just clarity.",
      angle: "Elevator-pitch recap",
      goals: [
        "Remind them why they opted in to begin with",
        "State the offer in 2-4 plain sentences, no fluff",
        "Make the single next action obvious",
      ],
      persuasionElements: ["Offer: total value and price justification", "Desire: the emotional payoff, recapped"],
      fields: shortLong,
    },
    {
      id: "sms-reinforce-offer",
      channel: "sms",
      anchor: "event",
      offsetHours: 180, // same day as email-recap-offer, different channel
      title: "Offer reminder text",
      phaseId: "conversion",
      purpose:
        "Same message, different channel. Some people only act from a text, not an inbox they've stopped checking as closely.",
      angle: "Multi-channel urgency nudge",
      goals: ["Reinforce the same offer through a channel email can't reach"],
      persuasionElements: ["Urgency: same deadline, different channel"],
      fields: smsFields,
    },
    {
      id: "email-gratitude",
      channel: "email",
      anchor: "event",
      offsetHours: 195, // ~1 day after email-recap-offer
      title: "Thank you",
      phaseId: "conversion",
      purpose:
        "Whether or not someone bought, saying thank you keeps goodwill high and keeps the relationship open past this one campaign.",
      angle: "Goodwill gratitude + soft pitch",
      goals: [
        "Thank everyone for sticking with the sequence, buyer or not",
        "Give something free regardless of purchase",
        "Leave one more easy door open to the offer",
      ],
      persuasionElements: ["Story: thank-you and goodwill", "Offer: one more easy, low-pressure door"],
      fields: shortLong,
    },

    // --- Marketing intel: last-minute recovery + honest feedback ---
    {
      id: "email-marketing-intel",
      channel: "email",
      anchor: "event",
      offsetHours: 219, // ~1 day after email-gratitude
      title: "Quick favor — why not?",
      phaseId: "marketing-intel",
      purpose:
        "Anyone still here didn't say no, they just didn't say yes yet. Asking why, with zero pressure, surfaces the real objection — sometimes straight into a sale.",
      angle: "Non-buyer intel question",
      goals: [
        "Ask the people who haven't bought exactly why, without pressure",
        "Surface objections worth answering directly, by reply",
        "Catch the rare reply that turns straight into a sale",
      ],
      persuasionElements: ["Objections: surface the real one, unprompted", "Audience: hear it in their own words"],
      fields: shortLong,
    },
    {
      id: "email-final-reopen",
      channel: "email",
      anchor: "event",
      offsetHours: 267, // ~2 days after email-marketing-intel
      title: "Last call",
      phaseId: "marketing-intel",
      purpose:
        "The sequence is ending, which is itself a reason to act for anyone who was genuinely close. One last honest reason the door is still open, then it closes.",
      angle: "Last-chance re-open",
      goals: [
        "Acknowledge the sequence is ending",
        "Give one real reason the offer is still available (not a fake deadline)",
        "Make the final ask easy to act on immediately",
      ],
      persuasionElements: ["Urgency: a real reason the door reopens, not a fake deadline", "Offer: the easiest possible final ask"],
      fields: shortLong,
    },
  ],
};
