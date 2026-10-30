import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  alternates: { canonical: "/privacy" },
};

// Plain-language draft describing what the app actually does with data,
// based on reading the real code paths (Firebase Auth, Firestore
// collections in firestore.rules, the OpenAI calls in lib/ai/, Stripe
// checkout/webhook routes, and the sales-page crawl in
// app/api/analyze-offer-page). Not reviewed by a lawyer — have one check
// this, especially if you'll have EU users (GDPR) or a California user
// base (CCPA), before relying on it.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper text-slate font-body">
      <div className="px-6 py-5">
        <Link href="/" className="inline-flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- local /public asset */}
          <img src="/logo-lockup.png" alt="Campeos" className="h-7 w-auto object-contain" />
        </Link>
      </div>

      <div className="max-w-[720px] mx-auto px-6 py-10 flex flex-col gap-10">
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-[34px] sm:text-[42px] leading-[1.05] font-medium tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-faint">Last updated October 18, 2026</p>
        </div>

        <div className="flex flex-col gap-8 text-[15px] leading-relaxed text-slate">
          <Section title="1. What this covers">
            <p>
              This policy explains what information Campeos (&quot;we,&quot; &quot;us&quot;)
              collects when you use the app at campeos.com, and what we do with it.
            </p>
          </Section>

          <Section title="2. What we collect">
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li><strong>Account info:</strong> your email address and, if you sign in with Google, your name.</li>
              <li>
                <strong>Offer and business info:</strong> what you enter during onboarding or in
                the builder &mdash; your offer&apos;s name, price, audience, what customers
                get, and tone.
              </li>
              <li>
                <strong>Content you submit:</strong> winning copy, sales-call transcripts, and
                a sales-page URL if you choose to give us one.
              </li>
              <li>
                <strong>Sales-page content:</strong> if you provide a sales-page URL, we fetch
                that page&apos;s publicly visible text to pull out details about your
                offer. We don&apos;t collect anything from that page beyond its visible
                content, and we don&apos;t log in, submit forms, or access anything
                non-public.
              </li>
              <li>
                <strong>Generated content:</strong> the campaigns, steps, and copy the Service
                creates for you.
              </li>
              <li>
                <strong>Payment info:</strong> if you subscribe, Stripe collects and processes
                your card details directly &mdash; we never see or store your full card
                number. We keep a record that you&apos;re subscribed and which plan.
              </li>
              <li>
                <strong>Basic usage data:</strong> things like when you signed in and which
                features you&apos;ve used, to keep the Service running and improve it.
              </li>
            </ul>
          </Section>

          <Section title="3. How we use it">
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>To run the Service &mdash; generate your campaigns, save your work, and show it back to you.</li>
              <li>To send your offer details and submitted content to our AI provider so it can generate copy (see Section 4).</li>
              <li>To process payments and manage your subscription.</li>
              <li>To communicate with you about your account (for example, billing or support).</li>
              <li>To fix bugs and improve the Service.</li>
            </ul>
            <p>We don&apos;t sell your data. We don&apos;t use it to train AI models.</p>
          </Section>

          <Section title="4. Who we share it with">
            <p>We use a small number of service providers to run Campeos, each only for its specific job:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li><strong>OpenAI</strong> &mdash; processes your offer details and submitted content to generate campaign copy.</li>
              <li><strong>Firebase (Google Cloud)</strong> &mdash; handles sign-in and stores your account and campaign data.</li>
              <li><strong>Stripe</strong> &mdash; processes payments and manages subscriptions.</li>
              <li><strong>Vercel</strong> &mdash; hosts the application.</li>
              <li><strong>Meta (Facebook and Instagram)</strong> &mdash; we run ads there. See the advertising section below.</li>
            </ul>
            <p>
              We don&apos;t share your data with anyone else, except if required by law or
              to protect our legal rights.
            </p>
          </Section>

          <Section title="Advertising and your privacy choices">
            <p id="choices">
              We advertise on Meta. If you allow it, we use the Meta Pixel and Meta&apos;s Conversions API to
              measure our ads. Meta may receive the pages you visit, and when you subscribe, the plan
              and amount, hashed versions of your email address and phone number, and browser and device details such
              as your IP address. We do this to see which ads lead to sign-ups and to show our ads to
              people likely to be interested. We never send what you write in the app.
            </p>
            <p>
              In the United States this is on unless you opt out. Everywhere else it is off unless you
              accept. You can change your choice at any time with the &quot;Your privacy choices&quot; link at
              the bottom of our home page, or by clearing this site&apos;s cookies. We treat a browser&apos;s
              Global Privacy Control signal as an opt-out. You can also manage ad settings in your
              Meta account.
            </p>
          </Section>

          <Section title="5. How long we keep it">
            <p>
              We keep your account and campaign data for as long as your account is
              active. If you delete your account, we delete your data within a
              reasonable period, except where we need to keep records for legal or
              billing reasons.
            </p>
          </Section>

          <Section title="6. Your choices">
            <p>
              You can edit or delete your submitted winning copy and sales-call
              transcripts at any time from your library pages. To access, correct, or
              delete your account data, or to ask what we hold about you, contact us
              at{" "}
              <a href="mailto:ajay@ajaysharma.co" className="text-clay font-semibold">
                ajay@ajaysharma.co
              </a>
              .
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We use reasonable technical measures (like access-controlled databases
              and encrypted connections) to protect your data, but no system is
              perfectly secure, and we can&apos;t guarantee absolute security.
            </p>
          </Section>

          <Section title="8. Children">
            <p>Campeos isn&apos;t intended for anyone under 18, and we don&apos;t knowingly collect data from children.</p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>
              If we make material changes to this policy, we&apos;ll let you know (for
              example, by email or in the app) before they take effect.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Questions about this policy or your data? Reach us at{" "}
              <a href="mailto:ajay@ajaysharma.co" className="text-clay font-semibold">
                ajay@ajaysharma.co
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-2.5 text-muted">{children}</div>
    </div>
  );
}
