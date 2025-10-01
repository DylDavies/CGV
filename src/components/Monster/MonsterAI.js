// src/components/Monster/MonsterAI.js

import { Vector3, Raycaster, LineCurve3, TubeGeometry, MeshBasicMaterial, Mesh } from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class Node {
    constructor(x, y, parent = null) { this.x = x; this.y = y; this.parent = parent; this.g = 0; this.h = 0; this.f = 0; }
    equals(other) { return this.x === other.x && this.y === other.y; }
}

class MonsterAI {
     constructor(monsterMesh, playerMesh, navigationGrid, walls, camera, config, scene, mansion) {
        this.monster = monsterMesh;
        this.player = playerMesh;
        this.grid = navigationGrid;
        this.walls = walls;
        this.camera = camera;
        this.scene = scene;
        this.mansion = mansion;
        this.baseSpeed = config.speed || 2.5; // A more noticeable base speed
        this.baseRecalculationInterval = config.recalculationInterval || 1000;
        this.onAggressionChange = config.onAggressionChange || function () {};
        this.wallSize = config.wallSize;
        this.path = [];
        this.lastPathRecalculation = 0;
        this.aggressionLevel = 0;
        this.currentTarget = null;
        this.raycaster = new Raycaster();
        this.debugTubes = [];
        this.monsterDebugTubes = [];
        this.visionAngle = Math.PI / 6;
        this.isFleeing = false;
        this.fleeUntil = 0;
        this.patrolPoints = [ { x: 3, y: 1 }, { x: 3, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 1 } ];
        this.currentPatrolIndex = 0;
        this.corners = [{ x: 1, y: 1 }, { x: 12, y: 1 }, { x: 1, y: 9 }, { x: 12, y: 9 }];
        this.walkableTiles = this.grid;
        this.setAggression(0);
    }

    setupRayVisualizers() {
        const material = new MeshBasicMaterial({ color: 0xffff00, wireframe: true });
        for (let i = 0; i < 5; i++) {
            const path = new LineCurve3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
            const geometry = new TubeGeometry(path, 2, 0.05, 8, false);
            const tubeMesh = new Mesh(geometry, material);
            this.debugTubes.push(tubeMesh); this.scene.add(tubeMesh);
        }
    }

    setupMonsterRayVisualizers() {
        const material = new MeshBasicMaterial({ color: 0xff0000, wireframe: true });
        for (let i = 0; i < 5; i++) {
            const path = new LineCurve3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
            const geometry = new TubeGeometry(path, 2, 0.05, 8, false);
            const tubeMesh = new Mesh(geometry, material);
            this.monsterDebugTubes.push(tubeMesh); this.scene.add(tubeMesh);
        }
    }

    updateRayVisualizers() {
        const origin = this.camera.position.clone();
        const centerDirection = this.camera.getWorldDirection(new Vector3());
        const spreadAngle = Math.PI / 12; const viewDistance = 50;
        const upVector = new Vector3(0, 1, 0); const rightVector = new Vector3().crossVectors(centerDirection, upVector).normalize();
        const directions = [ centerDirection.clone(), centerDirection.clone().applyAxisAngle(upVector, spreadAngle), centerDirection.clone().applyAxisAngle(upVector, -spreadAngle), centerDirection.clone().applyAxisAngle(rightVector, spreadAngle), centerDirection.clone().applyAxisAngle(rightVector, -spreadAngle) ];
        for (let i = 0; i < directions.length; i++) {
            const tubeMesh = this.debugTubes[i];
            tubeMesh.visible = window.showVisualizers;
            const endPoint = new Vector3().addVectors(origin, directions[i].clone().multiplyScalar(viewDistance));
            const path = new LineCurve3(origin, endPoint);
            const newGeometry = new TubeGeometry(path, 2, 0.05, 8, false);
            tubeMesh.geometry.dispose(); tubeMesh.geometry = newGeometry;
        }
    }

    updateMonsterRayVisualizers() {
        if (!this.monster) return;
        const origin = this.monster.position.clone();
        const centerDirection = new Vector3();
        this.monster.getWorldDirection(centerDirection);
        const viewDistance = 30;
        const upVector = new Vector3(0, 1, 0); const rightVector = new Vector3().crossVectors(centerDirection, upVector).normalize();
        const directions = [ centerDirection.clone(), centerDirection.clone().applyAxisAngle(upVector, this.visionAngle), centerDirection.clone().applyAxisAngle(upVector, -this.visionAngle), centerDirection.clone().applyAxisAngle(rightVector, this.visionAngle), centerDirection.clone().applyAxisAngle(rightVector, -this.visionAngle) ];
        for (let i = 0; i < directions.length; i++) {
            const tubeMesh = this.monsterDebugTubes[i];
            // NOTE: To see these visualizers, you must type 'window.showVisualizers = true' in the browser console.
            tubeMesh.visible = window.showVisualizers;
            const endPoint = new Vector3().addVectors(origin, directions[i].clone().multiplyScalar(viewDistance));
            const path = new LineCurve3(origin, endPoint);
            const newGeometry = new TubeGeometry(path, 2, 0.05, 8, false);
            tubeMesh.geometry.dispose(); tubeMesh.geometry = newGeometry;
        }
    }

    setAggression(level) {
        this.aggressionLevel = level; this.path = []; this.currentTarget = null; this.isFleeing = false;
        switch (level) {
            case 0: this.speed = this.baseSpeed * 0.7; this.recalculationInterval = this.baseRecalculationInterval * 1.5; break;
            case 1: this.speed = this.baseSpeed; this.recalculationInterval = this.baseRecalculationInterval; break;
            case 2: this.speed = this.baseSpeed * 1.2; this.recalculationInterval = this.baseRecalculationInterval * 0.9; break;
            case 3: this.speed = this.baseSpeed * 1.5; this.recalculationInterval = this.baseRecalculationInterval * 0.75; break;
            case 4: this.speed = this.baseSpeed * 2.5; this.recalculationInterval = this.baseRecalculationInterval * 0.5; break;
        }
        this.onAggressionChange(this.aggressionLevel);
    }

    update(delta) {
        // First, decide what to do (find a path, look around, etc.)
        if (this.aggressionLevel === 0) {
            this.behaveDocilely();
        } else { // Any aggression level > 0 will now trigger the chase
            this.behaveHostilely();
        }

        // Then, execute the movement based on the chosen behavior
        this.followPath(delta);
    }
    
    behaveDocilely() {
        if (this.canMonsterSeePlayer()) {
            this.setAggression(1);
            return;
        }
        // If we don't have a path, find one to the next patrol point.
        if (!this.path || this.path.length === 0) {
            const monsterGridPos = { x: Math.round(this.monster.position.x / this.wallSize), y: Math.round(this.monster.position.z / this.wallSize) };
            const targetPoint = this.patrolPoints[this.currentPatrolIndex];
            this.path = this.findPath(monsterGridPos, targetPoint);
            this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.patrolPoints.length;

            // Immediately remove the starting node from the path.
            if (this.path && this.path.length > 0) {
                this.path.shift();
            }
        }
    }
    
    canMonsterSeePlayer() {
        if (!this.monster) return false;
        const origin = this.monster.position.clone();
        const centerDirection = new Vector3();
        this.monster.getWorldDirection(centerDirection);
        const viewDistance = 30; this.raycaster.far = viewDistance;
        const upVector = new Vector3(0, 1, 0);
        const rightVector = new Vector3().crossVectors(centerDirection, upVector).normalize();
        
        const directions = [
            centerDirection.clone(),
            centerDirection.clone().applyAxisAngle(upVector, this.visionAngle),
            centerDirection.clone().applyAxisAngle(upVector, -this.visionAngle),
        ];

        for (const direction of directions) {
            this.raycaster.set(origin, direction);
            const intersects = this.raycaster.intersectObjects(this.scene.children, true); 

            if (intersects.length > 0) {
                if (intersects[0].object.name === 'player_body') {
                    return true;
                }
                if (this.walls.includes(intersects[0].object)) {
                    continue;
                }
            }
        }
        return false;
    }

    isMonsterVisible() {
        if (!this.monster) return false;
        const origin = this.camera.position.clone();
        const centerDirection = this.camera.getWorldDirection(new Vector3());
        const spreadAngle = Math.PI / 12;
        const viewDistance = 50; this.raycaster.far = viewDistance;
        const upVector = new Vector3(0, 1, 0); const rightVector = new Vector3().crossVectors(centerDirection, upVector).normalize();
        const directions = [ centerDirection.clone(), centerDirection.clone().applyAxisAngle(upVector, spreadAngle), centerDirection.clone().applyAxisAngle(upVector, -spreadAngle), centerDirection.clone().applyAxisAngle(rightVector, spreadAngle), centerDirection.clone().applyAxisAngle(rightVector, -spreadAngle) ];
        for (const direction of directions) {
            this.raycaster.set(origin, direction);
            const intersects = this.raycaster.intersectObjects([this.monster, ...this.walls], true);
            if (intersects.length > 0 && intersects[0].object.name.startsWith('monster')) { return true; }
        }
        return false;
    }
    
    behaveHostilely() {
        const now = Date.now();
        if (now - this.lastPathRecalculation > this.recalculationInterval) {
            this.recalculateChasePath();
        }
    }

    recalculateChasePath() {
        this.lastPathRecalculation = Date.now();
        const monsterGridPos = { x: Math.round(this.monster.position.x / this.wallSize), y: Math.round(this.monster.position.z / this.wallSize) };
        const targetGridPos = { x: Math.round(this.player.model.position.x / this.wallSize), y: Math.round(this.player.model.position.z / this.wallSize) };

        const gridHeight = this.grid.length;
        const gridWidth = this.grid[0] ? this.grid[0].length : 0;

        if (targetGridPos.y >= 0 && targetGridPos.y < gridHeight && targetGridPos.x >= 0 && targetGridPos.x < gridWidth &&
            this.grid[targetGridPos.y][targetGridPos.x] === 0) {
            this.path = this.findPath(monsterGridPos, targetGridPos);

            // Immediately remove the starting node from the path.
            if (this.path && this.path.length > 0) {
                this.path.shift();
            }
        }
    }
    
    followPath(delta) {
        if (!this.monster || !delta || !this.mansion) return;

        const currentRoom = this.mansion.getRoomAt(this.monster.position);
        const targetHeight = currentRoom ? (currentRoom.baseHeight || 0) + 1.0 : this.monster.position.y;
        
        this.monster.position.y += (targetHeight - this.monster.position.y) * 0.1;

        if (this.path && this.path.length > 0) {
            const targetNode = this.path[0];
            const targetPosition = new Vector3(targetNode.x * this.wallSize, targetHeight, targetNode.y * this.wallSize);
            
            const distance = this.monster.position.distanceTo(targetPosition);

            if (distance > 0.1) {
                const direction = targetPosition.clone().sub(this.monster.position).normalize();
                this.monster.position.add(direction.multiplyScalar(this.speed * delta));
                
                const lookTarget = this.monster.position.clone().add(direction);
                this.monster.lookAt(lookTarget);
            }
            
            if (distance < 0.5) {
                this.path.shift();
            }
        }
    }

    findPath(start, end) {
        const startNode = new Node(start.x, start.y);
        const endNode = new Node(end.x, end.y);
        const openList = [startNode];
        const closedList = [];

        while (openList.length > 0) {
            let currentNode = openList.reduce((a, b) => a.f < b.f ? a : b);
            
            openList.splice(openList.indexOf(currentNode), 1);
            closedList.push(currentNode);

            if (currentNode.equals(endNode)) {
                let path = [];
                let current = currentNode;
                while (current) {
                    path.push({ x: current.x, y: current.y });
                    current = current.parent;
                }
                return path.reverse();
            }

            const neighbors = [];
            const { x, y } = currentNode;
            const possibleMoves = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

            for (const move of possibleMoves) {
                const nx = x + move.x;
                const ny = y + move.y;

                if (ny >= 0 && ny < this.grid.length && nx >= 0 && nx < this.grid[ny].length && this.grid[ny][nx] === 0) {
                    neighbors.push(new Node(nx, ny, currentNode));
                }
            }

            for (let neighbor of neighbors) {
                if (closedList.some(node => node.equals(neighbor))) {
                    continue;
                }

                neighbor.g = currentNode.g + 1;
                neighbor.h = Math.abs(neighbor.x - endNode.x) + Math.abs(neighbor.y - endNode.y);
                neighbor.f = neighbor.g + neighbor.h;

                if (openList.some(node => node.equals(neighbor) && neighbor.g >= node.g)) {
                    continue;
                }

                openList.push(neighbor);
            }
        }
        return null; // No path found
    }
}

export { MonsterAI };