-- Local development seed data.
--
-- Runs automatically after migrations on:
--   * `supabase start`
--   * `supabase db reset`
--
-- IMPORTANT: This file is for LOCAL DEV ONLY. It inserts fake auth.users rows
-- so the dashboard has cats to display before you sign in. Do NOT push this
-- to any cloud Supabase project. `supabase db push` ignores seed.sql by design.

-- ──────────────────────────────────────────────────────────────────────────
-- Dummy auth users (so cats have a valid owner_user_id FK target)
-- ──────────────────────────────────────────────────────────────────────────
insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'eliceek@dev.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"eliceek"}'::jsonb,
    now() - interval '7 days',
    now() - interval '7 days'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'kelthos@dev.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Kelthos"}'::jsonb,
    now() - interval '5 days',
    now() - interval '5 days'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'starpounce@dev.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"StarPounce"}'::jsonb,
    now() - interval '2 days',
    now() - interval '2 days'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'ruprd@dev.local',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ruprd"}'::jsonb,
    now() - interval '12 hours',
    now() - interval '12 hours'
  )
on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────────────────
-- Their cats — these show up in the "Other Tribes" sidebar on the dashboard
-- ──────────────────────────────────────────────────────────────────────────
insert into public.cats (
  owner_user_id,
  name,
  image_url,
  domestication_points,
  domesticated_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    'Shadow Whiskers',
    'https://cdn2.thecatapi.com/images/MTk3OTg4OA.jpg',
    145,
    now() - interval '6 days'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Storm Paws',
    'https://cdn2.thecatapi.com/images/bje.jpg',
    122,
    now() - interval '4 days'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'Astral Mews',
    'https://cdn2.thecatapi.com/images/3cr.jpg',
    108,
    now() - interval '1 day'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'Moon Tail',
    'https://cdn2.thecatapi.com/images/9ic.jpg',
    102,
    now() - interval '3 hours'
  )
on conflict (owner_user_id) do nothing;
