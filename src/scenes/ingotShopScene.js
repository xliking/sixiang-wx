(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const COLS = 4;
  const ROWS = 3;
  const PAGE_SIZE = COLS * ROWS; // 3 排 × 4 列 = 12 件精品

  const TABS = [
    { id: 'all', label: '全部精品' },
    { id: 'hero', label: 'SSR/UR神将' },
    { id: 'equip', label: '无双神兵' },
    { id: 'chest', label: '传世秘匣' },
    { id: 'treasure', label: '仙丹至宝' },
  ];

  let lastOpenAt = 0;
  let pageIdx = 0;
  let activeTab = 'all';

  function enter() {
    lastOpenAt = Date.now();
    pageIdx = 0;
    activeTab = 'all';
    App.State.openIngotShop();
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
    if (tabId === 'treasure') {
      if (of.kind === 'artifact') return true;
      if (of.kind !== 'item') return false;
      const it = App.Config.ITEMS[of.id];
      return !(it && (it.cat === 'chest' || it.kind === 'chest')) && String(of.id || '').indexOf('chest') < 0;
    }
    return true;
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
    const q = of.quality || (of.price >= 85 ? 'supreme' : (of.price >= 65 ? 'mythic' : (of.price >= 18 ? 'gold' : 'purple')));
    if (q === 'supreme') {
      return { bg: '#3f1210', border: '#facc15', tagBg: '#dc2626', titleCol: '#fef08a', descCol: '#fde68a', btnGrad: ['#dc2626', '#991b1b'], qLabel: '至尊臻品' };
    }
    if (q === 'mythic') {
      return { bg: '#381a0c', border: '#fbbf24', tagBg: '#b45309', titleCol: '#fef08a', descCol: '#fde68a', btnGrad: ['#d97706', '#92400e'], qLabel: '无双名器' };
    }
    if (q === 'gold') {
      return { bg: '#f6e2ae', border: '#d97706', tagBg: '#b45309', titleCol: '#451a03', descCol: '#78350f', btnGrad: ['#b45309', '#7c2d12'], qLabel: '传世金品' };
    }
    return { bg: '#f0dfbe', border: '#9333ea', tagBg: '#6d28d9', titleCol: '#3b1806', descCol: '#581c87', btnGrad: ['#9a3412', '#7c2d12'], qLabel: '史诗精品' };
  }

  function drawArtifactIcon(ctx, aid, x, y, sz, border) {
    const art = App.Config.ARTIFACTS && App.Config.ARTIFACTS[aid];
    const img = art && art.imgKey ? App.Assets.get(art.imgKey) : null;
    ctx.save();
    App.UI.roundRect(ctx, x, y, sz, sz, 8);
    ctx.clip();
    ctx.fillStyle = '#451a03';
    ctx.fillRect(x, y, sz, sz);
    if (img) {
      ctx.drawImage(img, x, y, sz, sz);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 15px "PingFang SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(art ? art.name.slice(0, 2) : '至宝', x + sz / 2, y + sz / 2);
    }
    ctx.restore();
    ctx.save();
    App.UI.roundRect(ctx, x, y, sz, sz, 8);
    ctx.strokeStyle = border || '#facc15';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();
    const rawOffers = App.State.getIngotShopOffers();

    // 玄金华贵底色
    ctx.fillStyle = '#241208';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 元宝商店大面板
    App.UI.drawPanel(ctx, 14, 58, W - 28, H - 66, { r: 14, bg: '#f5e7c4', border: '#d97706', lineWidth: 2.2 });

    // 顶部招牌、分类筛选与互转/刷新栏
    App.UI.drawPanel(ctx, 22, 64, W - 44, 42, { r: 9, bg: '#3b1307', border: '#fbbf24', lineWidth: 1.8 });
    const remainSec = App.State.getIngotShopRefreshSeconds();
    if ((!rawOffers.length || remainSec <= 0) && Date.now() - lastOpenAt > 3000) {
      lastOpenAt = Date.now();
      App.State.openIngotShop();
    }
    const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
    const ss = String(remainSec % 60).padStart(2, '0');

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 13.5px "PingFang SC", serif';
    ctx.fillText('元宝商店', 32, 82);
    ctx.fillStyle = '#fde68a';
    ctx.font = '9.5px "PingFang SC", sans-serif';
    ctx.fillText(`10元宝起·${mm}:${ss}`, 32, 98);
    ctx.restore();

    let tabX = 110;
    TABS.forEach((tb) => {
      const isCur = activeTab === tb.id;
      const bw = tb.id === 'hero' ? 76 : 66;
      App.UI.drawButton(ctx, tabX, 71, bw, 28, tb.label, {
        r: 7,
        grad: isCur ? ['#dc2626', '#991b1b'] : undefined,
        bg: isCur ? undefined : 'rgba(22, 9, 4, 0.78)',
        border: isCur ? '#fef08a' : 'rgba(251, 191, 36, 0.45)',
        color: isCur ? '#fffbeb' : '#fde68a',
        fontSize: 10.5,
      }, () => {
        if (activeTab !== tb.id) {
          activeTab = tb.id;
          pageIdx = 0;
        }
      });
      tabX += bw + 4;
    });

    // 右侧：货币互转 + 铜钱商城 + 元宝刷新 + 免费刷新 + 返回
    App.UI.drawButton(ctx, W - 486, 70, 76, 30, '货币互转', {
      r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 10.5,
    }, () => {
      if (App.UI && App.UI.openExchangeModal) App.UI.openExchangeModal();
    });

    App.UI.drawButton(ctx, W - 406, 70, 74, 30, '铜钱商城', {
      r: 7, bg: '#5c2c16', border: '#d4a34b', fontSize: 10.5,
    }, () => App.Main.goScene('shop'));

    const refCost = App.State.INGOT_SHOP_REFRESH_COST;
    App.UI.drawButton(ctx, W - 328, 70, 96, 30, `刷新(${refCost}元宝)`, {
      r: 7, grad: ['#b45309', '#78350f'], border: '#fef08a', fontSize: 10.5,
    }, () => {
      pageIdx = 0;
      App.State.refreshIngotShop(false);
    });

    App.UI.drawAdButton(ctx, W - 228, 70, 124, 30, '免费刷UR神将', {
      r: 7, fontSize: 10,
    }, () => {
      App.Platform.showRewardedAd('stamina', '观看激励视频，免费刷新元宝商店并必出 UR 至尊神将与传世至宝！', () => {
        pageIdx = 0;
        App.State.refreshIngotShop(true);
      });
    });

    App.UI.drawButton(ctx, W - 100, 70, 70, 30, '◀ 返回', {
      r: 7, bg: '#5c2c16', border: '#fde047', fontSize: 10.5,
    }, () => App.Main.goScene('map'));

    const filtered = [];
    rawOffers.forEach((of, idx) => {
      if (matchTab(of, activeTab)) filtered.push({ of, realIdx: idx });
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (pageIdx >= totalPages) pageIdx = totalPages - 1;
    if (pageIdx < 0) pageIdx = 0;
    const pageItems = filtered.slice(pageIdx * PAGE_SIZE, (pageIdx + 1) * PAGE_SIZE);

    if (!rawOffers.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 290, '正在开启皇家珍宝阁，清点传世精品…');
      return;
    }

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
        lineWidth: 1.8,
      });

      const iconX = cx + 8;
      const iconY = cy + 16;
      const iconSz = 52;
      if (isHero) {
        App.Portraits.drawGeneralPortrait(ctx, of.id, iconX, iconY, iconSz, { radius: 8, border: acc.border, lineWidth: 2 });
      } else if (of.kind === 'artifact') {
        drawArtifactIcon(ctx, of.id, iconX, iconY, iconSz, acc.border);
      } else if (of.kind === 'item' || of.kind === 'equip') {
        App.Sprites.drawEquipIcon(ctx, of.id, iconX, iconY, iconSz, { radius: 8, border: acc.border, lineWidth: 1.8 });
      } else {
        ctx.save();
        App.UI.roundRect(ctx, iconX, iconY, iconSz, iconSz, 8);
        ctx.fillStyle = '#3b0764';
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 1.8;
        ctx.stroke();
        App.UI.drawMiniIcon(ctx, 'res_soul', iconX + 9, iconY + 9, 36);
        ctx.restore();
      }

      const tagText = of.tag || acc.qLabel;
      if (tagText) {
        ctx.save();
        ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
        const tagW = Math.min(72, Math.max(44, Math.ceil(ctx.measureText(tagText).width + 10)));
        ctx.fillStyle = of.sold ? '#57534e' : acc.tagBg;
        App.UI.roundRect(ctx, cx + 6, cy + 5, tagW, 14, 4);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, cx + 6 + tagW / 2, cy + 12, tagW - 4);
        ctx.restore();
      }

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

      const price = Math.max(10, Number(of.price) || 10);
      const canAfford = (st.ingot || 0) >= price;
      const btnLabel = of.sold
        ? '✓ 已收入囊中'
        : `${price} 元宝${isHero ? '圣召' : '购入'}`;
      App.UI.drawButton(ctx, cx + 8, cy + 77, cardW - 16, 30, btnLabel, {
        r: 7,
        grad: of.sold ? undefined : acc.btnGrad,
        bg: of.sold ? '#6b5e4c' : undefined,
        border: of.sold ? '#a8a29e' : (canAfford ? '#fef08a' : '#fca5a5'),
        color: of.sold ? '#e7e5e4' : (canAfford ? '#fffbeb' : '#fecaca'),
        fontSize: 11,
        disabled: of.sold,
      }, () => {
        if (!canAfford) {
          App.UI.showToast(`元宝不足 ${price}（当前 ${st.ingot || 0}），点击上方【货币互转】可用铜钱换算！`, '#fde047');
          return;
        }
        App.State.buyIngotShopOffer(entry.realIdx);
      });
      if (!of.sold) {
        App.UI.drawMiniIcon(ctx, 'res_ingot', cx + 18, cy + 83, 18);
      }
    });

    // 底部分页与汇率说明条
    App.UI.drawPanel(ctx, 22, 482, W - 44, 42, { r: 9, bg: 'rgba(48, 18, 8, 0.94)', border: '#d97706', lineWidth: 1.5 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.fillText(
      `第 ${pageIdx + 1}/${totalPages} 页 · 共 ${filtered.length} 件精品（1元宝=${App.State.INGOT_EXCHANGE_RATE}铜钱）`,
      34,
      503
    );
    ctx.restore();

    App.UI.drawPagination(ctx, 376, 489, 550, 28, pageIdx, totalPages, (nextP) => {
      pageIdx = nextP;
    }, {
      bg: '#4a2511',
      border: '#b45309',
      activeGrad: ['#dc2626', '#991b1b'],
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.ingotShop = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
