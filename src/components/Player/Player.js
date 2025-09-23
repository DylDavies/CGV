import { BoxGeometry, Mesh, MeshStandardMaterial } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createPlayer() {
  const geometry = new BoxGeometry(2, 2, 2); // 2x2x2 cube
  const material = new MeshStandardMaterial({ color: 'red' });
  const player = new Mesh(geometry, material);

  // Add a tick method for animation
  player.tick = (delta) => {
    // Rotate the cube on every frame
    player.rotation.x += 0.01 * delta;
    player.rotation.y += 0.01 * delta;
    player.rotation.z += 0.01 * delta;
  };

  return player;
}

export { createPlayer };