<script setup lang="ts">
import { useTresContext } from '@tresjs/core';
import { Fog, MathUtils, Quaternion, Vector2, Vector3 } from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

import { createGroundGrid, createLightRig } from '../utils/ro-arm/environment';
import { disposeSceneResources } from '../utils/ro-arm/geometry';
import { buildRoArmModel, type RoArmModel } from '../utils/ro-arm/model';
import {
  dampAngle,
  GRIPPER_CLOSED_ANGLE,
  GRIPPER_OPEN_ANGLE,
  gripperActuation,
  SHOULDER_HEIGHT,
  solveArm,
} from '../utils/ro-arm/motion';

const emit = defineEmits<{
  error: [message: string];
  ready: [];
}>();

const sceneRoot = shallowRef<RoArmModel['root']>();
const { camera, renderer, scene } = useTresContext();
const previousFog = scene.value.fog;
const pointer = new Vector2(0.58, 0.06);
const pointerTarget = new Vector2(0.58, 0.06);
const rayPoint = new Vector3();
const rayDirection = new Vector3();
const targetWorld = new Vector3();
const targetLocal = new Vector3();
const attackWorld = new Vector3();
const attackLocal = new Vector3();
const rootQuaternion = new Quaternion();
const wristParentQuaternion = new Quaternion();
const desiredWristQuaternion = new Quaternion();
const localWristQuaternion = new Quaternion();
const up = new Vector3(0, 1, 0);
const compactBreakpoint = 900;

const loader = new STLLoader();
let model: RoArmModel | undefined;
let grid: ReturnType<typeof createGroundGrid> | undefined;
let lightRig: ReturnType<typeof createLightRig> | undefined;
let removeLoop: (() => void) | undefined;
let pointerActive = false;
let pointerClientY = Number.POSITIVE_INFINITY;
let interactionTime = 0;

const armModelPaths = [
  '/models/roarm-m2/base_link.stl',
  '/models/roarm-m2/link2.stl',
  '/models/roarm-m2/link3.stl',
];

function handlePointerMove(event: PointerEvent) {
  pointerTarget.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    1 - (event.clientY / window.innerHeight) * 2,
  );
  pointerActive = true;
  pointerClientY = event.clientY;
}

function handlePointerLeave() {
  pointerTarget.set(window.innerWidth < compactBreakpoint ? 0.18 : 0.58, 0.06);
  pointerActive = false;
  pointerClientY = Number.POSITIVE_INFINITY;
}

onMounted(async () => {
  scene.value.fog = new Fog('#000000', 8, 18);
  grid = createGroundGrid();
  lightRig = createLightRig();
  scene.value.add(grid);
  scene.value.add(lightRig);

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', handlePointerLeave);

  try {
    const armSource = await Promise.all(armModelPaths.map((path) => loader.loadAsync(path)));
    model = buildRoArmModel(armSource);
    sceneRoot.value = model.root;
    emit('ready');
  } catch (error) {
    emit('error', error instanceof Error ? error.message : 'Unable to load the 3D model.');
  }

  const loopSubscription = renderer.loop.onLoop(({ delta }) => {
    if (!model) return;

    const { armYaw, forearm, gripperDrive, gripperFollower, root, toolRoll, upperArm, wrist } =
      model;
    const compact = window.innerWidth < compactBreakpoint;
    const baseX = compact ? 0.48 : 1.7;
    const baseY = compact ? -1.82 : -1.45;
    const modelScale = compact ? 0.62 : 0.92;
    root.position.set(baseX, baseY, 0);
    root.scale.setScalar(modelScale);
    if (grid) {
      grid.material.uniforms.uPlaneY!.value = baseY - 0.012;
      grid.material.uniforms.uLightPosition!.value.set(baseX, 0.7);
      grid.material.uniforms.uRobotPosition!.value.set(baseX, 0);
      grid.material.uniforms.uRobotScale!.value = modelScale;
    }

    pointer.x = MathUtils.damp(pointer.x, pointerTarget.x, 14, delta);
    pointer.y = MathUtils.damp(pointer.y, pointerTarget.y, 14, delta);

    const activeCamera = camera.activeCamera.value;
    rayPoint.set(pointer.x, pointer.y, 0.5).unproject(activeCamera);
    rayDirection.copy(rayPoint).sub(activeCamera.position).normalize();
    const directionZ = Math.abs(rayDirection.z) < 0.0001 ? -0.0001 : rayDirection.z;
    const rayDistance = (1.55 - activeCamera.position.z) / directionZ;
    targetWorld.copy(activeCamera.position).addScaledVector(rayDirection, rayDistance);

    attackWorld
      .set(0.18 - pointer.x * 0.46, -0.5 + pointer.y * 0.1, 0.84 + pointer.y * 0.2)
      .normalize();
    if (pointerActive) {
      const rawUprightAmount = MathUtils.clamp((150 - pointerClientY) / 70, 0, 1);
      const uprightAmount = rawUprightAmount * rawUprightAmount * (3 - 2 * rawUprightAmount);
      attackWorld.lerp(up, uprightAmount).normalize();
    }

    const floorY = baseY - 0.012;
    targetWorld.y = Math.max(targetWorld.y, floorY + 0.34);
    attackWorld.y = Math.max(attackWorld.y, -0.5);
    attackWorld.normalize();

    root.updateWorldMatrix(true, true);
    targetLocal.copy(targetWorld);
    root.worldToLocal(targetLocal);
    root.getWorldQuaternion(rootQuaternion).invert();
    attackLocal.copy(attackWorld).applyQuaternion(rootQuaternion).normalize();

    const wristTargetX = targetLocal.x - 1.12 * attackLocal.x;
    const wristTargetY = targetLocal.y - SHOULDER_HEIGHT - 1.12 * attackLocal.y;
    const wristTargetZ = targetLocal.z - 1.12 * attackLocal.z;
    const planarReach = Math.hypot(wristTargetX, wristTargetZ);
    const yaw = Math.atan2(wristTargetZ, -wristTargetX);
    const jointAngles = solveArm(-planarReach, wristTargetY, (floorY - baseY) / modelScale);
    const wristResponse = 1 - Math.exp(-10 * delta);

    armYaw.rotation.y = dampAngle(armYaw.rotation.y, yaw, 8.5, delta);
    upperArm.rotation.z = dampAngle(upperArm.rotation.z, jointAngles.shoulder, 8.5, delta);
    forearm.rotation.z = dampAngle(forearm.rotation.z, jointAngles.elbow, 8.5, delta);

    root.updateWorldMatrix(true, true);
    wrist.parent?.getWorldQuaternion(wristParentQuaternion);
    desiredWristQuaternion.setFromUnitVectors(up, attackWorld);
    localWristQuaternion.copy(wristParentQuaternion).invert().multiply(desiredWristQuaternion);
    wrist.quaternion.slerp(localWristQuaternion, wristResponse);

    interactionTime = pointerActive ? interactionTime + delta : 0;
    const cycle = Math.max(interactionTime - 1.15, 0) % 4.52;
    let roll = 0;
    if (interactionTime >= 1.15) {
      if (cycle < 0.9) {
        const progress = cycle / 0.9;
        const eased =
          progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
        roll = eased * Math.PI * 2;
      } else if (cycle < 1.42) {
        roll = Math.PI * 2;
      }
    }
    toolRoll.rotation.y = roll;

    const gripAngle = MathUtils.lerp(
      GRIPPER_OPEN_ANGLE,
      GRIPPER_CLOSED_ANGLE,
      gripperActuation(cycle),
    );
    gripperDrive.rotation.z = dampAngle(gripperDrive.rotation.z, -gripAngle, 18, delta);
    gripperFollower.rotation.z = -gripperDrive.rotation.z;
  });
  removeLoop = loopSubscription.off;
});

onBeforeUnmount(() => {
  removeLoop?.();
  window.removeEventListener('pointermove', handlePointerMove);
  document.documentElement.removeEventListener('mouseleave', handlePointerLeave);

  if (grid) {
    scene.value.remove(grid);
    grid.geometry.dispose();
    grid.material.dispose();
  }
  if (lightRig) scene.value.remove(lightRig);

  scene.value.fog = previousFog;
  disposeSceneResources();
});
</script>

<template>
  <primitive v-if="sceneRoot" :object="sceneRoot" />
</template>
