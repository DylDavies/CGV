// Easy AI ghost that makes mistakes intentionally
export class TicTacToeLogic {
    constructor() {
        this.board = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];
        this.playerSymbol = 1;  // X (player)
        this.ghostSymbol = -1;  // O (ghost)
        this.currentPlayer = 1; // 1 for player, -1 for ghost
        this.gameOver = false;
        this.winner = null;
    }

    /**
     * Player makes a move at the given cell
     * @param {number} row - Row index (0-2)
     * @param {number} col - Column index (0-2)
     * @returns {boolean} - Whether the move was valid
     */
    playerMove(row, col) {
        if (!this.isValidMove(row, col)) {
            return false;
        }

        this.board[row][col] = this.playerSymbol;
        this.currentPlayer = this.ghostSymbol;

        // Check win conditions after player move
        this.checkGameState();

        return true;
    }

    /**
     * Ghost (easy AI) makes a move
     * Easy difficulty: 60% random, 30% blocking, 10% winning move
     */
    ghostMove() {
        if (this.gameOver || this.currentPlayer !== this.ghostSymbol) {
            return false;
        }

        const emptyMoves = this.getEmptyMoves();
        if (emptyMoves.length === 0) {
            return false;
        }

        let chosenMove = null;
        const rand = Math.random();

        // 10% chance to win if possible
        if (rand < 0.1) {
            chosenMove = this.findWinningMove(this.ghostSymbol);
        }

        // 30% chance to block player
        if (!chosenMove && rand < 0.4) {
            chosenMove = this.findBlockingMove();
        }

        // 60% chance to play randomly (easy difficulty)
        if (!chosenMove) {
            chosenMove = emptyMoves[Math.floor(Math.random() * emptyMoves.length)];
        }

        if (chosenMove) {
            this.board[chosenMove.row][chosenMove.col] = this.ghostSymbol;
            this.currentPlayer = this.playerSymbol;
            this.checkGameState();
            return true;
        }

        return false;
    }

    /**
     * Check if a move is valid
     */
    isValidMove(row, col) {
        return row >= 0 && row < 3 && col >= 0 && col < 3 && this.board[row][col] === 0;
    }

    /**
     * Get all empty cells
     */
    getEmptyMoves() {
        const empty = [];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (this.board[row][col] === 0) {
                    empty.push({ row, col });
                }
            }
        }
        return empty;
    }

    /**
     * Find a winning move for the given symbol
     */
    findWinningMove(symbol) {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (this.board[row][col] === 0) {
                    this.board[row][col] = symbol;
                    if (this.checkWin(symbol)) {
                        this.board[row][col] = 0;
                        return { row, col };
                    }
                    this.board[row][col] = 0;
                }
            }
        }
        return null;
    }

    /**
     * Find a move that blocks the player from winning
     */
    findBlockingMove() {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (this.board[row][col] === 0) {
                    this.board[row][col] = this.playerSymbol;
                    if (this.checkWin(this.playerSymbol)) {
                        this.board[row][col] = 0;
                        return { row, col };
                    }
                    this.board[row][col] = 0;
                }
            }
        }
        return null;
    }

    /**
     * Check if the given symbol has won
     */
    checkWin(symbol) {
        // Check rows
        for (let row = 0; row < 3; row++) {
            if (this.board[row][0] === symbol &&
                this.board[row][1] === symbol &&
                this.board[row][2] === symbol) {
                return true;
            }
        }

        // Check columns
        for (let col = 0; col < 3; col++) {
            if (this.board[0][col] === symbol &&
                this.board[1][col] === symbol &&
                this.board[2][col] === symbol) {
                return true;
            }
        }

        // Check diagonals
        if (this.board[0][0] === symbol &&
            this.board[1][1] === symbol &&
            this.board[2][2] === symbol) {
            return true;
        }

        if (this.board[0][2] === symbol &&
            this.board[1][1] === symbol &&
            this.board[2][0] === symbol) {
            return true;
        }

        return false;
    }

    /**
     * Check if the board is full
     */
    isBoardFull() {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (this.board[row][col] === 0) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Update game state after each move
     */
    checkGameState() {
        // Check if player won
        if (this.checkWin(this.playerSymbol)) {
            this.gameOver = true;
            this.winner = 'player';
        }
        // Check if ghost won
        else if (this.checkWin(this.ghostSymbol)) {
            this.gameOver = true;
            this.winner = 'ghost';
        }
        // Check if board is full (draw)
        else if (this.isBoardFull()) {
            this.gameOver = true;
            this.winner = 'draw';
        }
    }

    /**
     * Reset the game
     */
    reset() {
        this.board = [
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0]
        ];
        this.currentPlayer = 1;
        this.gameOver = false;
        this.winner = null;
    }

    /**
     * Get the board state
     */
    getBoard() {
        return this.board;
    }

    /**
     * Check if player has won
     */
    playerWon() {
        return this.winner === 'player';
    }

    /**
     * Check if ghost has won
     */
    ghostWon() {
        return this.winner === 'ghost';
    }

    /**
     * Check if game is a draw
     */
    isDraw() {
        return this.winner === 'draw';
    }

    /**
     * Check if it's the player's turn
     */
    isPlayerTurn() {
        return this.currentPlayer === this.playerSymbol;
    }

    /**
     * Check if it's the ghost's turn
     */
    isGhostTurn() {
        return this.currentPlayer === this.ghostSymbol;
    }
}
