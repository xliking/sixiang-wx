(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const COLS = 4;
  const ROWS = 3;
  const PAGE_SIZE = COLS * ROWS; // 3 排 × 4 列 = 12 个横版市集摊位卡

  const TABS = [
    { id: 'all', label: '全部奇珍' },
    { id: 'hero', label: '在野名将' },
    { id: 'chest', label: '秘宝礼匣' },
    { id: 'equip', label: '神兵套装' },
    { id: 'supply', label: '丹卷百宝' },
  ];

  let lastOpenAt = 0;
  let pageIdx = 0;
  let activeTab = 'all';

  function enter() {
    lastOpenAt = Date.now();
    pageIdx = 0;
    activeTab = 'all';
    App.State.openShop();
  }

  function matchTab(of, tabId) {
    if (!of || tabId === 'all') return true;
    if (tabId === 'hero') return of.kind === 'hero';
    if (tabId === 'equip') return of.kind === 'equip';
    if (tabId === 'chest') {
      if (of.kind === 'resource') return true;
      if (of.kind !== 'item') return false;
      const it = App.Config.ITEMS[of.id];
      return !!(it && (it.cat === 'chest' || it.kind === 'chest')) || String(of.id || '').indexOf('chest') >= 0;
    }
    if (tabId === 'supply') {
      if (of.kind !== 'item') return false;
      const it = App.Config.ITEMS[of.id];
      return !(it && (it.cat === 'chest' || it.kind === 'chest')) && String(of.id || '').indexOf('chest') < 0;
    }
    return true;
  }

  function formatGold(n) {
    const num = Number(n) || 0;
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const FIT_CACHE = new Map();
  const CLAMP_CACHE = new Map();

  function fitSingleLine(ctx, text, maxW) {
    const str = String(text || '');
    if (!str) return '';
    const key = ctx.font + '|' + Math.round(maxW) + '|' + str;
    const hit = FIT_CACHE.get(key);
    if (hit !== undefined) return hit;
    if (ctx.measureText(str).width <= maxW) {
      if (FIT_CACHE.size >= 400) FIT_CACHE.delete(FIT_CACHE.keys().next().value);
      FIT_CACHE.set(key, str);
      return str;
    }
    let out = str;
    while (out.length > 1 && ctx.measureText(out + '…').width > maxW) {
      out = out.slice(0, -1);
    }
    const res = out + '…';
    if (FIT_CACHE.size >= 400) FIT_CACHE.delete(FIT_CACHE.keys().next().value);
    FIT_CACHE.set(key, res);
    return res;
  }

  function drawClampedLines(ctx, text, x, y, maxW, lineH, maxLines) {
    const str = String(text || '');
    if (!str) return;
    const key = ctx.font + '|' + Math.round(maxW) + '|' + maxLines + '|' + str;
    let rows = CLAMP_CACHE.get(key);
    if (!rows) {
      rows = [];
      const chars = Array.from(str);
      let line = '';
      for (let i = 0; i < chars.length; i++) {
        const test = line + chars[i];
        if (ctx.measureText(test).width > maxW && line.length > 0) {
          if (rows.length + 1 >= maxLines) {
            rows.push(fitSingleLine(ctx, line + chars.slice(i).join(''), maxW));
            line = '';
            break;
          }
          rows.push(line);
          line = chars[i];
        } else {
          line = test;
        }
      }
      if (line && rows.length < maxLines) rows.push(line);
      if (CLAMP_CACHE.size >= 400) CLAMP_CACHE.delete(CLAMP_CACHE.keys().next().value);
      CLAMP_CACHE.set(key, rows);
    }
    for (let r = 0; r < rows.length; r++) {
      ctx.fillText(rows[r], x, y + r * lineH);
    }
  }

  function getOfferAccent(of) {
    if (of.kind === 'hero') {
      const g = App.Config.GENERALS[of.id];
      const rar = g ? g.rarity : 'A';
      if (rar === 'SSS') return { bg: '#fff3d1', head: '#7c2d12', border: '#d97706', tagBg: '#dc2626', titleCol: '#451a03', descCol: '#7c2d12', btnGrad: ['#b91c1c', '#7f1d1d'] };
      if (rar === 'SS') return { bg: '#faecc8', head: '#78350f', border: '#ca8a04', tagBg: '#b45309', titleCol: '#451a03', descCol: '#78350f', btnGrad: ['#d97706', '#92400e'] };
      if (rar === 'S') return { bg: '#f5e9fe', head: '#581c87', border: '#9333ea', tagBg: '#7e22ce', titleCol: '#3b0764', descCol: '#581c87', btnGrad: ['#9333ea', '#6b21a8'] };
      return { bg: '#f5e6c4', head: '#5c2c16', border: '#a16207', tagBg: '#9a3412', titleCol: '#3b1806', descCol: '#6b3417', btnGrad: ['#b45309', '#78350f'] };
    }
    let qual = 'purple';
    if (of.kind === 'equip' && App.Config.EQUIP_TEMPLATES[of.id]) {
      qual = App.Config.EQUIP_TEMPLATES[of.id].quality || 'purple';
    } else if (of.kind === 'item' && App.Config.ITEMS[of.id]) {
      qual = App.Config.ITEMS[of.id].quality || (of.price >= 22000 ? 'gold' : 'purple');
    } else if (of.price >= 22000) {
      qual = 'gold';
    }
    if (qual === 'gold') {
      return { bg: '#fbf0cf', head: '#854d0e', border: '#d97706', tagBg: '#b45309', titleCol: '#451a03', descCol: '#78350f', btnGrad: ['#b45309', '#7c2d12'] };
    }
    if (qual === 'purple') {
      return { bg: '#f4e6c6', head: '#581c87', border: '#9333ea', tagBg: '#6d28d9', titleCol: '#3b1806', descCol: '#5b21b6', btnGrad: ['#9a3412', '#7c2d12'] };
    }
    return { bg: '#efe3c8', head: '#44403c', border: '#78716c', tagBg: '#0369a1', titleCol: '#3b1806', descCol: '#57534e', btnGrad: ['#78350f', '#5c2c16'] };
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();
    const rawOffers = App.State.getShopOffers();

    // 暖檀古卷市集底色（与元宝阁暗夜紫金皇城风格彻底区分）
    ctx.fillStyle = '#c8aa74';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 满高商行主画框（y=58..532，彻底消除底部留白，两侧留出翻页耳标位）
    App.UI.drawPanel(ctx, 26, 58, W - 52, 474, { r: 14, bg: '#f7ebd2', border: '#854d0e', lineWidth: 2.2 });
    App.UI.drawPanel(ctx, 31, 63, W - 62, 464, { r: 11, bg: 'rgba(255, 248, 231, 0.55)', border: 'rgba(180, 130, 60, 0.35)', lineWidth: 1 });

    // 顶部雕花檀木横匾
    App.UI.drawPanel(ctx, 36, 66, W - 72, 42, { r: 9, bg: '#4a210b', border: '#d4a34b', lineWidth: 1.6 });
    const remainSec = App.State.getShopRefreshSeconds();
    if ((!rawOffers.length || remainSec <= 0) && Date.now() - lastOpenAt > 3000) {
      lastOpenAt = Date.now();
      App.State.openShop();
    }
    const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
    const ss = String(remainSec % 60).padStart(2, '0');

    App.UI.drawMiniIcon(ctx, 'res_gold', 44, 73, 28);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14.5px "PingFang SC", serif';
    ctx.fillText('九州铜钱集市', 76, 84);
    ctx.fillStyle = '#fde68a';
    ctx.font = '10px "PingFang SC", sans-serif';
    ctx.fillText(`货架轮换 ${mm}:${ss}`, 76, 100);
    ctx.restore();

    // 分类标签组
    let tabX = 178;
    TABS.forEach((tb) => {
      const isCur = activeTab === tb.id;
      App.UI.drawButton(ctx, tabX, 73, 68, 28, tb.label, {
        r: 7,
        grad: isCur ? ['#d97706', '#92400e'] : undefined,
        bg: isCur ? undefined : 'rgba(28, 13, 6, 0.68)',
        border: isCur ? '#fef08a' : 'rgba(212, 163, 75, 0.42)',
        color: isCur ? '#fffbeb' : '#e7d5b8',
        fontSize: 10.5,
      }, () => {
        if (activeTab !== tb.id) {
          activeTab = tb.id;
          pageIdx = 0;
        }
      });
      tabX += 72;
    });

    // 右侧功能按钮 + 右上角 ✕ 关闭圆章
    const adsOn = !!(App.Config && App.Config.isAdEnabled && App.Config.isAdEnabled());
    App.UI.drawButton(ctx, adsOn ? (W - 420) : (W - 324), 73, 68, 28, '货币互转', {
      r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 10,
    }, () => {
      if (App.UI && App.UI.openExchangeModal) App.UI.openExchangeModal();
    });

    App.UI.drawButton(ctx, adsOn ? (W - 348) : (W - 250), 73, 76, 28, '✦元宝秘阁', {
      r: 7, grad: ['#6d28d9', '#3b0764'], border: '#facc15', fontSize: 10,
    }, () => App.Main.goScene('ingotShop'));

    App.UI.drawButton(ctx, adsOn ? (W - 268) : (W - 168), 73, 86, 28, `刷新(${App.State.SHOP_REFRESH_COST})`, {
      r: 7, grad: ['#b45309', '#78350f'], border: '#fef08a', fontSize: 10,
    }, () => {
      pageIdx = 0;
      App.State.refreshShop(false);
    });

    if (adsOn) {
      App.UI.drawAdButton(ctx, W - 178, 73, 96, 28, '免费刷良将', {
        r: 7, fontSize: 9.5,
      }, () => {
        App.Platform.showRewardedAd('stamina', '观看激励视频，免费刷新整座铜钱商铺货架！', () => {
          pageIdx = 0;
          App.State.refreshShop(true);
        });
      });
    }

    App.UI.drawCloseButton(ctx, W - 74, 71, 32, () => App.Main.goScene('map'));

    const filtered = [];
    rawOffers.forEach((of, idx) => {
      if (matchTab(of, activeTab)) filtered.push({ of, realIdx: idx });
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (pageIdx >= totalPages) pageIdx = totalPages - 1;
    if (pageIdx < 0) pageIdx = 0;
    const pageItems = filtered.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);

    if (!rawOffers.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 296, '正在清点集市奇珍与在野名将…');
      return;
    }

    // 4列 × 3排 饱满横版木牌摊位卡（铺满 y=116..522，移除底部多余文字条）
    const startX = 38;
    const startY = 116;
    const gapX = 10;
    const gapY = 9;
    const cardW = 213.5;
    const cardH = 129;

    pageItems.forEach((entry, slot) => {
      const of = entry.of;
      const col = slot % COLS;
      const row = Math.floor(slot / COLS);
      const cx = Math.round(startX + col * (cardW + gapX));
      const cy = Math.round(startY + row * (cardH + gapY));
      const cw = Math.round(cardW);

      const isHero = of.kind === 'hero';
      const acc = getOfferAccent(of);

      // 宣纸木框横卡
      App.UI.drawPanel(ctx, cx, cy, cw, cardH, {
        r: 10,
        bg: of.sold ? 'rgba(168, 152, 126, 0.45)' : acc.bg,
        border: of.sold ? '#a8a29e' : acc.border,
        lineWidth: isHero || acc.border === '#d97706' ? 1.8 : 1.3,
      });

      // 顶部细木纹眉条
      ctx.save();
      App.UI.roundRect(ctx, cx + 2, cy + 2, cw - 4, 6, 4);
      ctx.fillStyle = of.sold ? 'rgba(120, 113, 108, 0.35)' : acc.border;
      ctx.globalAlpha = 0.28;
      ctx.fill();
      ctx.restore();

      // 左侧商品图标 (58x58)
      const iconX = cx + 10;
      const iconY = cy + 22;
      const iconSz = 58;
      if (isHero) {
        App.Portraits.drawGeneralPortrait(ctx, of.id, iconX, iconY, iconSz, { radius: 9, border: acc.border, lineWidth: 1.8 });
      } else if (of.kind === 'item' || of.kind === 'equip') {
        App.Sprites.drawEquipIcon(ctx, of.id, iconX, iconY, iconSz, { radius: 9, border: acc.border, lineWidth: 1.6 });
      } else {
        ctx.save();
        App.UI.roundRect(ctx, iconX, iconY, iconSz, iconSz, 9);
        ctx.fillStyle = '#3b0764';
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        App.UI.drawMiniIcon(ctx, 'res_soul', iconX + 11, iconY + 11, 36);
        ctx.restore();
      }

      if (of.tag) {
        ctx.save();
        ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
        const tagW = Math.min(68, Math.max(42, Math.ceil(ctx.measureText(of.tag).width + 10)));
        ctx.fillStyle = of.sold ? '#78716c' : acc.tagBg;
        App.UI.roundRect(ctx, cx + 8, cy + 8, tagW, 15, 4);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(of.tag, cx + 8 + tagW / 2, cy + 15.5, tagW - 4);
        ctx.restore();
      }

      // 右侧商品标题与效用描述
      const txtX = cx + 76;
      const txtW = cw - 84;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = of.sold ? '#78716c' : acc.titleCol;
      ctx.font = 'bold 12px "PingFang SC", serif';
      ctx.fillText(fitSingleLine(ctx, of.title, txtW), txtX, cy + 31);

      ctx.fillStyle = of.sold ? '#78716c' : acc.descCol;
      ctx.font = '10px "PingFang SC", sans-serif';
      drawClampedLines(ctx, of.desc, txtX, cy + 50, txtW, 14, 2);

      // 木纹分隔细线
      ctx.strokeStyle = 'rgba(133, 77, 14, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy + 86);
      ctx.lineTo(cx + cw - 10, cy + 86);
      ctx.stroke();
      ctx.restore();

      // 底部铜钱购买按钮
      const canAfford = st.gold >= of.price;
      const btnLabel = of.sold
        ? '✓ 已购入库'
        : `${formatGold(of.price)} 铜钱${isHero ? '招募' : '购买'}`;
      App.UI.drawButton(ctx, cx + 10, cy + 91, cw - 20, 31, btnLabel, {
        r: 7,
        grad: of.sold ? undefined : acc.btnGrad,
        bg: of.sold ? '#8c7e6a' : undefined,
        border: of.sold ? '#b8afa0' : (canAfford ? '#fef08a' : '#fca5a5'),
        color: of.sold ? '#f5f5f4' : (canAfford ? '#fffbeb' : '#fecaca'),
        fontSize: 11,
        disabled: of.sold,
      }, () => {
        App.State.buyShopOffer(entry.realIdx);
      });
      if (!of.sold) {
        App.UI.drawMiniIcon(ctx, 'res_gold', cx + 18, cy + 98, 17);
      }
    });

    // 左右两侧翻页耳标按钮
    App.UI.drawSidePageButtons(ctx, pageIdx, totalPages, (nextP) => {
      pageIdx = nextP;
    }, {
      cy: 318,
      grad: ['#78350f', '#451a03'],
      border: '#f59e0b',
      arrowColor: '#fef08a',
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.shop = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
