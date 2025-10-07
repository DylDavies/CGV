import { WebGLRenderer } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createRenderer(canvas) {
  // Load antialiasing setting from localStorage
  let settings = { antialiasing: false };
  try {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
      settings = JSON.parse(savedSettings);
    }
  } catch (e) {
    console.warn('⚠️ Failed to load renderer settings, using defaults:', e);
  }

  const renderer = new WebGLRenderer({
    canvas,
    antialias: settings.antialiasing || false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true
  });

  renderer.physicallyCorrectLights = true;

  // Performance optimizations
  renderer.shadowMap.enabled = false; // Disable shadows entirely for performance
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio

  console.log(`🎨 Renderer created with antialiasing: ${settings.antialiasing || false}`);

  return renderer;
}

export { createRenderer };