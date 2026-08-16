import type { DrumHitVariant, DrumPadId } from './drumKit'

const NOISE_DURATION_SECONDS = 2
const noiseCache = new WeakMap<AudioContext, AudioBuffer>()

function noiseBuffer(context: AudioContext): AudioBuffer {
  const cached = noiseCache.get(context)
  if (cached) return cached
  const frameCount = Math.ceil(context.sampleRate * NOISE_DURATION_SECONDS)
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
  noiseCache.set(context, buffer)
  return buffer
}

interface ToneOptions {
  type: OscillatorType
  fromFrequency: number
  toFrequency?: number
  duration: number
  peak: number
}

function spawnTone(context: AudioContext, destination: AudioNode, options: ToneOptions): void {
  const now = context.currentTime
  const oscillator = context.createOscillator()
  oscillator.type = options.type
  oscillator.frequency.setValueAtTime(options.fromFrequency, now)
  if (options.toFrequency !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(options.toFrequency, now + options.duration * 0.8)
  }
  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(options.peak, 0.0002), now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration)
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start(now)
  oscillator.stop(now + options.duration + 0.05)
}

interface NoiseOptions {
  filterType: BiquadFilterType
  frequency: number
  q: number
  duration: number
  peak: number
}

function spawnNoise(context: AudioContext, destination: AudioNode, options: NoiseOptions): void {
  const now = context.currentTime
  const source = context.createBufferSource()
  source.buffer = noiseBuffer(context)
  source.loop = true
  const filter = context.createBiquadFilter()
  filter.type = options.filterType
  filter.frequency.value = options.frequency
  filter.Q.value = options.q
  const gain = context.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(Math.max(options.peak, 0.0002), now + 0.004)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + options.duration)
  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  source.start(now, Math.random() * NOISE_DURATION_SECONDS * 0.5)
  source.stop(now + options.duration + 0.05)
}

/**
 * Synthesizes a drum voice with the Web Audio API when the recorded sample for
 * a pad could not be loaded. Rough imitations — only used as a graceful fallback.
 */
export function synthesizeDrumHit(
  context: AudioContext,
  destination: AudioNode,
  padId: DrumPadId,
  variant: DrumHitVariant,
  peak: number,
): void {
  switch (padId) {
    case 'kick':
      spawnTone(context, destination, { type: 'sine', fromFrequency: 150, toFrequency: 45, duration: 0.42, peak })
      break
    case 'snare':
      spawnTone(context, destination, { type: 'triangle', fromFrequency: 185, toFrequency: 130, duration: 0.16, peak: peak * 0.5 })
      spawnNoise(context, destination, { filterType: 'highpass', frequency: 1600, q: 0.7, duration: 0.2, peak: peak * 0.8 })
      break
    case 'tomHi':
      spawnTone(context, destination, { type: 'sine', fromFrequency: 220, toFrequency: 170, duration: 0.4, peak })
      break
    case 'tomMid':
      spawnTone(context, destination, { type: 'sine', fromFrequency: 170, toFrequency: 130, duration: 0.45, peak })
      break
    case 'tomFloor':
      spawnTone(context, destination, { type: 'sine', fromFrequency: 120, toFrequency: 88, duration: 0.55, peak })
      break
    case 'hihat':
      if (variant === 'alt') {
        spawnNoise(context, destination, { filterType: 'highpass', frequency: 7000, q: 0.8, duration: 0.5, peak: peak * 0.7 })
      } else {
        spawnNoise(context, destination, { filterType: 'highpass', frequency: 9000, q: 0.8, duration: 0.06, peak: peak * 0.6 })
      }
      break
    case 'crash':
      spawnNoise(context, destination, { filterType: 'bandpass', frequency: 5000, q: 0.6, duration: 1.3, peak: peak * 0.7 })
      break
    case 'ride':
      spawnNoise(context, destination, { filterType: 'bandpass', frequency: 3600, q: 1.2, duration: 1.1, peak: peak * 0.55 })
      break
  }
}
