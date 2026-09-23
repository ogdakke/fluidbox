const CENTER_ATTRACTION_RADIUS = 32;
const CENTER_ATTRACTION_STRENGTH = 0.7;
const TOUCH_SPRING_RESPONSE_NEAR = 0.11;
const TOUCH_SPRING_RESPONSE_FAR = 0.06;
const TOUCH_SPRING_RELEASE_RADIUS = 48;
const TOUCH_SPRING_DAMPING = 0.92;
const WHEEL_SPRING_RESPONSE = 0.14;
const WHEEL_SPRING_DAMPING = 0.82;
const WHEEL_RELEASE_GAP = 80;
const WHEEL_SETTLE_POSITION = 0.1;
const WHEEL_SETTLE_VELOCITY = 5;
const BACKDROP_FADE_END = 0.6;
const DISMISS_EDGE = { x: 48, y: 80 } as const;
const DISMISS_EDGE_TRAVEL = 64;
const DISMISS_FLICK_HORIZON = 160;
const DISMISS_SETTLE_RESPONSE = 0.28;
const DISMISS_SETTLE_DAMPING = 0.86;

type DismissAxis = keyof typeof DISMISS_EDGE;
type WheelGesturePhase = "tracking" | "settling" | "past-open";

export const touchAxisThreshold = 6;
export const wheelDismissDistance = 144;

export type CornerRadii = [
  topLeft: number,
  topRight: number,
  bottomRight: number,
  bottomLeft: number,
];

export interface LightboxDragStart {
  matrix: DOMMatrix;
  wheelTarget?: DOMMatrix;
  wheelDirection: number;
  wheelOffset: number;
  wheelSnapOffset: number;
  opacity: number;
  closeOpacity: number;
  borderRadii: CornerRadii;
  targetRadii: CornerRadii;
  clipX: number;
  clipY: number;
  targetClipX: number;
  targetClipY: number;
  width: number;
  height: number;
  time: number;
}

export interface LightboxDragState extends LightboxDragStart {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  inputX: number;
  inputY: number;
  wheelCommit: boolean;
  wheelPhase: WheelGesturePhase;
  wheelSettleDistance: number;
  wheelSnapProgress: number;
  wheelSettleSnapProgress: number;
  lastX: number;
  lastY: number;
  velocityX: number;
  velocityY: number;
  springVelocityX: number;
  springVelocityY: number;
  springTime: number;
}

export interface LightboxDragRelease {
  state: LightboxDragState;
  velocityX: number;
  velocityY: number;
  inputDistance: number;
  inputSpeed: number;
}

export class LightboxGestureController {
  #state: LightboxDragState | undefined;
  #frame = 0;
  readonly #onUpdate: (state: LightboxDragState) => void;
  readonly #onWheelCommit: () => void;

  constructor(onUpdate: (state: LightboxDragState) => void, onWheelCommit: () => void) {
    this.#onUpdate = onUpdate;
    this.#onWheelCommit = onWheelCommit;
  }

  get state(): LightboxDragState | undefined {
    return this.#state;
  }

  get active(): boolean {
    return this.#state !== undefined;
  }

  begin(start: LightboxDragStart): LightboxDragState {
    this.cancel();
    const state: LightboxDragState = {
      ...start,
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      inputX: 0,
      inputY: 0,
      wheelCommit: false,
      wheelPhase: "tracking",
      wheelSettleDistance: 0,
      wheelSnapProgress: 0,
      wheelSettleSnapProgress: 0,
      lastX: 0,
      lastY: 0,
      velocityX: 0,
      velocityY: 0,
      springVelocityX: 0,
      springVelocityY: 0,
      springTime: performance.now(),
    };
    this.#state = state;
    return state;
  }

  moveTouch(x: number, y: number): void {
    const state = this.#state;
    if (!state || state.wheelTarget) return;
    const now = performance.now();
    const elapsed = now - state.time;
    if (elapsed > 0) {
      state.velocityX = Math.max(-3, Math.min(3, (x - state.lastX) / Math.max(8, elapsed)));
      state.velocityY = Math.max(-3, Math.min(3, (y - state.lastY) / Math.max(8, elapsed)));
    }
    state.time = now;
    state.lastX = x;
    state.lastY = y;
    state.inputX = x;
    state.inputY = y;
    state.targetX = dismissTarget(x, "x");
    state.targetY = dismissTarget(y, "y");
    if (!this.#frame) {
      state.springTime = now - 1000 / 60;
      this.#frame = requestAnimationFrame(this.#advanceTouch);
    }
  }

  moveWheel(delta: number): void {
    const state = this.#state;
    if (!state?.wheelTarget) return;
    const now = performance.now();
    const step = -delta;
    // Drop any buffered travel in the old direction. Without this, reversed
    // wheel input first has to unwind the spring's target lead before the
    // image responds, which feels like an idle timeout.
    if ((state.targetY - state.y) * step < 0) {
      state.targetY = state.y;
      if (state.springVelocityY * step < 0) state.springVelocityY = 0;
    }
    state.targetY += step;
    state.wheelPhase = "tracking";
    const targetDistance = state.wheelOffset + state.targetY * state.wheelDirection;
    state.wheelCommit = targetDistance >= wheelDismissDistance;
    state.time = now;
    if (!this.#frame) {
      state.springTime = now - 1000 / 60;
      this.#frame = requestAnimationFrame(this.#advanceWheel);
    }
  }

  finish(): LightboxDragRelease | undefined {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    const state = this.#state;
    if (!state) return undefined;
    this.#state = undefined;
    const recent = performance.now() - state.time < 100;
    const velocityX = recent ? state.velocityX : 0;
    const velocityY = recent ? state.velocityY : 0;
    return {
      state,
      velocityX,
      velocityY,
      inputDistance: Math.max(Math.abs(state.inputX), Math.abs(state.inputY)),
      inputSpeed: Math.max(Math.abs(velocityX), Math.abs(velocityY)),
    };
  }

  cancel(): void {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    this.#state = undefined;
  }

  #advanceTouch = (now: number) => {
    this.#frame = 0;
    const state = this.#state;
    if (!state || state.wheelTarget) return;
    const dt = Math.min(0.032, Math.max(0, (now - state.springTime) / 1000));
    state.springTime = now;
    if (dt > 0) {
      const inputDistance = Math.hypot(state.inputX, state.inputY);
      const response =
        TOUCH_SPRING_RESPONSE_FAR +
        (TOUCH_SPRING_RESPONSE_NEAR - TOUCH_SPRING_RESPONSE_FAR) *
          Math.exp(-inputDistance / TOUCH_SPRING_RELEASE_RADIUS);
      [state.x, state.springVelocityX] = springStep(
        state.x,
        state.targetX,
        state.springVelocityX,
        dt,
        response,
        TOUCH_SPRING_DAMPING,
      );
      [state.y, state.springVelocityY] = springStep(
        state.y,
        state.targetY,
        state.springVelocityY,
        dt,
        response,
        TOUCH_SPRING_DAMPING,
      );
    }
    this.#onUpdate(state);
    if (
      this.#state === state &&
      (Math.abs(state.targetX - state.x) > 0.05 ||
        Math.abs(state.targetY - state.y) > 0.05 ||
        Math.abs(state.springVelocityX) > 0.05 ||
        Math.abs(state.springVelocityY) > 0.05)
    ) {
      this.#frame = requestAnimationFrame(this.#advanceTouch);
    }
  };

  #advanceWheel = (now: number) => {
    this.#frame = 0;
    const state = this.#state;
    if (!state?.wheelTarget) return;
    if (!state.wheelCommit && now - state.time >= WHEEL_RELEASE_GAP) {
      if (state.wheelPhase === "tracking") {
        const distance = state.wheelOffset + state.y * state.wheelDirection;
        state.wheelPhase = distance <= 0 ? "past-open" : "settling";
        state.wheelSettleDistance = Math.max(0.001, Math.abs(distance));
        state.wheelSettleSnapProgress = state.wheelSnapProgress;
      }
      state.targetY = -state.wheelOffset / state.wheelDirection;
    }
    const dt = Math.min(0.032, Math.max(0, (now - state.springTime) / 1000));
    state.springTime = now;
    if (dt > 0) {
      [state.y, state.springVelocityY] = springStep(
        state.y,
        state.targetY,
        state.springVelocityY,
        dt,
        WHEEL_SPRING_RESPONSE,
        WHEEL_SPRING_DAMPING,
      );
    }
    let distance = state.wheelOffset + state.y * state.wheelDirection;
    if (state.wheelPhase !== "tracking") {
      const returnProgress = Math.max(
        0,
        Math.min(1, 1 - Math.abs(distance) / state.wheelSettleDistance),
      );
      state.wheelSnapProgress = Math.max(
        state.wheelSnapProgress,
        state.wheelSettleSnapProgress + (1 - state.wheelSettleSnapProgress) * returnProgress,
      );
    }
    if (state.wheelPhase === "settling" && distance <= 0) {
      state.wheelPhase = "past-open";
    } else if (state.wheelPhase === "past-open" && distance >= 0) {
      state.y = -state.wheelOffset / state.wheelDirection;
      state.springVelocityY = 0;
      distance = 0;
    }
    const waitingForRelease = now - state.time < WHEEL_RELEASE_GAP;
    const settled =
      Math.abs(state.targetY - state.y) <= WHEEL_SETTLE_POSITION &&
      Math.abs(state.springVelocityY) <= WHEEL_SETTLE_VELOCITY;
    if (settled) {
      state.y = state.targetY;
      state.springVelocityY = 0;
    }
    this.#onUpdate(state);
    if (this.#state !== state) return;
    if (state.wheelCommit && distance >= wheelDismissDistance) {
      this.#onWheelCommit();
      return;
    }
    if ((!settled || waitingForRelease) && !this.#frame) {
      this.#frame = requestAnimationFrame(this.#advanceWheel);
    }
  };
}

function springStep(
  value: number,
  target: number,
  velocity: number,
  elapsed: number,
  response: number,
  damping: number,
): [number, number] {
  const omega = (2 * Math.PI) / response;
  const zetaOmega = damping * omega;
  const omegaD = omega * Math.sqrt(1 - damping * damping);
  const decay = Math.exp(-zetaOmega * elapsed);
  const cosD = Math.cos(omegaD * elapsed);
  const sinD = Math.sin(omegaD * elapsed);
  const offset = value - target;
  const coefficient = (velocity + zetaOmega * offset) / omegaD;
  return [
    target + decay * (offset * cosD + coefficient * sinD),
    decay *
      ((coefficient * omegaD - offset * zetaOmega) * cosD -
        (offset * omegaD + coefficient * zetaOmega) * sinD),
  ];
}

export function dragDistance(state: LightboxDragState): number {
  return state.wheelTarget
    ? state.wheelOffset + state.y * state.wheelDirection
    : Math.max(Math.abs(state.x), Math.abs(state.y));
}

export function dragProgress(state: LightboxDragState): number {
  return Math.min(state.wheelTarget ? 0.6 : 1, Math.max(0, dragDistance(state)) / 360);
}

export function backdropVisibility(progress: number): number {
  const backdropProgress = Math.min(1, progress / BACKDROP_FADE_END);
  return (1 - backdropProgress) ** 3;
}

function dismissTarget(input: number, axis: DismissAxis): number {
  const response =
    1 - CENTER_ATTRACTION_STRENGTH * Math.exp(-Math.abs(input) / CENTER_ATTRACTION_RADIUS);
  return boundDismissOffset(input * response, axis);
}

export function boundDismissOffset(offset: number, axis: DismissAxis): number {
  const distance = Math.abs(offset);
  const edge = DISMISS_EDGE[axis];
  if (distance <= edge) return offset;
  const overflow = distance - edge;
  const resisted = DISMISS_EDGE_TRAVEL * Math.log1p(overflow / DISMISS_EDGE_TRAVEL);
  return Math.sign(offset) * (edge + resisted);
}

export function boundDismissVelocity(
  position: number,
  velocity: number,
  axis: DismissAxis,
): number {
  if (velocity === 0) return 0;
  const projected = position + velocity * DISMISS_FLICK_HORIZON;
  const bounded = boundDismissOffset(projected, axis);
  return (bounded - position) / DISMISS_FLICK_HORIZON;
}

export function dismissRadiusProgress(x: number, y: number): number {
  return Math.min(1, Math.max(Math.abs(x) / DISMISS_EDGE.x, Math.abs(y) / DISMISS_EDGE.y) * 2);
}

export function dismissReturnValue(
  from: number,
  to: number,
  velocity: number,
  elapsedMs: number,
): number {
  const time = elapsedMs / 1000;
  const omega = (2 * Math.PI) / DISMISS_SETTLE_RESPONSE;
  const displacement = from - to;
  const zetaOmega = DISMISS_SETTLE_DAMPING * omega;
  const omegaD = omega * Math.sqrt(1 - DISMISS_SETTLE_DAMPING * DISMISS_SETTLE_DAMPING);
  const coefficient = (velocity * 1000 + zetaOmega * displacement) / omegaD;
  return (
    to +
    Math.exp(-zetaOmega * time) *
      (displacement * Math.cos(omegaD * time) + coefficient * Math.sin(omegaD * time))
  );
}

export function dismissCloseValue(
  from: number,
  to: number,
  velocity: number,
  elapsedMs: number,
  durationMs = 220,
  responseMs = 280,
): number {
  const evaluate = (timeMs: number) => {
    const time = timeMs / 1000;
    const omega = (2 * Math.PI * 1000) / responseMs;
    const displacement = from - to;
    return (
      to +
      (displacement + (velocity * 1000 + omega * displacement) * time) * Math.exp(-omega * time)
    );
  };
  const end = evaluate(durationMs);
  const range = end - from;
  if (Math.abs(range) < 0.0001) return elapsedMs >= durationMs ? to : from;
  const progress = Math.max(0, Math.min(1, (evaluate(elapsedMs) - from) / range));
  const value = from + (to - from) * progress;
  return Math.min(Math.max(value, Math.min(from, to)), Math.max(from, to));
}
