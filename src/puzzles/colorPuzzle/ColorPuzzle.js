import { PuzzleLogic } from './PuzzleLogic.js';
import { PuzzleUI } from './PuzzleUI.js';
import { PuzzleTimer } from './PuzzleTimer.js';
import { PuzzleResult } from './PuzzleResult.js';

export class ColorPuzzle {
    constructor() {
        this.allLevels = [];
        this.colorMap = { 0: 'blue', 1: 'yellow', 2: 'green', 3: 'red', 4: 'orange', 5: 'purple', 6: 'pink', 7: 'cyan' };
        this.controls = null;
        this.puzzleContainer = document.getElementById('puzzle-container');
        this.isAnimating = false;
        
        this.ui = new PuzzleUI({
            onTileClick: (row, col) => this.handleTileClick(row, col),
            onColorSelect: (color) => this.handleColorSelect(color),
            onReset: () => this.startCurrentLevel(),
            onClose: () => this.hide()
        });

        this.result = new PuzzleResult();
        this.onSolveCallback = null;
        this.onCloseCallback = null;
        this.successMessage = 'The mechanism clicks open.';
        this.clue = null;
    }
    
    setControls(controls) { this.controls = controls; }

    async loadLevels() {
        const response = await fetch('public/puzzles/colorPuzzle/levels.json');
        this.allLevels = await response.json();

        this.allLevels = this.allLevels.filter(level => !level.levelData.board.flat().includes(-1));
        //console.log(`Loaded ${this.allLevels.length} solvable color puzzle levels.`);
    }

    /**
     * Starts a NEW random puzzle that matches the moveCount.
     */
    start(moveCount) {
        this.lastMoveCount = moveCount;
        const suitableLevels = this.allLevels.filter(level => level.levelData.turns === moveCount);
        if (suitableLevels.length === 0) {
            this.hide();
            return;
        }
        
        const randomLevel = suitableLevels[Math.floor(Math.random() * suitableLevels.length)];

        // Debug weird puzzle issues
        // console.log("🧩 New Puzzle Selected");
        // console.log(`   - Level ID: ${randomLevel.id}`);
        // console.log("   - Level Data:", randomLevel.levelData);


        this.currentLevelData = randomLevel.levelData;
        
        // This is the first time the level is loaded, so we start the timer.
        this.startCurrentLevel(true); 
    }
    
    /**
     * Resets the puzzle state. If isFirstLoad is true, it also starts a new timer.
     */
    startCurrentLevel(isFirstLoad = false) {
        if (!this.currentLevelData) {
            console.error("Cannot reset, no level data is currently loaded.");
            return;
        }

        this.logic = new PuzzleLogic(this.currentLevelData, this.colorMap);
        const availableColors = [...new Set(this.logic.originalLevelData.board.flat())]
            .map(index => this.logic.colorMap[index])
            .filter(Boolean);

        // --- DEBUG LOG ---
        //console.log("   - Available Colors (Palette):", availableColors);

        this.logic.selectedColor = availableColors[0];

        //console.log(`   - Initially Selected Color: ${this.logic.selectedColor}`);
        // --- END DEBUG LOG ---

        this.ui.render(this.logic);
        
        // for puzzle reset
        if (isFirstLoad) {
            this.startTimer();
        }
    }

    show(moveCount) {
        if (this.controls) this.controls.freeze();
        this.puzzleContainer.style.display = 'flex';
        this.start(moveCount);
    }

    async handleTileClick(row, col) {
        if (this.isAnimating) return;

        const animationSteps = this.logic.getAnimatedFloodFillSteps(row, col);

        if (animationSteps) {
            this.isAnimating = true;
            await this.ui.animateTileChanges(animationSteps, this.logic.selectedColor);
            
            this.logic.applyGridChanges(animationSteps);
            this.ui.updateText(this.logic);
            
            const gameState = this.logic.checkWinCondition();
            if (gameState !== 'continue') {
                if (this.timer) this.timer.stop();
                this.result.show(gameState === 'win', () => {
                    this.hide(); // Hide the puzzle UI
                    if (gameState === 'win' && this.onSolveCallback) {
                        this.onSolveCallback(); // Trigger the callback (which shows the clue)
                    }
                }, 
                this.successMessage);
            }
            this.isAnimating = false;
        }
    }

    handleColorSelect(color) {
        this.logic.selectedColor = color;

        // Debug current selected color
        console.log(`Color change. New selected color: ${color}`);

        this.ui.renderPalette(this.logic);
    }
    
    hide() {
        if (this.timer) {
            this.timer.stop();
        }
        if (this.controls) this.controls.unfreeze();
        this.puzzleContainer.style.display = 'none';
        if (this.onCloseCallback) this.onCloseCallback();
    }

    startTimer() {
        if (this.timer) this.timer.stop();
        this.timer = new PuzzleTimer(60, 
            (time) => {},
            () => {
                this.result.show(false, () => this.hide());
            }
        );
        this.timer.start();
    }

     onSolve(callback, successMessage) { 
        this.onSolveCallback = callback;
        if (successMessage) {
            this.successMessage = successMessage;
        }
     }
    onClose(callback) { this.onCloseCallback = callback; }
}