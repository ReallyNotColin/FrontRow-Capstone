// scripts/admin-claims.mjs
// Usage:
//  node scripts/admin-claims.mjs grant you@example.com other@example.com
//  node scripts/admin-claims.mjs revoke you@example.com
//  node scripts/admin-claims.mjs show you@example.com
//
// Auth: set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON,
// or edit the `initializeApp` block below to import the JSON directly.

import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs';

function initAdmin() {
  // Prefer GOOGLE_APPLICATION_CREDENTIALS (recommended)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: applicationDefault() });
    return;
  }

  // Fallback: load local JSON file if present
  const fallbackPath = './serviceAccountKey.json';
  if (fs.existsSync(fallbackPath)) {
    const key = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
    initializeApp({ credential: cert(key) });
    return;
  }

  console.error(
    'No credentials. Set GOOGLE_APPLICATION_CREDENTIALS or provide ./serviceAccountKey.json'
  );
  process.exit(1);
}

async function setAdminByEmail(email, makeAdmin) {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const existing = user.customClaims || {};
  const updated = { ...existing };

  if (makeAdmin) {
    updated.admin = true;
  } else {
    delete updated.admin;
  }

  await auth.setCustomUserClaims(user.uid, updated);

  // Optional: force refresh tokens next sign-in by bumping tokensValidAfterTime
  // Not required; clients can also call getIdToken(true)
  // await auth.revokeRefreshTokens(user.uid);

  return { uid: user.uid, email, claims: updated };
}

async function showClaims(email) {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  return { uid: user.uid, email, claims: user.customClaims || {} };
}

function printResult(prefix, res) {
  console.log(`${prefix} ${res.email} (uid: ${res.uid})`);
  console.log(`Claims: ${JSON.stringify(res.claims)}`);
}

async function main() {
  initAdmin();

  const [cmd, ...emails] = process.argv.slice(2);
  if (!cmd || emails.length === 0) {
    console.log(`Usage:
  node scripts/admin-claims.mjs grant <email> [email2 ...]
  node scripts/admin-claims.mjs revoke <email> [email2 ...]
  node scripts/admin-claims.mjs show  <email> [email2 ...]`);
    process.exit(1);
  }

  try {
    if (cmd === 'grant') {
      for (const email of emails) {
        const res = await setAdminByEmail(email, true);
        printResult('Granted admin to', res);
      }
    } else if (cmd === 'revoke') {
      for (const email of emails) {
        const res = await setAdminByEmail(email, false);
        printResult('Revoked admin from', res);
      }
    } else if (cmd === 'show') {
      for (const email of emails) {
        const res = await showClaims(email);
        printResult('Claims for', res);
      }
    } else {
      throw new Error(`Unknown command: ${cmd}`);
    }
  } catch (err) {
    console.error('Error:', err?.message || err);
    process.exit(1);
  }
}

main();
