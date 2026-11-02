import { defineConfig } from 'vite';
import { wgslVitePlugin } from '@vgpu/wgsl/loader-vite';

export default defineConfig({
  plugins: [wgslVitePlugin({ minify: true })],
  build: {
    outDir: 'oveshcloud',
    emptyOutDir: false,
    target: 'es2022',
    minify: 'esbuild',
    lib: {
      entry: 'oveshcloud/spring-choreography-entry.ts',
      name: 'OvSpringChoreographyBundle',
      formats: ['iife'],
      fileName: () => 'spring-choreography.bundle.js',
    },
  },
});
