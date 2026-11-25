(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 世界 BOSS：每天固定时段开启，全服共享血量。本场造成的伤害由战斗上报，服务端封顶后扣血、发奖，
  // 时段结束或击杀后按伤害排名邮件发奖。
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

  // 停留在界面时每 8 秒刷新一次血量与伤害榜
  function update(dt) {
    timer += dt;
    if (timer >= 8) { timer = 0; load(); }
  }

  /** 共享血量 BOSS 的战斗关卡（世界 BOSS、联盟 BOSS 共用）：沿用魔将战的巨型 BOSS 演出，血量取服务端剩余值 */
  function raidLevel(boss, data) {
    // 严格按挑战者当前【上阵主力阵容】等级计算 BOSS 攻防（不再被仓库 1 级闲置武将拉低！）
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

  /** 伤害榜面板（世界 BOSS、联盟 BOSS 共用） */
  function drawBoard(ctx, data, x, y, w, h, title) {
    App.UI.drawPanel(ctx, x, y, w, h, { r: 10, bg: '#2c150e', border: '#b45309', lineWidth: 1.4 });
    ctx.save();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 13.5px "PingFang SC", serif';
    ctx.fillText(title, x + 14, y + 18);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fde68a'; ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(data.myRank ? `我：第 ${data.myRank} 名 · 伤害 ${data.myDamage}` : '我：尚未出手', x + w - 14, y + 18);
    ctx.font = '12px "PingFang SC", sans-serif';
    (data.top || []).slice(0, 10).forEach((r, i) => {
      const ry = y + 44 + i * 20;
      ctx.textAlign = 'left'; ctx.fillStyle = i < 3 ? '#fde047' : '#e7cfa8';
      ctx.fillText(`${r.rank}. ${r.name}`, x + 16, ry, w - 130);
      ctx.textAlign = 'right'; ctx.fillStyle = '#fca5a5';
      ctx.fillText(String(r.damage), x + w - 16, ry);
    });
    if (!(data.top || []).length) { ctx.textAlign = 'center'; ctx.fillStyle = '#b8a287'; ctx.fillText('还没有人出手，抢占伤害榜首！', x + w / 2, y + 90); }
    ctx.restore();
  }

  /** BOSS 立绘 + 血条 + 讨伐按钮（世界 BOSS、联盟 BOSS 共用） */
  function drawBossCard(ctx, data, x, y, w, h, opts) {
    const boss = data.boss || {};
    App.UI.drawPanel(ctx, x, y, w, h, { r: 12, bg: '#381911', border: '#f59e0b', lineWidth: 1.8 });
    ctx.save();
    const aura = ctx.createRadialGradient(x + w / 2, y + 96, 12, x + w / 2, y + 96, 120);
    aura.addColorStop(0, 'rgba(220, 38, 38, 0.48)');
    aura.addColorStop(1, 'rgba(220, 38, 38, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(x + w / 2, y + 96, 120, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (boss.generalId) App.Portraits.drawGeneralPortrait(ctx, boss.generalId, x + (w - 150) / 2, y + 16, 150, { radius: 12, border: '#fbbf24', lineWidth: 2.4 });

    const hp = Math.max(0, data.hp || 0), maxHp = Math.max(1, data.maxHp || 1), dead = opts.active && hp <= 0;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText(boss.name || '', x + w / 2, y + 186, w - 20);
    ctx.fillStyle = '#fed7aa'; ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText(opts.statusText, x + w / 2, y + 208, w - 20);
    ctx.restore();
    if (opts.active) {
      App.UI.drawBar(ctx, x + 22, y + 222, w - 44, 14, hp / maxHp, '#dc2626', '#180906');
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(dead ? '已被击杀' : `${hp} / ${maxHp}（${(hp / maxHp * 100).toFixed(1)}%）`, x + w / 2, y + 229.5);
      ctx.restore();
    }
    ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#e7cfa8'; ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(`限时 ${data.battleSeconds || 75} 秒，按造成的伤害发奖 · 今日剩余 ${data.attemptsLeft} / ${data.dailyAttempts} 次`, x + w / 2, y + 258, w - 16);
    ctx.restore();

    const can = opts.active && !dead && data.attemptsLeft > 0;
    App.UI.drawButton(ctx, x + 30, y + h - 62, w - 60, 46, !opts.active ? '尚未开启' : (dead ? 'BOSS 已被击杀' : (data.attemptsLeft > 0 ? '率军讨伐' : '今日次数已用完')), {
      r: 10, grad: ['#dc2626', '#7f1d1d'], border: '#fde047', fontSize: 15, disabled: !can,
    }, () => {
      App.Main.startBattle(opts.mode, '0', { mode: 'demon', backScene: opts.backScene, level: raidLevel(boss, data) }).then((res) => { if (!res.ok) opts.reload(); });
    });
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    ctx.fillStyle = '#1e0f0a';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);
    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#2c150e', border: '#d97706', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 72, W - 52, 44, { r: 10, bg: '#1c0a06', border: '#b45309', lineWidth: 1.6 });
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText('世界BOSS · 全服共讨', 42, 94);
    ctx.fillStyle = '#fde68a'; ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText(info ? `每日开启时段：${info.windowText}` : '', 230, 95, 480);
    ctx.restore();
    const wbSubCnt = (App.API && App.API.getSubscribeQuota) ? App.API.getSubscribeQuota('boss_rank') : 0;
    App.UI.drawButton(ctx, W - 216, 78, 106, 32, wbSubCnt > 0 ? `已订结算(${wbSubCnt})` : '排名结算提醒', {
      r: 8, grad: wbSubCnt > 0 ? ['#15803d', '#166534'] : ['#b45309', '#78350f'], border: '#fde047', fontSize: 11.5,
    }, () => {
      if (App.API && App.API.subscribeNotice) App.API.subscribeNotice('boss_rank');
    });
    App.UI.drawButton(ctx, W - 104, 78, 68, 32, '返回', { r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12 }, () => App.Main.goScene('map'));

    if (!info) {
      App.UI.drawPanelLoading(ctx, W / 2, 280, '正在探查魔神踪迹…');
      App.Scenes.map.drawBottomNav(ctx, '');
      return;
    }

    drawBossCard(ctx, info, 26, 124, 330, 338, {
      active: info.open,
      statusText: info.open ? (info.killer ? `已被【${info.killer}】完成最后一击` : '魔神降临，全服共讨！') : '魔神尚未降临',
      mode: 'worldboss', backScene: 'worldBoss', reload: load,
    });
    drawBoard(ctx, info.open ? info : { top: [], myRank: 0 }, 366, 124, 290, 338, '本场伤害榜');

    // 排名奖励
    App.UI.drawPanel(ctx, 666, 124, 268, 338, { r: 10, bg: '#2c150e', border: '#b45309', lineWidth: 1.4 });
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 13.5px "PingFang SC", serif';
    ctx.fillText('伤害排名奖励（邮件发放）', 680, 142);
    let ry = 166;
    (info.rankRewards || []).forEach((t) => {
      ctx.fillStyle = '#fde047'; ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(t.label, 680, ry);
      ctx.fillStyle = '#e7cfa8'; ctx.font = '11.5px "PingFang SC", sans-serif';
      ry = App.UI.drawWrappedText(ctx, (t.rewards || []).join(' · '), 680, ry + 17, 240, 15, 'left') + 7;
    });
    ctx.restore();
    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.worldBoss = { enter, update, render, drawBoard, drawBossCard, raidLevel };
})(typeof globalThis !== 'undefined' ? globalThis : window);
