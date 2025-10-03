// src/components/Monster/Monster.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

function createMonster() {
  const geometry = new THREE.BoxGeometry(1, 2, 1); // Width, Height, Depth
  geometry.translate(0, 1, 0); // Move the geometry up by half its height
  
  const material = new THREE.MeshStandardMaterial({ color: 'red' });
  const monster = new THREE.Mesh(geometry, material);
  monster.name = 'monster';

  // Position it somewhere visible for now
  //monster.position.set(1, 1, 1); 

  return monster;
}

export { createMonster };