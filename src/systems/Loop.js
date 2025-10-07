import { Clock } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

const clock = new Clock();

class Loop {
  constructor(camera, scene, renderer, stats, labelRenderer = null) {
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    this.stats = stats;
    this.labelRenderer = labelRenderer;
    this.updatables = []; // Array of objects with a .tick() method
    this.paused = false;
  }

  start() {
    this.renderer.setAnimationLoop(() => {
        this.stats.begin();

      // Get the time since the last frame
      let delta = clock.getDelta();

      // Skip tick updates if paused, but continue rendering
      if (!this.paused) {
        // Cap delta to prevent physics issues when tab is inactive
        // Max delta of 0.1s (equivalent to 10 FPS minimum)
        const maxDelta = 0.1;
        if (delta > maxDelta) {
          console.warn(`⚠️ Large delta detected (${delta.toFixed(3)}s), capping to ${maxDelta}s to prevent physics issues`);
          delta = maxDelta;
        }

        // Call the tick method for each object in the updatables array
        for (const object of this.updatables) {
          object.tick(delta);
        }
      }

      try {
        this.renderer.render(this.scene, this.camera);

        if (this.labelRenderer) {
          this.labelRenderer.render(this.scene, this.camera);
        }
      } catch (error) {
        console.error("❌ Rendering error detected. This is often caused by an invalid camera or object position (NaN).", error);
        // We stop the loop here to prevent a flood of errors.
        this.stop(); 
      }

      this.stats.end();
    });
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  pause() {
    this.paused = true;
    console.log('⏸️ Game loop paused');
  }

  resume() {
    this.paused = false;
    // Reset clock to prevent large delta on resume
    clock.getDelta();
    console.log('▶️ Game loop resumed');
  }

  isPaused() {
    return this.paused;
  }
}

export { Loop };