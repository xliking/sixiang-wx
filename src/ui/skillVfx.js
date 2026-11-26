(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 离屏预烘焙纹理缓存：将黑底手绘原画特效羽化去边 + 色彩分级，呈现原生透明贴图级游戏特效质感
  const vfxTexCache = {};
  let vfxTexCount = 0;
  const MAX_VFX_CACHE = 96;

  const spiritCache = {};
  let spiritCount = 0;
  const MAX_SPIRIT_CACHE = 96;

  const swordTexCache = {};
  const relicTexCache = {};

  function hexToRgb(hex) {
    const s = String(hex || '#fbbf24').replace('#', '');
    const full = s.length === 3 ? (s[0] + s[0] + s[1] + s[1] + s[2] + s[2]) : s;
    const n = parseInt(full, 16);
    if (Number.isNaN(n)) return { r: 251, g: 191, b: 36 };
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function hashStr(str) {
    const s = String(str || 'sixiang');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  function seeded(seed, idx) {
    const x = Math.sin((seed % 9973) * 12.9898 + idx * 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function easeOutCubic(t) { const x = clamp01(t); return 1 - Math.pow(1 - x, 3); }
  function easeOutQuart(t) { const x = clamp01(t); return 1 - Math.pow(1 - x, 4); }
  function easeOutBack(t) {
    const x = clamp01(t);
    const c1 = 1.55, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function createOffscreenCanvas(w, h) {
    if (App.Platform && App.Platform.createOffscreen) {
      return App.Platform.createOffscreen(w, h);
    }
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    }
    if (typeof wx !== 'undefined' && typeof wx.createCanvas === 'function') {
      const c = wx.createCanvas();
      c.width = w;
      c.height = h;
      return c;
    }
    return null;
  }

  /**
   * 获取径向柔化去黑框的手绘特效离屏贴图（同时支持原生透明通道高清 PNG 与传统黑底 JPG 抠图染色）
   */
  function getPaintedVfxCanvas(primaryKey, fallbackKey, tintColor, tintStrength) {
    if (!App.Assets || !App.Assets.get) return null;
    const rawPrimary = primaryKey ? App.Assets.get(primaryKey) : null;
    const usedKey = rawPrimary ? primaryKey : fallbackKey;
    const img = rawPrimary || (fallbackKey ? App.Assets.get(fallbackKey) : null);
    if (!img) return null;

    // 支持任意强度(>=0.08)的精准元素色彩分级，彻底消除原画底色串色（如绿底八卦串入霸道金剑）
    const applyTint = (tintColor && (tintStrength == null || tintStrength > 0.08)) ? tintColor : null;
    const tStrength = rawPrimary ? (tintStrength != null ? tintStrength : 0) : Math.max(0.76, tintStrength || 0.80);
    const cacheKey = `${usedKey}|${applyTint || 'raw'}|${Math.round(tStrength * 100)}`;
    if (vfxTexCache[cacheKey]) return vfxTexCache[cacheKey];

    const sw = img.naturalWidth || img.width || 224;
    const sh = img.naturalHeight || img.height || 224;
    const isNonSquare = Math.abs(sw - sh) > 8;
    const maxDim = (isNonSquare || sw > 384 || sh > 384) ? 440 : 224;
    const sc = Math.min(1, maxDim / Math.max(sw, sh));
    const cw = isNonSquare ? Math.max(32, Math.round(sw * sc)) : maxDim;
    const ch = isNonSquare ? Math.max(32, Math.round(sh * sc)) : maxDim;

    const cvs = createOffscreenCanvas(cw, ch);
    if (!cvs) return img;
    const g = cvs.getContext('2d');
    if (!g) return img;

    if (vfxTexCount >= MAX_VFX_CACHE) {
      const fk = Object.keys(vfxTexCache)[0];
      if (fk) { delete vfxTexCache[fk]; vfxTexCount--; }
    }

    g.clearRect(0, 0, cw, ch);
    g.drawImage(img, 0, 0, cw, ch);

    const tintRgb = (applyTint && tStrength > 0.08) ? hexToRgb(applyTint) : null;
    let isNativeAlpha = false;
    try {
      const probe = g.getImageData(0, 0, cw, ch);
      const pd = probe.data;
      const c0 = pd[3];
      const c1 = pd[(cw - 1) * 4 + 3];
      const c2 = pd[(ch - 1) * cw * 4 + 3];
      const c3 = pd[(cw * ch - 1) * 4 + 3];
      isNativeAlpha = (c0 <= 4 && c1 <= 4 && c2 <= 4 && c3 <= 4);

      if (isNativeAlpha) {
        // ★ 原生透明通道高清 PNG（如 ChatGPT 生成的长枪/刀芒）：完整保留原图宽高比、锐利枪尖高光与半透冰晶细节，绝不套圆遮罩截断！
        if (tintRgb) {
          for (let i = 0; i < pd.length; i += 4) {
            if (pd[i + 3] === 0) continue;
            const r = pd[i], gr = pd[i + 1], b = pd[i + 2];
            const lum = (r * 0.299 + gr * 0.587 + b * 0.114) / 255;
            const hot = Math.pow(lum, 2.2);
            const tr = Math.min(255, tintRgb.r * lum * 1.38 + 255 * hot * 0.58);
            const tg = Math.min(255, tintRgb.g * lum * 1.38 + 252 * hot * 0.58);
            const tb = Math.min(255, tintRgb.b * lum * 1.38 + 242 * hot * 0.58);
            pd[i]     = Math.round(r * (1 - tStrength) + tr * tStrength);
            pd[i + 1] = Math.round(gr * (1 - tStrength) + tg * tStrength);
            pd[i + 2] = Math.round(b * (1 - tStrength) + tb * tStrength);
          }
          g.putImageData(probe, 0, 0);
        }
        cvs._isNativeAlpha = true;
        cvs._isPrimary = !!rawPrimary;
        cvs._aspect = cw / ch;
        vfxTexCache[cacheKey] = cvs;
        vfxTexCount++;
        return cvs;
      }
    } catch (e) {
      // 受限环境回退走常规径向柔化路径
    }

    // 传统黑底 JPG 特效贴图：径向软羽化遮罩 + 逐像素去黑底抠图 + 高光柔化抑制
    g.save();
    g.globalCompositeOperation = 'destination-in';
    const halfW = cw / 2, halfH = ch / 2, rad = Math.min(halfW, halfH);
    const mask = g.createRadialGradient(halfW, halfH, rad * 0.40, halfW, halfH, rad * 0.94);
    mask.addColorStop(0, 'rgba(255,255,255,1)');
    mask.addColorStop(0.55, 'rgba(255,255,255,0.92)');
    mask.addColorStop(0.78, 'rgba(255,255,255,0.45)');
    mask.addColorStop(0.93, 'rgba(255,255,255,0.08)');
    mask.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = mask;
    g.fillRect(0, 0, cw, ch);
    g.restore();

    let keyedOk = false;
    try {
      const imgData = g.getImageData(0, 0, cw, ch);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const a0 = d[i + 3];
        if (a0 === 0) continue;
        let r = d[i], gr = d[i + 1], b = d[i + 2];
        const mx = r > gr ? (r > b ? r : b) : (gr > b ? gr : b);
        if (mx <= 42) {
          d[i + 3] = 0;
          continue;
        }
        const keyA = Math.min(1, (mx - 42) / 155);
        if (tintRgb) {
          const lum = (r * 0.299 + gr * 0.587 + b * 0.114) / 255;
          const hot = Math.pow(lum, 2.4);
          const tr = Math.min(255, tintRgb.r * lum * 1.42 + 255 * hot * 0.55);
          const tg = Math.min(255, tintRgb.g * lum * 1.42 + 250 * hot * 0.55);
          const tb = Math.min(255, tintRgb.b * lum * 1.42 + 235 * hot * 0.55);
          r = Math.round(r * (1 - tStrength) + tr * tStrength);
          gr = Math.round(gr * (1 - tStrength) + tg * tStrength);
          b = Math.round(b * (1 - tStrength) + tb * tStrength);
        }
        const mx2 = r > gr ? (r > b ? r : b) : (gr > b ? gr : b);
        if (mx2 > 234) {
          const damp = (234 + (mx2 - 234) * 0.35) / mx2;
          r = Math.round(r * damp);
          gr = Math.round(gr * damp);
          b = Math.round(b * damp);
        }
        d[i] = r; d[i + 1] = gr; d[i + 2] = b;
        d[i + 3] = Math.round(a0 * keyA * 0.90);
      }
      g.putImageData(imgData, 0, 0);
      keyedOk = true;
    } catch (e) {
      // 微信小游戏或跨域受限环境不支持 getImageData 时：用原生 color 合成模式完成精准染色！
      if (applyTint && tStrength > 0.08) {
        try {
          g.save();
          g.globalCompositeOperation = 'color';
          g.globalAlpha = Math.min(0.96, tStrength);
          g.fillStyle = applyTint;
          g.fillRect(0, 0, cw, ch);
          g.restore();
        } catch (e2) {}
      }
    }

    cvs._isNativeAlpha = false;
    cvs._keyedOk = keyedOk;
    cvs._isPrimary = !!rawPrimary;
    cvs._aspect = cw / ch;
    vfxTexCache[cacheKey] = cvs;
    vfxTexCount++;
    return cvs;
  }

  /**
   * ★ 预烘焙原画级【天命神剑】离屏透明贴图（融合手绘神剑原画 eq_qinggang_sword 抠图调色 + 盘龙吞口剑格与剑气寒芒，彻底告别简陋小黄片！）
   * 坐标系：宽 140，高 280，剑尖朝正下方 (70, 266)，剑柄在上方 (70, 24)
   */
  function getDivineSwordCanvas(pal) {
    const pCol = (pal && pal.c2) || '#facc15';
    const dCol = (pal && pal.c1) || '#b91c1c';
    const lCol = (pal && pal.c3) || '#fef08a';
    const rawSword = (App.Assets && App.Assets.get) ? App.Assets.get('eq_qinggang_sword') : null;
    const key = `${dCol}|${pCol}|${lCol}|${rawSword ? 'art' : 'forged'}`;
    if (swordTexCache[key]) return swordTexCache[key];

    const W = 140, H = 280;
    const cvs = createOffscreenCanvas(W, H);
    if (!cvs) return null;
    const g = cvs.getContext('2d');
    if (!g) return null;

    const cx = W / 2;
    g.clearRect(0, 0, W, H);

    // 1. 若手绘神剑原画已就绪，先将手绘原画（左下剑柄->右上剑尖）旋转 135° 使剑尖垂直朝下，保留实心剑脊剑柄并抠除深蓝暗底 + 调配本命剑气色泽！
    if (rawSword) {
      const tmpSz = 200;
      const tmp = createOffscreenCanvas(tmpSz, tmpSz);
      const tg = tmp && tmp.getContext('2d');
      if (tg) {
        tg.drawImage(rawSword, 0, 0, tmpSz, tmpSz);
        try {
          const id = tg.getImageData(0, 0, tmpSz, tmpSz);
          const d = id.data;
          const rgb2 = hexToRgb(pCol);
          const rgb1 = hexToRgb(dCol);
          for (let y = 0; y < tmpSz; y++) {
            const ny = y / tmpSz;
            for (let x = 0; x < tmpSz; x++) {
              const nx = x / tmpSz;
              const idx = (y * tmpSz + x) * 4;
              // 对角线轴向进度 along (0=左下剑首 -> 1=右上剑尖) 与法向半宽 perp
              const along = (nx + (1 - ny)) * 0.5;
              const perp = Math.abs(nx - (1 - ny)) * 0.7071;
              const edgeMask = perp > 0.26 ? 0 : (perp > 0.16 ? (1 - (perp - 0.16) / 0.10) : 1);
              const borderFade = Math.min(1, Math.min(nx, 1 - nx, ny, 1 - ny) / 0.045);
              if (edgeMask <= 0.01 || borderFade <= 0.01 || along < 0.02 || along > 0.985) {
                d[idx + 3] = 0;
                continue;
              }

              // 实心剑体保护区（剑首 + 缠绳剑柄 + 盘龙鎏金剑格 + 收尖双斜面钢刃 100% 不镂空！）
              let coreW = 0;
              if (along >= 0.035 && along <= 0.235) {
                coreW = along < 0.085 ? 0.042 : 0.026;
              } else if (along > 0.235 && along <= 0.34) {
                coreW = 0.034 + Math.max(0, 1 - Math.abs(along - 0.285) / 0.055) * 0.078;
              } else if (along > 0.34 && along <= 0.968) {
                coreW = 0.056 * Math.min(1, (0.968 - along) / 0.13);
              }
              const inCore = perp <= coreW;

              const r0 = d[idx], g0 = d[idx + 1], b0 = d[idx + 2];
              const lum = (r0 * 0.299 + g0 * 0.587 + b0 * 0.114);
              let lumA = 1;
              if (!inCore) {
                const isDarkBg = (lum < 56) || (b0 > r0 * 1.35 && g0 < b0 * 0.74 && lum < 88);
                if (isDarkBg) { d[idx + 3] = 0; continue; }
                lumA = Math.min(1, (lum - 46) / 92);
                if (coreW > 0 && perp < coreW + 0.014) {
                  lumA = Math.max(lumA, 1 - (perp - coreW) / 0.014);
                }
              }

              // 保留鎏金盘龙剑格与乌木缠绳剑柄质感，将剑身与外焰剑气精准重铸为武将本命神辉！
              const isGripCord = inCore && along >= 0.085 && along <= 0.235 && perp <= 0.022;
              const isGoldFitting = along <= 0.315 && r0 > b0 * 1.14 && g0 > b0 * 0.96;
              if (isGripCord && !isGoldFitting) {
                const gt = lum / 255;
                d[idx]     = Math.min(255, Math.round(42 + gt * 95));
                d[idx + 1] = Math.min(255, Math.round(24 + gt * 68));
                d[idx + 2] = Math.min(255, Math.round(16 + gt * 42));
              } else if (!isGoldFitting) {
                const t = lum / 255;
                const hot = Math.pow(t, 2.0);
                const baseBoost = inCore ? 0.22 : 0;
                d[idx]     = Math.min(255, Math.round(rgb1.r * (baseBoost + (1 - t) * 0.55) + rgb2.r * t * 1.18 + 255 * hot * 0.58));
                d[idx + 1] = Math.min(255, Math.round(rgb1.g * (baseBoost + (1 - t) * 0.55) + rgb2.g * t * 1.18 + 252 * hot * 0.58));
                d[idx + 2] = Math.min(255, Math.round(rgb1.b * (baseBoost + (1 - t) * 0.55) + rgb2.b * t * 1.18 + 240 * hot * 0.58));
              }
              d[idx + 3] = Math.round(255 * edgeMask * borderFade * lumA);
            }
          }
          tg.putImageData(id, 0, 0);
          g.save();
          g.translate(cx, 140);
          g.rotate(Math.PI * 0.75);
          g.scale(0.92, 0.92);
          g.drawImage(tmp, -tmpSz / 2, -tmpSz / 2, tmpSz, tmpSz);
          g.restore();
        } catch (e) {}
      }
    }

    // 2. 叠加外层流光剑气护芒与高精锐利双斜面剑锋芯（既让手绘原画锋芒倍增，也在首帧原画未达时呈现神兵质感！）
    g.save();
    g.globalCompositeOperation = 'lighter';
    const auraG = g.createLinearGradient(cx, 38, cx, 266);
    auraG.addColorStop(0, 'rgba(0,0,0,0)');
    auraG.addColorStop(0.22, dCol);
    auraG.addColorStop(0.72, pCol);
    auraG.addColorStop(1, '#ffffff');
    g.globalAlpha = rawSword ? 0.36 : 0.58;
    g.fillStyle = auraG;
    g.beginPath();
    g.moveTo(cx, 270);
    g.quadraticCurveTo(cx - 22, 195, cx - 14, 66);
    g.lineTo(cx + 14, 66);
    g.quadraticCurveTo(cx + 22, 195, cx, 270);
    g.closePath();
    g.fill();
    g.restore();

    if (!rawSword) {
      // 无原画时的超清古风长剑金属双斜面雕刻（修长锋锐 185px，绝无粗短黄木棍感）
      g.save();
      g.lineJoin = 'round';
      // 左亮斜面
      const lg = g.createLinearGradient(cx - 9, 68, cx, 262);
      lg.addColorStop(0, lCol);
      lg.addColorStop(0.6, '#ffffff');
      lg.addColorStop(1, '#ffffff');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(cx, 264);
      g.lineTo(cx - 8.5, 224);
      g.lineTo(cx - 7.2, 70);
      g.lineTo(cx, 70);
      g.closePath();
      g.fill();

      // 右暗折光斜面
      const rg = g.createLinearGradient(cx, 68, cx + 9, 262);
      rg.addColorStop(0, pCol);
      rg.addColorStop(0.65, dCol);
      rg.addColorStop(1, lCol);
      g.fillStyle = rg;
      g.beginPath();
      g.moveTo(cx, 264);
      g.lineTo(cx, 70);
      g.lineTo(cx + 7.2, 70);
      g.lineTo(cx + 8.5, 224);
      g.closePath();
      g.fill();

      // 盘龙吞云鎏金剑格与修长剑柄
      const hg = g.createLinearGradient(cx - 24, 58, cx + 24, 78);
      hg.addColorStop(0, '#fef08a');
      hg.addColorStop(0.5, '#eab308');
      hg.addColorStop(1, '#92400e');
      g.fillStyle = hg;
      g.beginPath();
      g.moveTo(cx, 79);
      g.quadraticCurveTo(cx - 14, 72, cx - 25, 58);
      g.quadraticCurveTo(cx - 12, 62, cx - 5, 65);
      g.lineTo(cx + 5, 65);
      g.quadraticCurveTo(cx + 12, 62, cx + 25, 58);
      g.quadraticCurveTo(cx + 14, 72, cx, 79);
      g.closePath();
      g.fill();

      g.fillStyle = '#451a03';
      g.fillRect(cx - 3.2, 32, 6.4, 33);
      g.fillStyle = '#facc15';
      g.beginPath(); g.arc(cx, 29, 5.2, 0, Math.PI * 2); g.fill();
      g.restore();
    }

    // 3. 剑脊炽白贯日寒芒线 + 剑尖十字星芒（赋予一剑破苍穹的锋利神韵）
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.8;
    g.globalAlpha = 0.88;
    g.beginPath();
    g.moveTo(cx, 76);
    g.lineTo(cx, 262);
    g.stroke();

    // 剑尖破空星芒
    const tipY = 256;
    g.fillStyle = '#ffffff';
    g.globalAlpha = 0.92;
    g.beginPath();
    g.moveTo(cx, tipY - 14);
    g.lineTo(cx + 3.2, tipY - 2.5);
    g.lineTo(cx + 16, tipY);
    g.lineTo(cx + 3.2, tipY + 2.5);
    g.lineTo(cx, tipY + 14);
    g.lineTo(cx - 3.2, tipY + 2.5);
    g.lineTo(cx - 16, tipY);
    g.lineTo(cx - 3.2, tipY - 2.5);
    g.closePath();
    g.fill();
    g.restore();

    swordTexCache[key] = cvs;
    return cvs;
  }

  /**
   * ★ 预烘焙吕布独享原画级【鬼神方天画戟】离屏透明贴图（精准沿对角戟杆与双耳月牙刃抠除黑褐底色，彻底根除圆团黑底！）
   * 坐标系：宽 180，高 300，戟尖朝正下方 (90, 278)，双耳月牙刃在 (90, 206)
   */
  function getDivineHalberdCanvas() {
    const rawHb = (App.Assets && App.Assets.get) ? App.Assets.get('eq_fangtian_halberd') : null;
    const key = rawHb ? 'halberd_art_v2' : 'halberd_forged_v2';
    if (relicTexCache[key]) return relicTexCache[key];

    const W = 180, H = 300;
    const cvs = createOffscreenCanvas(W, H);
    const g = cvs && cvs.getContext('2d');
    if (!g) return null;
    const cx = W / 2;
    g.clearRect(0, 0, W, H);

    let drewRawHb = false;
    if (rawHb) {
      const tmpSz = 220;
      const tmp = createOffscreenCanvas(tmpSz, tmpSz);
      const tg = tmp && tmp.getContext('2d');
      if (tg) {
        tg.drawImage(rawHb, 0, 0, tmpSz, tmpSz);
        try {
          const id = tg.getImageData(0, 0, tmpSz, tmpSz);
          const d = id.data;
          for (let y = 0; y < tmpSz; y++) {
            const ny = y / tmpSz;
            for (let x = 0; x < tmpSz; x++) {
              const nx = x / tmpSz;
              const idx = (y * tmpSz + x) * 4;
              const along = (nx + (1 - ny)) * 0.5;
              const perp = Math.abs(nx - (1 - ny)) * 0.7071;
              const maxPerp = (along >= 0.45 && along <= 0.95) ? 0.33 : 0.14;
              const edgeMask = perp > maxPerp ? 0 : (perp > maxPerp - 0.07 ? (1 - (perp - (maxPerp - 0.07)) / 0.07) : 1);
              const borderFade = Math.min(1, Math.min(nx, 1 - nx, ny, 1 - ny) / 0.045);
              if (edgeMask <= 0.01 || borderFade <= 0.01 || along < 0.02 || along > 0.985) {
                d[idx + 3] = 0;
                continue;
              }
              const inShaft = along >= 0.04 && along <= 0.965 && perp <= 0.025 * Math.min(1, (0.98 - along) / 0.08);
              const inCrescent = along >= 0.54 && along <= 0.84 && perp >= 0.035 && perp <= 0.235;
              const r0 = d[idx], g0 = d[idx + 1], b0 = d[idx + 2];
              const lum = r0 * 0.299 + g0 * 0.587 + b0 * 0.114;
              let lumA = 1;
              if (!inShaft) {
                const minLum = inCrescent ? 38 : 72;
                if (lum < minLum) { d[idx + 3] = 0; continue; }
                lumA = Math.min(1, (lum - (minLum - 4)) / (inCrescent ? 56 : 95));
              }
              const t = lum / 255;
              d[idx]     = Math.min(255, Math.round(r0 * 1.15 + 42 * Math.pow(t, 1.5)));
              d[idx + 1] = Math.min(255, Math.round(g0 * 1.05 + 22 * Math.pow(t, 2.1)));
              d[idx + 2] = Math.min(255, Math.round(b0 * 0.92 + 28 * Math.pow(t, 2.8)));
              d[idx + 3] = Math.round(255 * edgeMask * borderFade * lumA);
            }
          }
          tg.putImageData(id, 0, 0);
          g.save();
          g.translate(cx, 150);
          g.rotate(Math.PI * 0.75);
          g.scale(0.92, 0.92);
          g.drawImage(tmp, -tmpSz / 2, -tmpSz / 2, tmpSz, tmpSz);
          g.restore();
          drewRawHb = true;
        } catch (e) {}
      }
    }

    if (!drewRawHb) {
      // 受限环境免 getImageData 高精雕刻【鬼神方天画戟】（赤金乌木长杆 + 龙吞口 + 对称双月耳刃 + 破天中锋！）
      g.save();
      g.fillStyle = '#450a0a';
      g.strokeStyle = '#d97706';
      g.lineWidth = 1.6;
      g.fillRect(cx - 3.6, 28, 7.2, 165);
      g.strokeRect(cx - 3.6, 28, 7.2, 165);

      // 左右双耳新月钢刃
      [-1, 1].forEach((sgn) => {
        const bg = g.createLinearGradient(cx, 162, cx + sgn * 48, 232);
        bg.addColorStop(0, '#dc2626');
        bg.addColorStop(0.55, '#facc15');
        bg.addColorStop(1, '#ffffff');
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(cx + sgn * 8, 168);
        g.quadraticCurveTo(cx + sgn * 52, 198, cx + sgn * 14, 242);
        g.quadraticCurveTo(cx + sgn * 30, 202, cx + sgn * 8, 168);
        g.closePath();
        g.fill();
      });

      // 中央修长双斜面破甲戟尖
      const sg = g.createLinearGradient(cx - 9, 168, cx + 9, 282);
      sg.addColorStop(0, '#fde047');
      sg.addColorStop(0.5, '#ffffff');
      sg.addColorStop(1, '#ef4444');
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(cx, 284);
      g.lineTo(cx - 8.5, 205);
      g.lineTo(cx, 166);
      g.lineTo(cx + 8.5, 205);
      g.closePath();
      g.fill();

      // 鎏金兽面吞口
      g.fillStyle = '#f59e0b';
      g.beginPath();
      g.arc(cx, 186, 10, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // 叠绘赤金魔雷戟芒与双耳月牙寒锋高光
    g.save();
    g.globalCompositeOperation = 'lighter';
    const ag = g.createLinearGradient(cx, 35, cx, 282);
    ag.addColorStop(0, 'rgba(0,0,0,0)');
    ag.addColorStop(0.35, '#dc2626');
    ag.addColorStop(0.75, '#f97316');
    ag.addColorStop(1, '#fef08a');
    g.globalAlpha = drewRawHb ? 0.34 : 0.45;
    g.fillStyle = ag;
    g.beginPath();
    g.moveTo(cx, 284);
    g.lineTo(cx - 10, 225);
    g.lineTo(cx - 5, 42);
    g.lineTo(cx + 5, 42);
    g.lineTo(cx + 10, 225);
    g.closePath();
    g.fill();

    g.strokeStyle = '#ffffff';
    g.lineWidth = 1.8;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(cx, 152);
    g.lineTo(cx, 276);
    g.stroke();
    g.restore();

    relicTexCache[key] = cvs;
    return cvs;
  }

  /**
   * 预烘焙手绘传国龙玺离屏贴图（干净抠除暗底，呈现通透翡翠盘龙金玺）
   */
  function getKeyedRelicCanvas(assetKey) {
    if (!App.Assets || !App.Assets.get) return null;
    const raw = App.Assets.get(assetKey);
    if (!raw) return null;
    if (relicTexCache[assetKey]) return relicTexCache[assetKey];

    const sz = 196;
    const cvs = createOffscreenCanvas(sz, sz);
    const g = cvs && cvs.getContext('2d');
    if (!g) return null;

    g.clearRect(0, 0, sz, sz);
    g.drawImage(raw, 0, 0, sz, sz);
    g.save();
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(sz / 2, sz / 2, sz * 0.18, sz / 2, sz / 2, sz * 0.47);
    m.addColorStop(0, 'rgba(255,255,255,1)');
    m.addColorStop(0.65, 'rgba(255,255,255,0.92)');
    m.addColorStop(0.86, 'rgba(255,255,255,0.32)');
    m.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = m;
    g.fillRect(0, 0, sz, sz);
    g.restore();

    try {
      const id = g.getImageData(0, 0, sz, sz);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const lum = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        if (lum < 50) { d[i + 3] = 0; continue; }
        d[i + 3] = Math.round(d[i + 3] * Math.min(1, (lum - 46) / 82));
      }
      g.putImageData(id, 0, 0);
    } catch (e) {}

    relicTexCache[assetKey] = cvs;
    return cvs;
  }

  function drawStarFlare(ctx, x, y, r, col, alpha, rot) {
    if (alpha <= 0.02) return;
    const rad = Math.min(18, r * 0.68);
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp01(alpha) * 0.42;
    const rg = ctx.createRadialGradient(0, 0, 0.5, 0, 0, rad * 1.15);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.35, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(0, 0, rad * 1.15, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = clamp01(alpha) * 0.65;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const len = i % 2 === 0 ? rad * 0.85 : rad * 0.14;
      const px = Math.cos(a) * len, py = Math.sin(a) * len;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 烘焙名将骑乘幻影 / 四象神兽真灵发光原画贴图（与武将本尊画风 100% 统一！）
   */
  function getGlowingSpiritCanvas(spriteKey, glowColor, tintAlpha) {
    if (!App.Assets || !App.Assets.get) return null;
    const spr = App.Assets.get(spriteKey) || (String(spriteKey || '').startsWith('battle_gen_') ? App.Assets.get('unit_gen_silver') : null);
    if (!spr) return null;

    const ta = tintAlpha != null ? tintAlpha : 0.36;
    const key = `${spriteKey}|${glowColor || 'none'}|${Math.round(ta * 100)}`;
    if (spiritCache[key]) return spiritCache[key];

    const sw = spr.naturalWidth || spr.width || 160;
    const sh = spr.naturalHeight || spr.height || 160;
    const maxDim = 220;
    const sc = Math.min(maxDim / sw, maxDim / sh);
    const cw = Math.max(32, Math.round(sw * sc) + 28);
    const ch = Math.max(32, Math.round(sh * sc) + 28);

    const cvs = createOffscreenCanvas(cw, ch);
    if (!cvs) return spr;
    const g = cvs.getContext('2d');
    if (!g) return spr;

    if (spiritCount >= MAX_SPIRIT_CACHE) {
      const fk = Object.keys(spiritCache)[0];
      if (fk) { delete spiritCache[fk]; spiritCount--; }
    }

    const dw = Math.round(sw * sc);
    const dh = Math.round(sh * sc);
    const ox = Math.round((cw - dw) / 2);
    const oy = Math.round((ch - dh) / 2);

    g.clearRect(0, 0, cw, ch);
    if (glowColor) {
      g.save();
      g.globalAlpha = 0.24;
      g.drawImage(spr, ox - 3, oy, dw, dh);
      g.drawImage(spr, ox + 3, oy, dw, dh);
      g.drawImage(spr, ox, oy - 3, dw, dh);
      g.drawImage(spr, ox, oy + 3, dw, dh);
      g.restore();
    }
    g.drawImage(spr, ox, oy, dw, dh);

    if (glowColor && ta > 0.02) {
      g.save();
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = ta;
      g.fillStyle = glowColor;
      g.fillRect(0, 0, cw, ch);
      g.restore();
    }

    spiritCache[key] = cvs;
    spiritCount++;
    return cvs;
  }

  /**
   * 在战场任意坐标绘制一张手绘原画特效贴图（支持缩放、旋转、镜像、自适应宽高比与原生透明 PNG 高透渲染）
   */
  function drawPaintedBurst(ctx, primaryKey, fallbackKey, x, y, w, h, rot, alpha, tintColor, flipX, tintStrength) {
    if (alpha <= 0.01) return false;
    const tex = getPaintedVfxCanvas(primaryKey, fallbackKey, tintColor, tintStrength);
    if (!tex) return false;

    const isNative = !!tex._isNativeAlpha;
    const keyedOk = !!tex._keyedOk;
    const aspect = tex._aspect || ((tex.width && tex.height) ? (tex.width / tex.height) : 1);
    const drawW = (h == null && !tex._isPrimary && aspect < 1.2) ? w * 0.66 : w;
    const drawH = h != null ? h : (drawW / aspect);

    const cleanA = clamp01(alpha) * (isNative ? 0.86 : 0.48);
    ctx.save();
    ctx.translate(x, y);
    if (flipX) ctx.scale(-1, 1);
    if (rot) ctx.rotate(rot);
    // 若受限环境未执行逐像素去黑底（!keyedOk），强制使用 screen 滤色混合以 100% 消除黑底圆斑！
    ctx.globalCompositeOperation = (isNative || keyedOk) ? 'source-over' : 'screen';
    ctx.globalAlpha = cleanA;
    ctx.drawImage(tex, -drawW / 2, -drawH / 2, drawW, drawH);
    if (isNative) {
      if (cleanA > 0.14) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = cleanA * 0.24;
        ctx.drawImage(tex, -drawW / 2, -drawH / 2, drawW, drawH);
      }
    } else if (cleanA > 0.20) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = cleanA * 0.14;
      ctx.drawImage(tex, -drawW * 0.44, -drawH * 0.44, drawW * 0.88, drawH * 0.88);
    }
    ctx.restore();
    return true;
  }

  /**
   * 绘制武将/圣兽手绘原画真灵虚影（支持冲刺残影与威压巨像）
   */
  function drawSpiritPhantom(ctx, spriteKey, x, y, targetH, facing, alpha, glowColor, rot, tintAlpha, additive) {
    if (alpha <= 0.01) return;
    const tex = getGlowingSpiritCanvas(spriteKey, glowColor, tintAlpha);
    if (!tex) return;
    const tw = tex.width || 160;
    const th = tex.height || 160;
    const dh = targetH;
    const dw = (tw / th) * dh;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing || 1, 1);
    if (rot) ctx.rotate(rot);
    if (additive) ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp01(alpha);
    ctx.drawImage(tex, -dw / 2, -dh * 0.86, dw, dh);
    ctx.restore();
  }

  // ================= 30 大国风古典配色主题表 =================
  const PREFIX_THEMES = {
    '太白': { c1: '#ca8a04', c2: '#fde047', c3: '#fef9c3', core: '#ffffff', tint: '#fbbf24' },
    '鬼神': { c1: '#991b1b', c2: '#ef4444', c3: '#fb923c', core: '#fff1f2', tint: '#ef4444' },
    '七星': { c1: '#0284c7', c2: '#38bdf8', c3: '#e0f2fe', core: '#ffffff', tint: '#38bdf8' },
    '无双': { c1: '#b91c1c', c2: '#f97316', c3: '#fde047', core: '#fffbeb', tint: '#f97316' },
    '八荒': { c1: '#92400e', c2: '#f59e0b', c3: '#fef08a', core: '#fffbeb', tint: '#f59e0b' },
    '乾坤': { c1: '#0d9488', c2: '#34d399', c3: '#fde047', core: '#f0fdfa', tint: '#10b981' },
    '九天': { c1: '#6d28d9', c2: '#c084fc', c3: '#fde047', core: '#faf5ff', tint: '#a855f7' },
    '玄冥': { c1: '#0369a1', c2: '#38bdf8', c3: '#bae6fd', core: '#f8fafc', tint: '#38bdf8' },
    '裂地': { c1: '#9a3412', c2: '#fb923c', c3: '#fde047', core: '#fff7ed', tint: '#f97316' },
    '紫电': { c1: '#7e22ce', c2: '#d8b4fe', c3: '#67e8f9', core: '#ffffff', tint: '#a855f7' },
    '流火': { c1: '#dc2626', c2: '#fb923c', c3: '#fde047', core: '#fffbeb', tint: '#ef4444' },
    '苍穹': { c1: '#0284c7', c2: '#7dd3fc', c3: '#e0f2fe', core: '#ffffff', tint: '#38bdf8' },
    '贪狼': { c1: '#be123c', c2: '#fb7185', c3: '#fda4af', core: '#fff1f2', tint: '#f43f5e' },
    '盘龙': { c1: '#047857', c2: '#34d399', c3: '#fde047', core: '#ecfdf5', tint: '#10b981' },
    '赤焰': { c1: '#b91c1c', c2: '#ef4444', c3: '#fbbf24', core: '#fefce8', tint: '#ef4444' },
    '天罡': { c1: '#0f766e', c2: '#5eead4', c3: '#fde047', core: '#ffffff', tint: '#14b8a6' },
    '朱雀': { c1: '#c2410c', c2: '#fb923c', c3: '#fef08a', core: '#fff7ed', tint: '#f97316' },
    '青霜': { c1: '#0e7490', c2: '#22d3ee', c3: '#cffafe', core: '#ffffff', tint: '#06b6d4' },
    '惊鸿': { c1: '#be185d', c2: '#f472b6', c3: '#fde68a', core: '#fff1f2', tint: '#ec4899' },
    '霸王': { c1: '#a16207', c2: '#facc15', c3: '#fef08a', core: '#fefce8', tint: '#eab308' },
    '阴阳': { c1: '#0f766e', c2: '#5eead4', c3: '#fde047', core: '#ffffff', tint: '#14b8a6' },
    '猛虎': { c1: '#b45309', c2: '#fbbf24', c3: '#fef08a', core: '#fffbeb', tint: '#f59e0b' },
    '地煞': { c1: '#581c87', c2: '#a78bfa', c3: '#fbbf24', core: '#f5f3ff', tint: '#9333ea' },
    '狂澜': { c1: '#0369a1', c2: '#22d3ee', c3: '#a5f3fc', core: '#f0f9ff', tint: '#06b6d4' },
    '六合': { c1: '#0f766e', c2: '#38bdf8', c3: '#fde68a', core: '#f8fafc', tint: '#0ea5e9' },
    '破军': { c1: '#991b1b', c2: '#f87171', c3: '#fde047', core: '#ffffff', tint: '#ef4444' },
    '奔雷': { c1: '#4338ca', c2: '#60a5fa', c3: '#fde047', core: '#ffffff', tint: '#3b82f6' },
    '焚天': { c1: '#dc2626', c2: '#f59e0b', c3: '#fef08a', core: '#ffffff', tint: '#f97316' },
    '寒冰': { c1: '#0284c7', c2: '#7dd3fc', c3: '#e0f2fe', core: '#ffffff', tint: '#38bdf8' },
    '幽冥': { c1: '#581c87', c2: '#c084fc', c3: '#fde047', core: '#faf5ff', tint: '#a855f7' },
  };

  // 中段招式语义映射为 12 大原画级演出流派
  const MIDDLE_ACTION_MAP = {
    '凝霜': 'ice_lotus',
    '冰封': 'ice_lotus',
    '天罚': 'thunder_tempest',
    '惊雷': 'thunder_tempest',
    '伏魔': 'bagua_swords',
    '诛邪': 'bagua_swords',
    '剑雨': 'bagua_swords',
    '斩月': 'dragon_blade',
    '刀罡': 'dragon_blade',
    '横扫': 'crimson_halberd',
    '戟影': 'crimson_halberd',
    '穿云': 'phoenix_arrows',
    '贯日': 'phoenix_arrows',
    '坠星': 'astral_meteor',
    '碎星': 'astral_meteor',
    '灭世': 'astral_meteor',
    '追魂': 'astral_meteor',
    '夺魄': 'crimson_halberd',
    '裂空': 'silver_spear_rush',
    '枪芒': 'silver_spear_rush',
    '破军': 'cavalry_stampede',
    '燎原': 'inferno_storm',
    '焚城': 'inferno_storm',
    '狂岚': 'tidal_tsunami',
    '覆海': 'tidal_tsunami',
    '泣血': 'blossom_ribbons',
    '断岳': 'tiger_quake',
    '震山': 'tiger_quake',
  };

  // 全部 54 位三国传奇名将 + 四象神兽 独立专属原画演出预设（每位均绑定各自独立骑乘贴图 battle_gen_<id> 与专属特征异象 sig，绝不雷同！）
  const HERO_PRESETS = {
    // 蜀汉 15 将（含五虎上将）
    liubei:        { pal: '乾坤', style: 'bagua_swords',      sig: 'liubei_twin_swords',     beastSpr: 'beast_sprite_qinglong' },
    zhugeliang:    { pal: '天罡', style: 'bagua_thunder',     sig: 'zhugeliang_eight_gates', beastSpr: 'beast_sprite_qinglong' },
    guanyu:        { pal: '盘龙', style: 'dragon_blade',      sig: 'guanyu_crescent_moon',   beastSpr: 'beast_sprite_qinglong' },
    zhaoyun:       { pal: '苍穹', style: 'silver_spear_rush', sig: 'zhaoyun_seven_star',     beastSpr: 'beast_sprite_qinglong' },
    zhangfei:      { pal: '鬼神', style: 'tiger_quake',       sig: 'zhangfei_bridge_fissure', beastSpr: 'beast_sprite_baihu' },
    machao:        { pal: '太白', style: 'cavalry_stampede',  sig: 'machao_thunder_spears',  beastSpr: 'beast_sprite_baihu' },
    huangzhong:    { pal: '焚天', style: 'phoenix_arrows',    sig: 'huangzhong_solar_bow',   beastSpr: 'beast_sprite_zhuque' },
    pangtong:      { pal: '朱雀', style: 'inferno_storm',     sig: 'pangtong_iron_chains',   beastSpr: 'beast_sprite_zhuque' },
    huangyueying:  { pal: '八荒', style: 'petrify_monolith_seal', sig: 'huangyueying_mech_gears', beastSpr: null },
    weiyan:        { pal: '贪狼', style: 'crimson_halberd',   sig: 'weiyan_blood_fangs',     beastSpr: null },
    jiangwei:      { pal: '阴阳', style: 'silver_spear_rush', sig: 'jiangwei_nine_lances',   beastSpr: 'beast_sprite_qinglong' },
    fazheng:       { pal: '阴阳', style: 'venom_miasma_plague', sig: 'fazheng_eye_reticle',    beastSpr: null },
    guanping:      { pal: '盘龙', style: 'dragon_blade',        sig: 'guanping_jade_wheel',    beastSpr: null },
    menghuo:       { pal: '裂地', style: 'tiger_quake',         sig: 'menghuo_totem_stomp',    beastSpr: 'beast_sprite_baihu' },
    zhurong:       { pal: '流火', style: 'inferno_storm',       sig: 'zhurong_fire_boomerangs', beastSpr: 'beast_sprite_zhuque' },

    // 曹魏 15 将（含五子良将）
    caocao:        { pal: '无双', style: 'bagua_swords',        sig: 'caocao_imperial_seal',   beastSpr: null },
    simayi:        { pal: '幽冥', style: 'astral_meteor',       sig: 'simayi_abyss_vortex',    beastSpr: 'beast_sprite_xuanwu' },
    dianwei:       { pal: '破军', style: 'crimson_halberd',     sig: 'dianwei_twin_halberds',  beastSpr: 'beast_sprite_baihu' },
    zhangliao:     { pal: '七星', style: 'cavalry_stampede',    sig: 'zhangliao_azure_crescent', beastSpr: null },
    xuhuang:       { pal: '苍穹', style: 'dragon_blade',        sig: 'xuhuang_giant_axe',      beastSpr: 'beast_sprite_baihu' },
    zhanghe:       { pal: '紫电', style: 'petrify_monolith_seal', sig: 'zhanghe_butterfly_hex', beastSpr: null },
    yuejin:        { pal: '六合', style: 'dragon_blade',        sig: 'yuejin_sky_leap_slash',  beastSpr: null },
    yujin:         { pal: '太白', style: 'bagua_swords',        sig: 'yujin_iron_phalanx',     beastSpr: 'beast_sprite_xuanwu' },
    guojia:        { pal: '玄冥', style: 'ice_lotus',           sig: 'guojia_ten_frost_peaks', beastSpr: 'beast_sprite_xuanwu' },
    zhenji:        { pal: '青霜', style: 'ice_lotus',           sig: 'zhenji_moon_ripples',    beastSpr: null },
    xiahoudun:     { pal: '贪狼', style: 'dragon_blade',        sig: 'xiahoudun_blood_eye',    beastSpr: null },
    xiahouyuan:    { pal: '奔雷', style: 'phoenix_arrows',      sig: 'xiahouyuan_triple_bolts', beastSpr: null },
    xuchu:         { pal: '猛虎', style: 'tiger_quake',         sig: 'xuchu_meteor_hammer',    beastSpr: 'beast_sprite_baihu' },
    caoren:        { pal: '霸王', style: 'petrify_monolith_seal', sig: 'caoren_eight_locks',   beastSpr: 'beast_sprite_xuanwu' },
    jiaxu:         { pal: '地煞', style: 'venom_miasma_plague', sig: 'jiaxu_venom_curtain',    beastSpr: null },

    // 东吴 13 将（含江东四督）
    sunquan:       { pal: '无双', style: 'bagua_swords',        sig: 'sunquan_jade_seal',      beastSpr: 'beast_sprite_baihu' },
    sunce:         { pal: '无双', style: 'cavalry_stampede',    sig: 'sunce_conqueror_lance',  beastSpr: 'beast_sprite_baihu' },
    zhouyu:        { pal: '赤焰', style: 'inferno_storm',       sig: 'zhouyu_zither_waves',    beastSpr: 'beast_sprite_zhuque' },
    luxun:         { pal: '流火', style: 'inferno_storm',       sig: 'luxun_linked_beacons',   beastSpr: null },
    lvmeng:        { pal: '寒冰', style: 'petrify_monolith_seal', sig: 'lvmeng_mist_moon_blade', beastSpr: null },
    lusu:          { pal: '乾坤', style: 'sacred_heal_burst',   sig: 'lusu_granary_bounty',    beastSpr: null },
    ganning:       { pal: '狂澜', style: 'tidal_tsunami',       sig: 'ganning_iron_anchor',    beastSpr: 'beast_sprite_qinglong' },
    sunshangxiang: { pal: '赤焰', style: 'phoenix_arrows',      sig: 'sunshangxiang_chakrams', beastSpr: null },
    taishici:      { pal: '青霜', style: 'phoenix_arrows',      sig: 'taishici_twin_pierce',   beastSpr: null },
    huanggai:      { pal: '裂地', style: 'inferno_storm',       sig: 'huanggai_fire_prow',     beastSpr: null },
    zhoutai:       { pal: '破军', style: 'crimson_halberd',     sig: 'zhoutai_scar_slashes',   beastSpr: null },
    daqiao:        { pal: '天罡', style: 'spring_regen_rain',   sig: 'daqiao_aqua_lanterns',   beastSpr: 'beast_sprite_xuanwu' },
    xiaoqiao:      { pal: '惊鸿', style: 'spring_regen_rain',   sig: 'xiaoqiao_peach_petals',  beastSpr: null },

    // 群雄 11 将（吕布独占全游戏唯一全屏灭世流派 lvbu_unrivaled_god！）
    lvbu:          { pal: '鬼神', style: 'lvbu_unrivaled_god',  sig: 'lvbu_cross_halberd',     beastSpr: null },
    diaochan:      { pal: '九天', style: 'blossom_ribbons',     sig: 'diaochan_eclipse_moon',  beastSpr: null },
    yuanshao:      { pal: '太白', style: 'phoenix_arrows',      sig: 'yuanshao_royal_archers', beastSpr: null },
    yanliang:      { pal: '赤焰', style: 'dragon_blade',        sig: 'yanliang_gold_guillotine', beastSpr: null },
    wenchou:       { pal: '紫电', style: 'silver_spear_rush',   sig: 'wenchou_shadow_fork',    beastSpr: null },
    gongsunzan:    { pal: '寒冰', style: 'cavalry_stampede',    sig: 'gongsunzan_snow_tracks', beastSpr: null },
    gaoshun:       { pal: '破军', style: 'tiger_quake',         sig: 'gaoshun_battering_wedge', beastSpr: null },
    dongzhuo:      { pal: '地煞', style: 'venom_miasma_plague', sig: 'dongzhuo_abyss_goblet',  beastSpr: null },
    huaxiong:      { pal: '裂地', style: 'crimson_halberd',     sig: 'huaxiong_wolf_fang_chop', beastSpr: null },
    huatuo:        { pal: '乾坤', style: 'sacred_heal_burst',   sig: 'huatuo_jade_gourd',      beastSpr: 'beast_sprite_qinglong' },
    zhangjiao:     { pal: '八荒', style: 'petrify_monolith_seal', sig: 'zhangjiao_yellow_talismans', beastSpr: null },

    // 十二神兽全屏圣技（四象圣兽 / 太古四凶 / 上古创世神兽）
    beast_qinglong:{ pal: '盘龙', style: 'divine_beast_ult', beastId: 'qinglong', beastSpr: 'beast_sprite_qinglong' },
    beast_baihu:   { pal: '太白', style: 'divine_beast_ult', beastId: 'baihu',    beastSpr: 'beast_sprite_baihu' },
    beast_zhuque:  { pal: '朱雀', style: 'divine_beast_ult', beastId: 'zhuque',   beastSpr: 'beast_sprite_zhuque' },
    beast_xuanwu:  { pal: '玄冥', style: 'divine_beast_ult', beastId: 'xuanwu',   beastSpr: 'beast_sprite_xuanwu' },
    beast_taotie:  { pal: '幽冥', style: 'divine_beast_ult', beastId: 'taotie',   beastSpr: 'beast_sprite_taotie' },
    beast_qiongqi: { pal: '鬼神', style: 'divine_beast_ult', beastId: 'qiongqi',  beastSpr: 'beast_sprite_qiongqi' },
    beast_taowu:   { pal: '裂地', style: 'divine_beast_ult', beastId: 'taowu',    beastSpr: 'beast_sprite_taowu' },
    beast_hundun:  { pal: '惊鸿', style: 'divine_beast_ult', beastId: 'hundun',   beastSpr: 'beast_sprite_hundun' },
    beast_qilin:   { pal: '霸王', style: 'divine_beast_ult', beastId: 'qilin',    beastSpr: 'beast_sprite_qilin' },
    beast_baize:   { pal: '青霜', style: 'divine_beast_ult', beastId: 'baize',    beastSpr: 'beast_sprite_baize' },
    beast_kunpeng: { pal: '奔雷', style: 'divine_beast_ult', beastId: 'kunpeng',  beastSpr: 'beast_sprite_kunpeng' },
    beast_zhulong: { pal: '焚天', style: 'divine_beast_ult', beastId: 'zhulong',  beastSpr: 'beast_sprite_zhulong' },
  };

  const ALL_STYLES = [
    'silver_spear_rush', 'dragon_blade', 'crimson_halberd', 'tiger_quake',
    'phoenix_arrows', 'thunder_tempest', 'inferno_storm', 'ice_lotus',
    'bagua_swords', 'astral_meteor', 'blossom_ribbons', 'tidal_tsunami', 'cavalry_stampede',
  ];

  function resolveHeroSprite(gid) {
    if (!gid) return 'unit_gen_silver';
    if (App.Config && App.Config.resolveGeneralCombatProfile) {
      return App.Config.resolveGeneralCombatProfile(gid).spriteKey;
    }
    return 'battle_gen_' + gid;
  }

  function resolveSkillProfile(fx) {
    const gid = fx.generalId || (fx.beastId ? 'beast_' + fx.beastId : '');
    const sName = String(fx.skillName || '');
    const h = hashStr(gid + '|' + sName);

    const gCfg = (App.Config && App.Config.GENERALS && gid) ? App.Config.GENERALS[gid] : null;
    const sRole = fx.skillRole || (gCfg && gCfg.skillRole) || '';

    if (HERO_PRESETS[gid]) {
      const pre = HERO_PRESETS[gid];
      let style = (gCfg && gCfg.vfxSpec && gCfg.vfxSpec.style) || pre.style;
      let palTheme = pre.pal;
      // 若后台修改了名将的技能定位 skillRole（如改为群疗/渐疗/中毒/石化），自动联动切换对应大招主演出！
      if (sRole === 'mass_heal' && style !== 'sacred_heal_burst' && style !== 'bagua_swords') {
        style = 'sacred_heal_burst'; palTheme = '乾坤';
      } else if (sRole === 'gradual_hot' && style !== 'spring_regen_rain' && style !== 'ice_lotus' && style !== 'tiger_quake') {
        style = 'spring_regen_rain'; palTheme = '天罡';
      } else if (sRole === 'poison_dot' && style !== 'venom_miasma_plague' && style !== 'astral_meteor') {
        style = 'venom_miasma_plague'; palTheme = '地煞';
      } else if (sRole === 'petrify_cc' && style !== 'petrify_monolith_seal') {
        style = 'petrify_monolith_seal'; palTheme = '八荒';
      }
      return {
        gid,
        seed: h,
        pal: PREFIX_THEMES[palTheme] || PREFIX_THEMES['无双'],
        style,
        sig: pre.sig || null,
        heroSpr: resolveHeroSprite(gid),
        beastSpr: pre.beastSpr || null,
        beastId: pre.beastId || fx.beastId || null,
        variant: h % 7,
      };
    }
    const p2 = sName.slice(0, 2);
    const m2 = sName.slice(2, 4);
    let pal = PREFIX_THEMES[p2];
    if (!pal) {
      if (sRole === 'mass_heal') pal = PREFIX_THEMES['乾坤'];
      else if (sRole === 'gradual_hot') pal = PREFIX_THEMES['天罡'];
      else if (sRole === 'petrify_cc' || /[石化封岩化岩凝石迷石]/.test(sName)) pal = PREFIX_THEMES['八荒'];
      else if (sRole === 'poison_dot' || /[蛊毒鸩瘴腐瘟]/.test(sName)) pal = PREFIX_THEMES['地煞'];
      else if (/[冰霜雪寒凝冻洛]/.test(sName) || fx.element === 'ice') pal = PREFIX_THEMES['玄冥'];
      else if (/[火炎焚赤燎烈阳]/.test(sName) || fx.element === 'fire') pal = PREFIX_THEMES['赤焰'];
      else if (/[雷电霆震苍]/.test(sName) || fx.element === 'thunder') pal = PREFIX_THEMES['紫电'];
      else if (/[风岚青盘龙]/.test(sName)) pal = PREFIX_THEMES['盘龙'];
      else if (/[花月舞香桃洛倾]/.test(sName) || fx.element === 'heal_petal') pal = PREFIX_THEMES['惊鸿'];
      else if (/[幽冥鬼魔魂煞]/.test(sName) || fx.element === 'shadow') pal = PREFIX_THEMES['幽冥'];
      else if (/[水浪涛海江潮]/.test(sName)) pal = PREFIX_THEMES['狂澜'];
      else pal = PREFIX_THEMES['霸王'];
    }

    let style = null;
    if (sRole === 'mass_heal') style = 'sacred_heal_burst';
    else if (sRole === 'gradual_hot') style = 'spring_regen_rain';
    else if (sRole === 'poison_dot') style = 'venom_miasma_plague';
    else if (sRole === 'petrify_cc') style = 'petrify_monolith_seal';
    else style = MIDDLE_ACTION_MAP[m2];

    if (!style) {
      if (/[石化封岩化岩凝石迷石]/.test(sName)) style = 'petrify_monolith_seal';
      else if (/[蛊毒鸩瘴腐瘟]/.test(sName)) style = 'venom_miasma_plague';
      else if (/[济世普度活血圣疗仙露]/.test(sName)) style = 'sacred_heal_burst';
      else if (/[回春绵延润脉生肌甘露]/.test(sName)) style = 'spring_regen_rain';
      else if (/[箭弓射羽]/.test(sName)) style = 'phoenix_arrows';
      else if (/[剑诛伏]/.test(sName)) style = 'bagua_swords';
      else if (/[枪矛刺闪]/.test(sName)) style = 'silver_spear_rush';
      else if (/[戟狂乱]/.test(sName)) style = 'crimson_halberd';
      else if (/[刀斩偃]/.test(sName)) style = 'dragon_blade';
      else if (/[吼啸锤岳山震虎]/.test(sName)) style = 'tiger_quake';
      else if (/[骑马踏冲]/.test(sName)) style = 'cavalry_stampede';
      else if (/[冰霜雪寒]/.test(sName)) style = 'ice_lotus';
      else if (/[火炎焚燎]/.test(sName)) style = 'inferno_storm';
      else if (/[雷电霆]/.test(sName)) style = 'thunder_tempest';
      else if (/[花舞香倾]/.test(sName)) style = 'blossom_ribbons';
      else if (/[水海浪涛岚]/.test(sName)) style = 'tidal_tsunami';
      else style = ALL_STYLES[h % ALL_STYLES.length];
    }

    let beastSpr = null;
    if (p2 === '盘龙') beastSpr = 'beast_sprite_qinglong';
    else if (p2 === '朱雀') beastSpr = 'beast_sprite_zhuque';
    else if (p2 === '猛虎' || p2 === '贪狼') beastSpr = 'beast_sprite_baihu';
    else if (p2 === '玄冥') beastSpr = 'beast_sprite_xuanwu';

    return {
      gid,
      seed: h,
      pal,
      style,
      heroSpr: resolveHeroSprite(gid),
      beastSpr,
      beastId: fx.beastId || null,
      variant: h % 9,
    };
  }

  // ================= 柔光地面阵纹底衬（清爽半透贴地符阵，彻底杜绝地面大白斑过曝！） =================
  function drawPaintedGroundArray(ctx, style, x, y, isFull, p, alpha, pal) {
    const scale = easeOutBack(Math.min(1, p * 2.6)) * (isFull ? 1.38 : 1.04);
    const w = 285 * scale;

    // 仅绘制极柔和元素色底环（严禁使用纯白中心渐变，确保沙场地面与兵马清晰锐利）
    ctx.save();
    ctx.globalAlpha = alpha * 0.22;
    ctx.strokeStyle = pal.c2;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.ellipse(x, y + 6, w * 0.48, w * 0.17, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    let primary = 'vfx_holy_heal';
    let fallback = 'vfx_holy_heal';
    let groundTint = pal.tint;
    let groundTintStrength = 0.72;
    if (style === 'sacred_heal_burst' || style === 'spring_regen_rain') {
      primary = 'vfx_holy_heal'; fallback = 'vfx_holy_heal'; groundTint = '#10b981'; groundTintStrength = 0.18;
    } else if (style === 'petrify_monolith_seal') {
      primary = 'vfx_holy_heal'; fallback = 'vfx_crimson_slash'; groundTint = '#d97706'; groundTintStrength = 0.78;
    } else if (style === 'venom_miasma_plague') {
      primary = 'vfx_meteor_starfall'; fallback = 'vfx_water_tsunami'; groundTint = '#84cc16'; groundTintStrength = 0.82;
    } else if (style === 'lvbu_unrivaled_god') {
      primary = 'vfx_crimson_slash'; fallback = 'vfx_fire'; groundTint = '#ef4444'; groundTintStrength = 0.45;
    } else if (style === 'ice_lotus' || style === 'tidal_tsunami' || style === 'silver_spear_rush') {
      primary = 'vfx_ice'; fallback = 'vfx_ice'; groundTintStrength = 0.35;
    } else if (style === 'inferno_storm' || style === 'phoenix_arrows') {
      primary = 'vfx_fire'; fallback = 'vfx_fire'; groundTintStrength = 0.35;
    } else if (style === 'crimson_halberd' || style === 'tiger_quake') {
      primary = 'vfx_crimson_slash'; fallback = 'vfx_crimson_slash'; groundTintStrength = 0.55;
    } else if (style === 'bagua_swords') {
      primary = 'vfx_crimson_slash'; fallback = 'vfx_dragon_slash'; groundTintStrength = 0.78;
    } else if (style === 'thunder_tempest') {
      primary = 'vfx_thunder'; fallback = 'vfx_thunder'; groundTintStrength = 0.45;
    } else if (style === 'astral_meteor') {
      primary = 'vfx_meteor_starfall'; fallback = 'vfx_holy_heal'; groundTintStrength = 0.55;
    }

    const tex = getPaintedVfxCanvas(primary, fallback, groundTint, groundTintStrength);
    if (!tex) return;

    ctx.save();
    ctx.translate(x, y + 8);
    ctx.scale(1, 0.36);
    ctx.rotate(p * 1.35);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha * (style === 'lvbu_unrivaled_god' ? 0.55 : 0.38);
    ctx.drawImage(tex, -w / 2, -w / 2, w, w);
    ctx.restore();
  }

  // ================= 针尖级锐利收尾新月刀芒/枪芒（内外圆弧精确交汇于同一刀尖点，100% 根除平头进度条白圈！） =================
  function traceTrueCrescentPath(ctx, rOut, bellyShift, halfAng) {
    const tx = rOut * Math.cos(halfAng);
    const ty = rOut * Math.sin(halfAng);
    const rIn = Math.hypot(tx + bellyShift, ty);
    const inAng = Math.atan2(ty, tx + bellyShift);
    ctx.beginPath();
    ctx.arc(0, 0, rOut, -halfAng, halfAng, false);
    ctx.arc(-bellyShift, 0, rIn, inAng, -inAng, true);
    ctx.closePath();
  }

  function drawSleekCrescentArc(ctx, x, y, radius, thickness, rot, alpha, pal, flipX) {
    if (alpha <= 0.01 || radius <= 4) return;
    ctx.save();
    ctx.translate(x, y);
    if (flipX) ctx.scale(-1, 1);
    ctx.rotate(rot);
    ctx.globalCompositeOperation = 'lighter';

    // 1. 外层狂暴元素气焰晕（两端 100% 尖锐收束成针芒！）
    ctx.globalAlpha = clamp01(alpha * 0.42);
    ctx.fillStyle = pal.c1;
    traceTrueCrescentPath(ctx, radius + thickness * 0.28, thickness * 1.15, 1.28);
    ctx.fill();

    // 2. 主体流光金属气刃腹
    ctx.globalAlpha = clamp01(alpha * 0.82);
    ctx.fillStyle = pal.c2;
    traceTrueCrescentPath(ctx, radius, thickness * 0.68, 1.16);
    ctx.fill();

    // 3. 极细炽白破空寒芒芯
    ctx.globalAlpha = clamp01(alpha * 0.96);
    ctx.fillStyle = '#ffffff';
    traceTrueCrescentPath(ctx, radius * 0.985, Math.max(2.5, thickness * 0.24), 0.96);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 渐隐流光疾掠残影束（两端全透明平滑消融，专用于突进枪影残迹）
   */
  function drawColossalSlashBeam(ctx, x, y, halfLen, halfThick, ang, alpha, cOuter, cMid) {
    if (alpha <= 0.02) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';

    const g1 = ctx.createLinearGradient(-halfLen, 0, halfLen, 0);
    g1.addColorStop(0, 'rgba(0,0,0,0)');
    g1.addColorStop(0.26, cOuter);
    g1.addColorStop(0.5, cMid);
    g1.addColorStop(0.74, cOuter);
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = clamp01(alpha * 0.56);
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.moveTo(-halfLen, 0);
    ctx.quadraticCurveTo(0, -halfThick * 1.45, halfLen, 0);
    ctx.quadraticCurveTo(0, halfThick * 1.45, -halfLen, 0);
    ctx.closePath();
    ctx.fill();

    const g2 = ctx.createLinearGradient(-halfLen * 0.78, 0, halfLen * 0.78, 0);
    g2.addColorStop(0, 'rgba(255,255,255,0)');
    g2.addColorStop(0.5, '#ffffff');
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = clamp01(alpha * 0.72);
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.moveTo(-halfLen * 0.78, 0);
    ctx.quadraticCurveTo(0, -halfThick * 0.38, halfLen * 0.78, 0);
    ctx.quadraticCurveTo(0, halfThick * 0.38, -halfLen * 0.78, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /**
   * 弧形横扫千军【方天双月刃气浪】（针尖新月弧 + 纵向渐变消融，彻底告别僵硬直线十字旗！）
   */
  function drawSweepingHalberdWave(ctx, x, y, rx, ry, belly, rot, alpha, cOuter, cMid, flipX) {
    if (alpha <= 0.02 || rx <= 8) return;
    ctx.save();
    ctx.translate(x, y);
    if (flipX) ctx.scale(-1, 1);
    ctx.rotate(rot);
    ctx.scale(1, ry / rx);
    ctx.globalCompositeOperation = 'lighter';

    const gOut = ctx.createLinearGradient(0, -rx, 0, rx);
    gOut.addColorStop(0, 'rgba(0,0,0,0)');
    gOut.addColorStop(0.22, cOuter);
    gOut.addColorStop(0.5, cMid);
    gOut.addColorStop(0.78, cOuter);
    gOut.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = clamp01(alpha * 0.78);
    ctx.fillStyle = gOut;
    traceTrueCrescentPath(ctx, rx, belly, 1.34);
    ctx.fill();

    const gCore = ctx.createLinearGradient(0, -rx * 0.85, 0, rx * 0.85);
    gCore.addColorStop(0, 'rgba(255,255,255,0)');
    gCore.addColorStop(0.32, cMid);
    gCore.addColorStop(0.5, '#ffffff');
    gCore.addColorStop(0.68, cMid);
    gCore.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = clamp01(alpha * 0.92);
    ctx.fillStyle = gCore;
    traceTrueCrescentPath(ctx, rx * 0.98, Math.max(4, belly * 0.32), 1.08);
    ctx.fill();

    ctx.restore();
  }

  /**
   * 撕裂苍穹的分叉鬼神赤雷（吕布全屏震慑眩晕专属天裂狂雷！）
   */
  function drawHeavenlyLightningBolt(ctx, x1, y1, x2, y2, seed, alpha, cGlow, cCore) {
    if (alpha <= 0.02) return;
    const segs = 9;
    const pts = [{ x: x1, y: y1 }];
    for (let i = 1; i < segs; i++) {
      const t = i / segs;
      const jit = (seeded(seed, i * 7) - 0.5) * 56 * Math.sin(t * Math.PI);
      pts.push({
        x: x1 + (x2 - x1) * t + jit,
        y: y1 + (y2 - y1) * t,
      });
    }
    pts.push({ x: x2, y: y2 });

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.globalAlpha = clamp01(alpha * 0.62);
    ctx.strokeStyle = cGlow;
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    pts.forEach((pt, idx) => { if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
    ctx.stroke();

    ctx.globalAlpha = clamp01(alpha * 0.95);
    ctx.strokeStyle = cCore;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    pts.forEach((pt, idx) => { if (idx === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); });
    ctx.stroke();

    // 分叉支脉雷弧
    const bIdx = 4;
    const bp = pts[bIdx];
    const dir = seeded(seed, 91) > 0.5 ? 1 : -1;
    ctx.globalAlpha = clamp01(alpha * 0.72);
    ctx.strokeStyle = cGlow;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(bp.x, bp.y);
    ctx.lineTo(bp.x + dir * 32, bp.y + 38);
    ctx.lineTo(bp.x + dir * 52, bp.y + 78);
    ctx.stroke();
    ctx.restore();
  }

  // ================= 原画级主招式演出（全部基于手绘原画贴图 + 武将/圣兽真灵动态合成） =================
  function drawMainStyleShow(ctx, prof, fx, vx, vw, p, alpha, facing) {
    const pal = prof.pal;
    const isFull = !!fx.isFullscreen;
    const cx = isFull ? (vx + vw * 0.52) : fx.x;
    const cy = fx.y;
    const casterX = fx.casterX != null ? fx.casterX : (cx - 210 * facing);
    const casterY = fx.casterY != null ? fx.casterY : cy;
    const flip = facing < 0;
    const spanW = isFull ? (vw - 180) : 290;
    const leftX = isFull ? (vx + 90) : (cx - 145);

    switch (prof.style) {
      case 'lvbu_unrivaled_god': {
        // ★★★【吕布全屏神技 · 前景清透层（绝不遮挡战场兵马！）】：
        // 魔神巨像、原画血火十字与擎天画戟均已置于兵马身后的远景层（renderBackdrop），前景仅呈现利落通透的【赤兔疾影】与【方天双月破空刃浪】！
        const fullSpan = vw - 150;

        // 1. 前段 0.42 秒：赤兔三道半透疾掠残影横贯沙场（低透明度清透残影，绝不盖住本尊！）
        for (let i = 0; i < 3; i++) {
          const dp = (p - i * 0.08) / 0.30;
          if (dp <= 0 || dp >= 1) continue;
          const dir = (i % 2 === 0 ? 1 : -1) * facing;
          const rx = (cx - dir * (fullSpan * 0.42)) + easeOutQuart(dp) * dir * (fullSpan * 0.84);
          const ry = cy - 14 + (i - 1) * 24;
          const ra = alpha * Math.sin(dp * Math.PI) * 0.44;
          drawColossalSlashBeam(ctx, rx - dir * 46, ry - 34, 110, 5.0, 0.04 * dir, ra, '#dc2626', '#fde047');
          drawSpiritPhantom(ctx, prof.heroSpr, rx, ry, 96, dir, ra, '#ef4444', -0.06, 0.25, false);
        }

        // 2. 两道修长锋锐、半透通明的【方天双月破空刃浪】向左右两侧疾速推开（中央交战区完全通透清晰！）
        const mp = clamp01((p - 0.04) / 0.78);
        if (mp > 0 && mp < 1) {
          const ma = alpha * Math.sin(mp * Math.PI);
          const expand = easeOutQuart(Math.min(1, mp * 1.9));
          const sweepOut = 54 + expand * (vw * 0.34);

          drawSleekCrescentArc(ctx, cx + sweepOut, cy - 42, 115 * (0.7 + expand * 0.35), 17, -0.08, ma * 0.68, pal, false);
          drawSleekCrescentArc(ctx, cx - sweepOut, cy - 42, 115 * (0.7 + expand * 0.35), 17, -0.08, ma * 0.68, pal, true);

          if (mp < 0.42) {
            const flashA = ma * (1 - mp / 0.42) * 0.48;
            drawSleekCrescentArc(ctx, cx, cy - 44, 145 * expand, 14, -0.44 * facing, flashA, pal, false);
            drawSleekCrescentArc(ctx, cx, cy - 44, 145 * expand, 14, 0.44 * facing, flashA, pal, true);
          }
        }
        break;
      }

      case 'petrify_monolith_seal': {
        // ★【玄石石化奇阵 · 张角黄天玄石咒 / 曹仁八门化石阵 / 张郃迷石阵 / 黄月英机关石化炮 / 吕蒙封石斩】：
        // 大地龟裂琥珀封印大阵 + 5 座拔地而起的太古玄武岩镇魂石碑 + 飞溅碎岩晶簇 + 石化禁锢波环！
        if (p < 0.68) {
          drawSpiritPhantom(ctx, prof.heroSpr, casterX + p * 42 * facing, casterY - Math.sin(p * Math.PI) * 14, 118, facing, alpha * 0.86, '#fbbf24', 0, 0.28, false);
        }
        if (prof.beastSpr) {
          drawSpiritPhantom(ctx, prof.beastSpr, cx, cy - 72, 195, facing, alpha * 0.78, '#f59e0b', 0, 0.30, true);
        }

        // 底部奇门琥珀封印光爆
        const sealSz = (isFull ? 355 : 275) * easeOutBack(Math.min(1, p * 2.2));
        drawPaintedBurst(ctx, 'vfx_holy_heal', 'vfx_thunder', cx, cy - 38, sealSz, sealSz * 0.85, p * 0.9, alpha * 0.90, '#d97706', false, 0.78);

        // 5 座拔地而起的太古玄石镇魂巨碑（立体双斜面玄武岩 + 鎏金封印符纹裂脉！）
        const stoneCnt = isFull ? 5 : 4;
        const sSpan = isFull ? (vw * 0.62) : 240;
        const sLeft = isFull ? (vx + vw * 0.20) : (cx - 120);
        for (let i = 0; i < stoneCnt; i++) {
          const sp = clamp01((p - i * 0.055) / 0.74);
          if (sp <= 0 || sp >= 1) continue;
          const rise = easeOutBack(Math.min(1, sp * 2.4));
          const fade = sp > 0.72 ? (1 - (sp - 0.72) / 0.28) : 1;
          const sx = sLeft + (i + 0.5) * (sSpan / stoneCnt);
          const sy = cy + 8 + ((i % 2) === 0 ? -8 : 10);
          const mw = (i === Math.floor(stoneCnt / 2) ? 46 : 34);
          const mh = (i === Math.floor(stoneCnt / 2) ? 148 : 112) * rise;
          const tilt = (i - (stoneCnt - 1) / 2) * 0.08;

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(tilt);
          ctx.globalAlpha = clamp01(alpha * fade * 0.96);

          // 石碑暗面与亮面玄武岩切面
          ctx.fillStyle = '#44403c';
          ctx.beginPath();
          ctx.moveTo(-mw * 0.52, 0);
          ctx.lineTo(-mw * 0.42, -mh * 0.84);
          ctx.lineTo(0, -mh);
          ctx.lineTo(mw * 0.44, -mh * 0.82);
          ctx.lineTo(mw * 0.52, 0);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#a8a29e';
          ctx.beginPath();
          ctx.moveTo(-mw * 0.52, 0);
          ctx.lineTo(-mw * 0.42, -mh * 0.84);
          ctx.lineTo(0, -mh);
          ctx.lineTo(-mw * 0.05, 0);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#e7e5e4';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // 石碑中央琥珀金锁封印神纹
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(0, -mh * 0.82);
          ctx.lineTo(0, -mh * 0.20);
          ctx.moveTo(-mw * 0.24, -mh * 0.58);
          ctx.lineTo(mw * 0.24, -mh * 0.58);
          ctx.moveTo(-mw * 0.18, -mh * 0.38);
          ctx.lineTo(mw * 0.18, -mh * 0.38);
          ctx.stroke();

          ctx.restore();
          drawStarFlare(ctx, sx, sy - mh * 0.62, 20, '#fde047', alpha * fade * 0.88, p * 4 + i);
        }

        // 石化灰金波环向外震荡锁敌
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let r = 0; r < 2; r++) {
          const rp = clamp01(p * 1.45 - r * 0.22);
          if (rp <= 0 || rp >= 1) continue;
          ctx.globalAlpha = alpha * (1 - rp) * 0.78;
          ctx.strokeStyle = r === 0 ? '#fde047' : '#d6d3d1';
          ctx.lineWidth = 3.2 * (1 - rp * 0.4);
          ctx.beginPath();
          ctx.ellipse(cx, cy, 40 + rp * (isFull ? 290 : 185), 14 + rp * 52, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'sacred_heal_burst': {
        // ★【群体一次性治疗 · 华佗青囊济世露 / 鲁肃指囷犒赏】：医圣仙灵护佑 + 380px翠金圣莲大阵 + 四道冲天甘露圣光柱 + 仙丹星辉普度全军！
        const centerHealX = isFull ? (vx + vw * 0.44) : cx;
        if (p < 0.75) {
          const hp = p / 0.75;
          drawSpiritPhantom(ctx, prof.heroSpr, casterX, casterY - Math.sin(hp * Math.PI) * 18, 138, facing, alpha * 0.88, '#34d399', 0, 0.24, true);
        }
        if (prof.beastSpr) {
          const bp = clamp01(p * 1.15);
          drawSpiritPhantom(ctx, prof.beastSpr, centerHealX, cy - 78 - Math.sin(bp * Math.PI) * 28, 210, facing, alpha * 0.78, '#34d399', -0.04, 0.25, true);
        }

        // 核心巨幅先天生机圣莲大阵绽放
        const bloom = easeOutBack(Math.min(1, p * 2.3));
        const lotusSz = (isFull ? 375 : 295) * bloom;
        drawPaintedBurst(ctx, 'vfx_holy_heal', 'vfx_holy_heal', centerHealX, cy - 52, lotusSz, lotusSz, p * 0.65, alpha * 0.96, '#10b981', false, 0.16);

        // 4 道冲天翡翠流金圣疗光柱沐浴友军全阵
        const pillarCnt = isFull ? 4 : 3;
        const pSpan = isFull ? (vw * 0.56) : 240;
        const pStart = isFull ? (vx + 95) : (centerHealX - 120);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < pillarCnt; i++) {
          const pp = clamp01((p - i * 0.07) / 0.72);
          if (pp <= 0 || pp >= 1) continue;
          const px0 = pStart + (i + 0.5) * (pSpan / pillarCnt);
          const pa = alpha * Math.sin(pp * Math.PI);
          const pw = 54 * (0.75 + pp * 0.35);
          const ph = 255;
          const pg = ctx.createLinearGradient(px0 - pw / 2, 0, px0 + pw / 2, 0);
          pg.addColorStop(0, 'rgba(0,0,0,0)');
          pg.addColorStop(0.3, '#10b981');
          pg.addColorStop(0.5, '#ecfdf5');
          pg.addColorStop(0.7, '#fde047');
          pg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = clamp01(pa * 0.68);
          ctx.fillStyle = pg;
          ctx.fillRect(px0 - pw / 2, cy - ph + 16, pw, ph);

          drawPaintedBurst(ctx, 'vfx_holy_heal', 'vfx_blossom_dance', px0, cy - 18, 165 * easeOutCubic(pp), 72 * easeOutCubic(pp), pp, pa * 0.85, '#34d399', i % 2 === 1, 0.25);
          drawStarFlare(ctx, px0, cy - 58 - pp * 85, 26, '#fde047', pa * 0.95, p * 3 + i);
        }
        ctx.restore();
        break;
      }

      case 'spring_regen_rain': {
        // ★【持续逐渐治疗(HoT) · 小乔桃华春风露 / 大乔沧海甘霖曲】：漫天芳华花雨/碧波灵雾飘洒 + 三重绵延翡翠回春波纹 + 升腾生命星萤！
        const centerHotX = isFull ? (vx + vw * 0.46) : cx;
        const canopySz = (isFull ? 360 : 285) * easeOutBack(Math.min(1, p * 2.0));
        drawPaintedBurst(ctx, 'vfx_blossom_dance', 'vfx_holy_heal', centerHotX - 75, cy - 72, canopySz, canopySz, p * 1.4, alpha * 0.88, pal.tint, false, 0.48);
        drawPaintedBurst(ctx, 'vfx_holy_heal', 'vfx_blossom_dance', centerHotX + 65, cy - 58, canopySz * 0.88, canopySz * 0.88, -p * 1.2, alpha * 0.86, '#10b981', true, 0.22);

        if (prof.beastSpr) {
          drawSpiritPhantom(ctx, prof.beastSpr, centerHotX, cy - 68, 185, facing, alpha * 0.72, '#2dd4bf', 0, 0.26, true);
        }

        // 绵延不绝的三重地面回春灵泉波环 + 16 缕袅袅升腾的翠玉回春仙气
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let r = 0; r < 3; r++) {
          const rp = ((p * 1.8 + r * 0.33) % 1);
          ctx.globalAlpha = alpha * Math.sin(rp * Math.PI) * 0.68;
          ctx.strokeStyle = r % 2 === 0 ? '#34d399' : '#fef08a';
          ctx.lineWidth = 2.8 * (1 - rp * 0.4);
          ctx.beginPath();
          ctx.ellipse(centerHotX, cy + 4, 48 + rp * (isFull ? 295 : 185), 14 + rp * 52, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        for (let m = 0; m < 16; m++) {
          const mr = seeded(prof.seed, m + 11);
          const mp2 = (p * 1.4 + mr) % 1;
          const mx = (isFull ? (vx + 90 + mr * (vw - 220)) : (centerHotX + (mr - 0.5) * 240)) + Math.sin(p * 6 + m) * 14;
          const my = (cy + 10) - mp2 * 165;
          const ma2 = alpha * Math.sin(mp2 * Math.PI);
          drawStarFlare(ctx, mx, my, 12 + (m % 3) * 4, m % 2 === 0 ? '#4ade80' : '#fbcfe8', ma2 * 0.88, p * 4 + m);
        }
        ctx.restore();
        break;
      }

      case 'venom_miasma_plague': {
        // ★【目标中毒 · 贾诩万蛊噬魂毒 / 法正鸩羽计 / 董卓腐骨毒 / 朵思毒泉】：幽绿紫黑万蛊毒泉喷发 + 盘旋毒蛟气刃 + 升腾剧毒酸泡爆裂！
        if (p < 0.62) {
          drawSpiritPhantom(ctx, prof.heroSpr, casterX + p * 45 * facing, casterY - Math.sin(p * Math.PI) * 14, 114, facing, alpha * 0.82, '#84cc16', 0, 0.32, false);
        }

        const pools = isFull ? 4 : 3;
        for (let i = 0; i < pools; i++) {
          const vp = clamp01((p - i * 0.08) / 0.72);
          if (vp <= 0 || vp >= 1) continue;
          const vx0 = isFull ? (leftX + (i + 0.5) * (spanW / pools)) : (cx + (i - 1) * 72);
          const vy0 = cy - 38 + (i % 2) * 18;
          const va = alpha * Math.sin(vp * Math.PI);
          const vsz = (225 + (i === 1 ? 45 : 0)) * (0.78 + easeOutCubic(vp) * 0.34);
          drawPaintedBurst(ctx, 'vfx_meteor_starfall', 'vfx_water_tsunami', vx0, vy0, vsz, vsz, vp * (i % 2 === 0 ? 1.1 : -1.1), va * 0.95, i % 2 === 0 ? '#84cc16' : '#9333ea', i % 2 === 1, 0.82);
        }

        // 双毒蛟盘旋蚀骨弯月毒刃
        const vPal = { c1: '#4d7c0f', c2: '#a3e635', c3: '#d8b4fe' };
        drawSleekCrescentArc(ctx, cx, cy - 46, 112, 26, p * 5.2 * facing, alpha * 0.90, vPal, flip);
        drawSleekCrescentArc(ctx, cx, cy - 46, 96, 22, (p * 5.2 + Math.PI) * facing, alpha * 0.85, { c1: '#581c87', c2: '#c084fc', c3: '#bef264' }, flip);

        // 16 颗剧毒瘴气腐蚀气泡升腾爆散
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 16; b++) {
          const br = seeded(prof.seed, b + 31);
          const bp = (p * 1.55 + br) % 1;
          const bx = cx + (br - 0.5) * (isFull ? spanW * 0.85 : 230) + Math.sin(p * 7 + b) * 12;
          const by = (cy + 8) - bp * 155;
          const ba = alpha * Math.sin(bp * Math.PI) * 0.85;
          const rad = (4.5 + (b % 4) * 2.4) * (0.7 + bp * 0.5);
          ctx.globalAlpha = clamp01(ba);
          ctx.fillStyle = b % 3 === 0 ? '#c084fc' : '#a3e635';
          ctx.beginPath(); ctx.arc(bx, by, rad, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ecfccb';
          ctx.beginPath(); ctx.arc(bx - rad * 0.3, by - rad * 0.3, rad * 0.32, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        break;
      }

      case 'silver_spear_rush': {
        // ★【赵云 · 龙胆七进七出 / 姜维 · 麒麟星落枪】：7 道银龙枪影全屏高速穿梭 + 苍龙破空贯日巨枪终式！
        const isZhaoyun = prof.gid === 'zhaoyun';
        const dashes = 7;
        for (let i = 0; i < dashes; i++) {
          const dp = (p - i * 0.085) / 0.32;
          if (dp <= 0 || dp >= 1) continue;
          const dir = (i % 2 === 0 ? 1 : -1) * facing;
          const ease = easeOutQuart(dp);
          const startX = cx - dir * (isFull ? 310 : 185);
          const endX = cx + dir * (isFull ? 310 : 185);
          const curX = startX + (endX - startX) * ease;
          const curY = cy - 8 + ((i % 3) - 1) * 28;
          const fadeA = alpha * Math.sin(dp * Math.PI);

          if (isZhaoyun) {
            const lungeAng = ((i % 3) - 1) * 0.065 * dir;
            const spearW = isFull ? 325 : 268;
            drawColossalSlashBeam(ctx, curX - 58 * dir, curY - 38, 170, 8, lungeAng, fadeA * 0.82, '#0284c7', '#e0f2fe');
            drawSpiritPhantom(ctx, prof.heroSpr, curX - 38 * dir, curY, 102, dir, fadeA * 0.42, '#7dd3fc', -0.06, 0.48, true);
            drawSpiritPhantom(ctx, prof.heroSpr, curX - 10 * dir, curY, 108, dir, fadeA * 0.94, '#bae6fd', -0.08, 0.18, false);
            drawPaintedBurst(
              ctx, 'vfx_zhaoyun_spear', 'vfx_dragon_slash',
              curX + 68 * dir, curY - 38,
              spearW, null, lungeAng, fadeA * 0.98, null, dir < 0, 0
            );
            drawStarFlare(
              ctx,
              curX + (68 + spearW * 0.44) * dir,
              curY - 38 + Math.sin(lungeAng) * spearW * 0.44 * dir,
              22, '#e0f2fe', fadeA * 0.92, dp * 4
            );
          } else {
            drawColossalSlashBeam(ctx, curX - 45 * dir, curY - 34, 155, 9, -0.05 * dir, fadeA * 0.86, pal.c1, pal.c2);
            drawSpiritPhantom(ctx, prof.heroSpr, curX - 28 * dir, curY, 100, dir, fadeA * 0.45, pal.c2, -0.06, 0.55, true);
            drawSpiritPhantom(ctx, prof.heroSpr, curX, curY, 108, dir, fadeA * 0.94, pal.c2, -0.08, 0.22, false);

            drawPaintedBurst(
              ctx, 'vfx_silver_spear', 'vfx_dragon_slash',
              curX + 26 * dir, curY - 40,
              220, 220, (dp - 0.5) * 0.9, fadeA * 0.95, pal.tint || '#38bdf8', dir < 0, 0.78
            );
          }
        }

        if (p > 0.14) {
          const cp = clamp01((p - 0.14) / 0.78);
          const ca = alpha * Math.sin(cp * Math.PI);
          if (isZhaoyun) {
            if (prof.beastSpr) {
              drawSpiritPhantom(
                ctx, prof.beastSpr,
                cx + (-55 + easeOutCubic(cp) * 125) * facing, cy - 78 - easeOutCubic(cp) * 26,
                210, facing, ca * 0.62, '#7dd3fc', -0.08, 0.62, true
              );
            }
            // 终式：巨幅银龙破空长枪正面贯阵而出，完整展现苍龙盘枪与寒芒枪尖！
            const thrustX = cx + (-88 + easeOutQuart(cp) * 142) * facing;
            const thrustY = cy - 46;
            const mainW = (isFull ? 545 : 425) * (0.88 + easeOutCubic(cp) * 0.20);
            drawColossalSlashBeam(ctx, thrustX - 75 * facing, thrustY, mainW * 0.52, 13, -0.03 * facing, ca * 0.72, '#0284c7', '#bae6fd');
            drawPaintedBurst(
              ctx, 'vfx_zhaoyun_spear', 'vfx_dragon_slash',
              thrustX, thrustY,
              mainW, null, -0.03 * facing, ca, null, flip, 0
            );
            const tipX = thrustX + mainW * 0.455 * facing;
            const tipY = thrustY - mainW * 0.455 * 0.03;
            drawStarFlare(ctx, tipX, tipY, (isFull ? 44 : 34) * (0.75 + Math.sin(cp * Math.PI) * 0.35), '#ffffff', ca * 0.96, cp * 5.2);
          } else {
            if (prof.beastSpr) {
              drawSpiritPhantom(
                ctx, prof.beastSpr,
                cx + (cp - 0.5) * 140 * facing, cy - 56 - easeOutCubic(cp) * 38,
                215, facing, ca * 0.84, pal.c2, -0.10, 0.36, true
              );
            }
            const mainSz = (isFull ? 360 : 285) * (0.82 + easeOutCubic(cp) * 0.34);
            drawPaintedBurst(
              ctx, 'vfx_silver_spear', 'vfx_dragon_slash',
              cx, cy - 46, mainSz, mainSz,
              -0.25 + cp * 0.65, ca, pal.tint || '#38bdf8', flip, 0.78
            );
          }
        }
        break;
      }

      case 'tiger_quake': {
        // ★【张飞 · 当阳断桥怒吼 / 许褚 · 裸衣虎痴 / 孟获 · 蛮王震山】：猛将巨灵踏裂山河 + 370px咆哮金虎扑杀 + 全屏裂地火柱！
        if (p < 0.62) {
          const lp = p / 0.62;
          const jumpY = -Math.sin(lp * Math.PI) * 52;
          const hx = casterX + easeOutCubic(lp) * Math.min(165, Math.abs(cx - casterX) * 0.65) * facing;
          drawSpiritPhantom(ctx, prof.heroSpr, hx, cy + jumpY, 142, facing, alpha * (1 - lp * 0.45), pal.c2, 0.06, 0.25, false);
        }

        const fisCnt = isFull ? 5 : 3;
        for (let f = 0; f < fisCnt; f++) {
          const fp = clamp01((p - 0.08 - f * 0.07) / 0.68);
          if (fp <= 0 || fp >= 1) continue;
          const fx0 = isFull ? (leftX + (f + 0.5) * (spanW / fisCnt)) : (cx + (f - 1) * 85);
          const fa = alpha * Math.sin(fp * Math.PI);
          drawPaintedBurst(ctx, f % 2 === 0 ? 'vfx_crimson_slash' : 'vfx_fire', 'vfx_fire', fx0, cy - 22, 240, 185, 0, fa * 0.88, pal.tint, f % 2 === 1, 0.58);
        }

        const rp = clamp01((p - 0.05) / 0.86);
        if (rp > 0) {
          const ra = alpha * Math.sin(rp * Math.PI);
          const roarScale = easeOutBack(Math.min(1, rp * 2.4));
          const tigerSz = (isFull ? 375 : 300) * roarScale;

          if (prof.beastSpr) {
            const pounceX = cx - (1 - easeOutCubic(rp)) * 110 * facing;
            drawSpiritPhantom(
              ctx, prof.beastSpr,
              pounceX, cy - 32 - Math.sin(rp * Math.PI) * 28,
              215 * roarScale, facing, ra * 0.88, '#fbbf24', -0.06, 0.30, true
            );
          }

          drawPaintedBurst(
            ctx, 'vfx_tiger_roar', 'vfx_crimson_slash',
            cx + 12 * facing, cy - 62,
            tigerSz, tigerSz,
            0, ra * 0.98, '#f59e0b', flip, 0.68
          );

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let r = 0; r < 3; r++) {
            const wp = clamp01((rp * 1.45) - r * 0.18);
            if (wp <= 0 || wp >= 1) continue;
            ctx.globalAlpha = alpha * (1 - wp) * 0.78;
            ctx.strokeStyle = r === 0 ? '#ffffff' : pal.c2;
            ctx.lineWidth = (4.8 - r) * (1 - wp * 0.6);
            ctx.beginPath();
            ctx.ellipse(cx, cy - 52, 48 + wp * (isFull ? 320 : 205), 26 + wp * (isFull ? 145 : 98), 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        }
        break;
      }

      case 'dragon_blade': {
        // ★【关羽 · 青龙偃月斩】：武圣法相挥刀 + 235px青龙圣灵盘旋破空 + 五重翡翠流金偃月巨刃横扫全屏！
        const sp = clamp01(p * 1.18);
        if (p < 0.68) {
          drawSpiritPhantom(ctx, prof.heroSpr, cx - 85 * facing, cy + 8, isFull ? 195 : 150, facing, alpha * (1 - p) * 0.86, pal.c2, -0.05, 0.24, true);
        }
        if (prof.beastSpr) {
          const dx = (cx - 150 * facing) + easeOutCubic(sp) * 300 * facing;
          const dy = cy - 52 - Math.sin(sp * Math.PI) * 42;
          drawSpiritPhantom(ctx, prof.beastSpr, dx, dy, isFull ? 238 : 190, facing, alpha * 0.90, pal.c2, -0.08, 0.22, true);
        }

        const waveCnt = isFull ? 5 : 3;
        for (let w = 0; w < waveCnt; w++) {
          const wp = (p - w * 0.09) / 0.66;
          if (wp <= 0 || wp >= 1) continue;
          const wx = isFull
            ? ((leftX + 30) + easeOutCubic(wp) * (spanW - 60) * (facing > 0 ? 1 : -1) * 0.45 + (w - 2) * 85 * facing)
            : ((cx - 90 * facing) + easeOutCubic(wp) * 220 * facing);
          const wy = cy - 48 + ((w % 3) - 1) * 16;
          const sz = (245 + (w % 2) * 42) * (0.85 + wp * 0.28);
          const wa = alpha * Math.sin(wp * Math.PI);
          drawPaintedBurst(
            ctx, 'vfx_dragon_slash', 'vfx_dragon_slash',
            wx, wy, sz, sz,
            (-0.35 + wp * 0.75) * facing, wa * 0.96, pal.tint, flip, 0.25
          );
          drawSleekCrescentArc(ctx, wx + 26 * facing, wy, 92 + w * 12, 26, (-0.18 + w * 0.09) * facing, wa * 0.88, pal, flip);
        }
        break;
      }

      case 'crimson_halberd': {
        // ★【吕布 · 无双乱舞 / 典韦 · 恶来狂戟】：重骑鬼神幻影连斩 + 手绘赤焰十字裂空斩大爆炸！
        for (let k = 0; k < 3; k++) {
          const kp = (p - k * 0.10) / 0.45;
          if (kp > 0 && kp < 1) {
            const dir = (k % 2 === 0 ? 1 : -1) * facing;
            const hx = cx + (kp - 0.5) * 180 * dir;
            const ka = alpha * Math.sin(kp * Math.PI);
            drawSpiritPhantom(ctx, prof.heroSpr, hx, cy - 6 + (k - 1) * 18, 108, dir, ka * 0.82, '#ef4444', 0.08, 0.28, false);
            drawSleekCrescentArc(ctx, hx + 26 * dir, cy - 46, 92, 26, (k - 1) * 0.28, ka * 0.88, pal, dir < 0);
          }
        }

        // 核心十字裂天原画爆发 + 业火冲天
        if (p > 0.10) {
          const bp = clamp01((p - 0.10) / 0.82);
          const ba = alpha * Math.sin(bp * Math.PI);
          const mainSz = (isFull ? 370 : 295) * easeOutBack(Math.min(1, bp * 2.2));
          drawPaintedBurst(ctx, 'vfx_fire', 'vfx_fire', cx, cy - 32, mainSz * 0.85, mainSz * 0.85, 0, ba * 0.78, null, flip, 0);
          drawPaintedBurst(
            ctx, 'vfx_crimson_slash', 'vfx_crimson_slash',
            cx, cy - 48, mainSz, mainSz,
            bp * 0.28 * facing, ba, null, flip, 0
          );
        }
        break;
      }

      case 'phoenix_arrows': {
        // ★【黄忠 · 百步穿杨 / 孙尚香 · 枭姬乱舞】：朱雀火凤展翅掠空 + 手绘烈焰流星箭雨倾泻轰炸！
        if (prof.beastSpr || isFull) {
          const fp = clamp01(p * 1.25);
          const fxPos = casterX + easeOutCubic(fp) * (cx - casterX + 120 * facing);
          const fyPos = cy - 118 - Math.sin(fp * Math.PI) * 32;
          drawSpiritPhantom(
            ctx, prof.beastSpr || 'beast_sprite_zhuque',
            fxPos, fyPos, 155, facing, alpha * Math.sin(fp * Math.PI) * 0.85, '#fb923c', 0.06, 0.25, true
          );
        }

        const volleys = isFull ? 5 : 3;
        for (let i = 0; i < volleys; i++) {
          const vp = (p - i * 0.11) / 0.62;
          if (vp <= 0 || vp >= 1) continue;
          const vxPos = isFull ? (leftX + (i + 0.5) * (spanW / volleys)) : (cx + (i - 1) * 68);
          const vyPos = cy - 42 + ((i % 2) * 18);
          const fallOffset = (1 - easeOutCubic(Math.min(1, vp * 1.5))) * 95;
          const va = alpha * Math.sin(vp * Math.PI);

          drawPaintedBurst(
            ctx, 'vfx_arrow_storm', 'vfx_fire',
            vxPos - fallOffset * 0.55 * facing, vyPos - fallOffset,
            245, 245, 0, va * 0.96, pal.tint, flip, 0.35
          );

          if (vp > 0.38) {
            const ip = (vp - 0.38) / 0.62;
            drawPaintedBurst(
              ctx, 'vfx_fire', 'vfx_crimson_slash',
              vxPos, cy - 22, 165 * (0.7 + ip * 0.45), 155 * (0.7 + ip * 0.45),
              0, alpha * (1 - ip) * 0.82, pal.tint, flip, 0.25
            );
          }
        }
        break;
      }

      case 'bagua_thunder':
      case 'thunder_tempest': {
        // ★【诸葛亮 · 奇门八卦 / 张角 · 苍天已死】：手绘先天八卦圣阵 + 九霄神雷原画轰鸣落雷！
        if (prof.style === 'bagua_thunder') {
          const bSz = (isFull ? 340 : 265) * easeOutBack(Math.min(1, p * 2.4));
          drawPaintedBurst(ctx, 'vfx_holy_heal', 'vfx_holy_heal', cx, cy - 58, bSz, bSz, p * 0.45, alpha * 0.88, null, false, 0);
        }

        const bolts = isFull ? 5 : 3;
        for (let b = 0; b < bolts; b++) {
          const bp = (p - b * 0.10) / 0.64;
          if (bp <= 0 || bp >= 1) continue;
          const bx = isFull ? (leftX + (b + 0.5) * (spanW / bolts)) : (cx + (b - 1) * 76);
          const by = cy - 52 + ((b % 2) * 20);
          const flick = Math.sin(p * 42 + b * 2.1) > -0.65 ? 1 : 0.48;
          const ba = alpha * Math.sin(bp * Math.PI) * flick;
          const sz = (isFull ? 255 : 235) * (0.85 + easeOutCubic(bp) * 0.25);

          drawPaintedBurst(
            ctx, 'vfx_thunder', 'vfx_thunder',
            bx, by, sz * 0.92, sz * 1.15,
            0, ba, pal.tint, b % 2 === 1, 0.22
          );
        }
        break;
      }

      case 'bagua_swords': {
        // ★【曹操 · 倚天剑指天下归心 / 刘备 · 仁德昭烈双剑 / 孙权 · 坐断东南帝王玺 / 于禁 · 玄甲剑阵】：
        // 彻底摒弃旧版简陋小黄三角与绿底八卦，升级为【手绘传世圣剑破苍穹 + 斜贯万剑流星雨 + 原画裂地剑爆】！
        if (prof.sig === 'sunquan_jade_seal') {
          // 孙权专属：白虎圣灵护驾 + 手绘盘龙传国玉玺镇压全屏 + 赤金虎啸连爆！
          if (prof.beastSpr) {
            const bp = clamp01(p * 1.18);
            drawSpiritPhantom(
              ctx, prof.beastSpr,
              (cx - 125 * facing) + easeOutCubic(bp) * 240 * facing, cy - 48 - Math.sin(bp * Math.PI) * 30,
              205, facing, alpha * 0.86, '#fb923c', -0.05, 0.25, true
            );
          }
          for (let i = 0; i < (isFull ? 5 : 3); i++) {
            const ep = (p - i * 0.08) / 0.65;
            if (ep <= 0 || ep >= 1) continue;
            const ex = isFull ? (leftX + (i + 0.5) * (spanW / 5)) : (cx + (i - 1) * 82);
            const ea = alpha * Math.sin(ep * Math.PI);
            drawPaintedBurst(ctx, i % 2 === 0 ? 'vfx_tiger_roar' : 'vfx_fire', 'vfx_crimson_slash', ex, cy - 44 + (i % 2) * 18, 255, 255, 0, ea * 0.94, '#f59e0b', i % 2 === 1, 0.55);
          }
          const sealTex = getKeyedRelicCanvas('eq_sixiang_seal');
          const sp0 = clamp01((p - 0.04) / 0.82);
          if (sp0 > 0 && sealTex) {
            const dropY = (1 - easeOutQuart(Math.min(1, sp0 * 1.65))) * 155;
            const sa0 = alpha * Math.sin(sp0 * Math.PI);
            const sz0 = 178 * easeOutBack(Math.min(1, sp0 * 2.2));
            drawPaintedBurst(ctx, 'vfx_crimson_slash', 'vfx_fire', cx, cy - 34, 320, 320, sp0 * 0.4, sa0 * 0.92, '#fbbf24', flip, 0.68);
            ctx.save();
            ctx.translate(cx, cy - 66 - dropY);
            ctx.globalAlpha = clamp01(sa0 * 0.98);
            ctx.drawImage(sealTex, -sz0 / 2, -sz0 / 2, sz0, sz0);
            ctx.restore();
          }
          break;
        }

        const swordTex = getDivineSwordCanvas(pal);
        const isTwinHero = prof.sig === 'liubei_twin_swords';
        const slAng = -0.30 * facing; // 万剑斜贯破空角（凌厉彗星斜斩，告别呆板垂直插秧！）
        const dirX = -Math.sin(slAng);
        const dirY = Math.cos(slAng);

        // 1. 帝王/统帅真灵策马挥剑残影 + 护法神兽腾空
        if (p < 0.62) {
          const hp = p / 0.62;
          drawSpiritPhantom(
            ctx, prof.heroSpr,
            casterX + easeOutCubic(hp) * 95 * facing, casterY - Math.sin(hp * Math.PI) * 18,
            110, facing, alpha * (1 - hp * 0.55) * 0.90, pal.c2, -0.05, 0.24, false
          );
        }
        if (prof.beastSpr) {
          const bp = clamp01(p * 1.15);
          drawSpiritPhantom(
            ctx, prof.beastSpr,
            (cx - 135 * facing) + easeOutCubic(bp) * 270 * facing, cy - 68 - Math.sin(bp * Math.PI) * 34,
            isFull ? 205 : 175, facing, alpha * 0.82, pal.c2, -0.06, 0.28, true
          );
        }

        // 2. 苍穹天裂剑门（高空雷火云涡，100% 匹配武将本命色调，绝无绿斑串色）
        const riftSz = (isFull ? 320 : 245) * easeOutBack(Math.min(1, p * 2.4));
        drawPaintedBurst(
          ctx, isTwinHero ? 'vfx_dragon_slash' : 'vfx_crimson_slash', 'vfx_thunder',
          cx - 38 * facing, cy - 128, riftSz, riftSz * 0.52,
          p * 0.55 * facing, alpha * 0.72, pal.tint, flip, 0.78
        );

        // 3. 万剑流星雨：错落远近景 12 柄手绘流光神剑斜贯轰炸全屏 + 落地炸开手绘剑罡与雷芒！
        const swordCnt = isFull ? 12 : 6;
        for (let i = 0; i < swordCnt; i++) {
          const delay = 0.03 + ((i * 3) % swordCnt) * 0.038;
          const sp = (p - delay) / 0.54;
          if (sp <= 0 || sp >= 1) continue;

          const laneT = (i + 0.5) / swordCnt;
          const jitterX = (seeded(prof.seed, i + 5) - 0.5) * 34;
          const impactX = isFull
            ? (leftX + laneT * spanW + jitterX)
            : (cx + (laneT - 0.5) * 245 + jitterX * 0.6);
          const depthR = seeded(prof.seed, i + 29);
          const impactY = cy - 28 + depthR * 46;
          const sc = (0.64 + depthR * 0.44) * (isFull ? 1.04 : 0.96);

          const travelDist = (1 - easeOutQuart(Math.min(1, sp * 1.68))) * 235;
          const tipX = impactX - dirX * travelDist;
          const tipY = impactY - dirY * travelDist;
          const sa = alpha * Math.sin(sp * Math.PI);

          // 破空彗星流光长尾（先于剑体绘制）
          ctx.save();
          ctx.translate(tipX, tipY);
          ctx.rotate(slAng);
          ctx.globalCompositeOperation = 'lighter';
          const tailLen = (135 + (1 - sp) * 75) * sc;
          const tg = ctx.createLinearGradient(0, 0, 0, -tailLen);
          tg.addColorStop(0, '#ffffff');
          tg.addColorStop(0.28, pal.c3);
          tg.addColorStop(0.65, pal.c2);
          tg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = clamp01(sa * 0.78);
          ctx.fillStyle = tg;
          ctx.beginPath();
          ctx.moveTo(0, 4);
          ctx.lineTo(-11 * sc, -tailLen * 0.55);
          ctx.lineTo(0, -tailLen);
          ctx.lineTo(11 * sc, -tailLen * 0.55);
          ctx.closePath();
          ctx.fill();

          // 绘制预烘焙手绘神剑本体（剑尖对齐 (0,0)）
          if (swordTex) {
            const dw = 92 * sc, dh = 184 * sc;
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = clamp01(sa * 0.96);
            ctx.drawImage(swordTex, -dw / 2, -dh * 0.94, dw, dh);
          }
          ctx.restore();

          // 剑锋贯地瞬间：爆开真实手绘剑气裂痕原画 + 雷火光柱！
          if (sp >= 0.34) {
            const ip = (sp - 0.34) / 0.66;
            const ia = alpha * (1 - ip);
            const impKey = isTwinHero ? 'vfx_dragon_slash' : (i % 2 === 0 ? 'vfx_crimson_slash' : 'vfx_thunder');
            const bSz = (128 + sc * 52) * (0.72 + easeOutCubic(ip) * 0.42);
            drawPaintedBurst(
              ctx, impKey, 'vfx_crimson_slash',
              impactX, impactY - 16, bSz, bSz,
              (i % 2 === 0 ? 0.25 : -0.25), ia * 0.92, pal.tint, i % 2 === 1, 0.72
            );
            if (ip < 0.45) {
              drawStarFlare(ctx, impactX, impactY - 4, 24 * sc * (1 - ip * 1.5), pal.c2, ia * 0.95, ip * 2);
            }
          }
        }

        // 4. 中央镇世主剑高潮（曹操：擎天【倚天圣剑】轰然贯阵；刘备：【雌雄双股圣剑】龙凤交击十字斩！）
        const mainP = clamp01((p - 0.10) / 0.78);
        if (mainP > 0 && swordTex) {
          const ma = alpha * Math.sin(mainP * Math.PI);
          const fall = (1 - easeOutQuart(Math.min(1, mainP * 1.85))) * 195;

          if (mainP >= 0.26) {
            const ep = (mainP - 0.26) / 0.74;
            const coreSz = (isFull ? 345 : 285) * (0.78 + easeOutCubic(ep) * 0.34);
            drawPaintedBurst(
              ctx, isTwinHero ? 'vfx_dragon_slash' : 'vfx_crimson_slash', 'vfx_crimson_slash',
              cx, cy - 36, coreSz, coreSz,
              ep * 0.35 * facing, alpha * (1 - ep * 0.75) * 0.98, pal.tint, flip, 0.65
            );
            drawPaintedBurst(
              ctx, 'vfx_thunder', 'vfx_fire',
              cx, cy - 58, coreSz * 0.82, coreSz * 1.08,
              0, alpha * (1 - ep * 0.82) * 0.86, pal.c2, !flip, 0.75
            );
          }

          const swordsToDraw = isTwinHero
            ? [{ ox: -20 * facing, ang: -0.34 * facing, sc: 1.18 }, { ox: 20 * facing, ang: 0.34 * facing, sc: 1.18 }]
            : [{ ox: 0, ang: -0.15 * facing, sc: isFull ? 1.32 : 1.22 }];

          swordsToDraw.forEach((sw) => {
            const sx0 = cx + sw.ox + Math.sin(sw.ang) * fall;
            const sy0 = (cy + 14) - Math.cos(sw.ang) * fall;
            const mw = 108 * sw.sc, mh = 216 * sw.sc;

            ctx.save();
            ctx.translate(sx0, sy0);
            ctx.rotate(sw.ang);
            // 圣剑后层金色神辉光柱
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = clamp01(ma * 0.62);
            const pg = ctx.createLinearGradient(-22, 0, 22, 0);
            pg.addColorStop(0, 'rgba(0,0,0,0)');
            pg.addColorStop(0.5, pal.c2);
            pg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = pg;
            ctx.fillRect(-24, -mh * 1.05, 48, mh * 1.05);

            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = clamp01(ma * 0.98);
            ctx.drawImage(swordTex, -mw / 2, -mh * 0.94, mw, mh);
            ctx.restore();

            drawStarFlare(ctx, sx0 - Math.sin(sw.ang) * (mh * 0.66), sy0 - Math.cos(sw.ang) * (mh * 0.66), 34 * sw.sc, pal.c3, ma * 0.88, p * 3);
          });
        }
        break;
      }

      case 'inferno_storm': {
        // ★【周瑜 · 火烧赤壁 / 陆逊 · 火烧连营 / 庞统 · 凤雏涅槃】：朱雀圣灵展翼 + 手绘烈焰火海漩涡冲天！
        if (prof.beastSpr || isFull) {
          const zp = clamp01(p * 1.15);
          const zx = (cx - 165 * facing) + easeOutCubic(zp) * 330 * facing;
          const zy = cy - 92 - Math.sin(zp * Math.PI) * 36;
          drawSpiritPhantom(
            ctx, prof.beastSpr || 'beast_sprite_zhuque',
            zx, zy, isFull ? 205 : 170, facing, alpha * Math.sin(zp * Math.PI) * 0.90, '#fb923c', 0.04, 0.18, true
          );
        }

        const pillars = isFull ? 5 : 3;
        for (let i = 0; i < pillars; i++) {
          const fp = (p - i * 0.09) / 0.68;
          if (fp <= 0 || fp >= 1) continue;
          const fxPos = isFull ? (leftX + (i + 0.5) * (spanW / pillars)) : (cx + (i - 1) * 78);
          const fyPos = cy - 42 + ((i % 2) * 18);
          const fa = alpha * Math.sin(fp * Math.PI);
          const fSz = (225 + (i % 2) * 35) * (0.78 + easeOutCubic(fp) * 0.36);

          drawPaintedBurst(
            ctx, 'vfx_fire', 'vfx_fire',
            fxPos, fyPos, fSz, fSz * 1.12,
            0, fa * 0.96, null, i % 2 === 1, 0
          );
        }
        break;
      }

      case 'ice_lotus': {
        // ★【郭嘉 · 鬼谋冰封 / 甄姬 · 洛神赋】：手绘玄冰圣莲层叠盛放 + 寒霜龙卷折射极光！
        const bloom = easeOutBack(Math.min(1, p * 2.2));
        const mainSz = (isFull ? 360 : 285) * bloom;
        drawPaintedBurst(ctx, 'vfx_ice', 'vfx_ice', cx, cy - 46, mainSz, mainSz, 0, alpha * 0.98, null, false, 0);

        const subCnt = isFull ? 4 : 2;
        for (let i = 0; i < subCnt; i++) {
          const ip = (p - 0.12 - i * 0.10) / 0.65;
          if (ip <= 0 || ip >= 1) continue;
          const ix = isFull ? (leftX + (i + 0.5) * (spanW / subCnt)) : (cx + (i === 0 ? -82 : 82));
          const ia = alpha * Math.sin(ip * Math.PI);
          drawPaintedBurst(
            ctx, 'vfx_ice', 'vfx_ice',
            ix, cy - 28 + (i % 2) * 16, 195 * easeOutCubic(ip), 195 * easeOutCubic(ip),
            0, ia * 0.82, null, i % 2 === 1, 0
          );
        }

        if (prof.beastSpr) {
          drawSpiritPhantom(ctx, prof.beastSpr, cx, cy - 34, 175 * bloom, facing, alpha * 0.72, '#38bdf8', 0, 0.28, true);
        }
        break;
      }

      case 'astral_meteor': {
        // ★【司马懿 · 鹰视狼顾 / 董卓 · 暴虐魔星】：手绘紫微星陨灭世天降 + 雷火魔阵轰鸣！
        const waves = isFull ? 4 : 2;
        for (let i = 0; i < waves; i++) {
          const mp = (p - i * 0.13) / 0.66;
          if (mp <= 0 || mp >= 1) continue;
          const tx = isFull ? (leftX + (i + 0.5) * (spanW / waves)) : (cx + (i === 0 ? -36 : 44));
          const ty = cy - 46 + (i % 2) * 16;
          const slide = (1 - easeOutCubic(Math.min(1, mp * 1.45))) * 78;
          const ma = alpha * Math.sin(mp * Math.PI);
          const sz = (isFull ? 275 : 265) * (0.84 + easeOutCubic(mp) * 0.26);

          drawPaintedBurst(
            ctx, 'vfx_meteor_starfall', 'vfx_fire',
            tx + slide * 0.4 * facing, ty - slide,
            sz, sz, 0, ma * 0.96, '#a855f7', flip, 0.75
          );
        }
        break;
      }

      case 'blossom_ribbons': {
        // ★【貂蝉 · 闭月羞花 / 小乔 · 天香国色】：手绘流金绯樱绫罗风暴旋转绽放！
        const mainSz = (isFull ? 365 : 295) * easeOutBack(Math.min(1, p * 2.1));
        drawPaintedBurst(
          ctx, 'vfx_blossom_dance', 'vfx_dragon_slash',
          cx, cy - 52, mainSz, mainSz,
          p * 1.8 * facing, alpha * 0.96, '#ec4899', flip, 0.78
        );
        drawPaintedBurst(
          ctx, 'vfx_blossom_dance', 'vfx_holy_heal',
          cx, cy - 52, mainSz * 0.72, mainSz * 0.72,
          -p * 2.4 * facing, alpha * 0.72, '#fde047', !flip, 0.45
        );
        break;
      }

      case 'tidal_tsunami': {
        // ★【甘宁 · 百骑劫营 / 沧海怒涛】：手绘碧海狂澜巨浪推进 + 苍龙踏浪突袭！
        for (let w = 0; w < 3; w++) {
          const wp = (p - w * 0.11) / 0.68;
          if (wp <= 0 || wp >= 1) continue;
          const wx = (cx - 120 * facing) + easeOutCubic(wp) * (isFull ? 340 : 235) * facing;
          const wy = cy - 46 + (w - 1) * 14;
          const sz = (240 + w * 32) * (0.82 + wp * 0.28);
          const wa = alpha * Math.sin(wp * Math.PI);

          drawPaintedBurst(
            ctx, 'vfx_water_tsunami', 'vfx_dragon_slash',
            wx, wy, sz, sz,
            (wp - 0.5) * 0.45 * facing, wa * 0.95, '#06b6d4', flip, 0.78
          );
        }
        if (prof.beastSpr) {
          const dx = (cx - 90 * facing) + easeOutCubic(p) * 210 * facing;
          drawSpiritPhantom(ctx, prof.beastSpr, dx, cy - 56, 175, facing, alpha * 0.78, '#22d3ee', -0.06, 0.35, true);
        }
        break;
      }

      case 'cavalry_stampede': {
        // ★【马超 · 铁骑纵横 / 张辽 · 威震逍遥津】：五骑铁甲神驹楔形冲锋真身残影 + 雷霆银枪破阵！
        const startX = casterX - 40 * facing;
        const travel = (isFull ? 560 : 420) * easeOutCubic(p) * facing;
        for (let c = 0; c < 5; c++) {
          const gallop = p * 28 + c * 1.35;
          const bob = -Math.abs(Math.sin(gallop)) * 6;
          const pitch = Math.cos(gallop) * 0.065;
          const hx = startX + travel - Math.abs(c - 2) * 48 * facing;
          const hy = Math.max(204, Math.min(386, cy + (c - 2) * 28));

          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const tg = ctx.createLinearGradient(hx, hy - 30, hx - 145 * facing, hy - 30);
          tg.addColorStop(0, pal.c3);
          tg.addColorStop(0.45, pal.c2);
          tg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = tg;
          ctx.globalAlpha = alpha * 0.65;
          ctx.fillRect(facing > 0 ? hx - 145 : hx, hy - 54, 145, 38);
          ctx.restore();

          drawSpiritPhantom(ctx, prof.heroSpr, hx, hy + bob, 94, facing, alpha * (c === 2 ? 0.96 : 0.78), pal.c2, pitch, 0.22, false);
        }

        // 先锋主骑枪尖炸开手绘银枪/雷霆冲击原画
        const leadX = startX + travel + 36 * facing;
        drawPaintedBurst(
          ctx, 'vfx_silver_spear', 'vfx_thunder',
          leadX, cy - 42, 235, 235,
          0, alpha * 0.92, pal.tint, flip, 0.45
        );
        break;
      }

      case 'divine_beast_ult':
      default: {
        // ★【十二神兽满气全屏神威圣技】：巨幅圣兽真灵腾空镇世 + 全屏连环原画天灾轰炸！
        const bid = prof.beastId || 'qinglong';
        const bSpr = prof.beastSpr || ('beast_sprite_' + bid);
        const isZhulongUlt = bid === 'zhulong';
        const surge = easeOutCubic(p);
        const bx = (vx + vw * (isZhulongUlt ? 0.30 : 0.34)) + surge * (vw * (isZhulongUlt ? 0.38 : 0.32)) * facing;
        const by = cy - (isZhulongUlt ? 54 : 42) - Math.sin(p * Math.PI) * (isZhulongUlt ? 44 : 36);

        // ★ 创世烛龙专属【睁目为昼 · 钟山太古日轮开天异象】：天穹昼夜交替 + 竖立创世天目贯射金乌神芒！
        if (isZhulongUlt) {
          const eyeOpen = Math.sin(Math.min(1, p * 1.18) * Math.PI);
          const skyX = vx + vw * 0.50;
          const skyY = cy - 134;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          // 1. 焚世赤金天穹日冕大光轮
          const sunR = 148 + surge * 56;
          const sunG = ctx.createRadialGradient(skyX, skyY, 10, skyX, skyY, sunR);
          sunG.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
          sunG.addColorStop(0.28, 'rgba(254, 240, 138, 0.72)');
          sunG.addColorStop(0.62, 'rgba(234, 88, 12, 0.38)');
          sunG.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.globalAlpha = alpha * eyeOpen * 0.88;
          ctx.fillStyle = sunG;
          ctx.beginPath();
          ctx.arc(skyX, skyY, sunR, 0, Math.PI * 2);
          ctx.fill();

          // 2. 十二道太古日晷金芒贯照全屏沙场
          ctx.save();
          ctx.translate(skyX, skyY);
          ctx.rotate(p * 0.85);
          for (let r = 0; r < 12; r++) {
            const ang = (Math.PI * 2 * r) / 12;
            const rayLen = (r % 2 === 0 ? 260 : 175) * (0.75 + 0.25 * eyeOpen);
            ctx.fillStyle = r % 2 === 0 ? 'rgba(254, 240, 138, 0.36)' : 'rgba(249, 115, 22, 0.28)';
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang - 0.055) * 26, Math.sin(ang - 0.055) * 26);
            ctx.lineTo(Math.cos(ang) * rayLen, Math.sin(ang) * rayLen);
            ctx.lineTo(Math.cos(ang + 0.055) * 26, Math.sin(ang + 0.055) * 26);
            ctx.closePath();
            ctx.fill();
          }
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.arc(0, 0, 62 + surge * 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();

          // 3. 苍穹中央“睁目为昼”太古烛龙竖瞳神目
          const ew = 68 * (0.55 + 0.45 * eyeOpen);
          const eh = Math.max(3, 28 * eyeOpen);
          ctx.globalAlpha = alpha * Math.min(1, eyeOpen * 1.15);
          ctx.fillStyle = '#7c2d12';
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 2.8;
          ctx.beginPath();
          ctx.moveTo(skyX - ew, skyY);
          ctx.quadraticCurveTo(skyX, skyY - eh * 1.45, skyX + ew, skyY);
          ctx.quadraticCurveTo(skyX, skyY + eh * 1.45, skyX - ew, skyY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // 炽白黄金竖瞳仁
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(skyX, skyY, Math.max(3.5, 8.5 * eyeOpen), eh * 0.86, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.8;
          ctx.stroke();
          ctx.restore();
        } else if (bid === 'qinglong') {
          // ★ 苍穹青龙专属【东海九霄苍雷贯空电脉】
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#6ee7b7';
          ctx.lineWidth = 2.6;
          ctx.globalAlpha = alpha * Math.sin(p * Math.PI) * 0.78;
          for (let bolt = 0; bolt < 3; bolt++) {
            const lx = leftX + (bolt + 0.5) * (spanW / 3);
            ctx.beginPath();
            ctx.moveTo(lx - 18, cy - 190);
            ctx.lineTo(lx + 10, cy - 132);
            ctx.lineTo(lx - 12, cy - 86);
            ctx.lineTo(lx + 16, cy - 24);
            ctx.stroke();
          }
          ctx.restore();
        }

        // 圣兽真身巨像（烛龙享 312px 创世祖龙巨型法相威压！）
        const mainSz = isZhulongUlt ? 312 : 248;
        const backSz = isZhulongUlt ? 336 : 265;
        drawSpiritPhantom(ctx, bSpr, bx - 24 * facing, by, backSz, facing, alpha * (isZhulongUlt ? 0.58 : 0.45), isZhulongUlt ? '#fde047' : pal.c2, 0, 0.55, true);
        drawSpiritPhantom(ctx, bSpr, bx, by, mainSz, facing, alpha * 0.98, pal.c2, isZhulongUlt ? -0.06 : -0.04, 0.14, false);

        const cfgMap = {
          qinglong: { p1: 'vfx_dragon_slash', p2: 'vfx_thunder', tint: null },
          zhuque:   { p1: 'vfx_fire',         p2: 'vfx_arrow_storm', tint: null },
          baihu:    { p1: 'vfx_tiger_roar',   p2: 'vfx_crimson_slash', tint: '#fbbf24' },
          xuanwu:   { p1: 'vfx_ice',          p2: 'vfx_water_tsunami', tint: '#38bdf8' },
          taotie:   { p1: 'vfx_crimson_slash',p2: 'vfx_thunder', tint: '#c084fc' },
          qiongqi:  { p1: 'vfx_tiger_roar',   p2: 'vfx_crimson_slash', tint: '#ef4444' },
          taowu:    { p1: 'vfx_fire',         p2: 'vfx_tiger_roar', tint: '#f59e0b' },
          hundun:   { p1: 'vfx_dragon_slash', p2: 'vfx_thunder', tint: '#f472b6' },
          qilin:    { p1: 'vfx_holy_heal',    p2: 'vfx_fire', tint: '#facc15' },
          baize:    { p1: 'vfx_ice',          p2: 'vfx_holy_heal', tint: '#67e8f9' },
          kunpeng:  { p1: 'vfx_water_tsunami',p2: 'vfx_thunder', tint: '#60a5fa' },
          zhulong:  { p1: 'vfx_fire',         p2: 'vfx_meteor_starfall', tint: '#fbbf24' },
        };
        const bc = cfgMap[bid] || cfgMap.qinglong;
        const waveCnt = isZhulongUlt ? 7 : 5;

        for (let i = 0; i < waveCnt; i++) {
          const ep = (p - i * (isZhulongUlt ? 0.062 : 0.08)) / 0.66;
          if (ep <= 0 || ep >= 1) continue;
          const ex = leftX + (i + 0.5) * (spanW / waveCnt);
          const ey = cy - (isZhulongUlt ? 50 : 44) + ((i % 2) * 24);
          const ea = alpha * Math.sin(ep * Math.PI);
          const esz = (isZhulongUlt ? 276 : 245) * (0.80 + easeOutCubic(ep) * 0.34);
          drawPaintedBurst(
            ctx, i % 2 === 0 ? bc.p1 : bc.p2, isZhulongUlt ? 'vfx_dragon_slash' : (bc.p1 === 'vfx_tiger_roar' ? 'vfx_crimson_slash' : bc.p1),
            ex, ey, esz, esz, 0, ea * 0.95, bc.tint, i % 2 === 1, isZhulongUlt ? 0.38 : 0.55
          );
        }
        break;
      }
    }
  }

  // ================= 54位传奇名将专属本命原画异象层（100% 采用体积流光刃、手绘原画融合与星芒神兵，零简陋线框！） =================
  function drawHeroSignatureOverlay(ctx, prof, fx, vx, vw, p, alpha, facing) {
    const sig = prof && prof.sig;
    if (!sig) return;
    const pal = prof.pal;
    const isFull = !!fx.isFullscreen;
    const cx = isFull ? (vx + vw * 0.52) : fx.x;
    const cy = fx.y;
    const flip = facing < 0;
    const wave = Math.sin(Math.min(1, p * 1.15) * Math.PI);
    if (wave <= 0.02) return;

    ctx.save();
    switch (sig) {
      case 'caocao_imperial_seal':
      case 'liubei_twin_swords':
      case 'sunquan_jade_seal': {
        // 三国君主已在 bagua_swords 主演出中呈现倚天巨剑/雌雄双股圣剑/盘龙传国玉玺，此处叠绘柔金帝威星辉冲击环
        ctx.globalCompositeOperation = 'lighter';
        for (let r = 0; r < 2; r++) {
          const rp = clamp01(p * 1.4 - r * 0.22);
          if (rp <= 0 || rp >= 1) continue;
          ctx.globalAlpha = alpha * (1 - rp) * 0.65;
          ctx.strokeStyle = r === 0 ? '#ffffff' : pal.c2;
          ctx.lineWidth = (3.8 - r) * (1 - rp * 0.5);
          ctx.beginPath();
          ctx.ellipse(cx, cy - 14, 52 + rp * (isFull ? 320 : 210), 16 + rp * 64, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'guanyu_crescent_moon': {
        // 武圣满月翡翠刀轮 + 巨幅青龙偃月体积光刃劈落
        drawPaintedBurst(ctx, 'vfx_dragon_slash', 'vfx_dragon_slash', cx + 18 * facing, cy - 64, 310, 310, (-0.5 + p * 0.9) * facing, alpha * wave * 0.72, '#10b981', flip, 0.35);
        drawSleekCrescentArc(ctx, cx + 28 * facing, cy - 56, 128, 36, (-0.52 + easeOutCubic(p) * 1.12) * facing, alpha * wave * 0.94, pal, flip);
        break;
      }
      case 'zhaoyun_seven_star': {
        // 赵云专属异象 · 龙胆北斗七星寒芒：天穹七星连珠闪烁 + 破空寒星冲击环（衬托中央银龙巨枪，不遮挡龙头细节）
        const dipper = [
          [-148, -118], [-98, -104], [-48, -86], [2, -74],
          [46, -98], [104, -106], [152, -76],
        ];
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < dipper.length; i++) {
          const sp = clamp01((p - i * 0.055) / 0.56);
          if (sp <= 0 || sp >= 1) continue;
          const sx = cx + dipper[i][0] * (isFull ? 1.28 : 0.96) * facing;
          const sy = cy + dipper[i][1];
          const sa = alpha * Math.sin(sp * Math.PI);
          if (i > 0) {
            const px0 = cx + dipper[i - 1][0] * (isFull ? 1.28 : 0.96) * facing;
            const py0 = cy + dipper[i - 1][1];
            ctx.globalAlpha = sa * 0.46;
            ctx.strokeStyle = '#7dd3fc';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(px0, py0);
            ctx.lineTo(sx, sy);
            ctx.stroke();
          }
          drawStarFlare(ctx, sx, sy, 20 + (i === 6 ? 8 : 0), i % 2 === 0 ? '#e0f2fe' : '#38bdf8', sa * 0.94, p * 4.5 + i);
        }
        ctx.restore();
        break;
      }
      case 'jiangwei_nine_lances':
      case 'zhanghe_butterfly_hex':
      case 'wenchou_shadow_fork': {
        // 龙胆七星耀芒 / 幼麟九星枪阵 / 巧变紫电枪影（星芒节点 + 交错体积流光银弧，零折线框）
        const cnt = sig === 'jiangwei_nine_lances' ? 9 : 7;
        for (let i = 0; i < cnt; i++) {
          const sp = clamp01((p - i * 0.06) / 0.52);
          if (sp <= 0 || sp >= 1) continue;
          const ox = ((i / (cnt - 1)) - 0.5) * 230 * facing;
          const oy = -88 + Math.sin(i * 1.9) * 34;
          const sa = alpha * Math.sin(sp * Math.PI);
          drawSleekCrescentArc(ctx, cx + ox, cy + oy + 28, 56, 15, (i % 2 === 0 ? 0.38 : -0.38) * facing, sa * 0.78, pal, i % 2 === 1);
          drawStarFlare(ctx, cx + ox, cy + oy, 22, pal.c2, sa * 0.95, p * 4 + i);
        }
        break;
      }
      case 'zhangfei_bridge_fissure':
      case 'menghuo_totem_stomp':
      case 'xuchu_meteor_hammer':
      case 'gaoshun_battering_wedge': {
        // 当阳怒吼震山 / 蛮王踏地 / 虎痴碎岳 / 陷阵破壁：双重赤金交错裂空刀波 + 烈焰地裂喷发
        drawPaintedBurst(ctx, 'vfx_fire', 'vfx_crimson_slash', cx, cy - 18, 290, 150, 0, alpha * wave * 0.82, pal.tint, flip, 0.65);
        drawSleekCrescentArc(ctx, cx + 18 * facing, cy - 38, 114, 30, 0.18 * facing, alpha * wave * 0.88, pal, flip);
        drawSleekCrescentArc(ctx, cx - 12 * facing, cy - 38, 96, 24, -0.22 * facing, alpha * wave * 0.76, pal, !flip);
        break;
      }
      case 'machao_thunder_spears':
      case 'sunce_conqueror_lance':
      case 'zhangliao_azure_crescent':
      case 'gongsunzan_snow_tracks': {
        // 西凉神威雷枪 / 小霸王烈焰破阵 / 逍遥津苍蓝雷岚 / 白马冰雪枪芒
        const burstKey = sig === 'gongsunzan_snow_tracks' ? 'vfx_ice' : (sig === 'sunce_conqueror_lance' ? 'vfx_fire' : 'vfx_thunder');
        drawPaintedBurst(ctx, burstKey, 'vfx_silver_spear', cx + 42 * facing, cy - 48, 265, 265, p * 0.5 * facing, alpha * wave * 0.85, pal.tint, flip, 0.68);
        drawSleekCrescentArc(ctx, cx + 48 * facing, cy - 46, 112, 28, -0.08 * facing, alpha * wave * 0.90, pal, flip);
        break;
      }
      case 'huangzhong_solar_bow':
      case 'xiahouyuan_triple_bolts':
      case 'taishici_twin_pierce':
      case 'yuanshao_royal_archers': {
        // 定军百步烈阳神弓法相（双翼流光弯月巨弓 + 贯日炽白神矢光束 + 落点星爆！）
        const bowX = cx - 95 * facing, bowY = cy - 72;
        drawSleekCrescentArc(ctx, bowX, bowY, 74, 20, 0, alpha * wave * 0.92, pal, flip);
        drawStarFlare(ctx, bowX + 18 * facing, bowY, 30, pal.c2, alpha * wave * 0.95, p * 3);
        const shotCnt = sig === 'xiahouyuan_triple_bolts' ? 3 : (sig === 'taishici_twin_pierce' ? 2 : 1);
        ctx.globalCompositeOperation = 'lighter';
        for (let s = 0; s < shotCnt; s++) {
          const sp = clamp01((p - s * 0.10) * 1.55);
          if (sp <= 0 || sp >= 1) continue;
          const ay = bowY + (s - (shotCnt - 1) / 2) * 20;
          const ax = bowX + easeOutQuart(sp) * 240 * facing;
          const ag = ctx.createLinearGradient(ax - 95 * facing, ay, ax + 28 * facing, ay);
          ag.addColorStop(0, 'rgba(0,0,0,0)');
          ag.addColorStop(0.55, pal.c2);
          ag.addColorStop(1, '#ffffff');
          ctx.globalAlpha = alpha * Math.sin(sp * Math.PI) * 0.95;
          ctx.fillStyle = ag;
          ctx.beginPath();
          ctx.moveTo(ax + 34 * facing, ay);
          ctx.lineTo(ax - 95 * facing, ay - 7);
          ctx.lineTo(ax - 95 * facing, ay + 7);
          ctx.closePath();
          ctx.fill();
          drawStarFlare(ctx, ax + 24 * facing, ay, 20, pal.c3, alpha * Math.sin(sp * Math.PI), 0);
        }
        break;
      }
      case 'lvbu_cross_halberd': {
        // 移除散乱遮挡画面的白色四角星贴片，保持沙场兵马利落清晰
        break;
      }
      case 'dianwei_twin_halberds':
      case 'weiyan_blood_fangs':
      case 'zhoutai_scar_slashes':
      case 'huaxiong_wolf_fang_chop': {
        // 恶来/狂骨/不屈血刃锐利双十字裂空斩（100% 针尖收束新月刃，零钝头圆弧！）
        const cnt = sig === 'zhoutai_scar_slashes' ? 4 : 2;
        for (let i = 0; i < cnt; i++) {
          const rot = cnt === 2 ? (i === 0 ? 0.58 : -0.58) : (-0.72 + i * 0.48);
          drawColossalSlashBeam(ctx, cx, cy - 48, isFull ? 240 : 175, 13, rot * facing, alpha * wave * 0.90, pal.c1, pal.c2);
          drawSleekCrescentArc(ctx, cx + 12 * facing, cy - 48, 108, 24, rot * facing, alpha * wave * 0.88, pal, i % 2 === 1);
        }
        break;
      }
      case 'sunshangxiang_chakrams':
      case 'zhurong_fire_boomerangs':
      case 'guanping_jade_wheel':
      case 'huangyueying_mech_gears': {
        // 枭姬绯红双月轮 / 祝融赤炎旋刃 / 关平青龙旋刀轮 / 月英金光飞轮（由对向高速旋转的流光弯月光刃构成，零齿轮铁丝！）
        const wheels = sig === 'guanping_jade_wheel' ? 1 : (sig === 'zhurong_fire_boomerangs' ? 3 : 2);
        for (let w = 0; w < wheels; w++) {
          const wx = cx + (w - (wheels - 1) / 2) * 78 * facing;
          const wy = cy - 48 + (w % 2) * 16;
          const spin = p * 9.5 * (w % 2 === 0 ? 1 : -1);
          drawSleekCrescentArc(ctx, wx, wy, 48, 16, spin, alpha * wave * 0.92, pal, false);
          drawSleekCrescentArc(ctx, wx, wy, 48, 16, spin + Math.PI, alpha * wave * 0.92, pal, false);
          drawStarFlare(ctx, wx, wy, 18, pal.c2, alpha * wave * 0.85, -spin);
        }
        break;
      }
      default: {
        // 五子/四督/奇谋名将：手绘元素旋涡与流光半月光刃交相辉映
        drawPaintedBurst(
          ctx, 'vfx_dragon_slash', 'vfx_crimson_slash',
          cx, cy - 52, isFull ? 295 : 240, isFull ? 295 : 240,
          p * 1.4 * facing, alpha * wave * 0.68, pal.tint, flip, 0.78
        );
        drawSleekCrescentArc(ctx, cx + 16 * facing, cy - 50, 98, 24, (-0.35 + p * 0.7) * facing, alpha * wave * 0.85, pal, flip);
        break;
      }
    }
    ctx.restore();
  }

  // ================= 细腻微缩金砂星屑（告别浮夸大黄圆球，仅保留轻盈微粒点缀） =================
  function drawAtmosphericEmbers(ctx, prof, x, y, vx, vw, isFull, p, alpha) {
    const pal = prof.pal;
    const count = isFull ? 14 : 9;
    const span = isFull ? (vw - 140) : 220;
    const baseLeft = isFull ? (vx + 70) : (x - 110);

    ctx.save();
    for (let i = 0; i < count; i++) {
      const r1 = seeded(prof.seed, i * 3 + 1);
      const r2 = seeded(prof.seed, i * 3 + 2);
      const r3 = seeded(prof.seed, i * 3 + 3);
      const px = baseLeft + r1 * span + Math.sin(p * 4.5 + i) * 16;
      const py = (y + 4 - r2 * 115) - p * (48 + r3 * 48);
      const rad = 1.2 + r3 * 1.3;
      const pa = alpha * (0.28 + 0.42 * Math.sin(p * Math.PI)) * (0.5 + r2 * 0.5);

      ctx.globalAlpha = pa;
      ctx.fillStyle = i % 3 === 0 ? pal.c3 : pal.c2;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ================= 施法者脚下清爽真气波环（绝不遮盖施法武将本尊！） =================
  function drawCasterAura(ctx, fx, prof, p, alpha) {
    if (fx.casterX == null || fx.casterY == null || p > 0.52) return;
    const cp = p / 0.52;
    const ca = alpha * (1 - cp);
    const gx = fx.casterX, gy = fx.casterY;
    const pal = prof.pal;

    ctx.save();
    ctx.globalAlpha = ca * 0.62;
    ctx.strokeStyle = pal.c2;
    ctx.lineWidth = 2.0 * (1 - cp * 0.45);
    ctx.beginPath();
    ctx.ellipse(gx, gy + 4, 24 + cp * 38, 8.5 + cp * 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // ================= 精简高雅招式题铭（默认由顶部立绘特写横幅或演武顶栏展示，绝不遮挡画面中央原画特效） =================
  function drawSkillCalligraphy(ctx, fx, prof, vx, vw, p) {
    if (!fx.showCalligraphy || !fx.skillName || fx.suppressCalligraphy || p > 0.76) return;
    // 仅对敌军Boss或局部无横幅技能在上方展示轻巧名帖，绝不遮挡画面中央特效
    const pal = prof.pal;
    const a = p < 0.12 ? (p / 0.12) : Math.max(0, 1 - (p - 0.46) / 0.30);
    const tx = fx.isFullscreen ? (vx + vw / 2) : fx.x;
    const ty = fx.isFullscreen ? 152 : Math.max(82, fx.y - 148 - p * 12);

    ctx.save();
    ctx.globalAlpha = clamp01(a * 0.92);
    const label = fx.casterName ? `${fx.casterName} · ${fx.skillName}` : `${fx.skillName}`;
    const boxW = Math.max(148, label.length * 16 + 42);
    const bg = ctx.createLinearGradient(tx - boxW / 2, ty, tx + boxW / 2, ty);
    bg.addColorStop(0, 'rgba(15, 8, 4, 0)');
    bg.addColorStop(0.22, 'rgba(18, 9, 4, 0.78)');
    bg.addColorStop(0.78, 'rgba(18, 9, 4, 0.78)');
    bg.addColorStop(1, 'rgba(15, 8, 4, 0)');
    ctx.fillStyle = bg;
    ctx.fillRect(tx - boxW / 2, ty - 15, boxW, 24);

    ctx.font = 'bold 14.5px "STKaiti", "KaiTi", "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.92)';
    ctx.lineWidth = 3.2;
    ctx.strokeText(`【${label}】`, tx, ty + 2);
    ctx.fillStyle = pal.c3;
    ctx.fillText(`【${label}】`, tx, ty + 2);
    ctx.restore();
  }

  // ================= 远景与贴地符阵底衬层（严格在所有兵马精灵之前绘制，威严震撼且 100% 不遮挡局内人物！） =================
  function renderBackdrop(ctx, fx, viewX, viewW) {
    const p = clamp01(1 - fx.life / fx.maxLife);
    const burst = p < 0.06 ? (p / 0.06) : 1;
    const fade = p < 0.68 ? 1 : Math.max(0, 1 - (p - 0.68) / 0.32);
    const alpha = clamp01(burst * fade);
    if (alpha <= 0.005) return;

    const facing = fx.facing || 1;
    const vx = typeof viewX === 'number' ? viewX : Math.max(0, fx.x - 480);
    const vw = viewW || 960;
    const prof = fx._cachedProfile || (fx._cachedProfile = resolveSkillProfile(fx));
    const spotX = fx.isFullscreen ? (vx + vw * 0.50) : fx.x;

    ctx.save();

    // 1. 极克制的边缘微暗（最高仅 0.14，保持整片沙场明亮通透）
    const dimPeak = (fx.isFullscreen ? 0.14 : 0.09) * Math.sin(Math.min(1, p * 1.2) * Math.PI);
    if (dimPeak > 0.01) {
      const vg = ctx.createRadialGradient(spotX, fx.y - 36, 120, spotX, fx.y - 36, vw * 0.72);
      vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vg.addColorStop(1, `rgba(18, 6, 8, ${dimPeak.toFixed(3)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(vx - 40, 0, vw + 80, 422);
    }

    // 2. 兵马脚下透视灵阵与施法光环
    drawPaintedGroundArray(ctx, prof.style, spotX, fx.y, !!fx.isFullscreen, p, alpha * 0.85, prof.pal);
    drawCasterAura(ctx, fx, prof, p, alpha);

    // 3. 吕布专属【远景天穹魔神法相 + 原画赤雷血十字背光 + 擎天方天画戟 + 贴地全屏震波】（全部位于将士身后与脚下，既霸气炫酷又 100% 不遮挡局内人物！）
    if (prof.style === 'lvbu_unrivaled_god') {
      const cx = spotX;
      const cy = fx.y;
      const godSurge = easeOutBack(Math.min(1, p * 2.2));
      const fullLeft = vx + 85;
      const fullSpan = vw - 170;

      // 远景天幕 3 道半透原画赤雷（置于所有兵马身后天际！）
      for (let b = 0; b < 3; b++) {
        const bp = (p * 1.6 - b * 0.12);
        if (bp <= 0 || bp >= 1) continue;
        const bx = fullLeft + (b + 0.5) * (fullSpan / 3);
        drawPaintedBurst(ctx, 'vfx_thunder', 'vfx_crimson_slash', bx, 148, 195, 225, (b - 1) * 0.08, alpha * Math.sin(bp * Math.PI) * 0.52, '#ef4444', b % 2 === 1, 0.96);
      }

      // 远景中央原画血火十字背光 + 半透战神吕布法相（耸立于天际城墙前、所有地面部队身后！）
      drawPaintedBurst(ctx, 'vfx_crimson_slash', 'vfx_fire', cx, 168, 285 * godSurge, 255 * godSurge, p * 0.25 * facing, alpha * 0.62, '#ef4444', false, 0.20);
      drawSpiritPhantom(ctx, prof.heroSpr, cx, 222, 198 * godSurge, facing, alpha * 0.52, '#ef4444', -0.02, 0.22, false);

      const mp = clamp01((p - 0.04) / 0.84);
      if (mp > 0) {
        const ma = alpha * Math.sin(mp * Math.PI);
        const hbTex = getDivineHalberdCanvas();
        if (hbTex) {
          const fallY = (1 - easeOutQuart(Math.min(1, mp * 2.2))) * 185;
          const hw = 152, hh = 252;
          ctx.save();
          ctx.translate(cx, (cy - 6) - fallY);
          ctx.rotate(-0.06 * facing);
          ctx.globalAlpha = clamp01(ma * 0.78);
          ctx.drawImage(hbTex, -hw / 2, -hh * 0.90, hw, hh);
          ctx.restore();
        }

        // 贴地向全屏扩散的三道扁平赤金震地波环（在所有兵马脚下扩散！）
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let r = 0; r < 3; r++) {
          const rp = clamp01(mp * 1.45 - r * 0.18);
          if (rp <= 0 || rp >= 1) continue;
          ctx.globalAlpha = alpha * (1 - rp) * 0.62;
          ctx.strokeStyle = r === 0 ? '#fde047' : '#ef4444';
          ctx.lineWidth = (3.4 - r * 0.8) * (1 - rp * 0.45);
          ctx.beginPath();
          ctx.ellipse(cx, cy + 4, 55 + rp * (vw * 0.45), 14 + rp * 48, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // ================= 清透前景刀芒特效层（在兵马之后、血条铭牌之前绘制，半透清朗不糊屏！） =================
  function renderForeground(ctx, fx, viewX, viewW) {
    const p = clamp01(1 - fx.life / fx.maxLife);
    const burst = p < 0.06 ? (p / 0.06) : 1;
    const fade = p < 0.66 ? 1 : Math.max(0, 1 - (p - 0.66) / 0.34);
    const rawAlpha = clamp01(burst * fade);
    if (rawAlpha <= 0.005) return;

    const facing = fx.facing || 1;
    const vx = typeof viewX === 'number' ? viewX : Math.max(0, fx.x - 480);
    const vw = viewW || 960;
    const prof = fx._cachedProfile || (fx._cachedProfile = resolveSkillProfile(fx));
    // 全屏技能前景透明度温和收敛，确保透过刀光火焰始终清晰看见两军交锋动作！
    const fgAlpha = fx.isFullscreen ? (rawAlpha * 0.68) : (rawAlpha * 0.82);

    ctx.save();
    drawMainStyleShow(ctx, prof, fx, vx, vw, p, fgAlpha, facing);
    drawHeroSignatureOverlay(ctx, prof, fx, vx, vw, p, fgAlpha * 0.85, facing);
    drawAtmosphericEmbers(ctx, prof, fx.x, fx.y, vx, vw, !!fx.isFullscreen, p, fgAlpha * 0.8);
    drawSkillCalligraphy(ctx, fx, prof, vx, vw, p);
    ctx.restore();
  }

  // ================= 兼容单次调用入口 =================
  function render(ctx, fx, viewX, viewW) {
    renderBackdrop(ctx, fx, viewX, viewW);
    renderForeground(ctx, fx, viewX, viewW);
  }

  App.SkillVFX = {
    render,
    renderBackdrop,
    renderForeground,
    resolveSkillProfile,
    drawPaintedBurst,
    drawSpiritPhantom,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
