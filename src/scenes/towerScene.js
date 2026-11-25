(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  function floorInfo(floor) {
    const t = App.Config.TOWER;
    const dCfg = App.Config.DIFFICULTY || {};
    const lvStep = t.enemyLvPerFloor || dCfg.towerLvPerFloor || 1.18;
    const lv = (t.baseEnemyLv || 5) + Math.floor(floor * lvStep);
    const hasGen = floor % (t.generalEvery || 5) === 0;
    const lineups = t.lineups || [];
    const lineup = hasGen && lineups.length ? lineups[(Math.floor(floor / (t.generalEvery || 5)) - 1) % lineups.length] : null;
    let gens = lineup ? lineup.generals.filter((g) => App.Config.GENERALS[g]) : [];
    if (!gens.length && floor >= 2 && App.Config.ALL_GENERAL_IDS && App.Config.ALL_GENERAL_IDS.length) {
      const pool = App.Config.ALL_GENERAL_IDS;
      const pick1 = pool[(floor * 7) % pool.length];
      gens = floor >= 15 && floor % 2 === 0 ? [pick1, pool[(floor * 13 + 3) % pool.length]] : [pick1];
    }
    const disasters = App.Config.DISASTERS;
    const disaster = floor % (t.disasterEvery || 10) === 0 && disasters.length ? disasters[(floor / (t.disasterEvery || 10) - 1) % disasters.length] : null;
    const basePower = Math.round(5200 + floor * 1320 + Math.pow(floor, 1.68) * 155 + (hasGen ? (6500 + lv * 1100) : 0));
    const power = App.Config.scaleRecommendedPower('tower', basePower, { order: Math.min(120, 5 + floor), difficultyMult: 1 });
    return {
      floor, lv, lineup, disaster, goldEquip: floor % (t.goldEquipEvery || 10) === 0,
      power,
      level: {
        id: 'tower_' + floor,
        name: `铜雀天梯 · 第 ${floor} 层${lineup ? ' · ' + lineup.name : ''}`,
        order: Math.min(120, 5 + floor),
        chapter: 4 + Math.floor(floor / 5),
        biome: 'canyon',
        recommendedLv: lv,
        towers: floor % 3 === 0 ? 2 : 1,
        forceDisasterId: disaster ? disaster.id : null,
        noDisaster: !disaster,
        enemyGenerals: gens.map((g, i) => ({ id: g, lv, isBoss: hasGen && i === 0 })),
      },
    };
  }

  function todayKey() {
    const d = new Date(App.API.now());
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const st = App.State.get(), t = App.Config.TOWER;
    const myPower = App.State.getTeamPower();

    ctx.fillStyle = '#c8ad78';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 满高外框大画板（y=58..532，移除底部留白与我方战力胶囊）
    App.UI.drawPanel(ctx, 16, 58, W - 32, 474, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 66, W - 52, 42, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });

    const maxFloor = t.maxFloor || 200;
    const cleared = st.towerFloor || 0, next = cleared + 1, top = cleared >= maxFloor;
    const towerIcon = App.Assets.get('icon_tower');
    if (towerIcon) {
      ctx.drawImage(towerIcon, 34, 70, 34, 34);
    }

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16.5px "PingFang SC", serif';
    ctx.fillText(`铜雀天梯 · 已登临 ${cleared} / ${maxFloor} 层`, 76, 87);
    ctx.restore();

    const idleDone = st.towerIdleDate === todayKey();
    App.UI.drawButton(
      ctx,
      W - 284,
      72,
      204,
      30,
      cleared <= 0 ? '登塔后每日领供奉' : (idleDone ? '今日天梯供奉已领' : `领供奉 +${(t.idleGoldPerFloor || 0) * cleared}钱 +${(t.idleSoulPerFloor || 0) * cleared}魂`),
      {
        r: 8,
        grad: ['#d97706', '#92400e'],
        border: '#fef08a',
        fontSize: 11,
        disabled: cleared <= 0 || idleDone,
      },
      () => App.State.towerIdle()
    );

    App.UI.drawCloseButton(ctx, W - 66, 71, 32, () => App.Main.goScene('map'));

    // ================= 左侧：6 层递进古铜飞檐塔阶列表（铺满 y=116..520） =================
    for (let i = 0; i < 6; i++) {
      const f = floorInfo(next + 5 - i), y = 116 + i * 68, cur = f.floor === next;
      if (f.floor > maxFloor) continue;
      const isBossFloor = !!f.lineup;

      App.UI.drawPanel(ctx, 26, y, 376, 60, {
        r: 10,
        bg: cur ? '#7c2d12' : (isBossFloor ? '#451a03' : '#fff7e0'),
        border: cur ? '#facc15' : (isBossFloor ? '#d97706' : '#a16207'),
        lineWidth: cur ? 2.4 : 1.4,
      });

      ctx.save();
      ctx.fillStyle = cur ? '#f59e0b' : (isBossFloor ? '#b45309' : '#78350f');
      App.UI.roundRect(ctx, 36, y + 11, 68, 38, 7);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fffbeb';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(`第${f.floor}层`, 70, y + 30);

      ctx.textAlign = 'left';
      ctx.fillStyle = cur || isBossFloor ? '#fef08a' : '#451a03';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(f.lineup ? `★ 名将镇守【${f.lineup.name}】` : '铜雀精锐护卫军', 114, y + 21);

      ctx.fillStyle = cur || isBossFloor ? '#fed7aa' : '#92400e';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(
        `${f.disaster ? '天象·' + f.disaster.name : '晴空校场'}${f.goldEquip ? ' · ★必掉神装' : ''}`,
        114, y + 41
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = cur ? '#86efac' : (isBossFloor ? '#fde68a' : '#b45309');
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(`战力 ${f.power}`, 392, y + 30);
      ctx.restore();
    }

    // ================= 右侧：当前挑战层手绘铜雀台画卷 + 守将与奖励详情（rh=404） =================
    const rx = 414, ry = 116, rw = W - 440, rh = 404;
    App.UI.drawPanel(ctx, rx, ry, rw, rh, { r: 12, bg: '#2c1609', border: '#d4a34b', lineWidth: 2 });

    if (top) {
      const pagoda = App.Assets.get('tower_pagoda');
      if (pagoda) {
        ctx.save();
        App.UI.roundRect(ctx, rx + 10, ry + 10, rw - 20, rh - 20, 9);
        ctx.clip();
        ctx.drawImage(pagoda, rx + 10, ry + 10, rw - 20, rh - 20);
        ctx.fillStyle = 'rgba(20, 10, 4, 0.55)';
        ctx.fillRect(rx + 10, ry + 10, rw - 20, rh - 20);
        ctx.restore();
      }
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 22px "PingFang SC", serif';
      ctx.fillText(`★ 主公已威震九州 · 登顶铜雀 ${maxFloor} 层天梯！ ★`, rx + rw / 2, ry + rh / 2);
      ctx.restore();
    } else {
      const f = floorInfo(next), locked = (st.lordLevel || 1) < (t.unlockLordLv || 1);
      const pagoda = App.Assets.get('tower_pagoda');

      const imgX = rx + 14, imgY = ry + 14, imgW = rw - 28, imgH = 186;
      ctx.save();
      App.UI.roundRect(ctx, imgX, imgY, imgW, imgH, 10);
      ctx.clip();
      if (pagoda) {
        ctx.drawImage(pagoda, imgX, imgY - 18, imgW, imgH + 36);
      } else {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(imgX, imgY, imgW, imgH);
      }
      const grad = ctx.createLinearGradient(imgX, imgY, imgX, imgY + imgH);
      grad.addColorStop(0, 'rgba(20, 10, 4, 0.18)');
      grad.addColorStop(0.55, 'rgba(20, 10, 4, 0.38)');
      grad.addColorStop(1, 'rgba(20, 10, 4, 0.90)');
      ctx.fillStyle = grad;
      ctx.fillRect(imgX, imgY, imgW, imgH);
      ctx.restore();

      ctx.save();
      App.UI.roundRect(ctx, imgX, imgY, imgW, imgH, 10);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 19px "PingFang SC", serif';
      ctx.strokeStyle = '#090402';
      ctx.lineWidth = 4;
      ctx.strokeText(f.level.name, imgX + 16, imgY + 32);
      ctx.fillText(f.level.name, imgX + 16, imgY + 32);

      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillStyle = myPower >= f.power ? '#86efac' : '#fca5a5';
      ctx.strokeText(`守军 Lv.${f.lv}  ·  推荐战力 ${f.power}`, imgX + 16, imgY + 56);
      ctx.fillText(`守军 Lv.${f.lv}  ·  推荐战力 ${f.power}`, imgX + 16, imgY + 56);
      ctx.restore();

      if (f.lineup && f.lineup.generals && f.lineup.generals.length) {
        f.lineup.generals.slice(0, 5).forEach((gid, idx) => {
          const px = imgX + 18 + idx * 86;
          const py = imgY + 78;
          App.Portraits.drawGeneralPortrait(ctx, gid, px, py, 74, { radius: 9, border: '#fde047', lineWidth: 2 });
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fffbeb';
          ctx.font = 'bold 11px "PingFang SC", sans-serif';
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
          const gName = (App.Config.GENERALS[gid] || {}).name || '';
          ctx.strokeText(gName, px + 37, py + 88);
          ctx.fillText(gName, px + 37, py + 88);
          ctx.restore();
        });
      } else {
        (App.Config.TROOP_CARDS || []).slice(0, 4).forEach((tc, idx) => {
          const px = imgX + 18 + idx * 102, py = imgY + 84;
          App.UI.drawPanel(ctx, px, py, 90, 78, { r: 8, bg: 'rgba(36, 18, 8, 0.78)', border: '#d97706', lineWidth: 1.3 });
          const spr = App.Assets.get(tc.spriteKey);
          if (spr) ctx.drawImage(spr, px + 19, py + 6, 52, 52);
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
          ctx.fillText(tc.name, px + 45, py + 70);
          ctx.restore();
        });
      }

      ctx.save();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`本层犒赏${f.disaster ? '（战场天象：' + f.disaster.name + '）' : ''}：`, rx + 16, ry + 226);
      ctx.restore();

      const rwGold = (t.goldPerFloor || 0) * next;
      const rwSoul = (t.soulPerFloor || 0) * next;
      const rwExp = (t.lordExpPerFloor || 0) * next;
      const rewards = [
        { icon: 'res_gold', label: `铜钱 +${rwGold}`, col: '#fbbf24' },
        { icon: 'res_soul', label: `将魂 +${rwSoul}`, col: '#f0abfc' },
        { icon: 'res_stage', label: `经验 +${rwExp}`, col: '#86efac' },
      ];
      if (f.goldEquip) {
        rewards.push({ icon: 'icon_forge', label: '必掉神装', col: '#fde047' });
      }
      rewards.forEach((rItem, idx) => {
        const cx = rx + 16 + idx * 122;
        const cy = ry + 240;
        App.UI.drawPanel(ctx, cx, cy, 116, 62, { r: 8, bg: '#43200d', border: '#b45309', lineWidth: 1.3 });
        App.UI.drawMiniIcon(ctx, rItem.icon, cx + 8, cy + 15, 32);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = rItem.col;
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText(rItem.label, cx + 44, cy + 35);
        ctx.restore();
      });

      App.UI.drawButton(ctx, rx + 16, ry + 324, rw - 32, 58, locked ? `主公 Lv.${t.unlockLordLv} 开启铜雀天梯` : `⚔ 登塔破阵 · 挑战第 ${next} 层`, {
        r: 11,
        grad: ['#dc2626', '#991b1b'],
        border: '#fef08a',
        fontSize: 16,
        subText: locked ? undefined : `消耗 ${App.State.getStaminaCost(t.staminaCost || 6)} 粮草  ·  逢 5 层名将镇守、10 层必掉神装`,
        disabled: locked,
      }, () => App.Main.startBattle('tower', next, { level: f.level }));
    }
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.tower = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
