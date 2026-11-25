(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let battle = null;

  const BACK = { arena: 'arena', beast: 'beastDungeon', demon: 'demon', tower: 'tower', city: 'map' };
  const backOf = (b) => b.backScene || BACK[b.mode] || 'challenge';

  // ★ 关卡标题牌右侧嵌入式【轮次小圆圈进度环】（如 1/3、4/6、3/3，直观呈现波次推进！）
  function drawRoundProgressCircle(ctx, cx, cy, r, curRound, totalRounds) {
    const total = Math.max(1, totalRounds || 1);
    const cur = Math.max(1, Math.min(total, curRound || 1));
    const ratio = cur / total;
    const isLast = cur >= total;

    ctx.save();
    // 1. 凹陷玄黑圆盘底托
    const bg = ctx.createRadialGradient(cx, cy - r * 0.25, 1, cx, cy, r);
    bg.addColorStop(0, '#2c1409');
    bg.addColorStop(1, '#120703');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    // 2. 轨道底环
    const ringR = r - 2.1;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(254, 243, 199, 0.18)';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    // 3. 顺时针轮次进度弧
    const startAng = -Math.PI / 2;
    const endAng = startAng + Math.PI * 2 * ratio;
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, startAng, endAng, false);
    ctx.strokeStyle = isLast ? '#f87171' : '#fbbf24';
    ctx.lineWidth = 2.7;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 4. 外圈极细暗金包边
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = isLast ? 'rgba(252, 165, 165, 0.55)' : 'rgba(212, 163, 75, 0.55)';
    ctx.lineWidth = 0.9;
    ctx.stroke();

    // 5. 圆心轮次分数字样（如 4/6、1/3）
    const txt = `${cur}/${total}`;
    ctx.fillStyle = isLast ? '#fecaca' : '#fef9c3';
    ctx.font = `bold ${txt.length >= 5 ? 8.5 : 9.5}px "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, cx, cy + 0.5);
    ctx.restore();
  }

  // ★ 自适应宽度 + 自动缩字防溢出横幅胶囊（彻底根治天象/目标提示文字超出框外！）
  function drawFittedBannerPill(ctx, cx, y, h, text, opts) {
    const o = opts || {};
    const maxW = o.maxW || 880;
    const minW = o.minW || 220;
    const padX = o.padX || 18;
    let fontSize = o.fontSize || 11.5;

    ctx.save();
    ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    let textW = ctx.measureText(text).width;
    while (textW + padX * 2 > maxW && fontSize > 9.5) {
      fontSize -= 0.5;
      ctx.font = `bold ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
      textW = ctx.measureText(text).width;
    }

    const boxW = Math.min(maxW, Math.max(minW, Math.ceil(textW + padX * 2)));
    const bx = cx - boxW / 2;

    App.UI.roundRect(ctx, bx, y, boxW, h, o.r != null ? o.r : h / 2);
    ctx.fillStyle = o.bg || 'rgba(22, 12, 7, 0.88)';
    ctx.fill();
    ctx.strokeStyle = o.border || '#d4a34b';
    ctx.lineWidth = o.lineWidth || 1.4;
    ctx.stroke();

    ctx.fillStyle = o.color || '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, y + h / 2 + 0.5, boxW - padX * 1.5);
    ctx.restore();

    return { x: bx, w: boxW };
  }

  function syncBattlePause(b) {
    if (!b) return false;
    if (App.BattleEngine && App.BattleEngine.syncPaused) return App.BattleEngine.syncPaused(b);
    b.paused = !!(b.userPaused || b.adPaused || b.settingsPaused || b.retreatConfirmOpen);
    return b.paused;
  }

  function enter(params) {
    if (App.Scenes.settings && App.Scenes.settings.closeBattleModal) {
      App.Scenes.settings.closeBattleModal();
    }
    if (params) {
      battle = App.BattleEngine.createBattle(params);
      battle.backScene = params.backScene || null;
    }
  }

  function leave() {
    if (battle) {
      battle.retreatConfirmOpen = false;
      battle.userPaused = false;
      syncBattlePause(battle);
    }
    if (App.Scenes.settings && App.Scenes.settings.closeBattleModal) {
      App.Scenes.settings.closeBattleModal();
    }
  }

  function update(dt) {
    if (!battle) return;
    if (battle.status !== 'fighting' && (battle.retreatConfirmOpen || battle.userPaused)) {
      battle.retreatConfirmOpen = false;
      battle.userPaused = false;
      syncBattlePause(battle);
    }
    App.BattleEngine.updateBattle(battle, dt);
  }

  function render(ctx, time) {
    if (!battle) return App.Main.goScene('map');
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();
    const isPaused = syncBattlePause(battle);
    const worldTime = battle.animTime != null ? battle.animTime : (time || 0);

    // 1. 绘制横版沙场与军团激战
    const allowShake = !App.Settings || App.Settings.get('screenShake');
    const highQuality = !App.Settings || App.Settings.get('highQualityVfx');
    const showSmallDmg = !App.Settings || App.Settings.get('damageFloat');
    ctx.save();
    if (battle.shakeTimer > 0 && allowShake && !isPaused) {
      const m = battle.shakeTimer * 18;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    ctx.save();
    ctx.translate(-battle.cameraX, 0);

    const hudCollector = [];
    const viewL = battle.cameraX;
    const viewR = battle.cameraX + W;
    App.Sprites.drawBattlefieldTerrain(ctx, battle, battle.cameraX, W, worldTime, hudCollector);

    const dustColor = battle.battleBgKey === 'bg_battle_snow'
      ? 'rgba(226, 238, 248, 0.80)'
      : (battle.battleBgKey === 'bg_battle_mystic'
        ? 'rgba(148, 163, 184, 0.65)'
        : 'rgba(218, 186, 134, 0.82)');
    if (highQuality) {
      battle.dustParticles.forEach((d) => {
        if (d.x < viewL - 60 || d.x > viewR + 60) return;
        const p = 1 - d.life / (d.maxLife || 0.32);
        ctx.save();
        ctx.globalAlpha = Math.max(0, (1 - p) * 0.58);
        ctx.fillStyle = dustColor;
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.size * (0.85 + p * 0.75), d.size * (0.55 + p * 0.45), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    battle.dyingUnits.forEach((d) => {
      if (d.x < viewL - 160 || d.x > viewR + 160) return;
      App.Sprites.drawDyingUnit(ctx, d);
    });

    // ★ 1A. 大招远景/地面符阵/法天象地魔相底衬（严格铺在所有兵马人物身后与脚下，绝不遮挡战场单位！）
    if (battle.skillEffects.length > 0 && App.Sprites.drawSkillBackdrop) {
      battle.skillEffects.forEach((fx) => App.Sprites.drawSkillBackdrop(ctx, fx, battle.cameraX, W));
    }

    const renderList = [];
    battle.towers.forEach((t) => {
      if (t.alive && t.x >= viewL - 150 && t.x <= viewR + 150) {
        renderList.push({ y: t.y, type: 'tower', obj: t });
      }
    });
    battle.units.forEach((u) => {
      if (!u.alive || u.x < viewL - 190 || u.x > viewR + 190) return;
      // 主营为等轴大建筑，按其底面中心深度 (y-56) 参与前后遮挡排序，确保辕门外将士永远显示在主营前方
      const sortY = (u.isMainBase || u.isBase) ? (u.y - 56) : u.y;
      renderList.push({ y: sortY, type: u.kind, obj: u });
    });
    renderList.sort((a, b) => a.y - b.y);

    renderList.forEach((item) => {
      if (item.type === 'tower') App.Sprites.drawWatchTower(ctx, item.obj, hudCollector);
      else if (item.type === 'general') App.Sprites.drawMountedGeneral(ctx, item.obj, worldTime, hudCollector);
      else if (item.type === 'beast') App.Sprites.drawGiantBeastSprite(ctx, item.obj, worldTime, hudCollector);
      else if (item.type === 'prop') App.Sprites.drawProp(ctx, item.obj, worldTime, hudCollector);
      else App.Sprites.drawSoldierSprite(ctx, item.obj, worldTime, hudCollector);
    });

    // ★ 1B. 渲染清透利落的前景刀芒/雷弧特效（半透通明，透过光刃清晰可见正在拼杀的兵马！）
    if (battle.skillEffects.length > 0) {
      battle.skillEffects.forEach((fx) => App.Sprites.drawSkillEffect(ctx, fx, battle.cameraX, W));
    }

    // ★ 1B+. 渲染随军悬浮的【镇军法宝真身】（灵空八卦星轨护持前锋，蓄满周期释放镇军神威！）
    if (App.Sprites.drawBattleArtifact) {
      if (battle.playerArtifact && battle.playerArtifact.x >= viewL - 120 && battle.playerArtifact.x <= viewR + 120) {
        App.Sprites.drawBattleArtifact(ctx, battle.playerArtifact, time);
      }
      if (battle.enemyArtifact && battle.enemyArtifact.x >= viewL - 120 && battle.enemyArtifact.x <= viewR + 120) {
        App.Sprites.drawBattleArtifact(ctx, battle.enemyArtifact, time);
      }
    }

    // ★ 1C. 所有将领与士卒铭牌、血条、眩晕/石化状态标永远置于最顶层，100% 零遮挡！
    if (App.Sprites.drawUnitHudLayer) {
      App.Sprites.drawUnitHudLayer(ctx, hudCollector, battle.cameraX, W);
    }

    battle.projectiles.forEach((p) => {
      const px = p.cx != null ? p.cx : (p.x2 != null ? p.x2 : p.x1);
      if (px != null && (px < viewL - 180 || px > viewR + 180)) return;
      App.Sprites.drawProjectile(ctx, p, worldTime);
    });

    battle.sparks.forEach((s) => {
      if (s.x < viewL - 60 || s.x > viewR + 60) return;
      ctx.save();
      ctx.globalAlpha = Math.min(0.85, s.life * 3.2);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size || 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - (s.vx || 0) * 0.032, s.y - (s.vy || 0) * 0.032);
      ctx.stroke();
      ctx.restore();
    });

    battle.floatTexts.forEach((f) => {
      if (!f.big && !showSmallDmg) return;
      if (f.x < viewL - 90 || f.x > viewR + 90) return;
      const age = (f.maxLife || 1) - f.life;
      const pop = age < 0.12 ? (0.82 + (age / 0.12) * 0.24) : 1.0;
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life * 2.2);
      ctx.translate(f.x, f.y);
      if (pop !== 1) ctx.scale(pop, pop);
      ctx.font = `bold ${f.big ? 15.5 : 11.5}px "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.92)';
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    });

    // ★ 渲染局内随机自然灾害粒子与天象滤镜层（狂风/暴雨/冰雹/瘟疫/风沙）
    if (App.Sprites.drawDisasterOverlay) {
      App.Sprites.drawDisasterOverlay(ctx, battle, battle.cameraX, W, worldTime);
    }

    ctx.restore();
    ctx.restore();

    // 2. 顶部一体化檀木资源栏（木材胶囊 + 粮草胶囊 + 鎏金圆章【▶ 军需+120】补给胶囊；世界/联盟 BOSS 无小兵模式下隐藏）
    const noTroops = !!battle.noTroops;
    const showSupplyBtn = !noTroops && !battle.adSupplyUsed && battle.status === 'fighting';
    const leftBarRight = noTroops ? 10 : (10 + (showSupplyBtn ? 338 : 228));
    if (!noTroops) {
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
          if (isPaused) {
            App.UI.showToast('战局已暂停，请先点击【继续】恢复作战', '#fde047');
            return;
          }
          battle.adPaused = true;
          syncBattlePause(battle);
          App.Platform.showRewardedAd('stamina', '前线紧急空投：立即获得 +120 木材 与 +120 粮草！', () => {
            battle.adPaused = false;
            syncBattlePause(battle);
            battle.adSupplyUsed = true;
            battle.wood = Math.min(999, battle.wood + 120);
            battle.food = Math.min(999, battle.food + 120);
            App.UI.showToast('前线军需空投抵达！木材+120 粮草+120！', '#4ade80');
          }, () => {
            battle.adPaused = false;
            syncBattlePause(battle);
          });
        });
      }
    }

    // ★ 顶部关卡主牌匾 + 右侧内嵌【轮次小圆圈进度环 (1/3、4/6)】+ 旁侧紧凑嘲讽钮！
    const titleText = battle.mode === 'arena'
      ? `群英志 · ${battle.arenaMatch && battle.arenaMatch.spar ? '演武切磋' : '演武场PK'} vs ${battle.arenaMatch.playerName}`
      : (battle.mode !== 'city' ? `群英志 · ${battle.level.name}` : `群英志 · 第${battle.level.order}关 ${battle.level.name}`);
    const hasRoundBadge = (battle.totalRounds || 1) > 1;
    const canTauntEarly = hasRoundBadge && !battle.special && battle.round < battle.totalRounds && battle.status === 'fighting';

    ctx.save();
    ctx.font = 'bold 14px "PingFang SC", serif';
    const rawTitleW = ctx.measureText(titleText).width;
    ctx.restore();

    const rightSafeX = W - 260; // 留出右侧【设置 + 加速 + 暂停 + 撤退】四钮组安全间距
    const tauntExtraW = canTauntEarly ? 76 : 0;
    const maxHeaderW = Math.max(196, rightSafeX - (leftBarRight + 8) - tauntExtraW);
    const desiredHeaderW = rawTitleW + (hasRoundBadge ? 64 : 34);
    const headerW = Math.min(maxHeaderW, Math.max(hasRoundBadge ? 232 : 206, Math.ceil(desiredHeaderW)));
    const totalCenterGroupW = headerW + tauntExtraW;
    let headerX = Math.round(W / 2 - totalCenterGroupW / 2);
    if (headerX < leftBarRight + 8) headerX = leftBarRight + 8;
    if (headerX + totalCenterGroupW > rightSafeX) headerX = rightSafeX - totalCenterGroupW;

    App.UI.drawWoodHeader(ctx, headerX, 6, headerW, 38);
    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const titleAreaW = headerW - (hasRoundBadge ? 48 : 20);
    const titleCenterX = headerX + (hasRoundBadge ? (headerW - 36) / 2 + 4 : headerW / 2);
    ctx.fillText(titleText, titleCenterX, 25.5, Math.max(80, titleAreaW));
    ctx.restore();

    if (hasRoundBadge) {
      const displayRound = battle.special && (battle.special.type === 'pass' || battle.special.type === 'xian' || battle.special.type === 'mo')
        ? Math.min(battle.totalRounds, (battle.passCleared || 0) + 1)
        : battle.round;
      drawRoundProgressCircle(ctx, headerX + headerW - 21, 25, 14.5, displayRound, battle.totalRounds);
    }

    if (canTauntEarly) {
      const tauntTxt = battle.roundWaiting ? `迎敌 ${Math.ceil(battle.roundCountdown)}s` : '嘲讽 ▶';
      App.UI.drawButton(ctx, headerX + headerW + 6, 9, 70, 32, tauntTxt, {
        r: 8, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 11.5,
      }, () => {
        if (isPaused) {
          App.UI.showToast('战局已暂停，请先点击【继续】恢复作战', '#fde047');
          return;
        }
        if (App.BattleEngine.nextRound(battle)) App.UI.showToast('主公阵前嘲讽，敌军下一轮提前杀到！', '#fca5a5');
      });
    }

    if (App.UI.drawSettingsGearButton && App.Scenes.settings) {
      App.UI.drawSettingsGearButton(ctx, W - 252, 11, 30, () => {
        App.Scenes.settings.openBattleModal(battle);
      });
    } else if (App.UI.drawSoundToggle) {
      App.UI.drawSoundToggle(ctx, W - 251, 12, 28);
    }
    App.UI.drawButton(ctx, W - 216, 8, 64, 36, `${battle.speedMult}x 加速`, {
      r: 8,
      grad: battle.speedMult > 1 ? ['#b45309', '#78350f'] : undefined,
      bg: battle.speedMult > 1 ? undefined : '#78350f',
      border: '#fde047',
      fontSize: 11.5,
    }, () => { battle.speedMult = battle.speedMult === 1 ? 2 : 1; });

    const manualPaused = !!battle.userPaused;
    App.UI.drawButton(ctx, W - 146, 8, 64, 36, manualPaused ? '继续' : '暂停', {
      r: 8,
      icon: manualPaused ? 'play' : 'pause',
      grad: manualPaused ? ['#d97706', '#92400e'] : ['#5c3a1e', '#3b2310'],
      border: manualPaused ? '#fef08a' : '#eab308',
      lineWidth: manualPaused ? 2 : 1.45,
      fontSize: 12,
      disabled: battle.status !== 'fighting',
    }, () => {
      if (battle.status !== 'fighting') return;
      battle.userPaused = !battle.userPaused;
      syncBattlePause(battle);
    });

    App.UI.drawButton(ctx, W - 76, 8, 66, 36, '撤退', {
      r: 8, grad: ['#b91c1c', '#7f1d1d'], border: '#fca5a5', fontSize: 12,
    }, () => {
      if (battle.status === 'fighting') {
        battle.retreatConfirmOpen = true;
        syncBattlePause(battle);
        return;
      }
      App.Main.goScene(backOf(battle));
    });

    // ★ 顶部次级信息条纵向顺排 + 动态自适应框宽（彻底根治天象框字超框 & 与波次框重叠遮挡！）
    let subBannerY = 48;
    if (battle.aimingUnit && battle.status === 'fighting') {
      ctx.save();
      ctx.fillStyle = 'rgba(250, 204, 21, 0.12)';
      ctx.fillRect(0, 48, W, 330);
      ctx.restore();
      drawFittedBannerPill(
        ctx, W / 2, 52, 34,
        `点击战场任意敌群位置，释放【${battle.aimingUnit.name}·${battle.aimingUnit.cfg.skillName}】！`,
        { maxW: W - 40, minW: 360, fontSize: 13.5, bg: 'rgba(28, 16, 8, 0.92)', border: '#fde047', color: '#fef08a', lineWidth: 2 }
      );
    } else if (battle.status === 'fighting') {
      if (battle.special) {
        const sp = battle.special, t = Math.ceil(battle.timeLeft);
        let txt = '';
        if (sp.type === 'tomb') txt = `皇陵劫掠倒计时 ${t} 秒  ·  已夺秘宝 ${App.BattleEngine.specialScore(battle)} / ${sp.lootTotal}`;
        else if (sp.type === 'treasury') txt = `郿坞夺金倒计时 ${t} 秒  ·  已破金窖 ${App.BattleEngine.specialScore(battle)} / ${sp.lootTotal}`;
        else if (sp.type === 'defend') txt = `死守帅帐 · 剩余 ${t} 秒  ·  第 ${battle.round} / ${battle.totalRounds} 波蛮兵`;
        else if (sp.type === 'pass' || sp.type === 'xian' || sp.type === 'mo') {
          const pTitle = sp.type === 'xian' ? '九天仙台渡劫' : (sp.type === 'mo' ? '幽冥魔渊试炼' : '千里走单骑');
          txt = `${pTitle} · 已破 ${battle.passCleared || 0} / ${battle.totalRounds} 重（过重回血 ${Math.round((sp.cfg.healPct || 0.25) * 100)}%）`;
        }
        else if (sp.type === 'escort') txt = `护送木牛流马 · 粮车耐久 ${Math.round((battle.cartHpPct || 1) * 100)}%`;
        else if (sp.type === 'chaos') txt = App.State.get().activeBeastId === (battle.level.special.boss || {}).counter ? '✦ 克制神兽在阵 · 太古凶兽护盾已破除！' : '⚠ 未上阵克制神兽 · 凶兽护盾减免九成伤害';

        const hasPillBtn = sp.type === 'pass';
        const pillCx = hasPillBtn ? (W / 2 - 48) : (W / 2);
        const pillRes = drawFittedBannerPill(ctx, pillCx, subBannerY, 24, txt, {
          maxW: hasPillBtn ? (W - 156) : (W - 44),
          minW: 260,
          fontSize: 11.5,
          bg: 'rgba(34, 17, 7, 0.90)',
          border: '#d4a34b',
          color: '#fef08a',
        });

        if (hasPillBtn) {
          App.UI.drawButton(ctx, pillRes.x + pillRes.w + 8, subBannerY - 2, 96, 28, '服行军灵丹', {
            r: 14, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11,
          }, () => {
            if (isPaused) {
              App.UI.showToast('战局已暂停，请先点击【继续】恢复作战', '#fde047');
              return;
            }
            App.State.battlePill(battle.serverId).then((res) => {
              if (!res.ok) return;
              const pct = sp.cfg.pillHealPct || 0.4;
              battle.units.forEach((u) => { if (u.alive && u.side === 'player') u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * pct)); });
            });
          });
        }
        subBannerY += 27;
      } else if (battle.level && battle.level.raid) {
        drawFittedBannerPill(ctx, W / 2, subBannerY, 24, `讨伐倒计时 ${Math.ceil(battle.raidTimeLeft)} 秒  ·  本场已造成伤害 ${Math.round(battle.raidDamage || 0)}`, {
          maxW: W - 44, minW: 260, fontSize: 11.5, bg: 'rgba(34, 17, 7, 0.90)', border: '#d4a34b', color: '#fef08a',
        });
        subBannerY += 27;
      }

      if (battle.activeDisaster) {
        const dis = battle.activeDisaster;
        const disTxt = `天象【${dis.name}】(${Math.max(0, battle.disasterRemain).toFixed(1)}s) · ${dis.desc}`;
        drawFittedBannerPill(ctx, W / 2, subBannerY, 23, disTxt, {
          maxW: W - 36,
          minW: 300,
          fontSize: 11,
          bg: 'rgba(20, 12, 8, 0.88)',
          border: dis.color,
          color: dis.color,
        });
        subBannerY += 26;
      }
    }

    if (battle.status === 'victory' && battle.lootText) {
      drawFittedBannerPill(ctx, W / 2, H - 34, 28, battle.lootText, {
        maxW: W - 40,
        minW: 280,
        r: 8,
        fontSize: 12,
        bg: 'rgba(34, 17, 7, 0.92)',
        border: '#fde047',
        color: '#fef08a',
      });
    }

    // 3. 三军指令按钮（神兽灵气积满自动释放神威，不在界面展示神兽技能进度条/按钮）
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
        if (isPaused) {
          App.UI.showToast('战局已暂停，请先点击【继续】恢复作战', '#fde047');
          return;
        }
        battle.order = o.id;
        App.UI.showToast(`三军听令：${o.label}！`, '#fef08a');
      });
    });

    // ★ 3B. 右下小地图正上方：专属【镇军法宝】对战实时灵盘（展示出战法宝真身图标、强化等级与神威蓄力条！）
    if (battle.playerArtifact) {
      const pa = battle.playerArtifact;
      const ax = 724, ay = 376, aw = 224, ah = 36;
      const charge = pa.pulseInterval > 0 ? Math.max(0, Math.min(1, 1 - (pa.pulseTimer || 0) / pa.pulseInterval)) : 0;
      const flaring = (pa.castFlash || 0) > 0.15;

      App.UI.drawPanel(ctx, ax, ay, aw, ah, {
        r: 9,
        bg: flaring ? 'rgba(127, 29, 29, 0.94)' : 'rgba(30, 12, 7, 0.90)',
        border: flaring ? '#fef08a' : pa.color,
        lineWidth: flaring ? 2.2 : 1.5,
      });

      ctx.save();
      App.UI.roundRect(ctx, ax + 5, ay + 4, 28, 28, 6);
      ctx.clip();
      ctx.fillStyle = '#240f08';
      ctx.fillRect(ax + 5, ay + 4, 28, 28);
      const aImg = App.Assets.get(pa.imgKey);
      if (aImg) ctx.drawImage(aImg, ax + 5, ay + 4, 28, 28);
      ctx.restore();

      ctx.save();
      App.UI.roundRect(ctx, ax + 5, ay + 4, 28, 28, 6);
      ctx.strokeStyle = pa.color;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10.8px "PingFang SC", sans-serif';
      ctx.fillText(`法宝·${pa.name.slice(0, 6)} Lv.${pa.lv}`, ax + 39, ay + 15.5, aw - 92);

      ctx.textAlign = 'right';
      ctx.fillStyle = flaring ? '#ffffff' : pa.subColor;
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.fillText(flaring ? '✦神威爆发!' : `神威 ${Math.round(charge * 100)}%`, ax + aw - 8, ay + 15.5);
      ctx.restore();

      App.UI.drawBar(ctx, ax + 39, ay + 22, aw - 47, 7, flaring ? 1 : charge, flaring ? '#fef08a' : pa.color, 'rgba(0,0,0,0.65)');

      App.UI.addHit(ax, ay, aw, ah, () => {
        App.UI.showToast(`镇军法宝【${pa.name} Lv.${pa.lv}】出战中！本命光环生效，每 ${pa.pulseInterval.toFixed(1)} 秒降下法宝神威轰击敌阵！`, '#fde047');
      });
    } else if ((st.lordLevel || 1) >= 4 && battle.status === 'fighting') {
      const ax = 766, ay = 380, aw = 182, ah = 28;
      App.UI.drawPanel(ctx, ax, ay, aw, ah, {
        r: 7, bg: 'rgba(28, 16, 10, 0.72)', border: 'rgba(168, 162, 158, 0.5)', lineWidth: 1,
      });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#d6d3d1';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText('未装备法宝（锻器坊炼化助战）', ax + aw / 2, ay + ah / 2 + 0.5);
      ctx.restore();
    }

    // 4. 底部总控台
    App.UI.drawPanel(ctx, 0, 418, W, 122, { r: 0, bg: '#e8d4a6', border: '#6b3417', lineWidth: 3 });

    const pGens = battle.units.filter((u) => u.side === 'player' && u.kind === 'general');
    const genSlotW = noTroops ? 80 : 68;
    const genSlotStep = noTroops ? 92 : 74;
    const genStartX = noTroops ? 16 : 10;
    const portSize = noTroops ? 54 : 52;
    const barW = genSlotW - 12;
    for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
      const cx = genStartX + slotIdx * genSlotStep;
      const cy = 426;
      const u = pGens[slotIdx];

      if (!u) {
        App.UI.drawPanel(ctx, cx, cy, genSlotW, 106, { r: 8, bg: 'rgba(92, 54, 24, 0.25)', border: '#a16207', lineWidth: 1.2 });
        ctx.save();
        ctx.fillStyle = '#78350f';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`空阵位 ${slotIdx + 1}`, cx + genSlotW / 2, cy + 48);
        ctx.fillText('最多5将', cx + genSlotW / 2, cy + 66);
        ctx.restore();
        continue;
      }

      const ready = u.alive && u.rage >= 100 && battle.status === 'fighting';
      const isAiming = battle.aimingUnit === u;
      App.UI.drawPanel(ctx, cx, cy, genSlotW, 106, {
        r: 8,
        bg: isAiming ? '#15803d' : (ready ? '#78350f' : '#3b2112'),
        border: isAiming ? '#86efac' : (ready ? '#fde047' : '#a16207'),
        lineWidth: ready || isAiming ? 2.6 : 1.5,
      });
      const tMeta = App.Config.getTroopMeta ? App.Config.getTroopMeta(u.troopId) : { short: '兵', color: '#fde047', bg: '#78350f' };
      ctx.save();
      if (!u.alive) ctx.globalAlpha = 0.35;
      App.Portraits.drawGeneralPortrait(ctx, u.id, cx + Math.round((genSlotW - portSize) / 2), cy + 6, portSize, { radius: 6, lineWidth: 1.5 });

      // 左上角默认统率兵种小徽标（无小兵模式下不展示）
      if (!noTroops) {
        ctx.fillStyle = tMeta.bg;
        App.UI.roundRect(ctx, cx + 4, cy + 4, 17, 14, 4);
        ctx.fill();
        ctx.strokeStyle = tMeta.color;
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.fillStyle = '#fefce8';
        ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(tMeta.short, cx + 12.5, cy + 13.5);
      }

      const eqCount = u.equips ? Object.keys(u.equips).length : 0;
      if (eqCount > 0) {
        ctx.fillStyle = '#facc15';
        App.UI.roundRect(ctx, cx + genSlotW - 24, cy + 4, 20, 14, 4);
        ctx.fill();
        ctx.fillStyle = '#1c1917';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${eqCount}装`, cx + genSlotW - 14, cy + 14);
      }

      App.UI.drawBar(ctx, cx + 6, cy + 62, barW, 12, u.hp / u.maxHp, '#22c55e', '#1c1917');
      ctx.fillStyle = u.alive ? '#ffffff' : '#fca5a5';
      ctx.font = 'bold 9px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.alive ? `${Math.ceil(u.hp)}` : '已战死', cx + genSlotW / 2, cy + 71);

      App.UI.drawBar(ctx, cx + 6, cy + 77, barW, 5, u.rage / 100, '#facc15', '#1c1917');
      ctx.fillStyle = ready ? '#fef08a' : '#e2e8f0';
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      const isFullUlt = !!(u.cfg && u.cfg.isFullscreenSkill);
      const btnTxt = isAiming
        ? '选目标中'
        : (ready ? (isFullUlt ? '全屏大招!' : (u.needsManualAim ? '选点大招!' : '释放绝技!')) : u.name);
      ctx.fillText(btnTxt, cx + genSlotW / 2, cy + 97, genSlotW - 8);
      ctx.restore();

      if (ready) {
        App.UI.addHit(cx, cy, genSlotW, 106, () => App.BattleEngine.triggerPlayerGeneralSkill(battle, u));
      }
    }

    // ★ 兵营出兵面板：世界/联盟 BOSS 无小兵模式下不展示小兵卡槽！
    if (!noTroops) {
      App.UI.drawPanel(ctx, 386, 426, 358, 106, { r: 8, bg: '#d9be86', border: '#854d0e', lineWidth: 1.5 });
      ctx.save();
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('兵营出兵（仅出战武将对应兵种可派兵 · 武将战死停止派兵）', 394, 440, 342);
      ctx.restore();

      const troopEntries = App.BattleEngine.getDeployedTroopEntries
        ? App.BattleEngine.getDeployedTroopEntries(battle)
        : App.BattleEngine.TROOP_CARDS.map((card, cardIdx) => ({ card, cardIdx, cmd: { deployed: true, aliveCount: 1, totalCount: 1, aliveGenerals: [] } }));
      const nCards = troopEntries.length;
      const tw = nCards >= 5 ? 66 : (nCards === 4 ? 76 : 78);
      const th = 83;
      const tGap = nCards >= 5 ? 3 : (nCards === 4 ? 8 : 10);
      const totalTroopW = nCards * tw + Math.max(0, nCards - 1) * tGap;
      const startTroopX = 386 + Math.round((358 - totalTroopW) / 2);

      troopEntries.forEach((entry, posIdx) => {
        const c = entry.card;
        const idx = entry.cardIdx;
        const cmd = entry.cmd;
        const cmdDead = cmd.aliveCount <= 0;
        const tx = startTroopX + posIdx * (tw + tGap);
        const ty = 444;
        const isAuto = !cmdDead && !!(battle.autoTroops && battle.autoTroops[idx]);
        const canAfford = battle.wood >= c.wood && battle.food >= c.food;
        const can = !cmdDead && canAfford && battle.status === 'fighting';

        ctx.save();
        const cg = ctx.createLinearGradient(tx, ty, tx, ty + th);
        if (cmdDead) {
          cg.addColorStop(0, '#2b1f1d');
          cg.addColorStop(1, '#171211');
        } else if (isAuto) {
          cg.addColorStop(0, '#14532d');
          cg.addColorStop(0.55, '#0f3d21');
          cg.addColorStop(1, '#092614');
        } else if (can) {
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
        ctx.strokeStyle = cmdDead ? '#7f1d1d' : (isAuto ? '#4ade80' : (can ? '#fde047' : '#a8a29e'));
        ctx.lineWidth = isAuto ? 2.2 : (can ? 1.6 : 1.1);
        ctx.stroke();

        // 顶部兵种小图内衬底框 + 光晕
        App.UI.roundRect(ctx, tx + 4, ty + 4, tw - 8, 43, 6);
        ctx.fillStyle = cmdDead
          ? 'rgba(12, 8, 8, 0.58)'
          : (isAuto ? 'rgba(6, 28, 14, 0.55)' : (can ? 'rgba(20, 9, 4, 0.48)' : 'rgba(20, 20, 20, 0.35)'));
        ctx.fill();

        if (!cmdDead) {
          const halo = ctx.createRadialGradient(tx + tw / 2, ty + 25, 2, tx + tw / 2, ty + 25, 21);
          halo.addColorStop(0, isAuto ? 'rgba(74, 222, 128, 0.44)' : (can ? (c.isMagic ? 'rgba(192,132,252,0.38)' : 'rgba(251,191,36,0.30)') : 'rgba(255,255,255,0.08)'));
          halo.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(tx + tw / 2, ty + 25, 21, 0, Math.PI * 2);
          ctx.fill();
        }

        // 绘制高清手绘兵种精灵小图片（自适应宽高比居中展示）
        const cardSprKey = (App.Sprites && App.Sprites.resolveTroopSpriteKey)
          ? App.Sprites.resolveTroopSpriteKey(c.id, c.spriteKey, 'player')
          : c.spriteKey;
        const spr = App.Assets.get(cardSprKey) || App.Assets.get(c.spriteKey);
        if (spr) {
          if (cmdDead) ctx.globalAlpha = 0.24;
          else if (!can && !isAuto) ctx.globalAlpha = 0.55;
          const maxW = 44, maxH = 40;
          const sw = spr.naturalWidth || spr.width || 64;
          const sh = spr.naturalHeight || spr.height || 64;
          const sc = Math.min(maxW / sw, maxH / sh);
          const dw = sw * sc, dh = sh * sc;
          ctx.drawImage(spr, tx + (tw - dw) / 2, ty + 5 + (40 - dh) / 2, dw, dh);
          ctx.globalAlpha = 1;
        }

        if (cmdDead) {
          // 统率该兵种的出战武将已全部战死：醒目封禁角标
          const dwBadge = tw - 12, dhBadge = 16;
          const dbx = tx + 6, dby = ty + 17;
          App.UI.roundRect(ctx, dbx, dby, dwBadge, dhBadge, 5);
          ctx.fillStyle = 'rgba(127, 29, 29, 0.92)';
          ctx.fill();
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 0.9;
          ctx.stroke();
          ctx.fillStyle = '#fecaca';
          ctx.font = 'bold 9px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('武将战死', dbx + dwBadge / 2, dby + dhBadge / 2 + 0.5);
          ctx.textBaseline = 'alphabetic';
        } else {
          // 左上角统率武将微标（多将同兵种时显示在阵人数）
          const leadTxt = cmd.totalCount > 1
            ? `${cmd.aliveCount}/${cmd.totalCount}将`
            : ((cmd.aliveGenerals && cmd.aliveGenerals[0]) ? cmd.aliveGenerals[0].name.slice(0, 2) : '');
          if (leadTxt && !isAuto) {
            ctx.fillStyle = 'rgba(28, 16, 8, 0.82)';
            App.UI.roundRect(ctx, tx + 3, ty + 3, 28, 12, 4);
            ctx.fill();
            ctx.fillStyle = '#fde68a';
            ctx.font = 'bold 8px "PingFang SC", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(leadTxt, tx + 17, ty + 9.5);
            ctx.textBaseline = 'alphabetic';
          }
        }

        // ★ 持续自动派兵状态角标与流光蓄力细条（直观区分「派兵中 / 待粮木 / 未开启」）
        if (isAuto) {
          const badgeW = 36, badgeH = 13;
          const bx = tx + tw - badgeW - 3, by = ty + 3;
          App.UI.roundRect(ctx, bx, by, badgeW, badgeH, 5);
          ctx.fillStyle = canAfford ? 'rgba(22, 163, 74, 0.94)' : 'rgba(180, 83, 9, 0.94)';
          ctx.fill();
          ctx.strokeStyle = canAfford ? '#bbf7d0' : '#fde68a';
          ctx.lineWidth = 0.9;
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(canAfford ? '派兵中' : '待粮木', bx + badgeW / 2, by + badgeH / 2 + 0.5);
          ctx.textBaseline = 'alphabetic';

          // 内嵌出兵节奏进度细条
          const interval = battle.autoTroopInterval || 1.15;
          const pRatio = canAfford ? Math.max(0.08, Math.min(1, 1 - (battle.autoTroopTimer || 0) / interval)) : 0.25;
          App.UI.drawBar(ctx, tx + 6, ty + 44, tw - 12, 3, pRatio, canAfford ? '#4ade80' : '#fbbf24', 'rgba(0,0,0,0.55)');
        }

        // 兵种名称
        ctx.fillStyle = cmdDead ? '#78716c' : (isAuto ? '#86efac' : (can ? '#fef08a' : '#d6d3d1'));
        ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(c.name, tx + tw / 2, ty + 60, tw - 6);

        // 底部木材与粮草小图标消耗胶囊（统将阵亡后显示「停止派兵」）
        App.UI.roundRect(ctx, tx + 3, ty + 65, tw - 6, 15, 5);
        ctx.fillStyle = cmdDead ? 'rgba(69, 10, 10, 0.55)' : 'rgba(0, 0, 0, 0.42)';
        ctx.fill();

        if (cmdDead) {
          ctx.fillStyle = '#fca5a5';
          ctx.font = 'bold 9px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('停止派兵', tx + tw / 2, ty + 75.5);
        } else {
          const resOffX = Math.max(0, Math.floor((tw - 66) / 2));
          App.UI.drawMiniIcon(ctx, 'res_wood', tx + 5 + resOffX, ty + 67, 11);
          ctx.fillStyle = battle.wood >= c.wood ? '#fde68a' : '#fca5a5';
          ctx.font = 'bold 9.5px sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(String(c.wood), tx + 17 + resOffX, ty + 76);

          App.UI.drawMiniIcon(ctx, 'res_stamina', tx + 34 + resOffX, ty + 67, 11);
          ctx.fillStyle = battle.food >= c.food ? '#bbf7d0' : '#fca5a5';
          ctx.fillText(String(c.food), tx + 46 + resOffX, ty + 76);
        }
        ctx.restore();

        if (battle.status === 'fighting') {
          App.UI.addHit(tx, ty, tw, th, () => App.BattleEngine.toggleAutoTroop(battle, idx));
        }
      });
    }

    const mmX = noTroops ? 496 : 754, mmY = 426, mmW = noTroops ? 448 : 194, mmH = 106;
    App.UI.drawPanel(ctx, mmX, mmY, mmW, mmH, { r: 8, bg: '#b08d57', border: '#6b3417', lineWidth: 2 });
    // 小地图展示双方上下双箭垒（方标）与主营基地（金边大营标）
    battle.towers.forEach((tw) => {
      if (!tw.alive) return;
      const mx = mmX + (tw.x / battle.worldW) * mmW;
      const my = mmY + ((tw.y - 180) / 220) * mmH;
      ctx.fillStyle = tw.side === 'player' ? '#16a34a' : '#b91c1c';
      ctx.fillRect(mx - 3, my - 3, 6, 6);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 0.9;
      ctx.strokeRect(mx - 3, my - 3, 6, 6);
    });
    battle.units.forEach((u) => {
      if (!u.alive) return;
      const mx = mmX + (u.x / battle.worldW) * mmW;
      const my = mmY + ((u.y - 180) / 220) * mmH;
      if (u.isMainBase || u.isBase) {
        ctx.fillStyle = u.side === 'player' ? '#22c55e' : '#ef4444';
        ctx.fillRect(mx - 4.5, my - 4.5, 9, 9);
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(mx - 4.5, my - 4.5, 9, 9);
        return;
      }
      ctx.fillStyle = u.side === 'player' ? (u.kind === 'beast' ? '#38bdf8' : '#2563eb') : '#dc2626';
      ctx.beginPath(); ctx.arc(mx, my, u.kind === 'soldier' ? 2.5 : 4.2, 0, Math.PI * 2); ctx.fill();
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

      const hasBannerPort = !!(b.portraitId || b.beastPortraitId);
      const portX = -90 + slide * 250;
      if (b.portraitId) {
        App.Portraits.drawGeneralPortrait(ctx, b.portraitId, portX, 54, 84, { radius: 12, border: b.color, lineWidth: 3 });
      } else if (b.beastPortraitId) {
        App.Portraits.drawBeastPortrait(ctx, b.beastPortraitId, portX, 54, 84, { radius: 12, border: b.color, lineWidth: 3 });
      }

      ctx.fillStyle = b.color;
      ctx.font = 'bold 21px "PingFang SC", serif';
      ctx.textAlign = hasBannerPort ? 'left' : 'center';
      ctx.fillText(b.title, hasBannerPort ? 265 : W / 2, 91, hasBannerPort ? W - 285 : W - 80);
      ctx.fillStyle = '#fef3c7';
      ctx.font = '13px "PingFang SC", sans-serif';
      ctx.fillText(b.sub, hasBannerPort ? 265 : W / 2, 115, hasBannerPort ? W - 285 : W - 80);
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
        if (battle.playerArtifact) {
          const pa = battle.playerArtifact;
          const aImg = App.Assets.get(pa.imgKey);
          if (aImg) {
            ctx.save();
            App.UI.roundRect(ctx, lx + 152, 238, 26, 26, 6);
            ctx.clip();
            ctx.drawImage(aImg, lx + 152, 238, 26, 26);
            ctx.restore();
            ctx.strokeStyle = pa.color;
            ctx.lineWidth = 1.4;
            App.UI.roundRect(ctx, lx + 152, 238, 26, 26, 6);
            ctx.stroke();
          }
          ctx.fillStyle = pa.subColor;
          ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
          ctx.fillText(`镇军法宝 · ${pa.name} Lv.${pa.lv}`, lx + (aImg ? 184 : 152), 256);
        }
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
        if (battle.enemyArtifact) {
          ctx.fillStyle = battle.enemyArtifact.subColor;
          ctx.font = 'bold 12px "PingFang SC", sans-serif';
          ctx.fillText(`敌方法宝 · ${battle.enemyArtifact.name} Lv.${battle.enemyArtifact.lv}`, rx - 14, 252);
        }
      }
      ctx.restore();
    }

    const settingsOpen = !!(App.Scenes.settings && App.Scenes.settings.isBattleModalOpen && App.Scenes.settings.isBattleModalOpen());
    const adOpen = !!(App.Platform.adOverlay && App.Platform.adOverlay.active);
    if (battle.status === 'fighting' && battle.userPaused && !battle.retreatConfirmOpen && !settingsOpen && !adOpen) {
      drawPauseOverlay(ctx);
    }
    if (battle.status === 'fighting' && battle.retreatConfirmOpen) {
      drawRetreatConfirmModal(ctx);
    }
    if (battle.status !== 'fighting') drawResultModal(ctx, st, time || 0);
    if (App.Scenes.settings && App.Scenes.settings.drawBattleModal) {
      App.Scenes.settings.drawBattleModal(ctx);
    }
  }

  // ★ 沙场驻军暂停浮窗（半透微暗不遮视野，支持左右滑屏观察敌阵，一键继续作战或鸣金撤退）
  function drawPauseOverlay(ctx) {
    const W = App.Platform.LOGICAL_W;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 2, 0.30)';
    ctx.fillRect(0, 48, W, 370);
    ctx.restore();

    const pw = 368, ph = 136;
    const px = Math.round((W - pw) / 2);
    const py = 150;

    // 仅拦截卡片自身区域点击，保留沙场空白处左右拖拽与小地图点按
    App.UI.addHit(px, py, pw, ph, () => {}, { silent: true });

    ctx.save();
    App.UI.roundRect(ctx, px - 3, py + 5, pw + 6, ph + 4, 15);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fill();

    const bg = ctx.createLinearGradient(px, py, px, py + ph);
    bg.addColorStop(0, '#361a0c');
    bg.addColorStop(0.55, '#221007');
    bg.addColorStop(1, '#140904');
    App.UI.roundRect(ctx, px, py, pw, ph, 13);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.strokeStyle = '#e5b869';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    App.UI.roundRect(ctx, px + 5, py + 5, pw - 10, ph - 10, 9);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 顶部居中鎏金牌匾
    const bw = 196, bh = 34;
    const bx = Math.round(W / 2 - bw / 2), by = py - Math.round(bh / 2);
    const hg = ctx.createLinearGradient(bx, by, bx, by + bh);
    hg.addColorStop(0, '#92400e');
    hg.addColorStop(1, '#451a03');
    App.UI.roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", "STKaiti", serif';
    ctx.fillText('⚔ 战 局 已 暂 停 ⚔', W / 2, by + bh / 2 + 0.5);

    ctx.fillStyle = '#e7cfa8';
    ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText('三军驻马待命 · 可左右滑动沙场观察敌我态势', W / 2, py + 47);
    ctx.restore();

    App.UI.drawButton(ctx, px + 24, py + 76, 148, 40, '鸣金撤退', {
      r: 9, grad: ['#7f1d1d', '#450a0a'], border: '#fca5a5', fontSize: 13, color: '#fecaca',
    }, () => {
      battle.retreatConfirmOpen = true;
      syncBattlePause(battle);
    });

    App.UI.drawButton(ctx, px + pw - 24 - 156, py + 76, 156, 40, '继续作战', {
      r: 9, icon: 'play', grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13.5,
    }, () => {
      battle.userPaused = false;
      syncBattlePause(battle);
    });
  }

  // ★ 鸣金撤退二次确认弹窗（防止激烈点兵操作时误触右上角撤退直接判负！）
  function drawRetreatConfirmModal(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;

    // 拦截底层点击穿透
    App.UI.addHit(0, 0, W, H, () => {}, { silent: true });

    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 2, 0.74)';
    ctx.fillRect(0, 0, W, H);

    const mw = 452, mh = 218;
    const mx = Math.round((W - mw) / 2);
    const my = Math.round((H - mh) / 2 + 6);

    App.UI.roundRect(ctx, mx - 4, my + 6, mw + 8, mh + 6, 16);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.fill();

    const bodyGrad = ctx.createLinearGradient(mx, my, mx, my + mh);
    bodyGrad.addColorStop(0, '#33190c');
    bodyGrad.addColorStop(0.52, '#200f07');
    bodyGrad.addColorStop(1, '#130804');
    App.UI.roundRect(ctx, mx, my, mw, mh, 14);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = '#e5b869';
    ctx.lineWidth = 2.4;
    ctx.stroke();

    App.UI.roundRect(ctx, mx + 6, my + 6, mw - 12, mh - 12, 10);
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.28)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // 四角鎏金护角纹饰
    const cLen = 12;
    ctx.strokeStyle = '#e2b159';
    ctx.lineWidth = 2;
    [
      [mx + 10, my + 10, 1, 1],
      [mx + mw - 10, my + 10, -1, 1],
      [mx + 10, my + mh - 10, 1, -1],
      [mx + mw - 10, my + mh - 10, -1, -1],
    ].forEach(([cx, cy, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * cLen);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * cLen, cy);
      ctx.stroke();
    });

    // 顶部居中朱红牌匾
    const bw = 212, bh = 38;
    const bx = Math.round(W / 2 - bw / 2), by = my - Math.round(bh / 2);
    const headGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    headGrad.addColorStop(0, '#991b1b');
    headGrad.addColorStop(1, '#450a0a');
    App.UI.roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 17.5px "PingFang SC", "STKaiti", serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText('⚔ 确 认 撤 退 ⚔', W / 2 + 1, by + bh / 2 + 2);
    ctx.fillStyle = '#fef08a';
    ctx.fillText('⚔ 确 认 撤 退 ⚔', W / 2, by + bh / 2 + 0.5);

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 15px "PingFang SC", sans-serif';
    ctx.fillText('主公确定要鸣金收兵、撤离当前战场吗？', W / 2, my + 54);

    // 模式感知结算规则提示胶囊
    const hasSta = !!(battle.level && battle.level.staminaCost > 0);
    let subTip = '撤退将立即结束本局对战，当前战场进度不会保留';
    let subCol = '#fde68a';
    if (battle.mode === 'arena') {
      if (battle.arenaMatch && battle.arenaMatch.spar) {
        subTip = '✓ 好友切磋中途撤退不扣挑战令，亦不影响天梯战绩与名次';
        subCol = '#86efac';
      } else {
        subTip = '⚠ 演武场中途撤退将直接判负，且不返还演武挑战令';
        subCol = '#fca5a5';
      }
    } else if (battle.level && battle.level.raid) {
      subTip = '⚠ 撤退将放弃本场讨伐伤害，已消耗的讨伐次数不返还';
      subCol = '#fca5a5';
    } else if (battle.mode === 'demon' || battle.special) {
      subTip = `⚠ 撤退将放弃本场进度，今日已扣挑战次数不返还${hasSta ? '（返一半粮草）' : ''}`;
      subCol = '#fde68a';
    } else if (hasSta) {
      subTip = '✓ 撤退将结束本局对战，并自动返还一半出征粮草';
      subCol = '#86efac';
    }

    const tipX = mx + 26, tipY = my + 82, tipW = mw - 52, tipH = 42;
    App.UI.roundRect(ctx, tipX, tipY, tipW, tipH, 9);
    ctx.fillStyle = 'rgba(18, 9, 4, 0.68)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(212, 163, 75, 0.38)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = subCol;
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(subTip, W / 2, tipY + tipH / 2 + 0.5, tipW - 20);
    ctx.restore();

    const btnY = my + mh - 62;
    App.UI.drawButton(ctx, mx + 34, btnY, 178, 42, '取 消', {
      r: 9, grad: ['#523620', '#2e1c0f'], border: '#c29042', fontSize: 14, color: '#f5e6cc',
    }, () => {
      battle.retreatConfirmOpen = false;
      syncBattlePause(battle);
    });

    App.UI.drawButton(ctx, mx + mw - 34 - 178, btnY, 178, 42, '确定撤退', {
      r: 9, grad: ['#dc2626', '#991b1b'], border: '#fca5a5', fontSize: 14, color: '#fffbeb',
    }, () => {
      battle.retreatConfirmOpen = false;
      battle.userPaused = false;
      syncBattlePause(battle);
      if (battle.status === 'fighting' && battle.serverId && !battle.settling && !battle.settled) {
        battle.settling = true;
        App.State.finishBattle(battle.serverId, false);
      }
      App.Main.goScene(backOf(battle));
    });
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

    // 紧凑精确计算高度：胜负统一采用国风玄金檀木双层雕花边框！
    const mw = win ? 564 : 536;
    const mh = win ? (hasCaptive ? (topPad + 292) : (topPad + 156)) : 282;
    const mx = Math.round((W - mw) / 2);
    const my = Math.round((H - mh) / 2 + 8);

    // 2. 双层雕花边框（零高斯模糊分层投影，确保凯旋金芒 60fps 满帧流畅）
    ctx.save();
    App.UI.roundRect(ctx, mx - 4, my + 6, mw + 8, mh + 6, 16);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
    ctx.fill();
    const bodyGrad = ctx.createLinearGradient(mx, my, mx, my + mh);
    if (win) {
      bodyGrad.addColorStop(0, '#361a0c');
      bodyGrad.addColorStop(0.5, '#251107');
      bodyGrad.addColorStop(1, '#1a0b04');
    } else {
      bodyGrad.addColorStop(0, '#2b160b');
      bodyGrad.addColorStop(0.52, '#1b0d06');
      bodyGrad.addColorStop(1, '#110804');
    }
    App.UI.roundRect(ctx, mx, my, mw, mh, 14);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    ctx.strokeStyle = win ? '#facc15' : '#d4a34b';
    ctx.lineWidth = 2.6;
    ctx.stroke();

    App.UI.roundRect(ctx, mx + 6, my + 6, mw - 12, mh - 12, 10);
    ctx.strokeStyle = win ? 'rgba(250, 204, 21, 0.35)' : 'rgba(212, 163, 75, 0.28)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // 古典四角鎏金护角纹饰
    const cLen = 14;
    ctx.strokeStyle = win ? '#fde047' : '#e2b159';
    ctx.lineWidth = 2.2;
    [
      [mx + 10, my + 10, 1, 1],
      [mx + mw - 10, my + 10, -1, 1],
      [mx + 10, my + mh - 10, 1, -1],
      [mx + mw - 10, my + mh - 10, -1, -1],
    ].forEach(([cx, cy, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * cLen);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * cLen, cy);
      ctx.stroke();
    });

    // 顶部居中牌匾横幅
    const bw = win ? 264 : 252, bh = win ? 42 : 40;
    const bx = W / 2 - bw / 2, by = my - Math.round(bh / 2);
    const headGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    if (win) {
      headGrad.addColorStop(0, '#dc2626');
      headGrad.addColorStop(1, '#7f1d1d');
    } else {
      headGrad.addColorStop(0, '#6b2414');
      headGrad.addColorStop(1, '#361008');
    }
    App.UI.roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = headGrad;
    ctx.fill();
    ctx.strokeStyle = win ? '#fde047' : '#e5b869';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${win ? 20 : 18}px "PingFang SC", "STKaiti", serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText(win ? '★ 凯 旋 大 捷 ★' : '⚔ 鸣 金 整 军 ⚔', W / 2 + 1, by + bh / 2 + 2.5);
    ctx.fillStyle = win ? '#fef08a' : '#fde68a';
    ctx.fillText(win ? '★ 凯 旋 大 捷 ★' : '⚔ 鸣 金 整 军 ⚔', W / 2, by + bh / 2 + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();

    const backScene = backOf(battle);
    const settling = !battle.settled;

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

      // 3. 紧凑横排 4 格战利品卡（好友切磋模式下展示切磋胜出横幅，不显示 0 收益战利品）
      const isSpar = !!(battle.mode === 'arena' && battle.arenaMatch && battle.arenaMatch.spar);
      const ch = 86;
      const cardY = my + topPad;
      if (isSpar) {
        const sbW = mw - 48, sbX = mx + 24;
        App.UI.drawPanel(ctx, sbX, cardY, sbW, ch, {
          r: 10, bg: 'rgba(18, 9, 4, 0.78)', border: '#d4a34b', lineWidth: 1.6,
        });
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 15px "PingFang SC", serif';
        ctx.fillText(`⚔ 切磋得胜 · 成功攻破【${battle.arenaMatch.playerName || '对方'}】防守大阵！`, W / 2, cardY + 38, sbW - 28);
        ctx.fillStyle = '#d6c7b2';
        ctx.font = '12px "PingFang SC", sans-serif';
        ctx.fillText('好友切磋演武不消耗挑战令，亦不结算铜钱将魂与天梯名次', W / 2, cardY + 64, sbW - 28);
        ctx.restore();
      } else {
        const eqTpl = battle.droppedEquip ? App.Config.EQUIP_TEMPLATES[battle.droppedEquip.tplId] : null;
        const eqQual = eqTpl ? App.Config.QUALITIES[eqTpl.quality] : null;
        const lootCards = [
          { type: 'item', key: 'exp_scroll', title: `经验 +${battle.expGain}`, sub: `主公 Lv.${st.lordLevel}`, border: '#38bdf8', col: '#bae6fd' },
          { type: 'mini', key: 'res_gold', title: `铜钱 +${battle.goldReward}`, sub: '战利军饷', border: '#facc15', col: '#fde047' },
          { type: 'mini', key: 'res_soul', title: `将魂 +${battle.soulReward}`, sub: '升星精魄', border: '#c084fc', col: '#f5d0fe' },
        ];
        if (eqTpl) {
          lootCards.push({
            type: 'equip', key: eqTpl.id, title: eqTpl.name.slice(0, 6),
            sub: `${eqQual.name}·已入库`, border: eqQual.color, col: '#fef08a',
          });
        }
        if (battle.droppedMat && battle.droppedMat.id) {
          const mCfg = App.Config.ITEMS[battle.droppedMat.id] || { name: battle.droppedMat.name || '法宝灵材', quality: 'purple' };
          const mQual = App.Config.QUALITIES[mCfg.quality] || { color: '#f43f5e' };
          lootCards.push({
            type: 'item', key: battle.droppedMat.id,
            title: `${String(mCfg.name).slice(0, 5)}×${battle.droppedMat.count || 1}`,
            sub: '法宝灵材·入库!', border: mQual.color || '#f43f5e', col: '#fda4af',
          });
        }

        const cw = lootCards.length >= 5 ? 97 : 121, cGap = lootCards.length >= 5 ? 8 : 13;
        const totalCW = lootCards.length * cw + (lootCards.length - 1) * cGap;
        let startCX = W / 2 - totalCW / 2;

        lootCards.forEach((lc) => {
          App.UI.drawPanel(ctx, startCX, cardY, cw, ch, {
            r: 9, bg: 'rgba(18, 9, 4, 0.78)', border: lc.border, lineWidth: 1.6,
          });
          if (lc.type === 'equip' || lc.type === 'item') {
            App.Sprites.drawEquipIcon(ctx, lc.key, startCX + (cw - 40) / 2, cardY + 7, 40, { radius: 7, border: lc.border, lineWidth: 1.6 });
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
      }

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
        const capTroop = App.Config.getGeneralTroopMeta ? App.Config.getGeneralTroopMeta(gid).name : g.title.slice(0, 4);
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${g.rarity}·${capTroop}`, boxX + 57, boxY + 114);

        ctx.textAlign = 'left';
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 15px "PingFang SC", serif';
        ctx.fillText(`帐下生擒：${g.name}  (绝技：${g.skillName})`, boxX + 116, boxY + 31);

        const pityPct = Math.round((st.recruitPity[gid] || 0) * 100);
        const stepPct = Math.max(1, Math.round((((App.Config.PARAMS && App.Config.PARAMS.recruitPityStep) != null ? App.Config.PARAMS.recruitPityStep : 0.05) * 100)));
        const dupSoul = (App.Config.PARAMS && App.Config.PARAMS.duplicateGeneralSoul) || 45;
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
            subText: `失败自动 +${stepPct}% 保底率`, loading: settling, disabled: settling,
          }, () => {
            App.BattleEngine.postVictoryRecruit(battle, false).then((res) => {
              if (res.ok) App.UI.showToast(res.success ? `招降大喜！【${g.name}】归顺麾下！` : `暂未松口，${g.name} 赏识度 +${stepPct}%！`, res.success ? '#4ade80' : '#fbbf24');
            });
          });

          App.UI.drawAdButton(ctx, boxX + 318, boxY + 64, 190, 50, `三顾茅庐 (${dblChance}%)`, {
            r: 9, fontSize: 13,
            subText: '双倍高几率直招', loading: settling, disabled: settling,
          }, () => {
            App.Platform.showRewardedAd('recruit_retry', `施展【三顾茅庐】，以 ${dblChance}% 双倍高几率招降 ${g.name}！`, () => {
              App.BattleEngine.postVictoryRecruit(battle, true).then((res) => {
                if (res.ok) App.UI.showToast(res.success ? `三顾茅庐成功！【${g.name}】入营！` : `傲骨铮铮，赏识度再 +${stepPct}%！`, res.success ? '#4ade80' : '#fde047');
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
            battle.recruitDuplicate ? `✓ 已拥有【${g.name}】，自动转化为 +${dupSoul} 将魂！` : `招降成功！名将【${g.name}】已加入名将营！`,
            boxX + 312, boxY + 95
          );
          ctx.restore();
        } else if (battle.recruitState === 'exhausted') {
          ctx.save();
          ctx.fillStyle = 'rgba(120, 53, 15, 0.35)';
          App.UI.roundRect(ctx, boxX + 116, boxY + 68, 392, 44, 9);
          ctx.fill();
          ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.4; ctx.stroke();
          ctx.fillStyle = '#fde68a';
          ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`傲骨铮铮暂未归顺，累计保底率(+${pityPct}%)已永久保留，再战可招！`, boxX + 312, boxY + 94, 380);
          ctx.restore();
        } else {
          App.UI.drawAdButton(ctx, boxX + 116, boxY + 64, 392, 50, `【三顾茅庐】以 ${dblChance}% 双倍几率再次招降！`, {
            r: 9, fontSize: 13,
            subText: `刚烈未降，赏识保底已增加 +${stepPct}%`,
          }, () => {
            App.Platform.showRewardedAd('recruit_retry', `施展【三顾茅庐】，以 ${dblChance}% 几率再次招降 ${g.name}！`, () => {
              App.BattleEngine.postVictoryRecruit(battle, true).then((res) => {
                if (res.ok) App.UI.showToast(res.success ? `三顾茅庐成功！${g.name} 归顺！` : `仍未松口，保底再 +${stepPct}%！`, res.success ? '#4ade80' : '#fde047');
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
          battle.catchState === 'exhausted'
            ? '圣兽震碎灵索化光遁去，重整旗鼓再次讨伐即可收服！'
            : (battle.catchState === 'failed' ? '神兽已震断普通索！仅限黄金缚兽索再次收服：' : `抛出缚兽索缔结契约（普通索 ${r1}% / 黄金索 ${r2}%）：`),
          boxX + 122, boxY + 52
        );
        ctx.restore();

        if (battle.catchState === 'success') {
          ctx.save();
          ctx.fillStyle = '#4ade80';
          ctx.font = 'bold 14.5px "PingFang SC", sans-serif';
          ctx.fillText(`契约礼成！【${bCfg.name}】已收入四象兽栏！`, boxX + 122, boxY + 94);
          ctx.restore();
        } else if (battle.catchState === 'exhausted') {
          ctx.save();
          ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
          App.UI.roundRect(ctx, boxX + 122, boxY + 68, 386, 44, 9);
          ctx.fill();
          ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.4; ctx.stroke();
          ctx.fillStyle = '#cbd5e1';
          ctx.font = 'bold 13px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('本场收服次数已尽，圣兽已遁归秘境深处', boxX + 315, boxY + 94);
          ctx.restore();
        } else {
          const normalUsed = battle.catchState === 'failed';
          App.UI.drawButton(ctx, boxX + 122, boxY + 64, 188, 50, normalUsed ? '普通索已震断' : `普通缚兽索 (${r1}%)`, {
            r: 9, grad: ['#0284c7', '#0369a1'], border: '#bae6fd', fontSize: 12.5,
            subText: normalUsed ? '请改用右侧黄金索' : `库存 ${st.ropes} 根`,
            loading: settling, disabled: settling || normalUsed || st.ropes <= 0,
          }, () => {
            App.BattleEngine.postVictoryCatchBeast(battle, false).then((res) => {
              if (res.ok) App.UI.showToast(res.success ? `收服【${bCfg.name}】！` : `神兽挣脱了缚兽索！可用黄金索再试一次`, res.success ? '#4ade80' : '#f87171');
            });
          });

          if (st.goldRopes > 0) {
            App.UI.drawButton(ctx, boxX + 320, boxY + 64, 188, 50, `黄金缚兽索 (${r2}%)`, {
              r: 9, grad: ['#d97706', '#b45309'], border: '#fef08a', fontSize: 12.5,
              subText: `双倍高率 · 剩 ${st.goldRopes} 根`, loading: settling, disabled: settling,
            }, () => {
              App.BattleEngine.postVictoryCatchBeast(battle, true).then((res) => {
                if (res.ok) App.UI.showToast(res.success ? `金索锁魂！收服【${bCfg.name}】！` : `圣兽震碎金索遁去！`, res.success ? '#4ade80' : '#f87171');
              });
            });
          } else {
            App.UI.drawAdButton(ctx, boxX + 320, boxY + 64, 188, 50, `免费领黄金索`, {
              r: 9, fontSize: 12.5,
              subText: `成功率提升至 ${r2}%`, loading: settling, disabled: settling,
            }, () => {
              App.Platform.showRewardedAd('golden_rope', '免费领取 1 根【黄金缚兽索】（双倍抓捕率）！', () => {
                App.State.claimAd('golden_rope');
              });
            });
          }
        }
      }

      // 5. 紧贴底部的快捷操作栏（支持主线关卡直接【再次征战】本关或推进【下一关 ▶】）
      const btnY = hasCaptive ? (boxY + boxH + 12) : (cardY + ch + 14);
      const isCity = battle.mode === 'city' && !!battle.level;
      const isCityNext = isCity && battle.level.order < App.Config.TOTAL_STAGES;
      const curCityCost = isCity ? App.State.getStaminaCost(battle.level.staminaCost) : 5;
      const adStaGain = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('stamina', 'stamina') : 20;

      const onReplayCity = () => {
        if (!isCity) return;
        const curLv = App.Config.buildStage ? App.Config.buildStage(battle.level.order) : battle.level;
        if (st.stamina < App.State.getStaminaCost(curLv.staminaCost)) {
          App.Platform.showRewardedAd('stamina', `粮草不足！观看激励视频立即恢复 +${adStaGain} 粮草并再次征战本关！`, () => {
            App.State.claimAd('stamina').then((res) => { if (res && res.ok) App.Main.startBattle('city', curLv.order, { level: curLv }); });
          });
          return;
        }
        App.Main.startBattle('city', curLv.order, { level: curLv });
      };

      const onBackToMap = () => {
        App.Main.goScene('map', isCity ? { selectOrder: battle.level.order } : undefined);
      };

      const onNextClick = () => {
        if (isCityNext) {
          const nextLv = App.Config.buildStage(battle.level.order + 1);
          if (st.stamina < App.State.getStaminaCost(nextLv.staminaCost)) {
            App.Platform.showRewardedAd('stamina', `粮草不足！观看激励视频立即恢复 +${adStaGain} 粮草并进军下一关！`, () => {
              App.State.claimAd('stamina').then((res) => { if (res && res.ok) App.Main.startBattle('city', nextLv.order, { level: nextLv }); });
            });
            return;
          }
          App.Main.startBattle('city', nextLv.order, { level: nextLv });
        } else {
          App.Main.goScene(backScene);
        }
      };

      if (isCity) {
        if (!battle.doubleAdUsed) {
          App.UI.drawAdButton(ctx, mx + 18, btnY, 126, 42, '双倍军饷', {
            r: 9, fontSize: 12,
            subText: `+${battle.goldReward}钱+${battle.soulReward}魂`,
            loading: settling, disabled: settling,
          }, () => {
            App.Platform.showRewardedAd('double_reward', '观看激励视频，额外再领一份铜钱与将魂！', () => {
              App.State.doubleReward(battle.serverId).then((res) => { if (res.ok) battle.doubleAdUsed = true; });
            });
          });

          App.UI.drawButton(ctx, mx + 152, btnY, 106, 42, '返回地图', {
            r: 9, grad: ['#475569', '#334155'], border: '#cbd5e1', fontSize: 12.5,
          }, onBackToMap);

          App.UI.drawButton(ctx, mx + 266, btnY, 132, 42, '再次征战', {
            r: 9, grad: ['#78350f', '#451a03'], border: '#fde68a', fontSize: 13,
            subText: `耗${curCityCost}粮重战本关`,
            loading: settling, disabled: settling,
          }, onReplayCity);

          App.UI.drawButton(ctx, mx + 406, btnY, 140, 42, isCityNext ? '下一关 ▶' : '凯旋归营 ▶', {
            r: 9, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 13.5,
            subText: isCityNext ? `耗${curCityCost}粮草直战` : undefined,
            loading: settling, disabled: settling,
          }, onNextClick);
        } else {
          App.UI.drawButton(ctx, mx + 24, btnY, 124, 42, '返回地图', {
            r: 9, grad: ['#475569', '#334155'], border: '#cbd5e1', fontSize: 13,
          }, onBackToMap);

          App.UI.drawButton(ctx, mx + 158, btnY, 118, 42, '名将营', {
            r: 9, grad: ['#5c2c16', '#3b1d0e'], border: '#d4a34b', fontSize: 13,
          }, () => App.Main.goScene('roster'));

          App.UI.drawButton(ctx, mx + 286, btnY, 124, 42, '再次征战', {
            r: 9, grad: ['#78350f', '#451a03'], border: '#fde68a', fontSize: 13,
            subText: `耗${curCityCost}粮重战`,
            loading: settling, disabled: settling,
          }, onReplayCity);

          App.UI.drawButton(ctx, mx + 420, btnY, 124, 42, isCityNext ? '下一关 ▶' : '凯旋归营 ▶', {
            r: 9, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 13.5,
            subText: isCityNext ? `耗${curCityCost}粮直战` : undefined,
            loading: settling, disabled: settling,
          }, onNextClick);
        }
      } else if (!battle.doubleAdUsed && !isSpar) {
        App.UI.drawAdButton(ctx, mx + 20, btnY, 136, 42, '双倍军饷', {
          r: 9, fontSize: 12.5,
          subText: `+${battle.goldReward}钱+${battle.soulReward}魂`,
          loading: settling, disabled: settling,
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

        App.UI.drawButton(ctx, mx + 412, btnY, 132, 42, '继续征战 ▶', {
          r: 9, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 14,
          loading: settling, disabled: settling,
        }, onNextClick);
      } else {
        App.UI.drawButton(ctx, mx + 34, btnY, 152, 42, '返回地图', {
          r: 9, grad: ['#475569', '#334155'], border: '#cbd5e1', fontSize: 13.5,
        }, () => App.Main.goScene('map'));

        App.UI.drawButton(ctx, mx + 198, btnY, 158, 42, '名将与装备', {
          r: 9, grad: ['#78350f', '#451a03'], border: '#d4a34b', fontSize: 13.5,
        }, () => App.Main.goScene('roster'));

        App.UI.drawButton(ctx, mx + 368, btnY, 162, 42, '继续征战 ▶', {
          r: 9, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 14,
          loading: settling, disabled: settling,
        }, onNextClick);
      }
    } else {
      // ================= 鸣金整军界面：国风玄金檀木雕花框 (536×282) =================
      // 1. 顶部护航返还提示条（暖玉鎏金胶囊，温润雅致）
      const tipBarW = mw - 48, tipBarH = 50;
      const tipBarX = mx + 24, tipBarY = my + 30;
      ctx.save();
      App.UI.roundRect(ctx, tipBarX, tipBarY, tipBarW, tipBarH, 10);
      const stripG = ctx.createLinearGradient(tipBarX, tipBarY, tipBarX + tipBarW, tipBarY);
      stripG.addColorStop(0, 'rgba(20, 83, 45, 0.24)');
      stripG.addColorStop(0.5, 'rgba(69, 26, 3, 0.56)');
      stripG.addColorStop(1, 'rgba(20, 83, 45, 0.24)');
      ctx.fillStyle = stripG;
      ctx.fill();
      ctx.strokeStyle = 'rgba(212, 163, 75, 0.42)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.textAlign = 'center';
      const hasStaminaRefund = !!(battle.level && battle.level.staminaCost > 0);
      const refundSuffix = hasStaminaRefund ? ' · 已返还一半出征粮草' : '';
      let defeatLine1 = `✓ 胜败乃兵家常事${refundSuffix || ' · 重整军备再战沙场'}`;
      let defeatCol1 = '#86efac';
      if (battle.defeatReason === 'generals_dead') {
        defeatLine1 = `⚠ 我方上阵武将全部战死，对局失败${refundSuffix}`;
        defeatCol1 = '#fca5a5';
      } else if (battle.defeatReason === 'base_lost') {
        defeatLine1 = `⚠ 我方中军主营失守，对局失败${refundSuffix}`;
        defeatCol1 = '#fca5a5';
      } else if (battle.defeatReason === 'cart_lost') {
        defeatLine1 = `⚠ 护送木牛流马被毁，对局失败${refundSuffix}`;
        defeatCol1 = '#fca5a5';
      }
      ctx.fillStyle = defeatCol1;
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(defeatLine1, W / 2, tipBarY + 21);
      ctx.fillStyle = '#d6c7b2';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText('点选下方任一军务精修兵甲防线，重整旗鼓即可破敌制胜', W / 2, tipBarY + 40);
      ctx.restore();

      // 2. 中部统一黑檀鎏金 4 格养成手绘图标卡（彻底告别杂乱五颜六色药丸按钮与重复入口！）
      const growthCards = [
        { icon: 'icon_roster', title: '名将升星', sub: '升级 · 穿戴神装', scene: 'roster' },
        { icon: 'icon_camp', title: '演武固防', sub: '主营 · 箭垒 · 兵种', scene: 'camp' },
        { icon: 'icon_forge', title: '锻器神兵', sub: '打造 · 精炼洗炼', scene: 'forge' },
        { icon: 'icon_shop', title: '军需补给', sub: '招将 · 搜罗秘宝', scene: 'shop' },
      ];
      const gcw = 113, gch = 110, gcGap = 12;
      const totalGW = growthCards.length * gcw + (growthCards.length - 1) * gcGap;
      let gcx = Math.round(W / 2 - totalGW / 2);
      const gcy = tipBarY + tipBarH + 14;

      growthCards.forEach((gc) => {
        ctx.save();
        const cg = ctx.createLinearGradient(gcx, gcy, gcx, gcy + gch);
        cg.addColorStop(0, 'rgba(54, 27, 13, 0.92)');
        cg.addColorStop(1, 'rgba(24, 11, 5, 0.95)');
        App.UI.roundRect(ctx, gcx, gcy, gcw, gch, 10);
        ctx.fillStyle = cg;
        ctx.fill();
        ctx.strokeStyle = '#c29042';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        App.UI.roundRect(ctx, gcx + 3, gcy + 3, gcw - 6, gch - 6, 8);
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 顶部暖金光晕与手绘圆章图标
        const icx = gcx + gcw / 2, icy = gcy + 35;
        const glow = ctx.createRadialGradient(icx, icy, 4, icx, icy, 26);
        glow.addColorStop(0, 'rgba(245, 158, 11, 0.32)');
        glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(icx, icy, 26, 0, Math.PI * 2);
        ctx.fill();

        const iconImg = App.Assets.get(gc.icon);
        if (iconImg) {
          ctx.drawImage(iconImg, icx - 22, icy - 22, 44, 44);
        } else {
          ctx.fillStyle = '#78350f';
          ctx.beginPath(); ctx.arc(icx, icy, 19, 0, Math.PI * 2); ctx.fill();
        }

        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
        ctx.fillText(gc.title, icx, gcy + 76);

        ctx.fillStyle = '#bca78e';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(gc.sub, icx, gcy + 93);
        ctx.restore();

        App.UI.addHit(gcx, gcy, gcw, gch, () => App.Main.goScene(gc.scene));
        gcx += gcw + gcGap;
      });

      // 3. 底部沉稳双主按钮（左：檀木古铜返回；右：朱红鎏金重整再战）
      const btnY = gcy + gch + 16;
      const canRetryCity = battle.mode === 'city' && battle.level;
      const backLabel = backScene === 'map' ? '◀ 返回征战地图' : '◀ 返回上级营帐';

      App.UI.drawButton(ctx, mx + 24, btnY, 226, 46, backLabel, {
        r: 10, grad: ['#523620', '#2e1c0f'], border: '#c29042', fontSize: 14, color: '#f5e6cc',
      }, () => App.Main.goScene(backScene, canRetryCity ? { selectOrder: battle.level.order } : undefined));

      App.UI.drawButton(ctx, mx + mw - 24 - 248, btnY, 248, 46, canRetryCity ? '重整旗鼓 · 再战 ▶' : '前往整备再战 ▶', {
        r: 10, grad: ['#dc2626', '#991b1b'], border: '#fde047', fontSize: 14.5,
        subText: canRetryCity ? `消耗 ${App.State.getStaminaCost(battle.level.staminaCost)} 粮草再次攻城` : undefined,
      }, () => {
        if (canRetryCity) {
          const needStam = App.State.getStaminaCost(battle.level.staminaCost);
          if (st.stamina < needStam) {
            App.Platform.showRewardedAd('stamina', '粮草不足！观看激励视频立即恢复 +15 粮草并重整再战！', () => {
              App.State.claimAd('stamina').then((res) => {
                if (res.ok) App.Main.startBattle('city', battle.level.order, { level: battle.level });
              });
            });
            return;
          }
          App.Main.startBattle('city', battle.level.order, { level: battle.level }).then((res) => { if (!res.ok) App.Main.goScene('map'); });
        } else if (battle.mode === 'beast' && battle.level && battle.level.id) {
          App.Main.startBattle('beast', battle.level.id, { level: battle.level }).then((res) => { if (!res.ok) App.Main.goScene(backScene); });
        } else {
          App.Main.goScene(backScene);
        }
      });
    }
  }

  function onDrag(dx) {
    if (!battle || battle.status !== 'fighting') return;
    if (battle.retreatConfirmOpen) return;
    if (App.Scenes.settings && App.Scenes.settings.isBattleModalOpen && App.Scenes.settings.isBattleModalOpen()) return;
    battle.autoCam = false;
    battle.cameraX = Math.max(0, Math.min(battle.worldW - App.Platform.LOGICAL_W, battle.cameraX - dx));
  }

  function onBattleClick(x, y) {
    if (App.Scenes.settings && App.Scenes.settings.isBattleModalOpen && App.Scenes.settings.isBattleModalOpen()) return false;
    if (!battle || battle.status !== 'fighting' || syncBattlePause(battle) || !battle.aimingUnit) return false;
    if (y >= 48 && y <= 376) {
      const worldX = x + battle.cameraX;
      const worldY = Math.max(205, Math.min(380, y));
      App.BattleEngine.executeGeneralSkillAt(battle, battle.aimingUnit, worldX, worldY);
      return true;
    }
    return false;
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.battle = { enter, leave, update, render, onDrag, onBattleClick };
})(typeof globalThis !== 'undefined' ? globalThis : window);
