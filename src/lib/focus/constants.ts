// Virtual Backgrounds
export const VIRTUAL_BACKGROUNDS = [
  {
    id: 'none',
    name: 'Default',
    description: 'Dark minimal background',
    bgClass: 'bg-neutral-950',
    previewColor: '#0a0a0a',
  },
  {
    id: 'library',
    name: 'Library',
    description: 'Quiet study space',
    bgClass: 'bg-gradient-to-br from-amber-950 via-neutral-950 to-neutral-900',
    previewColor: '#451a03',
  },
  {
    id: 'cafe',
    name: 'Cozy Café',
    description: 'Warm coffee shop vibes',
    bgClass: 'bg-gradient-to-br from-orange-950 via-amber-950 to-neutral-900',
    previewColor: '#431407',
  },
  {
    id: 'nature',
    name: 'Nature',
    description: 'Peaceful forest setting',
    bgClass: 'bg-gradient-to-br from-emerald-950 via-teal-950 to-neutral-900',
    previewColor: '#022c22',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Calm seaside view',
    bgClass: 'bg-gradient-to-br from-cyan-950 via-blue-950 to-neutral-900',
    previewColor: '#083344',
  },
  {
    id: 'night',
    name: 'Night Sky',
    description: 'Starry night atmosphere',
    bgClass: 'bg-gradient-to-br from-indigo-950 via-slate-950 to-neutral-900',
    previewColor: '#1e1b4b',
  },
]

// Ambient Sounds
export const AMBIENT_SOUNDS = [
  {
    id: 'none',
    name: 'Silent',
    icon: '🔇',
    // No sound file
  },
  {
    id: 'rain',
    name: 'Rain',
    icon: '🌧️',
    // Use Web Audio API for generation
  },
  {
    id: 'cafe',
    name: 'Café',
    icon: '☕',
  },
  {
    id: 'white_noise',
    name: 'White Noise',
    icon: '📻',
  },
  {
    id: 'piano',
    name: 'Soft Piano',
    icon: '🎹',
  },
  {
    id: 'forest',
    name: 'Forest',
    icon: '🌲',
  },
]

// Pomodoro Presets
export const POMODORO_PRESETS = [
  { id: 'classic', name: 'Classic', focusMinutes: 25, breakMinutes: 5 },
  { id: 'short', name: 'Short', focusMinutes: 15, breakMinutes: 3 },
  { id: 'long', name: 'Long', focusMinutes: 50, breakMinutes: 10 },
  { id: 'custom', name: 'Custom', focusMinutes: 0, breakMinutes: 0 },
]

// Motivational Quotes
export const MOTIVATIONAL_QUOTES = [
  { text: "Small steps lead to big achievements.", author: "Unknown" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus on progress, not perfection.", author: "Unknown" },
  { text: "Your future self will thank you.", author: "Unknown" },
  { text: "One hour of focused work beats three hours of distraction.", author: "Unknown" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Education is not preparation for life; education is life itself.", author: "John Dewey" },
  { text: "The beautiful thing about learning is that nobody can take it away from you.", author: "B.B. King" },
  { text: "Stay focused. Your dedication today shapes your tomorrow.", author: "Unknown" },
  { text: "Every expert was once a beginner.", author: "Helen Hayes" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
]

// Focus Room Storage Keys
export const STORAGE_KEYS = {
  BACKGROUND: 'focus_background',
  SOUND: 'focus_sound',
  SOUND_VOLUME: 'focus_sound_volume',
  POMODORO_ENABLED: 'focus_pomodoro_enabled',
  POMODORO_PRESET: 'focus_pomodoro_preset',
  POMODORO_FOCUS: 'focus_pomodoro_focus',
  POMODORO_BREAK: 'focus_pomodoro_break',
  DISTRACTION_BLOCK: 'focus_distraction_block',
  QUOTES_ENABLED: 'focus_quotes_enabled',
}
