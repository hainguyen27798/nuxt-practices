<script setup lang="ts">
import { useTresContext } from '@tresjs/core';
import type { Group, PerspectiveCamera } from 'three';
import { Box3, Vector3 } from 'three';
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';

import { aimRobot, loadRobot, type RobotModel } from '../utils/robot/model';

const emit = defineEmits<{ error: [message: string]; ready: [] }>();
const { camera, renderer } = useTresContext();
const sceneRoot = shallowRef<Group>();
let model: RobotModel | undefined;
let removeLoop: (() => void) | undefined;
let disposed = false;
let pointerX = 0;
let pointerY = 0;
let neutralHeadCenter: Vector3 | undefined;

function handlePointer(event: PointerEvent) {
  const canvas = renderer.instance.domElement;
  const rect = canvas.getBoundingClientRect();
  pointerX = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
  // Use the resting head position, not the screen center or the moving head (feedback loop).
  const activeCamera = camera.activeCamera.value;
  const headY =
    neutralHeadCenter && activeCamera
      ? (1 - neutralHeadCenter.clone().project(activeCamera).y) / 2
      : 0.5;
  const originY = Math.max(0.01, Math.min(0.99, headY));
  const offsetY = (event.clientY - rect.top) / Math.max(1, rect.height) - originY;
  pointerY = Math.max(-1, Math.min(1, offsetY / (offsetY < 0 ? originY : 1 - originY)));
}

function resetPointer() {
  pointerX = 0;
  pointerY = 0;
}

onMounted(async () => {
  const canvas = renderer.instance.domElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  canvas.addEventListener('pointermove', handlePointer, { passive: true });
  canvas.addEventListener('pointerleave', resetPointer);
  canvas.addEventListener('pointercancel', resetPointer);
  window.addEventListener('blur', resetPointer);

  try {
    const loaded = await loadRobot();
    if (disposed) {
      loaded.dispose();
      return;
    }
    model = loaded;
    sceneRoot.value = model.root;
    const bottom = new Box3().setFromObject(model.root).min.y;
    neutralHeadCenter = new Box3().setFromObject(model.head).getCenter(new Vector3());
    removeLoop = renderer.loop.onLoop(({ delta }) => {
      if (!model) return;
      aimRobot(model, pointerX, pointerY, delta, reducedMotion.matches);
      const activeCamera = camera.activeCamera.value as PerspectiveCamera;
      const aspect = activeCamera.aspect || 1;
      // Half the previous projected size, anchored above the bottom edge on every viewport.
      const halfFov = (activeCamera.fov * Math.PI) / 360;
      const distance = Math.max(3.65, 3.45 / aspect) / Math.tan(halfFov);
      const viewHeight = 2 * distance * Math.tan(halfFov);
      const bottomPadding = (12 / Math.max(1, canvas.clientHeight)) * viewHeight;
      const centerY = bottom + viewHeight / 2 - bottomPadding;
      activeCamera.position.set(0, centerY, distance);
      activeCamera.lookAt(0, centerY, 0);
    }).off;
    emit('ready');
  } catch (error) {
    if (!disposed) emit('error', error instanceof Error ? error.message : 'Unable to load robot.');
  }
});

onBeforeUnmount(() => {
  disposed = true;
  removeLoop?.();
  const canvas = renderer.instance.domElement;
  canvas.removeEventListener('pointermove', handlePointer);
  canvas.removeEventListener('pointerleave', resetPointer);
  canvas.removeEventListener('pointercancel', resetPointer);
  window.removeEventListener('blur', resetPointer);
  model?.dispose();
});
</script>

<template>
  <primitive v-if="sceneRoot" :object="sceneRoot" />
</template>
