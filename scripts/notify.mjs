#!/usr/bin/env node
// Send a "new song" push to every subscriber.
//
//   node scripts/notify.mjs --name "Song Title" [--cat "Coaches"] [--message "..."] [--dry-run]
//
// --dry-run verifies your REST key and prints the exact payload WITHOUT sending,
// so you can confirm everything is wired before alerting real phones.

import { sendNewSongPush } from "./onesignal.mjs";

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--name") args.name = argv[++i];
    else if (a === "--cat") args.cat = argv[++i];
    else if (a === "--message") args.message = argv[++i];
    else if (!args.name) args.name = a; // allow positional name
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.name) {
  console.error('Usage: node scripts/notify.mjs --name "Song Title" [--cat "Coaches"] [--dry-run]');
  process.exit(1);
}

try {
  const r = await sendNewSongPush(args);
  if (r.dryRun) {
    console.log("✅ Dry run — key verified, NOTHING sent.");
    console.log(`   App: ${r.verified.appId}`);
    console.log("   Payload that WOULD be sent:");
    console.log(JSON.stringify(r.payload, null, 2));
  } else {
    console.log(`✅ Push sent. id=${r.id} recipients=${r.recipients}`);
  }
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(1);
}
