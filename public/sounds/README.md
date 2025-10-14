# Timer Alert Sounds

This directory contains audio files for the study session timer alerts.

## Required Sound Files

Please add the following sound files to this directory:

1. **timer-complete.mp3** or **timer-complete.wav**
   - Used when study session completes
   - Suggested: Pleasant bell or chime sound (2-3 seconds)
   - Should be noticeable but not jarring

2. **break-complete.mp3** or **break-complete.wav**
   - Used when break time ends
   - Suggested: Gentle notification sound (2-3 seconds)
   - Can be the same as timer-complete or slightly different

## Where to Get Free Sounds

You can download free notification sounds from:
- https://mixkit.co/free-sound-effects/notification/
- https://freesound.org/ (search for "notification" or "bell")
- https://www.zapsplat.com/sound-effect-categories/

## Sound Specifications

- **Format**: MP3 or WAV
- **Duration**: 2-5 seconds
- **Volume**: Normalized (not too loud)
- **License**: Ensure commercial use is allowed

## Usage in Code

The sounds are referenced in the timer component as:
```typescript
const alertSound = new Audio('/sounds/timer-complete.mp3')
const breakSound = new Audio('/sounds/break-complete.mp3')
```
