/**
 * TheCatAPI has started handing out its images as bucket URLs —
 * `https://s3.us-west-2.amazonaws.com/cdn2.thecatapi.com/images/x.jpg` — rather
 * than through its own CDN host. Both serve the same file, but only the CDN
 * host is in this app's `img-src` (apps/game/vercel.json), so a bucket URL is
 * blocked by CSP before the request is even made and the cat renders as a
 * broken image.
 *
 * Pinning the URL back to the canonical host on the way in keeps the policy
 * narrow and every stored `image_url` in one shape.
 */

const BUCKET_PREFIX = 'https://s3.us-west-2.amazonaws.com/cdn2.thecatapi.com/';
const CDN_PREFIX = 'https://cdn2.thecatapi.com/';

export const canonicalCatImageUrl = (url: string): string =>
  url.startsWith(BUCKET_PREFIX) ? CDN_PREFIX + url.slice(BUCKET_PREFIX.length) : url;
