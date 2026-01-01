# VS-1

Too many samples, too little time? VS-1 is an audio sample tournament sorter that helps you find the best samples in large libraries through pairwise comparison.

![VS-1 Demo](app.gif)

## Features

- Scan directories for audio files (WAV, MP3, FLAC, OGG, AIFF, M4A)
- Swiss-style tournament ranking
- Keyboard-driven workflow
- Save/load session progress
- Export results

## How It Works

VS-1 uses a Swiss-style tournament system borrowed from chess competitions. Instead of single-elimination brackets (where one bad matchup knocks out a great sample) or exhaustive round-robin (where comparing 100 samples means 4,950 matchups), Swiss tournaments strike a balance:

1. **Samples are paired by similar win records** — after a few rounds, top samples face other top samples
2. **Every sample plays the same number of rounds** — nothing gets eliminated early
3. **Rankings emerge quickly** — a reliable ordering typically surfaces in log₂(n) rounds

For a library of 100 samples, you'll have a solid ranking after ~7 rounds (700 comparisons) instead of the ~5,000 a full round-robin would require.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Q | Play sample A |
| W | Play sample B |
| Enter | Select last played |
| X | Skip both |
| Space | Stop playback |
| L | Leaderboard |
| Cmd+S | Save |

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
