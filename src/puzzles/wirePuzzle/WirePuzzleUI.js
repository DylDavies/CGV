export class WirePuzzleUI {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.boardContainer = document.getElementById('wire-puzzle-board'); 
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks;
        this.cellSize = 50;
        this._addEventListeners();
    }

    _addEventListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
    }

    getGridPos(event) {
        const rect = this.boardContainer.getBoundingClientRect();
        const padding = 10;
        const x = Math.floor((event.clientX - rect.left - padding) / this.cellSize);
        const y = Math.floor((event.clientY - rect.top - padding) / this.cellSize);
        return { x, y };
    }

    handleMouseDown(e) {
        const { x, y } = this.getGridPos(e);
        this.callbacks.onPathStart(x, y);
    }

    handleMouseMove(e) {
        const { x, y } = this.getGridPos(e);
        this.callbacks.onPathDraw(x, y);
    }

    handleMouseUp() {
        this.callbacks.onPathEnd();
    }


    render(logic) {
        if (!logic || !logic.gridSize) return;
        const numCols = logic.gridSize[0];
        const numRows = logic.gridSize[1];
        
        const canvasWidth = numCols * this.cellSize;
        const canvasHeight = numRows * this.cellSize;
        
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;

        const padding = 10;
        this.boardContainer.style.width = `${canvasWidth + padding * 2}px`;
        this.boardContainer.style.height = `${canvasHeight + padding * 2}px`;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid(logic);
        this.drawObstacles(logic);
        this.drawPaths(logic); 
        this.drawTerminals(logic.levelData.terminals);
    }
    
    drawGrid(logic) {
        this.ctx.strokeStyle = '#333';
        for (let i = 0; i <= logic.gridSize[0]; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.cellSize, 0);
            this.ctx.lineTo(i * this.cellSize, this.canvas.height);
            this.ctx.stroke();
        }
        for (let i = 0; i <= logic.gridSize[1]; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, i * this.cellSize);
            this.ctx.lineTo(this.canvas.width, i * this.cellSize);
            this.ctx.stroke();
        }
    }

    drawObstacles(logic) {
        if (!logic.levelData.obstacles) return;
        this.ctx.fillStyle = '#555';
        logic.levelData.obstacles.forEach(([x, y]) => {
            this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
        });
    }

    drawTerminals(terminals) {
        terminals.forEach(t => {
            this.ctx.fillStyle = t.color;
            t.pair.forEach(([x, y]) => {
                this.ctx.beginPath();
                this.ctx.arc(x * this.cellSize + this.cellSize / 2, y * this.cellSize + this.cellSize / 2, this.cellSize / 3, 0, Math.PI * 2);
                this.ctx.fill();
            });
        });
    }


    drawPaths(logic) {
        this.ctx.lineWidth = this.cellSize / 4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Draw all the completed paths
        for (const color in logic.paths) {
            this.drawSinglePath(logic.paths[color], color);
        }

        // If a path is actively being drawn, draw it on top
        if (logic.isDrawing && logic.activePath.length > 0) {
            this.drawSinglePath(logic.activePath, logic.activeColor);
        }
    }

    // Helper function to draw a single line from an array of points
    drawSinglePath(path, color) {
        if (!path || path.length < 2) return;

        this.ctx.strokeStyle = color;
        this.ctx.beginPath();
        this.ctx.moveTo(
            path[0][0] * this.cellSize + this.cellSize / 2,
            path[0][1] * this.cellSize + this.cellSize / 2
        );
        for (let i = 1; i < path.length; i++) {
            this.ctx.lineTo(
                path[i][0] * this.cellSize + this.cellSize / 2,
                path[i][1] * this.cellSize + this.cellSize / 2
            );
        }
        this.ctx.stroke();
    }
}