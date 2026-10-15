<script setup lang="ts">
const email = ref('');
</script>

<template>
  <div>
    <p>{{ email }}</p>
    <UInput v-model="email" />
  </div>
</template>
