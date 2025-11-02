// src/systems/QTEManager.js
import logger from '../utils/Logger.js'; 

const QTE_TYPES = {
    BUTTON_MASH: 'buttonMash',
    SKILL_CHECK: 'skillCheck',
    BOUNCING_RING: 'bouncingRing',
    RHYTHM_GAME: 'rhythmGame'
};

class QTEManager {
    constructor(uiManager, controls) {
        this.uiManager = uiManager;
        this.controls = controls; // instance of playerControls
        this.activeQTE = null; // { type, key, duration, startTime, timeLeft, onSuccess, onFailure, state }
        this.rafId = null; // For requestAnimationFrame
        this.lastTimestamp = null; // Initialize timestamp tracking

        logger.log('QTEManager Initialized');
    }

    isActive() {
        return !!this.activeQTE;
    }

    startQTE(type, options = {}) {
        if (this.isActive()) {
            logger.warn("QTEManager: Cannot start QTE while another is active.");
            return;
        }

        const {
            key = 'Space', // Default key
            duration = 20000, // Default duration: 20 seconds
            onSuccess = () => logger.log("QTE Success!"),
            onFailure = () => logger.log("QTE Failure!"),

            // Button mash config
            requiredPresses = 15, // For button mash

            // Skill check config
            successZoneSize = 40, // For skill check (degrees)
            needleSpeed = 360, // For skill check (degrees per second)

            // Bouncing config
            initialZoneSize = 70, // Start Bouncing Ring zones at 70 degrees
            requiredLoops = 8, // For bouncing ring (complete 8 full back-and-forths)
            indicatorSpeed = 250, // For bouncing ring (degrees per second)

            // Rhythm game config
            noteSequence = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'], // For rhythm game
            noteSpeed = 200, // For rhythm game (pixels per second)
            noteSpeedIncrease = 0, // Speed increase per note (pixels per second)
            hitZoneStart = 400, // For rhythm game (center of hit zone in pixels from left)
            hitZoneSize = 80 // For rhythm game (width of hit zone in pixels)
        } = options;

        logger.log(`Starting QTE: ${type}`);
        this.controls?.freeze(); // Freeze player movement
        this.lastTimestamp = null; // Reset timestamp for the new QTE

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
                const successZoneStart = Math.random() * (360 - successZoneSize);

                this.activeQTE.state = {
                    needleSpeed,
                    currentAngle: 0,
                    successZoneStart: successZoneStart,
                    successZoneEnd: (successZoneStart + successZoneSize), // Raw end, might be > 360
                    triggered: false,
                    targetKeyDisplay: key === 'Space' ? 'SPACE' : key.replace('Key', ''),
                };

                this.uiManager.showSkillCheckQTE(
                    this.activeQTE.state.targetKeyDisplay,
                    this.activeQTE.state.successZoneStart,
                    successZoneSize
                );

                this.uiManager.updateSkillCheckNeedle(0);
                break;

            case QTE_TYPES.BOUNCING_RING:
                const westZoneCenterBR = 180; // 180 is WEST
                const eastZoneCenterBR = 0; //  0 is EAST
                const startNearEastBR = Math.random() > 0.5;
                const startAngleOffsetBR = initialZoneSize / 4; // Start slightly inside a zone
                const initialDirectionBR = - 1; //Math.random() > 0.5 ? 1 : -1; // Random initial direction

                // Determine the *first* zone the indicator will move towards
                let firstTargetZone;
                if (startNearEastBR){
                    firstTargetZone = (initialDirectionBR === 1) ? 'right' : 'left'; // Moving R targets East, L targets West (from near East)
                } 
                else{ // startNearWest
                    firstTargetZone = (initialDirectionBR === 1) ? 'right' : 'left'; // Moving R targets East, L targets West (from near West)
                }

                this.activeQTE.state = {
                    indicatorSpeed,
                    currentAngle: startNearEastBR ? (eastZoneCenterBR + startAngleOffsetBR * initialDirectionBR + 360) % 360
                                                  : (westZoneCenterBR + startAngleOffsetBR * initialDirectionBR + 360) % 360,
                    direction: initialDirectionBR,
                    currentZoneSize: initialZoneSize,
                    requiredLoops,
                    completedLoops: 0,
                    // The next zone to HIT is the first one it moves towards
                    nextBounceTarget: firstTargetZone,
                    westZoneCenter: westZoneCenterBR, // 180
                    eastZoneCenter: eastZoneCenterBR, // 0
                    targetKeyDisplay: key === 'Space' ? 'SPACE' : key.replace('Key', ''),
                };

                this.uiManager.showBouncingRingQTE(this.activeQTE.state.targetKeyDisplay);
                this.uiManager.updateBouncingRingZones(this.activeQTE.state.currentZoneSize);
                this.uiManager.updateBouncingRingProgress(0, requiredLoops);
                this.uiManager.updateBouncingRingTimer(1); // Start timer bar full
                break;

            case QTE_TYPES.RHYTHM_GAME:
                this.activeQTE.state = {
                    noteSequence: noteSequence,
                    baseNoteSpeed: noteSpeed, // Store base speed
                    noteSpeed: noteSpeed, // Current speed (will increase)
                    noteSpeedIncrease: noteSpeedIncrease, // How much to increase per note
                    hitZoneStart: hitZoneStart,
                    hitZoneEnd: hitZoneStart + hitZoneSize,
                    currentNoteIndex: 0,
                    currentNotePosition: -100, // Start off-screen to the left
                    screenWidth: 600, // Total width of the rhythm game track
                    hitSuccess: false,
                    flashingRed: false,
                };

                this.uiManager.showRhythmGameQTE();
                this.uiManager.updateRhythmGameNote(
                    this.activeQTE.state.currentNotePosition,
                    this.getArrowKeySymbol(noteSequence[0])
                );
                this.uiManager.updateRhythmGameProgress(0, noteSequence.length);
                break;

            default:
                logger.error(`QTEManager: Unknown QTE type "${type}"`);
                this.endQTE(false); // End immediately if type is wrong
                return;
        }

        // Start the update loop
        this.rafId = requestAnimationFrame(this.update.bind(this));
    }

    update(timestamp) {
        if (!this.isActive()) return;

        // Ensure lastTimestamp is initialized correctly on the first frame
        if (this.lastTimestamp === null) {
            this.lastTimestamp = timestamp;
            this.rafId = requestAnimationFrame(this.update.bind(this)); // Skip first frame logic, request next
            return;
        }

        const now = performance.now();
        const elapsedTime = now - this.activeQTE.startTime;
        this.activeQTE.timeLeft = Math.max(0, this.activeQTE.duration - elapsedTime);
        const timeRatio = this.activeQTE.timeLeft / this.activeQTE.duration;

        // Calculate delta *after* checking if lastTimestamp is null
        const delta = (timestamp - this.lastTimestamp) / 1000; // Time since last frame in seconds
        this.lastTimestamp = timestamp; // Update lastTimestamp for the next frame

        // Defend against excessively large delta values (e.g., tabbed out)
        const maxDelta = 0.1; // Cap at 100ms (10 FPS equivalent)
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
                const stateBR = this.activeQTE.state;
                stateBR.currentAngle = (stateBR.currentAngle + stateBR.indicatorSpeed * stateBR.direction * clampedDelta);
                // Ensure angle stays within 0-360 range properly using modulo
                stateBR.currentAngle = (stateBR.currentAngle % 360 + 360) % 360;

                this.uiManager.updateBouncingRingIndicator(stateBR.currentAngle);
                this.uiManager.updateBouncingRingTimer(timeRatio); // Update timer bar
                // No automatic bouncing logic needed here, only input matters
                break;

            case QTE_TYPES.RHYTHM_GAME:
                const stateRG = this.activeQTE.state;

                // Move note from left to right
                stateRG.currentNotePosition += stateRG.noteSpeed * clampedDelta;

                // Update note position on UI
                this.uiManager.updateRhythmGameNote(
                    stateRG.currentNotePosition,
                    this.getArrowKeySymbol(stateRG.noteSequence[stateRG.currentNoteIndex])
                );

                // Check if note passed the hit zone without being hit
                if (stateRG.currentNotePosition > stateRG.hitZoneEnd && !stateRG.hitSuccess) {
                    logger.log(`Rhythm Game: Missed note ${stateRG.currentNoteIndex + 1}/${stateRG.noteSequence.length}`);
                    endType = 'failure';
                }
                break;
        }

       // Check for timeout failure (Only if no other end condition met yet)
        if (endType === null && this.activeQTE.timeLeft <= 0) {
            logger.log(`QTE Timeout: ${this.activeQTE.type}`); // Log timeout

            // Check specific failure conditions for each type on timeout
            if (this.activeQTE.type === QTE_TYPES.SKILL_CHECK && !this.activeQTE.state.triggered){
                endType = 'failure'; // Skill check fails if not triggered before timeout
            } 
            else if (this.activeQTE.type === QTE_TYPES.BUTTON_MASH && this.activeQTE.state.currentPresses < this.activeQTE.state.requiredPresses){
                endType = 'failure'; // Button mash fails if not enough presses
            } 
            else if (this.activeQTE.type === QTE_TYPES.BOUNCING_RING && this.activeQTE.state.completedLoops < this.activeQTE.state.requiredLoops){
                endType = 'failure'; // Bouncing ring fails if not enough loops completed
            }
            // If QTE was successfully completed on the exact frame timeout occurs, endType might already be 'success'.
        }

        if (endType !== null) { // Check if end condition met
            this.endQTE(endType === 'success');
        } 
        else{
            // Only request next frame if QTE hasn't ended
            this.rafId = requestAnimationFrame(this.update.bind(this));
        }
    }

    handleInput(keyCode) {
        if (!this.isActive()) {
            return; // Ignore if no QTE active
        }

        // For rhythm game, accept any arrow key (validation happens in the switch case)
        // For other QTE types, check if it's the expected key
        const isRhythmGame = this.activeQTE.type === QTE_TYPES.RHYTHM_GAME;
        if (!isRhythmGame && keyCode !== this.activeQTE.key) {
            return; // Ignore if wrong key for non-rhythm QTEs
        }

        let endType = null; // null, 'success', 'failure'

        switch (this.activeQTE.type) {
            case QTE_TYPES.BUTTON_MASH:
                this.activeQTE.state.currentPresses++;
                const progressBM = this.activeQTE.state.currentPresses / this.activeQTE.state.requiredPresses;
                this.uiManager.updateButtonMashProgress(Math.min(1, progressBM) * 100);
                if (this.activeQTE.state.currentPresses >= this.activeQTE.state.requiredPresses) {
                    endType = 'success';
                }
                break;

            case QTE_TYPES.SKILL_CHECK:
                if (this.activeQTE.state.triggered) break; // Prevent multiple triggers
                
                this.activeQTE.state.triggered = true;

                const angleSC = this.activeQTE.state.currentAngle;
                const startSC = this.activeQTE.state.successZoneStart;
                const endSC = this.activeQTE.state.successZoneEnd; // Raw end angle
                const zoneSizeSC = endSC - startSC;
                let inZoneSC = false;

                 // Normalize angle relative to the start for easy wrap check
                const normalizedAngleSC = (angleSC - startSC + 360) % 360;

                 // Check if the normalized angle falls within the zone size
                if (normalizedAngleSC >= 0 && normalizedAngleSC <= zoneSizeSC){
                     inZoneSC = true;
                }

                endType = inZoneSC ? 'success' : 'failure';
                logger.log(`Skill Check Input: Angle=${angleSC.toFixed(1)}, Zone=[${startSC.toFixed(1)} to ${(endSC % 360).toFixed(1)} (Size: ${zoneSizeSC.toFixed(1)})], InZone=${inZoneSC}`);
                break;

            case QTE_TYPES.BOUNCING_RING:
                const stateBR = this.activeQTE.state;
                const angleBR = stateBR.currentAngle; // Current indicator angle
                const halfSizeBR = stateBR.currentZoneSize / 2;
                let inCorrectZoneBR = false;
                let targetCenterBR;
                let lowerBoundBR, upperBoundBR; // Variables to hold calculated bounds

                // Determine target zone and calculate its bounds
                if (stateBR.nextBounceTarget === 'right') { // Target is East zone (center 0)
                    targetCenterBR = stateBR.eastZoneCenter; // Should be 0
                    // Lower bound wraps around (e.g., 345 for size 30)
                    lowerBoundBR = (360 - halfSizeBR);
                    // Upper bound is simple (e.g., 15 for size 30)
                    upperBoundBR = halfSizeBR;

                    // Check East zone (handles wrap around 0/360)
                    // Angle is in zone if it's >= lower bound OR <= upper bound
                    if (angleBR >= lowerBoundBR || angleBR <= upperBoundBR) {
                        inCorrectZoneBR = true;
                    }

                    logger.log(`Bounce Check (East): Angle=${angleBR.toFixed(1)}, Target=${stateBR.nextBounceTarget}, Zone=[${lowerBoundBR.toFixed(1)}...${upperBoundBR.toFixed(1)}], Size=${(2*halfSizeBR).toFixed(1)}, InZone=${inCorrectZoneBR} (Raw check: ${angleBR} >= ${lowerBoundBR} || ${angleBR} <= ${upperBoundBR})`);

                } 
                else{ // Target is West zone (center 180)
                    targetCenterBR = stateBR.westZoneCenter; // Should be 180
                    // Bounds do not wrap
                    lowerBoundBR = targetCenterBR - halfSizeBR; // e.g., 165 for size 30
                    upperBoundBR = targetCenterBR + halfSizeBR; // e.g., 195 for size 30

                    // Check West zone (simple range check)
                    if (angleBR >= lowerBoundBR && angleBR <= upperBoundBR) {
                        inCorrectZoneBR = true;
                    }
                    
                    logger.log(`Bounce Check (West): Angle=${angleBR.toFixed(1)}, Target=${stateBR.nextBounceTarget}, Zone=[${lowerBoundBR.toFixed(1)}...${upperBoundBR.toFixed(1)}], Size=${(2*halfSizeBR).toFixed(1)}, InZone=${inCorrectZoneBR} (Raw check: ${angleBR} >= ${lowerBoundBR} && ${angleBR} <= ${upperBoundBR})`);
                }


                if (inCorrectZoneBR) {
                    stateBR.direction *= -1; // Reverse direction

                    // If we just successfully hit the LEFT zone, a full loop is completed
                    if (stateBR.nextBounceTarget === 'left'){
                        stateBR.completedLoops++;
                        this.uiManager.updateBouncingRingProgress(stateBR.completedLoops, stateBR.requiredLoops);

                         // Shrink zones (make it harder)
                        stateBR.currentZoneSize *= 0.92; // Shrink by 15%
                        stateBR.currentZoneSize = Math.max(stateBR.currentZoneSize, 20); // Min size 20 deg
                        this.uiManager.updateBouncingRingZones(stateBR.currentZoneSize);
                        logger.log(`Loop ${stateBR.completedLoops} completed. New zone size: ${stateBR.currentZoneSize.toFixed(1)}`);
                    }

                    // Swap the next target zone for the next hit
                    stateBR.nextBounceTarget = (stateBR.nextBounceTarget === 'right') ? 'left' : 'right';
                    logger.log(`Bounce Success! Dir reversed. Next target: ${stateBR.nextBounceTarget}`);

                    // Check for win condition AFTER updating loops
                    if (stateBR.completedLoops >= stateBR.requiredLoops) {
                        endType = 'success';
                    }

                } 
                else {
                    endType = 'failure';
                    logger.log(`Bounce Miss: Angle=${angleBR.toFixed(1)}, Target=${stateBR.nextBounceTarget}. Failure.`);
                }
                break; // End BOUNCING_RING case

            case QTE_TYPES.RHYTHM_GAME:
                const stateRG = this.activeQTE.state;
                const expectedKey = stateRG.noteSequence[stateRG.currentNoteIndex];

                logger.log(`Rhythm Game Input: Key pressed=${keyCode}, Expected=${expectedKey}, Note pos=${stateRG.currentNotePosition.toFixed(1)}, Hit zone=[${stateRG.hitZoneStart}-${stateRG.hitZoneEnd}]`);

                // Check if correct key was pressed
                if (keyCode !== expectedKey) {
                    logger.log(`Rhythm Game: Wrong key! Expected ${expectedKey}, got ${keyCode}`);
                    endType = 'failure';
                    break;
                }

                // Check if note is within hit zone
                const inHitZone = stateRG.currentNotePosition >= stateRG.hitZoneStart &&
                                  stateRG.currentNotePosition <= stateRG.hitZoneEnd;

                if (inHitZone) {
                    logger.log(`Rhythm Game: Hit note ${stateRG.currentNoteIndex + 1}/${stateRG.noteSequence.length} perfectly!`);
                    stateRG.hitSuccess = true;

                    // Move to next note
                    stateRG.currentNoteIndex++;
                    this.uiManager.updateRhythmGameProgress(stateRG.currentNoteIndex, stateRG.noteSequence.length);

                    // Check if all notes completed
                    if (stateRG.currentNoteIndex >= stateRG.noteSequence.length) {
                        endType = 'success';
                    } else {
                        // Increase speed for next note
                        stateRG.noteSpeed += stateRG.noteSpeedIncrease;
                        logger.log(`   Note speed increased to ${stateRG.noteSpeed} px/s`);

                        // Reset for next note
                        stateRG.currentNotePosition = -100;
                        stateRG.hitSuccess = false;
                        this.uiManager.updateRhythmGameNote(
                            stateRG.currentNotePosition,
                            this.getArrowKeySymbol(stateRG.noteSequence[stateRG.currentNoteIndex])
                        );
                    }
                } else {
                    logger.log(`Rhythm Game: Pressed too early or too late! Position=${stateRG.currentNotePosition.toFixed(1)}`);
                    endType = 'failure';
                }
                break;
        }

        // If input caused QTE to end (success or failure)
        if (endType !== null) {
            this.endQTE(endType === 'success');
        }
    }

    // Helper to convert arrow key codes to display symbols
    getArrowKeySymbol(keyCode) {
        switch(keyCode) {
            case 'ArrowUp': return '↑';
            case 'ArrowDown': return '↓';
            case 'ArrowLeft': return '←';
            case 'ArrowRight': return '→';
            default: return keyCode;
        }
    }

    endQTE(success) {
        if (!this.isActive()) {
            // logger.warn("endQTE called but no QTE is active.");
            return;
        }

        logger.log(`QTE Ended: ${this.activeQTE.type} - ${success ? 'Success' : 'Failure'}`);

        // cancel animation frame before clearing state
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null; // Clear the ID
        }

        this.lastTimestamp = null;

        // Local copy *before* clearing activeQTE
        const endedQTEType = this.activeQTE.type;
        const callback = success ? this.activeQTE.onSuccess : this.activeQTE.onFailure;

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
            case QTE_TYPES.RHYTHM_GAME:
                this.uiManager.hideRhythmGameQTE();
                break;
             default:
                  logger.warn(`endQTE: Attempted to hide unknown QTE type "${endedQTEType}"`);
                  break;
        }

        // Call appropriate callback *after* clearing state and hiding UI
        try{
            if (callback && typeof callback === 'function') {
                callback();
            }
        } 
        catch (e) {
             logger.error("Error executing QTE callback:", e);
        }

        // Only unfreeze if no OTHER QTE has immediately started (edge case safety)
        if (!this.isActive()){
            // logger.log("Unfreezing controls after QTE end."); // Keep if helpful
            this.controls?.unfreeze();
        } 
        else{
            logger.warn("QTEManager: Another QTE started immediately after ending. Controls remain frozen.");
        }
    }

    // tick(delta) - Not strictly needed if using requestAnimationFrame
}

export { QTEManager, QTE_TYPES };