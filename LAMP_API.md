# Mansion Lamp Control API

## Overview
The MansionLoader automatically detects and adds lights to objects with names containing:
- `WallLamp`
- `Chandelier`
- `Lamp`
- `Light`

## Features
- **Automatic detection** - Scans model on load
- **Dim lighting** - Low-intensity warm lights (0.25-0.4 intensity)
- **Flickering effect** - Realistic candle-like flickering
- **Type-based properties**:
  - Chandeliers: Warmer orange (0xffaa55), 8 unit range
  - Wall Lamps: Warm (0xffbb66), 5 unit range
  - Generic Lamps: Yellow-white (0xffcc77), 6 unit range

## API Methods

Access via `window.gameControls.mansionLoader` or your mansionLoader instance:

### Enable/Disable All Lamps
```javascript
// Disable all lamps
mansionLoader.setLampsEnabled(false);

// Enable all lamps
mansionLoader.setLampsEnabled(true);

// Toggle lamps on/off
mansionLoader.toggleLamps();
```

### Adjust Light Intensity
```javascript
// Set all lamps to specific intensity (0.0 - 1.0)
mansionLoader.setLampIntensity(0.5); // Brighter
mansionLoader.setLampIntensity(0.1); // Dimmer
```

### Control Flicker Speed
```javascript
// Set flicker speed multiplier (default: 1.0)
mansionLoader.setLampFlickerSpeed(2.0); // Faster flickering
mansionLoader.setLampFlickerSpeed(0.5); // Slower flickering
mansionLoader.setLampFlickerSpeed(0.0); // No flickering
```

### Get Lamps by Type
```javascript
// Get all chandeliers
const chandeliers = mansionLoader.getLampsByType('chandelier');

// Get all wall lamps
const wallLamps = mansionLoader.getLampsByType('walllamp');

// Get generic lamps
const genericLamps = mansionLoader.getLampsByType('lamp');
```

### Debug Info
```javascript
const info = mansionLoader.getDebugInfo();
console.log(info);
// {
//   totalRooms: 12,
//   visibleRooms: 8,
//   physicsBodies: 145,
//   occlusionCulling: true,
//   maxVisibleDistance: 50,
//   totalLamps: 24,
//   lampsEnabled: true
// }
```

## Console Examples

```javascript
// Turn off all lamps for darkness
window.gameControls.mansionLoader.toggleLamps();

// Make lamps very dim for horror atmosphere
window.gameControls.mansionLoader.setLampIntensity(0.15);

// Increase flicker for spooky effect
window.gameControls.mansionLoader.setLampFlickerSpeed(3.0);

// Check how many lamps were found
window.gameControls.mansionLoader.getDebugInfo().totalLamps;
```

## Moonlight

The scene now includes subtle moonlight:
- Dim blue ambient light (0x1a1a2e)
- Directional moonlight from above with shadows
- Creates atmospheric outdoor/window lighting
