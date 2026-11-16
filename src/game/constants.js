// World layout. Player stands at the near kerb (z = 0) and throws across the
// road towards the far kerb (z = -ROAD_WIDTH). -Z is "towards the kerb".
export const ROAD_WIDTH = 6 // distance between kerbs (throw distance)
export const ROAD_LENGTH = 26 // length of the street along X
export const KERB_HEIGHT = 0.3
export const KERB_WIDTH = 0.22
export const BALL_RADIUS = 0.11

// Camera (the player's eyes, once the phone is lowered)
export const EYE_HEIGHT = 1.5
export const PLAYER_Z = 1.2 // eyes sit slightly behind the near kerb edge

// Throw tuning (accelerometer)
export const SAMPLE_WINDOW_MS = 350 // motion samples used for the throw
export const THROW_GAIN = 1.15 // raw integrated m/s -> game m/s
export const MIN_THROW_SPEED = 2.5
export const MAX_THROW_SPEED = 11
export const FORWARD_ASSIST = 1.4 // m/s of free speed towards the kerb

// Desktop fallback
export const DRAG_MAX_PIXELS = 260

export const GRAVITY = -9.81
