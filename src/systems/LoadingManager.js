// src/systems/LoadingManager.js (Updated)

class LoadingManager {
    constructor() {
        this.container = document.getElementById('loading-container');
        this.progressBar = document.getElementById('loading-bar');
        this.totalAssets = 0;
        this.loadedAssets = 0;
    }

    init(totalAssets) {
        this.totalAssets = totalAssets;
        this.loadedAssets = 0;
        this.updateProgress();
        this.container.style.display = 'block';
    }

    assetLoaded() {
        this.loadedAssets++;
        this.updateProgress();
    }

    updateProgress() {
        const progress = this.totalAssets > 0 ? (this.loadedAssets / this.totalAssets) * 100 : 100;
        this.progressBar.style.width = `${progress}%`;

        if (progress >= 100) {
            // Hide the bar after the initial load is complete
            setTimeout(() => {
                this.container.style.display = 'none';
            }, 1000);
        }
    }
}

export { LoadingManager };