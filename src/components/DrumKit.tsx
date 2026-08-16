import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ALT_HOLD_DELAY_MS, CYMBAL_STAND_ORDER, DRUM_PADS, HIHAT_OPEN_KEYBOARD_KEY, HIHAT_OPEN_VELOCITY, PAINT_ORDER, type DrumHitVariant, type DrumPad, type DrumPadId } from '../audio/drumKit'
import type { DrumVoiceHandle } from '../audio/useDrumAudio'
import { clamp, velocityFromPointerOffset } from '../audio/levels'
import { useI18n } from '../utils/i18n'

const KEYBOARD_VELOCITY = 0.9
const FLASH_DURATION_MS = 220
const OPEN_VISUAL_DURATION_MS = 1200

export interface DrumKitProps {
  onHit: (padId: DrumPadId, velocity: number, variant?: DrumHitVariant, edgeOffset?: number) => DrumVoiceHandle | null
}

interface CymbalGeometry {
  kind: 'cymbal'
  cx: number
  cy: number
  rx: number
  ry: number
  tilt: number
  baseX: number
  baseY: number
  badge: { x: number; y: number }
}

interface ShellGeometry {
  kind: 'shell'
  cx: number
  cy: number
  rx: number
  ry: number
  chrome?: boolean
  badge: { x: number; y: number }
}

type PartGeometry = CymbalGeometry | ShellGeometry

const LAYOUT: Record<DrumPadId, PartGeometry> = {
  crash: { kind: 'cymbal', cx: 240, cy: 118, rx: 118, ry: 90, tilt: -9, baseX: 196, baseY: 476, badge: { x: 168, y: 212 } },
  ride: { kind: 'cymbal', cx: 760, cy: 116, rx: 126, ry: 96, tilt: 8, baseX: 802, baseY: 476, badge: { x: 872, y: 212 } },
  hihat: { kind: 'cymbal', cx: 142, cy: 238, rx: 84, ry: 62, tilt: 0, baseX: 142, baseY: 476, badge: { x: 204, y: 304 } },
  tomHi: { kind: 'shell', cx: 410, cy: 272, rx: 92, ry: 72, badge: { x: 410, y: 366 } },
  tomMid: { kind: 'shell', cx: 632, cy: 278, rx: 102, ry: 80, badge: { x: 632, y: 378 } },
  snare: { kind: 'shell', cx: 302, cy: 414, rx: 96, ry: 76, chrome: true, badge: { x: 302, y: 322 } },
  tomFloor: { kind: 'shell', cx: 740, cy: 420, rx: 110, ry: 88, badge: { x: 872, y: 452 } },
  kick: { kind: 'shell', cx: 514, cy: 452, rx: 150, ry: 122, badge: { x: 514, y: 452 } },
}

/**
 * Tight bounding box around the drawn kit (open-hat button to ride rim,
 * crash top to the cropped bottom row). The visible scene grows beyond it as
 * needed to match the container aspect, and the rug fills whatever is added,
 * so the drums always render at their maximum possible size.
 */
const CONTENT_BOX = { x: 56, y: 20, width: 838, height: 492 }

const LUG_ANGLES = Array.from({ length: 8 }, (_, index) => ((22.5 + index * 45) * Math.PI) / 180)

function lugPositions(cx: number, cy: number, rx: number, ry: number) {
  return LUG_ANGLES.map((angle) => ({
    x: cx + Math.cos(angle) * rx,
    y: cy + Math.sin(angle) * ry,
  }))
}

interface PointerHit {
  velocity: number
  edge: number
}

function pointerHit(event: React.PointerEvent, element: Element): PointerHit {
  const rect = element.getBoundingClientRect()
  if (!rect.width || !rect.height) return { velocity: 1, edge: 0 }
  const offsetX = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)
  const offsetY = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)
  const edge = clamp(Math.hypot(offsetX, offsetY), 0, 1)
  return { velocity: velocityFromPointerOffset(edge), edge }
}

function KeyBadge({ x, y, label, large = false }: { x: number; y: number; label: string; large?: boolean }) {
  return (
    <g className={`key-badge ${large ? 'key-badge--large' : ''}`} aria-hidden="true">
      <circle cx={x} cy={y} r={large ? 30 : 17} />
      <text x={x} y={y}>{label}</text>
    </g>
  )
}

function Tripod({ x, y }: { x: number; y: number }) {
  const legs = [
    { x: x - 46, y: y + 24 },
    { x: x + 46, y: y + 24 },
    { x: x + 16, y: y + 34 },
  ]
  return (
    <g className="kit-tripod" aria-hidden="true">
      {legs.map((leg) => (
        <line key={`${leg.x},${leg.y}`} x1={x} y1={y} x2={leg.x} y2={leg.y} className="kit-stand__leg" />
      ))}
      <path d={`M ${x - 23} ${y + 12} L ${x + 8} ${y + 17} L ${x + 23} ${y + 12}`} className="kit-stand__brace" />
      {legs.map((leg) => (
        <circle key={`foot-${leg.x},${leg.y}`} cx={leg.x} cy={leg.y} r={4.5} className="kit-stand__foot" />
      ))}
      <rect x={x - 5.5} y={y - 8} width={11} height={10} rx={3} className="kit-stand__collar" />
    </g>
  )
}

function Stand({ fromX, fromY, toX, toY }: { fromX: number; fromY: number; toX: number; toY: number }) {
  return (
    <g className="kit-stand" aria-hidden="true">
      <line x1={fromX} y1={fromY} x2={toX} y2={toY} className="kit-stand__pole" />
      <Tripod x={toX} y={toY} />
    </g>
  )
}

function ShellPart({ geometry, chrome }: { geometry: ShellGeometry; chrome: boolean }) {
  const { cx, cy, rx, ry } = geometry
  return (
    <g className="drum-part__anim">
      <ellipse cx={cx} cy={cy + ry * 0.58} rx={rx * 1.02} ry={ry * 0.46} className="part-shadow" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={chrome ? 'url(#dk-chrome)' : 'url(#dk-shell)'} stroke="var(--shell-edge)" strokeWidth="5" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="url(#dk-chrome)" strokeWidth="7" />
      <ellipse cx={cx} cy={cy} rx={rx - 10} ry={ry - 9} fill="url(#dk-head)" stroke="var(--head-edge)" strokeWidth="2.5" />
      {lugPositions(cx, cy, rx - 4, ry - 4).map((position) => (
        <circle key={`${position.x},${position.y}`} cx={position.x} cy={position.y} r={5.5} className="kit-lug" />
      ))}
    </g>
  )
}

function CymbalPart({ geometry }: { geometry: CymbalGeometry }) {
  const { cx, cy, rx, ry, tilt } = geometry
  return (
    <g transform={`rotate(${tilt} ${cx} ${cy})`}>
      <g className="drum-part__anim">
        <ellipse cx={cx} cy={cy + ry * 0.62} rx={rx * 1.0} ry={ry * 0.42} className="part-shadow" />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#dk-cymbal)" stroke="var(--cymbal-deep)" strokeWidth="4" />
        <ellipse cx={cx} cy={cy} rx={rx * 0.66} ry={ry * 0.66} className="kit-cymbal-groove" />
        <ellipse cx={cx} cy={cy} rx={rx * 0.38} ry={ry * 0.38} className="kit-cymbal-groove" />
        <ellipse cx={cx} cy={cy} rx={rx * 0.2} ry={ry * 0.2} fill="url(#dk-bell)" stroke="var(--cymbal-deep)" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={6} className="kit-stand-nut" />
      </g>
    </g>
  )
}

export default function DrumKit({ onHit }: DrumKitProps) {
  const { t } = useI18n()
  const [flash, setFlash] = useState<Partial<Record<DrumPadId, boolean>>>({})
  const [hatOpen, setHatOpen] = useState(false)
  const [containerBox, setContainerBox] = useState<{ width: number; height: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const onHitRef = useRef(onHit)

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setContainerBox({ width: rect.width, height: rect.height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const scene = useMemo(() => {
    const contentAspect = CONTENT_BOX.width / CONTENT_BOX.height
    const aspect = containerBox && containerBox.height > 0
      ? containerBox.width / containerBox.height
      : contentAspect
    if (aspect >= contentAspect) {
      // Taller-than-content container: widen the scene around the kit.
      const width = CONTENT_BOX.height * aspect
      return { x: CONTENT_BOX.x + (CONTENT_BOX.width - width) / 2, y: CONTENT_BOX.y, width, height: CONTENT_BOX.height }
    }
    // Wider-than-content container: extend the scene upward; the drum row
    // stays flush with the bottom edge.
    const height = CONTENT_BOX.width / aspect
    return { x: CONTENT_BOX.x, y: CONTENT_BOX.y - (height - CONTENT_BOX.height), width: CONTENT_BOX.width, height }
  }, [containerBox])
  const heldPointers = useRef(new Map<number, DrumPadId>())
  const heldKeys = useRef(new Set<string>())
  const altTimers = useRef(new Map<DrumPadId, ReturnType<typeof setTimeout>>())
  const hatVoice = useRef<DrumVoiceHandle | null>(null)
  const openVisualTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimers = useRef(new Map<DrumPadId, ReturnType<typeof setTimeout>>())

  useEffect(() => { onHitRef.current = onHit }, [onHit])

  useEffect(() => {
    const flashTimersRef = flashTimers
    const altTimersRef = altTimers
    const openVisualTimerRef = openVisualTimer
    return () => {
      for (const timer of flashTimersRef.current.values()) clearTimeout(timer)
      for (const timer of altTimersRef.current.values()) clearTimeout(timer)
      if (openVisualTimerRef.current) clearTimeout(openVisualTimerRef.current)
    }
  }, [])

  const flashPad = useCallback((padId: DrumPadId) => {
    setFlash((current) => ({ ...current, [padId]: true }))
    clearTimeout(flashTimers.current.get(padId))
    flashTimers.current.set(padId, setTimeout(() => {
      setFlash((current) => ({ ...current, [padId]: false }))
      flashTimers.current.delete(padId)
    }, FLASH_DURATION_MS))
  }, [])

  const releasePad = useCallback((pad: DrumPad) => {
    if (!pad.altSample) return
    const timer = altTimers.current.get(pad.id)
    if (timer) {
      clearTimeout(timer)
      altTimers.current.delete(pad.id)
    }
    setHatOpen(false)
  }, [])

  const trigger = useCallback((pad: DrumPad, hit: { velocity: number; edge: number }) => {
    flashPad(pad.id)
    if (pad.id === 'hihat') {
      hatVoice.current?.choke()
      setHatOpen(false)
      if (openVisualTimer.current) {
        clearTimeout(openVisualTimer.current)
        openVisualTimer.current = null
      }
    }
    const handle = onHitRef.current(pad.id, hit.velocity, 'primary', hit.edge)
    if (!pad.altSample) return
    hatVoice.current = handle
    clearTimeout(altTimers.current.get(pad.id))
    altTimers.current.set(pad.id, setTimeout(() => {
      altTimers.current.delete(pad.id)
      hatVoice.current?.choke()
      setHatOpen(true)
      flashPad(pad.id)
      hatVoice.current = onHitRef.current(pad.id, hit.velocity * 0.95, 'alt', hit.edge)
    }, ALT_HOLD_DELAY_MS))
  }, [flashPad])

  const triggerOpenHat = useCallback(() => {
    const timer = altTimers.current.get('hihat')
    if (timer) {
      clearTimeout(timer)
      altTimers.current.delete('hihat')
    }
    hatVoice.current?.choke()
    flashPad('hihat')
    setHatOpen(true)
    hatVoice.current = onHitRef.current('hihat', HIHAT_OPEN_VELOCITY, 'alt')
    if (openVisualTimer.current) clearTimeout(openVisualTimer.current)
    openVisualTimer.current = setTimeout(() => {
      openVisualTimer.current = null
      setHatOpen(false)
    }, OPEN_VISUAL_DURATION_MS)
  }, [flashPad])

  useEffect(() => {
    const releasePointer = (event: PointerEvent) => {
      const padId = heldPointers.current.get(event.pointerId)
      if (padId === undefined) return
      heldPointers.current.delete(event.pointerId)
      const pad = DRUM_PADS.find((entry) => entry.id === padId)
      if (pad) releasePad(pad)
    }
    window.addEventListener('pointerup', releasePointer)
    window.addEventListener('pointercancel', releasePointer)
    return () => {
      window.removeEventListener('pointerup', releasePointer)
      window.removeEventListener('pointercancel', releasePointer)
    }
  }, [releasePad])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && ['SELECT', 'INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (document.querySelector('[role="dialog"]')) return
      const key = event.key.toLowerCase()
      if (key === HIHAT_OPEN_KEYBOARD_KEY) {
        event.preventDefault()
        if (!event.repeat) triggerOpenHat()
        return
      }
      const pad = DRUM_PADS.find((entry) => entry.keyboardKey === key)
      if (!pad) return
      event.preventDefault()
      if (heldKeys.current.has(pad.id)) return
      heldKeys.current.add(pad.id)
      trigger(pad, { velocity: KEYBOARD_VELOCITY, edge: 0 })
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const pad = DRUM_PADS.find((entry) => entry.keyboardKey === event.key.toLowerCase())
      if (!pad || !heldKeys.current.delete(pad.id)) return
      releasePad(pad)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [releasePad, trigger, triggerOpenHat])

  const renderPart = (pad: DrumPad) => {
    const geometry = LAYOUT[pad.id]
    const isFlashing = flash[pad.id] === true
    const className = [
      'drum-part',
      geometry.kind === 'cymbal' ? 'drum-part--cymbal' : 'drum-part--shell',
      isFlashing ? 'drum-part--hit' : '',
    ].filter(Boolean).join(' ')
    const handlers = {
      onPointerDown: (event: React.PointerEvent<SVGGElement>) => {
        event.preventDefault()
        if (event.pointerType === 'mouse' && event.button !== 0) return
        heldPointers.current.set(event.pointerId, pad.id)
        trigger(pad, pointerHit(event, event.currentTarget))
      },
      onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        if (!event.repeat) trigger(pad, { velocity: KEYBOARD_VELOCITY, edge: 0 })
      },
      onKeyUp: (event: React.KeyboardEvent<SVGGElement>) => {
        if (event.key === 'Enter' || event.key === ' ') releasePad(pad)
      },
    }
    const label = t('drum.aria', { name: t(pad.labelKey), key: pad.keyboardKey.toUpperCase() })
    return (
      <g key={pad.id} className={className} role="button" tabIndex={0} aria-label={label} {...handlers}>
        {pad.id === 'hihat' && geometry.kind === 'cymbal' && (
          <g className={`hihat-stack ${hatOpen ? 'hihat-stack--open' : ''}`}>
            <ellipse cx={geometry.cx} cy={geometry.cy + 10} rx={geometry.rx} ry={geometry.ry} fill="url(#dk-cymbal)" stroke="var(--cymbal-deep)" strokeWidth="4" opacity="0.9" />
            <g transform={`rotate(${geometry.tilt} ${geometry.cx} ${geometry.cy})`}>
              <g className="drum-part__anim">
                <ellipse cx={geometry.cx} cy={geometry.cy} rx={geometry.rx} ry={geometry.ry} fill="url(#dk-cymbal)" stroke="var(--cymbal-deep)" strokeWidth="4" />
                <ellipse cx={geometry.cx} cy={geometry.cy} rx={geometry.rx * 0.38} ry={geometry.ry * 0.38} className="kit-cymbal-groove" />
                <ellipse cx={geometry.cx} cy={geometry.cy} rx={geometry.rx * 0.18} ry={geometry.ry * 0.18} fill="url(#dk-bell)" stroke="var(--cymbal-deep)" strokeWidth="2" />
                <rect x={geometry.cx - 7} y={geometry.cy - geometry.ry - 16} width="14" height="18" rx="4" className="kit-stand" />
              </g>
            </g>
          </g>
        )}
        {geometry.kind === 'cymbal' && pad.id !== 'hihat' && <CymbalPart geometry={geometry} />}
        {geometry.kind === 'shell' && pad.id === 'kick' && (
          <>
            <path d={`M ${geometry.cx - geometry.rx + 20} ${geometry.cy + 62} L ${geometry.cx - geometry.rx - 12} ${geometry.cy + 106} L ${geometry.cx - geometry.rx - 30} ${geometry.cy + 134}`} className="kick-spur" />
            <path d={`M ${geometry.cx + geometry.rx - 20} ${geometry.cy + 62} L ${geometry.cx + geometry.rx + 12} ${geometry.cy + 106} L ${geometry.cx + geometry.rx + 30} ${geometry.cy + 134}`} className="kick-spur" />
            <circle cx={geometry.cx - geometry.rx - 30} cy={geometry.cy + 134} r={6} className="kit-stand__foot" />
            <circle cx={geometry.cx + geometry.rx + 30} cy={geometry.cy + 134} r={6} className="kit-stand__foot" />
            <ShellPart geometry={geometry} chrome={false} />
            <circle cx={geometry.cx + geometry.rx * 0.45} cy={geometry.cy + geometry.ry * 0.45} r="15" className="kick-port" />
          </>
        )}
        {geometry.kind === 'shell' && pad.id !== 'kick' && (
          <>
            {pad.id === 'snare' && (
              <g aria-hidden="true">
                <line x1={geometry.cx} y1={geometry.cy + geometry.ry + 4} x2={geometry.cx} y2={geometry.cy + geometry.ry + 64} className="kit-stand__pole" />
                <path d={`M ${geometry.cx} ${geometry.cy + geometry.ry + 18} Q ${geometry.cx - 26} ${geometry.cy + geometry.ry + 14} ${geometry.cx - 46} ${geometry.cy + geometry.ry + 1}`} className="kit-stand__arm" />
                <path d={`M ${geometry.cx} ${geometry.cy + geometry.ry + 18} Q ${geometry.cx + 26} ${geometry.cy + geometry.ry + 14} ${geometry.cx + 46} ${geometry.cy + geometry.ry + 1}`} className="kit-stand__arm" />
                <Tripod x={geometry.cx} y={geometry.cy + geometry.ry + 64} />
              </g>
            )}
            {pad.id === 'tomFloor' && (
              <g aria-hidden="true">
                <line x1={geometry.cx - geometry.rx + 18} y1={geometry.cy + geometry.ry * 0.7} x2={geometry.cx - geometry.rx + 6} y2={geometry.cy + geometry.ry - 4} className="tom-leg" />
                <line x1={geometry.cx + geometry.rx - 18} y1={geometry.cy + geometry.ry * 0.7} x2={geometry.cx + geometry.rx - 6} y2={geometry.cy + geometry.ry - 4} className="tom-leg" />
                <line x1={geometry.cx} y1={geometry.cy + geometry.ry * 0.94} x2={geometry.cx + 4} y2={geometry.cy + geometry.ry} className="tom-leg" />
                <circle cx={geometry.cx - geometry.rx + 6} cy={geometry.cy + geometry.ry - 4} r={5} className="kit-stand__foot" />
                <circle cx={geometry.cx + geometry.rx - 6} cy={geometry.cy + geometry.ry - 4} r={5} className="kit-stand__foot" />
                <circle cx={geometry.cx + 4} cy={geometry.cy + geometry.ry} r={5} className="kit-stand__foot" />
              </g>
            )}
            <ShellPart geometry={geometry} chrome={geometry.chrome === true} />
          </>
        )}
        <KeyBadge x={geometry.badge.x} y={geometry.badge.y} label={pad.keyboardKey.toUpperCase()} large={pad.id === 'kick'} />
      </g>
    )
  }

  return (
    <div ref={containerRef} className="drum-stage" onContextMenu={(event) => event.preventDefault()}>
      <svg className="drum-stage__svg" viewBox={`${scene.x} ${scene.y} ${scene.width} ${scene.height}`} preserveAspectRatio="xMidYMax meet" role="group" aria-label={t('kit.stageLabel')}>
        <defs>
          <linearGradient id="dk-shell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--shell-light)" />
            <stop offset="1" stopColor="var(--shell-dark)" />
          </linearGradient>
          <linearGradient id="dk-chrome" x1="0" y1="0" x2="0.6" y2="1">
            <stop offset="0" stopColor="var(--hoop-light)" />
            <stop offset="0.5" stopColor="var(--hoop)" />
            <stop offset="1" stopColor="var(--hoop-dark)" />
          </linearGradient>
          <linearGradient id="dk-cymbal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--cymbal-light)" />
            <stop offset="0.55" stopColor="var(--cymbal)" />
            <stop offset="1" stopColor="var(--cymbal-deep)" />
          </linearGradient>
          <radialGradient id="dk-head">
            <stop offset="0" stopColor="var(--head-center)" />
            <stop offset="0.78" stopColor="var(--head)" />
            <stop offset="1" stopColor="var(--head-edge)" />
          </radialGradient>
          <radialGradient id="dk-bell">
            <stop offset="0" stopColor="var(--cymbal-bright)" />
            <stop offset="1" stopColor="var(--cymbal-deep)" />
          </radialGradient>
        </defs>
        <rect x={scene.x} y={scene.y} width={scene.width} height={scene.height} className="kit-rug" />
        <rect x={scene.x + 18} y={scene.y + 16} width={scene.width - 36} height={scene.height - 32} rx="26" className="kit-rug-inner" />
        <g className="stand-layer">
          {CYMBAL_STAND_ORDER.map((padId) => {
            const geometry = LAYOUT[padId]
            return geometry.kind === 'cymbal'
              ? <Stand key={padId} fromX={geometry.cx} fromY={geometry.cy} toX={geometry.baseX} toY={geometry.baseY} />
              : null
          })}
        </g>
        {PAINT_ORDER.map((padId) => {
          const pad = DRUM_PADS.find((entry) => entry.id === padId)
          return pad ? renderPart(pad) : null
        })}
        <g
          className="hihat-open-button"
          role="button"
          tabIndex={0}
          aria-label={t('drum.hihatOpen')}
          onPointerDown={(event) => {
            event.preventDefault()
            event.stopPropagation()
            if (event.pointerType === 'mouse' && event.button !== 0) return
            triggerOpenHat()
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            if (!event.repeat) triggerOpenHat()
          }}
        >
          <circle cx={86} cy={196} r={28} />
          <ellipse cx={86} cy={187} rx={12.5} ry={4} />
          <ellipse cx={86} cy={205} rx={12.5} ry={4} />
        </g>
      </svg>
    </div>
  )
}
