// src/systems/ProceduralMansion.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class ProceduralMansion {
    constructor(scene, physicsManager = null) {
        this.scene = scene;
        this.physicsManager = physicsManager;
        this.rooms = [];
        this.hallways = [];
        this.doors = [];
        this.puzzleRooms = [];
        this.materials = this.createMaterials();
        // More realistic room types and sizes
        this.roomTypes = [
            { type: 'living_room', minSize: [4, 4], maxSize: [6, 5], probability: 0.8 },
            { type: 'kitchen', minSize: [3, 3], maxSize: [4, 4], probability: 0.9 },
            { type: 'bedroom', minSize: [3, 3], maxSize: [4, 4], probability: 0.7 },
            { type: 'bathroom', minSize: [2, 2], maxSize: [3, 2], probability: 0.6 },
            { type: 'dining_room', minSize: [3, 3], maxSize: [4, 4], probability: 0.5 },
            { type: 'study', minSize: [2, 3], maxSize: [3, 3], probability: 0.4 },
            { type: 'storage', minSize: [2, 2], maxSize: [3, 2], probability: 0.3 },
            { type: 'hallway', minSize: [1, 3], maxSize: [2, 8], probability: 1.0 }
        ];

        this.gridSize = 6; // Smaller grid units for more detail
        this.mansionWidth = 12; // Manageable size for now
        this.mansionHeight = 10; // Manageable size for now
        this.grid = this.createGrid();

        // Multi-level support
        this.levels = [];
        this.currentLevel = 0;
        this.maxLevels = 2;

        // Collision mesh storage
        this.collisionMeshes = [];
        this.floorMeshes = [];
    }

    createMaterials() {
        const textureLoader = new THREE.TextureLoader();

        return {
            // Use MeshStandardMaterial for better lighting response
            wall: new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.8,
                metalness: 0.1
            }),
            floor: new THREE.MeshStandardMaterial({
                color: 0x654321,
                roughness: 0.9,
                metalness: 0.0
            }),
            ceiling: new THREE.MeshStandardMaterial({
                color: 0x2F2F2F,
                roughness: 0.8,
                metalness: 0.1
            }),
            door: new THREE.MeshStandardMaterial({
                color: 0x4A4A4A,
                roughness: 0.7,
                metalness: 0.2
            }),
            window: new THREE.MeshStandardMaterial({
                color: 0x1E90FF,
                transparent: true,
                opacity: 0.3,
                roughness: 0.1,
                metalness: 0.9
            }),
            furniture: new THREE.MeshStandardMaterial({
                color: 0x8B4513,
                roughness: 0.8,
                metalness: 0.1
            }),
            // Horror-themed materials
            bloodStain: new THREE.MeshStandardMaterial({
                color: 0x8B0000,
                roughness: 0.9,
                metalness: 0.0
            }),
            mold: new THREE.MeshStandardMaterial({
                color: 0x2F4F2F,
                roughness: 1.0,
                metalness: 0.0
            }),
            rust: new THREE.MeshStandardMaterial({
                color: 0xB87333,
                roughness: 0.9,
                metalness: 0.3
            })
        };
    }

    createGrid() {
        const grid = [];
        for (let x = 0; x < this.mansionWidth; x++) {
            grid[x] = [];
            for (let z = 0; z < this.mansionHeight; z++) {
                grid[x][z] = {
                    occupied: false,
                    roomId: null,
                    type: null,
                    connections: []
                };
            }
        }
        return grid;
    }

    generateMansion() {
        console.log("Generating procedural mansion...");
        
        // Step 1: Generate room layout
        this.generateRoomLayout();
        
        // Step 2: Connect rooms with hallways
        this.generateHallways();
        
        // Step 3: Build the physical structure
        this.buildStructure();
        
        // Step 4: Place furniture and decorations
        this.placeFurniture();
        
        // Step 5: Generate puzzles and horror elements
        this.generatePuzzles();
        
        // Step 6: Add atmospheric elements
        this.addAtmosphere();
        
        console.log(`Generated mansion with ${this.rooms.length} rooms`);
        return this.getAllObjects();
    }

    generateRoomLayout() {
        console.log("🏠 Generating realistic multi-level house layout...");

        // Generate multiple levels
        for (let level = 0; level < this.maxLevels; level++) {
            this.currentLevel = level;
            this.generateLevelLayout(level);
        }

        // Connect levels with stairs
        if (this.maxLevels > 1) {
            this.generateStairs();
        }

        console.log(`🏠 Generated ${this.rooms.length} rooms across ${this.maxLevels} levels`);
    }


    generateLevelLayout(level) {
        console.log(`🏗️ Generating level ${level}...`);

        // Create a level-specific grid
        const levelGrid = this.createGrid();
        const levelRooms = [];

        if (level === 0) {
            // Ground floor - main living areas
            this.generateGroundFloor(levelGrid, levelRooms, level);
        } else {
            // Upper floors - bedrooms and private areas
            this.generateUpperFloor(levelGrid, levelRooms, level);
        }

        // Store level data
        this.levels[level] = {
            grid: levelGrid,
            rooms: levelRooms,
            height: level * 4 // 4 units height per level
        };

        console.log(`📍 Level ${level}: Generated ${levelRooms.length} rooms`);
    }

    generateGroundFloor(grid, rooms, level) {
        console.log("🏠 Generating ground floor - public areas...");

        // Always start with an entrance
        const entranceX = Math.floor(this.mansionWidth / 2) - 1;
        const entranceZ = this.mansionHeight - 3;
        const entranceRoom = this.createLevelRoom(entranceX, entranceZ, 'entrance', 3, 2, level, grid);
        if (entranceRoom) rooms.push(entranceRoom);

        // Ground floor room types - public/social areas
        const groundFloorTypes = [
            { type: 'living_room', count: 1, priority: 0.95 },
            { type: 'kitchen', count: 1, priority: 0.9 },
            { type: 'dining_room', count: 1, priority: 0.7 },
            { type: 'bathroom', count: 1, priority: 0.6 }, // Half bath on ground floor
            { type: 'study', count: 1, priority: 0.4 }
        ];

        this.generateRoomsForLevel(grid, rooms, level, groundFloorTypes, 4, 8);
    }

    generateUpperFloor(grid, rooms, level) {
        console.log(`🛏️ Generating upper floor ${level} - private areas...`);

        // Upper floor room types - private/personal areas
        const upperFloorTypes = [
            { type: 'bedroom', count: 2 + level, priority: 0.9 }, // More bedrooms on higher floors
            { type: 'bathroom', count: 1, priority: 0.8 },
            { type: 'study', count: 1, priority: 0.5 },
            { type: 'storage', count: 1, priority: 0.3 }
        ];

        this.generateRoomsForLevel(grid, rooms, level, upperFloorTypes, 3, 6);
    }

    // Helper method to generate rooms for a specific level
    generateRoomsForLevel(grid, rooms, level, roomTypes, minRooms, maxRooms) {
        const targetRooms = Math.floor(Math.random() * (maxRooms - minRooms + 1)) + minRooms;
        let placedRooms = 0;
        let attempts = 0;

        // Try to place each required room type
        for (const roomType of roomTypes) {
            if (Math.random() > roomType.priority) continue;

            const roomsToPlace = roomType.count || 1;
            let placed = 0;

            while (placed < roomsToPlace && placedRooms < targetRooms && attempts < 100) {
                const room = this.tryPlaceRoomOnLevel(grid, roomType.type, level);
                if (room) {
                    rooms.push(room);
                    placedRooms++;
                    placed++;
                }
                attempts++;
            }
        }

        console.log(`📍 Level ${level}: Placed ${placedRooms} rooms (target: ${targetRooms})`);
    }

    // Try to place a room of a specific type on a level
    tryPlaceRoomOnLevel(grid, roomTypeName, level) {
        const roomType = this.roomTypes.find(r => r.type === roomTypeName);
        if (!roomType) return null;

        const maxAttempts = 50;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Generate varied dimensions
            const width = Math.floor(Math.random() * (roomType.maxSize[0] - roomType.minSize[0] + 1)) + roomType.minSize[0];
            const height = Math.floor(Math.random() * (roomType.maxSize[1] - roomType.minSize[1] + 1)) + roomType.minSize[1];

            // Random position
            const x = Math.floor(Math.random() * (this.mansionWidth - width));
            const z = Math.floor(Math.random() * (this.mansionHeight - height));

            const room = this.createLevelRoom(x, z, roomTypeName, width, height, level, grid);
            if (room) {
                return room;
            }
        }
        return null;
    }

    // Create a room on a specific level
    createLevelRoom(x, z, type, width, height, level, grid) {
        if (!this.canPlaceRoomOnLevel(grid, x, z, width, height)) {
            return null;
        }

        const roomId = this.rooms.length;
        const baseHeight = level * 4; // 4 meters per level

        const room = {
            id: roomId,
            x: x,
            z: z,
            width: width,
            height: height,
            type: type,
            level: level,
            baseHeight: baseHeight,
            center: {
                x: (x + width / 2) * this.gridSize,
                y: baseHeight,
                z: (z + height / 2) * this.gridSize
            },
            bounds: {
                minX: x * this.gridSize,
                maxX: (x + width) * this.gridSize,
                minZ: z * this.gridSize,
                maxZ: (z + height) * this.gridSize
            },
            connected: [],
            furniture: []
        };

        // Mark grid as occupied
        this.markGridArea(grid, x, z, width, height, roomId);

        // Add to main rooms array
        this.rooms.push(room);

        console.log(`🏠 Created ${type} room (${width}x${height}) at level ${level}, position (${x},${z})`);
        return room;
    }

    canPlaceRoomOnLevel(grid, x, z, width, height) {
        // Check bounds
        if (x < 0 || z < 0 || x + width > this.mansionWidth || z + height > this.mansionHeight) {
            return false;
        }

        // Check if area is free in the level grid
        for (let i = x; i < x + width; i++) {
            for (let j = z; j < z + height; j++) {
                if (!grid[i] || !grid[i][j] || grid[i][j].occupied) {
                    return false;
                }
            }
        }
        return true;
    }

    markGridArea(grid, x, z, width, height, roomId) {
        for (let i = x; i < x + width && i < this.mansionWidth; i++) {
            for (let j = z; j < z + height && j < this.mansionHeight; j++) {
                if (grid[i] && grid[i][j]) {
                    grid[i][j].occupied = true;
                    grid[i][j].roomId = roomId;
                }
            }
        }
    }

    // Helper methods for new room generation
    createRealisticRoom(x, z, type, width, height, level) {
        const room = {
            id: this.rooms.length + 1,
            x: x,
            z: z,
            width: width,
            height: height,
            level: level,
            type: type,
            center: {
                x: (x + width / 2) * this.gridSize,
                z: (z + height / 2) * this.gridSize
            },
            bounds: {
                minX: x * this.gridSize,
                maxX: (x + width) * this.gridSize,
                minZ: z * this.gridSize,
                maxZ: (z + height) * this.gridSize
            },
            connected: [],
            furniture: []
        };
        return room;
    }

    markGridArea(grid, x, z, width, height, roomId) {
        for (let i = x; i < x + width && i < this.mansionWidth; i++) {
            for (let j = z; j < z + height && j < this.mansionHeight; j++) {
                if (grid[i] && grid[i][j]) {
                    grid[i][j].occupied = true;
                    grid[i][j].roomId = roomId;
                }
            }
        }
    }

    generateConnectedRooms(grid, rooms, startRoom, roomTypes) {
        // Simplified room generation for now
        let placed = 0;
        const maxAttempts = 50;

        for (const roomDef of roomTypes) {
            if (Math.random() > roomDef.priority) continue;

            let attempts = 0;
            while (attempts < maxAttempts && placed < 5) {
                const roomType = this.roomTypes.find(r => r.type === roomDef.type);
                if (!roomType) continue;

                const width = Math.floor(Math.random() * (roomType.maxSize[0] - roomType.minSize[0] + 1)) + roomType.minSize[0];
                const height = Math.floor(Math.random() * (roomType.maxSize[1] - roomType.minSize[1] + 1)) + roomType.minSize[1];

                const x = Math.floor(Math.random() * (this.mansionWidth - width));
                const z = Math.floor(Math.random() * (this.mansionHeight - height));

                if (this.canPlaceRoom(grid, x, z, width, height)) {
                    const room = this.createRealisticRoom(x, z, roomDef.type, width, height, this.currentLevel);
                    this.markGridArea(grid, x, z, width, height, room.id);
                    rooms.push(room);
                    placed++;
                    break;
                }
                attempts++;
            }
        }
    }

    canPlaceRoom(grid, x, z, width, height) {
        // Check if area is free
        for (let i = x; i < x + width && i < this.mansionWidth; i++) {
            for (let j = z; j < z + height && j < this.mansionHeight; j++) {
                if (!grid[i] || !grid[i][j] || grid[i][j].occupied) {
                    return false;
                }
            }
        }
        return true;
    }

    generateHallwaysForLevel(grid, rooms, level) {
        // Simple hallway generation - connect rooms with basic corridors
        console.log(`🚪 Generating hallways for level ${level}...`);
    }

    generateStairs() {
        console.log("🪜 Generating stairs between levels...");

        // Find a good location for stairs on each level
        for (let level = 0; level < this.maxLevels - 1; level++) {
            this.createStaircase(level);
        }
    }

    createStaircase(fromLevel) {
        const toLevel = fromLevel + 1;
        console.log(`🪜 Creating staircase from level ${fromLevel} to ${toLevel}`);

        // Find a suitable location for stairs (avoid existing rooms)
        const stairWidth = 2;
        const stairHeight = 3;
        let stairX, stairZ;

        // Try to find a central location
        const attempts = 50;
        for (let attempt = 0; attempt < attempts; attempt++) {
            stairX = Math.floor(this.mansionWidth / 2) + Math.floor(Math.random() * 3) - 1;
            stairZ = Math.floor(this.mansionHeight / 2) + Math.floor(Math.random() * 3) - 1;

            // Check if this location works for both levels
            const canPlaceOnFromLevel = this.canPlaceStairs(stairX, stairZ, stairWidth, stairHeight, fromLevel);
            const canPlaceOnToLevel = this.canPlaceStairs(stairX, stairZ, stairWidth, stairHeight, toLevel);

            if (canPlaceOnFromLevel && canPlaceOnToLevel) {
                break;
            }
        }

        // Create stair rooms on both levels
        const bottomStair = this.createStairRoom(stairX, stairZ, stairWidth, stairHeight, fromLevel, 'stairs_up');
        const topStair = this.createStairRoom(stairX, stairZ, stairWidth, stairHeight, toLevel, 'stairs_down');

        if (bottomStair && topStair) {
            // Connect the stairs
            bottomStair.connectedStairs = topStair.id;
            topStair.connectedStairs = bottomStair.id;

            console.log(`🪜 Successfully created staircase at (${stairX}, ${stairZ})`);
        }
    }

    canPlaceStairs(x, z, width, height, level) {
        const levelData = this.levels[level];
        if (!levelData) return false;

        return this.canPlaceRoomOnLevel(levelData.grid, x, z, width, height);
    }

    createStairRoom(x, z, width, height, level, type) {
        const levelData = this.levels[level];
        if (!levelData) return null;

        const room = this.createLevelRoom(x, z, type, width, height, level, levelData.grid);
        if (room) {
            levelData.rooms.push(room);
            console.log(`🪜 Created ${type} at level ${level}`);
        }
        return room;
    }

    generateHallways() {
        // Simple hallway generation - connect adjacent rooms
        for (const room of this.rooms) {
            const neighbors = this.findAdjacentRooms(room);
            for (const neighbor of neighbors) {
                if (!this.areRoomsConnected(room.id, neighbor.id)) {
                    this.createConnection(room, neighbor);
                }
            }
        }
    }

    findAdjacentRooms(room) {
        const adjacent = [];
        const directions = [
            { dx: 0, dz: -1 }, // North
            { dx: 1, dz: 0 },  // East
            { dx: 0, dz: 1 },  // South
            { dx: -1, dz: 0 }  // West
        ];
        
        for (const dir of directions) {
            const checkX = room.x + (dir.dx < 0 ? -1 : room.width);
            const checkZ = room.z + (dir.dz < 0 ? -1 : room.height);
            
            if (checkX >= 0 && checkX < this.mansionWidth && 
                checkZ >= 0 && checkZ < this.mansionHeight) {
                const cell = this.grid[checkX][checkZ];
                if (cell.occupied && cell.roomId !== room.id) {
                    const neighborRoom = this.rooms[cell.roomId];
                    if (neighborRoom && !adjacent.includes(neighborRoom)) {
                        adjacent.push(neighborRoom);
                    }
                }
            }
        }
        
        return adjacent;
    }

    areRoomsConnected(roomId1, roomId2) {
        return this.doors.some(door => 
            (door.room1 === roomId1 && door.room2 === roomId2) ||
            (door.room1 === roomId2 && door.room2 === roomId1)
        );
    }

    createConnection(room1, room2) {
        // Find connection point between rooms
        const door = {
            room1: room1.id,
            room2: room2.id,
            position: this.findConnectionPoint(room1, room2),
            locked: Math.random() < 0.3, // 30% chance of locked door
            key: null
        };
        
        if (door.locked) {
            door.key = `key_${door.room1}_${door.room2}`;
        }
        
        this.doors.push(door);
    }

    findConnectionPoint(room1, room2) {
        // Simplified connection point calculation
        const midX = (room1.center.x + room2.center.x) / 2;
        const midZ = (room1.center.z + room2.center.z) / 2;
        return new THREE.Vector3(midX, 0, midZ);
    }

    buildStructure() {
        // Build walls, floors, and ceilings for each room
        for (const room of this.rooms) {
            this.buildRoom(room);
        }
        
        // Build doors
        for (const door of this.doors) {
            this.buildDoor(door);
        }
    }

    buildRoom(room) {
        const roomGroup = new THREE.Group();
        roomGroup.name = `room_${room.id}_${room.type}_level_${room.level || 0}`;

        const startX = room.x * this.gridSize;
        const startZ = room.z * this.gridSize;
        const width = room.width * this.gridSize;
        const height = room.height * this.gridSize;
        const wallHeight = 4;

        // Get the floor height for this room's level
        const floorY = room.baseHeight || 0;
        
        // Floor - using BoxGeometry for better lighting
        const floorGeometry = new THREE.BoxGeometry(width, 0.1, height);
        const floor = new THREE.Mesh(floorGeometry, this.materials.floor);
        floor.position.set(startX + width/2, floorY + 0.05, startZ + height/2);
        floor.name = `floor_room_${room.id}_level_${room.level || 0}`;
        floor.receiveShadow = true; // Floor receives shadows
        roomGroup.add(floor);

        // Add floor to physics system
        if (this.physicsManager) {
            const floorBody = this.physicsManager.createBoxBody(
                new THREE.Vector3(startX + width/2, floorY - 0.5, startZ + height/2),
                new THREE.Vector3(width, 1, height)
            );
            this.physicsManager.addBody(floorBody);
            this.floorMeshes.push(floor);
        }

        // Ceiling - using BoxGeometry for better lighting
        const ceilingGeometry = new THREE.BoxGeometry(width, 0.1, height);
        const ceiling = new THREE.Mesh(ceilingGeometry, this.materials.ceiling);
        ceiling.position.set(startX + width/2, floorY + wallHeight - 0.05, startZ + height/2);
        ceiling.name = `ceiling_room_${room.id}_level_${room.level || 0}`;
        roomGroup.add(ceiling);

        // Walls
        this.buildWalls(roomGroup, startX, startZ, width, height, wallHeight, room.id, floorY);

        this.scene.add(roomGroup);
        room.meshGroup = roomGroup;
    }

    buildWalls(group, startX, startZ, width, height, wallHeight, roomId, floorY = 0) {
        const wallThickness = 0.2;

        // North wall
        const northWall = new THREE.Mesh(
            new THREE.BoxGeometry(width, wallHeight, wallThickness),
            this.materials.wall
        );
        northWall.position.set(startX + width/2, floorY + wallHeight/2, startZ);
        northWall.name = `wall_north_room_${roomId}`;
        northWall.receiveShadow = true;
        northWall.castShadow = true;
        group.add(northWall);

        // Add to physics system
        if (this.physicsManager) {
            const wallBody = this.physicsManager.createBoxBody(
                new THREE.Vector3(startX + width/2, floorY + wallHeight/2, startZ),
                new THREE.Vector3(width, wallHeight, wallThickness)
            );
            this.physicsManager.addBody(wallBody);
            this.collisionMeshes.push(northWall);
        }

        // South wall
        const southWall = new THREE.Mesh(
            new THREE.BoxGeometry(width, wallHeight, wallThickness),
            this.materials.wall
        );
        southWall.position.set(startX + width/2, floorY + wallHeight/2, startZ + height);
        southWall.name = `wall_south_room_${roomId}`;
        southWall.receiveShadow = true;
        southWall.castShadow = true;
        group.add(southWall);

        if (this.physicsManager) {
            const wallBody = this.physicsManager.createBoxBody(
                new THREE.Vector3(startX + width/2, floorY + wallHeight/2, startZ + height),
                new THREE.Vector3(width, wallHeight, wallThickness)
            );
            this.physicsManager.addBody(wallBody);
            this.collisionMeshes.push(southWall);
        }

        // East wall
        const eastWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness, wallHeight, height),
            this.materials.wall
        );
        eastWall.position.set(startX + width, floorY + wallHeight/2, startZ + height/2);
        eastWall.name = `wall_east_room_${roomId}`;
        eastWall.receiveShadow = true;
        eastWall.castShadow = true;
        group.add(eastWall);

        if (this.physicsManager) {
            const wallBody = this.physicsManager.createBoxBody(
                new THREE.Vector3(startX + width, floorY + wallHeight/2, startZ + height/2),
                new THREE.Vector3(wallThickness, wallHeight, height)
            );
            this.physicsManager.addBody(wallBody);
            this.collisionMeshes.push(eastWall);
        }

        // West wall
        const westWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness, wallHeight, height),
            this.materials.wall
        );
        westWall.position.set(startX, floorY + wallHeight/2, startZ + height/2);
        westWall.name = `wall_west_room_${roomId}`;
        westWall.receiveShadow = true;
        westWall.castShadow = true;
        group.add(westWall);

        if (this.physicsManager) {
            const wallBody = this.physicsManager.createBoxBody(
                new THREE.Vector3(startX, floorY + wallHeight/2, startZ + height/2),
                new THREE.Vector3(wallThickness, wallHeight, height)
            );
            this.physicsManager.addBody(wallBody);
            this.collisionMeshes.push(westWall);
        }
    }

    buildDoor(door) {
        const doorGroup = new THREE.Group();
        doorGroup.name = `door_${door.room1}_${door.room2}`;
        
        const doorGeometry = new THREE.BoxGeometry(1, 3, 0.1);
        const doorMesh = new THREE.Mesh(doorGeometry, this.materials.door);
        doorMesh.position.copy(door.position);
        doorMesh.position.y = 1.5;
        
        if (door.locked) {
            // Add a lock visual indicator
            const lockGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const lockMesh = new THREE.Mesh(lockGeometry, this.materials.rust);
            lockMesh.position.set(0.3, 0, 0.1);
            doorMesh.add(lockMesh);
        }
        
        doorGroup.add(doorMesh);
        this.scene.add(doorGroup);

        door.mesh = doorGroup;

        // Add door to collision system (doors can be walked through but detected for interaction)
        if (this.collisionSystem) {
            // Create invisible collision box for door interaction
            const doorInteractionBox = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 3, 0.5),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            doorInteractionBox.position.copy(door.position);
            doorInteractionBox.position.y = 1.5;
            doorInteractionBox.userData = {
                type: 'door',
                doorData: door,
                interactable: true
            };

            this.scene.add(doorInteractionBox);
            this.collisionMeshes.push(doorInteractionBox);
        }
    }

    placeFurniture() {
        for (const room of this.rooms) {
            this.addRoomFurniture(room);
        }
    }

    addRoomFurniture(room) {
        const furnitureTypes = this.getFurnitureForRoom(room.type);
        const numItems = Math.floor(Math.random() * 4) + 1;
        
        for (let i = 0; i < numItems; i++) {
            const furnitureType = furnitureTypes[Math.floor(Math.random() * furnitureTypes.length)];
            const furniture = this.createFurniture(furnitureType, room);
            if (furniture) {
                room.meshGroup.add(furniture);
                room.furniture.push(furniture);
            }
        }
    }

    getFurnitureForRoom(roomType) {
        const furnitureMap = {
            bedroom: ['bed', 'dresser', 'nightstand', 'mirror'],
            kitchen: ['table', 'chair', 'cabinet', 'sink'],
            library: ['bookshelf', 'chair', 'table', 'lamp'],
            study: ['desk', 'chair', 'bookshelf', 'lamp'],
            bathroom: ['sink', 'mirror', 'cabinet'],
            storage: ['box', 'shelf', 'barrel'],
            attic: ['box', 'chest', 'cobweb'],
            entrance: ['table', 'mirror', 'coat_rack']
        };
        return furnitureMap[roomType] || ['table', 'chair'];
    }

    createFurniture(type, room) {
        const furnitureGroup = new THREE.Group();
        furnitureGroup.name = `furniture_${type}`;
        
        // Position furniture randomly within room bounds
        const roomStartX = room.x * this.gridSize;
        const roomStartZ = room.z * this.gridSize;
        const roomWidth = room.width * this.gridSize;
        const roomHeight = room.height * this.gridSize;
        
        const x = roomStartX + Math.random() * (roomWidth - 2) + 1;
        const z = roomStartZ + Math.random() * (roomHeight - 2) + 1;
        
        let mesh;
        
        switch(type) {
            case 'bed':
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(2, 0.5, 3),
                    this.materials.furniture
                );
                mesh.position.set(x, 0.25, z);
                break;
                
            case 'table':
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(1.5, 0.1, 1),
                    this.materials.furniture
                );
                mesh.position.set(x, 0.8, z);
                
                // Add table legs
                for (let i = 0; i < 4; i++) {
                    const leg = new THREE.Mesh(
                        new THREE.BoxGeometry(0.1, 0.8, 0.1),
                        this.materials.furniture
                    );
                    const legX = i % 2 === 0 ? -0.65 : 0.65;
                    const legZ = i < 2 ? -0.4 : 0.4;
                    leg.position.set(legX, -0.45, legZ);
                    mesh.add(leg);
                }
                break;
                
            case 'chair':
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(0.5, 0.1, 0.5),
                    this.materials.furniture
                );
                mesh.position.set(x, 0.45, z);
                
                // Chair back
                const back = new THREE.Mesh(
                    new THREE.BoxGeometry(0.5, 1, 0.1),
                    this.materials.furniture
                );
                back.position.set(0, 0.5, -0.2);
                mesh.add(back);
                break;
                
            case 'bookshelf':
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 2, 0.3),
                    this.materials.furniture
                );
                mesh.position.set(x, 1, z);
                
                // Add some books
                for (let i = 0; i < 5; i++) {
                    const book = new THREE.Mesh(
                        new THREE.BoxGeometry(0.1, 0.3, 0.2),
                        new THREE.MeshLambertMaterial({ 
                            color: Math.random() * 0xffffff 
                        })
                    );
                    book.position.set(
                        -0.4 + (i * 0.2),
                        -0.5 + Math.random() * 0.3,
                        0.05
                    );
                    mesh.add(book);
                }
                break;
                
            case 'box':
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(0.8, 0.8, 0.8),
                    this.materials.furniture
                );
                mesh.position.set(x, 0.4, z);
                break;
                
            default:
                mesh = new THREE.Mesh(
                    new THREE.BoxGeometry(1, 1, 1),
                    this.materials.furniture
                );
                mesh.position.set(x, 0.5, z);
        }
        
        furnitureGroup.add(mesh);

        // Add furniture to collision system
        if (this.collisionSystem) {
            // Create collision box based on furniture type
            let collisionBox;
            switch(type) {
                case 'bed':
                    collisionBox = new THREE.Mesh(
                        new THREE.BoxGeometry(2, 0.8, 3),
                        new THREE.MeshBasicMaterial({ visible: false })
                    );
                    break;
                case 'table':
                    collisionBox = new THREE.Mesh(
                        new THREE.BoxGeometry(1.5, 0.8, 1),
                        new THREE.MeshBasicMaterial({ visible: false })
                    );
                    break;
                case 'chair':
                    collisionBox = new THREE.Mesh(
                        new THREE.BoxGeometry(0.5, 1.0, 0.5),
                        new THREE.MeshBasicMaterial({ visible: false })
                    );
                    break;
                case 'bookshelf':
                    collisionBox = new THREE.Mesh(
                        new THREE.BoxGeometry(1, 2, 0.3),
                        new THREE.MeshBasicMaterial({ visible: false })
                    );
                    break;
                default:
                    collisionBox = new THREE.Mesh(
                        new THREE.BoxGeometry(1, 1, 1),
                        new THREE.MeshBasicMaterial({ visible: false })
                    );
            }

            collisionBox.position.copy(mesh.position);
            collisionBox.userData = {
                type: 'furniture',
                furnitureType: type,
                interactable: true
            };

            room.meshGroup.add(collisionBox);

            if (this.physicsManager) {
                const furnitureBody = this.physicsManager.createBoxBody(
                    mesh.position.clone(),
                    new THREE.Vector3(width, height, depth)
                );
                this.physicsManager.addBody(furnitureBody);
            }
            this.collisionMeshes.push(collisionBox);
        }

        return furnitureGroup;
    }

    generatePuzzles() {
        // Select random rooms for puzzles
        const puzzleRoomCount = Math.floor(this.rooms.length * 0.3); // 30% of rooms have puzzles
        const shuffledRooms = [...this.rooms].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < puzzleRoomCount; i++) {
            const room = shuffledRooms[i];
            const puzzleType = this.choosePuzzleType(room.type);
            const puzzle = this.createPuzzle(puzzleType, room);
            room.puzzles.push(puzzle);
            this.puzzleRooms.push(room);
        }
    }

    choosePuzzleType(roomType) {
        const puzzleMap = {
            library: ['book_sequence', 'hidden_message'],
            study: ['combination_lock', 'riddle'],
            bedroom: ['hidden_key', 'mirror_puzzle'],
            kitchen: ['recipe_puzzle', 'ingredient_hunt'],
            storage: ['box_puzzle', 'weight_puzzle'],
            attic: ['ghost_puzzle', 'memory_game']
        };
        
        const puzzles = puzzleMap[roomType] || ['simple_key', 'switch_puzzle'];
        return puzzles[Math.floor(Math.random() * puzzles.length)];
    }

    createPuzzle(type, room) {
        const puzzle = {
            type: type,
            room: room.id,
            solved: false,
            hint: this.getPuzzleHint(type),
            solution: this.generateSolution(type)
        };
        
        // Add visual puzzle elements to the room
        this.addPuzzleVisuals(puzzle, room);
        
        return puzzle;
    }

    getPuzzleHint(type) {
        const hints = {
            book_sequence: "The books tell a story when read in order...",
            hidden_message: "Look closely at the writing on the wall...",
            combination_lock: "The numbers are hidden around the room...",
            riddle: "Answer the ancient riddle to proceed...",
            hidden_key: "Something valuable is hidden where you rest...",
            mirror_puzzle: "Your reflection holds the answer...",
            recipe_puzzle: "Mix the ingredients in the right order...",
            ingredient_hunt: "Gather what's needed from around the kitchen...",
            box_puzzle: "Open the boxes in the correct sequence...",
            weight_puzzle: "Balance is key to unlocking the truth...",
            ghost_puzzle: "The spirits will guide you if you listen...",
            memory_game: "Remember the pattern shown by the lights..."
        };
        return hints[type] || "Solve the mystery to continue...";
    }

    generateSolution(type) {
        // Generate random solutions based on puzzle type
        switch(type) {
            case 'combination_lock':
                return Array.from({length: 3}, () => Math.floor(Math.random() * 10)).join('');
            case 'book_sequence':
                return ['red', 'blue', 'green', 'yellow'].sort(() => Math.random() - 0.5);
            case 'riddle':
                return ['darkness', 'echo', 'shadow', 'time'][Math.floor(Math.random() * 4)];
            default:
                return 'solved';
        }
    }

    addPuzzleVisuals(puzzle, room) {
        const puzzleGroup = new THREE.Group();
        puzzleGroup.name = `puzzle_${puzzle.type}`;
        
        // Add visual elements based on puzzle type
        switch(puzzle.type) {
            case 'combination_lock':
                const lock = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.2, 0.2, 0.1),
                    this.materials.rust
                );
                lock.position.set(0, 1, 0);
                puzzleGroup.add(lock);
                break;
                
            case 'hidden_message':
                const message = new THREE.Mesh(
                    new THREE.PlaneGeometry(1, 0.5),
                    new THREE.MeshLambertMaterial({ 
                        color: 0x8B4513,
                        transparent: true,
                        opacity: 0.7
                    })
                );
                message.position.set(0, 2, -2);
                puzzleGroup.add(message);
                break;
        }
        
        if (puzzleGroup.children.length > 0) {
            room.meshGroup.add(puzzleGroup);
        }
    }

    addAtmosphere() {
        for (const room of this.rooms) {
            this.addRoomAtmosphere(room);
        }
        
        // Add global atmospheric elements
        this.addGlobalAtmosphere();
    }

    addRoomAtmosphere(room) {
        const atmosphereChance = Math.random();
        
        if (atmosphereChance < 0.3) {
            this.addBloodStain(room);
        }
        
        if (atmosphereChance < 0.4) {
            this.addCobwebs(room);
        }
        
        if (atmosphereChance < 0.2) {
            this.addFlickeringLight(room);
        }
    }

    addBloodStain(room) {
        const stain = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            this.materials.bloodStain
        );
        stain.rotation.x = -Math.PI / 2;
        stain.position.set(
            Math.random() * room.width * this.gridSize,
            0.01,
            Math.random() * room.height * this.gridSize
        );
        room.meshGroup.add(stain);
    }

    addCobwebs(room) {
        const cobweb = new THREE.Mesh(
            new THREE.PlaneGeometry(0.5, 0.5),
            new THREE.MeshLambertMaterial({ 
                color: 0x888888,
                transparent: true,
                opacity: 0.6
            })
        );
        cobweb.position.set(0, 3.5, 0);
        room.meshGroup.add(cobweb);
    }

    addFlickeringLight(room) {
        const light = new THREE.PointLight(0xffffff, 0.5, 10);
        light.position.set(
            room.center.x,
            3,
            room.center.z
        );
        
        // Add flickering animation
        light.userData = { 
            flicker: true,
            intensity: 0.5,
            flickerSpeed: Math.random() * 2 + 1
        };
        
        room.meshGroup.add(light);
        room.atmosphere.push(light);
    }

    addGlobalAtmosphere() {
        // Add fog for atmospheric effect
        this.scene.fog = new THREE.FogExp2(0x000000, 0.01);
        
        // Add ambient horror sounds (would need audio system)
        // this.addAmbientSounds();
    }

    getAllObjects() {
        const objects = [];
        
        // Collect all room meshes
        for (const room of this.rooms) {
            if (room.meshGroup) {
                objects.push(room.meshGroup);
            }
        }
        
        // Collect all door meshes
        for (const door of this.doors) {
            if (door.mesh) {
                objects.push(door.mesh);
            }
        }
        
        return objects;
    }

    // Animation methods for dynamic elements
    tick(delta) {
        // Animate flickering lights
        for (const room of this.rooms) {
            for (const atmosphereItem of room.atmosphere) {
                if (atmosphereItem.userData && atmosphereItem.userData.flicker) {
                    const time = Date.now() * 0.001 * atmosphereItem.userData.flickerSpeed;
                    atmosphereItem.intensity = atmosphereItem.userData.intensity * 
                        (0.5 + 0.5 * Math.sin(time) * Math.random());
                }
            }
        }
    }

    // Utility methods for game logic
    getRoomAt(position) {
        const gridX = Math.floor(position.x / this.gridSize);
        const gridZ = Math.floor(position.z / this.gridSize);
        
        if (gridX >= 0 && gridX < this.mansionWidth && 
            gridZ >= 0 && gridZ < this.mansionHeight) {
            const cell = this.grid[gridX][gridZ];
            return cell.occupied ? this.rooms[cell.roomId] : null;
        }
        return null;
    }

    getDoorsInRoom(roomId) {
        return this.doors.filter(door => 
            door.room1 === roomId || door.room2 === roomId
        );
    }

    unlockDoor(doorId, keyId) {
        const door = this.doors[doorId];
        if (door && door.locked && door.key === keyId) {
            door.locked = false;
            // Update visual representation
            if (door.mesh) {
                const lock = door.mesh.getObjectByName('lock');
                if (lock) {
                    door.mesh.remove(lock);
                }
            }
            return true;
        }
        return false;
    }

    isPuzzleSolved(roomId, puzzleType) {
        const room = this.rooms[roomId];
        if (room) {
            const puzzle = room.puzzles.find(p => p.type === puzzleType);
            return puzzle ? puzzle.solved : false;
        }
        return false;
    }

    solvePuzzle(roomId, puzzleType, solution) {
        const room = this.rooms[roomId];
        if (room) {
            const puzzle = room.puzzles.find(p => p.type === puzzleType);
            if (puzzle && !puzzle.solved) {
                if (this.validateSolution(puzzle, solution)) {
                    puzzle.solved = true;
                    this.onPuzzleSolved(puzzle, room);
                    return true;
                }
            }
        }
        return false;
    }

    validateSolution(puzzle, solution) {
        switch(puzzle.type) {
            case 'combination_lock':
                return solution === puzzle.solution;
            case 'book_sequence':
                return JSON.stringify(solution) === JSON.stringify(puzzle.solution);
            case 'riddle':
                return solution.toLowerCase() === puzzle.solution.toLowerCase();
            default:
                return solution === puzzle.solution;
        }
    }

    onPuzzleSolved(puzzle, room) {
        console.log(`Puzzle ${puzzle.type} solved in room ${room.id}!`);
        
        // Trigger effects based on puzzle type
        switch(puzzle.type) {
            case 'combination_lock':
                // Unlock a door or reveal a hidden passage
                this.revealHiddenDoor(room);
                break;
            case 'hidden_message':
                // Provide a clue or key
                this.spawnKey(room);
                break;
        }
    }

    revealHiddenDoor(room) {
        // Add a new door or passage
        console.log(`Hidden door revealed in room ${room.id}`);
    }

    spawnKey(room) {
        // Spawn a key item in the room
        const key = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.3),
            new THREE.MeshLambertMaterial({ color: 0xFFD700 })
        );
        key.position.set(
            room.center.x + Math.random() * 2 - 1,
            1,
            room.center.z + Math.random() * 2 - 1
        );
        key.userData = { type: 'key', keyId: `key_${room.id}`, interactable: true };
        room.meshGroup.add(key);
    }

    // Collision system integration methods
    setCollisionSystem(collisionSystem) {
        this.collisionSystem = collisionSystem;

        // Physics bodies are already added when meshes are created
        // No need to add existing meshes again
    }

    removeFromCollisionSystem() {
        if (this.collisionSystem) {
            for (const mesh of this.collisionMeshes) {
                this.collisionSystem.removeCollisionObject(mesh);
            }
            for (const mesh of this.floorMeshes) {
                this.collisionSystem.removeCollisionObject(mesh);
            }
        }
    }

    getCollisionMeshes() {
        return {
            walls: this.collisionMeshes,
            floors: this.floorMeshes
        };
    }

    // Performance optimization for collision system
    buildCollisionSpatialHash() {
        if (this.collisionSystem && this.collisionSystem.buildSpatialHash) {
            this.collisionSystem.buildSpatialHash(this.gridSize);
        }
    }

    // Debug collision visualization
    toggleCollisionDebug(enabled = true) {
        for (const mesh of this.collisionMeshes) {
            mesh.material.visible = enabled;
            mesh.material.wireframe = enabled;
            mesh.material.color.setHex(enabled ? 0xff0000 : 0x000000);
        }

        for (const mesh of this.floorMeshes) {
            // Add wireframe overlay for floor debugging
            if (enabled && !mesh.userData.debugWireframe) {
                const wireframe = new THREE.WireframeGeometry(mesh.geometry);
                const line = new THREE.LineSegments(wireframe, new THREE.LineBasicMaterial({ color: 0x00ff00 }));
                line.position.copy(mesh.position);
                line.rotation.copy(mesh.rotation);
                mesh.parent.add(line);
                mesh.userData.debugWireframe = line;
            } else if (!enabled && mesh.userData.debugWireframe) {
                mesh.parent.remove(mesh.userData.debugWireframe);
                delete mesh.userData.debugWireframe;
            }
        }
    }

    // Cleanup
    dispose() {
        // Remove from collision system
        this.removeFromCollisionSystem();

        // Clear arrays
        this.collisionMeshes = [];
        this.floorMeshes = [];
        this.rooms = [];
        this.doors = [];
        this.hallways = [];
        this.puzzleRooms = [];

        // Clear grid
        this.grid = null;
    }
}

export { ProceduralMansion };