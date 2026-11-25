(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;

    // 暖金古风画卷背景
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#3b1d0e');
    bg.addColorStop(0.5, '#592b14');
    bg.addColorStop(1, '#2a1409');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 顶部标题横幅
    App.UI.drawWoodHeader(ctx, 20, 14, W - 40, 74);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 32px "PingFang SC", "STKaiti", serif';
    ctx.fillText('群英志', W / 2, 50);
    ctx.fillStyle = '#fde68a';
    ctx.font = '13px "PingFang SC", sans-serif';
    ctx.fillText('横版即时军团对垒 · 招降名将 · 神装锻造 · 捕捉四象神兽 · 演武场PK', W / 2, 74);
    ctx.restore();

    // 魏 · 蜀 · 吴 三列并排画卷卡片
    const list = App.Config.FACTION_LIST;
    const cardW = 294;
    const cardH = 412;
    const startX = 24;
    const gap = 15;

    list.forEach((fac, idx) => {
      const cx = startX + idx * (cardW + gap);
      const cy = 104;

      App.UI.drawPanel(ctx, cx, cy, cardW, cardH, {
        r: 14,
        bg: '#f5e8c8',
        border: fac.color,
        lineWidth: 3,
      });

      // 顶部阵营彩带
      ctx.save();
      App.UI.roundRect(ctx, cx + 6, cy + 6, cardW - 12, 54, 10);
      ctx.fillStyle = fac.darkColor;
      ctx.fill();

      ctx.fillStyle = fac.color;
      App.UI.roundRect(ctx, cx + 16, cy + 14, 38, 38, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "PingFang SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fac.badge, cx + 35, cy + 33);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 18px "PingFang SC", sans-serif';
      ctx.fillText(fac.name, cx + 64, cy + 33);
      ctx.fillStyle = fac.accent;
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(fac.title, cx + 64, cy + 51);
      ctx.restore();

      // 阵营光环
      App.UI.drawPanel(ctx, cx + 14, cy + 72, cardW - 28, 48, { r: 8, bg: '#ead4a2', border: '#b45309', lineWidth: 1.2 });
      ctx.save();
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText('【阵营光环】', cx + 22, cy + 90);
      ctx.fillStyle = '#451a03';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(fac.bonusDesc, cx + 22, cy + 108);

      // 剧情介绍
      ctx.fillStyle = '#573318';
      ctx.font = '12px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, fac.story, cx + 16, cy + 140, cardW - 32, 18, 'left');

      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText('开局初始三名将（赠神兵+战甲+战马）：', cx + 16, cy + 206);
      ctx.restore();

      // 初始三名将头像
      fac.starters.forEach((gid, sIdx) => {
        const gCfg = App.Config.GENERALS[gid];
        const px = cx + 20 + sIdx * 88;
        const py = cy + 220;
        App.Portraits.drawGeneralPortrait(ctx, gid, px, py, 74, { radius: 10, lineWidth: 2 });
        ctx.save();
        ctx.fillStyle = '#3b1f0b';
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(gCfg.name, px + 37, py + 92);
        const tMeta = App.Config.getGeneralTroopMeta ? App.Config.getGeneralTroopMeta(gid) : { name: App.Config.UNIT_TYPES[gCfg.type].name };
        ctx.fillStyle = '#78350f';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(tMeta.name, px + 37, py + 107);
        ctx.restore();
      });

      App.UI.drawButton(ctx, cx + 28, cy + 348, cardW - 56, 48, `投效${fac.name} · 起兵${fac.capitalName}`, {
        r: 10,
        grad: [fac.color, fac.darkColor],
        border: '#fef08a',
        fontSize: 15,
      }, () => {
        App.State.chooseFaction(fac.id).then((res) => {
          if (!res.ok) return;
          App.UI.showToast(`已投效${fac.name}！全军于${fac.capitalName}集结！`, '#fef08a');
          App.Main.goScene('map');
        });
      });
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.faction = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
