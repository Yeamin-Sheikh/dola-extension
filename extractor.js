/**
 * Dola AI & Doubao Watermark-Free Video Stream Extractor (MAIN World)
 * Intercepts network responses, extracts fallback APIs, requests unwatermarked streams,
 * decodes QAAB AES-CBC encrypted URLs, and notifies the content script.
 */
(() => {
  'use strict';

  // Global safeguard: suppress copy-to-clipboard browser prompt modals
  try {
    const originalPrompt = window.prompt;
    window.prompt = function(message, defaultVal) {
      if (typeof message === 'string' && message.toLowerCase().includes('copy to clipboard')) {
        console.warn('[Dola Extractor] Suppressed copy-to-clipboard browser prompt modal:', defaultVal);
        return defaultVal || null;
      }
      return originalPrompt ? originalPrompt.apply(this, arguments) : null;
    };
  } catch {}

  if (window.__DOLA_EXTRACTOR_HOOKS_INSTALLED__) {
    // Already installed in this page — the original listeners from the first execution
    // are still registered and functional. Do NOT call attachAutomationListeners() here
    // because this re-injected IIFE scope has let/const variables in TDZ (never initialized
    // due to the early return), and the hoisted function would close over those dead references,
    // replacing working listeners with broken ones that throw ReferenceError.
    console.log('[Dola Extractor] Stream interceptor already installed. Skipping re-initialization.');
    return;
  }
  window.__DOLA_EXTRACTOR_HOOKS_INSTALLED__ = true;
  window.__DOLA_EXTRACTOR_INITIALIZED__ = true;

  console.log('[Dola Extractor] Stream interceptor initialized in MAIN world.');

  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const NativeReadableStream = pageWindow.ReadableStream || ReadableStream;
  const NativeResponse = pageWindow.Response || Response;

  let extractedVideos = [];
  const videoUrlIndex = new Set();
  const videoVidIndex = new Set();
  const processedFallbackApis = new Set();
  const fallbackVideoPosterIndex = new Map();
  let latestSubmittedPrompt = '';
  let activeBatchPrompts = [];
  let nextBatchPromptIndex = 0;

  const QAAB_SALT_HEX = '4dd4c2e6b83162090e52b3c7a6733ba4'
    + '1cb2462b829ab58a196b39db57177524'
    + 'f49baf7f08e8d68d26a72e37c1a95a2f'
    + '1f05a51892aef2949732b62a38aadd58';

  function escapeText(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanUserPrompt(str) {
    return String(str || '')
      .replace(/^(9:16 vertical portrait|16:9 widescreen landscape|raw prompt):\s*/i, '')
      .replace(/<[^>]*>/g, '')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function extractPromptFromPayload(body) {
    if (!body) return '';
    try {
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        const candidates = ['prompt', 'query', 'input', 'text', 'messages', 'content'];
        for (const k of candidates) {
          const val = body.get(k);
          if (typeof val === 'string' && val.trim()) return cleanUserPrompt(val);
        }
      }

      if (typeof URLSearchParams !== 'undefined' && (body instanceof URLSearchParams || (typeof body === 'string' && body.includes('=') && !body.startsWith('{')))) {
        try {
          const params = typeof body === 'string' ? new URLSearchParams(body) : body;
          const candidates = ['prompt', 'query', 'input', 'text', 'content'];
          for (const k of candidates) {
            const val = params.get(k);
            if (typeof val === 'string' && val.trim()) return cleanUserPrompt(val);
          }
        } catch {}
      }

      let parsed = null;
      if (typeof body === 'string') {
        const trimmed = body.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          parsed = JSON.parse(trimmed);
        }
      } else if (typeof body === 'object') {
        parsed = body;
      }

      if (parsed) {
        if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
          for (let i = parsed.messages.length - 1; i >= 0; i--) {
            const msg = parsed.messages[i];
            if (msg.role === 'user' || msg.sender_type === 'user' || !msg.role) {
              const content = msg.content || msg.text || msg.prompt;
              if (typeof content === 'string' && content.trim()) {
                return cleanUserPrompt(content);
              }
              if (Array.isArray(content)) {
                for (const part of content) {
                  if (part && (part.text || part.content)) {
                    return cleanUserPrompt(part.text || part.content);
                  }
                }
              }
            }
          }
        }

        const candidates = [
          parsed.query,
          parsed.prompt,
          parsed.text,
          parsed.input,
          parsed.content,
          parsed.user_prompt,
          parsed.user_input,
          parsed.message
        ];
        for (const c of candidates) {
          if (typeof c === 'string' && c.trim()) {
            return cleanUserPrompt(c);
          }
        }

        if (parsed.data && typeof parsed.data === 'object') {
          const nested = extractPromptFromPayload(parsed.data);
          if (nested) return nested;
        }
      }
    } catch {}
    return '';
  }

  function normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    return url.trim().replace(/^http:\/\//i, 'https://');
  }

  function isHttpUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
  }

  function addExtractedVideo(videoInfo) {
    if (!videoInfo || !videoInfo.url) return;
    const url = normalizeImageUrl(videoInfo.url);
    const vid = videoInfo.vid ? String(videoInfo.vid) : '';

    if ((vid && videoVidIndex.has(vid)) || videoUrlIndex.has(url)) {
      const existing = extractedVideos.find(v => (vid && String(v.vid) === vid) || v.url === url);
      if (existing && videoInfo.prompt && (!existing.prompt || existing.prompt === 'Dola Video')) {
        existing.prompt = videoInfo.prompt;
      }
      return;
    }

    let promptCandidate = videoInfo.prompt;
    if (!promptCandidate || promptCandidate === 'Dola Video' || promptCandidate.toLowerCase().startsWith('generate videos')) {
      if (activeBatchPrompts.length > 0) {
        promptCandidate = activeBatchPrompts[nextBatchPromptIndex % activeBatchPrompts.length];
        nextBatchPromptIndex++;
      } else {
        promptCandidate = latestSubmittedPrompt || 'Dola Video';
      }
    } else if (/\b1\.\s+[\s\S]*\b2\.\s+/i.test(promptCandidate)) {
      const parts = promptCandidate.split(/\n*(?:^|\n)\s*\d+\.\s*/).map(p => p.trim()).filter(Boolean);
      if (parts.length > 1) {
        activeBatchPrompts = parts;
        promptCandidate = activeBatchPrompts[nextBatchPromptIndex % activeBatchPrompts.length];
        nextBatchPromptIndex++;
      }
    }

    const normalized = {
      ...videoInfo,
      prompt: promptCandidate,
      url,
      vid: vid || url,
      timestamp: Date.now()
    };

    extractedVideos.push(normalized);
    videoUrlIndex.add(url);
    if (vid) videoVidIndex.add(vid);

    console.log('[Dola Extractor] 🎯 New Unwatermarked Video Captured:', normalized);

    try {
      window.dispatchEvent(new CustomEvent('DOLA_VIDEO_EXTRACTED', { detail: normalized }));
    } catch (e) {
      console.warn('[Dola Extractor] Failed to dispatch DOLA_VIDEO_EXTRACTED:', e);
    }
  }

  // Hook XHR
  const originalXHROpen = pageWindow.XMLHttpRequest.prototype.open;
  const originalXHRSend = pageWindow.XMLHttpRequest.prototype.send;

  pageWindow.XMLHttpRequest.prototype.open = function (method, url, ...args) {
    this._url = url;
    return originalXHROpen.apply(this, [method, url, ...args]);
  };

  pageWindow.XMLHttpRequest.prototype.send = function (...args) {
    const url = this._url;
    const requestPrompt = extractPromptFromPayload(args[0]) || latestSubmittedPrompt;
    this.addEventListener('load', function () {
      if (url && (url.includes('/im/chain/single') || url.includes('/chat/completion') || url.includes('/samantha/'))) {
        try {
          if (!this.responseType || this.responseType === 'text') {
            const text = this.responseText;
            if (text) {
              try {
                const data = JSON.parse(text);
                processDoubaoFallbackVideos(data, text, '', requestPrompt);
              } catch (e) {}
              scanTextForDirectVideoUrls(text, requestPrompt);
            }
          }
        } catch (e) {}
      }
    });
    return originalXHRSend.apply(this, args);
  };

  function scanTextForDirectVideoUrls(text, promptFallback = '') {
    if (!text || typeof text !== 'string') return;
    try {
      const patterns = [
        /\[(?:Download\s*Video|Video)\]\((https?:\/\/[^\s\)\"\'<>]+)/gi,
        /(https?:\/\/[^\s\"\'<>]+\/video\/tos\/[^\s\"\'<>]+)/gi,
        /(https?:\/\/[^\s\"\'<>]*dola\.com[^\s\"\'<>]*mime_type=video_mp4[^\s\"\'<>]*)/gi
      ];
      for (const regex of patterns) {
        let match;
        while ((match = regex.exec(text)) !== null) {
          let rawUrl = match[1] || match[0];
          rawUrl = decodeJsonEscapedFragment(rawUrl);
          if (isHttpUrl(rawUrl)) {
            const prompt = promptFallback || latestSubmittedPrompt || 'Dola Video';
            const isDynWatermark = rawUrl.includes('video_gen_watermark_dyn');
            const isStaticWatermark = !isDynWatermark && rawUrl.includes('video_gen_watermark');
            const watermarkType = isDynWatermark ? 'dynamic' : (isStaticWatermark ? 'static' : 'none');
            const definition = isDynWatermark ? 'Dynamic Watermark' : (isStaticWatermark ? 'Static Watermark' : '1080p Stream');
            addExtractedVideo({
              url: rawUrl,
              vid: rawUrl,
              source: 'chat_stream_link',
              prompt,
              watermarkType,
              definition
            });
          }
        }
      }
    } catch (e) {}
  }

  // Hook Fetch
  const originalFetch = pageWindow.fetch;
  pageWindow.fetch = async function (...args) {
    const url = args[0];
    const options = args[1] || {};
    const requestUrl = typeof url === 'string' ? url : (url?.url || '');
    const requestBody = options?.body || (typeof url === 'object' ? url.body : null);
    const requestPrompt = extractPromptFromPayload(requestBody) || latestSubmittedPrompt;

    if (requestUrl && requestUrl.includes('/im/chain/single')) {
      const response = await originalFetch.apply(this, args);
      response.clone().text().then(text => {
        try {
          const data = JSON.parse(text);
          processDoubaoFallbackVideos(data, text, '', requestPrompt);
        } catch (e) {}
      }).catch(() => {});
      return response;
    }

    if (requestUrl && requestUrl.includes('/chat/completion')) {
      const response = await originalFetch.apply(this, args);
      if (!response.body || typeof response.body.getReader !== 'function') {
        return response;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const stream = new NativeReadableStream({
        async start(controller) {
          window.dispatchEvent(new CustomEvent('DOLA_STREAM_START'));
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.substring(6).trim();
                  if (jsonStr.includes('fallback_api') || jsonStr.includes('creation_block') || jsonStr.includes('creations')) {
                    const data = JSON.parse(jsonStr);
                    processDoubaoFallbackVideos(data, jsonStr, '', requestPrompt);
                  }
                  scanTextForDirectVideoUrls(jsonStr, requestPrompt);
                } catch (e) {}
              }
            }

            controller.enqueue(value);
          }
          controller.close();
          window.dispatchEvent(new CustomEvent('DOLA_STREAM_END', {
            detail: { status: response.status, ok: response.ok }
          }));
        }
      });

      return new NativeResponse(stream, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText
      });
    }

    return originalFetch.apply(this, args);
  };

  function processDoubaoFallbackVideos(json, rawBody = '', posterUrl = '', promptFallback = '') {
    const fallbackApis = findDoubaoFallbackApis(json, rawBody);
    if (!fallbackApis.length) return;

    for (const fallbackApi of fallbackApis) {
      if (posterUrl) fallbackVideoPosterIndex.set(fallbackApi, posterUrl);
      if (processedFallbackApis.has(fallbackApi)) continue;
      processedFallbackApis.add(fallbackApi);

      getDoubaoVideoInfoFromFallbackApi(fallbackApi, promptFallback)
        .then(info => {
          if (info) {
            if (!info.poster_url) {
              info.poster_url = fallbackVideoPosterIndex.get(fallbackApi) || '';
            }
            addExtractedVideo(info);
          }
        })
        .catch(err => {
          console.warn('[Dola Extractor] Fallback API extraction error:', err);
        });
    }
  }

  function findDoubaoFallbackApis(json, rawBody = '') {
    const apis = new Set();

    for (const value of findValuesByKey(json, 'fallback_api')) {
      addFallbackApi(apis, value);
    }

    const body = typeof rawBody === 'string' ? rawBody : '';
    const patterns = [
      /fallback_api\\":\\"(.*?)\\"/g,
      /"fallback_api"\s*:\s*"([^"]+)"/g,
    ];

    for (const pattern of patterns) {
      let match = pattern.exec(body);
      while (match) {
        addFallbackApi(apis, decodeJsonEscapedFragment(match[1]));
        match = pattern.exec(body);
      }
    }

    return Array.from(apis);
  }

  function addFallbackApi(apis, value) {
    if (typeof value !== 'string' || !value) return;
    const url = decodeJsonEscapedFragment(value);
    if (isHttpUrl(url)) {
      apis.add(url);
    }
  }

  function decodeJsonEscapedFragment(value) {
    let text = value;
    for (let i = 0; i < 3; i++) {
      try {
        const decoded = JSON.parse(`"${text.replace(/"/g, '\\"')}"`);
        if (decoded === text) break;
        text = decoded;
      } catch {
        break;
      }
    }
    return text.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
  }

  function replaceQueryParams(url, params) {
    try {
      const parsedUrl = new URL(url);
      for (const [key, value] of Object.entries(params)) {
        parsedUrl.searchParams.set(key, value);
      }
      return parsedUrl.toString();
    } catch {
      return url;
    }
  }

  async function getDoubaoVideoInfoFromFallbackApi(fallbackApi, promptFallback = '') {
    // Override logo_type to unwatermarked for full 1080P raw master video
    const apiUrl = replaceQueryParams(fallbackApi, {
      channel: 'no',
      codec_type: '8',
      logo_type: 'unwatermarked',
    });

    const payload = await requestJson(apiUrl);
    const data = getVideoData(payload);
    const picked = pickMainUrlEntry(data);
    if (!picked?.token) {
      return null;
    }

    const videoUrl = await decodeMainUrl(picked.token, findKeySeedDeep(payload));
    if (!videoUrl) {
      return null;
    }

    const meta = picked.entry || {};
    const resolvedPrompt = promptFallback || latestSubmittedPrompt || data.title || meta.title || data.text || '';
    return {
      vid: data.vid || data.video_id || meta.vid || meta.video_id || apiUrl,
      source: 'fallback_api',
      width: Number(meta.vwidth || meta.width || data.vwidth || data.width || 0),
      height: Number(meta.vheight || meta.height || data.vheight || data.height || 0),
      definition: meta.definition || data.definition || '1080P Raw',
      watermarkType: 'none',
      duration: Number(meta.duration || data.duration || 0),
      codec_type: meta.codec_type || data.codec_type || '',
      poster_url: data.poster_url || data.poster || '',
      url: videoUrl,
      prompt: resolvedPrompt
    };
  }

  function requestJson(url) {
    return originalFetch.call(pageWindow, url, {
      method: 'GET',
      credentials: 'omit',
      headers: {
        accept: 'application/json,text/plain,*/*',
      },
    }).then(res => res.json());
  }

  function getVideoData(payload) {
    const videoInfo = payload?.video_info || payload?.data?.video_info || payload;
    const data = videoInfo?.data || videoInfo;
    return data && typeof data === 'object' ? data : {};
  }

  function pickMainUrlEntry(data) {
    const videoList = data?.video_list;
    const entries = videoList && typeof videoList === 'object' && Object.keys(videoList).length
      ? Object.values(videoList)
      : [data];
    let best = null;

    for (const entry of entries) {
      if (!entry || typeof entry !== 'object') continue;
      const token = entry.main_url || entry.play_url || '';
      if (typeof token !== 'string' || !token.trim()) continue;
      const score = Number(entry.bitrate || entry.real_bitrate || 0)
        + Number(entry.vwidth || entry.width || 0) * Number(entry.vheight || entry.height || 0);
      if (!best || score > best.score) {
        best = { token: token.trim(), score, entry };
      }
    }

    return best;
  }

  function findKeySeedDeep(value, depth = 0) {
    if (depth > 10 || value == null) return '';

    if (typeof value === 'string') {
      let match = value.match(/(?:^|[?&])key_seed=([^&"'<>\\\s]+)/i);
      if (match) return decodeURIComponent(match[1]);
      match = value.match(/["']key_seed["']\s*:\s*["']([^"']+)/i);
      return match ? decodeURIComponent(match[1]) : '';
    }

    if (typeof value !== 'object') return '';

    if (typeof value.key_seed === 'string' && value.key_seed.trim()) {
      return value.key_seed.trim();
    }

    for (const item of Object.values(value)) {
      const hit = findKeySeedDeep(item, depth + 1);
      if (hit) return hit;
    }

    return '';
  }

  async function decodeMainUrl(token, keySeed = '') {
    if (isHttpUrl(token)) return token;

    const plainUrl = tryDecodeBase64Url(token);
    if (plainUrl) return plainUrl;

    if (token.startsWith('qAAB') && keySeed) {
      return await decodeQaabToken(token, keySeed);
    }

    return '';
  }

  function tryDecodeBase64Url(token) {
    const bytes = base64DecodeLoose(token);
    if (!bytes) return '';
    const text = asciiUrlFromBytes(bytes);
    return isHttpUrl(text) ? text : '';
  }

  function base64DecodeLoose(text) {
    const input = String(text || '').trim();
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

  async function decodeQaabToken(token, keySeed) {
    const data = base64DecodeLoose(token);
    const seed = base64DecodeLoose(keySeed);
    if (!data || !seed) return '';

    const digest1 = await crypto.subtle.digest('SHA-512', seed.slice(0, 32));
    const salt = hexToBytes(QAAB_SALT_HEX);
    const digest2Input = concatBytes(new Uint8Array(digest1), salt);
    const digest2 = new Uint8Array(await crypto.subtle.digest('SHA-512', digest2Input));
    const key = digest2.slice(0, 16);
    const iv = digest2.slice(16, 32);
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

  async function decryptAesCbcUrl(payload, keyBytes, ivBytes) {
    if (!payload.length || payload.length % 16 !== 0) return '';

    try {
      const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-CBC', false, ['decrypt']);
      const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivBytes }, key, payload));
      const direct = asciiUrlFromBytes(plain);
      if (isHttpUrl(direct)) return direct;
      const stripped = stripPkcs7(plain);
      const url = asciiUrlFromBytes(stripped);
      return isHttpUrl(url) ? url : '';
    } catch {
      return '';
    }
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

  function findValuesByKey(value, targetKey) {
    const values = [];
    walkJsonAndStrings(value, (node) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;
      if (Object.prototype.hasOwnProperty.call(node, targetKey)) {
        values.push(node[targetKey]);
      }
    });
    return values;
  }

  function walkJsonAndStrings(value, visitor, seen = new Set()) {
    if (value == null) return;

    if (typeof value === 'string') {
      const parsed = parseJsonString(value);
      if (parsed !== null) {
        walkJsonAndStrings(parsed, visitor, seen);
      }
      return;
    }

    if (typeof value !== 'object' || seen.has(value)) return;

    seen.add(value);
    visitor(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        walkJsonAndStrings(item, visitor, seen);
      }
      return;
    }

    for (const key of Object.keys(value)) {
      walkJsonAndStrings(value[key], visitor, seen);
    }
  }

  function parseJsonString(text) {
    const trimmed = text.trim();
    if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) {
      return null;
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  // Scan initial page HTML script tags for pre-rendered fallback APIs
  function scanPageScriptTags() {
    try {
      const scriptElement = document.querySelector(
        'script[data-script-src="modern-run-router-data-fn"], script[data-script-src="modern-run-window-fn"][data-fn-name="mergeLoaderData"]'
      );
      if (scriptElement) {
        const dataFnArgs = scriptElement.getAttribute('data-fn-args');
        if (dataFnArgs) {
          const jsonStr = dataFnArgs.replace(/&quot;/g, '"');
          const jsonData = JSON.parse(jsonStr);
          processDoubaoFallbackVideos(jsonData, jsonStr);
        }
      }
    } catch (e) {}
  }

  // Dedicated helper to locate Dola's send button reliably (never targets message bubble copy buttons)
  function findDolaSendButton(allowDisabled = false) {
    // 1. Exact ID match (Dola's primary send button)
    const exactIdBtn = document.getElementById('flow-end-msg-send');
    if (exactIdBtn) {
      if (allowDisabled) return exactIdBtn;
      const isAriaDisabled = exactIdBtn.getAttribute('aria-disabled') === 'true';
      const isDataDisabled = exactIdBtn.getAttribute('data-disabled') === 'true';
      if (!exactIdBtn.disabled && !isAriaDisabled && !isDataDisabled) return exactIdBtn;
    }

    // 2. Chat input container send button only
    const editorEl = document.querySelector('.tiptap.ProseMirror');
    const inputContainer = editorEl ? editorEl.closest('.chat-input, [class*="chat-input"], form, [class*="relative"]') : null;
    if (inputContainer) {
      const btn = inputContainer.querySelector('button[id*="send"], button[class*="send"], button[aria-label*="send" i]');
      if (btn) {
        if (allowDisabled) return btn;
        if (!btn.disabled && btn.getAttribute('aria-disabled') !== 'true') return btn;
      }
    }

    return null;
  }

  function dolaSubmitMessage(retries = 35, delay = 120) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const sendBtn = findDolaSendButton(false);

      if (sendBtn) {
        clearInterval(interval);
        sendBtn.click();

        // Also call React onClick handler if available as a failsafe
        const reactKey = Object.keys(sendBtn).find(k => k.startsWith('__reactProps'));
        if (reactKey && typeof sendBtn[reactKey]?.onClick === 'function') {
          try {
            sendBtn[reactKey].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
          } catch (e) {}
        }

        console.log('[Dola Extractor] Successfully submitted message via send button:', sendBtn.id || sendBtn.className);
        return;
      }

      // If button exists but is still disabled, nudge React state with an input event
      const editorEl = document.querySelector('.tiptap.ProseMirror');
      if (editorEl) {
        editorEl.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: ' '
        }));
      }

      if (attempts >= retries) {
        clearInterval(interval);
        const forcedBtn = findDolaSendButton(true);
        if (forcedBtn) {
          try {
            forcedBtn.disabled = false;
            forcedBtn.setAttribute('aria-disabled', 'false');
            forcedBtn.setAttribute('data-disabled', 'false');
          } catch (e) {}
          forcedBtn.click();
          const reactKey = Object.keys(forcedBtn).find(k => k.startsWith('__reactProps'));
          if (reactKey && typeof forcedBtn[reactKey]?.onClick === 'function') {
            try {
              forcedBtn[reactKey].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
            } catch (e) {}
          }
          console.log('[Dola Extractor] Force-clicked send button after max retries');
        }
      }
    }, delay);
  }

  function attachAutomationListeners() {
    // 1. Handle requests from content script
    if (window.__DOLA_MEDIA_LISTENER__) {
      window.removeEventListener('DOLA_GET_CHAT_MEDIA', window.__DOLA_MEDIA_LISTENER__);
    }
    window.__DOLA_MEDIA_LISTENER__ = () => {
      window.dispatchEvent(new CustomEvent('DOLA_CHAT_MEDIA_RESPONSE', {
        detail: { videos: extractedVideos }
      }));
    };
    window.addEventListener('DOLA_GET_CHAT_MEDIA', window.__DOLA_MEDIA_LISTENER__);

    // 2. Click New Chat button
    if (window.__DOLA_NEW_CHAT_LISTENER__) {
      window.removeEventListener('DOLA_CLICK_NEW_CHAT', window.__DOLA_NEW_CHAT_LISTENER__);
    }
    window.__DOLA_NEW_CHAT_LISTENER__ = () => {
      try {
        const items = Array.from(document.querySelectorAll('.group\\/sidebar_nav_item, [class*="sidebar_nav_item"], .nav-link-IkIer0'));
        const newChatItem = items.find(el => el.textContent && el.textContent.includes('New Chat'));
        if (newChatItem) {
          newChatItem.click();
          const reactKey = Object.keys(newChatItem).find(k => k.startsWith('__reactProps'));
          if (reactKey && typeof newChatItem[reactKey]?.onClick === 'function') {
            try {
              newChatItem[reactKey].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
            } catch (e) {}
          }
          console.log('[Dola Extractor] Clicked New Chat navigation item');
        } else {
          const anyNewChat = Array.from(document.querySelectorAll('a, button, div')).find(el =>
            el.textContent && el.textContent.trim().startsWith('New Chat') && el.offsetHeight > 0
          );
          if (anyNewChat) {
            anyNewChat.click();
            console.log('[Dola Extractor] Clicked fallback New Chat button');
          }
        }
      } catch (err) {
        console.warn('[Dola Extractor] Click New Chat error:', err);
      }
    };
    window.addEventListener('DOLA_CLICK_NEW_CHAT', window.__DOLA_NEW_CHAT_LISTENER__);

    /**
     * Editor Locator Heuristic
     * Traverses the DOM hierarchy to resolve Dola's active rich-text input container.
     * Evaluates multiple CSS selector signatures in priority order:
     * 1. `.tiptap.ProseMirror`: Standard Tiptap ProseMirror contenteditable instance exposing `editorEl.editor`.
     * 2. `div[contenteditable="true"][role="textbox"]`: Accessible ARIA textbox implementation.
     * 3. `.chat-input [contenteditable="true"]`: Scoped chat container wrapper fallback.
     * 4. Generic `div[contenteditable="true"]`: Unscoped fallback for layout variants.
     */
    function findDolaEditor() {
      return document.querySelector('.tiptap.ProseMirror') ||
             document.querySelector('div[contenteditable="true"][role="textbox"]') ||
             document.querySelector('.chat-input [contenteditable="true"]') ||
             document.querySelector('div[contenteditable="true"]');
    }

    /**
     * Asynchronous Editor Polling Monitor
     * Polls the DOM at 120ms intervals until the editor mounts or timeout occurs.
     * Essential for React hydration cycles when transitioning across virtual routes or new chat tabs.
     * @param {number} timeoutMs - Maximum acquisition budget before failing gracefully.
     * @returns {Promise<HTMLElement|null>} Resolves with DOM node or null.
     */
    async function waitForDolaEditor(timeoutMs = 8000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const el = findDolaEditor();
        if (el) return el;
        await new Promise(r => setTimeout(r, 120));
      }
      return null;
    }

    /**
     * Unified Content Injection Engine
     * Handles programmatic text and structured node injection into Dola's Tiptap editor.
     * Employs a dual-strategy architecture:
     * 
     * Strategy A (ProseMirror Transaction Pipeline):
     * When `editorEl.editor` is exposed, leverages ProseMirror's transaction pipeline:
     * 1. Clears current document node state (`ed.commands.clearContent()`).
     * 2. If `useSlashGenerateVideo` is active:
     *    - Injects character tokens for `/generate video` to prime suggestion triggers.
     *    - Constructs an atomic `mention` schema node with `external_skill_id: '294222337297'`.
     *    - Splits the block (`splitBlock()`) to force a clean paragraph boundary.
     *    - Injects multi-line prompt text formatted as `<p>` HTML elements to preserve linefeeds.
     * 3. If raw/verbatim mode:
     *    - Maps lines directly to `<p>` paragraphs via `setContent()`, bypassing mention injection.
     * 
     * Strategy B (Native DOM ContentEditable Fallback):
     * Used when the ProseMirror instance is unexposed or uninitialized:
     * Focuses element, executes `document.execCommand('selectAll')`, and applies `insertText`.
     * 
     * Post-Condition Synchronization:
     * Dispatches synthetic `InputEvent` (`inputType: 'insertText'`) to notify React synthetic event
     * listeners and synchronize internal component state.
     *
     * @param {HTMLElement} editorEl - Target contenteditable DOM container.
     * @param {string} content - Raw or formatted text payload.
     * @param {boolean} isBatch - Whether payload represents a batch generation sequence.
     * @param {boolean} useSlashGenerateVideo - Whether to construct and prepend the video skill mention node.
     * @returns {Promise<boolean>} True on verified injection.
     */
    async function injectContentIntoEditor(editorEl, content, isBatch = false, useSlashGenerateVideo = false) {
      if (!editorEl) return false;
      const ed = editorEl.editor;

      if (ed) {
        ed.commands.clearContent();
        ed.commands.focus();
        await new Promise(r => setTimeout(r, 150));

        if (isBatch && useSlashGenerateVideo) {
          const textToType = '/generate video';
          for (const char of textToType) {
            ed.commands.insertContent(char);
            await new Promise(r => setTimeout(r, 45));
          }
          await new Promise(r => setTimeout(r, 180));

          const mentionProps = {
            id: 'creative-video',
            label: 'Generate Videos',
            mentionSuggestionChar: '/',
            mentionType: 'skill',
            skillId: 'creative-video',
            external_skill_id: '294222337297',
            display_name: 'Generate Videos',
            skill_type: 2,
            description: 'Create commercials, talking-head videos, and product promos'
          };

          ed.commands.clearContent();
          ed.commands.insertContent({
            type: 'mention',
            attrs: mentionProps
          });
          ed.commands.insertContent(' ');
          await new Promise(r => setTimeout(r, 220));

          ed.commands.focus('end');
          if (typeof ed.commands.splitBlock === 'function') {
            ed.commands.splitBlock();
          } else {
            ed.commands.insertContent('\n');
          }
          await new Promise(r => setTimeout(r, 220));

          const lines = String(content || '').split('\n');
          const contentHtml = lines.map(l => `<p>${escapeText(l) || '<br>'}</p>`).join('');
          ed.commands.insertContent(contentHtml);
          ed.commands.focus('end');
        } else {
          const lines = String(content || '').split('\n');
          const html = lines.map(l => `<p>${escapeText(l) || '<br>'}</p>`).join('');
          ed.commands.setContent(html);
          ed.commands.focus('end');
        }
      } else {
        // Native DOM contenteditable fallback
        editorEl.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, content);
      }

      await new Promise(r => setTimeout(r, 200));
      editorEl.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
        data: ' '
      }));

      // Validation check
      const currentText = editorEl.innerText || editorEl.textContent || '';
      if (!currentText.trim() && content.trim()) {
        console.warn('[Dola Extractor] Editor text verification failed, applying direct text fallback');
        editorEl.innerText = content;
        editorEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true }));
      }

      return true;
    }

    // 3. Inject message into Tiptap editor and submit
    if (window.__DOLA_INJECT_LISTENER__) {
      window.removeEventListener('DOLA_INJECT_AND_SEND', window.__DOLA_INJECT_LISTENER__);
    }
    window.__DOLA_INJECT_LISTENER__ = async (event) => {
      try {
        const text = event?.detail?.text || '';
        if (!text) return;
        latestSubmittedPrompt = cleanUserPrompt(text);

        window.dispatchEvent(new CustomEvent('DOLA_USER_PROMPT_SUBMITTED', {
          detail: { prompt: latestSubmittedPrompt }
        }));

        const editorEl = await waitForDolaEditor(8000);
        if (!editorEl) {
          console.warn('[Dola Extractor] Chat editor element not found after waiting');
          return;
        }

        await injectContentIntoEditor(editorEl, text, false, false);
        await new Promise(r => setTimeout(r, 350));
        dolaSubmitMessage(35, 120);
      } catch (err) {
        console.warn('[Dola Extractor] Inject and send error:', err);
      }
    };
    window.addEventListener('DOLA_INJECT_AND_SEND', window.__DOLA_INJECT_LISTENER__);

    // 4. Batch inject with /generate video mention skill
    if (window.__DOLA_BATCH_LISTENER__) {
      window.removeEventListener('DOLA_INJECT_AND_SEND_BATCH', window.__DOLA_BATCH_LISTENER__);
    }
    window.__DOLA_BATCH_LISTENER__ = async (event) => {
      try {
        const detail = event?.detail || {};
        const promptsBlock = detail.promptsBlock || '';
        const promptsList = detail.promptsList || [];
        if (!promptsBlock) return;

        activeBatchPrompts = promptsList.map(p => cleanUserPrompt(p));
        nextBatchPromptIndex = 0;
        if (activeBatchPrompts.length > 0) {
          latestSubmittedPrompt = activeBatchPrompts[0];
        }

        window.dispatchEvent(new CustomEvent('DOLA_USER_PROMPT_SUBMITTED', {
          detail: { prompt: latestSubmittedPrompt, promptsList: activeBatchPrompts }
        }));

        const editorEl = await waitForDolaEditor(8000);
        if (!editorEl) {
          console.warn('[Dola Extractor] Chat editor element not found for batch');
          return;
        }

        await injectContentIntoEditor(editorEl, promptsBlock, true, detail.useSlashGenerateVideo !== false);
        await new Promise(r => setTimeout(r, 400));
        dolaSubmitMessage(35, 120);
      } catch (err) {
        console.warn('[Dola Extractor] Batch inject error:', err);
      }
    };
    window.addEventListener('DOLA_INJECT_AND_SEND_BATCH', window.__DOLA_BATCH_LISTENER__);

    // 5. Direct paste into chat input without submitting
    if (window.__DOLA_PASTE_ONLY_LISTENER__) {
      window.removeEventListener('DOLA_PASTE_PROMPTS_ONLY', window.__DOLA_PASTE_ONLY_LISTENER__);
    }
    window.__DOLA_PASTE_ONLY_LISTENER__ = async (event) => {
      try {
        const detail = event?.detail || {};
        const promptsBlock = detail.promptsBlock || '';
        const promptsList = detail.promptsList || [];
        if (!promptsBlock) return;

        activeBatchPrompts = promptsList.map(p => cleanUserPrompt(p));
        if (activeBatchPrompts.length > 0) {
          latestSubmittedPrompt = activeBatchPrompts[0];
        }

        const editorEl = await waitForDolaEditor(8000);
        if (!editorEl) {
          console.warn('[Dola Extractor] Chat editor element not found for paste');
          window.dispatchEvent(new CustomEvent('DOLA_PASTE_PROMPTS_RESULT', { detail: { ok: false, error: 'Chat editor not found' } }));
          return;
        }

        const isBatch = detail.isBatch === true;
        const useSlash = detail.useSlashGenerateVideo === true;
        await injectContentIntoEditor(editorEl, promptsBlock, isBatch, useSlash);
        window.dispatchEvent(new CustomEvent('DOLA_PASTE_PROMPTS_RESULT', { detail: { ok: true, count: promptsList.length || 1 } }));
      } catch (err) {
        console.warn('[Dola Extractor] Paste prompts error:', err);
        window.dispatchEvent(new CustomEvent('DOLA_PASTE_PROMPTS_RESULT', { detail: { ok: false, error: err.message } }));
      }
    };
    window.addEventListener('DOLA_PASTE_PROMPTS_ONLY', window.__DOLA_PASTE_ONLY_LISTENER__);

    // 6. Auto-continue stalled batch generation
    if (window.__DOLA_AUTO_CONTINUE_LISTENER__) {
      window.removeEventListener('DOLA_AUTO_CONTINUE_BATCH', window.__DOLA_AUTO_CONTINUE_LISTENER__);
    }
    window.__DOLA_AUTO_CONTINUE_LISTENER__ = async (event) => {
      try {
        const detail = event?.detail || {};
        const text = detail.customMessage || 'Please continue generating the remaining videos.';
        latestSubmittedPrompt = cleanUserPrompt(text);

        console.log('[Dola Extractor] 🔄 Auto-resuming batch with continuation prompt:', text);

        const editorEl = await waitForDolaEditor(8000);
        if (!editorEl) {
          console.warn('[Dola Extractor] Chat editor not found for auto-continuation');
          return;
        }

        await injectContentIntoEditor(editorEl, text, false, false);
        await new Promise(r => setTimeout(r, 350));
        dolaSubmitMessage(35, 120);

        window.dispatchEvent(new CustomEvent('DOLA_AUTO_CONTINUE_SENT', {
          detail: { text, timestamp: Date.now() }
        }));
      } catch (err) {
        console.warn('[Dola Extractor] Auto-continue execution error:', err);
      }
    };
    window.addEventListener('DOLA_AUTO_CONTINUE_BATCH', window.__DOLA_AUTO_CONTINUE_LISTENER__);
  }

  // Initial attachment of automation listeners
  attachAutomationListeners();

  // Manual prompt capture from page DOM
  function captureManualPromptFromPage() {
    try {
      let text = '';
      const editorEl = document.querySelector('.tiptap.ProseMirror');
      if (editorEl) {
        text = editorEl.innerText || editorEl.textContent || '';
      } else {
        const active = document.activeElement;
        if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')) {
          text = active.value;
        }
      }
      const cleaned = cleanUserPrompt(text);
      if (cleaned && cleaned.length > 2) {
        latestSubmittedPrompt = cleaned;
        window.dispatchEvent(new CustomEvent('DOLA_USER_PROMPT_SUBMITTED', {
          detail: { prompt: cleaned }
        }));
      }
    } catch {}
  }

  // Intercept Enter key inside the editor for manual prompt submissions
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      captureManualPromptFromPage();
    }
  }, true);

  // Intercept send button clicks for manual prompt submissions
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!target) return;
    const btn = target.closest('button');
    if (btn) {
      const isSend = btn.id === 'flow-end-msg-send' ||
        btn.id.includes('send') ||
        btn.className.includes('send-msg-btn') ||
        btn.className.includes('bg-g-send-msg-btn') ||
        btn.getAttribute('aria-label')?.toLowerCase().includes('send');
      if (isSend) {
        captureManualPromptFromPage();
      }
    }
  }, true);

  // Run initial scan
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanPageScriptTags);
  } else {
    scanPageScriptTags();
  }
})();