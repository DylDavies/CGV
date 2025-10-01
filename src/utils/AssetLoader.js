import { GLTFLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.127.0/examples/jsm/loaders/DRACOLoader.js';

async function loadMap(filePaths) {
  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();

  // The path needed to use /js/ instead of /jsm/ for this version.
  dracoLoader.setDecoderPath('https://unpkg.com/three@0.127.0/examples/js/libs/draco/gltf/');

  gltfLoader.setDRACOLoader(dracoLoader);
  
  const promises = [];

  for (const path of filePaths) {
    promises.push(gltfLoader.loadAsync(path));
  }

  const models = await Promise.all(promises);
  return models;
}

async function loadModel(path) {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://unpkg.com/three@0.127.0/examples/js/libs/draco/gltf/');
    gltfLoader.setDRACOLoader(dracoLoader);

    try {
        const gltf = await gltfLoader.loadAsync(path);
        console.log(`Model loaded successfully from ${path}`, gltf);
        return gltf;
    } catch (error) {
        console.error(`Error loading model from ${path}:`, error);
        throw error;
    }
}

export { loadMap, loadModel };