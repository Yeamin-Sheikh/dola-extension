# Dola AI Video Watermark Remover and Batch Studio v2.3.1

Chrome extension sidebar for automated batch video creation, unwatermarked 1080p raw MP4 downloading, and 100% in-browser dynamic watermark removal on Dola AI and Doubao.

## Overview

Dola Studio is a Manifest V3 browser extension built with a high-density obsidian UI, hardware-accelerated MediaRecorder inpainting, and an automated chat injection engine for Dola AI (`dola.com/chat`).

## Quick start

### Option 1: Load unpacked folder (recommended for development)

1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** using the toggle switch in the top right corner.
3. Click **Load unpacked** and select the `dola_watermark_remove` folder.
4. Navigate to `https://www.dola.com/chat`.
5. Click the extension icon in the Chrome toolbar to dock the sidebar.

### Option 2: Pre-packaged ZIP

1. Extract `dola_watermark_remove.zip`.
2. Follow steps 1 through 5 above, selecting the extracted directory.

## Key features

### 1. Generation section
- **Batch prompt input**: Paste prompts in any format (numbered `1.` / `2.`, bullet points `-`, double-spaced paragraphs, or single lines) without prompt collapsing or counter errors.
- **Live prompt counter**: Automatically parses and displays the exact number of prompts queued.
- **Paste to chat input**: One-click button to immediately paste formatted prompts with the official Generate Videos skill chip directly into Dola's chat input.
- **Aspect ratio presets**: Toggle between 9:16 vertical, 16:9 widescreen, or raw text format.
- **Automated slash command typing**: Types `/generate video` one character at a time with a 45ms delay, converts it into the Generate Videos skill chip, moves to a new line, and submits the batch.
- **Sidebar auto-zoom**: Automatically scales down the Dola webpage to your chosen percentage (default 80%) while the sidebar is open or on queue start, and resets back to 100% when the sidebar is closed.
- **Screen video grabber**: Grab and download any finished video currently visible on screen.
- **Download history**: View captured videos with timestamps, dynamic watermark badges, cleaned status badges, and click to open in Windows Explorer.

### 2. In-browser dynamic watermark cleaning engine
- **100% self-contained**: Entire watermark removal pipeline runs natively inside Chrome's offscreen engine with zero terminal commands, zero external Python processes, and no local servers.
- **Multiscale harmonic diffusion inpainting**: Reconstructs natural background textures frame-by-frame using soft Gaussian-feathered elliptical zones across all 3 ByteDance quadrants (Bottom-Right, Mid-Left, and Top-Right).
- **Audio preservation**: Retains original AAC audio tracks synchronously through HTMLMediaElement capture streams.
- **Native MP4 export**: Encodes clean watermark-free video directly into standard MP4 via hardware-accelerated MediaRecorder.
- **Segregated output**: Cleaned videos save directly into `Downloads/Dola_Videos/cleaned/`, keeping source and output files separate.

### 3. Settings section
- **Downloads and storage group**: Auto-download raw MP4 switch, Windows Downloads subfolder configurator, and desktop notifications toggle at the top of settings.
- **Automation sequence group**: Greeting selector, AI health check verification, and unattended bypass agreement editor in the middle.
- **Workspace and display group**: Sidebar auto-zoom toggle, active zoom factor selector, and fresh chat toggle at the bottom.
- **Natural action delays**: Pacing pauses between navigation, greeting, bypass, and prompt submission to keep execution smooth and reliable.
- **Prompt-based file naming**: Saves videos named directly after the prompt that created them, with clean Windows-safe ASCII sanitization.
- **Direct Blob pipeline**: Uses in-memory Blob URLs via an offscreen DOM engine, ensuring Chrome downloads directly to your chosen folder.

### 4. Right-click context menus
- **Browser context menu**: Right-click anywhere in Chrome to open Dola Studio sidebar, download the visible video on screen, add selected text to your batch prompts draft, or download a video from a link.
- **In-app custom context menu**: Custom Cut, Copy, Paste, and Select All context menu in the side panel and popup for text inputs and selections.

### 5. Stream interception and unwatermarked extraction
- Intercepts CDN video streams and requests raw unwatermarked media keys.
- Decodes QAAB AES-CBC tokens using native browser crypto APIs.
- In-memory Blob streaming: Downloads route cleanly to the target folder.
- Runs directly inside Chrome with minimal memory consumption.

## Repository structure

```
dola_extension/
├── dola_watermark_remove/      # Unpacked extension root (Manifest V3)
│   ├── manifest.json           # Extension permissions and background worker config
│   ├── background.js           # Background service worker with Blob download pipeline
│   ├── content.js              # Automation bridge and tab communication
│   ├── extractor.js            # Main world network interceptor and Tiptap injector
│   ├── offscreen.html          # Offscreen document host for inpainting engine
│   ├── offscreen.js            # Native canvas inpainting and MediaRecorder engine
│   ├── sidepanel.html          # Obsidian glass sidebar interface
│   ├── sidepanel.css           # 125% DPI optimized design system
│   ├── sidepanel.js            # Prompt parser, zoom coordinator, and queue runner
│   ├── popup.html              # Browser toolbar popup
│   ├── popup.css               # Popup styling
│   ├── popup.js                # Popup logic
│   ├── assets/                 # Icons and artwork
│   │   └── logo.png
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   ├── icon128.png
│   └── README.md
├── dola_watermark_remove.zip   # Ready-to-distribute packaged archive
├── .gitignore
└── README.md
```
