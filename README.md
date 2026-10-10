# retroify

convert your videos into formats playable on retro devices. all in your browser, completely offline, nothing leaves your device.

live repo: https://github.com/pearsies/retroify

trying to watch modern 4k 60fps videos on an old ipod classic, psp, or nokia phone usually means dealing with weird ffmpeg commands that fail because of unsupported baseline profiles, wrong audio sample rates, or missing fast-start moov atoms.

retroify fixes this. drop your video in, pick your device, and hit convert. everything is transcoded client-side using hardware-accelerated webcodecs right inside your browser.

## supported devices

- apple ipod classic (5th / 5.5g / 6th gen), ipod nano (3rd-5th gen)
- sony walkman nw-a25, nw-e080, nwz-a15 series
- sony playstation portable (psp-1000 / 2000 / 3000 / psp go)
- apple iphone 2g / 3g / 3gs
- nintendo 3ds / 2ds
- nokia n95, n82, e71 (symbian s60)
- nokia 6300, 5310 xpressmusic (series 40)
- nokia 3310 3g, early camera phones (3gp / qcif)
- microsoft zune
- blackberry bold 9000
- generic 2000s mp4 players (creative zen, archos, rockchip, sigmatel)
- custom presets (custom resolution, bitrate, fps, and audio boost)

## features

- 100% in-browser processing: zero server uploads, total privacy, works offline.
- hardware accelerated: uses the modern webcodecs api (`videodecoder` + `videoencoder`) for speeds up to 10x-20x realtime.
- battery & memory friendly: pipelined streaming chunks with bounded queue backpressure so long 2-hour movies won't crash your browser tab.
- fast-start mp4: places the moov atom at the front of the file so retro firmware decoders can start playing instantly without buffering into ram.
- smart cadence skipping: drops extra source frames cleanly without drifting presentation timestamps (pts) out of sync with audio.
- built-in trimming: set custom start and end points directly in the ui.
- audio boost: optional +3db / +6db gain for quiet vintage phone speakers.
- transfer guides: built-in instructions showing you the exact usb folder paths and quirks for each device.
- system dark mode: automatically adapts to your system theme without extra clutter or toggles.

## tech stack

- react 19 + vite
- tailwind css v4
- webcodecs api (hardware accelerated decoding & encoding)
- mp4box.js (fast client-side demuxing)
- mp4-muxer (clean iso bmff fast-start multiplexing)
- satoshi light typography

## getting started

make sure you have node.js (v18+) installed.

```bash
# clone the repo
git clone https://github.com/pearsies/retroify.git

# hop into the directory
cd retroify

# install dependencies
npm install

# start local dev server
npm run dev
```

open `http://localhost:3000` in your browser.

note: webcodecs is supported out of the box in chrome, edge, safari 16.4+, and firefox 130+.

## building for production

```bash
npm run build
```

the static output will be generated inside the `dist` folder. you can deploy it to github pages, vercel, netlify, cloudflare pages, or host it anywhere.

## contributing

pull requests and issues are super welcome! if you have a retro device that needs custom bitrate or profile tweaks, feel free to submit a preset in `src/constants/presets.ts`.

## license

mit license. do whatever you want with it!
