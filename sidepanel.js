/**
 * Dola AI Video Studio — Side Panel Controller
 * High-performance, obsidian glass sidebar interface.
 * Manages Generation queue, custom greetings, bypass instructions,
 * page auto-zoom, and direct in-memory blob unwatermarked downloads.
 */
(() => {
  'use strict';

  const DEFAULT_BYPASS_PROMPT =
    "I'll be away from home and unavailable for the next few hours due to some commitments, " +
    "so I'm giving you all the prompts in advance. Please create videos for every prompt I send, " +
    "with each video being approximately 15 seconds long, depending on the prompt. Do not ask me " +
    "any questions or wait for my confirmation at any stage. If any prompt or video encounters " +
    "a violation, generation issue, or any other problem, simply skip that particular one and " +
    "continue with the remaining prompts. Keep processing and generating the videos one after another " +
    "without stopping or requesting additional instructions, as I will not be available to respond during this time.";

  // DOM Elements: Navigation
  const tabBtnGen = document.getElementById('tab-btn-generation');
  const tabBtnSettings = document.getElementById('tab-btn-settings');
  const sectionGen = document.getElementById('section-generation');
  const sectionSettings = document.getElementById('section-settings');

  // DOM Elements: Generation Section
  const batchPromptsInput = document.getElementById('batch-prompts-input');
  const promptCountBadge = document.getElementById('prompt-count-badge');
  const btnClearPrompts = document.getElementById('btn-clear-prompts');
  const btnPasteToChat = document.getElementById('btn-paste-to-chat');
  const btnPasteToChatText = document.getElementById('btn-paste-to-chat-text');
  const ratioButtons = document.querySelectorAll('.ratio-btn');
  const btnStartQueue = document.getElementById('btn-start-queue');
  const btnStartQueueText = document.getElementById('btn-start-queue-text');
  const btnStopQueue = document.getElementById('btn-stop-queue');
  const queueStatusCard = document.getElementById('queue-status-card');
  const queueStatusTitle = document.getElementById('queue-status-title');
  const queueStatusDetail = document.getElementById('queue-status-detail');
  const queueProgressBar = document.getElementById('queue-progress-bar');
  const btnDownloadScreen = document.getElementById('btn-download-screen');
  const btnDownloadScreenText = document.getElementById('btn-download-screen-text');
  const historyList = document.getElementById('dola-history-list');
  const historyCount = document.getElementById('dola-history-count');
  const clearHistoryBtn = document.getElementById('btn-dola-clear-history');
  const btnToggleManualImport = document.getElementById('btn-toggle-manual-import');
  const manualImportDrawer = document.getElementById('manual-import-drawer');
  const manualLinksInput = document.getElementById('manual-links-input');
  const btnRunManualImport = document.getElementById('btn-run-manual-import');
  const manualImportStatus = document.getElementById('manual-import-status');

  // DOM Elements: Cleaner Queue Card
  const cleanerQueueContainer = document.getElementById('dola-cleaner-queue-container');
  const cleanerQueueStatusLabel = document.getElementById('cleaner-queue-status-label');
  const cleanerQueueCountBadge = document.getElementById('cleaner-queue-count-badge');
  const cleanerQueueActiveTitle = document.getElementById('cleaner-queue-active-title');
  const cleanerQueueProgressBar = document.getElementById('cleaner-queue-progress-bar');
  const cleanerQueueProgressPercent = document.getElementById('cleaner-queue-progress-percent');

  // DOM Elements: Settings Section
  const settingNewChatToggle = document.getElementById('setting-new-chat-toggle');
  const settingAutoZoomToggle = document.getElementById('setting-auto-zoom-toggle');
  const settingZoomLevelSelect = document.getElementById('setting-zoom-level-select');
  const currentZoomPill = document.getElementById('current-zoom-pill');
  const settingBypassInput = document.getElementById('setting-bypass-input');
  const btnResetBypass = document.getElementById('btn-reset-bypass');
  const autoDownloadToggle = document.getElementById('dola-auto-download-toggle');
  const subfolderInput = document.getElementById('dola-subfolder-input');
  const saveFolderBtn = document.getElementById('btn-dola-save-folder');
  const settingNotificationsToggle = document.getElementById('setting-notifications-toggle');

  // DOM Elements: Context Menu
  const contextMenu = document.getElementById('sidebar-context-menu');
  let activeContextTarget = null;
  let activeSelectedText = '';

  // Local State
  let currentSettings = {
    newChatPerBatch: true,
    autoZoomOnBatch: true,
    zoomLevel: 0.80,
    bypassPrompt: DEFAULT_BYPASS_PROMPT,
    aspectRatio: 'raw',
    activeTab: 'generation',
    subfolder: 'Dola_Videos',
    autoDownload: true,
    notifications: false
  };

  // Safe Chrome API Wrappers
  const safeStorage = {
    get: (keys) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        return chrome.storage.local.get(keys);
      }
      return Promise.resolve({});
    },
    set: (data) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        return chrome.storage.local.set(data).catch(() => {});
      }
      return Promise.resolve();
    },
    remove: (keys) => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        return chrome.storage.local.remove(keys).catch(() => {});
      }
      return Promise.resolve();
    }
  };

  const safeRuntime = {
    sendMessage: (msg, cb) => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(msg, (res) => {
          if (typeof cb === 'function') {
            cb(chrome.runtime.lastError ? { ok: false, error: chrome.runtime.lastError.message } : res);
          }
        });
      } else if (typeof cb === 'function') {
        cb({ ok: false, error: 'Extension runtime unavailable' });
      }
    }
  };

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function formatTime(timestamp) {
    if (!timestamp) return '';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  // --- 1. Tab Switching ---
  function switchTab(tabName) {
    if (tabName === 'settings') {
      tabBtnSettings.classList.add('active');
      tabBtnSettings.setAttribute('aria-selected', 'true');
      tabBtnGen.classList.remove('active');
      tabBtnGen.setAttribute('aria-selected', 'false');
      sectionSettings.classList.add('active');
      sectionGen.classList.remove('active');
    } else {
      tabBtnGen.classList.add('active');
      tabBtnGen.setAttribute('aria-selected', 'true');
      tabBtnSettings.classList.remove('active');
      tabBtnSettings.setAttribute('aria-selected', 'false');
      sectionGen.classList.add('active');
      sectionSettings.classList.remove('active');
    }
    currentSettings.activeTab = tabName;
    safeStorage.set({ dola_sidebar_active_tab: tabName });
  }

  tabBtnGen.addEventListener('click', () => switchTab('generation'));
  tabBtnSettings.addEventListener('click', () => switchTab('settings'));

  // --- 2. Prompt Counting & Batch Textarea ---
  function cleanPromptPrefix(str) {
    return String(str || '')
      .replace(/^\s*(?:(?:prompt|video|scene|topic|clip)\s*#?\d*[:.-]?\s*)/i, '')
      .trim();
  }

  /**
   * Multi-Format Video Prompt Parser & Lexical Tokenizer
   * Evaluates input buffer text through a prioritized grammatical hierarchy to resolve
   * discrete video generation prompt boundaries without corrupting internal markdown structure:
   * 
   * Pre-Condition: Normalizes carriage returns (`\r\n` / `\r` -> `\n`) and applies trimming.
   * 
   * Hierarchy Level 1 (Explicit Thematic Breaks / Dividers):
   * Tests for markdown horizontal rule markers (`---`, `===`, `___`, `***`).
   * When matched, segments the text along divider boundaries. If `isRawMode` is active,
   * returns sliced chunks verbatim with zero alteration of whitespace, bullets, or headers.
   * 
   * Hierarchy Level 2 (Raw Mode Cohesion):
   * When `isRawMode` is active and no thematic dividers exist, enforces atomic cohesion:
   * Returns `[raw]` as a single multi-paragraph prompt, ensuring complex multi-shot production
   * specifications (e.g. Seedance 2.5 / Sora camera scripts) remain structurally unfragmented.
   * 
   * Hierarchy Level 3 (Explicit Domain Headers):
   * In ratio-transformed modes (9:16 / 16:9), matches explicit task prefixes (`Prompt \d+:`, `Video \d+:`).
   * Strips prefix metadata via `cleanPromptPrefix` while preserving internal bullet hierarchies.
   * 
   * Hierarchy Level 4 (Paragraph Block Chunking):
   * Segments remaining inputs along double newline (`\n\s*\n+`) paragraph boundaries.
   * 
   * @returns {string[]} Array of normalized prompt chunks ready for injection or queue execution.
   */
  function parsePromptsFromInput() {
    const raw = (batchPromptsInput.value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!raw) return [];

    const isRawMode = currentSettings.aspectRatio === 'raw';

    // 1. Check for explicit markdown divider lines (e.g. --- or === or ***)
    // This is the cleanest delimiter for multi-topic production prompts
    const dividerRegex = /\n\s*(?:[-=_*]){3,}\s*(?:\n|$)/;
    if (dividerRegex.test(raw)) {
      const chunks = raw.split(dividerRegex).map(c => c.trim()).filter(Boolean);
      if (chunks.length > 0) {
        if (isRawMode) {
          // Raw mode: preserve verbatim, zero modifications, zero stripping
          return chunks;
        }
        return chunks.map(c => cleanPromptPrefix(c)).filter(Boolean);
      }
    }

    // 2. In Raw Mode without explicit dividers, treat the entire textarea as ONE raw prompt
    // This preserves all sections, shot lists, paragraphs, bullet points, and markdown untouched
    if (isRawMode) {
      return [raw];
    }

    // 3. For 9:16 / 16:9 modes, check for explicit prompt headers like "Prompt 1:", "Video 1:"
    // (Never match bullet points - or * or shot lists as separate prompts)
    const promptHeaderRegex = /(?:^|\n)\s*(?:prompt|video)\s*#?\d+[:.-]\s+/i;
    if (promptHeaderRegex.test(raw)) {
      const parts = raw.split(/(?:^|\n)(?=\s*(?:prompt|video)\s*#?\d+[:.-]\s+)/i)
        .map(p => p.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        return parts.map(p => cleanPromptPrefix(p)).filter(Boolean);
      }
    }

    // 4. Double blank lines separating distinct blocks/paragraphs
    const blocks = raw.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean);
    if (blocks.length > 1) {
      return blocks.map(p => cleanPromptPrefix(p)).filter(Boolean);
    }

    // 5. Fallback: single prompt
    return [cleanPromptPrefix(raw)];
  }

  function updatePromptCount() {
    const raw = (batchPromptsInput.value || '').trim();
    if (!raw) {
      promptCountBadge.textContent = '0 prompts';
      return;
    }
    const list = parsePromptsFromInput();
    const count = list.length;
    if (currentSettings.aspectRatio === 'raw') {
      promptCountBadge.textContent = count === 1 ? '1 raw prompt' : `${count} raw prompts`;
    } else {
      promptCountBadge.textContent = count === 1 ? '1 prompt' : `${count} prompts`;
    }
  }

  batchPromptsInput.addEventListener('input', () => {
    updatePromptCount();
    // Cache draft prompts so user never loses work
    safeStorage.set({ dola_batch_prompts_draft: batchPromptsInput.value });
  });

  btnClearPrompts.addEventListener('click', () => {
    batchPromptsInput.value = '';
    updatePromptCount();
    safeStorage.remove('dola_batch_prompts_draft');
    batchPromptsInput.focus();
  });

  // Direct paste to active Dola chat input box
  if (btnPasteToChat) {
    btnPasteToChat.addEventListener('click', async () => {
      const rawText = (batchPromptsInput.value || '').trim();
      if (!rawText) {
        batchPromptsInput.focus();
        promptCountBadge.textContent = 'Enter prompts first';
        setTimeout(updatePromptCount, 2000);
        return;
      }

      const isRaw = currentSettings.aspectRatio === 'raw';
      const prompts = parsePromptsFromInput();

      const originalLabel = btnPasteToChatText ? btnPasteToChatText.textContent : 'Paste to Chat Input';
      if (btnPasteToChatText) btnPasteToChatText.textContent = 'Pasting...';

      try {
        const dolaTarget = await ensureDolaTab(true);
        if (!dolaTarget || !dolaTarget.tab || !dolaTarget.tab.id) {
          if (btnPasteToChatText) btnPasteToChatText.textContent = 'No Dola tab';
          setTimeout(() => {
            if (btnPasteToChatText) btnPasteToChatText.textContent = originalLabel;
          }, 2000);
          return;
        }

        const tab = dolaTarget.tab;

        // Ensure content script and extractor are ready
        if (chrome.scripting && chrome.scripting.executeScript) {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['extractor.js'],
            world: 'MAIN'
          }).catch(() => {});

          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }).catch(() => {});
        }

        chrome.tabs.sendMessage(tab.id, {
          type: 'PASTE_PROMPTS_TO_INPUT',
          payload: {
            prompts,
            rawContent: rawText,
            aspectRatio: currentSettings.aspectRatio,
            useSlashGenerateVideo: false // Pasting directly to chat input should not inject /generate video chips
          }
        }, res => {
          if (chrome.runtime.lastError || (res && !res.ok)) {
            if (btnPasteToChatText) btnPasteToChatText.textContent = 'Paste failed';
            setTimeout(() => {
              if (btnPasteToChatText) btnPasteToChatText.textContent = originalLabel;
            }, 2000);
          } else {
            const count = res?.count || prompts.length;
            if (btnPasteToChatText) btnPasteToChatText.textContent = isRaw ? 'Pasted raw prompt!' : `Pasted ${count} prompt${count === 1 ? '' : 's'}!`;
            btnPasteToChat.classList.add('btn-action-success');
            setTimeout(() => {
              if (btnPasteToChatText) btnPasteToChatText.textContent = originalLabel;
              btnPasteToChat.classList.remove('btn-action-success');
            }, 2200);
          }
        });
      } catch (err) {
        if (btnPasteToChatText) btnPasteToChatText.textContent = 'Error';
        setTimeout(() => {
          if (btnPasteToChatText) btnPasteToChatText.textContent = originalLabel;
        }, 2000);
      }
    });
  }

  // --- 3. Aspect Ratio Selection ---
  ratioButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      ratioButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSettings.aspectRatio = btn.dataset.ratio;
      safeStorage.set({ dola_aspect_ratio: currentSettings.aspectRatio });
      updatePromptCount();
    });
  });

  // --- 4. Queue Automation Trigger, Progress & Sidebar Zoom Management ---
  let sidepanelPort = null;
  function ensureSidepanelPort() {
    try {
      if (!sidepanelPort && typeof chrome !== 'undefined' && chrome.runtime?.connect) {
        sidepanelPort = chrome.runtime.connect({ name: 'dola-sidepanel-port' });
        sidepanelPort.onDisconnect.addListener(() => {
          sidepanelPort = null;
        });
      }
    } catch {}
    return sidepanelPort;
  }

  let activeZoomedTabId = null;

  async function applySidebarZoom(targetTabId = null, overrideLevel = null) {
    if (!currentSettings.autoZoomOnBatch) return;
    const tab = targetTabId ? { id: targetTabId } : await getActiveDolaTab();
    if (!tab || !tab.id) return;

    const level = overrideLevel !== null ? overrideLevel : (parseFloat(currentSettings.zoomLevel) || 0.80);
    activeZoomedTabId = tab.id;

    // Send to background service worker via persistent port
    const port = ensureSidepanelPort();
    if (port) {
      try {
        port.postMessage({
          type: 'SIDEPANEL_APPLY_ZOOM',
          tabId: tab.id,
          zoomLevel: level
        });
      } catch {}
    }

    // Direct tabs.setZoom call as immediate local action
    if (chrome.tabs && chrome.tabs.setZoom) {
      try {
        if (chrome.tabs.setZoomSettings) {
          await chrome.tabs.setZoomSettings(tab.id, { scope: 'per-tab', mode: 'automatic' }).catch(() => {});
        }
        await chrome.tabs.setZoom(tab.id, level);
      } catch (err) {
        console.warn('[Dola Sidebar] Failed to apply tab zoom:', err);
      }
    }
  }

  async function resetSidebarZoom(targetTabId = null) {
    const tabId = targetTabId || activeZoomedTabId;
    if (!tabId) return;

    const port = ensureSidepanelPort();
    if (port) {
      try {
        port.postMessage({
          type: 'SIDEPANEL_RESET_ZOOM',
          tabId
        });
      } catch {}
    }

    if (chrome.tabs && chrome.tabs.setZoom) {
      try {
        await chrome.tabs.setZoom(tabId, 1.0);
      } catch {}
    }
    if (activeZoomedTabId === tabId) {
      activeZoomedTabId = null;
    }
  }

  // Restore 100% zoom when sidebar unloads or closes
  window.addEventListener('beforeunload', () => {
    if (activeZoomedTabId && chrome.tabs && chrome.tabs.setZoom) {
      try {
        chrome.tabs.setZoom(activeZoomedTabId, 1.0);
      } catch {}
    }
  });

  window.addEventListener('pagehide', () => {
    if (activeZoomedTabId && chrome.tabs && chrome.tabs.setZoom) {
      try {
        chrome.tabs.setZoom(activeZoomedTabId, 1.0);
      } catch {}
    }
  });

  // Observe tab activation to zoom active Dola tab when user switches tabs
  if (chrome.tabs && chrome.tabs.onActivated) {
    chrome.tabs.onActivated.addListener(async activeInfo => {
      try {
        if (!currentSettings.autoZoomOnBatch) return;
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab && tab.url && (tab.url.includes('dola.com') || tab.url.includes('doubao.com'))) {
          applySidebarZoom(tab.id);
        }
      } catch {}
    });
  }

  async function ensureDolaTab(createIfMissing = true) {
    if (typeof chrome === 'undefined' || !chrome.tabs) return null;
    try {
      // 1. Check if the currently active tab in the current window is already Dola
      const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTabs && activeTabs[0]?.url && (activeTabs[0].url.includes('dola.com') || activeTabs[0].url.includes('doubao.com'))) {
        return { tab: activeTabs[0], isNew: false };
      }

      // 2. Check if an existing Dola tab exists in the current window or any other window
      const allDolaTabs = await chrome.tabs.query({ url: ['https://*.dola.com/*', 'https://*.doubao.com/*'] });
      if (allDolaTabs && allDolaTabs.length > 0) {
        const existingTab = allDolaTabs[0];
        if (existingTab.windowId && chrome.windows?.update) {
          await chrome.windows.update(existingTab.windowId, { focused: true }).catch(() => {});
        }
        await chrome.tabs.update(existingTab.id, { active: true }).catch(() => {});
        await new Promise(r => setTimeout(r, 500));
        return { tab: existingTab, isNew: false };
      }

      if (!createIfMissing) return null;

      // 3. No Dola tab exists: open a new tab to https://www.dola.com/chat
      const newTab = await chrome.tabs.create({ url: 'https://www.dola.com/chat', active: true });

      // Wait for the new tab to complete loading
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 18000);

        function listener(tabId, changeInfo) {
          if (tabId === newTab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            clearTimeout(timeout);
            resolve();
          }
        }
        chrome.tabs.onUpdated.addListener(listener);
      });

      // Extra buffer for Dola's React framework and Tiptap editor to mount
      await new Promise(r => setTimeout(r, 2200));

      return { tab: newTab, isNew: true };
    } catch (err) {
      console.warn('[Dola Sidebar] Error in ensureDolaTab:', err);
      return null;
    }
  }

  async function getActiveDolaTab() {
    const res = await ensureDolaTab(false);
    return res ? res.tab : null;
  }

  btnStartQueue.addEventListener('click', async () => {
    const prompts = parsePromptsFromInput();
    if (prompts.length === 0) {
      batchPromptsInput.focus();
      promptCountBadge.textContent = 'Enter prompts first';
      setTimeout(updatePromptCount, 2000);
      return;
    }

    // Set UI to running state immediately
    btnStartQueue.classList.add('hidden');
    btnStopQueue.classList.remove('hidden');
    queueStatusCard.classList.remove('hidden');
    queueProgressBar.style.width = '4%';
    queueStatusTitle.textContent = 'Locating Dola workspace...';
    queueStatusDetail.textContent = 'Checking or opening Dola AI chat tab...';

    // Locate existing tab or open a fresh one automatically
    const dolaTarget = await ensureDolaTab(true);
    if (!dolaTarget || !dolaTarget.tab || !dolaTarget.tab.id) {
      queueStatusTitle.textContent = 'Could not open Dola';
      queueStatusDetail.textContent = 'Unable to launch or navigate to dola.com';
      resetQueueButtons();
      return;
    }

    const tab = dolaTarget.tab;

    if (dolaTarget.isNew) {
      queueProgressBar.style.width = '8%';
      queueStatusTitle.textContent = 'Initializing Dola interface...';
      queueStatusDetail.textContent = 'Waiting for chat editor to load...';
    } else {
      queueProgressBar.style.width = '6%';
      queueStatusTitle.textContent = 'Initiating batch queue...';
      queueStatusDetail.textContent = `Queuing ${prompts.length} video prompts`;
    }

    // Ensure content script and extractor are ready
    if (chrome.scripting && chrome.scripting.executeScript) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['extractor.js'],
        world: 'MAIN'
      }).catch(() => {});

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }).catch(() => {});
    }

    // Auto-Zoom Dola Tab if enabled
    let zoomAppliedViaTabsApi = false;
    if (currentSettings.autoZoomOnBatch && tab && tab.id) {
      await applySidebarZoom(tab.id);
      zoomAppliedViaTabsApi = true;
    }

    // Short pacing pause to allow tab state and layout to settle
    await new Promise(r => setTimeout(r, 400));

    // Send start signal to content script
    chrome.tabs.sendMessage(tab.id, {
      type: 'START_AUTOMATION_QUEUE',
      payload: {
        prompts,
        aspectRatio: currentSettings.aspectRatio,
        newChatPerBatch: dolaTarget.isNew ? false : currentSettings.newChatPerBatch,
        autoZoom: currentSettings.autoZoomOnBatch,
        zoomAppliedViaTabsApi,
        zoomLevel: currentSettings.zoomLevel,
        bypassPrompt: currentSettings.bypassPrompt
      }
    }, res => {
      if (chrome.runtime.lastError) {
        queueStatusTitle.textContent = 'Connection error';
        queueStatusDetail.textContent = 'Please reload the Dola AI tab and try again.';
        resetQueueButtons();
        return;
      }
      if (res && !res.ok) {
        queueStatusTitle.textContent = 'Queue error';
        queueStatusDetail.textContent = res.error || 'Failed to start queue.';
        resetQueueButtons();
      }
    });
  });

  btnStopQueue.addEventListener('click', async () => {
    const tab = await getActiveDolaTab();
    if (tab && tab.id && chrome.tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTOMATION_QUEUE' }).catch(() => {});
    }
    queueStatusTitle.textContent = 'Stopping queue...';
    queueStatusDetail.textContent = 'Halting automated sequence';
    setTimeout(resetQueueButtons, 1200);
  });

  function resetQueueButtons() {
    btnStartQueue.classList.remove('hidden');
    btnStopQueue.classList.add('hidden');
  }

  // Listen for progress updates from content.js
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(msg => {
      if (msg && msg.type === 'QUEUE_PROGRESS_UPDATE' && msg.state) {
        const { title, detail, currentStep, totalSteps, done, stopped } = msg.state;

        queueStatusCard.classList.remove('hidden');
        if (title) queueStatusTitle.textContent = title;
        if (detail) queueStatusDetail.textContent = detail;

        if (totalSteps && totalSteps > 0) {
          const pct = Math.min(Math.round((currentStep / totalSteps) * 100), 100);
          queueProgressBar.style.width = `${pct}%`;
        }

        if (done || stopped) {
          resetQueueButtons();
          if (done) {
            queueProgressBar.style.width = '100%';
            setTimeout(() => {
              queueStatusCard.classList.add('hidden');
            }, 4000);
          }
        }
      }
    });
  }

  // --- 5. Settings: New Chat Toggle ---
  settingNewChatToggle.addEventListener('change', () => {
    currentSettings.newChatPerBatch = settingNewChatToggle.checked;
    safeStorage.set({ dola_new_chat_per_batch: currentSettings.newChatPerBatch });
  });

  // --- 5b. Settings: Auto-Zoom Toggle & Level ---
  function updateZoomPill(level) {
    if (currentZoomPill) {
      const pct = Math.round((parseFloat(level) || 0.8) * 100);
      currentZoomPill.textContent = `${pct}%`;
    }
  }

  if (settingAutoZoomToggle) {
    settingAutoZoomToggle.addEventListener('change', async () => {
      currentSettings.autoZoomOnBatch = settingAutoZoomToggle.checked;
      safeStorage.set({ dola_auto_zoom_enabled: currentSettings.autoZoomOnBatch });
      const container = document.getElementById('zoom-level-container');
      if (container) {
        container.classList.toggle('disabled', !currentSettings.autoZoomOnBatch);
      }
      if (currentSettings.autoZoomOnBatch) {
        await applySidebarZoom();
      } else {
        await resetSidebarZoom();
      }
    });
  }

  if (settingZoomLevelSelect) {
    settingZoomLevelSelect.addEventListener('change', async () => {
      const level = parseFloat(settingZoomLevelSelect.value) || 0.8;
      currentSettings.zoomLevel = level;
      updateZoomPill(level);
      safeStorage.set({ dola_zoom_level: level.toFixed(2) });

      if (currentSettings.autoZoomOnBatch) {
        await applySidebarZoom(null, level);
      }
    });
  }



  // --- 7. Settings: Second Message (Bypass Instructions) ---
  settingBypassInput.addEventListener('input', () => {
    currentSettings.bypassPrompt = settingBypassInput.value;
    safeStorage.set({ dola_bypass_prompt: currentSettings.bypassPrompt });
  });

  btnResetBypass.addEventListener('click', () => {
    settingBypassInput.value = DEFAULT_BYPASS_PROMPT;
    currentSettings.bypassPrompt = DEFAULT_BYPASS_PROMPT;
    safeStorage.set({ dola_bypass_prompt: DEFAULT_BYPASS_PROMPT });
    btnResetBypass.textContent = 'Reset done!';
    setTimeout(() => { btnResetBypass.textContent = 'Reset default'; }, 1500);
  });

  // --- 8. Settings: Auto-Download & Folder Config ---
  autoDownloadToggle.addEventListener('change', () => {
    currentSettings.autoDownload = autoDownloadToggle.checked;
    safeRuntime.sendMessage({
      type: 'TOGGLE_AUTO_DOWNLOAD',
      enabled: autoDownloadToggle.checked
    });
  });

  if (settingNotificationsToggle) {
    settingNotificationsToggle.addEventListener('change', () => {
      currentSettings.notifications = settingNotificationsToggle.checked;
      safeRuntime.sendMessage({
        type: 'TOGGLE_NOTIFICATIONS',
        enabled: settingNotificationsToggle.checked
      });
    });
  }

  function saveSubfolderConfig() {
    const raw = (subfolderInput.value || 'Dola_Videos').trim();
    const folder = raw.replace(/^[/\\]+|[/\\]+$/g, '') || 'Dola_Videos';
    subfolderInput.value = folder;
    currentSettings.subfolder = folder;

    safeRuntime.sendMessage({
      type: 'UPDATE_DOWNLOADER_CONFIG',
      config: { subfolder: folder }
    }, () => {
      saveFolderBtn.textContent = 'Saved!';
      setTimeout(() => { saveFolderBtn.textContent = 'Save'; }, 1500);
    });
  }

  saveFolderBtn.addEventListener('click', saveSubfolderConfig);

  subfolderInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveSubfolderConfig();
    }
  });

  subfolderInput.addEventListener('blur', () => {
    if (subfolderInput.value.trim() !== currentSettings.subfolder) {
      saveSubfolderConfig();
    }
  });

  // --- 9. Action: Download Video on Screen ---
  btnDownloadScreen.addEventListener('click', () => {
    btnDownloadScreen.disabled = true;
    btnDownloadScreenText.textContent = 'Scanning tab for 1080p stream...';

    safeRuntime.sendMessage({ type: 'TRIGGER_PAGE_SCAN_AND_DOWNLOAD' }, res => {
      if (typeof chrome !== 'undefined' && chrome.runtime?.lastError) {
        btnDownloadScreenText.textContent = 'Error scanning tab';
        setTimeout(() => {
          btnDownloadScreenText.textContent = 'Download Video on Screen';
          btnDownloadScreen.disabled = false;
        }, 2000);
        return;
      }

      if (res && res.ok) {
        btnDownloadScreenText.textContent = 'Downloaded 1080p Raw MP4!';
        setTimeout(() => {
          btnDownloadScreenText.textContent = 'Download Video on Screen';
          btnDownloadScreen.disabled = false;
          refreshHistory();
        }, 2000);
      } else {
        btnDownloadScreenText.textContent = res?.message || 'No video detected';
        setTimeout(() => {
          btnDownloadScreenText.textContent = 'Download Video on Screen';
          btnDownloadScreen.disabled = false;
        }, 2500);
      }
    });
  });

  // --- 9c. In-Browser Watermark Cleaner Integration ---
  const headerCleanerStatus = document.getElementById('header-cleaner-status');
  const cleanerStatusDot = document.getElementById('cleaner-status-dot');
  const cleanerStatusText = document.getElementById('cleaner-status-text');

  function initInBrowserCleaner() {
    if (headerCleanerStatus) {
      headerCleanerStatus.classList.add('online');
      headerCleanerStatus.title = 'In-Browser Watermark Removal Engine (Native Chrome)';
    }
    if (cleanerStatusDot) cleanerStatusDot.classList.add('online');
    if (cleanerStatusText) cleanerStatusText.textContent = 'In-Browser Cleaner';
  }

  initInBrowserCleaner();

  if (headerCleanerStatus) {
    headerCleanerStatus.addEventListener('click', () => {
      showGlobalToast('In-Browser AI Cleaner is active. Both static and dynamic watermarks are cleaned automatically in Chrome.');
    });
  }

  function renderCleanerQueue(state) {
    if (!cleanerQueueContainer) return;
    const queue = state?.queue || [];

    if (!queue || queue.length === 0) {
      cleanerQueueContainer.style.display = 'none';
      if (cleanerStatusText) {
        cleanerStatusText.textContent = 'In-Browser Cleaner';
      }
      return;
    }

    cleanerQueueContainer.style.display = 'block';

    const activeJob = queue.find(j => j.status === 'cleaning') || queue[0];
    const queuedCount = queue.filter(j => j.status === 'queued').length;

    if (activeJob) {
      if (cleanerQueueActiveTitle) {
        const titleText = activeJob.prompt || activeJob.filename || 'Dola Video';
        cleanerQueueActiveTitle.textContent = titleText;
        cleanerQueueActiveTitle.title = titleText;
      }

      const pct = Math.max(0, Math.min(100, Math.round(activeJob.progress || 0)));
      if (cleanerQueueProgressBar) {
        cleanerQueueProgressBar.style.width = `${pct}%`;
      }
      if (cleanerQueueProgressPercent) {
        cleanerQueueProgressPercent.textContent = `${pct}%`;
      }

      if (cleanerQueueStatusLabel) {
        if (activeJob.status === 'cleaning') {
          const wmLabel = activeJob.watermarkType === 'static' ? 'Static' : 'Dynamic';
          cleanerQueueStatusLabel.textContent = `Removing ${wmLabel} watermark...`;
        } else if (activeJob.status === 'completed') {
          cleanerQueueStatusLabel.textContent = 'Cleaned 100% (Saved)';
        } else if (activeJob.status === 'failed') {
          cleanerQueueStatusLabel.textContent = 'Inpainting failed (Skipped)';
        } else {
          cleanerQueueStatusLabel.textContent = 'Queued for cleaning...';
        }
      }

      if (cleanerStatusText) {
        cleanerStatusText.textContent = `Cleaning: ${pct}%`;
      }
    }

    if (cleanerQueueCountBadge) {
      if (queuedCount > 0) {
        cleanerQueueCountBadge.style.display = 'inline-block';
        cleanerQueueCountBadge.textContent = `+${queuedCount} queued`;
      } else {
        cleanerQueueCountBadge.style.display = 'none';
      }
    }
  }

  // Listen for progress and queue updates from offscreen cleaner and background service worker
  chrome.runtime.onMessage.addListener(msg => {
    if (!msg || !msg.type) return;

    if (msg.type === 'DOLA_CLEANER_PROGRESS') {
      const pct = Math.max(0, Math.min(100, Math.round(msg.progress || 0)));
      if (cleanerQueueProgressBar) {
        cleanerQueueProgressBar.style.width = `${pct}%`;
      }
      if (cleanerQueueProgressPercent) {
        cleanerQueueProgressPercent.textContent = `${pct}%`;
      }
      if (cleanerQueueActiveTitle && msg.prompt) {
        cleanerQueueActiveTitle.textContent = msg.prompt;
        cleanerQueueActiveTitle.title = msg.prompt;
      }
      if (cleanerStatusText) {
        cleanerStatusText.textContent = `Cleaning: ${pct}%`;
      }
      if (cleanerQueueContainer && cleanerQueueContainer.style.display === 'none') {
        cleanerQueueContainer.style.display = 'block';
      }
    }

    if (msg.type === 'DOLA_QUEUE_UPDATED') {
      renderCleanerQueue(msg);
      refreshHistory();
    }

    if (msg.type === 'DOLA_VIDEO_SAVED' || msg.type === 'REFRESH_HISTORY') {
      refreshHistory();
    }
  });

  // --- 10. History Rendering ---
  function renderHistory(items = []) {
    if (!historyList) return;
    if (historyCount) historyCount.textContent = String(items.length);

    if (!items || items.length === 0) {
      historyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              <line x1="17" y1="17" x2="22" y2="17"/>
              <line x1="17" y1="7" x2="22" y2="7"/>
            </svg>
          </div>
          <span class="empty-state-title">No videos downloaded yet</span>
          <span class="empty-state-desc">Captured unwatermarked 1080p MP4s will appear here automatically.</span>
        </div>
      `;
      return;
    }

    historyList.innerHTML = items.slice(0, 30).map(item => {
      const isDynamic = item.watermarkType === 'dynamic' || (item.url && item.url.includes('video_gen_watermark_dyn'));
      const isStatic = item.watermarkType === 'static' || (!isDynamic && item.url && item.url.includes('video_gen_watermark'));
      const isCleaned = (item.filename && item.filename.includes('cleaned')) ||
                        (item.filename && item.filename.includes('_clean')) ||
                        (item.resolution && item.resolution.includes('Cleaned'));

      let badgeClass = 'history-tag tag-master';
      let badgeLabel = '1080p Master';
      if (isDynamic) {
        badgeClass = 'history-tag tag-dynamic';
        badgeLabel = 'Dynamic Watermark';
      } else if (isStatic) {
        badgeClass = 'history-tag tag-static';
        badgeLabel = 'Static Watermark';
      }
      const cleanBadge = isCleaned ? `<span class="history-tag tag-cleaned">100% Cleaned</span>` : '';

      return `
      <div class="history-item">
        <div class="history-details">
          <div class="history-prompt" title="${escapeHtml(item.prompt || item.filename)}">
            ${escapeHtml(item.prompt || item.filename)}
          </div>
          <div class="history-meta">
            <span class="${badgeClass}">${badgeLabel}</span>
            ${cleanBadge}
            <span>&bull;</span>
            <span class="mono-num">${formatTime(item.timestamp)}</span>
          </div>
        </div>
        <div class="history-item-actions">
          <button class="btn-icon-open" data-download-id="${item.downloadId || ''}" title="Show in folder" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
    }).join('');

    historyList.querySelectorAll('.btn-icon-open').forEach(btn => {
      btn.addEventListener('click', () => {
        const dId = btn.getAttribute('data-download-id');
        safeRuntime.sendMessage({
          type: 'SHOW_DOWNLOAD_ITEM',
          downloadId: dId ? Number(dId) : null
        });
      });
    });
  }

  function refreshHistory() {
    safeRuntime.sendMessage({ type: 'GET_DOWNLOADER_STATUS' }, res => {
      if (res && res.ok) {
        renderHistory(res.history || []);
      }
    });
    safeRuntime.sendMessage({ type: 'GET_CLEANER_QUEUE' }, res => {
      if (res && res.ok) {
        renderCleanerQueue(res);
      }
    });
  }

  clearHistoryBtn.addEventListener('click', () => {
    safeRuntime.sendMessage({ type: 'CLEAR_DOWNLOAD_HISTORY' }, () => {
      renderHistory([]);
    });
  });

  // --- 10b. Manual Link Importer Drawer ---
  if (btnToggleManualImport && manualImportDrawer) {
    btnToggleManualImport.addEventListener('click', () => {
      manualImportDrawer.classList.toggle('hidden');
      if (!manualImportDrawer.classList.contains('hidden')) {
        manualLinksInput?.focus();
      }
    });
  }

  async function processManualLinkItem(rawLine, index, total) {
    const item = rawLine.trim();
    if (!item) return false;

    const isDyn = item.includes('video_gen_watermark_dyn');
    const isStatic = !isDyn && item.includes('video_gen_watermark');
    const watermarkType = isDyn ? 'dynamic' : (isStatic ? 'static' : 'none');

    // Direct video stream URL (e.g. Dola CDN MP4 link)
    if (item.includes('/video/tos/') || item.includes('mime_type=video_mp4') || item.includes('.mp4') || (item.includes('dola.dola.com') && item.includes('download=true'))) {
      safeRuntime.sendMessage({
        type: 'AUTO_DOWNLOAD_VIDEO',
        video: {
          url: item,
          prompt: `Imported Video ${index + 1}`,
          watermarkType,
          source: 'manual_import'
        },
        force: true
      }, () => refreshHistory());
      return true;
    }

    // Fallback API URL or web link
    if (item.startsWith('http')) {
      try {
        const unwatermarkedApi = item.replace(/logo_type=[^&]*/i, 'logo_type=unwatermarked');
        const resp = await fetch(unwatermarkedApi);
        const data = await resp.json();
        const encoded = data?.data?.video?.main_url || data?.video?.main_url || '';
        const keySeed = data?.data?.key_seed || data?.key_seed || '';
        if (encoded) {
          const cleanUrl = await decodeQaabToken(encoded, keySeed);
          if (cleanUrl) {
            safeRuntime.sendMessage({
              type: 'AUTO_DOWNLOAD_VIDEO',
              video: { url: cleanUrl, prompt: `Imported Video ${index + 1}`, source: 'manual_import' },
              force: true
            }, () => refreshHistory());
            return true;
          }
        }
      } catch (e) {
        // Fallback: direct download attempt
        safeRuntime.sendMessage({
          type: 'AUTO_DOWNLOAD_VIDEO',
          video: { url: item, prompt: `Imported Video ${index + 1}`, source: 'manual_import' },
          force: true
        }, () => refreshHistory());
        return true;
      }
    }

    // Encrypted qAAB token
    if (item.startsWith('qAAB') || item.length > 80) {
      try {
        const cleanUrl = await decodeQaabToken(item);
        if (cleanUrl) {
          safeRuntime.sendMessage({
            type: 'AUTO_DOWNLOAD_VIDEO',
            video: { url: cleanUrl, prompt: `Imported Video ${index + 1}`, source: 'manual_import' },
            force: true
          }, () => refreshHistory());
          return true;
        }
      } catch {}
    }

    return false;
  }

  if (btnRunManualImport) {
    btnRunManualImport.addEventListener('click', async () => {
      const text = (manualLinksInput?.value || '').trim();
      if (!text) {
        manualLinksInput?.focus();
        return;
      }

      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      btnRunManualImport.disabled = true;
      let successCount = 0;

      for (let i = 0; i < lines.length; i++) {
        if (manualImportStatus) {
          manualImportStatus.textContent = `Downloading ${i + 1}/${lines.length}...`;
        }
        const ok = await processManualLinkItem(lines[i], i, lines.length);
        if (ok) successCount++;
        await new Promise(r => setTimeout(r, 350));
      }

      if (manualImportStatus) {
        manualImportStatus.textContent = `Queued ${successCount} video${successCount === 1 ? '' : 's'}!`;
      }
      btnRunManualImport.disabled = false;
      if (manualLinksInput) manualLinksInput.value = '';
      setTimeout(() => {
        if (manualImportStatus) manualImportStatus.textContent = '';
      }, 3500);
    });
  }

  // --- 11. Complete Web Crypto QAAB Decryptor ---
  const QAAB_SALT_HEX = '4dd4c2e6b83162090e52b3c7a6733ba4'
    + '1cb2462b829ab58a196b39db57177524'
    + 'f49baf7f08e8d68d26a72e37c1a95a2f'
    + '1f05a51892aef2949732b62a38aadd58';

  function base64DecodeLoose(text) {
    if (!text || typeof text !== 'string') return null;
    const input = text.trim().replace(/^qAAB/i, '');
    const variants = [
      input,
      input.replace(/[$@#]/g, char => ({ '$': '_', '@': '/', '#': '.' }[char])),
      input.replace(/[$@#]/g, char => ({ '$': '+', '@': '/', '#': '=' }[char])),
    ];
    const seen = new Set();

    for (const candidate of variants) {
      if (!candidate || seen.has(candidate)) continue;
      seen.add(candidate);
      try {
        const normalized = padBase64(candidate).replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(normalized);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
      } catch {}
    }

    return null;
  }

  function padBase64(text) {
    const pad = (4 - (text.length % 4)) % 4;
    return text + '='.repeat(pad);
  }

  function asciiUrlFromBytes(bytes) {
    if (!bytes || !bytes.length) return '';
    for (const byte of bytes) {
      if (byte !== 9 && byte !== 10 && byte !== 13 && (byte < 32 || byte > 126)) {
        return '';
      }
    }
    return new TextDecoder().decode(bytes);
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  function concatBytes(first, second) {
    const bytes = new Uint8Array(first.length + second.length);
    bytes.set(first, 0);
    bytes.set(second, first.length);
    return bytes;
  }

  function stripPkcs7(bytes) {
    if (!bytes || !bytes.length) return new Uint8Array();
    const pad = bytes[bytes.length - 1];
    if (pad < 1 || pad > 16 || pad > bytes.length) return bytes;
    for (let i = bytes.length - pad; i < bytes.length; i++) {
      if (bytes[i] !== pad) return bytes;
    }
    return bytes.slice(0, bytes.length - pad);
  }

  async function decryptAesCbcUrl(payload, keyBytes, ivBytes) {
    if (!payload.length || payload.length % 16 !== 0) return '';
    try {
      const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['decrypt']);
      const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivBytes }, key, payload));
      const direct = asciiUrlFromBytes(plain);
      if (direct.startsWith('http://') || direct.startsWith('https://')) return direct;
      const stripped = stripPkcs7(plain);
      const url = asciiUrlFromBytes(stripped);
      return (url.startsWith('http://') || url.startsWith('https://')) ? url : '';
    } catch {
      return '';
    }
  }

  async function decodeQaabToken(token, keySeed = '') {
    const data = base64DecodeLoose(token);
    if (!data) return '';

    const salt = hexToBytes(QAAB_SALT_HEX);
    let key, iv;

    if (keySeed) {
      const seed = base64DecodeLoose(keySeed);
      if (seed) {
        const digest1 = await crypto.subtle.digest('SHA-512', seed.slice(0, 32));
        const digest2Input = concatBytes(new Uint8Array(digest1), salt);
        const digest2 = new Uint8Array(await crypto.subtle.digest('SHA-512', digest2Input));
        key = digest2.slice(0, 16);
        iv = digest2.slice(16, 32);
      }
    }

    if (!key || !iv) {
      const hashBuffer = await crypto.subtle.digest('SHA-512', salt);
      const hashBytes = new Uint8Array(hashBuffer);
      key = hashBytes.slice(0, 16);
      iv = hashBytes.slice(16, 32);
    }

    const attempts = [];
    if (data.length >= 4 && data[0] === 0xa8 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00) {
      attempts.push({ payload: data.slice(4), key, iv });
      attempts.push({ payload: data.slice(4), key: iv, iv: key });
      if (data.length > 36) {
        attempts.push({ payload: data.slice(36), key, iv: data.slice(20, 36) });
        attempts.push({ payload: data.slice(36), key, iv });
      }
    } else {
      attempts.push({ payload: data, key, iv });
    }

    for (const attempt of attempts) {
      const url = await decryptAesCbcUrl(attempt.payload, attempt.key, attempt.iv);
      if (url) return url;
    }

    return '';
  }

  // --- 12. Right-Click Context Menu ---
  document.addEventListener('contextmenu', (e) => {
    const target = e.target;
    const isInput = target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && target.type === 'text') || target.tagName === 'SELECT';
    const selectedText = window.getSelection() ? window.getSelection().toString().trim() : '';

    if (isInput || selectedText) {
      e.preventDefault();
      activeContextTarget = isInput ? target : null;
      activeSelectedText = selectedText;

      // Adjust enabled state of Cut / Paste if not an input element
      const cutItem = contextMenu.querySelector('[data-action="cut"]');
      const pasteItem = contextMenu.querySelector('[data-action="paste"]');
      if (cutItem) cutItem.style.display = isInput ? 'flex' : 'none';
      if (pasteItem) pasteItem.style.display = isInput ? 'flex' : 'none';

      // Position context menu safely within window boundaries
      const menuWidth = 150;
      const menuHeight = isInput ? 145 : 75;
      const posX = Math.max(8, Math.min(e.clientX, window.innerWidth - menuWidth - 8));
      const posY = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8));

      contextMenu.style.top = `${posY}px`;
      contextMenu.style.left = `${posX}px`;
      contextMenu.classList.add('visible');
    } else {
      contextMenu.classList.remove('visible');
    }
  });

  document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target)) {
      contextMenu.classList.remove('visible');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && contextMenu.classList.contains('visible')) {
      contextMenu.classList.remove('visible');
      if (activeContextTarget) activeContextTarget.focus();
    }
  });

  contextMenu.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      const action = item.dataset.action;

      if (action === 'select-all') {
        if (activeContextTarget) {
          activeContextTarget.focus();
          activeContextTarget.select();
        } else {
          window.getSelection()?.selectAllChildren(document.body);
        }
      } else if (action === 'copy') {
        if (activeContextTarget) {
          activeContextTarget.focus();
          const sel = activeContextTarget.value.substring(
            activeContextTarget.selectionStart,
            activeContextTarget.selectionEnd
          );
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(sel || activeContextTarget.value).catch(() => {});
          }
        } else if (activeSelectedText) {
          if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(activeSelectedText).catch(() => {});
          }
        }
      } else if (action === 'cut' && activeContextTarget) {
        activeContextTarget.focus();
        const start = activeContextTarget.selectionStart;
        const end = activeContextTarget.selectionEnd;
        const sel = activeContextTarget.value.substring(start, end);
        if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(sel).catch(() => {});
        }
        activeContextTarget.value = activeContextTarget.value.substring(0, start) + activeContextTarget.value.substring(end);
        activeContextTarget.selectionStart = activeContextTarget.selectionEnd = start;
        // Dispatch input and change events to keep state variables & storage in sync
        activeContextTarget.dispatchEvent(new Event('input', { bubbles: true }));
        activeContextTarget.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (action === 'paste' && activeContextTarget) {
        activeContextTarget.focus();
        try {
          const text = await navigator.clipboard.readText();
          const start = activeContextTarget.selectionStart;
          const end = activeContextTarget.selectionEnd;
          activeContextTarget.value = activeContextTarget.value.substring(0, start) + text + activeContextTarget.value.substring(end);
          activeContextTarget.selectionStart = activeContextTarget.selectionEnd = start + text.length;
          // Dispatch input and change events to keep state variables & storage in sync
          activeContextTarget.dispatchEvent(new Event('input', { bubbles: true }));
          activeContextTarget.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
      }
      contextMenu.classList.remove('visible');
    });
  });

  // Initialize DOM inputs immediately with defaults
  settingBypassInput.value = currentSettings.bypassPrompt;
  settingNewChatToggle.checked = currentSettings.newChatPerBatch;
  if (settingAutoZoomToggle) settingAutoZoomToggle.checked = currentSettings.autoZoomOnBatch;
  if (settingZoomLevelSelect) {
    settingZoomLevelSelect.value = (0.80).toFixed(2);
    updateZoomPill(0.80);
  }
  if (settingNotificationsToggle) {
    settingNotificationsToggle.checked = currentSettings.notifications;
  }

  // --- 13. State Initialization & Storage Loading ---
  async function loadInitialState() {
    try {
      const res = await safeStorage.get([
        'dola_sidebar_active_tab',
        'dola_batch_prompts_draft',
        'dola_aspect_ratio',
        'dola_new_chat_per_batch',
        'dola_auto_zoom_enabled',
        'dola_zoom_level',
        'dola_bypass_prompt'
      ]);

      // Active tab
      if (res.dola_sidebar_active_tab) {
        switchTab(res.dola_sidebar_active_tab);
      }

      // Prompts draft
      if (res.dola_batch_prompts_draft) {
        batchPromptsInput.value = res.dola_batch_prompts_draft;
        updatePromptCount();
      }

      // Aspect ratio
      if (res.dola_aspect_ratio) {
        currentSettings.aspectRatio = res.dola_aspect_ratio;
        ratioButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.ratio === res.dola_aspect_ratio);
        });
      } else {
        currentSettings.aspectRatio = 'raw';
        ratioButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.ratio === 'raw');
        });
      }

      // New chat toggle
      if (typeof res.dola_new_chat_per_batch === 'boolean') {
        currentSettings.newChatPerBatch = res.dola_new_chat_per_batch;
        settingNewChatToggle.checked = res.dola_new_chat_per_batch;
      }

      // Auto-Zoom toggle & level
      if (typeof res.dola_auto_zoom_enabled === 'boolean') {
        currentSettings.autoZoomOnBatch = res.dola_auto_zoom_enabled;
        if (settingAutoZoomToggle) settingAutoZoomToggle.checked = res.dola_auto_zoom_enabled;
        const container = document.getElementById('zoom-level-container');
        if (container) {
          container.classList.toggle('disabled', !res.dola_auto_zoom_enabled);
        }
      }
      if (res.dola_zoom_level) {
        const levelNum = parseFloat(res.dola_zoom_level) || 0.8;
        currentSettings.zoomLevel = levelNum;
        const normalizedVal = levelNum.toFixed(2);
        if (settingZoomLevelSelect) {
          settingZoomLevelSelect.value = normalizedVal;
        }
        updateZoomPill(levelNum);
      }

      // Immediately apply zoom to active Dola tab when sidebar opens
      if (currentSettings.autoZoomOnBatch) {
        applySidebarZoom().catch(() => {});
      }

      // Bypass prompt
      if (res.dola_bypass_prompt) {
        currentSettings.bypassPrompt = res.dola_bypass_prompt;
      }
      settingBypassInput.value = currentSettings.bypassPrompt;

      // Backend config (subfolder & autoDownload & notifications)
      safeRuntime.sendMessage({ type: 'GET_DOWNLOADER_STATUS' }, statusRes => {
        if (statusRes && statusRes.ok) {
          if (statusRes.config) {
            autoDownloadToggle.checked = Boolean(statusRes.config.autoDownload);
            subfolderInput.value = statusRes.config.subfolder || 'Dola_Videos';
            currentSettings.subfolder = statusRes.config.subfolder || 'Dola_Videos';
            if (settingNotificationsToggle && typeof statusRes.config.notifications !== 'undefined') {
              settingNotificationsToggle.checked = Boolean(statusRes.config.notifications);
              currentSettings.notifications = Boolean(statusRes.config.notifications);
            }
          }
          renderHistory(statusRes.history || []);
        }
      });
    } catch (e) {
      console.warn('[Dola Sidebar] Failed to load initial state:', e);
    }
  }

  // Listen for storage updates from context menu or background script
  if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.dola_batch_prompts_draft && changes.dola_batch_prompts_draft.newValue !== undefined) {
        batchPromptsInput.value = changes.dola_batch_prompts_draft.newValue;
        updatePromptCount();
      }
    });
  }

  loadInitialState();
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    setInterval(refreshHistory, 3500);
  }
})();
