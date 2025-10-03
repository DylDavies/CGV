// src/utils/Pathfinding.js

// This file contains the A* pathfinding algorithm adapted to work with a graph structure.

class PathNode {
    constructor(id, position) {
        this.id = id; // e.g., 'room_center_library' or 'door_kitchen_hallway'
        this.position = position; // THREE.Vector3
        this.neighbors = []; // Array of { node: PathNode, cost: number }

        // A* properties
        this.g = 0; // Cost from start to this node
        this.h = 0; // Heuristic cost from this node to end
        this.f = 0; // g + h
        this.parent = null;
    }
}

function findGraphPath(startNode, endNode) {
    const openList = [startNode];
    const closedList = new Set();

    startNode.g = 0;
    startNode.h = startNode.position.distanceTo(endNode.position);
    startNode.f = startNode.h;
    startNode.parent = null;

    while (openList.length > 0) {
        // Find the node with the lowest F score in the open list
        let currentNode = openList.reduce((a, b) => a.f < b.f ? a : b);

        // If we've reached the end, reconstruct and return the path
        if (currentNode === endNode) {
            const path = [];
            let current = currentNode;
            while (current) {
                path.push(current);
                current = current.parent;
            }
            return path.reverse();
        }

        // Move current node from open to closed list
        openList.splice(openList.indexOf(currentNode), 1);
        closedList.add(currentNode);

        // Check all neighbors
        for (const neighborEdge of currentNode.neighbors) {
            const neighborNode = neighborEdge.node;

            if (closedList.has(neighborNode)) {
                continue;
            }

            const gScore = currentNode.g + neighborEdge.cost;

            let isNewPath = false;
            if (!openList.includes(neighborNode)) {
                openList.push(neighborNode);
                isNewPath = true;
            } else if (gScore < neighborNode.g) {
                isNewPath = true;
            }

            if (isNewPath) {
                neighborNode.parent = currentNode;
                neighborNode.g = gScore;
                neighborNode.h = neighborNode.position.distanceTo(endNode.position);
                neighborNode.f = neighborNode.g + neighborNode.h;
            }
        }
    }

    return null; // No path found
}

export { PathNode, findGraphPath };
