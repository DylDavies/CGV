# Quick Reference - Debug Commands

## Logging

```javascript
// Disable all console logging
logger.disable()

// Enable console logging
logger.enable()

// Save logs to file buffer
logger.enableFileLogging()

// Download logs
logger.downloadLogs()
```

## Lightmap Controls

```javascript
// Toggle between lights ON and lights OFF lightmaps
window.game.mansionLoader.toggleLightmaps()

// Adjust lightmap brightness (default: 2.5)
window.game.mansionLoader.setLightmapIntensity(5.0)  // Brighter
window.game.mansionLoader.setLightmapIntensity(1.0)  // Dimmer

// Check current state
window.game.mansionLoader.useLightsOn  // true = lights on, false = lights off
```

## Debug Info

```javascript
// Get mansion debug info
window.game.mansionLoader.getDebugInfo()

// Check UV channels (diagnose lightmap issues)
window.game.mansionLoader.debugUVs()

// List all objects in mansion
window.game.mansionLoader.listAllObjects()

// Search for specific objects
window.game.mansionLoader.findObjects('lamp')

// List all collections/rooms
window.game.mansionLoader.listCollections()
```

## Fireplace Controls

```javascript
// Toggle fireplaces
window.game.mansionLoader.toggleFireplaces()

// Enable/disable fireplaces
window.game.mansionLoader.setFireplacesEnabled(true)
window.game.mansionLoader.setFireplacesEnabled(false)
```

## Navigation Mesh

```javascript
// Toggle navmesh visualizer
window.game.mansionLoader.toggleNavMeshVisualizer()

// Toggle navmesh nodes visualizer
window.game.mansionLoader.toggleNavMeshNodesVisualizer()

// Toggle mansion visibility (to see navmesh better)
window.game.mansionLoader.toggleMansionVisibility()
```

## Occlusion Culling

```javascript
// Toggle occlusion culling
window.game.mansionLoader.setOcclusionCulling(false)  // Disable
window.game.mansionLoader.setOcclusionCulling(true)   // Enable

// Adjust visible distance (default varies by quality)
window.game.mansionLoader.setMaxVisibleDistance(25)
```

## Common Issues

### Lightmaps not showing / too dark
```javascript
// Increase lightmap intensity
window.game.mansionLoader.setLightmapIntensity(5.0)

// Check if lightmaps are loaded
window.game.mansionLoader.lightmapOn
window.game.mansionLoader.lightmapOff
```

### Performance issues
```javascript
// Disable logging
logger.disable()

// Check active objects
window.game.mansionLoader.getDebugInfo()
```

### Missing objects after export
Make sure you export ALL objects in the Mansion collection from Blender, not just the baked mesh.
