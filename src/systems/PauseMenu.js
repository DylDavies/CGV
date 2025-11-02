// src/systems/PauseMenu.js - Pause menu with settings

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class PauseMenu {
    constructor(renderer, controls, loop) {
        this.renderer = renderer;
        this.controls = controls;
        this.loop = loop;
        this.isPaused = false;
        this.menuElement = null;

        // Settings - load from localStorage first, then use defaults if not present
        this.loadSettingsFromStorage();

        this.createMenu();
        this.setupControls();

        // Dispatch initial quality change event to ensure all systems sync with loaded settings
        // This is important because PauseMenu is created after other systems
        setTimeout(() => {
            console.log(`Dispatching initial quality sync event: ${this.settings.quality}`);
            window.dispatchEvent(new CustomEvent('qualitychange', {
                detail: { quality: this.settings.quality }
            }));
        }, 100); // Small delay to ensure all systems are ready

        console.log('Pause menu initialized with quality:', this.settings.quality);
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
                <button class="tab-btn" data-tab="audio" style="background: #333; border: 1px solid #555; color: #aaa; padding: 10px 20px; cursor: pointer;">Audio</button>
                <button class="tab-btn" data-tab="video" style="background: #333; border: 1px solid #555; color: #aaa; padding: 10px 20px; cursor: pointer;">Video</button>
            </div>

            <div class="settings-content">
                <div id="controls-tab" class="tab-content active" style="display: block;">
                    <h2 style="margin-bottom: 15px;">Key Binds</h2>
                    <ul class="controls-list" style="list-style: none; padding: 0; text-align: left; max-width: 400px; margin: 0 auto;">
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">W, A, S, D</span><span>Move</span></li>
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">Mouse</span><span>Look</span></li>
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">Shift</span><span>Run</span></li> 
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">E / Left Click</span><span>Interact</span></li>              
                        <li style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #333;"><span style="color: #ff6666; font-weight: bold;">ESC</span><span>Pause Menu</span></li>
                    </ul>
                </div>

                <div id="audio-tab" class="tab-content" style="display: none;">
                    <h2 style="margin-bottom: 15px;">Audio Settings</h2>

                    <!-- Master Volume -->
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; margin-bottom: 15px; text-align: left; max-width: 400px; margin: 0 auto 15px auto;">
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <label style="display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold;">
                                <span>Master Volume</span>
                                <span class="master-volume-value" style="color: #ff6666; font-weight: bold; min-width: 45px; text-align: right;">100%</span>
                            </label>
                            <input type="range" id="master-volume" min="0" max="100" value="100" style="width: 100%; height: 6px; border-radius: 3px; background: #333; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
                        </div>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #aaa;">Overall game volume level</p>
                    </div>

                    <!-- Music Volume -->
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; margin-bottom: 15px; text-align: left; max-width: 400px; margin: 0 auto 15px auto;">
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <label style="display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold;">
                                <span>Music Volume</span>
                                <span class="music-volume-value" style="color: #ff6666; font-weight: bold; min-width: 45px; text-align: right;">90%</span>
                            </label>
                            <input type="range" id="music-volume" min="0" max="100" value="90" style="width: 100%; height: 6px; border-radius: 3px; background: #333; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
                        </div>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #aaa;">Background music</p>
                    </div>

                    <!-- SFX Volume -->
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; margin-bottom: 15px; text-align: left; max-width: 400px; margin: 0 auto 15px auto;">
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <label style="display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold;">
                                <span>Effects Volume</span>
                                <span class="sfx-volume-value" style="color: #ff6666; font-weight: bold; min-width: 45px; text-align: right;">95%</span>
                            </label>
                            <input type="range" id="sfx-volume" min="0" max="100" value="95" style="width: 100%; height: 6px; border-radius: 3px; background: #333; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
                        </div>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #aaa;">Sound effects and interactions</p>
                    </div>

                    <!-- Ambience Volume -->
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; margin-bottom: 15px; text-align: left; max-width: 400px; margin: 0 auto 15px auto;">
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <label style="display: flex; justify-content: space-between; align-items: center; font-size: 16px; font-weight: bold;">
                                <span>Ambience Volume</span>
                                <span class="ambience-volume-value" style="color: #ff6666; font-weight: bold; min-width: 45px; text-align: right;">50%</span>
                            </label>
                            <input type="range" id="ambience-volume" min="0" max="100" value="50" style="width: 100%; height: 6px; border-radius: 3px; background: #333; outline: none; -webkit-appearance: none; appearance: none; cursor: pointer;">
                        </div>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #aaa;">Environmental and atmospheric sounds</p>
                    </div>
                </div>

                <div id="video-tab" class="tab-content" style="display: none;">
                    <h2 style="margin-bottom: 15px;">Graphics Settings</h2>

                    <!-- Quality Preset -->
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; margin-bottom: 15px; text-align: left; max-width: 400px; margin: 0 auto 15px auto;">
                        <label style="display: block; font-size: 16px; margin-bottom: 10px;">
                            <span style="font-weight: bold;">Quality Preset</span>
                        </label>
                        <select id="quality-select" style="width: 100%; padding: 10px; background: #222; color: #fff; border: 1px solid #555; font-size: 14px; font-family: 'Courier New', monospace; cursor: pointer;">
                            <option value="low" ${this.settings.quality === 'low' ? 'selected' : ''}>Low (Minimum)</option>
                            <option value="medium" ${this.settings.quality === 'medium' ? 'selected' : ''}>Medium (Balanced)</option>
                            <option value="high" ${this.settings.quality === 'high' ? 'selected' : ''}>High (Recommended)</option>
                            <option value="ultra" ${this.settings.quality === 'ultra' ? 'selected' : ''}>Ultra (Maximum)</option>
                        </select>
                        <p style="margin: 8px 0 0 0; font-size: 12px; color: #aaa;">
                            Adjusts shadows, particles, lights, and effects
                        </p>
                    </div>

                    <!-- Anti-aliasing -->
                    <div style="background: rgba(0,0,0,0.3); padding: 15px; margin-bottom: 15px; text-align: left; max-width: 400px; margin: 0 auto 15px auto;">
                        <label style="display: flex; align-items: center; cursor: pointer; font-size: 16px;">
                            <input type="checkbox" id="antialiasing-toggle" style="margin-right: 10px; width: 20px; height: 20px; cursor: pointer;" ${this.settings.antialiasing ? 'checked' : ''}>
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
        const qualitySelect = menuContent.querySelector('#quality-select');
        qualitySelect.value = this.settings.quality; // Set the initial value

        // Anti-aliasing toggle
        const aaToggle = menuContent.querySelector('#antialiasing-toggle');
        aaToggle.checked = this.settings.antialiasing;
        
        // Use Event Delegation for the change event.
        menuContent.addEventListener('change', (e) => {
            // Check if the event was triggered by our quality select dropdown.
            if (e.target.id === 'quality-select') {
                console.log("Quality dropdown changed to:", e.target.value);
                this.settings.quality = e.target.value;
                this.saveSettings();
                this.applyQualitySettings();
            }

            // Check if the event was triggered by our anti-aliasing toggle.
            if (e.target.id === 'antialiasing-toggle') {
                this.settings.antialiasing = e.target.checked;
                this.saveSettings();
                this.applySettings();
            }
        });

        // Add audio slider event listeners
        this.addAudioListeners(menuContent);
    }

    addAudioListeners(menuContent) {
        const masterVolumeSlider = menuContent.querySelector('#master-volume');
        const musicVolumeSlider = menuContent.querySelector('#music-volume');
        const sfxVolumeSlider = menuContent.querySelector('#sfx-volume');
        const ambienceVolumeSlider = menuContent.querySelector('#ambience-volume');

        // Initialize sliders with saved values and update display
        if (masterVolumeSlider) {
            const masterValue = this.settings.audio.master !== undefined ? this.settings.audio.master : 1.0;
            masterVolumeSlider.value = masterValue * 100;
            const masterDisplay = menuContent.querySelector('.master-volume-value');
            if (masterDisplay) masterDisplay.textContent = Math.round(masterValue * 100) + '%';
        }
        if (musicVolumeSlider) {
            const musicValue = this.settings.audio.music !== undefined ? this.settings.audio.music : 0.9;
            musicVolumeSlider.value = musicValue * 100;
            const musicDisplay = menuContent.querySelector('.music-volume-value');
            if (musicDisplay) musicDisplay.textContent = Math.round(musicValue * 100) + '%';
        }
        if (sfxVolumeSlider) {
            const sfxValue = this.settings.audio.sfx !== undefined ? this.settings.audio.sfx : 0.95;
            sfxVolumeSlider.value = sfxValue * 100;
            const sfxDisplay = menuContent.querySelector('.sfx-volume-value');
            if (sfxDisplay) sfxDisplay.textContent = Math.round(sfxValue * 100) + '%';
        }
        if (ambienceVolumeSlider) {
            const ambienceValue = this.settings.audio.ambience !== undefined ? this.settings.audio.ambience : 0.5;
            ambienceVolumeSlider.value = ambienceValue * 100;
            const ambienceDisplay = menuContent.querySelector('.ambience-volume-value');
            if (ambienceDisplay) ambienceDisplay.textContent = Math.round(ambienceValue * 100) + '%';
        }

        // Master volume
        if (masterVolumeSlider) {
            masterVolumeSlider.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                this.settings.audio.master = value;
                const displayEl = menuContent.querySelector('.master-volume-value');
                if (displayEl) displayEl.textContent = e.target.value + '%';
                this.applyAudioSettings();
            });
        }

        // Music volume
        if (musicVolumeSlider) {
            musicVolumeSlider.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                this.settings.audio.music = value;
                const displayEl = menuContent.querySelector('.music-volume-value');
                if (displayEl) displayEl.textContent = e.target.value + '%';
                this.applyAudioSettings();
            });
        }

        // SFX volume
        if (sfxVolumeSlider) {
            sfxVolumeSlider.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                this.settings.audio.sfx = value;
                const displayEl = menuContent.querySelector('.sfx-volume-value');
                if (displayEl) displayEl.textContent = e.target.value + '%';
                this.applyAudioSettings();
            });
        }

        // Ambience volume
        if (ambienceVolumeSlider) {
            ambienceVolumeSlider.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                this.settings.audio.ambience = value;
                const displayEl = menuContent.querySelector('.ambience-volume-value');
                if (displayEl) displayEl.textContent = e.target.value + '%';
                this.applyAudioSettings();
            });
        }
    }

    applyAudioSettings() {
        this.saveSettings();
        // Dispatch event that AudioManager can listen to
        window.dispatchEvent(new CustomEvent('audiochange', {
            detail: { audio: this.settings.audio }
        }));
        console.log('🔊 Audio settings updated:', this.settings.audio);
    }

    setupControls() {
        // Listen for pointer lock changes - when ESC is pressed and pointer unlocks, show pause menu
        document.addEventListener('pointerlockchange', () => {
            // If pointer was unlocked and we're not already paused, show pause menu
            // BUT: Don't show if controls are frozen (puzzle/interaction is active)
            // Add a small delay to handle cases where the pointer is being relocked after a puzzle closes
            if (!document.pointerLockElement && !this.isPaused && !this.controls.isFrozen) {
                setTimeout(() => {
                    // Double-check after delay - if pointer is still unlocked and controls still not frozen, show menu
                    if (!document.pointerLockElement && !this.isPaused && !this.controls.isFrozen) {
                        this.show();
                    }
                }, 150); // Wait slightly longer than the unfreeze delay
            }
        });

        // Prevent F10 from being caught by pause menu (let physics manager handle it)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'F10') {
                e.stopPropagation();
            }
        }, true); // Use capture phase to intercept before other listeners
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

        console.log('Pause menu shown');
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
        console.log('💾 Settings saved:', this.settings);
    }

    loadSettingsFromStorage() {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            try {
                this.settings = JSON.parse(saved);
                // Ensure defaults for missing properties
                if (!this.settings.quality) {
                    this.settings.quality = 'medium';
                }
                if (this.settings.antialiasing === undefined) {
                    this.settings.antialiasing = false;
                }
                // Audio settings with defaults
                if (this.settings.audio === undefined) {
                    this.settings.audio = {
                        master: 1.0,
                        music: 0.9,
                        sfx: 0.95,
                        ambience: 0.5
                    };
                }
                console.log('📂 Settings loaded from localStorage:', this.settings);
            } catch (e) {
                console.error('❌ Failed to load settings, using defaults:', e);
                this.settings = {
                    antialiasing: false,
                    quality: 'medium',
                    audio: {
                        master: 1.0,
                        music: 0.9,
                        sfx: 0.95,
                        ambience: 0.5
                    }
                };
            }
        } else {
            // No saved settings, use defaults
            this.settings = {
                antialiasing: false,
                quality: 'medium',
                audio: {
                    master: 1.0,
                    music: 0.9,
                    sfx: 0.95,
                    ambience: 0.5
                }
            };
            console.log('📂 No saved settings, using defaults');
        }
    }

    applySettings() {
        // Anti-aliasing requires page reload
        if (this.renderer && this.settings.antialiasing !== this.renderer.getContext().getContextAttributes().antialias) {
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
                dustParticles: 100, // Reduced from 150 for better low-end performance
                fireParticles: 10, // Reduced from 15
                lampUpdateRate: 6, // Reduced from 4 (update less frequently)
                fireplaceUpdateRate: 6, // Reduced from 4
                maxVisibleDistance: 10, // Reduced from 12 for less rendering
                shadows: false, // Shadows disabled for performance
                shadowMapSize: 512
            },
            medium: {
                dustParticles: 250,
                fireParticles: 25,
                lampUpdateRate: 3, // Update every 3rd frame
                fireplaceUpdateRate: 3,
                maxVisibleDistance: 15,
                shadows: true, // Basic shadows enabled
                shadowMapSize: 1024
            },
            high: {
                dustParticles: 500,
                fireParticles: 50,
                lampUpdateRate: 2, // Update every 2nd frame
                fireplaceUpdateRate: 2,
                maxVisibleDistance: 20,
                shadows: true, // High-quality shadows
                shadowMapSize: 2048
            },
            ultra: {
                dustParticles: 1500, // Increased from 1000 for high-end showcase
                fireParticles: 150, // Increased from 100
                lampUpdateRate: 1, // Update every frame
                fireplaceUpdateRate: 1,
                maxVisibleDistance: 30, // Increased from 25 for more visible rooms
                shadows: true, // Ultra-quality shadows
                shadowMapSize: 4096
            }
        };

        return presets[this.settings.quality] || presets.medium;
    }

    tick(delta) {
        // Pause menu doesn't need tick updates
    }
}

export { PauseMenu };
