(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 魔将挑战：击败巨型魔将获得信物，集齐后兑换该武将（魔将列表与数值来自后台「魔将挑战」配置）
  let page = 0;

  function enter() { page = 0; }

  function challenge(d) {
    const g = App.Config.GENERALS[d.generalId];
    if (!g) return App.UI.showToast('魔将配置有误', '#f87171');
    App.Main.startBattle('demon', d.id, {
      level: {
        id: d.id, name: d.name, order: 40, chapter: 20, biome: 'canyon',
        recommendedLv: d.enemyLv, towers: 1, demon: d,
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

    // 暗金赤煞背景底板
    ctx.fillStyle = '#1e0f0a';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#2c150e', border: '#d97706', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 72, W - 52, 44, { r: 10, bg: '#1c0a06', border: '#b45309', lineWidth: 1.6 });

    // 左上角手绘魔将金章图标 + 标题（彻底移除廉价Emoji，且与右侧翻页按钮完全分区零遮挡！）
    const demonIcon = App.Assets.get('icon_demon');
    if (demonIcon) {
      ctx.drawImage(demonIcon, 34, 75, 38, 38);
    }
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText('魔将讨伐榜 · 斩魔集信物兑无双神将', 78, 94);
    ctx.restore();

    const myPower = App.State.getTeamPower();
    App.UI.drawResCapsule(ctx, 'res_power', 432, 82, 162, 24, `我方战力 ${myPower}`, {
      color: '#fde047', border: 'rgba(250, 204, 21, 0.55)', glow: 'rgba(220, 38, 38, 0.35)', fontSize: 11,
    });

    const list = Object.keys(C.DEMONS).map((k) => Object.assign({ id: k }, C.DEMONS[k])).sort((a, b) => (a.order || 0) - (b.order || 0));
    const maxPage = Math.max(0, Math.ceil(list.length / 3) - 1);
    page = Math.min(page, maxPage);

    if (maxPage > 0) {
      App.UI.drawButton(ctx, 610, 78, 76, 32, '◀ 上一批', {
        r: 8, grad: ['#78350f', '#451a03'], border: '#fde047', fontSize: 11, disabled: page <= 0,
      }, () => { page -= 1; });

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`${page + 1} / ${maxPage + 1}`, 716, 94);
      ctx.restore();

      App.UI.drawButton(ctx, 746, 78, 76, 32, '下一批 ▶', {
        r: 8, grad: ['#b45309', '#78350f'], border: '#fde047', fontSize: 11, disabled: page >= maxPage,
      }, () => { page += 1; });
    }

    App.UI.drawButton(ctx, W - 104, 78, 68, 32, '返回', {
      r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12,
    }, () => App.Main.goScene('map'));

    const today = (st.demonCounts && st.demonCounts.date === todayKey()) ? st.demonCounts : {};

    list.slice(page * 3, page * 3 + 3).forEach((d, i) => {
      const x = 26 + i * 304, y = 124, w = 296, h = 338;
      const g = C.GENERALS[d.generalId] || {};
      const tokens = (st.demonTokens || {})[d.id] || 0;
      const locked = (st.lordLevel || 1) < (d.unlockLordLv || 1);
      const left = Math.max(0, (d.dailyLimit || 3) - (today[d.id] || 0));
      const canBeat = myPower >= d.recommendedPower;

      // 外层赤金雕花讨伐卡 + 顶部暗焰辉光衬底
      App.UI.drawPanel(ctx, x, y, w, h, { r: 12, bg: '#381911', border: '#f59e0b', lineWidth: 1.8 });
      App.UI.drawPanel(ctx, x + 5, y + 5, w - 10, h - 10, { r: 9, bg: 'rgba(28, 10, 6, 0.55)', border: 'rgba(248, 113, 113, 0.35)', lineWidth: 1 });

      ctx.save();
      const aura = ctx.createRadialGradient(x + w / 2, y + 84, 12, x + w / 2, y + 84, 92);
      aura.addColorStop(0, 'rgba(220, 38, 38, 0.48)');
      aura.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.arc(x + w / 2, y + 84, 92, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      App.Portraits.drawGeneralPortrait(ctx, d.generalId, x + (w - 128) / 2, y + 14, 128, { radius: 12, border: '#fbbf24', lineWidth: 2.4 });

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 17px "PingFang SC", serif';
      ctx.fillText(d.name, x + w / 2, y + 164);

      ctx.fillStyle = canBeat ? '#86efac' : '#fca5a5';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`推荐战力 ${d.recommendedPower}${canBeat ? '（兵力充沛）' : '（强敌慎入）'}`, x + w / 2, y + 185);

      // 战利品黑金条
      ctx.fillStyle = 'rgba(20, 8, 4, 0.72)';
      App.UI.roundRect(ctx, x + 18, y + 195, w - 36, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText(`击败掉：信物×${d.tokensPerWin} · 铜钱+${d.rewardGold} · 将魂+${d.rewardSoul}`, x + w / 2, y + 211);

      ctx.fillStyle = '#fed7aa';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(`${g.rarity || 'SSR'} 无双名将【${g.name || ''}】信物进度：${tokens} / ${d.tokensNeeded}`, x + w / 2, y + 236);
      ctx.restore();

      App.UI.drawBar(ctx, x + 24, y + 244, w - 48, 9, Math.min(1, tokens / Math.max(1, d.tokensNeeded)), '#f59e0b', '#180906');

      if (tokens >= d.tokensNeeded) {
        App.UI.drawButton(ctx, x + 22, y + 260, w - 44, 30, `✦ 集齐信物 · 立即招募【${g.name}】`, {
          r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12,
        }, () => App.State.demonRedeem(d.id));
      }

      App.UI.drawButton(ctx, x + 22, y + 294, w - 44, 36, locked ? `主公 Lv.${d.unlockLordLv} 开启讨伐` : (left > 0 ? '挥师讨伐魔将' : '今日讨伐次数已尽'), {
        r: 9,
        grad: ['#dc2626', '#7f1d1d'],
        border: '#fde047',
        fontSize: 13.5,
        subText: locked || left <= 0 ? undefined : `耗 ${App.State.getStaminaCost(d.staminaCost)} 粮草 · 今日剩 ${left} 次`,
        disabled: locked || left <= 0,
      }, () => challenge(d));
    });

    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.demon = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
