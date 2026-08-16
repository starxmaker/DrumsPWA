# Drum Kit PWA

A private, installable drum simulator. Play an eight-piece acoustic drum kit with your fingers — every hit is rendered with hand-drawn SVG artwork and CC BY 4.0 FreePats *MuldjordKit* samples that run entirely in the browser; no audio leaves the device.

## Features

- Eight-piece kit: kick, snare, hi-hat, two rack toms, floor tom, crash, and ride
- **Multi-touch polyphony** — strike several drums at once and they all sound
- Tap the centre of a head for full volume, the edge for softer, darker rim hits
- Press and hold the hi-hat for an open-wash voice
- Keyboard shortcuts on desktop (A S D J K L U I)
- Offline, installable PWA
- English and Spanish interface
- Responsive light and dark themes, master volume setting

## Development

```bash
npm install
npm run dev
```

Run all quality checks with `npm run check`. Set `VITE_BASE_PATH=/` for root-hosted builds; the default deployment path is `/drums-pwa/`.

Production builds download the pinned MuldjordKit archive from FreePats, verify its SHA-256 checksum, and extract only the nine required FLAC samples. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for attribution.

## Credits

- Drum samples: **MuldjordKit** by [Lars Muldjord](https://muldjord.com), via the [FreePats project](https://freepats.zenvoid.org/Percussion/acoustic-drum-kit.html), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

## License

The application source is licensed under **GPL-3.0-or-later**. The bundled MuldjordKit drum samples are licensed under **CC BY 4.0** (attribution provided above).
