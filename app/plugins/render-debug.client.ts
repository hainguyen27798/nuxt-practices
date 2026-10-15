import type { ComponentPublicInstance } from 'vue';

export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.dev) return;

  nuxtApp.vueApp.mixin({
    updated(this: ComponentPublicInstance) {
      const options = this.$options as typeof this.$options & {
        __file?: string;
        __name?: string;
      };

      const name = options.__name ?? options.name ?? 'Anonymous';

      const path = options.__file ?? this.$?.type.__file ?? 'Unknown';

      console.count(`[UPDATED] ${name} (${path})`);
    },
  });
});
