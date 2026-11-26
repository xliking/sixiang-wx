(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 离屏高清合成头像缓存（LRU 上限 48 张，复用单张面部遮罩画布，零临时画布分配）
  const compositeCache = new Map();
  let sharedFaceScratch = null;

  function createOffscreen(sz) {
    if (App.Platform && App.Platform.createOffscreen) {
      return App.Platform.createOffscreen(sz, sz);
    }
    if (typeof document !== 'undefined' && document.createElement) {
      const c = document.createElement('canvas');
      c.width = sz;
      c.height = sz;
      return c;
    }
    if (typeof wx !== 'undefined' && wx.createCanvas) {
      const c = wx.createCanvas();
      c.width = sz;
      c.height = sz;
      return c;
    }
    return null;
  }

  function drawStageFactionBadge(ctx, g, x, y, size) {
    if (!g || !g.isStageBoss || size < 44) return;
    const facCol = g.faction === 'wei' ? '#2563eb' : (g.faction === 'shu' ? '#16a34a' : (g.faction === 'wu' ? '#dc2626' : '#9333ea'));
    const facTxt = g.faction === 'wei' ? '魏' : (g.faction === 'shu' ? '蜀' : (g.faction === 'wu' ? '吴' : '群'));
    const br = Math.max(7.5, size * 0.11);
    ctx.save();
    ctx.fillStyle = facCol;
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x + br + 3, y + br + 3, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(br * 1.1)}px "PingFang SC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(facTxt, x + br + 3, y + br + 3.5);
    ctx.restore();
  }

  /**
   * 渲染名将与守将头像：
   * 全部 54 位三国名将与 770 位关卡守将均严格加载各自的专属手绘立绘文件（generals/<gid>.jpg），
   * 网络首帧尚未加载完成时使用该武将自身衣冠特征渲染，绝不借用或回退为其他名将头像！
   */
  function drawGeneralPortrait(ctx, gid, x, y, size, opts) {
    const o = opts || {};
    const g = App.Config.GENERALS[gid];
    const r = o.radius != null ? o.radius : 10;

    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.clip();

    const portraitKey = (g && g.imgKey) || ('general_' + gid);
    const realFileImg = App.Assets.get(portraitKey);
    if (realFileImg) {
      ctx.drawImage(realFileImg, x, y, size, size);
      drawStageFactionBadge(ctx, g, x, y, size);
    } else if (g) {
      drawChibiGeneral(ctx, g, x, y, size);
      drawStageFactionBadge(ctx, g, x, y, size);
    } else {
      drawSoldierPortrait(ctx, o.unitType || 'spear', x, y, size);
    }
    ctx.restore();

    const effGen = (o.ascend === undefined && !o.raw && App.State && App.State.getEffectiveGeneral)
      ? App.State.getEffectiveGeneral(gid)
      : null;
    const ascPath = o.ascend !== undefined ? o.ascend : (effGen && effGen.ascend) || '';
    const ascBorder = ascPath === 'xian' ? '#38bdf8' : (ascPath === 'mo' ? '#e879f9' : null);

    // 稀有度/阵营/神魔边框
    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.strokeStyle = o.border || ascBorder || (g && g.portraitSpec ? g.portraitSpec.crestColor : getRarityColor(g ? g.rarity : 'B'));
    ctx.lineWidth = o.lineWidth || (ascBorder ? 2.2 : 2);
    ctx.stroke();

    // 右上角神/魔道果印记角标
    if ((ascPath === 'xian' || ascPath === 'mo') && size >= 34) {
      const isXian = ascPath === 'xian';
      const br = Math.max(7.5, Math.min(11.5, size * 0.135));
      const bx = x + size - br - 2.5;
      const by = y + br + 2.5;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = isXian ? 'rgba(8, 51, 68, 0.94)' : 'rgba(74, 4, 78, 0.94)';
      ctx.fill();
      ctx.strokeStyle = isXian ? '#67e8f9' : '#f472b6';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = isXian ? '#ecfeff' : '#fdf4ff';
      ctx.font = `bold ${Math.max(9, Math.round(br * 1.12))}px "PingFang SC", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isXian ? '神' : '魔', bx, by + 0.5);
    }
    ctx.restore();
  }

  function getRarityColor(rarity) {
    if (rarity === 'SSS') return '#f43f5e';
    if (rarity === 'SS') return '#facc15';
    if (rarity === 'S') return '#c084fc';
    if (rarity === 'A') return '#38bdf8';
    if (rarity === 'B') return '#4ade80';
    return '#64748b';
  }

  function drawChibiGeneral(ctx, g, x, y, s) {
    const v = g.visual || {};
    const cx = x + s / 2;
    const cy = y + s / 2;

    // 背景渐变（按阵营色调）
    const bgMap = {
      wei: ['#1e3a8a', '#0f172a'],
      shu: ['#065f46', '#06281e'],
      wu: ['#991b1b', '#2b0909'],
      qun: ['#581c87', '#180c24'],
    };
    const bgc = bgMap[g.faction] || bgMap.qun;
    const grad = ctx.createRadialGradient(cx, cy - s * 0.1, s * 0.08, cx, cy, s * 0.7);
    grad.addColorStop(0, bgc[0]);
    grad.addColorStop(1, bgc[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, s, s);

    // 背后光晕圆环
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.05, s * 0.36, 0, Math.PI * 2);
    ctx.fill();

    // 吕布双赤红长翎 / 赵云银缨（头后装饰）
    if (v.feature === 'lvbu_plumes') {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(2, s * 0.055);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.08, cy - s * 0.25);
      ctx.quadraticCurveTo(cx - s * 0.38, cy - s * 0.52, cx - s * 0.44, cy - s * 0.14);
      ctx.moveTo(cx + s * 0.08, cy - s * 0.25);
      ctx.quadraticCurveTo(cx + s * 0.38, cy - s * 0.52, cx + s * 0.44, cy - s * 0.14);
      ctx.stroke();
    }

    // 身体/铠甲（Q版大肩甲）
    ctx.fillStyle = v.robe || '#334155';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.2, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.34, y + s);
    ctx.quadraticCurveTo(cx - s * 0.32, cy + s * 0.12, cx, cy + s * 0.10);
    ctx.quadraticCurveTo(cx + s * 0.32, cy + s * 0.12, cx + s * 0.34, y + s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 领口/甲片滚边
    ctx.strokeStyle = v.trim || '#facc15';
    ctx.lineWidth = Math.max(1.5, s * 0.04);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.14, cy + s * 0.16);
    ctx.lineTo(cx, cy + s * 0.30);
    ctx.lineTo(cx + s * 0.14, cy + s * 0.16);
    ctx.stroke();

    // 头部（Q版大头）
    ctx.fillStyle = v.skin || '#fde4cf';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(1.2, s * 0.028);
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.05, s * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 头发/头冠
    ctx.fillStyle = v.hair || '#0f172a';
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.10, s * 0.245, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();

    // 特色发饰/头冠
    if (v.feature === 'buns') {
      ctx.fillStyle = v.hair;
      ctx.beginPath();
      ctx.arc(cx - s * 0.22, cy - s * 0.22, s * 0.09, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.22, cy - s * 0.22, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fb7185';
      ctx.beginPath();
      ctx.arc(cx - s * 0.22, cy - s * 0.22, s * 0.04, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.22, cy - s * 0.22, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    } else if (v.feature === 'goggles') {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(cx - s * 0.18, cy - s * 0.24, s * 0.36, s * 0.08);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(cx - s * 0.08, cy - s * 0.20, s * 0.055, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.08, cy - s * 0.20, s * 0.055, 0, Math.PI * 2);
      ctx.fill();
    } else if (v.feature === 'talisman') {
      ctx.fillStyle = '#facc15';
      ctx.fillRect(cx - s * 0.22, cy - s * 0.24, s * 0.44, s * 0.08);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(cx - s * 0.04, cy - s * 0.26, s * 0.08, s * 0.12);
    } else if (v.feature === 'crown_gold' || v.feature === 'crown_blue' || v.feature === 'plume_silver') {
      ctx.fillStyle = v.feature === 'crown_blue' ? '#38bdf8' : (v.feature === 'plume_silver' ? '#e2e8f0' : '#facc15');
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.10, cy - s * 0.26);
      ctx.lineTo(cx, cy - s * 0.40);
      ctx.lineTo(cx + s * 0.10, cy - s * 0.26);
      ctx.closePath();
      ctx.fill();
    } else if (v.feature === 'hairpin') {
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = Math.max(1.5, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.26, cy - s * 0.26);
      ctx.lineTo(cx + s * 0.26, cy - s * 0.20);
      ctx.stroke();
    }

    // 眼睛
    ctx.fillStyle = '#0f172a';
    const eyeY = cy - s * 0.04;
    if (v.feature === 'eyepatch') {
      // 夏侯惇独眼罩
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.5, s * 0.03);
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.22, eyeY - s * 0.06);
      ctx.lineTo(cx + s * 0.18, eyeY + s * 0.02);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx - s * 0.09, eyeY, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + s * 0.09, eyeY, s * 0.038, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(cx - s * 0.09, eyeY, s * 0.038, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.09, eyeY, s * 0.038, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx - s * 0.08, eyeY - s * 0.012, s * 0.014, 0, Math.PI * 2);
      ctx.arc(cx + s * 0.10, eyeY - s * 0.012, s * 0.014, 0, Math.PI * 2);
      ctx.fill();
    }

    // 胡须特征（关羽长髯 / 张飞炸须 / 黄盖白须）
    if (v.feature === 'long_beard') {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.10, cy + s * 0.09);
      ctx.quadraticCurveTo(cx, cy + s * 0.42, cx + s * 0.10, cy + s * 0.09);
      ctx.fill();
    } else if (v.feature === 'beard_wild' || v.feature === 'white_beard') {
      ctx.fillStyle = v.feature === 'white_beard' ? '#e2e8f0' : '#0f172a';
      ctx.beginPath();
      ctx.arc(cx, cy + s * 0.11, s * 0.14, 0, Math.PI);
      ctx.fill();
    }

    // 侧边标志兵器剪影
    ctx.strokeStyle = v.trim || '#facc15';
    ctx.lineWidth = Math.max(2, s * 0.045);
    ctx.beginPath();
    ctx.moveTo(x + s * 0.84, y + s * 0.92);
    ctx.lineTo(x + s * 0.84, y + s * 0.18);
    ctx.stroke();
  }

  function drawSoldierPortrait(ctx, unitType, x, y, s) {
    const u = App.Config.UNIT_TYPES[unitType] || App.Config.UNIT_TYPES.spear;
    const cx = x + s / 2;
    const cy = y + s / 2;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = u.color;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold ${Math.round(s * 0.38)}px "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(u.short, cx, cy);
  }

  /**
   * 渲染四大神兽立绘（优先用 assets/beasts/<id>.png；若未加载则渲染发光四象圣兽图腾）
   */
  function drawBeastPortrait(ctx, bid, x, y, size, opts) {
    const o = opts || {};
    const b = App.Config.BEASTS[bid];
    const r = o.radius != null ? o.radius : 12;
    const isZhulong = bid === 'zhulong';
    const t = isZhulong && size >= 56 ? ((Date.now() % 1000000) / 1000) : 0;

    // 创世烛龙专属外溢赤金日冕神框背光
    if (isZhulong && size >= 56 && !o.noAnim) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.6);
      ctx.save();
      App.UI.roundRect(ctx, x - 2.5, y - 2.5, size + 5, size + 5, r + 2.5);
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.38 + pulse * 0.38})`;
      ctx.lineWidth = 2.8;
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.clip();

    const img = App.Assets.get('beast_' + bid);
    const ownedBeast = (!o.raw && App.State && App.State.get && App.State.get().ownedBeasts)
      ? App.State.get().ownedBeasts[bid]
      : null;
    const ascPath = o.ascend !== undefined ? o.ascend : ((ownedBeast && ownedBeast.ascend) || '');
    const ascBorder = ascPath === 'xian' ? '#38bdf8' : (ascPath === 'mo' ? '#e879f9' : null);

    if (img) {
      ctx.drawImage(img, x, y, size, size);
    } else if (b) {
      drawVectorBeast(ctx, b, x, y, size, ascPath);
    }
    ctx.restore();

    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.strokeStyle = o.border || ascBorder || (b ? b.glow : '#facc15');
    ctx.lineWidth = o.lineWidth || (ascBorder ? 2.4 : (isZhulong ? 2.4 : 2));
    ctx.stroke();

    // 右上角神/魔圣兽印记角标
    if ((ascPath === 'xian' || ascPath === 'mo') && size >= 34) {
      const isXian = ascPath === 'xian';
      const br = Math.max(7.5, Math.min(12, size * 0.135));
      const bx = x + size - br - 2.5;
      const by = y + br + 2.5;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = isXian ? 'rgba(8, 51, 68, 0.94)' : 'rgba(74, 4, 78, 0.94)';
      ctx.fill();
      ctx.strokeStyle = isXian ? '#67e8f9' : '#f472b6';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = isXian ? '#ecfeff' : '#fdf4ff';
      ctx.font = `bold ${Math.max(9, Math.round(br * 1.12))}px "PingFang SC", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isXian ? '神' : '魔', bx, by + 0.5);
    }

    // 创世烛龙立绘右上角“昼”日冕金芒星徽
    if (isZhulong && !ascPath && size >= 56 && !o.noAnim) {
      const tw = 0.55 + 0.45 * Math.abs(Math.sin(t * 4.0));
      const sx = x + size - 8, sy = y + 8, sr = Math.max(4, size * 0.055) * tw;
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx - sr, sy); ctx.lineTo(sx + sr, sy);
      ctx.moveTo(sx, sy - sr); ctx.lineTo(sx, sy + sr);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawVectorBeast(ctx, b, x, y, s, ascPath) {
    const cx = x + s / 2;
    const cy = y + s / 2;

    const grad = ctx.createRadialGradient(cx, cy, s * 0.05, cx, cy, s * 0.65);
    grad.addColorStop(0, b.color);
    grad.addColorStop(1, b.darkColor);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, s, s);

    // 圣兽八卦灵环
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = Math.max(1.2, s * 0.025);
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    if (b.id === 'qinglong') {
      // 青龙盘旋龙首与双角
      ctx.strokeStyle = '#a7f3d0';
      ctx.lineWidth = Math.max(3, s * 0.09);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.24, -Math.PI * 0.8, Math.PI * 0.75);
      ctx.stroke();
      // 龙角
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(2, s * 0.04);
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, -s * 0.14);
      ctx.lineTo(-s * 0.20, -s * 0.34);
      ctx.moveTo(s * 0.08, -s * 0.14);
      ctx.lineTo(s * 0.20, -s * 0.34);
      ctx.stroke();
      // 龙瞳
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-s * 0.07, -s * 0.04, s * 0.04, 0, Math.PI * 2);
      ctx.arc(s * 0.07, -s * 0.04, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.id === 'baihu') {
      // 白虎双耳与额头“王”纹
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(0, s * 0.02, s * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-s * 0.19, -s * 0.19, s * 0.09, 0, Math.PI * 2);
      ctx.arc(s * 0.19, -s * 0.19, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
      // 王字纹
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.5, s * 0.035);
      ctx.beginPath();
      ctx.moveTo(-s * 0.08, -s * 0.14); ctx.lineTo(s * 0.08, -s * 0.14);
      ctx.moveTo(-s * 0.06, -s * 0.08); ctx.lineTo(s * 0.06, -s * 0.08);
      ctx.moveTo(0, -s * 0.16); ctx.lineTo(0, -s * 0.05);
      ctx.stroke();
      // 赤瞳
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(-s * 0.09, s * 0.03, s * 0.04, 0, Math.PI * 2);
      ctx.arc(s * 0.09, s * 0.03, s * 0.04, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.id === 'zhuque') {
      // 朱雀展翅火凤
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.30);
      ctx.quadraticCurveTo(s * 0.38, -s * 0.12, s * 0.28, s * 0.24);
      ctx.lineTo(0, s * 0.08);
      ctx.lineTo(-s * 0.28, s * 0.24);
      ctx.quadraticCurveTo(-s * 0.38, -s * 0.12, 0, -s * 0.30);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -s * 0.06, s * 0.11, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.id === 'xuanwu') {
      // 玄武冰晶六角龟甲
      ctx.fillStyle = '#bae6fd';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = Math.max(2, s * 0.04);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = Math.cos(a) * s * 0.26;
        const py = Math.sin(a) * s * 0.24;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 冰核
      ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.id === 'zhulong') {
      // 创世烛龙：太古赤金日轮 + 霸皇四重龙角 + 额间睁目为昼竖瞳
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = Math.max(2, s * 0.045);
      ctx.beginPath();
      ctx.arc(0, -s * 0.02, s * 0.31, 0, Math.PI * 2);
      ctx.stroke();
      // 皇冠双巨角与翼廓
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-s * 0.10, -s * 0.10); ctx.lineTo(-s * 0.28, -s * 0.36); ctx.lineTo(-s * 0.04, -s * 0.18);
      ctx.moveTo(s * 0.10, -s * 0.10);  ctx.lineTo(s * 0.28, -s * 0.36);  ctx.lineTo(s * 0.04, -s * 0.18);
      ctx.fill();
      // 额心竖立天目（睁目为昼）
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.11, s * 0.038, s * 0.095, 0, 0, Math.PI * 2);
      ctx.fill();
      // 炽金双龙目
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-s * 0.10, s * 0.02, s * 0.042, 0, Math.PI * 2);
      ctx.arc(s * 0.10, s * 0.02, s * 0.042, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // 太古四凶与上古神兽古篆图腾光轮兜底
      ctx.strokeStyle = b.glow || '#fde047';
      ctx.lineWidth = Math.max(2, s * 0.045);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i;
        const rIn = (i % 2 === 0) ? s * 0.28 : s * 0.16;
        const px = Math.cos(a) * rIn;
        const py = Math.sin(a) * rIn;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = b.glow || '#fef08a';
      ctx.beginPath();
      ctx.arc(0, -s * 0.03, s * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 底部圣兽角标文字
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y + s * 0.74, s, s * 0.26);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(10, Math.round(s * 0.20))}px "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const shortLbl = ascPath === 'xian' ? ('神.' + b.shortName) : (ascPath === 'mo' ? ('魔.' + b.shortName) : b.shortName);
    ctx.fillText(shortLbl, cx, y + s * 0.87, s - 4);
  }

  App.Portraits = {
    drawGeneralPortrait,
    drawBeastPortrait,
    getRarityColor,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
