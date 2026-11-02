import { createRenderer } from './spring-choreography-source/renderer';

export function mountSpringChoreography(canvas: HTMLCanvasElement, container: HTMLElement) {
  const renderer = createRenderer({ canvas, container });
  return { ready: renderer.ready, dispose: renderer.dispose };
}

// Explicitly publish the API on window. This avoids relying on the bundler's
// top-level IIFE variable being reflected as a Window property in every host.
if (typeof window !== 'undefined') {
  (window as Window & { OvSpringChoreography?: { mountSpringChoreography: typeof mountSpringChoreography } })
    .OvSpringChoreography = { mountSpringChoreography };
}
