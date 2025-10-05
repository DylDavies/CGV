export class PuzzleLogic{
    constructor(levelData, colorMap){
        this.colorMap = colorMap;
        this.originalLevelData = levelData;
        this.selectedColor = null;
        this.grid = [];
        this.targetColor = null;
        this.movesRemaining = 0;
        this.adaptLevelData(levelData);
    }

    // Extract board, target color and number of moves required to solve the puzzle
    adaptLevelData(levelData){
        this.grid = levelData.board.map(row =>{
            return row.map(colorIndex => this.colorMap[colorIndex] || 'grey')
        });

        this.targetColor = this.colorMap[levelData.targetColor];
        this.movesRemaining = levelData.turns;
    }

    /**
     * Calculates the steps using a bfs for the propagation of the waves and returning the steps as an array
     */
    getAnimatedFloodFillSteps(startRow, startCol) {
        const targetColor = this.grid[startRow][startCol];

        if (targetColor === this.selectedColor || targetColor === 'grey' || !this.selectedColor) {
            return null; // Invalid move
        }

        const animationSteps = [];
        let queue = [{ row: startRow, col: startCol }];
        const visited = new Set([`${startRow},${startCol}`]);

        while (queue.length > 0) {
            animationSteps.push([...queue]); 
            let nextQueue = [];

            for (const { row, col } of queue) {
                const neighbors = [[row + 1, col], [row - 1, col], [row, col + 1], [row, col - 1]];
                for (const [newRow, newCol] of neighbors) {
                    const key = `${newRow},${newCol}`;
                    if (newRow >= 0 && newRow < this.grid.length && newCol >= 0 && newCol < this.grid[0].length && !visited.has(key) && this.grid[newRow][newCol] === targetColor) {
                        visited.add(key);
                        nextQueue.push({ row: newRow, col: newCol });
                    }
                }
            }
            queue = nextQueue;
        }
        return animationSteps;
    }

    /**
     * Applies the changes to the grid after the animation is complete.
     */
    applyGridChanges(steps) {
        //console.log(this.grid);
        for (const wave of steps) {
            for (const { row, col } of wave) {
                this.grid[row][col] = this.selectedColor;
            }
        }
        this.movesRemaining--;
    }

    // Check if board is solved
    checkWinCondition() {
        const isSolved = this.grid.every(row => row.every(color => color === this.targetColor || color === 'grey'));

        if (isSolved) return 'win';

        if (this.movesRemaining <= 0) return 'lose';
        return 'continue';
    }
}