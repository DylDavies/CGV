import { TicTacToeLogic } from './TicTacToeLogic.js';
import { TicTacToeUI } from './TicTacToeUI.js';
import { PuzzleResult } from '../colorPuzzle/PuzzleResult.js';

export class TicTacToePuzzle {
    constructor() {
        this.logic = null;
        this.ui = null;
        this.controls = null;
        this.onSolveCallback = null;
        this.onCloseCallback = null;
        this.isInitialized = false;
        this.ghostDialogues = {
            win: [
                "Your luck ends here...",
                "Impressive. The mirror fades as you triumph.",
                "You have bested me... for now.",
                "The game was yours this time, mortal.",
                "Well played. The page is yours."
            ],
            loss: [
                "Another soul claimed by the mirror...",
                "Did you truly think you could defeat me?",
                "This dwelling is mine. Always.",
                "The darkness consumes the weak.",
                "Try again, if you dare..."
            ],
            flee: [
                "You thought you could escape?",
                "Cowards deserve only death...",
                "There is no escape from the mirror.",
                "Running won't save you now.",
                "Your fear makes you weak... and mine."
            ]
        };

        // Don't initialize DOM elements in constructor - they may not be loaded yet
        this.container = null;
        this.result = null;

        console.log('🎮 TicTacToe Puzzle constructed');
    }

    /**
     * Initialize DOM elements and event listeners (called lazily on first use)
     */
    _ensureInitialized() {
        if (this.isInitialized) return;

        this.container = document.getElementById('tictactoe-puzzle-container');
        if (!this.container) {
            console.error('❌ TicTacToe container not found');
            return;
        }

        const canvas = document.getElementById('tictactoe-puzzle-canvas');
        if (!canvas) {
            console.error('❌ TicTacToe canvas not found');
            return;
        }

        this.ui = new TicTacToeUI(canvas, {
            onCellClick: (row, col) => this.handlePlayerMove(row, col),
            onHover: (cell) => this.handleHover(cell)
        });

        this.result = new PuzzleResult(
            'tictactoe-puzzle-result-overlay',
            'tictactoe-result-title',
            'tictactoe-result-subtitle'
        );

        // Set up button handlers
        const resetBtn = document.getElementById('tictactoe-reset-puzzle-btn');
        const closeBtn = document.getElementById('tictactoe-close-puzzle-btn');

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.startNewGame());
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.handleFlee());
        }

        // Prevent clicks from passing through to the game
        this.container.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        this.isInitialized = true;
        console.log('🎮 TicTacToe Puzzle DOM initialized');
    }

    /**
     * Set the game controls (for freezing/unfreezing player movement)
     */
    setControls(controls) {
        this.controls = controls;
    }

    /**
     * Show the puzzle UI and start a new game
     */
    show() {
        console.log('🎮 TicTacToePuzzle.show() called');

        // Ensure DOM elements are initialized first
        this._ensureInitialized();

        if (!this.container) {
            console.error('❌ Container not found! Looking for tictactoe-puzzle-container');
            return;
        }

        console.log('  Container:', this.container?.id, 'Display:', this.container?.style.display);

        if (this.controls) {
            console.log('  Freezing controls...');
            this.controls.freeze();
        } else {
            console.warn('  ⚠️ Controls not set!');
        }

        this.container.style.display = 'flex';
        console.log('  Set display to flex');

        this.startNewGame();
        console.log('  Game started');
    }

    /**
     * Hide the puzzle UI
     */
    hide() {
        if (this.controls) this.controls.unfreeze();
        this.container.style.display = 'none';

        // Call close callback
        setTimeout(() => {
            if (this.onCloseCallback) this.onCloseCallback();
        }, 0);
    }

    /**
     * Handle player attempting to flee
     */
    async handleFlee() {
        const fleeMessage = this.getRandomDialogue(this.ghostDialogues.flee);
        const resultOverlay = document.getElementById('tictactoe-puzzle-result-overlay');
        const resultTitle = document.getElementById('tictactoe-result-title');
        const resultSubtitle = document.getElementById('tictactoe-result-subtitle');

        if (!resultOverlay || !resultTitle || !resultSubtitle) {
            console.error('❌ Result elements not found');
            return;
        }

        // Play scary mirror scream sound
        if (window.gameControls && window.gameControls.audioManager) {
            try {
                window.gameControls.audioManager.playSound('mirror_scream', 'public/audio/sfx/mirror-scream.mp3');
            } catch (error) {
                console.warn('⚠️ Could not play mirror scream sound:', error.message);
            }
        }

        // Show ghost's dialogue about fleeing
        resultOverlay.className = 'failure';
        resultTitle.textContent = 'No Escape!';
        resultSubtitle.textContent = 'The ghost claims your soul...';
        document.getElementById('tictactoe-ghost-dialogue').textContent = `"${fleeMessage}"`;
        resultOverlay.classList.remove('hidden');

        // After showing message, kill the player
        setTimeout(async () => {
            resultOverlay.className = 'hidden';
            this.hide();

            // Kill the player
            if (window.gameControls && window.gameControls.gameManager) {
                await window.gameControls.gameManager.onPlayerDeath('mirror_flee');
            }
        }, 3500);
    }

    /**
     * Start a new game
     */
    startNewGame() {
        this.logic = new TicTacToeLogic();
        this.updateUI();
    }

    /**
     * Handle player move
     */
    async handlePlayerMove(row, col) {
        // Prevent moves if game is over or not player's turn
        if (this.logic.gameOver || !this.logic.isPlayerTurn()) {
            return;
        }

        // Process player move
        if (!this.logic.playerMove(row, col)) {
            return; // Invalid move
        }

        this.updateUI();

        // Check if player won
        if (this.logic.playerWon()) {
            this.showVictory();
            return;
        }

        // Check if draw
        if (this.logic.isDraw()) {
            this.showDraw();
            return;
        }

        // Ghost's turn - delay for dramatic effect
        await this.delay(800);
        this.ghostMove();
    }

    /**
     * Ghost makes a move
     */
    ghostMove() {
        if (this.logic.gameOver) return;

        this.logic.ghostMove();
        this.updateUI();

        // Check if ghost won
        if (this.logic.ghostWon()) {
            this.showDefeat();
            return;
        }

        // Check if draw
        if (this.logic.isDraw()) {
            this.showDraw();
            return;
        }
    }

    /**
     * Update the UI to reflect current game state
     */
    updateUI() {
        // Update turn indicator
        const turnIndicator = document.getElementById('tictactoe-turn-indicator');
        if (this.logic.gameOver) {
            turnIndicator.textContent = 'Game Over';
        } else if (this.logic.isPlayerTurn()) {
            turnIndicator.textContent = 'Your Turn';
        } else {
            turnIndicator.textContent = "Ghost's Turn";
        }

        // Render the board
        this.ui.render(this.logic);
    }

    /**
     * Handle hover effect
     */
    handleHover(cell) {
        this.updateUI();
    }

    /**
     * Show victory screen
     */
    showVictory() {
        const successMessage = this.getRandomDialogue(this.ghostDialogues.win);
        const resultOverlay = document.getElementById('tictactoe-puzzle-result-overlay');
        const resultTitle = document.getElementById('tictactoe-result-title');
        const resultSubtitle = document.getElementById('tictactoe-result-subtitle');
        const ghostDialogue = document.getElementById('tictactoe-ghost-dialogue');

        if (!resultOverlay || !resultTitle || !resultSubtitle || !ghostDialogue) {
            console.error('❌ Result elements not found');
            return;
        }

        resultOverlay.className = 'success';
        resultTitle.textContent = 'Victory!';
        resultSubtitle.textContent = 'You have outsmarted the ghost!';
        ghostDialogue.textContent = `"${successMessage}"`;
        resultOverlay.classList.remove('hidden');

        setTimeout(() => {
            resultOverlay.className = 'hidden';
            if (this.onSolveCallback) this.onSolveCallback();
            this.hide();
        }, 3500);
    }

    /**
     * Show defeat screen and kill the player
     */
    async showDefeat() {
        const failureMessage = this.getRandomDialogue(this.ghostDialogues.loss);
        const resultOverlay = document.getElementById('tictactoe-puzzle-result-overlay');
        const resultTitle = document.getElementById('tictactoe-result-title');
        const resultSubtitle = document.getElementById('tictactoe-result-subtitle');

        if (!resultOverlay || !resultTitle || !resultSubtitle) {
            console.error('❌ Result elements not found');
            return;
        }

        // Play scary mirror scream sound
        if (window.gameControls && window.gameControls.audioManager) {
            try {
                window.gameControls.audioManager.playSound('mirror_scream', 'public/audio/sfx/mirror-scream.mp3');
            } catch (error) {
                console.warn('⚠️ Could not play mirror scream sound:', error.message);
            }
        }

        resultOverlay.className = 'failure';
        resultTitle.textContent = 'Defeated!';
        resultSubtitle.textContent = 'The ghost has claimed your soul...';
        document.getElementById('tictactoe-ghost-dialogue').textContent = `"${failureMessage}"`;
        resultOverlay.classList.remove('hidden');

        // After showing message, kill the player
        setTimeout(async () => {
            resultOverlay.className = 'hidden';
            this.hide();

            // Kill the player - same as when monster catches them
            if (window.gameControls && window.gameControls.gameManager) {
                await window.gameControls.gameManager.onPlayerDeath('mirror_loss');
            }
        }, 3500);
    }

    /**
     * Show draw screen
     */
    showDraw() {
        const resultOverlay = document.getElementById('tictactoe-puzzle-result-overlay');
        const resultTitle = document.getElementById('tictactoe-result-title');
        const resultSubtitle = document.getElementById('tictactoe-result-subtitle');

        if (!resultOverlay || !resultTitle || !resultSubtitle) {
            console.error('❌ Result elements not found');
            return;
        }

        resultOverlay.className = 'success';
        resultTitle.textContent = 'A Draw!';
        resultSubtitle.textContent = 'The spirit respects your cunning.';
        document.getElementById('tictactoe-ghost-dialogue').textContent = '"Perhaps you are worthy after all..."';
        resultOverlay.classList.remove('hidden');

        setTimeout(() => {
            resultOverlay.className = 'hidden';
            this.startNewGame(); // Allow replay
        }, 3500);
    }

    /**
     * Get a random dialogue from an array
     */
    getRandomDialogue(dialogues) {
        return dialogues[Math.floor(Math.random() * dialogues.length)];
    }

    /**
     * Delay helper for async operations
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Register callback for when puzzle is solved
     */
    onSolve(callback) {
        this.onSolveCallback = callback;
    }

    /**
     * Register callback for when puzzle is closed
     */
    onClose(callback) {
        this.onCloseCallback = callback;
    }
}
