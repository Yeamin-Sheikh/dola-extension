# Project progress

Auto-maintained by dev-tracker skill. Do not edit the log section manually.

## Project info

- **Project:** Dola AI Video Automation & Watermark Removal
- **Started:** 2026-09-06
- **Last updated:** 2026-09-06
- **Status:** Active

---

## Progress log

### 2026-09-08, Session 25

Status: Done

#### What changed
- Enriched all core extension modules (`extractor.js`, `content.js`, `sidepanel.js`, `background.js`) with deeply technical, architectural docstrings explaining ProseMirror node transactions, IPC boundaries, ByteDance CDN token canonicalization, and state machine transitions.
- Created official GitHub Release `v2.3.3` on `Yeamin-Sheikh/dola-extension` with `dola_watermark_remove.zip` attached.
- Deleted local `dola_watermark_remove.zip` file, removed it from Git tracking (`git rm --cached`), and added `*.zip` to `.gitignore`.
- Pushed clean source-only commit `677b92d` to GitHub repository `main` branch.

#### Files touched
- `dola_extension/dola_watermark_remove/extractor.js`: Added technical documentation for Tiptap editor polling, ProseMirror schema manipulation, and synthetic event dispatch.
- `dola_extension/dola_watermark_remove/content.js`: Added technical docstring for queue state machine and pre-flight execution.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Added lexical grammar and parsing hierarchy documentation.
- `dola_extension/dola_watermark_remove/background.js`: Added ByteDance CDN URI normalization and key derivation documentation.
- `dola_extension/.gitignore`: Added `*.zip` ignore rule.
- `dola_extension/dola_watermark_remove.zip`: Uploaded to GitHub release `v2.3.3` and removed from repository working directory.
- `PROGRESS.md`: Logged Session 25 updates.

---

### 2026-09-08, Session 24

Status: Done

#### What changed
- Removed the initial "hello" / "hey buddy" greeting check from the automation sequence entirely.
- Made the unattended bypass agreement message the single, direct pre-flight message sent to Dola before prompt dispatch.
- Removed obsolete greeting select and custom greeting inputs from `sidepanel.html` and cleaned up all greeting event handlers and state in `sidepanel.js`.
- Reduced queue step sequence count from 4 steps down to 2 (or 3 if fresh chat is requested), speeding up queue execution.
- Bumped extension version to v2.3.3 across `manifest.json`, `sidepanel.html`, and `README.md`, and rebuilt distribution zip `dola_extension/dola_watermark_remove.zip`.

#### Files touched
- `dola_extension/dola_watermark_remove/content.js`: Removed greeting check step from `executeAutomationQueue`.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Removed greeting message block from settings card, updated badge to v2.3.3.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Cleaned up greeting DOM references, event handlers, and storage loading.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.3.3.
- `dola_extension/README.md`: Updated badges and links to v2.3.3.
- `dola_extension/dola_watermark_remove.zip`: Rebuilt extension archive.
- `PROGRESS.md`: Logged Session 24 updates.

---

### 2026-09-08, Session 23

Status: Done

#### What changed
- Fixed raw prompt mode: when "Raw Prompt" mode is active, prompt text is preserved 100% verbatim without any numbering, prefixes, or modifications.
- Eliminated aggressive regex splitting that treated bullet points (`-`, `*`) and internal shot numbers as prompt delimiters, preventing structured multi-line prompts from fragmenting into 121 pieces.
- Added explicit divider support (`---`, `===`) for separating distinct multi-topic production prompts cleanly while keeping internal sections intact.
- Updated "Paste to Chat Input" to deliver clean, unadorned text directly to Dola's chat input in raw mode without unwanted `/generate video` mention chips or sequential numbering.
- Fixed temporal dead zone (TDZ) ReferenceError bug on extractor re-injection by removing hoisted re-attachment calls from the early return guard.
- Bumped extension version to v2.3.2 across `manifest.json`, `sidepanel.html`, and `README.md`, and rebuilt distribution zip `dola_extension/dola_watermark_remove.zip`.

#### Files touched
- `dola_extension/dola_watermark_remove/sidepanel.js`: Fixed `parsePromptsFromInput`, `cleanPromptPrefix`, `updatePromptCount`, and `btnPasteToChat`.
- `dola_extension/dola_watermark_remove/content.js`: Updated `executeAutomationQueue` and `PASTE_PROMPTS_TO_INPUT` to prevent numbering in raw mode.
- `dola_extension/dola_watermark_remove/extractor.js`: Fixed TDZ re-injection bug and preserved multi-line paragraph formatting in `injectContentIntoEditor`.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Bumped version badge and footer to v2.3.2.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.3.2.
- `dola_extension/README.md`: Updated badges and download links to v2.3.2.
- `dola_extension/dola_watermark_remove.zip`: Rebuilt extension archive.
- `PROGRESS.md`: Logged Session 23 updates.

---

### 2026-09-08, Session 22

Status: Done

#### What changed
- Initialized a standalone Git repository inside `dola_extension/` with dedicated `.gitignore` and comprehensive `README.md`.
- Staged all extension assets, code modules, and packaged archive `dola_watermark_remove.zip`.
- Created GitHub repository `Yeamin-Sheikh/dola-extension` via GitHub CLI (`gh repo create`) and pushed the `main` branch.
- Switched repository visibility from private to public via `gh repo edit --visibility public`.
- Overhauled repository `README.md` with ambient hero banner, aperture squircle logo, feature matrix table, workflow mode diagrams, ByteDance quadrant inpainting architecture breakdown, full layer communication flowchart, and MIT license.

#### Files touched
- `dola_extension/README.md`: Upgraded presentation documentation with banner, badges, and architectural diagrams.
- `dola_extension/assets/`: Copied `banner.png` and `logo.png` to repository root for GitHub presentation rendering.
- `dola_extension/LICENSE`: Added MIT license file.
- `https://github.com/Yeamin-Sheikh/dola-extension`: Repository updated to public visibility and synchronized with latest documentation.
- `PROGRESS.md`: Logged Session 22 updates.
- `dola_extension/.gitignore`: Configured repository ignore rules.
- `dola_extension/README.md`: Created master repository documentation.
- `https://github.com/Yeamin-Sheikh/dola-extension`: Private GitHub repository created and synchronized.
- `PROGRESS.md`: Logged Session 22 updates.

---

### 2026-09-08, Session 21

Status: Done

#### What changed
- Replaced fragile newline block prompt splitting in `sidepanel.js` with an intelligent parser handling numbered items (`1.`, `2.`), bullet points (`-`), section headers (`Prompt 1:`), and blank-line separated paragraphs without collapsing multi-line prompts or trailing newlines into a single item.
- Added a dedicated "Paste to Chat Input" button in `sidepanel.html` and styled it in `sidepanel.css`, giving users a 1-click deterministic option to paste detected prompts directly into Dola AI's chat input during live demonstrations.
- Added `findDolaEditor` with polling (`waitForDolaEditor`, 8000ms timeout) across multiple DOM selectors (`.tiptap.ProseMirror`, `div[contenteditable="true"][role="textbox"]`, `.chat-input [contenteditable="true"]`, `div[contenteditable="true"]`) in `extractor.js`.
- Implemented `injectContentIntoEditor` in `extractor.js` featuring dual strategies: Tiptap ProseMirror commands with official Generate Videos mention chip insertion (`external_skill_id: 294222337297`) and a native DOM `document.execCommand('insertText')` + `InputEvent` fallback, backed by post-injection text verification.
- Added `DOLA_PASTE_PROMPTS_ONLY` page event in `extractor.js` and `PASTE_PROMPTS_TO_INPUT` runtime message in `content.js` to support pasting without auto-submitting.
- Made initial greeting check and bypass agreement checks in `content.js` non-fatal: timeouts now log a warning and proceed directly to video prompt injection rather than halting the automation queue.
- Bumped version to 2.3.1 across `manifest.json`, `sidepanel.html`, and `README.md`, and rebuilt distribution zip `dola_extension/dola_watermark_remove.zip`.

#### Files touched
- `dola_extension/dola_watermark_remove/sidepanel.html`: Added `#btn-paste-to-chat` button and updated version badge to v2.3.1.
- `dola_extension/dola_watermark_remove/sidepanel.css`: Added `.prompt-tools-left` and `.btn-text-action` styles.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Added intelligent `parsePromptsFromInput` and wired `#btn-paste-to-chat` click listener.
- `dola_extension/dola_watermark_remove/extractor.js`: Added `waitForDolaEditor`, dual-strategy `injectContentIntoEditor`, and `DOLA_PASTE_PROMPTS_ONLY` listener.
- `dola_extension/dola_watermark_remove/content.js`: Added `PASTE_PROMPTS_TO_INPUT` handler and made greeting/bypass checks non-fatal.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.3.1.
- `dola_extension/dola_watermark_remove/README.md`: Documented new paste button and prompt parser.
- `dola_extension/dola_watermark_remove.zip`: Rebuilt extension archive.
- `PROGRESS.md`: Logged Session 21 updates.

---

### 2026-09-07, Session 20

Status: Done

#### What changed
- Cleaned up root workspace directory by removing all loose debugging images (`compare_*.jpg`), loose template crops, scrap test videos (`download.mpg4`, `download_clean.mp4`, `pipeline_clean_test.mp4`, `test_full_soft_pipeline.mp4`, `test_transition_soft.mp4`), and obsolete root distribution archive (`dola_watermark_remove.zip`).
- Removed junk `dola_extension/__MACOSX` directory and deleted empty `downloads/` directory.
- Created root `.gitignore` to prevent temporary video chunks (`_temp_*`), Python bytecode (`__pycache__`), media outputs, and OS metadata from cluttering the repository.
- Created root `README.md` providing architectural overview, setup instructions, and CLI usage guides for all components (`dola_extension/`, `watermark_remover/`, and `dola_pipeline/`).

#### Files touched
- `c:\Users\Yeamin-Sheikh\Documents\antigravity\sharp-hypatia\.gitignore`: Created version control ignore rules.
- `c:\Users\Yeamin-Sheikh\Documents\antigravity\sharp-hypatia\README.md`: Created master project documentation.
- `PROGRESS.md`: Logged Session 20 cleanup updates.

---

### 2026-09-07, Session 19

Status: Done

#### What changed
- Invoked `/learn` workflow to persist reusable behavioral rules from recent user corrections into global machine configuration (`GEMINI.md`).
- Added `Processed media output separation` rule to `Coding preferences`: mandates routing cleaned, converted, or processed media into a dedicated subfolder (`cleaned/`, `processed/`, or `output/`) so outputs never mix with original source files.
- Added `Video watermark removal & inpainting standards` to `Media Processing & Downloading`: mandates soft elliptical geometry with wide Gaussian feathering (`ksize=51, sigma=16`) and 3-channel float alpha blending to eliminate boxy prism edges, plus transition overlap buffering for dynamic entrance wipe streaks.

#### Files touched
- `C:\Users\Yeamin-Sheikh\.gemini\config\GEMINI.md`: Updated global rules with media output separation and video inpainting standards.
- `PROGRESS.md`: Logged Session 19 updates.

---

### 2026-09-07, Session 18

Status: Done

#### What changed
- Reorganized video output structure so cleaned videos are stored in a dedicated `cleaned/` subfolder by default instead of mixing with original watermarked video files.
- Added `--subfolder <name>` option to `watermark_remover/main.py` allowing custom subfolder naming while defaulting to `cleaned`.
- Routed single video and batch directory modes to automatically create and populate the destination subfolder.
- Moved all 9 cleaned MP4 video files in `C:\Users\Yeamin-Sheikh\Downloads\Dola_Videos\New folder\` into `C:\Users\Yeamin-Sheikh\Downloads\Dola_Videos\New folder\cleaned\`.
- Updated `watermark_remover/README.md` and `walkthrough.md` with subfolder routing details and CLI options.

#### Files touched
- `watermark_remover/main.py`: Added `--subfolder` argument, created target subfolder automatically, and routed worker task output paths to the subfolder.
- `watermark_remover/README.md`: Documented automatic subfolder routing and `--subfolder` option.
- `walkthrough.md`: Documented new folder organization and paths.
- `PROGRESS.md`: Logged Session 18 updates.

---

### 2026-09-07, Session 17

Status: Done

#### What changed
- Replaced hard-boundary rectangular inpainting with soft elliptical Gaussian-feathered inpainting (`build_soft_zone` with `ksize=51, sigma=16`), completely eliminating visible boxy prism edges and blur squares.
- Analyzed frame-by-frame watermark trajectory and expanded Mid-Left quadrant coverage (`axes_ratio=(0.170, 0.026)`) to cover the 240px entrance wipe motion streak.
- Added transition overlap windows (`[t - 0.2s, t + 0.2s]`) between quadrant handovers, ensuring both the exiting fade and entering streak are cleanly covered without gaps.
- Updated `watermark_remover/processor.py` and `watermark_remover/remover.py` to precompute 3 quadrant soft zones per video and inpaint subregions with 3-channel float alpha blending.
- Added multi-process parallel batch processing (`--workers 3`) to `watermark_remover/main.py` for faster batch execution on multi-core systems.
- Updated `watermark_remover/README.md` with documentation on soft elliptical inpainting, parameters, and batch CLI options.
- Batch cleaned all 9 MP4 videos in `C:\Users\Yeamin-Sheikh\Downloads\Dola_Videos\New folder` with original AAC audio streams preserved.

#### Files touched
- `watermark_remover/remover.py`: Implemented `build_soft_zone`, `apply_soft_inpaint`, and `build_soft_zone_from_bbox` with Gaussian feathering.
- `watermark_remover/processor.py`: Rewrote video processing pipeline with dynamic quadrant scheduling, transition overlap, and ffmpeg audio remuxing.
- `watermark_remover/main.py`: Added parallel worker execution (`--workers 3`), soft inpainting arguments (`--ksize`, `--sigma`, `--radius`), and batch reporting.
- `watermark_remover/README.md`: Documented soft elliptical inpainting and batch CLI commands.
- `PROGRESS.md`: Logged Session 17 updates.

---

### 2026-09-07, Session 13

Status: Done

#### What changed
- Solved root cause of browser modal alert `Copy to clipboard: Ctrl+C, Enter`: `findDolaSendButton` fallback was searching document-wide for any SVG button on the right side of the screen, mistakenly clicking chat message action toolbars (the Copy button), which triggered Dola's clipboard fallback modal when automated clicks failed browser security permissions.
- Strictly scoped send button locator to `flow-end-msg-send` and input container buttons only, completely eliminating misclicks on message bubbles or toolbar buttons.
- Added global safeguard overriding `window.prompt` in `extractor.js` to silently suppress any copy-to-clipboard browser prompt modals without blocking page execution.
- Added re-entrancy and double-injection guards to `content.js` and `extractor.js` so multiple script injections never duplicate event listeners or run parallel automation queues.
- Structured `attachAutomationListeners` in `extractor.js` so extension updates hot-refresh automation listeners even if the Dola tab was not reloaded.
- Verified character typing of `/generate video` (50ms per keystroke), conversion to Generate Videos mention tag, new line split, and prompt insertion directly on the live Dola page.
- Bumped extension version to 2.2.7 across manifest.json, sidepanel.html, and README.md.
- Rebuilt dola_watermark_remove.zip distribution package.

#### Files touched
- `dola_extension/dola_watermark_remove/extractor.js`: Suppressed copy-to-clipboard prompt modal, scoped send button search strictly to input container, added idempotent listener manager.
- `dola_extension/dola_watermark_remove/content.js`: Added single-instance initialization guard.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.2.7.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Bumped version badge to v2.2.7.
- `dola_extension/dola_watermark_remove/README.md`: Bumped version to 2.2.7.
- `dola_watermark_remove.zip`: Rebuilt zip archive.

---

### 2026-09-07, Session 12

Status: Done

#### What changed
- Identified and eliminated character duplication bug where dispatching InputEvent inside the character typing loop caused ProseMirror to insert every letter twice, producing garbled input.
- Removed the blind Enter key event that was causing Dola to submit premature messages when the suggestion dropdown was not open.
- Fixed /generate video typing to insert clean single characters with 50ms keystroke delays, then cleanly convert into the official Generate Videos skill chip via the mention extension.
- Maintained a clean block split to a new line before inserting prompt content, followed by single input event dispatch to enable the send button.
- Bumped extension version to 2.2.6 across manifest.json, sidepanel.html, and README.md.
- Rebuilt dola_watermark_remove.zip distribution package.

#### Files touched
- `dola_extension/dola_watermark_remove/extractor.js`: Fixed character typing loop to prevent duplicate letters, removed premature Enter key submission, and stabilized mention skill conversion.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.2.6.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Bumped version badges to v2.2.6.
- `dola_extension/dola_watermark_remove/README.md`: Bumped version to 2.2.6.
- `dola_watermark_remove.zip`: Rebuilt zip archive.

---

### 2026-09-06, Session 11

Status: Done

#### What changed
- Reordered the settings panel groups so Downloads and storage appears first at the top, Automation sequence in the middle, and Workspace and display at the bottom.
- Implemented character-by-character typing with a 50ms keystroke delay for /generate video in the Tiptap editor.
- Dispatched Enter key event and clicked active suggestion dropdown item to select the Generate Videos skill tag, then split to a new line before inserting prompt content.
- Added short pacing pauses between actions in the automation queue, including chat navigation, AI health check response verification, bypass agreement confirmation, prompt injection, and final submission.
- Bumped extension version to 2.2.5 across manifest.json, sidepanel.html, and README.md.
- Rebuilt dola_watermark_remove.zip distribution package.

#### Files touched
- `dola_extension/dola_watermark_remove/sidepanel.html`: Reordered settings cards so Downloads and storage is top, Automation sequence is middle, and Workspace and display is bottom. Updated version badges to v2.2.5.
- `dola_extension/dola_watermark_remove/extractor.js`: Added 50ms character typing loop for /generate video, Enter key selection, new line split, and action delays.
- `dola_extension/dola_watermark_remove/content.js`: Tuned pacing pauses between automated workflow phases.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Added settle pause before starting queue execution.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.2.5.
- `dola_extension/dola_watermark_remove/README.md`: Bumped version to 2.2.5 with updated feature notes.
- `dola_watermark_remove.zip`: Rebuilt zip archive.

---

### 2026-09-06, Session 10

Status: Done

#### What changed
- Reorganized the settings panel from four disparate card fragments into three purposeful, logically structured sections.
- Grouped display and viewport controls into `Workspace & display`, with the zoom factor dropdown nested directly beneath the sidebar auto-zoom switch as an indented dependent control that dims when disabled.
- Unified the greeting message and the unattended bypass instruction into a single `Automation sequence` card with numbered step badges (`1` and `2`), reflecting the chronological pre-flight flow.
- Grouped file destination, unwatermarked raw downloads, and desktop alerts into a dedicated `Downloads & storage` card.
- Updated styling with `.dependent-control`, `.settings-step-block`, `.step-indicator`, `.step-number`, and `.step-count-badge`.
- Bumped extension version to 2.1.3 across `manifest.json`, `sidepanel.html`, `README.md`, and rebuilt `dola_watermark_remove.zip`.
- Reloaded extension in Chrome and confirmed zero errors.

#### Files touched
- `dola_extension/dola_watermark_remove/sidepanel.html`: Reorganized settings tab into 3 cohesive cards with step badges.
- `dola_extension/dola_watermark_remove/sidepanel.css`: Added dependent control styling and step indicator badges.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Added dynamic container disabled state toggling.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.1.3.
- `dola_extension/dola_watermark_remove/README.md`: Bumped version to 2.1.3.
- `dola_watermark_remove.zip`: Rebuilt distribution archive.

---

### 2026-09-06, Session 9

Status: Done

#### What changed
- Tied page zoom lifecycle to the sidebar open and close events as requested by the user.
- Configured sidepanel runtime port connection (`dola-sidepanel-port`) to detect when the sidebar is opened and closed.
- On sidebar open or initial load: applies the selected zoom percentage (default 80%) to the active Dola tab using `chrome.tabs.setZoom` scoped per-tab.
- On sidebar close: detects port disconnection in `background.js` and `beforeunload`/`pagehide` events in `sidepanel.js`, instantly restoring tab zoom to 100% (1.0).
- Updated settings UI: toggling auto-zoom off immediately restores 100% zoom, while toggling on applies the selected zoom level. Changing the zoom percentage dropdown updates the page zoom in real time.
- Updated UI text to clearly describe the sidebar zoom behavior and updated footer version to v2.1.2.
- Bumped extension version to 2.1.2 across `manifest.json`, `sidepanel.html`, and rebuilt `dola_watermark_remove.zip`.
- Reloaded extension in Chrome and confirmed zero errors.

#### Files touched
- `dola_extension/dola_watermark_remove/background.js`: Added sidepanel port connection listener, tab zoom tracking, and automatic 100% zoom restoration on port disconnect.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Implemented `applySidebarZoom`, `resetSidebarZoom`, startup zoom application, real-time setting change handlers, and `beforeunload`/`pagehide` reset fallbacks.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Updated zoom setting labels, header version badge, and footer version note to v2.1.2.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.1.2.
- `dola_watermark_remove.zip`: Rebuilt distribution archive.

---

### 2026-09-06, Session 8

Status: Done

#### What changed
- Investigated root cause of duplicate video files in `C:\Users\Yeamin-Sheikh\Downloads\000 v\Dola_Videos`.
- Identified that 20 files were byte-for-byte exact duplicates caused by repeated DOM scans on existing chat history and extension service worker restarts without persistent key synchronization.
- Purged all 20 redundant duplicate files from disk, keeping only the 11 unique files (8 unique Doodle World Studio scene clips, 2 master 1080p prompt clips, and 1 OpenCV inpaint verification clip).
- Added `data-dola-processed="true"` DOM attribute marking to `scanDomForDownloadLinks()` in `content.js` so chat history anchors are never re-evaluated.
- Added canonical ByteDance TOS key resolution (`dolaExtractCanonicalKey`) and two-way `chrome.storage.local` synchronization to `content.js`.
- Bumped extension version to 2.1.1 across `manifest.json`, `sidepanel.html`, and rebuilt `dola_watermark_remove.zip`.
- Reloaded extension in Chrome and confirmed zero errors.

#### Files touched
- `dola_extension/dola_watermark_remove/content.js`: Added DOM processed attribute filtering and persistent canonical key deduplication.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.1.1.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Bumped version badge to v2.1.1.
- `dola_watermark_remove.zip`: Rebuilt distribution archive.

---

### 2026-09-06, Session 7

Status: Done

#### What changed
- Updated batch video automation flow to match user specification: sends greeting, sends bypass agreement instruction, selects Generate Videos skill via /generate video, inserts all prompts simultaneously on a new line, and dispatches the entire batch in one step.
- Added programmatic Tiptap ProseMirror mention node injection for the Generate Videos skill tag.
- Enhanced prompt resolution in extractor.js to parse numbered multi-prompt blocks into individual scene prompt titles, ensuring each incoming video stream receives its unique filename.
- Tested OpenCV inpainting pipeline on sample video frames, successfully detecting and inpainting the Dola AI watermark across all 361 frames while preserving the original audio track.
- Bumped extension version to 2.1.0 across manifest.json, sidepanel.html, and README.md.
- Re-verified syntax with node -c and reloaded the unpacked extension in Chrome with zero errors.

#### Files touched
- `dola_extension/dola_watermark_remove/extractor.js`: Added batch prompt parsing, DOLA_INJECT_AND_SEND_BATCH listener, and individual prompt assignment for each video.
- `dola_extension/dola_watermark_remove/content.js`: Updated executeAutomationQueue to dispatch all batch prompts simultaneously via /generate video mention skill.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.1.0.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Updated version badge to v2.1.0.
- `dola_extension/dola_watermark_remove/README.md`: Updated version and batch generation documentation.
- `dola_watermark_remove.zip`: Repackaged extension distribution archive.

---

### 2026-09-06, Session 6

Status: Done

#### What changed
- Removed the manual stream decryptor utility from the Settings tab in the sidebar as requested by the user.
- Cleaned up decryptor DOM queries, event handlers, and unused CSS rules.
- Implemented prompt-to-video correlation across network requests, SSE streams, automation queues, and chat DOM elements.
- Updated network interceptor to extract user prompt text from request payloads and associate it with extracted unwatermarked video streams.
- Updated content script to track the active automation prompt and traverse chat message containers to identify the user prompt for each video.
- Overhauled file naming in the background service worker to name saved MP4 files directly after the prompt without unnecessary timestamps or prefixes.
- Updated extension README and rebuilt the zip package.

#### Files touched
- `dola_extension/dola_watermark_remove/sidepanel.html`: Removed stream decryptor tool section.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Removed decryptor DOM queries and event handlers.
- `dola_extension/dola_watermark_remove/sidepanel.css`: Removed decryptor styling rules.
- `dola_extension/dola_watermark_remove/extractor.js`: Added prompt extraction from request bodies and passed prompts to extracted video objects.
- `dola_extension/dola_watermark_remove/content.js`: Added active queue prompt tracking, recent prompt history, and chat DOM traversal.
- `dola_extension/dola_watermark_remove/background.js`: Updated filename sanitizer and generator to name files directly with the prompt text.
- `dola_extension/dola_watermark_remove/README.md`: Updated feature documentation.
- `dola_watermark_remove.zip`: Repackaged extension archive.

---

### 2026-09-06, Session 5

Status: Done

#### What changed
- Added desktop notifications toggle in Settings tab under the Download and storage section.
- Set default notification state to off so background downloads remain quiet unless opted in.
- Synchronized toggle state between sidepanel UI, Chrome local storage, and background service worker.
- Gated desktop notifications and in-page toast alerts behind the notification preference setting.
- Rebuilt extension zip package.

#### Files touched
- `dola_extension/dola_watermark_remove/sidepanel.html`: Added notification toggle element.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Added DOM binding, state synchronization, and toggle event handler.
- `dola_extension/dola_watermark_remove/background.js`: Set default notification flag to false, added toggle message listener, and conditioned desktop popups.
- `dola_extension/dola_watermark_remove/content.js`: Conditioned page toast on notification state.
- `dola_watermark_remove.zip`: Updated extension archive.

---

### 2026-09-06, Session 4

**Status:** Done

#### What changed
- Re-architected Generation tab into a fixed-height container, completely removing outer sidebar scrolling.
- Rebalanced UI hierarchy: compressed the header bar to 26px, reduced navigation tabs, and replaced bulky aspect ratio cards with a sleek horizontal segmented pill bar (9:16 Vertical, 16:9 Wide, Raw Prompt).
- Configured dedicated internal scroll containers with custom slim scrollbars for the Video Prompts textarea and Captured Videos list.
- Implemented automatic chat markdown link detection in content.js and extractor.js to detect and download text-based `[Download Video]` links and direct CDN streams from Dola chat with scene title extraction.
- Built an inline `+ Import Links` drawer in the captured videos section supporting multi-line direct video URLs, API endpoints, and tokens with automated background download.
- Repackaged extension zip archive.

#### Files touched
- `dola_extension/dola_watermark_remove/sidepanel.html`: Segmented aspect pill row, compact header, and inline import drawer.
- `dola_extension/dola_watermark_remove/sidepanel.css`: Fixed height container, internal scrollbars, compact spacing, and drawer styles.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Manual import runner, direct video URL detection, and drawer toggling.
- `dola_extension/dola_watermark_remove/content.js`: DOM link scanner, scene title extraction, and MutationObserver.
- `dola_extension/dola_watermark_remove/extractor.js`: SSE stream chunk direct URL scanner.
- `dola_watermark_remove.zip`: Updated extension package.

---

### 2026-09-06, Session 3

**Status:** Done

#### What changed
- Completely removed all external manager badges, pills, and references across the extension interface, styles, background scripts, offscreen engine, and documentation.
- Retained the silent in-memory blob download pipeline in background.js and offscreen.js so videos download directly into the chosen subfolder without third-party manager interception.
- Verified all JavaScript files with Node syntax checks.
- Updated the packaged extension archive dola_watermark_remove.zip.

#### Files touched
- `dola_extension/dola_watermark_remove/sidepanel.html`: Removed badge elements and status pills.
- `dola_extension/dola_watermark_remove/sidepanel.css`: Deleted unused status pill and tag CSS classes.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Cleaned up history tags and header comments.
- `dola_extension/dola_watermark_remove/background.js`: Neutralized log messages, comments, and status payload properties.
- `dola_extension/dola_watermark_remove/offscreen.js`: Neutralized header comments.
- `dola_extension/dola_watermark_remove/README.md`: Updated feature list and architecture descriptions.
- `dola_watermark_remove.zip`: Rebuilt zip archive with all latest changes.

---

### 2026-09-06, Session 4

**Status:** Done

#### What changed
- Implemented `chrome.downloads.onDeterminingFilename` in `background.js` to guarantee every download writes directly to `Downloads/Dola_Videos/<cleanPrompt>.mp4` without UUID filename overrides or path omissions.
- Added prompt sanitization in `dolaSanitizeFilename`: stripped reserved Windows names, forbidden characters, aspect ratio tags, and capped length to 100 characters.
- Extracted prompt tracking in `extractor.js` for `FormData`, `URLSearchParams`, and manual submissions (Enter key in `.tiptap.ProseMirror` and send button clicks), dispatching `DOLA_USER_PROMPT_SUBMITTED`.
- Integrated manual prompt tracking and stream categorization in `content.js`, distinguishing dynamic rotating watermarks (`video_gen_watermark_dyn`) from unwatermarked 1080p master streams.
- Completely redesigned `sidepanel.html` and `sidepanel.css` following installed design skills (`frontend-design`, `better-layout`, `ui-ux-pro-max`, `web-design-engineer`): removed all AI slop styling (cosmic gradient mesh, logo glow, pulsing rings, glassmorphism blur, multi-stop neon gradients). Built a disciplined, high-density professional tool design system with solid matte surfaces, 1px hairline borders, and fixed non-scrollable layout shell with independent scrolling for prompts and video lists.
- Bumped extension version to `2.0.0` across `manifest.json`, `sidepanel.html`, and `README.md` following semantic versioning (Major.Minor.Patch).
- Rebuilt `dola_watermark_remove.zip`.

#### Files touched
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to `2.0.0`.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Updated header version badge and footer note to `v2.0.0`.
- `dola_extension/dola_watermark_remove/README.md`: Updated title to `v2.0.0`.
- `dola_extension/dola_watermark_remove/background.js`: Added onDeterminingFilename listener, filename sanitization, dynamic watermark tagging.
- `dola_extension/dola_watermark_remove/extractor.js`: Added FormData extraction, direct video detection, manual prompt interception, and escapeText helper.
- `dola_extension/dola_watermark_remove/content.js`: Added DOLA_USER_PROMPT_SUBMITTED listener, DOM scan watermark tagging, and dynamic watermark toast.
- `dola_extension/dola_watermark_remove/sidepanel.css`: Complete redesign into Linear-inspired dark tool interface.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Updated renderHistory and manual import to tag and render Dynamic Watermark badges.
- `dola_watermark_remove.zip`: Rebuilt zip package with all updated assets.

---

### 2026-09-06, Session 5

**Status:** Done

#### What changed
- Fixed `Extension context invalidated` error that surfaced in `chrome://extensions` when the extension was reloaded or updated while Dola AI tabs remained open.
- Implemented `isContextValid()` and `handleContextInvalidated()` in `content.js` to gracefully detect extension disconnects, disconnect active `MutationObserver` instances, and unbind event listeners without calling `console.warn` or throwing errors.
- Added re-injection cleanup hook `window.__DOLA_CONTENT_SCRIPT_CLEANUP__` so updated content scripts cleanly supersede older instances without conflicts.
- Guarded all `chrome.runtime.sendMessage` and DOM scanning calls in `content.js` against invalidated context states.
- Bumped extension version to `2.0.1` across `manifest.json`, `sidepanel.html`, and `README.md` following semantic versioning (Major.Minor.Patch).
- Rebuilt `dola_watermark_remove.zip`.

#### Files touched
- `dola_extension/dola_watermark_remove/content.js`: Added `isContextValid()`, `handleContextInvalidated()`, silent context teardown, and re-injection cleanup hook.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to `2.0.1`.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Updated header version badge and footer note to `v2.0.1`.
- `dola_extension/dola_watermark_remove/README.md`: Updated title to `v2.0.1`.
- `dola_watermark_remove.zip`: Rebuilt zip archive with `v2.0.1` package.

---

### 2026-09-06, Session 6

**Status:** Complete

#### What changed
- Added `escapeText()` helper to `extractor.js` to ensure reliable paragraph generation and prevent reference errors during automated message injection.
- Enhanced `parsePromptsFromInput()` in `sidepanel.js` to detect double-newline paragraph breaks (`\n\n`) and treat multi-line descriptive prompts as individual batched items.
- Added aspect ratio deduplication guard in `content.js` to prevent double-prefixing when user prompts already start with `9:16` or `16:9`.
- Bumped extension version to `2.0.2` across `manifest.json`, `sidepanel.html`, `README.md`, and `PROGRESS.md`.
- Rebuilt `dola_watermark_remove.zip`.

#### Files touched
- `dola_extension/dola_watermark_remove/extractor.js`: Added `escapeText()` helper.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Added multi-line paragraph splitting to `parsePromptsFromInput()`.
- `dola_extension/dola_watermark_remove/content.js`: Added aspect ratio deduplication in `START_AUTOMATION_QUEUE`.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to `2.0.2`.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Updated badges to `v2.0.2`.
- `dola_extension/dola_watermark_remove/README.md`: Updated version to `v2.0.2`.
- `dola_watermark_remove.zip`: Rebuilt zip archive with `v2.0.2` package.

### 2026-09-06, Session 11

**Status:** Complete

#### What changed
- Fixed in-progress key leak in `background.js` by ensuring `canonicalKey` and `mediaKey` are deleted and in-memory blob URLs are revoked on download failures.
- Fixed unhandled promise rejections in `content.js` and `sidepanel.js` by attaching rejection handlers to cross-context runtime messages.
- Cleaned up inline zoom styles in `content.js` during queue completion.
- Removed duplicate `escapeText` declaration in `extractor.js` and added `id: 'generate_video'` to the ProseMirror mention node attributes for atomic document insertion.
- Replaced the incomplete `decryptQaabToken` in `sidepanel.js` with the full ByteDance Web Crypto AES-CBC decryption suite.
- Bumped extension version to `2.1.4` across `manifest.json`, `sidepanel.html`, `README.md`, and `PROGRESS.md`.
- Rebuilt `dola_watermark_remove.zip`.
- Verified unpacked extension reload in Chrome with zero errors.

#### Files touched
- `dola_extension/dola_watermark_remove/background.js`: Scoped blob variables and cleaned up in-progress keys and blob URLs in catch block.
- `dola_extension/dola_watermark_remove/content.js`: Added catch handler to `reportQueueProgress` message and reset inline zoom in finally block.
- `dola_extension/dola_watermark_remove/extractor.js`: Removed duplicate `escapeText` and added mention ID attribute.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Handled queue stop message rejection and added full QAAB decryption suite.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to `2.1.4`.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Updated version badges to `v2.1.4`.
- `dola_extension/dola_watermark_remove/README.md`: Updated version to `v2.1.4`.
- `dola_watermark_remove.zip`: Rebuilt zip archive.
- `PROGRESS.md`: Logged Session 11 updates.

### 2026-09-06, Session 12

**Status:** Complete

#### What changed
- Added native Chrome right-click context menu via `chrome.contextMenus` with items to open Dola Studio sidebar, download visible screen video, add highlighted text directly to batch prompts, and download videos from links.
- Added custom right-click context menu (Cut, Copy, Paste, Select All) to `popup.html`, `popup.css`, and `popup.js`, and expanded `sidepanel.js` context menu to support copying text selections anywhere in the sidebar.
- Fixed message submission stall in `extractor.js` where injecting text via Tiptap `setContent()` did not trigger native React input events, leaving the send button disabled. Added native `InputEvent` dispatch and reliable `flow-end-msg-send` button detection with Enter fallback.
- Bumped extension version to `2.2.1` across `manifest.json`, `sidepanel.html`, `README.md`, and `PROGRESS.md`.
- Rebuilt `dola_watermark_remove.zip`.
- Verified live automated prompt injection and submission on `dola.com` with zero errors.

#### Files touched
- `dola_extension/dola_watermark_remove/manifest.json`: Added `contextMenus` permission and bumped version to `2.2.1`.
- `dola_extension/dola_watermark_remove/background.js`: Registered native context menu items and click handlers.
- `dola_extension/dola_watermark_remove/extractor.js`: Added native `InputEvent` dispatch on injection, targeted `#flow-end-msg-send`, and added polling submitter.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Updated badges to `v2.2.1`.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Added selection support to custom context menu and storage sync listener.
- `dola_extension/dola_watermark_remove/popup.html`: Added custom context menu markup.
- `dola_extension/dola_watermark_remove/popup.css`: Added context menu styles.
- `dola_extension/dola_watermark_remove/popup.js`: Added context menu actions.
- `dola_extension/dola_watermark_remove/README.md`: Documented context menu features and updated version to `2.2.1`.
- `dola_watermark_remove.zip`: Rebuilt zip package.
- `PROGRESS.md`: Logged Session 12.

### 2026-09-06, Session 13

**Status:** Complete

#### What changed
- Fixed `/generate video` skill triggering in `extractor.js`. Resolved schema mismatch where previously mocked mention attributes were rejected by Dola. Connected directly to Dola's native mention suggestion command using exact attributes (`id: 'creative-video'`, `display_name: 'Generate Videos'`, `skill_type: 2`, `external_skill_id: '294222337297'`).
- Followed exact interaction flow: committed the Generate Videos mention chip, split block to a new line, inserted the full prompts block, dispatched native React input events, and submitted via `#flow-end-msg-send`.
- Upgraded `dolaSubmitMessage()` with extended polling retries, React state input nudging, and direct `onClick` invocation.
- Bumped extension version to `2.2.2` across `manifest.json`, `sidepanel.html`, `README.md`, and `PROGRESS.md`.
- Rebuilt `dola_watermark_remove.zip`.
- Verified live on `dola.com` that the message with `/creative-video` mention chip and multiline prompt sent cleanly.

#### Files touched
- `dola_extension/dola_watermark_remove/extractor.js`: Rewrote `DOLA_INJECT_AND_SEND_BATCH` and `dolaSubmitMessage` to use native mention suggestion command, block splitting, and robust send button polling.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to `2.2.2`.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Bumped version badges to `v2.2.2`.
- `dola_extension/dola_watermark_remove/README.md`: Updated version to `v2.2.2`.
- `dola_watermark_remove.zip`: Rebuilt zip package.
- `PROGRESS.md`: Logged Session 13.

### 2026-09-06, Session 14

**Status:** Complete

#### What changed
- Added explicit AI response verification to the greeting health-check step in `content.js`. The workflow now monitors assistant message arrivals and verifies that Dola AI produces a non-empty, non-error reply before proceeding to bypass instructions or batch generation.
- Implemented `verifyAiResponse()` with dual-layer detection: DOM assistant message inspection (filtering out user message bubbles) and network stream completion events (`DOLA_STREAM_END`).
- Added error detection during handshake (network error, rate limit, quota exceeded, service unavailable) that halts the queue and alerts the user rather than blindly blasting prompts into a broken chat.
- Applied the same response verification to the batch agreement bypass instructions step, ensuring Dola acknowledges the mode before submitting prompts.
- Bumped extension version to `2.2.3` across `manifest.json`, `sidepanel.html`, `README.md`, and `PROGRESS.md`.
- Rebuilt `dola_watermark_remove.zip`.

#### Files touched
- `dola_extension/dola_watermark_remove/content.js`: Implemented `getAssistantMessages`, `getLatestAssistantMessage`, `verifyAiResponse`, and integrated checks into greeting and bypass steps.
- `dola_extension/dola_watermark_remove/extractor.js`: Added response status details to `DOLA_STREAM_END` event dispatch.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to `2.2.3`.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Bumped version badges to `v2.2.3`.
- `dola_extension/dola_watermark_remove/README.md`: Updated version to `v2.2.3`.
- `dola_watermark_remove.zip`: Rebuilt zip package.
- `PROGRESS.md`: Logged Session 14.

### 2026-09-06, Session 15

**Status:** Complete

#### What changed
- Added automatic navigation to Dola AI when clicking Start Batch Generation from any non-Dola page (such as `chrome://extensions` or external tabs). Removed the blocking alert modal. The extension now focuses an existing Dola tab if open, or automatically creates a new tab to `https://www.dola.com/chat`, waits for page and editor load, injects content scripts, and starts the batch queue seamlessly.
- Changed default aspect ratio setting to Raw Prompt (`raw`) across `sidepanel.html` and `sidepanel.js`, preserving user prompt text as entered without prepending aspect ratio tags unless explicitly selected.
- Bumped extension version to `2.2.4` across `manifest.json`, `sidepanel.html`, `README.md`, and `PROGRESS.md`.
- Rebuilt `dola_watermark_remove.zip`.

#### Files touched
- `dola_extension/dola_watermark_remove/sidepanel.js`: Added `ensureDolaTab()` auto-navigation helper, removed alert modal, and defaulted `aspectRatio` to `raw`.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Moved default active class to Raw Prompt button and bumped version badges to `v2.2.4`.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to `2.2.4`.
- `dola_extension/dola_watermark_remove/README.md`: Updated version to `v2.2.4`.
- `dola_watermark_remove.zip`: Rebuilt zip package.
- `PROGRESS.md`: Logged Session 15.





### 2026-09-07, Session 16

**Status:** Complete

#### What changed
- Upgraded standalone `watermark_remover` to detect and eliminate moving ByteDance dynamic watermarks (`video_gen_watermark_dyn`) from downloaded Dola AI MP4 videos.
- Bundled the master 32x124 Dola AI watermark template (`dola_ai_template.png`) directly into `watermark_remover/`.
- Updated `detector.py` with phase-locked tracking: detects the 4-second dynamic quadrant cycle (bottom-right -> mid-left -> top-right -> bottom-right) and locks coordinates per phase, achieving 100% frame coverage without jitter.
- Updated `remover.py` to use OpenCV TELEA inpainting on localized subregions (`inpaint_subregion`), replacing ineffective Gaussian blur and eliminating smudges and bounding box artifacts while achieving 35-40 fps processing speeds.
- Updated `processor.py` and `main.py` to support single videos and batch directory processing (`python main.py "C:\path\to\folder"`), maintaining original AAC audio tracks via ffmpeg.
- Batch-processed all 9 downloaded videos in `C:\Users\Yeamin-Sheikh\Downloads\Dola_Videos\New folder`, generating clean, unwatermarked versions with preserved audio.
- Fixed the `[Dola Offscreen Engine] Stream fetch failed: Error: Stream HTTP 403` error reported in the browser extensions dashboard: replaced `console.error` with `console.warn` in `offscreen.js` to prevent Chromium error badges, and updated `background.js` to route ByteDance CDN streams directly through Chrome's native browser downloader.
- Rebuilt extension package `dola_watermark_remove.zip`.

#### Files touched
- `watermark_remover/detector.py`: Added phase-locked multi-quadrant watermark detector.
- `watermark_remover/remover.py`: Added localized subregion TELEA inpainting.
- `watermark_remover/processor.py`: Integrated video loop with subregion inpainting, progress reporting, and audio remuxing.
- `watermark_remover/main.py`: Added batch folder mode, raw docstrings, and CLI arguments.
- `watermark_remover/dola_ai_template.png`: Added master template asset.
- `watermark_remover/README.md`: Documented batch folder CLI usage and options.
- `dola_extension/dola_watermark_remove/offscreen.js`: Handled non-200 responses gracefully and replaced `console.error` with `console.warn`.
- `dola_extension/dola_watermark_remove/background.js`: Bypassed offscreen blob fetch for ByteDance CDN streams and sanitized error logs.
- `dola_watermark_remove.zip`: Rebuilt extension archive.

### 2026-09-08, Session 17

**Status:** Complete

#### What changed
- Integrated the Chrome extension with an automated local background watermark cleaning service for dynamic moving watermarks (`video_gen_watermark_dyn`).
- Created `watermark_remover/watcher.py`: a real-time folder watcher and embedded HTTP API server on port 8765 with CORS support that detects newly completed downloads in `Downloads/Dola_Videos/`, automatically runs localized TELEA inpainting with soft Gaussian feathering (`ksize=51, sigma=16`), and routes cleaned MP4s to `Downloads/Dola_Videos/cleaned/`.
- Updated `background.js`: added download completion listener (`chrome.downloads.onChanged`) that notifies `http://127.0.0.1:8765/clean` when dynamic watermark videos finish downloading; updated `dolaSanitizeFilename` to strip non-ASCII emojis and normalize unicode dashes so Windows filenames never contain invalid symbols or question marks.
- Updated `sidepanel.html` and `sidepanel.css`: added live cleaner connection indicator (`Cleaner: Active` / `Cleaner: Offline`), `Clean` action button, and `Cleaned` status badge on captured dynamic watermark cards.
- Updated `sidepanel.js`: added health check polling against `http://127.0.0.1:8765/health` to keep the UI in sync with local cleaning activity in real time.
- Batch cleaned all current topic videos (`Topic 1` through `Topic 8`) into `Downloads/Dola_Videos/cleaned/` with preserved AAC audio.
- Rebuilt `dola_watermark_remove.zip` package and bumped version to `v2.2.8`.

#### Files touched
- `watermark_remover/watcher.py`: Real-time download watcher and HTTP API server.
- `watermark_remover/batch_clean_topics.py`: Multi-core parallel batch cleaner for topic videos.
- `dola_extension/dola_watermark_remove/background.js`: Auto-cleaner download completion notification and ASCII filename sanitization.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Cleaner status badge in header and version update to v2.2.8.
- `dola_extension/dola_watermark_remove/sidepanel.css`: Cleaner indicator, tag-cleaned, and btn-clean-now styling.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Cleaner health polling, dynamic clean button trigger, and cleaned status display.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.2.8.
- `dola_extension/dola_watermark_remove/README.md`: Documented auto-cleaner pipeline and setup.
- `dola_watermark_remove.zip`: Rebuilt extension archive.
### 2026-09-08, Session 26

**Status:** Complete

#### What changed
- Watermark cleaning verification: Audited and verified inpainting support for both static (stationary bottom-right) and dynamic (rotating 3-quadrant) watermarks.
- Resolved static watermark bypass: Identified that static watermarks (`video_gen_watermark` without `_dyn`) were previously treated as unwatermarked or dynamic-rotated, causing them to either bypass inpainting or remain uninpainted for 65% of frames.
- Updated `offscreen.js`: Added explicit mode branching in `renderNextFrame`. For static watermarks (`isStatic`), `inpaintZone(ctx, zones.br)` runs continuously on 100% of frames. For dynamic watermarks (`isDynamic`), the 12-second 3-phase quadrant rotation (`zones.br`, `zones.ml`, `zones.tr`) runs with transition overlap buffering.
- Updated `background.js`: Passed `watermarkType` into `dolaCleanVideoInOffscreen` options. Updated `dolaHandleAutoDownload` so both static and dynamic watermarks route into the in-browser cleaner and save as `Downloads/Dola_Videos/cleaned/<prompt>_clean.mp4`.
- Updated `content.js` and `extractor.js`: Tagged `watermarkType: 'static'` for `video_gen_watermark` and `watermarkType: 'dynamic'` for `video_gen_watermark_dyn`. Raw fallback master streams continue to download directly as unwatermarked 1080p originals.
- Updated `sidepanel.js` and `sidepanel.css`: Added yellow `.tag-static` badge for `Static Watermark` items in download history and updated manual link parser.
- Bumped extension version to `v2.3.4` across `manifest.json`, `sidepanel.html`, and `README.md`.
- Packaged `dola_watermark_remove.zip`, published GitHub Release `v2.3.4` titled `Dola AI Video Watermark Remover & Downloader v2.3.4`, and deleted local zip package.

#### Files touched
- `dola_extension/dola_watermark_remove/offscreen.js`: Added continuous static inpainting and dynamic rotation branching.
- `dola_extension/dola_watermark_remove/background.js`: Added watermarkType propagation to offscreen cleaner and history logs.
- `dola_extension/dola_watermark_remove/content.js`: Updated DOM and chat stream watermark classification.
- `dola_extension/dola_watermark_remove/extractor.js`: Explicitly tagged fallback API video streams as `watermarkType: 'none'`.
- `dola_extension/dola_watermark_remove/sidepanel.js`: Added static watermark badges and manual import support.
- `dola_extension/dola_watermark_remove/sidepanel.css`: Added `.tag-static` styling.
- `dola_extension/dola_watermark_remove/manifest.json`: Bumped version to 2.3.4.
- `dola_extension/dola_watermark_remove/sidepanel.html`: Bumped version badge to v2.3.4.
- `dola_extension/dola_watermark_remove/README.md`: Updated documentation and version to v2.3.4.
- `dola_extension/README.md`: Updated badges and architecture overview to v2.3.4.
- `PROGRESS.md`: Logged Session 26.

### 2026-09-08, Session 27

**Status:** Complete

#### What changed
- Directory structure refactoring: Flattened confusing 3-layer nested structure (`sharp-hypatia` -> `dola_extension` -> `dola_watermark_remove`) into a single, clean root structure.
- Promoted all Chrome extension files (`manifest.json`, `background.js`, `content.js`, `extractor.js`, `offscreen.*`, `sidepanel.*`, `popup.*`, `icon*.png`, `assets/`) directly to the repository root.
- Removed redundant intermediate directories (`dola_extension/` and `dola_watermark_remove/`).
- Moved `.git` from `dola_extension/.git` to root `.git`, maintaining the complete commit history and remote origin pointing to `https://github.com/Yeamin-Sheikh/dola-extension.git` on branch `main`.
- Replaced obsolete root README with the comprehensive documentation and updated install instructions to reference loading the root folder directly.
- Packaged clean release archive `dola-extension.zip` and uploaded to GitHub Release `v2.3.4`.
- Verified all JS files with `node -c` (zero errors), verified zero third-party download manager mentions, and pushed flattened layout to GitHub.

#### Files touched
- `manifest.json`: Promoted to root.
- `background.js`: Promoted to root.
- `content.js`: Promoted to root.
- `extractor.js`: Promoted to root.
- `offscreen.html`, `offscreen.js`: Promoted to root.
- `sidepanel.html`, `sidepanel.css`, `sidepanel.js`: Promoted to root.
- `popup.html`, `popup.css`, `popup.js`: Promoted to root.
- `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`: Promoted to root.
- `assets/`: Promoted to root.
- `LICENSE`: Promoted to root.
- `README.md`: Updated to document the flat repository structure.
- `PROGRESS.md`: Logged Session 27.

### 2026-09-08, Session 28

**Status:** Complete

#### What changed
- Added sequential FIFO video cleaner queue (`dolaCleanerQueue`) and queue worker in `background.js`. Videos requiring watermark removal are queued and processed one by one, eliminating concurrency collisions and preventing browser frame drops across batch video captures.
- Prevented raw watermarked video downloads: if a video has a watermark (`video_gen_watermark_dyn` or `video_gen_watermark`), the extension enqueues and saves only the cleaned output. If inpainting fails, the raw watermarked stream is never downloaded to disk. Pristine 1080p master streams continue to download directly as unwatermarked originals.
- Added live inpainting progress tracking and queue visualization in `sidepanel.html` and `sidepanel.css`: provides an active processing card with real-time numeric percentage, animated gradient progress bar, and queued count badge.
- Updated `sidepanel.js` to handle `DOLA_CLEANER_PROGRESS` and `DOLA_QUEUE_UPDATED` events, rendering active progress and queue depth.
- Updated `offscreen.js` to broadcast job identifiers and progress details.
- Updated `content.js` to distinguish between queued watermark removal and completed master downloads in user notifications.
- Bumped extension version to v2.3.5 across `manifest.json`, `sidepanel.html`, and `README.md`.

#### Files touched
- `background.js`: Implemented sequential queue, `dolaProcessCleanerQueue`, queue broadcast, and eliminated raw watermarked fallback downloads.
- `offscreen.js`: Added job metadata in `DOLA_CLEANER_PROGRESS`.
- `sidepanel.html`: Added active processing card markup `#dola-cleaner-queue-container`.
- `sidepanel.css`: Added styles for active processing card, progress bar track, pulsing status dot, and queue counter badges.
- `sidepanel.js`: Added `renderCleanerQueue`, progress listener updates, and queue polling on load.
- `content.js`: Updated download notifications to indicate queued inpainting.
- `manifest.json`: Bumped version to 2.3.5.
- `README.md`: Bumped version badges to v2.3.5.
- `PROGRESS.md`: Logged Session 28.

### 2026-09-08, Session 29

**Status:** Complete

#### What changed
- Fixed unclosed `manual-import-drawer` container in `sidepanel.html`: the missing closing `</div>` tag previously caused both `#dola-cleaner-queue-container` and `#dola-history-list` to be trapped inside the hidden drawer (`display: none`), making the active queue card and captured list invisible below `CAPTURED (1)`.
- Replaced offscreen render loop in `offscreen.js`: attached `video` and `canvas` elements directly to `document.body` and replaced the idle-sensitive `requestVideoFrameCallback` loop with a robust 30fps timer-driven loop (`renderFrame` with `setTimeout(..., 33)` and `video.ontimeupdate`). This ensures continuous frame inpainting and progress updates in headless offscreen documents without stalling at 0%.
- Updated `sidepanel.js` to dynamically refresh status labels (`Removing dynamic watermark...` or `Removing static watermark...`) during frame progress.
- Corrected footer version text in `sidepanel.html` to v2.3.5.

#### Files touched
- `sidepanel.html`: Added missing `</div>` for manual import drawer, updated footer version to v2.3.5.
- `offscreen.js`: Attached media elements to DOM, implemented timer-driven frame loop, added DOM cleanup in `finally`.
- `sidepanel.js`: Added dynamic watermark type label update during progress.
- `PROGRESS.md`: Logged Session 29.

### 2026-09-08, Session 30

**Status:** Complete

#### What changed
- Packaged clean, production-ready distribution archive `dola-extension.zip` in the extension root directory.
- Strictly excluded internal development artifacts (`.git/`, `.gitignore`, `PROGRESS.md`, `AGENTS.md`, and `CUSTOMER_USER_GUIDE_AND_CHECKLIST.md`).
- Confirmed flat archive hierarchy with runtime files and `assets/` subfolder at root, ready for sharing and immediate unpacked loading.

#### Files touched
- `dola-extension.zip`: Generated distribution archive.
- `PROGRESS.md`: Logged Session 30.

### 2026-09-09, Session 31

**Status:** Complete

#### What changed
- Added one-click "Open folder location" options in `sidepanel.html`, `sidepanel.js`, `popup.html`, and `popup.js`:
  - Captured section header now has a dedicated `[Folder]` button to reveal the cleaned videos directory in Windows File Explorer immediately.
  - History empty-state now provides an `Open Cleaned Folder` button so users can locate and verify the download target before running generations.
  - Settings tab `Downloads & storage` now has an `Open Folder` button directly next to Save, plus a live path preview displaying the exact destination (`Downloads/<subfolder>/cleaned/`).
  - Extension popup now contains matching `Open Folder` buttons in the destination folder group and history header.
- Implemented multi-tier folder resolution in `background.js` (`dolaOpenCleanedFolder`):
  - Tier 1: Checks in-memory download history for a completed cleaned video still present on disk.
  - Tier 2: Queries Chrome download records for any existing file in the `cleaned` subfolder.
  - Tier 3: Queries Chrome download records for files in the parent download directory.
  - Tier 4: Generates a lightweight directory anchor file (`Downloads/<subfolder>/cleaned/DOLA_CLEANED_VIDEOS.txt`) via Data URI download to guarantee Windows File Explorer opens directly inside the cleaned folder even if no videos have been downloaded yet.
  - Tier 5: Falls back to the default downloads folder if file manager focus fails.
- Rebuilt `dola-extension.zip` distribution archive with the updated files.

#### Files touched
- `background.js`: Implemented `dolaOpenCleanedFolder` and `OPEN_CLEANED_FOLDER` message handler.
- `sidepanel.html`: Added Open Folder buttons in Captured header, empty state, and Settings card with path preview.
- `sidepanel.css`: Added styles for folder action buttons, tiny icons, and path preview text.
- `sidepanel.js`: Added folder button click handlers with "Opening..." feedback and dynamic path preview updater.
- `popup.html`: Added Open Folder buttons in destination section and history header with path preview.
- `popup.css`: Added styles for popup folder buttons and preview text.
- `popup.js`: Added popup folder button event listeners and path preview logic.
- `README.md`: Updated key features and settings reference tables.
- `dola-extension.zip`: Re-packaged distribution zip.
- `PROGRESS.md`: Logged Session 31.

### 2026-09-13, Session 32

**Status:** Complete

#### What changed
- Bumped extension version to v2.3.6 across `manifest.json`, `sidepanel.html` (header badge and footer notes), and `README.md` (badges and download link).
- Re-packaged distribution archive `dola-extension.zip` containing the new v2.3.6 build.
- Committed all version bump changes, pushed to GitHub `origin main`, and published GitHub Release `v2.3.6` with the release archive.

#### Files touched
- `manifest.json`: Bumped version to 2.3.6.
- `sidepanel.html`: Updated header version badge and footer notes to v2.3.6.
- `README.md`: Bumped version badges to v2.3.6.
- `dola-extension.zip`: Re-packaged archive.
- `PROGRESS.md`: Logged Session 32.
