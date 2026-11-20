(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 征战秘境：五大奇战副本（配备 5 幅独立手绘国风秘境画卷，彻底替换简陋蓝底与Emoji！）
  const ART_KEY = {
    tomb: 'dungeon_tomb',
    defend: 'dungeon_defend',
    pass: 'dungeon_pass',
    escort: 'dungeon_escort',
    chaos: 'dungeon_chaos',
  };
  let chaosPick = false;

  function enter() { chaosPick = false; }

  function start(mode, cfg, bossId) {
    const boss = bossId ? Object.assign({ id: bossId }, cfg.bosses[bossId]) : null;
    App.Main.startBattle(mode, bossId || '1', {
      level: {
        id: mode,
        name: boss ? `混沌四象坛 · ${boss.name}` : cfg.name,
        order: 20 + (cfg.enemyLv || 10),
        chapter: 12,
        biome: mode === 'pass' ? 'canyon' : 'plains',
        recommendedLv: cfg.enemyLv || 10,
        enemyGenerals: [],
        noDisaster: true,
        special: { type: mode, cfg, boss },
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

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 72, W - 52, 44, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });

    const headerIcon = App.Assets.get(chaosPick ? 'icon_chaos_altar' : 'icon_challenge');
    if (headerIcon) {
      ctx.drawImage(headerIcon, 34, 75, 38, 38);
    }

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16.5px "PingFang SC", serif';
    ctx.fillText(chaosPick ? '混沌四象坛 · 选择讨伐太古凶兽' : '九州征战秘境 · 五大奇战副本', 78, 94);
    ctx.restore();

    const myPower = App.State.getTeamPower();
    App.UI.drawResCapsule(ctx, 'res_power', 376, 82, 162, 24, `我方战力 ${myPower}`, {
      color: '#fde047', border: 'rgba(250, 204, 21, 0.55)', glow: 'rgba(245, 158, 11, 0.35)', fontSize: 11,
    });

    App.UI.drawButton(ctx, W - 110, 78, 72, 32, chaosPick ? '◀ 秘境' : '返回', {
      r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12,
    }, () => (chaosPick ? (chaosPick = false) : App.Main.goScene('map')));

    const counts = (st.challengeCounts && st.challengeCounts.date === todayKey()) ? st.challengeCounts : {};

    // 子界面：混沌四象坛四大凶兽选择
    if (chaosPick) {
      const cfg = C.CHALLENGES.chaos, ids = Object.keys(cfg.bosses || {});
      ids.forEach((id, i) => {
        const b = cfg.bosses[id], x = 26 + i * 228, w = 218, y = 124, h = 338;
        const counter = C.BEASTS[b.counter] || {}, on = st.activeBeastId === b.counter;

        App.UI.drawPanel(ctx, x, y, w, h, { r: 12, bg: '#2c1609', border: on ? '#4ade80' : '#d4a34b', lineWidth: 2 });
        App.Portraits.drawBeastPortrait(ctx, b.sprite, x + (w - 118) / 2, y + 14, 118, { radius: 12, border: '#fbbf24', lineWidth: 2.2 });

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 17px "PingFang SC", serif';
        ctx.fillText('太古凶兽 · ' + b.name, x + w / 2, y + 156);

        ctx.fillStyle = on ? '#86efac' : '#fca5a5';
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.fillText(`破盾圣兽：${counter.name || b.counter}`, x + w / 2, y + 180);
        ctx.fillText(on ? '✦ 已随军上阵 · 破除凶兽护盾' : '⚠ 未上阵 · 凶兽护盾减伤九成', x + w / 2, y + 200);

        ctx.fillStyle = '#fed7aa';
        ctx.font = '11.5px "PingFang SC", sans-serif';
        ctx.fillText(`讨伐必掉【${(C.EQUIP_SETS[b.setId] || {}).name || '神兽圣装'}】`, x + w / 2, y + 226);
        ctx.restore();

        App.UI.drawButton(ctx, x + 18, y + h - 58, w - 36, 44, '讨伐太古凶兽', {
          r: 9, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 13.5,
          subText: `耗 ${App.State.getStaminaCost(cfg.staminaCost)} 粮草`,
        }, () => start('chaos', cfg, id));
      });
      App.Scenes.map.drawBottomNav(ctx, '');
      return;
    }

    // 主界面：5 大手绘原画秘境卷轴卡
    const modes = Object.keys(C.CHALLENGES).sort((a, b) => (C.CHALLENGES[a].order || 0) - (C.CHALLENGES[b].order || 0));
    const gap = 8;
    const cw = Math.floor((W - 52 - gap * (modes.length - 1)) / Math.max(1, modes.length));

    modes.forEach((mode, i) => {
      const cfg = C.CHALLENGES[mode], x = 26 + i * (cw + gap), y = 124, h = 338;
      const locked = (st.lordLevel || 1) < (cfg.unlockLordLv || 1);
      const left = Math.max(0, (cfg.dailyLimit || 2) - (counts[mode] || 0));
      const canBeat = myPower >= (cfg.recommendedPower || 0);
      const [title, sub] = String(cfg.name || mode).split(' · ');

      // 檀木鎏金秘境立式卷轴卡
      App.UI.drawPanel(ctx, x, y, cw, h, { r: 12, bg: '#32190b', border: '#c28538', lineWidth: 1.8 });
      App.UI.drawPanel(ctx, x + 4, y + 4, cw - 8, h - 8, { r: 9, bg: '#261207', border: 'rgba(254, 240, 138, 0.22)', lineWidth: 1 });

      // 顶部 106px 高清手绘秘境原画窗
      const art = App.Assets.get(ART_KEY[mode] || 'dungeon_tomb');
      const ix = x + 8, iy = y + 8, iw = cw - 16, ih = 106;
      ctx.save();
      App.UI.roundRect(ctx, ix, iy, iw, ih, 8);
      ctx.clip();
      if (art) {
        ctx.drawImage(art, ix, iy, iw, ih);
      } else {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(ix, iy, iw, ih);
      }
      // 底部暗角过渡衬出副标题角标
      const ig = ctx.createLinearGradient(ix, iy + ih * 0.45, ix, iy + ih);
      ig.addColorStop(0, 'rgba(0,0,0,0)');
      ig.addColorStop(1, 'rgba(18, 8, 3, 0.86)');
      ctx.fillStyle = ig;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.restore();

      ctx.save();
      App.UI.roundRect(ctx, ix, iy, iw, ih, 8);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      if (sub) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
        ctx.fillText(`✦ ${sub} ✦`, x + cw / 2, iy + ih - 8);
      }

      // 秘境大字名 + 玩法简介 + 战力次数
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 15.5px "PingFang SC", serif';
      ctx.fillText(title, x + cw / 2, y + 136);

      ctx.fillStyle = '#e7d5b8';
      ctx.font = '11px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, cfg.desc || '', x + cw / 2, y + 158, cw - 20, 15.5, 'center');

      // 战力与次数内嵌条
      ctx.fillStyle = 'rgba(15, 7, 3, 0.65)';
      App.UI.roundRect(ctx, x + 10, y + 230, cw - 20, 42, 7);
      ctx.fill();

      ctx.fillStyle = canBeat ? '#86efac' : '#fca5a5';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(`推荐战力 ${cfg.recommendedPower || 0}`, x + cw / 2, y + 246);

      ctx.fillStyle = '#fde68a';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(`今日剩余 ${left} / ${cfg.dailyLimit || 2} 次`, x + cw / 2, y + 264);
      ctx.restore();

      App.UI.drawButton(ctx, x + 10, y + h - 56, cw - 20, 44, locked ? `主公 Lv.${cfg.unlockLordLv} 解锁` : (left > 0 ? '击鼓出征' : '今日已战毕'), {
        r: 9,
        grad: mode === 'chaos' ? ['#9a3412', '#581c87'] : ['#d97706', '#92400e'],
        border: '#fef08a',
        fontSize: 13.5,
        subText: locked || left <= 0 ? undefined : `耗 ${App.State.getStaminaCost(cfg.staminaCost)} 粮草`,
        disabled: locked || left <= 0,
      }, () => {
        if (mode !== 'chaos') return start(mode, cfg);
        if (C.BEAST_IDS.some((b) => !st.ownedBeasts[b])) {
          return App.UI.showToast('需先收服全部四象神兽，方可开启混沌四象坛！', '#fca5a5');
        }
        chaosPick = true;
      });
    });

    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.challenge = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
