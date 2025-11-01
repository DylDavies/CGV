import { Clock } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

const clock = new Clock();

class Loop {
  constructor(camera, scene, renderer, stats, labelRenderer = null, stageManager = null) {
    this.camera = camera;
    this.scene = scene; // Kept for backwards compatibility, but stageManager takes priority
    this.stageManager = stageManager; // Multi-scene support
    this.renderer = renderer;  // Single renderer
    this.stats = stats;
    this.labelRenderer = labelRenderer;
    this.updatables = []; // Array of objects with a .tick() method
    this.paused = false;
    this.isRunning = false;
  }

  start() {
    this.isRunning = true;
    if (!this.renderer) {
      console.error('❌ No renderer available');
      return;
    }

    let frameCount = 0;
    let lastLagFrame = -1;

    this.renderer.setAnimationLoop(() => {
        this.stats.begin();

      // Get the time since the last frame
      let delta = clock.getDelta();
      let shouldProfile = false;

      // Skip tick updates if paused, but continue rendering
      if (!this.paused) {
        // Cap delta to prevent physics issues when tab is inactive
        // Max delta of 0.1s (equivalent to 10 FPS minimum)
        const maxDelta = 0.1;
        if (delta > maxDelta) {
          // Only log details once per lag spike to avoid spam
          if (frameCount - lastLagFrame > 10) {
            lastLagFrame = frameCount;
            console.warn(`⚠️ Large delta detected (${delta.toFixed(3)}s), capping to ${maxDelta}s to prevent physics issues`);
            shouldProfile = true;
          }
          delta = maxDelta;
        }

        // Call the tick method for each object in the updatables array
        if (shouldProfile) {
          // Profile which updatable is slow
          for (const object of this.updatables) {
            const updatableStart = performance.now();
            if (object.tick.length > 1) {
              object.tick(delta, this.camera.position);
            } else {
              object.tick(delta);
            }
            const updatableTime = performance.now() - updatableStart;
            if (updatableTime > 10) {
              console.warn(`⚠️ Slow updatable: ${object.constructor.name || 'Unknown'} took ${updatableTime.toFixed(1)}ms`);
            }
          }
        } else {
          // Normal path, no profiling
          for (const object of this.updatables) {
            // Pass camera position to loaders for occlusion culling
            if (object.tick.length > 1) {
              object.tick(delta, this.camera.position);
            } else {
              object.tick(delta);
            }
          }
        }
      }

      try {
        // Render current scene with single renderer
        // Use stageManager's current scene if available, otherwise fall back to this.scene
        const sceneToRender = this.stageManager ? this.stageManager.getCurrentScene() : this.scene;

        if (shouldProfile) {
          const renderStart = performance.now();

          // Count visible objects before render
          let visibleMeshes = 0;
          sceneToRender.traverse(node => {
            if (node.isMesh && node.visible) visibleMeshes++;
          });

          this.renderer.render(sceneToRender, this.camera);
          const renderTime = performance.now() - renderStart;

          // Get renderer stats
          const info = this.renderer.info;
          console.warn(`📊 Render time: ${renderTime.toFixed(1)}ms | Visible meshes: ${visibleMeshes} | Draw calls: ${info.render.calls} | Triangles: ${info.render.triangles}`);
        } else {
          this.renderer.render(sceneToRender, this.camera);
        }

        if (this.labelRenderer) {
          this.labelRenderer.render(sceneToRender, this.camera);
        }
      } catch (error) {
        console.error("❌ Rendering error detected. This is often caused by an invalid camera or object position (NaN).", error);
        // We stop the loop here to prevent a flood of errors.
        this.stop();
      }

      this.stats.end();
      frameCount++;
    });
  }

  stop() {
    this.isRunning = false;
    // Stop animation loop on the single renderer
    if (this.renderer) {
      this.renderer.setAnimationLoop(null);
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