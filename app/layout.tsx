import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Campeos",
  description: "Plan and write your whole campaign, not just one post.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..700&family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body">{children}</body>
    </html>
  );
}
