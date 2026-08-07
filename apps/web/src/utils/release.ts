/**
 * Launch moment for the game at https://meow.magic-cats.fyi
 *
 * 17 August 2026, 12:00 Europe/Prague. August is CEST (UTC+2), so the instant is
 * 10:00 UTC — written here as an absolute UTC timestamp so it does not drift
 * with the build machine's timezone.
 */
export const RELEASE_AT = new Date('2026-08-17T10:00:00Z')

export const GAME_URL = 'https://meow.magic-cats.fyi'

export const isReleased = (now: Date = new Date()): boolean => now.getTime() >= RELEASE_AT.getTime()
