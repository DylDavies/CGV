# Project HER 👁️

Welcome to Project HER, a procedurally generated 3D horror escape room experience built with **Three.js** and vanilla JavaScript. This document serves as a guide for developers looking to understand, contribute to, and expand the project. The goal is to create a tense, atmospheric game where players must solve puzzles and uncover secrets to escape a haunted mansion.

## 📂 Project Structure

The project is organized into a modular, component-based structure within the `src` directory. This separation of concerns makes the codebase easier to manage, debug, and scale.

```
/
├── public/                     # Static assets accessible to the browser (puzzle data, models, etc.)
│   └── puzzles/
│       └── colorPuzzle/
│           └── levels.json
├── src/                        # Main source code directory
│   ├── components/             # Reusable, self-contained game objects (Player, World elements)
│   │   ├── Player/
│   │   └── World/
│   ├── puzzles/                # Logic for specific in-game puzzles
│   │   └── colorPuzzle/
│   ├── systems/                # Core engine managers (rendering, physics, UI, etc.)
│   ├── ui/                     # Component-based UI files (HTML & CSS)
│   │   ├── colorPuzzle/
│   │   ├── resultScreen/
│   │   └── welcomeScreen/
│   └── utils/                  # Helper functions and utilities
├── styles/                     # Global, non-component-specific CSS
│   └── main.css
├── index.html                  # Main entry point of the application
└── main.js                     # Initializes all systems and starts the game
```

---

## ⚙️ Core Systems Deep Dive

The project is driven by a collection of manager-style "systems" that handle different aspects of the game. They are all initialized in `src/main.js` and work together in the main game loop.

### Player System
The player's experience is managed by a combination of camera manipulation, physics, and input controls.

* **`src/components/Player/PlayerControls.js`**: This is the heart of player interaction. It uses Three.js's `PointerLockControls` to create a first-person perspective. It listens for keyboard input (WASD, Space, etc.) and translates it into movement intentions, which are then passed to the physics manager. It also contains the crucial `freeze()` and `unfreeze()` methods, which disable player movement when a UI element like a puzzle is active.
* **`src/components/Player/ImprovedFlashlight.js`**: This class creates and manages the player's flashlight. It's a `SpotLight` attached to the scene that continuously updates its position and target to match the camera's view. It includes features like a battery system, intensity flickering at low power, and a toggle function bound to the 'F' key.
* **`src/systems/CannonPhysicsManager.js`**: This system gives the player a physical presence in the world using the `cannon-es` physics library. It creates a spherical physics body for the player, applies gravity, and handles collisions with the mansion's walls and floors. It receives input from `PlayerControls` to apply forces and velocities for walking, running, and jumping.

### World & Atmosphere
The game world is procedurally generated and enhanced with atmospheric effects to create a horror setting.

* **`src/systems/ProceduralMansion.js`**: This powerful system is responsible for generating the entire mansion layout from scratch. It algorithmically places rooms, connects them with hallways, and builds the 3D mesh for the floors and walls. It also populates the rooms with furniture and puzzle elements.
* **`src/systems/HorrorAtmosphere.js`**: To create a tense environment, this system adds visual effects like volumetric fog, floating dust particles, flickering lights, and dynamically triggered "scare events" (e.g., a shadow figure, whispers).
* **`src/components/World/scene.js`**: A simple utility that creates the main Three.js `Scene` object with a black background and initial fog settings, establishing the base horror tone.

### Game & Interaction
These systems manage the game state and how the player interacts with the world.

* **`src/systems/GameManager.js`**: This is the high-level state machine for the game. It tracks the player's inventory, current objectives, and overall game progress (playing, won, lost). It's the central authority for game-wide events.
* **`src/systems/InteractionSystem.js`**: This system enables the player to interact with objects. It uses a `Raycaster` that shoots a ray from the center of the screen. If the ray hits an object with `interactable` user data within a certain range, it displays a prompt ("Press E to open") and handles the interaction logic when the player clicks or presses 'E'.

### Rendering Engine
* **`src/systems/Loop.js`**: This is the main game loop. It uses Three.js's `Clock` to calculate the time delta between frames and calls the `.tick(delta)` method on all "updatable" objects (like controls, physics, and animations) before rendering a new frame.
* **`src/systems/Renderer.js` & `Resizer.js`**: These files set up the core Three.js `WebGLRenderer` and ensure that the canvas and camera automatically resize to fit the browser window.

---

## 🎨 The UI System (In-Depth Guide)

The UI is built using a component-based approach where HTML and CSS are separated into their own files and managed by the `UIManager`. This system can seem complex, but it's designed to be highly organized and scalable.

### How It Works: The Core Concept
The `UIManager`'s job is to load all the separate HTML UI fragments into the main `index.html` file at startup. This way, all possible UI elements exist in the DOM from the beginning, but are hidden. The manager can then simply show or hide them as needed, without having to load files during gameplay.

1.  **HTML Placeholders**: The main `index.html` file is very simple. It contains empty `<divs>` that act as containers or "mount points" for the UI components, for example `<div id="puzzle-container"></div>`.
2.  **Component Folders**: Each UI component (like the welcome screen or the color puzzle) has its own dedicated folder inside `src/ui/`. This folder contains its HTML structure and CSS styles, making it a self-contained unit.
3.  **CSS Linking**: To ensure reliability and speed, all component-specific CSS files are linked directly in the `<head>` of `index.html`. The browser loads all styles up front, preventing any "flash of unstyled content".
4.  **HTML Injection & Caching**: When the game starts, the `UIManager.initialize()` method is called. It fetches the HTML content of each component and injects it into the corresponding placeholder `div` in `index.html`. It then caches references to all important elements (buttons, text fields, etc.) in its `this.uiElements` object. This is a huge performance boost, as the game code can now access UI elements instantly without searching the DOM every time.

### How `main.js` Uses the `UIManager`
The integration in `main.js` is clean and straightforward. It creates the manager, initializes it, and then uses it to control the game flow.

```javascript
// src/main.js

// 1. Import the manager
import { UIManager } from './systems/uiManager.js';

async function main() {
    // ...
    // 2. Create an instance of the manager
    const uiManager = new UIManager();
    
    // 3. Initialize it. The 'await' is crucial, as it pauses
    //    execution until all HTML has been loaded and cached.
    await uiManager.initialize();

    // 4. Use the manager to show the first screen and provide a
    //    callback function for what to do when the "Play" button is clicked.
    uiManager.showWelcomeScreen(async () => {
        // ... all the game initialization logic goes here ...
        uiManager.hideLoadingScreen();
    });
    // ...
}

main();
```

### How to Add a New UI Component (Step-by-Step)
Let's say you want to add a new "Settings" menu that can be accessed from the welcome screen.

#### 1. Create the Component Folder and Files
Inside `src/ui/`, create a new folder `settingsMenu`. Inside it, create two files:

**`src/ui/settingsMenu/settings-menu.html`**
```html
<div id="settings-menu" class="menu-screen">
  <h2>Settings</h2>
  <label for="volume-slider">Volume:</label>
  <input type="range" id="volume-slider" min="0" max="100" value="80">
  <button id="back-to-main-btn">Back</button>
</div>
```

**`src/ui/settingsMenu/settings-menu.css`**
```css
#settings-menu {
  position: absolute;
  width: 100%;
  height: 100%;
  background: #111;
  z-index: 1003; /* Higher than the welcome screen */
  flex-direction: column;
  justify-content: center;
  align-items: center;
  /* Start hidden */
  display: none; 
}
/* ... other styles for the slider and button ... */
```

#### 2. Update `index.html`
Add a placeholder `div` for the new menu and a `<link>` tag for its stylesheet.

```html
<head>
    ...
    <link rel="stylesheet" href="./styles/main.css">
    <link rel="stylesheet" href="./src/ui/welcomeScreen/welcome-screen.css">
    <link rel="stylesheet" href="./src/ui/settingsMenu/settings-menu.css">
</head>
<body>
    ...
    <div id="settings-menu-container"></div>
    ...
</body>
```

#### 3. Update the `UIManager`
Finally, tell the `UIManager` to load the new component and add any interactive elements to its cache.

```javascript
// src/systems/uiManager.js
async initialize() {
    // ...
    // Load your new HTML file into its container
    await this._loadHTML('src/ui/settingsMenu/settings-menu.html', 'settings-menu-container');

    // After all HTML is loaded, cache the new elements
    this.uiElements = {
        // ... all the old elements
        settingsMenu: document.getElementById('settings-menu'),
        volumeSlider: document.getElementById('volume-slider'),
        backToMainBtn: document.getElementById('back-to-main-btn')
    };
    // ...
}

// You would then create new show/hide methods for it
showSettingsMenu() {
    if (this.uiElements.settingsMenu) {
        this.uiElements.settingsMenu.style.display = 'flex';
    }
}
hideSettingsMenu() {
    if (this.uiElements.settingsMenu) {
        this.uiElements.settingsMenu.style.display = 'none';
    }
}
```

---

## 🧩 The Puzzle System

The puzzle system is designed to be modular, allowing new puzzles to be created and integrated easily.

### How It Works
* **`src/systems/PuzzleSystem.js`**: This acts as a central registry for all puzzle instances in the game. When a puzzle is created in `main.js`, it's "registered" with the `PuzzleSystem`. This allows other systems to query what puzzles are available.
* **`src/puzzles/colorPuzzle/`**: This folder is a case study in how to structure a complex puzzle.
    * **`ColorPuzzle.js`**: The main orchestrator class. It initializes all the other parts of the puzzle and handles the main `show()` and `hide()` methods. It connects the logic to the UI.
    * **`PuzzleLogic.js`**: The "brain" of the puzzle. It manages the grid state and solves the flood-fill algorithm. It contains no DOM code.
    * **`PuzzleUI.js`**: The "hands" of the puzzle. It handles all rendering, DOM updates, and animations.
    * **`PuzzleTimer.js` & `PuzzleResult.js`**: Small, dedicated classes for managing the timer and the success/failure screen, respectively.

### How to Add a New Puzzle
1.  **Create the Puzzle Logic**: In `src/puzzles/`, create a new folder (e.g., `slidingTilePuzzle`). Inside, create your main puzzle class (`SlidingTilePuzzle.js`) and any other helper modules it needs.
2.  **Create the UI**: Follow the steps in the UI System section to create the HTML and CSS files for your new puzzle in the `src/ui/` directory (e.g., `src/ui/slidingTilePuzzle/`).
3.  **Instantiate in `main.js`**: Just like the `ColorPuzzle`, create an instance of your new puzzle when the game loads.
    ```javascript
    // src/main.js
    import { SlidingTilePuzzle } from './puzzles/slidingTilePuzzle/SlidingTilePuzzle.js';
    
    // ... in main() ...
    const slidingTilePuzzle = new SlidingTilePuzzle();
    await slidingTilePuzzle.loadData(); // if it needs to load data
    ```
4.  **Register the Puzzle**: In `main.js`, after initializing the `PuzzleSystem`, register your new puzzle instance.
    ```javascript
    // src/main.js
    puzzleSystem.registerPuzzle('slidingTilePuzzle', slidingTilePuzzle);
    ```
5.  **Create an Interaction Trigger**: In `src/systems/InteractionSystem.js`, add logic to trigger your puzzle. For example, you could add a new case in `handlePuzzleInteraction` that checks for `userData.puzzleType === 'sliding_tile'` and then calls `slidingTilePuzzle.show()`.
