// src/systems/PuzzleSystem.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class PuzzleSystem {
    constructor(scene, gameManager) {
        this.scene = scene;
        this.gameManager = gameManager;
        this.activePuzzles = new Map();
        this.puzzleTemplates = this.createPuzzleTemplates();
    }

    // Register an instance o the puzzle system to be loaded
    registerPuzzle(puzzleId, puzzleInstance) {
        if (!puzzleId || !puzzleInstance) {
            console.error("Failed to register puzzle: ID or instance is missing.");
            return;
        }
        this.activePuzzles.set(puzzleId, puzzleInstance);
        console.log(`🧩 Puzzle registered: ${puzzleId}`);
    }

    createPuzzleTemplates() {
        return {
            combination_safe: {
                name: "Combination Safe",
                description: "A locked safe with a 4-digit combination",
                difficulty: 3,
                hints: [
                    "The combination is written somewhere in this room",
                    "Look for numbers that stand out",
                    "The year the mansion was built might be important"
                ],
                solution: () => String(1847 + Math.floor(Math.random() * 100)),
                create: (room) => this.createCombinationSafe(room)
            },
            
            book_cipher: {
                name: "Book Cipher",
                description: "Books must be arranged in the correct order",
                difficulty: 2,
                hints: [
                    "The books tell a chronological story",
                    "Look at the dates on the book spines",
                    "Arrange from oldest to newest"
                ],
                solution: () => ['red', 'blue', 'green', 'yellow'],
                create: (room) => this.createBookCipher(room)
            },
            
            mirror_sequence: {
                name: "Mirror Reflection Puzzle",
                description: "Mirrors must be aligned to reflect light correctly",
                difficulty: 4,
                hints: [
                    "Light must reach the final mirror",
                    "Each mirror can be rotated",
                    "The path of light creates a pattern"
                ],
                solution: () => [0, 45, 90, 135], // Rotation angles
                create: (room) => this.createMirrorPuzzle(room)
            },

            pressure_plate: {
                name: "Weight Puzzle",
                description: "Objects must be placed on pressure plates in correct order",
                difficulty: 2,
                hints: [
                    "The weights must be balanced",
                    "Heavier objects go on specific plates",
                    "The pattern matches something else in the room"
                ],
                solution: () => ['heavy', 'medium', 'light', 'medium'],
                create: (room) => this.createPressurePlatePuzzle(room)
            },

            clock_puzzle: {
                name: "Ancient Clock",
                description: "Set the clock to the correct time",
                difficulty: 3,
                hints: [
                    "The time is written in Roman numerals somewhere",
                    "When did the mansion's tragedy occur?",
                    "Look for historical records in other rooms"
                ],
                solution: () => "11:47", // 11:47 PM - time of the mansion's tragedy
                create: (room) => this.createClockPuzzle(room)
            },

            symbol_matching: {
                name: "Occult Symbol Puzzle",
                description: "Match symbols to their corresponding meanings",
                difficulty: 4,
                hints: [
                    "Each symbol has a specific meaning",
                    "The symbols form a protective ward",
                    "The order matters for the ritual"
                ],
                solution: () => ['protection', 'banishment', 'sealing', 'peace'],
                create: (room) => this.createSymbolPuzzle(room)
            },
            safe_and_key: {
                name: "Master Bedroom Safe",
                description: "A safe that requires a key and a password.",
                difficulty: 3,
                hints: [
                    "The key is hidden near a source of warmth.",
                    "The password is a time.",
                    "Look at the grandfather clock."
                ],
                solution: () => "1035", // Example time
                create: (room) => this.createSafeAndKeyPuzzle(room)
            },
            createSafeAndKeyPuzzle(room) {
                // You can add logic here to procedurally generate the safe and keys
                // if they don't already exist in your Blender model.
                // For now, since they are in your model, this function can be left empty.
            }

        };
    }

    createCombinationSafe(room) {
        const safeGroup = new THREE.Group();
        safeGroup.name = "combination_safe";
        
        // Main safe body
        const safeBody = new THREE.Mesh(
            new THREE.BoxGeometry(1.5, 2, 1),
            new THREE.MeshLambertMaterial({ color: 0x2F2F2F })
        );
        safeBody.position.set(0, 1, -0.4);
        
        // Combination dial
        const dial = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 0.1),
            new THREE.MeshLambertMaterial({ color: 0x666666 })
        );
        dial.position.set(0, 0.5, 0.55);
        dial.rotation.z = Math.PI / 2;
        
        // Numbers around the dial
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const number = this.createNumberLabel(i.toString());
            number.position.set(
                Math.cos(angle) * 0.4,
                Math.sin(angle) * 0.4,
                0.06
            );
            dial.add(number);
        }
        
        safeGroup.add(safeBody);
        safeGroup.add(dial);
        
        // Add interaction data
        safeGroup.userData = {
            type: 'puzzle',
            puzzleType: 'combination_safe',
            interactable: true,
            currentCombination: '0000',
            solved: false
        };
        
        // Position in room
        const roomCenter = room.center;
        safeGroup.position.set(
            roomCenter.x - 3,
            0,
            roomCenter.z - 3
        );
        
        room.meshGroup.add(safeGroup);
        return safeGroup;
    }

    createBookCipher(room) {
        const bookGroup = new THREE.Group();
        bookGroup.name = "book_cipher";
        
        const bookColors = [
            { color: 0xFF0000, name: 'red', year: 1823 },
            { color: 0x0000FF, name: 'blue', year: 1834 },
            { color: 0x00FF00, name: 'green', year: 1845 },
            { color: 0xFFFF00, name: 'yellow', year: 1856 }
        ];
        
        const bookshelf = new THREE.Mesh(
            new THREE.BoxGeometry(3, 2, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x8B4513 })
        );
        bookshelf.position.set(0, 1, 0);
        bookGroup.add(bookshelf);
        
        // Create draggable books
        bookColors.forEach((bookData, index) => {
            const book = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 1.5, 0.25),
                new THREE.MeshLambertMaterial({ color: bookData.color })
            );
            
            book.position.set(-1.2 + (index * 0.6), 0.25, 0.15);
            book.userData = {
                type: 'book',
                color: bookData.name,
                year: bookData.year,
                originalPosition: book.position.clone(),
                draggable: true
            };
            
            bookGroup.add(book);
        });
        
        bookGroup.userData = {
            type: 'puzzle',
            puzzleType: 'book_cipher',
            interactable: true,
            currentOrder: ['red', 'blue', 'green', 'yellow'],
            solved: false
        };
        
        const roomCenter = room.center;
        bookGroup.position.set(roomCenter.x + 3, 0, roomCenter.z);
        
        room.meshGroup.add(bookGroup);
        return bookGroup;
    }

    createMirrorPuzzle(room) {
        const mirrorGroup = new THREE.Group();
        mirrorGroup.name = "mirror_puzzle";
        
        const mirrors = [];
        const positions = [
            new THREE.Vector3(-2, 1.5, -2),
            new THREE.Vector3(2, 1.5, -2),
            new THREE.Vector3(2, 1.5, 2),
            new THREE.Vector3(-2, 1.5, 2)
        ];
        
        // Light source
        const lightSource = new THREE.SpotLight(0xffffff, 2, 10, Math.PI / 8);
        lightSource.position.set(-3, 2, -3);
        lightSource.target.position.set(-2, 1.5, -2);
        mirrorGroup.add(lightSource);
        mirrorGroup.add(lightSource.target);
        
        // Create mirrors
        positions.forEach((pos, index) => {
            const mirrorFrame = new THREE.Mesh(
                new THREE.BoxGeometry(0.8, 0.8, 0.1),
                new THREE.MeshLambertMaterial({ color: 0x444444 })
            );
            
            const mirror = new THREE.Mesh(
                new THREE.PlaneGeometry(0.6, 0.6),
                new THREE.MeshLambertMaterial({ 
                    color: 0xCCCCCC,
                    transparent: true,
                    opacity: 0.8
                })
            );
            
            mirrorFrame.position.copy(pos);
            mirror.position.copy(pos);
            mirror.position.z += 0.06;
            
            mirror.userData = {
                type: 'mirror',
                index: index,
                rotation: 0,
                rotatable: true
            };
            
            mirrors.push(mirror);
            mirrorGroup.add(mirrorFrame);
            mirrorGroup.add(mirror);
        });
        
        // Target (where light should end up)
        const target = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 0.3, 8),
            new THREE.MeshLambertMaterial({ color: 0xFF0000 })
        );
        target.position.set(0, 1.5, 0);
        mirrorGroup.add(target);
        
        mirrorGroup.userData = {
            type: 'puzzle',
            puzzleType: 'mirror_sequence',
            interactable: true,
            mirrors: mirrors,
            solved: false
        };
        
        const roomCenter = room.center;
        mirrorGroup.position.set(roomCenter.x, 0, roomCenter.z);
        
        room.meshGroup.add(mirrorGroup);
        return mirrorGroup;
    }

    createPressurePlatePuzzle(room) {
        const plateGroup = new THREE.Group();
        plateGroup.name = "pressure_plates";
        
        const plates = [];
        const objects = [];
        const platePositions = [
            new THREE.Vector3(-1.5, 0, -1.5),
            new THREE.Vector3(1.5, 0, -1.5),
            new THREE.Vector3(1.5, 0, 1.5),
            new THREE.Vector3(-1.5, 0, 1.5)
        ];
        
        const objectData = [
            { weight: 'heavy', color: 0x8B0000, size: 0.5 },
            { weight: 'medium', color: 0x0000FF, size: 0.4 },
            { weight: 'light', color: 0x00FF00, size: 0.3 },
            { weight: 'medium', color: 0xFF00FF, size: 0.4 }
        ];
        
        // Create pressure plates
        platePositions.forEach((pos, index) => {
            const plate = new THREE.Mesh(
                new THREE.CylinderGeometry(0.4, 0.4, 0.1),
                new THREE.MeshLambertMaterial({ color: 0x666666 })
            );
            plate.position.copy(pos);
            plate.position.y = 0.05;
            
            plate.userData = {
                type: 'pressure_plate',
                index: index,
                occupied: false,
                requiredWeight: null
            };
            
            plates.push(plate);
            plateGroup.add(plate);
        });
        
        // Create moveable objects
        objectData.forEach((data, index) => {
            const obj = new THREE.Mesh(
                new THREE.SphereGeometry(data.size),
                new THREE.MeshLambertMaterial({ color: data.color })
            );
            
            obj.position.set(
                -3 + (index * 1.5),
                data.size,
                3
            );
            
            obj.userData = {
                type: 'weight_object',
                weight: data.weight,
                draggable: true,
                originalPosition: obj.position.clone()
            };
            
            objects.push(obj);
            plateGroup.add(obj);
        });
        
        plateGroup.userData = {
            type: 'puzzle',
            puzzleType: 'pressure_plate',
            interactable: true,
            plates: plates,
            objects: objects,
            solved: false
        };
        
        const roomCenter = room.center;
        plateGroup.position.set(roomCenter.x, 0, roomCenter.z);
        
        room.meshGroup.add(plateGroup);
        return plateGroup;
    }

    createClockPuzzle(room) {
        const clockGroup = new THREE.Group();
        clockGroup.name = "ancient_clock";
        
        // Clock face
        const clockFace = new THREE.Mesh(
            new THREE.CylinderGeometry(1, 1, 0.2),
            new THREE.MeshLambertMaterial({ color: 0xF5F5DC })
        );
        clockFace.position.set(0, 2, -0.4);
        clockFace.rotation.x = Math.PI / 2;
        
        // Hour markers
        for (let i = 1; i <= 12; i++) {
            const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
            const marker = this.createNumberLabel(this.toRoman(i));
            marker.position.set(
                Math.cos(angle) * 0.8,
                Math.sin(angle) * 0.8,
                0.11
            );
            clockFace.add(marker);
        }
        
        // Hour hand
        const hourHand = new THREE.Mesh(
            new THREE.BoxGeometry(0.05, 0.5, 0.02),
            new THREE.MeshLambertMaterial({ color: 0x000000 })
        );
        hourHand.position.set(0, 0.25, 0.11);
        
        // Minute hand
        const minuteHand = new THREE.Mesh(
            new THREE.BoxGeometry(0.03, 0.7, 0.02),
            new THREE.MeshLambertMaterial({ color: 0x000000 })
        );
        minuteHand.position.set(0, 0.35, 0.12);
        
        clockFace.add(hourHand);
        clockFace.add(minuteHand);
        
        clockGroup.add(clockFace);
        
        clockGroup.userData = {
            type: 'puzzle',
            puzzleType: 'clock_puzzle',
            interactable: true,
            hourHand: hourHand,
            minuteHand: minuteHand,
            currentTime: '12:00',
            solved: false
        };
        
        const roomCenter = room.center;
        clockGroup.position.set(roomCenter.x, 0, roomCenter.z + 4);
        
        room.meshGroup.add(clockGroup);
        return clockGroup;
    }

    createSymbolPuzzle(room) {
        const symbolGroup = new THREE.Group();
        symbolGroup.name = "symbol_puzzle";
        
        const symbols = [
            { name: 'protection', shape: 'triangle', color: 0x0000FF },
            { name: 'banishment', shape: 'square', color: 0xFF0000 },
            { name: 'sealing', shape: 'pentagon', color: 0x00FF00 },
            { name: 'peace', shape: 'circle', color: 0xFFFFFF }
        ];
        
        // Create altar/pedestal
        const altar = new THREE.Mesh(
            new THREE.CylinderGeometry(1.5, 1.5, 0.3),
            new THREE.MeshLambertMaterial({ color: 0x2F2F2F })
        );
        altar.position.set(0, 0.15, 0);
        symbolGroup.add(altar);
        
        // Create symbol slots
        const slotPositions = [
            new THREE.Vector3(-0.7, 0.31, -0.7),
            new THREE.Vector3(0.7, 0.31, -0.7),
            new THREE.Vector3(0.7, 0.31, 0.7),
            new THREE.Vector3(-0.7, 0.31, 0.7)
        ];
        
        const slots = [];
        slotPositions.forEach((pos, index) => {
            const slot = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.2, 0.05),
                new THREE.MeshLambertMaterial({ color: 0x444444 })
            );
            slot.position.copy(pos);
            slot.userData = {
                type: 'symbol_slot',
                index: index,
                occupied: false
            };
            slots.push(slot);
            symbolGroup.add(slot);
        });
        
        // Create moveable symbols
        const symbolObjects = [];
        symbols.forEach((symbolData, index) => {
            const geometry = this.createSymbolGeometry(symbolData.shape);
            const symbol = new THREE.Mesh(
                geometry,
                new THREE.MeshLambertMaterial({ color: symbolData.color })
            );
            
            symbol.position.set(
                -3 + (index * 2),
                1,
                3
            );
            
            symbol.userData = {
                type: 'symbol',
                name: symbolData.name,
                draggable: true,
                originalPosition: symbol.position.clone()
            };
            
            symbolObjects.push(symbol);
            symbolGroup.add(symbol);
        });
        
        symbolGroup.userData = {
            type: 'puzzle',
            puzzleType: 'symbol_matching',
            interactable: true,
            slots: slots,
            symbols: symbolObjects,
            currentOrder: [],
            solved: false
        };
        
        const roomCenter = room.center;
        symbolGroup.position.set(roomCenter.x, 0, roomCenter.z);
        
        room.meshGroup.add(symbolGroup);
        return symbolGroup;
    }

    createSymbolGeometry(shape) {
        switch (shape) {
            case 'triangle':
                return new THREE.ConeGeometry(0.15, 0.3, 3);
            case 'square':
                return new THREE.BoxGeometry(0.25, 0.25, 0.1);
            case 'pentagon':
                return new THREE.CylinderGeometry(0.15, 0.15, 0.1, 5);
            case 'circle':
                return new THREE.SphereGeometry(0.15);
            default:
                return new THREE.BoxGeometry(0.2, 0.2, 0.1);
        }
    }

    createNumberLabel(text) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        
        context.fillStyle = '#000000';
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 32, 32);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshLambertMaterial({ 
            map: texture,
            transparent: true 
        });
        
        const geometry = new THREE.PlaneGeometry(0.3, 0.3);
        return new THREE.Mesh(geometry, material);
    }

    toRoman(num) {
        const romanNumerals = {
            1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI',
            7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII'
        };
        return romanNumerals[num] || num.toString();
    }

    // Puzzle solving methods
    solveCombinationSafe(puzzle, input) {
        const correctCombination = this.puzzleTemplates.combination_safe.solution();
        if (input === correctCombination) {
            puzzle.userData.solved = true;
            this.showSafeContents(puzzle);
            return true;
        }
        return false;
    }

    showSafeContents(safe) {
        // Animate safe opening
        const door = new THREE.Mesh(
            new THREE.BoxGeometry(0.7, 1.5, 0.1),
            new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        door.position.set(-0.4, 0, 0.55);
        
        // Add contents (key or important item)
        const key = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.2),
            new THREE.MeshLambertMaterial({ color: 0xFFD700 })
        );
        key.position.set(-0.2, -0.3, 0.3);
        key.userData = {
            type: 'key',
            keyId: 'master_key',
            name: 'Master Key'
        };
        
        safe.add(door);
        safe.add(key);
        
        // Animate door opening
        const openTween = { rotation: 0 };
        const animate = () => {
            openTween.rotation += 0.02;
            door.rotation.y = -openTween.rotation;
            if (openTween.rotation < Math.PI / 2) {
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    solveBookCipher(puzzle, newOrder) {
        const correctOrder = ['red', 'blue', 'green', 'yellow']; // Chronological by year
        if (JSON.stringify(newOrder) === JSON.stringify(correctOrder)) {
            puzzle.userData.solved = true;
            this.revealBookSecret(puzzle);
            return true;
        }
        return false;
    }

    revealBookSecret(bookshelf) {
        // Create a hidden compartment that opens
        const secretPanel = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.3, 0.1),
            new THREE.MeshLambertMaterial({ color: 0x654321 })
        );
        secretPanel.position.set(0, -0.5, 0.2);
        
        // Add secret item
        const scroll = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.4),
            new THREE.MeshLambertMaterial({ color: 0xF5F5DC })
        );
        scroll.rotation.z = Math.PI / 2;
        scroll.position.set(0, 0, 0.1);
        scroll.userData = {
            type: 'scroll',
            name: 'Ancient Scroll',
            content: 'The way out lies beneath the grandfather clock at the stroke of midnight...'
        };
        
        secretPanel.add(scroll);
        bookshelf.add(secretPanel);
    }

    solveMirrorPuzzle(puzzle) {
        // Check if mirrors are aligned correctly to reflect light to target
        const mirrors = puzzle.userData.mirrors;
        const correctAngles = [0, 45, 90, 135];
        
        let correct = true;
        mirrors.forEach((mirror, index) => {
            if (mirror.userData.rotation !== correctAngles[index]) {
                correct = false;
            }
        });
        
        if (correct) {
            puzzle.userData.solved = true;
            this.activateLightPath(puzzle);
            return true;
        }
        return false;
    }

    activateLightPath(puzzle) {
        // Create visible light beams between mirrors
        const beamMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFFFFF,
            transparent: true,
            opacity: 0.6
        });
        
        // Add light beam effects
        const beam = new THREE.Mesh(
            new THREE.CylinderGeometry(0.02, 0.02, 5),
            beamMaterial
        );
        beam.position.set(0, 1.5, 0);
        beam.rotation.z = Math.PI / 2;
        puzzle.add(beam);
        
        // Reveal hidden door or passage
        this.revealHiddenPassage(puzzle);
    }

    revealHiddenPassage(puzzle) {
        // Create a new passage in the wall
        console.log("Hidden passage revealed!");
        // Implementation would modify the room structure
    }

    // Interactive puzzle methods
    rotateMirror(mirror) {
        mirror.userData.rotation += 45;
        if (mirror.userData.rotation >= 360) {
            mirror.userData.rotation = 0;
        }
        mirror.rotation.z = (mirror.userData.rotation * Math.PI) / 180;
    }

    moveObject(object, targetPosition) {
        // Animate object movement
        const startPos = object.position.clone();
        let progress = 0;
        
        const animate = () => {
            progress += 0.05;
            object.position.lerpVectors(startPos, targetPosition, progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.checkPressurePlates(object.parent);
            }
        };
        animate();
    }

    checkPressurePlates(puzzle) {
        const plates = puzzle.userData.plates;
        const objects = puzzle.userData.objects;
        
        // Check which objects are on which plates
        const placement = [];
        plates.forEach((plate, index) => {
            const platePos = plate.position;
            let occupyingObject = null;
            
            objects.forEach(obj => {
                const distance = obj.position.distanceTo(platePos);
                if (distance < 0.5) { // Close enough to be "on" the plate
                    occupyingObject = obj.userData.weight;
                }
            });
            
            placement[index] = occupyingObject;
        });
        
        // Check if placement matches solution
        const correctPlacement = ['heavy', 'medium', 'light', 'medium'];
        if (JSON.stringify(placement) === JSON.stringify(correctPlacement)) {
            puzzle.userData.solved = true;
            this.openSecretDoor(puzzle);
        }
    }

    openSecretDoor(puzzle) {
        // Animate a secret door opening in the room
        console.log("Secret door activated by pressure plates!");
    }

    setClockTime(puzzle, hours, minutes) {
        const hourHand = puzzle.userData.hourHand;
        const minuteHand = puzzle.userData.minuteHand;
        
        // Calculate hand rotations
        const hourAngle = ((hours % 12) / 12) * Math.PI * 2 - Math.PI / 2;
        const minuteAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
        
        hourHand.rotation.z = hourAngle;
        minuteHand.rotation.z = minuteAngle;
        
        puzzle.userData.currentTime = `${hours}:${minutes.toString().padStart(2, '0')}`;
        
        // Check if correct time
        if (puzzle.userData.currentTime === '11:47') {
            puzzle.userData.solved = true;
            this.triggerClockMechanism(puzzle);
            return true;
        }
        return false;
    }

    triggerClockMechanism(clock) {
        // Play clock chiming sound effect
        console.log("The ancient clock chimes ominously...");
        
        // Reveal final escape route
        this.revealFinalEscape(clock);
    }

    revealFinalEscape(clock) {
        // Create the final escape mechanism
        const escapePortal = new THREE.Mesh(
            new THREE.RingGeometry(1, 1.5, 16),
            new THREE.MeshLambertMaterial({ 
                color: 0x00FFFF,
                transparent: true,
                opacity: 0.7
            })
        );
        escapePortal.position.set(0, 2, 0);
        escapePortal.userData = {
            type: 'escape_portal',
            interactable: true
        };
        
        clock.add(escapePortal);
        
        // Animate portal spinning
        const animatePortal = () => {
            escapePortal.rotation.z += 0.02;
            requestAnimationFrame(animatePortal);
        };
        animatePortal();
    }

    tick(delta) {
        // Update any animated puzzle elements
        this.activePuzzles.forEach((puzzle, id) => {
            if (puzzle.userData && puzzle.userData.type === 'puzzle') {
                // Handle any continuous puzzle updates here
            }
        });
    }
}

export { PuzzleSystem };