import type { TranslationKey } from '../utils/i18n'

export type DrumPadId = 'kick' | 'snare' | 'hihat' | 'tomHi' | 'tomMid' | 'tomFloor' | 'crash' | 'ride'
export type DrumHitVariant = 'primary' | 'alt'

export interface DrumPad {
  id: DrumPadId
  labelKey: TranslationKey
  sample: string
  /** Alternative voice for pads that support a second sound (hi-hat open). */
  altSample?: string
  keyboardKey: string
  baseGain: number
  /** Pads played with sticks respond to edge position; the kick is pedal-played. */
  edgeTone?: boolean
}

export const DRUM_PADS: DrumPad[] = [
  { id: 'kick', labelKey: 'drum.kick', sample: 'kick.flac', keyboardKey: 'a', baseGain: 1, edgeTone: false },
  { id: 'snare', labelKey: 'drum.snare', sample: 'snare.flac', keyboardKey: 's', baseGain: 0.9 },
  { id: 'hihat', labelKey: 'drum.hihat', sample: 'hihat-closed.flac', altSample: 'hihat-open.flac', keyboardKey: 'd', baseGain: 0.8 },
  { id: 'tomHi', labelKey: 'drum.tomHi', sample: 'tom-hi.flac', keyboardKey: 'j', baseGain: 0.9 },
  { id: 'tomMid', labelKey: 'drum.tomMid', sample: 'tom-mid.flac', keyboardKey: 'k', baseGain: 0.9 },
  { id: 'tomFloor', labelKey: 'drum.tomFloor', sample: 'tom-floor.flac', keyboardKey: 'l', baseGain: 1 },
  { id: 'crash', labelKey: 'drum.crash', sample: 'crash.flac', keyboardKey: 'u', baseGain: 0.85 },
  { id: 'ride', labelKey: 'drum.ride', sample: 'ride.flac', keyboardKey: 'i', baseGain: 0.85 },
]

/** How long a pad must be held before the alternate voice (open hi-hat) triggers. */
export const ALT_HOLD_DELAY_MS = 280

/** Dedicated open-hi-hat button next to the hi-hat. */
export const HIHAT_OPEN_KEYBOARD_KEY = 'f'
export const HIHAT_OPEN_VELOCITY = 0.9

/**
 * Back-to-front paint order for the stage: the kick sits in the background,
 * the toms layer over it, and the cymbal discs render in front of the drums.
 * Cymbal floor stands are painted separately (see CYMBAL_STAND_ORDER) behind
 * everything, so their poles pass behind the drums.
 */
export const PAINT_ORDER: DrumPadId[] = ['kick', 'tomHi', 'tomMid', 'snare', 'tomFloor', 'crash', 'ride', 'hihat']

/** Cymbals whose floor stands are drawn in the background stands layer. */
export const CYMBAL_STAND_ORDER: DrumPadId[] = ['crash', 'ride', 'hihat']

export function getDrumPad(id: DrumPadId): DrumPad | undefined {
  return DRUM_PADS.find((pad) => pad.id === id)
}

export function getSampleUrl(sampleFile: string): string {
  return `${import.meta.env.BASE_URL}audio/drums/${sampleFile}`
}
