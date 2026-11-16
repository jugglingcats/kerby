import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DRAG_MAX_PIXELS,
  FORWARD_ASSIST,
  MAX_THROW_SPEED,
  MIN_THROW_SPEED,
  SAMPLE_WINDOW_MS,
  THROW_GAIN,
} from './constants.js'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

// Used when sensors are granted but produce nothing usable (blocked in OS
// settings, desktop browsers lying about support) — a gentle lob so the
// game never dead-ends.
const DEFAULT_THROW = { x: 0, y: 3.2, z: -(MIN_THROW_SPEED + 2.5) }

// Motion sampling for the "pretend to throw the phone" mechanic.
//
// While the player holds the screen (arm cocked above their head) we buffer
// raw device-motion samples. When they let go we integrate the last few
// hundred milliseconds of user acceleration (the swing) into a velocity,
// rotate it out of phone space into game space, and clamp it into a playable
// range. The result is a Vector3-like {x, y, z} in game world units/s.
export function useThrowController({ onWindupStart, onThrow }) {
  const [motionState, setMotionState] = useState('idle') // idle | granted | denied | unsupported
  const samples = useRef([]) // [{ t, x, y, z }] device-space accel (m/s^2)
  const holding = useRef(false)
  const hadMotion = useRef(false) // have real sensor samples ever arrived?
  const dragStart = useRef(null) // desktop fallback
  const dragCurrent = useRef(null)

  // --- native listeners -----------------------------------------------------
  useEffect(() => {
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration
      if (!a || a.x == null) return
      // DeviceMotion device axes: x = screen right, y = screen top,
      // z = out of the screen. Keep raw; mapping happens at release.
      samples.current.push({ t: performance.now(), x: a.x, y: a.y, z: a.z })
      hadMotion.current = true
      const cutoff = performance.now() - 1200
      while (samples.current.length > 2 && samples.current[0].t < cutoff) {
        samples.current.shift()
      }
    }
    window.addEventListener('devicemotion', onMotion)
    return () => window.removeEventListener('devicemotion', onMotion)
  }, [])

  const requestMotion = useCallback(async () => {
    const DM = window.DeviceMotionEvent
    const DO = window.DeviceOrientationEvent
    if (!DM) {
      setMotionState('unsupported')
      return
    }
    try {
      // iOS gate: must run inside the tap that started this call.
      if (typeof DM.requestPermission === 'function') {
        const res = await DM.requestPermission()
        if (res !== 'granted') {
          setMotionState('denied')
          return
        }
      }
      if (DO && typeof DO.requestPermission === 'function') {
        await DO.requestPermission()
      }
    } catch {
      setMotionState('denied')
      return
    }
    // Desktop browsers expose the constructor but never emit events — give
    // the sensor a beat to prove itself before promising motion control.
    await new Promise((r) => setTimeout(r, 600))
    setMotionState(hadMotion.current ? 'granted' : 'unsupported')
  }, [])

  // --- throw vector ---------------------------------------------------------
  const velocityFromMotion = useCallback(() => {
    const now = performance.now()
    const recent = samples.current.filter((s) => now - s.t <= SAMPLE_WINDOW_MS)
    samples.current = []
    if (recent.length < 2) return null

    let vx = 0
    let vy = 0
    let vz = 0
    for (let i = 1; i < recent.length; i++) {
      const dt = (recent[i].t - recent[i - 1].t) / 1000
      const a = recent[i - 1]
      vx += a.x * dt
      vy += a.y * dt
      vz += a.z * dt
    }
    // Integrated velocity is in device space. The canonical grip is "phone
    // flat above the head, top edge pointing at the opposite kerb":
    //   device x (screen right)      -> world +X
    //   device y (screen top)        -> world -Z (towards the kerb)
    //   device z (out of the screen) -> world +Y (up)
    let wx = vx
    let wy = vz
    let wz = -vy
    if (THROW_GAIN !== 1) {
      wx *= THROW_GAIN
      wy *= THROW_GAIN
      wz *= THROW_GAIN
    }
    // A gentle assist so weak flicks still reach the road; the real aim test
    // stays in the player's hands (X) and the arc (Y).
    wz -= FORWARD_ASSIST
    const speed = Math.hypot(wx, wy, wz)
    if (speed < MIN_THROW_SPEED) return null
    const s = Math.min(MAX_THROW_SPEED, speed) / speed
    return { x: wx * s, y: Math.max(1.2, wy * s), z: wz * s }
  }, [])

  const velocityFromDrag = useCallback(() => {
    if (!dragStart.current || !dragCurrent.current) return null
    const dx = dragCurrent.current.x - dragStart.current.x
    const dy = dragCurrent.current.y - dragStart.current.y
    const len = Math.hypot(dx, dy)
    if (len < 24) return null
    // Swipe DOWN (pull back like a slingshot) throws towards the kerb.
    const power = clamp(-dy / DRAG_MAX_PIXELS, 0.12, 1)
    const speed = MIN_THROW_SPEED + power * (MAX_THROW_SPEED - MIN_THROW_SPEED)
    return {
      x: clamp((-dx / DRAG_MAX_PIXELS) * 7, -6, 6),
      y: 2.4 + power * 3.6,
      z: -speed,
    }
  }, [])

  // --- input handlers (attached to the play surface) -------------------------
  const onPointerDown = useCallback(
    (e) => {
      if (holding.current) return
      holding.current = true
      samples.current = []
      dragStart.current = { x: e.clientX, y: e.clientY }
      dragCurrent.current = { x: e.clientX, y: e.clientY }
      onWindupStart?.()
    },
    [onWindupStart],
  )

  const onPointerMove = useCallback((e) => {
    if (!holding.current) return
    dragCurrent.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onPointerUp = useCallback(() => {
    if (!holding.current) return
    holding.current = false
    let velocity = null
    if (motionState === 'granted') {
      velocity = velocityFromMotion()
      // Sensors granted but silent (blocked in OS settings etc.) — fall back
      // to a gentle lob so the game never dead-ends.
      if (!velocity && hadMotion.current === false) velocity = DEFAULT_THROW
    }
    if (!velocity) velocity = velocityFromDrag()
    if (velocity) onThrow?.(velocity)
  }, [motionState, onThrow, velocityFromDrag, velocityFromMotion])

  return { motionState, requestMotion, onPointerDown, onPointerMove, onPointerUp }
}
