export class PuzzleUI {
    constructor(callbacks) {
        this.callbacks = callbacks;
        this._cacheDOMElements();
        this._addEventListeners();
    }

    _cacheDOMElements() {
        this.elements = {
            board: document.getElementById('puzzle-board'),
            moves: document.getElementById('moves-remaining'),
            objective: document.getElementById('puzzle-objective'),
            palette: document.getElementById('color-palette'),
        };
    }

    _addEventListeners() {
    const resetButton = document.getElementById('reset-puzzle-btn');
    const closeButton = document.getElementById('close-puzzle-btn');

    if (resetButton) {
        resetButton.onclick = (event) => {
            event.stopPropagation(); // Prevent click from bubbling up
            this.callbacks.onReset();
        };
    }
    if (closeButton) {
        closeButton.onclick = (event) => {
            event.stopPropagation(); // Prevent click from bubbling up
            this.callbacks.onClose();
        };
    }
}

    render(logic) {
        this.renderBoard(logic);
        this.renderPalette(logic);
        this.updateText(logic);
    }

    renderBoard(logic) {
        this.elements.board.innerHTML = '';
        const cellSize = 40;
        const gap = 2;
        const padding = 10;
        const numCols = logic.grid[0].length;
        const numRows = logic.grid.length;
        const totalWidth = (numCols * cellSize) + ((numCols - 1) * gap) + (padding * 2);
        const totalHeight = (numRows * cellSize) + ((numRows - 1) * gap) + (padding * 2);

        this.elements.board.style.width = `${totalWidth}px`;
        this.elements.board.style.height = `${totalHeight}px`;

        this.elements.board.style.setProperty('--grid-cols', numCols);

        logic.grid.forEach((row, i) => {
            row.forEach((color, j) => {
                const tile = document.createElement('div');
                tile.className = 'puzzle-tile';
                tile.style.backgroundColor = color;
                tile.dataset.row = i;
                tile.dataset.col = j;
                tile.onclick = () => this.callbacks.onTileClick(i, j);
                this.elements.board.appendChild(tile);
            });
        });
    }

    renderPalette(logic) {
        this.elements.palette.innerHTML = '';
        const uniqueColors = [...new Set(logic.originalLevelData.board.flat())]
            .map(index => logic.colorMap[index])
            .filter(Boolean);

        uniqueColors.forEach(color => {
            const option = document.createElement('div');
            option.className = 'color-option';
            option.style.backgroundColor = color;
            if (color === logic.selectedColor) {
                option.classList.add('selected');
            }
            option.onclick = () => this.callbacks.onColorSelect(color);
            this.elements.palette.appendChild(option);
        });
    }

    updateText(logic) {
        this.elements.moves.textContent = logic.movesRemaining;
        this.elements.objective.textContent = `Turn all blocks into ${logic.targetColor}`;
    }

    async animateTileChanges(steps, newColor) {
        for (const wave of steps) {
            for (const { row, col } of wave) {
                const tileElement = this.elements.board.querySelector(`[data-row='${row}'][data-col='${col}']`);
                if (tileElement) {
                    tileElement.style.backgroundColor = newColor;
                    tileElement.classList.add('tile-pop');
                    setTimeout(() => tileElement.classList.remove('tile-pop'), 200);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
}