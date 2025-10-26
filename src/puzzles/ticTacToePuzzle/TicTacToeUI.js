// TicTacToe UI renderer
export class TicTacToeUI {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.callbacks = callbacks;

        // Visual settings
        this.cellSize = 80;
        this.boardSize = 3;
        this.padding = 10;

        // Colors for horror aesthetic
        this.colors = {
            background: '#1a1a1a',
            grid: '#8b0000',
            gridDark: '#440000',
            playerX: '#d4af37',
            ghostO: '#ff6b6b',
            empty: '#000',
            hover: '#333',
            highlight: '#8b0000'
        };

        this._addEventListeners();
    }

    _addEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    }

    /**
     * Get the cell at the given mouse position
     */
    getCellAtPosition(x, y) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = x - rect.left - this.padding;
        const canvasY = y - rect.top - this.padding;

        const col = Math.floor(canvasX / this.cellSize);
        const row = Math.floor(canvasY / this.cellSize);

        if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize) {
            return { row, col };
        }
        return null;
    }

    handleClick(e) {
        const cell = this.getCellAtPosition(e.clientX, e.clientY);
        if (cell && this.callbacks.onCellClick) {
            this.callbacks.onCellClick(cell.row, cell.col);
        }
    }

    handleMouseMove(e) {
        const cell = this.getCellAtPosition(e.clientX, e.clientY);
        this.hoveredCell = cell;
        if (this.callbacks.onHover) {
            this.callbacks.onHover(cell);
        }
    }

    handleMouseLeave() {
        this.hoveredCell = null;
    }

    /**
     * Render the tic-tac-toe board
     */
    render(logic) {
        // Get the actual displayed size of the canvas
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width;
        const displayHeight = rect.height;

        // Set canvas resolution to match display size (accounts for DPI)
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;

        // Calculate cell size based on actual canvas size
        const availableSize = Math.min(displayWidth, displayHeight) - (this.padding * 2);
        this.cellSize = availableSize / this.boardSize;

        // Draw background
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, displayWidth, displayHeight);

        // Draw grid
        this.drawGrid();

        // Draw board state
        this.drawBoard(logic.getBoard());

        // Draw hovered cell highlight
        if (this.hoveredCell && logic.isPlayerTurn() && !logic.gameOver) {
            this.drawHoverHighlight(this.hoveredCell);
        }
    }

    /**
     * Draw the grid
     */
    drawGrid() {
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 3;

        // Vertical lines
        for (let i = 1; i < this.boardSize; i++) {
            const x = this.padding + i * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.padding);
            this.ctx.lineTo(x, this.padding + this.boardSize * this.cellSize);
            this.ctx.stroke();
        }

        // Horizontal lines
        for (let i = 1; i < this.boardSize; i++) {
            const y = this.padding + i * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(this.padding, y);
            this.ctx.lineTo(this.padding + this.boardSize * this.cellSize, y);
            this.ctx.stroke();
        }

        // Draw border
        this.ctx.strokeStyle = this.colors.gridDark;
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(
            this.padding,
            this.padding,
            this.boardSize * this.cellSize,
            this.boardSize * this.cellSize
        );
    }

    /**
     * Draw the board state (X's and O's)
     */
    drawBoard(board) {
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                const cell = board[row][col];
                if (cell !== 0) {
                    this.drawSymbol(row, col, cell);
                }
            }
        }
    }

    /**
     * Draw a single symbol (X for player, O for ghost)
     */
    drawSymbol(row, col, symbol) {
        const x = this.padding + col * this.cellSize;
        const y = this.padding + row * this.cellSize;
        const centerX = x + this.cellSize / 2;
        const centerY = y + this.cellSize / 2;

        if (symbol === 1) {
            // Draw X for player
            this.drawX(centerX, centerY);
        } else if (symbol === -1) {
            // Draw O for ghost
            this.drawO(centerX, centerY);
        }
    }

    /**
     * Draw an X (player)
     */
    drawX(centerX, centerY) {
        const offset = this.cellSize * 0.3;
        this.ctx.strokeStyle = this.colors.playerX;
        this.ctx.lineWidth = 6;
        this.ctx.lineCap = 'round';

        // First diagonal
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - offset, centerY - offset);
        this.ctx.lineTo(centerX + offset, centerY + offset);
        this.ctx.stroke();

        // Second diagonal
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + offset, centerY - offset);
        this.ctx.lineTo(centerX - offset, centerY + offset);
        this.ctx.stroke();
    }

    /**
     * Draw an O (ghost)
     */
    drawO(centerX, centerY) {
        const radius = this.cellSize * 0.25;
        this.ctx.strokeStyle = this.colors.ghostO;
        this.ctx.lineWidth = 6;
        this.ctx.lineCap = 'round';

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Add a subtle glow for the ghost
        this.ctx.strokeStyle = this.colors.ghostO + '40';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    /**
     * Draw hover highlight for empty cells
     */
    drawHoverHighlight(cell) {
        const x = this.padding + cell.col * this.cellSize;
        const y = this.padding + cell.row * this.cellSize;

        this.ctx.fillStyle = this.colors.hover;
        this.ctx.globalAlpha = 0.3;
        this.ctx.fillRect(x, y, this.cellSize, this.cellSize);
        this.ctx.globalAlpha = 1.0;

        // Draw border around hovered cell
        this.ctx.strokeStyle = this.colors.highlight;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, this.cellSize, this.cellSize);
    }
}
