# The Cheer DJ

A single page web app (PWA) that streams custom cheer hype mixes, organized by
category, with an "add to phone" install and push alerts for new drops.
Live at https://dc.thecheerdj.com (hosted on Netlify; subdomain CNAME'd to Netlify).

## Files

- `index.html` — the entire site: HTML, CSS, and JS are inline. The hero and footer
  logos are embedded as optimized WebP data URIs so they always render, even offline
  or in a preview, without depending on separate image files.
- `sw.js` — service worker. Network first (always tries the live version, falls back
  to cache when offline). Audio is left to stream straight from the network.
- `OneSignalSDKWorker.js` — the worker that actually gets registered. It pulls in both
  OneSignal's push SDK and `sw.js`, so push and caching coexist on the same scope.
- `manifest.json` — PWA manifest (name, colors, icons).
- Icons: `favicon-64.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`,
  `icon-512-maskable.png`. All generated from `cheerdj-logo.png`.
- `cheerdj-logo.png`, `dc-logo.png` — source logo art. Used to regenerate the icons
  and the embedded logos. Not referenced directly by the page.
- `*.mp3` — the audio mixes.
- `supabase-optional/` — a parked, NOT active self-serve admin (see bottom).

## Add a song + alert everyone (one command)

```
node scripts/add-song.mjs \
  --name "Tracy in Boss Mode" \
  --cat "Coaches" \
  --file ~/Downloads/tracy_in_boss_mode.mp3
```

This copies the mp3 into the project, adds it to the `TRACKS` array (reading its
duration with ffprobe if available), commits + pushes (Netlify auto-deploys), waits
for it to go live, then sends a push alert to every subscriber.

- `--cat` must be one of: `Comp Day`, `Team Hype`, `Gym Mix`, `Coaches`.
- `--dur 179` to set the length manually (skips ffprobe).
- `--cover cover.jpg` for square cover art (drop the image in the folder too).
- `--src file.mp3` to use an mp3 already in the repo root instead of `--file`.
- `--message "..."` to override the alert text.
- `--no-notify` to deploy without alerting; `--no-deploy` to only edit `TRACKS`.
- `--dry-run` to verify the push key and print the payload **without** sending.

Requires `ONESIGNAL_REST_API_KEY` in `.env` (see "Push notifications" below).
Send an alert on its own (no song change) with `node scripts/notify.mjs --name "…"`.

## Add or replace a song (manual workflow)

1. Put the `.mp3` in the project root.
2. In `index.html`, find the `TRACKS` array and add an entry:
   ```js
   { name:"Song Title", cat:"Coaches", src:"file.mp3", dur:179 }
   ```
   - `cat` must be one of: `Comp Day`, `Team Hype`, `Gym Mix`, `Coaches`.
   - `dur` is the length in seconds, so the time shows instantly. Get it with ffprobe
     (`ffprobe -i file.mp3 -show_entries format=duration`) or any tag reader. If you
     leave `dur` off, the player loads the length live in the browser instead.
   - Optional cover art: add `cover:"cover.jpg"` to the entry and drop a square image
     (~600x600 or larger) in the folder. No cover = a colored tile is used.
3. Deploy (see below).

## Categories

The four tabs are fixed: Comp Day, Team Hype, Gym Mix, Coaches. Any category with no
songs automatically shows the "New season coming soon" banner (that's how Team Hype
stays in coming-soon until a song is added there).

## Push notifications (OneSignal)

- The OneSignal App ID is set in `index.html` (`ONESIGNAL_APP_ID`) — it's public.
- Visitors tap "Turn on song alerts" to subscribe.
- **Sending alerts from the command line:** put your OneSignal **REST API Key** in a
  local `.env` file (copy `.env.example`). Get it from OneSignal dashboard → Settings →
  Keys & IDs → "REST API Key". The key is a secret — `.env` is gitignored and the key
  never goes into `index.html` or the public site. Then `scripts/add-song.mjs` (above)
  or `scripts/notify.mjs` will alert every subscriber. Targets the `Total Subscriptions`
  segment by default — that's "everyone" in this app (override with `ONESIGNAL_SEGMENT`,
  e.g. `Active Subscriptions`). Check Audience → Segments in the dashboard for the exact
  names; targeting a segment that doesn't exist silently reaches 0 people.
- You can still send manually from the dashboard: Messages > New Push.
- iPhone caveat: web push only works after the user adds the site to their home screen
  and opens it from there. Android and desktop work straight from the button.

## Logos and icons

- The on-page logos are embedded WebP data URIs inside `index.html`.
- To regenerate icons or re-embed logos, use `cheerdj-logo.png` / `dc-logo.png` as the
  source (resize, then for icons composite centered on a #08090c tile; the maskable
  icon uses ~66% scale for safe-zone padding).

## Deploy to Netlify

- Manual: Netlify > the site > Deploys > drag the whole project folder onto the drop area.
- Recommended with Claude Code: connect this folder as a Git repo to Netlify so pushes
  auto-deploy.
- After any deploy: hard refresh (Cmd+Shift+R) or open in an incognito window. The
  service worker is network-first, so changes show on reload; the first load after a
  deploy re-registers the worker.

## Service worker notes

- `sw.js` cache name is `cheerdj-v2`. If you change caching behavior, bump that name to
  force old caches to clear on the next visit.

## Supabase (parked, optional)

`supabase-optional/` holds `admin.html` and `supabase-setup.sql` for a future setup
where songs and covers are uploaded through a login page with no redeploy. It is NOT
wired into the live site right now. To turn it on later: run the SQL, create a public
`media` storage bucket, add an auth user, paste the project URL + anon key into both
files, and re-add the supabase-js loader to `index.html` (Claude can re-wire it).
