(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 铜雀天梯：国风鎏金宝塔攀登界面（配备手绘铜雀高台云海原画 + 图标化供奉与奖励展示）
  function floorInfo(floor) {
    const t = App.Config.TOWER;
    const lv = (t.baseEnemyLv || 3) + Math.floor(floor * 0.9);
    const hasGen = floor % (t.generalEvery || 5) === 0;
    const lineups = t.lineups || [];
    const lineup = hasGen && lineups.length ? lineups[(Math.floor(floor / (t.generalEvery || 5)) - 1) % lineups.length] : null;
    const gens = lineup ? lineup.generals.filter((g) => App.Config.GENERALS[g]) : [];
    const disasters = App.Config.DISASTERS;
    const disaster = floor % (t.disasterEvery || 10) === 0 && disasters.length ? disasters[(floor / (t.disasterEvery || 10) - 1) % disasters.length] : null;
    return {
      floor, lv, lineup, disaster, goldEquip: floor % (t.goldEquipEvery || 10) === 0,
      power: Math.round(1500 + floor * 520 + Math.pow(floor, 1.4) * 40 + gens.length * lv * 180),
      level: {
        id: 'tower_' + floor,
        name: `铜雀天梯 · 第 ${floor} 层${lineup ? ' · ' + lineup.name : ''}`,
        order: Math.min(60, 5 + floor),
        chapter: 4 + Math.floor(floor / 5),
        biome: 'canyon',
        recommendedLv: lv,
        towers: floor % 3 === 0 ? 2 : 1,
        forceDisasterId: disaster ? disaster.id : null,
        noDisaster: !disaster,
        enemyGenerals: gens.map((g, i) => ({ id: g, lv, isBoss: i === 0 })),
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

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 宣纸古铜大画框 + 顶部檀木雕花匾额
    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 72, W - 52, 44, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });

    const cleared = st.towerFloor || 0, next = cleared + 1, top = cleared >= (t.maxFloor || 100);
    const towerIcon = App.Assets.get('icon_tower');
    if (towerIcon) {
      ctx.drawImage(towerIcon, 34, 75, 38, 38);
    }

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16.5px "PingFang SC", serif';
    ctx.fillText(`铜雀天梯 · 已登临 ${cleared} / ${t.maxFloor || 100} 层`, 78, 94);
    ctx.restore();

    const myPower = App.State.getTeamPower();
    App.UI.drawResCapsule(ctx, 'res_power', 352, 82, 162, 24, `我方战力 ${myPower}`, {
      color: '#fde047', border: 'rgba(250, 204, 21, 0.55)', glow: 'rgba(245, 158, 11, 0.35)', fontSize: 11,
    });

    const idleDone = st.towerIdleDate === todayKey();
    App.UI.drawButton(
      ctx,
      W - 314,
      78,
      192,
      32,
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

    App.UI.drawButton(ctx, W - 110, 78, 72, 32, '返回', {
      r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12,
    }, () => App.Main.goScene('map'));

    // ================= 左侧：6 层递进古铜飞檐塔阶列表 =================
    for (let i = 0; i < 6; i++) {
      const f = floorInfo(next + 5 - i), y = 124 + i * 56, cur = f.floor === next;
      if (f.floor > (t.maxFloor || 100)) continue;
      const isBossFloor = !!f.lineup;

      App.UI.drawPanel(ctx, 26, y, 376, 50, {
        r: 9,
        bg: cur ? '#7c2d12' : (isBossFloor ? '#451a03' : '#fff7e0'),
        border: cur ? '#facc15' : (isBossFloor ? '#d97706' : '#a16207'),
        lineWidth: cur ? 2.4 : 1.4,
      });

      // 左侧层数牌
      ctx.save();
      ctx.fillStyle = cur ? '#f59e0b' : (isBossFloor ? '#b45309' : '#78350f');
      App.UI.roundRect(ctx, 34, y + 8, 66, 34, 6);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fffbeb';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(`第${f.floor}层`, 67, y + 25);

      ctx.textAlign = 'left';
      ctx.fillStyle = cur || isBossFloor ? '#fef08a' : '#451a03';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(f.lineup ? `★ 名将镇守【${f.lineup.name}】` : '铜雀精锐护卫军', 110, y + 18);

      ctx.fillStyle = cur || isBossFloor ? '#fed7aa' : '#92400e';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(
        `${f.disaster ? '天象·' + f.disaster.name : '晴空校场'}${f.goldEquip ? ' · ★首通必掉神装' : ''}`,
        110, y + 36
      );

      ctx.textAlign = 'right';
      ctx.fillStyle = cur ? '#86efac' : (isBossFloor ? '#fde68a' : '#b45309');
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(`战力 ${f.power}`, 392, y + 25);
      ctx.restore();
    }

    // ================= 右侧：当前挑战层手绘铜雀台画卷 + 守将与奖励详情 =================
    const rx = 416, ry = 124, rw = W - 442, rh = 338;
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
      ctx.fillText('★ 主公已威震九州 · 登顶铜雀百层天梯！ ★', rx + rw / 2, ry + rh / 2);
      ctx.restore();
    } else {
      const f = floorInfo(next), locked = (st.lordLevel || 1) < (t.unlockLordLv || 1);
      const pagoda = App.Assets.get('tower_pagoda');

      // 上半幅手绘《铜雀凌云台》横幅原画景窗（彻底消除空洞留白！）
      const imgX = rx + 12, imgY = ry + 12, imgW = rw - 24, imgH = 148;
      ctx.save();
      App.UI.roundRect(ctx, imgX, imgY, imgW, imgH, 9);
      ctx.clip();
      if (pagoda) {
        ctx.drawImage(pagoda, imgX, imgY - 22, imgW, imgH + 44);
      } else {
        ctx.fillStyle = '#451a03';
        ctx.fillRect(imgX, imgY, imgW, imgH);
      }
      const grad = ctx.createLinearGradient(imgX, imgY, imgX, imgY + imgH);
      grad.addColorStop(0, 'rgba(20, 10, 4, 0.18)');
      grad.addColorStop(0.55, 'rgba(20, 10, 4, 0.35)');
      grad.addColorStop(1, 'rgba(20, 10, 4, 0.88)');
      ctx.fillStyle = grad;
      ctx.fillRect(imgX, imgY, imgW, imgH);
      ctx.restore();

      ctx.save();
      App.UI.roundRect(ctx, imgX, imgY, imgW, imgH, 9);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 画卷内标题与镇守名将头像排阵
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 18px "PingFang SC", serif';
      ctx.strokeStyle = '#090402';
      ctx.lineWidth = 4;
      ctx.strokeText(f.level.name, imgX + 14, imgY + 28);
      ctx.fillText(f.level.name, imgX + 14, imgY + 28);

      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillStyle = myPower >= f.power ? '#86efac' : '#fca5a5';
      ctx.strokeText(`守军等级 Lv.${f.lv}  ·  推荐战力 ${f.power}（${myPower >= f.power ? '可稳操胜券' : '建议提升装备'}）`, imgX + 14, imgY + 50);
      ctx.fillText(`守军等级 Lv.${f.lv}  ·  推荐战力 ${f.power}（${myPower >= f.power ? '可稳操胜券' : '建议提升装备'}）`, imgX + 14, imgY + 50);
      ctx.restore();

      if (f.lineup && f.lineup.generals && f.lineup.generals.length) {
        f.lineup.generals.slice(0, 5).forEach((gid, idx) => {
          const px = imgX + 14 + idx * 82;
          const py = imgY + 62;
          App.Portraits.drawGeneralPortrait(ctx, gid, px, py, 68, { radius: 8, border: '#fde047', lineWidth: 2 });
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fffbeb';
          ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
          ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
          const gName = (App.Config.GENERALS[gid] || {}).name || '';
          ctx.strokeText(gName, px + 34, py + 80);
          ctx.fillText(gName, px + 34, py + 80);
          ctx.restore();
        });
      } else {
        // 普通层展示精锐守军兵种立绘卡徽
        (App.Config.TROOP_CARDS || []).slice(0, 4).forEach((tc, idx) => {
          const px = imgX + 16 + idx * 96, py = imgY + 66;
          App.UI.drawPanel(ctx, px, py, 84, 68, { r: 8, bg: 'rgba(36, 18, 8, 0.78)', border: '#d97706', lineWidth: 1.3 });
          const spr = App.Assets.get(tc.spriteKey);
          if (spr) ctx.drawImage(spr, px + 18, py + 4, 48, 48);
          ctx.save();
          ctx.textAlign = 'center';
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 10px "PingFang SC", sans-serif';
          ctx.fillText(tc.name, px + 42, py + 62);
          ctx.restore();
        });
      }

      // 中部：本层通关奖励图形胶囊展示栏
      ctx.save();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`本层通关犒赏${f.disaster ? '（注意战场天象：' + f.disaster.name + '）' : ''}：`, rx + 16, ry + 184);
      ctx.restore();

      const rwGold = (t.goldPerFloor || 0) * next;
      const rwSoul = (t.soulPerFloor || 0) * next;
      const rwExp = (t.lordExpPerFloor || 0) * next;
      const rewards = [
        { icon: 'res_gold', label: `铜钱 +${rwGold}`, col: '#fbbf24' },
        { icon: 'res_soul', label: `将魂 +${rwSoul}`, col: '#f0abfc' },
        { icon: 'res_stage', label: `主公经验 +${rwExp}`, col: '#86efac' },
      ];
      if (f.goldEquip) {
        rewards.push({ icon: 'icon_forge', label: '必掉传世神装', col: '#fde047' });
      }
      rewards.forEach((rItem, idx) => {
        const cx = rx + 16 + idx * 122;
        const cy = ry + 196;
        App.UI.drawPanel(ctx, cx, cy, 116, 56, { r: 8, bg: '#43200d', border: '#b45309', lineWidth: 1.3 });
        App.UI.drawMiniIcon(ctx, rItem.icon, cx + 8, cy + 12, 32);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = rItem.col;
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(rItem.label, cx + 44, cy + 32);
        ctx.restore();
      });

      // 底部大气鎏金朱红登塔主按钮
      App.UI.drawButton(ctx, rx + 16, ry + 270, rw - 32, 52, locked ? `主公 Lv.${t.unlockLordLv} 开启铜雀天梯` : `⚔ 登塔破阵 · 挑战第 ${next} 层`, {
        r: 10,
        grad: ['#dc2626', '#991b1b'],
        border: '#fef08a',
        fontSize: 15.5,
        subText: locked ? undefined : `消耗 ${App.State.getStaminaCost(t.staminaCost || 6)} 粮草  ·  每逢 5 层名将镇守、10 层必掉神装`,
        disabled: locked,
      }, () => App.Main.startBattle('tower', next, { level: f.level }));
    }

    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.tower = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
