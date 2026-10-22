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
  if (channel === "sms") return /offer|deal|sale|close|deadline/.test(t) ? PLAYS["sms-offer"] : PLAYS["sms-reminder"];
  if (channel === "ad") return /retarget|objection/.test(t) ? PLAYS["ad-retarget"] : /offer|warm/.test(t) ? PLAYS["ad-offer"] : PLAYS["ad-hook"];
  if (channel === "social") return /proof|story|customer/.test(t) ? PLAYS["post-proof"] : /deadline|close|last/.test(t) ? PLAYS["post-deadline"] : PLAYS["post-teaser"];
  return undefined;
}
