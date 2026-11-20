(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const hitBoxes = [];
  const toasts = [];

  function clearHits() { hitBoxes.length = 0; }

  function addHit(x, y, w, h, onClick, meta) {
    hitBoxes.push({ x, y, w, h, onClick, meta });
  }

  function dispatchClick(x, y) {
    for (let i = hitBoxes.length - 1; i >= 0; i--) {
      const b = hitBoxes[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (App.Audio && !(b.meta && b.meta.silent)) App.Audio.playSfx('click');
        if (b.onClick) b.onClick(b.meta);
        return true;
      }
    }
    return false;
  }

  function showToast(text, color) {
    toasts.push({ text, color: color || '#fef08a', life: 2.2, maxLife: 2.2 });
    if (toasts.length > 4) toasts.shift();
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
      const y = 82 + idx * 32 - (1 - t.life / t.maxLife) * 8;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif';
      const tw = ctx.measureText(t.text).width + 32;
      roundRect(ctx, (W - tw) / 2, y, tw, 28, 14);
      ctx.fillStyle = 'rgba(42, 24, 14, 0.94)';
      ctx.fill();
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = t.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, W / 2, y + 14);
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

  function drawButton(ctx, x, y, w, h, text, opts, onClick) {
    const o = opts || {};
    ctx.save();
    roundRect(ctx, x, y, w, h, o.r || 8);
    if (o.disabled) {
      ctx.fillStyle = '#78716c';
    } else if (o.grad) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, o.grad[0]);
      g.addColorStop(1, o.grad[1]);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = o.bg || '#b45309';
    }
    ctx.fill();
    ctx.strokeStyle = o.disabled ? '#57534e' : (o.border || '#fef08a');
    ctx.lineWidth = o.lineWidth || 1.5;
    ctx.stroke();

    ctx.fillStyle = o.disabled ? '#d6d3d1' : (o.color || '#fffbeb');
    ctx.font = `bold ${o.fontSize || 13}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + (o.subText ? -6 : 0));

    if (o.subText) {
      ctx.font = `10px "PingFang SC", sans-serif`;
      ctx.fillStyle = o.subColor || '#fef08a';
      ctx.fillText(o.subText, x + w / 2, y + h / 2 + 9);
    }
    ctx.restore();

    if (onClick && !o.disabled) addHit(x, y, w, h, onClick);
  }

  // ★ 国风鎏金琥珀激励按钮（替代突兀刺眼的纯绿“广告”方块：左侧立体金章播放徽记 + 双层金丝檀木漆面）
  function drawAdButton(ctx, x, y, w, h, text, opts, onClick) {
    const o = opts || {};
    const r = o.r != null ? o.r : Math.min(10, h / 2);
    ctx.save();
    if (o.disabled) ctx.globalAlpha = 0.55;

    // 1. 立体投影 + 琥珀檀木渐变漆底
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
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
    ctx.shadowColor = 'transparent';

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

    // 圆章内的精致实心播放三角
    const triSz = badgeR * 0.46;
    ctx.fillStyle = '#451a03';
    ctx.beginPath();
    ctx.moveTo(bx - triSz * 0.55, by - triSz * 0.88);
    ctx.lineTo(bx + triSz * 0.98, by);
    ctx.lineTo(bx - triSz * 0.55, by + triSz * 0.88);
    ctx.closePath();
    ctx.fill();

    // 5. 右侧居中排布的鎏金文字与副标题（避开左侧圆章，永不挤压）
    const leftPad = 7 + badgeR * 2 + 4;
    const textCx = x + leftPad + (w - leftPad - 5) / 2;

    ctx.fillStyle = o.disabled ? '#d6d3d1' : (o.color || '#fef9c3');
    ctx.font = `bold ${o.fontSize || 12.5}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, textCx, y + h / 2 + (o.subText ? -6.5 : 0.5));

    if (o.subText) {
      ctx.font = `${o.subFontSize || 9.5}px "PingFang SC", sans-serif`;
      ctx.fillStyle = o.subColor || '#fde68a';
      ctx.fillText(o.subText, textCx, y + h / 2 + 8.5);
    }
    ctx.restore();

    if (onClick && !o.disabled) addHit(x, y, w, h, onClick);
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

  function drawWrappedText(ctx, text, x, y, maxW, lineH, align) {
    ctx.textAlign = align || 'left';
    let line = '';
    let cy = y;
    for (let i = 0; i < text.length; i++) {
      const test = line + text[i];
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        ctx.fillText(line, x, cy);
        line = text[i];
        cy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, cy);
    return cy + lineH;
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
    ctx.fillText('（微信端将自动拉起 wx.createRewardedVideoAd）', W / 2, H / 2 + 76);
    ctx.restore();
  }

  // 绘制精致透明小图标
  function drawMiniIcon(ctx, iconKey, x, y, size) {
    const img = App.Assets && App.Assets.get(iconKey);
    if (img) {
      ctx.drawImage(img, x, y, size, size);
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
    ctx.fillText(text, x + iconSz + 2, y + h / 2 + 0.5);

    // 可选右侧快捷加号按钮徽标（点击领取铜钱/恢复粮草体力！）
    if (o.plusBadge) {
      const pr = h >= 22 ? 8 : 6.8;
      const px = x + w - pr - 4;
      const py = y + h / 2;
      ctx.fillStyle = o.plusDisabled ? '#57534e' : (o.plusColor || '#16a34a');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = o.plusDisabled ? '#a8a29e' : '#fef08a';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${h >= 22 ? 12 : 10}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', px, py + 0.5);
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

  App.UI = {
    clearHits, addHit, dispatchClick, showToast, updateToasts, drawToasts,
    roundRect, drawPanel, drawWoodHeader, drawButton, drawAdButton, drawBar, drawWrappedText, drawAdOverlay,
    drawMiniIcon, drawResCapsule, drawSoundToggle,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
