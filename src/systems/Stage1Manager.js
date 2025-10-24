// src/systems/Stage1Manager.js
// Manages the complete puzzle sequence for Stage 1 (The Journalist's Office)

import logger from '../utils/Logger.js';

export class Stage1Manager {
    constructor(scene, gameManager, mansionLoader, uiManager, audioManager, interactionSystem) {
        this.scene = scene;
        this.gameManager = gameManager;
        this.mansionLoader = mansionLoader;
        this.uiManager = uiManager;
        this.audioManager = audioManager;
        this.interactionSystem = interactionSystem;

        // Stage state tracking
        this.stage1Active = false;
        this.phoneAnswered = false;
        this.computerLoggedIn = false;
        this.reportFound = false;
        this.captureTriggered = false;

        // UI Overlay references
        this.computerOverlay = null;
        this.reportOverlay = null;

        logger.log('📋 Stage1Manager initialized');
    }

    /**
     * Initialize Stage 1 gameplay sequence
     */
    startStage1() {
        if (this.stage1Active) return;
        this.stage1Active = true;

        logger.log('🎬 Starting Stage 1 - The Journalist\'s Office');

        // Start the phone ring after 5 seconds
        setTimeout(() => {
            this.triggerPhoneCall();
        }, 5000);
    }

    /**
     * Step 1: Phone Call Trigger
     */
    triggerPhoneCall() {
        logger.log('☎️ Phone ringing...');

        // Play phone ringing sound
        this.audioManager.play('phone_ringing');

        // Set up desk interaction to answer
        const deskMesh = this.mansionLoader.getProp('desk') || this.findObjectByName('Desk');
        if (deskMesh) {
            deskMesh.userData.isInteractable = true;
            deskMesh.userData.onInteract = () => this.answerPhone();
        } else {
            logger.warn('⚠️ Desk object not found for phone interaction');
        }

        // Auto-answer after 15 seconds if player doesn't click
        setTimeout(() => {
            if (!this.phoneAnswered) {
                this.answerPhone();
            }
        }, 15000);
    }

    /**
     * Answer the phone and trigger voicemail
     */
    answerPhone() {
        if (this.phoneAnswered) return;
        this.phoneAnswered = true;

        logger.log('📞 Phone answered');

        // Stop ringing sound
        this.audioManager.stopSound('phone_ringing');

        // Play voicemail from editor
        this.audioManager.play('voicemail_editor');

        // Display message via UI
        this.uiManager.displayObjective({
            id: 'answer_telephone',
            title: 'Editor\'s Voicemail',
            description: 'You\'d better have a real story on this "Mansion" lead, or you\'re finished!'
        });

        // Unlock computer interaction
        setTimeout(() => {
            this.setupComputerInteraction();
        }, 3000);
    }

    /**
     * Step 2 & 3: Computer Login Setup
     */
    setupComputerInteraction() {
        logger.log('💻 Setting up computer interaction...');

        const computerMesh = this.mansionLoader.getProp('computer') || this.findObjectByName('Computer');
        if (computerMesh) {
            computerMesh.userData.isInteractable = true;
            computerMesh.userData.onInteract = () => this.openComputerLogin();
        } else {
            logger.warn('⚠️ Computer object not found');
        }

        // Also enable notepad hint
        this.setupNotepadHint();
    }

    /**
     * Notepad hint system
     */
    setupNotepadHint() {
        const notepadMesh = this.mansionLoader.getProp('notepad') || this.findObjectByName('Notepad');
        if (notepadMesh) {
            notepadMesh.userData.isInteractable = true;
            notepadMesh.userData.onInteract = () => {
                this.uiManager.displayObjective({
                    id: 'computer_password_hint',
                    title: 'Notepad',
                    description: 'Password hint: my first big break.'
                });
            };
        }
    }

    /**
     * Open computer login overlay
     */
    openComputerLogin() {
        if (this.computerLoggedIn) {
            this.openComputerDesktop();
            return;
        }

        logger.log('🔐 Opening computer login...');

        // Create HTML overlay for login
        const overlay = document.createElement('div');
        overlay.id = 'stage1-computer-login';
        overlay.className = 'computer-overlay';
        overlay.innerHTML = `
            <div class="computer-screen">
                <div class="login-container">
                    <h1>LOGIN</h1>
                    <div class="login-form">
                        <label>Username:</label>
                        <input type="text" id="username" value="journalist" disabled>

                        <label>Password:</label>
                        <input type="password" id="password" placeholder="Enter password...">

                        <button id="login-btn">LOGIN</button>
                        <div id="login-error" class="error-message"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.computerOverlay = overlay;

        // Set up event listeners
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('login-btn');
        const errorMsg = document.getElementById('login-error');

        loginBtn.addEventListener('click', () => {
            const password = passwordInput.value.toUpperCase().replace(/\s+/g, '');
            if (password === 'MINECOLLAPSE') {
                this.computerLoggedIn = true;
                overlay.remove();
                this.openComputerDesktop();
            } else {
                errorMsg.textContent = 'Incorrect password';
                passwordInput.value = '';
            }
        });

        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loginBtn.click();
            }
        });

        // Show hint about newspaper
        this.showNewspaperClue();
    }

    /**
     * Show newspaper clue
     */
    showNewspaperClue() {
        const newspaperMesh = this.findObjectByName('Newspaper') || this.findObjectByName('Paper');
        if (newspaperMesh) {
            newspaperMesh.userData.isInteractable = true;
            newspaperMesh.userData.onInteract = () => {
                this.uiManager.displayObjective({
                    id: 'newspaper_clue',
                    title: 'Newspaper Headline',
                    description: 'MINE COLLAPSE - Your biggest investigative piece. The password hint makes sense now.'
                });
            };
        }
    }

    /**
     * Step 3: Computer Desktop Interface
     */
    openComputerDesktop() {
        logger.log('🖥️ Opening computer desktop...');

        if (this.computerOverlay) {
            this.computerOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.id = 'stage1-computer-desktop';
        overlay.className = 'computer-overlay';
        overlay.innerHTML = `
            <div class="computer-screen desktop">
                <div class="taskbar">
                    <span>Journalist's Computer</span>
                    <button id="close-desktop" class="close-btn">✕</button>
                </div>
                <div class="desktop-icons">
                    <div class="file-icon clickable" data-file="interview">
                        <div class="icon">🎵</div>
                        <div class="label">Interview.wav</div>
                    </div>
                    <div class="file-icon clickable" data-file="mansion_layout">
                        <div class="icon">🗺️</div>
                        <div class="label">Mansion_Layout.jpg</div>
                    </div>
                    <div class="file-icon clickable" data-file="evidence">
                        <div class="icon">🔒</div>
                        <div class="label">Evidence.zip</div>
                    </div>
                    <div class="file-icon clickable" data-file="note">
                        <div class="icon">📝</div>
                        <div class="label">NOTE.txt</div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.computerOverlay = overlay;

        // Set up file interactions
        const fileIcons = overlay.querySelectorAll('.file-icon.clickable');
        fileIcons.forEach(icon => {
            icon.addEventListener('click', () => {
                const fileType = icon.dataset.file;
                this.handleFileClick(fileType);
            });
        });

        // Close button
        overlay.querySelector('#close-desktop').addEventListener('click', () => {
            overlay.remove();
            this.computerOverlay = null;
        });
    }

    /**
     * Handle file clicks on desktop
     */
    handleFileClick(fileType) {
        logger.log(`📂 Opening file: ${fileType}`);

        switch (fileType) {
            case 'interview':
                this.audioManager.play('interview_audio');
                this.uiManager.displayObjective({
                    id: 'interview_file',
                    title: 'Interview.wav',
                    description: 'Audio file playing... [You hear a detailed account of the mansion\'s dark history and the mysterious disappearance connected to it]'
                });
                break;

            case 'mansion_layout':
                this.showImageOverlay('Mansion Layout', 'mansion_blueprint.jpg');
                break;

            case 'note':
                this.uiManager.displayObjective({
                    id: 'note_file',
                    title: 'NOTE.txt',
                    description: 'ZIP password is the case number from the Miller disappearance.'
                });
                break;

            case 'evidence':
                this.promptForZipPassword();
                break;
        }
    }

    /**
     * Prompt for ZIP password
     */
    promptForZipPassword() {
        const password = prompt('Enter ZIP password (case number):');
        if (password === '8013') {
            this.unlockedEvidenceZip();
        } else if (password) {
            alert('Incorrect password. Try finding the missing persons report.');
        }
    }

    /**
     * Step 4: Physical Trail - Setup Missing Persons File
     */
    setupMissingPersonsFile() {
        logger.log('🔍 Setting up missing persons file interaction...');

        // Find the "loose book" on the bookshelf
        const bookMesh = this.findObjectByName('LooseBook') || this.findObjectByName('Book');
        if (bookMesh) {
            bookMesh.userData.isInteractable = true;
            bookMesh.userData.onInteract = () => this.retrieveMissingPersonsReport();
        }
    }

    /**
     * Retrieve missing persons report
     */
    retrieveMissingPersonsReport() {
        if (this.reportFound) return;
        this.reportFound = true;

        logger.log('📄 Retrieved missing persons report');

        // Add to inventory
        this.gameManager.addToInventory({
            name: 'Missing Persons Report',
            type: 'document',
            description: 'Case report for the Miller disappearance',
            caseNumber: 8013
        });

        // Visual feedback
        this.uiManager.displayObjective({
            id: 'found_report',
            title: 'Found Report',
            description: 'You found a hidden missing persons report behind a loose book on the shelf. Case No. 8013'
        });

        // Set up inventory click to view report
        // This will be handled by the GameManager inventory system
    }

    /**
     * Step 5: The Trap Sequence
     */
    unlockedEvidenceZip() {
        if (this.captureTriggered) return;
        this.captureTriggered = true;

        logger.log('⚠️ TRAP TRIGGERED - Capture sequence initiated');

        // Close any open overlays
        if (this.computerOverlay) {
            this.computerOverlay.remove();
        }

        // Start the trap sequence
        this.executeCaptureSequence();
    }

    /**
     * Execute the dramatic capture sequence
     */
    async executeCaptureSequence() {
        try {
            // Phase 1: Display symbol image with flickering
            await this.displaySymbolImage();

            // Phase 2: Door unlocks with sound
            this.audioManager.play('door_unlock_click');

            // Phase 3: Read me message
            await this.displayReadMeMessage();

            // Phase 4: Door bangs - impact on screen
            this.audioManager.play('door_bang_1');
            this.shakeCamera(0.5);

            // Wait 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Phase 5: Second, louder bang
            this.audioManager.play('door_bang_2_loud');
            this.shakeCamera(1);

            // Wait 500ms
            await new Promise(resolve => setTimeout(resolve, 500));

            // Phase 6: Final thud and blackout
            this.audioManager.play('door_thud');
            await this.fadeToBlack();

            // Transition to Stage 2
            this.transitionToStage2();

        } catch (error) {
            logger.error('Error in capture sequence:', error);
        }
    }

    /**
     * Display the symbol image
     */
    displaySymbolImage() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.id = 'symbol-display';
            overlay.className = 'computer-overlay';
            overlay.innerHTML = `
                <div class="computer-screen">
                    <div class="symbol-container flicker">
                        <img src="/assets/symbol.jpg" alt="Symbol" class="symbol-image">
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Flicker for 2 seconds then resolve
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 2000);
        });
    }

    /**
     * Display READ_ME.txt message
     */
    displayReadMeMessage() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.id = 'readme-display';
            overlay.className = 'computer-overlay';
            overlay.innerHTML = `
                <div class="computer-screen readme">
                    <div class="readme-container">
                        <h2>READ_ME.txt</h2>
                        <p>You wanted a story.</p>
                        <p>Now you have one.</p>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            // Show for 2 seconds
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 2000);
        });
    }

    /**
     * Camera shake effect
     */
    shakeCamera(intensity = 0.5) {
        const camera = window.gameControls.camera;
        if (!camera) return;

        const originalPos = {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z
        };

        const shakeAmount = intensity;
        const shakeDuration = 300;
        const startTime = Date.now();

        const shake = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed >= shakeDuration) {
                camera.position.copy(originalPos);
                return;
            }

            camera.position.x = originalPos.x + (Math.random() - 0.5) * shakeAmount;
            camera.position.y = originalPos.y + (Math.random() - 0.5) * shakeAmount;
            camera.position.z = originalPos.z + (Math.random() - 0.5) * shakeAmount;

            requestAnimationFrame(shake);
        };

        shake();
    }

    /**
     * Fade screen to black
     */
    fadeToBlack() {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.id = 'blackout';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: black;
                opacity: 0;
                z-index: 10000;
                transition: opacity 1s ease-in;
            `;
            document.body.appendChild(overlay);

            // Trigger fade
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
            });

            setTimeout(resolve, 1000);
        });
    }

    /**
     * Transition to Stage 2
     */
    async transitionToStage2() {
        logger.log('🎬 Transitioning to Stage 2...');

        // Use narrative manager to transition stages if available
        if (window.gameControls && window.gameControls.narrativeManager) {
            await window.gameControls.narrativeManager.transitionToStage('mansion', 0, 500);
        }
    }

    /**
     * Show image overlay
     */
    showImageOverlay(title, imagePath) {
        const overlay = document.createElement('div');
        overlay.className = 'image-overlay';
        overlay.innerHTML = `
            <div class="image-container">
                <div class="image-header">
                    <h2>${title}</h2>
                    <button class="close-btn">✕</button>
                </div>
                <img src="/assets/${imagePath}" alt="${title}">
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.close-btn').addEventListener('click', () => {
            overlay.remove();
        });
    }

    /**
     * Helper: Find object by name in the scene
     */
    findObjectByName(name) {
        let found = null;
        this.scene.traverse((child) => {
            if (child.name === name || child.name.toLowerCase() === name.toLowerCase()) {
                found = child;
            }
        });
        return found;
    }

    /**
     * Tick update
     */
    tick(delta) {
        // Update any animated elements here
    }

    /**
     * Clean up when stage ends
     */
    dispose() {
        if (this.computerOverlay) {
            this.computerOverlay.remove();
        }
        logger.log('🧹 Stage1Manager disposed');
    }
}
