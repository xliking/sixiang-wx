(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 魔将挑战：击败巨型魔将获得信物，集齐后兑换该武将
  let page = 0;

  function enter() { page = 0; }

  function challenge(d) {
    const g = App.Config.GENERALS[d.generalId];
    if (!g) return App.UI.showToast('魔将配置有误', '#f87171');
    App.Main.startBattle('demon', d.id, {
      level: {
        id: d.id, name: d.name, order: 40, chapter: 20, biome: 'canyon',
        battleKey: d.battleKey || undefined,
        recommendedLv: d.enemyLv, difficultyMult: d.difficultyMult || 1, towers: 1, demon: d,
        enemyGenerals: [{ id: d.generalId, lv: d.enemyLv, isBoss: true }],
      },
    });
  }

  function todayKey() {
    const d = new Date(App.API.now());
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const st = App.State.get(), C = App.Config;
    const myPower = App.State.getTeamPower();

    // 暗金赤煞背景底板
    ctx.fillStyle = '#180b07';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 满高外框画板（y=58..532，彻底消除底部空框留白）
    App.UI.drawPanel(ctx, 26, 58, W - 52, 474, { r: 14, bg: '#2c150e', border: '#d97706', lineWidth: 2 });
    App.UI.drawPanel(ctx, 36, 66, W - 72, 42, { r: 10, bg: '#1c0a06', border: '#b45309', lineWidth: 1.6 });

    const demonIcon = App.Assets.get('icon_demon');
    if (demonIcon) {
      ctx.drawImage(demonIcon, 44, 70, 34, 34);
    }
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16.5px "PingFang SC", serif';
    ctx.fillText('魔将讨伐榜', 86, 87);
    ctx.fillStyle = '#fde68a';
    ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText('斩魔集齐信物，直接招募 A ~ SSS 无双名将', 184, 87);
    ctx.restore();

    // 右上角统一 ✕ 关闭圆章按钮
    App.UI.drawCloseButton(ctx, W - 74, 71, 32, () => App.Main.goScene('map'));

    const list = Object.keys(C.DEMONS).map((k) => Object.assign({ id: k }, C.DEMONS[k])).sort((a, b) => (a.order || 0) - (b.order || 0));
    const totalPages = Math.max(1, Math.ceil(list.length / 3));
    page = Math.max(0, Math.min(page, totalPages - 1));

    const today = (st.demonCounts && st.demonCounts.date === todayKey()) ? st.demonCounts : {};

    list.slice(page * 3, page * 3 + 3).forEach((d, i) => {
      const w = 288, h = 404, gap = 10;
      const x = 38 + i * (w + gap), y = 116;
      const g = C.GENERALS[d.generalId] || {};
      const tokens = (st.demonTokens || {})[d.id] || 0;
      const locked = (st.lordLevel || 1) < (d.unlockLordLv || 1);
      const left = Math.max(0, (d.dailyLimit || 3) - (today[d.id] || 0));
      const recPower = App.Config.scaleRecommendedPower('demon', d.recommendedPower || d.enemyLv * 1650, d);
      const canBeat = myPower >= recPower;

      App.UI.drawPanel(ctx, x, y, w, h, { r: 12, bg: '#381911', border: '#f59e0b', lineWidth: 1.8 });
      App.UI.drawPanel(ctx, x + 5, y + 5, w - 10, h - 10, { r: 9, bg: 'rgba(28, 10, 6, 0.58)', border: 'rgba(248, 113, 113, 0.35)', lineWidth: 1 });

      ctx.save();
      const aura = ctx.createRadialGradient(x + w / 2, y + 96, 12, x + w / 2, y + 96, 102);
      aura.addColorStop(0, 'rgba(220, 38, 38, 0.50)');
      aura.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(x + w / 2, y + 96, 102, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      App.Portraits.drawGeneralPortrait(ctx, d.generalId, x + (w - 144) / 2, y + 18, 144, { radius: 13, border: '#fbbf24', lineWidth: 2.5 });

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 18.5px "PingFang SC", serif';
      ctx.fillText(d.name, x + w / 2, y + 188);

      ctx.fillStyle = canBeat ? '#86efac' : '#fca5a5';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`推荐战力 ${recPower}`, x + w / 2, y + 212);

      // 战利品黑金条
      ctx.fillStyle = 'rgba(20, 8, 4, 0.78)';
      App.UI.roundRect(ctx, x + 16, y + 226, w - 32, 28, 7);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText(`掉落：信物×${d.tokensPerWin} · 铜钱+${d.rewardGold} · 将魂+${d.rewardSoul}`, x + w / 2, y + 244);

      ctx.fillStyle = '#fed7aa';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`${g.rarity || 'SS'} 名将【${g.name || ''}】信物：${tokens} / ${d.tokensNeeded}`, x + w / 2, y + 276);
      ctx.restore();

      App.UI.drawBar(ctx, x + 22, y + 286, w - 44, 10, Math.min(1, tokens / Math.max(1, d.tokensNeeded)), '#f59e0b', '#180906');

      if (tokens >= d.tokensNeeded) {
        App.UI.drawButton(ctx, x + 20, y + 306, w - 40, 34, `✦ 集齐信物 · 立即招募【${g.name}】`, {
          r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12.5,
        }, () => App.State.demonRedeem(d.id));
      }

      App.UI.drawButton(ctx, x + 20, y + 346, w - 40, 44, locked ? `主公 Lv.${d.unlockLordLv} 开启讨伐` : (left > 0 ? '挥师讨伐魔将' : '今日讨伐次数已尽'), {
        r: 10,
        grad: ['#dc2626', '#7f1d1d'],
        border: '#fde047',
        fontSize: 14,
        subText: locked || left <= 0 ? undefined : `耗 ${App.State.getStaminaCost(d.staminaCost)} 粮草 · 今日剩 ${left} 次`,
        disabled: locked || left <= 0,
      }, () => challenge(d));
    });

    // 左右两侧翻页耳标按钮
    App.UI.drawSidePageButtons(ctx, page, totalPages, (p) => { page = p; }, {
      cy: 318,
      grad: ['#7f1d1d', '#3b0a06'],
      border: '#f59e0b',
      arrowColor: '#fef08a',
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.demon = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
