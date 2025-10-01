import { WebGLRenderer } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createRenderer(canvas) {
  // Load antialiasing setting from localStorage
  const savedSettings = localStorage.getItem('gameSettings');
  const settings = savedSettings ? JSON.parse(savedSettings) : { antialiasing: false };

  const renderer = new WebGLRenderer({
    canvas,
    antialias: settings.antialiasing,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true
  });

  renderer.physicallyCorrectLights = true;

  // Performance optimizations
  renderer.shadowMap.enabled = false; // Disable shadows entirely for performance
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio

  console.log('🎨 Renderer created with performance optimizations');

  return renderer;
}

export { createRenderer };