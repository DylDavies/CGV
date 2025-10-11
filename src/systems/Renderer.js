import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createRenderer(canvas) {
  // Load settings from localStorage
  let settings = { antialiasing: false, quality: 'medium' };
  try {
    const savedSettings = localStorage.getItem('gameSettings');
    if (savedSettings) {
      settings = JSON.parse(savedSettings);
      if (!settings.quality) settings.quality = 'medium';
    }
  } catch (e) {
    console.warn('⚠️ Failed to load renderer settings, using defaults:', e);
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: settings.antialiasing || false,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true
  });

  renderer.physicallyCorrectLights = true;

  // Enhanced tone mapping for more dramatic lighting and shadows
  renderer.toneMapping = THREE.ACESFilmicToneMapping; // Cinematic tone mapping
  renderer.toneMappingExposure = 0.8; // Slightly darker for horror atmosphere

  // Enhanced output encoding for better color depth
  renderer.outputEncoding = THREE.sRGBEncoding;

  // Shadow map configuration based on quality
  const shadowConfig = getShadowConfig(settings.quality);
  renderer.shadowMap.enabled = shadowConfig.enabled;
  renderer.shadowMap.type = shadowConfig.type;
  renderer.shadowMap.autoUpdate = true;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Limit pixel ratio

  console.log(`🎨 Renderer created with antialiasing: ${settings.antialiasing || false}, shadows: ${shadowConfig.enabled ? shadowConfig.type : 'disabled'}`);

  // Listen for quality changes
  window.addEventListener('qualitychange', (e) => {
    const newConfig = getShadowConfig(e.detail.quality);
    renderer.shadowMap.enabled = newConfig.enabled;
    renderer.shadowMap.type = newConfig.type;
    renderer.shadowMap.needsUpdate = true;
    console.log(`🎨 Renderer shadows updated: ${newConfig.enabled ? newConfig.type : 'disabled'}`);
  });

  return renderer;
}

function getShadowConfig(quality) {
  const configs = {
    low: {
      enabled: false,
      type: THREE.BasicShadowMap
    },
    medium: {
      enabled: true,
      type: THREE.PCFShadowMap // Default, good quality, sharp shadows
    },
    high: {
      enabled: true,
      type: THREE.PCFShadowMap // Sharp shadows for dramatic effect
    },
    ultra: {
      enabled: true,
      type: THREE.PCFShadowMap // Changed from PCFSoft for sharper, more extreme shadows
    }
  };
  return configs[quality] || configs.medium;
}

export { createRenderer };