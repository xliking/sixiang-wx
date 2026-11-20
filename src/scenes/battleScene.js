(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let battle = null;

  const BACK = { arena: 'arena', beast: 'beastDungeon', demon: 'demon', tower: 'tower', city: 'map' };
  const backOf = (b) => BACK[b.mode] || 'challenge';

  function enter(params) {
    if (params) battle = App.BattleEngine.createBattle(params);
  }

  function update(dt) {
    if (battle) App.BattleEngine.updateBattle(battle, dt);
  }

  function render(ctx, time) {
    if (!battle) return App.Main.goScene('map');
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    // 1. 绘制横版沙场与军团激战
    ctx.save();
    if (battle.shakeTimer > 0) {
      const m = battle.shakeTimer * 18;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    ctx.save();
    ctx.translate(-battle.cameraX, 0);

    App.Sprites.drawBattlefieldTerrain(ctx, battle, battle.cameraX, W, time);

    battle.dustParticles.forEach((d) => {
      const p = 1 - d.life / (d.maxLife || 0.32);
      ctx.save();
      ctx.globalAlpha = Math.max(0, (1 - p) * 0.58);
      ctx.fillStyle = 'rgba(218, 186, 134, 0.82)';
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.size * (0.85 + p * 0.75), d.size * (0.55 + p * 0.45), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    battle.dyingUnits.forEach((d) => App.Sprites.drawDyingUnit(ctx, d));

    const renderList = [];
    battle.towers.forEach((t) => { if (t.alive) renderList.push({ y: t.y, type: 'tower', obj: t }); });
    battle.units.forEach((u) => { if (u.alive) renderList.push({ y: u.y, type: u.kind, obj: u }); });
    renderList.sort((a, b) => a.y - b.y);

    renderList.forEach((item) => {
      if (item.type === 'tower') App.Sprites.drawWatchTower(ctx, item.obj);
      else if (item.type === 'general') App.Sprites.drawMountedGeneral(ctx, item.obj, time);
      else if (item.type === 'beast') App.Sprites.drawGiantBeastSprite(ctx, item.obj, time);
      else if (item.type === 'prop') App.Sprites.drawProp(ctx, item.obj, time);
      else App.Sprites.drawSoldierSprite(ctx, item.obj, time);
    });

    // ★ 渲染名将/神兽无双大招全屏暗场聚光 + 高清Additive炫光特效！
    if (battle.skillEffects.length > 0) {
      let maxFocus = 0;
      battle.skillEffects.forEach((fx) => {
        const ratio = fx.life / fx.maxLife;
        if (ratio > maxFocus) maxFocus = ratio;
      });
      ctx.save();
      ctx.fillStyle = `rgba(6, 4, 16, ${(0.44 * Math.min(1, maxFocus * 1.4)).toFixed(3)})`;
      ctx.fillRect(battle.cameraX - 40, 0, W + 80, 420);
      ctx.restore();
      battle.skillEffects.forEach((fx) => App.Sprites.drawSkillEffect(ctx, fx, battle.cameraX, W));
    }

    battle.projectiles.forEach((p) => {
      App.Sprites.drawProjectile(ctx, p, time);
    });

    battle.sparks.forEach((s) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.life * 3);
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    battle.floatTexts.forEach((f) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.font = `bold ${f.big ? 16 : 12}px "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });

    // ★ 渲染局内随机自然灾害粒子与天象滤镜层（狂风/暴雨/冰雹/瘟疫/风沙）
    if (App.Sprites.drawDisasterOverlay) {
      App.Sprites.drawDisasterOverlay(ctx, battle, battle.cameraX, W, time);
    }

    ctx.restore();
    ctx.restore();

    // ★ 顶部单一天象状态条（每次最多仅存在一种自然灾害，精炼不与Toast重叠！）
    if (battle.activeDisaster && battle.status === 'fighting' && !battle.aimingUnit) {
      const dis = battle.activeDisaster;
      ctx.save();
      ctx.fillStyle = 'rgba(20, 12, 8, 0.86)';
      App.UI.roundRect(ctx, W / 2 - 210, 48, 420, 22, 11);
      ctx.fill();
      ctx.strokeStyle = dis.color;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = dis.color;
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`天象【${dis.name}】(${Math.max(0, battle.disasterRemain).toFixed(1)}s) · ${dis.desc}`, W / 2, 59.5);
      ctx.restore();
    }

    // 手动瞄准释放大招交互层
    if (battle.aimingUnit && battle.status === 'fighting') {
      ctx.save();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.12)';
      ctx.fillRect(0, 48, W, 330);
      ctx.fillStyle = 'rgba(28, 16, 8, 0.92)';
      App.UI.roundRect(ctx, W / 2 - 220, 54, 440, 36, 18);
      ctx.fill();
      ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 14px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🎯 点击战场任意敌群位置，释放【${battle.aimingUnit.name}·${battle.aimingUnit.cfg.skillName}】！`, W / 2, 77);
      ctx.restore();
    }

    // 2. 顶部一体化檀木资源栏（木材胶囊 + 粮草胶囊 + 鎏金圆章【▶ 军需+120】补给胶囊，与中间关卡牌留足舒适间距！）
    const showSupplyBtn = !battle.adSupplyUsed && battle.status === 'fighting';
    App.UI.drawWoodHeader(ctx, 10, 6, showSupplyBtn ? 338 : 228, 40);
    App.UI.drawResCapsule(ctx, 'res_wood', 17, 14, 100, 23, `木材 ${battle.wood}`, {
      color: '#fde68a', border: 'rgba(251, 191, 36, 0.55)', glow: 'rgba(217, 119, 6, 0.42)', fontSize: 11.5,
    });
    App.UI.drawResCapsule(ctx, 'res_stamina', 123, 14, 102, 23, `粮草 ${battle.food}`, {
      color: '#bbf7d0', border: 'rgba(74, 222, 128, 0.55)', glow: 'rgba(34, 197, 94, 0.40)', fontSize: 11.5,
    });

    if (showSupplyBtn) {
      App.UI.drawAdButton(ctx, 233, 12, 107, 28, '军需+120', {
        r: 14, fontSize: 11.5,
      }, () => {
        battle.paused = true;
        App.Platform.showRewardedAd('stamina', '前线紧急空投：立即获得 +120 木材 与 +120 粮草！', () => {
          battle.paused = false;
          battle.adSupplyUsed = true;
          battle.wood = Math.min(999, battle.wood + 120);
          battle.food = Math.min(999, battle.food + 120);
          App.UI.showToast('前线军需空投抵达！木材+120 粮草+120！', '#4ade80');
        }, () => { battle.paused = false; });
      });
    }

    const titleText = battle.mode === 'arena'
      ? `演武场PK · 对战 ${battle.arenaMatch.playerName}`
      : (battle.mode !== 'city' ? `${battle.level.name}` : `第${battle.level.order}关 · ${battle.level.name}`);
    App.UI.drawWoodHeader(ctx, W / 2 - 112, 6, 236, 38);
    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.fillText(titleText, W / 2 + 6, 30);
    ctx.restore();

    if (App.UI.drawSoundToggle) {
      App.UI.drawSoundToggle(ctx, W - 194, 12, 28);
    }
    App.UI.drawButton(ctx, W - 158, 8, 68, 36, `${battle.speedMult}x 加速`, {
      r: 8, bg: '#78350f', border: '#fde047', fontSize: 12,
    }, () => { battle.speedMult = battle.speedMult === 1 ? 2 : 1; });
    App.UI.drawButton(ctx, W - 82, 8, 70, 36, '撤退', {
      r: 8, bg: '#991b1b', border: '#fca5a5', fontSize: 12,
    }, () => {
      if (battle.status === 'fighting' && battle.serverId) App.State.finishBattle(battle.serverId, false);
      App.Main.goScene(backOf(battle));
    });

    // 特殊副本的目标提示（贴合顶部牌匾下方 y=48 悬空展示，古风黑金横签，绝不遮挡战场中军辎重矿！）
    if (battle.special && battle.status === 'fighting') {
      const sp = battle.special, t = Math.ceil(battle.timeLeft);
      let txt = '';
      if (sp.type === 'tomb') txt = `皇陵劫掠倒计时 ${t} 秒  ·  已夺秘宝 ${App.BattleEngine.specialScore(battle)} / ${sp.lootTotal}`;
      else if (sp.type === 'defend') txt = `死守帅帐 · 剩余 ${t} 秒  ·  第 ${battle.round} / ${battle.totalRounds} 波蛮兵`;
      else if (sp.type === 'pass') txt = `千里走单骑 · 已斩 ${battle.passCleared || 0} / ${battle.totalRounds} 关（过关回血 ${Math.round((sp.cfg.healPct || 0.25) * 100)}%）`;
      else if (sp.type === 'escort') txt = `护送木牛流马 · 粮车耐久 ${Math.round((battle.cartHpPct || 1) * 100)}%`;
      else if (sp.type === 'chaos') txt = App.State.get().activeBeastId === (battle.level.special.boss || {}).counter ? '✦ 克制神兽在阵 · 太古凶兽护盾已破除！' : '⚠ 未上阵克制神兽 · 凶兽护盾减免九成伤害';

      App.UI.drawPanel(ctx, W / 2 - 196, 48, 392, 24, { r: 12, bg: 'rgba(34, 17, 7, 0.90)', border: '#d4a34b', lineWidth: 1.4 });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(txt, W / 2, 60.5);
      ctx.restore();

      if (sp.type === 'pass') {
        App.UI.drawButton(ctx, W / 2 + 204, 46, 98, 28, '服行军灵丹', {
          r: 14, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11,
        }, () => {
          App.State.battlePill(battle.serverId).then((res) => {
            if (!res.ok) return;
            const pct = sp.cfg.pillHealPct || 0.4;
            battle.units.forEach((u) => { if (u.alive && u.side === 'player') u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * pct)); });
          });
        });
      }
    } else if (battle.totalRounds > 1 && battle.status === 'fighting') {
      // 普通多轮城池战轮次提示 + 阵前嘲讽
      const last = battle.round >= battle.totalRounds;
      App.UI.drawPanel(ctx, W / 2 - 112, 48, last ? 236 : 160, 26, { r: 8, bg: 'rgba(42, 20, 10, 0.86)', border: last ? '#f87171' : '#d4a34b', lineWidth: 1.4 });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillStyle = last ? '#fca5a5' : '#fef08a';
      const txt = last ? `最终轮 ${battle.round}/${battle.totalRounds} · 击破守将` : (battle.roundWaiting ? `第 ${battle.round}/${battle.totalRounds} 轮已清 · ${Math.ceil(battle.roundCountdown)} 秒后下一轮` : `第 ${battle.round}/${battle.totalRounds} 轮`);
      ctx.fillText(txt, last ? W / 2 + 6 : W / 2 - 32, 61);
      ctx.restore();
      if (!last) {
        App.UI.drawButton(ctx, W / 2 + 54, 48, 70, 26, '嘲讽 ▶', { r: 8, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 12 }, () => {
          if (App.BattleEngine.nextRound(battle)) App.UI.showToast('主公阵前嘲讽，敌军下一轮提前杀到！', '#fca5a5');
        });
      }
    }

    if (battle.status === 'victory' && battle.lootText) {
      App.UI.drawPanel(ctx, 30, H - 34, W - 60, 28, { r: 8, bg: 'rgba(34, 17, 7, 0.92)', border: '#fde047', lineWidth: 1.2 });
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fef08a'; ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(battle.lootText.slice(0, 70), W / 2, H - 20); ctx.restore();
    }

    // 3. 三军指令 + 我方神兽大招按钮
    const orderY = 380;
    [
      { id: 'hold', label: '武将待命' },
      { id: 'attack', label: '武将进攻' },
      { id: 'retreat', label: '武将撤退' },
    ].forEach((o, i) => {
      const act = battle.order === o.id;
      App.UI.drawButton(ctx, 14 + i * 86, orderY, 80, 30, o.label, {
        r: 7,
        grad: act ? ['#d97706', '#92400e'] : ['#44403c', '#292524'],
        border: act ? '#fef08a' : '#78716c',
        fontSize: 11,
      }, () => {
        battle.order = o.id;
        App.UI.showToast(`三军听令：${o.label}！`, '#fef08a');
      });
    });

    const pb = battle.playerBeastUnit;
    if (pb && pb.alive) {
      const bCfg = pb.beastCfg;
      const bReady = (pb.rage || 0) >= 100 && battle.status === 'fighting';
      App.UI.drawButton(ctx, 282, orderY - 4, 168, 34, bReady ? `🔥 释放【${bCfg.skillName}】!` : `${bCfg.shortName}灵气 ${Math.floor(pb.rage || 0)}%`, {
        r: 8,
        grad: bReady ? [bCfg.color, bCfg.darkColor] : ['#334155', '#1e293b'],
        border: bReady ? '#fef08a' : '#64748b',
        fontSize: 12,
        disabled: !bReady,
      }, () => App.BattleEngine.castBeastUltimate(battle, pb));
    }

    // 4. 底部总控台
    App.UI.drawPanel(ctx, 0, 418, W, 122, { r: 0, bg: '#e8d4a6', border: '#6b3417', lineWidth: 3 });

    const pGens = battle.units.filter((u) => u.side === 'player' && u.kind === 'general');
    for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
      const cx = 10 + slotIdx * 74;
      const cy = 426;
      const u = pGens[slotIdx];

      if (!u) {
        App.UI.drawPanel(ctx, cx, cy, 68, 106, { r: 8, bg: 'rgba(92, 54, 24, 0.25)', border: '#a16207', lineWidth: 1.2 });
        ctx.save();
        ctx.fillStyle = '#78350f';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`空阵位 ${slotIdx + 1}`, cx + 34, cy + 48);
        ctx.fillText('最多5将', cx + 34, cy + 66);
        ctx.restore();
        continue;
      }

      const ready = u.alive && u.rage >= 100 && battle.status === 'fighting';
      const isAiming = battle.aimingUnit === u;
      App.UI.drawPanel(ctx, cx, cy, 68, 106, {
        r: 8,
        bg: isAiming ? '#15803d' : (ready ? '#78350f' : '#3b2112'),
        border: isAiming ? '#86efac' : (ready ? '#fde047' : '#a16207'),
        lineWidth: ready || isAiming ? 2.6 : 1.5,
      });
      ctx.save();
      if (!u.alive) ctx.globalAlpha = 0.35;
      App.Portraits.drawGeneralPortrait(ctx, u.id, cx + 8, cy + 6, 52, { radius: 6, lineWidth: 1.5 });

      const eqCount = u.equips ? Object.keys(u.equips).length : 0;
      if (eqCount > 0) {
        ctx.fillStyle = '#facc15';
        App.UI.roundRect(ctx, cx + 44, cy + 4, 20, 14, 4);
        ctx.fill();
        ctx.fillStyle = '#1c1917';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${eqCount}装`, cx + 54, cy + 14);
      }

      App.UI.drawBar(ctx, cx + 6, cy + 62, 56, 12, u.hp / u.maxHp, '#22c55e', '#1c1917');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(u.hp)}`, cx + 34, cy + 71);

      App.UI.drawBar(ctx, cx + 6, cy + 77, 56, 5, u.rage / 100, '#facc15', '#1c1917');
      ctx.fillStyle = ready ? '#fef08a' : '#e2e8f0';
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      const isFullUlt = !!(u.cfg && u.cfg.isFullscreenSkill);
      const btnTxt = isAiming
        ? '选目标中'
        : (ready ? (isFullUlt ? '全屏大招!' : (u.needsManualAim ? '选点大招!' : '释放绝技!')) : u.name);
      ctx.fillText(btnTxt, cx + 34, cy + 97);
      ctx.restore();

      if (ready) {
        App.UI.addHit(cx, cy, 68, 106, () => App.BattleEngine.triggerPlayerGeneralSkill(battle, u));
      }
    }

    // ★ 兵营出兵面板：5 大兵种全部展示高清手绘兵种小图片 + 木粮小图标消耗条！
    App.UI.drawPanel(ctx, 386, 426, 358, 106, { r: 8, bg: '#d9be86', border: '#854d0e', lineWidth: 1.5 });
    ctx.save();
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('兵营出兵（点击兵种卡派兵支援 · 步枪弓骑方协同推进）', 394, 440);
    ctx.restore();

    App.BattleEngine.TROOP_CARDS.forEach((c, idx) => {
      const tx = 392 + idx * 69;
      const ty = 444;
      const tw = 66, th = 83;
      const can = battle.wood >= c.wood && battle.food >= c.food && battle.status === 'fighting';

      ctx.save();
      const cg = ctx.createLinearGradient(tx, ty, tx, ty + th);
      if (can) {
        cg.addColorStop(0, '#853110');
        cg.addColorStop(0.6, '#5c1f09');
        cg.addColorStop(1, '#3b1305');
      } else {
        cg.addColorStop(0, '#57534e');
        cg.addColorStop(1, '#363330');
      }
      App.UI.roundRect(ctx, tx, ty, tw, th, 8);
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = can ? '#fde047' : '#a8a29e';
      ctx.lineWidth = can ? 1.6 : 1.1;
      ctx.stroke();

      // 顶部兵种小图内衬底框 + 光晕
      App.UI.roundRect(ctx, tx + 4, ty + 4, tw - 8, 43, 6);
      ctx.fillStyle = can ? 'rgba(20, 9, 4, 0.48)' : 'rgba(20, 20, 20, 0.35)';
      ctx.fill();

      const halo = ctx.createRadialGradient(tx + tw / 2, ty + 25, 2, tx + tw / 2, ty + 25, 21);
      halo.addColorStop(0, can ? (c.isMagic ? 'rgba(192,132,252,0.38)' : 'rgba(251,191,36,0.30)') : 'rgba(255,255,255,0.08)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(tx + tw / 2, ty + 25, 21, 0, Math.PI * 2);
      ctx.fill();

      // 绘制高清手绘兵种精灵小图片（自适应宽高比居中展示）
      const spr = App.Assets.get(c.spriteKey);
      if (spr) {
        if (!can) ctx.globalAlpha = 0.55;
        const maxW = 44, maxH = 40;
        const sw = spr.naturalWidth || spr.width || 64;
        const sh = spr.naturalHeight || spr.height || 64;
        const sc = Math.min(maxW / sw, maxH / sh);
        const dw = sw * sc, dh = sh * sc;
        ctx.drawImage(spr, tx + (tw - dw) / 2, ty + 5 + (40 - dh) / 2, dw, dh);
        ctx.globalAlpha = 1;
      }

      // 兵种名称
      ctx.fillStyle = can ? '#fef08a' : '#d6d3d1';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.name, tx + tw / 2, ty + 60);

      // 底部木材与粮草小图标消耗胶囊
      App.UI.roundRect(ctx, tx + 3, ty + 65, tw - 6, 15, 5);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fill();

      App.UI.drawMiniIcon(ctx, 'res_wood', tx + 5, ty + 67, 11);
      ctx.fillStyle = battle.wood >= c.wood ? '#fde68a' : '#fca5a5';
      ctx.font = 'bold 9.5px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(c.wood), tx + 17, ty + 76);

      App.UI.drawMiniIcon(ctx, 'res_stamina', tx + 34, ty + 67, 11);
      ctx.fillStyle = battle.food >= c.food ? '#bbf7d0' : '#fca5a5';
      ctx.fillText(String(c.food), tx + 46, ty + 76);
      ctx.restore();

      if (battle.status === 'fighting') {
        App.UI.addHit(tx, ty, tw, th, () => App.BattleEngine.spawnPlayerTroop(battle, idx));
      }
    });

    const mmX = 754, mmY = 426, mmW = 194, mmH = 106;
    App.UI.drawPanel(ctx, mmX, mmY, mmW, mmH, { r: 8, bg: '#b08d57', border: '#6b3417', lineWidth: 2 });
    battle.units.forEach((u) => {
      if (!u.alive) return;
      const mx = mmX + (u.x / battle.worldW) * mmW;
      const my = mmY + ((u.y - 180) / 220) * mmH;
      ctx.fillStyle = u.side === 'player' ? (u.kind === 'beast' ? '#38bdf8' : '#2563eb') : '#dc2626';
      ctx.beginPath(); ctx.arc(mx, my, u.kind === 'soldier' ? 2.5 : 4.5, 0, Math.PI * 2); ctx.fill();
    });
    const vx = mmX + (battle.cameraX / battle.worldW) * mmW;
    const vw = (W / battle.worldW) * mmW;
    ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 1.6;
    ctx.strokeRect(vx, mmY + 2, vw, mmH - 4);
    App.UI.addHit(mmX, mmY, mmW, mmH, () => {
      battle.autoCam = !battle.autoCam;
      battle.cameraX = battle.autoCam ? 0 : Math.max(0, battle.worldW - W);
      App.UI.showToast(battle.autoCam ? '镜头：自动跟随我军先锋' : '镜头：观察敌方大营', '#fef08a');
    });

    // ★ 5. 释放大招时的【名将/神兽立绘滑入特写 Cut-in】！
    if (battle.banner) {
      const b = battle.banner;
      const slide = Math.min(1, (b.maxTimer - b.timer) * 6);
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.timer * 2.5);
      ctx.fillStyle = 'rgba(20, 10, 5, 0.90)';
      ctx.fillRect(0, 62, W, 68);
      ctx.strokeStyle = b.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, 62); ctx.lineTo(W, 62); ctx.moveTo(0, 130); ctx.lineTo(W, 130); ctx.stroke();

      const portX = -90 + slide * 250;
      if (b.portraitId) {
        App.Portraits.drawGeneralPortrait(ctx, b.portraitId, portX, 54, 84, { radius: 12, border: b.color, lineWidth: 3 });
      } else if (b.beastPortraitId) {
        App.Portraits.drawBeastPortrait(ctx, b.beastPortraitId, portX, 54, 84, { radius: 12, border: b.color, lineWidth: 3 });
      }

      ctx.fillStyle = b.color;
      ctx.font = 'bold 22px "PingFang SC", serif';
      ctx.textAlign = 'left';
      ctx.fillText(b.title, 265, 92);
      ctx.fillStyle = '#fef3c7';
      ctx.font = '13px "PingFang SC", sans-serif';
      ctx.fillText(b.sub, 265, 116);
      ctx.restore();
    }

    // ★ 6. 开局【两军主将应战特写图片展示】（回应“少了将领应战的图片展示”）！
    if (battle.introTimer > 0) {
      const alpha = Math.min(1, battle.introTimer * 2.2);
      const slideIn = Math.min(1, (1.45 - battle.introTimer) * 5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(15, 8, 4, 0.72)';
      ctx.fillRect(0, 120, W, 185);
      ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 120); ctx.lineTo(W, 120); ctx.moveTo(0, 305); ctx.lineTo(W, 305); ctx.stroke();

      // 左侧我方主将大图滑入
      const lx = -160 + slideIn * 240;
      if (battle.leadPlayerGenId) {
        const pg = App.Config.GENERALS[battle.leadPlayerGenId];
        App.Portraits.drawGeneralPortrait(ctx, pg.id, lx, 142, 138, { radius: 14, border: '#4ade80', lineWidth: 3 });
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 20px "PingFang SC", serif';
        ctx.textAlign = 'left';
        ctx.fillText(`我军主将 · ${pg.name}`, lx + 152, 196);
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 14px "PingFang SC", sans-serif';
        ctx.fillText(`军团总战力 ${App.State.getTeamPower()}`, lx + 152, 226);
      }

      // 中央交锋大字
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 3;
      ctx.font = 'bold 38px "PingFang SC", serif';
      ctx.textAlign = 'center';
      ctx.strokeText('应 战 !', W / 2, 224);
      ctx.fillText('应 战 !', W / 2, 224);

      // 右侧敌方守城大将/神兽大图滑入
      const rx = W + 20 - slideIn * 240;
      if (battle.leadEnemyBeastId) {
        const eb = App.Config.BEASTS[battle.leadEnemyBeastId];
        App.Portraits.drawBeastPortrait(ctx, eb.id, rx, 142, 138, { radius: 14, border: eb.glow, lineWidth: 3 });
        ctx.fillStyle = eb.glow;
        ctx.font = 'bold 20px "PingFang SC", serif';
        ctx.textAlign = 'right';
        ctx.fillText(`镇守神兽 · ${eb.name}`, rx - 14, 196);
      } else if (battle.leadEnemyGenId) {
        const eg = App.Config.GENERALS[battle.leadEnemyGenId];
        App.Portraits.drawGeneralPortrait(ctx, eg.id, rx, 142, 138, { radius: 14, border: '#f87171', lineWidth: 3 });
        ctx.fillStyle = '#fca5a5';
        ctx.font = 'bold 20px "PingFang SC", serif';
        ctx.textAlign = 'right';
        ctx.fillText(`敌军守将 · ${eg.name}`, rx - 14, 196);
        ctx.fillStyle = '#fde68a';
        ctx.font = '13px "PingFang SC", sans-serif';
        ctx.fillText(eg.title, rx - 14, 224);
      }
      ctx.restore();
    }

    if (battle.status !== 'fighting') drawResultModal(ctx, st, time || 0);
  }

  // ★ 紧凑精致版黑金凯旋捷报 & 小巧惜败撤军弹窗（零多余留白 + 新增【返回地图】与【下一关】快捷按钮！）
  function drawResultModal(ctx, st, time) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const win = battle.status === 'victory';

    // 拦截底层点击穿透
    App.UI.addHit(0, 0, W, H, () => {});

    // 1. 全屏暗角遮罩 + 凯旋金芒
    ctx.save();
    ctx.fillStyle = win ? 'rgba(10, 5, 2, 0.78)' : 'rgba(9, 13, 22, 0.80)';
    ctx.fillRect(0, 0, W, H);

    if (win) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(time * 0.35);
      for (let i = 0; i < 14; i++) {
        ctx.rotate((Math.PI * 2) / 14);
        const rayG = ctx.createLinearGradient(0, 0, 0, -290);
        rayG.addColorStop(0, 'rgba(250, 204, 21, 0.22)');
        rayG.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = rayG;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-20, -290);
        ctx.lineTo(20, -290);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();

    const hasCaptive = win && !!(battle.captiveGeneralId || battle.captiveBeastId);
    const hasLvUp = win && !!(battle.levelUpInfo && battle.levelUpInfo.leveledUp);
    const topPad = hasLvUp ? 44 : 30;

    // 紧凑精确计算高度：胜利无冗余空白，惜败撤军缩小为轻巧小弹窗(416×196)！
    const mw = win ? 564 : 416;
    const mh = win ? (hasCaptive ? (topPad + 292) : (topPad + 156)) : 196;
    const mx = Math.round((W - mw) / 2);
    const my = Math.round((H - mh) / 2 + 8);

    // 2. 双层雕花边框
    ctx.save();
    const bodyGrad = ctx.createLinearGradient(mx, my, mx, my + mh);
    if (win) {
      bodyGrad.addColorStop(0, '#361a0c');
      bodyGrad.addColorStop(0.5, '#251107');
      bodyGrad.addColorStop(1, '#1a0b04');
    } else {
      bodyGrad.addColorStop(0, '#1e293b');
      bodyGrad.addColorStop(1, '#0f172a');
    }
    App.UI.roundRect(ctx, mx, my, mw, mh, 14);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = win ? '#facc15' : '#94a3b8';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    App.UI.roundRect(ctx, mx + 6, my + 6, mw - 12, mh - 12, 10);
    ctx.strokeStyle = win ? 'rgba(250, 204, 21, 0.35)' : 'rgba(148, 163, 184, 0.26)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // 顶部居中牌匾横幅
    const bw = win ? 264 : 204, bh = win ? 42 : 36;
    const bx = W / 2 - bw / 2, by = my - Math.round(bh / 2);
    const headGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    if (win) {
      headGrad.addColorStop(0, '#dc2626');
      headGrad.addColorStop(1, '#7f1d1d');
    } else {
      headGrad.addColorStop(0, '#475569');
      headGrad.addColorStop(1, '#1e293b');
    }
    App.UI.roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.strokeStyle = win ? '#fde047' : '#cbd5e1';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${win ? 20 : 17}px "PingFang SC", "STKaiti", serif`;
    ctx.fillStyle = win ? '#fef08a' : '#e2e8f0';
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
    ctx.shadowBlur = 5;
    ctx.fillText(win ? '★ 凯 旋 大 捷 ★' : '惜 败 撤 军', W / 2, by + bh / 2 + 1);
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';
    ctx.restore();

    const backScene = backOf(battle);

    if (win) {
      if (hasLvUp) {
        const lvInfo = battle.levelUpInfo;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText(
          `恭喜主公晋升至 Lv.${lvInfo.newLv}！${lvInfo.unlockedBeast ? '【四象神兽副本已正式开启！】' : ''}`,
          W / 2, my + 35
        );
        ctx.restore();
      }

      // 3. 紧凑横排 4 格战利品卡
      const eqTpl = battle.droppedEquip ? App.Config.EQUIP_TEMPLATES[battle.droppedEquip.tplId] : null;
      const eqQual = eqTpl ? App.Config.QUALITIES[eqTpl.quality] : null;
      const lootCards = [
        { type: 'item', key: 'exp_scroll', title: `经验 +${battle.expGain}`, sub: `主公 Lv.${st.lordLevel}`, border: '#38bdf8', col: '#bae6fd' },
        { type: 'mini', key: 'res_gold', title: `铜钱 +${battle.goldReward}`, sub: '战利军饷', border: '#facc15', col: '#fde047' },
        { type: 'mini', key: 'res_soul', title: `将魂 +${battle.soulReward}`, sub: '升星精魄', border: '#c084fc', col: '#f5d0fe' },
      ];
      if (eqTpl) {
        lootCards.push({
          type: 'equip', key: eqTpl.id, title: eqTpl.name,
          sub: `${eqQual.name}·已入库`, border: eqQual.color, col: '#fef08a',
        });
      }

      const cw = 121, ch = 86, cGap = 13;
      const totalCW = lootCards.length * cw + (lootCards.length - 1) * cGap;
      let startCX = W / 2 - totalCW / 2;
      const cardY = my + topPad;

      lootCards.forEach((lc) => {
        App.UI.drawPanel(ctx, startCX, cardY, cw, ch, {
          r: 9, bg: 'rgba(18, 9, 4, 0.78)', border: lc.border, lineWidth: 1.6,
        });
        if (lc.type === 'equip') {
          App.Sprites.drawEquipIcon(ctx, lc.key, startCX + (cw - 40) / 2, cardY + 7, 40, { radius: 7, border: lc.border, lineWidth: 1.6 });
        } else if (lc.type === 'item') {
          const img = App.Assets.get('item_' + lc.key);
          if (img) ctx.drawImage(img, startCX + (cw - 38) / 2, cardY + 8, 38, 38);
        } else {
          App.UI.drawMiniIcon(ctx, lc.key, startCX + (cw - 38) / 2, cardY + 8, 38);
        }
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = lc.col;
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(lc.title, startCX + cw / 2, cardY + 62);
        ctx.fillStyle = '#a8a29e';
        ctx.font = '9.5px "PingFang SC", sans-serif';
        ctx.fillText(lc.sub, startCX + cw / 2, cardY + 77);
        ctx.restore();
        startCX += cw + cGap;
      });

      // 4. 紧凑帐下生擒敌将劝降台 / 四象神兽收服台（紧贴战利品下方，零空洞留白！）
      const boxX = mx + 20, boxY = cardY + ch + 10, boxW = mw - 40, boxH = 128;
      if (battle.captiveGeneralId) {
        const gid = battle.captiveGeneralId;
        const g = App.Config.GENERALS[gid];
        const tier = App.Config.RECRUIT_TIERS[g.recruitTier];
        const chance = Math.round(App.State.computeRecruitChance(gid, 0.05, false, false) * 100);
        const dblChance = Math.round(App.State.computeRecruitChance(gid, 0.05, false, true) * 100);

        App.UI.drawPanel(ctx, boxX, boxY, boxW, boxH, {
          r: 11, bg: 'rgba(62, 30, 14, 0.90)', border: '#d4a34b', lineWidth: 1.7,
        });
        App.Portraits.drawGeneralPortrait(ctx, gid, boxX + 14, boxY + 12, 86, { radius: 10, lineWidth: 2.2 });

        ctx.save();
        ctx.fillStyle = '#1c1008';
        App.UI.roundRect(ctx, boxX + 19, boxY + 102, 76, 17, 8);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 9.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${g.rarity} · ${g.title.slice(0, 4)}`, boxX + 57, boxY + 114);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 15px "PingFang SC", serif';
        ctx.fillText(`帐下生擒：${g.name}  (绝技：${g.skillName})`, boxX + 116, boxY + 31);

        const pityPct = Math.round((st.recruitPity[gid] || 0) * 100);
        ctx.fillStyle = tier.color;
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText(
          `气节：${tier.label}   归顺成功率：${chance}% ${pityPct > 0 ? `(含保底+${pityPct}%)` : ''}`,
          boxX + 116, boxY + 52
        );
        ctx.restore();

        if (battle.recruitState === 'pending') {
          App.UI.drawButton(ctx, boxX + 116, boxY + 64, 192, 50, `礼贤招降 (${chance}%)`, {
            r: 9, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13.5,
            subText: '失败自动 +10% 保底率',
          }, () => {
            App.BattleEngine.postVictoryRecruit(battle, false).then((res) => {
              if (res.ok) App.UI.showToast(res.success ? `招降大喜！【${g.name}】归顺麾下！` : `暂未松口，${g.name} 赏识度 +10%！`, res.success ? '#4ade80' : '#fbbf24');
            });
          });

          App.UI.drawAdButton(ctx, boxX + 318, boxY + 64, 190, 50, `三顾茅庐 (${dblChance}%)`, {
            r: 9, fontSize: 13,
            subText: '双倍高几率直招',
          }, () => {
            App.Platform.showRewardedAd('recruit_retry', `施展【三顾茅庐】，以 ${dblChance}% 双倍高几率招降 ${g.name}！`, () => {
              App.BattleEngine.postVictoryRecruit(battle, true).then((res) => {
                if (res.ok) App.UI.showToast(res.success ? `三顾茅庐成功！【${g.name}】入营！` : `傲骨铮铮，赏识度再 +10%！`, res.success ? '#4ade80' : '#fde047');
              });
            });
          });
        } else if (battle.recruitState === 'success') {
          ctx.save();
          ctx.fillStyle = 'rgba(22, 163, 74, 0.22)';
          App.UI.roundRect(ctx, boxX + 116, boxY + 68, 392, 44, 9);
          ctx.fill();
          ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.fillStyle = '#86efac';
          ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            battle.recruitDuplicate ? `✓ 已拥有【${g.name}】，自动转化为 +35 将魂！` : `招降成功！名将【${g.name}】已加入名将营！`,
            boxX + 312, boxY + 95
          );
          ctx.restore();
        } else {
          App.UI.drawAdButton(ctx, boxX + 116, boxY + 64, 392, 50, `【三顾茅庐】以 ${dblChance}% 双倍几率再次招降！`, {
            r: 9, fontSize: 13,
            subText: '刚烈未降，赏识保底已增加 +10%',
          }, () => {
            App.Platform.showRewardedAd('recruit_retry', `施展【三顾茅庐】，以 ${dblChance}% 几率再次招降 ${g.name}！`, () => {
              App.BattleEngine.postVictoryRecruit(battle, true).then((res) => {
                if (res.ok) App.UI.showToast(res.success ? `三顾茅庐成功！${g.name} 归顺！` : `仍未松口，保底再 +10%！`, res.success ? '#4ade80' : '#fde047');
              });
            });
          });
        }
      } else if (battle.captiveBeastId) {
        const bid = battle.captiveBeastId;
        const bCfg = App.Config.BEASTS[bid];
        const r1 = Math.round(App.State.computeCatchChance(bid, 0.05, false) * 100);
        const r2 = Math.round(App.State.computeCatchChance(bid, 0.05, true) * 100);

        App.UI.drawPanel(ctx, boxX, boxY, boxW, boxH, { r: 11, bg: '#0f172a', border: bCfg.glow, lineWidth: 1.8 });
        App.Portraits.drawBeastPortrait(ctx, bid, boxX + 14, boxY + 16, 94, { radius: 10, lineWidth: 2.2 });

        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = bCfg.glow;
        ctx.font = 'bold 15px "PingFang SC", serif';
        ctx.fillText(`四象神兽已镇伏：${bCfg.name}`, boxX + 122, boxY + 32);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '11.5px "PingFang SC", sans-serif';
        ctx.fillText(
          battle.catchState === 'failed' ? '神兽震断了绳索！可切换黄金缚兽索再次收服：' : `抛出缚兽索缔结契约（普通索 ${r1}% / 黄金索 ${r2}%）：`,
          boxX + 122, boxY + 52
        );
        ctx.restore();

        if (battle.catchState === 'success') {
          ctx.save();
          ctx.fillStyle = '#4ade80';
          ctx.font = 'bold 14.5px "PingFang SC", sans-serif';
          ctx.fillText(`契约礼成！【${bCfg.name}】已收入四象兽栏！`, boxX + 122, boxY + 94);
          ctx.restore();
        } else {
          App.UI.drawButton(ctx, boxX + 122, boxY + 64, 188, 50, `普通缚兽索 (${r1}%)`, {
            r: 9, grad: ['#0284c7', '#0369a1'], border: '#bae6fd', fontSize: 12.5,
            subText: `库存 ${st.ropes} 根`, disabled: st.ropes <= 0,
          }, () => {
            App.BattleEngine.postVictoryCatchBeast(battle, false).then((res) => {
              if (res.ok) App.UI.showToast(res.success ? `收服【${bCfg.name}】！` : `神兽挣脱了缚兽索！`, res.success ? '#4ade80' : '#f87171');
            });
          });

          if (st.goldRopes > 0) {
            App.UI.drawButton(ctx, boxX + 320, boxY + 64, 188, 50, `黄金缚兽索 (${r2}%)`, {
              r: 9, grad: ['#d97706', '#b45309'], border: '#fef08a', fontSize: 12.5,
              subText: `双倍高率 · 剩 ${st.goldRopes} 根`,
            }, () => {
              App.BattleEngine.postVictoryCatchBeast(battle, true).then((res) => {
                if (res.ok) App.UI.showToast(res.success ? `金索锁魂！收服【${bCfg.name}】！` : `差一点点！`, res.success ? '#4ade80' : '#f87171');
              });
            });
          } else {
            App.UI.drawAdButton(ctx, boxX + 320, boxY + 64, 188, 50, `免费领黄金索`, {
              r: 9, fontSize: 12.5,
              subText: `成功率提升至 ${r2}%`,
            }, () => {
              App.Platform.showRewardedAd('golden_rope', '免费领取 1 根【黄金缚兽索】（双倍抓捕率）！', () => {
                App.State.claimAd('golden_rope');
              });
            });
          }
        }
      }

      // 5. 紧贴底部的四键快捷操作栏（双倍军饷 / 返回地图 / 名将与装备 / 下一关 ▶）
      const btnY = hasCaptive ? (boxY + boxH + 12) : (cardY + ch + 14);
      const isCityNext = battle.mode === 'city' && battle.level && battle.level.order < App.Config.TOTAL_STAGES;

      const onNextClick = () => {
        if (isCityNext) {
          const nextLv = App.Config.buildStage(battle.level.order + 1);
          if (st.stamina < App.State.getStaminaCost(nextLv.staminaCost)) {
            App.Platform.showRewardedAd('stamina', '粮草不足！观看激励视频立即恢复 +15 粮草并进军下一关！', () => {
              App.State.claimAd('stamina').then((res) => { if (res.ok) App.Main.startBattle('city', nextLv.order, { level: nextLv }); });
            });
            return;
          }
          App.Main.startBattle('city', nextLv.order, { level: nextLv });
        } else {
          App.Main.goScene(backScene);
        }
      };

      if (!battle.doubleAdUsed) {
        App.UI.drawAdButton(ctx, mx + 20, btnY, 136, 42, '双倍军饷', {
          r: 9, fontSize: 12.5,
          subText: `+${battle.goldReward}钱+${battle.soulReward}魂`,
        }, () => {
          App.Platform.showRewardedAd('double_reward', '观看激励视频，额外再领一份铜钱与将魂！', () => {
            App.State.doubleReward(battle.serverId).then((res) => { if (res.ok) battle.doubleAdUsed = true; });
          });
        });

        App.UI.drawButton(ctx, mx + 164, btnY, 114, 42, '返回地图', {
          r: 9, grad: ['#475569', '#334155'], border: '#cbd5e1', fontSize: 13,
        }, () => App.Main.goScene('map'));

        App.UI.drawButton(ctx, mx + 286, btnY, 118, 42, '名将与装备', {
          r: 9, grad: ['#78350f', '#451a03'], border: '#d4a34b', fontSize: 13,
        }, () => App.Main.goScene('roster'));

        App.UI.drawButton(ctx, mx + 412, btnY, 132, 42, isCityNext ? '下一关 ▶' : '继续征战 ▶', {
          r: 9, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 14,
          subText: isCityNext ? '耗5粮草直战' : undefined,
        }, onNextClick);
      } else {
        App.UI.drawButton(ctx, mx + 34, btnY, 152, 42, '返回地图', {
          r: 9, grad: ['#475569', '#334155'], border: '#cbd5e1', fontSize: 13.5,
        }, () => App.Main.goScene('map'));

        App.UI.drawButton(ctx, mx + 198, btnY, 158, 42, '名将与装备', {
          r: 9, grad: ['#78350f', '#451a03'], border: '#d4a34b', fontSize: 13.5,
        }, () => App.Main.goScene('roster'));

        App.UI.drawButton(ctx, mx + 368, btnY, 162, 42, isCityNext ? '下一关 ▶' : '继续征战 ▶', {
          r: 9, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 14,
          subText: isCityNext ? '耗5粮草直战' : undefined,
        }, onNextClick);
      }
    } else {
      // ================= 惜败撤军界面：精致小巧玄铁框 (416×196) =================
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
      ctx.fillText('胜败乃兵家常事！已贴心返还一半粮草体力', W / 2, my + 44);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText('点击下方快捷途径提升战力，即可轻松破敌：', W / 2, my + 65);
      ctx.restore();

      const miniTips = [
        { label: '升级穿装', scene: 'roster', grad: ['#78350f', '#451a03'], border: '#facc15' },
        { label: '商铺招将', scene: 'shop', grad: ['#1e3a8a', '#172554'], border: '#60a5fa' },
        { label: '福利领将', scene: 'activity', grad: ['#14532d', '#052e16'], border: '#4ade80' },
      ];
      miniTips.forEach((tp, idx) => {
        App.UI.drawButton(ctx, mx + 24 + idx * 126, my + 80, 116, 32, tp.label, {
          r: 8, grad: tp.grad, border: tp.border, fontSize: 12,
        }, () => App.Main.goScene(tp.scene));
      });

      const btnY = my + 132;
      App.UI.drawButton(ctx, mx + 20, btnY, 114, 42, '返回地图', {
        r: 9, grad: ['#475569', '#334155'], border: '#cbd5e1', fontSize: 13,
      }, () => App.Main.goScene('map'));

      App.UI.drawButton(ctx, mx + 144, btnY, 114, 42, '名将强化', {
        r: 9, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13,
      }, () => App.Main.goScene('roster'));

      App.UI.drawButton(ctx, mx + 268, btnY, 128, 42, '重新挑战 ▶', {
        r: 9, grad: ['#dc2626', '#991b1b'], border: '#fca5a5', fontSize: 13,
      }, () => {
        if (battle.mode === 'city' && battle.level) {
          App.Main.startBattle('city', battle.level.order, { level: battle.level }).then((res) => { if (!res.ok) App.Main.goScene('map'); });
        } else {
          App.Main.goScene(backScene);
        }
      });
    }
  }

  function onDrag(dx) {
    if (!battle || battle.status !== 'fighting') return;
    battle.autoCam = false;
    battle.cameraX = Math.max(0, Math.min(battle.worldW - App.Platform.LOGICAL_W, battle.cameraX - dx));
  }

  function onBattleClick(x, y) {
    if (!battle || battle.status !== 'fighting' || !battle.aimingUnit) return false;
    if (y >= 48 && y <= 376) {
      const worldX = x + battle.cameraX;
      const worldY = Math.max(205, Math.min(380, y));
      App.BattleEngine.executeGeneralSkillAt(battle, battle.aimingUnit, worldX, worldY);
      return true;
    }
    return false;
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.battle = { enter, update, render, onDrag, onBattleClick };
})(typeof globalThis !== 'undefined' ? globalThis : window);
