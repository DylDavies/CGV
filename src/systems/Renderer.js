import { WebGLRenderer } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createRenderer(canvas) {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.physicallyCorrectLights = true;
  return renderer;
}

export { createRenderer };