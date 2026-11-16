import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Environment, Street } from './components/Scene.jsx'
import Ball from './components/Ball.jsx'
import { CameraRig } from './components/CameraRig.jsx'
import { useThrowController } from './game/useThrowController.js'
import { GRAVITY } from './game/constants.js'

const THROWS_PER_PLAYER = 5
const RESULT_DELAY_MS = 2400

const PHASE = {
  INTRO: 'intro',
  READY: 'ready', // waiting for touch & hold
  WINDUP: 'windup', // holding the screen, phone above head
  FLIGHT: 'flight', // ball in the air
  RESULT: 'result', // showing the outcome banner
  GAMEOVER: 'gameover',
}

const PLAYER_NAMES = ['Player 1', 'Player 2']

export default function App() {
  const [phase, setPhase] = useState(PHASE.INTRO)
  const [current, setCurrent] = useState(0) // index into players
  const [scores, setScores] = useState([0, 0])
  const [throwsUsed, setThrowsUsed] = useState([0, 0])
  const [banner, setBanner] = useState(null) // { text, kind }
  const ballRef = useRef(null)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const holdBall = useCallback(() => {
    // The physics world may still be spinning up on first mount.
    let tries = 0
    const tick = () => {
      if (ballRef.current) ballRef.current.hold()
      else if (tries++ < 60) requestAnimationFrame(tick)
    }
    tick()
  }, [])

  // --- throw controller -----------------------------------------------------
  const onWindupStart = useCallback(() => {
    if (phaseRef.current !== PHASE.READY) return
    setPhase(PHASE.WINDUP)
  }, [])

  const onThrow = useCallback(
    (velocity) => {
      if (phaseRef.current !== PHASE.WINDUP) return
      ballRef.current?.throwBall(velocity)
      setBanner(null)
      setPhase(PHASE.FLIGHT)
    },
    [],
  )

  const { motionState, requestMotion, onPointerDown, onPointerMove, onPointerUp } =
    useThrowController({ onWindupStart, onThrow })

  // --- outcomes ---------------------------------------------------------------
  const onOutcome = useCallback(
    (outcome) => {
      setPhase(PHASE.RESULT)
      if (outcome === 'kerb') {
        setBanner({ text: 'Kerby!', kind: 'hit' })
        setScores((s) => {
          const next = [...s]
          next[current] += 1
          return next
        })
      } else if (outcome === 'road') {
        setBanner({ text: 'Caught!', kind: 'miss' })
      } else {
        setBanner({ text: 'Too far!', kind: 'miss' })
      }

      const used = [...throwsUsed]
      used[current] += 1
      const done = used.every((n) => n >= THROWS_PER_PLAYER)
      setTimeout(() => {
        setThrowsUsed(used)
        setBanner(null)
        if (done) {
          setPhase(PHASE.GAMEOVER)
        } else {
          setCurrent(1 - current)
          setPhase(PHASE.READY) // entering READY re-seats the ball in the hand
        }
      }, RESULT_DELAY_MS)
    },
    [current, throwsUsed],
  )

  // --- flow buttons -----------------------------------------------------------
  const startGame = async () => {
    await requestMotion()
    setScores([0, 0])
    setThrowsUsed([0, 0])
    setCurrent(0)
    setBanner(null)
    setPhase(PHASE.READY)
  }

  const playAgain = () => {
    setScores([0, 0])
    setThrowsUsed([0, 0])
    setCurrent(0)
    setBanner(null)
    setPhase(PHASE.READY)
  }

  // Snap the ball into the hand whenever we enter READY from elsewhere.
  useEffect(() => {
    if (phase === PHASE.READY) holdBall()
  }, [phase, holdBall])

  const playing = phase !== PHASE.INTRO && phase !== PHASE.GAMEOVER
  const motionGranted = motionState === 'granted'
  const motionSupported = motionState !== 'unsupported'

  return (
    <div
      className="app"
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 70, position: [0, 1.5, 1.2], near: 0.05, far: 120 }}
        gl={{ antialias: true }}
      >
        <CameraRig mode={phase === PHASE.WINDUP ? 'windup' : 'rest'} />
        <Environment />
        <Physics gravity={[0, GRAVITY, 0]} timeStep={1 / 120}>
          <Street />
          <Ball ref={ballRef} onOutcome={onOutcome} />
        </Physics>
      </Canvas>

      {playing && (
        <div className="hud">
          <div className="hud-top">
            <div className={`score-chip ${current === 0 ? 'active' : ''}`}>
              <div className="label">{PLAYER_NAMES[0]}</div>
              <div className="value">{scores[0]}</div>
            </div>
            <div className="turn-badge">
              Throw {Math.min(throwsUsed[current] + 1, THROWS_PER_PLAYER)} /{' '}
              {THROWS_PER_PLAYER}
            </div>
            <div className={`score-chip ${current === 1 ? 'active' : ''}`}>
              <div className="label">{PLAYER_NAMES[1]}</div>
              <div className="value">{scores[1]}</div>
            </div>
          </div>
          {(phase === PHASE.READY || phase === PHASE.WINDUP || phase === PHASE.FLIGHT) && (
            <div className="prompt">
              {phase === PHASE.READY && (motionGranted
                ? `${PLAYER_NAMES[current]} — hold the phone above your head, touch & hold`
                : `${PLAYER_NAMES[current]} — swipe down & release to throw`)}
              {phase === PHASE.WINDUP && 'Release to throw!'}
              {phase === PHASE.FLIGHT && '…'}
            </div>
          )}
        </div>
      )}

      {banner && playing && (
        <div className={`banner ${banner.kind}`}>{banner.text}</div>
      )}

      {phase === PHASE.INTRO && (
        <div className="overlay dim">
          <h1 className="title">Kerby</h1>
          <div className="subtitle">A street game for your phone</div>
          <div className="card">
            <ol>
              <li>
                Hold the phone <b>above your head</b>, top edge pointing at the opposite kerb.
              </li>
              <li>
                <b>Touch &amp; hold</b> the screen, then pretend to throw the phone like a ball.
              </li>
              <li>
                <b>Let go</b> of the screen as you swing — the ball flies towards the far kerb.
              </li>
              <li>
                Hit the kerb so it <b>bounces back</b> to score. Miss and your opponent catches it.
              </li>
            </ol>
          </div>
          <button className="btn" onClick={startGame}>
            Play
          </button>
          {!motionSupported && (
            <p className="subtitle" style={{ marginTop: 14 }}>
              No motion sensor here — swipe to throw instead
            </p>
          )}
        </div>
      )}

      {phase === PHASE.GAMEOVER && (
        <div className="overlay dim">
          <h1 className="title" style={{ fontSize: 'clamp(36px, 10vw, 64px)' }}>
            Game over
          </h1>
          <div className="subtitle">
            {scores[0] === scores[1]
              ? 'A draw!'
              : `${PLAYER_NAMES[scores[0] > scores[1] ? 0 : 1]} wins`}
          </div>
          <div className="card" style={{ fontSize: 18 }}>
            {PLAYER_NAMES[0]} <b>{scores[0]}</b> — <b>{scores[1]}</b> {PLAYER_NAMES[1]}
          </div>
          <button className="btn" onClick={playAgain}>
            Play again
          </button>
        </div>
      )}
    </div>
  )
}
