import Stats from 'https://unpkg.com/three@0.127.0/examples/jsm/libs/stats.module.js';

function createStats() {
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
    return stats;
}

export { createStats };