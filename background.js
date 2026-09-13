/**
 * Dola AI Video Watermark Remover — Background Service Worker
 * Manages auto-downloads, deduplication, folder storage, history, notifications,
 * and the direct in-memory blob download engine.
 */

let dolaConfig = {
  autoDownload: true,
  subfolder: 'Dola_Videos',
  notifications: false,
  autoResumeBatches: true,
  totalDownloaded: 0
};

let dolaDownloadHistory = [];
const dolaInProgressKeys = new Set();
const dolaDownloadedKeys = new Set();
const activeBlobDownloads = new Map();

/**
 * ByteDance Canonical Resource Key Extractor
 * Normalizes ephemeral CDN URLs to static content-addressed keys for deduplication.
 * ByteDance video assets follow the URI topology: `https://[cdn-node]/tos-[region]/[hash]?[params]`
 * The query parameters contain short-lived access tokens (`&auth_key=...&wsSecret=...`)
 * that rotate on every request. This function isolates the static object path
 * (`/tos-[region]/[hash]`) or uses the canonical `vid` to prevent redundant downloads.
 * 
 * @param {string} url - Ephemeral signed CDN URL.
 * @param {string} [vid] - Optional ByteDance video ID.
 * @returns {string} Normalized canonical key.
 */
function dolaExtractCanonicalKey(url, vid) {
  if (vid && !String(vid).startsWith('http')) return String(vid).trim();
  const clean = String(url || '').trim();
  const tosMatch = clean.match(/\/tos-[^/?#]+\/[^/?#]+/i);
  if (tosMatch) return tosMatch[0].toLowerCase();
  return clean.split('?')[0].toLowerCase();
}

/**
 * Normalizes user-specified subfolder paths into safe, relative download paths.
 * Handles Windows absolute paths (e.g. C:\Users\...\Downloads\MyFolder),
 * accidental "Downloads/" prefixes, mixed slashes, and illegal filesystem characters.
 *
 * @param {string} inputFolder - Raw folder path entered by the user.
 * @returns {string} Sanitized relative directory path.
 */
function dolaNormalizeSubfolder(inputFolder) {
  if (!inputFolder || typeof inputFolder !== 'string') return 'Dola_Videos';

  let folder = inputFolder.trim().replace(/\\/g, '/');

  // If user pasted a path containing "Downloads", extract only the part after Downloads
  const downloadsMatch = folder.match(/(?:^|[/\\])Downloads(?:[/\\](.*))?$/i);
  if (downloadsMatch) {
    folder = downloadsMatch[1] || '';
  } else {
    // Strip Windows drive letters (e.g. "C:/" or "D:/")
    folder = folder.replace(/^[a-zA-Z]:[/]*/, '');
    folder = folder.replace(/^Users\/[^/]+\//i, '');
  }

  folder = folder.replace(/^\/+|\/+$/g, '');

  // Strip trailing "cleaned" segment to prevent nested "cleaned/cleaned" directories
  folder = folder.replace(/\/cleaned$/i, '');
  if (folder.toLowerCase() === 'cleaned') {
    folder = '';
  }

  // Clean illegal Windows filename characters from each segment while preserving valid hierarchy
  const segments = folder.split('/')
    .map(seg => seg.trim().replace(/[<>:"|?*]/g, '_').replace(/^[.\s]+|[.\s]+$/g, ''))
    .filter(seg => seg && seg !== '..');

  return segments.join('/') || 'Dola_Videos';
}

async function dolaLoadState() {
  try {
    const res = await chrome.storage.local.get(['dola_downloader_config', 'dola_subfolder', 'dola_download_history', 'dola_downloaded_keys']);
    if (res.dola_downloader_config) {
      dolaConfig = { ...dolaConfig, ...res.dola_downloader_config };
    }
    if (res.dola_subfolder) {
      dolaConfig.subfolder = res.dola_subfolder;
    }
    // Strictly normalize configured subfolder
    dolaConfig.subfolder = dolaNormalizeSubfolder(dolaConfig.subfolder);

    if (Array.isArray(res.dola_download_history)) {
      dolaDownloadHistory = res.dola_download_history;
      for (const item of dolaDownloadHistory) {
        if (item.url) {
          dolaDownloadedKeys.add(String(item.url).trim());
          dolaDownloadedKeys.add(dolaExtractCanonicalKey(item.url, item.vid));
        }
        if (item.filename) dolaDownloadedKeys.add(String(item.filename).trim());
        if (item.vid) dolaDownloadedKeys.add(String(item.vid).trim());
      }
    }
    if (Array.isArray(res.dola_downloaded_keys)) {
      for (const k of res.dola_downloaded_keys) dolaDownloadedKeys.add(k);
    }
  } catch (e) {
    console.warn('[Dola Downloader] Failed to load state:', e);
  }
}

async function dolaSaveState() {
  try {
    dolaConfig.subfolder = dolaNormalizeSubfolder(dolaConfig.subfolder);
    await chrome.storage.local.set({
      dola_downloader_config: dolaConfig,
      dola_subfolder: dolaConfig.subfolder,
      dola_download_history: dolaDownloadHistory.slice(0, 100),
      dola_downloaded_keys: Array.from(dolaDownloadedKeys).slice(-500)
    });
  } catch (e) {
    console.warn('[Dola Downloader] Failed to save state:', e);
  }
}

// Keep in-memory config strictly synchronized whenever storage changes from sidepanel or popup
if (chrome.storage && chrome.storage.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.dola_subfolder && changes.dola_subfolder.newValue) {
      dolaConfig.subfolder = dolaNormalizeSubfolder(changes.dola_subfolder.newValue);
      console.log('[Dola Downloader] Synced subfolder from storage change:', dolaConfig.subfolder);
    }
    if (changes.dola_downloader_config && changes.dola_downloader_config.newValue) {
      dolaConfig = { ...dolaConfig, ...changes.dola_downloader_config.newValue };
      if (changes.dola_downloader_config.newValue.subfolder) {
        dolaConfig.subfolder = dolaNormalizeSubfolder(changes.dola_downloader_config.newValue.subfolder);
      }
    }
  });
}

function dolaUpdateBadge() {
  try {
    const count = dolaConfig.totalDownloaded || dolaDownloadHistory.length;
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count > 99 ? '99+' : count) });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch {}
}

// Pending download filename registries for onDeterminingFilename
const dolaPendingFilenamesByUrl = new Map();
const dolaPendingFilenamesById = new Map();

function dolaRegisterPendingDownload(url, filename, downloadId = null) {
  if (url) {
    dolaPendingFilenamesByUrl.set(url, filename);
  }
  if (downloadId) {
    dolaPendingFilenamesById.set(downloadId, filename);
  }

  // Safety cleanup after 60 seconds
  setTimeout(() => {
    if (url) dolaPendingFilenamesByUrl.delete(url);
    if (downloadId) dolaPendingFilenamesById.delete(downloadId);
  }, 60000);
}

function dolaSanitizeFilename(str) {
  let clean = String(str || '')
    // Normalize unicode dashes to standard ASCII hyphen
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    // Strip aspect ratio prefixes
    .replace(/^(\[\s*|\(\s*)?(?:9:16|16:9)\s*(?:vertical portrait|widescreen landscape)?[\s\]\):-]*/i, '')
    // Strip raw prompt prefix
    .replace(/^raw prompt:\s*/i, '')
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Strip embedded URLs
    .replace(/https?:\/\/[^\s]+/g, '')
    // Replace Windows-illegal characters \ / : * ? " < > | with spaces
    .replace(/[\\/:*?"<>|]/g, ' ')
    // Strip non-ASCII characters (emojis like checkmarks, Asian symbols, non-ASCII quotes)
    .replace(/[^\x20-\x7E]/g, ' ')
    // Strip ASCII control characters and non-printable bytes
    .replace(/[\x00-\x1f\x7f-\x9f]/g, ' ')
    // Replace newlines and tabs with spaces
    .replace(/[\r\n\t]+/g, ' ')
    // Collapse consecutive whitespace
    .replace(/\s+/g, ' ')
    // Trim trailing periods, dashes, and spaces
    .replace(/[.\s\-_]+$/, '')
    .trim();

  // Guard against Windows reserved device names
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(clean)) {
    clean = `${clean}_video`;
  }

  // Cap length to 100 characters for Windows MAX_PATH safety
  if (clean.length > 100) {
    clean = clean.substring(0, 100).replace(/[.\s\-_]+$/, '').trim();
  }
  return clean;
}

function dolaGenerateFilename(video, isCleaned = false) {
  const folder = dolaNormalizeSubfolder(dolaConfig.subfolder || 'Dola_Videos');

  // If cleaning a dynamic watermark, route into dedicated cleaned/ subfolder
  let prefix = folder ? `${folder}/` : '';
  if (isCleaned) {
    prefix = `${prefix}cleaned/`;
  }

  const rawPrompt = video.prompt || video.title || '';
  const cleanPrompt = dolaSanitizeFilename(rawPrompt);

  const suffix = isCleaned ? '_clean.mp4' : '.mp4';

  // If a prompt was tracked, name the file directly after the prompt
  if (
    cleanPrompt &&
    cleanPrompt.toLowerCase() !== 'dola video' &&
    cleanPrompt.toLowerCase() !== 'video' &&
    !/^(?:download\s*video|video\s*mp4|master\s*mp4)$/i.test(cleanPrompt)
  ) {
    return `${prefix}${cleanPrompt}${suffix}`;
  }

  // Fallback timestamped filename only if prompt was unavailable
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  return `${prefix}dola_${year}${month}${day}_${hours}${mins}${secs}${suffix}`;
}

// Ensure offscreen document exists for Blob handling
let offscreenCreationPromise = null;

async function ensureOffscreenDocument() {
  if (!chrome.offscreen) return false;
  try {
    if (chrome.offscreen.hasDocument && await chrome.offscreen.hasDocument()) {
      return true;
    }
  } catch {}

  if (offscreenCreationPromise) {
    return offscreenCreationPromise;
  }

  offscreenCreationPromise = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.BLOBS || 'BLOBS'],
        justification: 'In-memory blob pipeline to reliably route downloads directly into the target folder'
      });
      // Short delay to allow offscreen script to finish attaching message listeners
      await new Promise(r => setTimeout(r, 100));
      return true;
    } catch (err) {
      if (err.message && err.message.includes('Only a single offscreen document may exist')) {
        return true;
      }
      console.warn('[Dola Downloader] Failed to create offscreen document:', err);
      return false;
    } finally {
      offscreenCreationPromise = null;
    }
  })();

  return offscreenCreationPromise;
}

// Request offscreen document to fetch video stream and create a local blob: URL
async function dolaFetchBlobUrl(cleanUrl) {
  const offscreenReady = await ensureOffscreenDocument();
  if (!offscreenReady) return null;

  return new Promise(resolve => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[Dola Downloader] Offscreen blob creation timed out after 15s, falling back to direct stream');
        resolve(null);
      }
    }, 15000);

    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'CREATE_BLOB_URL',
      url: cleanUrl
    }, res => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (chrome.runtime.lastError || !res || !res.ok) {
        console.warn('[Dola Downloader] Offscreen blob creation failed, will use direct URL fallback:', chrome.runtime.lastError?.message || res?.error);
        resolve(null);
      } else {
        resolve(res);
      }
    });
  });
}

// --- In-Browser Cleaner Sequential Queue ---
const dolaCleanerQueue = [];
let isCleanerProcessing = false;

function dolaGetQueueState() {
  return {
    queue: dolaCleanerQueue.map(item => ({
      id: item.id,
      prompt: item.prompt,
      filename: item.filename,
      watermarkType: item.watermarkType,
      status: item.status,
      progress: item.progress || 0,
      createdAt: item.createdAt,
      error: item.error || null
    })),
    isProcessing: isCleanerProcessing
  };
}

function dolaBroadcastQueueUpdate() {
  try {
    chrome.runtime.sendMessage({
      type: 'DOLA_QUEUE_UPDATED',
      ...dolaGetQueueState()
    }, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch {}
}

// Request offscreen document to clean watermark in-browser and re-encode to MP4
async function dolaCleanVideoInOffscreen(cleanUrl, filename, prompt, watermarkType = 'dynamic', jobId = null) {
  const offscreenReady = await ensureOffscreenDocument();
  if (!offscreenReady) return null;

  return new Promise(resolve => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        console.warn('[Dola Downloader] In-browser video cleaner timed out after 90s');
        resolve(null);
      }
    }, 90000);

    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'CLEAN_AND_RECORD_VIDEO',
      url: cleanUrl,
      options: { filename, prompt, watermarkType, jobId }
    }, res => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      if (chrome.runtime.lastError || !res || !res.ok) {
        console.warn('[Dola Downloader] In-browser video cleaner error:', chrome.runtime.lastError?.message || res?.error);
        resolve(null);
      } else {
        resolve(res);
      }
    });
  });
}

async function dolaProcessCleanerQueue() {
  if (isCleanerProcessing) return;
  isCleanerProcessing = true;

  try {
    while (dolaCleanerQueue.length > 0) {
      const job = dolaCleanerQueue.find(j => j.status === 'queued');
      if (!job) break;

      job.status = 'cleaning';
      job.progress = 0;
      dolaBroadcastQueueUpdate();

      console.log(`[Dola Downloader] Cleaner Queue: Starting ${job.watermarkType} inpainting for:`, job.filename);

      let cleanRes = null;
      try {
        cleanRes = await dolaCleanVideoInOffscreen(job.cleanUrl, job.filename, job.prompt, job.watermarkType, job.id);
      } catch (err) {
        console.warn('[Dola Downloader] Cleaner Queue inpainting error:', err);
      }

      if (cleanRes && cleanRes.blobUrl) {
        const downloadTargetUrl = cleanRes.blobUrl;
        const blobId = cleanRes.blobId;

        dolaRegisterPendingDownload(downloadTargetUrl, job.filename);

        try {
          const downloadId = await chrome.downloads.download({
            url: downloadTargetUrl,
            filename: job.filename,
            saveAs: false,
            conflictAction: 'uniquify'
          });

          if (downloadId) {
            dolaPendingFilenamesById.set(downloadId, job.filename);
          }
          if (blobId) {
            activeBlobDownloads.set(downloadId, blobId);
          }

          dolaDownloadedKeys.add(job.canonicalKey);
          dolaDownloadedKeys.add(job.mediaKey);
          dolaDownloadedKeys.add(job.cleanUrl);
          dolaInProgressKeys.delete(job.canonicalKey);
          dolaInProgressKeys.delete(job.mediaKey);
          dolaConfig.totalDownloaded = (dolaConfig.totalDownloaded || 0) + 1;

          const resolutionLabel = job.watermarkType === 'dynamic'
            ? 'Dynamic Cleaned (In-Browser)'
            : 'Static Cleaned (In-Browser)';

          const historyEntry = {
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            downloadId,
            url: job.cleanUrl,
            filename: job.filename,
            prompt: job.prompt,
            resolution: resolutionLabel,
            watermarkType: job.watermarkType,
            blobPipeline: true,
            timestamp: Date.now()
          };

          dolaDownloadHistory.unshift(historyEntry);
          await dolaSaveState();
          dolaUpdateBadge();

          job.status = 'completed';
          job.progress = 100;
          dolaBroadcastQueueUpdate();

          if (dolaConfig.notifications) {
            try {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon128.png',
                title: 'Watermark Removed and Saved',
                message: `${job.prompt.substring(0, 50)}...\nSaved to Downloads/${job.filename}`,
                priority: 1
              });
            } catch {}
          }
        } catch (dlErr) {
          console.warn('[Dola Downloader] Cleaner Queue download failed:', dlErr);
          job.status = 'failed';
          job.error = dlErr.message || String(dlErr);
          dolaInProgressKeys.delete(job.canonicalKey);
          dolaInProgressKeys.delete(job.mediaKey);
          dolaBroadcastQueueUpdate();
        }
      } else {
        // Inpainting failed or timed out.
        // Strict rule: do not fall back to downloading dirty watermarked video.
        console.warn(`[Dola Downloader] Cleaner inpainting failed for: ${job.filename}. Suppressing raw download to prevent saving watermarked video.`);
        job.status = 'failed';
        job.error = 'Inpainting failed or timed out';
        dolaInProgressKeys.delete(job.canonicalKey);
        dolaInProgressKeys.delete(job.mediaKey);
        dolaBroadcastQueueUpdate();
      }

      // Keep completed or failed status visible in UI for 1.2s before advancing
      await new Promise(r => setTimeout(r, 1200));
      const idx = dolaCleanerQueue.indexOf(job);
      if (idx !== -1) {
        dolaCleanerQueue.splice(idx, 1);
      }
      dolaBroadcastQueueUpdate();
    }
  } finally {
    isCleanerProcessing = false;
  }
}

function dolaRevokeBlobUrl(blobId, blobUrl) {
  try {
    chrome.runtime.sendMessage({
      target: 'offscreen',
      type: 'REVOKE_BLOB_URL',
      blobId,
      blobUrl
    }, () => {
      if (chrome.runtime.lastError) {}
    });
  } catch {}
}

// Listen for download completion to clean up blob URLs and pending filename mappings
if (chrome.downloads && chrome.downloads.onChanged) {
  chrome.downloads.onChanged.addListener(delta => {
    if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
      const blobId = activeBlobDownloads.get(delta.id);
      if (blobId) {
        dolaRevokeBlobUrl(blobId);
        activeBlobDownloads.delete(delta.id);
      }
      dolaPendingFilenamesById.delete(delta.id);
    }
  });
}

// Hook chrome.downloads.onDeterminingFilename to strictly enforce subfolder and prompt filename
if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
  chrome.downloads.onDeterminingFilename.addListener((downloadItem, suggest) => {
    try {
      const itemUrl = downloadItem.url || '';
      const finalUrl = downloadItem.finalUrl || '';
      const itemId = downloadItem.id;
      const byExtension = downloadItem.byExtensionId;

      let targetFilename =
        dolaPendingFilenamesById.get(itemId) ||
        dolaPendingFilenamesByUrl.get(itemUrl) ||
        (finalUrl && dolaPendingFilenamesByUrl.get(finalUrl));

      // If download originated from this extension but was missing from pending map:
      if (!targetFilename && byExtension === chrome.runtime.id) {
        const currentFolder = dolaNormalizeSubfolder(dolaConfig.subfolder || 'Dola_Videos');
        if (downloadItem.filename && downloadItem.filename.endsWith('.mp4')) {
          const rawItemFilename = downloadItem.filename.replace(/\\/g, '/');
          const isCleaned = rawItemFilename.includes('/cleaned/') || rawItemFilename.startsWith('cleaned/') || rawItemFilename.includes('_clean.mp4');
          const cleanItemName = rawItemFilename.split('/').pop();
          targetFilename = isCleaned
            ? `${currentFolder}/cleaned/${cleanItemName}`
            : `${currentFolder}/${cleanItemName}`;
        }
      }

      if (targetFilename) {
        // Enforce forward slashes for Chrome's suggest() API
        const normalized = targetFilename.replace(/\\/g, '/');
        console.log(`[Dola Downloader] onDeterminingFilename: Forcing filename for #${itemId} -> "${normalized}"`);
        suggest({
          filename: normalized,
          conflictAction: 'uniquify'
        });

        // Cleanup immediately
        dolaPendingFilenamesById.delete(itemId);
        dolaPendingFilenamesByUrl.delete(itemUrl);
        if (finalUrl) dolaPendingFilenamesByUrl.delete(finalUrl);
        return;
      }
    } catch (err) {
      console.warn('[Dola Downloader] onDeterminingFilename error:', err);
    }

    // Call suggest() with no arguments so external browser downloads proceed normally
    try {
      suggest();
    } catch {}
  });
}

async function dolaHandleAutoDownload(video, force = false) {
  if (!video || !video.url) return { ok: false, error: 'Invalid video URL' };
  if (!dolaConfig.autoDownload && !force) return { ok: true, downloaded: false, reason: 'Auto-download is paused' };

  const cleanUrl = String(video.url).trim();
  const canonicalKey = dolaExtractCanonicalKey(cleanUrl, video.vid);
  const mediaKey = String(video.vid || cleanUrl);

  // Deduplication check
  if (!force) {
    if (
      dolaDownloadedKeys.has(canonicalKey) ||
      dolaDownloadedKeys.has(mediaKey) ||
      dolaDownloadedKeys.has(cleanUrl)
    ) {
      console.log('[Dola Downloader] Duplicate prevented by canonical key:', canonicalKey);
      return { ok: true, downloaded: false, reason: 'Already downloaded' };
    }
    if (dolaInProgressKeys.has(canonicalKey) || dolaInProgressKeys.has(mediaKey)) {
      return { ok: true, downloaded: false, reason: 'Download already in progress' };
    }
    if (dolaCleanerQueue.some(j => j.canonicalKey === canonicalKey || j.cleanUrl === cleanUrl)) {
      return { ok: true, downloaded: false, reason: 'Already in cleaning queue' };
    }
  }

  const isDynamic = Boolean(video.watermarkType === 'dynamic' || cleanUrl.includes('video_gen_watermark_dyn'));
  const isStatic = Boolean(video.watermarkType === 'static' || (!isDynamic && cleanUrl.includes('video_gen_watermark')));
  const needsWatermarkCleaning = isDynamic || isStatic;
  const watermarkType = isDynamic ? 'dynamic' : (isStatic ? 'static' : 'none');
  const filename = dolaGenerateFilename(video, needsWatermarkCleaning);

  if (needsWatermarkCleaning) {
    // Watermarked video: NEVER download raw. Route into sequential queue.
    dolaInProgressKeys.add(canonicalKey);
    dolaInProgressKeys.add(mediaKey);

    const job = {
      id: `clean_job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      video,
      force,
      cleanUrl,
      canonicalKey,
      mediaKey,
      filename,
      prompt: video.prompt || video.title || 'Dola Video',
      watermarkType,
      status: 'queued',
      progress: 0,
      createdAt: Date.now()
    };

    dolaCleanerQueue.push(job);
    dolaBroadcastQueueUpdate();
    dolaProcessCleanerQueue();

    return {
      ok: true,
      queued: true,
      jobId: job.id,
      prompt: job.prompt,
      watermarkType,
      notifications: dolaConfig.notifications
    };
  }

  // Pristine 1080p master without watermark: download directly
  dolaInProgressKeys.add(canonicalKey);
  dolaInProgressKeys.add(mediaKey);

  let downloadTargetUrl = cleanUrl;
  let usedBlobPipeline = false;
  let blobId = null;

  try {
    console.log('[Dola Downloader] Downloading raw unwatermarked MP4:', filename, cleanUrl);
    // Route stream through in-memory Blob pipeline to guarantee target folder placement
    // and prevent external download interceptors from overriding the destination folder.
    try {
      const blobInfo = await dolaFetchBlobUrl(cleanUrl);
      if (blobInfo && blobInfo.blobUrl) {
        downloadTargetUrl = blobInfo.blobUrl;
        blobId = blobInfo.blobId;
        usedBlobPipeline = true;
        console.log('[Dola Downloader] In-memory blob URL acquired for master stream:', downloadTargetUrl);
      }
    } catch (e) {
      console.warn('[Dola Downloader] Blob pipeline error, using direct stream fallback:', e);
    }

    // Pre-register URLs in pending maps BEFORE triggering download so onDeterminingFilename catches them
    dolaRegisterPendingDownload(downloadTargetUrl, filename);
    if (cleanUrl !== downloadTargetUrl) {
      dolaRegisterPendingDownload(cleanUrl, filename);
    }

    const downloadId = await chrome.downloads.download({
      url: downloadTargetUrl,
      filename,
      saveAs: false,
      conflictAction: 'uniquify'
    });

    if (downloadId) {
      dolaPendingFilenamesById.set(downloadId, filename);
    }

    if (usedBlobPipeline && blobId) {
      activeBlobDownloads.set(downloadId, blobId);
    }

    // Now that download successfully queued, add to downloaded keys
    dolaDownloadedKeys.add(canonicalKey);
    dolaDownloadedKeys.add(mediaKey);
    dolaDownloadedKeys.add(cleanUrl);
    dolaInProgressKeys.delete(canonicalKey);
    dolaInProgressKeys.delete(mediaKey);
    dolaConfig.totalDownloaded = (dolaConfig.totalDownloaded || 0) + 1;

    const resolutionLabel = '1080p Master (Raw)';

    const historyEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      downloadId,
      url: cleanUrl,
      filename,
      prompt: video.prompt || video.title || 'Dola Unwatermarked Video',
      resolution: resolutionLabel,
      watermarkType: 'none',
      blobPipeline: usedBlobPipeline,
      timestamp: Date.now()
    };

    dolaDownloadHistory.unshift(historyEntry);
    await dolaSaveState();
    dolaUpdateBadge();

    if (dolaConfig.notifications) {
      try {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'Master Video Downloaded',
          message: `${(historyEntry.prompt).substring(0, 50)}...\nSaved directly to Downloads/${filename}`,
          priority: 1
        });
      } catch {}
    }

    return { ok: true, downloaded: true, downloadId, filename, blobPipeline: usedBlobPipeline, notifications: dolaConfig.notifications };
  } catch (err) {
    dolaInProgressKeys.delete(mediaKey);
    dolaInProgressKeys.delete(canonicalKey);
    if (blobId) {
      dolaRevokeBlobUrl(blobId);
    }
    console.warn('[Dola Downloader] Download skipped or canceled:', err);
    return { ok: false, error: err.message || String(err) };
  }
}

async function dolaAutoInjectIntoExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: [
        'https://*.dola.com/*',
        'https://*.doubao.com/*',
        'https://*.seaart.ai/*'
      ]
    });

    for (const tab of tabs) {
      if (!tab.id) continue;
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['extractor.js'],
          world: 'MAIN'
        }).catch(() => {});

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(() => {});
      } catch (err) {
        console.warn('[Dola Downloader] Injection failed on tab', tab.id, err);
      }
    }
  } catch (e) {
    console.warn('[Dola Downloader] autoInject failed:', e);
  }
}

/**
 * Opens Windows File Explorer directly to the cleaned videos folder.
 * Uses a multi-tier fallback:
 * 1. Checks in-memory history for existing cleaned video on disk.
 * 2. Queries Chrome's download database for existing files in cleaned/.
 * 3. Queries Chrome's download database for files in the parent download subfolder.
 * 4. Generates an anchor file in the cleaned directory via data URI to create and focus the folder.
 * 5. Falls back to default downloads directory if all else fails.
 */
async function dolaOpenCleanedFolder() {
  const folder = dolaNormalizeSubfolder(dolaConfig.subfolder || 'Dola_Videos');
  const targetPrefix = folder ? `${folder}/cleaned` : 'cleaned';
  const escapedFolder = folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const folderRegex = new RegExp(`(?:^|[\\/\\\\])${escapedFolder}[\\/\\\\]cleaned`, 'i');

  // Tier 1: Check in-memory history for a completed cleaned video download that still exists in this folder
  for (const entry of dolaDownloadHistory) {
    if (entry.downloadId && entry.filename && folderRegex.test(entry.filename.replace(/\\/g, '/'))) {
      try {
        const results = await chrome.downloads.search({ id: entry.downloadId });
        if (results && results.length > 0 && results[0].exists && results[0].state === 'complete') {
          chrome.downloads.show(results[0].id);
          return { ok: true, source: 'history', id: results[0].id };
        }
      } catch (e) {
        console.warn('[Dola Downloader] History download verification error:', e);
      }
    }
  }

  // Tier 2: Search Chrome downloads database for existing files in THIS cleaned folder
  try {
    const searchResults = await chrome.downloads.search({
      query: ['cleaned'],
      state: 'complete',
      orderBy: ['-startTime'],
      limit: 50
    });

    const match = searchResults.find(r => r.exists && folderRegex.test(r.filename.replace(/\\/g, '/')));
    if (match) {
      chrome.downloads.show(match.id);
      return { ok: true, source: 'search_cleaned', id: match.id };
    }
  } catch (e) {
    console.warn('[Dola Downloader] Search cleaned error:', e);
  }

  // Tier 3: Search Chrome downloads database for any files in the parent folder
  try {
    const parentRegex = new RegExp(`(?:^|[\\/\\\\])${escapedFolder}(?:[\\/\\\\]|$)`, 'i');
    const searchFolder = await chrome.downloads.search({
      query: [folder.split('/').pop() || 'Dola_Videos'],
      state: 'complete',
      orderBy: ['-startTime'],
      limit: 30
    });
    const folderMatch = searchFolder.find(r => r.exists && parentRegex.test(r.filename.replace(/\\/g, '/')));
    if (folderMatch) {
      chrome.downloads.show(folderMatch.id);
      return { ok: true, source: 'search_subfolder', id: folderMatch.id };
    }
  } catch (e) {
    console.warn('[Dola Downloader] Search subfolder error:', e);
  }

  // Tier 4: If no existing file is found, create an anchor file in the cleaned directory
  // This writes Downloads/<subfolder>/cleaned/DOLA_CLEANED_VIDEOS.txt and opens File Explorer directly on it
  try {
    const anchorFilename = `${targetPrefix}/DOLA_CLEANED_VIDEOS.txt`;
    const anchorContent = 'Dola Video Studio - Cleaned Videos Directory\r\nWatermark-free videos will be saved in this folder automatically.\r\n';
    const dataUrl = 'data:text/plain;charset=utf-8,' + encodeURIComponent(anchorContent);

    dolaRegisterPendingDownload(dataUrl, anchorFilename);

    const anchorDownloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: anchorFilename,
      saveAs: false,
      conflictAction: 'overwrite'
    });

    if (anchorDownloadId) {
      dolaPendingFilenamesById.set(anchorDownloadId, anchorFilename);

      // Wait a short moment for Windows filesystem write to finish
      await new Promise(r => setTimeout(r, 350));
      chrome.downloads.show(anchorDownloadId);
      return { ok: true, source: 'anchor_file', id: anchorDownloadId };
    }
  } catch (err) {
    console.warn('[Dola Downloader] Anchor download failed:', err);
  }

  // Tier 5: Final fallback to default downloads folder
  try {
    chrome.downloads.showDefaultFolder();
    return { ok: true, source: 'default_folder' };
  } catch (err) {
    console.warn('[Dola Downloader] showDefaultFolder failed:', err);
    return { ok: false, error: err.message || String(err) };
  }
}

// Runtime messaging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'AUTO_DOWNLOAD_VIDEO') {
    dolaHandleAutoDownload(message.video, Boolean(message.force)).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_STATUS' || message.type === 'GET_DOWNLOADER_STATUS') {
    sendResponse({
      ok: true,
      config: dolaConfig,
      history: dolaDownloadHistory,
      totalDownloaded: dolaConfig.totalDownloaded || dolaDownloadHistory.length
    });
    return false;
  }

  if (message.type === 'GET_CLEANER_QUEUE') {
    sendResponse({
      ok: true,
      ...dolaGetQueueState()
    });
    return false;
  }

  if (message.type === 'DOLA_CLEANER_PROGRESS') {
    if (message.jobId) {
      const activeJob = dolaCleanerQueue.find(j => j.id === message.jobId && j.status === 'cleaning');
      if (activeJob) {
        activeJob.progress = message.progress;
      }
    }
    return false;
  }

  if (message.type === 'TOGGLE_AUTO_DOWNLOAD') {
    dolaConfig.autoDownload = Boolean(message.enabled);
    dolaSaveState().then(() => {
      dolaUpdateBadge();
      sendResponse({ ok: true, autoDownload: dolaConfig.autoDownload });
    });
    return true;
  }

  if (message.type === 'TOGGLE_NOTIFICATIONS') {
    dolaConfig.notifications = Boolean(message.enabled);
    dolaSaveState().then(() => {
      sendResponse({ ok: true, notifications: dolaConfig.notifications });
    });
    return true;
  }

  if (message.type === 'UPDATE_CONFIG' || message.type === 'UPDATE_DOWNLOADER_CONFIG') {
    const updated = { ...(message.config || {}) };
    if (updated.subfolder) {
      updated.subfolder = dolaNormalizeSubfolder(updated.subfolder);
    }
    dolaConfig = { ...dolaConfig, ...updated };
    dolaSaveState().then(() => {
      dolaUpdateBadge();
      sendResponse({ ok: true, config: dolaConfig });
    });
    return true;
  }

  if (message.type === 'CLEAR_HISTORY' || message.type === 'CLEAR_DOWNLOAD_HISTORY') {
    dolaDownloadHistory = [];
    dolaDownloadedKeys.clear();
    dolaSaveState().then(() => {
      dolaUpdateBadge();
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === 'OPEN_CLEANED_FOLDER' || message.type === 'OPEN_DOWNLOAD_FOLDER') {
    dolaOpenCleanedFolder().then(res => {
      sendResponse(res || { ok: true });
    });
    return true;
  }

  if (message.type === 'SHOW_DOWNLOAD_ITEM') {
    if (message.downloadId) {
      try {
        chrome.downloads.search({ id: Number(message.downloadId) }, (results) => {
          if (results && results.length > 0 && results[0].exists) {
            chrome.downloads.show(Number(message.downloadId));
            sendResponse({ ok: true });
          } else {
            dolaOpenCleanedFolder().then(res => sendResponse(res || { ok: true }));
          }
        });
        return true;
      } catch {
        dolaOpenCleanedFolder().then(res => sendResponse(res || { ok: true }));
        return true;
      }
    } else {
      dolaOpenCleanedFolder().then(res => sendResponse(res || { ok: true }));
      return true;
    }
  }

  if (message.type === 'TRIGGER_PAGE_SCAN_AND_DOWNLOAD') {
    (async () => {
      try {
        let activeTab = null;
        const dolaTabs = await chrome.tabs.query({ url: ['https://*.dola.com/*', 'https://*.doubao.com/*'] });
        if (dolaTabs && dolaTabs.length > 0) {
          activeTab = dolaTabs.find(t => t.active) || dolaTabs[0];
        } else {
          const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          activeTab = currentTab;
        }

        if (!activeTab || !activeTab.id) {
          return sendResponse({ ok: false, error: 'No active Dola AI tab found' });
        }

        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['extractor.js'],
          world: 'MAIN'
        }).catch(() => {});
        await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          files: ['content.js']
        }).catch(() => {});

        const scanRes = await chrome.tabs.sendMessage(activeTab.id, { type: 'SCAN_AND_DOWNLOAD_ACTIVE_TAB' });
        if (scanRes?.ok && scanRes.foundCount > 0) {
          sendResponse({ ok: true, downloadedCount: scanRes.foundCount, unwatermarked: scanRes.unwatermarked, url: scanRes.url });
        } else {
          sendResponse({ ok: false, downloadedCount: 0, message: scanRes?.message || 'No unwatermarked video detected on screen.' });
        }
      } catch (err) {
        sendResponse({ ok: false, error: err.message || String(err) });
      }
    })();
    return true;
  }
});

// Track tabs zoomed by sidepanel to restore 100% zoom on panel disconnect
const dolaZoomedTabs = new Map();

if (chrome.tabs && chrome.tabs.onRemoved) {
  chrome.tabs.onRemoved.addListener(tabId => {
    dolaZoomedTabs.delete(tabId);
  });
}

if (chrome.runtime && chrome.runtime.onConnect) {
  chrome.runtime.onConnect.addListener(port => {
    if (port.name === 'dola-sidepanel-port') {
      let activeSidepanelTabId = null;

      port.onMessage.addListener(async msg => {
        if (msg.type === 'SIDEPANEL_APPLY_ZOOM') {
          const { tabId, zoomLevel } = msg;
          if (tabId && chrome.tabs && chrome.tabs.setZoom) {
            try {
              activeSidepanelTabId = tabId;
              if (chrome.tabs.setZoomSettings) {
                await chrome.tabs.setZoomSettings(tabId, { scope: 'per-tab', mode: 'automatic' }).catch(() => {});
              }
              await chrome.tabs.setZoom(tabId, zoomLevel);
              dolaZoomedTabs.set(tabId, zoomLevel);
            } catch (e) {
              console.warn('[Dola Background] Error applying tab zoom:', e);
            }
          }
        } else if (msg.type === 'SIDEPANEL_RESET_ZOOM') {
          const { tabId } = msg;
          const targetId = tabId || activeSidepanelTabId;
          if (targetId && chrome.tabs && chrome.tabs.setZoom) {
            try {
              await chrome.tabs.setZoom(targetId, 1.0);
              dolaZoomedTabs.delete(targetId);
            } catch (e) {}
          }
        }
      });

      port.onDisconnect.addListener(async () => {
        console.log('[Dola Background] Sidepanel closed. Resetting zoom to 100% on tab:', activeSidepanelTabId);
        if (activeSidepanelTabId && chrome.tabs && chrome.tabs.setZoom) {
          try {
            await chrome.tabs.setZoom(activeSidepanelTabId, 1.0);
          } catch (e) {}
          dolaZoomedTabs.delete(activeSidepanelTabId);
        }
        for (const [tId] of dolaZoomedTabs) {
          try {
            if (chrome.tabs && chrome.tabs.setZoom) {
              await chrome.tabs.setZoom(tId, 1.0);
            }
          } catch (e) {}
        }
        dolaZoomedTabs.clear();
      });
    }
  });
}

// Enable native side panel to open on extension icon click
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.warn('[Dola SidePanel] setPanelBehavior error:', err));
}

// --- Native Chrome Right-Click Context Menu Support ---
// Registers context menu items so users can interact with Dola directly by right-clicking on pages, selections, and videos.
function dolaSetupContextMenus() {
  if (!chrome.contextMenus) return;

  // Clear existing items first to avoid duplicate ID conflicts on worker restart or reload
  chrome.contextMenus.removeAll(() => {
    // 1. Open the Dola Studio sidebar from any web page
    chrome.contextMenus.create({
      id: 'dola_open_sidepanel',
      title: 'Open Dola Studio Sidebar',
      contexts: ['page', 'action']
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Dola ContextMenu] Error creating open sidebar item:', chrome.runtime.lastError);
      }
    });

    // 2. Download the unwatermarked video currently visible on the active page
    chrome.contextMenus.create({
      id: 'dola_download_screen',
      title: 'Download Video on Screen (Watermark-Free)',
      contexts: ['page', 'video']
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Dola ContextMenu] Error creating download screen item:', chrome.runtime.lastError);
      }
    });

    // 3. Right-click selected text anywhere and append it directly to batch generation prompts
    chrome.contextMenus.create({
      id: 'dola_add_prompt',
      title: 'Add Selected Text to Dola Prompts',
      contexts: ['selection']
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Dola ContextMenu] Error creating add prompt item:', chrome.runtime.lastError);
      }
    });

    // 4. Right-click a video link to download it directly
    chrome.contextMenus.create({
      id: 'dola_download_link',
      title: 'Download Video from Link',
      contexts: ['link']
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[Dola ContextMenu] Error creating download link item:', chrome.runtime.lastError);
      }
    });
  });
}

// Handle context menu clicks across all contexts
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || !tab.id) return;

    // Action 1: Open Side Panel
    if (info.menuItemId === 'dola_open_sidepanel') {
      try {
        if (chrome.sidePanel && chrome.sidePanel.open) {
          if (tab.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
          } else {
            await chrome.sidePanel.open({ tabId: tab.id });
          }
        }
      } catch (err) {
        console.warn('[Dola ContextMenu] Failed to open side panel:', err);
      }
      return;
    }

    // Action 2: Trigger screen scan and download in active tab
    if (info.menuItemId === 'dola_download_screen') {
      try {
        chrome.tabs.sendMessage(tab.id, { type: 'SCAN_AND_DOWNLOAD_ACTIVE_TAB' }, (res) => {
          if (chrome.runtime.lastError) {
            console.warn('[Dola ContextMenu] Scan tab communication failed:', chrome.runtime.lastError.message);
          }
        });
      } catch (err) {
        console.warn('[Dola ContextMenu] Error sending download message to tab:', err);
      }
      return;
    }

    // Action 3: Add highlighted text to batch prompt draft
    if (info.menuItemId === 'dola_add_prompt' && info.selectionText) {
      try {
        const text = info.selectionText.trim();
        if (!text) return;

        // Retrieve existing draft from local storage
        const stored = await chrome.storage.local.get(['dola_batch_prompts_draft']);
        const current = stored.dola_batch_prompts_draft || '';
        // Separate multiple prompts by double newlines so the queue parser treats them cleanly
        const updated = current ? `${current}\n\n${text}` : text;
        await chrome.storage.local.set({ dola_batch_prompts_draft: updated });

        // Optional desktop notification confirming prompt addition
        if (dolaConfig.notifications) {
          try {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icon128.png',
              title: 'Added to Dola Prompts',
              message: text.length > 50 ? `${text.substring(0, 50)}...` : text,
              priority: 1
            });
          } catch {}
        }

        // Open side panel automatically so user can inspect or run the queue
        if (chrome.sidePanel && chrome.sidePanel.open) {
          if (tab.windowId) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
          } else {
            await chrome.sidePanel.open({ tabId: tab.id });
          }
        }
      } catch (err) {
        console.warn('[Dola ContextMenu] Failed to add prompt from selection:', err);
      }
      return;
    }

    // Action 4: Download video link directly
    if (info.menuItemId === 'dola_download_link' && info.linkUrl) {
      try {
        await dolaHandleAutoDownload({
          url: info.linkUrl,
          prompt: 'Context Menu Video Link',
          source: 'context_menu'
        }, true);
      } catch (err) {
        console.warn('[Dola ContextMenu] Failed to download video from link:', err);
      }
      return;
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await dolaLoadState();
  dolaUpdateBadge();
  dolaAutoInjectIntoExistingTabs();
  ensureOffscreenDocument().catch(() => {});
  dolaSetupContextMenus();
});

chrome.runtime.onStartup.addListener(async () => {
  await dolaLoadState();
  dolaUpdateBadge();
  dolaAutoInjectIntoExistingTabs();
  ensureOffscreenDocument().catch(() => {});
  dolaSetupContextMenus();
});

dolaLoadState().then(() => {
  dolaAutoInjectIntoExistingTabs();
  ensureOffscreenDocument().catch(() => {});
  dolaSetupContextMenus();
});
