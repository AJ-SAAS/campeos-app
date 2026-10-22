// The play library: the proven message structures every campaign is
// built from. A campaign template (lib/templates/*) says WHEN each message
// goes out and WHY; its play says HOW the message is built, beat by beat,
// the way a working copywriter would lay it out before writing a word.
//
// The email plays in the "backend" group come straight from a real
// copywriter's 11-day post-webinar sequence (welcome, second chance,
// story time, paradigm shift, social proof, takeaway, FAQ, recap,
// gratitude, why not, last minute). The rest cover what the other
// campaign types need: launches, sales, deadlines, win-back, lead gen,
// calls, giveaways and brand.
//
// Writing rules for beats: each beat is one instruction the model can
// follow in order. Beats point at the campaign brief (lib/ai/brief.ts)
// by name, e.g. "the reader's moment", "one pain", "the enemy", so the
// copy is built from research, not from thin air.

export type PlayFocus =
  | "pain"
  | "desire"
  | "proof"
  | "objection"
  | "story"
  | "offer"
  | "urgency"
  | "curiosity"
  | "enemy";

export interface Play {
  id: string;
  name: string;
  /** What the reader should feel or do by the end, in one line. */
  job: string;
  /** The message, beat by beat, in order. */
  beats: string[];
  /** Subject line / headline / hook patterns that fit this play. */
  hooks: string[];
  /** Which part of the brief this play leads with. Used to give each
   * message in a campaign a different thing to open on. */
  focus: PlayFocus;
  /** Play-specific traps to avoid. */
  avoid?: string[];
}

const P = (p: Play) => p;

export const PLAYS: Record<string, Play> = {
  /* ------------------------------------------------------------ */
  /* Webinar / event: getting people in the room                    */
  /* ------------------------------------------------------------ */

  "invite": P({
    id: "invite",
    name: "Direct invitation",
    job: "Make the event feel made for this reader and get the registration.",
    beats: [
      "Open on the reader's moment: a small, specific scene of the problem showing up in their day.",
      "Name what the event is in one plain sentence: what it is and when (use the real event time). Mention how long it runs or that it's free only if you were told; never leave a blank for it.",
      "Give 3 short bullets of what they'll walk away knowing. Each bullet is a specific outcome or a curiosity gap, never a topic label.",
      "Say who it is for in one line, and one line on who it is not for.",
      "One call to action with [LINK]. Tell them exactly what happens when they click.",
    ],
    hooks: ["You're invited: <the outcome, not the topic>", "<Day> at <time>: <the outcome>", "A free class on <specific outcome>"],
    focus: "desire",
  }),

  "whats-inside": P({
    id: "whats-inside",
    name: "What you'll learn",
    job: "Make the content feel so specific they'd feel silly missing it.",
    beats: [
      "Open by picking up a thread: they signed up (or should), and here is exactly what they'll see.",
      "3 to 5 bullets in the 'how to X without Y' or 'the one Z that W' shape. Each one names a specific result and hides the method.",
      "Future pace: one short paragraph of what their week looks like after using even one of these.",
      "Remind them of the real time and day, and that showing up live matters (one honest reason why).",
      "Call to action with [LINK].",
    ],
    hooks: ["What you'll learn on <day>", "<Number> things I'll show you live", "The <specific> I'm covering <day>"],
    focus: "curiosity",
  }),

  "pre-event-story": P({
    id: "pre-event-story",
    name: "Why this matters now",
    job: "Turn a registration into a commitment to show up.",
    beats: [
      "Open with a short, specific scene from the reader's world where the cost of the problem is felt.",
      "Name the stakes: what staying the same costs them over the next few months, in plain terms.",
      "Bridge: tomorrow's event is the shortest path to a different answer. Say the one insight they'll get.",
      "Ask them to put it in their calendar now. Give the real time.",
      "Call to action with [LINK].",
    ],
    hooks: ["Why I'm doing this <day>", "Before tomorrow", "This is costing you more than you think"],
    focus: "pain",
  }),

  "starting-soon": P({
    id: "starting-soon",
    name: "Starting soon",
    job: "Get them to click in the final hours.",
    beats: [
      "Lead with the time: we start at <real time>, in <hours> hours.",
      "One line on the single most useful thing they'll see.",
      "One line on why live beats the replay (questions answered, a live-only bonus if one exists, or just focus).",
      "Call to action with [LINK]. Short email, under 80 words.",
    ],
    hooks: ["Starting in <x> hours", "Tonight at <time>", "Grab a coffee, we start at <time>"],
    focus: "urgency",
  }),

  "live-now": P({
    id: "live-now",
    name: "We're live",
    job: "One tap to join.",
    beats: ["Say it's live right now.", "One reason to join this minute.", "[LINK]. Nothing else."],
    hooks: ["We're live", "Live now"],
    focus: "urgency",
  }),

  /* ------------------------------------------------------------ */
  /* The 11-day backend (from the copywriter's swipe file)          */
  /* ------------------------------------------------------------ */

  "welcome-replay": P({
    id: "welcome-replay",
    name: "Welcome + replay link",
    job: "Hand over the replay with no gatekeeping and get a reply.",
    beats: [
      "Open personally: '<sign-off name> here.' then say you're glad they grabbed the training.",
      "Give the replay link straight away with [LINK].",
      "Sell the replay in 2 to 3 sentences: what it shows and the result it points to. Make it sound worth 45 minutes.",
      "Set up the next few days: what you'll send and why it's worth opening.",
      "One line on why the next emails are worth opening, specific to what they'll get. No generic promise to earn their attention.",
      "P.S. Ask ONE simple question they can answer by hitting reply, about their goal or what's holding them back.",
    ],
    hooks: ["Your replay is here", "Welcome in", "Did you see the training?", "First of many"],
    focus: "desire",
  }),

  "second-chance": P({
    id: "second-chance",
    name: "Did you catch the replay?",
    job: "Get the people who skipped it to watch, with light proof.",
    beats: [
      "Open: a couple of days ago they signed up for <the training>. Say what it is in one elevator-pitch line.",
      "Say people have told you it's better than paid stuff, only if the brief has proof; otherwise use [PROOF].",
      "Give the link again 'just in case' with [LINK].",
      "Mention there's an offer at the end and the result it gets.",
      "2 to 3 bullets of outcomes buyers want, then one line of the pains they'd leave behind.",
      "Close: if they want those results, watch it. [LINK].",
    ],
    hooks: ["Did you see the training?", "Open this if you signed up", "Last link for the replay"],
    focus: "desire",
  }),

  "story-time": P({
    id: "story-time",
    name: "A confession",
    job: "Build a real bond by showing the struggle behind the result.",
    beats: [
      "Open on the highlight reel: everyone shows their wins, never the losses. Paint 2 or 3 quick, specific images of what the audience sees others enjoying.",
      "Admit you do it too. If the brief has real credentials, mention one; otherwise [YOUR WIN].",
      "Turn: admit it wasn't always like this, in your own words.",
      "The struggle: the same obstacles and feelings the reader has now, in their words from the brief. If the seller's real story is in the research, use it. If not, use ONE [YOUR STORY] placeholder for the personal details, and make the rest of the email about the reader's version of the struggle so it still works.",
      "What you tried that didn't work (the reader's failed alternatives).",
      "The breakthrough: the discovery that became the method. Name the mechanism from the brief.",
      "Point to the replay with [LINK], and mention the offer at the end without pushing.",
    ],
    hooks: ["A confession", "Story time", "Can you keep this between us?", "Mask off"],
    focus: "story",
    avoid: ["Never invent personal life events, dates or numbers. Use [YOUR STORY] for the real details."],
  }),

  "paradigm-shift": P({
    id: "paradigm-shift",
    name: "Kill the sacred cow",
    job: "Flip a belief the reader holds, so the offer becomes the obvious answer.",
    beats: [
      "Subject names the belief being overturned (the enemy from the brief).",
      "Open straight on the belief and say plainly that it's wrong. Bold, but in your own words, never a stock line like 'this will make some people mad'.",
      "State the common belief: most people think <enemy> is the key to <desire>.",
      "Flip it: what if that's the worst thing you can do? Say why in plain words.",
      "Show the cost: keep doing it and you stay stuck in the cycle, feeling <emotion from brief>.",
      "The truth: the new way of thinking (the mechanism). Make it concrete with one example.",
      "Bridge to the offer as the best way to do the new way. [LINK].",
    ],
    hooks: ["Stop doing <enemy>", "The ugly truth about <enemy>", "<Enemy> vs <new way>", "Why <enemy> is the worst thing you can do"],
    focus: "enemy",
  }),

  "social-proof": P({
    id: "social-proof",
    name: "Will this work for you?",
    job: "Make the result feel possible for someone like them, and add FOMO.",
    beats: [
      "Open with the question in their head: will this actually work for me?",
      "Testimonial barrage: 2 to 4 short results. Use real ones from the brief's proof only. If there are none, write [TESTIMONIAL 1], [TESTIMONIAL 2].",
      "Turn: these results are impressive, but not unique. Many others have done it.",
      "The real test: the only way to know is to bet on yourself. Dive in, don't dip a toe.",
      "Remove the risk: the guarantee from the brief if there is one, otherwise [GUARANTEE].",
      "Call to action with [LINK]: one specific next step, said plainly.",
    ],
    hooks: ["Will this work for you?", "Does this actually work?", "This won't work for you...", "Results?"],
    focus: "proof",
    avoid: ["Never invent a testimonial, name or number. Placeholders only."],
  }),

  "takeaway": P({
    id: "takeaway",
    name: "Who should NOT buy",
    job: "Sell by pushing the wrong people away, so the right ones lean in.",
    beats: [
      "Open: what the offer is, the one result it gets, and the thing they hate that it avoids. [LINK].",
      "Be upfront: it isn't for everyone. It isn't a silver bullet.",
      "Who should not buy, 3 types, each with a short 'why': people who quit at the first bump; people who want it with zero work; people who buy courses and never use them. Adapt the three to this audience.",
      "Who it IS for: people willing to do the work to get <desire>.",
      "If that's you, here's the link. [LINK].",
    ],
    hooks: ["3 people who should NOT buy this", "Why you shouldn't buy", "This won't work for you if...", "Banned"],
    focus: "objection",
  }),

  "faq": P({
    id: "faq",
    name: "Your questions, answered",
    job: "Clear the last objections in one skimmable email.",
    beats: [
      "Open: you've had a few of the same questions about the offer, which is open until <real deadline>.",
      "4 to 6 Q and A pairs, each separated clearly. Cover: what's included, how much it costs (anchor the price against the cost of the problem), is there a guarantee, will it work for me even if <objection from brief>, how fast will I see results.",
      "Answers are short and direct. Use [PLACEHOLDER] for any fact the brief doesn't have.",
      "A [LINK] after the key answers.",
      "Close with one line inviting them to reply with any other question.",
    ],
    hooks: ["What the FAQ?", "Your questions, answered", "Questions about <offer>?"],
    focus: "objection",
  }),

  "recap-offer": P({
    id: "recap-offer",
    name: "Quick recap: why you're here",
    job: "Reconnect them with their original reason, then give the elevator pitch.",
    beats: [
      "Open: a few days ago you came across this, signed up and watched. Something made you want to learn more.",
      "Maybe it was <desire>. Or maybe you'd hit your breaking point with <pain>. Dig in on the pain.",
      "Ask them to remember their main reason. What made them want change?",
      "Be frank: this offer is the best way to get <desire>.",
      "Elevator pitch: in 2 to 4 sentences, what makes it different (the mechanism) and its main benefit.",
      "If you're serious about <desire>, here's the link. [LINK].",
    ],
    hooks: ["Quick recap", "Why did you join?", "What's your why?"],
    focus: "desire",
  }),

  "gratitude": P({
    id: "gratitude",
    name: "Thank you",
    job: "Build goodwill, give something free, and make one last soft pitch.",
    beats: [
      "Thank them for reading this week's emails, lightly and in your own words.",
      "Share that people have joined and you're glad to help them get <desire>. Use [NUMBER] if no real count is given.",
      "Give something free even if they didn't buy: a free resource, group or video. [LINK].",
      "P.S. If they want <desire> without <thing they hate>, here's the offer. [LINK].",
    ],
    hooks: ["Thank you", "I'm grateful", "A gift for you"],
    focus: "offer",
  }),

  "why-not": P({
    id: "why-not",
    name: "Quick favor: why not?",
    job: "Get non-buyers to reply with their real objection.",
    beats: [
      "Super short. One quick question for those who haven't joined yet: why?",
      "Ask if something is holding them back, or if something feels missing.",
      "Say you're not here to pressure them. You genuinely want to hear it, to make the offer better.",
      "Ask them to hit reply. It goes to your own inbox and you read every one.",
      "P.S. If you're ready, here's the link. [LINK].",
    ],
    hooks: ["Why?", "Quick favor", "Question?", "?"],
    focus: "objection",
    avoid: ["Under 120 words. No selling in the body."],
  }),

  "last-minute": P({
    id: "last-minute",
    name: "Last call / re-open",
    job: "A final, honest second chance for the people who missed it.",
    beats: [
      "Open: you got a few emails from people who missed it.",
      "Own part of it (maybe you didn't send enough reminders). Most had real reasons: life gets in the way.",
      "Quote one reason someone gave, as [QUOTE FROM A READER] unless the brief has one.",
      "The reopen: a couple of spots opened, or you extended it briefly. Use [EXTENSION DETAILS] if not given.",
      "Link and a clear end time. [LINK].",
    ],
    hooks: ["Did you email me?", "Did I miss you?", "Left you hanging?", "Last questions?"],
    focus: "urgency",
    avoid: ["Never invent fake scarcity. If the brief has no real deadline, use [DEADLINE]."],
  }),

  /* ------------------------------------------------------------ */
  /* Launches                                                       */
  /* ------------------------------------------------------------ */

  "launch-teaser": P({
    id: "launch-teaser",
    name: "Something's coming",
    job: "Create a curiosity gap before the launch.",
    beats: [
      "Open on the problem in the reader's words.",
      "Hint that you've been working on a fix for a while, without naming it.",
      "Give one specific, intriguing detail about what it does.",
      "Say when they'll hear more (real date if given, otherwise [LAUNCH DATE]).",
      "Ask them to reply or watch for the next email. No hard sell.",
    ],
    hooks: ["Something I've been working on", "Coming <day>", "I can't say much yet, but..."],
    focus: "curiosity",
  }),

  "doors-open": P({
    id: "doors-open",
    name: "Doors are open",
    job: "Announce the offer clearly and get the first buyers.",
    beats: [
      "Lead with the news: it's open, right now.",
      "What it is in one line, and the main result.",
      "The offer stack: what's included, as short bullets.",
      "Price and any launch-only bonus or price, plus the real deadline.",
      "Who it's for in one line.",
      "Call to action with [LINK].",
    ],
    hooks: ["It's open", "Doors are open", "<Offer> is live"],
    focus: "offer",
  }),

  "case-study": P({
    id: "case-study",
    name: "Case study",
    job: "Prove it works with one before-and-after story.",
    beats: [
      "Open in the middle of the customer's before: a specific frustrating moment. Use [CUSTOMER NAME] and [THEIR SITUATION] unless real ones are in the brief.",
      "What they tried before that didn't work.",
      "The turning point: why they chose this.",
      "What they did, step by step, briefly.",
      "The after: the result, using [RESULT] unless real.",
      "The lesson for the reader, then the offer with [LINK].",
    ],
    hooks: ["How <customer> went from <before> to <after>", "<Result> in <time>", "She almost didn't do it"],
    focus: "proof",
    avoid: ["Never invent customer names, numbers or quotes."],
  }),

  "bonus-reveal": P({
    id: "bonus-reveal",
    name: "Bonus reveal",
    job: "Give a fresh reason to buy now.",
    beats: [
      "Lead with the bonus name and what it does for them.",
      "Why you added it: the objection or problem it solves.",
      "The rule: only for people who join by <real deadline>.",
      "Quick recap of the main offer in one line.",
      "Call to action with [LINK].",
    ],
    hooks: ["New bonus: <bonus>", "I added something", "For the next <time> only"],
    focus: "offer",
  }),

  "objection-crusher": P({
    id: "objection-crusher",
    name: "But what if...",
    job: "Take the single biggest objection head on.",
    beats: [
      "Name the objection in the reader's own words, as a question.",
      "Say why it's a fair worry from their side.",
      "Answer it with a reason, an example, or the guarantee. No hype.",
      "Show what it costs to let that worry decide for them.",
      "Call to action with [LINK].",
    ],
    hooks: ["\"But what if <objection>?\"", "Too <expensive/busy/late>?", "Will this work if <situation>?"],
    focus: "objection",
  }),

  /* ------------------------------------------------------------ */
  /* Sales and deadlines                                            */
  /* ------------------------------------------------------------ */

  "sale-announce": P({
    id: "sale-announce",
    name: "Sale announcement",
    job: "Say what's on sale, how much off, and until when, fast.",
    beats: [
      "The deal in the first line: what, how much off (or [DISCOUNT]), until when.",
      "Why you're running it, in one honest line (the season, a milestone).",
      "What they get, 2 to 3 bullets.",
      "Who should grab it.",
      "Call to action with [LINK] and the real end time.",
    ],
    hooks: ["<Discount> off <offer>, until <day>", "The <season> sale is on", "<Offer>, <discount> off"],
    focus: "offer",
  }),

  "early-access": P({
    id: "early-access",
    name: "Early access",
    job: "Reward the list with first access before the public.",
    beats: [
      "You're on the list, so you get in first.",
      "What's opening and when the public gets it.",
      "The early perk: price, bonus, or first pick. Use [EARLY PERK] if not given.",
      "Call to action with [LINK].",
    ],
    hooks: ["You get in first", "Early access opens now", "Before everyone else"],
    focus: "offer",
  }),

  "countdown": P({
    id: "countdown",
    name: "24 hours left",
    job: "Make the deadline real and personal.",
    beats: [
      "Lead with the time left and the exact end time.",
      "What changes when it ends (price goes up, bonus goes, doors close).",
      "One reminder of the main result.",
      "One line handling 'I'll do it later'.",
      "Call to action with [LINK].",
    ],
    hooks: ["24 hours left", "Ends tomorrow at <time>", "Last day for <deal>"],
    focus: "urgency",
  }),

  "final-hours": P({
    id: "final-hours",
    name: "Final hours",
    job: "Last nudge before close. Short and direct.",
    beats: [
      "A few hours left. Give the exact end time.",
      "One line of what they get.",
      "One line of what happens after it closes.",
      "[LINK]. Under 80 words.",
    ],
    hooks: ["<x> hours left", "Closing tonight", "Last call"],
    focus: "urgency",
  }),

  "extension": P({
    id: "extension",
    name: "Extended",
    job: "An honest extension for the people who asked.",
    beats: [
      "You got messages from people who missed it.",
      "So you're extending it until <real time or [NEW DEADLINE]>. This is the last time.",
      "What they get, one line.",
      "[LINK].",
    ],
    hooks: ["Extended until <time>", "You asked, so...", "One more day"],
    focus: "urgency",
  }),

  "deal-of-day": P({
    id: "deal-of-day",
    name: "Today's deal",
    job: "One deal, today only, easy to act on.",
    beats: [
      "Today's deal in the first line: the product and the price or discount.",
      "Who it's perfect for.",
      "Ends tonight at <time or [END TIME]>.",
      "[LINK].",
    ],
    hooks: ["Today only: <deal>", "Deal #<n>: <product>", "Tomorrow it's gone"],
    focus: "offer",
  }),

  /* ------------------------------------------------------------ */
  /* Win-back, lead gen, calls, giveaways, brand                    */
  /* ------------------------------------------------------------ */

  "win-back": P({
    id: "win-back",
    name: "We miss you",
    job: "Re-start the relationship with someone who went quiet.",
    beats: [
      "Open honestly: it's been a while, and you noticed.",
      "Remind them why they joined in the first place (the desire).",
      "What's new or improved since they last looked.",
      "A reason to come back now: a welcome-back offer if there is one, otherwise [WELCOME BACK OFFER].",
      "Easy next step with [LINK], or ask them to reply if they'd rather not hear from you.",
    ],
    hooks: ["Is this goodbye?", "It's been a while", "Did I do something wrong?"],
    focus: "desire",
  }),

  "lead-magnet": P({
    id: "lead-magnet",
    name: "Free resource",
    job: "Get the download or opt-in.",
    beats: [
      "Open on the reader's moment of the problem.",
      "Name the free resource and the one quick win it gives.",
      "3 bullets of what's inside, specific.",
      "It's free, takes <minutes> to use.",
      "[LINK].",
    ],
    hooks: ["Free: <resource>", "The <resource> I use for <outcome>", "Steal my <resource>"],
    focus: "pain",
  }),

  "hand-raiser": P({
    id: "hand-raiser",
    name: "Hand-raiser",
    job: "Find who's interested with one easy reply.",
    beats: [
      "Very short. One question: would you want <specific outcome> if I could help with it?",
      "One line of context on what you'd do.",
      "Ask them to reply with one word (like 'yes' or 'me').",
      "No link. Under 70 words.",
    ],
    hooks: ["Quick question", "Yes or no?", "Interested?"],
    focus: "desire",
  }),

  "book-call": P({
    id: "book-call",
    name: "Book a call",
    job: "Get qualified people on a call.",
    beats: [
      "Open on the reader's situation and the outcome they want.",
      "What the call is: how long, what you'll cover, what they'll leave with even if they don't buy.",
      "Who it's for and who it isn't for.",
      "Limited spots only if the brief says so; otherwise just a clear next step.",
      "[LINK] to book.",
    ],
    hooks: ["Want help with <outcome>?", "<Minutes> minutes to map out <outcome>", "Free strategy call"],
    focus: "desire",
  }),

  "giveaway": P({
    id: "giveaway",
    name: "Giveaway",
    job: "Get entries fast with clear rules.",
    beats: [
      "Lead with the prize and why it's worth wanting.",
      "How to enter: 1 to 3 simple steps.",
      "When it ends and when the winner is picked (or [END DATE]).",
      "[LINK] or the action to take.",
    ],
    hooks: ["Win <prize>", "Giveaway: <prize>", "Want <prize> for free?"],
    focus: "desire",
  }),

  "newsletter-value": P({
    id: "newsletter-value",
    name: "Value email",
    job: "Teach one useful thing so they keep opening.",
    beats: [
      "Open with a specific observation or story from the reader's world.",
      "The lesson: one idea, explained simply with one example.",
      "How to use it today, in 1 to 3 steps.",
      "A soft mention of the offer with [LINK], or none.",
    ],
    hooks: ["The <specific> mistake", "What I learned from <specific>", "Try this today"],
    focus: "curiosity",
  }),

  "brand-story": P({
    id: "brand-story",
    name: "What we believe",
    job: "Make the brand feel human and worth trusting.",
    beats: [
      "Open with what you believe that others in the space don't (the enemy).",
      "Why: a short origin moment. Use [YOUR STORY] for real details.",
      "What that means for how you do things.",
      "Invite them in. [LINK] or a reply.",
    ],
    hooks: ["Why we do it differently", "What we believe", "The reason we started"],
    focus: "enemy",
  }),

  /* ------------------------------------------------------------ */
  /* Video: title angles plus a plan, never a word-for-word script  */
  /* ------------------------------------------------------------ */

  "video-pitch": P({
    id: "video-pitch",
    name: "Video: why now",
    job: "A short video from the seller that gives one honest reason to act before the deadline.",
    beats: [
      "titles: 3 title ideas, each a different angle (for example the reader's problem, the deadline, a question they are asking). Each under 70 characters, plain words, no clickbait the video cannot pay off.",
      "summary: 2 to 3 plain sentences on what the video is about and what the viewer will know or feel by the end.",
      "bullets: 4 to 6 short bullets of what to say, in order: the hook, the problem, the proof or story only if one was given, the offer in one line, the deadline, and the call to action.",
    ],
    hooks: ["The real reason this ends <day>", "Before this closes: 3 things to know", "Should you get <offer>? An honest answer"],
    focus: "urgency",
    avoid: ["Do not write a word-for-word script.", "Never invent a story, a customer or a number. Use [YOUR STORY] for details only the seller knows."],
  }),

  "video-story": P({
    id: "video-story",
    name: "Video: the story behind the sale",
    job: "Build trust before any discount shows up, by telling why this sale exists.",
    beats: [
      "titles: 3 title ideas, each a different angle (the question people ask, a confession, the reason). Each under 70 characters, plain words, honest.",
      "summary: 2 to 3 plain sentences: a real story that shows why this sale exists, with no pitch in it.",
      "bullets: 5 to 6 short bullets in order: open on a real moment (use [YOUR STORY] for personal details), what you used to believe, what changed, why you run this sale, a hint of what is coming and the real date, where to join the list (link in the description).",
    ],
    hooks: ["Why I only run one sale a year", "The real reason behind this sale", "What I wish I knew before my first sale"],
    focus: "story",
    avoid: ["Do not write a word-for-word script.", "Never invent a personal story, a date or a number. Use [YOUR STORY] for details only the seller knows."],
  }),

  "video-qa": P({
    id: "video-qa",
    name: "Video: live Q&A before the sale",
    job: "Answer the real questions out loud so the doubts are gone before the sale opens.",
    beats: [
      "titles: 3 title ideas, each a different angle (ask me anything, the questions people keep sending, should you wait for the sale). Each under 70 characters.",
      "summary: 2 to 3 plain sentences: a live session where you answer questions about the offer before the sale, and what people leave knowing.",
      "bullets: 5 to 6 short bullets in order: welcome and what you will cover, the 3 to 5 questions buyers ask most (use the doubts in the brief, otherwise [QUESTION 1], [QUESTION 2]), one honest line on who it is not for, a hint of the sale and its real date, how to join the list, ask them to drop questions in the chat.",
    ],
    hooks: ["Ask me anything before the sale", "The questions you keep sending me", "Should you wait for the sale? Live answers"],
    focus: "objection",
    avoid: ["Do not write a word-for-word script.", "Never invent a question a real customer asked. Use [QUESTION] placeholders if the brief has none."],
  }),

  "video-short": P({
    id: "video-short",
    name: "Short video: who it is for",
    job: "In 30 seconds, make the right person think 'that is me'.",
    beats: [
      "titles: 3 hook lines for the first two seconds of a vertical video, each a different angle. Each under 70 characters, said out loud like a person.",
      "summary: 1 to 2 plain sentences on what the clip shows and the one thing the viewer should feel.",
      "bullets: 4 to 5 short beats for a 20 to 30 second clip: the hook, 'this is for you if' with two real examples from the audience, one 'not for you if', what is coming and the real date, the call to action.",
    ],
    hooks: ["This is for you if...", "Stop scrolling if you <situation>", "Not for everyone, but maybe for you"],
    focus: "desire",
    avoid: ["Do not write a word-for-word script.", "Never invent a customer or a number."],
  }),

  "email-open-loop": P({
    id: "email-open-loop",
    name: "A story that asks a question",
    job: "Earn attention and open a question the next email answers. No pitch.",
    beats: [
      "Subject: a short, curious line a friend would send. No sale words.",
      "Open on a small, specific scene from the season that the reader will recognize (a full inbox, a rush, a deadline). Use the reader's words from the brief.",
      "A short, honest reason you do this at all, in your own words. Use ONE [YOUR STORY] placeholder for personal details; the rest must still work without it.",
      "Say the open question out loud, exactly as the step gives it. Then say plainly that you will answer it on the real date you were given (otherwise [DAY]).",
      "No offer, no price, no link to buy. One soft line: reply and tell me your guess.",
    ],
    hooks: ["Can I ask you something?", "I have a confession about this time of year", "A question for you"],
    focus: "curiosity",
    avoid: ["Do not pitch or name a price.", "Never invent personal life events, dates or numbers."],
  }),

  "loop-answer": P({
    id: "loop-answer",
    name: "The answer, and the waitlist opens",
    job: "Pay off the open question and move the reader onto the waitlist.",
    beats: [
      "Open by picking up the question from the last email, in one line.",
      "The answer in 2 plain sentences: what is in the offer (use the stack from the brief, otherwise [WHAT'S INCLUDED]) and why it is worth waiting for.",
      "What the waitlist gets: first access and any early perk from the brief, otherwise [EARLY PERK]. Say exactly when the waitlist gets in (the real time if given).",
      "Who it is for in one line.",
      "One call to action: join the waitlist with [LINK]. Say what happens when they click.",
    ],
    hooks: ["Here's the answer", "What's in it, and the waitlist", "You asked, so here it is"],
    focus: "offer",
  }),

  "waitlist-nudge": P({
    id: "waitlist-nudge",
    name: "Waitlist reminder",
    job: "Get the people who have not joined the list yet to do it before early access.",
    beats: [
      "Open with the one thing that is true now: the waitlist is open and early access starts on the real date.",
      "What they get by being on it, in 2 or 3 short bullets, using only perks from the brief (otherwise [EARLY PERK]).",
      "One honest reason to join now and not later. Only use scarcity if it is real.",
      "One call to action: join with [LINK].",
    ],
    hooks: ["The list is open", "Get on the list before <day>", "Your spot on the list"],
    focus: "offer",
    avoid: ["Do not invent a spot count or a deadline for the waitlist."],
  }),

  "doors-tomorrow": P({
    id: "doors-tomorrow",
    name: "Doors open tomorrow",
    job: "Get the list ready to act the minute the sale opens.",
    beats: [
      "Lead with tomorrow: the real day and time the sale opens, and who gets in first.",
      "A short reminder of what is in it and the main result.",
      "How to be ready: be on the list, have the link, set a reminder. Keep it to three short lines.",
      "One line that handles 'I will look later': what changes once it is open.",
      "Call to action with [LINK].",
    ],
    hooks: ["Doors open tomorrow", "Tomorrow at <time>", "Be ready for tomorrow"],
    focus: "urgency",
  }),

  "post-behind-scenes": P({
    id: "post-behind-scenes",
    name: "Behind the scenes post",
    job: "Show what is inside the sale so people want a place on the list.",
    beats: [
      "First line: a 'here is what I have been putting together' hook that works before 'more'.",
      "2 to 4 short lines on what is in it, using only things from the offer.",
      "One line on why you built it this way.",
      "One call to action: join the list (link in bio or the link in the post).",
    ],
    hooks: ["What I've been building for Black Friday", "A look inside the sale", "Here's what's in it"],
    focus: "curiosity",
  }),

  "post-sale": P({
    id: "post-sale",
    name: "Sale is live post",
    job: "Say it is live, what it is and when it ends, in a few lines.",
    beats: [
      "First line: it is live, and the offer in a few words.",
      "2 to 3 short lines: what is included, the price or discount, and the real end time.",
      "One call to action with the link.",
    ],
    hooks: ["It's live", "The sale is on", "<Offer> is open until <time>"],
    focus: "offer",
  }),

  "ad-waitlist": P({
    id: "ad-waitlist",
    name: "Waitlist ad",
    job: "Turn people who already know you into names on the waitlist.",
    beats: [
      "Headline: the result and 'get on the list', under 40 characters.",
      "Primary text: speak to people who already know you or bought before, say what the list gets (early access and any real perk), and the date early access opens.",
      "One call to action to join.",
      "Visual idea: one line on what to show.",
    ],
    hooks: ["Get on the list", "First in line", "Join before <day>"],
    focus: "offer",
  }),

  "gift-pick": P({
    id: "gift-pick",
    name: "Who it is a great gift for",
    job: "Help a buyer picture the person they are buying for.",
    beats: [
      "Open with the gift question: who is hard to buy for this year?",
      "3 short 'perfect for' lines, each a real type of person from the audience.",
      "What the person gets and how it feels to receive it, in plain words.",
      "The price in one line and the real end date of the sale.",
      "Call to action with [LINK].",
    ],
    hooks: ["Who's hard to buy for?", "The gift that does not need wrapping", "3 people this is perfect for"],
    focus: "desire",
  }),

  "order-by": P({
    id: "order-by",
    name: "Order by date",
    job: "Make the delivery cut-off the reason to buy now.",
    beats: [
      "Lead with the last day to order so it arrives in time: the real date if given, otherwise [ORDER-BY DATE]. If the offer is digital and arrives right away, say it works as a last-minute gift instead.",
      "What happens after that date, in one line.",
      "One line of what they get.",
      "Call to action with [LINK].",
    ],
    hooks: ["Last day to order", "Order by <date>", "Still time to give this"],
    focus: "urgency",
    avoid: ["Never invent a shipping date or a promise. Use [ORDER-BY DATE] if it is not given."],
  }),

  "store-listing": P({
    id: "store-listing",
    name: "App Store listing",
    job: "Make the right person tap Get, using only what the app really does.",
    beats: [
      "appName and subtitle: the real name, then what the app does for the user in plain words. Both at most 30 characters.",
      "promo: one line, at most 170 characters, on the one thing worth knowing right now.",
      "keywords: words real people would search, at most 100 characters, comma separated, no spaces after commas, nothing already in the name or subtitle.",
      "description: the first two lines are the whole pitch, because only they show before 'more'. Name the reader's problem or the result, not the app.",
      "description: then 3 to 5 short feature bullets using only features the offer says exist, and one closing line that says who it is for.",
    ],
    hooks: [],
    focus: "desire",
    avoid: ["Never invent a feature, a rating, an award or a press quote.", "No words like 'best', '#1' or 'revolutionary'. Apple can reject them."],
  }),

  "video-demo": P({
    id: "video-demo",
    name: "Video: show the app",
    job: "Show the app solving the problem in under a minute, so people want it on their phone.",
    beats: [
      "titles: 3 title ideas, each a different angle (the problem, the result, a first look). Each under 70 characters.",
      "summary: 2 to 3 plain sentences: what the video shows and what the viewer will want to do after.",
      "bullets: 5 to 6 beats in order: the hook (the problem in one line), the app on screen in the first 3 seconds, the 2 or 3 taps that solve it, the result, who it is for, how to get it (App Store or the list).",
    ],
    hooks: ["I built an app to <result>", "Watch this take 10 seconds", "A first look at <app>"],
    focus: "desire",
    avoid: ["Do not write a word-for-word script.", "Only show or claim features the offer says exist."],
  }),

  "post-community": P({
    id: "post-community",
    name: "Community post",
    job: "Share the app where makers and users gather, ask for real feedback and sell nothing hard.",
    beats: [
      "First line: the honest reason you built it, in your own words. Sounds like a person, not a launch.",
      "2 to 3 short lines: what it does and who it is for, no hype.",
      "One thing you are unsure about and want feedback on. Real communities respond to that.",
      "A plain link line. Say you read every reply.",
    ],
    hooks: ["I built <thing> because <real reason>", "Looking for feedback on a small app", "Would this be useful to you?"],
    focus: "story",
    avoid: ["Never beg for upvotes or installs.", "Never invent numbers, users or reviews."],
  }),

  "post-app-live": P({
    id: "post-app-live",
    name: "It's on the App Store",
    job: "Say it is live, what it does and where to get it, in a few lines.",
    beats: [
      "First line: it is live, and what it does in a few words.",
      "2 to 3 short lines: who it is for and the one thing it makes easy.",
      "One call to action with the App Store link.",
    ],
    hooks: ["It's live on the App Store", "<App> is out", "Out today: <app>"],
    focus: "offer",
  }),

  "email-beta-invite": P({
    id: "email-beta-invite",
    name: "Early access invite",
    job: "Get the list to try the app first and tell you what they think.",
    beats: [
      "Open on the problem the app solves, in one specific moment.",
      "What it is, one plain sentence, and that they can try it before anyone else.",
      "What early users get (use only real perks, otherwise [EARLY PERK]) and what you ask in return: honest feedback.",
      "One call to action: join with [LINK] (the early access or TestFlight link). Say what happens when they click.",
    ],
    hooks: ["Want to try it first?", "You're early", "Be one of the first to use <app>"],
    focus: "offer",
    avoid: ["Do not invent a spot count."],
  }),

  "email-app-live": P({
    id: "email-app-live",
    name: "The app is live",
    job: "Tell the list it is live and get the first installs.",
    beats: [
      "Lead with the news: it is on the App Store today.",
      "What it does in one line, then 3 short bullets of what they can do with it.",
      "Who it is for in one line.",
      "One call to action with the App Store link. Say it takes under a minute to try.",
      "One line asking them to reply with their first impression.",
    ],
    hooks: ["It's live", "<App> is on the App Store", "Today's the day"],
    focus: "offer",
  }),

  "email-review-ask": P({
    id: "email-review-ask",
    name: "A small favor",
    job: "Ask people who have used the app for an honest rating, politely.",
    beats: [
      "Thank them for trying it, in your own words.",
      "Say what a rating does for a small app, in one honest line.",
      "Ask for an honest rating or review, whatever they think. Never ask for 5 stars.",
      "One line: if something is broken or missing, reply and you will fix it. Link to the App Store review page with [LINK].",
    ],
    hooks: ["A small favor", "Quick question about <app>", "How is it going?"],
    focus: "story",
    avoid: ["Never ask for a 5 star rating or offer a reward for one."],
  }),

  "post-update": P({
    id: "post-update",
    name: "What's new",
    job: "Show the app is alive and listening.",
    beats: [
      "First line: what changed, in a few words.",
      "2 to 3 short lines: what it fixes or adds and who asked for it, only if real.",
      "One call to action: update, or tell me what you want next.",
    ],
    hooks: ["You asked, we built it", "What's new in <app>", "A small update"],
    focus: "proof",
    avoid: ["Never invent a change or a request."],
  }),

  "post-problem": P({
    id: "post-problem",
    name: "The problem moment",
    job: "Make the right person feel seen in the first line.",
    beats: [
      "First line: one specific moment of the problem, in the reader's own words from the brief. It has to work before 'more'.",
      "3 to 4 short lines that make the moment feel real.",
      "One line: if that is you, you are not alone.",
      "One light call to action: follow along, or comment if it is you.",
    ],
    hooks: ["If you've ever <specific moment>", "It's 11 PM and you're still <pain>", "Nobody talks about this part of <topic>"],
    focus: "pain",
  }),

  "post-myth": P({
    id: "post-myth",
    name: "Myth buster",
    job: "Challenge one belief so you look like the person who sees it clearly.",
    beats: [
      "First line: the myth, stated bluntly (the enemy from the brief).",
      "2 to 3 short lines on why it is wrong, in plain words.",
      "One line with the truth.",
      "One call to action: save this, or send it to someone who needs it.",
    ],
    hooks: ["Stop believing <myth>", "Unpopular opinion: <myth> is wrong", "The lie about <topic>"],
    focus: "enemy",
    avoid: ["Never invent a statistic or a study."],
  }),

  "post-tip": P({
    id: "post-tip",
    name: "One quick win",
    job: "Give something useful for free so they trust you before you ask for anything.",
    beats: [
      "First line: the small result this tip gives, specific.",
      "2 to 4 short numbered steps they can do today. Only advice that is true and that you can stand behind.",
      "One line on what they will notice.",
      "One call to action: save it, or follow for more.",
    ],
    hooks: ["Do this today to <result>", "A 2 minute fix for <pain>", "The easiest way to <result>"],
    focus: "desire",
    avoid: ["Never invent a number or a result."],
  }),

  "post-story-mini": P({
    id: "post-story-mini",
    name: "A short story",
    job: "Let people see the person behind the offer.",
    beats: [
      "First line: a specific scene, no setup.",
      "3 to 4 short lines: the struggle, the turn. Use ONE [YOUR STORY] placeholder for personal details.",
      "One line: what it taught you, which is the reader's lesson too.",
      "One soft call to action.",
    ],
    hooks: ["I almost quit when <moment>", "The day I <moment>", "What nobody sees behind <result>"],
    focus: "story",
    avoid: ["Never invent personal life events, dates or numbers. Use [YOUR STORY]."],
  }),

  "post-question": P({
    id: "post-question",
    name: "Conversation starter",
    job: "Get replies, and learn what your audience really thinks.",
    beats: [
      "First line: a real question the audience cares about.",
      "1 to 2 lines on why you are asking.",
      "2 to 3 short answer options, so replying takes five seconds.",
      "One call to action: reply or comment with yours.",
    ],
    hooks: ["Which one are you?", "Quick question for <audience>", "Be honest: <question>?"],
    focus: "curiosity",
  }),

  "post-countdown": P({
    id: "post-countdown",
    name: "Days to go",
    job: "Keep the date in front of people and make the wait feel worth it.",
    beats: [
      "First line: the days left and the real date.",
      "2 to 3 short lines on what happens on the day and why it matters to them.",
      "One call to action: join the list or follow so they do not miss it.",
    ],
    hooks: ["<n> days to go", "Tomorrow", "<n> days until <day>"],
    focus: "urgency",
  }),

  "video-opportunity": P({
    id: "video-opportunity",
    name: "Video 1: the opportunity",
    job: "Show the reader a result they want is possible for them, and why now is the time.",
    beats: [
      "titles: 3 title ideas, each a different angle (the result, the surprising shift, a question). Each under 70 characters, honest.",
      "summary: 2 to 3 plain sentences: the opportunity this video shows and what the viewer will believe by the end.",
      "bullets: 5 to 6 beats in order: the hook (the result they want), why it is possible now, a short real story or proof only if one was given (otherwise [YOUR STORY]), one small thing they can try today, what video 2 covers and the real date.",
    ],
    hooks: ["What's now possible for <audience>", "The shift nobody is talking about", "Could you <result> in <time>?"],
    focus: "desire",
    avoid: ["Do not write a word-for-word script.", "Never invent a story, a customer or a number. Use [YOUR STORY] for details only the seller knows.", "No pitch and no price in this video."],
  }),

  "video-transformation": P({
    id: "video-transformation",
    name: "Video 2: the method",
    job: "Show how the result happens, so the offer feels like the obvious next step.",
    beats: [
      "titles: 3 title ideas, each a different angle (the method, the mistake, the 3 steps). Each under 70 characters.",
      "summary: 2 to 3 plain sentences: the method the video teaches and what the viewer can do differently after.",
      "bullets: 5 to 6 beats in order: a one line recap of video 1, the belief that holds people back (the enemy from the brief), the new way in 2 or 3 steps using the mechanism from the brief, one worked example that is real or clearly general, the biggest doubt answered, what video 3 covers and the real date.",
    ],
    hooks: ["The 3 steps to <result>", "Why <enemy> keeps you stuck", "How <result> actually happens"],
    focus: "enemy",
    avoid: ["Do not write a word-for-word script.", "Never invent a statistic, study or customer.", "No pitch and no price in this video."],
  }),

  "video-ownership": P({
    id: "video-ownership",
    name: "Video 3: picture it",
    job: "Help the viewer picture their life with the result and decide to take the next step.",
    beats: [
      "titles: 3 title ideas, each a different angle (what changes, the choice, the next step). Each under 70 characters.",
      "summary: 2 to 3 plain sentences: what the video helps the viewer see and decide.",
      "bullets: 5 to 6 beats in order: a one line recap, a picture of life after the result in the viewer's words, the real choice between staying where they are and moving, what it takes (honest effort, not hype), that the doors open on the real date and who they are for, how to get ready.",
    ],
    hooks: ["What your day looks like after <result>", "The choice in front of you", "Ready for what is next?"],
    focus: "desire",
    avoid: ["Do not write a word-for-word script.", "Never invent a customer or a number.", "Only mention the offer in the last beats, and only the real date."],
  }),

  "email-content-drop": P({
    id: "email-content-drop",
    name: "Today's video is live",
    job: "Get the list to watch today's video, and want the next one.",
    beats: [
      "Subject: the one thing they will know after watching, not 'video 1 is live'.",
      "Open with one line that picks up where the last touch left off.",
      "3 short bullets of what is in today's video. Each is a specific curiosity gap or outcome, never a topic label.",
      "One call to action: watch with [LINK]. Say how long it takes only if you were told.",
      "One line on what comes next and the real date. No offer, no price.",
    ],
    hooks: ["The 3 steps to <result>", "Did you see this?", "This is why <enemy> fails"],
    focus: "curiosity",
    avoid: ["No offer and no price in this email."],
  }),

  "winback-checkin": P({
    id: "winback-checkin",
    name: "A real check-in",
    job: "Reopen the conversation with someone who went quiet, and learn why.",
    beats: [
      "Subject: short and human, like a note from a person. No offer words.",
      "Open honestly: you noticed it has been a while, and you are not writing to sell.",
      "Say plainly that you want to know what happened, in one line: did it not work, did life get in the way, or something else?",
      "Make replying easy: ask for one honest sentence back, even if it is 'not for me'.",
      "No offer, no price, no link to buy. Sign off like a person.",
    ],
    hooks: ["Can I ask you something?", "Did I do something wrong?", "It's been a while"],
    focus: "story",
    avoid: ["No offer and no discount in this email.", "Do not guilt the reader."],
  }),

  "winback-whats-new": P({
    id: "winback-whats-new",
    name: "What has changed",
    job: "Show that the thing they left is not the thing that exists now.",
    beats: [
      "Open on the reason they likely left, using the doubts in the brief. Say it for them in one line.",
      "What has changed since, as 2 to 3 short bullets. Use only real changes from the offer; if none are given, use [WHAT CHANGED].",
      "What that means for them in plain words (the result, not the feature).",
      "One easy next step with [LINK].",
    ],
    hooks: ["A lot has changed", "What we fixed", "You were right about <thing>"],
    focus: "objection",
    avoid: ["Never invent a change, a feature or a date."],
  }),

  "winback-sunset": P({
    id: "winback-sunset",
    name: "Stay or go",
    job: "Give them an honest choice, and keep the list full of people who want to be there.",
    beats: [
      "Subject: a plain question like 'Should I keep emailing you?'.",
      "Say you only want to write to people who want it, and you will stop if they are done.",
      "Two clear options with a link each: stay on the list, or leave it. Both are fine.",
      "One kind line either way. No pressure, no offer.",
    ],
    hooks: ["Should I keep emailing you?", "Stay or go?", "One last question"],
    focus: "story",
    avoid: ["No offer and no guilt."],
  }),

  "call-what-happens": P({
    id: "call-what-happens",
    name: "What happens on the call",
    job: "Remove the fear of the unknown, so booking feels safe and easy.",
    beats: [
      "Open on the worry: people hesitate to book because they do not know what happens.",
      "Walk through the call in 3 to 4 short steps: how long, what you ask, what you show, what they leave with. Use only what the offer says; otherwise [CALL LENGTH].",
      "Say plainly that there is no pressure, and what happens if it is not a fit.",
      "One call to action with [LINK] to book.",
    ],
    hooks: ["What happens on the call", "No, it is not a sales trap", "15 minutes, step by step"],
    focus: "objection",
    avoid: ["Never promise an outcome the offer does not state."],
  }),

  "call-fit": P({
    id: "call-fit",
    name: "Who the call is NOT for",
    job: "Qualify people out so the right ones lean in and your calendar fills with fits.",
    beats: [
      "Open: the call is free and useful, and it is not for everyone.",
      "Who should not book, 3 types, each with a short honest 'why'. Adapt them to this audience.",
      "Who it is for: people ready to <desire> and willing to do the work.",
      "If that is you, one call to action with [LINK] to book.",
    ],
    hooks: ["Please do not book this call if...", "This call is not for you if", "3 people I cannot help"],
    focus: "objection",
  }),

  "call-slots": P({
    id: "call-slots",
    name: "The calendar closes",
    job: "Make the booking deadline real, honestly.",
    beats: [
      "Lead with the real day the booking window ends. Give the number of spots only if the brief says so; otherwise say the calendar closes on that date.",
      "One line of what they get on the call.",
      "One line on who it is for.",
      "One call to action with [LINK] to book.",
    ],
    hooks: ["Calendar closes <day>", "Last day to book", "The last spots"],
    focus: "urgency",
    avoid: ["Never invent a number of spots."],
  }),

  "post-book-call": P({
    id: "post-book-call",
    name: "Calendar is open post",
    job: "Tell followers the calendar is open and who the call is for.",
    beats: [
      "First line: the calendar is open, and the one result the call is about.",
      "2 to 3 short lines: who it is for and what they leave with.",
      "One call to action: the booking link.",
    ],
    hooks: ["My calendar is open", "Want help with <outcome>?", "Free calls are open"],
    focus: "desire",
  }),

  "ad-book-call": P({
    id: "ad-book-call",
    name: "Book a call ad",
    job: "Turn the right person's pain into a booked call.",
    beats: [
      "Headline: name the situation or the result, under 40 characters.",
      "Primary text: the moment of the problem, what the call is and what they leave with, and who it is for.",
      "One call to action to book.",
      "Visual idea: one line on what to show.",
    ],
    hooks: ["Stuck on <problem>?", "A free call to fix <problem>", "<Minutes> minutes to a plan"],
    focus: "pain",
  }),

  "handraiser-bump": P({
    id: "handraiser-bump",
    name: "A second ask",
    job: "Catch the people who missed the first ask, with a different angle.",
    beats: [
      "Very short. A different angle than the first ask: a new way to say the same question.",
      "One line of what you would do for the people who reply.",
      "Ask them to reply with one word.",
      "No link. Under 70 words.",
    ],
    hooks: ["In case you missed this", "Still want this?", "A different way to ask"],
    focus: "desire",
  }),

  "handraiser-next": P({
    id: "handraiser-next",
    name: "You raised your hand",
    job: "Turn a reply into the next step, fast, for people who said yes.",
    beats: [
      "Thank them for replying, in one line, like a person.",
      "Say what happens next in one or two short lines.",
      "Ask 1 to 3 short questions that tell you if they are a fit, so the call is useful.",
      "One call to action: reply, or [LINK] to book.",
    ],
    hooks: ["Thanks for replying", "Great, here is what is next", "You said yes"],
    focus: "desire",
    avoid: ["This email is only for people who replied. Write it that way."],
  }),

  "post-comment-word": P({
    id: "post-comment-word",
    name: "Comment to raise your hand",
    job: "Get people to comment one word, so you know who wants it.",
    beats: [
      "First line: the result, as a question the right person says yes to.",
      "2 short lines of what the ones who comment will get.",
      "The call to action: comment one word. Name the word in capital letters.",
    ],
    hooks: ["Want <result>? Comment <WORD>", "Comment <WORD> and I will send it", "Who wants <result>?"],
    focus: "desire",
  }),

  "ad-handraiser": P({
    id: "ad-handraiser",
    name: "Hand-raiser ad",
    job: "Find the people who want it by asking them to message you.",
    beats: [
      "Headline: the result as a question, under 40 characters.",
      "Primary text: the problem in one line, what they will get if they reply, and the one word or tap to raise a hand.",
      "One call to action: send a message or reply.",
      "Visual idea: one line on what to show.",
    ],
    hooks: ["Want <result>?", "Raise your hand if...", "Message me <WORD>"],
    focus: "desire",
  }),

  "sms-handraiser": P({
    id: "sms-handraiser",
    name: "Text hand-raiser",
    job: "A one line text that gets a reply.",
    beats: ["One question about the result they want.", "Ask them to reply YES or one word."],
    hooks: [],
    focus: "desire",
    avoid: ["Under 160 characters. No link."],
  }),

  "post-lead-magnet": P({
    id: "post-lead-magnet",
    name: "Free resource post",
    job: "Get a follower to tap the link and take the free resource.",
    beats: [
      "First line: the one small result the resource gives, as a promise a real person would say.",
      "2 to 3 short lines: what is inside and who it is for.",
      "One call to action: the link, and say it is free.",
    ],
    hooks: ["Free: <the resource>", "I made this for <audience>", "Steal my <resource>"],
    focus: "desire",
    avoid: ["Never invent a number of downloads or a result."],
  }),

  "ad-lead-magnet": P({
    id: "ad-lead-magnet",
    name: "Free resource ad",
    job: "Turn a cold scroller into an email address by offering one quick win.",
    beats: [
      "Headline: the quick win, under 40 characters.",
      "Primary text: the moment of the problem, what is inside the free resource, and how long it takes to use.",
      "One call to action: get it free.",
      "Visual idea: one line on what to show, such as the resource itself.",
    ],
    hooks: ["Free <resource>", "Fix <problem> in <minutes>", "The <resource> for <audience>"],
    focus: "pain",
  }),

  "magnet-delivery": P({
    id: "magnet-delivery",
    name: "Here is your download",
    job: "Deliver the resource right away and get them to open it now.",
    beats: [
      "Subject: say it is here, plainly, like 'Your <resource> is here'.",
      "One line of thanks. The link to the resource with [LINK] in the first lines.",
      "The one quick win to try first, in one or two short lines.",
      "One line asking them to reply with what they hope to fix.",
    ],
    hooks: ["Your <resource> is here", "Here it is", "Here is your download"],
    focus: "desire",
    avoid: ["No pitch in this email. Deliver first."],
  }),

  "magnet-first-win": P({
    id: "magnet-first-win",
    name: "Did you try it?",
    job: "Get them to use the resource and feel a first win.",
    beats: [
      "Open with a simple check: did you get a chance to open it?",
      "The one step to do first and what they will notice when it works.",
      "A small, true tip that is not in the resource.",
      "One line inviting a reply with a question.",
    ],
    hooks: ["Did you try it?", "The first thing to do", "A quick tip"],
    focus: "desire",
    avoid: ["No pitch in this email."],
  }),

  "magnet-bridge": P({
    id: "magnet-bridge",
    name: "The next step",
    job: "Move someone who got value from the free thing toward the paid offer, softly.",
    beats: [
      "Open on what the resource helped them do, so they feel the win.",
      "Name the next problem people hit after that, in the reader's words from the brief.",
      "Show the offer as the natural next step: what it is and the result, one plain sentence.",
      "One honest line on who it is for. One call to action with [LINK].",
    ],
    hooks: ["What comes after <resource>", "The next step", "If you liked <resource>"],
    focus: "offer",
  }),

  "post-giveaway": P({
    id: "post-giveaway",
    name: "Giveaway post",
    job: "Get real entries from the right people, with clear rules.",
    beats: [
      "First line: the prize and why it is worth wanting.",
      "How to enter in 1 to 3 simple steps.",
      "The real end date and when the winner is picked (use the dates given, otherwise [END DATE]).",
      "One line of rules: [OFFICIAL RULES LINK]. On Instagram or Facebook, say the giveaway is not sponsored or run by them.",
    ],
    hooks: ["Win <prize>", "Giveaway: <prize>", "Want <prize> for free?"],
    focus: "desire",
    avoid: ["Never invent a prize value or a number of entries."],
  }),

  "post-giveaway-winner": P({
    id: "post-giveaway-winner",
    name: "Winner announcement",
    job: "Announce the winner and thank everyone who entered.",
    beats: [
      "First line: the winner, using [WINNER NAME] if no name is given.",
      "One line of thanks to everyone who entered.",
      "One line on what is next for people who did not win.",
    ],
    hooks: ["The winner is...", "We have a winner", "Congrats, <name>"],
    focus: "story",
    avoid: ["Never name or invent a winner. Use [WINNER NAME]."],
  }),

  "email-giveaway-winner": P({
    id: "email-giveaway-winner",
    name: "Winner and thank you",
    job: "Close the giveaway warmly and keep entrants on your side.",
    beats: [
      "Subject: say the giveaway is over and thank them.",
      "Announce the winner using [WINNER NAME] if no name is given. Thank everyone who entered.",
      "One line on what you learned or enjoyed. Keep it human.",
      "Tell them what comes next, in one line.",
    ],
    hooks: ["We have a winner", "Thank you for entering", "That's a wrap"],
    focus: "story",
    avoid: ["Never name or invent a winner. Use [WINNER NAME]."],
  }),

  "giveaway-offer": P({
    id: "giveaway-offer",
    name: "For everyone who entered",
    job: "Turn the people who did not win into buyers, kindly.",
    beats: [
      "Open on the prize or result they entered for, and say you know not everyone can win.",
      "Offer a real way to still get it: a welcome price, a bonus or an easy first step. Use only what the brief gives, otherwise [ENTRANT OFFER].",
      "What they get and who it is for, in two short lines.",
      "The real end time of the offer. One call to action with [LINK].",
    ],
    hooks: ["Did not win? This is for you", "For everyone who entered", "A thank you for entering"],
    focus: "offer",
    avoid: ["Never invent a discount. Use [ENTRANT OFFER]."],
  }),

  "ebook-announce": P({
    id: "ebook-announce",
    name: "The guide is out",
    job: "Make the right person buy a low-priced guide in one read.",
    beats: [
      "Lead with the problem the guide solves, in one specific moment.",
      "What the guide is, one plain sentence, and who it is for.",
      "3 to 5 short bullets of what is inside. Each is a specific outcome or insight, never a chapter label.",
      "The price, said plainly. Compare it honestly to the cost of the problem.",
      "One call to action with [LINK]. Say what format it comes in and that it is instant.",
    ],
    hooks: ["The guide for <audience>", "<Result> in <pages> pages", "It's out"],
    focus: "offer",
    avoid: ["Never invent page counts, a rating or a number of readers."],
  }),

  "ebook-sample": P({
    id: "ebook-sample",
    name: "A free sample",
    job: "Prove the quality by giving one useful idea from the guide for free.",
    beats: [
      "Open on the problem the idea fixes, in the reader's words.",
      "Give one real idea or step from the guide in full, so they can use it today. Only use content from the offer; otherwise [SAMPLE IDEA].",
      "Say there is more where that came from, in one line.",
      "One call to action with [LINK] to get the full guide.",
    ],
    hooks: ["One idea from the guide", "Try this today", "A free page from the guide"],
    focus: "desire",
    avoid: ["Never invent content that is not in the offer."],
  }),

  "post-ebook-peek": P({
    id: "post-ebook-peek",
    name: "A peek inside",
    job: "Show one real insight from the guide so followers want the rest.",
    beats: [
      "First line: one insight from the guide, as a bold statement that works alone.",
      "2 to 3 short lines that explain it simply.",
      "One call to action: the rest is in the guide, with the link.",
    ],
    hooks: ["A page from the guide", "One thing nobody tells you about <topic>", "Inside the guide: <insight>"],
    focus: "curiosity",
    avoid: ["Never invent content that is not in the offer."],
  }),

  "ebook-next-step": P({
    id: "ebook-next-step",
    name: "For readers: your next step",
    job: "Offer people who bought the guide a bigger next step, kindly.",
    beats: [
      "Thank them for getting the guide, in one line, like a person.",
      "Ask whether they have tried the first step and how it went.",
      "Say what most readers want next and show the bigger offer as that step, in one plain sentence.",
      "One call to action with [LINK]. Say it is only for people who got the guide.",
    ],
    hooks: ["Thanks for getting the guide", "How is it going?", "What most readers do next"],
    focus: "offer",
    avoid: ["This email is only for people who bought. Write it that way.", "Never invent a number of readers."],
  }),

  "last-minute-gift": P({
    id: "last-minute-gift",
    name: "Still time",
    job: "Win the buyer who left it late, by making it easy and fast.",
    beats: [
      "Lead with the good news: there is still time.",
      "Why this works when time is short. If the offer is digital or arrives right away, say so. If it ships, give the real last order date, otherwise [ORDER-BY DATE].",
      "One line of what they get and who it is for.",
      "One call to action with [LINK]. Say how fast it is.",
    ],
    hooks: ["Still time", "Last minute? Good", "It arrives today"],
    focus: "urgency",
    avoid: ["Never promise delivery by a date that was not given."],
  }),

  "holiday-thanks": P({
    id: "holiday-thanks",
    name: "Thank you and happy holidays",
    job: "Warm the list with a real thank you. No pitch.",
    beats: [
      "Subject: a short, warm line like a note from a person.",
      "Thank them for being here this year, in your own words and one specific thing you appreciate.",
      "Wish them a good holiday in one line.",
      "No offer, no price, no link to buy. Sign off like a person.",
    ],
    hooks: ["Thank you", "Happy holidays", "Before the year ends"],
    focus: "story",
    avoid: ["No offer in this email."],
  }),

  "post-holiday-thanks": P({
    id: "post-holiday-thanks",
    name: "Holiday thank you post",
    job: "Say thank you to followers and customers. No pitch.",
    beats: [
      "First line: thank you, in your own words.",
      "2 to 3 short lines: one specific thing you appreciate about the people who follow you.",
      "One warm wish for the holiday. No link, no offer.",
    ],
    hooks: ["Thank you", "Happy holidays", "Grateful for you"],
    focus: "story",
    avoid: ["No offer in this post."],
  }),

  "post-gift-idea": P({
    id: "post-gift-idea",
    name: "Gift idea post",
    job: "Make a follower picture the person they are buying for.",
    beats: [
      "First line: a gift question or a 'perfect for' line that works alone.",
      "2 to 3 short lines: who it is perfect for and how it feels to receive it.",
      "One call to action with the link and the real end date.",
    ],
    hooks: ["Hard to buy for?", "Perfect for the person who has everything", "A gift that does not need wrapping"],
    focus: "desire",
  }),

  "love-angles": P({
    id: "love-angles",
    name: "Three ways to love this",
    job: "Make the offer fit whoever the reader loves, including themselves.",
    beats: [
      "Open on the idea that Valentine's Day is not only for couples.",
      "Three short angles, each 2 lines: for the person you love, for a friend, for yourself. Each says what they get.",
      "The price and the real end date in one line.",
      "One call to action with [LINK].",
    ],
    hooks: ["Not just for couples", "Three ways to say I love you", "A gift for you, too"],
    focus: "desire",
  }),

  "post-deal-of-day": P({
    id: "post-deal-of-day",
    name: "Today's deal post",
    job: "One deal, today only, in a few lines.",
    beats: [
      "First line: today's deal and the price or discount. If the offer lists more than one product, use a different one each day; if it lists one, vary the angle (bundle, starter, premium). Use [TODAY'S DEAL] for any detail not given.",
      "2 short lines: who it is perfect for.",
      "Ends tonight at the real time or [END TIME]. One link.",
    ],
    hooks: ["Today only: <deal>", "Deal of the day", "Tomorrow it is gone"],
    focus: "offer",
    avoid: ["Never invent a product or a price."],
  }),

  "deals-recap": P({
    id: "deals-recap",
    name: "What you missed",
    job: "Bring back people who missed the first deals while there is still time.",
    beats: [
      "Open on the idea that a deal a day is easy to miss, and you do not want them to.",
      "A short list of the deals so far, one line each, using only deals that were really sent.",
      "What is still open and when it ends.",
      "One call to action with [LINK].",
    ],
    hooks: ["What you missed", "Catch up on this week's deals", "Still open"],
    focus: "urgency",
    avoid: ["Never list a deal that was not sent."],
  }),

  /* ------------------------------------------------------------ */
  /* Short channels: texts, posts, ads                              */
  /* ------------------------------------------------------------ */

  "sms-reminder": P({
    id: "sms-reminder",
    name: "Text reminder",
    job: "A text a friend would send.",
    beats: ["One specific line about what's happening and when (real time).", "[LINK]."],
    hooks: [],
    focus: "urgency",
    avoid: ["Under 160 characters. No hashtags, no emojis unless the tone is playful."],
  }),

  "sms-offer": P({
    id: "sms-offer",
    name: "Text offer nudge",
    job: "One reason to click before it ends.",
    beats: ["The deal or deadline in plain words.", "[LINK]."],
    hooks: [],
    focus: "urgency",
    avoid: ["Under 160 characters."],
  }),

  "post-teaser": P({
    id: "post-teaser",
    name: "Curiosity post",
    job: "Stop the scroll and make them want the fix.",
    beats: [
      "First line: a pattern-breaking statement or a relatable moment. It must work on its own before 'more'.",
      "2 to 4 short lines that show the problem and hint at the fix without giving it away.",
      "One clear call to action (link in bio, comment a word, or join the event).",
    ],
    hooks: ["Unpopular opinion: <enemy>", "If you <pain>, read this", "Nobody tells you this about <topic>"],
    focus: "curiosity",
  }),

  "post-proof": P({
    id: "post-proof",
    name: "Proof post",
    job: "One before-and-after that makes them think 'that could be me'.",
    beats: [
      "First line: the result or the before moment.",
      "The before, the turn, the after, in short lines. Use placeholders for any real names or numbers not in the brief.",
      "The lesson in one line, then the call to action.",
    ],
    hooks: ["<Before> to <after>", "This message made my week", "Here's what changed"],
    focus: "proof",
  }),

  "post-deadline": P({
    id: "post-deadline",
    name: "Deadline post",
    job: "Say the deadline plainly.",
    beats: ["First line: what closes and when.", "One line on what they get.", "Call to action."],
    hooks: ["Closing <day>", "Last chance for <offer>"],
    focus: "urgency",
  }),

  "ad-hook": P({
    id: "ad-hook",
    name: "Cold ad: pattern interrupt",
    job: "Stop a stranger's scroll and get the click.",
    beats: [
      "Headline: a pattern interrupt or a specific promise. Never a question that can be answered 'no'.",
      "Primary text line 1: call out the audience by their situation.",
      "Line 2 to 4: the pain, then an open loop about the fix.",
      "Proof line only if real (or [PROOF]).",
      "Call to action: what they get when they click.",
    ],
    hooks: ["<Audience>: stop <enemy>", "The <specific> that <result>", "How <audience> <result> without <pain>"],
    focus: "pain",
  }),

  "ad-retarget": P({
    id: "ad-retarget",
    name: "Retargeting ad: objection",
    job: "Win back someone who looked but didn't act.",
    beats: [
      "Headline: name the objection or the thing they were unsure about.",
      "Primary text: answer it in 2 to 3 lines, with proof or the guarantee.",
      "Remind them of the outcome and the deadline if there is one.",
      "Call to action.",
    ],
    hooks: ["Still thinking about it?", "\"But I don't have time\"", "Worried it won't work for you?"],
    focus: "objection",
  }),

  "ad-offer": P({
    id: "ad-offer",
    name: "Warm ad: offer reveal",
    job: "Tell warm people the offer is live and make it one click.",
    beats: [
      "Headline: the offer and the result, plainly.",
      "Primary text: you saw the training, here's the next step. What's included in 2 to 3 short lines.",
      "Deadline or reason to act now, only if real.",
      "Call to action.",
    ],
    hooks: ["<Offer> is open", "Ready for the next step?", "The program behind the training"],
    focus: "offer",
  }),
};

export function getPlay(id: string | undefined): Play | undefined {
  return id ? PLAYS[id] : undefined;
}

/** Fallback when a step has no play: pick one from its channel and angle. */
export function guessPlay(channel: string, angle: string, title: string): Play | undefined {
  const t = `${angle} ${title}`.toLowerCase();
  if (channel === "video") return PLAYS["video-pitch"];
  if (channel === "sms") return /offer|deal|sale|close|deadline/.test(t) ? PLAYS["sms-offer"] : PLAYS["sms-reminder"];
  if (channel === "ad") return /retarget|objection/.test(t) ? PLAYS["ad-retarget"] : /offer|warm/.test(t) ? PLAYS["ad-offer"] : PLAYS["ad-hook"];
  if (channel === "social") return /proof|story|customer/.test(t) ? PLAYS["post-proof"] : /deadline|close|last/.test(t) ? PLAYS["post-deadline"] : PLAYS["post-teaser"];
  return undefined;
}
