import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ALT_HOLD_DELAY_MS, CYMBAL_STAND_ORDER, DRUM_PADS, HIHAT_OPEN_VELOCITY, PAINT_ORDER, type DrumHitVariant, type DrumPad, type DrumPadId } from '../audio/drumKit'
import type { DrumVoiceHandle } from '../audio/useDrumAudio'
import { clamp, velocityFromPointerOffset } from '../audio/levels'
import { useI18n } from '../utils/i18n'

const FLASH_DURATION_MS = 220
const OPEN_VISUAL_DURATION_MS = 1200
const KIT_X_OFFSET = -5

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
}

interface ShellGeometry {
  kind: 'shell'
  cx: number
  cy: number
  rx: number
  ry: number
  depth?: number
  tilt?: number
  chrome?: boolean
}

const CYMBAL_RIDGES = [0.86, 0.74, 0.62, 0.5, 0.38, 0.28]

function CymbalRidges({ cx, cy, rx, ry }: Pick<CymbalGeometry, 'cx' | 'cy' | 'rx' | 'ry'>) {
  return <>{CYMBAL_RIDGES.map((scale) => (
    <ellipse key={scale} cx={cx} cy={cy} rx={rx * scale} ry={ry * scale} className="kit-cymbal-groove" />
  ))}</>
}

type PartGeometry = CymbalGeometry | ShellGeometry

const LAYOUT: Record<DrumPadId, PartGeometry> = {
  crash: { kind: 'cymbal', cx: 110, cy: 108, rx: 134, ry: 88, tilt: -9, baseX: 96, baseY: 500 },
  ride: { kind: 'cymbal', cx: 850, cy: 106, rx: 136, ry: 92, tilt: 8, baseX: 874, baseY: 500 },
  hihat: { kind: 'cymbal', cx: 100, cy: 264, rx: 98, ry: 64, tilt: 0, baseX: 100, baseY: 500 },
  tomHi: { kind: 'shell', cx: 375, cy: 194, rx: 102, ry: 78, tilt: -7 },
  tomMid: { kind: 'shell', cx: 625, cy: 186, rx: 112, ry: 85, tilt: 7 },
  snare: { kind: 'shell', cx: 245, cy: 402, rx: 124, ry: 93, chrome: true },
  tomFloor: { kind: 'shell', cx: 775, cy: 382, rx: 142, ry: 108 },
  kick: { kind: 'shell', cx: 510, cy: 418, rx: 164, ry: 104 },
}

/**
 * Tight bounding box around the drawn kit (open-hat button to ride rim,
 * crash top to the cropped bottom row). The visible scene grows beyond it as
 * needed to match the container aspect, and the rug fills whatever is added,
 * so the drums always render at their maximum possible size.
 */
const CONTENT_BOX = { x: 28, y: 12, width: 904, height: 500 }

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

function TomMount() {
  const highTom = LAYOUT.tomHi as ShellGeometry
  const midTom = LAYOUT.tomMid as ShellGeometry
  const hubX = (highTom.cx + midTom.cx) / 2
  const hubY = 320
  return (
    <g className="kit-tom-mount" aria-hidden="true">
      <line x1={highTom.cx + highTom.rx * 0.34} y1={highTom.cy + highTom.ry * 0.55} x2={hubX - 28} y2={hubY} />
      <line x1={midTom.cx - midTom.rx * 0.34} y1={midTom.cy + midTom.ry * 0.55} x2={hubX + 28} y2={hubY} />
      <line x1={hubX} y1={hubY - 18} x2={hubX} y2={hubY + 46} />
      <rect x={hubX - 20} y={hubY - 10} width={40} height={20} rx={6} className="kit-tom-mount__clamp" />
      <circle cx={hubX} cy={hubY} r={5} className="kit-tom-mount__bolt" />
    </g>
  )
}

function ShellPart({ geometry, chrome }: { geometry: ShellGeometry; chrome: boolean }) {
  const { cx, cy, rx, ry } = geometry
  const depth = geometry.depth ?? Math.round(ry * 0.82)
  const shellBody = `M ${cx - rx + 7} ${cy + ry * 0.16} Q ${cx} ${cy + ry * 0.94} ${cx + rx - 7} ${cy + ry * 0.16} L ${cx + rx - 7} ${cy + ry * 0.16 + depth} Q ${cx} ${cy + ry * 1.32 + depth} ${cx - rx + 7} ${cy + ry * 0.16 + depth} Z`
  return (
    <g className="drum-part__anim">
      <ellipse cx={cx} cy={cy + ry * 0.82 + depth} rx={rx * 1.04} ry={ry * 0.46} className="part-shadow" />
      <path d={shellBody} fill={chrome ? 'url(#dk-chrome)' : 'url(#dk-shell-body)'} stroke="var(--shell-edge)" strokeWidth="4" className="kit-shell-body" />
      <path d={`M ${cx - rx + 7} ${cy + ry * 0.16 + depth} Q ${cx} ${cy + ry * 1.32 + depth} ${cx + rx - 7} ${cy + ry * 0.16 + depth}`} className="kit-shell-bottom-rim" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#dk-shell)" stroke="var(--shell-edge)" strokeWidth="5" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="url(#dk-chrome)" strokeWidth="9" />
      <ellipse cx={cx} cy={cy} rx={rx - 10} ry={ry - 9} fill="url(#dk-head)" stroke="var(--head-edge)" strokeWidth="2.5" />
      <ellipse cx={cx} cy={cy} rx={(rx - 10) * 0.78} ry={(ry - 9) * 0.78} className="kit-head-ring" />
      <path d={`M ${cx - rx * 0.56} ${cy - ry * 0.34} Q ${cx} ${cy - ry * 0.67} ${cx + rx * 0.56} ${cy - ry * 0.34}`} className="kit-head-gloss" />
      {lugPositions(cx, cy, rx - 4, ry - 4).map((position) => (
        <circle key={`${position.x},${position.y}`} cx={position.x} cy={position.y} r={5.5} className="kit-lug" />
      ))}
    </g>
  )
}

function KickPart({ geometry }: { geometry: ShellGeometry }) {
  const { cx, cy, rx, ry } = geometry
  const shellOffset = 94
  const rearY = cy - shellOffset
  const rearLeftX = cx - rx * 0.84
  const rearRightX = cx + rx * 0.84
  const frontLeftX = cx - rx * 0.94
  const frontRightX = cx + rx * 0.94
  return (
    <g className="drum-part__anim">
      <ellipse cx={cx} cy={cy + ry * 0.78} rx={rx * 1.08} ry={ry * 0.48} className="part-shadow" />
      <ellipse cx={cx} cy={rearY} rx={rx * 0.9} ry={ry * 0.78} fill="url(#dk-shell-body)" stroke="var(--shell-edge)" strokeWidth="5" className="kit-kick-shell" />
      <path d={`M ${rearLeftX} ${rearY} L ${rearRightX} ${rearY} L ${frontRightX} ${cy + ry * 0.24} L ${frontLeftX} ${cy + ry * 0.24} Z`} fill="url(#dk-shell-body)" stroke="var(--shell-edge)" strokeWidth="4" />
      <line x1={rearLeftX} y1={rearY} x2={frontLeftX} y2={cy + ry * 0.24} className="kit-kick-shell-rail" />
      <line x1={rearRightX} y1={rearY} x2={frontRightX} y2={cy + ry * 0.24} className="kit-kick-shell-rail" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#dk-shell)" stroke="var(--shell-edge)" strokeWidth="6" />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="url(#dk-chrome)" strokeWidth="11" />
      <ellipse cx={cx} cy={cy} rx={rx - 13} ry={ry - 12} fill="url(#dk-kick-head)" stroke="var(--head-edge)" strokeWidth="3" />
      <path d={`M ${cx - rx * 0.78} ${cy - ry * 0.2} Q ${cx} ${cy - ry * 0.82} ${cx + rx * 0.78} ${cy - ry * 0.2} L ${cx + rx * 0.62} ${cy + ry * 0.04} Q ${cx} ${cy - ry * 0.42} ${cx - rx * 0.62} ${cy + ry * 0.04} Z`} className="kit-kick-head-shadow" />
      <ellipse cx={cx} cy={cy} rx={(rx - 13) * 0.7} ry={(ry - 12) * 0.7} className="kit-head-ring" />
      <path d={`M ${cx - rx * 0.54} ${cy - ry * 0.36} Q ${cx} ${cy - ry * 0.68} ${cx + rx * 0.54} ${cy - ry * 0.36}`} className="kit-head-gloss" />
      {lugPositions(cx, cy, rx - 5, ry - 5).map((position) => (
        <circle key={`${position.x},${position.y}`} cx={position.x} cy={position.y} r={6.5} className="kit-lug" />
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
        <CymbalRidges cx={cx} cy={cy} rx={rx} ry={ry} />
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
    }
    const label = t(pad.labelKey)
    return (
      <g key={pad.id} className={className} role="button" aria-label={label} {...handlers}>
        {pad.id === 'hihat' && geometry.kind === 'cymbal' && (
          <g className={`hihat-stack ${hatOpen ? 'hihat-stack--open' : ''}`}>
            <ellipse cx={geometry.cx} cy={geometry.cy + 10} rx={geometry.rx} ry={geometry.ry} fill="url(#dk-cymbal)" stroke="var(--cymbal-deep)" strokeWidth="4" opacity="0.9" />
            <g transform={`rotate(${geometry.tilt} ${geometry.cx} ${geometry.cy})`}>
              <g className="drum-part__anim">
                <ellipse cx={geometry.cx} cy={geometry.cy} rx={geometry.rx} ry={geometry.ry} fill="url(#dk-cymbal)" stroke="var(--cymbal-deep)" strokeWidth="4" />
                <CymbalRidges cx={geometry.cx} cy={geometry.cy} rx={geometry.rx} ry={geometry.ry} />
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
            <KickPart geometry={geometry} />
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
            <g transform={`rotate(${geometry.tilt ?? 0} ${geometry.cx} ${geometry.cy})`}>
              <ShellPart geometry={geometry} chrome={geometry.chrome === true} />
            </g>
          </>
        )}
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
          <linearGradient id="dk-shell-body" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--shell-edge)" />
            <stop offset="0.22" stopColor="var(--shell-dark)" />
            <stop offset="0.5" stopColor="var(--shell-light)" />
            <stop offset="0.78" stopColor="var(--shell-dark)" />
            <stop offset="1" stopColor="var(--shell-edge)" />
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
          <linearGradient id="dk-kick-head" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#292e36" />
            <stop offset="0.45" stopColor="#4e5158" />
            <stop offset="0.78" stopColor="#726b6c" />
            <stop offset="1" stopColor="#3b3b42" />
          </linearGradient>
          <radialGradient id="dk-bell">
            <stop offset="0" stopColor="var(--cymbal-bright)" />
            <stop offset="1" stopColor="var(--cymbal-deep)" />
          </radialGradient>
        </defs>
        <rect x={scene.x} y={scene.y} width={scene.width} height={scene.height} className="kit-rug" />
        <rect x={scene.x + 18} y={scene.y + 16} width={scene.width - 36} height={scene.height - 32} rx="26" className="kit-rug-inner" />
        <g transform={`translate(${KIT_X_OFFSET} 0)`}>
          <g className="stand-layer">
            {CYMBAL_STAND_ORDER.map((padId) => {
              const geometry = LAYOUT[padId]
              return geometry.kind === 'cymbal'
                ? <Stand key={padId} fromX={geometry.cx} fromY={geometry.cy} toX={geometry.baseX} toY={geometry.baseY} />
                : null
            })}
            <TomMount />
          </g>
          {PAINT_ORDER.map((padId) => {
            const pad = DRUM_PADS.find((entry) => entry.id === padId)
            return pad ? renderPart(pad) : null
          })}
          <g
            className="hihat-open-button"
            role="button"
            aria-label={t('drum.hihatOpen')}
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              if (event.pointerType === 'mouse' && event.button !== 0) return
              triggerOpenHat()
            }}
          >
            <circle cx={60} cy={266} r={28} />
            <ellipse cx={60} cy={257} rx={12.5} ry={4} />
            <ellipse cx={60} cy={275} rx={12.5} ry={4} />
          </g>
        </g>
      </svg>
    </div>
  )
}
