(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const ART_KEY = {
    tomb: 'dungeon_tomb',
    treasury: 'dungeon_treasury',
    defend: 'dungeon_defend',
    pass: 'dungeon_pass',
    escort: 'dungeon_escort',
    chaos: 'dungeon_chaos',
    xian: 'dungeon_xian',
    mo: 'dungeon_mo',
  };
  const DEFAULT_ASCEND_CHALLENGES = {
    xian: {
      name: '成神副本 · 九天封神台',
      desc: '登临昆仑九重封神台迎战天界神尊，掉落【九转封神丹】与【太初神灵髓】，助150级名将晋升成神（等级.神）',
      unlockLordLv: 20, staminaCost: 12, dailyLimit: 3, recommendedPower: 132000, enemyLv: 38, difficultyMult: 1,
      tierStepLv: 15, tierRewardStep: 0.35, maxTier: 5, healPct: 0.20,
      passes: [{ name: '南天神门', generalId: 'zhaoyun' }, { name: '紫微神阙', generalId: 'zhugeliang' }, { name: '九天封神坛', generalId: 'liubei' }],
    },
    mo: {
      name: '成魔副本 · 幽冥魔渊',
      desc: '深入九幽血海炼狱激战修罗魔尊，掉落【九幽化魔丹】与【炼狱魔煞晶】，助150级名将觉醒成魔（等级.魔）',
      unlockLordLv: 20, staminaCost: 12, dailyLimit: 3, recommendedPower: 132000, enemyLv: 38, difficultyMult: 1,
      tierStepLv: 15, tierRewardStep: 0.35, maxTier: 5, healPct: 0.16,
      passes: [{ name: '修罗血池', generalId: 'zhangliao' }, { name: '炼狱魔殿', generalId: 'dianwei' }, { name: '九幽魔坛', generalId: 'lvbu' }],
    },
  };
  const TIER_NAMES = ['初阶', '灵阶', '玄阶', '地阶', '天阶'];
  let subTab = 'normal'; // normal | ascend
  let chaosPick = false;
  let chaosPage = 0;
  let mainPage = 0;

  function enter(params) {
    chaosPick = false;
    chaosPage = 0;
    mainPage = 0;
    subTab = (params && params.tab === 'ascend') ? 'ascend' : 'normal';
  }

  function calcRealmTier(cfg, lordLv) {
    const unlockLv = cfg.unlockLordLv || 8;
    const stepLv = Math.max(5, cfg.tierStepLv || 15);
    const maxTier = Math.max(1, cfg.maxTier || 5);
    const tier = Math.min(maxTier, 1 + Math.floor(Math.max(0, (lordLv || 1) - unlockLv) / stepLv));
    const rewardMult = 1 + (tier - 1) * (cfg.tierRewardStep || 0.35);
    const scaledEnemyLv = (cfg.enemyLv || 10) + (tier - 1) * 5;
    return { tier, name: TIER_NAMES[Math.min(TIER_NAMES.length - 1, tier - 1)] || (`${tier}阶`), rewardMult, scaledEnemyLv };
  }

  function start(mode, cfg, bossId) {
    const st = App.State.get();
    const rt = calcRealmTier(cfg, st.lordLevel || 1);
    const effCfg = Object.assign({}, cfg, { enemyLv: rt.scaledEnemyLv });
    const boss = bossId ? Object.assign({ id: bossId }, cfg.bosses[bossId]) : null;
    App.Main.startBattle(mode, bossId || '1', {
      level: {
        id: mode,
        name: boss ? `混沌四象坛 · ${boss.name}` : `${cfg.name}（${rt.name}）`,
        order: 20 + effCfg.enemyLv,
        chapter: 12,
        biome: mode === 'xian' ? 'snow' : ((mode === 'pass' || mode === 'mo') ? 'canyon' : 'plains'),
        battleKey: cfg.battleKey || undefined,
        recommendedLv: effCfg.enemyLv,
        difficultyMult: cfg.difficultyMult || 1,
        enemyGenerals: [],
        noDisaster: true,
        special: { type: mode, cfg: effCfg, boss },
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

    ctx.fillStyle = '#c8ad78';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 满高秘境大画框（y=58..532，彻底消除底部留白与冗余战力展示）
    App.UI.drawPanel(ctx, 26, 58, W - 52, 474, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 36, 66, W - 72, 42, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });

    const headerIcon = App.Assets.get(chaosPick ? 'icon_chaos_altar' : 'icon_challenge');
    if (headerIcon) {
      ctx.drawImage(headerIcon, 44, 70, 34, 34);
    }

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText(chaosPick ? '混沌四象坛 · 八荒凶兽' : '九州征战秘境', 86, 87);
    ctx.restore();

    if (!chaosPick) {
      App.UI.drawButton(ctx, 206, 72, 96, 30, '奇战秘境', {
        r: 7,
        grad: subTab === 'normal' ? ['#d97706', '#92400e'] : ['#5c2c16', '#3b1d0e'],
        border: subTab === 'normal' ? '#fef08a' : '#a16207',
        fontSize: 12,
      }, () => { subTab = 'normal'; });
      App.UI.drawButton(ctx, 310, 72, 120, 30, '✦ 神魔渡劫', {
        r: 7,
        grad: subTab === 'ascend' ? ['#7e22ce', '#0f4c5c'] : ['#5c2c16', '#3b1d0e'],
        border: subTab === 'ascend' ? '#67e8f9' : '#a16207',
        fontSize: 12,
      }, () => { subTab = 'ascend'; });
    } else {
      App.UI.drawButton(ctx, W - 168, 72, 84, 30, '◀ 返回秘境', {
        r: 7, bg: '#5c2c16', border: '#fde047', fontSize: 11,
      }, () => { chaosPick = false; });
    }

    App.UI.drawCloseButton(ctx, W - 74, 71, 32, () => App.Main.goScene('map'));

    const counts = (st.challengeCounts && st.challengeCounts.date === todayKey()) ? st.challengeCounts : {};

    // 子界面：混沌四象坛八荒凶兽选择（左右两侧翻页）
    if (chaosPick) {
      const cfg = C.CHALLENGES.chaos, ids = Object.keys(cfg.bosses || {});
      const totalChaosPages = Math.max(1, Math.ceil(ids.length / 4));
      chaosPage = Math.max(0, Math.min(chaosPage, totalChaosPages - 1));

      ids.slice(chaosPage * 4, chaosPage * 4 + 4).forEach((id, i) => {
        const b = cfg.bosses[id], w = 212, h = 404, x = 38 + i * 224, y = 116;
        const counter = C.BEASTS[b.counter] || {}, on = st.activeBeastId === b.counter;

        App.UI.drawPanel(ctx, x, y, w, h, { r: 12, bg: '#2c1609', border: on ? '#4ade80' : '#d4a34b', lineWidth: 2 });
        App.Portraits.drawBeastPortrait(ctx, b.sprite || id, x + (w - 128) / 2, y + 18, 128, { radius: 12, border: '#fbbf24', lineWidth: 2.2 });

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 18px "PingFang SC", serif';
        ctx.fillText('太古凶兽 · ' + b.name, x + w / 2, y + 174);

        ctx.fillStyle = 'rgba(15, 7, 3, 0.72)';
        App.UI.roundRect(ctx, x + 12, y + 190, w - 24, 54, 8);
        ctx.fill();
        ctx.fillStyle = on ? '#86efac' : '#fca5a5';
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.fillText(`破盾圣兽：${counter.name || b.counter}`, x + w / 2, y + 212);
        ctx.font = '11px "PingFang SC", sans-serif';
        ctx.fillText(on ? '✦ 已随军上阵 · 破除护盾' : '⚠ 未上阵 · 凶兽护盾减伤九成', x + w / 2, y + 233);

        ctx.fillStyle = '#fed7aa';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText(`必掉【${(C.EQUIP_SETS[b.setId] || {}).name || '神兽圣装'}】`, x + w / 2, y + 276);
        ctx.restore();

        App.UI.drawButton(ctx, x + 18, y + h - 66, w - 36, 48, '讨伐太古凶兽', {
          r: 10, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 13.5,
          subText: `耗 ${App.State.getStaminaCost(cfg.staminaCost)} 粮草`,
        }, () => start('chaos', cfg, id));
      });

      App.UI.drawSidePageButtons(ctx, chaosPage, totalChaosPages, (p) => { chaosPage = p; }, {
        cy: 318, grad: ['#78350f', '#3b1806'], border: '#f59e0b',
      });
      return;
    }

    // 子界面：仙魔渡劫双副本（升仙副本 & 升魔副本，满高铺展至 y=520）
    if (subTab === 'ascend') {
      const ac = C.ASCENSION || {};
      const xianPill = ac.xianPillItem || 'ascend_xian_pill';
      const xianSub = ac.xianSubItem || 'ascend_xian_jade';
      const moPill = ac.moPillItem || 'ascend_mo_pill';
      const moSub = ac.moSubItem || 'ascend_mo_crystal';

      ['xian', 'mo'].forEach((mode, idx) => {
        const isXian = mode === 'xian';
        const cfg = Object.assign({}, DEFAULT_ASCEND_CHALLENGES[mode], (C.CHALLENGES && C.CHALLENGES[mode]) || {});
        const w = 436, h = 404, x = 38 + idx * 448, y = 116;
        const locked = (st.lordLevel || 1) < (cfg.unlockLordLv || 20);
        const left = Math.max(0, (cfg.dailyLimit || 3) - (counts[mode] || 0));
        const rt = calcRealmTier(cfg, st.lordLevel || 1);
        const baseRec = App.Config.scaleRecommendedPower(mode, cfg.recommendedPower || 96000, cfg);
        const recPower = Math.round(baseRec * (1 + (rt.tier - 1) * 0.25));
        const canBeat = myPower >= recPower;
        const cleared = !!(st.clearedLevels && st.clearedLevels[mode]);

        const pillId = isXian ? xianPill : moPill;
        const subId = isXian ? xianSub : moSub;
        const pillName = (C.ITEMS[pillId] && C.ITEMS[pillId].name) || (isXian ? '九转封神丹' : '九幽化魔丹');
        const subName = (C.ITEMS[subId] && C.ITEMS[subId].name) || (isXian ? '太初神灵髓' : '炼狱魔煞晶');
        const pillCnt = App.State.getItemCount(pillId);
        const subCnt = App.State.getItemCount(subId);

        App.UI.drawPanel(ctx, x, y, w, h, {
          r: 12,
          bg: isXian ? '#0f2936' : '#260d24',
          border: isXian ? '#67e8f9' : '#f472b6',
          lineWidth: 2.2,
        });
        App.UI.drawPanel(ctx, x + 4, y + 4, w - 8, h - 8, {
          r: 9,
          bg: isXian ? 'rgba(8, 51, 68, 0.55)' : 'rgba(59, 7, 100, 0.45)',
          border: isXian ? 'rgba(254, 240, 138, 0.35)' : 'rgba(251, 113, 133, 0.35)',
          lineWidth: 1,
        });

        const art = App.Assets.get(ART_KEY[mode]) || App.Assets.get(isXian ? 'tower_pagoda' : 'dungeon_chaos');
        const ix = x + 12, iy = y + 12, iw = w - 24, ih = 136;
        ctx.save();
        App.UI.roundRect(ctx, ix, iy, iw, ih, 9);
        ctx.clip();
        if (art) ctx.drawImage(art, ix, iy, iw, ih);
        else { ctx.fillStyle = isXian ? '#164e63' : '#4a044e'; ctx.fillRect(ix, iy, iw, ih); }
        const ig = ctx.createLinearGradient(ix, iy + 36, ix, iy + ih);
        ig.addColorStop(0, 'rgba(0,0,0,0)');
        ig.addColorStop(1, isXian ? 'rgba(6, 24, 34, 0.90)' : 'rgba(28, 6, 30, 0.90)');
        ctx.fillStyle = ig;
        ctx.fillRect(ix, iy, iw, ih);
        ctx.restore();

        ctx.save();
        App.UI.roundRect(ctx, ix, iy, iw, ih, 9);
        ctx.strokeStyle = isXian ? '#67e8f9' : '#f472b6';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = 'rgba(10, 15, 28, 0.85)';
        App.UI.roundRect(ctx, ix + 8, iy + 8, 118, 22, 6);
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
        ctx.fillText(`${rt.name} · 赏×${rt.rewardMult.toFixed(2)}`, ix + 67, iy + 23);

        ctx.fillStyle = cleared ? 'rgba(21, 128, 61, 0.90)' : 'rgba(120, 53, 15, 0.88)';
        App.UI.roundRect(ctx, ix + iw - 96, iy + 8, 88, 22, 6);
        ctx.fill();
        ctx.fillStyle = cleared ? '#bbf7d0' : '#fde68a';
        ctx.fillText(cleared ? '★ 已证道通关' : '待首通证道', ix + iw - 52, iy + 23);

        ctx.fillStyle = isXian ? '#a5f3fc' : '#fbcfe8';
        ctx.font = 'bold 19px "PingFang SC", serif';
        ctx.fillText(cfg.name, x + w / 2, iy + ih - 14);

        ctx.fillStyle = '#f1f5f9';
        ctx.font = '12px "PingFang SC", sans-serif';
        App.UI.drawWrappedText(ctx, cfg.desc || '', x + w / 2, y + 174, w - 36, 17, 'center');

        ctx.fillStyle = isXian ? '#67e8f9' : '#f472b6';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText(
          isXian
            ? '✦ 成神飞升（等级.神）：三维暴涨 + 高额免伤 + 绝技增伤 + 开局神力'
            : '✦ 成魔觉醒（等级.魔）：三维暴涨 + 毁灭暴伤 + 嗜血吸取 + 狂暴攻速',
          x + w / 2, y + 228
        );

        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
        App.UI.roundRect(ctx, x + 16, y + 246, w - 32, 34, 8);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.fillText(`库存：【${pillName}】×${pillCnt}   ·   【${subName}】×${subCnt}`, x + w / 2, y + 268);

        ctx.fillStyle = canBeat ? '#86efac' : '#fca5a5';
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.fillText(`推荐战力 ${recPower}   |   今日余 ${left}/${cfg.dailyLimit || 3} 次`, x + w / 2, y + 306);
        ctx.restore();

        App.UI.drawButton(ctx, x + 16, y + h - 68, 262, 50, locked ? `主公 Lv.${cfg.unlockLordLv} 开启` : (left > 0 ? (isXian ? '⚡ 登台渡神劫' : '🔥 入渊渡魔劫') : '今日渡劫次数已尽'), {
          r: 10,
          grad: isXian ? ['#0284c7', '#0f4c5c'] : ['#be185d', '#581c87'],
          border: '#fef08a',
          fontSize: 14,
          subText: locked || left <= 0 ? undefined : `耗 ${App.State.getStaminaCost(cfg.staminaCost || 12)} 粮草 · 掉丹髓+${isXian ? '神·套装' : '魔·套装'}`,
          disabled: locked || left <= 0,
        }, () => start(mode, cfg));

        App.UI.drawButton(ctx, x + 288, y + h - 68, 132, 50, '去名将营飞升', {
          r: 10,
          grad: ['#d97706', '#92400e'],
          border: '#fde68a',
          fontSize: 12.5,
          subText: 'Lv.150满级可用',
        }, () => App.Main.goScene('roster', { openAscend: true }));
      });
      return;
    }

    // 主界面：6 大秘境（2行×3列饱满大卡铺满 y=116..520，超过6个用左右侧翻页）
    const modes = Object.keys(C.CHALLENGES).filter((m) => m !== 'xian' && m !== 'mo').sort((a, b) => (C.CHALLENGES[a].order || 0) - (C.CHALLENGES[b].order || 0));
    const pageSize = 6;
    const totalPages = Math.max(1, Math.ceil(modes.length / pageSize));
    mainPage = Math.max(0, Math.min(mainPage, totalPages - 1));

    const cw = 288, ch = 196, gapX = 10, gapY = 12;
    modes.slice(mainPage * pageSize, mainPage * pageSize + pageSize).forEach((mode, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const cfg = C.CHALLENGES[mode];
      const x = 38 + col * (cw + gapX), y = 116 + row * (ch + gapY);
      const locked = (st.lordLevel || 1) < (cfg.unlockLordLv || 1);
      const left = Math.max(0, (cfg.dailyLimit || 2) - (counts[mode] || 0));
      const rt = calcRealmTier(cfg, st.lordLevel || 1);
      const baseRec = App.Config.scaleRecommendedPower(mode, cfg.recommendedPower || 0, cfg);
      const recPower = Math.round(baseRec * (1 + (rt.tier - 1) * 0.25));
      const canBeat = myPower >= recPower;
      const [title, sub] = String(cfg.name || mode).split(' · ');

      App.UI.drawPanel(ctx, x, y, cw, ch, { r: 12, bg: '#32190b', border: '#c28538', lineWidth: 1.8 });
      App.UI.drawPanel(ctx, x + 3, y + 3, cw - 6, ch - 6, { r: 9, bg: '#261207', border: 'rgba(254, 240, 138, 0.20)', lineWidth: 1 });

      // 左侧手绘秘境景窗 (112 × 174)
      const art = App.Assets.get(cfg.imgKey || ART_KEY[mode] || 'dungeon_tomb');
      const ix = x + 9, iy = y + 11, iw = 112, ih = ch - 22;
      ctx.save();
      App.UI.roundRect(ctx, ix, iy, iw, ih, 8);
      ctx.clip();
      if (art) {
        ctx.drawImage(art, ix, iy, iw, ih);
      } else {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(ix, iy, iw, ih);
      }
      const ig = ctx.createLinearGradient(ix, iy + ih * 0.45, ix, iy + ih);
      ig.addColorStop(0, 'rgba(0,0,0,0)');
      ig.addColorStop(1, 'rgba(18, 8, 3, 0.90)');
      ctx.fillStyle = ig;
      ctx.fillRect(ix, iy, iw, ih);
      ctx.restore();

      ctx.save();
      App.UI.roundRect(ctx, ix, iy, iw, ih, 8);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.fillStyle = 'rgba(120, 53, 15, 0.92)';
      App.UI.roundRect(ctx, ix + 4, iy + 4, iw - 8, 20, 5);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.fillText(locked ? `Lv.${cfg.unlockLordLv}开启` : `${rt.name} · 赏×${rt.rewardMult.toFixed(2)}`, ix + iw / 2, iy + 17.5);

      if (sub) {
        ctx.fillStyle = '#fde68a';
        ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
        ctx.fillText(sub.slice(0, 7), ix + iw / 2, iy + ih - 9);
      }

      // 右侧信息区
      const rx = x + 130, rw = cw - 140;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 15.5px "PingFang SC", serif';
      ctx.fillText(title, rx, y + 30);

      ctx.fillStyle = '#e7d5b8';
      ctx.font = '11px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, cfg.desc || '', rx, y + 52, rw, 15.5, 'left');

      ctx.fillStyle = 'rgba(15, 7, 3, 0.68)';
      App.UI.roundRect(ctx, rx, y + 106, rw, 30, 6);
      ctx.fill();
      ctx.fillStyle = canBeat ? '#86efac' : '#fca5a5';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(`战力 ${recPower}`, rx + 7, y + 125);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(`余 ${left}/${cfg.dailyLimit || 2} 次`, rx + rw - 7, y + 125);
      ctx.restore();

      const fourSymbols = C.FOUR_SYMBOL_BEAST_IDS || ['qinglong', 'zhuque', 'xuanwu', 'baihu'];
      App.UI.drawButton(ctx, rx, y + ch - 50, rw, 38, locked ? `主公 Lv.${cfg.unlockLordLv} 解锁` : (left > 0 ? `击鼓出征 · ${App.State.getStaminaCost(cfg.staminaCost)}粮` : '今日已战毕'), {
        r: 9,
        grad: mode === 'chaos' ? ['#9a3412', '#581c87'] : (mode === 'treasury' ? ['#ca8a04', '#854d0e'] : ['#d97706', '#92400e']),
        border: '#fef08a',
        fontSize: 12,
        disabled: locked || left <= 0,
      }, () => {
        if (mode !== 'chaos') return start(mode, cfg);
        if (fourSymbols.some((b) => !st.ownedBeasts[b])) {
          return App.UI.showToast('需先收服全部四象圣兽（青龙·朱雀·玄武·白虎），方可开启混沌四象坛！', '#fca5a5');
        }
        chaosPick = true;
      });
    });

    App.UI.drawSidePageButtons(ctx, mainPage, totalPages, (p) => { mainPage = p; }, {
      cy: 318, grad: ['#78350f', '#3b1806'], border: '#f59e0b',
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.challenge = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
