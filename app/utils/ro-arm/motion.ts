import { MathUtils } from 'three';

export const SHOULDER_HEIGHT = 1.08;
export const GRIPPER_OPEN_ANGLE = MathUtils.degToRad(22);
export const GRIPPER_CLOSED_ANGLE = MathUtils.degToRad(2);

export function dampAngle(current: number, target: number, smoothing: number, delta: number) {
  const distance = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + distance * (1 - Math.exp(-smoothing * delta));
}

function smoothStep(value: number) {
  const progress = MathUtils.clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

export function gripperActuation(cycle: number) {
  const closeStart = 1.08;
  const closeEnd = 1.48;
  const releaseStart = 2.08;
  const releaseEnd = 2.48;

  if (cycle < closeStart || cycle >= releaseEnd) return 0;
  if (cycle < closeEnd) return smoothStep((cycle - closeStart) / (closeEnd - closeStart));
  if (cycle < releaseStart) return 1;
  return 1 - smoothStep((cycle - releaseStart) / (releaseEnd - releaseStart));
}

export function solveArm(x: number, y: number, floorY: number) {
  const upperLength = 1.75;
  const forearmLength = 1.52;
  const minimumReach = Math.abs(upperLength - forearmLength) + 0.025;
  const reach = MathUtils.clamp(Math.hypot(x, y), minimumReach, 3.245);
  const elbow = Math.min(
    Math.acos(
      MathUtils.clamp(
        (reach * reach - upperLength * upperLength - forearmLength * forearmLength) /
          (2 * upperLength * forearmLength),
        -1,
        1,
      ),
    ),
    MathUtils.degToRad(142),
  );
  const shoulder =
    Math.atan2(y, x) -
    Math.atan2(forearmLength * Math.sin(elbow), upperLength + forearmLength * Math.cos(elbow)) -
    Math.PI / 2;

  const safeShoulder = -0.58;
  const safeElbow = 1.3;
  const clearance = floorY + 0.24;
  const isSafe = (shoulderAngle: number, elbowAngle: number) => {
    const elbowY = 0.9 + Math.cos(shoulderAngle) * upperLength;
    const wristY = elbowY + Math.cos(shoulderAngle + elbowAngle) * forearmLength;
    return elbowY >= clearance && wristY >= clearance;
  };

  if (isSafe(shoulder, elbow)) return { elbow, shoulder };
  if (!isSafe(safeShoulder, safeElbow)) return { elbow: safeElbow, shoulder: safeShoulder };

  let unsafe = 0;
  let safe = 1;
  for (let index = 0; index < 14; index += 1) {
    const amount = (unsafe + safe) / 2;
    const smoothAmount = amount * amount * (3 - 2 * amount);
    const nextShoulder = MathUtils.lerp(shoulder, safeShoulder, smoothAmount);
    const nextElbow = MathUtils.lerp(elbow, safeElbow, smoothAmount);
    if (isSafe(nextShoulder, nextElbow)) safe = amount;
    else unsafe = amount;
  }

  const amount = safe * safe * (3 - 2 * safe);
  return {
    elbow: MathUtils.lerp(elbow, safeElbow, amount),
    shoulder: MathUtils.lerp(shoulder, safeShoulder, amount),
  };
}
