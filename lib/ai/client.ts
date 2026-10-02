import OpenAI from "openai";

// Server-side only. Never import this file from a client component — the
// API key must never reach the browser bundle.
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (typeof window !== "undefined") {
    throw new Error(
      "getOpenAIClient() was called in the browser. The OpenAI API key " +
        "must only be used from app/api routes."
    );
  }
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Copy .env.local.example to " +
          ".env.local and add your key."
      );
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

// Cheap and fast — fine for short marketing copy. Bump to "gpt-4o" later
// if quality needs it.
export const OPENAI_MODEL = "gpt-4o-mini";
