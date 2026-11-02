import { createRenderer } from './spring-choreography-source/renderer';

export function mountSpringChoreography(canvas: HTMLCanvasElement, container: HTMLElement) {
  const renderer = createRenderer({ canvas, container });
  return { ready: renderer.ready, dispose: renderer.dispose };
}

// Use a dedicated global that cannot be confused with the IIFE library name.
if (typeof window !== 'undefined') {
  (window as Window & { __OV_SPRING_RENDERER__?: { mountSpringChoreography: typeof mountSpringChoreography } })
    .__OV_SPRING_RENDERER__ = { mountSpringChoreography };
}
