(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const hitBoxes = [];
  const toasts = [];

  // 全局请求与按钮级加载反馈状态
  let loadSeq = 0;
  const activeLoads = [];
  let lastClickedBtn = null;

  // 文本测量与多行折行 LRU 缓存（避免每帧在列表/商店/说明中上百次重复调用 ctx.measureText）
  const MEASURE_CACHE = new Map();
  const WRAP_CACHE = new Map();

  function measureTextCached(ctx, text) {
    const s = String(text || '');
    if (!s) return 0;
    const key = ctx.font + '|' + s;
    let w = MEASURE_CACHE.get(key);
    if (w !== undefined) return w;
    w = ctx.measureText(s).width;
    if (MEASURE_CACHE.size >= 800) {
      const oldest = MEASURE_CACHE.keys().next().value;
      MEASURE_CACHE.delete(oldest);
    }
    MEASURE_CACHE.set(key, w);
    return w;
  }

  function notifyUiDirty() {
    if (App.Main && typeof App.Main.markDirty === 'function') App.Main.markDirty(300);
  }

  function beginLoading(text, opts) {
    const o = opts || {};
    const id = ++loadSeq;
    activeLoads.push({
      id,
      text: text || '正在请求服务器…',
      startedAt: Date.now(),
      delayMs: o.immediate ? 0 : (o.delayMs != null ? o.delayMs : 160),
    });
    notifyUiDirty();
    return () => endLoading(id);
  }

  function endLoading(id) {
    const idx = activeLoads.findIndex((x) => x.id === id);
    if (idx >= 0) activeLoads.splice(idx, 1);
    if (!activeLoads.length) lastClickedBtn = null;
    notifyUiDirty();
  }

  function isActionLoading() {
    return activeLoads.length > 0;
  }

  let exchangeModalOpen = false;

  function openExchangeModal() {
    exchangeModalOpen = true;
    notifyUiDirty();
  }

  function closeExchangeModal() {
    if (exchangeModalOpen) {
      exchangeModalOpen = false;
      notifyUiDirty();
    }
  }

  function hasActiveOverlay() {
    return toasts.length > 0 || activeLoads.length > 0 || exchangeModalOpen || !!(App.Compliance && App.Compliance.isOpen());
  }

  function clearHits() { hitBoxes.length = 0; }

  function addHit(x, y, w, h, onClick, meta) {
    hitBoxes.push({ x, y, w, h, onClick, meta });
  }

  function dispatchClick(x, y) {
    const kb = App.Platform && App.Platform.inputOverlay;
    if (kb && kb.active) {
      for (let i = hitBoxes.length - 1; i >= 0; i--) {
        const b = hitBoxes[i];
        if (b.meta && b.meta.inputModal && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          if (App.Audio) App.Audio.playSfx('click');
          if (b.onClick) b.onClick(b.meta);
          return true;
        }
      }
      return true;
    }
    if (activeLoads.length > 0) return true; // 请求处理中屏蔽重复连点穿透
    for (let i = hitBoxes.length - 1; i >= 0; i--) {
      const b = hitBoxes[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (App.Audio && !(b.meta && b.meta.silent)) App.Audio.playSfx('click');
        if (b.meta && b.meta.btnKey) {
          lastClickedBtn = { key: b.meta.btnKey, at: Date.now() };
        } else {
          lastClickedBtn = null;
        }
        if (b.onClick) b.onClick(b.meta);
        return true;
      }
    }
    return false;
  }

  function showToast(text, color) {
    toasts.push({ text, color: color || '#fef08a', life: 2.2, maxLife: 2.2 });
    if (toasts.length > 4) toasts.shift();
    notifyUiDirty();
  }

  function updateToasts(dt) {
    for (let i = toasts.length - 1; i >= 0; i--) {
      toasts[i].life -= dt;
      if (toasts[i].life <= 0) toasts.splice(i, 1);
    }
  }

  function drawToasts(ctx) {
    const W = App.Platform.LOGICAL_W;
    toasts.forEach((t, idx) => {
      const alpha = Math.min(1, t.life * 2.2);
      const y = 86 + idx * 32 - (1 - t.life / t.maxLife) * 8;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif';
      const maxTw = W - 40;
      const rawW = measureTextCached(ctx, t.text);
      const tw = Math.min(maxTw, Math.max(120, rawW + 32));
      roundRect(ctx, (W - tw) / 2, y, tw, 28, 14);
      ctx.fillStyle = 'rgba(42, 24, 14, 0.94)';
      ctx.fill();
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, W / 2, y + 14, tw - 22);
      ctx.restore();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r || 8, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  // 经典复古羊皮卷/红木边框面板
  function drawPanel(ctx, x, y, w, h, opts) {
    const o = opts || {};
    ctx.save();
    roundRect(ctx, x, y, w, h, o.r || 10);
    ctx.fillStyle = o.bg || '#f3e5c3';
    ctx.fill();
    if (o.border !== false) {
      ctx.strokeStyle = o.border || '#7c4a21';
      ctx.lineWidth = o.lineWidth || 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWoodHeader(ctx, x, y, w, h) {
    ctx.save();
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#6b3417');
    g.addColorStop(1, '#471f0c');
    roundRect(ctx, x, y, w, h, 8);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#d4a34b';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    ctx.restore();
  }

  // ★ 国风鎏金双翼转轮加载动画（按钮内嵌、异步面板、全屏请求通用）
  function drawSpinner(ctx, cx, cy, r, color) {
    const rad = Math.max(5, r || 10);
    // 对时间戳取模避免 10^10 弧度在 GPU Canvas float32 下丢失精度导致圆弧消失变成死圆圈！
    const t = ((Date.now() % 62832) * 0.0056) % (Math.PI * 2);
    const mainCol = color || '#fef08a';
    ctx.save();
    ctx.lineCap = 'round';

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.20)';
    ctx.lineWidth = Math.max(1.6, rad * 0.22);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = mainCol;
    ctx.lineWidth = Math.max(1.8, rad * 0.24);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, t, t + Math.PI * 1.18);
    ctx.stroke();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = Math.max(1.4, rad * 0.18);
    ctx.beginPath();
    const innerR = rad * (rad >= 12 ? 0.66 : 1);
    const a2 = rad >= 12 ? -t * 1.3 : t + Math.PI * 1.42;
    ctx.arc(cx, cy, innerR, a2, a2 + Math.PI * (rad >= 12 ? 0.95 : 0.35));
    ctx.stroke();

    if (rad >= 11) {
      ctx.fillStyle = mainCol;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.8, rad * 0.14), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPanelLoading(ctx, cx, cy, text) {
    const msg = text || '正在加载数据…';
    ctx.save();
    ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
    const w = Math.max(210, ctx.measureText(msg).width + 64), h = 82;
    const x = cx - w / 2, y = cy - h / 2;
    roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = 'rgba(38, 19, 9, 0.90)';
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    drawSpinner(ctx, cx, y + 29, 13, '#fde047');
    ctx.fillStyle = '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, cx, y + 62);
    ctx.restore();
  }

  function drawLoadingOverlay(ctx) {
    if (!activeLoads.length) return;
    const cur = activeLoads[activeLoads.length - 1];
    const elapsed = Date.now() - cur.startedAt;
    if (elapsed < cur.delayMs) return;

    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const fade = Math.min(1, (elapsed - cur.delayMs) / 120 + 0.38);

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = 'rgba(10, 5, 2, 0.36)';
    ctx.fillRect(0, 0, W, H);

    const dots = '.'.repeat(1 + (Math.floor(Date.now() / 320) % 3));
    const baseText = String(cur.text || '正在处理').replace(/[…\.]+$/, '');
    const label = baseText + dots;
    ctx.font = 'bold 13.5px "PingFang SC", "Microsoft YaHei", sans-serif';
    const pw = Math.max(226, Math.min(360, ctx.measureText(label).width + 68));
    const ph = 96;
    const px = (W - pw) / 2, py = (H - ph) / 2;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    roundRect(ctx, px, py, pw, ph, 14);
    const bg = ctx.createLinearGradient(px, py, px, py + ph);
    bg.addColorStop(0, 'rgba(48, 23, 11, 0.96)');
    bg.addColorStop(1, 'rgba(24, 11, 5, 0.96)');
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.stroke();

    roundRect(ctx, px + 4, py + 4, pw - 8, ph - 8, 10);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.24)';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawSpinner(ctx, W / 2, py + 34, 15, '#fef08a');

    ctx.fillStyle = '#fef3c7';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, py + 72, pw - 28);
    ctx.restore();
  }

  const MODERN_GREEN_RE = /^#(?:16a34a|22c55e|059669|10b981|064e3b)$/i;
  const MODERN_DARK_GREEN_RE = /^#(?:15803d|166534|14532d)$/i;
  const MODERN_BLUE_RE = /^#(?:0284c7|0369a1|0c4a6e|2563eb|3b82f6|0891b2|0d9488)$/i;
  const NEON_BORDER_RE = /^#(?:bbf7d0|bae6fd|a7f3d0|7dd3fc|86efac|67e8f9)$/i;
  const COLOR_EMOJI_STRIP_RE = /[\u{1F300}-\u{1FAFF}\u{26A1}\u{1F525}\u{1F50D}\u{1F3EF}\u{1F512}\u{1F381}\u{1F389}\u{1F4B0}\u{1F3A1}\u{1F3AC}\u{1F4DC}\u{1F3C6}\u{1F3AF}\u{1F4E3}\u{1F9F5}\u{2692}\u{2601}\u{2709}\u{23F1}]\uFE0F?\s*/gu;

  function harmonizeBtnPalette(o) {
    let grad = o.grad;
    let bg = o.bg;
    let border = o.border;
    if (Array.isArray(grad) && grad.length >= 2) {
      if (MODERN_GREEN_RE.test(grad[0])) {
        grad = ['#c26a1b', '#7c3a0e'];
        if (!border || NEON_BORDER_RE.test(border)) border = '#fde68a';
      } else if (MODERN_DARK_GREEN_RE.test(grad[0])) {
        grad = ['#4c6b3b', '#2e4423'];
        if (!border || NEON_BORDER_RE.test(border)) border = '#d4a34b';
      } else if (MODERN_BLUE_RE.test(grad[0])) {
        grad = ['#6b381b', '#43200d'];
        if (!border || NEON_BORDER_RE.test(border)) border = '#d4a34b';
      }
    } else if (bg) {
      if (MODERN_GREEN_RE.test(bg) || MODERN_DARK_GREEN_RE.test(bg)) {
        grad = ['#4c6b3b', '#2e4423'];
        bg = undefined;
        if (!border || NEON_BORDER_RE.test(border)) border = '#d4a34b';
      } else if (MODERN_BLUE_RE.test(bg)) {
        grad = ['#6b381b', '#43200d'];
        bg = undefined;
        if (!border || NEON_BORDER_RE.test(border)) border = '#d4a34b';
      }
    }
    if (border && NEON_BORDER_RE.test(border)) border = '#fde68a';
    return { grad, bg, border };
  }

  // 绘制古风单色金线微缩按钮图标（彻底告别违和的现代彩色系统 Emoji！）
  function drawVectorBtnGlyph(ctx, kind, cx, cy, r, col) {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 1.45;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (kind === 'search') {
      ctx.beginPath();
      ctx.arc(cx - r * 0.16, cy - r * 0.16, r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + r * 0.28, cy + r * 0.28);
      ctx.lineTo(cx + r * 0.82, cy + r * 0.82);
      ctx.stroke();
    } else if (kind === 'refresh') {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.72, -Math.PI * 0.78, Math.PI * 0.68);
      ctx.stroke();
      const ax = cx + Math.cos(-Math.PI * 0.78) * r * 0.72;
      const ay = cy + Math.sin(-Math.PI * 0.78) * r * 0.72;
      ctx.beginPath();
      ctx.moveTo(ax - 1.2, ay + 3.2);
      ctx.lineTo(ax - 0.5, ay - 1.2);
      ctx.lineTo(ax + 3.6, ay + 0.4);
      ctx.stroke();
    } else if (kind === 'lock') {
      ctx.strokeRect(cx - r * 0.62, cy - r * 0.08, r * 1.24, r * 0.92);
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.12, r * 0.40, Math.PI, 0);
      ctx.stroke();
    } else if (kind === 'tribute') {
      // 古风金元宝纹（一船双翘托圆珠，一眼即识岁贡军饷，绝不形似锁头！）
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.92, cy - r * 0.08);
      ctx.quadraticCurveTo(cx, cy + r * 0.34, cx + r * 0.92, cy - r * 0.08);
      ctx.lineTo(cx + r * 0.58, cy + r * 0.65);
      ctx.quadraticCurveTo(cx, cy + r * 0.82, cx - r * 0.58, cy + r * 0.65);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.14, r * 0.36, Math.PI * 1.05, -Math.PI * 0.05);
      ctx.stroke();
    } else if (kind === 'sweep') {
      // 双重疾风令箭纹
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.75, cy - r * 0.30); ctx.lineTo(cx + r * 0.45, cy - r * 0.30);
      ctx.moveTo(cx - r * 0.55, cy + r * 0.32); ctx.lineTo(cx + r * 0.75, cy + r * 0.32);
      ctx.moveTo(cx + r * 0.35, cy - r * 0.62); ctx.lineTo(cx + r * 0.80, cy); ctx.lineTo(cx + r * 0.35, cy + r * 0.62);
      ctx.stroke();
    } else if (kind === 'pause') {
      const bw = Math.max(1.8, r * 0.34);
      const bh = r * 1.32;
      const gap = Math.max(1.8, r * 0.30);
      roundRect(ctx, cx - gap / 2 - bw, cy - bh / 2, bw, bh, 1);
      ctx.fill();
      roundRect(ctx, cx + gap / 2, cy - bh / 2, bw, bh, 1);
      ctx.fill();
    } else if (kind === 'play') {
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.48, cy - r * 0.68);
      ctx.lineTo(cx + r * 0.72, cy);
      ctx.lineTo(cx - r * 0.48, cy + r * 0.68);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawButton(ctx, x, y, w, h, text, opts, onClick) {
    const o = opts || {};
    const btnKey = `${Math.round(x)}_${Math.round(y)}_${Math.round(w)}_${Math.round(h)}`;
    const isLoading = !!(o.loading || (activeLoads.length > 0 && lastClickedBtn && lastClickedBtn.key === btnKey));
    const isDisabled = !!o.disabled && !isLoading;
    const pal = harmonizeBtnPalette(o);
    const cleanText = String(text || '').replace(COLOR_EMOJI_STRIP_RE, '');
    const r = o.r || 8;

    ctx.save();
    if (h >= 26 && !isDisabled) {
      roundRect(ctx, x, y + 1.5, w, h, r);
      ctx.fillStyle = 'rgba(28, 12, 4, 0.24)';
      ctx.fill();
    }

    roundRect(ctx, x, y, w, h, r);
    if (isDisabled) {
      ctx.fillStyle = '#6b635b';
    } else if (pal.grad) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, pal.grad[0]);
      g.addColorStop(1, pal.grad[1]);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = pal.bg || '#b45309';
    }
    ctx.fill();

    if (h >= 24 && !isDisabled && (pal.grad || !o.bg || o.bg === '#b45309')) {
      ctx.save();
      roundRect(ctx, x + 1.5, y + 1.2, w - 3, Math.max(3, h * 0.42), Math.max(2, r - 1.5));
      const shine = ctx.createLinearGradient(x, y, x, y + h * 0.44);
      shine.addColorStop(0, 'rgba(254, 243, 199, 0.16)');
      shine.addColorStop(1, 'rgba(254, 243, 199, 0.01)');
      ctx.fillStyle = shine;
      ctx.fill();
      ctx.restore();
    }

    roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = isDisabled ? '#575049' : (isLoading ? '#fde047' : (pal.border || '#fef08a'));
    ctx.lineWidth = isLoading ? 2.2 : (o.lineWidth || 1.45);
    ctx.stroke();

    if (isLoading) {
      const spR = Math.min(8.5, Math.max(5.5, h * 0.21));
      const showLabel = w >= 78 ? String(o.loadingText || cleanText).replace(COLOR_EMOJI_STRIP_RE, '') : '';
      ctx.font = `bold ${o.fontSize || 13}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      if (showLabel) {
        const maxTw = Math.max(16, w - spR * 2 - 18);
        const tw = Math.min(maxTw, ctx.measureText(showLabel).width);
        const startX = x + (w - (spR * 2 + 7 + tw)) / 2;
        drawSpinner(ctx, startX + spR, y + h / 2 + (o.subText ? -5 : 0), spR, '#fef08a');
        ctx.fillText(showLabel, startX + spR * 2 + 7, y + h / 2 + (o.subText ? -5 : 0.5), maxTw);
        if (o.subText && h >= 40) {
          ctx.font = '10px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fde68a';
          ctx.fillText('请稍候…', x + w / 2, y + h / 2 + 10, w - 10);
        }
      } else {
        drawSpinner(ctx, x + w / 2, y + h / 2, spR, '#fef08a');
      }
    } else {
      const fgCol = isDisabled ? '#d6d3d1' : (o.color || '#fffbeb');
      const textY = y + h / 2 + (o.subText ? -6 : 0.5);
      ctx.fillStyle = fgCol;
      ctx.font = `bold ${o.fontSize || 13}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      ctx.textBaseline = 'middle';

      if (o.icon && w >= 56) {
        const iconR = Math.min(6.2, Math.max(4.6, (o.fontSize || 12) * 0.46));
        const maxTw = Math.max(16, w - iconR * 2 - 15);
        const tw = Math.min(maxTw, ctx.measureText(cleanText).width);
        const startX = x + (w - (iconR * 2 + 5 + tw)) / 2;
        drawVectorBtnGlyph(ctx, o.icon, startX + iconR, textY - 0.5, iconR, fgCol);
        ctx.textAlign = 'left';
        ctx.fillText(cleanText, startX + iconR * 2 + 5, textY, maxTw);
      } else if (!o.subText && (cleanText === '+' || cleanText === '-' || cleanText === '−')) {
        // 纯矢量正中绘制单字符加减号，彻底消除不同设备字体基线偏移
        const cxm = x + w / 2;
        const cym = y + h / 2;
        const arm = Math.min(w, h) * 0.22;
        ctx.save();
        ctx.strokeStyle = fgCol;
        ctx.lineWidth = Math.max(1.8, Math.min(2.6, h * 0.085));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cxm - arm, cym);
        ctx.lineTo(cxm + arm, cym);
        if (cleanText === '+') {
          ctx.moveTo(cxm, cym - arm);
          ctx.lineTo(cxm, cym + arm);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.textAlign = 'center';
        ctx.fillText(cleanText, x + w / 2, textY, Math.max(16, w - 10));
      }

      if (o.subText) {
        ctx.textAlign = 'center';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillStyle = o.subColor || '#fde68a';
        ctx.fillText(o.subText, x + w / 2, y + h / 2 + 9, Math.max(16, w - 10));
      }
    }
    ctx.restore();

    if (onClick && !o.disabled && !isLoading) addHit(x, y, w, h, onClick, { btnKey });
  }

  // ★ 国风鎏金琥珀激励按钮（替代突兀刺眼的纯绿“广告”方块：左侧立体金章播放徽记 + 双层金丝檀木漆面）
  function drawAdButton(ctx, x, y, w, h, text, opts, onClick) {
    const o = opts || {};
    const btnKey = `${Math.round(x)}_${Math.round(y)}_${Math.round(w)}_${Math.round(h)}`;
    const isLoading = !!(o.loading || (activeLoads.length > 0 && lastClickedBtn && lastClickedBtn.key === btnKey));
    const r = o.r != null ? o.r : Math.min(10, h / 2);
    ctx.save();
    if (o.disabled && !isLoading) ctx.globalAlpha = 0.55;

    // 1. 零高斯模糊硬投影（规避移动端 Canvas shadowBlur 逐帧光栅化卡顿）+ 琥珀檀木渐变漆底
    roundRect(ctx, x, y + 2, w, h, r);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.fill();

    roundRect(ctx, x, y, w, h, r);
    if (o.disabled) {
      ctx.fillStyle = '#57534e';
    } else {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#9a4412');
      g.addColorStop(0.48, '#6c2b0b');
      g.addColorStop(1, '#3d1505');
      ctx.fillStyle = g;
    }
    ctx.fill();

    // 2. 顶部温润高光釉层
    if (!o.disabled) {
      ctx.save();
      roundRect(ctx, x + 1.5, y + 1.5, w - 3, Math.max(4, h * 0.44), Math.max(2, r - 1.5));
      const shine = ctx.createLinearGradient(x, y, x, y + h * 0.46);
      shine.addColorStop(0, 'rgba(254, 240, 138, 0.22)');
      shine.addColorStop(1, 'rgba(254, 240, 138, 0.02)');
      ctx.fillStyle = shine;
      ctx.fill();
      ctx.restore();
    }

    // 3. 外层鎏金边框 + 内层暗金细线
    roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = o.disabled ? '#78716c' : (o.border || '#fbbf24');
    ctx.lineWidth = o.lineWidth || 1.6;
    ctx.stroke();

    if (h >= 26 && !o.disabled) {
      roundRect(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(2, r - 2));
      ctx.strokeStyle = 'rgba(254, 243, 199, 0.24)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // 4. 左侧立体黄金播放圆章徽记（直观传达看视频免费领，无需写生硬的“(广告)”字样）
    const badgeR = Math.min(10.5, Math.max(7.2, h * 0.27));
    const bx = x + 7 + badgeR;
    const by = y + h / 2;

    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    if (o.disabled) {
      ctx.fillStyle = '#a8a29e';
    } else {
      const bg = ctx.createRadialGradient(bx - badgeR * 0.28, by - badgeR * 0.28, 1, bx, by, badgeR);
      bg.addColorStop(0, '#fef9c3');
      bg.addColorStop(0.55, '#facc15');
      bg.addColorStop(1, '#b45309');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    ctx.strokeStyle = o.disabled ? '#57534e' : '#78350f';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // 圆章内的精致实心播放三角（加载中则切换为旋转光环）
    if (isLoading) {
      drawSpinner(ctx, bx, by, badgeR * 0.65, '#451a03');
    } else {
      const triSz = badgeR * 0.46;
      ctx.fillStyle = '#451a03';
      ctx.beginPath();
      ctx.moveTo(bx - triSz * 0.55, by - triSz * 0.88);
      ctx.lineTo(bx + triSz * 0.98, by);
      ctx.lineTo(bx - triSz * 0.55, by + triSz * 0.88);
      ctx.closePath();
      ctx.fill();
    }

    // 5. 右侧居中排布的鎏金文字与副标题（避开左侧圆章，永不挤压）
    const leftPad = 7 + badgeR * 2 + 4;
    const textMaxW = Math.max(16, w - leftPad - 6);
    const textCx = x + leftPad + (w - leftPad - 5) / 2;

    ctx.fillStyle = (o.disabled && !isLoading) ? '#d6d3d1' : (o.color || '#fef9c3');
    ctx.font = `bold ${o.fontSize || 12.5}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isLoading ? (o.loadingText || text) : text, textCx, y + h / 2 + (o.subText ? -6.5 : 0.5), textMaxW);

    if (o.subText) {
      ctx.font = `${o.subFontSize || 9.5}px "PingFang SC", sans-serif`;
      ctx.fillStyle = o.subColor || '#fde68a';
      ctx.fillText(isLoading ? '请稍候…' : o.subText, textCx, y + h / 2 + 8.5, textMaxW);
    }
    ctx.restore();

    if (onClick && !o.disabled && !isLoading) addHit(x, y, w, h, onClick, { btnKey });
  }

  function drawBar(ctx, x, y, w, h, ratio, fillColor, bgColor) {
    const r = Math.max(0, Math.min(1, ratio));
    ctx.save();
    roundRect(ctx, x, y, w, h, Math.min(4, h / 2));
    ctx.fillStyle = bgColor || 'rgba(0,0,0,0.58)';
    ctx.fill();
    if (r > 0.01) {
      roundRect(ctx, x, y, Math.max(h, w * r), h, Math.min(4, h / 2));
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.8;
    roundRect(ctx, x, y, w, h, Math.min(4, h / 2));
    ctx.stroke();
    ctx.restore();
  }

  function wrapLinesCached(ctx, text, maxW) {
    const s = String(text || '');
    if (!s) return [];
    const key = ctx.font + '|' + Math.round(maxW) + '|' + s;
    let lines = WRAP_CACHE.get(key);
    if (lines) return lines;
    lines = [];
    let line = '';
    for (let i = 0; i < s.length; i++) {
      const test = line + s[i];
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        lines.push(line);
        line = s[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (WRAP_CACHE.size >= 400) {
      const oldest = WRAP_CACHE.keys().next().value;
      WRAP_CACHE.delete(oldest);
    }
    WRAP_CACHE.set(key, lines);
    return lines;
  }

  function drawWrappedText(ctx, text, x, y, maxW, lineH, align) {
    ctx.textAlign = align || 'left';
    const lines = wrapLinesCached(ctx, text, maxW);
    let cy = y;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x, cy);
      if (i < lines.length - 1) cy += lineH;
    }
    return cy + lineH;
  }

  // 微信真机系统键盘输入顶栏浮层（位于屏幕上方，不被底部软键盘遮挡）
  function drawInputOverlay(ctx) {
    const kb = App.Platform && App.Platform.inputOverlay;
    if (!kb || !kb.active) return;
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    ctx.save();
    ctx.fillStyle = 'rgba(8, 4, 2, 0.55)';
    ctx.fillRect(0, 0, W, H);

    const pw = 560, ph = 116;
    const px = (W - pw) / 2, py = 28;
    drawPanel(ctx, px, py, pw, ph, { r: 12, bg: '#2c160c', border: '#fbbf24', lineWidth: 2.2 });

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(kb.title || '请输入内容', px + 18, py + 24, pw - 110);

    const val = String(kb.value || '');
    ctx.fillStyle = '#a8a29e';
    ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${val.length}/${kb.maxLength || 48}`, px + pw - 18, py + 24);

    // 输入预览槽
    roundRect(ctx, px + 18, py + 44, pw - 168, 38, 8);
    ctx.fillStyle = '#fff7e0';
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const cursor = (Math.floor(Date.now() / 480) % 2 === 0) ? '|' : '';
    ctx.fillStyle = val ? '#291509' : '#9ca3af';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    const maxInputTextW = pw - 188;
    let displayVal = val ? (val + cursor) : ('请在下方键盘输入…' + cursor);
    if (val && ctx.measureText(displayVal).width > maxInputTextW) {
      let tail = val;
      while (tail.length > 1 && ctx.measureText('…' + tail + cursor).width > maxInputTextW) {
        tail = tail.slice(1);
      }
      displayVal = '…' + tail + cursor;
    }
    ctx.fillText(displayVal, px + 28, py + 63, maxInputTextW);

    // 取消 / 确定 按钮（带 inputModal 标记，允许在键盘浮层激活时响应点击）
    const drawKbBtn = (bx, bw, label, grad, border, fn) => {
      roundRect(ctx, bx, py + 44, bw, 38, 8);
      const g = ctx.createLinearGradient(bx, py + 44, bx, py + 82);
      g.addColorStop(0, grad[0]);
      g.addColorStop(1, grad[1]);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = border;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fffbeb';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, bx + bw / 2, py + 63);
      addHit(bx, py + 44, bw, 38, fn, { inputModal: true });
    };
    drawKbBtn(px + pw - 140, 56, '取消', ['#57534e', '#44403c'], '#d6d3d1', () => { if (kb.cancel) kb.cancel(); });
    drawKbBtn(px + pw - 76, 58, '确定', ['#16a34a', '#15803d'], '#fef08a', () => { if (kb.submit) kb.submit(); });

    ctx.fillStyle = '#cbb89d';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('提示：输入完成后可点击键盘右下角「完成」或右侧「确定」提交', px + 18, py + 98);
    ctx.restore();
  }

  function drawAdOverlay(ctx) {
    const ad = App.Platform.adOverlay;
    if (!ad.active) return;
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, W, H);

    drawPanel(ctx, W / 2 - 220, H / 2 - 105, 440, 210, { r: 14, bg: '#2c1810', border: '#facc15', lineWidth: 2.5 });
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 18px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ad.title, W / 2, H / 2 - 60);

    ctx.fillStyle = '#fef3c7';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.fillText(ad.rewardText, W / 2, H / 2 - 22);

    drawBar(ctx, W / 2 - 160, H / 2 + 10, 320, 14, Math.min(1, ad.timer / ad.duration), '#22c55e', '#451a03');
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText(`正在发放奖励... ${Math.max(0, ad.duration - ad.timer).toFixed(1)}s`, W / 2, H / 2 + 48);
    ctx.fillText('（感念主公勤政爱民，本次免看视频直接发放犒赏）', W / 2, H / 2 + 76);
    ctx.restore();
  }

  // 绘制精致透明小图标（含元宝矢量兜底）
  function drawMiniIcon(ctx, iconKey, x, y, size) {
    const img = App.Assets && App.Assets.get(iconKey);
    if (img) {
      ctx.drawImage(img, x, y, size, size);
    } else if (iconKey === 'res_ingot') {
      const cx = x + size / 2, cy = y + size / 2, r = size * 0.42;
      ctx.save();
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.12, r * 0.48, Math.PI, 0);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r * 0.16);
      ctx.quadraticCurveTo(cx, cy + r * 0.28, cx + r, cy - r * 0.16);
      ctx.lineTo(cx + r * 0.65, cy + r * 0.62);
      ctx.quadraticCurveTo(cx, cy + r * 0.85, cx - r * 0.65, cy + r * 0.62);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ★ 绘制手游级顶部凹陷黑金胶囊框 + 左侧立体手绘小图片展示
  function drawResCapsule(ctx, iconKey, x, y, w, h, text, opts, onClick) {
    const o = opts || {};
    const r = h / 2;
    const iconSz = o.iconSize || (h + 4);

    ctx.save();
    // 凹槽暗漆底板
    roundRect(ctx, x + 5, y, w - 5, h, r);
    ctx.fillStyle = o.bg || 'rgba(26, 12, 5, 0.78)';
    ctx.fill();

    // 可选内部进度填充（如粮草体力条）
    if (typeof o.ratio === 'number' && o.ratio > 0.01) {
      const fillW = Math.max(h, (w - 9) * Math.min(1, o.ratio));
      ctx.save();
      roundRect(ctx, x + 6, y + 1.5, w - 7, h - 3, r);
      ctx.clip();
      ctx.fillStyle = o.barColor || 'rgba(34, 197, 94, 0.32)';
      ctx.fillRect(x + 6, y + 1.5, fillW, h - 3);
      ctx.restore();
    }

    // 金属细描边
    roundRect(ctx, x + 5, y, w - 5, h, r);
    ctx.strokeStyle = o.border || 'rgba(212, 163, 75, 0.65)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // 左侧小图标光晕托底 + 高清手绘小图片外露立体叠放
    const icX = x - 1;
    const icY = y + (h - iconSz) / 2;
    const halo = ctx.createRadialGradient(
      icX + iconSz / 2, icY + iconSz / 2, 2,
      icX + iconSz / 2, icY + iconSz / 2, iconSz * 0.55
    );
    halo.addColorStop(0, o.glow || 'rgba(250, 204, 21, 0.38)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(icX + iconSz / 2, icY + iconSz / 2, iconSz * 0.55, 0, Math.PI * 2);
    ctx.fill();

    drawMiniIcon(ctx, iconKey, icX, icY, iconSz);

    // 数值文字展示
    ctx.fillStyle = o.color || '#fef3c7';
    ctx.font = `bold ${o.fontSize || 11}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const resMaxW = Math.max(16, w - iconSz - (o.plusBadge ? 24 : 8));
    ctx.fillText(text, x + iconSz + 2, y + h / 2 + 0.5, resMaxW);

    // 可选右侧快捷加号按钮徽标（与胶囊右半圆同心 + 纯矢量十字绘制，确保内外圆与加号 100% 绝对居中！）
    if (o.plusBadge) {
      const pr = Math.max(5.5, r - 4);
      const px = x + w - r;
      const py = y + h / 2;
      ctx.fillStyle = o.plusDisabled ? '#57534e' : (o.plusColor || '#16a34a');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = o.plusDisabled ? '#a8a29e' : '#fef08a';
      ctx.lineWidth = 1.15;
      ctx.stroke();

      const arm = h >= 22 ? 3.7 : 3.1;
      ctx.save();
      ctx.strokeStyle = o.plusDisabled ? 'rgba(255, 255, 255, 0.72)' : '#ffffff';
      ctx.lineWidth = h >= 22 ? 1.9 : 1.65;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px - arm, py);
      ctx.lineTo(px + arm, py);
      ctx.moveTo(px, py - arm);
      ctx.lineTo(px, py + arm);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    if (onClick) addHit(x, y, w, h, onClick);
    if (o.onPlusClick && !o.plusDisabled) {
      addHit(x + w - 26, y - 2, 28, h + 4, o.onPlusClick);
    }
  }

  // ★ 精致古铜鎏金音效开关圆形按钮（纯矢量绘制喇叭声波与静音斜杠，绝不乱码！）
  function drawSoundToggle(ctx, x, y, size) {
    const sz = size || 28;
    const cx = x + sz / 2;
    const cy = y + sz / 2;
    const isMuted = App.Audio ? App.Audio.isMuted() : false;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2);
    ctx.fillStyle = isMuted ? 'rgba(30, 41, 59, 0.88)' : 'rgba(54, 26, 12, 0.92)';
    ctx.fill();
    ctx.strokeStyle = isMuted ? '#94a3b8' : '#fde047';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 喇叭主体
    ctx.fillStyle = isMuted ? '#94a3b8' : '#fef08a';
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - 2.5);
    ctx.lineTo(cx - 3, cy - 2.5);
    ctx.lineTo(cx + 1.5, cy - 6.5);
    ctx.lineTo(cx + 1.5, cy + 6.5);
    ctx.lineTo(cx - 3, cy + 2.5);
    ctx.lineTo(cx - 6, cy + 2.5);
    ctx.closePath();
    ctx.fill();

    if (!isMuted) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx + 1.5, cy, 4.2, -0.7, 0.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 1.5, cy, 7.0, -0.75, 0.75);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - 6, cy - 6);
      ctx.lineTo(cx + 6, cy + 6);
      ctx.stroke();
    }
    ctx.restore();

    addHit(x - 2, y - 2, sz + 4, sz + 4, () => {
      if (!App.Audio) return;
      const nowMuted = App.Audio.toggleMute();
      showToast(nowMuted ? '已关闭背景音乐与音效' : '已开启国风背景音乐与音效！', nowMuted ? '#cbd5e1' : '#4ade80');
      if (!nowMuted) App.Audio.playSfx('coin');
    }, { silent: true });
  }

  /**
   * ★ 通用国风数字分页器组件（支持 ◀ + 1, 2, 3, …, N 页码直选 + ▶，自适应窄栏与宽栏宽度！）
   * @param {number} pageIdx 当前页（0 起）
   * @param {number} totalPages 总页数（>=1）
   * @param {function(number):void} onPageChange 切换回调，参数为目标 0 起页码
   */
  function drawPagination(ctx, x, y, w, h, pageIdx, totalPages, onPageChange, opts) {
    const o = opts || {};
    const total = Math.max(1, Math.floor(totalPages || 1));
    if (o.hideIfSingle && total <= 1) return;
    const cur = Math.max(1, Math.min(total, Math.floor(pageIdx || 0) + 1)); // 1-based

    const compact = w < 250;
    const gap = compact ? 3 : 4;
    const arrowW = compact ? 24 : 30;
    const baseNumW = compact ? 23 : 27;
    const availForNums = Math.max(40, w - arrowW * 2 - gap * 2);
    const maxSlots = Math.max(3, Math.min(9, Math.floor((availForNums + gap) / (baseNumW + gap))));

    // 构建智能页码槽位（始终保留首页 1 与末页 total，中间滑动窗口 + 可点击快进省略号）
    const tokens = [];
    if (total <= maxSlots) {
      for (let p = 1; p <= total; p++) tokens.push({ type: 'page', page: p });
    } else if (maxSlots <= 4) {
      // 超窄栏精简模式: [1] [cur 或 …] [total]
      tokens.push({ type: 'page', page: 1 });
      if (cur > 1 && cur < total) {
        tokens.push({ type: 'page', page: cur });
      } else {
        const mid = cur === 1 ? 2 : total - 1;
        tokens.push({ type: 'page', page: mid });
      }
      if (total > 3) {
        tokens.push({ type: 'jump', label: '…', target: cur < total - 1 ? Math.min(total, cur + 5) : Math.max(1, cur - 5) });
      }
      tokens.push({ type: 'page', page: total });
    } else {
      const innerSlots = maxSlots - 2; // 扣除首页 1 与末页 total
      const half = Math.floor(innerSlots / 2);
      let left = cur - half;
      let right = left + innerSlots - 1;
      if (left <= 2) {
        left = 2;
        right = left + innerSlots - 1;
      }
      if (right >= total - 1) {
        right = total - 1;
        left = Math.max(2, right - innerSlots + 1);
      }

      tokens.push({ type: 'page', page: 1 });
      if (left > 2) {
        tokens.push({ type: 'jump', label: '…', target: Math.max(1, cur - Math.max(3, innerSlots)) });
        left += 1;
      }
      if (right < total - 1) {
        right -= 1;
      }
      for (let p = left; p <= right; p++) {
        tokens.push({ type: 'page', page: p });
      }
      if (right < total - 1) {
        tokens.push({ type: 'jump', label: '…', target: Math.min(total, cur + Math.max(3, innerSlots)) });
      }
      tokens.push({ type: 'page', page: total });
    }

    // 计算每个页码胶囊实际宽度（三位数页码自动微宽，避免文字挤压）
    const itemWidths = tokens.map((tk) => {
      if (tk.type === 'jump') return compact ? 18 : 22;
      const digits = String(tk.page).length;
      if (digits >= 3) return compact ? 28 : 33;
      if (digits === 2) return compact ? 24 : 28;
      return baseNumW;
    });
    const totalContentW = arrowW * 2 + itemWidths.reduce((s, v) => s + v, 0) + gap * (tokens.length + 1);
    const scaleX = totalContentW > w ? (w / totalContentW) : 1;
    const effArrowW = Math.floor(arrowW * scaleX);
    const effGap = Math.max(2, Math.floor(gap * scaleX));
    const effWidths = itemWidths.map((iw) => Math.max(16, Math.floor(iw * scaleX)));
    const realTotalW = effArrowW * 2 + effWidths.reduce((s, v) => s + v, 0) + effGap * (tokens.length + 1);

    let cx = Math.round(x + (w - realTotalW) / 2);
    const btnH = h || 26;
    const r = Math.min(6, Math.round(btnH * 0.25));
    const fSize = compact ? 10 : 11;
    const inactiveBg = o.bg || '#4a2c16';
    const inactiveBorder = o.border || '#a16207';

    // 1. 上一页 ◀
    drawButton(ctx, cx, y, effArrowW, btnH, '◀', {
      r, bg: inactiveBg, border: inactiveBorder, fontSize: fSize, disabled: cur <= 1,
    }, () => { if (onPageChange && cur > 1) onPageChange(cur - 2); });
    cx += effArrowW + effGap;

    // 2. 中间可直选页码按钮 1, 2, 3 ... N
    tokens.forEach((tk, idx) => {
      const bw = effWidths[idx];
      if (tk.type === 'jump') {
        drawButton(ctx, cx, y, bw, btnH, tk.label, {
          r, bg: 'rgba(59, 31, 14, 0.72)', border: 'rgba(161, 98, 7, 0.55)', fontSize: fSize, color: '#fde68a',
        }, () => { if (onPageChange) onPageChange(tk.target - 1); });
      } else {
        const isCur = tk.page === cur;
        drawButton(ctx, cx, y, bw, btnH, String(tk.page), {
          r,
          grad: isCur ? (o.activeGrad || ['#d97706', '#92400e']) : undefined,
          bg: isCur ? undefined : inactiveBg,
          border: isCur ? '#fef08a' : inactiveBorder,
          lineWidth: isCur ? 1.8 : 1.1,
          color: isCur ? '#fffbeb' : '#fde68a',
          fontSize: fSize,
        }, () => { if (!isCur && onPageChange) onPageChange(tk.page - 1); });
      }
      cx += bw + effGap;
    });

    // 3. 下一页 ▶
    drawButton(ctx, cx, y, effArrowW, btnH, '▶', {
      r, bg: inactiveBg, border: inactiveBorder, fontSize: fSize, disabled: cur >= total,
    }, () => { if (onPageChange && cur < total) onPageChange(cur); });
  }

  // ★ 纯矢量八齿古铜齿轮绘制（供设置按钮及图片未加载前的兜底圆章使用）
  function drawVectorGear(ctx, cx, cy, outerR, color) {
    const teeth = 8;
    const innerR = outerR * 0.72;
    const holeR = outerR * 0.34;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color || '#fef08a';
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const step = (Math.PI * 2) / teeth;
      const a1 = a0 + step * 0.16;
      const a2 = a0 + step * 0.34;
      const a3 = a0 + step * 0.66;
      const a4 = a0 + step * 0.84;
      if (i === 0) ctx.moveTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
      else ctx.lineTo(Math.cos(a0) * innerR, Math.sin(a0) * innerR);
      ctx.lineTo(Math.cos(a1) * outerR, Math.sin(a1) * outerR);
      ctx.lineTo(Math.cos(a2) * outerR, Math.sin(a2) * outerR);
      ctx.lineTo(Math.cos(a3) * innerR, Math.sin(a3) * innerR);
      ctx.lineTo(Math.cos(a4) * innerR, Math.sin(a4) * innerR);
    }
    ctx.closePath();
    ctx.moveTo(holeR, 0);
    ctx.arc(0, 0, holeR, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.restore();
  }

  // ★ 精致古铜鎏金【设置齿轮】圆形按钮（用于局内右上角快捷唤起设置弹窗）
  function drawSettingsGearButton(ctx, x, y, size, onClick) {
    const sz = size || 30;
    const cx = x + sz / 2;
    const cy = y + sz / 2;
    const spr = App.Assets && App.Assets.get ? App.Assets.get('icon_settings') : null;
    const isMuted = App.Audio ? App.Audio.isMuted() : false;

    ctx.save();
    if (spr) {
      ctx.drawImage(spr, x - 1, y - 1, sz + 2, sz + 2);
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, sz / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(54, 26, 12, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawVectorGear(ctx, cx, cy, sz * 0.31, '#fef08a');
    }
    if (isMuted) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.arc(x + sz - 4, y + sz - 4, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + sz - 7, y + sz - 7);
      ctx.lineTo(x + sz - 1, y + sz - 1);
      ctx.stroke();
    }
    ctx.restore();

    if (onClick) addHit(x - 3, y - 3, sz + 6, sz + 6, onClick);
  }

  function fmtComma(n) {
    return (Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // ★ 全局【九州钱庄 · 铜钱 ⇄ 元宝双向互转】弹窗（1元宝 = 10,000铜钱，任意界面顶栏元宝胶囊一键唤起）
  function drawExchangeModal(ctx) {
    if (!exchangeModalOpen || !App.State) return;
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();
    const rate = App.State.INGOT_EXCHANGE_RATE || 10000;
    const curGold = Number(st.gold) || 0;
    const curIngot = Number(st.ingot) || 0;
    const maxBuyIngot = Math.floor(curGold / rate);

    // 拦截底层点击穿透
    addHit(0, 0, W, H, () => {}, { silent: true });

    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 2, 0.68)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const pw = 660, ph = 368;
    const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);
    drawPanel(ctx, px, py, pw, ph, { r: 14, bg: '#f4e6c4', border: '#b45309', lineWidth: 2.5 });
    drawWoodHeader(ctx, px + 10, py + 10, pw - 20, 42);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText('九州官银钱庄 · 铜钱 ⇄ 元宝双向互转', px + pw / 2, py + 31);

    // 资产与汇率横幅
    drawPanel(ctx, px + 18, py + 60, pw - 36, 48, { r: 9, bg: '#3b1a0b', border: '#d4a34b', lineWidth: 1.4 });
    drawMiniIcon(ctx, 'res_gold', px + 34, py + 72, 24);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 13px "PingFang SC", sans-serif';
    ctx.fillText(`持有铜钱：${fmtComma(curGold)}`, px + 64, py + 84);

    drawMiniIcon(ctx, 'res_ingot', px + 248, py + 72, 24);
    ctx.fillStyle = '#fef08a';
    ctx.fillText(`持有元宝：${fmtComma(curIngot)}`, px + 278, py + 84);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`官定汇率：1 元宝 = ${fmtComma(rate)} 铜钱`, px + pw - 32, py + 84);
    ctx.restore();

    // 左栏：铜钱 → 换算元宝
    const boxW = (pw - 48) / 2;
    const boxH = 190;
    const leftX = px + 18, rightX = px + 30 + boxW, boxY = py + 116;

    drawPanel(ctx, leftX, boxY, boxW, boxH, { r: 10, bg: '#efe0be', border: '#b45309', lineWidth: 1.6 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7c2d12';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText('铜钱 → 铸造元宝', leftX + 14, boxY + 24);
    ctx.fillStyle = '#6b3417';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(`当前最多可兑：${fmtComma(maxBuyIngot)} 元宝`, leftX + 14, boxY + 43);
    ctx.restore();

    const toIngotPresets = [
      { n: 1, label: '兑 1 元宝', sub: `耗 ${fmtComma(rate)} 铜钱` },
      { n: 5, label: '兑 5 元宝', sub: `耗 ${fmtComma(rate * 5)} 铜钱` },
      { n: 10, label: '兑 10 元宝', sub: `耗 ${fmtComma(rate * 10)} 铜钱` },
      { n: Math.max(1, maxBuyIngot), label: maxBuyIngot > 0 ? `全兑 (${maxBuyIngot})` : '全部兑换', sub: '一键尽数换算', isMax: true },
    ];
    toIngotPresets.forEach((it, idx) => {
      const col = idx % 2, row = Math.floor(idx / 2);
      const bx = leftX + 12 + col * 144, by = boxY + 54 + row * 46;
      const disabled = it.isMax ? maxBuyIngot < 1 : curGold < it.n * rate;
      drawButton(ctx, bx, by, 138, 40, it.label, {
        r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12, subText: it.sub, disabled,
      }, () => App.State.exchangeCurrency('gold_to_ingot', it.n));
    });
    drawButton(ctx, leftX + 12, boxY + 148, boxW - 24, 32, '输入自定义兑换元宝数…', {
      r: 7, bg: '#5c2c16', border: '#d4a34b', fontSize: 11.5, disabled: maxBuyIngot < 1,
    }, () => {
      App.Platform.promptText(`请输入要兑换的元宝数量（1 ~ ${maxBuyIngot}，每1元宝需 ${fmtComma(rate)} 铜钱）`, (txt) => {
        const n = Math.floor(Number(String(txt || '').trim()));
        if (!n || n < 1) return showToast('请输入大于 0 的整数元宝数量', '#fca5a5');
        App.State.exchangeCurrency('gold_to_ingot', n);
      });
    });

    // 右栏：元宝 → 兑回铜钱
    drawPanel(ctx, rightX, boxY, boxW, boxH, { r: 10, bg: '#efe0be', border: '#78350f', lineWidth: 1.6 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText('元宝 → 兑回铜钱', rightX + 14, boxY + 24);
    ctx.fillStyle = '#6b3417';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(`可兑回总额：${fmtComma(curIngot * rate)} 铜钱`, rightX + 14, boxY + 43);
    ctx.restore();

    const toGoldPresets = [
      { n: 1, label: '1 元宝兑铜钱', sub: `得 +${fmtComma(rate)}` },
      { n: 5, label: '5 元宝兑铜钱', sub: `得 +${fmtComma(rate * 5)}` },
      { n: 10, label: '10 元宝兑铜钱', sub: `得 +${fmtComma(rate * 10)}` },
      { n: Math.max(1, curIngot), label: curIngot > 0 ? `全兑 (${curIngot}元宝)` : '全部兑回', sub: '一键化为军饷', isMax: true },
    ];
    toGoldPresets.forEach((it, idx) => {
      const col = idx % 2, row = Math.floor(idx / 2);
      const bx = rightX + 12 + col * 144, by = boxY + 54 + row * 46;
      const disabled = it.isMax ? curIngot < 1 : curIngot < it.n;
      drawButton(ctx, bx, by, 138, 40, it.label, {
        r: 7, grad: ['#9a3412', '#7c2d12'], border: '#fde68a', fontSize: 12, subText: it.sub, disabled,
      }, () => App.State.exchangeCurrency('ingot_to_gold', it.n));
    });
    drawButton(ctx, rightX + 12, boxY + 148, boxW - 24, 32, '输入自定义兑回元宝数…', {
      r: 7, bg: '#5c2c16', border: '#d4a34b', fontSize: 11.5, disabled: curIngot < 1,
    }, () => {
      App.Platform.promptText(`请输入要兑回铜钱的元宝数量（1 ~ ${curIngot}）`, (txt) => {
        const n = Math.floor(Number(String(txt || '').trim()));
        if (!n || n < 1) return showToast('请输入大于 0 的整数元宝数量', '#fca5a5');
        App.State.exchangeCurrency('ingot_to_gold', n);
      });
    });

    // 底部快捷跳转与关闭
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#78350f';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText('注：元宝仅能通过铜钱换算或天命轮盘低几率产出；10元宝起可在【元宝商店】购置传世精品！', px + 20, py + ph - 28);
    ctx.restore();

    if (App.Main && App.Main.getScene && App.Main.getScene() !== 'ingotShop') {
      drawButton(ctx, px + pw - 236, py + ph - 48, 126, 34, '前往元宝商店', {
        r: 8, grad: ['#b45309', '#78350f'], border: '#fef08a', fontSize: 12,
      }, () => {
        closeExchangeModal();
        App.Main.goScene('ingotShop');
      });
    }
    drawButton(ctx, px + pw - 100, py + ph - 48, 82, 34, '关 闭', {
      r: 8, bg: '#574c43', border: '#d6be92', fontSize: 12.5,
    }, closeExchangeModal);
    drawCloseButton(ctx, px + pw - 42, py + 10, 30, closeExchangeModal);
  }

  /**
   * 统一古风鎏金【✕ 关闭】圆章按钮（替代原各页面的文字“返回 / 返回地图”按钮）
   */
  function drawCloseButton(ctx, x, y, size, onClick, opts) {
    const sz = size || 34;
    const o = opts || {};
    const cx = x + sz / 2;
    const cy = y + sz / 2;
    const r = sz / 2;
    const gradCols = o.grad || ['#991b1b', '#450a0a'];
    const borderCol = o.border || '#fde047';
    const crossCol = o.color || '#fffbeb';

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, r * 0.1, cx, cy, r);
    g.addColorStop(0, gradCols[0]);
    g.addColorStop(1, gradCols[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = o.lineWidth || 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(254, 240, 138, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(4, r - 3.5), 0, Math.PI * 2);
    ctx.stroke();

    const arm = sz * 0.22;
    ctx.strokeStyle = crossCol;
    ctx.lineWidth = Math.max(2.3, sz * 0.085);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - arm, cy - arm);
    ctx.lineTo(cx + arm, cy + arm);
    ctx.moveTo(cx + arm, cy - arm);
    ctx.lineTo(cx - arm, cy + arm);
    ctx.stroke();
    ctx.restore();

    const cb = onClick || (() => {
      if (App.Main && App.Main.goScene) App.Main.goScene('map');
    });
    addHit(x - 6, y - 6, sz + 12, sz + 12, cb);
  }

  /**
   * 页面左右两侧悬浮翻页耳标按钮（替代底部/顶部冗长数字分页条）
   */
  function drawSidePageButtons(ctx, pageIdx, totalPages, onPageChange, opts) {
    const total = Math.max(1, Number(totalPages) || 1);
    const o = opts || {};
    if (total <= 1 && !o.alwaysShow) return;

    const W = (App.Platform && App.Platform.LOGICAL_W) || 960;
    const cur = Math.max(0, Math.min(total - 1, Number(pageIdx) || 0));
    const bw = o.w || 28;
    const bh = o.h || 82;
    const cy = o.cy || 312;
    const by = Math.round(cy - bh / 2);
    const lx = o.leftX != null ? o.leftX : 3;
    const rx = o.rightX != null ? o.rightX : (W - bw - 3);

    const gradActive = o.grad || ['#78350f', '#3b1806'];
    const gradDisabled = o.disabledGrad || ['rgba(45, 28, 18, 0.55)', 'rgba(24, 14, 9, 0.55)'];
    const borderActive = o.border || '#facc15';
    const borderDisabled = 'rgba(168, 162, 158, 0.35)';
    const arrowCol = o.arrowColor || '#fef08a';

    const drawSide = (bx, isLeft, enabled, targetPage) => {
      ctx.save();
      ctx.shadowColor = enabled ? 'rgba(0, 0, 0, 0.48)' : 'transparent';
      ctx.shadowBlur = enabled ? 6 : 0;
      ctx.shadowOffsetY = enabled ? 2 : 0;

      roundRect(ctx, bx, by, bw, bh, 9);
      const g = ctx.createLinearGradient(bx, by, bx, by + bh);
      const cols = enabled ? gradActive : gradDisabled;
      g.addColorStop(0, cols[0]);
      g.addColorStop(1, cols[1]);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = enabled ? borderActive : borderDisabled;
      ctx.lineWidth = enabled ? 1.8 : 1.1;
      ctx.stroke();

      // 矢量折角箭头
      const acx = bx + bw / 2 + (isLeft ? -1 : 1);
      const acy = by + bh / 2 - 8;
      ctx.strokeStyle = enabled ? arrowCol : 'rgba(168, 162, 158, 0.45)';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (isLeft) {
        ctx.moveTo(acx + 4, acy - 8);
        ctx.lineTo(acx - 4, acy);
        ctx.lineTo(acx + 4, acy + 8);
      } else {
        ctx.moveTo(acx - 4, acy - 8);
        ctx.lineTo(acx + 4, acy);
        ctx.lineTo(acx - 4, acy + 8);
      }
      ctx.stroke();

      // 紧凑页码角标 (如 1/6)
      ctx.fillStyle = enabled ? '#fde68a' : 'rgba(214, 211, 209, 0.45)';
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${cur + 1}/${total}`, bx + bw / 2, by + bh - 15, bw - 2);
      ctx.restore();

      if (enabled && onPageChange) {
        addHit(bx - 6, by - 6, bw + 12, bh + 12, () => onPageChange(targetPage));
      }
    };

    drawSide(lx, true, cur > 0, cur - 1);
    drawSide(rx, false, cur < total - 1, cur + 1);
  }

  App.UI = {
    clearHits, addHit, dispatchClick, showToast, updateToasts, drawToasts,
    beginLoading, endLoading, isActionLoading, hasActiveOverlay, drawSpinner, drawPanelLoading, drawLoadingOverlay,
    openExchangeModal, closeExchangeModal, drawExchangeModal,
    measureTextCached, wrapLinesCached,
    roundRect, drawPanel, drawWoodHeader, drawButton, drawAdButton, drawBar, drawWrappedText, drawAdOverlay, drawInputOverlay,
    drawMiniIcon, drawResCapsule, drawSoundToggle, drawVectorGear, drawSettingsGearButton, drawPagination,
    drawCloseButton, drawSidePageButtons,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
