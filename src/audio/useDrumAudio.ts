import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DRUM_PADS, getDrumPad, getSampleUrl, type DrumHitVariant, type DrumPadId } from './drumKit'
import { centerWeightedVelocity, EDGE_FILTER_OPEN_CUTOFF, lowpassCutoffFromOffset, masterGainFromVolume, voiceGain } from './levels'
import { synthesizeDrumHit } from './synthFallback'

export type DrumAudioStatus = 'loading' | 'ready' | 'error'
export type DrumVoiceHandle = { choke: () => void }

const MAX_VOICES = 32
const ATTACK_SECONDS = 0.003

interface ActiveVoice {
  source: AudioBufferSourceNode
  gain: GainNode
}

function audioContextConstructor(): (typeof AudioContext | undefined) {
  return window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

function uniqueSampleFiles(): string[] {
  const files = new Set<string>()
  for (const pad of DRUM_PADS) {
    files.add(pad.sample)
    if (pad.altSample) files.add(pad.altSample)
  }
  return [...files]
}

/**
 * Persistent polyphonic drum engine. A single shared AudioContext is created up
 * front (suspended until the first user gesture plays a hit) and every hit
 * spawns its own BufferSource -> Gain voice, so simultaneous multi-touch hits
 * all sound at once.
 */
export function useDrumAudio(volumePercent: number) {
  const [status, setStatus] = useState<DrumAudioStatus>(() => (audioContextConstructor() ? 'loading' : 'error'))
  const [running, setRunning] = useState(false)
  const [loadedCount, setLoadedCount] = useState(0)
  const [usingFallback, setUsingFallback] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const contextRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const buffersRef = useRef<Map<string, AudioBuffer>>(new Map())
  const voicesRef = useRef<ActiveVoice[]>([])
  const volumeRef = useRef(volumePercent)
  const sampleFiles = useMemo(() => uniqueSampleFiles(), [])

  useEffect(() => {
    let cancelled = false
    const buffers = new Map<string, AudioBuffer>()
    let missingCount = 0

    const AudioContextCtor = audioContextConstructor()
    if (!AudioContextCtor) return

    const context = new AudioContextCtor()
    const master = context.createGain()
    master.gain.value = masterGainFromVolume(volumeRef.current)
    master.connect(context.destination)
    contextRef.current = context
    masterRef.current = master
    buffersRef.current = buffers
    // The context starts suspended (no user gesture yet); `running` tracks it
    // so the UI can ask for an explicit tap before the first drum hit.
    const syncState = () => setRunning(context.state === 'running')
    context.addEventListener('statechange', syncState)

    const loadSamples = async () => {
      for (const file of sampleFiles) {
        try {
          const response = await fetch(getSampleUrl(file))
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const bytes = await response.arrayBuffer()
          const buffer = await context.decodeAudioData(bytes)
          if (cancelled) return
          buffers.set(file, buffer)
          setLoadedCount(buffers.size)
        } catch (error) {
          if (cancelled) return
          missingCount += 1
          console.warn(`Failed to load drum sample ${file}; a synthesized fallback will be used.`, error)
        }
      }
      if (cancelled) return
      setUsingFallback(missingCount > 0)
      setStatus(missingCount >= sampleFiles.length ? 'error' : 'ready')
    }
    void loadSamples()

    return () => {
      cancelled = true
      context.removeEventListener('statechange', syncState)
      for (const voice of voicesRef.current) {
        try { voice.source.stop() } catch { /* Already stopped. */ }
      }
      voicesRef.current = []
      void context.close().catch(() => undefined)
      contextRef.current = null
      masterRef.current = null
    }
  }, [retryCount, sampleFiles])

  useEffect(() => {
    // Mobile browsers suspend the context when backgrounded; re-check it when
    // returning to the foreground so the resume prompt can come back.
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const context = contextRef.current
      if (context) setRunning(context.state === 'running')
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  useEffect(() => {
    volumeRef.current = volumePercent
    const master = masterRef.current
    const context = contextRef.current
    if (!master || !context) return
    master.gain.setTargetAtTime(masterGainFromVolume(volumePercent), context.currentTime, 0.02)
  }, [volumePercent])

  const play = useCallback(
    (padId: DrumPadId, velocity = 1, variant: DrumHitVariant = 'primary', edgeOffset = 0): DrumVoiceHandle | null => {
      const context = contextRef.current
      const master = masterRef.current
      if (!context || !master) return null
      // Called from a pointer/key handler, so this resume() satisfies the
      // mobile autoplay unlock requirement.
      if (context.state === 'suspended') void context.resume().catch(() => undefined)
      const pad = getDrumPad(padId)
      if (!pad) return null
      const positional = pad.edgeTone !== false
      const file = variant === 'alt' && pad.altSample ? pad.altSample : pad.sample
      const peak = voiceGain(pad.baseGain, positional ? velocity : centerWeightedVelocity(velocity))
      const buffer = buffersRef.current.get(file)
      if (!buffer) {
        console.warn(`Drum sample unavailable (${file}); synthesizing "${padId}".`)
        synthesizeDrumHit(context, master, padId, variant, peak)
        return null
      }

      const now = context.currentTime
      const source = context.createBufferSource()
      source.buffer = buffer
      const gain = context.createGain()
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + ATTACK_SECONDS)
      // Rim hits run through a low-pass so they sound darker than centre hits.
      const cutoff = positional ? lowpassCutoffFromOffset(edgeOffset) : EDGE_FILTER_OPEN_CUTOFF
      let filter: BiquadFilterNode | null = null
      if (cutoff < 14000) {
        filter = context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = cutoff
        filter.Q.value = 0.7
        source.connect(filter)
        filter.connect(gain)
      } else {
        source.connect(gain)
      }
      gain.connect(master)
      source.start(now)

      const voice: ActiveVoice = { source, gain }
      voicesRef.current.push(voice)
      while (voicesRef.current.length > MAX_VOICES) {
        const oldest = voicesRef.current.shift()
        if (!oldest) break
        const cutoff = context.currentTime
        oldest.gain.gain.cancelScheduledValues(cutoff)
        oldest.gain.gain.setTargetAtTime(0.0001, cutoff, 0.01)
        oldest.source.stop(cutoff + 0.05)
      }
      source.onended = () => {
        voicesRef.current = voicesRef.current.filter((entry) => entry !== voice)
        gain.disconnect()
        source.disconnect()
        filter?.disconnect()
      }
      return {
        choke: () => {
          const cutoff = context.currentTime
          gain.gain.cancelScheduledValues(cutoff)
          gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), cutoff)
          gain.gain.exponentialRampToValueAtTime(0.0001, cutoff + 0.035)
          source.stop(cutoff + 0.05)
        },
      }
    },
    [],
  )

  const resume = useCallback(() => {
    const context = contextRef.current
    if (!context) return
    void context.resume().then(() => setRunning(context.state === 'running')).catch(() => undefined)
  }, [])

  const retry = useCallback(() => {
    setStatus('loading')
    setLoadedCount(0)
    setUsingFallback(false)
    setRetryCount((count) => count + 1)
  }, [])

  return { status, running, resume, loadedCount, totalCount: sampleFiles.length, usingFallback, play, retry }
}
