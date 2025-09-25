export class ColorPuzzle {
    constructor() {
        this.allLevels = [];
        this.colors = ['blue', 'yellow', 'green', 'red', 'orange', 'purple', 'pink', 'cyan'];
        this.colorMap = { 
            0: 'blue', 1: 'yellow', 2: 'green', 3: 'red', 4: 'orange', 5: 'purple', 6: 'pink', 7: 'cyan'
        };
        this.paletteColors = [];

        this.onSolveCallback = null;
        this.currentLevelData = null;
        this.onCloseCallback = null;
        this.timerInterval = null;
        this.timeRemaining = 60;
        this.isAnimating = false;
        this.controls = null;

    }

    _initializeUI() {
        this.puzzleContainer = document.getElementById('puzzle-container');
        this.boardElement = document.getElementById('puzzle-board');
        this.movesElement = document.getElementById('moves-remaining');
        this.objectiveElement = document.getElementById('puzzle-objective');
        this.paletteElement = document.getElementById('color-palette');
        this.timerValueElement = document.getElementById('timer-value');
        this.resultOverlay = document.getElementById('puzzle-result-overlay');
        this.resultTitle = document.getElementById('result-title');
        this.resultSubtitle = document.getElementById('result-subtitle');
        
        const resetButton = document.getElementById('reset-puzzle-btn');
        if (resetButton) resetButton.onclick = () => this.startCurrentLevel();

        const closeButton = document.getElementById('close-puzzle-btn');
        if (closeButton) closeButton.onclick = () => this.hide();
    }
    
    
    setControls(controls) {
        this.controls = controls;
    }

    /**
     * Fetch all puzzles from level.json
     */
    async loadLevels(){
        try{
            const response = await fetch('public/puzzles/colorPuzzle/levels.json'); 
           
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            this.allLevels = await response.json();
            console.log(`Successfully loaded ${this.allLevels.length} levels.`);
        
        } 
        catch(error){
            console.error("Could not load levels.json:", error);
            this.allLevels = []; // cant load the levels so make the array empty
        }
    }

    /**
     * Starts a new puzzle with a specific number of moves.
     * @param {number} moveCount - The desired number of moves for the puzzle.
     */
    start(moveCount) {
        if (this.allLevels.length === 0) {
            console.error("No levels are loaded. Cannot start puzzle.");
            return;
        }

        // Find levels that can be solved in moveCount number of moves
        const suitableLevels = this.allLevels.filter(level => level.levelData.turns === moveCount);

        if (suitableLevels.length === 0) {
            console.warn(`No puzzles found with exactly ${moveCount} moves.`);
            return;
        }

        // No levels found so find a random level
        const randomLevel = suitableLevels[Math.floor(Math.random() * suitableLevels.length)];
        this.currentLevelData = randomLevel.levelData; // Save for reset
        
        this.setupLevel(this.currentLevelData);
    }

    /**
     * Restarts the currently loaded level.
     */
    startCurrentLevel() {
        if (this.currentLevelData) {
            this.setupLevel(this.currentLevelData);
        }
    }

    /**
     * Sets up the game board and UI based on loaded level data.
     */
    setupLevel(levelData) {
        this._initializeUI();
        const adaptedLevel = this.adaptLevelData(levelData);

        this.grid = adaptedLevel.board;
        this.targetColor = adaptedLevel.targetColor;
        this.movesRemaining = adaptedLevel.moves;
        this.gridSize = this.grid.length;

        this.selectedColor = this.colors.find(c => c !== this.grid[0][0]) || this.colors[0];
        
        this.render();
        this.updateUI();
    }
    
    /**
     * Converts a level from "Overflowing Palette" format to the format used by this puzzle.
     * @param {object} levelData - The raw levelData object from the JSON file.
     */
    adaptLevelData(levelData) {
        const newBoard = levelData.board.map(row => 
            row.map(colorIndex => {
                if (colorIndex === -1) return 'grey'; 
                return this.colorMap[colorIndex] || 'grey';
            })
        );

        return {
            board: newBoard,
            targetColor: this.colorMap[levelData.targetColor],
            moves: levelData.turns
        };
    }
    
    async handleTileClick(row, col) {
        // Prevent new moves while the animation is playing
        if (this.isAnimating) return;

        const colorToReplace = this.grid[row][col];
        
        if (colorToReplace === 'grey' || colorToReplace === this.selectedColor || this.movesRemaining <= 0) {
            return;
        }
        
        // Tile propagation animation
        this.isAnimating = true; // Lock controls
        this.movesRemaining--;
        this.updateUI();

        // Call the new animated function and wait for it to complete
        await this.animatedFloodFill(row, col, colorToReplace, this.selectedColor, this.grid);

        this.isAnimating = false; // Unlock controls
        this.checkWinCondition();
    }

    iterativeFloodFill(startRow, startCol, targetColor, replacementColor, grid) {
        const queue = [[startRow, startCol]];
        const visited = new Set([`${startRow},${startCol}`]);
        grid[startRow][startCol] = replacementColor;

        while(queue.length > 0) {
            const [r, c] = queue.shift();
            const neighbors = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]];
            for (const [nr, nc] of neighbors) {
                const key = `${nr},${nc}`;
                if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length && !visited.has(key) && grid[nr][nc] === targetColor) {
                    visited.add(key);
                    grid[nr][nc] = replacementColor;
                    queue.push([nr, nc]);
                }
            }
        }
    }

    render() {
        this.boardElement.innerHTML = '';
        const cellSize = 40;
        const gap = 2;
        const padding = 10;
        
        const numCols = this.grid[0].length;
        const numRows = this.grid.length;

        const totalWidth = (numCols * cellSize) + ((numCols - 1) * gap) + (padding * 2);
        const totalHeight = (numRows * cellSize) + ((numRows - 1) * gap) + (padding * 2);

        this.boardElement.style.width = `${totalWidth}px`;
        this.boardElement.style.height = `${totalHeight}px`;
        this.boardElement.style.setProperty('--grid-cols', numCols);
        
        for (let i = 0; i < numRows; i++) {
            for (let j = 0; j < numCols; j++) {
                const tile = document.createElement('div');
                tile.classList.add('puzzle-tile');
                tile.style.backgroundColor = this.grid[i][j];
                tile.dataset.row = i;
                tile.dataset.col = j;
                tile.onclick = () => this.handleTileClick(i, j); 
                this.boardElement.appendChild(tile);
            }
        }
        this.renderPalette();
    }
    
    renderPalette() {
        // Clean pallete colours and button list
        this.paletteElement.innerHTML = ''; 
        this.paletteColors = [];

        let flatArray = this.currentLevelData.board.flat()
        const uniqueColoursSet = new Set(flatArray);
        //console.log(uniqueColoursSet);
        const uniqueColours = [...uniqueColoursSet];
        
        // Add colours to palette based on colours from the board
        for(let i = 0; i < uniqueColours.length; i++){
            //console.log(this.colors[uniqueColours[i]])
            if (this.colors[uniqueColours[i]] != undefined) this.paletteColors.push(this.colors[uniqueColours[i]]);
        }
        //console.log(this.paletteColors);

        this.paletteColors.forEach(color => {

            // New button for each color
            const option = document.createElement('div');
            option.classList.add('color-option');
            option.dataset.color = color;
            option.style.backgroundColor = color;

            if (color === this.selectedColor) {
                option.classList.add('selected');
            }

            option.onclick = () => {
                this.selectedColor = color;
                this.renderPalette(); // Re-render to update the selection highlight
            };
            
            // add button
            this.paletteElement.appendChild(option);
        });
    }

    // BFS for animation of tile propagation
    async animatedFloodFill(startRow, startCol, targetColor, replacementColor, grid) {
        let queue = [[startRow, startCol]];
        const visited = new Set([`${startRow},${startCol}`]);
        
        grid[startRow][startCol] = replacementColor;
        this.renderTile(startRow, startCol); // Re-render just the first tile

        while (queue.length > 0) {
            const levelSize = queue.length;
            let nextQueue = [];

            // Process all nodes at the current level of the BFS
            for (let i = 0; i < levelSize; i++) {
                const [r, c] = queue[i];
                const neighbors = [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]];

                for (const [nr, nc] of neighbors) {
                    const key = `${nr},${nc}`;
                    if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length && !visited.has(key) && grid[nr][nc] === targetColor) {
                        visited.add(key);
                        grid[nr][nc] = replacementColor;
                        nextQueue.push([nr, nc]);
                    }
                }
            }
            
            // "Pop" all the newly found tiles at once
            nextQueue.forEach(([r, c]) => this.renderTile(r, c, true));
            
            await this.sleep(100); // Waiting time for each wave of propagation

            queue = nextQueue;
        }
    }

    /**
     * Renders or updates a single tile on the board.
     * @param {number} row - The row of the tile to render.
     * @param {number} col - The column of the tile to render.
     * @param {boolean} [pop=false] - Whether to apply the "pop" animation.
     */
    renderTile(row, col, pop = false) {
        const tileElement = this.boardElement.querySelector(`[data-row='${row}'][data-col='${col}']`);
        if (tileElement) {
            tileElement.style.backgroundColor = this.grid[row][col];
            
            // Add and remove the animation class to trigger the effect
            if (pop) {
                tileElement.classList.add('tile-pop');
                setTimeout(() => {
                    tileElement.classList.remove('tile-pop');
                }, 200); // Duration should match the CSS transition
            }
        }
    }
    
    updateUI() {
        this.movesElement.textContent = this.movesRemaining;
        this.objectiveElement.textContent = `Turn all blocks into ${this.targetColor}`;
    }

    checkWinCondition() {
        const isSolved = this.grid.every(row => row.every(color => color === this.targetColor || color === 'grey'));

        if (isSolved) {
            this.showResultScreen(true); // Call success screen
        } 
        else if (this.movesRemaining <= 0 && !isSolved) {
            this.showResultScreen(false); // Call fail screen
        }
    }

    startTimer() {
        this.stopTimer(); 
        this.timeRemaining = 60; 
        this.updateTimerDisplay();

        this.timerInterval = setInterval(() => {
            this.timeRemaining -= 0.01; 
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                this.showResultScreen(false); 
            }
        }, 10);
    }

    stopTimer() {
        clearInterval(this.timerInterval);
    }

    updateTimerDisplay() {
        if (this.timerValueElement) {
            // Format to two decimal places, ensuring it doesn't go below zero
            this.timerValueElement.textContent = Math.max(0, this.timeRemaining).toFixed(2);
        }
    }


        /**
     * Shows a non-disruptive success or failure message.
     * @param {boolean} isSuccess - Determines which message to show.
     */
    showResultScreen(isSuccess) {
        this.stopTimer();

        if (!this.resultOverlay) {
            console.error("Result overlay element not found! Make sure it exists in puzzle-ui.html.");
            return;
        }

        if (isSuccess) {
            this.resultOverlay.className = 'success';
            this.resultTitle.textContent = 'Success';
            this.resultSubtitle.textContent = 'The mechanism clicks open.';
            
            setTimeout(() => {
                if (this.onSolveCallback) this.onSolveCallback();
                this.hide(); // This correctly closes the puzzle and unfreezes controls
            }, 3000);

        } else {
            const failureMessages = [
                "A floorboard creaks above you.", "It's getting closer.", "The creature grows restless.",
                "You hear a faint scratching from behind the wall.", "A guttural growl echoes from the darkness."
            ];
            const subtitle = failureMessages[Math.floor(Math.random() * failureMessages.length)];

            this.resultOverlay.className = 'failure';
            this.resultTitle.textContent = 'Failure';
            this.resultSubtitle.textContent = subtitle;

            setTimeout(() => {
                this.resultOverlay.className = 'hidden'; // Hide the message
                this.hide(); // Close the puzzle and unfreeze controls
            }, 3500);
        }

        this.resultOverlay.classList.remove('hidden');
    }

    /**
     * A helper function to create a delay.
     * @param {number} ms - The number of milliseconds to wait.
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    show(moveCount) {
        // Freeze player so they can interact with the puzzle
        if(this.controls){
            this.controls.freeze();
        }

        //this._initializeUI();
        if(this.puzzleContainer){
            this.puzzleContainer.style.display = 'flex';
        }
        this.start(moveCount);
        this.startTimer();
    }

    hide() {
        if (this.controls) {
            this.controls.unfreeze();
        }

        if(this.puzzleContainer){
            this.puzzleContainer.style.display= 'none';
        }
        this.stopTimer();
        if(this.onCloseCallback) this.onCloseCallback();
       
    }
    
    onSolve(callback) {
        this.onSolveCallback = callback;
    }

    onClose(callback) {
        this.onCloseCallback = callback;
    }
}