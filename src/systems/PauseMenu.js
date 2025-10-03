// src/systems/PauseMenu.js - Pause menu with settings

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class PauseMenu {
    constructor(renderer, controls, loop) {
        this.renderer = renderer;
        this.controls = controls;
        this.loop = loop;
        this.isPaused = false;
        this.menuElement = null;

        // Settings
        this.settings = {
            antialiasing: false, // Default off for performance
            quality: 'medium' // low, medium, high
        };

        this.createMenu();
        this.setupControls();

        console.log('⏸️ Pause menu initialized');
    }

    createMenu() {
        // Create overlay
        this.menuElement = document.createElement('div');
        this.menuElement.id = 'pause-menu';
        this.menuElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            backdrop-filter: blur(5px);
        `;

        // Create menu content - matching settings-screen.css style
        const menuContent = document.createElement('div');
        menuContent.style.cssText = `
            background: #111;
            border: 2px solid #555;
            padding: 30px;
            width: 90%;
            max-width: 700px;
            color: white;
            font-family: 'Courier New', monospace;
            text-align: center;
        `;

        menuContent.innerHTML = `
            <h1 style="margin: 0 0 20px 0; text-align: center; color: #fff; font-size: 28px;">
                PAUSED
            </h1>

            <div class="settings-tabs" style="margin-bottom: 20px;">
                <button class="tab-btn active" data-tab="controls" style="background: #555; border: 1px solid #555; color: #fff; padding: 10px 20px; cursor: pointer;">Controls</button>
                <button class="tab-btn" data-tab="video" style="background: #333; border: 1px solid #555; color: #aaa; padding: 10px 20px; cursor: pointer;">Video</button>
            </div>

            <div class="settings-content">
                <div id="controls-tab" class="tab-content active" style="display: block;">
                    <h2 style="margin-bottom: 15px;">Key Binds</h2>
                    <ul class="controls-list" style="list-style: none; padding: 0; text-align: left; max-width: 400px; margin: 0 auto;">
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">W, A, S, D</span><span>Move</span></li>
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">Mouse</span><span>Look</span></li>
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">Shift</span><span>Run</span></li>
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">Space</span><span>Jump</span></li>
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">F</span><span>Toggle Flashlight</span></li>
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">ESC</span><span>Pause Menu</span></li>
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">F10</span><span>Fly Mode (Dev)</span></li>
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">F11</span><span>Stats (Dev)</span></li>
                    </ul>
                </div>

                <div id="video-tab" class="tab-content" style="display: none;">
                    <h2 style="margin-bottom: 15px;">Graphics Settings</h2>

                    <!-- Quality Preset -->
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; margin-bottom: 15px; text-align: left; max-width: 400px; margin: 0 auto 15px auto;">
                        <label style="display: block; font-size: 16px; margin-bottom: 10px;">
                            <span style="font-weight: bold;">Quality Preset</span>
                        </label>
                        <select id="quality-select" style="width: 100%; padding: 10px; background: #222; color: #fff; border: 1px solid #555; font-size: 14px; font-family: 'Courier New', monospace; cursor: pointer;">
                            <option value="low">Low (Minimum)</option>
                            <option value="medium" selected>Medium (Balanced)</option>
                            <option value="high">High (Recommended)</option>
                            <option value="ultra">Ultra (Maximum)</option>
                        </select>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #aaa;">
                            Adjusts particles, lights, and effects
                        </p>
                    </div>

                    <!-- Anti-aliasing -->
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; margin-bottom: 15px; text-align: left; max-width: 400px; margin: 0 auto 15px auto;">
                        <label style="display: flex; align-items: center; cursor: pointer; font-size: 16px;">
                            <input type="checkbox" id="antialiasing-toggle" style="margin-right: 10px; width: 20px; height: 20px; cursor: pointer;">
                            <span>Anti-aliasing (restart required)</span>
                        </label>
                        <p style="margin: 8px 0 0 30px; font-size: 12px; color: #aaa;">
                            Smoother edges but lower performance
                        </p>
                    </div>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 30px;">
                <button id="resume-btn" class="menu-btn" style="
                    padding: 15px;
                    background: #333;
                    color: white;
                    border: 1px solid #555;
                    font-size: 18px;
                    font-family: 'Courier New', monospace;
                    cursor: pointer;
                    transition: all 0.2s;
                ">Resume</button>

                <button id="restart-btn" class="menu-btn" style="
                    padding: 12px;
                    background: #333;
                    color: white;
                    border: 1px solid #555;
                    font-size: 16px;
                    font-family: 'Courier New', monospace;
                    cursor: pointer;
                    transition: all 0.2s;
                ">Restart</button>
            </div>
        `;

        this.menuElement.appendChild(menuContent);
        document.body.appendChild(this.menuElement);

        // Setup tab switching
        const tabButtons = this.menuElement.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTab = e.target.getAttribute('data-tab');

                // Update active tab button
                tabButtons.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '#333';
                    b.style.color = '#aaa';
                });
                e.target.classList.add('active');
                e.target.style.background = '#555';
                e.target.style.color = '#fff';

                // Update active tab content
                const tabs = this.menuElement.querySelectorAll('.tab-content');
                tabs.forEach(tab => tab.style.display = 'none');
                this.menuElement.querySelector(`#${targetTab}-tab`).style.display = 'block';
            });
        });

        // Setup button handlers
        document.getElementById('resume-btn').addEventListener('click', () => {
            if (!this.canResume) return; // Ignore clicks if not ready

            this.hide();
            // Small delay before locking pointer (browser requires time between unlock/lock)
            setTimeout(() => {
                if (this.controls) {
                    this.controls.lock();
                }
            }, 100);
        });
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());

        // Quality preset selector
        const qualitySelect = document.getElementById('quality-select');
        qualitySelect.value = this.settings.quality;
        qualitySelect.addEventListener('change', (e) => {
            this.settings.quality = e.target.value;
            this.saveSettings();
            this.applyQualitySettings();
        });

        // Anti-aliasing toggle
        const aaToggle = document.getElementById('antialiasing-toggle');
        aaToggle.checked = this.settings.antialiasing;
        aaToggle.addEventListener('change', (e) => {
            this.settings.antialiasing = e.target.checked;
            this.saveSettings();
            this.applySettings();
        });

        // Load saved settings
        this.loadSettings();
    }

    setupControls() {
        // Listen for pointer lock changes - when ESC is pressed and pointer unlocks, show pause menu
        document.addEventListener('pointerlockchange', () => {
            // If pointer was unlocked and we're not already paused, show pause menu
            if (!document.pointerLockElement && !this.isPaused) {
                this.show();
            }
        });
    }

    show() {
        this.isPaused = true;
        this.menuElement.style.display = 'flex';

        // Pause the game loop
        if (this.loop) {
            this.loop.pause();
        }

        // Unlock pointer controls and exit pointer lock
        if (this.controls && this.controls.isLocked) {
            this.controls.unlock();
        }

        // Force exit pointer lock
        if (document.pointerLockElement) {
            document.exitPointerLock();
        }

        // Disable resume button and ESC key for 100ms to let browser process unlock
        this.canResume = false;
        const resumeBtn = document.getElementById('resume-btn');
        if (resumeBtn) {
            resumeBtn.disabled = true;
            resumeBtn.style.opacity = '0.5';
            resumeBtn.style.cursor = 'not-allowed';
        }

        setTimeout(() => {
            this.canResume = true;
            if (resumeBtn) {
                resumeBtn.disabled = false;
                resumeBtn.style.opacity = '1';
                resumeBtn.style.cursor = 'pointer';
            }
        }, 1000);

        console.log('⏸️ Pause menu shown');
    }

    hide() {
        this.isPaused = false;
        this.menuElement.style.display = 'none';

        // Resume the game loop
        if (this.loop) {
            this.loop.resume();
        }

        console.log('▶️ Pause menu hidden');
    }

    toggle() {
        if (this.isPaused) {
            this.hide();
        } else {
            this.show();
        }
    }

    restart() {
        if (confirm('Restart the game? All progress will be lost.')) {
            window.location.reload();
        }
    }

    saveSettings() {
        localStorage.setItem('gameSettings', JSON.stringify(this.settings));
        console.log('💾 Settings saved');
    }

    loadSettings() {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            this.settings = JSON.parse(saved);
            // Set default quality if not present
            if (!this.settings.quality) {
                this.settings.quality = 'medium';
            }
            document.getElementById('antialiasing-toggle').checked = this.settings.antialiasing;
            document.getElementById('quality-select').value = this.settings.quality;
            console.log('📂 Settings loaded:', this.settings);
        }
    }

    applySettings() {
        // Anti-aliasing requires page reload
        if (this.settings.antialiasing !== this.renderer.getContext().getContextAttributes().antialias) {
            console.log('⚠️ Anti-aliasing change requires restart');

            // Show notification
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #4a6fa5;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10001;
                font-family: 'Courier New', monospace;
            `;
            notification.textContent = '⚠️ Restart required for anti-aliasing change';
            document.body.appendChild(notification);

            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }

    applyQualitySettings() {
        console.log(`🎨 Applying ${this.settings.quality} quality settings`);

        // Notify user that quality settings are applied
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4a6fa5;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-family: 'Courier New', monospace;
        `;
        notification.textContent = `✅ Quality set to ${this.settings.quality}`;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 2000);

        // Emit custom event that other systems can listen to
        window.dispatchEvent(new CustomEvent('qualitychange', {
            detail: { quality: this.settings.quality }
        }));
    }

    getSettings() {
        return this.settings;
    }

    getQualityPreset() {
        const presets = {
            low: {
                dustParticles: 150,
                fireParticles: 15,
                lampUpdateRate: 4, // Update every 4th frame
                fireplaceUpdateRate: 4,
                maxVisibleDistance: 12
            },
            medium: {
                dustParticles: 250,
                fireParticles: 25,
                lampUpdateRate: 3, // Update every 3rd frame
                fireplaceUpdateRate: 3,
                maxVisibleDistance: 15
            },
            high: {
                dustParticles: 500,
                fireParticles: 50,
                lampUpdateRate: 2, // Update every 2nd frame
                fireplaceUpdateRate: 2,
                maxVisibleDistance: 20
            },
            ultra: {
                dustParticles: 1000,
                fireParticles: 100,
                lampUpdateRate: 1, // Update every frame
                fireplaceUpdateRate: 1,
                maxVisibleDistance: 25
            }
        };

        return presets[this.settings.quality] || presets.medium;
    }

    tick(delta) {
        // Pause menu doesn't need tick updates
    }
}

export { PauseMenu };
