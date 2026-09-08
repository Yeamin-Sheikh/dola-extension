/**
 * Dola AI Video Watermark Remover — Content Script (Isolated World)
 * Connects MAIN-world extractor (extractor.js) to background.js for 100% Watermark-Free raw downloads.
 */
(() => {
  'use strict';

  if (window.__DOLA_CONTENT_SCRIPT_INITIALIZED__) {
    console.log('[Dola Downloader Bridge] Content script already active in this tab.');
    return;
  }
  window.__DOLA_CONTENT_SCRIPT_INITIALIZED__ = true;

  console.log('[Dola Downloader Bridge] Content script active on:', window.location.href);

  const downloadedMediaKeys = new Set();
  let latestExtractedVideos = [];
  let currentActiveAutomationPrompt = '';
  const recentPromptsHistory = [];

  function cleanPromptText(str) {
    return String(str || '')
      .replace(/^(9:16 vertical portrait|16:9 widescreen landscape|raw prompt):\s*/i, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function findPromptInChatDom(targetEl) {
    try {
      if (!targetEl) return '';
      const messageTurn = targetEl.closest(
        'li, [data-message-id], [class*="message-item"], [class*="messageItem"], [class*="chat-item"], [class*="chat-message"], [class*="bubble"], article, section'
      );
      if (!messageTurn) return '';

      let prevTurn = messageTurn.previousElementSibling;
      while (prevTurn) {
        const userText = (prevTurn.textContent || '').trim();
        if (userText && userText.length > 3 && !/download\s*video/i.test(userText)) {
          const clean = cleanPromptText(userText);
          if (clean) return clean;
        }
        prevTurn = prevTurn.previousElementSibling;
      }
    } catch {}
    return '';
  }

  function showDownloadToast(title, resolution = '1080p Raw') {
    try {
      const existing = document.getElementById('dola-auto-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'dola-auto-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 9999999;
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.12);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 1px 3px rgba(0, 0, 0, 0.05);
        color: #09090b;
        padding: 12px 16px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        animation: dolaSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
      `;

      toast.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <div style="color: #09090b; font-weight: 600; font-size: 12px; display: flex; align-items: center; gap: 8px;">
            <span>Watermark-Free Video Downloaded</span>
            <span style="color: #059669; font-size: 11px; font-weight: 600;">${escapeHtml(resolution)}</span>
          </div>
          <span style="color: #71717a; font-size: 11px; max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(title || 'Saved to Downloads folder')}</span>
        </div>
      `;

      if (!document.getElementById('dola-toast-style')) {
        const style = document.createElement('style');
        style.id = 'dola-toast-style';
        style.textContent = `
          @keyframes dolaSlideIn {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    } catch {}
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function isContextValid() {
    try {
      return Boolean(typeof chrome !== 'undefined' && chrome?.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function dolaExtractCanonicalKey(url, vid) {
    if (vid && !String(vid).startsWith('http')) return String(vid).trim();
    const clean = String(url || '').trim();
    const tosMatch = clean.match(/\/tos-[^/?#]+\/[^/?#]+/i);
    if (tosMatch) return tosMatch[0].toLowerCase();
    return clean.split('?')[0].toLowerCase();
  }

  // Load existing downloaded canonical keys from chrome.storage.local
  try {
    if (isContextValid()) {
      chrome.storage.local.get(['dola_downloaded_keys'], res => {
        if (res && Array.isArray(res.dola_downloaded_keys)) {
          for (const k of res.dola_downloaded_keys) {
            downloadedMediaKeys.add(k);
          }
        }
      });
    }
  } catch {}

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.dola_downloaded_keys?.newValue) {
          for (const k of changes.dola_downloaded_keys.newValue) {
            downloadedMediaKeys.add(k);
          }
        }
      });
    } catch {}
  }

  let isContextTornDown = false;
  function handleContextInvalidated() {
    if (isContextTornDown) return;
    isContextTornDown = true;
    try {
      if (domObserver) domObserver.disconnect();
    } catch {}
    try {
      window.removeEventListener('DOLA_VIDEO_EXTRACTED', onVideoExtracted);
      window.removeEventListener('DOLA_USER_PROMPT_SUBMITTED', onUserPromptSubmitted);
    } catch {}
  }
  window.__DOLA_CONTENT_SCRIPT_CLEANUP__ = handleContextInvalidated;

  function triggerDownload(video, force = false) {
    if (!video || !video.url) return;

    // Silent exit and teardown if extension was reloaded or updated
    if (!isContextValid()) {
      handleContextInvalidated();
      return;
    }

    const cleanUrl = String(video.url).trim();
    if (!cleanUrl.startsWith('http')) return;

    const canonicalKey = dolaExtractCanonicalKey(cleanUrl, video.vid);
    const mediaKey = String(video.vid || cleanUrl);
    if (!force) {
      if (
        downloadedMediaKeys.has(canonicalKey) ||
        downloadedMediaKeys.has(mediaKey) ||
        downloadedMediaKeys.has(cleanUrl)
      ) {
        return;
      }
    }
    downloadedMediaKeys.add(canonicalKey);
    downloadedMediaKeys.add(mediaKey);
    downloadedMediaKeys.add(cleanUrl);

    let resolvedPrompt = cleanPromptText(video.prompt || video.title || '');
    if (!resolvedPrompt || resolvedPrompt === 'Dola Video' || /download\s*video/i.test(resolvedPrompt)) {
      if (currentActiveAutomationPrompt) {
        resolvedPrompt = currentActiveAutomationPrompt;
      } else if (recentPromptsHistory.length > 0) {
        const recent = recentPromptsHistory[recentPromptsHistory.length - 1];
        if (Date.now() - recent.time < 180000) {
          resolvedPrompt = recent.prompt;
        }
      }
    }
    resolvedPrompt = cleanPromptText(resolvedPrompt) || 'Dola Video';
    const isDynamic = Boolean(video.watermarkType === 'dynamic' || cleanUrl.includes('video_gen_watermark_dyn') || cleanUrl.includes('video_gen_watermark'));
    const watermarkType = isDynamic ? 'dynamic' : (video.watermarkType || 'none');
    const toastLabel = isDynamic ? 'Dynamic Watermark' : '1080p Master (Raw)';

    try {
      if (!isContextValid()) {
        handleContextInvalidated();
        return;
      }
      chrome.runtime.sendMessage({
        type: 'AUTO_DOWNLOAD_VIDEO',
        force,
        video: {
          ...video,
          url: cleanUrl,
          pageUrl: window.location.href,
          prompt: resolvedPrompt,
          watermarkType
        }
      }, response => {
        if (!isContextValid() || chrome.runtime.lastError) {
          return;
        }
        if (response?.ok && response?.downloaded && response?.notifications) {
          showDownloadToast(resolvedPrompt, toastLabel);
        }
      });
    } catch (err) {
      if (!isContextValid() || err?.message?.includes('context invalidated')) {
        handleContextInvalidated();
        return;
      }
    }
  }

  function requestMainWorldMedia(timeoutMs = 1500) {
    return new Promise(resolve => {
      let settled = false;
      const onResponse = event => {
        if (settled) return;
        settled = true;
        window.removeEventListener('DOLA_CHAT_MEDIA_RESPONSE', onResponse);
        const videos = event?.detail?.videos || [];
        latestExtractedVideos = videos;
        resolve(videos);
      };
      window.addEventListener('DOLA_CHAT_MEDIA_RESPONSE', onResponse, { once: true });
      window.dispatchEvent(new CustomEvent('DOLA_GET_CHAT_MEDIA'));
      setTimeout(() => {
        if (!settled) {
          settled = true;
          window.removeEventListener('DOLA_CHAT_MEDIA_RESPONSE', onResponse);
          resolve(latestExtractedVideos);
        }
      }, timeoutMs);
    });
  }

  // 1. Listen for new unwatermarked video extractions from extractor.js
  const onVideoExtracted = event => {
    try {
      if (!isContextValid()) {
        handleContextInvalidated();
        return;
      }
      const video = event.detail;
      if (video && video.url) {
        console.log('[Dola Downloader Bridge] Captured unwatermarked video stream:', video);
        triggerDownload(video);
      }
    } catch (e) {
      if (!isContextValid() || e?.message?.includes('context invalidated')) {
        handleContextInvalidated();
      }
    }
  };

  // Listen for user prompts submitted either manually or via queue
  const onUserPromptSubmitted = event => {
    try {
      if (!isContextValid()) {
        handleContextInvalidated();
        return;
      }
      const prompt = event?.detail?.prompt;
      if (prompt && typeof prompt === 'string') {
        const clean = cleanPromptText(prompt);
        if (clean) {
          recentPromptsHistory.push({ prompt: clean, time: Date.now() });
          if (recentPromptsHistory.length > 30) recentPromptsHistory.shift();
        }
      }
    } catch (e) {
      if (!isContextValid() || e?.message?.includes('context invalidated')) {
        handleContextInvalidated();
      }
    }
  };

  window.addEventListener('DOLA_VIDEO_EXTRACTED', onVideoExtracted);
  window.addEventListener('DOLA_USER_PROMPT_SUBMITTED', onUserPromptSubmitted);

  // --- 1b. Chat DOM Scanner for Markdown [Download Video] Links ---
  function extractTitleForLink(linkEl) {
    try {
      // 1. Check preceding text in same paragraph or container
      const parent = linkEl.closest('p, div, li, blockquote');
      if (parent) {
        let prevText = '';
        let curr = linkEl.previousSibling;
        while (curr) {
          prevText = (curr.textContent || '') + ' ' + prevText;
          curr = curr.previousSibling;
        }
        const cleanPrev = cleanPromptText(prevText);
        if (cleanPrev && cleanPrev.length > 3 && !/download\s*video/i.test(cleanPrev)) {
          return cleanPrev.replace(/^[✅🎬▶️\s—\-]+/, '').trim();
        }

        // Check previous sibling element of parent
        let prevEl = parent.previousElementSibling;
        while (prevEl) {
          const t = cleanPromptText(prevEl.textContent || '');
          if (t && t.length > 3 && !/download\s*video/i.test(t)) {
            return t.replace(/^[✅🎬▶️\s—\-]+/, '').trim();
          }
          prevEl = prevEl.previousElementSibling;
        }
      }

      // 2. Check closest message card or block
      const card = linkEl.closest('li, [class*="message"], article');
      if (card) {
        const header = card.querySelector('h1, h2, h3, h4, h5, h6, strong, b');
        if (header && header.textContent.trim()) {
          const hText = cleanPromptText(header.textContent);
          if (hText.length > 3 && !/download\s*video/i.test(hText)) {
            return hText.replace(/^[✅🎬▶️\s—\-]+/, '').trim();
          }
        }
      }

      // 3. Trace back to preceding user message in chat DOM
      const domPrompt = findPromptInChatDom(linkEl);
      if (domPrompt) {
        return domPrompt;
      }
    } catch {}

    if (currentActiveAutomationPrompt) {
      return currentActiveAutomationPrompt;
    }

    if (recentPromptsHistory.length > 0) {
      const recent = recentPromptsHistory[recentPromptsHistory.length - 1];
      if (Date.now() - recent.time < 180000) {
        return recent.prompt;
      }
    }

    return 'Dola Video';
  }

  function scanDomForDownloadLinks() {
    if (!isContextValid()) {
      handleContextInvalidated();
      return [];
    }
    const found = [];
    try {
      const anchors = document.querySelectorAll('a[href]:not([data-dola-processed])');
      for (const a of anchors) {
        const href = a.getAttribute('href') || '';
        if (!href.startsWith('http')) continue;

        const isVideoLink =
          href.includes('/video/tos/') ||
          href.includes('mime_type=video_mp4') ||
          href.includes('tos-mya-ve-') ||
          ((href.includes('dola.dola.com') || href.includes('dola.com')) && href.includes('download=true')) ||
          /download\s*video/i.test((a.textContent || '').trim());

        if (!isVideoLink) continue;

        a.setAttribute('data-dola-processed', 'true');

        const isDynamic = href.includes('lr=video_gen_watermark_dyn') || href.includes('video_gen_watermark');
        const title = extractTitleForLink(a);
        const video = {
          url: href,
          vid: href,
          title,
          prompt: title,
          watermarkType: isDynamic ? 'dynamic' : 'none',
          definition: isDynamic ? 'Dynamic Watermark' : '1080P Raw',
          source: 'dom_download_link',
          timestamp: Date.now()
        };

        found.push(video);
        triggerDownload(video);
      }
    } catch (e) {
      if (!isContextValid() || e?.message?.includes('context invalidated')) {
        handleContextInvalidated();
      }
    }
    return found;
  }

  // Continuously observe DOM changes for newly arrived chat download links
  let domScanTimeout = null;
  const domObserver = new MutationObserver(() => {
    if (domScanTimeout) clearTimeout(domScanTimeout);
    domScanTimeout = setTimeout(() => {
      scanDomForDownloadLinks();
    }, 600);
  });

  if (document.body) {
    domObserver.observe(document.body, { childList: true, subtree: true });
    // Initial scan
    setTimeout(scanDomForDownloadLinks, 1000);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      domObserver.observe(document.body, { childList: true, subtree: true });
      setTimeout(scanDomForDownloadLinks, 1000);
    });
  }

  // --- 2. Automated Generation Sequence Controller ---
  let isQueueRunning = false;
  let shouldStopQueue = false;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function reportQueueProgress(state) {
    try {
      chrome.runtime.sendMessage({
        type: 'QUEUE_PROGRESS_UPDATE',
        state: {
          isRunning: isQueueRunning,
          ...state
        }
      }).catch(() => {});
    } catch {}
  }

  function getAssistantMessages() {
    const items = Array.from(document.querySelectorAll('.inner-item-BjaxFt, .my-0.w-full'));
    const assistantItems = items.filter(it => !it.querySelector('[class*="send-msg-bubble"]'));
    return assistantItems.map(it => it.innerText.trim()).filter(Boolean);
  }

  function getLatestAssistantMessage() {
    const messages = getAssistantMessages();
    return messages.length > 0 ? messages[messages.length - 1] : '';
  }

  function verifyAiResponse({ preCount, preText, actionName = 'response', timeoutMs = 30000 }) {
    return new Promise(async (resolve) => {
      let settled = false;
      let streamEnded = false;

      const onStreamEnd = () => {
        streamEnded = true;
      };
      window.addEventListener('DOLA_STREAM_END', onStreamEnd, { once: true });

      const startTime = Date.now();

      const finish = (result) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('DOLA_STREAM_END', onStreamEnd);
        resolve(result);
      };

      while (Date.now() - startTime < timeoutMs) {
        if (shouldStopQueue) {
          finish({ ok: false, error: 'Queue stopped by user.' });
          return;
        }

        const breakBtn = document.querySelector('.break-btn-fISNgC');
        const isGenerating = Boolean(breakBtn);

        const currentMessages = getAssistantMessages();
        const currentCount = currentMessages.length;
        const latestText = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : '';

        const hasNewResponse = (currentCount > preCount) || (latestText && latestText !== preText);

        if (hasNewResponse && latestText.length > 0) {
          const lower = latestText.toLowerCase();
          const isError = lower.includes('network error') ||
                          lower.includes('rate limit') ||
                          lower.includes('too many requests') ||
                          lower.includes('failed to generate') ||
                          lower.includes('please try again') ||
                          lower.includes('service unavailable') ||
                          lower.includes('something went wrong');

          if (isError) {
            finish({
              ok: false,
              error: `Dola AI returned an error during ${actionName}: "${latestText.slice(0, 100)}"`
            });
            return;
          }

          // If stream finished or break button disappeared, AI completed its reply
          if (streamEnded || !isGenerating) {
            await sleep(600);
            const finalText = getLatestAssistantMessage() || latestText;
            const snippet = finalText.replace(/\s+/g, ' ').slice(0, 65);
            finish({
              ok: true,
              snippet: snippet + (finalText.length > 65 ? '...' : '')
            });
            return;
          } else {
            reportQueueProgress({
              title: `Dola is replying to ${actionName}...`,
              detail: `Live response: "${latestText.replace(/\s+/g, ' ').slice(0, 45)}..."`
            });
          }
        }

        await sleep(400);
      }

      finish({
        ok: false,
        error: `AI did not respond properly to ${actionName} within ${Math.round(timeoutMs / 1000)} seconds. Stopping workflow.`
      });
    });
  }

  function waitForStreamEnd(timeoutMs = 28000) {
    return new Promise(resolve => {
      let settled = false;

      const onEnd = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(true);
      };

      const cleanup = () => {
        window.removeEventListener('DOLA_STREAM_END', onEnd);
        clearTimeout(timer);
      };

      window.addEventListener('DOLA_STREAM_END', onEnd, { once: true });

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(false);
        }
      }, timeoutMs);
    });
  }

  /**
   * Automation Queue State Machine Coordinator
   * Manages end-to-end execution of unattended multi-prompt batch video generation workflows.
   * Enforces sequential progression across discrete operational states:
   * 
   * State 0 (Initialization & Zoom Management):
   * Enforces exclusive lock (`isQueueRunning`), sets cancellation sentinel, and optionally
   * adjusts viewport CSS zoom factor to optimize layout density.
   * 
   * State 1 (Optional Route Transition):
   * Triggers SPA navigation to a pristine conversation context via `DOLA_CLICK_NEW_CHAT`
   * and blocks on DOM polling until the Tiptap ProseMirror editor element mounts.
   * 
   * State 2 (Pre-Flight Agreement Injection):
   * Dispatches the `bypassPrompt` payload to prime the model's system-level response policies
   * for non-interactive sequential generation, using DOM message count polling for verification.
   * 
   * State 3 (Batch Prompt Dispatch & Stream Interception):
   * Prepares prompt payload (applying aspect ratio prefixes or passing raw markdown blocks verbatim),
   * updates prompt history ring buffer for filename mapping, triggers `/generate video` batch injection,
   * and delegates to network stream sniffers and DOM observers for artifact capture.
   * 
   * @param {Object} options - Queue configuration payload.
   * @param {string[]} options.prompts - Normalized array of video prompt strings.
   * @param {string} options.aspectRatio - Selected aspect ratio mode ('9:16', '16:9', 'raw').
   * @param {boolean} options.newChatPerBatch - Whether to invoke fresh chat navigation.
   * @param {boolean} options.autoZoom - Viewport zoom active flag.
   * @param {number} options.zoomLevel - Float zoom scale factor (default: 0.80).
   * @param {string} options.bypassPrompt - Unattended batch instruction text.
   * @returns {Promise<{ok: boolean, error?: string}>} Execution outcome.
   */
  async function executeAutomationQueue({ prompts, aspectRatio, newChatPerBatch, autoZoom, zoomAppliedViaTabsApi, zoomLevel, bypassPrompt }) {
    if (isQueueRunning) {
      return { ok: false, error: 'A queue is already running.' };
    }

    isQueueRunning = true;
    shouldStopQueue = false;

    // Optional page auto-zoom fallback (only if chrome.tabs.setZoom was not already applied)
    if (autoZoom && !zoomAppliedViaTabsApi) {
      try {
        const factor = parseFloat(zoomLevel) || 0.8;
        document.body.style.zoom = String(factor);
      } catch {}
    }

    const validPrompts = (prompts || []).map(p => p.trim()).filter(Boolean);
    const totalSteps = (newChatPerBatch ? 1 : 0) + 2;
    let currentStep = 0;

    try {
      // Step 1: Optional New Chat
      if (newChatPerBatch) {
        currentStep++;
        reportQueueProgress({
          title: 'Opening new chat...',
          detail: 'Navigating to fresh chat on Dola',
          currentStep,
          totalSteps
        });
        window.dispatchEvent(new CustomEvent('DOLA_CLICK_NEW_CHAT'));
        await sleep(2500);

        // Wait for editor element to mount in the new chat
        const editorStart = Date.now();
        while (Date.now() - editorStart < 6000) {
          if (document.querySelector('.tiptap.ProseMirror') || document.querySelector('div[contenteditable="true"]')) {
            break;
          }
          await sleep(200);
        }
        await sleep(400);
      }

      if (shouldStopQueue) throw new Error('Queue stopped by user.');

      // Short delay before sending bypass agreement instructions
      await sleep(500);

      // Step 2: Send Bypass Agreement Instruction (only pre-flight message)
      currentStep++;
      reportQueueProgress({
        title: 'Sending batch agreement instructions...',
        detail: 'Setting unattended multi-video generation mode',
        currentStep,
        totalSteps
      });

      const preBypassCount = getAssistantMessages().length;
      const preBypassText = getLatestAssistantMessage();

      window.dispatchEvent(new CustomEvent('DOLA_INJECT_AND_SEND', {
        detail: { text: bypassPrompt }
      }));

      // Verify that Dola acknowledged the bypass instruction, but do not fatal-halt if slow
      const bypassCheck = await verifyAiResponse({
        preCount: preBypassCount,
        preText: preBypassText,
        actionName: 'batch agreement instructions',
        timeoutMs: 22000
      });

      if (bypassCheck.ok) {
        reportQueueProgress({
          title: 'Batch instructions acknowledged',
          detail: `Dola confirmed: "${bypassCheck.snippet}"`,
          currentStep,
          totalSteps
        });
        await sleep(1500);
      } else {
        console.warn('[Dola Content] Bypass response unverified, proceeding to prompt dispatch:', bypassCheck.error);
        reportQueueProgress({
          title: 'Batch instructions delivered',
          detail: 'Proceeding directly to video prompt injection',
          currentStep,
          totalSteps
        });
        await sleep(800);
      }

      if (shouldStopQueue) throw new Error('Queue stopped by user.');

      // Short delay before preparing and typing batch prompts
      await sleep(800);

      // Step 4: Send All Prompts Simultaneously with /generate video
      currentStep++;
      for (const p of validPrompts) {
        recentPromptsHistory.push({ prompt: p, time: Date.now() });
      }
      if (recentPromptsHistory.length > 50) {
        recentPromptsHistory.splice(0, recentPromptsHistory.length - 50);
      }

      let formattedPromptsBlock = '';
      if (aspectRatio === 'raw') {
        // Raw mode: zero modifications, no aspect ratio prefixes, no sequential numbering added
        formattedPromptsBlock = validPrompts.join('\n\n');
      } else {
        formattedPromptsBlock = validPrompts.map((p, idx) => {
          let text = p;
          if (aspectRatio === '9:16' && !text.toLowerCase().startsWith('9:16')) {
            text = `9:16 vertical portrait: ${text}`;
          } else if (aspectRatio === '16:9' && !text.toLowerCase().startsWith('16:9')) {
            text = `16:9 widescreen landscape: ${text}`;
          }
          if (validPrompts.length > 1 && !/^\d+\.\s*/.test(text)) {
            text = `${idx + 1}. ${text}`;
          }
          return text;
        }).join('\n\n');
      }

      reportQueueProgress({
        title: 'Sending all prompts via /generate video...',
        detail: `Dispatching ${validPrompts.length} prompts simultaneously`,
        currentStep,
        totalSteps
      });

      window.dispatchEvent(new CustomEvent('DOLA_INJECT_AND_SEND_BATCH', {
        detail: {
          promptsBlock: formattedPromptsBlock,
          promptsList: validPrompts,
          useSlashGenerateVideo: true
        }
      }));

      // Monitor Dola generation and capture downloads
      await waitForStreamEnd(90000);
      await sleep(2000);
      scanDomForDownloadLinks();

      reportQueueProgress({
        title: 'Batch generation finished',
        detail: `Submitted all ${validPrompts.length} prompts via /generate video.`,
        currentStep: totalSteps,
        totalSteps,
        done: true
      });

      return { ok: true };
    } catch (err) {
      reportQueueProgress({
        title: 'Queue stopped',
        detail: err.message || 'Operation ended.',
        currentStep,
        totalSteps,
        stopped: true
      });
      return { ok: false, error: err.message };
    } finally {
      isQueueRunning = false;
      shouldStopQueue = false;
      if (autoZoom && !zoomAppliedViaTabsApi) {
        try {
          document.body.style.zoom = '';
        } catch {}
      }
      setTimeout(() => {
        if (!isQueueRunning) {
          currentActiveAutomationPrompt = '';
        }
      }, 5000);
    }
  }

  // --- 3. Runtime Message Listener ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'SCAN_AND_DOWNLOAD_ACTIVE_TAB') {
      (async () => {
        try {
          const domVideos = scanDomForDownloadLinks();
          const mainWorldVideos = await requestMainWorldMedia(1200);
          const allVideos = [...(mainWorldVideos || []), ...domVideos].filter(v => v && v.url);

          if (allVideos.length > 0) {
            const target = allVideos[allVideos.length - 1];
            triggerDownload(target, true);
            sendResponse({ ok: true, foundCount: allVideos.length, unwatermarked: true, url: target.url });
            return;
          }

          sendResponse({ ok: false, foundCount: 0, message: 'No video or download link detected on screen.' });
        } catch (err) {
          sendResponse({ ok: false, error: err.message || String(err) });
        }
      })();
      return true;
    }

    if (message?.type === 'START_AUTOMATION_QUEUE') {
      executeAutomationQueue(message.payload || {}).then(sendResponse);
      return true;
    }

    if (message?.type === 'PASTE_PROMPTS_TO_INPUT') {
      (async () => {
        try {
          const { prompts, rawContent, aspectRatio, useSlashGenerateVideo } = message.payload || {};
          const isRawMode = aspectRatio === 'raw';

          let formattedPromptsBlock = '';
          const validPrompts = (prompts || []).map(p => p.trim()).filter(Boolean);

          if (isRawMode && rawContent) {
            // Verbatim raw content from textarea: zero modifications, zero added text or numbers
            formattedPromptsBlock = rawContent;
          } else if (isRawMode) {
            formattedPromptsBlock = validPrompts.join('\n\n');
          } else {
            if (validPrompts.length === 0) {
              sendResponse({ ok: false, error: 'No valid prompts provided' });
              return;
            }

            formattedPromptsBlock = validPrompts.map((p, idx) => {
              let text = p;
              if (aspectRatio === '9:16' && !text.toLowerCase().startsWith('9:16')) {
                text = `9:16 vertical portrait: ${text}`;
              } else if (aspectRatio === '16:9' && !text.toLowerCase().startsWith('16:9')) {
                text = `16:9 widescreen landscape: ${text}`;
              }
              if (validPrompts.length > 1 && !/^\d+\.\s*/.test(text)) {
                text = `${idx + 1}. ${text}`;
              }
              return text;
            }).join('\n\n');
          }

          if (!formattedPromptsBlock.trim()) {
            sendResponse({ ok: false, error: 'No valid prompts provided' });
            return;
          }

          // Record in prompt history for download filename matching
          for (const p of validPrompts.length > 0 ? validPrompts : [formattedPromptsBlock]) {
            recentPromptsHistory.push({ prompt: p, time: Date.now() });
          }
          if (recentPromptsHistory.length > 50) {
            recentPromptsHistory.splice(0, recentPromptsHistory.length - 50);
          }

          let replied = false;
          const onResult = (e) => {
            if (replied) return;
            replied = true;
            window.removeEventListener('DOLA_PASTE_PROMPTS_RESULT', onResult);
            sendResponse(e?.detail || { ok: true, count: validPrompts.length || 1 });
          };
          window.addEventListener('DOLA_PASTE_PROMPTS_RESULT', onResult, { once: true });

          window.dispatchEvent(new CustomEvent('DOLA_PASTE_PROMPTS_ONLY', {
            detail: {
              promptsBlock: formattedPromptsBlock,
              promptsList: validPrompts.length > 0 ? validPrompts : [formattedPromptsBlock],
              useSlashGenerateVideo: useSlashGenerateVideo === true,
              isBatch: false
            }
          }));

          // Fallback timeout in case event response is delayed
          setTimeout(() => {
            if (!replied) {
              replied = true;
              window.removeEventListener('DOLA_PASTE_PROMPTS_RESULT', onResult);
              sendResponse({ ok: true, count: validPrompts.length });
            }
          }, 3500);
        } catch (err) {
          sendResponse({ ok: false, error: err.message || String(err) });
        }
      })();
      return true;
    }

    if (message?.type === 'STOP_AUTOMATION_QUEUE') {
      shouldStopQueue = true;
      sendResponse({ ok: true, message: 'Stopping queue' });
      return false;
    }

    if (message?.type === 'GET_QUEUE_STATE') {
      sendResponse({ ok: true, isRunning: isQueueRunning });
      return false;
    }
  });

})();
