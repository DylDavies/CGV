// src/utils/Logger.js - Centralized logging system

class Logger {
    constructor() {
        this.enabled = true;
        this.fileLoggingEnabled = true;  // Changed to true by default
        this.logBuffer = [];
        this.maxBufferSize = 1000;

        // Log initialization
        this._addToBuffer('info', ['Logger initialized with file logging enabled']);
    }

    log(...args) {
        if (this.enabled) {
            console.log(...args);
        }
        this._addToBuffer('log', args);
    }

    warn(...args) {
        if (this.enabled) {
            console.warn(...args);
        }
        this._addToBuffer('warn', args);
    }

    error(...args) {
        if (this.enabled) {
            console.error(...args);
        }
        this._addToBuffer('error', args);
    }

    info(...args) {
        if (this.enabled) {
            console.info(...args);
        }
        this._addToBuffer('info', args);
    }

    debug(...args) {
        if (this.enabled) {
            console.debug(...args);
        }
        this._addToBuffer('debug', args);
    }

    _addToBuffer(level, args) {
        if (this.fileLoggingEnabled) {
            const timestamp = new Date().toISOString();
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');

            this.logBuffer.push({ timestamp, level, message });

            // Keep buffer size manageable
            if (this.logBuffer.length > this.maxBufferSize) {
                this.logBuffer.shift();
            }
        }
    }

    enable() {
        this.enabled = true;
        this.log('Logger enabled');
    }

    disable() {
        this.log('Logger disabled');
        this.enabled = false;
    }

    enableFileLogging() {
        this.fileLoggingEnabled = true;
        this.log('File logging enabled');
    }

    disableFileLogging() {
        this.fileLoggingEnabled = false;
        this.log('File logging disabled');
    }

    downloadLogs() {
        if (this.logBuffer.length === 0) {
            alert('No logs to download. Enable file logging first.');
            return;
        }

        const logText = this.logBuffer.map(entry =>
            `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`
        ).join('\n');

        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `game-log-${new Date().toISOString().replace(/:/g, '-')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.log('Logs downloaded');
    }

    clearBuffer() {
        this.logBuffer = [];
        this.log('Log buffer cleared');
    }

    getStats() {
        return {
            enabled: this.enabled,
            fileLoggingEnabled: this.fileLoggingEnabled,
            bufferSize: this.logBuffer.length,
            maxBufferSize: this.maxBufferSize
        };
    }
}

// Create a singleton instance
const logger = new Logger();

// Make it globally accessible for debugging
if (typeof window !== 'undefined') {
    window.logger = logger;
}

export default logger;
