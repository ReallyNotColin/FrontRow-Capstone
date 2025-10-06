import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'node:fs';

function initAdmin() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    initializeApp({ credential: applicationDefault() });
    return;
  }
  const fallbackPath = './serviceAccountKey.json';
  if (fs.existsSync(fallbackPath)) {
    initializeApp({ credential: cert(JSON.parse(fs.readFileSync(fallbackPath, 'utf8'))) });
    return;
  }
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or provide ./serviceAccountKey.json');
  process.exit(1);
}

async function setAdminByEmail(email, makeAdmin) {
  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const updated = { ...(user.customClaims || {}) };
  if (makeAdmin) updated.admin = true; else delete updated.admin;
  await auth.setCustomUserClaims(user.uid, updated);
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

(async () => {
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
      for (const email of emails) printResult('Granted admin to', await setAdminByEmail(email, true));
    } else if (cmd === 'revoke') {
      for (const email of emails) printResult('Revoked admin from', await setAdminByEmail(email, false));
    } else if (cmd === 'show') {
      for (const email of emails) printResult('Claims for', await showClaims(email));
    } else {
      throw new Error(`Unknown command: ${cmd}`);
    }
  } catch (err) {
    console.error('Error:', err?.message || err);
    process.exit(1);
  }
})();
