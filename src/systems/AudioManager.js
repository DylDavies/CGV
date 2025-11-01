// src/systems/AudioManager.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class AudioManager {
    constructor(camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);

        this.audioLoader = new THREE.AudioLoader();
        this.soundCache = new Map();
        this.activeSounds = new Map();

        // Centralized sound paths
        this.soundPaths = {
            mainMenuMusic: 'public/audio/music/main_menu_audio.mp3',
            heartbeat: 'public/audio/sfx/heartbeat.mp3',
            rotaryPhone: 'public/audio/sfx/rotary-phone-ring.mp3',
            whispering: 'public/audio/ambience/creepy-whispering.mp3', 
            violentDoorSlam: 'public/audio/ambience/violent-door-slam.mp3',
            hitSound: 'public/audio/sfx/hit_sound.mp3',
            phone_ringing: 'public/audio/sfx/phone_ringing.mp3',
            voicemail_editor: 'public/audio/sfx/voicemail_editor.m4a',
            door_unlock_click: 'public/audio/sfx/door_unlock_click.mp3',
            door_bang_1: 'public/audio/sfx/door_bang_1.mp3',
            door_bang_2_loud: 'public/audio/sfx/door_bang_2_loud.mp3',
            door_thud: 'public/audio/sfx/door_bang_1.mp3', // Fallback to door_bang_1 until proper file added
            phone_linging: 'public/audio/sfx/yo_phone_linging.mp3',
            interview_audio: 'public/audio/sfx/interview.wav', // Placeholder for interview audio
            walking: 'public/audio/sfx/walking-on-wood.mp3',
            open_car_door: 'public/audio/sfx/open-car-door.mp3',
            car_hood_open: 'public/audio/sfx/hood-open.mp3',
            car_hood_close: 'public/audio/sfx/hood-close.mp3',
            car_starting: 'public/audio/sfx/car-starting.mp3',

            //ambient sound effects - to be used for random sound generation
            ambientSounds: [
                'public/audio/ambience/creaking-knocking.mp3',
                'public/audio/ambience/ghost-sound.mp3',
                'public/audio/ambience/horror-warning.mp3',
                'public/audio/ambience/paranormal-horror-sound.mp3',
                'public/audio/ambience/creepy-whispering.mp3', 
            ]

        };

        this.globalVolume = {
            music: 0.9,
            sfx: 0.95,
            ambience: 0.5,
        };

        console.log('🔊 AudioManager initialized');
    }

    async _loadSound(path, type = 'sfx', loop = false, initialVolume = 1.0) {
        if (this.soundCache.has(path)) {
            const cachedSound = this.soundCache.get(path);
            // It's important to create a new Audio object for each playback
            // to allow for overlapping sounds and individual control.
            const sound = new THREE.Audio(this.listener).setBuffer(cachedSound.buffer);
            sound.setLoop(loop);
            const volumeType = this.globalVolume[type] || 1.0;
            sound.setVolume(initialVolume * volumeType);
            return sound;
        }

        return new Promise((resolve, reject) => {
            this.audioLoader.load(
                path,
                (buffer) => {
                    const sound = new THREE.Audio(this.listener);
                    sound.setBuffer(buffer);
                    sound.setLoop(loop);

                    const volumeType = this.globalVolume[type] || 1.0;
                    sound.setVolume(initialVolume * volumeType);

                    // Cache the buffer for future use
                    this.soundCache.set(path, { buffer: buffer });
                    console.log(`🔊 Loaded sound: ${path}`);
                    resolve(sound);
                },
                () => {}, // onProgress
                (err) => {
                    console.error(`Failed to load sound: ${path}`, err);
                    reject(err);
                }
            );
        });
    }

    // --- Music ---

    async playMainMenuMusic(fadeDuration = 1000) {
        if (this.activeSounds.has('mainMenuMusic')) return;

        const music = await this._loadSound(this.soundPaths.mainMenuMusic, 'music', true, 0);
        this.activeSounds.set('mainMenuMusic', music);
        music.play();
        this.fadeIn(music, this.globalVolume.music, fadeDuration);
    }

    stopMainMenuMusic(fadeDuration = 1000) {
        this.stopSound('mainMenuMusic', fadeDuration);
    }

    // --- Sound Effects ---
/**
     * Plays a looping sound attached to a specific 3D object in the scene.
     * @param {string} soundId - A unique name for this sound instance (e.g., 'phone_ringing').
     * @param {string} path - The path to the audio file.
     * @param {THREE.Object3D} mesh - The 3D object to attach the sound to.
     * @param {number} refDistance - How quickly the sound fades. A larger number means it can be heard from further away.
     */
    async playLoopingPositionalSound(soundId, path, mesh, refDistance = 10) {
        if (this.activeSounds.has(soundId)) {
            this.stopSound(soundId);
        }

        try {
            const sound = await this._loadSound(path, 'sfx', true);
            
            const positionalSound = new THREE.PositionalAudio(this.listener);
            positionalSound.setBuffer(sound.buffer);
            positionalSound.setLoop(true);
            positionalSound.setRefDistance(refDistance);
            positionalSound.setVolume(this.globalVolume.sfx);

            mesh.add(positionalSound);
            positionalSound.play();

            this.activeSounds.set(soundId, positionalSound);
            console.log(`🔊 Playing looping positional sound '${soundId}' on object '${mesh.name}'`);
        } catch (error) {
            console.error(`Could not play positional sound '${soundId}':`, error);
        }
    }


    async playHeartbeat() {
        if (this.activeSounds.has('heartbeat')) return;

        const heartbeat = await this._loadSound(this.soundPaths.heartbeat, 'sfx', true, 0);
        this.activeSounds.set('heartbeat', heartbeat);
        heartbeat.play();
    }

    updateHeartbeat(distance, maxDistance = 20) {
        const sound = this.activeSounds.get('heartbeat');
        if (!sound) return;

        const closeness = 1 - (Math.min(distance, maxDistance) / maxDistance); // 0 to 1

        // Adjust volume based on distance
        const volume = Math.pow(closeness, 2); // Use pow for a more dramatic effect
        sound.setVolume(volume * this.globalVolume.sfx);

        // Adjust tempo (playback rate)
        const minRate = 0.8;
        const maxRate = 2.0;
        const playbackRate = minRate + (maxRate - minRate) * closeness;
        if (sound.source && sound.source.buffer) {
             sound.playbackRate = playbackRate;
        }
    }


    stopHeartbeat(fadeDuration = 500) {
        this.stopSound('heartbeat', fadeDuration);
    }

    async playMonsterGrowl(monsterMesh) {
        this.playPositionalSound('monsterGrowl', this.soundPaths.monsterGrowl, monsterMesh);
    }

        async playRandomAmbientSound() {
        // Prevent overlapping ambient sounds
        if (this.activeSounds.has('randomAmbient')) return;

        // Pick a random sound from our new list
        const randomSoundPath = this.soundPaths.ambientSounds[Math.floor(Math.random() * this.soundPaths.ambientSounds.length)];

        // Load and play the sound (you can adjust the volume here)
        const sound = await this._loadSound(randomSoundPath, 'ambience', false, 0.7); // 70% volume
        this.activeSounds.set('randomAmbient', sound);

        // When the sound finishes, remove it from active sounds so another can play later
        sound.onEnded = () => {
            this.activeSounds.delete('randomAmbient');
        };
        sound.play();
    }


    // --- Generic Playback ---

    /**
     * Quick play method that uses soundPaths configuration
     * @param {string} soundKey - Key from soundPaths (e.g., 'phone_ringing')
     * @param {number} volume - Optional volume (0-1)
     */
    async play(soundKey, volume = 1.0) {
        const path = this.soundPaths[soundKey];
        if (!path) {
            console.error(`Sound key '${soundKey}' not found in soundPaths`);
            return;
        }
        return this.playSound(soundKey, path, false, volume);
    }

    async playSound(soundId, path, loop = false, volume = 1.0) {
        if (this.activeSounds.has(soundId)) {
            this.activeSounds.get(soundId).stop();
        }
        const sound = await this._loadSound(path, 'sfx', loop, volume);
        this.activeSounds.set(soundId, sound);
        sound.play();
    }

    async playPositionalSound(soundId, path, mesh, distance = 5) {
        const sound = await this._loadSound(path, 'sfx', false, 1.0);
        const positionalSound = new THREE.PositionalAudio(this.listener);
        positionalSound.setBuffer(sound.buffer);
        positionalSound.setRefDistance(distance); // How far away the sound starts to fade
        mesh.add(positionalSound);
        positionalSound.play();
        this.activeSounds.set(soundId, positionalSound);
    }


    stopSound(soundId, fadeDuration = 0) {
        const sound = this.activeSounds.get(soundId);
        if (sound && sound.isPlaying) {
            if (fadeDuration > 0) {
                this.fadeOut(sound, fadeDuration, () => {
                    this.activeSounds.delete(soundId);
                });
            } else {
                sound.stop();
                this.activeSounds.delete(soundId);
            }
        }
    }

    stopAll(fadeDuration = 0) {
        console.log(`🔇 Stopping all active sounds (${this.activeSounds.size} sounds)`);

        const soundIds = Array.from(this.activeSounds.keys());
        soundIds.forEach(soundId => {
            this.stopSound(soundId, fadeDuration);
        });

        // Clear the active sounds map
        this.activeSounds.clear();
    }


    // --- Utilities ---

    fadeIn(sound, targetVolume, duration) {
        let currentVolume = 0;
        sound.setVolume(currentVolume);
        const steps = 50;
        const stepTime = duration / steps;
        const volumeStep = targetVolume / steps;

        const fade = () => {
            if (currentVolume < targetVolume) {
                currentVolume += volumeStep;
                sound.setVolume(currentVolume);
                setTimeout(fade, stepTime);
            } else {
                sound.setVolume(targetVolume);
            }
        };
        fade();
    }

    fadeOut(sound, duration, onComplete = null) {
        const startVolume = sound.getVolume();
        const steps = 50;
        const stepTime = duration / steps;
        const volumeStep = startVolume / steps;

        const fade = () => {
            let currentVolume = sound.getVolume();
            if (currentVolume > 0) {
                sound.setVolume(Math.max(0, currentVolume - volumeStep));
                setTimeout(fade, stepTime);
            } else {
                sound.stop();
                if (onComplete) {
                    onComplete();
                }
            }
        };
        fade();
    }

    setVolume(type, volume) {
        this.globalVolume[type] = Math.max(0, Math.min(1, volume));
        console.log(`🔊 Set ${type} volume to ${this.globalVolume[type]}`);

        // Update any currently playing sounds of this type
        for (const [id, sound] of this.activeSounds.entries()) {
            // This is a simplification; you might want to store the sound's type
            // to adjust it correctly. For now, we'll assume the main music is the only 'music' type
            if (id.toLowerCase().includes('music')) {
                sound.setVolume(this.globalVolume.music);
            }
        }
    }
}

export { AudioManager };