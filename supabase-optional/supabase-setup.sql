-- ============================================================
-- The Cheer DJ — Supabase setup
-- Run this in your Supabase project: SQL Editor > New query > paste > Run.
-- (Before running the storage section, create a PUBLIC bucket named "media"
--  under Storage > New bucket, with "Public bucket" turned ON.)
-- ============================================================

-- 1) Songs table -------------------------------------------------
create table if not exists public.tracks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null,
  audio_url   text not null,
  cover_url   text,
  duration    int  default 0,
  sort_order  int  default 100,
  created_at  timestamptz default now()
);

-- 2) Row level security -----------------------------------------
alter table public.tracks enable row level security;

-- anyone can READ songs (so the public site works)
create policy "tracks public read"
  on public.tracks for select using (true);

-- only logged-in admins can change songs
create policy "tracks admin insert"
  on public.tracks for insert to authenticated with check (true);
create policy "tracks admin update"
  on public.tracks for update to authenticated using (true) with check (true);
create policy "tracks admin delete"
  on public.tracks for delete to authenticated using (true);

-- 3) Storage policies for the "media" bucket --------------------
-- (Create the public bucket "media" in the dashboard first.)
create policy "media public read"
  on storage.objects for select using (bucket_id = 'media');
create policy "media admin insert"
  on storage.objects for insert to authenticated with check (bucket_id = 'media');
create policy "media admin update"
  on storage.objects for update to authenticated using (bucket_id = 'media');
create policy "media admin delete"
  on storage.objects for delete to authenticated using (bucket_id = 'media');

-- 4) Seed your existing songs (already hosted on your site) ------
-- These point at the mp3 files already on dc.thecheerdj.com, so they
-- show up right away with no re-upload. New songs added from the admin
-- page will be stored in Supabase instead.
insert into public.tracks (name, category, audio_url, duration, sort_order) values
  ('Dynamic Chaos',               'Gym Mix',  'https://dc.thecheerdj.com/dynamic_chaos.mp3',              157, 1),
  ('Comp Day Mix',                'Comp Day', 'https://dc.thecheerdj.com/comp_day.mp3',                   296, 2),
  ('Cheekin with Sami',           'Coaches',  'https://dc.thecheerdj.com/cheekin_with_sami.mp3',          179, 3),
  ('Dani Caliente',               'Coaches',  'https://dc.thecheerdj.com/dani_caliente.mp3',              179, 4),
  ('Hands in the Air for Jada',   'Coaches',  'https://dc.thecheerdj.com/hands_in_the_air_for_jada.mp3',  129, 5),
  ('The Dray Mix',                'Coaches',  'https://dc.thecheerdj.com/the_dray_mix.mp3',               167, 6),
  ('Lenny, Why You Sitting Down?','Coaches',  'https://dc.thecheerdj.com/lenny_why_you_sitting_down.mp3', 191, 7),
  ('Tracy in Boss Mode',          'Coaches',  'https://dc.thecheerdj.com/tracy_in_boss_mode.mp3',         167, 8);

-- 5) Create your admin login ------------------------------------
-- In the dashboard: Authentication > Users > Add user.
-- Enter your email + a password. That is the login for admin.html.
-- (Leave public signups OFF so only you can manage songs.)
