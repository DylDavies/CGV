# Stage 1 Implementation Guide
## The Journalist's Office Puzzle Flow

Complete implementation details for the Stage 1 puzzle sequence that leads to player capture.

---

## Overview

Stage 1 is a self-contained narrative and puzzle experience set in the player's office. The sequence progresses from a mysterious phone call through a computer-based investigation, culminating in the player discovering a final clue that triggers their capture and transition to Stage 2.

**Duration:** Approximately 10-15 minutes
**Trigger:** Automatic on office stage load
**Outcome:** Transition to mansion (Stage 2)

---

## System Architecture

### Stage1Manager (`src/systems/Stage1Manager.js`)

Central coordinator for all Stage 1 events and puzzles. Manages:
- Phone call triggering and response
- Computer login system
- Desktop file interface
- Physical object interactions
- Capture sequence execution

**Key Properties:**
- `stage1Active`: Tracks if Stage 1 is currently running
- `phoneAnswered`: Tracks phone interaction
- `computerLoggedIn`: Tracks login completion
- `reportFound`: Tracks missing persons file retrieval
- `captureTriggered`: Tracks if capture sequence has started

### Integration Points

1. **GameManager** - Tracks objectives and inventory
2. **UIManager** - Displays overlays and objectives
3. **AudioManager** - Plays sound effects and dialogue
4. **MansionLoader** - References office props/objects
5. **InteractionSystem** - Handles player clicks on 3D objects
6. **NarrativeManager** - Transitions to Stage 2

---

## Detailed Flow

### Step 1: Phone Call Trigger (0-5 seconds)

**Timing:** Automatically starts 5 seconds after stage load

**Audio:** Phone ring tone (looping)

**Interaction:** Player must click the "Desk" object

**Code Flow:**
```
Stage1Manager.startStage1()
└─ setTimeout(5000)
   └─ Stage1Manager.triggerPhoneCall()
      ├─ audioManager.play('phone_ringing')
      ├─ Enable desk interactivity
      └─ Auto-answer after 15 seconds if no click
```

**Object Requirements:**
- **Desk** - 3D model in office where phone interaction occurs
  - Must be named "Desk" or accessible via `mansionLoader.getProp('desk')`
  - Should be positioned at a reasonable interaction distance
  - Could have slight visual indication (glow, highlight on hover)

**Audio Requirements:**
- `phone_ringing` - Persistent looping phone ring sound
  - Should be ~2 seconds per ring cycle
  - Medium-high volume (clear but not overwhelming)

---

### Step 2: Phone Answer & Voicemail (5-8 seconds)

**Trigger:** Player clicks desk or 15-second timeout

**Audio:** Voicemail from editor

**UI Feedback:** Objective message

**Code Flow:**
```
Stage1Manager.answerPhone()
├─ audioManager.stopSound('phone_ringing')
├─ audioManager.play('voicemail_editor')
├─ uiManager.displayObjective(...)
└─ setTimeout(3000) → setupComputerInteraction()
```

**Audio Requirements:**
- `voicemail_editor` - Editor's voicemail message
  - Content: "You'd better have a real story on this 'Mansion' lead, or you're finished!"
  - Duration: ~3-4 seconds
  - Tone: Demanding, urgent
  - Could be multiple sound files spliced together for variety

**UI Display:**
```
Title: "Editor's Voicemail"
Description: "You'd better have a real story on this 'Mansion' lead, or you're finished!"
```

---

### Step 3A: Notepad Hint (Passive)

**Interaction:** Player clicks notepad on desk

**UI Feedback:** Hint message

**Purpose:** Guides player toward newspaper clue

**Code Flow:**
```
Stage1Manager.setupNotepadHint()
├─ Find notepad object
└─ On click: Display hint message
   "Password hint: my first big break."
```

**Object Requirements:**
- **Notepad** - Small 3D model on desk surface
  - Named "Notepad" or similar
  - Should be visually distinct and clickable

**Hint Message:**
```
Title: "Notepad"
Description: "Password hint: my first big break."
```

**Player Action:** This guides them to look for newspaper clues about "big break" stories

---

### Step 3B: Newspaper Clue (Passive)

**Interaction:** Player clicks framed newspaper on office wall

**UI Feedback:** Headline revelation

**Purpose:** Provides actual password for computer

**Code Flow:**
```
Stage1Manager.showNewspaperClue()
├─ Find newspaper object
└─ On click: Display clue message with headline
   "MINE COLLAPSE - Your biggest investigative piece."
```

**Object Requirements:**
- **Newspaper/Paper** - Framed newspaper on wall
  - Named "Newspaper", "Paper", or similar
  - Should be readable/visible from typical player viewing angles
  - Optional: Could have slight glow to make it stand out

**Clue Message:**
```
Title: "Newspaper Headline"
Description: "MINE COLLAPSE - Your biggest investigative piece. The password hint makes sense now."
```

**The Connection:**
- Hint: "my first big break"
- Newspaper headline: "MINE COLLAPSE"
- Password: "MINECOLLAPSE" (with spaces removed, uppercase)

---

### Step 4: Computer Login (8-15 seconds)

**Trigger:** Player clicks computer model

**Interface:** Green terminal-style login screen (classic hacker aesthetic)

**Password:** MINECOLLAPSE

**Code Flow:**
```
Stage1Manager.openComputerLogin()
├─ Create HTML overlay (green-on-black terminal)
├─ Show password input field
├─ Show newspaper clue prompt (automatic)
└─ On correct password:
   ├─ computerLoggedIn = true
   └─ openComputerDesktop()
```

**Interface Details:**

```
LOGIN
─────
Username: journalist [disabled]
Password: [______]
[LOGIN]
```

**Styling:**
- Background: Pure black (#0a0a0a)
- Text color: Bright green (#00ff00)
- Border: Glowing green (#00ff00)
- Font: Courier New (monospace)
- Glow effect: `box-shadow: 0 0 20px rgba(0, 255, 0, 0.5)`

**CSS File:** `src/ui/stage1-computer/stage1-computer.css`

**Error Handling:**
```
Error message: "Incorrect password"
Action: Clear password field, stay on login screen
Allow: Unlimited retry attempts (no lockout)
```

---

### Step 5: Computer Desktop (15-20 seconds)

**Trigger:** Successful login

**Interface:** Desktop with four clickable files

**Purpose:** Reveal investigation details and create anticipation

**Code Flow:**
```
Stage1Manager.openComputerDesktop()
├─ Create desktop overlay
├─ Show four file icons
└─ Set up file click handlers
```

**Desktop Layout:**

```
┌─ Journalist's Computer ──────────────────────────────┐
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                      │
│  [🎵]              [🗺️]                             │
│  Interview.wav     Mansion_Layout.jpg               │
│                                                      │
│  [🔒]              [📝]                             │
│  Evidence.zip      NOTE.txt                         │
│                                                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Files & Behaviors:**

#### 1. Interview.wav
- **Icon:** 🎵 (speaker symbol)
- **Action:** Play audio file
- **Audio Content:** Lore about mansion's history and missing people
- **Duration:** ~2-3 minutes
- **UI Feedback:** "Audio file playing..."
- **Code:** `audioManager.play('interview_audio')`

#### 2. Mansion_Layout.jpg
- **Icon:** 🗺️ (map symbol)
- **Action:** Display blueprint image
- **Content:** Architectural blueprint of the mansion
- **Size:** Max 1200px wide, maintains aspect ratio
- **UI:** Full-screen image viewer with close button
- **Code:** `Stage1Manager.showImageOverlay()`

#### 3. NOTE.txt
- **Icon:** 📝 (document symbol)
- **Action:** Display text file
- **Content:** "ZIP password is the case number from the Miller disappearance."
- **Purpose:** Direct player to find missing persons file
- **UI Feedback:** Objective display with note content

#### 4. Evidence.zip
- **Icon:** 🔒 (lock symbol)
- **Action:** Prompt for password
- **Password:** 8013
- **Locked Until:** Player retrieves missing persons report
- **Error Message:** "Incorrect password. Try finding the missing persons report."
- **Code:** `Stage1Manager.promptForZipPassword()`

---

### Step 6: Physical Investigation (15-30 seconds)

**Objective:** Find the missing persons report with case number

**Location:** Behind a loose book on office bookshelf

**Code Flow:**
```
Stage1Manager.setupMissingPersonsFile()
├─ Find "loose book" object
├─ On click:
│  ├─ Remove book visually
│  ├─ Retrieve "Missing Persons Report"
│  ├─ Add to inventory
│  └─ Display objective message
└─ Inventory setup:
   └─ On inventory click: View report with case number
```

**Physical Objects:**

- **Bookshelf** - Office wall furniture with multiple books
- **Loose Book** - One book that protrudes or looks out of place
  - Named: "LooseBook" or "Book"
  - Should have slight visual distinction (color, glow, offset)
  - Interactive on click

**Report Contents:**

```
MISSING PERSONS REPORT
────────────────────
Subject: [Name]
Date Missing: [Date]
Case Number: 8013
Description: [Details about Miller disappearance]
```

**Inventory System:**
```
GameManager.addToInventory({
  name: 'Missing Persons Report',
  type: 'document',
  description: 'Case report for the Miller disappearance',
  caseNumber: 8013
})
```

**Viewing Report:**
- Player clicks item in inventory
- HTML overlay displays report image/text
- Case number "8013" is clearly visible and highlighted
- Player can close and return to computer

---

### Step 7: The Trap Sequence (30-40 seconds)

**Trigger:** Player enters "8013" as Evidence.zip password

**Sequence:** Rapid-fire events that build tension and execute capture

**Code Flow:**
```
Stage1Manager.unlockedEvidenceZip()
├─ captureTriggered = true
├─ executeCaptureSequence()
│  ├─ Phase 1: Display symbol image (2s)
│  │  ├─ Show flickering Symbol.jpg
│  │  └─ Play flicker CSS animation
│  │
│  ├─ Phase 2: Door unlocks (immediate)
│  │  ├─ audioManager.play('door_unlock_click')
│  │  └─ Display READ_ME.txt on desktop
│  │
│  ├─ Phase 3: First door bang (2s after unlock)
│  │  ├─ audioManager.play('door_bang_1')
│  │  └─ shakeCamera(0.5)
│  │
│  ├─ Phase 4: Wait 1 second
│  │
│  ├─ Phase 5: Second loud bang (3s total)
│  │  ├─ audioManager.play('door_bang_2_loud')
│  │  └─ shakeCamera(1.0) [more intense]
│  │
│  ├─ Phase 6: Final thud + blackout (3.5s total)
│  │  ├─ audioManager.play('door_thud')
│  │  ├─ fadeToBlack()
│  │  └─ Transition to Stage 2
│  │
│  └─ transitionToStage2()
│     └─ narrativeManager.transitionToStage('mansion')
```

#### Sub-Step 7A: Symbol Image Display (0-2 seconds)

**Visual:** Flickering image overlay

**Image:** Symbol.jpg (mysterious occult symbol)

**Animation:** CSS flicker at 0.15s intervals

```css
@keyframes flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
```

**Code:**
```
displaySymbolImage()
├─ Create overlay
├─ Show Symbol.jpg
├─ Apply flicker animation
└─ Auto-close after 2s
```

#### Sub-Step 7B: Door Unlock Sound (2 seconds)

**Audio:** Click sound effect (door unlock)

**Purpose:** Establish intruder entering building

**Details:**
- Short (0.5-1 second) sharp click/snap sound
- Medium volume, clear
- Immediately followed by visual content

#### Sub-Step 7C: READ_ME Message Display (2-4 seconds)

**Visual:** Simple text on black background

**Content:**
```
READ_ME.txt
───────────
You wanted a story.

Now you have one.
```

**Duration:** 2 seconds on screen

**Styling:**
- Centered
- Large, readable font
- Green text on black (consistent with computer theme)
- Ominous tone

#### Sub-Step 7D: First Door Bang (2-2.5 seconds)

**Audio:** Door impact sound (medium)

**Visual:** Camera shake (subtle)

**Shake Parameters:**
- Intensity: 0.5
- Duration: 300ms
- Random displacement: +/- 0.5 units

**Code:**
```
shakeCamera(0.5)
├─ Store original camera position
├─ For 300ms:
│  ├─ Apply random offset
│  └─ Continuously update position
└─ Restore original position
```

**Purpose:** Establish someone attempting entry

#### Sub-Step 7E: Second Door Bang (3-3.5 seconds)

**Audio:** Louder door impact sound

**Visual:** Stronger camera shake

**Shake Parameters:**
- Intensity: 1.0 (double the first bang)
- Duration: 300ms
- Random displacement: +/- 1.0 units

**Purpose:** Second attempt, more forceful

#### Sub-Step 7F: Final Thud & Blackout (3.5-4.5 seconds)

**Audio:** Final heavy impact ("thud" sound)

**Visual:** Fade to black over 1 second

**Fade Implementation:**
```
fadeToBlack()
├─ Create div overlay
├─ Set opacity: 0
├─ Transition to opacity: 1 (1 second)
└─ Trigger stage transition on fade complete
```

**Code:**
```css
overlay {
  background-color: black;
  opacity: 0;
  transition: opacity 1s ease-in;
}
/* Then in JS: overlay.style.opacity = '1' */
```

**Purpose:** Player loses consciousness / captured

---

## Audio Requirements

### Sound Effects Needed

| Sound | Duration | Purpose | Tone |
|-------|----------|---------|------|
| `phone_ringing` | 2s loop | Phone call trigger | Generic phone ring |
| `voicemail_editor` | 3-4s | Editor's message | Professional, demanding |
| `door_unlock_click` | 0.5s | Door unlocks | Sharp, metallic click |
| `door_bang_1` | 0.5s | First impact | Medium wooden thud |
| `door_bang_2_loud` | 0.5s | Second impact | Loud wooden thud |
| `door_thud` | 0.5s | Final impact | Heavy, final thud |
| `interview_audio` | 2-3m | Mansion lore | Narrative voiceover |

### Audio Integration

**File Locations:**
- Sounds should be in `public/audio/`
- Register in AudioManager's sound paths
- Set appropriate volume levels

**AudioManager Integration:**
```javascript
audioManager.play('phone_ringing');
audioManager.stopSound('phone_ringing');
audioManager.play('voicemail_editor');
audioManager.play('door_unlock_click');
audioManager.play('door_bang_1');
audioManager.play('door_bang_2_loud');
audioManager.play('door_thud');
audioManager.play('interview_audio');
```

---

## 3D Model Requirements

### Office Environment Objects

| Object Name | Purpose | Interactive | Notes |
|------------|---------|-------------|-------|
| **Desk** | Phone interaction location | Yes | Central player interaction point |
| **Computer** | Login/file interface | Yes | Must support click detection |
| **Notepad** | Hint system | Yes | Small object on desk |
| **Newspaper** | Password clue | Yes | Wall-mounted, readable headline |
| **LooseBook** | Report retrieval | Yes | Bookshelf object, slightly offset |
| **Bookshelf** | Environment | No | Contains loose book |
| **Office Wall** | Environment | No | Where newspaper hangs |

### Naming Convention

Objects should be named in the model:
- `Desk` or `S_Desk`
- `Computer` or `S_Computer`
- `Notepad` or `S_Notepad`
- `Newspaper` or `S_Paper`
- `LooseBook` or `S_Book`

**Fallback System:**
If not found by name, code searches the scene tree:
```javascript
findObjectByName(name) {
  // Searches scene.traverse() for matching name
  // Case-insensitive matching available
}
```

---

## UI Overlays & Styling

### CSS Framework

**File:** `src/ui/stage1-computer/stage1-computer.css`

**Key Classes:**
- `.computer-overlay` - Full-screen backdrop
- `.computer-screen` - Main content box
- `.login-container` - Login layout
- `.desktop-icons` - File grid layout
- `.file-icon` - Individual file item
- `.symbol-container` - Symbol image display
- `.readme-container` - ReadMe text display

### Color Scheme

- **Background:** Black (#0a0a0a)
- **Text:** Bright green (#00ff00)
- **Borders:** Bright green (#00ff00)
- **Hover:** Lighter green (#00dd00)
- **Error:** Red (#ff0000)
- **Glow:** Soft green shadow (rgba(0, 255, 0, 0.5))

### Responsive Design

- Supports desktop and mobile
- Max width: 1200px (images)
- Scales to 90% viewport width on small screens
- Touch-friendly button sizes (12px+ padding)

---

## Integration Checklist

### Required Systems
- [ ] **AudioManager** - Configured with all required sounds
- [ ] **UIManager** - Method `displayObjective()` available
- [ ] **GameManager** - Method `addToInventory()` available
- [ ] **MansionLoader** - Can reference office props via `getProp()`
- [ ] **InteractionSystem** - Handles clicks on office objects
- [ ] **NarrativeManager** - Can transition to mansion stage
- [ ] **StageManager** - Tracks `currentStage` property

### Optional Enhancements
- [ ] Inventory system visual display
- [ ] Report document HTML page
- [ ] Symbol image asset (.jpg file)
- [ ] Mansion blueprint image (.jpg file)
- [ ] Custom voicemail recordings
- [ ] Visual book-removal animation

---

## Developer Implementation Steps

### 1. Asset Preparation
```
public/audio/
├── phone_ringing.wav
├── voicemail_editor.wav
├── door_unlock_click.wav
├── door_bang_1.wav
├── door_bang_2_loud.wav
├── door_thud.wav
└── interview_audio.wav

public/assets/
├── symbol.jpg
└── mansion_blueprint.jpg
```

### 2. Register Sounds in AudioManager
```javascript
// In AudioManager.js constructor
this.soundPaths = {
  phone_ringing: 'public/audio/phone_ringing.wav',
  voicemail_editor: 'public/audio/voicemail_editor.wav',
  // ... etc
}
```

### 3. Update Model Names
In Blender export:
- Name all interactive objects correctly
- Verify they export to the GLB model
- Test `findObjectByName()` finds them

### 4. Test Each Step
1. Verify office loads with correct props
2. Phone ring triggers at 5 seconds
3. Desk click stops ring and plays voicemail
4. Computer click opens login screen
5. Correct password unlocks desktop
6. All files open correctly
7. Physical report retrieval works
8. Capture sequence executes fully

### 5. Fine-Tuning
- Adjust camera shake intensity
- Balance audio volumes
- Tweak animation timings
- Polish visual transitions

---

## Troubleshooting

### Phone Doesn't Ring
- Check AudioManager has 'phone_ringing' sound registered
- Verify `startStage1()` is called for office stage
- Check browser console for errors

### Computer Overlay Not Showing
- Verify CSS file is linked in `index.html`
- Check z-index values (should be 1000+)
- Ensure `createComputerLogin()` is called

### Report Can't Be Found
- Check bookshelf object naming in model
- Verify `setupMissingPersonsFile()` is called
- Test `findObjectByName('LooseBook')` in console

### Capture Sequence Doesn't Trigger
- Verify correct ZIP password is '8013'
- Check `unlockedEvidenceZip()` is called
- Ensure Stage transition audio files exist

---

## Timeline Summary

```
0s    ├─ Stage loads
5s    ├─ Phone ring starts
5-15s ├─ Player answers phone
      ├─ Phone call dialog
      └─ Computer interaction enabled
15s   ├─ Computer login screen
15-30s├─ Password entry (notepad → newspaper → password)
      ├─ Computer desktop
      └─ File exploration
30s   ├─ Report finding (physical)
      └─ ZIP password entry
30-40s├─ CAPTURE SEQUENCE
      ├─ Symbol display (2s)
      ├─ Door unlock sound
      ├─ ReadMe message
      ├─ First door bang + shake
      ├─ Second door bang + shake
      ├─ Final thud + fade
      └─ Stage transition to mansion
```

---

## Notes for Level Designers

1. **Pacing:** The flow naturally guides players without hand-holding
2. **Difficulty:** Moderate puzzle difficulty (solvable in 10 minutes without guides)
3. **Atmosphere:** Dark, tense office environment with mystery elements
4. **Narrative:** Establishes that player's research accidentally triggered danger
5. **Player Agency:** Multiple optional interactions (interview, layout) create exploration feel
6. **Climax:** Capture sequence is dramatic and unavoidable - creates excellent narrative hook

---

## Future Enhancement Ideas

- [ ] Save/load system checkpoint in office
- [ ] Alternate passwords based on player actions
- [ ] Computer desktop shortcuts for other content
- [ ] Breaking window/light effects during capture
- [ ] Monster silhouette visible through window before capture
- [ ] Randomized file content for replayability
- [ ] Easter eggs in computer files
- [ ] Voice lines from monster during capture sequence
