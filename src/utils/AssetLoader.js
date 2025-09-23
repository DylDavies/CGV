import { GLTFLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';

async function loadMap(filePaths) {
  const loader = new GLTFLoader();
  const promises = [];

  // Create a loading promise for each file
  for (const path of filePaths) {
    promises.push(loader.loadAsync(path));
  }

  // Wait for all promises to resolve
  const models = await Promise.all(promises);
  return models;
}

export { loadMap };