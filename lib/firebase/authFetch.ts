"use client";

import { auth } from "./client";

/**
 * fetch() with the signed-in user's Firebase ID token attached, for our
 * own /api routes. The routes read who you are from this token (see
 * lib/serverAuth.ts), never from a uid in the body.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
