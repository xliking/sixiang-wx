(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  let info = null;
  let loading = false;
  let timer = 0;

  async function load() {
    if (loading) return;
    loading = true;
    try {
      const res = await App.API.get('/api/worldboss/info');
      if (res && res.ok) info = res;
    } finally {
      loading = false;
    }
  }

  function enter() { timer = 0; load(); }

  function update(dt) {
    timer += dt;
    if (timer >= 8) { timer = 0; load(); }
  }

  function raidLevel(boss, data) {
    const st = App.State.get();
    const deployIds = (st && st.deployIds && st.deployIds.length) ? st.deployIds : [];
    let squadLv = App.State.getAverageTeamLv();
    if (deployIds.length) {
      let sumLv = 0, maxLv = 1;
      deployIds.forEach((gid) => {
        const gs = App.State.getGeneralStats(gid);
        const glv = gs ? (gs.lv || 1) : 1;
        sumLv += glv;
        if (glv > maxLv) maxLv = glv;
      });
      squadLv = Math.round((sumLv / deployIds.length) * 0.65 + maxLv * 0.35);
    }
    const lvOff = boss.lvOffset != null ? boss.lvOffset : 6;
    const lv = Math.max(8, squadLv + lvOff);
    return {
      id: 'raid', name: boss.name, order: 32, chapter: 20, biome: 'canyon',
      battleKey: boss.battleKey || (App.Config.WORLD_BOSS && App.Config.WORLD_BOSS.battleKey) || 'bg_battle_mystic',
      recommendedLv: lv, difficultyMult: 1, towers: 0, noDisaster: true,
      demon: {
        name: boss.name, hpMult: 1,
        atkMult: Math.max(1.25, boss.atkMult || 1.45),
        defMult: boss.defMult || 1.35,
        scale: boss.scale || 2.15, color: boss.color,
      },
      raid: { seconds: data.battleSeconds || 75, hp: data.hp, maxHp: data.maxHp },
      enemyGenerals: [{ id: boss.generalId, lv, isBoss: true }],
    };
  }

  function drawBoard(ctx, data, x, y, w, h, title) {
    App.UI.drawPanel(ctx, x, y, w, h, { r: 10, bg: '#2c150e', border: '#b45309', lineWidth: 1.4 });
    ctx.save();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText(title, x + 14, y + 22);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fde68a'; ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(data.myRank ? `我：第 ${data.myRank} 名 · ${data.myDamage}` : '我：尚未出手', x + w - 14, y + 22);
    ctx.font = '12.5px "PingFang SC", sans-serif';
    const maxRows = Math.min(14, Math.floor((h - 52) / 23));
    (data.top || []).slice(0, maxRows).forEach((r, i) => {
      const ry = y + 50 + i * 23;
      ctx.textAlign = 'left'; ctx.fillStyle = i < 3 ? '#fde047' : '#e7cfa8';
      ctx.fillText(`${r.rank}. ${r.name}`, x + 16, ry, w - 130);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fca5a5';
      ctx.fillText(String(r.damage), x + w - 16, ry);
    });
    if (!(data.top || []).length) { ctx.textAlign = 'center'; ctx.fillStyle = '#b8a287'; ctx.fillText('还没有人出手，抢占伤害榜首！', x + w / 2, y + h / 2); }
    ctx.restore();
  }

  function drawBossCard(ctx, data, x, y, w, h, opts) {
    const boss = data.boss || {};
    App.UI.drawPanel(ctx, x, y, w, h, { r: 12, bg: '#381911', border: '#f59e0b', lineWidth: 1.8 });
    ctx.save();
    const aura = ctx.createRadialGradient(x + w / 2, y + 108, 12, x + w / 2, y + 108, 128);
    aura.addColorStop(0, 'rgba(220, 38, 38, 0.48)');
    aura.addColorStop(1, 'rgba(220, 38, 38, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(x + w / 2, y + 108, 128, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (boss.generalId) App.Portraits.drawGeneralPortrait(ctx, boss.generalId, x + (w - 164) / 2, y + 20, 164, { radius: 13, border: '#fbbf24', lineWidth: 2.5 });

    const hp = Math.max(0, data.hp || 0), maxHp = Math.max(1, data.maxHp || 1), dead = opts.active && hp <= 0;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 18.5px "PingFang SC", serif';
    ctx.fillText(boss.name || '', x + w / 2, y + 208, w - 20);
    ctx.fillStyle = '#fed7aa'; ctx.font = '12.5px "PingFang SC", sans-serif';
    ctx.fillText(opts.statusText, x + w / 2, y + 234, w - 20);
    ctx.restore();
    if (opts.active) {
      App.UI.drawBar(ctx, x + 22, y + 252, w - 44, 15, hp / maxHp, '#dc2626', '#180906');
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(dead ? '已被击杀' : `${hp} / ${maxHp}（${(hp / maxHp * 100).toFixed(1)}%）`, x + w / 2, y + 260);
      ctx.restore();
    }
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#e7cfa8'; ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText(`限时 ${data.battleSeconds || 75} 秒 · 今日剩余 ${data.attemptsLeft} / ${data.dailyAttempts} 次`, x + w / 2, y + 296, w - 16);
    ctx.restore();

    const can = opts.active && !dead && data.attemptsLeft > 0;
    App.UI.drawButton(ctx, x + 28, y + h - 68, w - 56, 50, !opts.active ? '尚未开启' : (dead ? 'BOSS 已被击杀' : (data.attemptsLeft > 0 ? '率军讨伐' : '今日次数已用完')), {
      r: 10, grad: ['#dc2626', '#7f1d1d'], border: '#fde047', fontSize: 15.5, disabled: !can,
    }, () => {
      App.Main.startBattle(opts.mode, '0', { mode: 'demon', backScene: opts.backScene, level: raidLevel(boss, data) }).then((res) => { if (!res.ok) opts.reload(); });
    });
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    ctx.fillStyle = '#180b07';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 16, 58, W - 32, 474, { r: 14, bg: '#2c150e', border: '#d97706', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 66, W - 52, 42, { r: 10, bg: '#1c0a06', border: '#b45309', lineWidth: 1.6 });

    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 16.5px "PingFang SC", serif';
    ctx.fillText('世界BOSS · 全服共讨', 42, 87);
    ctx.fillStyle = '#fde68a'; ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText(info ? `开启时段：${info.windowText}` : '', 228, 87, 460);
    ctx.restore();

    const wbSubCnt = (App.API && App.API.getSubscribeQuota) ? App.API.getSubscribeQuota('boss_rank') : 0;
    App.UI.drawButton(ctx, W - 188, 72, 112, 30, wbSubCnt > 0 ? `已订结算(${wbSubCnt})` : '排名结算提醒', {
      r: 8, grad: wbSubCnt > 0 ? ['#15803d', '#166534'] : ['#b45309', '#78350f'], border: '#fde047', fontSize: 11.5,
    }, () => {
      if (App.API && App.API.subscribeNotice) App.API.subscribeNotice('boss_rank');
    });
    App.UI.drawCloseButton(ctx, W - 66, 71, 32, () => App.Main.goScene('map'));

    if (!info) {
      App.UI.drawPanelLoading(ctx, W / 2, 300, '正在探查魔神踪迹…');
      return;
    }

    drawBossCard(ctx, info, 26, 118, 330, 402, {
      active: info.open,
      statusText: info.open ? (info.killer ? `已被【${info.killer}】完成最后一击` : '魔神降临，全服共讨！') : '魔神尚未降临',
      mode: 'worldboss', backScene: 'worldBoss', reload: load,
    });
    drawBoard(ctx, info.open ? info : { top: [], myRank: 0 }, 366, 118, 290, 402, '本场伤害榜');

    App.UI.drawPanel(ctx, 666, 118, 268, 402, { r: 10, bg: '#2c150e', border: '#b45309', lineWidth: 1.4 });
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText('伤害排名奖励（邮件发放）', 680, 144);
    let ry = 174;
    (info.rankRewards || []).forEach((t) => {
      ctx.fillStyle = '#fde047'; ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(t.label, 680, ry);
      ctx.fillStyle = '#e7cfa8'; ctx.font = '11.5px "PingFang SC", sans-serif';
      ry = App.UI.drawWrappedText(ctx, (t.rewards || []).join(' · '), 680, ry + 19, 240, 17, 'left') + 11;
    });
    ctx.restore();
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.worldBoss = { enter, update, render, drawBoard, drawBossCard, raidLevel };
})(typeof globalThis !== 'undefined' ? globalThis : window);
