// src/systems/QTEManager.js
import logger from '../utils/Logger.js'; // Ensure logger is imported

const QTE_TYPES = {
    BUTTON_MASH: 'buttonMash',
    SKILL_CHECK: 'skillCheck',
    BOUNCING_RING: 'bouncingRing'
};

class QTEManager {
    constructor(uiManager, controls) {
        this.uiManager = uiManager;
        this.controls = controls; // PlayerControls instance

        this.activeQTE = null; // { type, key, duration, startTime, timeLeft, onSuccess, onFailure, state }
        this.rafId = null; // For requestAnimationFrame

        this.lastTimestamp = null;

        logger.log('⚡ QTEManager Initialized'); // Use logger
    }

    isActive() {
        return !!this.activeQTE;
    }

    startQTE(type, options = {}) {
        if (this.isActive()) {
            logger.warn("QTEManager: Cannot start QTE while another is active."); // Use logger
            return;
        }

        const {
            key = 'Space', // Default key
            duration = 5000, // Default duration in ms
            onSuccess = () => logger.log("QTE Success!"), // Use logger
            onFailure = () => logger.log("QTE Failure!"), // Use logger
            // Specific options
            requiredPresses = 15, // For button mash
            successZoneSize = 40, // For skill check (degrees)
            needleSpeed = 360, // For skill check (degrees per second)
            initialZoneSize = 60, // For bouncing ring (degrees)
            requiredLoops = 3, // For bouncing ring
            indicatorSpeed = 200 // For bouncing ring (degrees per second)
        } = options;

        logger.log(`⚡ Starting QTE: ${type}`); // Use logger
        this.controls?.freeze(); // Freeze player movement

        this.activeQTE = {
            type,
            key,
            duration,
            startTime: performance.now(),
            timeLeft: duration,
            onSuccess,
            onFailure,
            state: {}, // QTE-specific state
        };

        // Initialize QTE-specific state and UI
        switch (type) {
            case QTE_TYPES.BUTTON_MASH:
                this.activeQTE.state = {
                    requiredPresses,
                    currentPresses: 0,
                    targetKeyDisplay: key === 'Space' ? 'SPACE' : key.replace('Key', ''),
                };
                this.uiManager.showButtonMashQTE(this.activeQTE.state.targetKeyDisplay);
                this.uiManager.updateButtonMashProgress(0);
                this.uiManager.updateButtonMashTimer(1);
                break;

            case QTE_TYPES.SKILL_CHECK:
                 // Ensure THREE is available if needed, or use Math.random directly
                const successZoneStart = (typeof THREE !== 'undefined' ? THREE.MathUtils.randFloat(0, 360 - successZoneSize) : Math.random() * (360 - successZoneSize));
                this.activeQTE.state = {
                    needleSpeed,
                    currentAngle: 0,
                    successZoneStart: successZoneStart,
                    // Handle wrap around for end zone
                    successZoneEnd: (successZoneStart + successZoneSize), // Calculate end angle first
                    triggered: false,
                    targetKeyDisplay: key === 'Space' ? 'SPACE' : key.replace('Key', ''),
                };
                 // Pass normalized end angle if needed by UI, or handle wrap in UI
                this.uiManager.showSkillCheckQTE(
                    this.activeQTE.state.targetKeyDisplay,
                    this.activeQTE.state.successZoneStart,
                    successZoneSize // Pass size instead of end angle for simplicity
                );
                this.uiManager.updateSkillCheckNeedle(0);
                break;

            case QTE_TYPES.BOUNCING_RING:
                 // Define zone centers (West=180, East=0/360)
                 const westZoneCenter = 180;
                 const eastZoneCenter = 0; // or 360
                 const startNearEast = Math.random() > 0.5;
                 const startAngleOffset = initialZoneSize / 4; // Start slightly inside a zone

                 this.activeQTE.state = {
                    indicatorSpeed,
                    // Start slightly within one of the zones
                    currentAngle: startNearEast ? (eastZoneCenter + startAngleOffset) % 360 : (westZoneCenter + startAngleOffset) % 360,
                    direction: Math.random() > 0.5 ? 1 : -1, // Random initial direction
                    currentZoneSize: initialZoneSize,
                    requiredLoops,
                    completedLoops: 0,
                    // Initial target should be the *opposite* zone from where it starts moving towards
                    nextBounceTarget: startNearEast ? ( (Math.random() > 0.5 ? 1 : -1) === 1 ? 'right' : 'left') : ( (Math.random() > 0.5 ? 1 : -1) === 1 ? 'right' : 'left'), // Target depends on initial direction
                    // Store zone centers for checks
                    westZoneCenter: westZoneCenter,
                    eastZoneCenter: eastZoneCenter, // Store 0 for simplicity
                    targetKeyDisplay: key === 'Space' ? 'SPACE' : key.replace('Key', ''),
                };
                this.uiManager.showBouncingRingQTE(this.activeQTE.state.targetKeyDisplay);
                 // Pass only the size to the UI manager now
                this.uiManager.updateBouncingRingZones(this.activeQTE.state.currentZoneSize);
                this.uiManager.updateBouncingRingProgress(0, requiredLoops);
                this.uiManager.updateBouncingRingTimer(1); // Start timer bar full
                break;

            default:
                logger.error(`QTEManager: Unknown QTE type "${type}"`); // Use logger
                this.endQTE(false); // End immediately if type is wrong
                return;
        }

        // Start the update loop
        this.rafId = requestAnimationFrame(this.update.bind(this));
    }

    update(timestamp) {
        if (!this.isActive()) return;

        // Ensure lastTimestamp is initialized on the first frame
        if (this.lastTimestamp === null) {
            this.lastTimestamp = timestamp;
            // Avoid large delta on first frame by skipping update
             this.rafId = requestAnimationFrame(this.update.bind(this));
             return;
        }

        const now = performance.now();
        const elapsedTime = now - this.activeQTE.startTime;
        this.activeQTE.timeLeft = Math.max(0, this.activeQTE.duration - elapsedTime);

        const timeRatio = this.activeQTE.timeLeft / this.activeQTE.duration;
         // Calculate delta *after* checking if lastTimestamp is null
        const delta = (timestamp - this.lastTimestamp) / 1000; // Time since last frame in seconds
        this.lastTimestamp = timestamp; // Update lastTimestamp

         // Defend against excessively large delta values (e.g., tabbed out)
         const maxDelta = 0.1; // Cap at 100ms
         const clampedDelta = Math.min(delta, maxDelta);


        let endType = null; // null, 'success', 'failure'

        // QTE-specific update logic
        switch (this.activeQTE.type) {
            case QTE_TYPES.BUTTON_MASH:
                this.uiManager.updateButtonMashTimer(timeRatio);
                // Success is checked in handleInput
                break;

            case QTE_TYPES.SKILL_CHECK:
                 if (!this.activeQTE.state.triggered) {
                    this.activeQTE.state.currentAngle = (this.activeQTE.state.currentAngle + this.activeQTE.state.needleSpeed * clampedDelta) % 360;
                    this.uiManager.updateSkillCheckNeedle(this.activeQTE.state.currentAngle);
                }
                // Failure condition handled by timer check below OR incorrect input in handleInput
                break;

            case QTE_TYPES.BOUNCING_RING:
                // Move indicator
                 const state = this.activeQTE.state;
                 state.currentAngle = (state.currentAngle + state.indicatorSpeed * state.direction * clampedDelta);
                 // Ensure angle stays within 0-360 range properly
                 state.currentAngle = (state.currentAngle % 360 + 360) % 360;

                this.uiManager.updateBouncingRingIndicator(state.currentAngle);
                this.uiManager.updateBouncingRingTimer(timeRatio); // Update timer bar

                // No automatic bouncing logic needed here, only input matters
                break;
        }

       // Check for timeout failure (Only if no other end condition met yet)
        if (endType === null && this.activeQTE.timeLeft <= 0) {
             logger.log(`QTE Timeout: ${this.activeQTE.type}`); // Log timeout
            if (this.activeQTE.type === QTE_TYPES.SKILL_CHECK && !this.activeQTE.state.triggered) {
                 // Skill check fails if timer runs out *before* triggering
                 endType = 'failure';
            } else if (this.activeQTE.type === QTE_TYPES.BUTTON_MASH && this.activeQTE.state.currentPresses < this.activeQTE.state.requiredPresses) {
                 // Button mash fails if not enough presses before time runs out
                 endType = 'failure';
             } else if (this.activeQTE.type === QTE_TYPES.BOUNCING_RING && this.activeQTE.state.completedLoops < this.activeQTE.state.requiredLoops) {
                 // Bouncing ring fails if not enough loops before time runs out
                 endType = 'failure';
            }
            // If QTE ended successfully (e.g., last press) on the exact frame timeout occurs, 'success' endType might already be set.
        }

        if (endType !== null) { // Check if end condition met
            this.endQTE(endType === 'success');
        } else {
            // Only request next frame if QTE hasn't ended
            this.rafId = requestAnimationFrame(this.update.bind(this));
        }
    }

    handleInput(keyCode) {
        // Critical: Check if QTE is active *before* accessing its properties
        if (!this.isActive()) {
            // logger.warn("handleInput called but no QTE is active."); // Optional logging
            return;
        }
        // Only process if the key matches the *current* active QTE's key
        if (keyCode !== this.activeQTE.key) {
             // logger.log(`handleInput: Ignored key ${keyCode}, expected ${this.activeQTE.key}`); // Optional logging
             return;
        }


        let endType = null; // null, 'success', 'failure'

        switch (this.activeQTE.type) {
            case QTE_TYPES.BUTTON_MASH:
                this.activeQTE.state.currentPresses++;
                const progress = this.activeQTE.state.currentPresses / this.activeQTE.state.requiredPresses;
                this.uiManager.updateButtonMashProgress(Math.min(1, progress) * 100);
                if (this.activeQTE.state.currentPresses >= this.activeQTE.state.requiredPresses) {
                    endType = 'success';
                }
                break;

            case QTE_TYPES.SKILL_CHECK:
                 // Prevent multiple triggers
                 if (this.activeQTE.state.triggered) break;

                 this.activeQTE.state.triggered = true; // Mark as triggered
                 const angleSC = this.activeQTE.state.currentAngle;
                 const startSC = this.activeQTE.state.successZoneStart;
                 const endSC = this.activeQTE.state.successZoneEnd; // This is the raw end angle, might be > 360
                 let inZoneSC = false;

                 // Normalize angle to be relative to start for easier wrap check
                 const normalizedAngle = (angleSC - startSC + 360) % 360;
                 const zoneSize = (endSC - startSC); // Use the original size calculation

                 if (normalizedAngle <= zoneSize) {
                      inZoneSC = true;
                 }


                 endType = inZoneSC ? 'success' : 'failure';
                 logger.log(`Skill Check Input: Angle=${angleSC.toFixed(1)}, Zone=[${startSC.toFixed(1)}, ${(endSC % 360).toFixed(1)} (Size: ${zoneSize.toFixed(1)})], InZone=${inZoneSC}`); // Use logger
                break;

             case QTE_TYPES.BOUNCING_RING:
                // --- FIX: Redeclared angle inside this case ---
                const stateBR = this.activeQTE.state;
                const angleBR = stateBR.currentAngle; // Use a different variable name
                // --- END FIX ---
                let inCorrectZoneBR = false;
                let targetCenterBR;

                // Determine which zone we *should* be hitting
                if (stateBR.nextBounceTarget === 'right') {
                    targetCenterBR = stateBR.eastZoneCenter; // 0 or 360
                } else { // nextBounceTarget === 'left'
                    targetCenterBR = stateBR.westZoneCenter; // 180
                }

                // Check if angle is within the target zone
                const halfSizeBR = stateBR.currentZoneSize / 2;
                 // Use positive modulo for lower bound
                 const lowerBoundBR = (((targetCenterBR - halfSizeBR) % 360) + 360) % 360;
                 const upperBoundBR = (targetCenterBR + halfSizeBR); // Keep potentially > 360 for wrap check

                // Handle wrap-around for the East zone (centered at 0/360)
                 if (targetCenterBR === 0) {
                     // Check if angle is within [360-halfSize, 360) OR [0, halfSize]
                     if (angleBR >= lowerBoundBR || angleBR <= (upperBoundBR % 360) ) {
                         inCorrectZoneBR = true;
                     }
                 } else { // West zone (centered at 180)
                      // Standard check: lowerBound <= angle <= upperBound
                     if (angleBR >= lowerBoundBR && angleBR <= upperBoundBR) {
                         inCorrectZoneBR = true;
                     }
                 }


                if (inCorrectZoneBR) {
                    // Successfully hit the zone
                    stateBR.direction *= -1; // Bounce back

                    // If we just hit the left zone, increment loop count and shrink
                    if (stateBR.nextBounceTarget === 'left') {
                         stateBR.completedLoops++;
                         this.uiManager.updateBouncingRingProgress(stateBR.completedLoops, stateBR.requiredLoops);

                         // Shrink zones
                         stateBR.currentZoneSize *= 0.8;
                         stateBR.currentZoneSize = Math.max(stateBR.currentZoneSize, 15); // Minimum size 15 degrees
                         this.uiManager.updateBouncingRingZones(stateBR.currentZoneSize); // Update UI
                    }

                    // Swap the next target zone
                    stateBR.nextBounceTarget = (stateBR.nextBounceTarget === 'right') ? 'left' : 'right';

                    // Check for win condition
                    if (stateBR.completedLoops >= stateBR.requiredLoops) {
                        endType = 'success';
                    }
                     // Optional: Play success tick sound
                     // window.gameControls?.audioManager?.playSound('qte_bounce_tick', 'path/to/tick.mp3');

                } else {
                     // Missed the zone
                    endType = 'failure';
                     logger.log(`Bounce Miss: Angle=${angleBR.toFixed(1)}, Target=${stateBR.nextBounceTarget}, Zone=[${lowerBoundBR.toFixed(1)}, ${(upperBoundBR % 360).toFixed(1)}]`); // Log failure details
                     // Optional: Play failure sound
                     // window.gameControls?.audioManager?.playSound('qte_bounce_fail', 'path/to/fail.mp3');
                }
                break; // End BOUNCING_RING case
        }

        // If input caused QTE to end (success or failure)
        if (endType !== null) { // Check if end condition met by input
            this.endQTE(endType === 'success');
        }
    }

    endQTE(success) {
        // Ensure we only end once and only if active
        if (!this.isActive()) {
            // logger.warn("endQTE called but no QTE is active."); // Optional logging
            return;
        }


        logger.log(`⚡ QTE Ended: ${this.activeQTE.type} - ${success ? 'Success' : 'Failure'}`); // Use logger

        // --- Critical Fixes ---
        // 1. Always cancel the animation frame request *before* clearing state
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null; // Clear the ID
        }
        // 2. Reset lastTimestamp immediately
        this.lastTimestamp = null;
        // --- End Critical Fixes ---

        // Local copy *before* clearing activeQTE
        const endedQTEType = this.activeQTE.type;
        const callback = success ? this.activeQTE.onSuccess : this.activeQTE.onFailure;

        // --- Critical Fix: Clear activeQTE state BEFORE hiding UI or calling callbacks ---
        this.activeQTE = null; // This makes isActive() return false

        // Hide UI based on the *ended* type
        switch (endedQTEType) {
            case QTE_TYPES.BUTTON_MASH:
                this.uiManager.hideButtonMashQTE();
                break;
            case QTE_TYPES.SKILL_CHECK:
                this.uiManager.hideSkillCheckQTE();
                break;
            case QTE_TYPES.BOUNCING_RING:
                this.uiManager.hideBouncingRingQTE();
                break;
             default:
                  logger.warn(`endQTE: Attempted to hide unknown QTE type "${endedQTEType}"`); // Use logger
                  break;
        }

        // Call appropriate callback *after* clearing state and hiding UI
        try {
            if (callback && typeof callback === 'function') {
                callback();
            }
        } catch (e) {
             logger.error("Error executing QTE callback:", e); // Use logger
        }


        // Only unfreeze if no OTHER QTE has immediately started (edge case safety)
        if (!this.isActive()) {
             logger.log("Unfreezing controls after QTE end."); // Log unfreeze
             this.controls?.unfreeze();
        } else {
             logger.warn("QTEManager: Another QTE started immediately after ending. Controls remain frozen."); // Use logger
        }
    }

    tick(delta) {
        // Kept for potential integration with main game loop if needed later
    }
}

export { QTEManager, QTE_TYPES };

