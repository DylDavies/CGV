// src/systems/RendererManager.js - Single WebGL context renderer management
// Production-standard pattern: Single renderer for all scenes

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';
import logger from '../utils/Logger.js';

class RendererManager {
    constructor(containerId = 'game-container') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with id "${containerId}" not found`);
        }

        this.renderer = null;
        this.canvas = null;
        this.settings = this.loadSettings();

        logger.log('🎨 RendererManager initialized');
    }

    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('gameSettings');
            return savedSettings ? JSON.parse(savedSettings) : { quality: 'medium', antialiasing: false };
        } catch (e) {
            logger.warn('⚠️ Failed to load renderer settings:', e);
            return { quality: 'medium', antialiasing: false };
        }
    }

    /**
     * Initialize the single WebGL renderer
     * Called once at application startup
     */
    initialize() {
        if (this.renderer) {
            logger.warn('⚠️ Renderer already initialized');
            return this.renderer;
        }

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'game-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: block;
            z-index: 9;
            visibility: hidden;
        `;
        this.container.appendChild(this.canvas);

        // Create single WebGL renderer (reused for all scenes)
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: this.settings.antialiasing || false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
        });

        this.renderer.physicallyCorrectLights = true;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Shadow configuration
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.shadowMap.autoUpdate = true;

        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        logger.log('🎨 Single WebGL renderer initialized');
        return this.renderer;
    }

    /**
     * Get the single renderer instance
     */
    getRenderer() {
        return this.renderer;
    }

    /**
     * Render a scene with a camera
     * The same renderer is used for all scenes
     */
    render(scene, camera) {
        if (this.renderer && scene && camera) {
            this.renderer.render(scene, camera);
        }
    }

    /**
     * Handle window resize
     * Updates renderer size (single canvas)
     */
    onWindowResize() {
        if (this.renderer) {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    /**
     * Show the canvas when game starts
     */
    showCanvas() {
        if (this.canvas) {
            this.canvas.style.visibility = 'visible';
            this.canvas.style.zIndex = '10';
            logger.log('🎮 Canvas made visible');
        }
    }

    /**
     * Hide the canvas when game stops
     */
    hideCanvas() {
        if (this.canvas) {
            this.canvas.style.visibility = 'hidden';
            this.canvas.style.zIndex = '9';
            logger.log('🎮 Canvas hidden');
        }
    }

    /**
     * Dispose renderer (called on app shutdown)
     */
    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer = null;
        }
        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }
        logger.log('🗑️ RendererManager disposed');
    }
}

export { RendererManager };
