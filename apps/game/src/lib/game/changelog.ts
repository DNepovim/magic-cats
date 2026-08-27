/**
 * What's new, announced once per release.
 *
 * The newest entry's `version` is what the app compares against the version a
 * player has already seen (kept in localStorage). Bump it when there is
 * something worth interrupting someone for — not for every deploy.
 */

export type Release = {
  version: string;
  date: string;
  headline: string;
  /** Message keys, so the notes are translated like everything else. */
  notes: string[];
};

export const RELEASES: Release[] = [
  {
    version: '2026.08.27',
    date: '2026-08-27',
    headline: 'news_2026_08_27_headline',
    notes: [
      'news_2026_08_27_age',
      'news_2026_08_27_mating',
      'news_2026_08_27_cuddle',
      'news_2026_08_27_sharing',
    ],
  },
];

export const LATEST_RELEASE = RELEASES[0];

/** Where the last-seen version lives. Namespaced, since it is shared storage. */
export const SEEN_RELEASE_KEY = 'magic-cats:seen-release';
