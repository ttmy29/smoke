/** Port of legacy presentation/session-entry-motion.js, with Cocos's upward Y axis. */
export interface EntryMotionInput {
  progress: number;
  sourceCenterX: number;
  sourceCenterY: number;
  targetCenterX: number;
  targetCenterY: number;
  sourceScaleX: number;
  sourceScaleY: number;
  liftDistance: number;
}

export interface EntryMotionFrame {
  centerX: number;
  centerY: number;
  rotationDegrees: number;
  scaleX: number;
  scaleY: number;
  maskRelease: number;
}

const CLEAR_PROGRESS = 0.28;
const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const smooth = (value: number): number => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

export function sharedEntryMotion(input: EntryMotionInput): EntryMotionFrame {
  const progress = clamp(input.progress);
  const liftPhase = clamp(progress / CLEAR_PROGRESS);
  const maskRelease = smooth(liftPhase) - 0.6 * liftPhase * liftPhase * (1 - liftPhase);
  const travel = clamp((progress - CLEAR_PROGRESS) / (1 - CLEAR_PROGRESS));
  const travelEase = smooth(travel);
  const turn = smooth((progress - CLEAR_PROGRESS) / (0.86 - CLEAR_PROGRESS));
  const liftedY = input.sourceCenterY + input.liftDistance;
  const overshoot = (0.6 * input.liftDistance) / CLEAR_PROGRESS;
  const centerY = travel > 0
    ? liftedY + (input.targetCenterY - liftedY) * travelEase
      + overshoot * (1 - CLEAR_PROGRESS) * travel * (1 - travel) * (1 - travel)
    : input.sourceCenterY + input.liftDistance * maskRelease;
  return {
    centerX: input.sourceCenterX + (input.targetCenterX - input.sourceCenterX) * travelEase,
    centerY,
    rotationDegrees: 180 * (1 - turn),
    scaleX: input.sourceScaleX + (1 - input.sourceScaleX) * travelEase,
    scaleY: input.sourceScaleY + (1 - input.sourceScaleY) * travelEase,
    maskRelease,
  };
}
