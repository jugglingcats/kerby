import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EYE_HEIGHT, PLAYER_Z } from '../game/constants.js'

// Camera poses. While winding up (phone held above the head) the view tilts
// up at the sky; on release it settles back down to eye level to watch the
// ball fly across the road.
const REST = { y: EYE_HEIGHT, pitch: -0.05 }
const WINDUP = { y: EYE_HEIGHT + 0.25, pitch: 0.62 }

const damp = (current, target, lambda, dt) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt))

export function CameraRig({ mode }) {
  const { camera } = useThree()
  const pitch = useRef(REST.pitch)
  const height = useRef(REST.y)

  useFrame((_, dt) => {
    const target = mode === 'windup' ? WINDUP : REST
    const lambda = mode === 'windup' ? 3.2 : 4.5
    pitch.current = damp(pitch.current, target.pitch, lambda, dt)
    height.current = damp(height.current, target.y, lambda, dt)

    camera.position.set(0, height.current, PLAYER_Z)
    camera.lookAt(0, height.current - Math.tan(pitch.current) * 8, PLAYER_Z - 8)
  })

  return null
}
