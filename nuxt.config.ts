// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: {
    enabled: true,
    componentInspector: true,
  },
  modules: ['@nuxt/eslint', '@tresjs/nuxt', '@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        '@vue/devtools-core',
        'three',
        'three/examples/jsm/geometries/RoundedBoxGeometry.js',
        'three/examples/jsm/loaders/STLLoader.js',
      ],
    },
  },
  vue: {
    config: {
      performance: true,
    },
  },
});
