import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

const mansionSections = [
    { id: 'entry', path: 'models/Mansion/MERGED_CENTRE_Entry.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'entry_library', path: 'models/Mansion/MERGED_CENTRE_Entry_library.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'entry_right', path: 'models/Mansion/MERGED_CENTRE_Entry_right.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'entry_top_right', path: 'models/Mansion/MERGED_CENTRE_Entry_top_right.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'bottom_left_corridor', path: 'models/Mansion/MERGED_CENTRE_bottom_left_corridor.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'bottom_right_back_room_001', path: 'models/Mansion/MERGED_CENTRE_bottom_right_back_room_001.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'bottom_right_back_room', path: 'models/Mansion/MERGED_CENTRE_bottom_right_back_room.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'bottom_right_back_room2', path: 'models/Mansion/MERGED_CENTRE_bottom_right_back_room2.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'bottom_right_corridor', path: 'models/Mansion/MERGED_CENTRE_bottom_right_corridor.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'corridor', path: 'models/Mansion/MERGED_CENTRE_corridor.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_left_corridor_centre', path: 'models/Mansion/MERGED_CENTRE_top_left_corridor_centre.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_left_corridor_end', path: 'models/Mansion/MERGED_CENTRE_top_left_corridor_end.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_left_corridor_entrance', path: 'models/Mansion/MERGED_CENTRE_top_left_corridor_entrance.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_left_room1', path: 'models/Mansion/MERGED_CENTRE_top_left_room1.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_left_room2', path: 'models/Mansion/MERGED_CENTRE_top_left_room2.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_middle_room', path: 'models/Mansion/MERGED_CENTRE_top_middle_room.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_right_corridor_end', path: 'models/Mansion/MERGED_CENTRE_top_right_corridor_end.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_right_corridor_entrance', path: 'models/Mansion/MERGED_CENTRE_top_right_corridor_entrance.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_right_corridor_kink', path: 'models/Mansion/MERGED_CENTRE_top_right_corridor_kink.glb', position: new THREE.Vector3(0, 0, 0) },
    { id: 'top_right_room_end', path: 'models/Mansion/MERGED_CENTRE_top_right_room_end.glb', position: new THREE.Vector3(0, 0, 0) }
];

export const mansionConfig = mansionSections.map(part => ({
    ...part,
    loaded: false,
}));