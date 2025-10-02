export class WirePuzzleLogic {
    constructor(levelData) {
        this.levelData = levelData;
        this.gridSize = levelData.gridSize;
        
        // State for the currently active drawing operation
        this.isDrawing = false;
        this.activeColor = null;
        this.activePath = []; // The array of [x, y] coordinates for the current path

        // The main data structures for the puzzle state
        this.paths = {}; // Stores ONLY completed paths
        this.gridState = this.createGridState();
    }

    createGridState() {
        const grid = Array(this.gridSize[1]).fill(null).map(() => 
            Array(this.gridSize[0]).fill({ type: 'empty', color: null })
        );

        this.levelData.terminals.forEach(t => {
            grid[t.pair[0][1]][t.pair[0][0]] = { type: 'terminal', color: t.color };
            grid[t.pair[1][1]][t.pair[1][0]] = { type: 'terminal', color: t.color };
        });

        if (this.levelData.obstacles) {
            this.levelData.obstacles.forEach(([x, y]) => {
                grid[y][x] = { type: 'obstacle', color: null };
            });
        }
        return grid;
    }

    startPath(x, y) {
        if (this.isDrawing) return;

        const cell = this.getCell(x, y);
        if (!cell || cell.type === 'obstacle') return;

        const colorToDraw = cell.color;
        if (!colorToDraw) return; // Can't start on an empty cell

        // If a path for this color already exists, clear it before starting a new one.
        this.clearPath(colorToDraw);

        this.isDrawing = true;
        this.activeColor = colorToDraw;
        this.activePath = [[x, y]]; // Start the new path
    }

    updatePath(x, y) {
        if (!this.isDrawing) return;
        if (x < 0 || x >= this.gridSize[0] || y < 0 || y >= this.gridSize[1]) return;

        const lastPoint = this.activePath[this.activePath.length - 1];
        if (x === lastPoint[0] && y === lastPoint[1]) return;

        // Backtracking: if moving to the previous cell, pop the last point.
        const secondToLastPoint = this.activePath[this.activePath.length - 2];
        if (secondToLastPoint && secondToLastPoint[0] === x && secondToLastPoint[1] === y) {
            this.activePath.pop();
            return;
        }

        const dx = Math.abs(x - lastPoint[0]);
        const dy = Math.abs(y - lastPoint[1]);
        if (dx + dy !== 1) return; // Not an adjacent cell

        const targetCell = this.getCell(x, y);
        
        // Check for collisions with other paths or obstacles
        if (targetCell.type === 'path' || targetCell.type === 'obstacle') return;
        if (targetCell.type === 'terminal' && targetCell.color !== this.activeColor) return;

        this.activePath.push([x, y]);
    }

    endPath() {
        if (!this.isDrawing) return;

        const lastPoint = this.activePath[this.activePath.length - 1];
        const endCell = this.getCell(lastPoint[0], lastPoint[1]);

        if (endCell.type === 'terminal' && endCell.color === this.activeColor && this.activePath.length > 1) {
            // Path is valid and complete. Add it to the main paths object.
            this.paths[this.activeColor] = [...this.activePath];
            this.updateGridState(); // Solidify the path in our grid
        }

        // Clear the active path regardless of success
        this.isDrawing = false;
        this.activeColor = null;
        this.activePath = [];
    }

    clearPath(color) {
        if (!this.paths[color]) return;
        delete this.paths[color];
        this.updateGridState(); // Update the grid to remove the old path
    }

    updateGridState() {
        // Reset all path cells to empty
        for (let y = 0; y < this.gridSize[1]; y++) {
            for (let x = 0; x < this.gridSize[0]; x++) {
                if (this.gridState[y][x].type === 'path') {
                    this.gridState[y][x] = { type: 'empty', color: null };
                }
            }
        }
        // Redraw all completed paths onto the grid
        for (const color in this.paths) {
            const path = this.paths[color];
            for (let i = 1; i < path.length - 1; i++) {
                const [x, y] = path[i];
                this.gridState[y][x] = { type: 'path', color };
            }
        }
    }

    getCell(x, y) {
        return this.gridState[y]?.[x];
    }

    checkWinCondition() {
        return this.levelData.terminals.length === Object.keys(this.paths).length;
    }
}