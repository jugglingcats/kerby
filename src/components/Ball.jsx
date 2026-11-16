import * as THREE from 'three'
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import { BALL_RADIUS, ROAD_WIDTH } from '../game/constants.js'

// Rapier's RigidBodyType enum values (0 = Dynamic, 2 = KinematicPosition).
const TYPE_DYNAMIC = 0
const TYPE_KINEMATIC_POSITION = 2

// The held ball sits above the head (like the real grip), inside the frustum
// both at rest (near the top edge) and while the rig tilts up for wind-up.
const HAND_POS = [0.3, 1.9, 0.5]
const THROW_ORIGIN = [0, 1.9, 0.4]

const STATE_IDLE = 'idle' // waiting for wind-up
const STATE_HELD = 'held' // in the hand, physics off
const STATE_FLYING = 'flying' // physics on, resolving outcome

/**
 * The kerby ball. Exposes an imperative API via ref:
 *   hold()       – snap into the player's hand, physics off
 *   throwBall(v) – launch with velocity {x,y,z}
 * Reports the outcome through onOutcome('kerb' | 'over' | 'road').
 *
 * The RigidBody props object is memoised once and the ring is toggled via a
 * ref rather than state — @react-three/rapier re-applies its options (and
 * re-snaps type/translation) whenever the props identity changes, which
 * would undo imperative body-type changes mid-flight.
 */
const Ball = memo(
  forwardRef(function Ball({ onOutcome }, ref) {
    const body = useRef(null)
    const ring = useRef(null)
    const stateRef = useRef(STATE_IDLE)
    const outcomeRef = useRef(null)
    const flightTime = useRef(0)
    const onOutcomeRef = useRef(null)
    onOutcomeRef.current = onOutcome

    useEffect(() => {
      if (!ref) return
      ref.current = {
        hold,
        throwBall,
        getBody: () => body.current,
      }
    })

    useFrame((_, dt) => {
      const b = body.current
      if (!b) return
      if (stateRef.current === STATE_HELD) {
        b.setNextKinematicTranslation({ x: HAND_POS[0], y: HAND_POS[1], z: HAND_POS[2] })
        return
      }
      flightTime.current += dt

      if (stateRef.current === STATE_FLYING && !outcomeRef.current) {
        const t = b.translation()
        const lv = b.linvel()
        // Sailed clean past the far kerb plane while still travelling out.
        if (t.z <= -ROAD_WIDTH - BALL_RADIUS && lv.z < 0) {
          setOutcome('over')
        } else if (flightTime.current > 8) {
          setOutcome('over')
        }
      }
    })

    const setOutcome = (outcome) => {
      if (outcomeRef.current) return
      outcomeRef.current = outcome
      onOutcomeRef.current?.(outcome)
    }

    const hold = () => {
      const b = body.current
      if (!b) return
      outcomeRef.current = null
      flightTime.current = 0
      stateRef.current = STATE_HELD
      if (ring.current) ring.current.visible = true
      b.setBodyType(TYPE_KINEMATIC_POSITION, true)
      b.setTranslation({ x: HAND_POS[0], y: HAND_POS[1], z: HAND_POS[2] }, true)
      b.setLinvel({ x: 0, y: 0, z: 0 }, true)
      b.setAngvel({ x: 0, y: 0, z: 0 }, true)
    }

    const throwBall = (velocity) => {
      const b = body.current
      if (!b || stateRef.current !== STATE_HELD) return
      stateRef.current = STATE_FLYING
      if (ring.current) ring.current.visible = false
      b.setBodyType(TYPE_DYNAMIC, true)
      b.setTranslation({ x: THROW_ORIGIN[0], y: THROW_ORIGIN[1], z: THROW_ORIGIN[2] }, true)
      b.setLinvel(velocity, true)
      b.setAngvel({ x: -velocity.z * 2, y: 0, z: 0 }, true)
      flightTime.current = 0
    }

    // Rapier collision callbacks decide what the ball actually hit.
    const handleCollision = useCallback((payload) => {
      if (stateRef.current !== STATE_FLYING) return
      const other = payload?.other ?? {}
      const type =
        other.rigidBodyObject?.userData?.type ?? other.colliderObject?.userData?.type
      if (type === 'far-kerb') setOutcome('kerb')
      else if (type === 'road') setOutcome('road')
    }, [])

    // Stable across every render — see the component docblock.
    const bodyProps = useMemo(
      () => ({
        ref: body,
        colliders: 'ball',
        type: 'kinematicPosition',
        position: HAND_POS,
        restitution: 0.55,
        friction: 0.7,
        linearDamping: 0.08,
        angularDamping: 0.15,
        mass: 0.06,
        ccd: true,
        onCollisionEnter: handleCollision,
      }),
      [handleCollision],
    )

    return (
      <RigidBody {...bodyProps}>
        <mesh castShadow>
          <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
          <meshStandardMaterial color="#d8ff3e" roughness={0.6} />
        </mesh>
        {/* Aim ring visible at the bottom edge of the view while winding up. */}
        <mesh ref={ring} rotation={[-Math.PI / 2.2, 0, 0]}>
          <ringGeometry args={[BALL_RADIUS * 1.5, BALL_RADIUS * 1.9, 24]} />
          <meshBasicMaterial
            color="#ffd93d"
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      </RigidBody>
    )
  }),
)

export default Ball
