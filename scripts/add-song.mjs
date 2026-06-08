#!/usr/bin/env node
// Add a song to The Cheer DJ in one motion: drop it into the TRACKS list, deploy,
// wait for it to go live, then push an alert to every subscriber.
//
//   node scripts/add-song.mjs \
//     --name "Tracy in Boss Mode" \
//     --cat "Coaches" \
//     --file ~/Downloads/tracy_in_boss_mode.mp3 \
//     [--dur 167] [--cover cover.jpg] [--message "custom alert text"]
//
// Flags:
//   --src <file.mp3>   use an mp3 already in the repo root instead of --file
//   --no-deploy        edit TRACKS but don't commit/push (no deploy, no live-wait)
//   --no-notify        deploy but don't send a push
//   --dry-run          verify the push key and print the payload without sending
//
// Category must be one of: Comp Day, Team Hype, Gym Mix, Coaches.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { basename, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sendNewSongPush } from "./onesignal.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(ROOT, "index.html");
const CATS = ["Comp Day", "Team Hype", "Gym Mix", "Coaches"];
const SITE_URL = process.env.CHEERDJ_SITE_URL || "https://dc.thecheerdj.com";

function parseArgs(argv) {
  const a = { deploy: true, notify: true, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const f = argv[i];
    if (f === "--name") a.name = argv[++i];
    else if (f === "--cat") a.cat = argv[++i];
    else if (f === "--file") a.file = argv[++i];
    else if (f === "--src") a.src = argv[++i];
    else if (f === "--dur") a.dur = parseInt(argv[++i], 10);
    else if (f === "--cover") a.cover = argv[++i];
    else if (f === "--message") a.message = argv[++i];
    else if (f === "--no-deploy") a.deploy = false;
    else if (f === "--no-notify") a.notify = false;
    else if (f === "--dry-run") a.dryRun = true;
  }
  return a;
}

const sh = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();

function probeDuration(path) {
  try {
    const out = sh("ffprobe", [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", path,
    ]);
    const sec = Math.round(parseFloat(out));
    return Number.isFinite(sec) && sec > 0 ? sec : undefined;
  } catch {
    return undefined; // ffprobe missing or unreadable — player will load length live
  }
}

function insertTrack({ name, cat, src, dur, cover }) {
  const html = readFileSync(INDEX, "utf8");
  if (html.includes(`src:"${src}"`)) {
    throw new Error(`A track with src "${src}" is already in TRACKS.`);
  }
  let entry = `  { name:${JSON.stringify(name)}, cat:${JSON.stringify(cat)}, src:${JSON.stringify(src)}`;
  if (dur) entry += `, dur:${dur}`;
  if (cover) entry += `, cover:${JSON.stringify(cover)}`;
  entry += ` },`;

  const re = /(const TRACKS = \[[\s\S]*?)(\n\];)/;
  if (!re.test(html)) throw new Error("Could not locate the TRACKS array in index.html.");
  writeFileSync(INDEX, html.replace(re, `$1\n${entry}$2`));
}

async function waitForLive(src, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const html = await (await fetch(`${SITE_URL}/index.html?cb=${Date.now()}`)).text();
      if (html.includes(`src:"${src}"`)) return true;
    } catch { /* transient — retry */ }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return false;
}

// ---- run ----
const a = parseArgs(process.argv.slice(2));
if (!a.name || !a.cat) {
  console.error('Required: --name "Song Title" --cat "Coaches" (and --file or --src)');
  process.exit(1);
}
if (!CATS.includes(a.cat)) {
  console.error(`--cat must be one of: ${CATS.join(", ")}`);
  process.exit(1);
}

// Resolve the mp3 source filename (copy into repo root if --file points elsewhere).
let src = a.src;
if (a.file) {
  const from = resolve(a.file);
  if (!existsSync(from)) { console.error(`File not found: ${from}`); process.exit(1); }
  src = basename(from);
  const dest = join(ROOT, src);
  if (resolve(dest) !== from) { copyFileSync(from, dest); console.log(`📁 copied ${src} into project`); }
}
if (!src) { console.error("Provide --file <path> or --src <file-in-repo>"); process.exit(1); }
if (!existsSync(join(ROOT, src))) { console.error(`Missing mp3 in repo root: ${src}`); process.exit(1); }

const dur = a.dur || probeDuration(join(ROOT, src));
console.log(`🎵 ${a.name} — ${a.cat} — ${src}${dur ? ` (${dur}s)` : " (length loads live)"}`);

insertTrack({ name: a.name, cat: a.cat, src, dur, cover: a.cover });
console.log("✏️  added to TRACKS");

if (a.deploy) {
  sh("git", ["add", "-A"]);
  sh("git", ["commit", "-q", "-m", `feat(music): add "${a.name}" to ${a.cat}`]);
  sh("git", ["push", "-q", "origin", "main"]);
  console.log(`🚀 pushed ${sh("git", ["rev-parse", "--short", "HEAD"])} — deploying…`);
  const live = await waitForLive(src);
  console.log(live ? "🌐 live on dc.thecheerdj.com" : "⚠️  deploy didn't confirm in time (check Netlify); continuing");
} else {
  console.log("⏭️  --no-deploy: TRACKS edited only (not committed)");
}

if (a.notify) {
  try {
    const r = await sendNewSongPush({ name: a.name, cat: a.cat, message: a.message, dryRun: a.dryRun });
    if (r.dryRun) {
      console.log("✅ Dry run — key verified, push NOT sent. Payload:");
      console.log(JSON.stringify(r.payload, null, 2));
    } else if (r.noRecipients) {
      console.log("📣 alert accepted, but 0 devices are subscribed yet — nothing delivered.");
    } else {
      console.log(`📣 push sent. id=${r.id} recipients=${r.recipients}`);
    }
  } catch (e) {
    console.error(`❌ push failed (song is still live): ${e.message}`);
    process.exit(1);
  }
} else {
  console.log("🔕 --no-notify: no push sent");
}
