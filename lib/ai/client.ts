import Anthropic from "@anthropic-ai/sdk";

// Server-side only. Never import this file from a client component — the
// API key must never reach the browser bundle.
let client: Anthropic | null = null;

export function getClaudeClient(): Anthropic {
  if (typeof window !== "undefined") {
    throw new Error(
      "getClaudeClient() was called in the browser. The Claude API key " +
        "must only be used from app/api routes."
    );
  }
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Copy .env.local.example to " +
          ".env.local and add your key."
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const CLAUDE_MODEL = "claude-sonnet-4-5";
