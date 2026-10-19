import { cert, getApps, getApp, initializeApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

// The Admin SDK, for server code that must write Firestore with no
// signed-in user in the request — the Stripe webhook is the only caller
// today. Everywhere else in the app (lib/firebase/*.ts, used from client
// components) deliberately uses the regular client SDK under the
// signed-in user's own session instead; this file is NOT a general
// replacement for that pattern, only for the one place a webhook needs
// to write on a user's behalf.
//
// FIREBASE_SERVICE_ACCOUNT_KEY is the whole service-account JSON (from
// Firebase console → Project settings → Service accounts → Generate new
// private key), stored as a single-line string in the env var.

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApp();
    return adminApp;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY is not set — see .env.local.example for where to get it."
    );
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY isn't valid JSON — paste the whole downloaded service-account file as one line."
    );
  }

  adminApp = initializeApp({ credential: cert(serviceAccount) });
  return adminApp;
}

let adminDb: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (!adminDb) adminDb = getFirestore(getAdminApp());
  return adminDb;
}

// No getAdminAuth() here on purpose. firebase-admin/auth pulls in
// jwks-rsa, which pulls in an ESM-only build of "jose" that a CommonJS
// require() can't load at all (ERR_REQUIRE_ESM) — not a load-order
// problem a dynamic import can dodge, but a genuine incompatibility
// between jwks-rsa@4.1.0's declared dependency and jose v6's dropped
// CJS support. Importing firebase-admin/auth anywhere, even lazily,
// crashes the moment it's actually used. app/api/account/delete/route.ts
// verifies the caller's ID token and deletes the Auth user through
// Firebase's REST API instead (Identity Toolkit's accounts:lookup and
// accounts:delete) — same security property (Google verifies the token
// server-side either way), without this broken dependency chain.
