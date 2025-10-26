// src/utils/ResourceTracker.js
// Official Three.js pattern for systematic resource disposal
// Based on Three.js documentation and community best practices

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

/**
 * ResourceTracker - Tracks and disposes Three.js resources
 *
 * This is the gold-standard pattern from Three.js official documentation.
 * It automatically tracks all created resources and disposes them together,
 * preventing memory leaks from orphaned geometries, materials, and textures.
 *
 * Usage:
 *   const tracker = new ResourceTracker();
 *   const track = tracker.track.bind(tracker);
 *
 *   const geometry = track(new THREE.BoxGeometry(1, 1, 1));
 *   const material = track(new THREE.MeshBasicMaterial({ color: 0xff0000 }));
 *   const mesh = track(new THREE.Mesh(geometry, material));
 *   scene.add(mesh);
 *
 *   // Later: dispose everything at once
 *   tracker.dispose();
 */
export class ResourceTracker {
  constructor() {
    this.resources = new Set();
  }

  track(resource) {
    if (!resource) {
      return resource;
    }

    // Handle arrays of resources
    if (Array.isArray(resource)) {
      resource.forEach(r => this.track(r));
      return resource;
    }

    // Track disposable resources
    if (resource.dispose || resource instanceof THREE.Object3D) {
      this.resources.add(resource);
    }

    // Recursively track children and materials of Object3D nodes
    if (resource instanceof THREE.Object3D) {
      this.track(resource.geometry);
      this.track(resource.material);
      this.track(resource.children);
    } else if (resource instanceof THREE.Material) {
      // Track all textures in material
      for (const value of Object.values(resource)) {
        if (value instanceof THREE.Texture) {
          this.track(value);
        }
      }

      // Track textures in shader uniforms
      if (resource.uniforms) {
        for (const value of Object.values(resource.uniforms)) {
          if (value) {
            const uniformValue = value.value;
            if (uniformValue instanceof THREE.Texture || Array.isArray(uniformValue)) {
              this.track(uniformValue);
            }
          }
        }
      }
    }

    return resource;
  }

  untrack(resource) {
    this.resources.delete(resource);
  }

  dispose() {
    for (const resource of this.resources) {
      // Remove Object3D from parent before disposing
      if (resource instanceof THREE.Object3D) {
        if (resource.parent) {
          resource.parent.remove(resource);
        }
      }

      // Close ImageBitmap if present (critical for GLB files!)
      if (resource instanceof THREE.Texture) {
        if (resource.source?.data?.close) {
          resource.source.data.close();
        }
      }

      // Dispose the resource
      if (resource.dispose) {
        resource.dispose();
      }
    }

    this.resources.clear();
  }
}
