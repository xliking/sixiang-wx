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

  function initCanvas() {
    if (isWechat) {
      const sys = wx.getSystemInfoSync();
      dpr = Math.min(sys.pixelRatio || 2, 3);
      screenW = sys.windowWidth;
      screenH = sys.windowHeight;
      canvas = wx.createCanvas();
      canvas.width = Math.round(screenW * dpr);
      canvas.height = Math.round(screenH * dpr);
    } else {
      canvas = document.getElementById('gameCanvas');
      const rect = canvas.parentElement.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 2, 3);
      screenW = rect.width;
      screenH = rect.height;
      canvas.width = Math.round(screenW * dpr);
      canvas.height = Math.round(screenH * dpr);
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
    return isWechat ? wx.createImage() : new Image();
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

  // 文本输入（兑换码等）：微信用系统键盘，浏览器用 prompt
  function promptText(title, onConfirm) {
    if (isWechat && typeof wx.showKeyboard === 'function') {
      const handler = (res) => {
        wx.offKeyboardConfirm(handler);
        wx.hideKeyboard({});
        if (res && res.value) onConfirm(String(res.value).trim());
      };
      wx.onKeyboardConfirm(handler);
      wx.showKeyboard({ defaultValue: '', maxLength: 32, multiple: false, confirmHold: false, confirmType: 'done' });
    } else if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
      const v = window.prompt(title, '');
      if (v) onConfirm(v.trim());
    }
  }

  function copyText(text) {
    try {
      if (isWechat && typeof wx.setClipboardData === 'function') wx.setClipboardData({ data: text });
      else if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(text);
    } catch (e) {}
  }

  function openSimulatedAd(scene, rewardText, onSuccess, onCancel) {
    adOverlay.active = true;
    adOverlay.scene = scene;
    adOverlay.title = '微信激励视频广告（本地试玩模拟）';
    adOverlay.rewardText = rewardText || '观看完整视频领取奖励';
    adOverlay.timer = 0;
    adOverlay.duration = 1.8;
    adOverlay.onSuccess = onSuccess;
    adOverlay.onCancel = onCancel;
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

  function requestFrame(cb) {
    return typeof requestAnimationFrame === 'function' ? requestAnimationFrame(cb) : setTimeout(() => cb(Date.now()), 16);
  }

  App.Platform = {
    isWechat, LOGICAL_W, LOGICAL_H, AD_UNIT_IDS, adOverlay,
    initCanvas, beginFrame, endFrame, bindPointerEvents, createImage,
    saveStorage, loadStorage, clearStorage, showRewardedAd, updateAdOverlay, promptText, copyText,
    requestFrame, getCtx: () => ctx,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
