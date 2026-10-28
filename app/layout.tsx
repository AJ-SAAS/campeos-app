import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/AuthProvider";
import { GlobalAgent } from "@/components/agent/GlobalAgent";

// SITE_URL backs metadataBase (so relative OG/icon paths below resolve
// to absolute URLs in the actual <meta> tags — required for link
// previews on Slack/X/iMessage/etc. to find the image at all) and the
// canonical URL. Falls back to the production domain so this still
// works correctly even if the env var isn't set somewhere (a preview
// deploy, local dev); set NEXT_PUBLIC_SITE_URL in Vercel to override.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://campeos.com";
const TAGLINE = "Plan and write your whole campaign, not just one post.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Campeos — AI campaign builder for marketers",
    template: "%s · Campeos",
  },
  description: TAGLINE,
  keywords: [
    "AI campaign builder",
    "marketing campaign generator",
    "webinar promotion emails",
    "flash sale copywriting",
    "AI copywriting tool",
    "email and ad campaign planner",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/icon.png",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Campeos",
    title: "Campeos — AI campaign builder for marketers",
    description: TAGLINE,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Campeos — plan and write your whole campaign, not just one post.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Campeos — AI campaign builder for marketers",
    description: TAGLINE,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400..700&family=Newsreader:ital,opsz,wght@0,6..72,500;1,6..72,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body">
        <AuthProvider>
          {children}
          <GlobalAgent />
        </AuthProvider>
      </body>
    </html>
  );
}
