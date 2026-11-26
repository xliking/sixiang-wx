(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  function uiClock(overrideTime) {
    return overrideTime != null ? overrideTime : ((Date.now() % 1000000) / 1000);
  }

  function hashSeed(str) {
    const s = String(str || '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  // 沿圆角矩形外框计算周长参数 [0,1) 对应的精确坐标，用于绘制神装双流金跑马灯流光框
  function pointOnRectPerimeter(x, y, w, h, u) {
    const p = ((u % 1) + 1) % 1;
    const perim = 2 * (w + h);
    let d = p * perim;
    if (d < w) return { x: x + d, y };
    d -= w;
    if (d < h) return { x: x + w, y: y + d };
    d -= h;
    if (d < w) return { x: x + w - d, y: y + h };
    d -= w;
    return { x, y: y + h - d };
  }

  function drawEquipIcon(ctx, tplId, x, y, size, opts) {
    const o = opts || {};
    const tpl = App.Config.EQUIP_TEMPLATES[tplId] || (App.Config.ITEMS && App.Config.ITEMS[tplId]);
    if (!tpl) return;
    const q = App.Config.QUALITIES[tpl.quality] || App.Config.QUALITIES.blue;
    const r = o.radius != null ? o.radius : 8;
    const isEquip = !!App.Config.EQUIP_TEMPLATES[tplId];
    const isGold = tpl.quality === 'gold';
    const isPurple = tpl.quality === 'purple';
    const isSoloGold = isEquip && isGold && !tpl.setId;
    const highGrowth = (o.enhance || 0) >= 8 || (o.star || 0) >= 2 || (o.advance || 0) >= 1;
    const hqVfx = !App.Settings || App.Settings.get('highQualityVfx');
    const animate = hqVfx && !o.noAnim && size >= 34 && (isGold || isPurple || highGrowth);
    const t = animate ? uiClock(o.time) : 0;
    const phase = (hashSeed(tplId) % 97) * 0.065;

    // 1. 神装/传世散件外溢呼吸背光晕
    if (animate && (isGold || isPurple)) {
      const pulse = 0.5 + 0.5 * Math.sin(t * (isGold ? 3.8 : 2.8) + phase);
      ctx.save();
      App.UI.roundRect(ctx, x - 2, y - 2, size + 4, size + 4, r + 2);
      ctx.strokeStyle = isSoloGold
        ? `rgba(251, 113, 133, ${0.32 + pulse * 0.36})`
        : (isGold ? `rgba(250, 204, 21, ${0.26 + pulse * 0.32})` : `rgba(192, 132, 252, ${0.20 + pulse * 0.24})`);
      ctx.lineWidth = isGold ? 2.6 : 1.8;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.clip();
    const key = tpl.imgKey || ((isEquip ? 'eq_' : 'item_') + tplId);
    const img = App.Assets.get(key);
    if (img) {
      ctx.drawImage(img, x, y, size, size);
    } else {
      ctx.fillStyle = q.bg;
      ctx.fillRect(x, y, size, size);
      if (App.Assets.isLoading && App.Assets.isLoading(key) && App.UI && App.UI.drawSpinner) {
        App.UI.drawSpinner(ctx, x + size / 2, y + size / 2, Math.min(10, size * 0.2), q.color || '#fde047');
      } else {
        ctx.fillStyle = '#fef08a';
        const mini = size < 22;
        ctx.font = `bold ${mini ? Math.max(8, Math.round(size * 0.62)) : Math.max(12, Math.round(size * 0.28))}px "PingFang SC", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(tpl.name || '装').slice(0, mini ? 1 : 2), x + size / 2, y + size / 2);
      }
    }

    // 2. 紫装/神装斜向丝绸金芒扫光带 + 升腾灵火粒子
    if (animate) {
      const cycle = ((t * (isGold ? 0.58 : 0.42) + phase) % 1.45);
      if (cycle < 1.0) {
        const sx = x - size * 0.75 + cycle * size * 2.5;
        const sheenG = ctx.createLinearGradient(sx - size * 0.28, y, sx + size * 0.28, y + size * 0.55);
        sheenG.addColorStop(0, 'rgba(255,255,255,0)');
        sheenG.addColorStop(0.5, isGold ? 'rgba(254, 249, 195, 0.48)' : 'rgba(243, 232, 255, 0.34)');
        sheenG.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = sheenG;
        ctx.beginPath();
        ctx.moveTo(sx - size * 0.35, y - 4);
        ctx.lineTo(sx + size * 0.08, y - 4);
        ctx.lineTo(sx - size * 0.28, y + size + 4);
        ctx.lineTo(sx - size * 0.72, y + size + 4);
        ctx.closePath();
        ctx.fill();
      }
      if (isGold && size >= 46) {
        const glowCol = tpl.glowColor || '#fde047';
        for (let i = 0; i < 3; i++) {
          const mp = ((t * 0.75 + phase + i * 0.33) % 1);
          const mx = x + size * (0.20 + ((i * 0.31 + Math.sin(t * 2.4 + i) * 0.07 + 1) % 0.62));
          const my = y + size * (0.92 - mp * 0.78);
          ctx.globalAlpha = Math.sin(mp * Math.PI) * 0.82;
          ctx.fillStyle = i === 0 ? '#ffffff' : glowCol;
          ctx.beginPath();
          ctx.arc(mx, my, 1.5 + (i % 2) * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.strokeStyle = o.border || q.color;
    ctx.lineWidth = o.lineWidth || 2;
    ctx.stroke();

    // 3. 传世金装 / 无双名器：双流金彗星环绕边框 + 右上角十字星芒闪烁
    if (animate && isGold) {
      ctx.globalCompositeOperation = 'lighter';
      const cometCol = isSoloGold ? '#fb7185' : (tpl.glowColor || '#fef08a');
      for (let c = 0; c < 2; c++) {
        const headU = (t * 0.36 + phase * 0.2 + c * 0.5) % 1;
        for (let seg = 0; seg < 6; seg++) {
          const p0 = pointOnRectPerimeter(x, y, size, size, headU - seg * 0.018);
          const p1 = pointOnRectPerimeter(x, y, size, size, headU - (seg + 1) * 0.018);
          ctx.strokeStyle = seg === 0 ? '#ffffff' : cometCol;
          ctx.globalAlpha = (1 - seg / 6) * 0.85;
          ctx.lineWidth = (o.lineWidth || 2) + (seg === 0 ? 1.2 : 0.4);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }
      // 角标寒星呼吸闪耀
      const starTw = 0.35 + 0.65 * Math.abs(Math.sin(t * 4.2 + phase));
      const sx = x + size - 7, sy = y + 7, sr = 4.2 * starTw;
      ctx.globalAlpha = starTw * 0.9;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(sx - sr, sy); ctx.lineTo(sx + sr, sy);
      ctx.moveTo(sx, sy - sr); ctx.lineTo(sx, sy + sr);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ★ UI 界面通用套装共鸣流光法阵（用于点将台武将立绘背光、神兽殿共鸣、军械库68套神装图鉴！）
  function drawUiSetAura(ctx, cx, cy, radius, setVfx, time) {
    if (!setVfx || !setVfx.vfxTier) return;
    const t = uiClock(time);
    const col = setVfx.auraColor || '#facc15';
    const subCol = setVfx.auraSubColor || '#fef08a';
    const tier = setVfx.vfxTier || 1;
    const style = setVfx.auraVfx || 'golden_emperor';

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';

    // 1. 呼吸元素柔光底盘
    const pulse = 0.86 + 0.14 * Math.sin(t * 3.4);
    const rg = ctx.createRadialGradient(0, 0, radius * 0.25, 0, 0, radius * 1.18 * pulse);
    rg.addColorStop(0, col + '55');
    rg.addColorStop(0.65, col + '22');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 1.18 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // 2. 外圈顺时针流光符环
    ctx.save();
    ctx.rotate(t * (tier >= 3 ? 1.35 : 0.85));
    ctx.strokeStyle = col;
    ctx.globalAlpha = tier >= 2 ? 0.78 : 0.48;
    ctx.lineWidth = tier >= 3 ? 2.2 : 1.6;
    ctx.setLineDash(style === 'frost_tide' ? [4, 5] : [10, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.96, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const nodes = tier >= 3 ? 6 : (tier >= 2 ? 4 : 2);
    for (let i = 0; i < nodes; i++) {
      const a = (Math.PI * 2 * i) / nodes;
      const nx = Math.cos(a) * radius * 0.96;
      const ny = Math.sin(a) * radius * 0.96;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : subCol;
      ctx.beginPath();
      ctx.arc(nx, ny, tier >= 3 ? 3.0 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. 4件套/6件套圆满：内层反向星芒阵与升腾灵韵粒子
    if (tier >= 2) {
      ctx.save();
      ctx.rotate(-t * 1.6);
      ctx.strokeStyle = subCol;
      ctx.globalAlpha = tier >= 3 ? 0.68 : 0.42;
      ctx.lineWidth = 1.4;
      const rIn = radius * 0.78;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k;
        if (k === 0) ctx.moveTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
        else ctx.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ★ 局内对战：武将/神兽脚底清爽半透套装共鸣符环（杜绝泛白光斑，突出地面清晰阵纹）
  function drawBattleSetAuraGround(ctx, setVfx, radiusX, time) {
    if (!setVfx || !setVfx.vfxTier) return;
    const t = time || 0;
    const tier = setVfx.vfxTier;
    const col = setVfx.auraColor || '#facc15';
    const sub = setVfx.auraSubColor || '#fef08a';
    const rx = radiusX || 38;

    ctx.save();
    ctx.translate(0, 5);
    ctx.scale(1, 0.35);

    const pulse = 1 + 0.04 * Math.sin(t * 3.8);
    ctx.save();
    ctx.rotate(t * (tier >= 3 ? 1.4 : 0.9));
    ctx.strokeStyle = col;
    ctx.globalAlpha = tier >= 3 ? 0.52 : (tier >= 2 ? 0.40 : 0.28);
    ctx.lineWidth = tier >= 3 ? 2.2 : 1.7;
    ctx.setLineDash([12, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, rx * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (tier >= 2) {
      const spokes = tier >= 3 ? 6 : 4;
      for (let i = 0; i < spokes; i++) {
        const a = (Math.PI * 2 * i) / spokes;
        ctx.fillStyle = i % 2 === 0 ? sub : col;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rx * pulse, Math.sin(a) * rx * pulse, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    if (tier >= 3) {
      ctx.save();
      ctx.rotate(-t * 1.8);
      ctx.strokeStyle = sub;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 1.4;
      const rIn = rx * 0.72;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k;
        if (k === 0) ctx.moveTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
        else ctx.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // ★ 局内对战：6件圆满高阶套装轻雅背光轮（克制内敛，绝不遮挡武将面容与战马）
  function drawBattleSetAuraUpper(ctx, setVfx, h, time, uid) {
    if (!setVfx || setVfx.vfxTier < 3) return;
    const t = time || 0;
    const col = setVfx.auraColor || '#facc15';
    const sub = setVfx.auraSubColor || '#fef08a';
    const seed = uid || 1;

    ctx.save();
    const haloY = -h * 0.58;
    const haloR = 20 + Math.sin(t * 3.2 + seed) * 1.2;
    ctx.translate(-5, haloY);
    ctx.rotate(t * 1.1);
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.36;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = sub;
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (haloR - 2), Math.sin(a) * (haloR - 2));
      ctx.lineTo(Math.cos(a) * (haloR + 3.5), Math.sin(a) * (haloR + 3.5));
      ctx.stroke();
    }
    ctx.restore();
  }

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function smoothstep(a, b, x) {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }
  function easeOutQuad(t) { const x = clamp01(t); return 1 - (1 - x) * (1 - x); }
  function easeOutCubic(t) { const x = clamp01(t); return 1 - Math.pow(1 - x, 3); }

  function createOffscreen(w, h) {
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

  // ================= 色彩材质光影工具（金属高光/暗面斜面/战马毛色/甲胄釉彩计算） =================
  function parseHexRgb(hex, fb) {
    const s = String(hex || '').trim();
    const m = /^#?([0-9a-fA-F]{6})$/.exec(s);
    if (!m) {
      const m3 = /^#?([0-9a-fA-F]{3})$/.exec(s);
      if (!m3) return fb || [203, 213, 225];
      const h3 = m3[1];
      return [parseInt(h3[0] + h3[0], 16), parseInt(h3[1] + h3[1], 16), parseInt(h3[2] + h3[2], 16)];
    }
    const v = parseInt(m[1], 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function rgbToHex(r, g, b) {
    const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  }

  function mixHex(c1, c2, t) {
    const a = parseHexRgb(c1), b = parseHexRgb(c2), k = clamp01(t);
    return rgbToHex(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
  }

  function shadeHex(hex, delta) {
    return delta >= 0 ? mixHex(hex, '#ffffff', delta) : mixHex(hex, '#090605', -delta);
  }

  function lumOfHex(hex) {
    const [r, g, b] = parseHexRgb(hex);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  function hexAlpha(hex, a) {
    const [r, g, b] = parseHexRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${clamp01(a).toFixed(3)})`;
  }

  // 温润古风金属深褐描边色（彻底告别生硬纯黑粗卡通线，完美贴合800名将手绘厚涂质感！）
  const CONTOUR_DARK = '#22150d';
  const CONTOUR_METAL = '#1c1410';

  // ================= ★ 3x超采样写实比例三国神兵工坊（冷锻精钢与鎏金吞口，真实贴合原画手掌尺寸！） =================
  const studioWeaponCache = {};
  let studioWeaponCount = 0;

  function resolveWeaponSubModel(k, wTpl, unitId, innateW) {
    if (!wTpl && innateW && innateW.subModel) {
      return innateW.subModel;
    }
    const wName = wTpl ? String(wTpl.name || '') : '';
    const wid = wTpl ? String(wTpl.id || '') : '';
    const q = wTpl ? wTpl.quality : 'none';
    const uid = String(unitId || '');
    const gCfg = (!wTpl && uid && App.Config && App.Config.GENERALS) ? App.Config.GENERALS[uid] : null;
    if (!wTpl && gCfg && gCfg.innateWeapon && gCfg.innateWeapon.subModel && (!gCfg.innateWeapon.weaponKind || gCfg.innateWeapon.weaponKind === k)) {
      return gCfg.innateWeapon.subModel;
    }

    if (k === 'spear') {
      if (wid === 'eq_yinlong_weapon' || /龙胆|百鸟/.test(wName) || (!wTpl && uid === 'zhaoyun')) {
        return q === 'gold' || wid === 'eq_yinlong_weapon' || !wTpl ? 'spear_dragon_winged' : 'spear_dragon';
      }
      if (/虎头|湛金|霸王/.test(wName) || (!wTpl && (uid === 'machao' || uid === 'sunce'))) {
        return 'spear_tiger_gold';
      }
      if (/丈八|矛|铍/.test(wName) || (!wTpl && uid === 'zhangfei')) return 'spear_serpent';
      if (/钩镰|狼牙|槊|铩|刺/.test(wName) || (!wTpl && uid === 'wenchou')) return 'spear_hook';
      return q === 'gold' ? 'spear_dragon_winged' : (q === 'purple' ? 'spear_dragon' : 'spear_standard');
    }
    if (k === 'halberd') {
      if (wid === 'fangtian_halberd' || /方天|鸿蒙|大戟/.test(wName) || (!wTpl && uid === 'lvbu')) return 'halberd_fangtian';
      if (/双铁戟|恶来/.test(wName) || (!wTpl && uid === 'dianwei')) return 'halberd_twin';
      return 'halberd_war';
    }
    if (k === 'guandao') {
      if (/钩镰|合淝|渡江/.test(wName) || (!wTpl && (uid === 'zhangliao' || uid === 'lvmeng'))) return 'guandao_hook';
      if (/七星/.test(wName)) return 'guandao_sevenstar';
      return 'guandao_dragon';
    }
    if (k === 'axe') {
      if (/锚/.test(wName) || (!wTpl && uid === 'ganning')) return 'axe_anchor';
      if (/[锤鎚杵鞭]/.test(wName) || (!wTpl && (uid === 'xuchu' || uid === 'menghuo' || uid === 'huanggai'))) return 'axe_hammer';
      return 'axe_xuanhua';
    }
    if (k === 'sword') {
      if (/双环/.test(wName)) return 'sword_chakram';
      if (/双股|雌雄/.test(wName) || (!wTpl && uid === 'liubei')) return 'sword_twin';
      if (/倚天/.test(wName) || (!wTpl && uid === 'caocao')) return 'sword_yitian';
      return 'sword_imperial';
    }
    return k;
  }

  function getStudioWeaponSpec(weaponKind, accentCol, bladeCol, wTpl, unitId, enhanceLv, innateW) {
    const k = weaponKind || 'spear';
    if (k === 'bow' || k === 'crossbow') return null;
    const gCfg = (!wTpl && unitId && App.Config && App.Config.GENERALS) ? App.Config.GENERALS[unitId] : null;
    const effInnate = (!wTpl && (innateW || (gCfg && gCfg.innateWeapon))) || null;
    const q = wTpl ? (wTpl.quality || 'blue') : (effInnate ? 'purple' : 'none');
    const qTier = q === 'gold' ? 3 : (q === 'purple' ? 2 : (q === 'blue' ? 1 : 0));
    const subModel = resolveWeaponSubModel(k, wTpl, unitId, effInnate);
    const acc = accentCol || (effInnate && effInnate.accentColor) || (qTier >= 3 ? '#d97706' : (qTier === 2 ? '#a855f7' : '#64748b'));
    const bld = bladeCol || (effInnate && effInnate.bladeColor) || '#e2e8f0';
    const enh = Math.min(15, Number(enhanceLv) || 0);
    const cacheKey = `real2|${subModel}|${q}|${acc}|${bld}|${enh >= 8 ? 2 : (enh >= 4 ? 1 : 0)}`;
    if (studioWeaponCache[cacheKey]) return studioWeaponCache[cacheKey];

    const SS = 3;
    let W = 96, H = 34, gripX = 28, gripY = 17, tasselX = 67, tasselY = 18.0;
    if (k === 'sword') { W = 72; H = 28; gripX = 15; gripY = 14; tasselX = 6.5; tasselY = 14.5; }
    else if (k === 'fan') { W = 48; H = 34; gripX = 10; gripY = 17; tasselX = 4.5; tasselY = 17.5; }
    else if (k === 'staff') { W = 86; H = 32; gripX = 26; gripY = 16; tasselX = 59; tasselY = 17.0; }
    else if (k === 'guandao') { W = 96; H = 38; gripX = 28; gripY = 20; tasselX = 63; tasselY = 21.2; }
    else if (k === 'halberd') { W = 96; H = 38; gripX = 28; gripY = 19; tasselX = 64; tasselY = 20.2; }
    else if (k === 'axe') { W = 86; H = 38; gripX = 26; gripY = 19; tasselX = 57; tasselY = 20.2; }
    else { W = 96; H = 32; gripX = 28; gripY = 16; tasselX = 68; tasselY = 17.2; }

    const cvs = createOffscreen(W * SS, H * SS);
    if (!cvs) return null;
    const g = cvs.getContext('2d');
    if (!g) return null;

    if (studioWeaponCount >= 96) {
      const fk = Object.keys(studioWeaponCache)[0];
      if (fk) { delete studioWeaponCache[fk]; studioWeaponCount--; }
    }

    g.save();
    g.scale(SS, SS);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const cy = gripY;

    // 写实古风冷锻精钢与鎏金青铜材质色阶（内敛厚重，贴合手绘人物光影）
    const trimLight = qTier >= 3 ? '#fde68a' : (qTier === 2 ? '#f3d082' : '#cbd5e1');
    const trimMid   = qTier >= 3 ? '#ca8a04' : (qTier === 2 ? '#a16207' : '#64748b');
    const trimDark  = qTier >= 3 ? '#5c3409' : (qTier === 2 ? '#452208' : '#334155');
    const bladeBright = '#f8fafc';
    const bladeMid = mixHex('#cbd5e1', bld, 0.30);
    const bladeDeep = '#3e4c5e';
    const bladeCore = '#26303d';
    const gemCol = qTier >= 3 ? (acc || '#dc2626') : (qTier === 2 ? acc : '#94a3b8');

    const outline = (lw, col) => {
      g.strokeStyle = col || CONTOUR_METAL;
      g.lineWidth = lw || 0.78;
      g.stroke();
    };

    const makeGoldGrad = (yTop, yBot) => {
      const gg = g.createLinearGradient(0, yTop, 0, yBot);
      gg.addColorStop(0, trimLight);
      gg.addColorStop(0.5, trimMid);
      gg.addColorStop(1, trimDark);
      return gg;
    };

    const drawMasterShaft = (x0, x1, r, shaftMain, shaftHi) => {
      const pg = makeGoldGrad(cy - r * 1.9, cy + r * 1.9);
      g.beginPath();
      g.moveTo(x0 - 5.2, cy);
      g.lineTo(x0 - 0.8, cy - r * 1.45);
      g.lineTo(x0 + 1.2, cy);
      g.lineTo(x0 - 0.8, cy + r * 1.45);
      g.closePath();
      g.fillStyle = pg; g.fill();
      outline(0.72);

      const sLight = shaftHi || (qTier >= 3 ? '#8c4b1f' : '#6e3c1b');
      const sBody  = shaftMain || '#33190b';
      const sg = g.createLinearGradient(0, cy - r, 0, cy + r);
      sg.addColorStop(0, shadeHex(sLight, 0.18));
      sg.addColorStop(0.35, sLight);
      sg.addColorStop(0.78, sBody);
      sg.addColorStop(1, '#170a04');
      g.beginPath();
      g.rect(x0, cy - r, x1 - x0, r * 2);
      g.fillStyle = sg; g.fill();
      outline(0.76);

      const wrapStart = gripX - 6, wrapEnd = gripX + 7;
      g.save();
      g.strokeStyle = hexAlpha(trimLight, 0.35);
      g.lineWidth = 0.55;
      for (let wx = wrapStart; wx < wrapEnd; wx += 2.8) {
        g.beginPath();
        g.moveTo(wx, cy - r + 0.2);
        g.lineTo(wx + 1.8, cy + r - 0.2);
        g.stroke();
      }
      g.restore();

      [x0 + 1.5, wrapEnd + 1.5, x1 - 3.5].forEach((rx) => {
        if (rx <= x0 || rx >= x1) return;
        g.fillStyle = pg;
        g.beginPath();
        g.rect(rx, cy - r * 1.22, 1.6, r * 2.44);
        g.fill();
        outline(0.62);
      });
    };

    const drawMasterCollar = (cx0, halfH, withGem) => {
      const cg = makeGoldGrad(cy - halfH, cy + halfH);
      g.beginPath();
      g.moveTo(cx0 - 0.8, cy - halfH * 0.72);
      g.lineTo(cx0 + 2.8, cy - halfH);
      g.lineTo(cx0 + 6.8, cy - halfH * 0.66);
      g.lineTo(cx0 + 8.0, cy);
      g.lineTo(cx0 + 6.8, cy + halfH * 0.66);
      g.lineTo(cx0 + 2.8, cy + halfH);
      g.lineTo(cx0 - 0.8, cy + halfH * 0.72);
      g.closePath();
      g.fillStyle = cg; g.fill();
      outline(0.75);

      if (withGem || qTier >= 2) {
        g.beginPath();
        g.arc(cx0 + 4.0, cy, 1.15, 0, Math.PI * 2);
        g.fillStyle = gemCol; g.fill();
        outline(0.5);
      }
    };

    const drawSymmetricFacetedBlade = (xBase, xShoulder, xTip, halfW) => {
      const ug = g.createLinearGradient(xBase, cy - halfW, xTip, cy);
      ug.addColorStop(0, bladeMid);
      ug.addColorStop(0.55, bladeBright);
      ug.addColorStop(1, '#ffffff');
      g.beginPath();
      g.moveTo(xBase, cy);
      g.lineTo(xShoulder, cy - halfW);
      g.quadraticCurveTo((xShoulder + xTip) * 0.56, cy - halfW * 0.46, xTip, cy);
      g.closePath();
      g.fillStyle = ug; g.fill();

      const lg = g.createLinearGradient(xBase, cy, xTip, cy + halfW);
      lg.addColorStop(0, bladeDeep);
      lg.addColorStop(0.6, mixHex(bladeMid, bladeDeep, 0.55));
      lg.addColorStop(1, bladeMid);
      g.beginPath();
      g.moveTo(xBase, cy);
      g.lineTo(xShoulder, cy + halfW);
      g.quadraticCurveTo((xShoulder + xTip) * 0.56, cy + halfW * 0.46, xTip, cy);
      g.closePath();
      g.fillStyle = lg; g.fill();

      g.beginPath();
      g.moveTo(xBase + 1.5, cy);
      g.lineTo(xShoulder + 1.2, cy - halfW * 0.26);
      g.lineTo(xTip - 7, cy);
      g.lineTo(xShoulder + 1.2, cy + halfW * 0.26);
      g.closePath();
      g.fillStyle = bladeCore; g.fill();

      g.beginPath();
      g.moveTo(xBase, cy);
      g.lineTo(xShoulder, cy - halfW);
      g.quadraticCurveTo((xShoulder + xTip) * 0.56, cy - halfW * 0.46, xTip, cy);
      g.quadraticCurveTo((xShoulder + xTip) * 0.56, cy + halfW * 0.46, xShoulder, cy + halfW);
      g.closePath();
      outline(0.78);

      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 0.62;
      g.beginPath();
      g.moveTo(xBase + 1.5, cy);
      g.lineTo(xTip - 0.8, cy);
      g.stroke();
    };

    if (k === 'spear') {
      const isWinged = subModel === 'spear_dragon_winged';
      const isTigerGold = subModel === 'spear_tiger_gold';
      const isDragon = subModel === 'spear_dragon' || isWinged || isTigerGold;
      const isSerpent = subModel === 'spear_serpent';
      const isHook = subModel === 'spear_hook';
      const shaftMain = isTigerGold ? '#4a1d0b' : (isWinged ? '#2c3540' : (isSerpent ? '#261416' : null));
      const shaftHi = isTigerGold ? '#b45309' : (isWinged ? '#94a3b8' : (isSerpent ? '#6b2121' : null));

      drawMasterShaft(7, 69, 1.18, shaftMain, shaftHi);

      if (isWinged || isTigerGold) {
        const wg = makeGoldGrad(cy - 5, cy + 5);
        [-1, 1].forEach((sgn) => {
          g.beginPath();
          g.moveTo(68.5, cy + sgn * 1.6);
          g.quadraticCurveTo(71.5, cy + sgn * 5.2, 67.2, cy + sgn * 6.0);
          g.quadraticCurveTo(73.2, cy + sgn * 5.0, 76.5, cy + sgn * 1.9);
          g.closePath();
          g.fillStyle = wg; g.fill();
          outline(0.68);
        });
      } else if (isHook) {
        g.beginPath();
        g.moveTo(72, cy + 1.8);
        g.quadraticCurveTo(75.5, cy + 7.2, 69.5, cy + 8.0);
        g.quadraticCurveTo(76.5, cy + 5.6, 76.5, cy + 1.9);
        g.closePath();
        g.fillStyle = bladeMid; g.fill();
        outline(0.68);
      }

      if (isSerpent) {
        drawMasterCollar(66.8, 2.9, true);
        g.beginPath();
        g.moveTo(73.5, cy - 2.0);
        g.bezierCurveTo(79, cy - 4.6, 84, cy + 1.4, 89, cy - 2.4);
        g.lineTo(94.8, cy);
        g.lineTo(89, cy + 1.8);
        g.bezierCurveTo(84, cy + 4.8, 79, cy - 1.0, 73.5, cy + 2.0);
        g.closePath();
        const smg = g.createLinearGradient(73.5, cy - 3.5, 94.8, cy + 3.5);
        smg.addColorStop(0, bladeBright);
        smg.addColorStop(0.55, bladeMid);
        smg.addColorStop(1, bladeDeep);
        g.fillStyle = smg; g.fill();
        outline(0.78);
      } else {
        drawMasterCollar(66.8, isDragon ? 3.0 : 2.5, isDragon);
        drawSymmetricFacetedBlade(73.5, 78.5, 94.8, (isWinged || isTigerGold) ? 3.1 : 2.75);
      }
    } else if (k === 'guandao') {
      const isHookDao = subModel === 'guandao_hook';
      drawMasterShaft(7, 65, 1.28, isHookDao ? '#23324a' : '#38190c', isHookDao ? '#64748b' : '#7c3a19');

      const bg = g.createLinearGradient(66, cy - 11, 94, cy + 4);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.42, bladeBright);
      bg.addColorStop(0.75, bladeMid);
      bg.addColorStop(1, bladeDeep);

      g.beginPath();
      g.moveTo(66.5, cy + 2.2);
      g.bezierCurveTo(78, cy + 5.0, 88.5, cy + 1.2, 94.8, cy - 9.8);
      g.lineTo(87.2, cy - 7.8);
      g.lineTo(85.8, cy - 9.8);
      g.lineTo(77.5, cy - 5.6);
      g.lineTo(67.0, cy - 2.2);
      g.closePath();
      g.fillStyle = bg; g.fill();
      outline(0.82);

      const spineG = makeGoldGrad(cy - 8, cy + 2);
      g.beginPath();
      g.moveTo(67.2, cy + 0.2);
      g.quadraticCurveTo(79, cy + 1.0, 88.2, cy - 6.6);
      g.lineTo(77.5, cy - 4.8);
      g.lineTo(67.2, cy - 1.8);
      g.closePath();
      g.fillStyle = spineG; g.fill();
      outline(0.62);

      if (isHookDao) {
        g.beginPath();
        g.moveTo(73, cy + 2.8);
        g.quadraticCurveTo(76.5, cy + 9.2, 69.8, cy + 9.8);
        g.quadraticCurveTo(74.0, cy + 6.8, 70.5, cy + 2.5);
        g.closePath();
        g.fillStyle = bladeMid; g.fill();
        outline(0.7);
      }
      drawMasterCollar(62.2, 3.2, true);
    } else if (k === 'halberd') {
      const isFangtian = subModel === 'halberd_fangtian';
      const isTwinHalberd = subModel === 'halberd_twin';
      drawMasterShaft(7, 67, 1.25, '#3b1512', '#88241e');

      const sides = (isFangtian || isTwinHalberd) ? [-1, 1] : [-1];
      sides.forEach((side) => {
        const barG = makeGoldGrad(cy - 8, cy + 8);
        [69.5, 75.0].forEach((bx) => {
          g.beginPath();
          g.rect(bx, side > 0 ? cy + 1.5 : cy - 6.5, 1.8, 5.0);
          g.fillStyle = barG; g.fill();
          outline(0.62);
        });

        const earG = g.createLinearGradient(65, cy + side * 4, 81, cy + side * 11);
        earG.addColorStop(0, bladeMid);
        earG.addColorStop(0.55, '#ffffff');
        earG.addColorStop(1, bladeDeep);
        g.beginPath();
        g.moveTo(65.0, cy + side * 10.6);
        g.quadraticCurveTo(73.0, cy + side * 6.8, 81.2, cy + side * 10.2);
        g.quadraticCurveTo(76.8, cy + side * 4.8, 72.8, cy + side * 4.6);
        g.quadraticCurveTo(68.5, cy + side * 4.8, 65.0, cy + side * 10.6);
        g.closePath();
        g.fillStyle = earG; g.fill();
        outline(0.75);
      });

      drawMasterCollar(63.5, 3.1, true);
      drawSymmetricFacetedBlade(70.5, 75.5, 94.5, 2.55);
    } else if (k === 'axe') {
      const isAnchor = subModel === 'axe_anchor';
      const isHammer = subModel === 'axe_hammer';
      drawMasterShaft(7, 63, 1.32, '#3a1a0d', '#7c3f1d');

      if (isHammer) {
        const hmG = makeGoldGrad(cy - 9, cy + 9);
        g.beginPath();
        g.ellipse(65.5, cy, 7.2, 8.2, 0, 0, Math.PI * 2);
        g.fillStyle = hmG; g.fill();
        outline(0.82);
        drawSymmetricFacetedBlade(72.5, 75.0, 83.5, 2.2);
        drawMasterCollar(56.5, 3.2, true);
      } else {
        [-1, 1].forEach((side) => {
          const reach = side > 0 ? 11.8 : (isAnchor ? 11.2 : 9.6);
          const axG = g.createLinearGradient(62, cy + side * 2, 62, cy + side * reach);
          axG.addColorStop(0, bladeDeep);
          axG.addColorStop(0.6, bladeMid);
          axG.addColorStop(1, bladeBright);
          g.beginPath();
          g.moveTo(59.5, cy + side * 2.0);
          g.quadraticCurveTo(54.5, cy + side * 6.5, 53.5, cy + side * (reach * 0.80));
          g.quadraticCurveTo(63.0, cy + side * (reach * 1.12), 72.2, cy + side * (reach * 0.76));
          g.quadraticCurveTo(67.5, cy + side * 5.8, 65.5, cy + side * 2.0);
          g.closePath();
          g.fillStyle = axG; g.fill();
          outline(0.8);
        });
        drawSymmetricFacetedBlade(66.0, 69.5, 83.0, 2.4);
        drawMasterCollar(56.8, 3.2, true);
      }
    } else if (k === 'sword') {
      const isTwin = subModel === 'sword_twin';
      const pg = makeGoldGrad(cy - 5, cy + 5);
      g.beginPath();
      g.arc(7.5, cy, 2.3, 0, Math.PI * 2);
      g.fillStyle = pg; g.fill();
      outline(0.72);

      g.fillStyle = '#3b1d0e';
      g.beginPath();
      g.rect(9.5, cy - 1.45, 9.5, 2.9);
      g.fill();
      outline(0.72);

      if (isTwin) {
        g.save();
        g.translate(-1.5, -2.4);
        g.scale(0.92, 0.78);
        drawSymmetricFacetedBlade(21, 24, 68, 2.1);
        g.restore();
      }
      drawSymmetricFacetedBlade(20.5, 23.5, 69.5, 2.45);

      g.beginPath();
      g.moveTo(17.8, cy - 4.8);
      g.lineTo(21.2, cy - 5.4);
      g.lineTo(23.0, cy);
      g.lineTo(21.2, cy + 5.4);
      g.lineTo(17.8, cy + 4.8);
      g.closePath();
      g.fillStyle = pg; g.fill();
      outline(0.75);
    } else if (k === 'staff') {
      drawMasterShaft(7, 62, 1.15, '#3b1d0e', '#854d0e');
      const cg = makeGoldGrad(cy - 7, cy + 7);
      [-1, 1].forEach((side) => {
        g.beginPath();
        g.moveTo(61, cy + side * 1.5);
        g.bezierCurveTo(65, cy + side * 8.2, 73, cy + side * 7.6, 77.5, cy + side * 2.8);
        g.quadraticCurveTo(72, cy + side * 4.2, 67, cy + side * 1.8);
        g.closePath();
        g.fillStyle = cg; g.fill();
        outline(0.72);
      });
      drawMasterCollar(58.5, 2.8, true);
      const og = g.createRadialGradient(69.2, cy - 1.0, 0.5, 70.2, cy, 3.8);
      og.addColorStop(0, '#ffffff');
      og.addColorStop(0.55, '#fde68a');
      og.addColorStop(1, trimMid);
      g.beginPath(); g.arc(70.2, cy, 3.5, 0, Math.PI * 2);
      g.fillStyle = og; g.fill();
      outline(0.68);
    } else if (k === 'fan') {
      const isFlameFan = subModel === 'fan_flame';
      const hg = makeGoldGrad(cy - 2, cy + 2);
      g.beginPath(); g.rect(4, cy - 1.3, 9, 2.6);
      g.fillStyle = '#5c2c16'; g.fill();
      outline(0.7);

      const angles = [-0.54, -0.36, -0.18, 0, 0.18, 0.36, 0.54];
      angles.forEach((a, idx) => {
        const len = 28 - Math.abs(idx - 3) * 1.5;
        g.save();
        g.translate(12.5, cy);
        g.rotate(a);
        const fg = g.createLinearGradient(0, 0, len, 0);
        if (isFlameFan) {
          fg.addColorStop(0, '#7f1d1d');
          fg.addColorStop(0.55, '#c2410c');
          fg.addColorStop(1, '#fde68a');
        } else {
          fg.addColorStop(0, '#334155');
          fg.addColorStop(0.45, '#cbd5e1');
          fg.addColorStop(1, '#f8fafc');
        }
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(len * 0.58, -3.2, len - 2.2, -1.6);
        g.quadraticCurveTo(len + 1.2, 0, len - 2.2, 1.6);
        g.quadraticCurveTo(len * 0.58, 3.2, 0, 0);
        g.closePath();
        g.fillStyle = fg; g.fill();
        outline(0.62);
        g.restore();
      });

      g.beginPath();
      g.moveTo(11.2, cy - 3.2); g.lineTo(15.2, cy - 3.8); g.lineTo(17.5, cy); g.lineTo(15.2, cy + 3.8); g.lineTo(11.2, cy + 3.2);
      g.closePath();
      g.fillStyle = hg; g.fill();
      outline(0.68);
    }

    g.restore();
    const spec = { canvas: cvs, w: W, h: H, gripX, gripY, tasselX, tasselY, qTier, acc, bld, subModel };
    studioWeaponCache[cacheKey] = spec;
    studioWeaponCount++;
    return spec;
  }

  // 54名核心名将原画实测【战马真毛色, 骑手臂甲主色】内置表（即便未重启后端或跨域Canvas亦可100%精准匹配！）
  const CORE_UNIT_PALETTES = {
    liubei: ['#cac8c8', '#6c7544'], zhugeliang: ['#ccc4bb', '#38554c'], guanyu: ['#852122', '#8f6847'],
    zhaoyun: ['#c8c8c9', '#757477'], zhangfei: ['#574835', '#71553a'], machao: ['#787983', '#786965'],
    huangzhong: ['#a54a19', '#96682e'], pangtong: ['#4a261b', '#4f362b'], huangyueying: ['#8a664e', '#8b492f'],
    weiyan: ['#4f3728', '#54442f'], jiangwei: ['#89776d', '#716951'], fazheng: ['#653a24', '#2a3733'],
    guanping: ['#873527', '#485638'], menghuo: ['#6e2824', '#aa6949'], zhurong: ['#702816', '#94472c'],
    caocao: ['#303650', '#68554d'], simayi: ['#552423', '#73564b'], dianwei: ['#4d2824', '#8f5843'],
    zhangliao: ['#595350', '#415797'], xuhuang: ['#685954', '#85664d'], zhanghe: ['#6b5353', '#4e4e66'],
    yuejin: ['#472c23', '#5d645a'], yujin: ['#373434', '#4a474d'], guojia: ['#474851', '#94b1b8'],
    zhenji: ['#aba7af', '#fbfcfa'], xiahoudun: ['#474854', '#49434e'], xiahouyuan: ['#873b26', '#47578a'],
    xuchu: ['#51362a', '#ab8663'], caoren: ['#4f3828', '#564846'], jiaxu: ['#35252f', '#8f566b'],
    sunquan: ['#91571d', '#aa652b'], sunce: ['#8c3818', '#96572d'], zhouyu: ['#8d2825', '#ac6946'],
    luxun: ['#8c371a', '#8d3827'], lvmeng: ['#68392a', '#bcb3a9'], lusu: ['#97431a', '#76462d'],
    ganning: ['#373435', '#ad5945'], sunshangxiang: ['#c2bcb9', '#70462e'], taishici: ['#542826', '#8d4731'],
    huanggai: ['#743723', '#713b2b'], zhoutai: ['#5b534e', '#66413c'], daqiao: ['#a7a8b0', '#b4c9d6'],
    xiaoqiao: ['#cca78d', '#e7c6b7'], lvbu: ['#742327', '#735935'], diaochan: ['#c6b7b6', '#a777a3'],
    yuanshao: ['#bab3ae', '#a08871'], yanliang: ['#533627', '#92342c'], wenchou: ['#494646', '#2c2728'],
    gongsunzan: ['#aba8ab', '#8c9698'], gaoshun: ['#6f2824', '#533731'], dongzhuo: ['#3a3232', '#76553a'],
    huaxiong: ['#393432', '#4c382d'], huatuo: ['#ada8aa', '#287758'], zhangjiao: ['#4a464e', '#71574b'],
  };

  const sampledSpritePalettes = {};
  const cleanHorseBodyCache = {};
  let cleanHorseBodyCount = 0;

  // 在同源或本地缓存可用时，直接从原画战马腿部与骑手肩臂采样100%真实色值（跨域时静默回退配置色）
  function sampleSpriteTrueColors(spriteKey, img) {
    if (!spriteKey || !img) return null;
    if (sampledSpritePalettes[spriteKey] !== undefined) return sampledSpritePalettes[spriteKey];
    sampledSpritePalettes[spriteKey] = null;
    try {
      const iw = img.naturalWidth || img.width || 0;
      const ih = img.naturalHeight || img.height || 0;
      if (iw < 32 || ih < 32) return null;
      const cvs = createOffscreen(iw, ih);
      if (!cvs) return null;
      const g = cvs.getContext('2d');
      if (!g) return null;
      g.drawImage(img, 0, 0, iw, ih);

      const pickRegion = (rx0, rx1, ry0, ry1) => {
        const x0 = Math.max(0, Math.floor(iw * rx0));
        const x1 = Math.min(iw, Math.ceil(iw * rx1));
        const y0 = Math.max(0, Math.floor(ih * ry0));
        const y1 = Math.min(ih, Math.ceil(ih * ry1));
        if (x1 <= x0 || y1 <= y0) return null;
        const data = g.getImageData(x0, y0, x1 - x0, y1 - y0).data;
        const rs = [], gs = [], bs = [];
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 210) continue;
          const r = data[i], gg = data[i + 1], b = data[i + 2];
          const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
          if (lum < 26 || lum > 246) continue;
          rs.push(r); gs.push(gg); bs.push(b);
        }
        if (rs.length < 10) return null;
        rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b);
        const mid = Math.floor(rs.length * 0.58);
        return rgbToHex(rs[mid], gs[mid], bs[mid]);
      };

      const isCav = spriteKey.startsWith('unit_cavalry');
      const coat = isCav
        ? pickRegion(0.14, 0.65, 0.72, 0.90)
        : pickRegion(0.22, 0.84, 0.75, 0.91);
      const arm = isCav
        ? pickRegion(0.32, 0.44, 0.22, 0.36)
        : pickRegion(0.42, 0.54, 0.34, 0.46);
      if (coat) {
        sampledSpritePalettes[spriteKey] = { coat, arm: arm || '#64748b' };
      }
    } catch (_e) {
      sampledSpritePalettes[spriteKey] = null;
    }
    return sampledSpritePalettes[spriteKey];
  }

  function resolveHorsePalette(spriteKey, unitId, mTpl, battleSpec, aTpl, img) {
    const key = String(spriteKey || '');
    const uid = String(unitId || '').replace(/^enemy_/, '');
    const sampled = sampleSpriteTrueColors(key, img);
    const core = CORE_UNIT_PALETTES[uid] || CORE_UNIT_PALETTES[key.replace(/^battle_gen_/, '')] || null;

    let baseCoat = '#6b442b';
    let baseArm = '#64748b';
    if (key.startsWith('unit_cavalry')) {
      baseCoat = '#4d2919';
      baseArm = key.endsWith('_enemy') ? '#7f2d24' : '#435570';
    } else if (key === 'unit_gen_silver' || key === 'unit_gen_female') {
      baseCoat = '#d4d8df';
      baseArm = '#8a94a0';
    } else if (sampled && sampled.coat) {
      baseCoat = sampled.coat;
      baseArm = sampled.arm || baseArm;
    } else if (core) {
      baseCoat = core[0];
      baseArm = core[1];
    } else if (battleSpec && battleSpec.coatColor) {
      baseCoat = battleSpec.coatColor;
      baseArm = battleSpec.armorColor || baseArm;
    }

    // 白马/银鬃马提亮还原清透银白肌理，杜绝灰暗脏色；赤兔/乌骓/栗色马保留温润毛色高光
    const coatLum = lumOfHex(baseCoat);
    const coat = coatLum > 0.58
      ? mixHex(baseCoat, '#eef2f7', 0.42)
      : (coatLum < 0.16 ? mixHex(baseCoat, '#2e323d', 0.22) : shadeHex(baseCoat, 0.06));
    const coatHi = coatLum > 0.58 ? '#f8fafc' : shadeHex(coat, 0.24);
    const coatDeep = coatLum > 0.58 ? mixHex(coat, '#6e7785', 0.52) : shadeHex(coat, -0.36);
    const farCoat = coatLum > 0.58 ? mixHex(coat, '#7a8391', 0.44) : shadeHex(coat, -0.28);
    const farDeep = shadeHex(farCoat, -0.34);
    const hoof = coatLum > 0.62 ? '#3b3532' : '#211813';
    const hoofHi = coatLum > 0.62 ? '#78716c' : '#57493f';

    const armorTier = aTpl ? (aTpl.quality === 'gold' ? 3 : (aTpl.quality === 'purple' ? 2 : 1)) : 0;
    const armLum = lumOfHex(baseArm);
    const armMid = armLum > 0.72 ? mixHex(baseArm, '#cbd5e1', 0.25) : shadeHex(baseArm, 0.08);
    const armHi = shadeHex(armMid, 0.30);
    const armDark = shadeHex(armMid, -0.38);
    const trim = (mTpl && mTpl.quality === 'gold') ? '#fde047' : '#d4a34b';
    const armorTrim = armorTier >= 3 ? '#fef08a' : (battleSpec && battleSpec.trimColor ? battleSpec.trimColor : '#cfa04c');

    return {
      coat,
      coatHi,
      coatDeep,
      farCoat,
      farDeep,
      hoof,
      hoofHi,
      armMid,
      armHi,
      armDark,
      trim,
      armorTrim,
      armorTier,
    };
  }

  // ★ 战马解剖曲线净身裁剪缓存（100%保留飘逸马尾、马臀甲、骑手战靴马镫与前胸甲，精准剔除原画静态4条死腿与悬空前膝！）
  function getCleanHorseBodyCanvas(spriteKey, img) {
    if (!img) return null;
    const key = String(spriteKey || 'default_horse');
    const iw = img.naturalWidth || img.width || 0;
    const ih = img.naturalHeight || img.height || 0;
    if (iw < 16 || ih < 16) return img;
    const cacheKey = `${key}|${iw}x${ih}`;
    if (cleanHorseBodyCache[cacheKey]) return cleanHorseBodyCache[cacheKey];

    const cvs = createOffscreen(iw, ih);
    if (!cvs) return img;
    const g = cvs.getContext('2d');
    if (!g) return img;

    if (cleanHorseBodyCount >= 64) {
      const firstKey = Object.keys(cleanHorseBodyCache)[0];
      if (firstKey) { delete cleanHorseBodyCache[firstKey]; cleanHorseBodyCount--; }
    }

    const isCav = key.startsWith('unit_cavalry');
    g.save();
    g.beginPath();
    if (isCav) {
      // 铁甲骑兵 (262x230)：完整保留左侧马尾、铁臀甲下沿、中部战袍铁靴马镫与前胸甲，彻底裁除原画静态大腿与前抬膝！
      g.moveTo(0, 0);
      g.lineTo(iw, 0);
      g.lineTo(iw, ih * 0.480);
      g.lineTo(iw * 0.706, ih * 0.498);
      g.quadraticCurveTo(iw * 0.692, ih * 0.608, iw * 0.662, ih * 0.618);
      g.quadraticCurveTo(iw * 0.595, ih * 0.605, iw * 0.522, ih * 0.622);
      g.bezierCurveTo(iw * 0.510, ih * 0.692, iw * 0.405, ih * 0.692, iw * 0.390, ih * 0.618);
      g.quadraticCurveTo(iw * 0.265, ih * 0.595, iw * 0.136, ih * 0.615);
      g.bezierCurveTo(iw * 0.118, ih * 0.678, iw * 0.095, ih * 0.748, 0, ih * 0.752);
    } else {
      // 824名骑将原画 (176x164)：完整保留马尾、马臀甲金边、中部战靴马镫与前胸甲，精准裁除原画静态四腿与前抬膝！
      const ox = key.includes('lvbu') ? 0.045 : 0;
      g.moveTo(0, 0);
      g.lineTo(iw, 0);
      g.lineTo(iw, ih * 0.575);
      g.lineTo(iw * Math.min(0.845, 0.806 + ox * 0.5), ih * 0.596);
      g.quadraticCurveTo(iw * Math.min(0.818, 0.775 + ox * 0.5), ih * 0.624, iw * (0.732 + ox * 0.45), ih * 0.616);
      g.quadraticCurveTo(iw * (0.666 + ox * 0.48), ih * 0.672, iw * (0.594 + ox * 0.5), ih * 0.648);
      g.bezierCurveTo(iw * (0.582 + ox * 0.5), ih * 0.764, iw * (0.492 + ox * 0.6), ih * 0.764, iw * (0.476 + ox * 0.6), ih * 0.654);
      g.quadraticCurveTo(iw * (0.346 + ox * 0.8), ih * 0.620, iw * (0.214 + ox), ih * 0.656);
      g.bezierCurveTo(iw * (0.196 + ox), ih * 0.772, iw * (0.178 + ox), ih * 0.838, 0, ih * 0.842);
    }
    g.closePath();
    g.clip();
    g.drawImage(img, 0, 0, iw, ih);
    g.restore();

    cleanHorseBodyCache[cacheKey] = cvs;
    cleanHorseBodyCount++;
    return cvs;
  }

  // ★ 真马四拍飞驰（Rotary/Transverse Gallop）6关键帧周期三次样条曲线：
  // 严格对齐真马飞驰步态（前伸探蹄 -> 撑地跨步 -> 收腕折蹄 -> 腾空聚拢高抬膝 -> 伸腕落蹄 / 后腿收腹前探 -> 屈飞节落蹄 -> 蹬伸后扬）：
  const HORSE_TAU = Math.PI * 2;
  // [a1(肩/髋角), a2(腕/飞节管骨角), a3(球节系部角), lift(肩胛/股骨上提缩略比)]
  const FORE_GALLOP_KEYS = [
    [ 0.78,  0.72,  0.58, 0.15], // k0: 前肢向前大幅伸直探出
    [ 0.38,  0.37,  0.48, 0.00], // k1: 前蹄踏地笔直支撑
    [-0.22, -0.24, -0.05, 0.00], // k2: 支撑后掠越过胸腹下方
    [-0.02, -1.24, -1.52, 0.65], // k3: 离地瞬间腕关节大幅向后L形折叠收蹄
    [ 0.84, -0.42, -0.82, 0.55], // k4: 腾空聚拢期高抬前膝（>形曲腕）
    [ 0.88, -0.02, -0.34, 0.35], // k5: 前膝高位向前展开准备下探
  ];
  const HIND_GALLOP_KEYS = [
    [-0.34,  0.14,  0.22, 0.00], // k0: 后肢踏地发力支撑（清晰<形飞节）
    [-0.50, -0.36, -0.62, 0.30], // k1: 向后崩直蹬地离地
    [-0.58, -0.86, -1.16, 0.75], // k2: 臀后凌空高扬收蹄
    [-0.28, -0.62, -0.98, 0.95], // k3: 股骨上提、屈飞节贴臀向前摆动（绝不擦地）
    [ 0.12,  0.78,  0.50, 0.68], // k4: 腾空期后蹄深探马腹下方聚拢
    [-0.22,  0.42,  0.34, 0.05], // k5: 后肢于腹下着地承重（<形飞节缓冲）
  ];
  // [bobY(腾空起伏), pitch(昂首俯冲角), surgeX(前窜律动)]
  const BODY_GALLOP_KEYS = [
    [-0.20,  0.020,  0.60],
    [ 0.70,  0.028,  1.00],
    [ 0.20,  0.006,  0.30],
    [-1.60, -0.028, -0.50],
    [-2.80, -0.044, -0.80],
    [-1.50, -0.016, -0.20],
  ];
  const _gallopSample = [0, 0, 0, 0];

  function evalPeriodicSpline(keys, phase, out) {
    const n = keys.length;
    let u = (phase / HORSE_TAU) % 1;
    if (u < 0) u += 1;
    const t = u * n;
    const i1 = Math.floor(t) % n;
    const f = t - Math.floor(t);
    const i0 = (i1 - 1 + n) % n;
    const i2 = (i1 + 1) % n;
    const i3 = (i1 + 2) % n;
    const p0 = keys[i0], p1 = keys[i1], p2 = keys[i2], p3 = keys[i3];
    const f2 = f * f;
    const f3 = f2 * f;
    const dims = p0.length;
    for (let c = 0; c < dims; c++) {
      const v0 = p0[c], v1 = p1[c], v2 = p2[c], v3 = p3[c];
      out[c] = 0.5 * (
        (2 * v1)
        + (-v0 + v2) * f
        + (2 * v0 - 5 * v1 + 4 * v2 - v3) * f2
        + (-v0 + 3 * v1 - 3 * v2 + v3) * f3
      );
    }
    return out;
  }

  // ★ 真马生物力学三关节飞驰步态（双通道无缝外轮廓消除关节黑圈 + 腾空折腕高抬膝与后腿收腹蹬伸；待机与攻击时四蹄稳扎地面！）
  function drawEquineMuscularLeg(ctx, ox, oy, isFront, isFar, phase, moveBlend, pal, rigScale) {
    const sc = rigScale || 1;
    const baseL1 = (isFront ? 13.8 : 14.6) * sc;
    const L2 = (isFront ? 11.2 : 11.6) * sc;
    const L3 = (isFront ? 4.0 : 4.1) * sc;

    // 1. 静止/攻击时稳健站姿（100%固定角度，绝不在原地刨蹄或随武将攻击乱动！）
    let idleA1, idleA2, idleA3;
    if (isFront) {
      idleA1 = isFar ? -0.05 : 0.08;
      idleA2 = idleA1 - 0.02;
      idleA3 = idleA2 + 0.14;
    } else {
      idleA1 = isFar ? -0.22 : -0.32;
      idleA2 = idleA1 + 0.34;
      idleA3 = idleA2 + 0.12;
    }

    const mb = clamp01(moveBlend);
    let a1 = idleA1, a2 = idleA2, a3 = idleA3, lift = 0;

    if (mb > 0.001) {
      const s = evalPeriodicSpline(isFront ? FORE_GALLOP_KEYS : HIND_GALLOP_KEYS, phase, _gallopSample);
      a1 = idleA1 * (1 - mb) + s[0] * mb;
      a2 = idleA2 * (1 - mb) + s[1] * mb;
      a3 = idleA3 * (1 - mb) + s[2] * mb;
      lift = Math.max(0, Math.min(1.1, s[3])) * mb;
    }

    // 奔跑折腿摆动期模拟肩胛骨/股骨自然上提与透视缩略，确保收蹄凌空不擦地
    const effOy = oy - lift * (isFront ? 1.8 : 3.4) * sc;
    const L1 = baseL1 * (1 - lift * (isFront ? 0.08 : 0.20));

    const j1x = ox + Math.sin(a1) * L1;
    const j1y = effOy + Math.cos(a1) * L1;
    const j2x = j1x + Math.sin(a2) * L2;
    const j2y = j1y + Math.cos(a2) * L2;
    const hfx = j2x + Math.sin(a3) * L3;
    const hfy = j2y + Math.cos(a3) * L3;

    const mainCol = isFar ? pal.farCoat : pal.coat;
    const deepCol = isFar ? pal.farDeep : pal.coatDeep;
    const hiCol = isFar ? mainCol : pal.coatHi;

    const traceMuscleSeg = (x0, y0, x1, y1, r0, r1, bowBack, bowFront) => {
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dy / len, ny = -dx / len;
      const mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x0 + nx * r0, y0 + ny * r0);
      ctx.quadraticCurveTo(mx + nx * ((r0 + r1) * 0.5 + bowFront), my + ny * ((r0 + r1) * 0.5 + bowFront), x1 + nx * r1, y1 + ny * r1);
      ctx.arc(x1, y1, r1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
      ctx.quadraticCurveTo(mx - nx * ((r0 + r1) * 0.5 + bowBack), my - ny * ((r0 + r1) * 0.5 + bowBack), x0 - nx * r0, y0 - ny * r0);
      ctx.arc(x0, y0, r0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
      ctx.closePath();
      return { nx, ny, mx, my, r0 };
    };

    const fillSegGrad = (x0, y0, x1, y1, r0, r1, bowBack, bowFront) => {
      const gInfo = traceMuscleSeg(x0, y0, x1, y1, r0, r1, bowBack, bowFront);
      const grad = ctx.createLinearGradient(
        gInfo.mx - gInfo.nx * gInfo.r0, gInfo.my - gInfo.ny * gInfo.r0,
        gInfo.mx + gInfo.nx * gInfo.r0, gInfo.my + gInfo.ny * gInfo.r0
      );
      grad.addColorStop(0, deepCol);
      grad.addColorStop(0.55, mainCol);
      grad.addColorStop(1, hiCol);
      ctx.fillStyle = grad;
      ctx.fill();
    };

    const r1Top = (isFront ? 4.85 : 5.85) * sc;
    const r1Bot = (isFront ? 2.35 : 2.48) * sc;
    const b1Back = (isFront ? 0.65 : 1.75) * sc;
    const b1Front = (isFront ? 0.80 : 0.55) * sc;
    const r2Top = (isFront ? 2.22 : 2.32) * sc;
    const r2Bot = 1.62 * sc;
    const b2Back = (isFront ? 0.16 : 0.42) * sc;
    const b2Front = 0.20 * sc;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 第一遍：一体连通外轮廓描边（彻底消除白马/浅色马膝盖与球节内部的木偶黑圈接缝！）
    ctx.fillStyle = CONTOUR_DARK;
    ctx.strokeStyle = CONTOUR_DARK;
    ctx.lineWidth = 1.72 * sc;
    traceMuscleSeg(ox, effOy, j1x, j1y, r1Top, r1Bot, b1Back, b1Front);
    ctx.fill(); ctx.stroke();
    traceMuscleSeg(j1x, j1y, j2x, j2y, r2Top, r2Bot, b2Back, b2Front);
    ctx.fill(); ctx.stroke();
    traceMuscleSeg(j2x, j2y, hfx, hfy, 1.62 * sc, 1.42 * sc, 0.24 * sc, 0.12 * sc);
    ctx.fill(); ctx.stroke();

    // 第二遍：无缝肌理渐变填充（大腿/肩臂 -> 腕/飞节管骨 -> 球节系部自然过渡）
    fillSegGrad(ox, effOy, j1x, j1y, r1Top, r1Bot, b1Back, b1Front);
    fillSegGrad(j1x, j1y, j2x, j2y, r2Top, r2Bot, b2Back, b2Front);
    fillSegGrad(j2x, j2y, hfx, hfy, 1.62 * sc, 1.42 * sc, 0.24 * sc, 0.12 * sc);

    // 第三遍：写实梯形角质铁蹄
    ctx.save();
    ctx.translate(hfx, hfy);
    ctx.rotate(-a3 * 0.88);
    const hw = 2.42 * sc, hh = 2.55 * sc;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.65, -hh * 0.48);
    ctx.lineTo(hw * 0.74, -hh * 0.45);
    ctx.lineTo(hw * 1.14, hh * 0.54);
    ctx.lineTo(-hw * 0.92, hh * 0.54);
    ctx.closePath();
    ctx.fillStyle = isFar ? shadeHex(pal.hoof, -0.25) : pal.hoof;
    ctx.fill();
    ctx.strokeStyle = CONTOUR_DARK;
    ctx.lineWidth = 0.78 * sc;
    ctx.stroke();

    if (!isFar) {
      ctx.strokeStyle = pal.hoofHi;
      ctx.lineWidth = 0.62 * sc;
      ctx.beginPath();
      ctx.moveTo(hw * 0.52, -hh * 0.28);
      ctx.lineTo(hw * 0.90, hh * 0.38);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  // ★ 统一解析五军小兵贴图 Key：自动映射铁骑/方士新写实立绘，并按敌我阵营切换蓝青（我军）/ 赤褐（敌军）战袍甲胄！
  function resolveTroopSpriteKey(troopId, rawSpriteKey, side) {
    let baseKey = rawSpriteKey || 'unit_infantry';
    if (troopId === 'cavalry' || baseKey === 'unit_gen_silver') baseKey = 'unit_cavalry';
    else if (troopId === 'mage' || baseKey === 'unit_gen_mage') baseKey = 'unit_mage';
    else if (troopId === 'pike') baseKey = 'unit_pikeman';
    else if (troopId === 'archer') baseKey = 'unit_archer';
    else if (troopId === 'spear') baseKey = 'unit_infantry';
    baseKey = String(baseKey).replace(/_enemy$/, '');

    if (side === 'enemy') {
      const enemyKey = baseKey + '_enemy';
      if (App.Assets && App.Assets.get && App.Assets.get(enemyKey)) return enemyKey;
    }
    if ((baseKey === 'unit_cavalry' || baseKey === 'unit_mage') && App.Assets && App.Assets.get && !App.Assets.get(baseKey)) {
      return baseKey === 'unit_cavalry' ? 'unit_gen_silver' : 'unit_gen_mage';
    }
    return baseKey;
  }

  // 真马四拍飞驰相位配置（远后领蹄 +0.135 -> 近后蹬伸 0.00 -> 近前探蹄 0.00 -> 远前跨步 -0.165 -> 四蹄腾空聚拢）：
  const HORSE_GEN_JOINTS = [
    [0.352, 0.578,  0.135 * HORSE_TAU, false, true],   // 远侧后腿 (左后)
    [0.635, 0.574, -0.165 * HORSE_TAU, true,  true],   // 远侧前腿 (左前)
    [0.292, 0.584,  0.00,              false, false],  // 近侧后腿 (右后)
    [0.686, 0.576,  0.00,              true,  false],  // 近侧前腿 (右前)
  ];
  const HORSE_CAV_JOINTS = [
    [0.285, 0.540,  0.135 * HORSE_TAU, false, true],   // 远侧后腿
    [0.562, 0.532, -0.165 * HORSE_TAU, true,  true],   // 远侧前腿
    [0.215, 0.546,  0.00,              false, false],  // 近侧后腿
    [0.620, 0.534,  0.00,              true,  false],  // 近侧前腿
  ];

  const SPRITE_RIGS = {
    default_horse:       { kind: 'horse',      legY: 0.700, waistY: 0.48, tailEndX: 0.195, anchorX: 0.48, hasPaintedWeapon: false, joints: HORSE_GEN_JOINTS },
    unit_gen_female:     { kind: 'horse',      legY: 0.700, waistY: 0.48, tailEndX: 0.195, anchorX: 0.48, hasPaintedWeapon: true,  joints: HORSE_GEN_JOINTS },
    unit_gen_silver:     { kind: 'horse',      legY: 0.700, waistY: 0.48, tailEndX: 0.195, anchorX: 0.48, hasPaintedWeapon: true,  joints: HORSE_GEN_JOINTS },
    unit_gen_mage:       { kind: 'horse',      legY: 0.700, waistY: 0.48, tailEndX: 0.195, anchorX: 0.48, hasPaintedWeapon: true,  joints: HORSE_GEN_JOINTS },
    unit_gen_heavy:      { kind: 'horse',      legY: 0.700, waistY: 0.48, tailEndX: 0.195, anchorX: 0.50, hasPaintedWeapon: true,  joints: HORSE_GEN_JOINTS },
    unit_cavalry:        { kind: 'horse',      legY: 0.655, waistY: 0.44, tailEndX: 0.115, anchorX: 0.43, hasPaintedWeapon: true,  joints: HORSE_CAV_JOINTS },
    unit_cavalry_enemy:  { kind: 'horse',      legY: 0.655, waistY: 0.44, tailEndX: 0.115, anchorX: 0.43, hasPaintedWeapon: true,  joints: HORSE_CAV_JOINTS },
    beast_sprite_baihu:  { kind: 'quad_tiger', legY: 0.77, anchorX: 0.50, legs: [[0, 0.335, 0], [0.335, 0.50, 0.72], [0.50, 0.72, 2.55], [0.72, 1.0, 3.27]] },
    beast_sprite_xuanwu: { kind: 'quad_heavy', legY: 0.81, anchorX: 0.50, legs: [[0, 0.28, 0], [0.28, 0.485, Math.PI], [0.485, 0.71, 1.57], [0.71, 1.0, 1.57 + Math.PI]] },
    beast_sprite_qiongqi:{ kind: 'quad_tiger', legY: 0.77, anchorX: 0.50, legs: [[0, 0.335, 0], [0.335, 0.50, 0.72], [0.50, 0.72, 2.55], [0.72, 1.0, 3.27]] },
    beast_sprite_qilin:  { kind: 'quad_tiger', legY: 0.76, anchorX: 0.50, legs: [[0, 0.335, 0], [0.335, 0.50, 0.72], [0.50, 0.72, 2.55], [0.72, 1.0, 3.27]] },
    beast_sprite_baize:  { kind: 'quad_tiger', legY: 0.76, anchorX: 0.50, legs: [[0, 0.335, 0], [0.335, 0.50, 0.72], [0.50, 0.72, 2.55], [0.72, 1.0, 3.27]] },
    beast_sprite_taotie: { kind: 'quad_heavy', legY: 0.79, anchorX: 0.50, legs: [[0, 0.28, 0], [0.28, 0.485, Math.PI], [0.485, 0.71, 1.57], [0.71, 1.0, 1.57 + Math.PI]] },
    beast_sprite_taowu:  { kind: 'quad_heavy', legY: 0.80, anchorX: 0.50, legs: [[0, 0.28, 0], [0.28, 0.485, Math.PI], [0.485, 0.71, 1.57], [0.71, 1.0, 1.57 + Math.PI]] },
    unit_infantry:       { kind: 'biped',      legY: 0.74, waistY: 0.52, armPivot: [0.52, 0.46], armBox: [0.53, 0.16, 1.0, 0.66], anchorX: 0.36, legs: [[0, 0.41, 0], [0.41, 1.0, Math.PI]] },
    unit_infantry_enemy: { kind: 'biped',      legY: 0.74, waistY: 0.52, armPivot: [0.52, 0.46], armBox: [0.53, 0.16, 1.0, 0.66], anchorX: 0.36, legs: [[0, 0.41, 0], [0.41, 1.0, Math.PI]] },
    unit_pikeman:        { kind: 'biped',      legY: 0.76, waistY: 0.54, anchorX: 0.34, legs: [[0, 0.33, 0], [0.33, 0.65, Math.PI]] },
    unit_pikeman_enemy:  { kind: 'biped',      legY: 0.76, waistY: 0.54, anchorX: 0.34, legs: [[0, 0.33, 0], [0.33, 0.65, Math.PI]] },
    unit_archer:         { kind: 'biped',      legY: 0.73, waistY: 0.52, anchorX: 0.40, legs: [[0, 0.45, 0], [0.45, 1.0, Math.PI]] },
    unit_archer_enemy:   { kind: 'biped',      legY: 0.73, waistY: 0.52, anchorX: 0.40, legs: [[0, 0.45, 0], [0.45, 1.0, Math.PI]] },
    unit_mage:           { kind: 'biped',      legY: 0.77, waistY: 0.50, armPivot: [0.49, 0.35], armBox: [0.50, 0.12, 1.0, 0.52], anchorX: 0.32, legs: [[0, 0.36, 0], [0.36, 1.0, Math.PI]] },
    unit_mage_enemy:     { kind: 'biped',      legY: 0.77, waistY: 0.50, armPivot: [0.49, 0.35], armBox: [0.50, 0.12, 1.0, 0.52], anchorX: 0.32, legs: [[0, 0.36, 0], [0.36, 1.0, Math.PI]] },
  };

  /**
   * ★ 四段式武道流体运动学解算器（蓄势引腰 -> 疾鞭爆发 -> 破甲顿帧 -> 卸力回架 + 三连击变招！）
   * 同步解算：马躯俯仰、马首昂扬、骑手独立腰胯前倾/蹬镫立身、披风飞扬、步卒上身猛扑
   */
  function computeAttackPose(u) {
    const p = u.atkProg > 0 ? Math.min(1, u.atkProg) : (u.attackAnim > 0 ? Math.min(1, 1 - u.attackAnim) : 0);
    const style = u.atkStyle || 'cleave';
    const combo = (u.comboStep || 0) % 3;
    const castWave = u.castAnim > 0 ? Math.sin(clamp01(u.castAnim / 0.85) * Math.PI) : 0;
    const pose = {
      active: p > 0.001,
      p,
      style,
      combo,
      lungeX: 0,
      lungeY: -4.5 * castWave,
      bodyPitch: -0.08 * castWave,
      bodySkew: 0,
      riderPitch: -0.16 * castWave,
      riderSurgeX: 0,
      riderRiseY: -3.2 * castWave,
      horseNeckPitch: -0.14 * castWave,
      capeFlare: castWave * 0.85,
      scaleX: 1 + 0.03 * castWave,
      scaleY: 1 + 0.03 * castWave,
      bowPull: 0,
      stringVib: 0,
      fanCharge: 0,
      fanSweepAlpha: 0,
      fanSweepProg: 0,
      meleeSwing: 0,
      strikeFlash: 0,
      afterimage: castWave * 0.45,
      castGlow: castWave,
    };
    if (!pose.active) return pose;

    const whipCurve = (t) => {
      const x = clamp01(t);
      return 1 - Math.pow(1 - x, 4.2);
    };

    if (style === 'bow') {
      const rel = 0.44;
      if (p < rel) {
        const k = smoothstep(0, rel, p);
        pose.bowPull = k;
        pose.lungeX = -3.8 * k;
        pose.bodyPitch = -0.04 * k;
        pose.riderPitch = -0.11 * k;
        pose.riderSurgeX = -2.2 * k;
        pose.horseNeckPitch = -0.06 * k;
        pose.capeFlare = 0.22 * k;
      } else {
        const r = clamp01((p - rel) / (1 - rel));
        const settle = 1 - smoothstep(0, 1, r);
        const recoil = Math.sin(Math.min(1, r * 3.0) * Math.PI);
        pose.bowPull = Math.max(0, 0.12 * (1 - r * 4.0));
        pose.stringVib = Math.sin(r * 44) * 3.2 * settle;
        pose.lungeX = -3.8 * settle - 3.0 * recoil;
        pose.bodyPitch = -0.04 * settle - 0.03 * recoil;
        pose.riderPitch = -0.11 * settle - 0.07 * recoil;
        pose.riderSurgeX = -2.2 * settle - 1.6 * recoil;
        pose.horseNeckPitch = 0.05 * recoil;
        pose.capeFlare = 0.35 * recoil + 0.15 * settle;
        pose.strikeFlash = r < 0.34 ? (1 - r / 0.34) : 0;
      }
    } else if (style === 'fan') {
      const rel = 0.37;
      if (p < rel) {
        const k = smoothstep(0, rel, p);
        pose.fanCharge = k;
        pose.lungeX = -3.5 * k;
        pose.lungeY -= 2.2 * k;
        pose.bodyPitch = -0.04 * k;
        pose.riderPitch = -0.15 * k;
        pose.riderRiseY -= 2.8 * k;
        pose.horseNeckPitch = -0.08 * k;
        pose.capeFlare = 0.35 * k;
      } else if (p < 0.72) {
        const s = whipCurve((p - rel) / 0.35);
        pose.fanCharge = Math.max(0, 1 - s * 2.2);
        pose.fanSweepProg = s;
        pose.fanSweepAlpha = Math.sin(clamp01((p - rel) / 0.35) * Math.PI);
        pose.lungeX = -3.5 + 11.5 * s;
        pose.bodyPitch = -0.04 + 0.10 * s;
        pose.riderPitch = -0.15 + 0.34 * s;
        pose.riderSurgeX = 4.6 * s;
        pose.riderRiseY -= 2.8 * (1 - s);
        pose.horseNeckPitch = -0.08 + 0.16 * s;
        pose.capeFlare = 0.35 + 0.55 * s;
        pose.strikeFlash = s < 0.75 ? (1 - clamp01((p - rel) / 0.28)) : 0;
      } else {
        const r = smoothstep(0.72, 1.0, p);
        pose.lungeX = 8.0 * (1 - r);
        pose.bodyPitch = 0.06 * (1 - r);
        pose.riderPitch = 0.19 * (1 - r);
        pose.riderSurgeX = 4.6 * (1 - r);
        pose.horseNeckPitch = 0.08 * (1 - r);
        pose.capeFlare = 0.90 * (1 - r);
      }
    } else if (style === 'thrust') {
      const rel = 0.30;
      const maxLunge = u.kind === 'general' ? (combo === 2 ? 26 : 23) : (u.isMounted ? 18 : 16);
      if (p < rel) {
        const k = smoothstep(0, rel, p);
        pose.lungeX = -8.0 * k;
        pose.bodyPitch = -0.065 * k;
        pose.bodySkew = -0.045 * k;
        pose.riderPitch = (combo === 1 ? 0.06 : -0.19) * k;
        pose.riderSurgeX = -4.2 * k;
        pose.riderRiseY -= (combo === 2 ? 4.2 : 1.8) * k;
        pose.horseNeckPitch = -0.13 * k;
        pose.capeFlare = 0.30 * k;
        pose.meleeSwing = -k;
      } else if (p < 0.58) {
        const rawT = (p - rel) / 0.28;
        const s = whipCurve(rawT);
        const arc = Math.sin(rawT * Math.PI);
        pose.lungeX = -8.0 + (maxLunge + 8.0) * s;
        pose.lungeY -= arc * (combo === 2 ? 4.2 : 2.2);
        pose.bodyPitch = -0.065 + 0.155 * s;
        pose.bodySkew = -0.045 + 0.145 * s;
        pose.riderPitch = (combo === 1 ? 0.06 : -0.19) + (combo === 1 ? -0.22 : 0.46) * s;
        pose.riderSurgeX = -4.2 + 10.4 * s;
        pose.riderRiseY -= (combo === 2 ? 4.2 * (1 - s * 0.6) : 1.8 * arc);
        pose.horseNeckPitch = -0.13 + 0.25 * s;
        pose.capeFlare = 0.30 + 0.70 * s;
        pose.meleeSwing = -1 + 2 * s;
        pose.strikeFlash = Math.sin(Math.min(1, rawT * 1.15) * Math.PI);
        pose.afterimage = Math.max(pose.afterimage, arc * 0.62);
      } else {
        const r = smoothstep(0.58, 1.0, p);
        pose.lungeX = maxLunge * (1 - r);
        pose.bodyPitch = 0.09 * (1 - r);
        pose.bodySkew = 0.10 * (1 - r);
        pose.riderPitch = (combo === 1 ? -0.16 : 0.27) * (1 - r);
        pose.riderSurgeX = 6.2 * (1 - r);
        pose.horseNeckPitch = 0.12 * (1 - r);
        pose.capeFlare = (1 - r) * 0.85;
        pose.meleeSwing = 1 - r;
        pose.strikeFlash = Math.max(0, (1 - r * 2.6) * 0.42);
      }
    } else if (style === 'sword') {
      const rel = 0.28;
      const maxLunge = 20;
      if (p < rel) {
        const k = smoothstep(0, rel, p);
        pose.lungeX = -6.5 * k;
        pose.bodyPitch = -0.055 * k;
        pose.riderPitch = (combo === 1 ? 0.08 : -0.18) * k;
        pose.riderSurgeX = -3.4 * k;
        pose.riderRiseY -= 2.4 * k;
        pose.horseNeckPitch = -0.10 * k;
        pose.capeFlare = 0.28 * k;
        pose.meleeSwing = -k;
      } else if (p < 0.58) {
        const rawT = (p - rel) / 0.30;
        const s = whipCurve(rawT);
        pose.lungeX = -6.5 + (maxLunge + 6.5) * s;
        pose.bodyPitch = -0.055 + 0.145 * s;
        pose.bodySkew = 0.11 * s;
        pose.riderPitch = (combo === 1 ? 0.08 : -0.18) + (combo === 1 ? -0.26 : 0.42) * s;
        pose.riderSurgeX = -3.4 + 8.8 * s;
        pose.horseNeckPitch = -0.10 + 0.21 * s;
        pose.capeFlare = 0.28 + 0.68 * s;
        pose.meleeSwing = -1 + 2 * s;
        pose.strikeFlash = Math.sin(Math.min(1, rawT * 1.15) * Math.PI);
        pose.afterimage = Math.max(pose.afterimage, Math.sin(rawT * Math.PI) * 0.52);
      } else {
        const r = smoothstep(0.58, 1.0, p);
        pose.lungeX = maxLunge * (1 - r);
        pose.bodyPitch = 0.09 * (1 - r);
        pose.bodySkew = 0.11 * (1 - r);
        pose.riderPitch = (combo === 1 ? -0.18 : 0.24) * (1 - r);
        pose.riderSurgeX = 5.4 * (1 - r);
        pose.horseNeckPitch = 0.11 * (1 - r);
        pose.capeFlare = 0.90 * (1 - r);
        pose.meleeSwing = 1 - r;
        pose.strikeFlash = Math.max(0, (1 - r * 2.5) * 0.38);
      }
    } else if (u.kind === 'beast') {
      const rel = 0.34;
      const bid = u.id || 'baihu';
      const isPouncer = bid === 'baihu' || bid === 'qiongqi' || bid === 'hundun';
      const isSteed = bid === 'qilin' || bid === 'baize';
      const isSoarer = bid === 'zhuque' || bid === 'kunpeng';
      const maxLunge = bid === 'zhulong' ? 38 : (isPouncer ? 34 : (isSteed ? 31 : (bid === 'qinglong' ? 30 : (isSoarer ? 28 : 26))));
      if (p < rel) {
        const k = smoothstep(0, rel, p);
        pose.lungeX = (bid === 'zhulong' ? -14 : -11) * k;
        pose.lungeY -= (bid === 'zhulong' ? 14 : (isSoarer ? 13 : (isSteed ? 5.5 : (bid === 'qinglong' ? 3.2 : -2.5)))) * k;
        pose.bodyPitch = (bid === 'zhulong' ? -0.22 : (isSoarer ? -0.19 : (isSteed ? -0.17 : -0.13))) * k;
        pose.bodySkew = -0.08 * k;
        pose.scaleX = 1 + (isPouncer ? 0.06 : (bid === 'zhulong' ? 0.05 : -0.04)) * k;
        pose.scaleY = 1 + (isPouncer ? -0.09 : (bid === 'zhulong' ? 0.08 : 0.05)) * k;
      } else if (p < 0.68) {
        const s = easeOutCubic((p - rel) / 0.34);
        const arc = Math.sin(s * Math.PI);
        const backX = bid === 'zhulong' ? -14 : -11;
        pose.lungeX = backX + (maxLunge - backX) * s;
        pose.lungeY -= isPouncer
          ? (12.5 * arc - 2.5 * (1 - s))
          : (bid === 'zhulong'
            ? (14 * (1 - s) - 6.0 * s)
            : (isSteed
              ? (10.2 * arc + 2.2 * (1 - s))
              : (isSoarer
                ? (13 * (1 - s) - 5 * s)
                : (bid === 'qinglong'
                  ? (3.2 * (1 - s) + 1.8 * arc)
                  : (-2.5 * (1 - s) + 5.2 * arc)))));
        pose.bodyPitch = (bid === 'zhulong' ? -0.22 : (isSoarer ? -0.19 : (isSteed ? -0.17 : -0.13))) + (bid === 'zhulong' ? 0.42 : (isPouncer ? 0.38 : (isSteed ? 0.35 : 0.33))) * s;
        pose.bodySkew = -0.08 + 0.25 * s;
        pose.scaleX = 1 + (bid === 'zhulong' ? 0.11 : 0.08) * arc;
        pose.scaleY = 1 - 0.05 * arc;
        pose.strikeFlash = Math.sin(s * Math.PI * 0.82);
        pose.afterimage = Math.max(pose.afterimage, arc * (bid === 'zhulong' ? 0.88 : 0.72));
      } else {
        const r = smoothstep(0.68, 1.0, p);
        pose.lungeX = maxLunge * (1 - r);
        pose.bodyPitch = 0.20 * (1 - r);
        pose.bodySkew = 0.17 * (1 - r);
        pose.strikeFlash = Math.max(0, (1 - r * 1.9) * 0.55);
      }
    } else {
      const rel = 0.32;
      const isGen = u.kind === 'general';
      const maxLunge = isGen ? (combo === 2 ? 25 : 22) : 16;
      if (p < rel) {
        const k = smoothstep(0, rel, p);
        pose.lungeX = (isGen ? -9.0 : -6.5) * k;
        pose.lungeY -= (isGen ? (combo === 2 ? 5.2 : 3.2) : 1.6) * k;
        pose.bodyPitch = (isGen ? -0.105 : -0.14) * k;
        pose.bodySkew = -0.055 * k;
        pose.riderPitch = (combo === 1 ? 0.10 : -0.25) * k;
        pose.riderSurgeX = -4.8 * k;
        pose.riderRiseY -= (combo === 2 ? 4.8 : 3.2) * k;
        pose.horseNeckPitch = -0.16 * k;
        pose.capeFlare = 0.42 * k;
        pose.meleeSwing = -1.15 * k;
      } else if (p < 0.62) {
        const rawT = (p - rel) / 0.30;
        const s = whipCurve(rawT);
        const arc = Math.sin(rawT * Math.PI);
        pose.lungeX = (isGen ? -9.0 : -6.5) + (maxLunge + (isGen ? 9.0 : 6.5)) * s;
        pose.lungeY -= (isGen ? (combo === 2 ? 5.2 * (1 - s) + 3.0 * arc : 3.2 * (1 - s) + 2.0 * arc) : 2.6 * arc);
        pose.bodyPitch = (isGen ? -0.105 : -0.14) + (isGen ? 0.22 : 0.34) * s;
        pose.bodySkew = -0.055 + 0.175 * s;
        pose.riderPitch = (combo === 1 ? 0.10 : -0.25) + (combo === 1 ? -0.32 : 0.56) * s;
        pose.riderSurgeX = -4.8 + 11.6 * s;
        pose.riderRiseY -= (combo === 2 ? 4.8 * (1 - s) : 3.2 * (1 - s));
        pose.horseNeckPitch = -0.16 + 0.30 * s;
        pose.capeFlare = 0.42 + 0.65 * s;
        pose.meleeSwing = -1.15 + 2.15 * s;
        pose.strikeFlash = Math.sin(Math.min(1, rawT * 1.15) * Math.PI);
        pose.afterimage = Math.max(pose.afterimage, arc * (isGen ? 0.65 : 0.48));
      } else {
        const r = smoothstep(0.62, 1.0, p);
        pose.lungeX = maxLunge * (1 - r);
        pose.bodyPitch = (isGen ? 0.115 : 0.20) * (1 - r);
        pose.bodySkew = 0.12 * (1 - r);
        pose.riderPitch = (combo === 1 ? -0.22 : 0.31) * (1 - r);
        pose.riderSurgeX = 6.8 * (1 - r);
        pose.horseNeckPitch = 0.14 * (1 - r);
        pose.capeFlare = 0.95 * (1 - r);
        pose.meleeSwing = 1.0 * (1 - r);
        pose.strikeFlash = Math.max(0, (1 - r * 2.3) * 0.48);
      }
    }
    return pose;
  }

  function drawLiveWeaponAuraAndTassel(ctx, spec, wVfx, pose, moveBlend, time, uid, wAng) {
    if (!spec) return;
    const t = time || 0;
    const qTier = spec.qTier || 0;
    const tx = spec.tasselX - spec.gripX;
    const ty = spec.tasselY - spec.gripY;
    const swingVel = pose.active ? (pose.strikeFlash * 0.55) : 0;
    const flutter = Math.sin(t * 8.2 + (uid || 1) * 1.9) * (0.12 + moveBlend * 0.16 + swingVel * 0.22);
    const tasselCol = spec.subModel === 'fan' ? '#b45309' : '#b91c1c';

    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(-wAng * 0.50 + flutter);
    const tg = ctx.createLinearGradient(0, 0, -5.5, 6.8);
    tg.addColorStop(0, shadeHex(tasselCol, 0.18));
    tg.addColorStop(0.65, tasselCol);
    tg.addColorStop(1, shadeHex(tasselCol, -0.35));
    ctx.beginPath();
    ctx.moveTo(0, -0.5);
    ctx.quadraticCurveTo(-3.4, 3.0, -6.2 - moveBlend * 2.2, 5.8);
    ctx.quadraticCurveTo(-3.6, 7.0, -1.5, 6.2);
    ctx.quadraticCurveTo(-0.2, 3.4, 1.0, 0.4);
    ctx.closePath();
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = CONTOUR_METAL;
    ctx.lineWidth = 0.58;
    ctx.stroke();
    ctx.restore();

    if (qTier >= 3 || wVfx) {
      const bladeStart = spec.w * 0.66 - spec.gripX;
      const bladeEnd = spec.w - spec.gripX - 2;
      const bladeLen = Math.max(10, bladeEnd - bladeStart);
      const col = (wVfx && wVfx.color) || spec.acc || '#facc15';

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sheenCycle = ((t * 0.78 + (uid || 1) * 0.31) % 1.8);
      if (sheenCycle < 1.0) {
        const gx = bladeStart + sheenCycle * bladeLen;
        const rg = ctx.createRadialGradient(gx, 0, 0.3, gx, 0, 4.8);
        rg.addColorStop(0, 'rgba(255,255,255,0.72)');
        rg.addColorStop(0.5, hexAlpha(col, 0.32));
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(gx, 0, 4.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ★ 写实双骨骼屈肘甲胄手臂 + 三国神兵连招渲染器（上臂札甲 -> 精钢护肘屈伸 -> 筒袖护腕小臂 -> 握拳扣杆）
  function drawGeneralArmAndWeapon(ctx, u, pose, wTpl, wVfx, pal, time) {
    const style = u.atkStyle || 'thrust';
    const combo = pose.combo || 0;
    const p = pose.active ? pose.p : 0;
    const innateW = (!wTpl && u.cfg && u.cfg.innateWeapon) ? u.cfg.innateWeapon : null;
    const wKind = u.weaponKind || (innateW && innateW.weaponKind) || (style === 'bow' ? 'bow' : (style === 'fan' ? 'fan' : (style === 'sword' ? 'sword' : (style === 'cleave' ? 'guandao' : 'spear'))));
    const enhLv = u.equips && u.equips.weapon ? (u.equips.weapon.enhance || 0) : 0;
    const accentCol = wVfx
      ? wVfx.color
      : ((wTpl && (wTpl.glowColor || wTpl.bladeColor)) ? (wTpl.glowColor || wTpl.bladeColor) : (innateW ? innateW.accentColor : null));
    const bladeCol = wVfx ? wVfx.bladeColor : (wTpl ? wTpl.bladeColor : (innateW ? innateW.bladeColor : null));
    const mb = clamp01(u.moveBlend != null ? u.moveBlend : (u.moving ? 1 : 0));
    const runPh = u.runPhase || 0;
    const handSkin = '#dca57c';
    const trimCol = pal.armorTrim || pal.trim || '#cfa04c';
    const armMid = pal.armMid || '#64748b';
    const armHi = pal.armHi || '#94a3b8';
    const armDark = pal.armDark || '#334155';

    // 奔跑颠簸时手臂肘部随四拍飞驰一周期一缓冲，沉稳协调
    const gallopBobY = !pose.active ? (Math.sin(runPh - 0.5) * 0.85 - 0.35) * mb : 0;
    const gallopSurgeX = !pose.active ? Math.sin(runPh + 0.6) * 0.55 * mb : 0;
    const gallopTilt = !pose.active ? (0.038 * mb + Math.sin(runPh + 0.4) * 0.026 * mb) : 0;

    const drawArmSegment = (x0, y0, x1, y1, r0, r1, isUpper, darken) => {
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dy / len, ny = -dx / len;
      const mx = (x0 + x1) * 0.5, my = (y0 + y1) * 0.5;
      const cDark = darken ? shadeHex(armDark, -0.25) : armDark;
      const cMid = darken ? shadeHex(armMid, -0.22) : armMid;
      const cHi = darken ? armMid : armHi;

      const ag = ctx.createLinearGradient(mx - nx * r0, my - ny * r0, mx + nx * r0, my + ny * r0);
      ag.addColorStop(0, cDark);
      ag.addColorStop(0.52, cMid);
      ag.addColorStop(1, cHi);

      ctx.beginPath();
      ctx.moveTo(x0 + nx * r0, y0 + ny * r0);
      ctx.quadraticCurveTo(mx + nx * ((r0 + r1) * 0.54), my + ny * ((r0 + r1) * 0.54), x1 + nx * r1, y1 + ny * r1);
      ctx.arc(x1, y1, r1, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
      ctx.quadraticCurveTo(mx - nx * ((r0 + r1) * 0.52), my - ny * ((r0 + r1) * 0.52), x0 - nx * r0, y0 - ny * r0);
      ctx.arc(x0, y0, r0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
      ctx.closePath();
      ctx.fillStyle = ag;
      ctx.fill();
      ctx.strokeStyle = CONTOUR_METAL;
      ctx.lineWidth = 0.76;
      ctx.stroke();

      // 护腕/吞袖甲片金边细节
      if (!isUpper && len > 2.5) {
        const cx = x0 + dx * 0.74, cy = y0 + dy * 0.74;
        ctx.strokeStyle = trimCol;
        ctx.lineWidth = 0.85;
        ctx.beginPath();
        ctx.moveTo(cx - nx * (r1 * 1.05), cy - ny * (r1 * 1.05));
        ctx.lineTo(cx + nx * (r1 * 1.05), cy + ny * (r1 * 1.05));
        ctx.stroke();
      }
    };

    const drawShoulderAndUpperArm = (shX, shY, elX, elY, darken) => {
      drawArmSegment(shX, shY, elX, elY, 2.55, 2.05, true, darken);
      if (!darken) {
        // 紧贴原画肩吞下缘的袖甲叠片（不遮挡原画高耸兽吞肩甲，完美遮掩肩轴旋转接缝）
        const ang = Math.atan2(elY - shY, elX - shX) - Math.PI * 0.5;
        ctx.save();
        ctx.translate(shX, shY);
        ctx.rotate(ang * 0.45);
        ctx.beginPath();
        ctx.moveTo(-2.7, -1.2);
        ctx.quadraticCurveTo(0, -2.2, 2.7, -1.0);
        ctx.lineTo(2.4, 1.5);
        ctx.quadraticCurveTo(0, 2.3, -2.4, 1.5);
        ctx.closePath();
        ctx.fillStyle = armMid;
        ctx.fill();
        ctx.strokeStyle = trimCol;
        ctx.lineWidth = 0.78;
        ctx.stroke();
        ctx.restore();
      }
    };

    const drawElbowAndForearm = (elX, elY, hndX, hndY, gripAngle, darken) => {
      drawArmSegment(elX, elY, hndX, hndY, 2.08, 1.58, false, darken);
      // 精钢护肘甲叶（清晰呈现手臂弯曲折角！）
      ctx.save();
      ctx.beginPath();
      ctx.arc(elX, elY, 1.85, 0, Math.PI * 2);
      ctx.fillStyle = darken ? shadeHex(armMid, -0.15) : armHi;
      ctx.fill();
      ctx.strokeStyle = trimCol;
      ctx.lineWidth = 0.78;
      ctx.stroke();
      ctx.restore();

      // 握拳指节压扣紧握枪杆/刀柄
      ctx.save();
      ctx.translate(hndX, hndY);
      ctx.rotate(gripAngle || 0);
      ctx.beginPath();
      ctx.ellipse(0.1, -0.2, 2.05, 1.72, 0, 0, Math.PI * 2);
      ctx.fillStyle = darken ? shadeHex(handSkin, -0.18) : handSkin;
      ctx.fill();
      ctx.strokeStyle = CONTOUR_DARK;
      ctx.lineWidth = 0.75;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(-0.4, -0.3, 1.45, Math.PI * 0.62, Math.PI * 1.62);
      ctx.strokeStyle = trimCol;
      ctx.lineWidth = 0.82;
      ctx.stroke();
      ctx.restore();
    };

    const drawCurvedSlashRibbon = (cx0, cy0, radius, startA, endA, ccw, mainCol, coreCol, alpha) => {
      if (alpha <= 0.04) return;
      ctx.save();
      ctx.translate(cx0, cy0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = clamp01(alpha * 0.82);
      ctx.fillStyle = mainCol;
      ctx.beginPath();
      ctx.arc(0, 0, radius, startA, endA, ccw);
      ctx.arc(-3.8, 0.4, radius * 0.78, endA, startA, !ccw);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = coreCol || '#ffffff';
      ctx.globalAlpha = clamp01(alpha * 0.90);
      ctx.beginPath();
      ctx.arc(1.0, 0, radius * 0.96, startA + (ccw ? -0.10 : 0.10), endA + (ccw ? 0.06 : -0.06), ccw);
      ctx.arc(-1.4, 0, radius * 0.87, endA + (ccw ? 0.06 : -0.06), startA + (ccw ? -0.10 : 0.10), !ccw);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // 1. 弓弩系名将：前手撑弓 + 后手大幅屈肘满月拉弦！
    if (style === 'bow') {
      const isCrossbow = wKind === 'crossbow';
      const pull = pose.active ? pose.bowPull : 0;
      const vib = pose.stringVib || 0;
      const qTier = wTpl ? (wTpl.quality === 'gold' ? 3 : (wTpl.quality === 'purple' ? 2 : 1)) : (innateW ? 2 : 0);
      const limbCol = qTier >= 3 ? '#9a4d18' : '#6b3a19';
      const bowTrim = qTier >= 2 ? '#eab308' : '#b4833e';

      if (isCrossbow) {
        const kick = (pose.active && p >= 0.44 && p < 0.72) ? Math.sin(((p - 0.44) / 0.28) * Math.PI) * 4.2 : 0;
        const cbX = 12.2 - kick + gallopSurgeX * 0.6;
        const cbY = -43.8 + (pose.active ? -1.0 : 0.4) + gallopBobY;
        const shX = -1.6, shY = -48.6;
        const elX = -4.2 - kick * 0.6, elY = -42.4 + gallopBobY * 0.7;

        drawShoulderAndUpperArm(3.2, -48.2, 8.2 - kick * 0.5, -44.2, true);
        drawElbowAndForearm(8.2 - kick * 0.5, -44.2, cbX + 4.5, cbY + 1.0, 0, true);
        drawShoulderAndUpperArm(shX, shY, elX, elY, false);

        ctx.save();
        ctx.translate(cbX, cbY);
        ctx.fillStyle = '#3b1a08';
        ctx.strokeStyle = CONTOUR_METAL;
        ctx.lineWidth = 0.80;
        ctx.beginPath();
        ctx.rect(-7.5, -1.7, 20, 3.4);
        ctx.fill(); ctx.stroke();

        const cBend = pull * 2.8;
        ctx.strokeStyle = '#e7e5e4';
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.moveTo(11.0 - cBend, -9.2);
        ctx.lineTo(3 - pull * 6.5 + vib * 0.45, 0);
        ctx.lineTo(11.0 - cBend, 9.2);
        ctx.stroke();

        ctx.strokeStyle = limbCol;
        ctx.lineWidth = 2.1;
        ctx.beginPath();
        ctx.moveTo(11.0 - cBend, -9.2);
        ctx.quadraticCurveTo(15.5, 0, 11.0 - cBend, 9.2);
        ctx.stroke();

        if (!pose.active || p < 0.44) {
          ctx.strokeStyle = '#d6b88c';
          ctx.lineWidth = 1.25;
          ctx.beginPath(); ctx.moveTo(1 - pull * 5.5, -0.4); ctx.lineTo(17.5, -0.4); ctx.stroke();
          ctx.fillStyle = '#e2e8f0';
          ctx.beginPath(); ctx.moveTo(21, -0.4); ctx.lineTo(16.5, -2.1); ctx.lineTo(16.5, 1.3); ctx.closePath(); ctx.fill();
        }
        ctx.restore();

        drawElbowAndForearm(elX, elY, cbX - 3.5, cbY + 1.2, -0.08, false);
        return;
      }

      const bowX = 14.6 + pull * 2.4 + gallopSurgeX * 0.5;
      const bowY = -44.6 + (pose.active ? -1.0 : 0.6) + gallopBobY;
      const bend = pull * 5.2;
      const bowR = 14.8;
      const topTipX = bowX - 4.0 - bend * 0.65;
      const topTipY = bowY - bowR + bend * 0.20;
      const botTipX = bowX - 4.0 - bend * 0.65;
      const botTipY = bowY + bowR - bend * 0.20;
      const nockX = bowX - 3.6 - pull * 13.5 + vib * 0.75;
      const nockY = bowY;

      // 远侧前撑弓臂（微屈稳控弓把）
      const fShX = 3.4, fShY = -48.2;
      const fElX = 8.8 + pull * 1.1, fElY = -45.6 + gallopBobY * 0.6;
      drawShoulderAndUpperArm(fShX, fShY, fElX, fElY, true);
      drawElbowAndForearm(fElX, fElY, bowX + 0.2, bowY + 0.3, -0.05, true);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#e7e5e4';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(topTipX, topTipY);
      ctx.lineTo(nockX, nockY);
      ctx.lineTo(botTipX, botTipY);
      ctx.stroke();

      [[-1, topTipX, topTipY], [1, botTipX, botTipY]].forEach(([sgn, tx, ty]) => {
        const lg = ctx.createLinearGradient(bowX, bowY, tx, ty);
        lg.addColorStop(0, bowTrim);
        lg.addColorStop(0.5, limbCol);
        lg.addColorStop(1, bowTrim);
        ctx.beginPath();
        ctx.moveTo(bowX + 1.3, bowY + sgn * 1.4);
        ctx.bezierCurveTo(bowX + 6.4, bowY + sgn * 6.6, bowX + 3.4, bowY + sgn * 12.0, tx, ty);
        ctx.bezierCurveTo(bowX + 1.2, bowY + sgn * 10.8, bowX + 3.0, bowY + sgn * 5.8, bowX - 1.0, bowY + sgn * 1.4);
        ctx.closePath();
        ctx.fillStyle = lg; ctx.fill();
        ctx.strokeStyle = CONTOUR_METAL; ctx.lineWidth = 0.78; ctx.stroke();
      });

      if (!pose.active || p < 0.44) {
        const tipX = nockX + 23;
        ctx.strokeStyle = CONTOUR_METAL; ctx.lineWidth = 1.85;
        ctx.beginPath(); ctx.moveTo(nockX, nockY); ctx.lineTo(tipX, nockY); ctx.stroke();
        ctx.strokeStyle = '#d6b88c'; ctx.lineWidth = 1.05;
        ctx.beginPath(); ctx.moveTo(nockX, nockY); ctx.lineTo(tipX, nockY); ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tipX + 5.4, nockY);
        ctx.lineTo(tipX - 0.6, nockY - 2.2);
        ctx.lineTo(tipX + 0.6, nockY);
        ctx.lineTo(tipX - 0.6, nockY + 2.2);
        ctx.closePath();
        ctx.fillStyle = '#e2e8f0'; ctx.fill();
        ctx.strokeStyle = CONTOUR_METAL; ctx.lineWidth = 0.72; ctx.stroke();
      }
      ctx.restore();

      // 近侧拉弦右臂：随拉弓大幅向后上方抬肘屈臂，撒放瞬间猛然回弹！
      const rShX = -1.8, rShY = -48.6;
      const releaseKick = (pose.active && p >= 0.44) ? Math.sin(clamp01((p - 0.44) / 0.35) * Math.PI) : 0;
      const rHndX = pose.active
        ? (p < 0.44 ? nockX : (-4.8 - releaseKick * 3.2) * (1 - smoothstep(0.55, 1.0, p)) + 4.5 * smoothstep(0.55, 1.0, p))
        : (6.2 + gallopSurgeX * 0.5);
      const rHndY = pose.active
        ? (p < 0.44 ? nockY : -45.2 - releaseKick * 1.6)
        : (-43.2 + gallopBobY);
      const rElX = pose.active
        ? (-3.8 - pull * 7.4 - releaseKick * 2.5) * (1 - smoothstep(0.60, 1.0, p)) - 3.6 * smoothstep(0.60, 1.0, p)
        : (-3.8 + gallopSurgeX * 0.3);
      const rElY = pose.active
        ? (-44.0 - pull * 6.2 - releaseKick * 1.8) * (1 - smoothstep(0.60, 1.0, p)) - 42.4 * smoothstep(0.60, 1.0, p)
        : (-42.4 + gallopBobY * 0.8);
      drawShoulderAndUpperArm(rShX, rShY, rElX, rElY, false);
      drawElbowAndForearm(rElX, rElY, rHndX, rHndY, Math.atan2(rHndY - rElY, rHndX - rElX), false);
      return;
    }

    // 2. 羽扇 / 谋士长杖：高抬屈肘引风 -> 挥臂洒扇破阵！
    if (style === 'fan') {
      const isStaffW = wKind === 'staff';
      const idleBase = isStaffW ? -0.42 : -0.92;
      const idleWave = Math.sin((time || 0) * 3.1 + (u.uid || 1)) * 0.07 + gallopTilt;
      const shX = -1.8, shY = -48.6;
      let elX = -4.2 + gallopSurgeX * 0.4, elY = -42.5 + gallopBobY * 0.8;
      let hndX = (isStaffW ? 3.6 : 4.2) + gallopSurgeX, hndY = (isStaffW ? -42.5 : -46.8) + gallopBobY;
      let fAng = idleBase + idleWave;

      if (pose.active) {
        if (p < 0.37) {
          const k = smoothstep(0, 0.37, p);
          fAng = idleBase - 1.05 * k;
          elX = -4.2 - 1.8 * k;
          elY = -42.5 - 9.2 * k;
          hndX = (isStaffW ? 3.6 : 4.2) - 4.8 * k;
          hndY = (isStaffW ? -42.5 : -46.8) - 8.4 * k;
        } else if (p < 0.72) {
          const s = 1 - Math.pow(1 - clamp01((p - 0.37) / 0.35), 3.8);
          fAng = (idleBase - 1.05) + 1.82 * s;
          elX = -6.0 + 11.8 * s;
          elY = -51.7 + 6.2 * s;
          hndX = (isStaffW ? -1.2 : -0.6) + 13.6 * s;
          hndY = (isStaffW ? -50.9 : -55.2) + 12.6 * s;
        } else {
          const r = smoothstep(0.72, 1.0, p);
          fAng = (idleBase + 0.77) * (1 - r) + idleBase * r;
          elX = 5.8 * (1 - r) - 4.2 * r;
          elY = -45.5 * (1 - r) - 42.5 * r;
          hndX = 12.6 * (1 - r) + (isStaffW ? 3.6 : 4.2) * r;
          hndY = -42.6 * (1 - r) + (isStaffW ? -42.5 : -46.8) * r;
        }
      } else if (pose.castGlow > 0.05) {
        const cg = pose.castGlow;
        fAng = idleBase - 0.95 * cg;
        elX -= 1.6 * cg;
        elY -= 7.5 * cg;
        hndY -= 7.0 * cg;
      }

      drawShoulderAndUpperArm(shX, shY, elX, elY, false);
      const spec = getStudioWeaponSpec(wKind === 'staff' ? 'staff' : 'fan', accentCol || '#38bdf8', bladeCol, wTpl, u.id, enhLv);
      if (spec) {
        ctx.save();
        ctx.translate(hndX, hndY);
        ctx.rotate(fAng);
        ctx.drawImage(spec.canvas, -spec.gripX, -spec.gripY, spec.w, spec.h);
        drawLiveWeaponAuraAndTassel(ctx, spec, wVfx, pose, mb, time, u.uid, fAng);
        ctx.restore();
      }
      drawElbowAndForearm(elX, elY, hndX, hndY, fAng, false);

      if (pose.fanSweepAlpha > 0.06) {
        const sp = pose.fanSweepProg || 0.5;
        drawCurvedSlashRibbon(14, -44, 34 * (0.85 + sp * 0.25), -1.25 + sp * 0.25, -0.10 + sp * 1.20, false, accentCol || '#38bdf8', '#ffffff', pose.fanSweepAlpha * 0.65);
      }
      return;
    }

    // 3. 长枪 / 蛇矛 / 大槊：向后大幅收肘蓄力 -> 全臂崩直疾刺破空！
    if (style === 'thrust') {
      const idleSway = Math.sin((time || 0) * 2.9 + (u.uid || 1)) * 0.028 + gallopTilt;
      const baseAng = -0.14 + idleSway;
      const shX = -1.8, shY = -48.6;
      let elX = -4.6 + gallopSurgeX * 0.4, elY = -42.0 + gallopBobY * 0.8;
      let hndX = 2.6 + gallopSurgeX, hndY = -41.4 + gallopBobY;
      let shift = 0;
      let ang = baseAng;

      if (pose.active) {
        const rel = 0.30, hitEnd = 0.58;
        if (p < rel) {
          // 引枪蓄势：肘部深拉至腰后上方，枪锋微昂蓄满寸劲！
          const k = smoothstep(0, rel, p);
          shift = -17.5 * k;
          ang = combo === 1 ? (baseAng + 0.28 * k) : (combo === 2 ? (baseAng - 0.34 * k) : (baseAng - 0.18 * k));
          elX = -4.6 - 7.2 * k;
          elY = -42.0 - 5.2 * k;
          hndX = 2.6 - 10.6 * k;
          hndY = -41.4 + (combo === 2 ? -2.4 : 1.6) * k;
        } else if (p < hitEnd) {
          // 疾鞭崩刺：上臂与小臂瞬间向前崩直伸展，枪尖暴刺而出！
          const rawT = (p - rel) / (hitEnd - rel);
          const s = 1 - Math.pow(1 - clamp01(rawT), 4.0);
          shift = -17.5 + (combo === 2 ? 46.5 : 43.5) * s;
          if (combo === 1) ang = (baseAng + 0.28) - 0.48 * s;
          else if (combo === 2) ang = (baseAng - 0.34) + 0.40 * s;
          else ang = (baseAng - 0.18) + 0.20 * s;

          elX = -11.8 + 19.2 * s;
          elY = -47.2 + 1.4 * s;
          hndX = -8.0 + 23.2 * s;
          hndY = -39.8 + (combo === 1 ? -4.6 * s : -3.4 * s);
        } else {
          // 收枪回架：手肘重新柔和弯曲回到戒备架势
          const r = smoothstep(hitEnd, 1.0, p);
          const endAng = combo === 1 ? (baseAng - 0.20) : (combo === 2 ? (baseAng + 0.06) : (baseAng + 0.02));
          shift = (combo === 2 ? 29.0 : 26.0) * (1 - r);
          ang = endAng * (1 - r) + baseAng * r;
          elX = 7.4 * (1 - r) - 4.6 * r;
          elY = -45.8 * (1 - r) - 42.0 * r;
          hndX = 15.2 * (1 - r) + 2.6 * r;
          hndY = -43.2 * (1 - r) - 41.4 * r;
        }
      }

      drawShoulderAndUpperArm(shX, shY, elX, elY, false);

      const spec = getStudioWeaponSpec('spear', accentCol, bladeCol, wTpl, u.id, enhLv);
      if (spec) {
        const weaponOriginX = hndX + Math.cos(ang) * (shift * 0.46);
        const weaponOriginY = hndY + Math.sin(ang) * (shift * 0.46);
        ctx.save();
        ctx.translate(weaponOriginX, weaponOriginY);
        ctx.rotate(ang);
        ctx.drawImage(spec.canvas, -spec.gripX, -spec.gripY, spec.w, spec.h);
        drawLiveWeaponAuraAndTassel(ctx, spec, wVfx, pose, mb, time, u.uid, ang);

        if (pose.active && pose.strikeFlash > 0.06) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = clamp01(pose.strikeFlash * 0.76);
          const tipStart = spec.w - spec.gripX - 16;
          const burstCol = accentCol || '#38bdf8';
          const lg = ctx.createLinearGradient(tipStart - 16, 0, tipStart + 28, 0);
          lg.addColorStop(0, 'rgba(0,0,0,0)');
          lg.addColorStop(0.42, burstCol);
          lg.addColorStop(1, '#ffffff');
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.moveTo(tipStart - 16, -4.6);
          ctx.lineTo(tipStart + 28, 0);
          ctx.lineTo(tipStart - 16, 4.6);
          ctx.closePath();
          ctx.fill();

          // 破空螺旋枪风气环
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.ellipse(tipStart - 2, 0, 2.6, 8.2, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      drawElbowAndForearm(elX, elY, hndX, hndY, ang, false);
      return;
    }

    // 4. 青龙偃月刀 / 方天画戟 / 开山巨斧 / 名剑：高举屈肘过顶 -> 150°雷霆挥臂劈斩 + 反手横扫！
    const isSword = style === 'sword' || wKind === 'sword';
    const idleBreathe = Math.sin((time || 0) * 2.8 + (u.uid || 1)) * 0.03 + gallopTilt;
    const idleAng = isSword ? (-0.28 + idleBreathe) : (-0.56 + idleBreathe);
    const relP = isSword ? 0.28 : 0.32;
    const endP = isSword ? 0.58 : 0.62;

    const shX = -1.8, shY = -48.6;
    let elX = -4.4 + gallopSurgeX * 0.4, elY = -42.2 + gallopBobY * 0.8;
    let hndX = (isSword ? 3.4 : 2.6) + gallopSurgeX;
    let hndY = -41.5 + gallopBobY;
    let wAng = idleAng;

    if (pose.active) {
      let windAng, strikeAng;
      let windElX, windElY, windHdX, windHdY;
      let hitElX, hitElY, hitHdX, hitHdY;
      if (combo === 1) {
        // 第二式：屈肘收胸反手横扫千军！
        windAng = isSword ? 0.82 : 0.74;
        strikeAng = isSword ? -1.26 : -1.18;
        windElX = 1.6; windElY = -41.6; windHdX = -4.6; windHdY = -39.2;
        hitElX = 6.8;  hitElY = -46.8;  hitHdX = 14.2; hitHdY = -44.5;
      } else if (combo === 2) {
        // 第三式：双手高举过顶蓄力重劈！
        windAng = isSword ? -1.96 : -1.92;
        strikeAng = isSword ? 0.58 : 0.64;
        windElX = -5.8; windElY = -55.4; windHdX = -0.8; windHdY = -58.8;
        hitElX = 6.8;   hitElY = -45.2;  hitHdX = 13.8;  hitHdY = -38.6;
      } else {
        // 第一式：扬肘斜劈斩马刀！
        windAng = isSword ? -1.72 : -1.76;
        strikeAng = isSword ? 0.46 : 0.52;
        windElX = -5.4; windElY = -53.6; windHdX = -0.4; windHdY = -56.4;
        hitElX = 6.5;   hitElY = -45.6;  hitHdX = 13.4;  hitHdY = -39.4;
      }

      if (p < relP) {
        const k = smoothstep(0, relP, p);
        wAng = idleAng + (windAng - idleAng) * k;
        elX = -4.4 + (windElX + 4.4) * k;
        elY = -42.2 + (windElY + 42.2) * k;
        hndX = (isSword ? 3.4 : 2.6) + (windHdX - (isSword ? 3.4 : 2.6)) * k;
        hndY = -41.5 + (windHdY + 41.5) * k;
      } else if (p < endP) {
        const rawT = (p - relP) / (endP - relP);
        const s = 1 - Math.pow(1 - clamp01(rawT), 3.8);
        wAng = windAng + (strikeAng - windAng) * s;
        elX = windElX + (hitElX - windElX) * s;
        elY = windElY + (hitElY - windElY) * s;
        hndX = windHdX + (hitHdX - windHdX) * s;
        hndY = windHdY + (hitHdY - windHdY) * s;
      } else {
        const r = smoothstep(endP, 1.0, p);
        wAng = strikeAng * (1 - r) + idleAng * r;
        elX = hitElX * (1 - r) - 4.4 * r;
        elY = hitElY * (1 - r) - 42.2 * r;
        hndX = hitHdX * (1 - r) + (isSword ? 3.4 : 2.6) * r;
        hndY = hitHdY * (1 - r) - 41.5 * r;
      }
    }

    drawShoulderAndUpperArm(shX, shY, elX, elY, false);

    const spec = getStudioWeaponSpec(isSword ? 'sword' : wKind, accentCol, bladeCol, wTpl, u.id, enhLv);
    if (spec) {
      ctx.save();
      ctx.translate(hndX, hndY);
      ctx.rotate(wAng);
      ctx.drawImage(spec.canvas, -spec.gripX, -spec.gripY, spec.w, spec.h);
      drawLiveWeaponAuraAndTassel(ctx, spec, wVfx, pose, mb, time, u.uid, wAng);
      ctx.restore();
    }

    drawElbowAndForearm(elX, elY, hndX, hndY, wAng, false);

    if (pose.active && pose.strikeFlash > 0.06) {
      const slashCol = accentCol || (isSword ? '#93c5fd' : '#f59e0b');
      const slashCore = (wVfx && wVfx.coreColor) || '#fef9c3';
      const r = isSword ? 35 : 43;
      if (combo === 1) {
        drawCurvedSlashRibbon(15, -43, r, 0.85, -1.12, true, slashCol, slashCore, pose.strikeFlash * 0.72);
      } else {
        drawCurvedSlashRibbon(15, -44, r, -1.32, 0.88, false, slashCol, slashCore, pose.strikeFlash * 0.76);
      }
    }
  }

  // ★ 净身骑乘网格连续脊柱变形 + 奔跑时后臀与前胸随大腿同步发力律动（彻底消除马腿根部静止感！）
  function drawSeamlessMountedMesh(ctx, srcImg, leftX, baseTopY, w, h, waistRy, _tailEndX, moveBlend, runPhase, _uid, spineDx, spineDy) {
    const iw = srcImg.naturalWidth || srcImg.width || 64;
    const ih = srcImg.naturalHeight || srcImg.height || 64;
    ctx.save();

    const syMid = Math.max(2, Math.min(ih - 4, Math.round(ih * waistRy)));
    const midRatio = syMid / ih;
    const dstMidY = baseTopY + h * midRatio;
    const dstBotH = h * (1 - midRatio);

    // 1. 马背鞍具、战靴马镫、马尾与前胸甲整体无缝绘制（绝不切分竖向接缝！）
    ctx.drawImage(
      srcImg,
      0, syMid - 1, iw, ih - syMid + 1,
      leftX, dstMidY - 0.7, w, dstBotH + 0.7
    );

    // 2. 骑手腰背、披风与头颈上半部（0 .. waistRy）：8 段连续仿射切片随招式俯仰发力
    const bands = 8;
    for (let b = 0; b < bands; b++) {
      const sy0 = Math.floor((syMid * b) / bands);
      const sy1 = b === bands - 1 ? syMid : Math.floor((syMid * (b + 1)) / bands);
      const sh = sy1 - sy0;
      if (sh <= 0) continue;
      const r0 = sy0 / ih;
      const r1 = sy1 / ih;
      const x0 = spineDx(r0);
      const x1 = spineDx(r1);
      const y0 = baseTopY + r0 * h + spineDy(r0);
      const y1 = baseTopY + r1 * h + spineDy(r1);
      const actH = Math.max(0.5, y1 - y0);
      const shearX = (x1 - x0) / actH;
      const padSrc = sy0 > 0 ? 1 : 0;
      const padDst = padSrc ? (h / ih) * 0.95 : 0;

      ctx.save();
      ctx.translate(leftX + x0 - shearX * padDst, y0 - padDst);
      ctx.transform(1, 0, shearX, 1, 0, 0);
      ctx.drawImage(
        srcImg,
        0, sy0 - padSrc, iw, sh + padSrc,
        0, 0, w, actH + padDst + 0.35
      );
      ctx.restore();
    }
    ctx.restore();
  }

  /**
   * ★ 写实真马三关节屈蹄疾驰骑将 / 猛虎纵跃 / 玄武重踏 / 精悍独立挥臂步卒骨骼渲染器
   */
  function drawArticulatedSprite(ctx, img, w, h, moving, runPhase, hitFlash, opts) {
    if (!img) return { topY: -h + 8 };
    const o = opts || {};
    const spriteKey = o.spriteKey || '';
    const rig = SPRITE_RIGS[spriteKey] || (o.isMounted
      ? SPRITE_RIGS.default_horse
      : SPRITE_RIGS.unit_infantry);
    const pose = o.pose || { bodyPitch: 0, bodySkew: 0, scaleX: 1, scaleY: 1, lungeY: 0, afterimage: 0 };
    const time = o.time || 0;
    const uid = o.uid || 1;
    const idlePhase = o.idlePhase != null ? o.idlePhase : uid * 1.9;
    const moveBlend = o.moveBlend != null ? clamp01(o.moveBlend) : (moving ? 1 : 0);
    const recoil = clamp01(o.hitRecoil || (hitFlash > 0 ? hitFlash * 4.5 : 0));
    const inCombat = !!o.inCombat;

    const iw = img.naturalWidth || img.width || 64;
    const ih = img.naturalHeight || img.height || 64;
    const anchorX = rig.anchorX != null ? rig.anchorX : 0.5;
    const leftX = -w * anchorX;
    const footSink = rig.kind === 'biped' ? 4 : 5;
    const baseTopY = -h + footSink;

    const isHorse = rig.kind === 'horse';
    const isTiger = rig.kind === 'quad_tiger';
    const isHeavyQuad = rig.kind === 'quad_heavy';
    const isQuad = isHorse || isTiger || isHeavyQuad;
    const breath = Math.sin(time * (inCombat ? 3.8 : 2.5) + idlePhase);
    const combatSway = (inCombat && moveBlend < 0.3 && !pose.active)
      ? Math.sin(time * 4.2 + idlePhase * 1.3) * (1 - moveBlend)
      : 0;

    const gaitSin = Math.sin(runPhase);
    const gaitCos = Math.cos(runPhase);
    let moveBobY = 0;
    let moveSurgeX = 0;
    let movePitch = 0;
    let moveSkew = 0;

    if (isHorse) {
      // 对角双拍对称微幅弹性起伏（左右迈步完全对称，马身平稳沉着不颠簸）
      moveBobY = (-0.40 - Math.abs(gaitSin) * 0.85) * moveBlend;
      moveSurgeX = Math.sin(runPhase * 2) * 0.45 * moveBlend;
      movePitch = Math.cos(runPhase * 2) * 0.014 * moveBlend;
      moveSkew = Math.sin(runPhase * 2) * 0.008 * moveBlend;
    } else if (isTiger) {
      moveBobY = -Math.max(-0.4, gaitSin) * 3.4 * moveBlend;
      moveSurgeX = gaitCos * 2.2 * moveBlend;
      movePitch = Math.sin(runPhase - 0.55) * 0.072 * moveBlend;
      moveSkew = gaitSin * 0.042 * moveBlend;
    } else if (isHeavyQuad) {
      moveBobY = -Math.abs(gaitSin) * 1.9 * moveBlend;
      moveSurgeX = gaitCos * 1.1 * moveBlend;
      movePitch = gaitSin * 0.028 * moveBlend;
      moveSkew = gaitCos * 0.022 * moveBlend;
    } else {
      moveBobY = -Math.abs(gaitSin) * 2.6 * moveBlend;
      moveSurgeX = gaitCos * 1.55 * moveBlend;
      movePitch = (0.048 + gaitCos * 0.032) * moveBlend;
      moveSkew = gaitSin * 0.032 * moveBlend;
    }

    const bodyBobY = moveBobY + (1 - moveBlend) * breath * 0.45;
    const bodySurgeX = moveSurgeX + combatSway * 0.75;
    const bodyPitch = movePitch + combatSway * 0.014 + (pose.bodyPitch || 0) - recoil * 0.095;
    const bodySkew = moveSkew + combatSway * 0.010 + (pose.bodySkew || 0) - recoil * 0.065;

    const breathScaleX = 1 - (1 - moveBlend) * breath * 0.006;
    const breathScaleY = 1 + (1 - moveBlend) * breath * 0.010;
    const sx = (pose.scaleX || 1) * breathScaleX * (1 - recoil * 0.04);
    const sy = (pose.scaleY || 1) * breathScaleY * (1 + recoil * 0.03);

    if (isHorse) {
      const isGen = !!((o.unitRef && o.unitRef.kind === 'general') || String(spriteKey).startsWith('battle_gen_'));
      const pal = resolveHorsePalette(spriteKey, o.unitRef && o.unitRef.id, o.mountTpl, o.battleSpec, o.armorTpl, img);
      const cleanBody = getCleanHorseBodyCanvas(spriteKey, img);
      const rigScale = w / 92;
      const waistRy = rig.waistY || 0.48;
      const tailEndX = rig.tailEndX || 0;
      // 关键：只要单位停下交战（!moving 或正在出招 pose.active），战马四蹄立即100%稳踏地面静止，仅马背上的武将拧腰屈肘挥刀突刺！
      const horseMove = (moving && !pose.active) ? moveBlend : 0;

      const gallopBody = horseMove > 0.001
        ? evalPeriodicSpline(BODY_GALLOP_KEYS, runPhase, _gallopSample)
        : null;
      const gBob = gallopBody ? gallopBody[0] : 0;
      const gPitch = gallopBody ? gallopBody[1] : 0;
      const gSurge = gallopBody ? gallopBody[2] : 0;

      const rawLean = (
        (pose.riderPitch || 0) * 24
        + (pose.riderSurgeX || 0) * 0.75
        + (pose.lungeX || 0) * 0.36
        + combatSway * 0.55
        + horseMove * 1.55
        + gPitch * 16 * horseMove
        + breath * 0.25 * (1 - horseMove)
        - recoil * 3.2
      );
      const riderLean = Math.max(-8.5, Math.min(11.5, rawLean)) * rigScale;
      const riderLift = (
        (pose.riderRiseY || 0) * 0.55
        + gBob * 0.22 * horseMove
      ) * rigScale;

      const spineDx = (ry) => {
        if (ry >= waistRy) return 0;
        const u0 = (waistRy - ry) / waistRy;
        return riderLean * u0 * (0.56 + 0.44 * u0);
      };
      const spineDy = (ry) => {
        if (ry >= waistRy) return 0;
        const u0 = (waistRy - ry) / waistRy;
        return riderLift * u0;
      };
      const spineRot = (ry) => {
        if (ry >= waistRy) return 0;
        const u0 = (waistRy - ry) / waistRy;
        return Math.atan2(riderLean * (0.56 + 0.88 * u0), waistRy * h) * 0.72;
      };

      const horseSurgeX = gSurge * rigScale * horseMove - recoil * 1.6;
      const horseBobY = gBob * rigScale * horseMove;
      const horsePitch = gPitch * horseMove;
      const horsePivotY = -h * 0.34;

      ctx.save();

      if (pose.afterimage > 0.22 && hitFlash <= 0 && isGen) {
        ctx.save();
        ctx.globalAlpha = pose.afterimage * 0.20;
        ctx.translate(horseSurgeX - 6, horseBobY);
        ctx.drawImage(cleanBody, leftX, baseTopY, w, h);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(horseSurgeX, horseBobY + horsePivotY);
      ctx.rotate(horsePitch);
      ctx.translate(0, -horsePivotY);

      // 1. 绘制战马四肢（奔跑时大腿主导带动小腿；停下攻击时 horseMove=0 四蹄稳扎地面纹丝不动！）
      const joints = rig.joints || HORSE_GEN_JOINTS;
      for (let i = 0; i < joints.length; i++) {
        const jd = joints[i];
        const jx = leftX + w * jd[0];
        const jy = baseTopY + h * jd[1];
        drawEquineMuscularLeg(
          ctx, jx, jy, jd[3], jd[4],
          runPhase + jd[2], horseMove, pal, rigScale
        );
      }

      // 2. 绘制马躯、马甲、战靴马镫与骑手发力脊柱
      drawSeamlessMountedMesh(
        ctx, cleanBody, leftX, baseTopY, w, h,
        waistRy, tailEndX, horseMove, runPhase, uid, spineDx, spineDy
      );

      // 3. 名将穿戴头盔时：头顶雉翎/红缨随冲锋与挥招飘逸摆动（不遮挡面容原画）
      if (isGen && o.helmTpl) {
        const plumeCol = o.helmTpl.helmPlume || (o.helmTpl.quality === 'gold' ? '#ef4444' : '#dc2626');
        const hx = leftX + w * 0.455 + spineDx(0.16);
        const hy = baseTopY + h * 0.165 + spineDy(0.16);
        const pWave = Math.sin(time * 7.5 + uid) * (1.8 + moveBlend * 2.8) + (pose.capeFlare || 0) * 4.5;
        ctx.save();
        ctx.strokeStyle = plumeCol;
        ctx.lineWidth = 1.65 * rigScale;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.quadraticCurveTo(hx - 8 * rigScale, hy - 5 * rigScale - pWave * 0.35, hx - (16 + moveBlend * 4) * rigScale, hy + 1.5 * rigScale + pWave * 0.45);
        ctx.stroke();
        ctx.restore();
      }

      // 4. 名将独立骑乘素体：双骨骼屈肘甲胄右臂 + 写实比例神兵全套连招挥舞！
      const useStudioWeapon = isGen && !rig.hasPaintedWeapon;
      if (useStudioWeapon && o.unitRef) {
        ctx.save();
        ctx.translate(spineDx(0.40), spineDy(0.40));
        ctx.translate(-1.8 * rigScale, -48.6 * rigScale);
        ctx.rotate(spineRot(0.40) * 0.55);
        ctx.translate(1.8 * rigScale, 48.6 * rigScale);
        ctx.scale(rigScale, rigScale);
        drawGeneralArmAndWeapon(ctx, o.unitRef, pose, o.wTpl, o.wVfx, pal, time);
        ctx.restore();
      }

      if (hitFlash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        ctx.drawImage(cleanBody, leftX, baseTopY, w, h);
        ctx.restore();
      }

      ctx.restore();
      ctx.restore();
      return { topY: baseTopY, usedStudioRig: useStudioWeapon };
    }

    const sySplit = Math.max(1, Math.min(ih - 2, Math.round(ih * rig.legY)));
    const dhTop = h * (sySplit / ih);
    const dhLeg = h - dhTop;
    const splitDstY = baseTopY + dhTop;

    ctx.save();

    ctx.translate(bodySurgeX - recoil * 2.4, bodyBobY + (pose.lungeY || 0));
    ctx.rotate(bodyPitch);
    ctx.transform(sx, 0, bodySkew, sy, 0, 0);

    // 步卒双腿真正前后交叉换步（消除原地八字螃蟹步！后腿前跨越过中轴线、前腿后蹬交换位置，支撑腿在下、抬膝迈步腿在上）
    const legSrcTotal = ih - sySplit;
    const bands = isQuad ? 3 : 2;
    const legOrder = (!isQuad && rig.legs.length === 2 && Math.sin(runPhase) > 0)
      ? [1, 0]
      : rig.legs.map((_, idx) => idx);

    legOrder.forEach((legIdx) => {
      const legDef = rig.legs[legIdx];
      const rx0 = legDef[0], rx1 = legDef[1], phOff = legDef[2];
      const sx0 = Math.round(iw * rx0);
      const sx1 = Math.round(iw * rx1);
      const sw = sx1 - sx0;
      if (sw <= 0 || legSrcTotal <= 0) return;

      const dx0 = leftX + w * rx0;
      const dw = w * (rx1 - rx0);
      const isFrontLeg = isQuad ? (rx0 >= 0.35) : (legIdx === 1);

      const ph = runPhase + phOff;
      const atkBrace = pose.active ? ((pose.bodySkew || 0) * (isFrontLeg ? 2.15 : -2.25)) : 0;
      const stride = Math.sin(ph) * moveBlend + atkBrace;
      const kneeLift = Math.max(0, Math.cos(ph)) * moveBlend;

      // 步卒前后双腿交叉位移量：swap 从 0->1 时后腿真正跨到前侧、前腿退到后侧，彻底告别横移螃蟹步！
      const swap = !isQuad ? ((0.5 - 0.5 * Math.cos(runPhase)) * moveBlend) : 0;
      const bipedLift = !isQuad
        ? (legIdx === 0 ? Math.max(0, Math.sin(runPhase)) : Math.max(0, -Math.sin(runPhase))) * moveBlend
        : 0;
      const crossSpan = w * (spriteKey.startsWith('unit_archer') ? 0.24 : 0.16);
      const crossDx = !isQuad ? ((legIdx === 0 ? 1 : -1) * swap * crossSpan) : 0;

      let curX = crossDx;
      let curY = splitDstY - bipedLift * 1.5;

      for (let b = 0; b < bands; b++) {
        const r0 = b / bands;
        const r1 = (b + 1) / bands;
        const bSy0 = sySplit + Math.floor(legSrcTotal * r0);
        const bSy1 = b === bands - 1 ? ih : (sySplit + Math.floor(legSrcTotal * r1));
        const bSh = bSy1 - bSy0;
        if (bSh <= 0) continue;
        const bDh = dhLeg * ((bSy1 - bSy0) / legSrcTotal);

        let bandShear = 0;
        let bandSy = 1;
        if (isTiger) {
          if (b === 0) { bandShear = (stride * 0.52 + kneeLift * 0.18) * 1.18; bandSy = 1 - kneeLift * 0.10; }
          else if (b === 1) { bandShear = (stride * 0.46 + kneeLift * 0.04) * 1.18; bandSy = 1 - kneeLift * 0.14; }
          else { bandShear = (stride * 0.38 - kneeLift * 0.40) * 1.18; bandSy = 1 - kneeLift * 0.16; }
        } else if (isHeavyQuad) {
          if (b === 0) { bandShear = stride * 0.34; bandSy = 1 - kneeLift * 0.10; }
          else if (b === 1) { bandShear = stride * 0.30; bandSy = 1 - kneeLift * 0.13; }
          else { bandShear = stride * 0.24 - kneeLift * 0.14; bandSy = 1 - kneeLift * 0.12; }
        } else {
          // 步卒前后换步：swap 驱动前后腿对调角度，bipedLift 驱动前迈腿高抬大腿、向后折小腿跨步！
          const swapDir = (legIdx === 0 ? 1 : -1) * swap;
          if (b === 0) {
            bandShear = swapDir * 0.46 + bipedLift * 0.28 + atkBrace * 0.65;
            bandSy = 1 - bipedLift * 0.14;
          } else {
            bandShear = swapDir * 0.32 - bipedLift * 0.52 + atkBrace * 0.45;
            bandSy = 1 - bipedLift * 0.18;
          }
        }

        const padSrc = bSy0 > 0 ? 1 : 0;
        const padDst = padSrc ? 0.75 : 0;
        ctx.save();
        ctx.translate(curX, curY);
        ctx.transform(1, 0, bandShear, bandSy, 0, 0);
        ctx.drawImage(
          img,
          sx0, bSy0 - padSrc, sw, bSh + padSrc,
          dx0, -padDst, dw, bDh + padDst
        );
        ctx.restore();

        curX += bandShear * bDh;
        curY += bandSy * bDh;
      }

      if (isTiger && moveBlend > 0.55 && kneeLift > 0.55 && (legIdx === 0 || legIdx === 3)) {
        ctx.save();
        ctx.globalAlpha = (kneeLift - 0.55) * 0.55 * moveBlend;
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 1.3;
        const hx = dx0 + dw * 0.5 + curX;
        ctx.beginPath();
        ctx.arc(hx - 4, curY - 2, 6, Math.PI * 0.15, Math.PI * 0.88);
        ctx.stroke();
        ctx.restore();
      }
    });

    if (!isQuad && rig.waistY) {
      const syWaist = Math.max(1, Math.min(sySplit - 2, Math.round(ih * rig.waistY)));
      const dhUpper = h * (syWaist / ih);
      const dhMid = dhTop - dhUpper;
      const waistDstY = baseTopY + dhUpper;
      const isInfantry = spriteKey.startsWith('unit_infantry');
      const isMage = spriteKey.startsWith('unit_mage');
      const isArcher = spriteKey.startsWith('unit_archer');
      const isPikeman = spriteKey.startsWith('unit_pikeman');

      const fanSwing = pose.fanSweepAlpha > 0 ? (-0.8 + 1.6 * (pose.fanSweepProg || 0)) : (-0.85 * (pose.fanCharge || 0));
      const swingAmt = pose.active
        ? (pose.style === 'fan' ? fanSwing : (pose.meleeSwing || (pose.bowPull ? -pose.bowPull * 0.75 : 0)))
        : (combatSway * 0.22 + Math.sin(runPhase) * 0.16 * moveBlend);
      const upperRot = swingAmt * (isPikeman ? 0.16 : 0.22);
      const upperReachX = pose.active && pose.style === 'thrust'
        ? (swingAmt < 0 ? swingAmt * 4.5 : swingAmt * 9.8)
        : (isArcher && pose.active ? -pose.bowPull * 2.6 : swingAmt * 3.8);
      const bowChestExpand = (isArcher && pose.active) ? (1 + pose.bowPull * 0.085) : 1;

      // 腰胯甲裙段（waistY .. legY）
      ctx.drawImage(
        img,
        0, syWaist, iw, Math.min(ih - syWaist, sySplit - syWaist + 2),
        leftX, waistDstY - 0.8, w, dhMid + 1.6
      );

      // 胸甲与独立挥臂兵刃段
      ctx.save();
      ctx.translate(upperReachX, waistDstY);
      ctx.rotate(upperRot);
      ctx.scale(bowChestExpand, 1);
      ctx.translate(0, -waistDstY);

      if (isInfantry || isMage) {
        // 刀盾兵持刀前臂 / 方士持杖右臂：袖口处预留3px关节叠合余量，旋转挥砍/扬杖时100%无缝无缺口！
        const traceArmPoly = () => {
          ctx.beginPath();
          if (isInfantry) {
            ctx.moveTo(leftX + w * 0.505, baseTopY + h * 0.38);
            ctx.lineTo(leftX + w * 0.584, baseTopY + h * 0.33);
            ctx.lineTo(leftX + w * 0.588, baseTopY + h * 0.12);
            ctx.lineTo(leftX + w * 1.02, baseTopY + h * 0.12);
            ctx.lineTo(leftX + w * 1.02, baseTopY + h * 0.65);
            ctx.lineTo(leftX + w * 0.505, baseTopY + h * 0.60);
          } else {
            ctx.moveTo(leftX + w * 0.455, baseTopY + h * 0.26);
            ctx.lineTo(leftX + w * 1.02, baseTopY + h * 0.08);
            ctx.lineTo(leftX + w * 1.02, baseTopY + h * 0.46);
            ctx.lineTo(leftX + w * 0.485, baseTopY + h * 0.46);
          }
          ctx.closePath();
        };

        // 1) 躯干与盾牌（仅挖去袖口外侧独立挥舞区，保留肘肩袖口内侧基底防止旋转露白！）
        ctx.save();
        ctx.beginPath();
        ctx.rect(leftX - 4, baseTopY - 4, w + 8, h + 8);
        if (isInfantry) {
          ctx.moveTo(leftX + w * 0.575, baseTopY + h * 0.35);
          ctx.lineTo(leftX + w * 0.575, baseTopY + h * 0.61);
          ctx.lineTo(leftX + w * 1.02, baseTopY + h * 0.65);
          ctx.lineTo(leftX + w * 1.02, baseTopY + h * 0.12);
          ctx.lineTo(leftX + w * 0.59, baseTopY + h * 0.12);
          ctx.lineTo(leftX + w * 0.586, baseTopY + h * 0.33);
        } else {
          ctx.moveTo(leftX + w * 0.525, baseTopY + h * 0.25);
          ctx.lineTo(leftX + w * 0.535, baseTopY + h * 0.46);
          ctx.lineTo(leftX + w * 1.02, baseTopY + h * 0.46);
          ctx.lineTo(leftX + w * 1.02, baseTopY + h * 0.08);
        }
        ctx.closePath();
        ctx.clip('evenodd');
        ctx.drawImage(
          img,
          0, 0, iw, Math.min(ih, syWaist + 3),
          leftX, baseTopY, w, dhUpper + 2.0
        );
        ctx.restore();

        // 2) 独立屈肘挥舞的持刀小臂 / 扬杖施法臂！
        const pvx = leftX + w * (isInfantry ? 0.535 : 0.485);
        const pvy = baseTopY + h * (isInfantry ? 0.465 : 0.355);
        const armSwingAng = pose.active
          ? (isInfantry ? swingAmt * 0.62 : swingAmt * 0.48)
          : (Math.sin(runPhase + Math.PI) * 0.22 * moveBlend + combatSway * 0.12);
        ctx.save();
        ctx.translate(pvx, pvy);
        ctx.rotate(armSwingAng);
        ctx.translate(-pvx, -pvy);
        traceArmPoly();
        ctx.clip();
        ctx.drawImage(
          img,
          0, 0, iw, Math.min(ih, Math.round(ih * 0.68)),
          leftX, baseTopY, w, h * 0.68
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          img,
          0, 0, iw, Math.min(ih, syWaist + 2),
          leftX, baseTopY, w, dhUpper + 1.4
        );
      }
      ctx.restore();
    } else {
      ctx.drawImage(
        img,
        0, 0, iw, Math.min(ih, sySplit + 1),
        leftX, baseTopY, w, dhTop + (dhTop / sySplit)
      );
    }
    if (hitFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.50;
      ctx.drawImage(
        img,
        0, 0, iw, Math.min(ih, sySplit + 1),
        leftX, baseTopY, w, dhTop + (dhTop / sySplit)
      );
      ctx.restore();
    }

    ctx.restore();

    return { topY: baseTopY, usedStudioRig: false };
  }

  // ★ 小兵弓手满月拉弦动态弦影与羽箭激射辅助层（严丝合缝对齐新写实弓兵大弓！）
  function drawBowActionOverlay(ctx, u, pose, wVfx, isGeneral) {
    if (isGeneral || !pose.active) return;
    const bx = 13.5, by = -38.5, bowR = 14.5;
    const pull = pose.bowPull * 12.5;
    const vib = pose.stringVib || 0;
    const nockX = -2.5 - pull + vib;
    ctx.save();
    ctx.translate(bx, by);
    ctx.strokeStyle = 'rgba(254, 249, 195, 0.92)';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(-1, -bowR);
    ctx.lineTo(nockX, 0);
    ctx.lineTo(-1, bowR);
    ctx.stroke();
    if (pose.p < 0.46) {
      const tipX = nockX + 20;
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 1.65;
      ctx.beginPath(); ctx.moveTo(nockX, 0); ctx.lineTo(tipX, 0); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(tipX + 5.2, 0); ctx.lineTo(tipX - 1, -2.8); ctx.lineTo(tipX - 1, 2.8);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawFanActionOverlay(ctx, u, pose, wVfx, isGeneral) {
    if (isGeneral || (!pose.active && !pose.castGlow)) return;
    const isEnemy = u.side === 'enemy';
    const mainCol = isEnemy ? '#fb7185' : '#38bdf8';
    if (pose.fanCharge > 0.08) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pose.fanCharge * 0.55;
      ctx.strokeStyle = mainCol;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(32, -41, 4.5 + pose.fanCharge * 4.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (pose.fanSweepAlpha > 0.06) {
      const sp = pose.fanSweepProg || 0.5;
      ctx.save();
      ctx.translate(16, -38);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = pose.fanSweepAlpha * 0.68;
      ctx.fillStyle = mainCol;
      const r = 27 * (0.85 + sp * 0.25);
      ctx.beginPath();
      ctx.arc(0, 0, r, -1.15 + sp * 0.3, -0.20 + sp * 1.25, false);
      ctx.arc(-4, 0, r * 0.76, -0.20 + sp * 1.25, -1.15 + sp * 0.3, true);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawMeleeActionOverlay(ctx, u, pose, wTpl, wVfx, isGeneral) {
    if (isGeneral || !pose.active || pose.strikeFlash <= 0.06) return;
    const style = u.atkStyle || 'cleave';
    const isFootSoldier = !isGeneral && !u.isMounted;
    const handX = isFootSoldier ? (style === 'thrust' ? 11 : 11) : 13;
    const handY = isFootSoldier ? (style === 'thrust' ? -33 : -31) : -46;
    const thrustAng = style === 'thrust' ? (isFootSoldier ? -0.34 : -0.28) : 0;

    ctx.save();
    ctx.globalAlpha = Math.min(0.75, pose.strikeFlash * 0.82);
    const glowCol = wVfx
      ? wVfx.color
      : (wTpl ? (wTpl.glowColor || '#fde047') : (u.side === 'player' ? (style === 'thrust' ? '#38bdf8' : '#fbbf24') : '#f87171'));
    const edgeCol = wVfx ? (wVfx.coreColor || '#fef08a') : (u.side === 'player' ? '#fef08a' : '#fecaca');
    const wMult = wVfx ? Math.min(1.32, wVfx.scaleMult || 1.15) : 1.0;

    if (style === 'thrust') {
      // 螺旋破风龙枪锥 + 双层音爆气环 + 神兵元素丝带
      const len = (isGeneral ? 66 : (u.isMounted ? 50 : 44)) * wMult;
      ctx.translate(handX + 4, handY);
      ctx.rotate(thrustAng);

      const lg = ctx.createLinearGradient(-8, 0, len + 8, 0);
      lg.addColorStop(0, 'rgba(0,0,0,0)');
      lg.addColorStop(0.35, glowCol);
      lg.addColorStop(1, '#ffffff');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.moveTo(-8, -(isGeneral ? 6.5 * wMult : 4.8));
      ctx.lineTo(len + 6, 0);
      ctx.lineTo(-8, isGeneral ? 6.5 * wMult : 4.8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -(isGeneral ? 2.8 : 1.9));
      ctx.lineTo(len + 11, 0);
      ctx.lineTo(0, isGeneral ? 2.8 : 1.9);
      ctx.closePath();
      ctx.fill();

      // 螺旋缠绕枪风丝带（奔雷枪呈锯齿雷电，其余呈螺旋龙气）
      ctx.strokeStyle = edgeCol;
      ctx.lineWidth = isGeneral ? (wVfx ? 2.2 : 1.8) : 1.4;
      ctx.beginPath();
      const isThunder = wVfx && wVfx.atkVfx === 'thunder_arc';
      for (let s = 0; s <= 12; s++) {
        const t = s / 12;
        const px = t * len * 0.88;
        const py = isThunder
          ? ((s % 2 === 0 ? 1 : -1) * 7.5 * (1 - t * 0.4))
          : (Math.sin(t * Math.PI * 3 - pose.p * 18) * (isGeneral ? 8.5 * wMult : 5.5) * (1 - t * 0.55));
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(len * 0.34, 0, 3.8, isGeneral ? 12.5 * wMult : 8.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (isGeneral) {
        ctx.beginPath();
        ctx.ellipse(len * 0.62, 0, 2.8, 8.0 * wMult, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      // 霸道流光弯月刀罡（神兵元素外焰 + 双重刃芒 + 飞散寒星/火羽）
      const r = (isGeneral ? 46 : 30) * wMult;
      ctx.translate(handX, handY);

      if (isFootSoldier) {
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(8, 2, 12, -0.85, 0.85);
        ctx.stroke();
      }

      ctx.fillStyle = glowCol;
      ctx.beginPath();
      ctx.arc(0, 0, r, -1.26, 1.08, false);
      ctx.arc(-8 * wMult, 1, r * 0.72, 1.08, -1.26, true);
      ctx.closePath();
      ctx.fill();

      // 泣血修罗斩 / 翠岚疾风刃 额外叠一层交错副刃弧
      if (wVfx && (wVfx.atkVfx === 'blood_crescent' || wVfx.atkVfx === 'jade_wind')) {
        ctx.strokeStyle = glowCol;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(4, 0, r * 1.08, -1.05, 0.92);
        ctx.stroke();
      }

      ctx.fillStyle = edgeCol;
      ctx.beginPath();
      ctx.arc(1.2, 0, r * 0.96, -1.02, 0.90, false);
      ctx.arc(-4.5, 0.5, r * 0.81, 0.90, -1.02, true);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(2.2, 0, r * 0.93, -0.76, 0.68, false);
      ctx.arc(-2, 0, r * 0.86, 0.68, -0.76, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 1. 温润护眼横版古风沙场背景地图（随章节地域、地形与秘境副本自动切换8幅原画，后台亦可单独配置！）
  function drawBattlefieldTerrain(ctx, battle, viewX, viewW, time, hudCollector) {
    const ch = battle.chapter || 1;
    const theme = battle.chapterTheme || (App.Config.getChapterMapTheme ? App.Config.getChapterMapTheme(ch) : null);
    const bgKey = battle.battleBgKey || (App.Config.resolveBattleBgKey ? App.Config.resolveBattleBgKey(battle) : ((theme && theme.battleKey) || 'bg_battle'));
    const customImg = App.Assets.get(bgKey);
    const bgImg = customImg || App.Assets.get('bg_battle_grassland') || App.Assets.get('bg_battle');
    const tileW = 960;
    const tileH = 425;

    if (bgImg) {
      ctx.save();
      if (theme && theme.flipX) {
        ctx.save();
        ctx.translate(tileW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(bgImg, 0, 0, tileW, tileH);
        ctx.restore();
        ctx.drawImage(bgImg, tileW, 0, tileW, tileH);
      } else {
        ctx.drawImage(bgImg, 0, 0, tileW, tileH);
        ctx.save();
        ctx.translate(tileW * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(bgImg, 0, 0, tileW, tileH);
        ctx.restore();
      }
      if (theme && theme.tint && battle.mode === 'city') {
        ctx.fillStyle = theme.tint;
        ctx.fillRect(viewX, 0, viewW, tileH);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#8b9968';
      ctx.fillRect(viewX, 0, viewW, tileH);
    }

    if ((battle.biome === 'snow' || bgKey === 'bg_battle_snow') && !battle.activeDisaster) {
      ctx.save();
      if (bgKey !== 'bg_battle_snow' || !customImg) {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
        ctx.fillRect(viewX, 0, viewW, tileH);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      for (let i = 0; i < 18; i++) {
        const sx = viewX + ((i * 89 + time * 45) % viewW);
        const sy = (i * 53 + time * 55) % 390;
        ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    if (!battle.noTroops) {
      const wTick = battle.woodTick || 10;
      const fTick = battle.foodTick || 10;
      drawBuildingSprite(ctx, 'building_lumber', 36, 188, 66, `伐木营 +${wTick}/2s`, '#fde047', null, viewX, viewW, hudCollector);
      drawBuildingSprite(ctx, 'building_granary', 36, 360, 68, `军粮仓 +${fTick}/2s`, '#86efac', null, viewX, viewW, hudCollector);
    }

    const node = battle.centerNode;
    if (node) {
      const isPlayer = node.owner === 'player';
      drawBuildingSprite(
        ctx, 'building_goldmine', node.x, node.y + 12, 92,
        isPlayer ? '★已占中军矿(+12木粮/2s)' : '中军辎重矿(推进占领)',
        isPlayer ? '#4ade80' : '#fef08a',
        isPlayer ? '#22c55e' : null,
        viewX, viewW, hudCollector
      );
    }

    // 地面预警圈
    (battle.aoeZones || []).forEach((z) => {
      if (z.isVisualBurst) return;
      ctx.save();
      const pulse = 1 - z.timer / z.maxTimer;
      ctx.strokeStyle = z.color || '#ef4444';
      ctx.fillStyle = z.fill || 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.radius, z.radius * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.radius * pulse, z.radius * 0.42 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      if (z.label) {
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(z.label, z.x, z.y - 6);
        ctx.fillStyle = '#fef08a';
        ctx.fillText(z.label, z.x, z.y - 6);
      }
      ctx.restore();
    });
  }

  function drawBuildingSprite(ctx, key, x, y, w, label, txtCol, ringCol, viewX, viewW, hudCollector) {
    const spr = App.Assets.get(key);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(x, y + 4, w * 0.44, 11, 0, 0, Math.PI * 2); ctx.fill();
    if (ringCol) {
      ctx.strokeStyle = ringCol;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    if (spr) {
      const h = (spr.height / spr.width) * w;
      ctx.drawImage(spr, x - w / 2, y - h + 8, w, h);

      // 统一推入顶层 HUD 铭牌层绘制（彻底杜绝主营拉绳、战马或兵卒遮挡伐木营/军粮仓文字！）
      const inView = viewW == null || (x + w * 0.48 > viewX && x - w * 0.48 < viewX + viewW);
      if (label && inView) {
        if (hudCollector) {
          hudCollector.push({
            kind: 'building_tag',
            uid: key === 'building_lumber' ? -101 : (key === 'building_granary' ? -102 : -103),
            x,
            anchorY: Math.max(78, y - h + 10),
            label,
            labelColor: txtCol,
            borderColor: ringCol || 'rgba(212, 163, 75, 0.55)',
          });
        } else {
          ctx.font = 'bold 10px "PingFang SC", sans-serif';
          const tw = ctx.measureText(label).width;
          const pw = tw + 12;
          const ph = 16;
          let lx = x;
          if (viewW != null) {
            lx = Math.max(viewX + pw / 2 + 6, Math.min(viewX + viewW - pw / 2 - 6, x));
          }
          const ly = Math.max(82, y - h + 12);
          App.UI.roundRect(ctx, lx - pw / 2, ly - ph / 2, pw, ph, 8);
          ctx.fillStyle = 'rgba(15, 8, 4, 0.78)';
          ctx.fill();
          ctx.strokeStyle = ringCol || 'rgba(212, 163, 75, 0.45)';
          ctx.lineWidth = 1;
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = txtCol;
          ctx.fillText(label, lx, ly + 0.5);
        }
      }
    }
    ctx.restore();
  }

  function drawWatchTower(ctx, t, hudCollector) {
    const x = t.x, y = t.y;
    const isPlayer = t.side === 'player';
    const spr = App.Assets.get('tower_sprite');
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = isPlayer ? 'rgba(34, 197, 94, 0.22)' : 'rgba(220, 38, 38, 0.24)';
    ctx.beginPath(); ctx.ellipse(0, 6, 36, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = isPlayer ? 'rgba(74, 222, 128, 0.65)' : 'rgba(248, 113, 113, 0.65)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    let h = 110;
    if (spr) {
      const w = 88;
      h = (spr.height / spr.width) * w;
      ctx.save();
      if (isPlayer) ctx.scale(-1, 1); // 我方箭垒木梯朝向己方大营后侧，射台朝前御敌
      ctx.drawImage(spr, -w / 2, -h + 10, w, h);
      if (t.hitFlash > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.50;
        ctx.drawImage(spr, -w / 2, -h + 10, w, h);
      }
      ctx.restore();
    }
    ctx.restore();

    const anchorY = y - h + 8;
    const towerLabel = `${t.name || (isPlayer ? '我方箭垒' : '敌军箭垒')} ${Math.ceil(t.hp)}`;
    if (hudCollector) {
      hudCollector.push({
        kind: 'prop',
        uid: t.uid,
        x,
        anchorY,
        label: towerLabel,
        labelColor: isPlayer ? '#bbf7d0' : '#fecaca',
        barColor: isPlayer ? '#22c55e' : '#ef4444',
        borderColor: isPlayer ? 'rgba(74, 222, 128, 0.55)' : 'rgba(248, 113, 113, 0.55)',
        hpRatio: t.hp / t.maxHp,
      });
    } else {
      App.UI.drawBar(ctx, x - 27, anchorY - 8, 54, 6.5, t.hp / t.maxHp, isPlayer ? '#22c55e' : '#ef4444');
    }
  }

  function drawMountedGeneral(ctx, u, time, hudCollector) {
    const facing = u.facing || (u.side === 'player' ? 1 : -1);
    const eq = u.equips || {};
    const rawKey = u.spriteKey || 'unit_gen_silver';
    const primarySpr = App.Assets.get(rawKey);
    const fbKey = u.fallbackSpriteKey || 'unit_gen_silver';
    const spr = primarySpr || App.Assets.get(fbKey) || App.Assets.get('unit_gen_silver');
    const sprKey = primarySpr ? rawKey : fbKey;
    const bSpec = primarySpr ? (u.battleSpec || (u.cfg && u.cfg.battleSpec) || null) : null;
    const pose = computeAttackPose(u);
    const style = u.atkStyle || 'cleave';
    const unitScale = u.scale || 1;

    const wTpl = eq.weapon ? App.Config.EQUIP_TEMPLATES[eq.weapon.tplId] : null;
    const mTpl = eq.mount ? App.Config.EQUIP_TEMPLATES[eq.mount.tplId] : null;
    const aTpl = eq.armor ? App.Config.EQUIP_TEMPLATES[eq.armor.tplId] : null;
    const hTpl = eq.helm ? App.Config.EQUIP_TEMPLATES[eq.helm.tplId] : null;
    const jTpl = eq.jade ? App.Config.EQUIP_TEMPLATES[eq.jade.tplId] : null;
    const bTpl = eq.book ? App.Config.EQUIP_TEMPLATES[eq.book.tplId] : null;
    const eqItems = Object.values(eq);
    const wVfx = u.weaponVfx || (eq.weapon && App.Config.resolveWeaponVfx ? App.Config.resolveWeaponVfx(eq.weapon) : null);
    const setVfx = u.setVfx || (eqItems.length >= 2 && App.Config.resolveSetVfx ? App.Config.resolveSetVfx(eqItems) : null);
    const genMounted = u.isMounted !== false;

    const mb = (u.moving && !(genMounted && u.atkProg > 0)) ? (u.moveBlend != null ? u.moveBlend : 1) : 0;
    const shadowScale = 1 - Math.abs(Math.sin(u.runPhase)) * 0.06 * mb;
    // 骑将停步交战挥砍时战马稳踏原地不前后溜冰平移，发力前探全部由马背上的武将腰胯与手臂完成！
    const worldX = u.x + (genMounted ? 0 : pose.lungeX * facing) + (u.knockX || 0);

    ctx.save();
    ctx.translate(worldX, u.y);
    if (unitScale !== 1) ctx.scale(unitScale, unitScale);

    // 脚底阵营圈 + 套装共鸣法阵 + 坐骑/宝玉光效
    ctx.save();
    ctx.fillStyle = u.side === 'player' ? 'rgba(34, 197, 94, 0.26)' : 'rgba(239, 68, 68, 0.28)';
    ctx.beginPath(); ctx.ellipse(0, 5, 29 * shadowScale, 9.5 * shadowScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = u.side === 'player' ? '#4ade80' : '#f87171';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (setVfx && setVfx.vfxTier > 0) {
      drawBattleSetAuraGround(ctx, setVfx, 40, time || 0);
    }
    if (jTpl || bTpl) {
      // 即使已激活套装大阵，宝玉与兵书亦叠绘内圈细腻灵韵细环，互不遮蔽！
      ctx.save();
      ctx.strokeStyle = (jTpl && jTpl.auraRing) || (bTpl && bTpl.auraRing) || '#fde047';
      ctx.globalAlpha = (setVfx && setVfx.vfxTier > 0) ? 0.42 : 0.68;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 5, (setVfx && setVfx.vfxTier > 0) ? 33 : 38, (setVfx && setVfx.vfxTier > 0) ? 10.8 : 12.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (mTpl) {
      const mCol = mTpl.mountTrail || '#f97316';
      ctx.strokeStyle = mCol;
      ctx.globalAlpha = 0.48;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(0, 5, 24 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2); ctx.stroke();
      // 战马真实奔跑冲锋时蹄后带起对应名驹蹄焰/飞尘
      if (mb > 0.30) {
        const nSparks = mTpl.quality === 'gold' ? 3 : 2;
        for (let i = 0; i < nSparks; i++) {
          const px = -facing * (15 + i * 8.5) + Math.sin((time || 0) * 12 + i) * 2.5;
          ctx.fillStyle = i === 0 && mTpl.quality === 'gold' ? '#fef08a' : mCol;
          ctx.globalAlpha = (0.42 - i * 0.11) * mb;
          ctx.beginPath(); ctx.arc(px, 4 - i * 1.8, 2.3 - i * 0.45, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.save();
    ctx.scale(facing, 1);

    const w = 96;
    const h = spr ? (spr.height / spr.width) * w : 90;

    if (setVfx && setVfx.vfxTier >= 3) {
      drawBattleSetAuraUpper(ctx, setVfx, h, time || 0, u.uid);
    }

    const isPetrified = (u.petrifyTimer || 0) > 0;
    const animTime = isPetrified ? 0 : (time || 0);
    const info = drawArticulatedSprite(ctx, spr, w, h, isPetrified ? false : u.moving, isPetrified ? 0 : u.runPhase, u.hitFlash, {
      spriteKey: sprKey,
      isMounted: u.isMounted !== false,
      pose,
      moveBlend: isPetrified ? 0 : mb,
      hitRecoil: isPetrified ? 0 : (u.hitRecoil || 0),
      idlePhase: u.idlePhase,
      inCombat: isPetrified ? false : u.inCombat,
      time: animTime,
      uid: u.uid,
      unitRef: u,
      wTpl,
      wVfx,
      mountTpl: mTpl,
      armorTpl: aTpl,
      helmTpl: hTpl,
      jadeTpl: jTpl,
      bookTpl: bTpl,
      battleSpec: bSpec,
    });

    if (!info.usedStudioRig) {
      if (style === 'bow') {
        drawBowActionOverlay(ctx, u, pose, wVfx, true, animTime);
      } else if (style === 'fan') {
        drawFanActionOverlay(ctx, u, pose, wVfx, true, animTime);
      } else {
        drawMeleeActionOverlay(ctx, u, pose, wTpl, wVfx, true, animTime);
      }
    }

    if ((u.shieldHp || 0) > 0) {
      ctx.save();
      const pulse = 0.78 + 0.22 * Math.sin((time || 0) * 5.2 + (u.uid || 1));
      ctx.strokeStyle = u.side === 'player' ? `rgba(103, 232, 249, ${(0.62 * pulse).toFixed(2)})` : `rgba(253, 224, 71, ${(0.58 * pulse).toFixed(2)})`;
      ctx.fillStyle = u.side === 'player' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(250, 204, 21, 0.12)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.48, 36, h * 0.50, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    drawUnitLiveStatusAura(ctx, u, h, time || 0);
    ctx.restore();
    ctx.restore();

    const mountTag = mTpl ? `·${mTpl.mountName}` : '';
    const label = `${u.name}${mountTag} ${Math.ceil(u.hp)}`;
    const anchorY = u.y + (info.topY - 6) * unitScale;
    const shieldRatio = (u.shieldHp && u.shieldHp > 0) ? Math.min(1, u.shieldHp / Math.max(1, u.maxHp)) : 0;
    const statusTags = collectUnitStatusTags(u);
    const barCol = u.petrifyTimer > 0 ? '#a8a29e' : (u.poisonTimer > 0 ? '#a855f7' : (u.side === 'player' ? '#22c55e' : '#ef4444'));

    if (hudCollector) {
      hudCollector.push({
        kind: 'general',
        uid: u.uid,
        x: worldX,
        anchorY,
        label,
        labelColor: u.isBoss ? '#fde047' : (u.side === 'player' ? '#ffffff' : '#fecaca'),
        barColor: barCol,
        borderColor: u.isBoss ? 'rgba(250, 204, 21, 0.72)' : (u.side === 'player' ? 'rgba(74, 222, 128, 0.52)' : 'rgba(248, 113, 113, 0.52)'),
        hpRatio: u.hp / u.maxHp,
        shieldRatio,
        stun: u.stunTimer > 0,
        statusTags,
        eqItems,
      });
    } else {
      drawSingleNameplate(ctx, {
        kind: 'general', x: worldX, cy: anchorY - 10, label,
        labelColor: u.isBoss ? '#fde047' : '#ffffff',
        barColor: barCol,
        borderColor: 'rgba(250,204,21,0.5)',
        hpRatio: u.hp / u.maxHp, shieldRatio, stun: u.stunTimer > 0, statusTags, eqItems,
      });
    }
  }

  function collectUnitStatusTags(u) {
    if (!u) return null;
    const tags = [];
    if (u.petrifyTimer > 0) tags.push({ txt: '🗿石化', col: '#e7e5e4' });
    if (u.stunTimer > 0) tags.push({ txt: '★眩晕', col: '#fde047' });
    if (u.poisonTimer > 0) tags.push({ txt: '☠中毒', col: '#a3e635' });
    if (u.hotTimer > 0) tags.push({ txt: '✚回春', col: '#4ade80' });
    if (u.burnTimer > 0) tags.push({ txt: '🔥灼烧', col: '#fb923c' });
    if (u.bleedTimer > 0) tags.push({ txt: '🩸流血', col: '#fb7185' });
    if (u.armorBreakTimer > 0 && tags.length < 3) tags.push({ txt: '💔破甲', col: '#fca5a5' });
    return tags.length ? tags.slice(0, 3) : null;
  }

  function drawUnitLiveStatusAura(ctx, u, h, t) {
    if (!u) return;
    // 1. 🗿石化禁锢：全身覆罩苍灰玄石晶壳 + 脚下拔地而起 5 簇玄武岩棱柱锁死身躯！
    if (u.petrifyTimer > 0) {
      ctx.save();
      const halfW = u.kind === 'general' ? 28 : 16;
      ctx.fillStyle = 'rgba(120, 113, 108, 0.42)';
      ctx.strokeStyle = 'rgba(231, 229, 228, 0.72)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, -h * 0.44, halfW, h * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 底部拔地锁足的尖锐玄岩晶簇 + 琥珀石纹裂痕
      const spikes = [
        { ox: -halfW * 0.85, sw: 8, sh: h * 0.34, tilt: -0.22 },
        { ox: -halfW * 0.38, sw: 10, sh: h * 0.46, tilt: -0.08 },
        { ox: 0,             sw: 11, sh: h * 0.52, tilt: 0.02 },
        { ox: halfW * 0.40,  sw: 10, sh: h * 0.44, tilt: 0.10 },
        { ox: halfW * 0.85,  sw: 8, sh: h * 0.32, tilt: 0.24 },
      ];
      spikes.forEach((sp, idx) => {
        ctx.save();
        ctx.translate(sp.ox, 5);
        ctx.rotate(sp.tilt);
        ctx.fillStyle = idx % 2 === 0 ? '#78716c' : '#57534e';
        ctx.beginPath();
        ctx.moveTo(-sp.sw * 0.55, 0);
        ctx.lineTo(-sp.sw * 0.20, -sp.sh);
        ctx.lineTo(sp.sw * 0.25, -sp.sh * 0.88);
        ctx.lineTo(sp.sw * 0.55, 0);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#d6d3d1';
        ctx.beginPath();
        ctx.moveTo(-sp.sw * 0.55, 0);
        ctx.lineTo(-sp.sw * 0.20, -sp.sh);
        ctx.lineTo(0, -sp.sh * 0.68);
        ctx.lineTo(-sp.sw * 0.12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      // 石壳琥珀封印裂纹
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.78)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.35, -h * 0.62);
      ctx.lineTo(2, -h * 0.46);
      ctx.lineTo(-4, -h * 0.28);
      ctx.lineTo(halfW * 0.32, -h * 0.18);
      ctx.stroke();
      ctx.restore();
    }

    // 2. ★眩晕震慑：头顶高速盘旋的流金眩晕光环 + 3 颗四角金星！
    if (u.stunTimer > 0) {
      ctx.save();
      const haloY = -h * 0.94;
      const rx = u.kind === 'general' ? 20 : 14;
      const ry = u.kind === 'general' ? 6.2 : 4.6;
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.78)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, haloY, rx, ry, -0.08, 0, Math.PI * 2);
      ctx.stroke();

      for (let s = 0; s < 3; s++) {
        const ang = t * 5.8 + s * ((Math.PI * 2) / 3) + (u.uid || 0);
        const sx = Math.cos(ang) * rx;
        const sy = haloY + Math.sin(ang) * ry;
        const sr = (u.kind === 'general' ? 4.8 : 3.6) * (0.85 + 0.2 * Math.sin(ang));
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(t * 4 + s);
        ctx.fillStyle = s === 0 ? '#ffffff' : '#fde047';
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const r0 = k % 2 === 0 ? sr : sr * 0.36;
          const a0 = (k * Math.PI) / 4;
          if (k === 0) ctx.moveTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
          else ctx.lineTo(Math.cos(a0) * r0, Math.sin(a0) * r0);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    if (u.hotTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 6 + (u.uid || 1));
      ctx.beginPath();
      ctx.ellipse(0, 3, 28, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const ph = (t * 1.3 + i * 0.25 + (u.uid || 0) * 0.17) % 1;
        const px = Math.sin(t * 4 + i * 2.1) * 16;
        const py = -4 - ph * (h * 0.85);
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.88;
        ctx.fillStyle = i % 2 === 0 ? '#4ade80' : '#fef08a';
        ctx.fillRect(px - 1.2, py - 4, 2.4, 8);
        ctx.fillRect(px - 4, py - 1.2, 8, 2.4);
      }
      ctx.restore();
    }
    if (u.poisonTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#84cc16';
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.58;
      ctx.beginPath();
      ctx.ellipse(0, 4, 26, 8.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const ph = (t * 1.45 + i * 0.25 + (u.uid || 0) * 0.23) % 1;
        const px = Math.cos(t * 4.5 + i * 1.9) * 15;
        const py = -6 - ph * (h * 0.82);
        const r = 2.6 + (i % 2) * 1.4;
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.85;
        ctx.fillStyle = i % 2 === 0 ? '#a3e635' : '#c084fc';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    if (u.burnTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const ph = (t * 2.0 + i * 0.33) % 1;
        const px = (i - 1) * 9 + Math.sin(t * 9 + i) * 3;
        const py = -8 - ph * (h * 0.68);
        ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.80;
        ctx.fillStyle = i === 1 ? '#fde047' : '#f97316';
        ctx.beginPath();
        ctx.arc(px, py, 3.2 * (1 - ph * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawProp(ctx, u, time, hudCollector) {
    const t = time || 0;
    let sprKey = u.propSprite;
    if (!sprKey) {
      if (u.isCart || String(u.name).includes('木牛')) sprKey = 'prop_wooden_ox';
      else if (u.isBase || String(u.name).includes('帅帐')) sprKey = 'prop_command_tent';
      else if (u.isRam || String(u.name).includes('冲车')) sprKey = 'prop_siege_ram';
      else if (String(u.name).includes('矿')) sprKey = 'building_goldmine';
      else sprKey = 'prop_treasure_cart';
    }
    const spr = App.Assets && App.Assets.get(sprKey);
    const isMain = !!(u.isBase || u.isMainBase);
    let drawW = isMain ? 258 : (u.isCart ? 114 : (u.isRam ? 108 : 92));
    let drawH = spr ? (spr.height / spr.width) * drawW : drawW;
    let crop = null;
    let footSink = isMain ? 14 : 10;
    let groundShearY = 0;
    let topOffset = isMain ? 10 : 8;
    if (spr) {
      if (isMain && sprKey === 'prop_command_tent') {
        // 裁去帅帐素材四周多余透明留白并大幅放大为气势恢弘的中军帅帐 (258×205)
        crop = {
          sx: spr.width * 0.016,
          sy: spr.height * 0.115,
          sw: spr.width * 0.968,
          sh: spr.height * 0.771,
        };
        drawW = 258;
        drawH = Math.round((crop.sh / crop.sw) * drawW);
      } else if (isMain && sprKey === 'city_fortress') {
        drawW = 232;
        drawH = Math.round((spr.height / spr.width) * drawW);
      } else if (sprKey === 'prop_wooden_ox') {
        // 裁去木牛流马上下 18.8% 透明留白，并用保持竖直立柱的斜投影校正让后轮与四蹄齐平踏在地面圈内
        crop = {
          sx: spr.width * 0.016,
          sy: spr.height * 0.188,
          sw: spr.width * 0.968,
          sh: spr.height * 0.625,
        };
        drawH = Math.round((crop.sh / crop.sw) * drawW);
        footSink = 15.5;
        groundShearY = -0.28;
        topOffset = 16;
      } else if (sprKey === 'prop_treasure_cart') {
        crop = {
          sx: spr.width * 0.016,
          sy: spr.height * 0.141,
          sw: spr.width * 0.968,
          sh: spr.height * 0.719,
        };
        drawH = Math.round((crop.sh / crop.sw) * drawW);
        footSink = 9;
      } else if (sprKey === 'prop_siege_ram') {
        crop = {
          sx: spr.width * 0.016,
          sy: spr.height * 0.083,
          sw: spr.width * 0.968,
          sh: spr.height * 0.833,
        };
        drawH = Math.round((crop.sh / crop.sw) * drawW);
        footSink = 10;
      }
    }
    const isMoving = !!(u.moving || u.isCart || u.isRam);
    const bob = isMoving ? Math.sin(t * 7.5 + (u.uid || 0)) * 1.4 : 0;
    const tilt = isMoving ? Math.cos(t * 7.5 + (u.uid || 0)) * 0.02 : 0;
    const worldX = u.x + (u.knockX || 0);

    ctx.save();
    ctx.translate(worldX, u.y);

    if (isMain) {
      // ★ 等轴菱形贴地接触暗影（圆心严格对齐城池/帅帐等轴底面几何中心 -drawH*0.28，彻底消除悬空黑圆盘错觉！）
      const footCenterY = sprKey === 'city_fortress' ? (-drawH * 0.27) : (-drawH * 0.25);
      const shdG = ctx.createRadialGradient(0, footCenterY + 6, drawW * 0.10, 0, footCenterY + 6, drawW * 0.52);
      shdG.addColorStop(0, 'rgba(42, 22, 8, 0.42)');
      shdG.addColorStop(0.68, 'rgba(58, 32, 12, 0.22)');
      shdG.addColorStop(1, 'rgba(58, 32, 12, 0)');
      ctx.save();
      ctx.translate(0, footCenterY + 6);
      ctx.scale(1, 0.48);
      ctx.fillStyle = shdG;
      ctx.beginPath();
      ctx.arc(0, 0, drawW * 0.52, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
      ctx.beginPath();
      ctx.ellipse(0, 4, drawW * 0.42, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = u.side === 'player' ? 'rgba(74, 222, 128, 0.58)' : 'rgba(250, 204, 21, 0.50)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(0, 4, drawW * 0.44, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(tilt);
    if (spr) {
      ctx.save();
      if (u.isCart && u.facing === -1) ctx.scale(-1, 1);
      if (groundShearY) ctx.transform(1, groundShearY, 0, 1, 0, 0);
      if (crop) {
        ctx.drawImage(spr, crop.sx, crop.sy, crop.sw, crop.sh, -drawW / 2, -drawH + footSink, drawW, drawH);
        if (u.hitFlash > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.50;
          ctx.drawImage(spr, crop.sx, crop.sy, crop.sw, crop.sh, -drawW / 2, -drawH + footSink, drawW, drawH);
          ctx.restore();
        }
      } else {
        ctx.drawImage(spr, -drawW / 2, -drawH + footSink, drawW, drawH);
        if (u.hitFlash > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.50;
          ctx.drawImage(spr, -drawW / 2, -drawH + footSink, drawW, drawH);
          ctx.restore();
        }
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); ctx.arc(0, -drawW * 0.42, drawW * 0.32, 0, Math.PI * 2); ctx.fill();
    }

    // ★ 主营墙根黄沙碎石压边（让城墙/营帐底边自然嵌入沙地，彻底稳扎地面不悬浮！）
    if (isMain && spr) {
      ctx.save();
      const leftY = sprKey === 'city_fortress' ? (-drawH * 0.36 + 14) : (-drawH * 0.40 + 14);
      const rightY = sprKey === 'city_fortress' ? (-drawH * 0.37 + 14) : (-drawH * 0.48 + 14);
      const botY = 13;
      const halfW = drawW * 0.47;

      ctx.strokeStyle = 'rgba(180, 128, 66, 0.52)';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.92, leftY + 3);
      ctx.quadraticCurveTo(-halfW * 0.42, (leftY + botY) * 0.5 + 3, 2, botY);
      ctx.quadraticCurveTo(halfW * 0.44, (rightY + botY) * 0.5 + 3, halfW * 0.92, rightY + 3);
      ctx.stroke();

      // 墙角零星沙砾小石块点缀
      const pebbles = [
        [-halfW * 0.62, (leftY + botY) * 0.46 + 4, 3.6, 1.8],
        [-halfW * 0.24, botY - 4, 4.2, 2.0],
        [4, botY + 1.5, 4.5, 2.1],
        [halfW * 0.32, botY - 6, 3.8, 1.8],
        [halfW * 0.66, (rightY + botY) * 0.44 + 4, 3.5, 1.7],
      ];
      ctx.fillStyle = 'rgba(146, 98, 46, 0.68)';
      pebbles.forEach(([px, py, rx, ry]) => {
        ctx.beginPath();
        ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }
    ctx.restore();

    if (u.isLoot) {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 5 + (u.uid || 0) * 1.7));
      ctx.save();
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#fef08a';
      const gx = Math.sin((u.uid || 1) * 2.3 + Math.floor(t * 2)) * 18;
      const gy = -drawH * 0.58;
      ctx.beginPath();
      ctx.moveTo(gx, gy - 6); ctx.lineTo(gx + 2, gy - 2); ctx.lineTo(gx + 6, gy);
      ctx.lineTo(gx + 2, gy + 2); ctx.lineTo(gx, gy + 6); ctx.lineTo(gx - 2, gy + 2);
      ctx.lineTo(gx - 6, gy); ctx.lineTo(gx - 2, gy - 2);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    const anchorY = u.y - drawH + topOffset;
    const propLabel = isMain ? `${u.name} ${Math.ceil(u.hp)}` : u.name;
    const isEnemyBase = u.side === 'enemy' && isMain;
    const plateKind = isMain ? 'main_base' : 'prop';
    if (hudCollector) {
      hudCollector.push({
        kind: plateKind,
        uid: u.uid,
        x: worldX,
        anchorY,
        label: propLabel,
        labelColor: isMain ? (u.side === 'player' ? '#86efac' : '#fca5a5') : (u.side === 'player' ? '#bbf7d0' : '#fef08a'),
        barColor: u.side === 'player' ? '#22c55e' : (isEnemyBase ? '#ef4444' : '#f59e0b'),
        borderColor: isMain ? (u.side === 'player' ? '#4ade80' : '#f87171') : (u.side === 'player' ? 'rgba(74, 222, 128, 0.55)' : 'rgba(250, 204, 21, 0.5)'),
        hpRatio: u.hp / u.maxHp,
      });
    } else {
      drawSingleNameplate(ctx, {
        kind: plateKind, x: worldX, cy: anchorY - 12, label: propLabel,
        labelColor: u.side === 'player' ? '#86efac' : '#fef08a',
        barColor: u.side === 'player' ? '#22c55e' : '#f59e0b',
        borderColor: 'rgba(250, 204, 21, 0.6)',
        hpRatio: u.hp / u.maxHp,
      });
    }
  }

  function drawSoldierSprite(ctx, u, time, hudCollector) {
    const facing = u.facing || (u.side === 'player' ? 1 : -1);
    const sprKey = resolveTroopSpriteKey(u.id, u.spriteKey || 'unit_infantry', u.side);
    const spr = App.Assets.get(sprKey) || App.Assets.get(u.spriteKey) || App.Assets.get('unit_infantry');
    const isMounted = u.id === 'mage' ? false : (u.id === 'cavalry' || sprKey.startsWith('unit_cavalry') || !!u.isMounted);
    const style = u.atkStyle || 'cleave';
    const pose = computeAttackPose(u);
    const mb = (u.moving && !(isMounted && u.atkProg > 0)) ? (u.moveBlend != null ? u.moveBlend : 1) : 0;
    const shadowScale = 1 - Math.abs(Math.sin(u.runPhase)) * 0.06 * mb;
    // 骑兵停步交战时战马稳踏原地不前后滑行；步兵挥砍突刺保留腰步前扑冲劲！
    const worldX = u.x + (isMounted ? 0 : pose.lungeX * facing) + (u.knockX || 0);

    // 写实三国军卒身高比例：铁骑兵 76px，步卒/长枪/弓手/方士 60~62px（与 96px 骑将同框协调自然！）
    const targetH = isMounted ? 76 : (sprKey.startsWith('unit_pikeman') ? 60 : (sprKey.startsWith('unit_mage') ? 62 : 60));
    const w = spr ? (spr.width / spr.height) * targetH : targetH;
    const h = targetH;

    ctx.save();
    ctx.translate(worldX, u.y);

    ctx.fillStyle = u.side === 'player' ? 'rgba(30, 64, 175, 0.24)' : 'rgba(185, 28, 28, 0.26)';
    ctx.beginPath();
    ctx.ellipse(0, 4, (isMounted ? 24 : 15.5) * shadowScale, 5.5 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.scale(facing, 1);

    const solPetrified = (u.petrifyTimer || 0) > 0;
    const solAnimTime = solPetrified ? 0 : (time || 0);
    const info = drawArticulatedSprite(ctx, spr, w, h, solPetrified ? false : u.moving, solPetrified ? 0 : u.runPhase, u.hitFlash, {
      spriteKey: sprKey,
      isMounted,
      pose,
      moveBlend: solPetrified ? 0 : mb,
      hitRecoil: solPetrified ? 0 : (u.hitRecoil || 0),
      idlePhase: u.idlePhase,
      inCombat: solPetrified ? false : u.inCombat,
      time: solAnimTime,
      uid: u.uid,
      unitRef: u,
    });

    if (!info.usedStudioRig) {
      if (style === 'bow') {
        drawBowActionOverlay(ctx, u, pose, null, false, solAnimTime);
      } else if (style === 'fan') {
        drawFanActionOverlay(ctx, u, pose, null, false, solAnimTime);
      } else {
        drawMeleeActionOverlay(ctx, u, pose, null, null, false, solAnimTime);
      }
    }
    drawUnitLiveStatusAura(ctx, u, h, time || 0);
    ctx.restore();
    ctx.restore();

    const barY = u.y + info.topY - 6;
    const solBarCol = u.petrifyTimer > 0 ? '#a8a29e' : (u.poisonTimer > 0 ? '#a855f7' : (u.side === 'player' ? '#4ade80' : '#f87171'));
    if (hudCollector) {
      hudCollector.push({
        kind: 'soldier',
        x: worldX,
        y: barY,
        w: 28,
        h: 4.2,
        ratio: u.hp / u.maxHp,
        color: solBarCol,
      });
    } else {
      App.UI.drawBar(ctx, worldX - 14, barY, 28, 4.2, u.hp / u.maxHp, solBarCol);
    }
  }

  // ================= 四象神兽专属骨骼与净身部件缓存（白虎猛扑虎纹爪 / 玄武完整盘蛇重甲足 / 朱雀双肩真振翅） =================
  const beastPartsCache = {};

  function clipImageToOffscreen(img, iw, ih, traceFn, shadeColor) {
    const cvs = createOffscreen(iw, ih);
    if (!cvs) return null;
    const g = cvs.getContext('2d');
    if (!g) return null;
    g.save();
    g.beginPath();
    traceFn(g, iw, ih);
    g.closePath();
    g.clip();
    g.drawImage(img, 0, 0, iw, ih);
    if (shadeColor) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = shadeColor;
      g.fillRect(0, 0, iw, ih);
    }
    g.restore();
    return cvs;
  }

  function clipLimbWithJointCap(img, iw, ih, polyPts, jcx, jcy, jrx, jry, shadeColor) {
    return clipImageToOffscreen(img, iw, ih, (g, W, H) => {
      for (let i = 0; i < polyPts.length; i++) {
        const pt = polyPts[i];
        if (i === 0) g.moveTo(pt[0] * W, pt[1] * H);
        else g.lineTo(pt[0] * W, pt[1] * H);
      }
      g.closePath();
      if (jrx > 0 && jry > 0) {
        g.moveTo((jcx + jrx) * W, jcy * H);
        g.ellipse(jcx * W, jcy * H, jrx * W, jry * H, 0, 0, Math.PI * 2);
      }
    }, shadeColor);
  }

  function getCleanBaihuParts(img) {
    if (!img) return null;
    const iw = img.naturalWidth || img.width || 0;
    const ih = img.naturalHeight || img.height || 0;
    if (iw < 16 || ih < 16) return null;
    const ck = `baihu_v2|${iw}x${ih}`;
    if (beastPartsCache[ck]) return beastPartsCache[ck];

    const wings = clipImageToOffscreen(img, iw, ih, (g, W, H) => {
      g.moveTo(0, 0);
      g.lineTo(W * 0.75, 0);
      g.lineTo(W * 0.75, H * 0.30);
      g.lineTo(W * 0.68, H * 0.35);
      g.lineTo(W * 0.54, H * 0.425);
      g.lineTo(W * 0.42, H * 0.465);
      g.lineTo(0, H * 0.45);
    });
    // 完整保留原画黑色毛绒腹线(y=0.73)与护胸金甲右缘，杜绝肚皮黑纹横切与前胸残角！
    const cleanBody = clipImageToOffscreen(img, iw, ih, (g, W, H) => {
      g.moveTo(0, H * 0.425);
      g.lineTo(W * 0.41, H * 0.435);
      g.lineTo(W * 0.53, H * 0.385);
      g.lineTo(W * 0.67, H * 0.31);
      g.lineTo(W * 0.74, H * 0.25);
      g.lineTo(W, H * 0.25);
      g.lineTo(W, H * 0.59);
      g.lineTo(W * 0.805, H * 0.59);
      g.lineTo(W * 0.792, H * 0.632);
      g.quadraticCurveTo(W * 0.752, H * 0.688, W * 0.702, H * 0.746);
      g.quadraticCurveTo(W * 0.655, H * 0.718, W * 0.635, H * 0.652);
      g.quadraticCurveTo(W * 0.565, H * 0.648, W * 0.522, H * 0.718);
      g.quadraticCurveTo(W * 0.435, H * 0.734, W * 0.342, H * 0.716);
      g.quadraticCurveTo(W * 0.290, H * 0.675, W * 0.218, H * 0.682);
      g.quadraticCurveTo(W * 0.120, H * 0.740, 0, H * 0.738);
    });
    const pauldronCap = clipImageToOffscreen(img, iw, ih, (g, W, H) => {
      g.moveTo(W * 0.495, H * 0.36);
      g.lineTo(W * 0.695, H * 0.36);
      g.lineTo(W * 0.685, H * 0.56);
      g.lineTo(W * 0.652, H * 0.658);
      g.lineTo(W * 0.565, H * 0.656);
      g.lineTo(W * 0.498, H * 0.638);
    });

    // 直接提取原画手绘真虎腿与四趾利爪分节贴图（圆形球窝叠合关节，旋转绝不断裂、100%原画质感！）
    const nhUpPts = [[0.16, 0.58], [0.342, 0.62], [0.342, 0.715], [0.255, 0.835], [0.135, 0.835]];
    const nhLoPts = [[0.135, 0.79], [0.245, 0.795], [0.255, 0.995], [0.095, 0.995]];
    const nfUpPts = [[0.525, 0.60], [0.628, 0.618], [0.695, 0.768], [0.585, 0.795]];
    const nfLoPts = [[0.595, 0.755], [0.725, 0.745], [0.762, 0.935], [0.615, 0.935]];
    const ffUpPts = [[0.735, 0.625], [0.822, 0.615], [0.902, 0.805], [0.812, 0.828]];
    const ffLoPts = [[0.815, 0.785], [0.912, 0.785], [0.995, 0.968], [0.845, 0.968]];

    const nhUpper = clipLimbWithJointCap(img, iw, ih, nhUpPts, 0.188, 0.815, 0.042, 0.045, null);
    const nhLower = clipLimbWithJointCap(img, iw, ih, nhLoPts, 0.188, 0.815, 0.038, 0.040, null);
    const fhUpper = clipLimbWithJointCap(img, iw, ih, nhUpPts, 0.188, 0.815, 0.042, 0.045, 'rgba(28, 22, 16, 0.24)');
    const fhLower = clipLimbWithJointCap(img, iw, ih, nhLoPts, 0.188, 0.815, 0.038, 0.040, 'rgba(28, 22, 16, 0.24)');
    const nfUpper = clipLimbWithJointCap(img, iw, ih, nfUpPts, 0.650, 0.770, 0.042, 0.042, null);
    const nfLower = clipLimbWithJointCap(img, iw, ih, nfLoPts, 0.650, 0.770, 0.038, 0.038, null);
    const ffUpper = clipLimbWithJointCap(img, iw, ih, ffUpPts, 0.860, 0.805, 0.042, 0.042, 'rgba(28, 22, 16, 0.17)');
    const ffLower = clipLimbWithJointCap(img, iw, ih, ffLoPts, 0.860, 0.805, 0.038, 0.038, 'rgba(28, 22, 16, 0.17)');

    if (!wings || !cleanBody || !pauldronCap || !nhUpper || !nhLower || !nfUpper || !nfLower || !ffUpper || !ffLower) return null;
    beastPartsCache[ck] = {
      wings, cleanBody, pauldronCap,
      nhUpper, nhLower, fhUpper, fhLower,
      nfUpper, nfLower, ffUpper, ffLower,
    };
    return beastPartsCache[ck];
  }

  function getCleanXuanwuParts(img) {
    if (!img) return null;
    const iw = img.naturalWidth || img.width || 0;
    const ih = img.naturalHeight || img.height || 0;
    if (iw < 16 || ih < 16) return null;
    const ck = `xuanwu_v2|${iw}x${ih}`;
    if (beastPartsCache[ck]) return beastPartsCache[ck];

    const cleanBody = clipImageToOffscreen(img, iw, ih, (g, W, H) => {
      g.moveTo(0, 0);
      g.lineTo(W, 0);
      g.lineTo(W, H * 0.685);
      g.lineTo(W * 0.885, H * 0.685);
      g.lineTo(W * 0.755, H * 0.668);
      g.lineTo(W * 0.695, H * 0.732);
      g.lineTo(W * 0.650, H * 0.685);
      g.lineTo(W * 0.530, H * 0.715);
      g.lineTo(W * 0.526, H * 0.876);
      g.quadraticCurveTo(W * 0.465, H * 0.892, W * 0.395, H * 0.848);
      g.quadraticCurveTo(W * 0.320, H * 0.792, W * 0.272, H * 0.698);
      g.lineTo(W * 0.205, H * 0.688);
      g.lineTo(W * 0.135, H * 0.738);
      g.lineTo(0, H * 0.742);
    });
    const rimCap = clipImageToOffscreen(img, iw, ih, (g, W, H) => {
      g.moveTo(W * 0.06, H * 0.52);
      g.lineTo(W * 0.72, H * 0.45);
      g.lineTo(W * 0.70, H * 0.725);
      g.lineTo(W * 0.645, H * 0.682);
      g.lineTo(W * 0.530, H * 0.712);
      g.lineTo(W * 0.526, H * 0.876);
      g.quadraticCurveTo(W * 0.465, H * 0.890, W * 0.395, H * 0.848);
      g.quadraticCurveTo(W * 0.320, H * 0.792, W * 0.272, H * 0.698);
      g.lineTo(W * 0.205, H * 0.685);
      g.lineTo(W * 0.06, H * 0.735);
    });
    const nhLeg = clipLimbWithJointCap(img, iw, ih, [[0.06, 0.68], [0.272, 0.68], [0.272, 0.975], [0.06, 0.975]], 0, 0, 0, 0, null);
    const fhLeg = clipLimbWithJointCap(img, iw, ih, [[0.06, 0.68], [0.272, 0.68], [0.272, 0.975], [0.06, 0.975]], 0, 0, 0, 0, 'rgba(10, 16, 26, 0.28)');
    const nfLeg = clipLimbWithJointCap(img, iw, ih, [[0.495, 0.66], [0.698, 0.66], [0.698, 0.995], [0.495, 0.995]], 0, 0, 0, 0, null);
    const ffLeg = clipLimbWithJointCap(img, iw, ih, [[0.750, 0.67], [0.968, 0.67], [0.968, 0.950], [0.750, 0.950]], 0, 0, 0, 0, 'rgba(10, 16, 26, 0.16)');

    if (!cleanBody || !rimCap || !nhLeg || !fhLeg || !nfLeg || !ffLeg) return null;
    beastPartsCache[ck] = { cleanBody, rimCap, nhLeg, fhLeg, nfLeg, ffLeg };
    return beastPartsCache[ck];
  }

  function clipImageWithHoles(img, iw, ih, outerPts, holePolys, shadeColor) {
    const cvs = createOffscreen(iw, ih);
    if (!cvs) return null;
    const g = cvs.getContext('2d');
    if (!g) return null;
    g.save();
    g.beginPath();
    for (let i = 0; i < outerPts.length; i++) {
      const pt = outerPts[i];
      if (i === 0) g.moveTo(pt[0] * iw, pt[1] * ih);
      else g.lineTo(pt[0] * iw, pt[1] * ih);
    }
    g.closePath();
    if (holePolys) {
      for (let h = 0; h < holePolys.length; h++) {
        const hp = holePolys[h];
        for (let i = 0; i < hp.length; i++) {
          const pt = hp[i];
          if (i === 0) g.moveTo(pt[0] * iw, pt[1] * ih);
          else g.lineTo(pt[0] * iw, pt[1] * ih);
        }
        g.closePath();
      }
    }
    g.clip('evenodd');
    g.drawImage(img, 0, 0, iw, ih);
    if (shadeColor) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = shadeColor;
      g.fillRect(0, 0, iw, ih);
    }
    g.restore();
    return cvs;
  }

  function clipPolyPart(img, iw, ih, polyPts, shadeColor) {
    return clipImageToOffscreen(img, iw, ih, (g, W, H) => {
      for (let i = 0; i < polyPts.length; i++) {
        const pt = polyPts[i];
        if (i === 0) g.moveTo(pt[0] * W, pt[1] * H);
        else g.lineTo(pt[0] * W, pt[1] * H);
      }
    }, shadeColor);
  }

  // 原画手绘真肢双骨骼纵跃曲线 [a1(上肢角), a2(小腿虎掌角), lift(肩胛/股骨上提比)]
  const TIGER_FORE_KEYS = [
    [ 0.68,  0.72, 0.05],
    [ 0.34,  0.34, 0.00],
    [-0.22, -0.18, 0.00],
    [-0.06, -0.78, 0.60],
    [ 0.56, -0.22, 0.55],
    [ 0.72,  0.32, 0.25],
  ];
  const TIGER_HIND_KEYS = [
    [-0.42, -0.04, 0.00],
    [-0.64, -0.46, 0.25],
    [-0.68, -0.82, 0.65],
    [-0.26, -0.52, 0.85],
    [ 0.14,  0.56, 0.55],
    [-0.22,  0.24, 0.05],
  ];
  const TIGER_BODY_KEYS = [
    [-0.40,  0.022,  1.20],
    [ 1.00,  0.032,  1.80],
    [ 0.40,  0.008,  0.40],
    [-1.80, -0.028, -0.80],
    [-3.40, -0.048, -1.20],
    [-1.80, -0.018, -0.30],
  ];

  // 圣兽分类步态曲线：祥瑞灵兽高抬膝飞驰（麒麟/白泽）、重甲凶兽裂地奔踏（饕餮/梼杌）、神魔双足阔步（烛龙）
  const STEED_FORE_KEYS = [
    [ 0.74,  0.68, 0.08],
    [ 0.34,  0.32, 0.00],
    [-0.24, -0.22, 0.00],
    [-0.04, -0.96, 0.62],
    [ 0.66, -0.34, 0.56],
    [ 0.78,  0.18, 0.28],
  ];
  const STEED_HIND_KEYS = [
    [-0.36,  0.06, 0.00],
    [-0.58, -0.42, 0.28],
    [-0.64, -0.84, 0.68],
    [-0.24, -0.56, 0.88],
    [ 0.16,  0.62, 0.58],
    [-0.20,  0.28, 0.06],
  ];
  const STEED_BODY_KEYS = [
    [-0.30,  0.020,  0.90],
    [ 0.90,  0.030,  1.40],
    [ 0.25,  0.006,  0.30],
    [-1.70, -0.026, -0.70],
    [-3.10, -0.044, -1.10],
    [-1.60, -0.016, -0.25],
  ];

  const BEHEMOTH_FORE_KEYS = [
    [ 0.70,  0.66, 0.05],
    [ 0.32,  0.30, 0.00],
    [-0.26, -0.22, 0.00],
    [-0.08, -0.76, 0.58],
    [ 0.54, -0.20, 0.52],
    [ 0.72,  0.28, 0.22],
  ];
  const BEHEMOTH_HIND_KEYS = [
    [-0.40, -0.02, 0.00],
    [-0.64, -0.44, 0.25],
    [-0.68, -0.78, 0.62],
    [-0.24, -0.48, 0.78],
    [ 0.16,  0.54, 0.52],
    [-0.20,  0.22, 0.05],
  ];
  const BEHEMOTH_BODY_KEYS = [
    [-0.35,  0.024,  1.10],
    [ 1.10,  0.034,  1.70],
    [ 0.35,  0.008,  0.35],
    [-1.75, -0.028, -0.75],
    [-3.10, -0.046, -1.15],
    [-1.60, -0.018, -0.25],
  ];

  const BIPED_DRAGON_KEYS = [
    [ 0.52,  0.46, 0.05],
    [ 0.20,  0.14, 0.00],
    [-0.28, -0.22, 0.00],
    [-0.18, -0.68, 0.55],
    [ 0.38, -0.24, 0.60],
    [ 0.58,  0.22, 0.25],
  ];

  // 六大四足圣兽（麒麟/白泽/穷奇/混沌/饕餮/梼杌）原画像素级分件与双骨骼关节表
  const QUAD_BEAST_SPECS = {
    qilin: {
      sink: 14, farSc: 0.94, shade: 'rgba(26, 16, 8, 0.26)',
      foreKeys: STEED_FORE_KEYS, hindKeys: STEED_HIND_KEYS, bodyKeys: STEED_BODY_KEYS,
      tail: { pts: [[0, 0.19], [0.435, 0.19], [0.445, 0.445], [0.455, 0.482], [0.420, 0.518], [0.345, 0.525], [0, 0.532]], piv: [0.428, 0.478], amp: 0.15 },
      body: [[0.432, 0.35], [0.51, 0.34], [0.51, 0], [1.0, 0], [1.0, 0.51], [0.902, 0.51], [0.902, 0.558], [0.888, 0.588], [0.852, 0.648], [0.812, 0.675], [0.782, 0.665], [0.745, 0.605], [0.675, 0.625], [0.605, 0.610], [0.525, 0.585], [0.475, 0.575], [0.422, 0.520], [0.438, 0.475]],
      cap: [[0.640, 0.440], [0.828, 0.440], [0.822, 0.642], [0.760, 0.632], [0.648, 0.585]],
      hipCap: [[0.420, 0.442], [0.542, 0.442], [0.535, 0.590], [0.470, 0.582], [0.420, 0.525]],
      nhUp: { pts: [[0.295, 0.565], [0.418, 0.495], [0.535, 0.565], [0.515, 0.675], [0.405, 0.775], [0.330, 0.770]], cap: [0.368, 0.755, 0.038, 0.040] },
      nhLo: { pts: [[0.230, 0.680], [0.335, 0.725], [0.408, 0.750], [0.405, 0.985], [0.295, 0.985], [0.230, 0.855]], cap: [0.368, 0.755, 0.035, 0.036] },
      nfUp: { pts: [[0.648, 0.610], [0.792, 0.575], [0.838, 0.775], [0.762, 0.785], [0.648, 0.715]], cap: [0.805, 0.762, 0.036, 0.038] },
      nfLo: { pts: [[0.722, 0.785], [0.775, 0.745], [0.845, 0.745], [0.935, 0.992], [0.825, 0.992], [0.722, 0.890]], cap: [0.805, 0.762, 0.034, 0.035] },
      joints: {
        nh: [0.455, 0.565, 0.368, 0.755, 0.355, 0.950, 0.455, 0.565, -0.32, 0.02, 1.0],
        fh: [0.455, 0.565, 0.368, 0.755, 0.355, 0.950, 0.548, 0.565, -0.18, 0.14, 1.0],
        nf: [0.748, 0.605, 0.805, 0.762, 0.882, 0.955, 0.742, 0.612,  0.22, 0.24, 1.04],
        ff: [0.748, 0.605, 0.805, 0.762, 0.882, 0.955, 0.812, 0.605,  0.44, 0.38, 1.0],
      },
    },
    baize: {
      sink: 14, farSc: 0.93, shade: 'rgba(16, 30, 44, 0.25)',
      foreKeys: STEED_FORE_KEYS, hindKeys: STEED_HIND_KEYS, bodyKeys: STEED_BODY_KEYS,
      tail: { pts: [[0, 0.25], [0.485, 0.25], [0.500, 0.495], [0.455, 0.535], [0.395, 0.542], [0.342, 0.625], [0.312, 0.735], [0.282, 0.835], [0, 0.855]], piv: [0.478, 0.495], amp: 0.13 },
      body: [[0.485, 0.25], [0.485, 0], [1.0, 0], [1.0, 0.555], [0.902, 0.555], [0.885, 0.635], [0.835, 0.672], [0.780, 0.680], [0.750, 0.620], [0.655, 0.645], [0.585, 0.688], [0.520, 0.655], [0.455, 0.615], [0.348, 0.625], [0.395, 0.542], [0.448, 0.532], [0.492, 0.495]],
      cap: [[0.635, 0.365], [0.835, 0.365], [0.825, 0.655], [0.755, 0.645], [0.645, 0.595]],
      nhUp: { pts: [[0.355, 0.632], [0.442, 0.555], [0.518, 0.615], [0.488, 0.725], [0.412, 0.798], [0.345, 0.778]], cap: [0.382, 0.772, 0.038, 0.040] },
      nhLo: { pts: [[0.290, 0.762], [0.418, 0.758], [0.442, 0.965], [0.345, 0.965], [0.290, 0.875]], cap: [0.382, 0.772, 0.035, 0.036] },
      nfUp: { pts: [[0.618, 0.585], [0.785, 0.565], [0.785, 0.762], [0.650, 0.772], [0.612, 0.680]], cap: [0.732, 0.752, 0.042, 0.040] },
      nfLo: { pts: [[0.608, 0.742], [0.785, 0.738], [0.840, 0.995], [0.695, 0.995], [0.608, 0.885]], cap: [0.732, 0.752, 0.038, 0.038] },
      joints: {
        nh: [0.455, 0.595, 0.382, 0.772, 0.398, 0.935, 0.455, 0.595, -0.34, 0.06, 1.0],
        fh: [0.455, 0.595, 0.382, 0.772, 0.398, 0.935, 0.542, 0.598, -0.20, 0.16, 1.0],
        nf: [0.722, 0.595, 0.732, 0.752, 0.772, 0.955, 0.722, 0.595,  0.08, 0.18, 1.04],
        ff: [0.722, 0.595, 0.732, 0.752, 0.772, 0.955, 0.805, 0.602,  0.34, 0.38, 1.0],
      },
    },
    qiongqi: {
      sink: 14, farSc: 0.92, shade: 'rgba(26, 10, 10, 0.28)',
      foreKeys: TIGER_FORE_KEYS, hindKeys: TIGER_HIND_KEYS, bodyKeys: TIGER_BODY_KEYS,
      wings: { pts: [[0, 0], [0.775, 0], [0.775, 0.31], [0.715, 0.38], [0.655, 0.53], [0.415, 0.53], [0, 0.395]], piv: [0.575, 0.425], amp: 0.12 },
      body: [[0, 0.380], [0.240, 0.410], [0.415, 0.480], [0.560, 0.470], [0.630, 0.380], [0.735, 0.280], [0.780, 0.260], [1.0, 0.260], [1.0, 0.715], [0.865, 0.715], [0.840, 0.675], [0.785, 0.722], [0.705, 0.728], [0.665, 0.655], [0.560, 0.665], [0.525, 0.692], [0.445, 0.665], [0.345, 0.665], [0.285, 0.695], [0.215, 0.742], [0, 0.748]],
      cap: [[0.552, 0.382], [0.748, 0.382], [0.742, 0.585], [0.682, 0.658], [0.562, 0.635]],
      nhUp: { pts: [[0.250, 0.685], [0.355, 0.565], [0.465, 0.635], [0.435, 0.725], [0.325, 0.825], [0.245, 0.815]], cap: [0.282, 0.805, 0.042, 0.044] },
      nhLo: { pts: [[0.215, 0.775], [0.330, 0.785], [0.345, 0.965], [0.215, 0.965]], cap: [0.282, 0.805, 0.038, 0.040] },
      nfUp: { pts: [[0.545, 0.595], [0.688, 0.605], [0.685, 0.775], [0.565, 0.785]], cap: [0.628, 0.755, 0.046, 0.044] },
      nfLo: { pts: [[0.558, 0.735], [0.692, 0.735], [0.772, 0.988], [0.605, 0.988]], cap: [0.628, 0.755, 0.042, 0.040] },
      joints: {
        nh: [0.375, 0.625, 0.282, 0.805, 0.285, 0.945, 0.375, 0.625, -0.44, 0.02, 1.0],
        fh: [0.375, 0.625, 0.282, 0.805, 0.285, 0.945, 0.468, 0.630, -0.26, 0.14, 1.0],
        nf: [0.615, 0.615, 0.628, 0.755, 0.695, 0.945, 0.615, 0.615,  0.12, 0.30, 1.04],
        ff: [0.615, 0.615, 0.628, 0.755, 0.695, 0.945, 0.742, 0.625,  0.38, 0.44, 1.0],
      },
    },
    hundun: {
      sink: 13, farSc: 0.93, shade: 'rgba(18, 10, 32, 0.28)',
      foreKeys: TIGER_FORE_KEYS, hindKeys: TIGER_HIND_KEYS, bodyKeys: TIGER_BODY_KEYS,
      farWing: { pts: [[0.535, 0], [1.0, 0], [1.0, 0.52], [0.895, 0.52], [0.855, 0.44], [0.745, 0.42], [0.585, 0.45]], piv: [0.675, 0.425], amp: -0.11 },
      wings: { pts: [[0.05, 0], [0.615, 0], [0.625, 0.595], [0.455, 0.595], [0.255, 0.602], [0.05, 0.45]], piv: [0.575, 0.525], amp: 0.13 },
      tail: { pts: [[0, 0.600], [0.445, 0.600], [0.442, 0.685], [0.352, 0.730], [0.322, 0.865], [0, 0.885]], piv: [0.425, 0.635], amp: 0.12 },
      body: [[0.420, 0.590], [0.585, 0.555], [0.605, 0.305], [0.755, 0.275], [0.855, 0.315], [0.915, 0.395], [0.955, 0.500], [0.935, 0.635], [0.840, 0.635], [0.822, 0.725], [0.762, 0.782], [0.702, 0.755], [0.615, 0.745], [0.545, 0.728], [0.475, 0.715], [0.415, 0.665]],
      cap: [[0.605, 0.465], [0.762, 0.465], [0.755, 0.675], [0.685, 0.685], [0.608, 0.645]],
      nhUp: { pts: [[0.345, 0.725], [0.435, 0.600], [0.518, 0.675], [0.492, 0.795], [0.405, 0.865], [0.345, 0.845]], cap: [0.378, 0.835, 0.038, 0.040] },
      nhLo: { pts: [[0.325, 0.815], [0.415, 0.825], [0.425, 0.992], [0.325, 0.992]], cap: [0.378, 0.835, 0.035, 0.036] },
      nfUp: { pts: [[0.585, 0.615], [0.722, 0.605], [0.710, 0.785], [0.585, 0.785]], cap: [0.652, 0.765, 0.042, 0.042] },
      nfLo: { pts: [[0.595, 0.745], [0.715, 0.745], [0.768, 0.942], [0.665, 0.942]], cap: [0.652, 0.765, 0.038, 0.038] },
      joints: {
        nh: [0.455, 0.665, 0.378, 0.835, 0.382, 0.960, 0.455, 0.665, -0.42, 0.02, 1.0],
        fh: [0.455, 0.665, 0.378, 0.835, 0.382, 0.960, 0.538, 0.672, -0.24, 0.14, 1.0],
        nf: [0.655, 0.635, 0.652, 0.765, 0.725, 0.905, 0.655, 0.652,  0.08, 0.32, 1.09],
        ff: [0.655, 0.635, 0.652, 0.765, 0.725, 0.905, 0.768, 0.668,  0.38, 0.42, 1.06],
      },
    },
    taotie: {
      sink: 11, farSc: 0.91, shade: 'rgba(16, 10, 22, 0.30)',
      foreKeys: BEHEMOTH_FORE_KEYS, hindKeys: BEHEMOTH_HIND_KEYS, bodyKeys: BEHEMOTH_BODY_KEYS,
      tail: { pts: [[0, 0.18], [0.295, 0.18], [0.295, 0.595], [0.225, 0.655], [0, 0.665]], piv: [0.275, 0.535], amp: 0.16 },
      body: [[0.275, 0.40], [0.35, 0.28], [0.35, 0], [1.0, 0], [1.0, 0.66], [0.845, 0.66], [0.815, 0.695], [0.745, 0.745], [0.675, 0.745], [0.625, 0.665], [0.495, 0.685], [0.435, 0.685], [0.355, 0.645], [0.275, 0.585]],
      cap: [[0.455, 0.295], [0.655, 0.295], [0.650, 0.615], [0.555, 0.635], [0.460, 0.585]],
      hipCap: [[0.268, 0.355], [0.415, 0.355], [0.412, 0.645], [0.335, 0.655], [0.272, 0.585]],
      nhUp: { pts: [[0.235, 0.665], [0.315, 0.565], [0.415, 0.635], [0.385, 0.765], [0.305, 0.815], [0.215, 0.795]], cap: [0.258, 0.785, 0.044, 0.046] },
      nhLo: { pts: [[0.172, 0.690], [0.308, 0.765], [0.315, 0.995], [0.185, 0.995]], cap: [0.258, 0.785, 0.040, 0.042] },
      nfUp: { pts: [[0.445, 0.565], [0.605, 0.565], [0.635, 0.785], [0.495, 0.805], [0.445, 0.695]], cap: [0.575, 0.765, 0.052, 0.052] },
      nfLo: { pts: [[0.495, 0.745], [0.642, 0.740], [0.708, 0.992], [0.545, 0.992]], cap: [0.575, 0.765, 0.048, 0.048] },
      joints: {
        nh: [0.335, 0.625, 0.258, 0.785, 0.258, 0.955, 0.335, 0.625, -0.42,  0.00, 1.0],
        fh: [0.335, 0.625, 0.258, 0.785, 0.258, 0.955, 0.448, 0.632, -0.24,  0.14, 1.0],
        nf: [0.525, 0.595, 0.575, 0.765, 0.638, 0.935, 0.525, 0.595,  0.22,  0.32, 1.04],
        ff: [0.525, 0.595, 0.575, 0.765, 0.638, 0.935, 0.715, 0.618,  0.42,  0.46, 1.0],
      },
    },
    taowu: {
      sink: 12, farSc: 0.91, shade: 'rgba(18, 12, 8, 0.32)',
      foreKeys: BEHEMOTH_FORE_KEYS, hindKeys: BEHEMOTH_HIND_KEYS, bodyKeys: BEHEMOTH_BODY_KEYS,
      tail: { pts: [[0, 0.12], [0.365, 0.12], [0.365, 0.625], [0.312, 0.665], [0.282, 0.755], [0, 0.775]], piv: [0.345, 0.555], amp: 0.15 },
      body: [[0.345, 0.36], [0.48, 0.28], [0.50, 0], [1.0, 0], [1.0, 0.73], [0.875, 0.73], [0.850, 0.675], [0.775, 0.728], [0.705, 0.728], [0.655, 0.645], [0.535, 0.675], [0.465, 0.665], [0.385, 0.625], [0.345, 0.615]],
      cap: [[0.512, 0.245], [0.718, 0.245], [0.712, 0.585], [0.615, 0.605], [0.515, 0.555]],
      hipCap: [[0.348, 0.365], [0.485, 0.365], [0.478, 0.635], [0.405, 0.635], [0.348, 0.585]],
      nhUp: { pts: [[0.315, 0.655], [0.365, 0.515], [0.472, 0.585], [0.455, 0.745], [0.395, 0.805], [0.305, 0.785]], cap: [0.355, 0.775, 0.044, 0.046] },
      nhLo: { pts: [[0.282, 0.755], [0.405, 0.765], [0.408, 0.965], [0.282, 0.965]], cap: [0.355, 0.775, 0.040, 0.042] },
      nfUp: { pts: [[0.495, 0.565], [0.658, 0.565], [0.682, 0.795], [0.555, 0.805], [0.495, 0.685]], cap: [0.632, 0.775, 0.052, 0.052] },
      nfLo: { pts: [[0.565, 0.750], [0.698, 0.750], [0.752, 0.995], [0.585, 0.995]], cap: [0.632, 0.775, 0.048, 0.048] },
      joints: {
        nh: [0.405, 0.605, 0.355, 0.775, 0.348, 0.925, 0.405, 0.605, -0.32, -0.02, 1.0],
        fh: [0.405, 0.605, 0.355, 0.775, 0.348, 0.925, 0.495, 0.612, -0.18,  0.12, 1.0],
        nf: [0.585, 0.585, 0.632, 0.775, 0.675, 0.945, 0.585, 0.585,  0.20,  0.24, 1.04],
        ff: [0.585, 0.585, 0.632, 0.775, 0.675, 0.945, 0.745, 0.610,  0.40,  0.44, 1.0],
      },
    },
  };

  // 展翼神禽（朱雀/鲲鹏）无缝肩轴鼓翼与独立凤尾/孔雀翎分件表
  const BIRD_BEAST_SPECS = {
    zhuque: {
      rightWing: { pts: [[0.680, 0], [1.0, 0], [1.0, 0.58], [0.665, 0.58], [0.680, 0.36]], piv: [0.725, 0.465], cap: [0.725, 0.465, 0.055, 0.055] },
      leftWing:  { pts: [[0.08, 0], [0.595, 0], [0.605, 0.455], [0.585, 0.555], [0.415, 0.545], [0.355, 0.482], [0.255, 0.422], [0.155, 0.342], [0.08, 0.15]], piv: [0.555, 0.465], cap: [0.555, 0.465, 0.055, 0.055] },
      tail:      { pts: [[0, 0.362], [0.24, 0.425], [0.35, 0.482], [0.46, 0.515], [0.565, 0.525], [0.520, 0.778], [0.715, 0.778], [0.715, 1.0], [0, 1.0]], piv: [0.485, 0.595] },
      body:      [[0.47, 0.20], [0.79, 0.20], [0.79, 0.40], [0.752, 0.568], [0.705, 0.778], [0.515, 0.778], [0.510, 0.535], [0.45, 0.44]],
      cap:       [[0.535, 0.385], [0.665, 0.385], [0.665, 0.575], [0.535, 0.575]],
    },
    kunpeng: {
      rightWing: { pts: [[0.625, 0.04], [1.0, 0.04], [1.0, 0.475], [0.855, 0.52], [0.625, 0.52]], piv: [0.705, 0.465], cap: [0.705, 0.465, 0.055, 0.055] },
      leftWing:  { pts: [[0.20, 0], [0.665, 0], [0.668, 0.465], [0.652, 0.605], [0.500, 0.602], [0.380, 0.478], [0.20, 0.35]], piv: [0.625, 0.535], cap: [0.625, 0.535, 0.055, 0.055] },
      tail:      { pts: [[0, 0.505], [0.385, 0.505], [0.535, 0.575], [0.555, 0.675], [0.492, 0.855], [0.472, 1.0], [0, 1.0]], piv: [0.505, 0.655] },
      body:      [[0.625, 0.440], [1.0, 0.450], [1.0, 0.745], [0.825, 0.765], [0.765, 0.895], [0.488, 0.985], [0.492, 0.850], [0.522, 0.665], [0.502, 0.585], [0.625, 0.555]],
      cap:       [[0.635, 0.448], [0.778, 0.448], [0.768, 0.665], [0.648, 0.645]],
    },
  };

  function getCleanQuadBeastParts(beastId, img) {
    const spec = QUAD_BEAST_SPECS[beastId];
    if (!spec || !img) return null;
    const iw = img.naturalWidth || img.width || 0;
    const ih = img.naturalHeight || img.height || 0;
    if (iw < 16 || ih < 16) return null;
    const ck = `quad_v3|${beastId}|${iw}x${ih}`;
    if (beastPartsCache[ck]) return beastPartsCache[ck];

    const cnh1 = spec.nhUp.cap, cnh2 = spec.nhLo.cap;
    const cnf1 = spec.nfUp.cap, cnf2 = spec.nfLo.cap;
    const cleanBody = clipPolyPart(img, iw, ih, spec.body, null);
    const pauldronCap = spec.cap ? clipPolyPart(img, iw, ih, spec.cap, null) : null;
    const hipCap = spec.hipCap ? clipPolyPart(img, iw, ih, spec.hipCap, null) : null;
    const wings = spec.wings ? clipPolyPart(img, iw, ih, spec.wings.pts, null) : null;
    const farWing = spec.farWing ? clipPolyPart(img, iw, ih, spec.farWing.pts, null) : null;
    const tail = spec.tail ? clipPolyPart(img, iw, ih, spec.tail.pts, null) : null;

    const nhUpper = clipLimbWithJointCap(img, iw, ih, spec.nhUp.pts, cnh1[0], cnh1[1], cnh1[2], cnh1[3], null);
    const nhLower = clipLimbWithJointCap(img, iw, ih, spec.nhLo.pts, cnh2[0], cnh2[1], cnh2[2], cnh2[3], null);
    const fhUpper = clipLimbWithJointCap(img, iw, ih, spec.nhUp.pts, cnh1[0], cnh1[1], cnh1[2], cnh1[3], spec.shade);
    const fhLower = clipLimbWithJointCap(img, iw, ih, spec.nhLo.pts, cnh2[0], cnh2[1], cnh2[2], cnh2[3], spec.shade);
    const nfUpper = clipLimbWithJointCap(img, iw, ih, spec.nfUp.pts, cnf1[0], cnf1[1], cnf1[2], cnf1[3], null);
    const nfLower = clipLimbWithJointCap(img, iw, ih, spec.nfLo.pts, cnf2[0], cnf2[1], cnf2[2], cnf2[3], null);
    const ffUpper = clipLimbWithJointCap(img, iw, ih, spec.nfUp.pts, cnf1[0], cnf1[1], cnf1[2], cnf1[3], spec.shade);
    const ffLower = clipLimbWithJointCap(img, iw, ih, spec.nfLo.pts, cnf2[0], cnf2[1], cnf2[2], cnf2[3], spec.shade);

    if (!cleanBody || !nhUpper || !nhLower || !nfUpper || !nfLower || !ffUpper || !ffLower) return null;
    beastPartsCache[ck] = {
      cleanBody, pauldronCap, hipCap, wings, farWing, tail,
      nhUpper, nhLower, fhUpper, fhLower, nfUpper, nfLower, ffUpper, ffLower,
    };
    return beastPartsCache[ck];
  }

  function getCleanBirdBeastParts(beastId, img) {
    const spec = BIRD_BEAST_SPECS[beastId];
    if (!spec || !img) return null;
    const iw = img.naturalWidth || img.width || 0;
    const ih = img.naturalHeight || img.height || 0;
    if (iw < 16 || ih < 16) return null;
    const ck = `bird_v3|${beastId}|${iw}x${ih}`;
    if (beastPartsCache[ck]) return beastPartsCache[ck];

    const rc = spec.rightWing.cap, lc = spec.leftWing.cap;
    const rightWing = clipLimbWithJointCap(img, iw, ih, spec.rightWing.pts, rc[0], rc[1], rc[2], rc[3], null);
    const leftWing = clipLimbWithJointCap(img, iw, ih, spec.leftWing.pts, lc[0], lc[1], lc[2], lc[3], null);
    const tail = clipPolyPart(img, iw, ih, spec.tail.pts, null);
    const body = clipPolyPart(img, iw, ih, spec.body, null);
    const cap = spec.cap ? clipPolyPart(img, iw, ih, spec.cap, null) : null;
    if (!rightWing || !leftWing || !tail || !body) return null;
    beastPartsCache[ck] = { rightWing, leftWing, tail, body, cap };
    return beastPartsCache[ck];
  }

  function getCleanQinglongParts(img) {
    if (!img) return null;
    const iw = img.naturalWidth || img.width || 0;
    const ih = img.naturalHeight || img.height || 0;
    if (iw < 16 || ih < 16) return null;
    const isPearl = iw >= 220;
    const ck = `qinglong_v3|${iw}x${ih}`;
    if (beastPartsCache[ck]) return beastPartsCache[ck];

    if (isPearl) {
      const ffClaw = clipLimbWithJointCap(img, iw, ih, [[0.822, 0.455], [1.0, 0.455], [1.0, 0.725], [0.818, 0.725]], 0.830, 0.660, 0.035, 0.035, null);
      const nfClaw = clipLimbWithJointCap(img, iw, ih, [[0.650, 0.560], [0.765, 0.560], [0.798, 0.715], [0.798, 0.775], [0.705, 0.775], [0.650, 0.665]], 0.705, 0.585, 0.035, 0.035, null);
      const fhLeg = clipLimbWithJointCap(img, iw, ih, [[0.398, 0.585], [0.535, 0.585], [0.535, 0.825], [0.435, 0.825], [0.398, 0.705]], 0.430, 0.610, 0.040, 0.040, 'rgba(12, 32, 28, 0.18)');
      const nhLeg = clipLimbWithJointCap(img, iw, ih, [[0.235, 0.615], [0.395, 0.605], [0.395, 0.825], [0.355, 0.995], [0.235, 0.995]], 0.350, 0.635, 0.042, 0.042, null);
      const hipCap = clipPolyPart(img, iw, ih, [[0.305, 0.485], [0.435, 0.485], [0.425, 0.635], [0.315, 0.645]], null);
      const cleanBody = clipImageWithHoles(img, iw, ih, [[0, 0], [1, 0], [1, 1], [0, 1]], [
        [[0.826, 0.450], [1.0, 0.450], [1.0, 0.730], [0.826, 0.730]],
        [[0.402, 0.615], [0.538, 0.615], [0.538, 0.828], [0.402, 0.828]],
        [[0.305, 0.785], [0.345, 0.685], [0.396, 0.685], [0.396, 1.0], [0.235, 1.0], [0.235, 0.805]],
      ], null);
      if (!cleanBody || !ffClaw || !nfClaw || !fhLeg || !nhLeg || !hipCap) return null;
      beastPartsCache[ck] = { isPearl: true, cleanBody, ffClaw, nfClaw, fhLeg, nhLeg, hipCap };
      return beastPartsCache[ck];
    }

    const nfClaw = clipLimbWithJointCap(img, iw, ih, [[0.555, 0.700], [0.675, 0.700], [0.768, 0.855], [0.768, 1.0], [0.625, 1.0], [0.555, 0.825]], 0.635, 0.735, 0.042, 0.042, null);
    const ffClaw = clipLimbWithJointCap(img, iw, ih, [[0.805, 0.605], [1.0, 0.605], [1.0, 0.825], [0.798, 0.825]], 0.815, 0.755, 0.038, 0.038, null);
    const cleanBody = clipImageWithHoles(img, iw, ih, [[0, 0], [1, 0], [1, 1], [0, 1]], [
      [[0.585, 0.835], [0.768, 0.842], [0.768, 1.0], [0.615, 1.0]],
      [[0.825, 0.600], [1.0, 0.600], [1.0, 0.825], [0.822, 0.815]],
    ], null);
    if (!cleanBody || !nfClaw || !ffClaw) return null;
    beastPartsCache[ck] = { isPearl: false, cleanBody, nfClaw, ffClaw, nfPiv: [0.635, 0.735], ffPiv: [0.815, 0.755] };
    return beastPartsCache[ck];
  }

  function getCleanZhulongParts(img) {
    if (!img) return null;
    const iw = img.naturalWidth || img.width || 0;
    const ih = img.naturalHeight || img.height || 0;
    if (iw < 16 || ih < 16) return null;
    const isBipedWinged = ih > iw * 0.88;
    const ck = `zhulong_v3|${iw}x${ih}`;
    if (beastPartsCache[ck]) return beastPartsCache[ck];

    if (isBipedWinged) {
      const farWing = clipLimbWithJointCap(img, iw, ih, [[0.41, 0.00], [0.84, 0.00], [0.84, 0.285], [0.60, 0.32], [0.41, 0.18]], 0.625, 0.265, 0.045, 0.045, null);
      const nearWing = clipLimbWithJointCap(img, iw, ih, [[0.00, 0.00], [0.595, 0.00], [0.595, 0.420], [0.575, 0.585], [0.362, 0.585], [0.345, 0.465], [0.255, 0.455], [0.185, 0.505], [0.08, 0.42], [0.00, 0.38]], 0.555, 0.445, 0.045, 0.045, null);
      const tail = clipLimbWithJointCap(img, iw, ih, [[0.05, 0.480], [0.345, 0.475], [0.355, 0.595], [0.475, 0.595], [0.465, 0.785], [0.410, 0.895], [0.355, 0.928], [0.05, 0.928]], 0.445, 0.725, 0.040, 0.040, null);
      const sunArm = clipLimbWithJointCap(img, iw, ih, [[0.755, 0.455], [1.0, 0.455], [1.0, 0.675], [0.755, 0.675]], 0.775, 0.615, 0.038, 0.038, null);
      const clawArm = clipLimbWithJointCap(img, iw, ih, [[0.595, 0.545], [0.715, 0.545], [0.808, 0.685], [0.808, 0.762], [0.695, 0.762], [0.595, 0.655]], 0.635, 0.575, 0.042, 0.042, null);
      const cap = clipPolyPart(img, iw, ih, [[0.542, 0.412], [0.718, 0.412], [0.715, 0.580], [0.552, 0.572]], null);
      const nhUp = clipLimbWithJointCap(img, iw, ih, [[0.430, 0.625], [0.580, 0.625], [0.580, 0.790], [0.515, 0.855], [0.410, 0.845]], 0.462, 0.825, 0.048, 0.045, null);
      const nhLo = clipLimbWithJointCap(img, iw, ih, [[0.395, 0.805], [0.515, 0.815], [0.522, 0.998], [0.365, 0.998]], 0.462, 0.825, 0.044, 0.042, null);
      const fhUp = clipLimbWithJointCap(img, iw, ih, [[0.580, 0.685], [0.720, 0.695], [0.742, 0.818], [0.595, 0.835]], 0.655, 0.815, 0.046, 0.042, 'rgba(18, 8, 6, 0.20)');
      const fhLo = clipLimbWithJointCap(img, iw, ih, [[0.585, 0.795], [0.720, 0.805], [0.798, 0.962], [0.600, 0.962]], 0.655, 0.815, 0.042, 0.038, 'rgba(18, 8, 6, 0.20)');
      const cleanBody = clipPolyPart(img, iw, ih, [
        [0.585, 0.255], [0.655, 0.160], [0.712, 0.215], [0.748, 0.190],
        [0.815, 0.250], [0.862, 0.345], [0.862, 0.455], [0.805, 0.475],
        [0.785, 0.665], [0.725, 0.705], [0.595, 0.715], [0.475, 0.675],
        [0.455, 0.585], [0.545, 0.555], [0.555, 0.365],
      ], null);
      if (!farWing || !nearWing || !tail || !sunArm || !clawArm || !cap || !nhUp || !nhLo || !fhUp || !fhLo || !cleanBody) return null;
      beastPartsCache[ck] = { isBipedWinged: true, farWing, nearWing, tail, sunArm, clawArm, cap, nhUp, nhLo, fhUp, fhLo, cleanBody };
      return beastPartsCache[ck];
    }

    const nfClaw = clipLimbWithJointCap(img, iw, ih, [[0.555, 0.700], [0.705, 0.700], [0.768, 0.865], [0.768, 1.0], [0.625, 1.0], [0.555, 0.825]], 0.655, 0.745, 0.045, 0.045, null);
    const ffClaw = clipLimbWithJointCap(img, iw, ih, [[0.805, 0.775], [0.978, 0.775], [0.978, 0.960], [0.805, 0.960]], 0.818, 0.825, 0.038, 0.038, null);
    const cleanBody = clipImageWithHoles(img, iw, ih, [[0, 0], [1, 0], [1, 1], [0, 1]], [
      [[0.585, 0.845], [0.770, 0.848], [0.770, 1.0], [0.620, 1.0]],
      [[0.825, 0.775], [0.980, 0.775], [0.980, 0.962], [0.822, 0.955]],
      [[0.215, 0.608], [0.258, 0.675], [0.275, 0.765], [0.228, 0.812], [0.202, 0.725]],
    ], null);
    if (!cleanBody || !nfClaw || !ffClaw) return null;
    beastPartsCache[ck] = { isBipedWinged: false, cleanBody, nfClaw, ffClaw, nfPiv: [0.655, 0.745], ffPiv: [0.818, 0.825] };
    return beastPartsCache[ck];
  }

  function drawPaintedPivotPart(ctx, partCvs, w, h, pivRx, pivRy, tx, ty, rotRad, scaleY) {
    ctx.save();
    ctx.translate(tx, ty);
    if (Math.abs(rotRad) > 1e-4) ctx.rotate(rotRad);
    if (scaleY && Math.abs(scaleY - 1) > 1e-3) ctx.scale(1, scaleY);
    ctx.drawImage(partCvs, -pivRx * w, -pivRy * h, w, h);
    ctx.restore();
  }

  function drawPaintedTwoBoneLimb(ctx, upperCvs, lowerCvs, w, h, piv1Rx, piv1Ry, piv2Rx, piv2Ry, endRx, endRy, keys, mountX, mountY, phase, mb, idleA1, idleA2, liftPx, shrink1, lowerSy, limbSc) {
    const ls = limbSc || 1;
    const lw = w * ls, lh = h * ls;
    const restDx1 = (piv2Rx - piv1Rx) * lw, restDy1 = (piv2Ry - piv1Ry) * lh;
    const restA1 = Math.atan2(restDx1, restDy1);
    const len1 = Math.hypot(restDx1, restDy1);
    const restA2 = Math.atan2((endRx - piv2Rx) * lw, (endRy - piv2Ry) * lh);

    let a1 = idleA1, a2 = idleA2, lift = 0;
    if (mb > 0.001) {
      const s = evalPeriodicSpline(keys, phase, _gallopSample);
      a1 = idleA1 * (1 - mb) + s[0] * mb;
      a2 = idleA2 * (1 - mb) + s[1] * mb;
      lift = Math.max(0, s[2]) * mb;
    }

    const p1x = mountX;
    const p1y = mountY - lift * liftPx;
    const s1 = 1 - lift * shrink1;
    // Canvas2D 中向 +X（前方）抬腿对应逆时针旋转 -(a - restA)
    drawPaintedPivotPart(ctx, upperCvs, lw, lh, piv1Rx, piv1Ry, p1x, p1y, -(a1 - restA1), s1);
    const p2x = p1x + Math.sin(a1) * len1 * s1;
    const p2y = p1y + Math.cos(a1) * len1 * s1;
    drawPaintedPivotPart(ctx, lowerCvs, lw, lh, piv2Rx, piv2Ry, p2x, p2y, -(a2 - restA2), lowerSy || 1);
  }

  // ★ 六大四足圣兽（麒麟/白泽/穷奇/混沌/饕餮/梼杌）真双骨骼四拍奔腾渲染器
  function drawArticulatedQuadBeast(ctx, beastId, spr, w, h, moving, runPhase, hitFlash, pose, mb, recoil, time, idlePhase) {
    const spec = QUAD_BEAST_SPECS[beastId];
    const parts = getCleanQuadBeastParts(beastId, spr);
    const sc = w / 146;
    const leftX = -w * 0.5;
    const sink = (spec && spec.sink != null) ? spec.sink : 14;
    const baseTopY = -h + sink * sc;
    if (!spec || !parts) {
      if (spr) ctx.drawImage(spr, leftX, baseTopY, w, h);
      return { topY: baseTopY };
    }

    const quadMove = (moving && !pose.active) ? clamp01(mb) : 0;
    const breath = Math.sin((time || 0) * 3.1 + idlePhase);
    const bSample = quadMove > 0.001 ? evalPeriodicSpline(spec.bodyKeys, runPhase, _gallopSample) : null;
    const bobY = (bSample ? bSample[0] * quadMove : 0) * sc + (1 - quadMove) * breath * 0.6;
    const pitch = (bSample ? bSample[1] * quadMove : 0) + (pose.bodyPitch || 0) * 0.76 - recoil * 0.08;
    const surgeX = (bSample ? bSample[2] * quadMove : 0) * sc - recoil * 2.2;
    const atkStrike = pose.active ? Math.sin(clamp01(pose.p) * Math.PI) : 0;

    ctx.save();
    if (pose.afterimage > 0.18 && hitFlash <= 0) {
      ctx.save();
      ctx.globalAlpha = pose.afterimage * 0.28;
      ctx.drawImage(spr, leftX - 12, baseTopY + bobY, w, h);
      ctx.restore();
    }

    const pvy = -h * 0.32;
    ctx.translate(surgeX, bobY + pvy);
    ctx.rotate(pitch);
    ctx.scale(pose.scaleX || 1, pose.scaleY || 1);
    ctx.translate(0, -pvy);

    if (parts.farWing && spec.farWing) {
      const fwp = spec.farWing.piv;
      const fwAng = quadMove > 0.001
        ? Math.sin(runPhase - 0.6) * spec.farWing.amp * quadMove
        : Math.sin((time || 0) * 3.2 + idlePhase + 0.8) * (spec.farWing.amp * 0.32);
      drawPaintedPivotPart(ctx, parts.farWing, w, h, fwp[0], fwp[1], leftX + w * fwp[0], baseTopY + h * fwp[1], fwAng, 1);
    }

    const j = spec.joints;
    const fSc = spec.farSc || 0.93;
    const fh = j.fh, ff = j.ff, nh = j.nh, nf = j.nf;

    // 1. 远侧后肢 + 远侧前肢
    drawPaintedTwoBoneLimb(
      ctx, parts.fhUpper, parts.fhLower, w, h,
      fh[0], fh[1], fh[2], fh[3], fh[4], fh[5], spec.hindKeys,
      leftX + w * fh[6], baseTopY + h * fh[7], runPhase + 0.14 * HORSE_TAU, quadMove,
      fh[8] - atkStrike * 0.12, fh[9], 3.8 * sc, 0.14, fh[10], fSc
    );
    drawPaintedTwoBoneLimb(
      ctx, parts.ffUpper, parts.ffLower, w, h,
      ff[0], ff[1], ff[2], ff[3], ff[4], ff[5], spec.foreKeys,
      leftX + w * ff[6], baseTopY + h * ff[7], runPhase - 0.17 * HORSE_TAU, quadMove,
      ff[8] + atkStrike * 0.24, ff[9] - atkStrike * 0.14, 2.2 * sc, 0.08, ff[10], fSc
    );

    // 2. 独立流火尾/仙翎尾/流星锤骨尾随奔跑节拍摆动
    if (parts.tail && spec.tail) {
      const tp = spec.tail.piv;
      const tAng = quadMove > 0.001
        ? Math.sin(runPhase - 0.9) * spec.tail.amp * quadMove
        : Math.sin((time || 0) * 2.8 + idlePhase) * (spec.tail.amp * 0.36);
      drawPaintedPivotPart(ctx, parts.tail, w, h, tp[0], tp[1], leftX + w * tp[0], baseTopY + h * tp[1], tAng, 1);
    }

    // 3. 近侧后肢 + 臀甲/灵焰盖片 + 近侧双翼 + 净身原画圣兽躯干
    drawPaintedTwoBoneLimb(
      ctx, parts.nhUpper, parts.nhLower, w, h,
      nh[0], nh[1], nh[2], nh[3], nh[4], nh[5], spec.hindKeys,
      leftX + w * nh[6], baseTopY + h * nh[7], runPhase, quadMove,
      nh[8] - atkStrike * 0.16, nh[9], 3.8 * sc, 0.14, nh[10], 1.0
    );
    if (parts.hipCap) {
      ctx.drawImage(parts.hipCap, leftX, baseTopY, w, h);
    }
    if (parts.wings && spec.wings) {
      const wp = spec.wings.piv;
      const wAng = quadMove > 0.001
        ? Math.sin(runPhase - 0.6) * spec.wings.amp * quadMove
        : Math.sin((time || 0) * 3.2 + idlePhase) * (spec.wings.amp * 0.32);
      drawPaintedPivotPart(ctx, parts.wings, w, h, wp[0], wp[1], leftX + w * wp[0], baseTopY + h * wp[1], wAng, 1);
    }

    ctx.drawImage(parts.cleanBody, leftX, baseTopY, w, h);

    // 4. 近侧前肢挥踏 + 黄金肩吞甲/肩焰盖片无缝叠合
    drawPaintedTwoBoneLimb(
      ctx, parts.nfUpper, parts.nfLower, w, h,
      nf[0], nf[1], nf[2], nf[3], nf[4], nf[5], spec.foreKeys,
      leftX + w * nf[6], baseTopY + h * nf[7], runPhase, quadMove,
      nf[8] + atkStrike * 0.34, nf[9] - atkStrike * 0.18, 2.2 * sc, 0.08, nf[10], 1.0
    );
    if (parts.pauldronCap) {
      ctx.drawImage(parts.pauldronCap, leftX, baseTopY, w, h);
    }

    if (hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.46;
      ctx.drawImage(parts.cleanBody, leftX, baseTopY, w, h);
    }
    ctx.restore();
    return { topY: baseTopY };
  }

  // ★ 展翼神禽（朱雀/鲲鹏）真肩轴双翼鼓翼 + 独立长尾流翎渲染器
  function drawArticulatedBirdBeast(ctx, beastId, spr, w, h, bSc, flapCycle, mb, hitFlash, pose, time) {
    const spec = BIRD_BEAST_SPECS[beastId];
    const parts = getCleanBirdBeastParts(beastId, spr);
    const leftX = -w * 0.5;
    const baseTopY = -h + 14 * bSc;
    const flapSin = Math.sin(flapCycle);
    const wingAng = flapSin * (0.24 + mb * 0.13);

    if (pose.afterimage > 0.18 && hitFlash <= 0 && spr) {
      ctx.save();
      ctx.globalAlpha = pose.afterimage * 0.32;
      ctx.drawImage(spr, leftX - 14, baseTopY, w, h);
      ctx.restore();
    }

    ctx.save();
    const pvy = baseTopY + h * 0.46;
    ctx.translate(0, pvy);
    ctx.rotate((pose.bodyPitch || 0) * 0.8 + mb * 0.065 + Math.cos(flapCycle) * 0.032);
    ctx.scale(pose.scaleX || 1, pose.scaleY || 1);
    ctx.translate(0, -pvy);

    if (spec && parts) {
      const rwp = spec.rightWing.piv;
      const lwp = spec.leftWing.piv;
      const tp = spec.tail.piv;
      const wingSy = 1 - Math.abs(flapSin) * 0.06;
      const tailAng = Math.sin(flapCycle - 1.1) * (0.07 + mb * 0.10);

      drawPaintedPivotPart(ctx, parts.rightWing, w, h, rwp[0], rwp[1], leftX + w * rwp[0], baseTopY + h * rwp[1], -wingAng * 0.90, wingSy);
      drawPaintedPivotPart(ctx, parts.tail, w, h, tp[0], tp[1], leftX + w * tp[0], baseTopY + h * tp[1], tailAng, 1);
      ctx.drawImage(parts.body, leftX, baseTopY, w, h);
      if (parts.cap) ctx.drawImage(parts.cap, leftX, baseTopY, w, h);
      drawPaintedPivotPart(ctx, parts.leftWing, w, h, lwp[0], lwp[1], leftX + w * lwp[0], baseTopY + h * lwp[1], wingAng, wingSy);
    } else if (spr) {
      ctx.drawImage(spr, leftX, baseTopY, w, h);
    }

    if (hitFlash > 0 && spr) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.48;
      ctx.drawImage(parts ? parts.body : spr, leftX, baseTopY, w, h);
    }
    ctx.restore();

    // 振翅飘散离火星羽（朱雀）或北冥寒溟流羽（鲲鹏）
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const isKunpeng = beastId === 'kunpeng';
    for (let e = 0; e < 4; e++) {
      const pEm = (((time || 0) * 1.6 + e * 0.25) % 1);
      ctx.globalAlpha = (1 - pEm) * 0.72;
      ctx.fillStyle = isKunpeng
        ? (e % 2 === 0 ? '#7dd3fc' : '#fde047')
        : (e % 2 === 0 ? '#fde047' : '#fb923c');
      ctx.beginPath();
      ctx.arc((-18 - pEm * 44) * bSc, (-44 - e * 11 + Math.sin((time || 0) * 8 + e) * 6) * bSc, 3.2 * (1 - pEm * 0.5) * Math.min(1.45, bSc), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return { topY: baseTopY };
  }

  // ★ 苍穹游龙（青龙 & 盘身态烛龙）：无缝S形游龙推进波 + 100%刚性昂首龙颜 + 独立龙爪划空踏云
  function drawSerpentineDragon(ctx, spr, parts, w, h, bSc, t, runPhase, mb, hitFlash, pose) {
    const leftX = -w * 0.5;
    const baseTopY = -h + 15 * bSc;
    if (!parts || !spr) {
      if (spr) ctx.drawImage(spr, leftX, baseTopY, w, h);
      return { topY: baseTopY };
    }

    const phase = t * (4.2 + mb * 3.2) + (runPhase || 0) * 0.68;
    const headBob = Math.sin(phase) * (2.2 + mb * 3.0) * bSc;
    const neckSplit = parts.isPearl ? 0.62 : 0.63;
    const waveX = (r) => {
      if (r >= neckSplit) return 0;
      const u = (neckSplit - r) / neckSplit;
      const env = (u * u) * (3 - 2 * u) * 0.74 + u * 0.32;
      return Math.cos(phase - u * 4.6) * (0.8 + mb * 2.1) * bSc * env;
    };
    const waveY = (r) => {
      if (r >= neckSplit) return headBob;
      const u = (neckSplit - r) / neckSplit;
      const env = (u * u) * (3 - 2 * u) * 0.74 + u * 0.32;
      return headBob + Math.sin(phase - u * 5.4) * (3.6 + mb * 8.0 + (pose.active ? 2.2 : 0)) * bSc * env;
    };

    if (pose.afterimage > 0.18 && hitFlash <= 0) {
      ctx.save();
      ctx.globalAlpha = pose.afterimage * 0.30;
      ctx.drawImage(spr, leftX - 14 * bSc, baseTopY, w, h);
      ctx.restore();
    }

    ctx.save();
    ctx.rotate((pose.bodyPitch || 0) * 0.72);
    ctx.scale(pose.scaleX || 1, pose.scaleY || 1);

    const strikeClaw = pose.active ? Math.sin(clamp01(pose.p) * Math.PI) * 0.32 : 0;

    if (parts.isPearl) {
      const fhWx = waveX(0.43), fhWy = waveY(0.43);
      const fhAng = Math.sin(phase + Math.PI) * (0.14 + mb * 0.30);
      drawPaintedPivotPart(ctx, parts.fhLeg, w, h, 0.430, 0.610, leftX + w * 0.430 + fhWx, baseTopY + h * 0.610 + fhWy, fhAng, 1);
      const ffAng = Math.sin(phase + 0.6) * (0.10 + mb * 0.20) + strikeClaw;
      drawPaintedPivotPart(ctx, parts.ffClaw, w, h, 0.830, 0.660, leftX + w * 0.830, baseTopY + headBob + h * 0.660, -ffAng, 1);
    } else {
      const ffp = parts.ffPiv;
      const ffAng = Math.sin(phase + Math.PI) * (0.14 + mb * 0.26) + strikeClaw;
      drawPaintedPivotPart(ctx, parts.ffClaw, w, h, ffp[0], ffp[1], leftX + w * ffp[0], baseTopY + headBob + h * ffp[1], -ffAng, 1);
    }

    const iw = parts.cleanBody.width || spr.width || 200;
    const ih = parts.cleanBody.height || spr.height || 153;
    const slices = 22;
    for (let s = 0; s < slices; s++) {
      const r0 = s / slices;
      const r1 = (s + 1) / slices;
      const mr = (r0 + r1) * 0.5;
      const padL = s > 0 ? 1 : 0;
      const padR = s < slices - 1 ? 1 : 0;
      const sx0 = Math.max(0, Math.floor(iw * r0) - padL);
      const sx1 = s === slices - 1 ? iw : Math.min(iw, Math.ceil(iw * r1) + padR);
      const sw = sx1 - sx0;
      if (sw <= 0) continue;
      const dx0 = leftX + w * r0 + waveX(r0) - padL * (w / iw);
      const dx1 = leftX + w * r1 + waveX(r1) + padR * (w / iw);
      const dw = Math.max(0.5, dx1 - dx0);
      ctx.drawImage(parts.cleanBody, sx0, 0, sw, ih, dx0, baseTopY + waveY(mr), dw, h);
    }

    if (parts.isPearl) {
      const nhWx = waveX(0.35), nhWy = waveY(0.35);
      const nhAng = Math.sin(phase) * (0.16 + mb * 0.34);
      const nhLift = Math.max(0, Math.cos(phase)) * mb * 3.5 * bSc;
      drawPaintedPivotPart(ctx, parts.nhLeg, w, h, 0.350, 0.635, leftX + w * 0.350 + nhWx, baseTopY + h * 0.635 + nhWy - nhLift, -nhAng, 1);
      ctx.drawImage(parts.hipCap, leftX + nhWx, baseTopY + nhWy, w, h);
      const nfAng = Math.sin(phase + Math.PI * 0.8) * (0.10 + mb * 0.22) + strikeClaw;
      drawPaintedPivotPart(ctx, parts.nfClaw, w, h, 0.705, 0.585, leftX + w * 0.705, baseTopY + headBob + h * 0.585, -nfAng, 1);
    } else {
      const nfp = parts.nfPiv;
      const nfAng = Math.sin(phase) * (0.16 + mb * 0.28) + strikeClaw;
      drawPaintedPivotPart(ctx, parts.nfClaw, w, h, nfp[0], nfp[1], leftX + w * nfp[0], baseTopY + headBob + h * nfp[1], -nfAng, 1);
    }

    if (hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.48;
      ctx.drawImage(parts.cleanBody, leftX, baseTopY + headBob, w, h);
    }
    ctx.restore();
    return { topY: baseTopY };
  }

  // ★ 钟山烛龙（双翼双足擎日魔神态）：双巨翼熔岩扇动 + 双龙足阔步踏阵 + 托日右臂与烈焰龙尾摆动
  function drawArticulatedWingedZhulong(ctx, spr, parts, w, h, moving, runPhase, hitFlash, pose, mb, recoil, time, idlePhase) {
    const sc = w / 146;
    const leftX = -w * 0.5;
    const baseTopY = -h + 10 * sc;
    const zlMove = (moving && !pose.active) ? clamp01(mb) : 0;
    const breath = Math.sin((time || 0) * 2.9 + idlePhase);
    const bobY = -Math.abs(Math.sin(runPhase)) * 3.2 * sc * zlMove + (1 - zlMove) * breath * 0.7;
    const pitch = (0.042 + Math.cos(runPhase * 2) * 0.022) * zlMove + (pose.bodyPitch || 0) * 0.72 - recoil * 0.07;
    const surgeX = Math.sin(runPhase * 2) * 1.2 * sc * zlMove - recoil * 2.0;
    const wingAng = zlMove > 0.001
      ? Math.sin(runPhase - 0.5) * 0.16 * zlMove
      : Math.sin((time || 0) * 3.1 + idlePhase) * 0.055;
    const atkStrike = pose.active ? Math.sin(clamp01(pose.p) * Math.PI) : 0;

    ctx.save();
    if (pose.afterimage > 0.18 && hitFlash <= 0) {
      ctx.save();
      ctx.globalAlpha = pose.afterimage * 0.28;
      ctx.drawImage(spr, leftX - 12, baseTopY + bobY, w, h);
      ctx.restore();
    }

    const pvy = -h * 0.35;
    ctx.translate(surgeX, bobY + pvy);
    ctx.rotate(pitch);
    ctx.scale(pose.scaleX || 1, pose.scaleY || 1);
    ctx.translate(0, -pvy);

    // 1. 远侧熔岩龙翼 + 擎日右臂 + 远侧右龙足（交替迈步）
    drawPaintedPivotPart(ctx, parts.farWing, w, h, 0.625, 0.265, leftX + w * 0.625, baseTopY + h * 0.265, -wingAng * 0.85, 1);
    const sunAng = (zlMove > 0.001 ? Math.sin(runPhase + 0.8) * 0.11 * zlMove : breath * 0.04) - atkStrike * 0.26;
    drawPaintedPivotPart(ctx, parts.sunArm, w, h, 0.775, 0.615, leftX + w * 0.775, baseTopY + h * 0.615, sunAng, 1);
    drawPaintedTwoBoneLimb(
      ctx, parts.fhUp, parts.fhLo, w, h,
      0.635, 0.705, 0.655, 0.815, 0.715, 0.925, BIPED_DRAGON_KEYS,
      leftX + w * 0.635, baseTopY + h * 0.705, runPhase + Math.PI, zlMove,
      0.14, 0.28, 3.2 * sc, 0.10, 1.0, 1.0
    );

    // 2. 烈焰骨尾 + 近侧熔岩巨翼 + 烛龙重甲胸躯龙首 + 近侧左龙足
    const tailAng = zlMove > 0.001 ? Math.sin(runPhase - 0.9) * 0.13 * zlMove : breath * 0.05;
    drawPaintedPivotPart(ctx, parts.tail, w, h, 0.445, 0.725, leftX + w * 0.445, baseTopY + h * 0.725, tailAng, 1);
    drawPaintedPivotPart(ctx, parts.nearWing, w, h, 0.555, 0.445, leftX + w * 0.555, baseTopY + h * 0.445, wingAng, 1);
    ctx.drawImage(parts.cleanBody, leftX, baseTopY, w, h);
    drawPaintedTwoBoneLimb(
      ctx, parts.nhUp, parts.nhLo, w, h,
      0.515, 0.675, 0.462, 0.825, 0.445, 0.960, BIPED_DRAGON_KEYS,
      leftX + w * 0.515, baseTopY + h * 0.675, runPhase, zlMove,
      -0.26, -0.06, 3.6 * sc, 0.12, 1.0, 1.0
    );

    // 3. 左龙爪臂摆动挥击 + 黄金肩吞甲盖片
    const clawAng = (zlMove > 0.001 ? Math.sin(runPhase + Math.PI) * 0.24 * zlMove : -breath * 0.04) + atkStrike * 0.36;
    drawPaintedPivotPart(ctx, parts.clawArm, w, h, 0.635, 0.575, leftX + w * 0.635, baseTopY + h * 0.575, -clawAng, 1);
    ctx.drawImage(parts.cap, leftX, baseTopY, w, h);

    if (hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.48;
      ctx.drawImage(parts.cleanBody, leftX, baseTopY, w, h);
    }
    ctx.restore();
    return { topY: baseTopY };
  }

  function drawArticulatedBaihu(ctx, spr, w, h, moving, runPhase, hitFlash, pose, mb, recoil, time, idlePhase) {
    const parts = getCleanBaihuParts(spr);
    const sc = w / 146;
    const leftX = -w * 0.5;
    // baseTopY 随体型等比缩放，确保四只厚虎掌始终稳踩在金色底圈正中央！
    const baseTopY = -h + 15 * sc;
    if (!parts) {
      ctx.drawImage(spr, leftX, baseTopY, w, h);
      return { topY: baseTopY };
    }
    const tigerMove = (moving && !pose.active) ? clamp01(mb) : 0;
    const breath = Math.sin((time || 0) * 3.2 + idlePhase);
    const bSample = tigerMove > 0.001 ? evalPeriodicSpline(TIGER_BODY_KEYS, runPhase, _gallopSample) : null;
    const bobY = (bSample ? bSample[0] * tigerMove : 0) * sc + (1 - tigerMove) * breath * 0.6;
    const pitch = (bSample ? bSample[1] * tigerMove : 0) + (pose.bodyPitch || 0) * 0.75 - recoil * 0.08;
    const surgeX = (bSample ? bSample[2] * tigerMove : 0) * sc - recoil * 2.2;
    const wingAng = tigerMove > 0.001
      ? Math.sin(runPhase - 0.6) * 0.10 * tigerMove
      : Math.sin((time || 0) * 3.2 + idlePhase) * 0.032;

    ctx.save();
    if (pose.afterimage > 0.18 && hitFlash <= 0) {
      ctx.save();
      ctx.globalAlpha = pose.afterimage * 0.28;
      ctx.drawImage(spr, leftX - 12, baseTopY + bobY, w, h);
      ctx.restore();
    }

    const pvy = -h * 0.32;
    ctx.translate(surgeX, bobY + pvy);
    ctx.rotate(pitch);
    ctx.scale(pose.scaleX || 1, pose.scaleY || 1);
    ctx.translate(0, -pvy);

    // 1. 远侧后腿 + 远侧前腿 + 近侧后腿（100%原画手绘真虎腿与四趾利爪，置于完整毛绒肚皮与护胸甲后层）
    drawPaintedTwoBoneLimb(
      ctx, parts.fhUpper, parts.fhLower, w, h,
      0.265, 0.635, 0.188, 0.815, 0.178, 0.960, TIGER_HIND_KEYS,
      leftX + w * 0.365, baseTopY + h * 0.625, runPhase + 0.14 * HORSE_TAU, tigerMove,
      -0.26, 0.12, 3.8 * sc, 0.14, 1.0
    );
    drawPaintedTwoBoneLimb(
      ctx, parts.ffUpper, parts.ffLower, w, h,
      0.768, 0.648, 0.860, 0.805, 0.925, 0.940, TIGER_FORE_KEYS,
      leftX + w * 0.745, baseTopY + h * 0.635, runPhase - 0.17 * HORSE_TAU, tigerMove,
      0.46, 0.44, 2.2 * sc, 0.08, 1.0
    );
    drawPaintedTwoBoneLimb(
      ctx, parts.nhUpper, parts.nhLower, w, h,
      0.265, 0.635, 0.188, 0.815, 0.178, 0.960, TIGER_HIND_KEYS,
      leftX + w * 0.265, baseTopY + h * 0.635, runPhase, tigerMove,
      -0.44, -0.05, 3.8 * sc, 0.14, 1.0
    );

    // 2. 双金翼随纵跃节拍扇动 + 完整保留腹线黑毛边的白虎真躯
    ctx.save();
    const wx = leftX + w * 0.52, wy = baseTopY + h * 0.39;
    ctx.translate(wx, wy);
    ctx.rotate(wingAng);
    ctx.translate(-wx, -wy);
    ctx.drawImage(parts.wings, leftX, baseTopY, w, h);
    ctx.restore();

    ctx.drawImage(parts.cleanBody, leftX, baseTopY, w, h);

    // 3. 近侧前虎臂挥扑于护胸金甲前方 + 黄金肩吞甲盖片无缝叠合
    drawPaintedTwoBoneLimb(
      ctx, parts.nfUpper, parts.nfLower, w, h,
      0.580, 0.625, 0.650, 0.770, 0.695, 0.905, TIGER_FORE_KEYS,
      leftX + w * 0.580, baseTopY + h * 0.625, runPhase, tigerMove,
      0.18, 0.16, 2.2 * sc, 0.08, 1.08
    );
    ctx.drawImage(parts.pauldronCap, leftX, baseTopY, w, h);

    if (hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.46;
      ctx.drawImage(parts.cleanBody, leftX, baseTopY, w, h);
    }
    ctx.restore();
    return { topY: baseTopY };
  }

  const XUANWU_STEP_KEYS = [
    [ 0.36, 0.15],
    [ 0.24, 0.00],
    [ 0.00, 0.00],
    [-0.32, 0.00],
    [-0.20, 0.85],
    [ 0.16, 1.00],
  ];

  function drawPaintedXuanwuLeg(ctx, legCvs, w, h, pivRx, pivRy, mountX, mountY, phase, mb, sc) {
    let ang = 0, lift = 0;
    if (mb > 0.001) {
      const s = evalPeriodicSpline(XUANWU_STEP_KEYS, phase, _gallopSample);
      ang = s[0] * mb;
      lift = Math.max(0, s[1]) * mb;
    }
    drawPaintedPivotPart(ctx, legCvs, w, h, pivRx, pivRy, mountX, mountY - lift * 4.5 * sc, -ang, 1.0);
  }

  function drawArticulatedXuanwu(ctx, spr, w, h, moving, runPhase, hitFlash, pose, mb, recoil, time, idlePhase) {
    const parts = getCleanXuanwuParts(spr);
    const sc = w / 146;
    const leftX = -w * 0.5;
    const baseTopY = -h + 15 * sc;
    if (!parts) {
      ctx.drawImage(spr, leftX, baseTopY, w, h);
      return { topY: baseTopY };
    }
    const xwMove = (moving && !pose.active) ? clamp01(mb) : 0;
    const breath = Math.sin((time || 0) * 2.6 + idlePhase);
    const bobY = -Math.abs(Math.sin(runPhase)) * 1.8 * sc * xwMove + (1 - xwMove) * breath * 0.5;
    const pitch = Math.sin(runPhase) * 0.024 * xwMove + (pose.bodyPitch || 0) * 0.65 - recoil * 0.06;
    const surgeX = Math.cos(runPhase * 2) * 0.9 * sc * xwMove - recoil * 1.8;

    ctx.save();
    const pvy = -h * 0.35;
    ctx.translate(surgeX, bobY + pvy);
    ctx.rotate(pitch);
    ctx.scale(pose.scaleX || 1, pose.scaleY || 1);
    ctx.translate(0, -pvy);

    // 1. 远侧双原画重甲巨足（置于玄蛇腹环与龟颈后方）
    drawPaintedXuanwuLeg(ctx, parts.fhLeg, w, h, 0.185, 0.72, leftX + w * 0.395, baseTopY + h * 0.71, runPhase + 0.50 * HORSE_TAU, xwMove, sc);
    drawPaintedXuanwuLeg(ctx, parts.ffLeg, w, h, 0.840, 0.71, leftX + w * 0.840, baseTopY + h * 0.71, runPhase, xwMove, sc);

    // 2. 完整玄龟背甲 + 100%无损青色玄蛇盘绕躯干
    ctx.drawImage(parts.cleanBody, leftX, baseTopY, w, h);

    // 3. 近侧双原画重甲巨足 + 寒铁壳缘与玄蛇下腹叠合盖片
    drawPaintedXuanwuLeg(ctx, parts.nhLeg, w, h, 0.185, 0.72, leftX + w * 0.185, baseTopY + h * 0.72, runPhase, xwMove, sc);
    drawPaintedXuanwuLeg(ctx, parts.nfLeg, w, h, 0.595, 0.71, leftX + w * 0.595, baseTopY + h * 0.71, runPhase + 0.50 * HORSE_TAU, xwMove, sc);
    ctx.drawImage(parts.rimCap, leftX, baseTopY, w, h);

    if (hitFlash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.46;
      ctx.drawImage(parts.cleanBody, leftX, baseTopY, w, h);
    }
    ctx.restore();
    return { topY: baseTopY };
  }

  function drawGiantBeastSprite(ctx, u, time, hudCollector) {
    const facing = u.facing || (u.side === 'player' ? 1 : -1);
    const bCfg = App.Config.BEASTS[u.id] || App.Config.BEASTS.baihu;
    const sprKey = 'beast_sprite_' + u.id;
    const spr = App.Assets.get(sprKey);
    const eq = u.equips || {};
    const clawTpl = eq.beast_claw ? App.Config.EQUIP_TEMPLATES[eq.beast_claw.tplId] : null;
    const scaleTpl = eq.beast_scale ? App.Config.EQUIP_TEMPLATES[eq.beast_scale.tplId] : null;
    const hornTpl = eq.beast_horn ? App.Config.EQUIP_TEMPLATES[eq.beast_horn.tplId] : null;
    const coreTpl = eq.beast_core ? App.Config.EQUIP_TEMPLATES[eq.beast_core.tplId] : null;
    const t = time || 0;

    const isZhulong = u.id === 'zhulong';
    const isQinglong = u.id === 'qinglong';
    const sprIw = spr ? (spr.naturalWidth || spr.width || 200) : 200;
    const sprIh = spr ? (spr.naturalHeight || spr.height || 155) : 155;
    const isBipedZhulong = isZhulong && sprIh > sprIw * 0.88;
    const isBirdBeast = u.id === 'zhuque' || u.id === 'kunpeng';
    const isXuanwu = u.id === 'xuanwu';
    const isBaihu = u.id === 'baihu';
    const isQuadBeast = !!QUAD_BEAST_SPECS[u.id];
    const isFlyer = isQinglong || isBirdBeast || (isZhulong && !isBipedZhulong);
    const pose = computeAttackPose(u);
    const mb = u.moveBlend != null ? u.moveBlend : (u.moving ? 1 : 0);

    // 朱雀/鲲鹏展翼节拍升浮 vs 青龙乘云破空 vs 地面瑞兽/凶兽/擎日烛龙阔步踏阵
    const activeFlyMove = (u.moving && !pose.active) ? clamp01(mb) : 0;
    const flapCycle = t * 5.8 + (u.runPhase || 0) * 0.42 + (u.uid || 1) * 1.3;
    const zlFlapCycle = t * 4.4 + (u.runPhase || 0) * 0.36 + (u.uid || 1) * 1.1;
    const qlIdlePh = u.idlePhase != null ? u.idlePhase : ((u.uid || 1) * 1.37);
    const qlBreath = Math.sin(t * 2.2 + qlIdlePh);
    const qlGlidePh = (u.runPhase || 0) * 0.58;
    const qlGlideSin = Math.sin(qlGlidePh);
    const baseHover = (isZhulong && !isBipedZhulong) ? 14.5 : (isBirdBeast ? 13 : (isQinglong ? 11.5 : 0));
    const hover = (isZhulong && !isBipedZhulong)
      ? (baseHover + Math.sin(zlFlapCycle) * (3.4 + activeFlyMove * 2.2))
      : (isBirdBeast
        ? (baseHover + Math.sin(flapCycle) * (3.8 + activeFlyMove * 2.2))
        : (isQinglong
          ? (baseHover + 1.2 * activeFlyMove + qlGlideSin * 0.85 * activeFlyMove + qlBreath * 1.15 * (1 - activeFlyMove))
          : 0));
    const lungeX = pose.lungeX * 1.15 * facing;
    const worldX = u.x + lungeX + (u.knockX || 0);

    ctx.save();
    ctx.translate(worldX, u.y);

    const beastScale = (u.scale || (u.isWildBeast ? 1.52 : 1));
    // 创世烛龙贵为 Lv.80 太古祖龙帝尊，双翼高展，体型较四象圣兽更加魁梧威严（200 vs 184）
    const baseW = isZhulong ? 200 : (u.id === 'zhuque' ? 174 : (isQinglong && sprIw >= 220 ? 190 : 184));
    const w = baseW * beastScale;
    const h = spr ? (sprIh / sprIw) * w : 160 * beastScale;
    const bSc = w / 146;

    // 地面圣兽光阵与步伐震波（烛龙脚下流淌钟山极昼双层赤金日晷阵纹）
    const shScale = (isFlyer ? (0.92 - hover * 0.008) : 1) * bSc;
    const shCy = 6 * bSc;
    ctx.fillStyle = isZhulong ? 'rgba(69, 10, 10, 0.48)' : 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(0, shCy, (isZhulong ? 58 : 52) * shScale, (isZhulong ? 17 : 15) * shScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = bCfg.glow;
    ctx.lineWidth = isZhulong ? 3.0 : 2.6;
    ctx.beginPath(); ctx.ellipse(0, shCy, ((isZhulong ? 63 : 56) + Math.sin(t * 5) * 3.5) * shScale, (isZhulong ? 19 : 17) * shScale, 0, 0, Math.PI * 2); ctx.stroke();
    if (isZhulong) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.72)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.ellipse(0, shCy, 47 * shScale, 13.5 * shScale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if ((isXuanwu || u.id === 'taotie' || u.id === 'taowu') && mb > 0.25) {
      const stompPulse = ((u.runPhase || 0) % Math.PI) / Math.PI;
      ctx.save();
      ctx.globalAlpha = (1 - stompPulse) * 0.48 * mb;
      ctx.strokeStyle = isXuanwu ? '#7dd3fc' : (bCfg.glow || '#f97316');
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(0, shCy, (36 + stompPulse * 38) * bSc, (11 + stompPulse * 11) * bSc, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if ((u.id === 'qilin' || u.id === 'baize') && mb > 0.25) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let sp = 0; sp < 3; sp++) {
        const pSp = ((t * 2.2 + sp * 0.33) % 1);
        ctx.globalAlpha = (1 - pSp) * 0.62 * mb;
        ctx.fillStyle = u.id === 'qilin' ? (sp % 2 === 0 ? '#fde047' : '#f97316') : (sp % 2 === 0 ? '#67e8f9' : '#fef08a');
        ctx.beginPath();
        ctx.arc(-facing * (14 + pSp * 36) * bSc, shCy - (2 + pSp * 8) * bSc, 2.8 * (1 - pSp * 0.4) * bSc, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    const bEqArr = Object.values(eq);
    const beastSetVfx = u.setVfx || (bEqArr.length >= 2 && App.Config.resolveSetVfx ? App.Config.resolveSetVfx(bEqArr) : null);
    if (beastSetVfx && beastSetVfx.vfxTier > 0) {
      drawBattleSetAuraGround(ctx, beastSetVfx, 68 * bSc, t);
    } else if (scaleTpl) {
      ctx.save();
      ctx.strokeStyle = scaleTpl.scaleAura || '#4ade80';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.ellipse(0, shCy, 66 * bSc, 21 * bSc, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.11)';
      ctx.beginPath(); ctx.ellipse(0, -52 * bSc - hover, 56 * bSc, 46 * bSc, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    let topY = -h + 14 * bSc - baseHover;

    ctx.save();
    ctx.translate(0, -hover + (pose.lungeY || 0));
    ctx.scale(facing, 1);

    if (isQinglong && spr) {
      // ★ 青龙专属【四爪踏云拨雾 + 无缝游龙推进波 + 100%刚性昂首龙颜】
      const qlParts = getCleanQinglongParts(spr);
      const qlMove = activeFlyMove;
      const info = drawSerpentineDragon(ctx, spr, qlParts, w, h, bSc, t, u.runPhase || 0, qlMove, u.hitFlash, pose);
      topY = info.topY - baseHover + (pose.lungeY || 0);

      // 青龙乘云破空向后掠过的流风丝带与东海苍雷灵芒
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      if (qlMove > 0.06) {
        for (let stIdx = 0; stIdx < 2; stIdx++) {
          const prog = ((t * 1.65 + stIdx * 0.5) % 1);
          const headX = (44 - prog * 118) * bSc;
          const streamLen = (26 + 16 * Math.sin(prog * Math.PI)) * bSc;
          const sy = (stIdx === 0 ? -20 : -54) * bSc + Math.sin(prog * Math.PI * 2 + stIdx) * 2.2 * bSc;
          ctx.strokeStyle = '#a7f3d0';
          ctx.lineWidth = (stIdx === 0 ? 1.8 : 1.3) * bSc;
          ctx.globalAlpha = Math.sin(prog * Math.PI) * 0.46 * qlMove;
          ctx.beginPath();
          ctx.moveTo(headX, sy);
          ctx.quadraticCurveTo(headX - streamLen * 0.5, sy - 2.0 * bSc, headX - streamLen, sy + 0.8 * bSc);
          ctx.stroke();
        }
      }
      for (let b = 0; b < 3; b++) {
        ctx.strokeStyle = b === 2 ? '#fef08a' : (b === 1 ? '#67e8f9' : '#34d399');
        ctx.lineWidth = 1.5;
        const arcProg = ((t * (1.15 + qlMove * 0.7) + b * 0.34) % 1);
        const bx = (36 - arcProg * 96) * bSc;
        const by = (-46 - b * 11 + Math.sin(arcProg * Math.PI * 2 + b) * 3.5) * bSc;
        ctx.globalAlpha = Math.sin(arcProg * Math.PI) * (0.40 + qlMove * 0.26);
        ctx.beginPath();
        ctx.moveTo(bx + 7 * bSc, by - 1.5 * bSc);
        ctx.lineTo(bx + 1 * bSc, by + 1.8 * bSc);
        ctx.lineTo(bx - 4 * bSc, by - 1.2 * bSc);
        ctx.lineTo(bx - 10 * bSc, by + 1.5 * bSc);
        ctx.stroke();
      }
      ctx.restore();
    } else if (isZhulong && spr) {
      // ★ 创世烛龙专属【九曜日冕神环 + 双巨翼扇动 + 双龙足阔步踏阵 + 擎日龙爪挥舞】
      const zlParts = getCleanZhulongParts(spr);
      const baseTopY = -h + (isBipedZhulong ? 10 : 13) * bSc;
      const haloCx = w * 0.16;
      const haloCy = baseTopY + h * 0.36;
      const haloR = (34 + 2.8 * Math.sin(t * 3.6)) * bSc;

      // 1. 背部旋转【太古钟山九曜日冕神环】
      ctx.save();
      ctx.translate(haloCx, haloCy);
      ctx.globalCompositeOperation = 'lighter';
      const sunGlow = ctx.createRadialGradient(0, 0, haloR * 0.16, 0, 0, haloR * 1.55);
      sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.56)');
      sunGlow.addColorStop(0.55, 'rgba(234, 88, 12, 0.30)');
      sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(0, 0, haloR * 1.55, 0, Math.PI * 2);
      ctx.fill();

      ctx.rotate(t * 0.92);
      ctx.strokeStyle = '#fde047';
      ctx.globalAlpha = 0.78;
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.arc(0, 0, haloR, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI * 2 * i) / 12;
        const rOut = haloR + (i % 2 === 0 ? 10.5 : 5.5) * bSc;
        ctx.fillStyle = i % 2 === 0 ? '#fef08a' : '#f97316';
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.085) * (haloR - 1.2), Math.sin(a - 0.085) * (haloR - 1.2));
        ctx.lineTo(Math.cos(a) * rOut, Math.sin(a) * rOut);
        ctx.lineTo(Math.cos(a + 0.085) * (haloR - 1.2), Math.sin(a + 0.085) * (haloR - 1.2));
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // 2. 分件骨骼真身渲染（双翼拍动 + 双龙足交替迈步 + 擎日烈阳呼吸）
      if (zlParts && zlParts.isBipedWinged) {
        const info = drawArticulatedWingedZhulong(ctx, spr, zlParts, w, h, u.moving, u.runPhase || 0, u.hitFlash, pose, mb, u.hitRecoil || 0, t, u.idlePhase || 0);
        topY = info.topY - baseHover + (pose.lungeY || 0);
      } else {
        const info = drawSerpentineDragon(ctx, spr, zlParts, w, h, bSc, t, u.runPhase || 0, activeFlyMove, u.hitFlash, pose);
        topY = info.topY - baseHover + (pose.lungeY || 0);
      }

      // 3. 周身升腾九阳金焰星火
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let e = 0; e < 5; e++) {
        const pEm = ((t * 1.45 + e * 0.20) % 1);
        const ex = (-42 + e * 21) * bSc + Math.sin(t * 6.2 + e * 1.7) * 5 * bSc;
        const ey = (-18 - pEm * 68) * bSc;
        ctx.globalAlpha = Math.sin(pEm * Math.PI) * 0.82;
        ctx.fillStyle = e % 2 === 0 ? '#fef08a' : '#f97316';
        ctx.beginPath();
        ctx.arc(ex, ey, (3.4 - pEm * 1.5) * bSc, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (isBirdBeast && spr) {
      // ★ 朱雀/鲲鹏专属【真肩轴双翼旋转鼓翼 + 独立凤尾/孔雀翎流波摆动】
      const info = drawArticulatedBirdBeast(ctx, u.id, spr, w, h, bSc, flapCycle, mb, u.hitFlash, pose, t);
      topY = info.topY - baseHover + (pose.lungeY || 0);
    } else if (isBaihu && spr) {
      // ★ 庚金白虎专属【真猛虎纵跃四拍骨骼 + 虎纹利爪 + 金翼扇动】：彻底根除原切图断爪残影！
      const info = drawArticulatedBaihu(ctx, spr, w, h, u.moving, u.runPhase || 0, u.hitFlash, pose, mb, u.hitRecoil || 0, t, u.idlePhase || 0);
      topY = info.topY - hover + (pose.lungeY || 0);
    } else if (isXuanwu && spr) {
      // ★ 玄冥玄武专属【完整玄蛇盘壳 + 四柱重甲铁爪沉步踏阵】：100%保留青色玄蛇盘腹不撕裂！
      const info = drawArticulatedXuanwu(ctx, spr, w, h, u.moving, u.runPhase || 0, u.hitFlash, pose, mb, u.hitRecoil || 0, t, u.idlePhase || 0);
      topY = info.topY - hover + (pose.lungeY || 0);

      // 玄武龟甲玄冥灵纹与玄蛇寒气呼吸光晕
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 + 0.16 * Math.sin(t * 4.2);
      const sg = ctx.createRadialGradient(-4 * bSc, -58 * bSc, 4 * bSc, -4 * bSc, -58 * bSc, 42 * bSc);
      sg.addColorStop(0, '#67e8f9');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(-4 * bSc, -58 * bSc, 42 * bSc, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (isQuadBeast && spr) {
      // ★ 麒麟/白泽/穷奇/混沌/饕餮/梼杌专属【真双骨骼四拍奔腾 + 翼尾联动 + 肩吞盖片】
      const info = drawArticulatedQuadBeast(ctx, u.id, spr, w, h, u.moving, u.runPhase || 0, u.hitFlash, pose, mb, u.hitRecoil || 0, t, u.idlePhase || 0);
      topY = info.topY - hover + (pose.lungeY || 0);
    } else {
      const info = drawArticulatedSprite(ctx, spr, w, h, u.moving, u.runPhase, u.hitFlash, {
        spriteKey: sprKey,
        isMounted: true,
        pose: Object.assign({}, pose, { lungeY: 0 }),
        moveBlend: mb,
        hitRecoil: u.hitRecoil || 0,
        idlePhase: u.idlePhase,
        inCombat: u.inCombat,
        time: t,
        uid: u.uid,
      });
      topY = info.topY - hover + (pose.lungeY || 0);
    }

    if (hornTpl) {
      ctx.save();
      ctx.fillStyle = hornTpl.hornColor || '#fde047';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-10, -h + 16); ctx.lineTo(0, -h - 2); ctx.lineTo(10, -h + 16);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // ★ 十二神兽各自专属普攻元素爆发特效（随巨兽体型等比放大）
    if (pose.strikeFlash > 0.06) {
      const sf = Math.min(1, pose.strikeFlash * 1.25);
      const cCol = clawTpl ? (clawTpl.clawColor || bCfg.glow) : bCfg.glow;
      ctx.save();
      ctx.scale(bSc, bSc);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = sf;

      if (isZhulong) {
        // 创世烛龙：太古烈阳贯日吐息 + 三重赤金撕天皇龙爪
        const rg = ctx.createRadialGradient(64, -62, 4, 64, -62, 46);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.35, '#fef08a');
        rg.addColorStop(0.72, '#ea580c');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(64, -62, 46, 0, Math.PI * 2); ctx.fill();

        const beamG = ctx.createLinearGradient(28, -68, 118, -42);
        beamG.addColorStop(0, '#ffffff');
        beamG.addColorStop(0.45, '#fde047');
        beamG.addColorStop(0.82, '#dc2626');
        beamG.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = beamG;
        ctx.beginPath();
        ctx.moveTo(28, -72);
        ctx.quadraticCurveTo(78, -88, 118, -48);
        ctx.quadraticCurveTo(76, -34, 28, -54);
        ctx.closePath();
        ctx.fill();

        ctx.lineCap = 'round';
        for (let k = -1; k <= 1; k++) {
          ctx.strokeStyle = k === 0 ? '#ffffff' : '#fde047';
          ctx.lineWidth = k === 0 ? 4.8 : 3.4;
          ctx.beginPath();
          ctx.moveTo(38, -68 + k * 13);
          ctx.quadraticCurveTo(76, -58 + k * 12, 112, -26 + k * 14);
          ctx.stroke();
        }
      } else if (isQinglong) {
        // 青龙：苍雷龙息球 + 闪电双龙爪撕裂
        const rg = ctx.createRadialGradient(58, -56, 3, 58, -56, 34);
        rg.addColorStop(0, '#ffffff');
        rg.addColorStop(0.45, '#6ee7b7');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(58, -56, 34, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2.8;
        for (let k = -1; k <= 1; k += 2) {
          ctx.beginPath();
          ctx.moveTo(34, -54 + k * 14);
          ctx.lineTo(54, -62 + k * 8);
          ctx.lineTo(72, -46 + k * 12);
          ctx.lineTo(96, -52 + k * 6);
          ctx.stroke();
        }
      } else if (isBirdBeast) {
        // 朱雀南明离火冲击波 / 鲲鹏北冥沧溟风刃波
        const fg = ctx.createLinearGradient(22, -62, 102, -32);
        fg.addColorStop(0, '#ffffff');
        fg.addColorStop(0.45, u.id === 'kunpeng' ? '#7dd3fc' : '#fde047');
        fg.addColorStop(0.8, u.id === 'kunpeng' ? '#2563eb' : '#ef4444');
        fg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(22, -64);
        ctx.quadraticCurveTo(68, -88, 104, -52);
        ctx.quadraticCurveTo(72, -40, 98, -22);
        ctx.quadraticCurveTo(54, -26, 22, -52);
        ctx.closePath();
        ctx.fill();
      } else if (isXuanwu || u.id === 'baize') {
        // 玄武玄冥冰棱 / 白泽瑞雪星辉光束
        const ig = ctx.createLinearGradient(22, -82, 98, -36);
        ig.addColorStop(0, '#ffffff');
        ig.addColorStop(0.5, '#67e8f9');
        ig.addColorStop(1, 'rgba(56, 189, 248, 0)');
        ctx.fillStyle = ig;
        ctx.beginPath();
        ctx.moveTo(24, -86);
        ctx.lineTo(100, -44);
        ctx.lineTo(90, -26);
        ctx.lineTo(20, -76);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(24, -81); ctx.lineTo(96, -36);
        ctx.stroke();
      } else if (u.id === 'qilin') {
        // 麒麟：祥瑞金焰踏火冲击弧
        const qg = ctx.createRadialGradient(64, -48, 4, 64, -48, 36);
        qg.addColorStop(0, '#ffffff');
        qg.addColorStop(0.45, '#fde047');
        qg.addColorStop(0.8, '#f97316');
        qg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = qg;
        ctx.beginPath(); ctx.arc(64, -48, 36, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.arc(46, -48, 38, -0.68, 0.68);
        ctx.stroke();
      } else {
        // 白虎/穷奇/混沌/饕餮/梼杌：狂暴四道交叉裂空利爪芒
        ctx.lineCap = 'round';
        for (let k = -1.5; k <= 1.5; k += 1) {
          ctx.strokeStyle = Math.abs(k) < 1 ? '#ffffff' : cCol;
          ctx.lineWidth = Math.abs(k) < 1 ? 5.2 : 3.6;
          ctx.beginPath();
          ctx.moveTo(30, -68 + k * 12);
          ctx.quadraticCurveTo(66, -56 + k * 12, 96, -24 + k * 13);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.restore();

    if (coreTpl) {
      const orbAng = (time || 0) * 3.6;
      const ox = Math.cos(orbAng) * 56 * bSc;
      const oy = -52 * bSc - hover + Math.sin(orbAng) * 17 * bSc;
      ctx.save();
      ctx.fillStyle = coreTpl.orbColor || '#fde047';
      ctx.shadowColor = coreTpl.orbColor || '#fde047';
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(ox, oy, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ox - 2, oy - 2, 2.8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    const lvLabel = u.lv ? `Lv.${u.lv} ${bCfg.name}` : bCfg.name;
    const label = `${lvLabel} ${Math.ceil(u.hp)}`;
    const anchorY = u.y + topY - 6;
    const eqItems = Object.values(eq);

    if (hudCollector) {
      hudCollector.push({
        kind: 'beast',
        isBossBeast: !!u.isWildBeast,
        uid: u.uid,
        x: worldX,
        anchorY,
        label,
        labelColor: bCfg.glow || '#fde047',
        barColor: u.side === 'player' ? '#22c55e' : '#ef4444',
        rageColor: bCfg.glow || '#38bdf8',
        rageRatio: (u.rage || 0) / 100,
        borderColor: bCfg.glow || '#38bdf8',
        hpRatio: u.hp / u.maxHp,
        stun: u.stunTimer > 0,
        eqItems,
      });
    } else {
      drawSingleNameplate(ctx, {
        kind: 'beast', isBossBeast: !!u.isWildBeast, x: worldX, cy: anchorY - 12, label,
        labelColor: bCfg.glow || '#fde047',
        barColor: u.side === 'player' ? '#22c55e' : '#ef4444',
        rageColor: bCfg.glow || '#38bdf8',
        rageRatio: (u.rage || 0) / 100,
        borderColor: bCfg.glow || '#38bdf8',
        hpRatio: u.hp / u.maxHp, stun: u.stunTimer > 0, eqItems,
      });
    }
  }

  // 绘制单个名将/神兽/物件/建筑顶层高清半透底铭牌
  function drawSingleNameplate(ctx, item) {
    ctx.save();
    if (item.kind === 'building_tag') {
      ctx.font = 'bold 10.5px "PingFang SC", "Microsoft YaHei", sans-serif';
      const tw = ctx.measureText(item.label).width;
      const pillW = tw + 14;
      const pillH = 18;
      const px = item.x - pillW / 2;
      const py = item.cy - pillH / 2;
      App.UI.roundRect(ctx, px, py, pillW, pillH, 9);
      ctx.fillStyle = 'rgba(15, 8, 4, 0.86)';
      ctx.fill();
      ctx.strokeStyle = item.borderColor || 'rgba(212, 163, 75, 0.55)';
      ctx.lineWidth = 1.15;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = item.labelColor || '#fef08a';
      ctx.fillText(item.label, item.x, py + pillH / 2 + 0.5);
      ctx.restore();
      return;
    }
    const isBeast = item.kind === 'beast';
    const isBossBeast = !!(isBeast && item.isBossBeast);
    const isMainBase = item.kind === 'main_base';
    ctx.font = `bold ${(isBossBeast ? 12.5 : ((isBeast || isMainBase) ? 11.5 : 10.5))}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    const textW = ctx.measureText(item.label).width;
    const barW = (isMainBase || isBossBeast) ? Math.max(108, textW + 10) : (isBeast ? Math.max(76, textW + 6) : Math.max(54, textW + 4));
    const pillW = barW + ((isMainBase || isBossBeast) ? 14 : 10);
    const pillH = (isMainBase || isBossBeast) ? 24 : (isBeast ? 22 : 21);
    const px = item.x - pillW / 2;
    const py = item.cy - pillH / 2;

    // 若铭牌被防重叠算法轻微移位，绘制一条极细指示连线指向单位头顶
    if (item.anchorY != null && Math.abs((py + pillH) - item.anchorY) > 8) {
      ctx.strokeStyle = item.borderColor || 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.moveTo(item.x, py + pillH);
      ctx.lineTo(item.origX != null ? item.origX : item.x, item.anchorY + 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 半透暗金圆角铭牌托底（彻底解决白字叠在银甲/白马/黄沙上看不清与被遮挡的问题！）
    App.UI.roundRect(ctx, px, py, pillW, pillH, isMainBase ? 7 : 6);
    ctx.fillStyle = isMainBase ? 'rgba(18, 9, 4, 0.86)' : 'rgba(14, 8, 4, 0.74)';
    ctx.fill();
    ctx.strokeStyle = item.borderColor || 'rgba(212, 163, 75, 0.48)';
    ctx.lineWidth = isMainBase ? 1.5 : 1.05;
    ctx.stroke();

    // 姓名 + 当前血量
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = item.labelColor || '#ffffff';
    ctx.fillText(item.label, item.x, py + (isMainBase ? 8 : 7.5));

    // 血条（内嵌在铭牌下半部；若拥有护盾则叠加冰晶蓝护盾进度条）
    const barY = py + (isMainBase ? 15 : 13.5);
    const barH = isMainBase ? 6.2 : (isBeast ? 5.5 : 5);
    App.UI.drawBar(ctx, item.x - barW / 2, barY, barW, barH, item.hpRatio, item.barColor, 'rgba(0,0,0,0.65)');
    if (item.shieldRatio && item.shieldRatio > 0.01) {
      const shW = Math.max(3, Math.min(barW, barW * item.shieldRatio));
      ctx.fillStyle = 'rgba(103, 232, 249, 0.88)';
      ctx.fillRect(item.x - barW / 2, barY, shW, 2.2);
    }

    // 穿戴装备微缩图标（紧贴铭牌上方居中排列）
    let topEdge = py;
    if (item.eqItems && item.eqItems.length > 0) {
      const iconSz = 13, gap = 2;
      let sx = item.x - (item.eqItems.length * iconSz + (item.eqItems.length - 1) * gap) / 2;
      const iy = py - iconSz - 2;
      item.eqItems.forEach((eqIt) => {
        drawEquipIcon(ctx, eqIt.tplId, sx, iy, iconSz, { radius: 3, lineWidth: 1.0 });
        sx += iconSz + gap;
      });
      topEdge = iy;
    }

    const tags = item.statusTags || (item.stun ? [{ txt: '★眩晕', col: '#fde047' }] : null);
    if (tags && tags.length > 0) {
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.strokeStyle = 'rgba(0,0,0,0.92)';
      ctx.lineWidth = 2.6;
      const joined = tags.map((t) => t.txt).join(' ');
      if (tags.length === 1) {
        ctx.strokeText(tags[0].txt, item.x, topEdge - 7);
        ctx.fillStyle = tags[0].col;
        ctx.fillText(tags[0].txt, item.x, topEdge - 7);
      } else {
        const totalW = ctx.measureText(joined).width;
        let tx = item.x - totalW / 2;
        ctx.textAlign = 'left';
        tags.forEach((tg, idx) => {
          const seg = idx < tags.length - 1 ? (tg.txt + ' ') : tg.txt;
          ctx.strokeText(seg, tx, topEdge - 7);
          ctx.fillStyle = tg.col;
          ctx.fillText(seg, tx, topEdge - 7);
          tx += ctx.measureText(seg).width;
        });
      }
    }
    ctx.restore();
  }

  /**
   * ★ 独立顶层战场 HUD 渲染器（在所有单位精灵绘制完毕后统一绘制 + 自动防重叠避让，零遮挡零叠字！）
   */
  function drawUnitHudLayer(ctx, hudList, viewX, viewW) {
    if (!hudList || !hudList.length) return;

    // 1. 先画小兵与箭塔的清爽纯血条
    for (let i = 0; i < hudList.length; i++) {
      const it = hudList[i];
      if (it.kind === 'soldier' || it.kind === 'tower') {
        App.UI.drawBar(ctx, it.x - it.w / 2, it.y, it.w, it.h, it.ratio, it.color);
      }
    }

    // 2. 提取将领、神兽、副本物件铭牌并测算尺寸，执行自动防重叠避让
    const plates = [];
    ctx.save();
    for (let i = 0; i < hudList.length; i++) {
      const it = hudList[i];
      if (it.kind !== 'general' && it.kind !== 'beast' && it.kind !== 'prop' && it.kind !== 'main_base' && it.kind !== 'building_tag') continue;
      const isBeast = it.kind === 'beast';
      const isBossBeast = !!(isBeast && it.isBossBeast);
      const isMainBase = it.kind === 'main_base';
      const isBldTag = it.kind === 'building_tag';
      ctx.font = `bold ${(isBossBeast ? 12.5 : ((isBeast || isMainBase) ? 11.5 : 10.5))}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      const tw = ctx.measureText(it.label).width;
      const pillW = isBldTag
        ? (tw + 14)
        : (((isMainBase || isBossBeast) ? Math.max(108, tw + 10) : (isBeast ? Math.max(76, tw + 6) : Math.max(54, tw + 4))) + ((isMainBase || isBossBeast) ? 14 : 10));
      const eqExtra = (it.eqItems && it.eqItems.length > 0) ? 15 : 0;
      const pillH = isBldTag ? 18 : ((isMainBase || isBossBeast) ? 24 : (isBeast ? 22 : 21));
      plates.push(Object.assign({}, it, {
        origX: it.x,
        cy: Math.max(58 + eqExtra, it.anchorY - pillH / 2 - 2),
        pillW,
        pillH,
        totalH: pillH + eqExtra,
      }));
    }
    ctx.restore();

    plates.sort((a, b) => a.cy - b.cy || a.x - b.x);

    // 3轮轻量碰撞推开：相邻将领血条自动上下错位排布，绝不互相盖字！
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < plates.length; i++) {
        for (let j = i + 1; j < plates.length; j++) {
          const a = plates[i], b = plates[j];
          const minDx = (a.pillW + b.pillW) * 0.5 + 4;
          const dx = b.x - a.x;
          if (Math.abs(dx) >= minDx) continue;

          const minDy = (a.totalH + b.totalH) * 0.5 + 3;
          const dy = b.cy - a.cy;
          if (Math.abs(dy) < minDy) {
            const push = (minDy - Math.abs(dy)) * 0.52;
            const sign = dy >= 0 ? 1 : -1;
            a.cy -= sign * push;
            b.cy += sign * push;
            if (Math.abs(dx) < 16) {
              const hNudge = ((a.uid || i) < (b.uid || j) ? -1 : 1) * 5;
              a.x += hNudge;
              b.x -= hNudge;
            }
          }
        }
      }
      for (let i = 0; i < plates.length; i++) {
        const p = plates[i];
        const minCy = 56 + ((p.eqItems && p.eqItems.length > 0) ? 14 : 0);
        if (p.cy < minCy) p.cy = minCy;
        if (viewW != null && p.origX > viewX - 20 && p.origX < viewX + viewW + 20) {
          p.x = Math.max(viewX + p.pillW / 2 + 4, Math.min(viewX + viewW - p.pillW / 2 - 4, p.x));
        }
      }
    }

    for (let i = 0; i < plates.length; i++) {
      drawSingleNameplate(ctx, plates[i]);
    }
  }

  function drawSkillBackdrop(ctx, fx, viewX, viewW) {
    if (App.SkillVFX && App.SkillVFX.renderBackdrop) {
      App.SkillVFX.renderBackdrop(ctx, fx, viewX, viewW);
    }
  }

  function drawSkillEffect(ctx, fx, viewX, viewW) {
    if (App.SkillVFX && App.SkillVFX.renderForeground) {
      App.SkillVFX.renderForeground(ctx, fx, viewX, viewW);
    } else if (App.SkillVFX && App.SkillVFX.render) {
      App.SkillVFX.render(ctx, fx, viewX, viewW);
    }
  }

  function drawDisasterOverlay(ctx, battle, viewX, viewW, time) {
    const dis = battle.activeDisaster;
    if (!dis) return;
    const H = 418;

    ctx.save();
    ctx.fillStyle = dis.tint || 'rgba(0,0,0,0.12)';
    ctx.fillRect(viewX, 0, viewW, H);

    if (dis.id === 'gale') {
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.58)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 22; i++) {
        const gx = viewX + viewW - ((time * 620 + i * 97) % (viewW + 140));
        const gy = 55 + ((i * 53) % 340);
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.quadraticCurveTo(gx + 42, gy - 8, gx + 88, gy - 2);
        ctx.stroke();
      }
    } else if (dis.id === 'rain') {
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.65)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 48; i++) {
        const rx = viewX + ((i * 67 - time * 240 + 9600) % viewW);
        const ry = (time * 540 + i * 43) % H;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 10, ry + 22);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(191, 219, 254, 0.45)';
      for (let r = 0; r < 10; r++) {
        const px = viewX + ((r * 113 + Math.floor(time * 4) * 37) % viewW);
        const py = 210 + ((r * 41) % 185);
        const rr = ((time * 3 + r * 0.3) % 1) * 14;
        ctx.beginPath();
        ctx.ellipse(px, py, rr, rr * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (dis.id === 'hail') {
      for (let i = 0; i < 26; i++) {
        const hx = viewX + ((i * 83 - time * 150 + 9600) % viewW);
        const hy = (time * 430 + i * 59) % H;
        ctx.fillStyle = '#e0f2fe';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(hx, hy, 4.2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (dis.id === 'plague') {
      for (let i = 0; i < 8; i++) {
        const mx = viewX + ((i * 155 + time * 32) % (viewW + 120)) - 60;
        const my = 185 + ((i * 37) % 190);
        const g = ctx.createRadialGradient(mx, my, 8, mx, my, 82);
        g.addColorStop(0, 'rgba(132, 204, 22, 0.32)');
        g.addColorStop(0.6, 'rgba(107, 33, 168, 0.18)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx, my, 82, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(190, 242, 100, 0.68)';
      for (let b = 0; b < 18; b++) {
        const bx = viewX + ((b * 79) % viewW);
        const by = 390 - ((time * 65 + b * 31) % 210);
        ctx.beginPath();
        ctx.arc(bx, by, 2.8 + (b % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (dis.id === 'sandstorm') {
      ctx.fillStyle = 'rgba(253, 224, 71, 0.55)';
      for (let i = 0; i < 42; i++) {
        const sx = viewX + viewW - ((time * 520 + i * 73) % (viewW + 80));
        const sy = 50 + ((i * 39 + Math.sin(time * 4 + i) * 18 + 400) % 355);
        ctx.beginPath();
        ctx.ellipse(sx, sy, 6 + (i % 4) * 3, 2, -0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (dis.id === 'blizzard') {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.82)';
      for (let i = 0; i < 46; i++) {
        const bx = viewX + viewW - ((time * 460 + i * 69) % (viewW + 60));
        const by = (time * 280 + i * 47) % H;
        ctx.beginPath();
        ctx.arc(bx, by, 2.2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (dis.id === 'meteor') {
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.78)';
      ctx.lineWidth = 2.6;
      for (let i = 0; i < 14; i++) {
        const mx = viewX + ((i * 127 - time * 380 + 9800) % viewW);
        const my = (time * 480 + i * 71) % H;
        ctx.beginPath();
        ctx.moveTo(mx + 22, my - 28);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(mx, my, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (dis.id === 'thunderstorm') {
      if (Math.sin(time * 19) > 0.92) {
        ctx.fillStyle = 'rgba(233, 213, 255, 0.16)';
        ctx.fillRect(viewX, 0, viewW, H);
      }
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.65)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 28; i++) {
        const rx = viewX + ((i * 79 - time * 210 + 9600) % viewW);
        const ry = (time * 560 + i * 53) % H;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 8, ry + 20);
        ctx.stroke();
      }
    } else if (dis.id === 'fog') {
      for (let i = 0; i < 8; i++) {
        const fx = viewX + ((i * 190 - time * 45 + 9600) % (viewW + 180)) - 90;
        const fy = 85 + (i % 4) * 75;
        ctx.fillStyle = 'rgba(226, 232, 240, 0.14)';
        ctx.beginPath();
        ctx.ellipse(fx, fy, 130, 34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (dis.id === 'drought') {
      ctx.fillStyle = 'rgba(253, 224, 71, 0.35)';
      for (let i = 0; i < 24; i++) {
        const ex = viewX + ((i * 97 + Math.sin(time * 2.5 + i) * 24) % viewW);
        const ey = H - ((time * 95 + i * 43) % (H - 60));
        ctx.beginPath();
        ctx.arc(ex, ey, 2 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // ★ 局内对战：随军悬浮的【镇军法宝真身】（旋转八卦星轨 + 圣器高清本相 + 蓄力神威环 + 精致悬浮铭牌！）
  function drawBattleArtifact(ctx, relic, time) {
    if (!relic) return;
    const t = time || 0;
    const flash = relic.castFlash || 0;
    const bob = Math.sin(t * 3.1 + (relic.side === 'player' ? 0 : 1.7)) * 4.5;
    const cx = relic.x;
    const cy = relic.y + bob;
    const col = relic.color || '#facc15';
    const subCol = relic.subColor || '#fef08a';
    const isGold = relic.quality === 'gold';
    const isPurple = relic.quality === 'purple';
    const scale = 1 + flash * 0.22;
    const chargeRatio = relic.pulseInterval > 0
      ? Math.max(0, Math.min(1, 1 - (relic.pulseTimer || 0) / relic.pulseInterval))
      : 0;

    ctx.save();
    ctx.translate(cx, cy);
    if (scale !== 1) ctx.scale(scale, scale);

    // 1. 柔和仙灵背光晕 + 神威爆发扩散波
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const haloR = (isGold ? 40 : 34) + flash * 16;
    const rg = ctx.createRadialGradient(0, 0, 5, 0, 0, haloR);
    rg.addColorStop(0, col + (flash > 0.1 ? '99' : '55'));
    rg.addColorStop(0.6, col + '24');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.fill();

    // 外层顺时针旋转流金八卦符阵环
    ctx.save();
    ctx.rotate(t * (isGold ? 1.55 : 1.15));
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.65 + flash * 0.30;
    ctx.lineWidth = isGold ? 1.8 : 1.4;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const orbCnt = isGold ? 6 : (isPurple ? 4 : 3);
    for (let i = 0; i < orbCnt; i++) {
      const a = (Math.PI * 2 * i) / orbCnt;
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : subCol;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 27, Math.sin(a) * 27, isGold ? 2.4 : 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 飘逸升腾灵火微粒
    for (let m = 0; m < 3; m++) {
      const mp = (t * 0.9 + m * 0.33) % 1;
      const mx = Math.sin(t * 3.6 + m * 2.1) * 18;
      const my = 16 - mp * 34;
      ctx.globalAlpha = Math.sin(mp * Math.PI) * 0.78;
      ctx.fillStyle = m === 0 ? '#ffffff' : subCol;
      ctx.beginPath();
      ctx.arc(mx, my, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. 法宝高清真身圆章框 (38×38)
    const sz = 38;
    const half = sz / 2;
    ctx.save();
    App.UI.roundRect(ctx, -half, -half, sz, sz, 10);
    ctx.clip();
    ctx.fillStyle = '#240f08';
    ctx.fillRect(-half, -half, sz, sz);
    const img = App.Assets && App.Assets.get(relic.imgKey);
    if (img) {
      ctx.drawImage(img, -half, -half, sz, sz);
    } else {
      ctx.fillStyle = subCol;
      ctx.font = 'bold 12px "PingFang SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(relic.name || '法宝').slice(0, 2), 0, 0);
    }
    if (flash > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255, 251, 235, ${(flash * 0.45).toFixed(2)})`;
      ctx.fillRect(-half, -half, sz, sz);
    }
    ctx.restore();

    // 鎏金描边与外环神威蓄力进度弧
    App.UI.roundRect(ctx, -half, -half, sz, sz, 10);
    ctx.strokeStyle = flash > 0.2 ? '#ffffff' : col;
    ctx.lineWidth = 2.1;
    ctx.stroke();

    if (chargeRatio > 0.03) {
      ctx.save();
      ctx.strokeStyle = chargeRatio > 0.88 ? '#ffffff' : subCol;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 23.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeRatio);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // 3. 法宝头顶凝练黑金悬浮小铭牌（不随呼吸缩放抖动，字迹锐利清晰）
    ctx.save();
    const tagTxt = `${relic.side === 'player' ? '★' : '❖'}${String(relic.name || '法宝').slice(0, 5)} Lv.${relic.lv}`;
    ctx.font = 'bold 9.5px "PingFang SC", "Microsoft YaHei", sans-serif';
    const tw = ctx.measureText(tagTxt).width;
    const pw = tw + 12, ph = 15;
    const px = cx - pw / 2, py = cy - 39;
    App.UI.roundRect(ctx, px, py, pw, ph, 7.5);
    ctx.fillStyle = relic.side === 'player' ? 'rgba(28, 10, 6, 0.86)' : 'rgba(30, 12, 24, 0.86)';
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = subCol;
    ctx.fillText(tagTxt, cx, py + ph / 2 + 0.5);
    ctx.restore();
  }

  function drawDyingUnit(ctx, d) {
    const p = clamp01(1 - d.dieTimer / d.maxDie);
    const facing = d.facing || 1;
    const resolvedKey = d.kind === 'soldier' ? resolveTroopSpriteKey(d.id, d.spriteKey, d.side) : d.spriteKey;
    const spr = App.Assets.get(resolvedKey) || App.Assets.get(d.spriteKey) || (d.kind === 'general' ? App.Assets.get('unit_gen_silver') : null);
    if (!spr) return;
    const knock = easeOutCubic(p) * 22;
    const hopY = -Math.sin(Math.min(1, p * 1.45) * Math.PI) * 7;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p * p);
    ctx.translate(d.x - facing * knock, d.y + hopY);
    ctx.scale(facing, 1 - p * 0.22);
    ctx.rotate(-easeOutQuad(p) * 1.28);
    const dieScale = d.scale || (d.isWildBeast ? 1.52 : 1);
    const h = (d.kind === 'beast' ? 136 : (d.kind === 'general' ? 88 : (d.isMounted ? 74 : 58))) * dieScale;
    const w = (spr.width / spr.height) * h;
    ctx.drawImage(spr, -w / 2, -h + 8, w, h);
    ctx.restore();
  }

  function drawProjectile(ctx, p, time) {
    if (!p) return;

    if (p.ballistic) {
      const cx = p.cx != null ? p.cx : p.x1;
      const cy = p.cy != null ? p.cy : p.y1;
      const ang = p.ang != null ? p.ang : 0;
      const trail = p.trail || [];
      const isFan = p.kind === 'fan_wave' || p.kind === 'gen_fan';
      const isGen = p.kind === 'gen_arrow' || p.kind === 'gen_fan';
      const isTower = p.kind === 'tower_arrow';

      ctx.save();
      if (trail.length >= 2) {
        const isThunderBolt = p.atkVfx === 'thunder_arc';
        for (let i = 1; i < trail.length; i++) {
          const ratio = i / trail.length;
          const towerCol = p.side === 'player' ? '#4ade80' : '#fb923c';
          ctx.strokeStyle = p.atkVfx ? p.color : (isFan ? p.color : (isTower ? towerCol : (isGen ? '#fde047' : 'rgba(255,255,255,0.78)')));
          ctx.globalAlpha = ratio * (p.atkVfx ? 0.85 : (isFan ? 0.65 : 0.52));
          ctx.lineWidth = (p.atkVfx ? 5.2 : (isGen ? 4.2 : 2.6)) * ratio;
          ctx.lineCap = 'round';
          const jitterY = isThunderBolt ? ((i % 2 === 0 ? 1 : -1) * 4.5 * ratio) : 0;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y + jitterY);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      if (isFan) {
        const scale = (isGen ? 1.28 : 0.95) * (p.atkVfx ? 1.15 : 1);
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.scale(scale, scale);

        ctx.fillStyle = p.color || '#2dd4bf';
        ctx.globalAlpha = p.atkVfx ? 0.42 : 0.28;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = p.color || '#2dd4bf';
        ctx.beginPath();
        ctx.arc(-2, 0, 13, -1.15, 1.15, false);
        ctx.arc(-8, 0, 11.5, 1.05, -1.05, true);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.coreColor || '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 10.5, -0.85, 0.85, false);
        ctx.arc(-4.5, 0, 9.2, 0.78, -0.78, true);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(2, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
        for (let s = 0; s < (p.atkVfx ? 4 : 3); s++) {
          const sa = (time || 0) * 14 + s * 2.1;
          ctx.fillStyle = s === 0 ? '#ffffff' : (p.color || '#c084fc');
          ctx.beginPath();
          ctx.arc(-8 - s * 4, Math.sin(sa) * 5.0, p.atkVfx ? 2.2 : 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const scale = (isGen ? 1.25 : (isTower ? 1.12 : 0.96)) * (p.atkVfx ? 1.18 : 1);
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.scale(scale, scale);

        // 神兵灵矢外层流焰/雷霆光罩
        if (p.atkVfx) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = p.color;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.ellipse(2, 0, 16, 4.8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        ctx.strokeStyle = p.atkVfx ? (p.coreColor || '#ffffff') : (isGen ? '#fde047' : '#d97706');
        ctx.lineWidth = p.atkVfx ? 2.6 : 2.2;
        ctx.beginPath();
        ctx.moveTo(-16, 0);
        ctx.lineTo(9, 0);
        ctx.stroke();

        ctx.fillStyle = p.atkVfx ? p.color : (isTower ? (p.side === 'player' ? '#4ade80' : '#f97316') : (p.side === 'player' ? '#ef4444' : '#cbd5e1'));
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(-17, -4.4); ctx.lineTo(-14, 0); ctx.lineTo(-17, 4.4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = p.atkVfx ? '#ffffff' : (isGen ? '#fef08a' : '#f8fafc');
        ctx.strokeStyle = p.atkVfx ? p.color : '#0f172a';
        ctx.lineWidth = p.atkVfx ? 1.3 : 0.9;
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(5, -3.8);
        ctx.lineTo(7, 0);
        ctx.lineTo(5, 3.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        if (isTower || isGen) {
          ctx.fillStyle = p.atkVfx ? (p.color + 'aa') : (isTower ? (p.side === 'player' ? 'rgba(74, 222, 128, 0.72)' : 'rgba(251, 146, 60, 0.72)') : 'rgba(250, 204, 21, 0.65)');
          ctx.beginPath();
          ctx.ellipse(6, 0, p.atkVfx ? 10 : 8, p.atkVfx ? 3.8 : 3.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    const ratio = clamp01(1 - p.life / p.maxLife);
    ctx.save();

    if (p.kind === 'relic_beam') {
      ctx.globalCompositeOperation = 'lighter';
      const a = Math.max(0, 1 - ratio * 0.88);
      const col = p.color || '#facc15';
      const core = p.coreColor || '#fef9c3';
      const mx = (p.x1 + p.x2) * 0.5;
      const my = Math.min(p.y1, p.y2) - 38;

      // 天降法宝神光贯日弧束
      ctx.globalAlpha = a * 0.72;
      ctx.strokeStyle = col;
      ctx.lineWidth = (p.isPrimary ? 7.5 : 5.2) * (1 - ratio * 0.45);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.quadraticCurveTo(mx, my, p.x2, p.y2);
      ctx.stroke();

      ctx.globalAlpha = a * 0.92;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = (p.isPrimary ? 2.8 : 1.9) * (1 - ratio * 0.45);
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.quadraticCurveTo(mx, my, p.x2, p.y2);
      ctx.stroke();

      // 落地镇压符阵光环
      const rr = (12 + ratio * (p.isPrimary ? 34 : 24));
      ctx.globalAlpha = Math.max(0, (1 - ratio) * 0.82);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.6 * (1 - ratio * 0.5);
      ctx.beginPath();
      ctx.ellipse(p.x2, p.y2 + 12, rr, rr * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = core;
      ctx.lineWidth = 1.3 * (1 - ratio);
      ctx.beginPath();
      ctx.ellipse(p.x2, p.y2 + 12, rr * 0.62, rr * 0.26, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'impact_ring') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, 1 - ratio);
      ctx.strokeStyle = p.color || '#fef08a';
      ctx.lineWidth = 3.2 * (1 - ratio * 0.6);
      const r = 8 + ratio * (p.isFan ? 32 : 20);
      ctx.beginPath();
      ctx.ellipse(p.x2, p.y2, r, r * 0.58, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * (1 - ratio);
      ctx.beginPath();
      ctx.ellipse(p.x2, p.y2, r * 0.65, r * 0.38, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'clash_star') {
      // 兵刃交击清脆寒星（克制凝练，杜绝光团遮挡）
      const sc = Math.min(1.05, p.scale || 1) * (1 - ratio * 0.48);
      ctx.globalAlpha = Math.max(0, (1 - ratio) * 0.72);
      ctx.translate(p.x2, p.y2);
      ctx.rotate(0.35 + ratio * 0.75);
      ctx.fillStyle = p.color || '#fde047';
      for (let k = 0; k < 2; k++) {
        ctx.rotate(Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(-11 * sc, 0);
        ctx.lineTo(0, -1.8 * sc);
        ctx.lineTo(11 * sc, 0);
        ctx.lineTo(0, 1.8 * sc);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 2.4 * sc, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'weapon_burst') {
      // ★ 穿戴史诗/神装武器命中特效（清透利落的元素纹章裂痕，零泛白光污染！）
      const dir = p.dir || 1;
      const sc = Math.min(1.15, p.scale || 1.0);
      const wAlpha = Math.max(0, 1 - ratio * 0.90);
      const sz = (44 + ratio * 22) * sc;
      if (App.SkillVFX && App.SkillVFX.drawPaintedBurst) {
        App.SkillVFX.drawPaintedBurst(
          ctx,
          p.vfxTex1 || 'vfx_dragon_slash',
          p.vfxTex2 || 'vfx_crimson_slash',
          p.x2, p.y2, sz, sz,
          ratio * 0.40 * dir, wAlpha * 0.42,
          p.color || '#fde047', dir < 0, 0.35
        );
      }
      ctx.globalAlpha = wAlpha * 0.78;
      ctx.translate(p.x2, p.y2);

      const atkStyle = p.atkVfx || 'dragon_gold';
      const col = p.color || '#fde047';
      const core = p.coreColor || '#ffffff';

      if (atkStyle === 'thunder_arc') {
        ctx.strokeStyle = core;
        ctx.lineWidth = 1.8 * (1 - ratio * 0.4);
        for (let b = 0; b < 4; b++) {
          const ba = b * (Math.PI / 2) + 0.4 + ratio * 0.3;
          ctx.save();
          ctx.rotate(ba);
          ctx.beginPath();
          ctx.moveTo(3, 0);
          ctx.lineTo(9 * sc, -4 * sc);
          ctx.lineTo(15 * sc, 3 * sc);
          ctx.lineTo((21 + ratio * 10) * sc, -1.5 * sc);
          ctx.stroke();
          ctx.restore();
        }
      } else if (atkStyle === 'flame_slash') {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.0 * (1 - ratio * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, (11 + ratio * 16) * sc, 0, Math.PI * 2);
        ctx.stroke();
      } else if (atkStyle === 'frost_shatter') {
        for (let k = 0; k < 6; k++) {
          const ka = (Math.PI / 3) * k + ratio * 0.25;
          const kr = (6 + ratio * 15) * sc;
          ctx.save();
          ctx.rotate(ka);
          ctx.fillStyle = k % 2 === 0 ? '#ffffff' : col;
          ctx.beginPath();
          ctx.moveTo(kr + 6 * sc, 0);
          ctx.lineTo(kr, -2.0 * sc);
          ctx.lineTo(kr - 3 * sc, 0);
          ctx.lineTo(kr, 2.0 * sc);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else if (atkStyle === 'blood_crescent') {
        for (let s = -1; s <= 1; s += 2) {
          ctx.save();
          ctx.rotate(s * 0.62);
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.ellipse(0, 0, (19 + ratio * 10) * sc, 2.6 * sc * (1 - ratio * 0.5), 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      } else if (atkStyle === 'starfall_arcane') {
        ctx.rotate(ratio * 1.4);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        const sr = (12 + ratio * 14) * sc;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k;
          if (k === 0) ctx.moveTo(Math.cos(a) * sr, Math.sin(a) * sr);
          else ctx.lineTo(Math.cos(a) * sr, Math.sin(a) * sr);
        }
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.0 * (1 - ratio * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, (11 + ratio * 16) * sc, -0.4 + ratio * 2, 2.4 + ratio * 2);
        ctx.stroke();
      }
    } else if (p.kind === 'beast_strike') {
      const dir = p.dir || 1;
      const sc = p.scale || 1.25;
      const bid = p.beastId || 'baihu';
      const bAlpha = Math.max(0, 1 - ratio * 0.88);
      const sz = (62 + ratio * 34) * sc;
      if (App.SkillVFX && App.SkillVFX.drawPaintedBurst) {
        if (bid === 'zhulong') {
          const zSz = sz * 1.24;
          App.SkillVFX.drawPaintedBurst(ctx, 'vfx_fire', 'vfx_dragon_slash', p.x2, p.y2 - 8, zSz, zSz, ratio * 0.45 * dir, bAlpha * 0.82, '#fbbf24', dir < 0, 0.35);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = '#fde047';
          ctx.globalAlpha = bAlpha * 0.72;
          ctx.lineWidth = 2.6 * (1 - ratio * 0.5);
          ctx.beginPath();
          ctx.ellipse(p.x2, p.y2 - 4, zSz * (0.32 + ratio * 0.28), zSz * (0.14 + ratio * 0.12), 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (bid === 'qinglong') {
          App.SkillVFX.drawPaintedBurst(ctx, 'vfx_dragon_slash', 'vfx_thunder', p.x2, p.y2, sz, sz, ratio * 0.6 * dir, bAlpha * 0.65, null, dir < 0, 0);
        } else if (bid === 'zhuque' || bid === 'qilin' || bid === 'taowu') {
          App.SkillVFX.drawPaintedBurst(ctx, 'vfx_fire', 'vfx_fire', p.x2, p.y2 - 6, sz, sz * 1.05, 0, bAlpha * 0.65, bid === 'qilin' ? '#fde047' : null, dir < 0, bid === 'qilin' ? 0.35 : 0);
        } else if (bid === 'xuanwu' || bid === 'baize') {
          App.SkillVFX.drawPaintedBurst(ctx, 'vfx_ice', 'vfx_ice', p.x2, p.y2, sz, sz, 0, bAlpha * 0.65, null, dir < 0, 0);
        } else if (bid === 'kunpeng' || bid === 'hundun') {
          App.SkillVFX.drawPaintedBurst(ctx, 'vfx_water_tsunami', 'vfx_thunder', p.x2, p.y2, sz, sz, 0, bAlpha * 0.65, bid === 'hundun' ? '#f472b6' : null, dir < 0, bid === 'hundun' ? 0.45 : 0);
        } else {
          App.SkillVFX.drawPaintedBurst(ctx, 'vfx_tiger_roar', 'vfx_crimson_slash', p.x2, p.y2, sz, sz, 0, bAlpha * 0.62, '#fbbf24', dir < 0, 0.55);
        }
      }
    } else if (p.kind === 'thrust') {
      const sc = Math.min(1.18, p.scale || 1);
      const ang = Math.atan2((p.y2 || 0) - (p.y1 || 0), (p.x2 || 0) - (p.x1 || 0));
      const tAlpha = Math.max(0, (1 - ratio * 0.88) * 0.72);
      ctx.globalAlpha = tAlpha;
      ctx.translate(p.x1, p.y1);
      ctx.rotate(ang);
      const len = (34 + ratio * 22) * sc;

      const tg = ctx.createLinearGradient(-6, 0, len + 6, 0);
      tg.addColorStop(0, 'rgba(0,0,0,0)');
      tg.addColorStop(0.45, p.color || '#38bdf8');
      tg.addColorStop(1, '#ffffff');
      ctx.fillStyle = tg;
      ctx.beginPath();
      ctx.moveTo(-4, -3.8 * sc);
      ctx.lineTo(len, 0);
      ctx.lineTo(-4, 3.8 * sc);
      ctx.closePath();
      ctx.fill();
    } else {
      const dir = p.dir || 1;
      const sc = Math.min(1.18, p.scale || 1);
      const r = (19 + ratio * 15) * sc;
      const sAlpha = Math.max(0, (1 - ratio * 0.86) * 0.72);
      ctx.globalAlpha = sAlpha;
      ctx.translate(p.x2, p.y2);
      ctx.scale(dir, 1);
      ctx.rotate(-0.18 + ratio * 0.36);

      ctx.fillStyle = p.color || '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, r, -1.08, 1.08, false);
      ctx.arc(-5 * sc, 0, r * 0.80, 1.00, -1.00, true);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  App.Sprites = {
    resolveTroopSpriteKey,
    drawEquipIcon,
    drawUiSetAura,
    drawBattlefieldTerrain,
    drawWatchTower,
    drawMountedGeneral,
    drawProp,
    drawSoldierSprite,
    drawGiantBeastSprite,
    drawBattleArtifact,
    drawUnitHudLayer,
    drawSkillBackdrop,
    drawSkillEffect,
    drawDisasterOverlay,
    drawDyingUnit,
    drawProjectile,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
