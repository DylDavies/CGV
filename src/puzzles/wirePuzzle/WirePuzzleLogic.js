export class WirePuzzleLogic {
    constructor(levelData) {
        this.levelData = levelData;
        this.gridSize = levelData.gridSize;
        this.paths = {};
        this.gridState = this.createGridState(levelData);
        this.isDrawing = false;
        this.activeColor = null;
    }

    createGridState(levelData) {
        const grid = Array(this.gridSize[1]).fill(null).map(() => Array(this.gridSize[0]).fill(null));
        levelData.terminals.forEach(t => {
            grid[t.pair[0][1]][t.pair[0][0]] = { type: 'terminal', color: t.color };
            grid[t.pair[1][1]][t.pair[1][0]] = { type: 'terminal', color: t.color };
        });
        if (levelData.obstacles) {
            levelData.obstacles.forEach(o => {
                grid[o[1]][o[0]] = { type: 'obstacle' };
            });
        }
        return grid;
    }

    startPath(x, y) {
        const cell = this.gridState[y]?.[x];
        if (cell && cell.type === 'terminal') {
            this.isDrawing = true;
            this.activeColor = cell.color;
            this.paths[this.activeColor] = [[x, y]];
            return true;
        }
        return false;
    }

    addPointToPath(x, y) {
        if (!this.isDrawing || !this.activeColor) return null;
        const lastPoint = this.paths[this.activeColor].slice(-1)[0];
        if (Math.abs(x - lastPoint[0]) + Math.abs(y - lastPoint[1]) !== 1) {
            return 'invalid_move';
        }
        const cell = this.gridState[y]?.[x];
        if (cell && cell.type === 'terminal' && cell.color !== this.activeColor) {
            return 'collision';
        }
        this.paths[this.activeColor].push([x, y]);
        const endTerminal = this.levelData.terminals.find(t => t.color === this.activeColor).pair[1];
        if (x === endTerminal[0] && y === endTerminal[1]) {
            this.endPath(true);
            return 'path_complete';
        }
        return 'path_continue';
    }

    endPath(isComplete) {
        if (!isComplete && this.activeColor) {
            delete this.paths[this.activeColor];
        }
        this.isDrawing = false;
        this.activeColor = null;
    }

    checkWinCondition() {
        return this.levelData.terminals.length === Object.keys(this.paths).length;
    }

    reset() {
        this.paths = {};
        this.isDrawing = false;
        this.activeColor = null;
    }
}