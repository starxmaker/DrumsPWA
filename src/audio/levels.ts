export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Maps the persisted 0–100 volume setting onto a perceptual master gain. */
export function masterGainFromVolume(volumePercent: number): number {
  const normalized = clamp(Math.round(volumePercent), 0, 100) / 100
  return normalized ** 1.5
}

/**
 * Maps the pointer's distance from the centre of a pad (0 = centre, 1 = edge)
 * onto a hit velocity: centre hits are full strength, edge hits softer.
 */
export function velocityFromPointerOffset(offsetRatio: number): number {
  return 1 - 0.35 * clamp(offsetRatio, 0, 1)
}

export function voiceGain(baseGain: number, velocity: number): number {
  return clamp(baseGain * clamp(velocity, 0, 1), 0, 1)
}

export const EDGE_FILTER_OPEN_CUTOFF = 16000
const EDGE_FILTER_EDGE_CUTOFF = 2800

/**
 * Maps a hit's edge offset (0 = centre, 1 = rim) onto a low-pass cutoff:
 * centre hits stay untouched while rim hits get progressively darker.
 */
export function lowpassCutoffFromOffset(offset: number): number {
  const ratio = clamp(offset, 0, 1)
  return EDGE_FILTER_OPEN_CUTOFF * (EDGE_FILTER_EDGE_CUTOFF / EDGE_FILTER_OPEN_CUTOFF) ** ratio
}

/**
 * Volume curve for pads without positional tone (the kick): the position
 * still adds a little dynamics, but far less than for stick-played pads.
 */
export function centerWeightedVelocity(velocity: number): number {
  return 1 - (1 - clamp(velocity, 0, 1)) * 0.35
}
