// Shared OneSignal helpers for The Cheer DJ.
// The REST API key is a SECRET — it lives only in a gitignored .env (or the shell
// environment), never in index.html or any committed file. Anyone with the key can
// push to every subscriber, so it must never reach the public site.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// App ID is public (it's already in index.html), so a default is fine here.
const APP_ID = "555513b3-ba92-4a62-b7b8-cf7193076411";
const API = "https://api.onesignal.com";
const SITE_URL = "https://dc.thecheerdj.com";

// Minimal .env loader (no dependency). Shell/Netlify env vars win over the file,
// so the same scripts work locally and in CI without changes.
function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      const key = m[1];
      let val = m[2].replace(/^["']|["']$/g, "");
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* no .env file — rely on the real environment */
  }
}

export function getConfig() {
  loadEnv();
  const key = process.env.ONESIGNAL_REST_API_KEY;
  if (!key) {
    throw new Error(
      "ONESIGNAL_REST_API_KEY is not set. Copy .env.example to .env and paste your\n" +
        "OneSignal REST API key (OneSignal dashboard → Settings → Keys & IDs)."
    );
  }
  // New OneSignal keys (os_v2_…) use the "Key" scheme; legacy REST keys use "Basic".
  const scheme =
    process.env.ONESIGNAL_AUTH_SCHEME || (key.startsWith("os_") ? "Key" : "Basic");
  return {
    appId: process.env.ONESIGNAL_APP_ID || APP_ID,
    key,
    authHeader: `${scheme} ${key}`,
    segment: process.env.ONESIGNAL_SEGMENT || "Subscribed Users",
    siteUrl: process.env.CHEERDJ_SITE_URL || SITE_URL,
  };
}

// Verify the key works WITHOUT sending anything (read-only list call).
export async function verifyCredentials() {
  const cfg = getConfig();
  const res = await fetch(
    `${API}/notifications?app_id=${encodeURIComponent(cfg.appId)}&limit=1`,
    { headers: { Authorization: cfg.authHeader } }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `OneSignal rejected the key (HTTP ${res.status}). ${JSON.stringify(body)}`
    );
  }
  return { ok: true, appId: cfg.appId, totalMessages: body.total_count };
}

// Build the push payload for a newly added song.
export function buildSongPayload({ name, cat, message }) {
  const cfg = getConfig();
  const body = message || `"${name}" is live${cat ? ` in ${cat}` : ""}. Press play and get loud.`;
  return {
    payload: {
      app_id: cfg.appId,
      target_channel: "push",
      included_segments: [cfg.segment],
      headings: { en: "New mix dropped 🎶" },
      contents: { en: body },
      url: cfg.siteUrl,
      chrome_web_icon: `${cfg.siteUrl}/icon-192.png`,
      chrome_web_badge: `${cfg.siteUrl}/icon-192.png`,
    },
    cfg,
  };
}

// Send (or dry-run) a "new song" push to all subscribers.
export async function sendNewSongPush({ name, cat, message, dryRun = false }) {
  if (!name) throw new Error("sendNewSongPush requires a song name.");
  const { payload, cfg } = buildSongPayload({ name, cat, message });

  if (dryRun) {
    const v = await verifyCredentials();
    return { dryRun: true, verified: v, payload };
  }

  const res = await fetch(`${API}/notifications`, {
    method: "POST",
    headers: { Authorization: cfg.authHeader, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.errors) {
    throw new Error(
      `OneSignal send failed (HTTP ${res.status}). ${JSON.stringify(body)}`
    );
  }
  return { id: body.id, recipients: body.recipients, payload };
}
