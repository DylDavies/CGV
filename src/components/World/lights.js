import { AmbientLight, DirectionalLight } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createLights() {
  // An ambient light that illuminates the whole scene
  const ambientLight = new AmbientLight('white', 0.5);

  // A directional light that acts like the sun
  const mainLight = new DirectionalLight('white', 1.0);
  mainLight.position.set(10, 10, 10);

  return { ambientLight, mainLight };
}

export { createLights };