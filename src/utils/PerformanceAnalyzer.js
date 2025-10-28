/**
 * Detailed Performance Analyzer
 * Provides comprehensive performance metrics for debugging and optimization
 */
export class PerformanceAnalyzer {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
        this.metrics = {
            fps: 0,
            frameTime: 0,
            drawCalls: 0,
            triangles: 0,
            vertices: 0,
            textures: 0,
            activeLights: 0,
            shadowMaps: 0,
            visibleMeshes: 0,
            culledMeshes: 0,
            memory: {
                used: 0,
                limit: 0
            }
        };

        this.lastTime = performance.now();
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
    }

    /**
     * Analyze current performance metrics
     */
    analyze() {
        const now = performance.now();
        this.frameCount++;

        // FPS calculation
        const elapsed = now - this.lastTime;
        if (elapsed >= 1000) {
            this.metrics.fps = this.frameCount;
            this.frameCount = 0;
            this.lastTime = now;
        }

        // Frame time
        this.metrics.frameTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        // Renderer info
        const info = this.renderer.info;
        this.metrics.drawCalls = info.render.calls;
        this.metrics.triangles = info.render.triangles;
        this.metrics.vertices = info.render.vertices;
        this.metrics.textures = info.memory.textures;

        // Lights and shadows
        this.analyzeLights();

        // Mesh visibility
        this.analyzeMeshVisibility();

        // Memory
        this.analyzeMemory();

        return this.metrics;
    }

    /**
     * Analyze active lights and shadow maps
     */
    analyzeLights() {
        let activeLights = 0;
        let shadowMaps = 0;

        this.scene.traverse((node) => {
            if (node.isLight && node.visible) {
                activeLights++;
                if (node.castShadow && node.shadow) {
                    shadowMaps++;
                }
            }
        });

        this.metrics.activeLights = activeLights;
        this.metrics.shadowMaps = shadowMaps;
    }

    /**
     * Analyze visible vs culled meshes
     */
    analyzeMeshVisibility() {
        let visibleMeshes = 0;
        let culledMeshes = 0;

        this.scene.traverse((node) => {
            if (node.isMesh) {
                if (node.visible) {
                    visibleMeshes++;
                } else {
                    culledMeshes++;
                }
            }
        });

        this.metrics.visibleMeshes = visibleMeshes;
        this.metrics.culledMeshes = culledMeshes;
    }

    /**
     * Analyze memory usage
     */
    analyzeMemory() {
        if (performance.memory) {
            // Convert bytes to MB
            this.metrics.memory.used = (performance.memory.usedJSHeapSize / 1048576).toFixed(2);
            this.metrics.memory.limit = (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2);
        }
    }

    /**
     * Get formatted metrics report
     */
    getReport() {
        return {
            fps: this.metrics.fps,
            frameTime: `${this.metrics.frameTime.toFixed(2)}ms`,
            drawCalls: this.metrics.drawCalls,
            triangles: this.metrics.triangles,
            vertices: this.metrics.vertices,
            textures: this.metrics.textures,
            activeLights: this.metrics.activeLights,
            shadowMaps: this.metrics.shadowMaps,
            visibleMeshes: this.metrics.visibleMeshes,
            culledMeshes: this.metrics.culledMeshes,
            totalMeshes: this.metrics.visibleMeshes + this.metrics.culledMeshes,
            memory: `${this.metrics.memory.used}MB / ${this.metrics.memory.limit}MB`
        };
    }

    /**
     * Log formatted performance report to console
     */
    logReport() {
        const report = this.getReport();
        console.log('%c═══ PERFORMANCE REPORT ═══', 'color: #00ff00; font-weight: bold; font-size: 14px');
        console.log(`📊 FPS: ${report.fps}`);
        console.log(`⏱️  Frame Time: ${report.frameTime}`);
        console.log(`📈 Draw Calls: ${report.drawCalls}`);
        console.log(`🔺 Triangles: ${report.triangles.toLocaleString()}`);
        console.log(`🔸 Vertices: ${report.vertices.toLocaleString()}`);
        console.log(`🎨 Textures: ${report.textures}`);
        console.log(`💡 Active Lights: ${report.activeLights}`);
        console.log(`🌑 Shadow Maps: ${report.shadowMaps}`);
        console.log(`👁️  Visible Meshes: ${report.visibleMeshes}`);
        console.log(`🚫 Culled Meshes: ${report.culledMeshes}`);
        console.log(`📦 Total Meshes: ${report.totalMeshes}`);
        console.log(`💾 Memory: ${report.memory}`);
        console.log('%c═════════════════════════', 'color: #00ff00; font-weight: bold');
    }

    /**
     * Find performance bottlenecks
     */
    findBottlenecks() {
        const bottlenecks = [];

        if (this.metrics.fps < 30) {
            bottlenecks.push(`⚠️  Low FPS (${this.metrics.fps}fps) - Consider reducing quality`);
        }

        if (this.metrics.frameTime > 33) {
            bottlenecks.push(`⚠️  High frame time (${this.metrics.frameTime.toFixed(2)}ms) - Target <16.67ms for 60fps`);
        }

        if (this.metrics.drawCalls > 500) {
            bottlenecks.push(`⚠️  High draw calls (${this.metrics.drawCalls}) - Consider reducing mesh count`);
        }

        if (this.metrics.triangles > 5000000) {
            bottlenecks.push(`⚠️  High triangle count (${this.metrics.triangles.toLocaleString()}) - Consider LOD or simplification`);
        }

        if (this.metrics.activeLights > 30) {
            bottlenecks.push(`⚠️  Many active lights (${this.metrics.activeLights}) - Consider light culling`);
        }

        if (this.metrics.shadowMaps > 10) {
            bottlenecks.push(`⚠️  Many shadow maps (${this.metrics.shadowMaps}) - Consider selective shadows`);
        }

        if (this.metrics.culledMeshes === 0 && this.metrics.visibleMeshes > 500) {
            bottlenecks.push(`⚠️  Occlusion culling not active - ${this.metrics.visibleMeshes} meshes always rendered`);
        }

        if (bottlenecks.length === 0) {
            bottlenecks.push(`✅ Performance looks good!`);
        }

        return bottlenecks;
    }

    /**
     * Log bottleneck analysis
     */
    logBottlenecks() {
        const bottlenecks = this.findBottlenecks();
        console.log('%c═══ PERFORMANCE ANALYSIS ═══', 'color: #ffaa00; font-weight: bold; font-size: 14px');
        bottlenecks.forEach(bottleneck => console.log(bottleneck));
        console.log('%c═══════════════════════════', 'color: #ffaa00; font-weight: bold');
    }
}
