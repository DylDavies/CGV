# Stage 1 Quick Reference Guide

## Fast Implementation Checklist

### ✅ Code Files Created
- [x] `src/systems/Stage1Manager.js` - Main puzzle coordinator
- [x] `src/ui/stage1-computer/stage1-computer.css` - Visual styling
- [x] `index.html` - CSS link added
- [x] `src/main.js` - Import and initialization added

### 🎨 Assets Needed (Create These)

**Audio Files** (place in `public/audio/`)
```
phone_ringing.wav              (2s loop, phone ring)
voicemail_editor.wav           (3-4s, editor message)
door_unlock_click.wav          (0.5s, sharp click)
door_bang_1.wav                (0.5s, medium thud)
door_bang_2_loud.wav           (0.5s, loud thud)
door_thud.wav                  (0.5s, final thud)
interview_audio.wav            (2-3m, mansion lore)
```

**Image Assets** (place in `public/assets/`)
```
symbol.jpg                     (mysterious occult symbol)
mansion_blueprint.jpg          (floor plan image)
```

### 🏢 3D Model Requirements (Update Blender Export)

Name these objects in your office model:
```
Desk                           (main interaction point)
Computer                       (login interface)
Notepad                        (on desk, hint giver)
Newspaper or Paper            (on wall, password clue)
LooseBook or Book             (on bookshelf, retrieves report)
```

### 🔊 Register Sounds in AudioManager

Add to `src/systems/AudioManager.js`:
```javascript
this.soundPaths = {
  phone_ringing: 'public/audio/phone_ringing.wav',
  voicemail_editor: 'public/audio/voicemail_editor.wav',
  door_unlock_click: 'public/audio/door_unlock_click.wav',
  door_bang_1: 'public/audio/door_bang_1.wav',
  door_bang_2_loud: 'public/audio/door_bang_2_loud.wav',
  door_thud: 'public/audio/door_thud.wav',
  interview_audio: 'public/audio/interview_audio.wav'
};
```

### 🧪 Testing Sequence

1. **Load Office Stage**
   ```javascript
   gameControls.stageManager.transitionToStage('office')
   ```

2. **Test Each Step**
   - [ ] Wait 5 seconds → phone rings
   - [ ] Click desk → phone stops, voicemail plays
   - [ ] Click notepad → hint message shows
   - [ ] Click newspaper → password clue shows
   - [ ] Click computer → login screen appears
   - [ ] Enter "MINECOLLAPSE" → desktop loads
   - [ ] Click files → appropriate content displays
   - [ ] Click loose book → report added to inventory
   - [ ] Enter "8013" in ZIP → capture sequence starts
   - [ ] Watch capture sequence complete

### 📋 Main Code Entry Points

**Start Stage 1:**
```javascript
stage1Manager.startStage1()
```

**Trigger Specific Events:**
```javascript
stage1Manager.triggerPhoneCall()
stage1Manager.answerPhone()
stage1Manager.openComputerLogin()
stage1Manager.openComputerDesktop()
stage1Manager.retrieveMissingPersonsReport()
stage1Manager.executeCaptureSequence()
```

**Access from Console:**
```javascript
window.gameControls.stage1Manager.startStage1()
window.gameControls.stage1Manager.openComputerDesktop()
// etc...
```

### 🎯 Critical Method Calls

**Already Integrated in main.js:**
```javascript
// Auto-starts when office stage loads
if (stageManager.currentStage === 'office') {
  stage1Manager.setupMissingPersonsFile();
  stage1Manager.startStage1();
}
```

### 🐛 Debugging Tips

**Check if Stage1Manager is initialized:**
```javascript
console.log(window.gameControls.stage1Manager)
```

**Manually trigger phone:**
```javascript
window.gameControls.stage1Manager.triggerPhoneCall()
```

**Skip to desktop:**
```javascript
window.gameControls.stage1Manager.computerLoggedIn = true
window.gameControls.stage1Manager.openComputerDesktop()
```

**Trigger capture sequence directly:**
```javascript
window.gameControls.stage1Manager.executeCaptureSequence()
```

**Check stage state:**
```javascript
const sm = window.gameControls.stage1Manager
console.log({
  active: sm.stage1Active,
  phoneAnswered: sm.phoneAnswered,
  loggedIn: sm.computerLoggedIn,
  reportFound: sm.reportFound,
  captured: sm.captureTriggered
})
```

### 📊 Timeline at a Glance

| Time | Event | Player Action |
|------|-------|---------------|
| 0s | Office loads | Wait |
| 5s | Phone rings | Listen |
| 5-15s | Voicemail plays | Click desk |
| 15s | Computer ready | Click computer |
| 15-30s | Login screen | Enter MINECOLLAPSE |
| 15-30s | (Meanwhile) Find hints | Click notepad, newspaper |
| 30s | Desktop loads | Click files to explore |
| 30-45s | Find report | Click loose book |
| 45s | ZIP password | Enter 8013 |
| 45-55s | CAPTURE SEQUENCE | Watch/listen |
| 55s | Fade to black | Transition to Stage 2 |

### 🎬 Capture Sequence Breakdown

```
0.0s → Symbol image displays (flickering)
0.0s → Door unlock click sound
2.0s → ReadMe message displays
2.0s → First door bang + camera shake (0.5 intensity)
3.0s → Wait 1 second
4.0s → Second door bang + camera shake (1.0 intensity)
3.5s → Wait 0.5 seconds
4.0s → Final thud sound
4.0s → Fade to black (1 second duration)
5.0s → Transition to mansion stage
```

### 💾 Save/Checkpoint

Stage 1 doesn't use save system - it's linear progression. Once started, player must complete or restart.

### 🚀 Performance Considerations

- HTML overlays are created/destroyed dynamically (good for memory)
- CSS animations are GPU-accelerated (flicker effect)
- Camera shake uses `requestAnimationFrame` (smooth)
- No persistent UI elements after stage ends

### 📝 Notes for Future Expansion

- **Alternate passwords:** Easy to add in `openComputerLogin()`
- **Multiple endings:** Could branch on specific file interactions
- **Save game:** Add checkpoint before capture sequence
- **Monster appearance:** Could add monster silhouette in window during sequence
- **Additional files:** Can add more desktop icons and content

### 🔗 Related Systems

These systems must be working:
- **GameManager** - Inventory, objectives
- **UIManager** - Objective display, overlays
- **AudioManager** - Sound playback
- **InteractionSystem** - Object clicking
- **NarrativeManager** - Stage transitions
- **StageManager** - Current stage tracking

### ❓ FAQ

**Q: What if player finds book before computer?**
A: It's fine - report is just inventory until password entered.

**Q: Can player skip the phone?**
A: No, auto-answers after 15 seconds.

**Q: What if audio files are missing?**
A: Code has error handling, UI still displays.

**Q: Can player leave office mid-puzzle?**
A: Once captured sequence starts, it's unstoppable.

**Q: How do I test just the capture sequence?**
A: Run `window.gameControls.stage1Manager.executeCaptureSequence()`

**Q: Can player go back to office from mansion?**
A: No - Stage 1 is one-way progression.

---

**For detailed implementation info, see:** `STAGE1_IMPLEMENTATION.md`
