import { centerWeightedVelocity, clamp, lowpassCutoffFromOffset, masterGainFromVolume, velocityFromPointerOffset, voiceGain } from './levels'

describe('clamp', () => {
  it('keeps values inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-3, 0, 10)).toBe(0)
    expect(clamp(42, 0, 10)).toBe(10)
  })
})

describe('masterGainFromVolume', () => {
  it('is silent at zero volume and unit at full volume', () => {
    expect(masterGainFromVolume(0)).toBe(0)
    expect(masterGainFromVolume(100)).toBe(1)
  })

  it('follows a perceptual curve and clamps out-of-range input', () => {
    expect(masterGainFromVolume(50)).toBeCloseTo(0.354, 3)
    expect(masterGainFromVolume(150)).toBe(1)
    expect(masterGainFromVolume(-20)).toBe(0)
  })
})

describe('velocityFromPointerOffset', () => {
  it('gives full strength at the centre and softer hits towards the edge', () => {
    expect(velocityFromPointerOffset(0)).toBe(1)
    expect(velocityFromPointerOffset(1)).toBeCloseTo(0.65, 10)
    expect(velocityFromPointerOffset(0.5)).toBeCloseTo(0.825, 10)
    expect(velocityFromPointerOffset(7)).toBeCloseTo(0.65, 10)
    expect(velocityFromPointerOffset(-2)).toBe(1)
  })
})

describe('voiceGain', () => {
  it('scales the pad base gain by the hit velocity and clamps to [0, 1]', () => {
    expect(voiceGain(0.9, 1)).toBeCloseTo(0.9, 10)
    expect(voiceGain(0.9, 0.5)).toBeCloseTo(0.45, 10)
    expect(voiceGain(1.4, 1)).toBe(1)
    expect(voiceGain(0.8, 0)).toBe(0)
  })
})

describe('lowpassCutoffFromOffset', () => {
  it('stays transparent at the centre and clearly darkens at the rim', () => {
    expect(lowpassCutoffFromOffset(0)).toBeCloseTo(16000, 5)
    expect(lowpassCutoffFromOffset(1)).toBeCloseTo(2800, 5)
    expect(lowpassCutoffFromOffset(-2)).toBeCloseTo(16000, 5)
    expect(lowpassCutoffFromOffset(9)).toBeCloseTo(2800, 5)
  })

  it('decreases monotonically towards the rim', () => {
    const centre = lowpassCutoffFromOffset(0)
    const mid = lowpassCutoffFromOffset(0.5)
    const rim = lowpassCutoffFromOffset(1)
    expect(centre).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(rim)
    expect(mid).toBeCloseTo(Math.sqrt(16000 * 2800), 3)
  })
})

describe('centerWeightedVelocity', () => {
  it('keeps the kick nearly full-strength regardless of tap position', () => {
    expect(centerWeightedVelocity(1)).toBe(1)
    expect(centerWeightedVelocity(0.65)).toBeCloseTo(0.8775, 5)
    expect(centerWeightedVelocity(0)).toBeCloseTo(0.65, 5)
    expect(centerWeightedVelocity(-3)).toBeCloseTo(0.65, 5)
  })
})
