/**
 * Dola Video Studio - In-Browser Watermark Removal and Offscreen Processing Engine
 *
 * Runs inside Chrome extension's offscreen document (offscreen.html).
 * Provides 100% native in-browser watermark removal and direct MP4 export:
 * 1. Fetches the video stream into an in-memory Blob to prevent network stalls.
 * 2. Renders frames into an offscreen HTML5 canvas.
 * 3. Applies soft Gaussian-feathered elliptical masks to the moving ByteDance watermark quadrants:
 *    - Phase 0 & 3: Bottom-Right (cx=0.865, cy=0.957, rx=0.150, ry=0.038)
 *    - Phase 1: Mid-Left (cx=0.175, cy=0.498, rx=0.170, ry=0.038)
 *    - Phase 2: Top-Right (cx=0.865, cy=0.042, rx=0.150, ry=0.038)
 * 4. Uses fast multiscale harmonic diffusion inpainting to reconstruct natural textures.
 * 5. Preserves original audio tracks via HTMLMediaElement.captureStream().
 * 6. Records composite streams directly to MP4 via MediaRecorder.
 */
(() => {
  'use strict';

  const activeBlobUrls = new Map();
  let isCleanerBusy = false;

  /**
   * Precomputes elliptical geometry, Gaussian alpha feathering,
   * and downscaled lattice buffers for a watermark zone.
   */
  function buildZone(W, H, centerRatio, axesRatio) {
    const cx = Math.round(centerRatio[0] * W);
    const cy = Math.round(centerRatio[1] * H);
    const rx = Math.round(axesRatio[0] * W);
    const ry = Math.round(axesRatio[1] * H);

    // Padding ensures Gaussian decay has ample room to continuously reach 0.0
    const padX = 20;
    const padY = 14;
    const x1 = Math.max(0, cx - rx - padX);
    const x2 = Math.min(W, cx + rx + padX);
    const y1 = Math.max(0, cy - ry - padY);
    const y2 = Math.min(H, cy + ry + padY);
    const boxW = x2 - x1;
    const boxH = y2 - y1;
    const size = boxW * boxH;

    const alpha = new Float32Array(size);
    const sigma = 0.35;

    for (let py = 0; py < boxH; py++) {
      const gy = y1 + py;
      const dy = (gy - cy) / ry;
      for (let px = 0; px < boxW; px++) {
        const gx = x1 + px;
        const dx = (gx - cx) / rx;
        const dSq = dx * dx + dy * dy;
        const idx = py * boxW + px;

        if (dSq <= 1.0) {
          // Inside core watermark ellipse
          alpha[idx] = 1.0;
        } else {
          // Continuous Gaussian decay outside the ellipse boundary
          const d = Math.sqrt(dSq) - 1.0;
          alpha[idx] = Math.exp(-(d * d) / (2 * sigma * sigma));
        }
      }
    }

    // 4x downscaling grid for ultra-fast harmonic diffusion inpainting
    const scale = 4;
    const sw = Math.floor(boxW / scale);
    const sh = Math.floor(boxH / scale);
    const sSize = sw * sh;
    const sCore = new Uint8Array(sSize);

    for (let sy = 0; sy < sh; sy++) {
      for (let sx = 0; sx < sw; sx++) {
        const py = Math.min(sy * scale, boxH - 1);
        const px = Math.min(sx * scale, boxW - 1);
        if (alpha[py * boxW + px] > 0.12) {
          sCore[sy * sw + sx] = 1;
        }
      }
    }

    const sBuf = new Float32Array(sSize * 3);
    const sNext = new Float32Array(sSize * 3);

    return {
      x1,
      y1,
      boxW,
      boxH,
      alpha,
      scale,
      sw,
      sh,
      sSize,
      sCore,
      sBuf,
      sNext
    };
  }

  /**
   * Applies fast multiscale harmonic diffusion inpainting to a single zone.
   */
  function inpaintZone(ctx, zone) {
    const { x1, y1, boxW, boxH, alpha, scale, sw, sh, sSize, sCore, sBuf, sNext } = zone;
    const imgData = ctx.getImageData(x1, y1, boxW, boxH);
    const data = imgData.data;

    // 1. Downsample patch to small float buffer (4x reduction)
    for (let sy = 0; sy < sh; sy++) {
      const srcY = sy * scale;
      const srcRow = srcY * boxW;
      const sRow = sy * sw;
      for (let sx = 0; sx < sw; sx++) {
        const srcX = sx * scale;
        const srcIdx = (srcRow + srcX) * 4;
        const sIdx = (sRow + sx) * 3;
        sBuf[sIdx] = data[srcIdx];
        sBuf[sIdx + 1] = data[srcIdx + 1];
        sBuf[sIdx + 2] = data[srcIdx + 2];
      }
    }

    // 2. Jacobi relaxation iterations for Laplace equation (harmonic inpainting)
    for (let c = 0; c < 3; c++) {
      for (let it = 0; it < 10; it++) {
        for (let sy = 1; sy < sh - 1; sy++) {
          const row = sy * sw;
          for (let sx = 1; sx < sw - 1; sx++) {
            const idx = row + sx;
            const pos = idx * 3 + c;
            if (sCore[idx]) {
              // 4-point stencil averaging surrounding known boundary values
              sNext[pos] = (sBuf[(idx - 1) * 3 + c] +
                            sBuf[(idx + 1) * 3 + c] +
                            sBuf[(idx - sw) * 3 + c] +
                            sBuf[(idx + sw) * 3 + c]) * 0.25;
            } else {
              sNext[pos] = sBuf[pos];
            }
          }
        }
        for (let idx = 0; idx < sSize; idx++) {
          sBuf[idx * 3 + c] = sNext[idx * 3 + c];
        }
      }
    }

    // 3. Bilinear upsample and continuous Gaussian alpha-blend back to canvas
    for (let py = 0; py < boxH; py++) {
      const sy = Math.min(Math.floor(py / scale), sh - 1);
      const rowOff = py * boxW;
      const sRow = sy * sw;
      for (let px = 0; px < boxW; px++) {
        const sx = Math.min(Math.floor(px / scale), sw - 1);
        const idx = rowOff + px;
        const a = alpha[idx];
        if (a > 0.01) {
          const sIdx = (sRow + sx) * 3;
          const dIdx = idx * 4;
          data[dIdx] = Math.round(data[dIdx] * (1 - a) + sBuf[sIdx] * a);
          data[dIdx + 1] = Math.round(data[dIdx + 1] * (1 - a) + sBuf[sIdx + 1] * a);
          data[dIdx + 2] = Math.round(data[dIdx + 2] * (1 - a) + sBuf[sIdx + 2] * a);
        }
      }
    }

    ctx.putImageData(imgData, x1, y1);
  }

  /**
   * Prepares and caches the 3 dynamic quadrant zones for the given resolution.
   */
  function prepareZones(W, H) {
    return {
      // Bottom-Right: Phase 0 & Phase 3
      br: buildZone(W, H, [0.865, 0.957], [0.150, 0.038]),
      // Mid-Left: Phase 1 (extended horizontal radius for 240px entrance wipe)
      ml: buildZone(W, H, [0.175, 0.498], [0.170, 0.038]),
      // Top-Right: Phase 2
      tr: buildZone(W, H, [0.865, 0.042], [0.150, 0.038])
    };
  }

  /**
   * Cleans watermarks frame-by-frame and re-encodes to a clean MP4.
   */
  async function cleanAndRecordVideo(url, options = {}) {
    console.log('[Dola Offscreen Cleaner] Starting in-browser video cleaning for:', url);

    // 1. Fetch source stream into local Blob so playback never buffers
    const fetchController = new AbortController();
    const fetchTimeout = setTimeout(() => fetchController.abort(), 25000);

    let sourceBlobUrl = null;
    try {
      const resp = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        signal: fetchController.signal
      });
      clearTimeout(fetchTimeout);

      if (!resp.ok) {
        throw new Error(`Failed to fetch video stream (HTTP ${resp.status})`);
      }

      const rawBlob = await resp.blob();
      sourceBlobUrl = URL.createObjectURL(rawBlob);
    } catch (err) {
      clearTimeout(fetchTimeout);
      throw new Error(`Network fetch failed: ${err.message}`);
    }

    // 2. Setup offscreen video element and Web Audio pipeline
    const video = document.createElement('video');
    video.playsInline = true;
    video.volume = 1.0;
    video.preload = 'auto';
    video.src = sourceBlobUrl;

    let audioCtx = null;

    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video metadata load timed out after 15s'));
        }, 15000);

        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve();
        };
        video.onerror = e => {
          clearTimeout(timeout);
          reject(new Error('Video element failed to load source'));
        };
      });

      const W = video.videoWidth || 1280;
      const H = video.videoHeight || 720;
      const duration = video.duration || 5.0;
      console.log(`[Dola Offscreen Cleaner] Video loaded: ${W}x${H}, duration: ${duration.toFixed(1)}s`);

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Precompute the soft quadrant zones
      const zones = prepareZones(W, H);

      // 3. Setup capture stream and silent Web Audio routing to preserve audio
      const canvasStream = canvas.captureStream(25);
      const combinedTracks = [...canvasStream.getVideoTracks()];

      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          audioCtx = new AudioCtxClass();
          const source = audioCtx.createMediaElementSource(video);
          const audioDest = audioCtx.createMediaStreamDestination();
          source.connect(audioDest);
          // Do not connect to audioCtx.destination so offscreen processing is silent
          const tracks = audioDest.stream.getAudioTracks();
          if (tracks && tracks.length > 0) {
            combinedTracks.push(tracks[0]);
            console.log('[Dola Offscreen Cleaner] Preserved audio track via Web Audio MediaStreamDestination');
          }
        }
      } catch (e) {
        // Fallback to native captureStream audio tracks
        try {
          if (typeof video.captureStream === 'function') {
            const mediaStream = video.captureStream();
            const audioTracks = mediaStream.getAudioTracks();
            if (audioTracks && audioTracks.length > 0) {
              combinedTracks.push(audioTracks[0]);
              console.log('[Dola Offscreen Cleaner] Preserved audio track via captureStream fallback');
            }
          }
        } catch (e2) {}
      }

      const combinedStream = new MediaStream(combinedTracks);

      // 4. Select best supported MP4 container format
      let mimeType = 'video/mp4;codecs=avc1,mp4a.40.2';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
          mimeType = 'video/mp4;codecs=avc1';
        } else if (MediaRecorder.isTypeSupported('video/mp4')) {
          mimeType = 'video/mp4';
        } else {
          mimeType = 'video/webm;codecs=vp9';
        }
      }
      console.log('[Dola Offscreen Cleaner] Using recorder format:', mimeType);

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 6000000
      });

      const recordedChunks = [];
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      // 5. Processing and rendering loop
      let isRendering = true;

      const isDynamic = options.watermarkType === 'dynamic' || url.includes('video_gen_watermark_dyn');
      const isStatic = options.watermarkType === 'static' || options.watermarkType === 'simple' || (!isDynamic && url.includes('video_gen_watermark'));

      function renderNextFrame() {
        if (!isRendering) return;

        // Draw current video frame to canvas
        ctx.drawImage(video, 0, 0, W, H);

        const t = video.currentTime;

        if (isStatic) {
          // Static / simple watermark: Stationary in the bottom-right corner across all frames
          inpaintZone(ctx, zones.br);
        } else {
          // Dynamic watermark: ByteDance 12-second 3-phase quadrant rotation with overlap buffering
          const cycleT = t % 12.0;

          if (cycleT <= 4.2 || cycleT >= 11.8) {
            inpaintZone(ctx, zones.br);
          }
          if (cycleT >= 3.8 && cycleT <= 8.2) {
            inpaintZone(ctx, zones.ml);
          }
          if (cycleT >= 7.8 && cycleT <= 12.2) {
            inpaintZone(ctx, zones.tr);
          }
        }

        // Notify progress to background and sidepanel
        try {
          const pct = Math.min(99, Math.round((t / Math.max(duration, 1.0)) * 100));
          chrome.runtime.sendMessage({
            type: 'DOLA_CLEANER_PROGRESS',
            jobId: options.jobId || null,
            filename: options.filename || '',
            prompt: options.prompt || '',
            watermarkType: options.watermarkType || 'dynamic',
            progress: pct,
            currentTime: t,
            duration
          }).catch(() => {});
        } catch {}

        if ('requestVideoFrameCallback' in video) {
          video.requestVideoFrameCallback(renderNextFrame);
        } else {
          requestAnimationFrame(renderNextFrame);
        }
      }

      recorder.start(100);

      // Start playback (if unmuted is restricted, fallback to muted)
      try {
        await video.play();
      } catch (playErr) {
        video.muted = true;
        await video.play();
      }

      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(renderNextFrame);
      } else {
        requestAnimationFrame(renderNextFrame);
      }

      // Wait for video completion
      const cleanedBlob = await new Promise((resolve, reject) => {
        const maxTimeoutMs = (duration + 8) * 1000;
        const timeout = setTimeout(() => {
          isRendering = false;
          try { video.pause(); } catch {}
          try { recorder.stop(); } catch {}
          reject(new Error('In-browser cleaning timed out'));
        }, maxTimeoutMs);

        video.onended = () => {
          isRendering = false;
          setTimeout(() => {
            recorder.stop();
          }, 150);
        };

        recorder.onstop = () => {
          clearTimeout(timeout);
          try { video.pause(); } catch {}
          const outputBlob = new Blob(recordedChunks, { type: mimeType });
          resolve(outputBlob);
        };

        video.onerror = err => {
          clearTimeout(timeout);
          isRendering = false;
          try { recorder.stop(); } catch {}
          reject(new Error('Video playback error during cleaning'));
        };
      });

      const cleanBlobUrl = URL.createObjectURL(cleanedBlob);
      const blobId = `clean_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      activeBlobUrls.set(blobId, cleanBlobUrl);

      // Auto-revoke after 5 minutes
      setTimeout(() => {
        if (activeBlobUrls.has(blobId)) {
          try { URL.revokeObjectURL(activeBlobUrls.get(blobId)); } catch {}
          activeBlobUrls.delete(blobId);
        }
      }, 300000);

      console.log(`[Dola Offscreen Cleaner] Video cleaned successfully: ${(cleanedBlob.size / 1048576).toFixed(2)} MB`);
      return {
        blobUrl: cleanBlobUrl,
        blobId,
        sizeBytes: cleanedBlob.size,
        mimeType
      };
    } finally {
      // Guaranteed resource teardown: release source blob, audio context, and hardware decoders
      if (sourceBlobUrl) {
        try { URL.revokeObjectURL(sourceBlobUrl); } catch {}
      }
      try {
        video.pause();
        video.src = '';
        video.load();
      } catch {}
      if (audioCtx && audioCtx.state !== 'closed') {
        try { audioCtx.close(); } catch {}
      }
    }
  }

  // Runtime message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.target !== 'offscreen') return false;

    // Direct Blob creation for unwatermarked streams
    if (message.type === 'CREATE_BLOB_URL') {
      (async () => {
        try {
          const { url } = message;
          if (!url) {
            sendResponse({ ok: false, error: 'No video stream URL provided' });
            return;
          }

          const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
          if (!resp.ok) {
            sendResponse({ ok: false, error: `Stream HTTP ${resp.status}` });
            return;
          }

          const blob = await resp.blob();
          const videoBlob = blob.type.includes('mp4') ? blob : new Blob([blob], { type: 'video/mp4' });
          const blobUrl = URL.createObjectURL(videoBlob);
          const blobId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          activeBlobUrls.set(blobId, blobUrl);

          setTimeout(() => {
            if (activeBlobUrls.has(blobId)) {
              try { URL.revokeObjectURL(activeBlobUrls.get(blobId)); } catch {}
              activeBlobUrls.delete(blobId);
            }
          }, 180000);

          sendResponse({ ok: true, blobUrl, blobId, sizeBytes: videoBlob.size });
        } catch (err) {
          sendResponse({ ok: false, error: err?.message || String(err) });
        }
      })();
      return true;
    }

    // In-browser watermark cleaning and recording
    if (message.type === 'CLEAN_AND_RECORD_VIDEO') {
      (async () => {
        if (isCleanerBusy) {
          sendResponse({ ok: false, busy: true, error: 'In-browser cleaner is busy with another video' });
          return;
        }

        isCleanerBusy = true;
        try {
          const result = await cleanAndRecordVideo(message.url, message.options);
          isCleanerBusy = false;
          sendResponse({ ok: true, ...result });
        } catch (err) {
          isCleanerBusy = false;
          console.warn('[Dola Offscreen Cleaner] Cleaning failed:', err);
          sendResponse({ ok: false, error: err?.message || String(err) });
        }
      })();
      return true;
    }

    // Revoke Blob URL
    if (message.type === 'REVOKE_BLOB_URL') {
      const { blobId, blobUrl } = message;
      if (blobId && activeBlobUrls.has(blobId)) {
        try { URL.revokeObjectURL(activeBlobUrls.get(blobId)); } catch {}
        activeBlobUrls.delete(blobId);
      } else if (blobUrl) {
        try { URL.revokeObjectURL(blobUrl); } catch {}
      }
      sendResponse({ ok: true });
      return false;
    }
  });
})();

