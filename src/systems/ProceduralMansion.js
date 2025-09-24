// src/systems/ProceduralMansion.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class ProceduralMansion {
    constructor(scene, collisionSystem = null) {
        this.scene = scene;
        this.collisionSystem = collisionSystem;
        this.rooms = [];
        this.hallways = [];
        this.doors = [];
        this.puzzleRooms = [];
        this.materials = this.createMaterials();
        this.roomTypes = ['bedroom', 'kitchen', 'library', 'study', 'bathroom', 'storage', 'attic'];
        this.gridSize = 10; // Size of each room unit
        this.mansionWidth = 8; // Grid units
        this.mansionHeight = 6; // Grid units
        this.grid = this.createGrid();

        // Collision mesh storage
        this.collisionMeshes = [];
        this.floorMeshes = [];
    }

    createMaterials() {
        const textureLoader = new THREE.TextureLoader();
        
        return {
            wall: new THREE.MeshLambertMaterial({ color: 0x8B4513 }), // Dark brown
            floor: new THREE.MeshLambertMaterial({ color: 0x654321 }), // Darker brown
            ceiling: new THREE.MeshLambertMaterial({ color: 0x2F2F2F }), // Dark gray
            door: new THREE.MeshLambertMaterial({ color: 0x4A4A4A }), // Gray
            window: new THREE.MeshLambertMaterial({ 
                color: 0x1E90FF, 
                transparent: true, 
                opacity: 0.3 
            }),
            furniture: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
            // Horror-themed materials
            bloodStain: new THREE.MeshLambertMaterial({ color: 0x8B0000 }), // Dark red
            mold: new THREE.MeshLambertMaterial({ color: 0x2F4F2F }), // Dark green
            rust: new THREE.MeshLambertMaterial({ color: 0xB87333 }) // Rusty brown
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
        const minRooms = 8;
        const maxRooms = 15;
        const targetRooms = Math.floor(Math.random() * (maxRooms - minRooms + 1)) + minRooms;
        
        // Always start with an entrance hall
        const entranceX = Math.floor(this.mansionWidth / 2) - 1;
        const entranceZ = this.mansionHeight - 2;
        const entranceRoom = this.createRoom(
            entranceX,
            entranceZ,
            'entrance',
            2, 2
        );
        
        let attempts = 0;
        while (this.rooms.length < targetRooms && attempts < 100) {
            const x = Math.floor(Math.random() * (this.mansionWidth - 2));
            const z = Math.floor(Math.random() * (this.mansionHeight - 2));
            const width = Math.random() > 0.7 ? 2 : 1;
            const height = Math.random() > 0.7 ? 2 : 1;
            const roomType = this.roomTypes[Math.floor(Math.random() * this.roomTypes.length)];
            
            if (this.canPlaceRoom(x, z, width, height)) {
                this.createRoom(x, z, roomType, width, height);
            }
            attempts++;
        }
    }

    canPlaceRoom(x, z, width, height) {
        if (x < 0 || z < 0 || x + width > this.mansionWidth || z + height > this.mansionHeight) {
            return false;
        }

        for (let i = x; i < x + width; i++) {
            for (let j = z; j < z + height; j++) {
                if (this.grid[i][j].occupied) {
                    return false;
                }
            }
        }
        return true;
    }

    createRoom(x, z, type, width, height) {
        // Validate bounds before creating room
        if (!this.canPlaceRoom(x, z, width, height)) {
            console.warn(`Cannot place room at (${x}, ${z}) with size ${width}x${height} - out of bounds or occupied`);
            return null;
        }

        const roomId = this.rooms.length;
        const room = {
            id: roomId,
            x: x,
            z: z,
            width: width,
            height: height,
            type: type,
            center: new THREE.Vector3(
                (x + width / 2) * this.gridSize,
                0,
                (z + height / 2) * this.gridSize
            ),
            furniture: [],
            puzzles: [],
            atmosphere: []
        };

        // Mark grid cells as occupied
        for (let i = x; i < x + width; i++) {
            for (let j = z; j < z + height; j++) {
                this.grid[i][j].occupied = true;
                this.grid[i][j].roomId = roomId;
                this.grid[i][j].type = type;
            }
        }

        this.rooms.push(room);
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
        roomGroup.name = `room_${room.id}_${room.type}`;
        
        const startX = room.x * this.gridSize;
        const startZ = room.z * this.gridSize;
        const width = room.width * this.gridSize;
        const height = room.height * this.gridSize;
        const wallHeight = 4;
        
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(width, height);
        const floor = new THREE.Mesh(floorGeometry, this.materials.floor);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(startX + width/2, 0, startZ + height/2);
        floor.name = `floor_room_${room.id}`;
        roomGroup.add(floor);

        // Add floor to collision system
        if (this.collisionSystem) {
            this.collisionSystem.addCollisionObject(floor, 'floor');
            this.floorMeshes.push(floor);
        }

        // Ceiling
        const ceiling = new THREE.Mesh(floorGeometry, this.materials.ceiling);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.set(startX + width/2, wallHeight, startZ + height/2);
        ceiling.name = `ceiling_room_${room.id}`;
        roomGroup.add(ceiling);

        // Walls
        this.buildWalls(roomGroup, startX, startZ, width, height, wallHeight, room.id);

        this.scene.add(roomGroup);
        room.meshGroup = roomGroup;
    }

    buildWalls(group, startX, startZ, width, height, wallHeight, roomId) {
        const wallThickness = 0.2;

        // North wall
        const northWall = new THREE.Mesh(
            new THREE.BoxGeometry(width, wallHeight, wallThickness),
            this.materials.wall
        );
        northWall.position.set(startX + width/2, wallHeight/2, startZ);
        northWall.name = `wall_north_room_${roomId}`;
        group.add(northWall);

        // Add to collision system
        if (this.collisionSystem) {
            this.collisionSystem.addCollisionObject(northWall, 'wall');
            this.collisionMeshes.push(northWall);
        }

        // South wall
        const southWall = new THREE.Mesh(
            new THREE.BoxGeometry(width, wallHeight, wallThickness),
            this.materials.wall
        );
        southWall.position.set(startX + width/2, wallHeight/2, startZ + height);
        southWall.name = `wall_south_room_${roomId}`;
        group.add(southWall);

        if (this.collisionSystem) {
            this.collisionSystem.addCollisionObject(southWall, 'wall');
            this.collisionMeshes.push(southWall);
        }

        // East wall
        const eastWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness, wallHeight, height),
            this.materials.wall
        );
        eastWall.position.set(startX + width, wallHeight/2, startZ + height/2);
        eastWall.name = `wall_east_room_${roomId}`;
        group.add(eastWall);

        if (this.collisionSystem) {
            this.collisionSystem.addCollisionObject(eastWall, 'wall');
            this.collisionMeshes.push(eastWall);
        }

        // West wall
        const westWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness, wallHeight, height),
            this.materials.wall
        );
        westWall.position.set(startX, wallHeight/2, startZ + height/2);
        westWall.name = `wall_west_room_${roomId}`;
        group.add(westWall);

        if (this.collisionSystem) {
            this.collisionSystem.addCollisionObject(westWall, 'wall');
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
            this.collisionSystem.addCollisionObject(collisionBox, 'wall');
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

        // Add existing meshes to collision system
        for (const mesh of this.collisionMeshes) {
            this.collisionSystem.addCollisionObject(mesh, 'wall');
        }
        for (const mesh of this.floorMeshes) {
            this.collisionSystem.addCollisionObject(mesh, 'floor');
        }
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