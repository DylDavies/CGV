import { Clock } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

const clock = new Clock();

class Loop {
  constructor(camera, scene, renderer, stats) {
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    this.stats = stats;
    this.updatables = []; // Array of objects with a .tick() method
  }

  start() {
    this.renderer.setAnimationLoop(() => {
        this.stats.begin();

      // Get the time since the last frame
      const delta = clock.getDelta();

      // Call the tick method for each object in the updatables array
      for (const object of this.updatables) {
        object.tick(delta);
      }
      
      // Render the scene
      this.renderer.render(this.scene, this.camera);

      this.stats.end();
    });
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }
}

export { Loop };