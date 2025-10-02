export class WirePuzzleUI {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        // THE FIX: Get the board container element, just like the color puzzle does
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
        // We now need to account for the board's padding
        const rect = this.boardContainer.getBoundingClientRect();
        const padding = 10; // As defined in your wire-puzzle.css for #wire-puzzle-board
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
        if (!logic || !logic.gridSize) {
            console.error('WirePuzzleUI Render ERROR: Logic object is invalid.');
            return;
        }

        const numCols = logic.gridSize[0];
        const numRows = logic.gridSize[1];
        
        // THE FIX: Calculate and set the size of the container div, not just the canvas
        const canvasWidth = numCols * this.cellSize;
        const canvasHeight = numRows * this.cellSize;
        
        // Set the canvas drawing dimensions
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;

        // Set the CSS size of the container div (including padding)
        // This is the step that was missing
        const padding = 10; // From CSS
        this.boardContainer.style.width = `${canvasWidth + padding * 2}px`;
        this.boardContainer.style.height = `${canvasHeight + padding * 2}px`;

        // Now, proceed with drawing
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawGrid(logic);
        this.drawObstacles(logic);
        this.drawPaths(logic.paths);
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

    drawPaths(paths) {
        this.ctx.lineWidth = this.cellSize / 4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        for (const color in paths) {
            const path = paths[color];
            this.ctx.strokeStyle = color;
            this.ctx.beginPath();
            this.ctx.moveTo(path[0][0] * this.cellSize + this.cellSize / 2, path[0][1] * this.cellSize + this.cellSize / 2);
            path.forEach(p => {
                this.ctx.lineTo(p[0] * this.cellSize + this.cellSize / 2, p[1] * this.cellSize + this.cellSize / 2);
            });
            this.ctx.stroke();
        }
    }
}