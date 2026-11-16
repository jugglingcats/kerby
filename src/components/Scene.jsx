import { RigidBody } from '@react-three/rapier'
import {
  KERB_HEIGHT,
  KERB_WIDTH,
  PLAYER_Z,
  ROAD_LENGTH,
  ROAD_WIDTH,
} from '../game/constants.js'

const FAR_KERB_Z = -ROAD_WIDTH

export const farKerbZ = FAR_KERB_Z

// Pure visuals — must live OUTSIDE <Physics>, and as a fragment rather than
// a group so <color>/<fog> attach to the scene root, not an intermediate
// object.
export function Environment() {
  return (
    <>
      <hemisphereLight args={['#cfe6ff', '#4a5a3a', 0.9]} />
      <directionalLight
        position={[6, 12, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <color attach="background" args={['#8fc0ea']} />
      <fog attach="fog" args={['#8fc0ea', 18, 60]} />

      {/* Grass verges */}
      <mesh position={[0, -0.06, FAR_KERB_Z - 7]} receiveShadow>
        <boxGeometry args={[ROAD_LENGTH + 30, 0.1, 14]} />
        <meshStandardMaterial color="#5d8a4a" roughness={1} />
      </mesh>
      <mesh position={[0, -0.06, 8]} receiveShadow>
        <boxGeometry args={[ROAD_LENGTH + 30, 0.1, 14]} />
        <meshStandardMaterial color="#5d8a4a" roughness={1} />
      </mesh>

      {/* Distant houses for depth cues */}
      {[-9, -3, 3, 9].map((x) => (
        <group key={x} position={[x, 0, FAR_KERB_Z - 5.5]}>
          <mesh position={[0, 1.6, 0]}>
            <boxGeometry args={[4.4, 3.2, 3]} />
            <meshStandardMaterial color="#c9b8a3" roughness={0.9} />
          </mesh>
          <mesh position={[0, 3.4, 0.1]}>
            <boxGeometry args={[4.6, 0.7, 3.2]} />
            <meshStandardMaterial color="#8a5444" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Lampposts */}
      {[-6.5, 6.5].map((x) => (
        <group key={x} position={[x, 0, FAR_KERB_Z - 1.4]}>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.06, 0.08, 4.4, 8]} />
            <meshStandardMaterial color="#3c4046" />
          </mesh>
          <mesh position={[0, 4.5, 0]}>
            <sphereGeometry args={[0.18, 12, 12]} />
            <meshStandardMaterial color="#fff3c4" emissive="#ffe9a8" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
    </>
  )
}

// The road and kerbs — fixed colliders. The far kerb carries userData so the
// ball's collision handler can tell the target from everything else.
export function Street() {
  return (
    <group>
      {/* Road surface */}
      <RigidBody
        type="fixed"
        colliders="cuboid"
        restitution={0.45}
        friction={0.9}
        userData={{ type: 'road' }}
      >
        <mesh position={[0, -0.05, (-PLAYER_Z + FAR_KERB_Z) / 2]} receiveShadow>
          <boxGeometry args={[ROAD_LENGTH, 0.1, ROAD_WIDTH + PLAYER_Z + 2]} />
          <meshStandardMaterial color="#4a4d52" roughness={0.95} />
        </mesh>
      </RigidBody>

      <Kerb z={FAR_KERB_Z} color="#b9bcc2" type="far-kerb" />
      <Kerb z={0} color="#b9bcc2" type="near-kerb" />

      {/* Coloured band so the aim point reads clearly from across the road. */}
      <mesh position={[0, KERB_HEIGHT / 2, FAR_KERB_Z + KERB_WIDTH / 2 + 0.005]}>
        <boxGeometry args={[1.6, KERB_HEIGHT * 0.55, 0.02]} />
        <meshStandardMaterial color="#ffd93d" emissive="#ffd93d" emissiveIntensity={0.35} />
      </mesh>
    </group>
  )
}

function Kerb({ z, color, type }) {
  return (
    <RigidBody
      type="fixed"
      colliders="cuboid"
      restitution={0.72}
      friction={0.6}
      userData={{ type }}
    >
      <mesh position={[0, KERB_HEIGHT / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[ROAD_LENGTH, KERB_HEIGHT, KERB_WIDTH]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </RigidBody>
  )
}
