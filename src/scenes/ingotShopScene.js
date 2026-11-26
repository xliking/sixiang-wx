(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 紫微珍宝阁采用尊贵竖版圣坛展台卡（4列 × 2排 = 8尊展台），与铜钱集市横版木牌彻底区分
  const COLS = 4;
  const ROWS = 2;
  const PAGE_SIZE = COLS * ROWS;

  const TABS = [
    { id: 'all', label: '全部臻品' },
    { id: 'hero', label: 'S~SSS神将' },
    { id: 'equip', label: '传世神兵' },
    { id: 'chest', label: '皇家秘匣' },
    { id: 'treasure', label: '神丹法宝' },
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

  function getOfferAccent(of) {
    const q = of.quality || (of.price >= 85 ? 'supreme' : (of.price >= 55 ? 'mythic' : (of.price >= 18 ? 'gold' : 'purple')));
    if (q === 'supreme') {
      return {
        topGrad: ['#4c0519', '#1e0b2b'], border: '#facc15', halo: 'rgba(250, 204, 21, 0.34)',
        tagBg: '#be123c', titleCol: '#fef08a', descCol: '#fbcfe8', btnGrad: ['#dc2626', '#881337'], qLabel: '至尊圣品',
      };
    }
    if (q === 'mythic') {
      return {
        topGrad: ['#431407', '#1d0d2e'], border: '#fbbf24', halo: 'rgba(251, 146, 60, 0.30)',
        tagBg: '#b45309', titleCol: '#fef08a', descCol: '#fde68a', btnGrad: ['#d97706', '#92400e'], qLabel: '无双名器',
      };
    }
    if (q === 'gold') {
      return {
        topGrad: ['#3b1d5e', '#170b28'], border: '#eab308', halo: 'rgba(234, 179, 8, 0.24)',
        tagBg: '#7e22ce', titleCol: '#fef08a', descCol: '#e9d5ff', btnGrad: ['#ca8a04', '#854d0e'], qLabel: '皇家金品',
      };
    }
    return {
      topGrad: ['#2e1065', '#130921'], border: '#c084fc', halo: 'rgba(192, 132, 252, 0.24)',
      tagBg: '#6d28d9', titleCol: '#f3e8ff', descCol: '#d8b4fe', btnGrad: ['#7e22ce', '#4c1d95'], qLabel: '紫微奇珍',
    };
  }

  function drawArtifactIcon(ctx, aid, x, y, sz, border) {
    const art = App.Config.ARTIFACTS && App.Config.ARTIFACTS[aid];
    const img = art && art.imgKey ? App.Assets.get(art.imgKey) : null;
    ctx.save();
    App.UI.roundRect(ctx, x, y, sz, sz, 11);
    ctx.clip();
    ctx.fillStyle = '#2e1065';
    ctx.fillRect(x, y, sz, sz);
    if (img) {
      ctx.drawImage(img, x, y, sz, sz);
    } else {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 16px "PingFang SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(art ? art.name.slice(0, 2) : '至宝', x + sz / 2, y + sz / 2);
    }
    ctx.restore();
    ctx.save();
    App.UI.roundRect(ctx, x, y, sz, sz, 11);
    ctx.strokeStyle = border || '#facc15';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();
    const rawOffers = App.State.getIngotShopOffers();

    // 皇家暗夜紫微星阙底色
    ctx.fillStyle = '#0b0516';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 紫微秘殿大画框（y=58..532 满屏铺展，无底部留白）
    ctx.save();
    App.UI.roundRect(ctx, 26, 58, W - 52, 474, 15);
    const hallGrad = ctx.createLinearGradient(26, 58, 26, 532);
    hallGrad.addColorStop(0, '#220e3b');
    hallGrad.addColorStop(0.5, '#150826');
    hallGrad.addColorStop(1, '#0d051a');
    ctx.fillStyle = hallGrad;
    ctx.fill();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 内层紫金星辉暗线框
    App.UI.roundRect(ctx, 31, 63, W - 62, 464, 12);
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // 顶部紫微帝阙横匾
    App.UI.drawPanel(ctx, 36, 66, W - 72, 42, { r: 10, bg: '#2b0d46', border: '#facc15', lineWidth: 1.8 });
    const remainSec = App.State.getIngotShopRefreshSeconds();
    if ((!rawOffers.length || remainSec <= 0) && Date.now() - lastOpenAt > 3000) {
      lastOpenAt = Date.now();
      App.State.openIngotShop();
    }
    const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
    const ss = String(remainSec % 60).padStart(2, '0');

    App.UI.drawMiniIcon(ctx, 'res_ingot', 44, 73, 28);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 14.5px "PingFang SC", serif';
    ctx.fillText('紫微珍宝阁', 76, 84);
    ctx.fillStyle = '#e9d5ff';
    ctx.font = '10px "PingFang SC", sans-serif';
    ctx.fillText(`秘殿轮换 ${mm}:${ss}`, 76, 100);
    ctx.restore();

    let tabX = 166;
    TABS.forEach((tb) => {
      const isCur = activeTab === tb.id;
      App.UI.drawButton(ctx, tabX, 73, 70, 28, tb.label, {
        r: 7,
        grad: isCur ? ['#be123c', '#6b21a8'] : undefined,
        bg: isCur ? undefined : 'rgba(15, 6, 28, 0.78)',
        border: isCur ? '#fef08a' : 'rgba(192, 132, 252, 0.45)',
        color: isCur ? '#fffbeb' : '#e9d5ff',
        fontSize: 10.5,
      }, () => {
        if (activeTab !== tb.id) {
          activeTab = tb.id;
          pageIdx = 0;
        }
      });
      tabX += 74;
    });

    // 右侧快捷操作 + 右上角 ✕ 关闭按钮
    const adsOn = !!(App.Config && App.Config.isAdEnabled && App.Config.isAdEnabled());
    App.UI.drawButton(ctx, adsOn ? (W - 420) : (W - 324), 73, 68, 28, '货币互转', {
      r: 7, grad: ['#ca8a04', '#854d0e'], border: '#fef08a', fontSize: 10,
    }, () => {
      if (App.UI && App.UI.openExchangeModal) App.UI.openExchangeModal();
    });

    App.UI.drawButton(ctx, adsOn ? (W - 348) : (W - 250), 73, 72, 28, '铜钱集市', {
      r: 7, bg: '#3b1c5a', border: '#c084fc', fontSize: 10,
    }, () => App.Main.goScene('shop'));

    const refCost = App.State.INGOT_SHOP_REFRESH_COST;
    App.UI.drawButton(ctx, adsOn ? (W - 272) : (W - 172), 73, 88, 28, `刷新(${refCost}元宝)`, {
      r: 7, grad: ['#7e22ce', '#4c1d95'], border: '#f5d0fe', fontSize: 10,
    }, () => {
      pageIdx = 0;
      App.State.refreshIngotShop(false);
    });

    if (adsOn) {
      App.UI.drawAdButton(ctx, W - 180, 73, 98, 28, '免费刷SSS神将', {
        r: 7, fontSize: 9.5,
      }, () => {
        App.Platform.showRewardedAd('stamina', '观看激励视频，免费刷新元宝商店并必出 SSS 至尊神将与传世至宝！', () => {
          pageIdx = 0;
          App.State.refreshIngotShop(true);
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
      App.UI.drawPanelLoading(ctx, W / 2, 296, '正在开启紫微珍宝阁，清点皇家秘宝…');
      return;
    }

    // ★ 4列 × 2排 竖版皇家莲台展柜卡（居中宝光底座 + 顶部玉牌 + 底部鎏金元宝圣召键）
    const startX = 38;
    const startY = 116;
    const gapX = 12;
    const gapY = 12;
    const cardW = 212;
    const cardH = 196;

    pageItems.forEach((entry, slot) => {
      const of = entry.of;
      const col = slot % COLS;
      const row = Math.floor(slot / COLS);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const isHero = of.kind === 'hero';
      const acc = getOfferAccent(of);

      // 竖版深紫鎏金展台底板
      ctx.save();
      App.UI.roundRect(ctx, cx, cy, cardW, cardH, 12);
      if (of.sold) {
        ctx.fillStyle = 'rgba(30, 20, 44, 0.62)';
      } else {
        const cg = ctx.createLinearGradient(cx, cy, cx, cy + cardH);
        cg.addColorStop(0, acc.topGrad[0]);
        cg.addColorStop(1, acc.topGrad[1]);
        ctx.fillStyle = cg;
      }
      ctx.fill();
      ctx.strokeStyle = of.sold ? '#64748b' : acc.border;
      ctx.lineWidth = of.sold ? 1.2 : 2.0;
      ctx.stroke();

      // 居中宝光神环与莲花底座
      const midX = cx + cardW / 2;
      const iconSz = 66;
      const iconX = Math.round(midX - iconSz / 2);
      const iconY = cy + 30;
      if (!of.sold) {
        const hg = ctx.createRadialGradient(midX, iconY + iconSz / 2, 6, midX, iconY + iconSz / 2, 54);
        hg.addColorStop(0, acc.halo);
        hg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(midX, iconY + iconSz / 2, 54, 0, Math.PI * 2);
        ctx.fill();

        // 鎏金展台托盘光弧
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.48)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(midX, iconY + iconSz + 3, 44, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // 居中大图展示
      if (isHero) {
        App.Portraits.drawGeneralPortrait(ctx, of.id, iconX, iconY, iconSz, { radius: 11, border: acc.border, lineWidth: 2.2 });
      } else if (of.kind === 'artifact') {
        drawArtifactIcon(ctx, of.id, iconX, iconY, iconSz, acc.border);
      } else if (of.kind === 'item' || of.kind === 'equip') {
        App.Sprites.drawEquipIcon(ctx, of.id, iconX, iconY, iconSz, { radius: 11, border: acc.border, lineWidth: 2.0 });
      } else {
        ctx.save();
        App.UI.roundRect(ctx, iconX, iconY, iconSz, iconSz, 11);
        ctx.fillStyle = '#3b0764';
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.0;
        ctx.stroke();
        App.UI.drawMiniIcon(ctx, 'res_soul', iconX + 13, iconY + 13, 40);
        ctx.restore();
      }

      // 顶部居中皇室品阶铭牌
      const tagText = of.tag || acc.qLabel;
      if (tagText) {
        ctx.save();
        ctx.font = 'bold 9px "PingFang SC", sans-serif';
        const tagW = Math.min(92, Math.max(54, Math.ceil(ctx.measureText(tagText).width + 14)));
        ctx.fillStyle = of.sold ? '#475569' : acc.tagBg;
        App.UI.roundRect(ctx, midX - tagW / 2, cy + 7, tagW, 17, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.65)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tagText, midX, cy + 15.5, tagW - 6);
        ctx.restore();
      }

      // 居中商品圣名 + 单行精炼效用胶囊（告别密集文字块）
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = of.sold ? '#94a3b8' : acc.titleCol;
      ctx.font = 'bold 13px "PingFang SC", serif';
      ctx.fillText(fitSingleLine(ctx, of.title, cardW - 20), midX, cy + 116);

      ctx.fillStyle = 'rgba(10, 4, 20, 0.55)';
      App.UI.roundRect(ctx, cx + 10, cy + 125, cardW - 20, 21, 6);
      ctx.fill();
      ctx.fillStyle = of.sold ? '#64748b' : acc.descCol;
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(fitSingleLine(ctx, of.desc, cardW - 28), midX, cy + 139);
      ctx.restore();

      // 底部皇家元宝购入按钮
      const price = Math.max(10, Number(of.price) || 10);
      const canAfford = (st.ingot || 0) >= price;
      const btnLabel = of.sold
        ? '✓ 已收入囊中'
        : `   ${price} 元宝${isHero ? '圣召' : '迎请'}`;
      App.UI.drawButton(ctx, cx + 14, cy + 154, cardW - 28, 33, btnLabel, {
        r: 9,
        grad: of.sold ? undefined : acc.btnGrad,
        bg: of.sold ? '#334155' : undefined,
        border: of.sold ? '#64748b' : (canAfford ? '#fef08a' : '#f87171'),
        color: of.sold ? '#cbd5e1' : (canAfford ? '#fffbeb' : '#fecaca'),
        fontSize: 11.5,
        disabled: of.sold,
      }, () => {
        if (!canAfford) {
          App.UI.showToast(`元宝不足 ${price}（当前 ${st.ingot || 0}），可点上方【货币互转】换算！`, '#fde047');
          return;
        }
        App.State.buyIngotShopOffer(entry.realIdx);
      });
      if (!of.sold) {
        App.UI.drawMiniIcon(ctx, 'res_ingot', cx + 26, cy + 162, 17);
      }
    });

    // 左右两侧皇家紫金翻页按钮
    App.UI.drawSidePageButtons(ctx, pageIdx, totalPages, (nextP) => {
      pageIdx = nextP;
    }, {
      cy: 318,
      grad: ['#6b21a8', '#2e1065'],
      border: '#facc15',
      arrowColor: '#fef08a',
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.ingotShop = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
