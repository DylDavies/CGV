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
            ]
        };

        this.container = document.getElementById('tictactoe-puzzle-container');

        this.ui = new TicTacToeUI(document.getElementById('tictactoe-puzzle-canvas'), {
            onCellClick: (row, col) => this.handlePlayerMove(row, col),
            onHover: (cell) => this.handleHover(cell)
        });

        this.result = new PuzzleResult(
            'tictactoe-puzzle-result-overlay',
            'tictactoe-result-title',
            'tictactoe-result-subtitle'
        );

        // Set up button handlers
        document.getElementById('tictactoe-reset-puzzle-btn').addEventListener('click', () => this.startNewGame());
        document.getElementById('tictactoe-close-puzzle-btn').addEventListener('click', () => this.hide());

        // Prevent clicks from passing through to the game
        this.container.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        console.log('🎮 TicTacToe Puzzle initialized');
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
        console.log('  Container:', this.container?.id, 'Display:', this.container?.style.display);

        if (this.controls) {
            console.log('  Freezing controls...');
            this.controls.freeze();
        } else {
            console.warn('  ⚠️ Controls not set!');
        }

        if (!this.container) {
            console.error('❌ Container not found! Looking for tictactoe-puzzle-box');
            return;
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

        this.result.resultOverlay.className = 'success';
        this.result.resultTitle.textContent = 'Victory!';
        this.result.resultSubtitle.textContent = 'You have outsmarted the ghost!';
        document.getElementById('tictactoe-ghost-dialogue').textContent = `"${successMessage}"`;
        this.result.resultOverlay.classList.remove('hidden');

        setTimeout(() => {
            this.result.resultOverlay.className = 'hidden';
            if (this.onSolveCallback) this.onSolveCallback();
            this.hide();
        }, 3500);
    }

    /**
     * Show defeat screen
     */
    showDefeat() {
        const failureMessage = this.getRandomDialogue(this.ghostDialogues.loss);

        this.result.resultOverlay.className = 'failure';
        this.result.resultTitle.textContent = 'Defeated!';
        this.result.resultSubtitle.textContent = 'The ghost has won this round.';
        document.getElementById('tictactoe-ghost-dialogue').textContent = `"${failureMessage}"`;
        this.result.resultOverlay.classList.remove('hidden');

        setTimeout(() => {
            this.result.resultOverlay.className = 'hidden';
            this.startNewGame(); // Allow replay
        }, 3500);
    }

    /**
     * Show draw screen
     */
    showDraw() {
        this.result.resultOverlay.className = 'success';
        this.result.resultTitle.textContent = 'A Draw!';
        this.result.resultSubtitle.textContent = 'The spirit respects your cunning.';
        document.getElementById('tictactoe-ghost-dialogue').textContent = '"Perhaps you are worthy after all..."';
        this.result.resultOverlay.classList.remove('hidden');

        setTimeout(() => {
            this.result.resultOverlay.className = 'hidden';
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
