import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

const mansionSections = [
    { id: 'entry', path: 'models/Mansion/MERGED_CENTRE_Entry.glb', position: new THREE.Vector3(-1.40, 5.19, 17.83) },
    { id: 'entry_library', path: 'models/Mansion/MERGED_CENTRE_Entry_library.glb', position: new THREE.Vector3(-18.26, 5.99, 20.03) },
    { id: 'entry_right', path: 'models/Mansion/MERGED_CENTRE_Entry_right.glb', position: new THREE.Vector3(16.75, 2.55, 14.46) },
    { id: 'entry_top_right', path: 'models/Mansion/MERGED_CENTRE_Entry_top_right.glb', position: new THREE.Vector3(14.13, 4.96, 13.51) },
    { id: 'bottom_left_corridor', path: 'models/Mansion/MERGED_CENTRE_bottom_left_corridor.glb', position: new THREE.Vector3(-15.54, 2.73, 3.82) },
    { id: 'bottom_right_back_room_001', path: 'models/Mansion/MERGED_CENTRE_bottom_right_back_room_001.glb', position: new THREE.Vector3(-15.13, 3.58, -5.70) },
    { id: 'bottom_right_back_room', path: 'models/Mansion/MERGED_CENTRE_bottom_right_back_room.glb', position: new THREE.Vector3(24.95, 3.34, -9.68) },
    { id: 'bottom_right_back_room2', path: 'models/Mansion/MERGED_CENTRE_bottom_right_back_room2.glb', position: new THREE.Vector3(-22.62, 1.85, -6.48) },
    { id: 'bottom_right_corridor', path: 'models/Mansion/MERGED_CENTRE_bottom_right_corridor.glb', position: new THREE.Vector3(14.12, 3.50, 2.91) },
    { id: 'corridor', path: 'models/Mansion/MERGED_CENTRE_corridor.glb', position: new THREE.Vector3(-2.42, -6.81, -94.59) },
    { id: 'top_left_corridor_centre', path: 'models/Mansion/MERGED_CENTRE_top_left_corridor_centre.glb', position: new THREE.Vector3(-16.76, 4.30, -5.95) },
    { id: 'top_left_corridor_end', path: 'models/Mansion/MERGED_CENTRE_top_left_corridor_end.glb', position: new THREE.Vector3(-8.50, 6.12, -9.97) },
    { id: 'top_left_corridor_entrance', path: 'models/Mansion/MERGED_CENTRE_top_left_corridor_entrance.glb', position: new THREE.Vector3(-13.33, 5.83, 10.35) },
    { id: 'top_left_room1', path: 'models/Mansion/MERGED_CENTRE_top_left_room1.glb', position: new THREE.Vector3(-23.28, 4.38, 2.68) },
    { id: 'top_left_room2', path: 'models/Mansion/MERGED_CENTRE_top_left_room2.glb', position: new THREE.Vector3(-24.21, 4.40, -7.92) },
    { id: 'top_middle_room', path: 'models/Mansion/MERGED_CENTRE_top_middle_room.glb', position: new THREE.Vector3(0.19, 6.62, 2.49) },
    { id: 'top_right_corridor_end', path: 'models/Mansion/MERGED_CENTRE_top_right_corridor_end.glb', position: new THREE.Vector3(2.45, 4.51, -17.27) },
    { id: 'top_right_corridor_entrance', path: 'models/Mansion/MERGED_CENTRE_top_right_corridor_entrance.glb', position: new THREE.Vector3(19.69, 4.55, 0.94) },
    { id: 'top_right_corridor_kink', path: 'models/Mansion/MERGED_CENTRE_top_right_corridor_kink.glb', position: new THREE.Vector3(10.76, 5.10, -9.20) },
    { id: 'top_right_room_end', path: 'models/Mansion/MERGED_CENTRE_top_right_room_end.glb', position: new THREE.Vector3(12.97, 5.64, -22.10) }
];

export const mansionConfig = mansionSections.map(part => ({
    ...part,
    loaded: false,
}));