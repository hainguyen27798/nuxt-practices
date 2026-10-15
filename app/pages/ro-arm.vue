<script setup lang="ts">
import { PerspectiveCamera } from 'three';
import { ref } from 'vue';

const loadError = ref('');
const isReady = ref(false);
const camera = new PerspectiveCamera(38, 1, 0.1, 50);
camera.position.set(0, 0.12, 7.6);
camera.lookAt(0, 0.08, 0);

useHead({
  title: 'Robot',
  meta: [
    {
      name: 'description',
      content: 'A Blender-built robot that follows your cursor with its head and neck.',
    },
  ],
});
</script>

<template>
  <main class="ro-arm-page">
    <h1 class="visually-hidden">Robot — move your pointer to turn its head</h1>

    <TresCanvas
      class="ro-arm-canvas"
      clear-color="#000000"
      :clear-alpha="0"
      :dpr="[1, 2]"
      :alpha="true"
      :antialias="true"
      :camera="camera"
      render-mode="always"
      :tone-mapping-exposure="0.86"
    >
      <RobotScene @ready="isReady = true" @error="loadError = $event" />
    </TresCanvas>

    <div v-if="!isReady && !loadError" class="loading-state" role="status">Loading model</div>
    <div v-if="loadError" class="error-state" role="alert">{{ loadError }}</div>
  </main>
</template>

<style scoped>
@font-face {
  font-family: 'Host Grotesk';
  font-style: normal;
  font-weight: 100 900;
  src: url('/fonts/host-grotesk.woff2') format('woff2');
}

body {
  overflow: hidden;
}

.ro-arm-page {
  position: relative;
  width: 100vw;
  height: 100svh;
  overflow: hidden;
  background: #f7f4ef;
}

.ro-arm-canvas {
  position: absolute !important;
  inset: 0;
  width: 100% !important;
  height: 100% !important;
  cursor: crosshair;
  touch-action: none;
}

.loading-state,
.error-state {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  color: rgb(240 242 238 / 60%);
  font-family: 'Host Grotesk', sans-serif;
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  transform: translateX(-50%);
}

.loading-state::after {
  display: inline-block;
  width: 1.25em;
  content: '…';
  overflow: hidden;
  vertical-align: bottom;
  animation: loading-dots 1.1s steps(4, end) infinite;
}

.error-state {
  color: #ffb4a8;
  letter-spacing: 0;
  text-transform: none;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes loading-dots {
  from {
    width: 0;
  }

  to {
    width: 1.25em;
  }
}

@media (max-width: 899px) {
  .ro-arm-page {
    background: #f7f4ef;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-state::after {
    animation: none;
  }
}
</style>
