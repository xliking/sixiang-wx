(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const COLS = 4;
  const ROWS = 3;
  const PAGE_SIZE = COLS * ROWS; // 一页 3 排 × 4 个 = 12 个商品

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
      const rar = g ? g.rarity : 'SR';
      if (rar === 'UR') return { bg: '#3b150c', border: '#facc15', tagBg: '#dc2626', titleCol: '#fef08a', descCol: '#fde68a', btnGrad: ['#dc2626', '#991b1b'] };
      if (rar === 'SSR') return { bg: '#351910', border: '#fbbf24', tagBg: '#b45309', titleCol: '#fef08a', descCol: '#fde68a', btnGrad: ['#d97706', '#92400e'] };
      return { bg: '#2f1a12', border: '#d4a34b', tagBg: '#9a3412', titleCol: '#fef3c7', descCol: '#e7d5b8', btnGrad: ['#b45309', '#78350f'] };
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
      return { bg: '#f5e2b3', border: '#d97706', tagBg: '#b45309', titleCol: '#451a03', descCol: '#78350f', btnGrad: ['#b45309', '#7c2d12'] };
    }
    if (qual === 'purple') {
      return { bg: '#efe0be', border: '#854d0e', tagBg: '#6d28d9', titleCol: '#3b1806', descCol: '#6b3417', btnGrad: ['#9a3412', '#7c2d12'] };
    }
    return { bg: '#ece1c8', border: '#78716c', tagBg: '#0369a1', titleCol: '#3b1806', descCol: '#57534e', btnGrad: ['#78350f', '#5c2c16'] };
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();
    const rawOffers = App.State.getShopOffers();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 商铺外框大面板
    App.UI.drawPanel(ctx, 14, 58, W - 28, H - 66, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });

    // 顶部商铺招牌、分类筛选与刷新操作栏
    App.UI.drawPanel(ctx, 22, 64, W - 44, 42, { r: 9, bg: '#451a03', border: '#d4a34b', lineWidth: 1.6 });
    const remainSec = App.State.getShopRefreshSeconds();
    if ((!rawOffers.length || remainSec <= 0) && Date.now() - lastOpenAt > 3000) {
      lastOpenAt = Date.now();
      App.State.openShop();
    }
    const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
    const ss = String(remainSec % 60).padStart(2, '0');

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 13.5px "PingFang SC", serif';
    ctx.fillText('铜钱商城', 32, 82);
    ctx.fillStyle = '#fde68a';
    ctx.font = '9.5px "PingFang SC", sans-serif';
    ctx.fillText(`刷新 ${mm}:${ss}`, 32, 98);
    ctx.restore();

    // 分类标签组
    let tabX = 104;
    TABS.forEach((tb) => {
      const isCur = activeTab === tb.id;
      App.UI.drawButton(ctx, tabX, 71, 68, 28, tb.label, {
        r: 7,
        grad: isCur ? ['#d97706', '#92400e'] : undefined,
        bg: isCur ? undefined : 'rgba(28, 13, 6, 0.72)',
        border: isCur ? '#fef08a' : 'rgba(212, 163, 75, 0.45)',
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

    // 货币互转 + 元宝商店 + 刷新 + 返回按钮
    App.UI.drawButton(ctx, W - 492, 70, 74, 30, '货币互转', {
      r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 10.5,
    }, () => {
      if (App.UI && App.UI.openExchangeModal) App.UI.openExchangeModal();
    });

    App.UI.drawButton(ctx, W - 414, 70, 80, 30, '★元宝商店', {
      r: 7, grad: ['#dc2626', '#991b1b'], border: '#fde047', fontSize: 10.5,
    }, () => App.Main.goScene('ingotShop'));

    App.UI.drawButton(ctx, W - 330, 70, 96, 30, `刷新(${App.State.SHOP_REFRESH_COST})`, {
      r: 7, grad: ['#b45309', '#78350f'], border: '#fef08a', fontSize: 10.5,
    }, () => {
      pageIdx = 0;
      App.State.refreshShop(false);
    });

    App.UI.drawAdButton(ctx, W - 230, 70, 126, 30, '免费刷新良将', {
      r: 7, fontSize: 10,
    }, () => {
      App.Platform.showRewardedAd('stamina', '观看激励视频，免费刷新整座铜钱商铺货架！', () => {
        pageIdx = 0;
        App.State.refreshShop(true);
      });
    });

    App.UI.drawButton(ctx, W - 100, 70, 70, 30, '◀ 返回', {
      r: 7, bg: '#5c2c16', border: '#fde047', fontSize: 10.5,
    }, () => App.Main.goScene('map'));

    // 过滤并保留真实服务端索引 realIdx（购买接口按原数组下标结算）
    const filtered = [];
    rawOffers.forEach((of, idx) => {
      if (matchTab(of, activeTab)) filtered.push({ of, realIdx: idx });
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (pageIdx >= totalPages) pageIdx = totalPages - 1;
    if (pageIdx < 0) pageIdx = 0;
    const pageItems = filtered.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);

    if (!rawOffers.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 290, '正在清点商铺十二页奇珍与在野名将…');
      return;
    }

    // ★ 3 排 × 4 列 = 12 张精致紧凑商品卡
    const startX = 22;
    const startY = 112;
    const gapX = 10;
    const gapY = 8;
    const cardW = 221;
    const cardH = 115;

    pageItems.forEach((entry, slot) => {
      const of = entry.of;
      const col = slot % COLS;
      const row = Math.floor(slot / COLS);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const isHero = of.kind === 'hero';
      const acc = getOfferAccent(of);

      App.UI.drawPanel(ctx, cx, cy, cardW, cardH, {
        r: 9,
        bg: of.sold ? 'rgba(92, 74, 56, 0.42)' : acc.bg,
        border: of.sold ? '#78716c' : acc.border,
        lineWidth: isHero || acc.border === '#d97706' ? 1.8 : 1.3,
      });

      // 左侧商品图标 (52x52，留出顶部角标空间避免遮挡脸部)
      const iconX = cx + 8;
      const iconY = cy + 16;
      const iconSz = 52;
      if (isHero) {
        App.Portraits.drawGeneralPortrait(ctx, of.id, iconX, iconY, iconSz, { radius: 8, border: acc.border, lineWidth: 1.8 });
      } else if (of.kind === 'item' || of.kind === 'equip') {
        App.Sprites.drawEquipIcon(ctx, of.id, iconX, iconY, iconSz, { radius: 8, border: acc.border, lineWidth: 1.6 });
      } else {
        ctx.save();
        App.UI.roundRect(ctx, iconX, iconY, iconSz, iconSz, 8);
        ctx.fillStyle = '#3b0764';
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        App.UI.drawMiniIcon(ctx, 'res_soul', iconX + 9, iconY + 9, 36);
        ctx.restore();
      }

      // 精致角标
      if (of.tag) {
        ctx.save();
        ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
        const tagW = Math.min(66, Math.max(42, Math.ceil(ctx.measureText(of.tag).width + 10)));
        ctx.fillStyle = of.sold ? '#57534e' : acc.tagBg;
        App.UI.roundRect(ctx, cx + 6, cy + 5, tagW, 14, 4);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(of.tag, cx + 6 + tagW / 2, cy + 12, tagW - 4);
        ctx.restore();
      }

      // 右侧名称与精炼双行描述
      const txtX = cx + 68;
      const txtW = cardW - 76;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = of.sold ? '#57534e' : acc.titleCol;
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(fitSingleLine(ctx, of.title, txtW), txtX, cy + 24);

      ctx.fillStyle = of.sold ? '#78716c' : acc.descCol;
      ctx.font = '9.5px "PingFang SC", sans-serif';
      drawClampedLines(ctx, of.desc, txtX, cy + 40, txtW, 13, 2);
      ctx.restore();

      // 底部通栏购买按钮
      const canAfford = st.gold >= of.price;
      const btnLabel = of.sold
        ? '✓ 已购入库'
        : `${formatGold(of.price)} 铜钱${isHero ? '招募' : '购买'}`;
      App.UI.drawButton(ctx, cx + 8, cy + 77, cardW - 16, 30, btnLabel, {
        r: 7,
        grad: of.sold ? undefined : acc.btnGrad,
        bg: of.sold ? '#6b5e4c' : undefined,
        border: of.sold ? '#a8a29e' : (canAfford ? '#fef08a' : '#fca5a5'),
        color: of.sold ? '#e7e5e4' : (canAfford ? '#fffbeb' : '#fecaca'),
        fontSize: 11,
        disabled: of.sold,
      }, () => {
        App.State.buyShopOffer(entry.realIdx);
      });
    });

    // 底部页码统计与 1~12 页数字分页器
    App.UI.drawPanel(ctx, 22, 482, W - 44, 42, { r: 9, bg: 'rgba(59, 29, 14, 0.90)', border: '#a16207', lineWidth: 1.4 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(
      `第 ${pageIdx + 1} / ${totalPages} 页  ·  共 ${filtered.length} 件商品（每页 ${PAGE_SIZE} 件）`,
      36,
      503
    );
    ctx.restore();

    App.UI.drawPagination(ctx, 356, 489, 570, 28, pageIdx, totalPages, (nextP) => {
      pageIdx = nextP;
    }, {
      bg: '#4a2511',
      border: '#b45309',
      activeGrad: ['#d97706', '#92400e'],
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.shop = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
