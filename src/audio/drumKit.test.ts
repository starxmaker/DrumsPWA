import { DRUM_PADS, getDrumPad, getSampleUrl } from './drumKit'
import en from '../locales/en.json'

describe('drum kit definition', () => {
  it('exposes the eight pads of a standard kit', () => {
    expect(DRUM_PADS.map((pad) => pad.id)).toEqual([
      'kick', 'snare', 'hihat', 'tomHi', 'tomMid', 'tomFloor', 'crash', 'ride',
    ])
  })

  it('uses unique ids, keyboard keys, and samples', () => {
    expect(new Set(DRUM_PADS.map((pad) => pad.id)).size).toBe(DRUM_PADS.length)
    expect(new Set(DRUM_PADS.map((pad) => pad.keyboardKey)).size).toBe(DRUM_PADS.length)
    const files = DRUM_PADS.flatMap((pad) => [pad.sample, pad.altSample]).filter(Boolean)
    expect(new Set(files).size).toBe(files.length)
  })

  it('maps every pad to an existing translation key', () => {
    for (const pad of DRUM_PADS) {
      expect(en[pad.labelKey]).toBeTruthy()
    }
  })

  it('uses single lowercase letter keyboard keys', () => {
    for (const pad of DRUM_PADS) {
      expect(pad.keyboardKey).toMatch(/^[a-z]$/)
    }
  })

  it('resolves sample URLs under the deployment base path', () => {
    expect(getSampleUrl('kick.flac').endsWith('/audio/drums/kick.flac')).toBe(true)
  })

  it('looks pads up by id', () => {
    expect(getDrumPad('snare')?.sample).toBe('snare.flac')
    expect(getDrumPad('snare')?.labelKey).toBe('drum.snare')
  })
})
