-- Repair cat images broken by TheCatAPI moving hosts.
--
-- The API began returning bucket URLs
-- (https://s3.us-west-2.amazonaws.com/cdn2.thecatapi.com/images/x.jpg) instead
-- of CDN URLs (https://cdn2.thecatapi.com/images/x.jpg). Both serve the same
-- file, but only the CDN host is in the app's img-src, so every cat tamed since
-- the change renders as a broken image. New rows are pinned to the canonical
-- host on the way in (src/lib/game/images.ts); this fixes the ones already
-- stored.

update public.cats
set image_url = replace(
  image_url,
  'https://s3.us-west-2.amazonaws.com/cdn2.thecatapi.com/',
  'https://cdn2.thecatapi.com/'
)
where image_url like 'https://s3.us-west-2.amazonaws.com/cdn2.thecatapi.com/%';
