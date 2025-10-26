const setSize = (camera, rendererManager) => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  // Update single renderer when window resizes
  rendererManager.onWindowResize();
};

class Resizer {
  constructor(camera, rendererManager) {
    // Set initial size
    setSize(camera, rendererManager);

    // Listen for resize events
    window.addEventListener('resize', () => {
      setSize(camera, rendererManager);
    });
  }
}

export { Resizer };