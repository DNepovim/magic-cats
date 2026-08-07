import { GAME_URL, RELEASE_AT, isReleased } from '@/utils/release'

const pad = (value: number): string => String(value).padStart(2, '0')

const applyGates = (released: boolean): void => {
  document.querySelectorAll('[data-release-gate]').forEach((gate) => {
    const before = gate.querySelector('[data-gate="before"]')
    const after = gate.querySelector('[data-gate="after"]')
    before?.toggleAttribute('hidden', released)
    after?.toggleAttribute('hidden', !released)
  })
}

const applyCountdowns = (): void => {
  const remaining = Math.max(0, RELEASE_AT.getTime() - Date.now())
  const values = {
    days: pad(Math.floor(remaining / 86_400_000)),
    hours: pad(Math.floor(remaining / 3_600_000) % 24),
    minutes: pad(Math.floor(remaining / 60_000) % 60),
    seconds: pad(Math.floor(remaining / 1000) % 60),
  }

  for (const [unit, value] of Object.entries(values)) {
    document.querySelectorAll(`[data-countdown-unit="${unit}"]`).forEach((el) => {
      if (el.textContent !== value) el.textContent = value
    })
  }
}

// The popup CTAs scroll to #join before launch, which is where the play button
// lands anyway — after launch they may as well go straight to the game.
const applyGateLinks = (released: boolean): void => {
  document.querySelectorAll('a[data-gate-href]').forEach((link) => {
    link.setAttribute('href', released ? GAME_URL : '#join')
  })
}

const tick = (): void => {
  const released = isReleased()
  applyGates(released)
  applyGateLinks(released)
  if (!released) applyCountdowns()
}

// The build bakes in whichever side was correct when the page was generated, so
// correct it immediately — a CDN copy built before launch would otherwise show
// the countdown forever.
tick()
setInterval(tick, 1000)
