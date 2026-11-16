# Kerby

A mobile prototype of the UK street game [kerby](https://en.wikipedia.org/wiki/Kerby): throw the ball at the opposite kerb and make it bounce back to you.

Built with Vite, React, Three.js (@react-three/fiber), and Rapier physics (@react-three/rapier).

## How it works

You are standing at one kerb of a street. The far kerb is across the road.

1. **Hold the phone above your head**, top edge pointing at the opposite kerb.
2. **Touch & hold the screen**, then swing your arm as if throwing the phone like a ball.
3. **Let go of the screen** as you swing. The ball launches from your point of view and flies across the road — the physics engine decides the rest.
4. Hit the far kerb so the ball **bounces back** → **Kerby!** (1 point). Land on the road → your opponent "catches" it. Sail clean over → too far.

Two players share the phone and alternate throws. 5 throws each; highest score wins.

## Controls

- **Phone (iOS/Android)**: motion sensors. iOS will ask for motion permission on the Play button — this requires HTTPS (Vercel provides it).
- **Desktop fallback**: press, drag **down** like a slingshot, release. The drag distance sets power, the sideways offset sets aim.

## Tech notes

- The throw is computed by integrating raw `devicemotion` user-acceleration over the last ~350 ms of the hold, mapped from phone axes into game space (screen right → world X, screen top → towards the kerb, screen normal → up). Tuning lives in `src/game/constants.js`.
- The ball is a Rapier rigid body; street, kerbs and road are fixed colliders. Outcomes (`kerb` / `road` / `over`) come from Rapier collision events, plus a geometric check for balls that clear the kerb entirely.
- While you hold the screen the camera tilts up to the sky; on release it settles back to eye level to watch the flight.

## Run

```bash
npm install
npm run dev      # local dev
npm run build    # static build in dist/
```

## Deploy to Vercel

Push to GitHub, import the repo at vercel.com — the Vite preset works as-is (build `npm run build`, output `dist`). **HTTPS matters**: motion sensors are only available in secure contexts, so test on the deployed URL or an HTTPS tunnel, not plain HTTP.

## Project structure

```
src/
  App.jsx                        game state machine + UI overlays
  components/
    Scene.jsx                    street, kerbs, houses, lights (fixed colliders)
    Ball.jsx                     the ball: hand / flight states, outcome detection
    CameraRig.jsx                wind-up / rest camera poses
  game/
    constants.js                 all gameplay tuning knobs
    useThrowController.js        accelerometer sampling, throw vector, input handlers
```
