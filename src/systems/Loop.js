import { Clock } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

const clock = new Clock();

class Loop {
  constructor(camera, scene, rendererManager, stats, labelRenderer = null, stageManager = null) {
    this.camera = camera;
    this.scene = scene; // Kept for backwards compatibility, but stageManager takes priority
    this.stageManager = stageManager; // Multi-scene support
    this.rendererManager = rendererManager;  // Single renderer managed here
    this.stats = stats;
    this.labelRenderer = labelRenderer;
    this.updatables = []; // Array of objects with a .tick() method
    this.paused = false;
    this.isRunning = false;
  }

  start() {
    this.isRunning = true;
    const renderer = this.rendererManager.getRenderer();
    if (!renderer) {
      console.error('❌ No renderer available');
      return;
    }

    renderer.setAnimationLoop(() => {
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
          // Pass camera position to loaders for occlusion culling
          if (object.tick.length > 1) {
            object.tick(delta, this.camera.position);
          } else {
            object.tick(delta);
          }
        }
      }

      try {
        // Render current scene with single renderer
        // Use stageManager's current scene if available, otherwise fall back to this.scene
        const sceneToRender = this.stageManager ? this.stageManager.getCurrentScene() : this.scene;
        renderer.render(sceneToRender, this.camera);

        if (this.labelRenderer) {
          this.labelRenderer.render(sceneToRender, this.camera);
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
    this.isRunning = false;
    // Stop animation loop on the single renderer
    const renderer = this.rendererManager.getRenderer();
    if (renderer) {
      renderer.setAnimationLoop(null);
    }
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