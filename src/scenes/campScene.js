(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 兵种演武营：用铜钱升级小兵属性（费用与上限来自后台「兵种演武营」配置）
  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const st = App.State.get(), C = App.Config, cfg = C.TROOP_CAMP;
    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);
    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 74, W - 52, 44, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    const campIcon = App.Assets.get('icon_camp');
    if (campIcon) ctx.drawImage(campIcon, 36, 77, 38, 38);
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText(`五军演武营 · 每级全属性 +${Math.round((cfg.statPerLevel || 0) * 100)}%`, 82, 96);
    ctx.restore();
    App.UI.drawButton(ctx, W - 108, 79, 70, 34, '返回', { r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12 }, () => App.Main.goScene('map'));

    const cards = C.TROOP_CARDS;
    const cw = Math.floor((W - 52 - (cards.length - 1) * 10) / Math.max(1, cards.length));
    cards.forEach((card, i) => {
      const x = 26 + i * (cw + 10), y = 128;
      const lv = (st.troopLevels || {})[card.id] || 0;
      const mult = 1 + lv * (cfg.statPerLevel || 0);
      const maxed = lv >= (cfg.maxLevel || 20);
      const cost = (cfg.goldBase || 0) + lv * (cfg.goldStep || 0);
      App.UI.drawPanel(ctx, x, y, cw, 334, { r: 12, bg: '#fff7e0', border: '#a16207', lineWidth: 1.6 });
      const spr = App.Assets.get(card.spriteKey);
      if (spr) ctx.drawImage(spr, x + cw / 2 - 48, y + 12, 96, 96);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#451a03'; ctx.font = 'bold 15px "PingFang SC", serif';
      ctx.fillText(card.name, x + cw / 2, y + 128);
      ctx.fillStyle = '#b45309'; ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(`Lv.${lv} / ${cfg.maxLevel || 20}`, x + cw / 2, y + 150);
      ctx.fillStyle = '#57301a'; ctx.font = '12px "PingFang SC", sans-serif';
      [['气血', card.hp], ['攻击', card.atk], ['防御', card.def]].forEach(([n, v], k) => {
        ctx.fillText(`${n} ${Math.round(v * mult)}${maxed ? '' : ' → ' + Math.round(v * (mult + (cfg.statPerLevel || 0)))}`, x + cw / 2, y + 178 + k * 22);
      });
      ctx.fillStyle = '#92400e'; ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(`出兵消耗 木${card.wood} 粮${card.food}`, x + cw / 2, y + 250);
      ctx.restore();
      App.UI.drawButton(ctx, x + 14, y + 274, cw - 28, 46, maxed ? '已满级' : '操练升级', {
        r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 14, subText: maxed ? undefined : `${cost} 铜钱`, disabled: maxed || App.State.isBusy(),
      }, () => App.State.upgradeTroop(card.id));
    });
    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.camp = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
