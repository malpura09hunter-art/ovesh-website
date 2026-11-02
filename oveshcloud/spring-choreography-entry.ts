import { createRenderer } from './spring-choreography-source/renderer';

export function mountSpringChoreography(canvas: HTMLCanvasElement, container: HTMLElement) {
  const renderer = createRenderer({ canvas, container });
  return { ready: renderer.ready, dispose: renderer.dispose };
}
