(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  let lastOpenAt = 0;

  function enter() {
    lastOpenAt = Date.now();
    App.State.openShop();
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();
    const offers = App.State.getShopOffers();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });

    // 顶部商铺招牌与刷新栏
    App.UI.drawPanel(ctx, 26, 74, W - 52, 54, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    const remainSec = App.State.getShopRefreshSeconds();
    // 货架由服务端生成：到了自动刷新时间就请求一次
    if ((!offers.length || remainSec <= 0) && Date.now() - lastOpenAt > 3000) { lastOpenAt = Date.now(); App.State.openShop(); }
    const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
    const ss = String(remainSec % 60).padStart(2, '0');

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText('💰 九州铜钱商铺 · 聚宝招贤阁', 42, 99);
    ctx.fillStyle = '#fde68a';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(`使用铜钱直接招募在野名将、购买宝箱粮草物资！  自动刷新倒计时：${mm}:${ss}`, 42, 118);
    ctx.restore();

    App.UI.drawButton(ctx, W - 388, 84, 118, 34, `铜钱刷新(${App.State.SHOP_REFRESH_COST})`, {
      r: 8, grad: ['#b45309', '#78350f'], border: '#fef08a', fontSize: 11,
    }, () => {
      App.State.refreshShop(false);
    });

    App.UI.drawAdButton(ctx, W - 262, 84, 146, 34, '免费刷新·必出神将', {
      r: 8, fontSize: 11,
    }, () => {
      App.Platform.showRewardedAd('stamina', '观看激励视频，免费刷新商铺并必刷出 SSR/UR 稀世名将与折扣好礼！', () => {
        App.State.refreshShop(true);
      });
    });

    App.UI.drawButton(ctx, W - 108, 84, 70, 34, '返回', {
      r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12,
    }, () => App.Main.goScene('map'));

    // 2行 x 3列 豪华货架卡片
    const cardW = 292;
    const cardH = 156;
    offers.forEach((of, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cx = 26 + col * (cardW + 16);
      const cy = 138 + row * (cardH + 14);

      const isHero = of.kind === 'hero';
      App.UI.drawPanel(ctx, cx, cy, cardW, cardH, {
        r: 12,
        bg: of.sold ? 'rgba(92, 74, 56, 0.45)' : (isHero ? '#3b1d11' : '#ead4a2'),
        border: isHero ? '#facc15' : '#854d0e',
        lineWidth: isHero ? 2.4 : 1.8,
      });

      // 左侧商品大图（名将立绘 或 宝箱/装备图标）
      if (isHero) {
        App.Portraits.drawGeneralPortrait(ctx, of.id, cx + 14, cy + 18, 88, { radius: 10, lineWidth: 2.2 });
      } else if (of.kind === 'item' || of.kind === 'equip') {
        App.Sprites.drawEquipIcon(ctx, of.id, cx + 14, cy + 18, 88, { radius: 10, lineWidth: 2.2 });
      } else {
        App.Sprites.drawEquipIcon(ctx, 'sixiang_seal', cx + 14, cy + 18, 88, { radius: 10, lineWidth: 2 });
      }

      // 折扣角标或名将稀有角标
      if (of.tag) {
        ctx.save();
        ctx.fillStyle = isHero ? '#dc2626' : '#d97706';
        App.UI.roundRect(ctx, cx + 10, cy + 10, 62, 18, 5);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(of.tag, cx + 41, cy + 23);
        ctx.restore();
      }

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = isHero ? '#fef08a' : '#451a03';
      ctx.font = 'bold 15px "PingFang SC", sans-serif';
      ctx.fillText(of.title, cx + 114, cy + 36);

      ctx.fillStyle = isHero ? '#fde68a' : '#7c2d12';
      ctx.font = '11px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, of.desc, cx + 114, cy + 58, 166, 15, 'left');
      ctx.restore();

      const canAfford = st.gold >= of.price;
      App.UI.drawButton(ctx, cx + 114, cy + 98, 164, 44, of.sold ? '✓ 已售罄' : `${of.price} 铜钱购买`, {
        r: 9,
        grad: isHero ? ['#d97706', '#92400e'] : ['#9a3412', '#7c2d12'],
        border: '#fef08a',
        fontSize: 13,
        subText: of.sold ? '等待下次刷新' : (canAfford ? (isHero ? '立即招募入营' : '立即购买入库') : '铜钱不足(点顶部铜钱+号)'),
        disabled: of.sold,
      }, () => {
        App.State.buyShopOffer(idx);
      });
    });

    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.shop = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
