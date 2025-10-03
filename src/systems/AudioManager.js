// src/systems/AudioManager.js

import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js';

class AudioManager {
    constructor(camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);

        this.audioLoader = new THREE.AudioLoader();
        this.soundCache = new Map();

        this.sounds = {
            music: null,
            sfx: [],
            ambience: null,
        };

        this.globalVolume = {
            music: 0.9,
            sfx: 0.8,
            ambience: 0.5,
        };

        console.log('🔊 AudioManager initialized');
    }

    async loadSound(path, type = 'sfx', loop = false, volume = 1.0) {
        if (this.soundCache.has(path)) {
            return this.soundCache.get(path);
        }

        return new Promise((resolve, reject) => {
            this.audioLoader.load(
                path,
                (buffer) => {
                    const sound = new THREE.Audio(this.listener);
                    sound.setBuffer(buffer);
                    sound.setLoop(loop);
                    
                    const volumeType = this.globalVolume[type] || 1.0;
                    sound.setVolume(volume * volumeType);

                    this.soundCache.set(path, sound);
                    console.log(`🔊 Loaded sound: ${path}`);
                    resolve(sound);
                },
                () => {}, // onProgress callback (optional)
                (err) => {
                    console.error(`Failed to load sound: ${path}`, err);
                    reject(err);
                }
            );
        });
    }

    async playMusic(path) {
        if (this.sounds.music && this.sounds.music.isPlaying) {
            this.sounds.music.stop();
        }
        const music = await this.loadSound(path, 'music', true, 1.0);
        this.sounds.music = music;
        music.play();
    }
    
    // Stop currently playing music
    stopMusic(fadeOutDuration = 1000) {
        const music = this.sounds.music;
        if (!music || !music.isPlaying) return;

        const startVolume = music.getVolume();
        let currentTime = 0;

        const fadeOutInterval = setInterval(() => {
            currentTime += 50; // Update every 50ms
            const newVolume = startVolume * (1 - currentTime / fadeOutDuration);
            
            if (newVolume > 0) {
                music.setVolume(newVolume);
            } else {
                music.stop();
                clearInterval(fadeOutInterval);
            }
        }, 50);
    }

    async playSFX(path, volume = 1.0) {
        const sfx = await this.loadSound(path, 'sfx', false, volume);
        // Allows playing the same sound multiple times without cutting off
        if (sfx.isPlaying) {
            sfx.stop();
        }
        sfx.play();
    }

    setVolume(type, volume) {
        this.globalVolume[type] = Math.max(0, Math.min(1, volume));
        console.log(`🔊 Set ${type} volume to ${this.globalVolume[type]}`);
        
        // Update any currently playing sounds of this type
        if (type === 'music' && this.sounds.music) {
            this.sounds.music.setVolume(this.globalVolume.music);
        }
    }
}

export { AudioManager };