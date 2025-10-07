# Logging System

## Overview

The project includes a comprehensive logging system that allows you to control console output and save logs to files.

## Features

- ✅ Enable/disable console logging
- ✅ Save logs to file buffer
- ✅ Download logs as text file
- ✅ Clear log buffer
- ✅ Automatic timestamp for all logs

## Usage

### From Browser Console

The logger is globally accessible as `window.logger`. Open your browser console (F12) and use these commands:

#### Disable Console Logging
```javascript
logger.disable()
```

#### Enable Console Logging
```javascript
logger.enable()
```

#### Enable File Logging (saves to buffer)
```javascript
logger.enableFileLogging()
```

#### Disable File Logging
```javascript
logger.disableFileLogging()
```

#### Download Logs
```javascript
logger.downloadLogs()
```
This downloads all buffered logs as a timestamped text file.

#### Clear Log Buffer
```javascript
logger.clearBuffer()
```

#### Check Logger Stats
```javascript
logger.getStats()
```
Returns:
```javascript
{
    enabled: true,
    fileLoggingEnabled: false,
    bufferSize: 0,
    maxBufferSize: 1000
}
```

## Typical Workflow

### Normal Development
Console logging is enabled by default. Just play the game and check the console.

### Debugging with File Logs
```javascript
// 1. Enable file logging
logger.enableFileLogging()

// 2. Play the game/reproduce the issue

// 3. Download the logs
logger.downloadLogs()

// 4. Disable file logging when done
logger.disableFileLogging()
```

### Performance Testing (Disable Logging)
```javascript
// Disable logging for better performance
logger.disable()

// Run your performance tests

// Re-enable when done
logger.enable()
```

## Log Levels

The logger supports different log levels:

```javascript
logger.log('Normal message')
logger.info('Info message')
logger.warn('Warning message')
logger.error('Error message')
logger.debug('Debug message')
```

## Lightmap Debugging

### Check Lightmap Status
```javascript
// In console, access the mansion loader
// (assuming it's stored in your game instance)
window.game.mansionLoader.lightmapsEnabled
window.game.mansionLoader.lightmapOn
window.game.mansionLoader.lightmapOff
```

### Adjust Lightmap Intensity
```javascript
// Increase brightness (default is 2.5)
window.game.mansionLoader.setLightmapIntensity(5.0)

// Decrease brightness
window.game.mansionLoader.setLightmapIntensity(1.0)
```

### Toggle Lightmaps On/Off
```javascript
window.game.mansionLoader.toggleLightmaps()
```

## Advanced

### Custom Log Buffer Size
The logger keeps the last 1000 log entries by default. This is defined in `src/utils/Logger.js`.

### Extending the Logger
To add custom logging functionality, modify `src/utils/Logger.js`.
