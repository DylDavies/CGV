const setSize = (camera, renderer) => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
};

class Resizer {
  constructor(camera, renderer) {
    // Set initial size
    setSize(camera, renderer);

    // Listen for resize events
    window.addEventListener('resize', () => {
      setSize(camera, renderer);
    });
  }
}

export { Resizer };