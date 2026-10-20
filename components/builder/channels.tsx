"use client";

// How each template channel shows up in the builder: its name and the
// real platform logos. "social" posts go to whichever social platforms
// the user picked in onboarding (lib/onboarding/answers.ts); ads run on
// Meta, shown as Facebook unless they only use Instagram.

export type PlatformKey = "email" | "sms" | "facebook" | "instagram" | "tiktok" | "linkedin" | "threads" | "youtube";

const LOGO: Record<Exclude<PlatformKey, "sms">, string> = {
  email: "/brand/email.png",
  facebook: "/brand/facebook.png",
  instagram: "/brand/instagram.png",
  tiktok: "/brand/tiktok.png",
  linkedin: "/brand/linkedin.png",
  threads: "/brand/threads.png",
  youtube: "/brand/youtube.png",
};

const SOCIAL: PlatformKey[] = ["instagram", "facebook", "tiktok", "linkedin", "threads", "youtube"];

export interface ChannelInfo {
  key: string;
  name: string;
  /** Short name for the channel filter row. */
  short: string;
  platforms: PlatformKey[];
}

/** userPlatforms: the platform ids saved in onboarding (may be empty). */
export function channelInfo(channel: string, userPlatforms: string[]): ChannelInfo {
  const picked = (userPlatforms ?? []) as PlatformKey[];
  if (channel === "email") return { key: channel, name: "Email", short: "Email", platforms: ["email"] };
  if (channel === "sms") return { key: channel, name: "Text message", short: "SMS", platforms: ["sms"] };
  if (channel === "ad") {
    const igOnly = picked.includes("instagram") && !picked.includes("facebook");
    return igOnly
      ? { key: channel, name: "Instagram ad", short: "Ads", platforms: ["instagram"] }
      : { key: channel, name: "Facebook ad", short: "Ads", platforms: ["facebook"] };
  }
  if (channel === "social") {
    const social = SOCIAL.filter((p) => picked.includes(p));
    return {
      key: channel,
      name: "Social post",
      short: "Social posts",
      platforms: social.length ? social : ["instagram", "facebook"],
    };
  }
  return { key: channel, name: channel, short: channel, platforms: [] };
}

export function PlatformLogo({ platform, size = 20, muted = false }: { platform: PlatformKey; size?: number; muted?: boolean }) {
  const cls = muted ? "grayscale opacity-45" : "";
  if (platform === "sms") {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-[6px] bg-[#34C759] ${cls}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" fill="#FFFFFF">
          <path d="M12 4C7 4 3 7.4 3 11.5c0 2.2 1.1 4.1 2.9 5.5L5 20.5l4-2c.9.3 1.9.4 3 .4 5 0 9-3.4 9-7.5S17 4 12 4z" />
        </svg>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- local /public asset
  return <img src={LOGO[platform]} alt="" className={`object-contain ${cls}`} style={{ width: size, height: size }} />;
}

/** Overlapping logos, like stacked avatars. */
export function LogoStack({ platforms, size = 18 }: { platforms: PlatformKey[]; size?: number }) {
  return (
    <span className="inline-flex items-center pl-2">
      {platforms.map((p) => (
        <span
          key={p}
          className="-ml-2 inline-flex items-center justify-center rounded-[10px] bg-paper border-[1.5px] border-paper shadow-[0_0_0_1px_#ECEAF0]"
          style={{ width: size + 14, height: size + 14 }}
        >
          <PlatformLogo platform={p} size={size} />
        </span>
      ))}
    </span>
  );
}
