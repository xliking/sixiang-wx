(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 三军演武营：上排修筑 4 座城防粮木后勤（中军主营 / 守御箭垒 / 伐木营 / 军粮仓），下排操练 5 大主力兵种
  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const st = App.State.get(), C = App.Config, cfg = C.TROOP_CAMP || {};
    const stepPct = cfg.statPerLevel || 0.08;
    const maxLv = cfg.maxLevel || 20;

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 58, W - 28, 474, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 66, W - 52, 42, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });

    const campIcon = App.Assets.get('icon_camp');
    if (campIcon) ctx.drawImage(campIcon, 34, 70, 34, 34);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText(
      `三军演武营 · 城防后勤修筑 & 五军兵种操练（每级属性 +${Math.round(stepPct * 100)}%）`,
      76, 87, W - 160
    );
    ctx.restore();
    App.UI.drawCloseButton(ctx, W - 66, 71, 32, () => App.Main.goScene('map'));

    const innerX = 26;
    const innerW = W - 52; // 908px

    // ================= 上排：4 座城防与后勤建筑（横版宽卡 221×186，图文并茂零拥挤） =================
    const lumberBase = cfg.lumberBase || 10;
    const lumberStep = cfg.lumberPerLv || 1;
    const initWoodBase = cfg.initWoodBase || 120;
    const initWoodStep = cfg.initWoodPerLv || 10;
    const granaryBase = cfg.granaryBase || 10;
    const granaryStep = cfg.granaryPerLv || 1;
    const initFoodBase = cfg.initFoodBase || 120;
    const initFoodStep = cfg.initFoodPerLv || 10;

    const fortEntries = [
      {
        id: 'base',
        tag: '大本营',
        tagBg: '#92400e',
        name: '中军主营',
        spriteKey: 'prop_command_tent',
        lines: (lv, maxed) => {
          const m0 = 1 + lv * stepPct, m1 = 1 + (lv + 1) * stepPct;
          const hp0 = Math.round((cfg.baseHp || 3800) * m0), hp1 = Math.round((cfg.baseHp || 3800) * m1);
          const df0 = Math.round((cfg.baseDef || 45) * m0), df1 = Math.round((cfg.baseDef || 45) * m1);
          return [
            maxed ? `气血 ${hp0}` : `气血 ${hp0} → ${hp1}`,
            maxed ? `护甲 ${df0}` : `护甲 ${df0} → ${df1}`,
            '镇守后方 · 随主公等级成长',
          ];
        },
      },
      {
        id: 'tower',
        tag: '上下双塔',
        tagBg: '#9a3412',
        name: '守御箭垒',
        spriteKey: 'tower_sprite',
        lines: (lv, maxed) => {
          const m0 = 1 + lv * stepPct, m1 = 1 + (lv + 1) * stepPct;
          const hp0 = Math.round((cfg.towerHp || 1850) * m0), hp1 = Math.round((cfg.towerHp || 1850) * m1);
          const ak0 = Math.round((cfg.towerAtk || 56) * m0), ak1 = Math.round((cfg.towerAtk || 56) * m1);
          const df0 = Math.round((cfg.towerDef || 32) * m0), df1 = Math.round((cfg.towerDef || 32) * m1);
          return [
            maxed ? `气血 ${hp0}` : `气血 ${hp0} → ${hp1}`,
            maxed ? `箭伤 ${ak0}` : `箭伤 ${ak0} → ${ak1}`,
            maxed ? `护甲 ${df0}` : `护甲 ${df0} → ${df1}`,
          ];
        },
      },
      {
        id: 'lumber',
        tag: '木材后勤',
        tagBg: '#854d0e',
        name: '伐木营',
        spriteKey: 'building_lumber',
        lines: (lv, maxed) => {
          const r0 = lumberBase + lv * lumberStep, r1 = lumberBase + (lv + 1) * lumberStep;
          const w0 = initWoodBase + lv * initWoodStep, w1 = initWoodBase + (lv + 1) * initWoodStep;
          return [
            maxed ? `产出 +${r0} 木材/2s` : `产出 +${r0} → +${r1} /2s`,
            maxed ? `开局木材 ${w0}` : `开局木 ${w0} → ${w1}`,
            '源源不断供应出兵木材',
          ];
        },
      },
      {
        id: 'granary',
        tag: '粮草后勤',
        tagBg: '#166534',
        name: '军粮仓',
        spriteKey: 'building_granary',
        lines: (lv, maxed) => {
          const r0 = granaryBase + lv * granaryStep, r1 = granaryBase + (lv + 1) * granaryStep;
          const f0 = initFoodBase + lv * initFoodStep, f1 = initFoodBase + (lv + 1) * initFoodStep;
          return [
            maxed ? `产出 +${r0} 粮草/2s` : `产出 +${r0} → +${r1} /2s`,
            maxed ? `开局粮草 ${f0}` : `开局粮 ${f0} → ${f1}`,
            '源源不断供应出兵粮草',
          ];
        },
      },
    ];

    const fGap = 8;
    const fcw = Math.floor((innerW - (fortEntries.length - 1) * fGap) / fortEntries.length); // 221
    const fy = 114, fch = 184;

    fortEntries.forEach((entry, i) => {
      const x = innerX + i * (fcw + fGap);
      const lv = (st.troopLevels || {})[entry.id] || 0;
      const maxed = lv >= maxLv;
      const cost = (cfg.goldBase || 500) + lv * (cfg.goldStep || 300);

      App.UI.drawPanel(ctx, x, fy, fcw, fch, {
        r: 11, bg: '#fef3c7', border: '#b45309', lineWidth: 2,
      });

      // 左侧建筑原画框
      const artX = x + 8, artY = fy + 10, artW = 80, artH = 112;
      App.UI.roundRect(ctx, artX, artY, artW, artH, 8);
      ctx.fillStyle = 'rgba(120, 53, 15, 0.11)';
      ctx.fill();

      const spr = App.Assets.get(entry.spriteKey);
      if (spr) {
        const sw = spr.naturalWidth || spr.width || 80;
        const sh = spr.naturalHeight || spr.height || 80;
        const sc = Math.min((artW - 10) / sw, (artH - 26) / sh);
        const dw = sw * sc, dh = sh * sc;
        ctx.drawImage(spr, artX + (artW - dw) / 2, artY + 20 + (artH - 24 - dh) / 2, dw, dh);
      }

      // 顶部类别小角标
      ctx.save();
      App.UI.roundRect(ctx, artX + 4, artY + 4, 54, 16, 5);
      ctx.fillStyle = entry.tagBg;
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry.tag, artX + 31, artY + 12.5);
      ctx.restore();

      // 右侧建筑属性详情
      const tx = artX + artW + 8;
      const maxTW = fcw - (artW + 22);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 14.5px "PingFang SC", serif';
      ctx.fillText(entry.name, tx, fy + 27, maxTW);

      ctx.fillStyle = '#9a3412';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(`Lv.${lv} / ${maxLv}`, tx, fy + 46, maxTW);

      const statLines = entry.lines(lv, maxed);
      statLines.forEach((ln, k) => {
        ctx.fillStyle = k === 2 && (entry.id === 'base' || entry.id === 'lumber' || entry.id === 'granary') ? '#78350f' : '#57301a';
        ctx.font = k === 2 && (entry.id === 'base' || entry.id === 'lumber' || entry.id === 'granary')
          ? '10px "PingFang SC", sans-serif'
          : 'bold 10.8px "PingFang SC", sans-serif';
        ctx.fillText(ln, tx, fy + 69 + k * 21, maxTW);
      });
      ctx.restore();

      // 底部修筑按钮
      App.UI.drawButton(ctx, x + 8, fy + fch - 50, fcw - 16, 42, maxed ? '已满级' : '修筑升级', {
        r: 9,
        grad: ['#b45309', '#78350f'],
        border: '#fef08a',
        fontSize: 13,
        subText: maxed ? undefined : `${cost} 铜钱`,
        disabled: maxed || App.State.isBusy(),
      }, () => App.State.upgradeTroop(entry.id));
    });

    // ================= 下排：5 大主力兵种操练卡（175×212 宽敞卡片） =================
    const troopCards = C.TROOP_CARDS || [];
    const tGap = 8;
    const tcw = Math.floor((innerW - Math.max(0, troopCards.length - 1) * tGap) / Math.max(1, troopCards.length)); // 175
    const ty = 306, tch = 212;

    const deployedTroopSet = new Set(
      (st.deployIds || []).slice(0, 5).map((gid) => (C.getGeneralTroopId ? C.getGeneralTroopId(gid) : 'spear'))
    );

    troopCards.forEach((card, i) => {
      const x = innerX + i * (tcw + tGap);
      const lv = (st.troopLevels || {})[card.id] || 0;
      const mult = 1 + lv * stepPct;
      const nextMult = 1 + (lv + 1) * stepPct;
      const maxed = lv >= maxLv;
      const cost = (cfg.goldBase || 500) + lv * (cfg.goldStep || 300);
      const inLineup = deployedTroopSet.has(card.id);

      App.UI.drawPanel(ctx, x, ty, tcw, tch, {
        r: 11, bg: '#fff7e0', border: inLineup ? '#15803d' : '#a16207', lineWidth: inLineup ? 2.0 : 1.6,
      });

      // 上部左图右名紧凑头栏
      const sBoxX = x + 8, sBoxY = ty + 8, sBoxW = 62, sBoxH = 68;
      App.UI.roundRect(ctx, sBoxX, sBoxY, sBoxW, sBoxH, 8);
      ctx.fillStyle = 'rgba(161, 98, 7, 0.09)';
      ctx.fill();

      const sprKey = (App.Sprites && App.Sprites.resolveTroopSpriteKey)
        ? App.Sprites.resolveTroopSpriteKey(card.id, card.spriteKey, 'player')
        : card.spriteKey;
      const spr = App.Assets.get(sprKey) || App.Assets.get(card.spriteKey);
      if (spr) {
        const sw = spr.naturalWidth || spr.width || 64;
        const sh = spr.naturalHeight || spr.height || 64;
        const sc = Math.min((sBoxW - 8) / sw, (sBoxH - 8) / sh);
        const dw = sw * sc, dh = sh * sc;
        ctx.drawImage(spr, sBoxX + (sBoxW - dw) / 2, sBoxY + (sBoxH - dh) / 2, dw, dh);
      }

      if (inLineup) {
        ctx.save();
        App.UI.roundRect(ctx, sBoxX + 3, sBoxY + 3, 38, 14, 4);
        ctx.fillStyle = '#15803d';
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('出战中', sBoxX + 22, sBoxY + 10.5);
        ctx.restore();
      }

      ctx.save();
      const infoX = sBoxX + sBoxW + 7;
      const infoW = tcw - (sBoxW + 22);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 14px "PingFang SC", serif';
      ctx.fillText(card.name, infoX, ty + 28, infoW);

      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(`Lv.${lv} / ${maxLv}`, infoX, ty + 48, infoW);

      ctx.fillStyle = '#78350f';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(`耗 木${card.wood} 粮${card.food}`, infoX, ty + 67, infoW);

      // 中部三项属性成长
      ctx.textAlign = 'center';
      ctx.fillStyle = '#57301a';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      [
        ['气血', card.hp],
        ['攻击', card.atk],
        ['防御', card.def],
      ].forEach(([n, v], k) => {
        const curVal = Math.round(v * mult);
        const nxtVal = Math.round(v * nextMult);
        const line = maxed ? `${n} ${curVal}` : `${n} ${curVal} → ${nxtVal}`;
        ctx.fillText(line, x + tcw / 2, ty + 98 + k * 21, tcw - 14);
      });
      ctx.restore();

      App.UI.drawButton(ctx, x + 8, ty + tch - 50, tcw - 16, 42, maxed ? '已满级' : '操练升级', {
        r: 9,
        grad: ['#d97706', '#92400e'],
        border: '#fef08a',
        fontSize: 13,
        subText: maxed ? undefined : `${cost} 铜钱`,
        disabled: maxed || App.State.isBusy(),
      }, () => App.State.upgradeTroop(card.id));
    });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.camp = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
