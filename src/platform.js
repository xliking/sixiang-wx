(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  const isWechat = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';

  // 横屏 16:9 标准逻辑分辨率（清晰宽阔，完美呈现横版两军对垒大地图）
  const LOGICAL_W = 960;
  const LOGICAL_H = 540;

  // 微信激励视频广告位配置（上线时替换为真实 adUnitId）
  const AD_UNIT_IDS = {
    stamina: 'adunit-sixiang-stamina',
    recruit_retry: 'adunit-sixiang-recruit',
    golden_rope: 'adunit-sixiang-rope',
    double_reward: 'adunit-sixiang-reward',
    arena_ticket: 'adunit-sixiang-arena',
  };

  let canvas = null;
  let ctx = null;
  let dpr = 1;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let screenW = LOGICAL_W;
  let screenH = LOGICAL_H;
  let appHidden = false;
  const visibilityListeners = [];

  const adOverlay = {
    active: false,
    scene: '',
    title: '',
    rewardText: '',
    timer: 0,
    duration: 2.0,
    onSuccess: null,
    onCancel: null,
  };

  // 微信真机键盘输入顶栏提示（解决 wx.showKeyboard 无标题提示、盲打及关闭漏解绑问题）
  const inputOverlay = {
    active: false,
    title: '',
    value: '',
    maxLength: 40,
    submit: null,
    cancel: null,
  };
  let cleanupActiveKeyboard = null;

  function notifyDirty() {
    if (App.Main && typeof App.Main.markDirty === 'function') App.Main.markDirty();
  }

  function emitVisibility(visible) {
    for (let i = 0; i < visibilityListeners.length; i++) {
      try { visibilityListeners[i](visible); } catch (e) {}
    }
    if (visible) notifyDirty();
  }

  function onVisibilityChange(fn) {
    if (typeof fn === 'function') visibilityListeners.push(fn);
  }

  // 微信本地文件系统目录初始化（大配置缓存 & 带版本哈希的图片持久化缓存）
  let wxFs = null;
  let cfgCacheDir = '';
  let resCacheDir = '';
  let cachedResFiles = null;

  function initWechatFs() {
    if (!isWechat || wxFs || typeof wx.getFileSystemManager !== 'function' || !wx.env || !wx.env.USER_DATA_PATH) return;
    try {
      wxFs = wx.getFileSystemManager();
      cfgCacheDir = wx.env.USER_DATA_PATH + '/cfg_cache';
      resCacheDir = wx.env.USER_DATA_PATH + '/res_cache';
      try { wxFs.mkdirSync(cfgCacheDir, true); } catch (e) {}
      try { wxFs.mkdirSync(resCacheDir, true); } catch (e) {}
      cachedResFiles = new Set();
      try {
        const files = wxFs.readdirSync(resCacheDir) || [];
        for (let i = 0; i < files.length; i++) cachedResFiles.add(files[i]);
      } catch (e) {}
    } catch (e) {
      wxFs = null;
    }
  }

  function initCanvas() {
    initWechatFs();
    if (isWechat) {
      const sys = wx.getSystemInfoSync();
      dpr = Math.min(sys.pixelRatio || 2, 3);
      screenW = sys.windowWidth;
      screenH = sys.windowHeight;
      canvas = wx.createCanvas();
      canvas.width = Math.round(screenW * dpr);
      canvas.height = Math.round(screenH * dpr);
      if (typeof wx.onWindowResize === 'function') {
        wx.onWindowResize((res) => {
          const w = (res && res.windowWidth) || screenW;
          const h = (res && res.windowHeight) || screenH;
          if (w > 0 && h > 0) {
            screenW = w;
            screenH = h;
            canvas.width = Math.round(screenW * dpr);
            canvas.height = Math.round(screenH * dpr);
            recalcTransform();
            notifyDirty();
          }
        });
      }
      if (typeof wx.onHide === 'function') {
        wx.onHide(() => { appHidden = true; emitVisibility(false); });
      }
      if (typeof wx.onShow === 'function') {
        wx.onShow(() => { appHidden = false; emitVisibility(true); });
      }
    } else {
      canvas = document.getElementById('gameCanvas');
      const rect = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 2, 3);
      screenW = rect.width;
      screenH = rect.height;
      canvas.width = Math.round(screenW * dpr);
      canvas.height = Math.round(screenH * dpr);
      if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('visibilitychange', () => {
          appHidden = !!document.hidden;
          emitVisibility(!appHidden);
        });
      }
    }
    ctx = canvas.getContext('2d');
    recalcTransform();
    return { canvas, ctx };
  }

  function recalcTransform() {
    if (!isWechat && canvas && canvas.parentElement) {
      const rect = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 2, 3);
      screenW = rect.width;
      screenH = rect.height;
      canvas.width = Math.round(screenW * dpr);
      canvas.height = Math.round(screenH * dpr);
    }
    scale = Math.min(screenW / LOGICAL_W, screenH / LOGICAL_H);
    offsetX = (screenW - LOGICAL_W * scale) / 2;
    offsetY = (screenH - LOGICAL_H * scale) / 2;
    notifyDirty();
  }

  function beginFrame() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#1b140d';
    ctx.fillRect(0, 0, screenW, screenH);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.clip();
  }

  function endFrame() {
    ctx.restore();
  }

  function clientToLogical(clientX, clientY) {
    if (isWechat) {
      return { x: (clientX - offsetX) / scale, y: (clientY - offsetY) / scale };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  function bindPointerEvents(handlers) {
    let dragging = false;
    let startPt = null;

    if (isWechat) {
      wx.onTouchStart((e) => {
        if (!e.touches || !e.touches.length) return;
        const pt = clientToLogical(e.touches[0].clientX, e.touches[0].clientY);
        dragging = true;
        startPt = pt;
        if (handlers.onDown) handlers.onDown(pt.x, pt.y);
      });
      wx.onTouchMove((e) => {
        if (!dragging || !e.touches || !e.touches.length) return;
        const pt = clientToLogical(e.touches[0].clientX, e.touches[0].clientY);
        if (handlers.onMove) handlers.onMove(pt.x, pt.y, startPt);
      });
      wx.onTouchEnd((e) => {
        const t = (e.changedTouches && e.changedTouches[0]) || null;
        const pt = t ? clientToLogical(t.clientX, t.clientY) : startPt || { x: 0, y: 0 };
        dragging = false;
        if (handlers.onUp) handlers.onUp(pt.x, pt.y, startPt);
      });
      if (typeof wx.onTouchCancel === 'function') {
        wx.onTouchCancel(() => {
          dragging = false;
          startPt = null;
          notifyDirty();
        });
      }
    } else {
      const getPos = (e) => {
        if (e.touches && e.touches.length) return clientToLogical(e.touches[0].clientX, e.touches[0].clientY);
        if (e.changedTouches && e.changedTouches.length) return clientToLogical(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        return clientToLogical(e.clientX, e.clientY);
      };
      canvas.addEventListener('pointerdown', (e) => {
        const pt = getPos(e);
        dragging = true;
        startPt = pt;
        if (handlers.onDown) handlers.onDown(pt.x, pt.y);
      });
      window.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const pt = getPos(e);
        if (handlers.onMove) handlers.onMove(pt.x, pt.y, startPt);
      });
      window.addEventListener('pointerup', (e) => {
        if (!dragging) return;
        dragging = false;
        const pt = getPos(e);
        if (handlers.onUp) handlers.onUp(pt.x, pt.y, startPt);
      });
      window.addEventListener('resize', recalcTransform);
    }
  }

  function createImage() {
    if (isWechat) return wx.createImage();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    return img;
  }

  function createOffscreen(w, h) {
    const cw = Math.max(1, Math.round(w));
    const ch = Math.max(1, Math.round(h));
    if (isWechat) {
      if (typeof wx.createOffscreenCanvas === 'function') {
        try {
          const off = wx.createOffscreenCanvas({ type: '2d', width: cw, height: ch });
          if (off && off.getContext('2d')) return off;
        } catch (e) {}
      }
      if (typeof wx.createCanvas === 'function') {
        const c = wx.createCanvas();
        c.width = cw;
        c.height = ch;
        return c;
      }
    }
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      return c;
    }
    return null;
  }

  function saveStorage(key, value) {
    try {
      const raw = JSON.stringify(value);
      if (isWechat) wx.setStorageSync(key, raw);
      else window.localStorage.setItem(key, raw);
    } catch (e) {}
  }

  function loadStorage(key) {
    try {
      const raw = isWechat ? wx.getStorageSync(key) : window.localStorage.getItem(key);
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) { return null; }
  }

  function clearStorage(key) {
    try {
      if (isWechat) wx.removeStorageSync(key);
      else window.localStorage.removeItem(key);
    } catch (e) {}
  }

  // 大体积 JSON 缓存（避免 stageGenerals 等超过微信 setStorageSync 单键 1MB 上限）
  function safeCacheName(key) {
    return String(key).replace(/[^a-zA-Z0-9_.-]/g, '_');
  }

  function saveLargeCache(key, value) {
    initWechatFs();
    if (wxFs && cfgCacheDir) {
      try {
        const filePath = cfgCacheDir + '/' + safeCacheName(key) + '.json';
        const raw = JSON.stringify(value);
        wxFs.writeFile({
          filePath,
          data: raw,
          encoding: 'utf8',
          fail: () => saveStorage(key, value),
        });
        try { wx.removeStorageSync(key); } catch (e) {}
        return;
      } catch (e) {}
    }
    saveStorage(key, value);
  }

  function loadLargeCache(key) {
    initWechatFs();
    if (wxFs && cfgCacheDir) {
      try {
        const filePath = cfgCacheDir + '/' + safeCacheName(key) + '.json';
        const raw = wxFs.readFileSync(filePath, 'utf8');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }
    return loadStorage(key);
  }

  // 带版本哈希的远程图片本地文件缓存（启动仅 1 次 readdirSync，O(1) 命中磁盘，自动清理旧版文件）
  function getCachedAssetPath(fileName) {
    initWechatFs();
    if (!wxFs || !resCacheDir || !cachedResFiles || !fileName) return null;
    return cachedResFiles.has(fileName) ? (resCacheDir + '/' + fileName) : null;
  }

  function cacheRemoteAsset(url, fileName) {
    initWechatFs();
    if (!isWechat || !wxFs || !resCacheDir || !fileName || typeof wx.downloadFile !== 'function') {
      return Promise.resolve(url);
    }
    if (cachedResFiles && cachedResFiles.has(fileName)) {
      return Promise.resolve(resCacheDir + '/' + fileName);
    }
    const targetPath = resCacheDir + '/' + fileName;
    return new Promise((resolve) => {
      wx.downloadFile({
        url,
        filePath: targetPath,
        timeout: 10000,
        success: (res) => {
          if (res && res.statusCode === 200) {
            if (cachedResFiles) cachedResFiles.add(fileName);
            resolve(res.filePath || targetPath);
          } else {
            resolve(url);
          }
        },
        fail: () => resolve(url),
      });
    });
  }

  function pruneCachedAssets(validFileNames) {
    initWechatFs();
    if (!wxFs || !resCacheDir || !cachedResFiles || !(validFileNames instanceof Set)) return;
    const stale = [];
    cachedResFiles.forEach((f) => {
      if (!validFileNames.has(f)) stale.push(f);
    });
    stale.forEach((f) => {
      cachedResFiles.delete(f);
      try { wxFs.unlink({ filePath: resCacheDir + '/' + f }); } catch (e) {}
    });
  }

  function showRewardedAd(scene, rewardText, onSuccessRaw, onCancel) {
    const onSuccess = onSuccessRaw;
    const adUnitId = AD_UNIT_IDS[scene] || AD_UNIT_IDS.stamina;
    if (isWechat && typeof wx.createRewardedVideoAd === 'function' && !adUnitId.startsWith('adunit-sixiang-')) {
      try {
        const videoAd = wx.createRewardedVideoAd({ adUnitId });
        const closeHandler = (res) => {
          videoAd.offClose(closeHandler);
          if ((res && res.isEnded) || res === undefined) {
            if (onSuccess) onSuccess();
          } else if (onCancel) onCancel();
        };
        videoAd.onClose(closeHandler);
        videoAd.show().catch(() => {
          videoAd.load().then(() => videoAd.show()).catch(() => openSimulatedAd(scene, rewardText, onSuccess, onCancel));
        });
        return;
      } catch (err) {}
    }
    openSimulatedAd(scene, rewardText, onSuccess, onCancel);
  }

  // 文本输入（兑换码、名号、联盟公告、集市上架等）：微信用系统键盘 + 顶栏实时预览浮层，浏览器用 prompt
  function promptText(title, onConfirm, opts) {
    const options = opts || {};
    let maxLen = options.maxLength;
    if (!maxLen) {
      const m = /(\d+)\s*个字/.exec(String(title || ''));
      maxLen = m ? Math.max(8, Number(m[1])) : 48;
    }
    const defVal = options.defaultValue ? String(options.defaultValue) : '';
    if (isWechat && typeof wx.showKeyboard === 'function') {
      if (cleanupActiveKeyboard) cleanupActiveKeyboard();
      let settled = false;
      const onInput = (res) => {
        inputOverlay.value = (res && res.value != null) ? String(res.value) : '';
        notifyDirty();
      };
      const finish = (doSubmit, rawVal) => {
        if (settled) return;
        settled = true;
        cleanup();
        try { wx.hideKeyboard({}); } catch (e) {}
        if (doSubmit) {
          const val = String(rawVal != null ? rawVal : inputOverlay.value || '').trim();
          if (val && onConfirm) onConfirm(val);
        }
      };
      const onConfirmKb = (res) => finish(true, res && res.value != null ? res.value : inputOverlay.value);
      const onCompleteKb = () => {
        if (!settled) {
          settled = true;
          cleanup();
        }
      };
      const cleanup = () => {
        try { if (typeof wx.offKeyboardInput === 'function') wx.offKeyboardInput(onInput); } catch (e) {}
        try { if (typeof wx.offKeyboardConfirm === 'function') wx.offKeyboardConfirm(onConfirmKb); } catch (e) {}
        try { if (typeof wx.offKeyboardComplete === 'function') wx.offKeyboardComplete(onCompleteKb); } catch (e) {}
        inputOverlay.active = false;
        inputOverlay.submit = null;
        inputOverlay.cancel = null;
        cleanupActiveKeyboard = null;
        notifyDirty();
      };
      cleanupActiveKeyboard = () => finish(false);
      inputOverlay.active = true;
      inputOverlay.title = title || '请输入内容';
      inputOverlay.value = defVal;
      inputOverlay.maxLength = maxLen;
      inputOverlay.submit = () => finish(true, inputOverlay.value);
      inputOverlay.cancel = () => finish(false);
      if (typeof wx.onKeyboardInput === 'function') wx.onKeyboardInput(onInput);
      wx.onKeyboardConfirm(onConfirmKb);
      if (typeof wx.onKeyboardComplete === 'function') wx.onKeyboardComplete(onCompleteKb);
      wx.showKeyboard({ defaultValue: defVal, maxLength: maxLen, multiple: false, confirmHold: false, confirmType: 'done' });
      notifyDirty();
    } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      const v = window.prompt(title, defVal);
      if (v) onConfirm(v.trim());
    }
  }

  function copyText(text) {
    try {
      if (isWechat && typeof wx.setClipboardData === 'function') wx.setClipboardData({ data: text });
      else if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
  }

  // 分享：微信内拉起转发面板（query 里带邀请人 ID）；浏览器里没有转发，改为复制邀请文案
  function share(title, query) {
    if (isWechat && typeof wx.shareAppMessage === 'function') {
      wx.shareAppMessage({ title, query });
      return true;
    }
    copyText(title + (query ? '（' + query + '）' : ''));
    return false;
  }

  // 右上角菜单的「转发」也带上邀请参数
  function setupShareMenu(getInfo) {
    if (!isWechat) return;
    try {
      if (typeof wx.showShareMenu === 'function') wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] });
      if (typeof wx.onShareAppMessage === 'function') wx.onShareAppMessage(() => getInfo());
    } catch (e) {}
  }

  // 启动参数（从好友分享的卡片进入时带有 inviter）
  function getLaunchQuery() {
    try {
      if (isWechat && typeof wx.getLaunchOptionsSync === 'function') return wx.getLaunchOptionsSync().query || {};
      if (typeof location !== 'undefined' && typeof URLSearchParams === 'function') {
        const out = {};
        new URLSearchParams(location.search).forEach((v, k) => { out[k] = v; });
        return out;
      }
    } catch (e) {}
    return {};
  }

  function openSimulatedAd(scene, rewardText, onSuccess, onCancel) {
    adOverlay.active = true;
    adOverlay.scene = scene;
    adOverlay.title = '军需官特批犒赏';
    adOverlay.rewardText = rewardText || '正在为您筹备军需福利';
    adOverlay.timer = 0;
    adOverlay.duration = 1.8;
    adOverlay.onSuccess = onSuccess;
    adOverlay.onCancel = onCancel;
  }

  function openWechatPrivacyContract(onFail) {
    if (isWechat && typeof wx.openPrivacyContract === 'function') {
      wx.openPrivacyContract({
        fail: () => { if (onFail) onFail(); },
      });
      return true;
    }
    if (onFail) onFail();
    return false;
  }

  function exitMiniProgram() {
    if (isWechat && typeof wx.exitMiniProgram === 'function') {
      try { wx.exitMiniProgram({}); return true; } catch (e) {}
    }
    return false;
  }

  // 微信一次性订阅消息授权（必须在用户点击事件同步栈中调用；自动对传入 tmplIds 去重以防同名过滤）
  function requestSubscribe(tmplIds, onResult) {
    const ids = Array.from(new Set((tmplIds || []).map((x) => String(x || '').trim()).filter(Boolean))).slice(0, 3);
    if (!ids.length) {
      if (onResult) onResult({ ok: false, accepted: [], error: 'empty_tmpl_ids' });
      return;
    }
    if (isWechat && typeof wx.requestSubscribeMessage === 'function') {
      try {
        wx.requestSubscribeMessage({
          tmplIds: ids,
          success: (res) => {
            const accepted = ids.filter((id) => res && res[id] === 'accept');
            const rejected = ids.filter((id) => res && (res[id] === 'reject' || res[id] === 'ban'));
            const filtered = ids.filter((id) => res && res[id] === 'filter');
            if (onResult) onResult({ ok: accepted.length > 0, accepted, rejected, filtered, raw: res });
          },
          fail: (err) => {
            if (onResult) onResult({ ok: false, accepted: [], error: (err && err.errMsg) || 'subscribe_fail' });
          },
        });
        return;
      } catch (e) {
        if (onResult) onResult({ ok: false, accepted: [], error: String(e) });
        return;
      }
    }
    // 浏览器本地联调环境模拟授权同意，便于端到端验证配额上报链路
    if (onResult) onResult({ ok: true, accepted: ids, simulated: true });
  }

  function updateAdOverlay(dt) {
    if (!adOverlay.active) return;
    adOverlay.timer += dt;
    if (adOverlay.timer >= adOverlay.duration) {
      const cb = adOverlay.onSuccess;
      adOverlay.active = false;
      adOverlay.onSuccess = null;
      adOverlay.onCancel = null;
      if (cb) cb();
    }
  }

  function vibrateShort(type) {
    if (App.Settings && !App.Settings.get('vibrate')) return;
    try {
      if (isWechat && typeof wx.vibrateShort === 'function') {
        wx.vibrateShort({ type: type || 'light' });
      } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(type === 'heavy' ? 28 : 14);
      }
    } catch (e) {}
  }

  function requestFrame(cb) {
    return typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(() => cb(Date.now()), 16);
  }

  App.Platform = {
    isWechat, LOGICAL_W, LOGICAL_H, AD_UNIT_IDS, adOverlay, inputOverlay,
    isHidden: () => appHidden, onVisibilityChange,
    initCanvas, recalcTransform, beginFrame, endFrame, bindPointerEvents, createImage, createOffscreen,
    saveStorage, loadStorage, clearStorage, saveLargeCache, loadLargeCache,
    getCachedAssetPath, cacheRemoteAsset, pruneCachedAssets,
    showRewardedAd, updateAdOverlay, promptText, copyText, share, setupShareMenu, getLaunchQuery, vibrateShort,
    openWechatPrivacyContract, exitMiniProgram, requestSubscribe,
    requestFrame, getCtx: () => ctx,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
