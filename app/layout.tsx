import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/firebase/AuthProvider";

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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:opsz,wght@9..40,400..700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
