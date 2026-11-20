(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let activeChapter = 1;
  let selectedOrder = 1;
  let sweepModal = null; // 扫荡战利品捷报弹窗状态

  function enter() {
    const st = App.State.get();
    const curOrder = Math.min(App.Config.TOTAL_STAGES, (st.maxClearedOrder || 0) + 1);
    activeChapter = Math.ceil(curOrder / App.Config.STAGES_PER_CHAPTER);
    selectedOrder = curOrder;
    sweepModal = null;
  }

  let showProfile = false;

  // 个人信息弹窗：名号、ID、阵营、战力等，可改名、复制 ID
  function drawProfileModal(ctx) {
    if (!showProfile) return;
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const st = App.State.get(), pf = App.State.getProfile(), fac = App.Config.FACTIONS[st.factionId] || {};
    App.UI.addHit(0, 0, W, H, () => {});
    ctx.save(); ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    const x = W / 2 - 210, y = 110, w = 420, h = 320;
    App.UI.drawPanel(ctx, x, y, w, h, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2.4 });
    App.UI.drawWoodHeader(ctx, x + 10, y + 10, w - 20, 40);
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText('主公名帖', x + w / 2, y + 30);
    ctx.fillStyle = fac.color || '#78716c'; App.UI.roundRect(ctx, x + 28, y + 68, 64, 64, 12); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px "PingFang SC", serif';
    ctx.fillText(fac.badge || '', x + 60, y + 100);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03'; ctx.font = 'bold 20px "PingFang SC", serif';
    ctx.fillText(pf.nickname || '', x + 108, y + 84);
    ctx.fillStyle = '#92400e'; ctx.font = '13px "PingFang SC", sans-serif';
    ctx.fillText(`ID：${pf.playerId || '-'}`, x + 108, y + 114);
    const rows = [['阵营', fac.name || '-'], ['主公等级', 'Lv.' + (st.lordLevel || 1)], ['军团战力', App.State.getTeamPower()], ['主线进度', '第 ' + (st.maxClearedOrder || 0) + ' 关'],
      ['名将', Object.keys(st.ownedGenerals || {}).length + ' 名'], ['神兽', Object.keys(st.ownedBeasts || {}).length + ' 只'], ['演武排名', '第 ' + (st.arenaRank || 500) + ' 名'], ['登录天数', (pf.loginDays || 1) + ' 天']];
    ctx.font = '13px "PingFang SC", sans-serif';
    rows.forEach((r, i) => {
      const rx = x + 30 + (i % 2) * 190, ry = y + 160 + Math.floor(i / 2) * 26;
      ctx.fillStyle = '#92400e'; ctx.fillText(r[0], rx, ry);
      ctx.fillStyle = '#451a03'; ctx.fillText(String(r[1]), rx + 70, ry);
    });
    ctx.restore();
    App.UI.drawButton(ctx, x + 28, y + h - 54, 112, 38, '修改名号', { r: 9, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13 }, () => {
      App.Platform.promptText('请输入新的名号（2~8 个字）', (name) => App.State.rename(name));
    });
    App.UI.drawButton(ctx, x + 154, y + h - 54, 112, 38, '复制 ID', { r: 9, grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 13 }, () => {
      App.Platform.copyText(String(pf.playerId));
      App.UI.showToast('ID 已复制：' + pf.playerId, '#93c5fd');
    });
    App.UI.drawButton(ctx, x + 280, y + h - 54, 112, 38, '关闭', { r: 9, grad: ['#475569', '#334155'], border: '#cbd5e1', fontSize: 13 }, () => { showProfile = false; });
  }

  function drawTopBar(ctx) {
    const W = App.Platform.LOGICAL_W;
    const st = App.State.get();
    const fac = App.Config.FACTIONS[st.factionId];
    App.State.syncStamina();

    App.UI.drawWoodHeader(ctx, 10, 6, W - 20, 48);

    ctx.save();
    ctx.fillStyle = fac.color;
    App.UI.roundRect(ctx, 18, 14, 32, 32, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fac.badge, 34, 30);

    const nextExp = App.State.getExpForNextLevel(st.lordLevel || 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
    const pf = App.State.getProfile();
    ctx.fillText(`${(pf.nickname || '').slice(0, 6)} Lv.${st.lordLevel || 1} (${st.lordExp || 0}/${nextExp})`, 56, 26);
    App.UI.drawBar(ctx, 56, 33, 132, 7.5, (st.lordExp || 0) / nextExp, '#38bdf8', '#1e293b');
    ctx.restore();

    // 点头像或名字查看个人信息
    App.UI.addHit(14, 8, 178, 44, () => { showProfile = true; });

    // ★ 单行一字排开全图形化胶囊栏（移除右上角两个广告大按钮，直接整合至铜钱与粮草右侧的【+】号！）
    const sec = App.State.getNextStaminaSeconds();
    const tStr = st.stamina >= App.State.STAMINA_MAX
      ? '满'
      : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const staAdLimit = ((App.Config.AD_REWARDS || {}).stamina || {}).dailyLimit || 8;
    const remainStaAds = Math.max(0, staAdLimit - ((st.adCounts || {}).stamina || 0));

    const claimGoldAd = () => {
      App.Platform.showRewardedAd('stamina', '观看激励视频，免费领取 +1500 铜钱军饷！', () => {
        App.State.claimAd('gold_top');
      });
    };

    const claimStaminaAd = () => {
      if (remainStaAds <= 0) {
        App.UI.showToast('今日广告补粮次数已用完，可使用仓库行军粮草丹！', '#fbbf24');
        return;
      }
      App.Platform.showRewardedAd('stamina', '观看激励视频，立刻恢复 +15 粮草体力！', () => {
        App.State.claimAd('stamina');
      });
    };

    const cy = 18, ch = 24;

    // 1. 铜钱胶囊（点击右侧 + 号直接看广告领 +1500 铜钱！）
    App.UI.drawResCapsule(ctx, 'res_gold', 198, cy, 112, ch, `${st.gold}`, {
      color: '#fbbf24', border: 'rgba(251, 191, 36, 0.60)', glow: 'rgba(251, 191, 36, 0.45)',
      fontSize: 11.5, plusBadge: true, plusColor: '#d97706', onPlusClick: claimGoldAd,
    }, claimGoldAd);

    // 2. 将魂胶囊
    App.UI.drawResCapsule(ctx, 'res_soul', 317, cy, 96, ch, `魂 ${st.soul}`, {
      color: '#f0abfc', border: 'rgba(232, 121, 249, 0.55)', glow: 'rgba(217, 70, 239, 0.40)', fontSize: 11.5,
    }, () => App.Main.goScene('roster'));

    // 3. 粮草体力胶囊（点击右侧 + 号直接看广告恢复 +15 粮草！）
    App.UI.drawResCapsule(ctx, 'res_stamina', 420, cy, 154, ch, `${st.stamina}/${App.State.STAMINA_MAX} (${tStr})`, {
      color: '#bbf7d0',
      border: 'rgba(74, 222, 128, 0.58)',
      glow: 'rgba(74, 222, 128, 0.38)',
      fontSize: 11,
      ratio: st.stamina / App.State.STAMINA_MAX,
      barColor: 'rgba(22, 163, 74, 0.42)',
      plusBadge: true,
      plusColor: '#16a34a',
      plusDisabled: remainStaAds <= 0,
      onPlusClick: claimStaminaAd,
    }, claimStaminaAd);

    // 4. 军团战力胶囊
    App.UI.drawResCapsule(ctx, 'res_power', 581, cy, 128, ch, `${App.State.getTeamPower()} (${st.deployIds.length}/5)`, {
      color: '#fde047', border: 'rgba(250, 204, 21, 0.52)', glow: 'rgba(249, 115, 22, 0.42)', fontSize: 11,
    }, () => App.Main.goScene('roster'));

    // 5. 缚兽索/金索胶囊
    const ropeTxt = (st.goldRopes || 0) > 0
      ? `索${st.ropes}·金${st.goldRopes}`
      : `缚索 ${st.ropes}`;
    App.UI.drawResCapsule(ctx, 'res_rope', 716, cy, 116, ch, ropeTxt, {
      color: '#7dd3fc', border: 'rgba(56, 189, 248, 0.52)', glow: 'rgba(56, 189, 248, 0.38)', fontSize: 11,
    }, () => App.Main.goScene('beastDungeon'));

    // 6. 攻城进度胶囊
    App.UI.drawResCapsule(ctx, 'res_stage', 839, cy, 101, ch, `破 ${st.maxClearedOrder || 0} 城`, {
      color: '#fed7aa', border: 'rgba(251, 146, 60, 0.52)', glow: 'rgba(239, 68, 68, 0.38)', fontSize: 11,
    }, () => App.Main.goScene('map'));
  }

  // 原底部栏已全部迁移为主地图左上角4枚小图片挂件！子页面底部仅保留清爽【◀ 返回九州征战】按钮
  function drawBottomNav(ctx, active) {
    if (!active || active === 'map') return;
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    App.UI.drawButton(ctx, W / 2 - 96, H - 52, 192, 40, '◀ 返回九州征战地图', {
      r: 20,
      grad: ['#b45309', '#78350f'],
      border: '#fef08a',
      fontSize: 13,
    }, () => App.Main.goScene('map'));
  }

  // 右上角绘制精美的游戏图形化活动/秘境图标挂件（紧凑45px，绝不遮挡下方任何城池！）
  function drawFloatingImageBadge(ctx, imgKey, x, y, label, hasRedDot, time, onClick, topTag, fallbackGlyph) {
    const spr = App.Assets.get(imgKey);
    const floatY = Math.sin(time * 3.8 + x * 0.05) * 2.0;
    const size = 45;

    ctx.save();
    const g = ctx.createRadialGradient(x + size / 2, y + size / 2 + floatY, 4, x + size / 2, y + size / 2 + floatY, 27);
    g.addColorStop(0, 'rgba(250, 204, 21, 0.52)');
    g.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2 + floatY, 27, 0, Math.PI * 2);
    ctx.fill();

    if (spr) {
      ctx.drawImage(spr, x, y + floatY, size, size);
    } else {
      ctx.fillStyle = '#b45309';
      ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2 + floatY, 19, 0, Math.PI * 2); ctx.fill();
      if (fallbackGlyph) {
        ctx.fillStyle = '#fef08a';
        ctx.font = '22px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fallbackGlyph, x + size / 2, y + size / 2 + floatY);
      }
    }

    if (topTag) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      App.UI.roundRect(ctx, x + 2, y - 3 + floatY, size - 4, 13, 6);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(topTag, x + size / 2, y + 3.5 + floatY);
    }

    ctx.fillStyle = 'rgba(42, 20, 10, 0.92)';
    App.UI.roundRect(ctx, x - 5, y + size - 6 + floatY, size + 10, 16, 8);
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + size / 2, y + size + 2 + floatY);

    if (hasRedDot) {
      ctx.fillStyle = '#ef4444';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + size - 4, y + 6 + floatY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    App.UI.addHit(x - 5, y - 3, size + 10, size + 19, onClick);
  }

  function drawSideChapterArrow(ctx, dir, x, y, disabled, onClick) {
    const w = 42, h = 92;
    ctx.save();
    App.UI.roundRect(ctx, x, y, w, h, 12);
    ctx.fillStyle = disabled ? 'rgba(68, 64, 60, 0.55)' : 'rgba(59, 29, 14, 0.88)';
    ctx.fill();
    ctx.strokeStyle = disabled ? '#78716c' : '#fde047';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = disabled ? '#a8a29e' : '#fef08a';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dir < 0 ? '◀' : '▶', x + w / 2, y + 34);

    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.fillText(dir < 0 ? '上章' : '下章', x + w / 2, y + 66);
    ctx.restore();

    if (!disabled) App.UI.addHit(x, y, w, h, onClick);
  }

  function drawCityNode(ctx, lv, unlocked, cleared, isSel, time) {
    const x = lv.x, y = lv.y;
    const spr = App.Assets.get('city_fortress');
    ctx.save();

    if (isSel) {
      const r = 36 + Math.sin(time * 5) * 4;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y + 6, r, r * 0.52, 0, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath(); ctx.ellipse(x, y + 12, 30, 11, 0, 0, Math.PI * 2); ctx.fill();

    if (spr) {
      const w = 68;
      const h = (spr.height / spr.width) * w;
      if (!unlocked) ctx.filter = 'grayscale(100%) brightness(0.7)';
      ctx.drawImage(spr, x - w / 2, y - h + 16, w, h);
      ctx.filter = 'none';
    }

    ctx.fillStyle = 'rgba(28, 16, 8, 0.92)';
    App.UI.roundRect(ctx, x - 44, y + 17, 88, 20, 6);
    ctx.fill();
    ctx.strokeStyle = isSel ? '#fde047' : (cleared ? '#4ade80' : '#a16207');
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = unlocked ? '#fef08a' : '#94a3b8';
    ctx.font = 'bold 10px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${lv.order}.${lv.name}`, x, y + 27);

    if (cleared) {
      ctx.fillStyle = '#4ade80';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.strokeText('★已攻克', x, y - 46);
      ctx.fillText('★已攻克', x, y - 46);
    }
    ctx.restore();
  }

  // ★ 古风护眼羊皮卷章节大地图渲染（采用4幅温润手绘古地图原画轮换，彻底移除刺眼变色滤镜、上下颠倒与杂乱涂鸦线！）
  function drawChapterWorldMap(ctx, ch, W, H, time) {
    const theme = App.Config.getChapterMapTheme ? App.Config.getChapterMapTheme(ch) : null;
    const mapImg = (theme && App.Assets.get(theme.mapKey)) || App.Assets.get('bg_map');

    if (mapImg) {
      ctx.save();
      if (theme && theme.flipX) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(mapImg, 0, 0, W, H);
      ctx.restore();

      if (theme && theme.tint) {
        ctx.save();
        ctx.fillStyle = theme.tint;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = '#d8c28a';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function render(ctx, time) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    drawChapterWorldMap(ctx, activeChapter, W, H, time);

    // 顶部居中只展示当前章节名牌匾（绝不显示总章数与共800关！）+ 右侧古铜音效开关
    const progressOrder = Math.min(App.Config.TOTAL_STAGES, (st.maxClearedOrder || 0) + 1);
    const progressCh = Math.ceil(progressOrder / App.Config.STAGES_PER_CHAPTER);
    const chInfo = App.Config.getChapterInfo(activeChapter);
    App.UI.drawPanel(ctx, W / 2 - 144, 62, 288, 36, { r: 18, bg: 'rgba(42, 22, 10, 0.92)', border: '#d4a34b', lineWidth: 1.8 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 15px "PingFang SC", serif';
    ctx.fillText(chInfo.name, W / 2, 85);
    ctx.restore();
    if (App.UI.drawSoundToggle) {
      App.UI.drawSoundToggle(ctx, W / 2 - 178, 66, 28);
    }

    // 若翻阅到后续章节预览时，牌匾正下方提供一键【◀ 回当前战线】胶囊签
    if (activeChapter !== progressCh) {
      App.UI.drawButton(ctx, W / 2 - 58, 102, 116, 24, '◀ 回当前战线', {
        r: 12, grad: ['#b45309', '#78350f'], border: '#fde047', fontSize: 10.5,
      }, () => {
        activeChapter = progressCh;
        selectedOrder = progressOrder;
      });
    }

    // ★ 左上角并排 4 个精美悬浮小图片挂件：【名将营】【军备仓库】【演武场】【四象兽栏】（替代原底部按钮栏！）
    const chestCount = App.Config.ITEM_IDS.reduce((s, k) => s + (App.Config.ITEMS[k].kind === 'chest' ? App.State.getItemCount(k) : 0), 0);
    const ownedBeastCnt = Object.keys(st.ownedBeasts || {}).length;
    drawFloatingImageBadge(ctx, 'icon_roster', 22, 60, '名将营', st.deployIds.length < Math.min(5, Object.keys(st.ownedGenerals).length), time, () => {
      App.Main.goScene('roster');
    });
    drawFloatingImageBadge(ctx, 'icon_warehouse', 84, 60, '军备仓库', chestCount > 0, time, () => {
      App.Main.goScene('warehouse');
    });
    drawFloatingImageBadge(ctx, 'icon_arena', 146, 60, '演武场', (st.arenaTickets || 0) > 0, time, () => {
      App.Main.goScene('arena');
    });
    drawFloatingImageBadge(
      ctx,
      'icon_beast_sanctuary',
      208,
      60,
      '四象兽栏',
      ownedBeastCnt > 0 && !st.activeBeastId,
      time,
      () => App.Main.goScene('beast'),
      st.activeBeastId ? '上阵中' : ''
    );

    // ★ 左右两侧悬浮大翻章按钮：支持自由一路向后翻阅浏览直至最终章节！
    drawSideChapterArrow(ctx, -1, 12, 212, activeChapter <= 1, () => {
      activeChapter = Math.max(1, activeChapter - 1);
      selectedOrder = (activeChapter - 1) * App.Config.STAGES_PER_CHAPTER + 1;
    });
    drawSideChapterArrow(ctx, 1, W - 54, 212, activeChapter >= App.Config.TOTAL_CHAPTERS, () => {
      activeChapter = Math.min(App.Config.TOTAL_CHAPTERS, activeChapter + 1);
      selectedOrder = (activeChapter - 1) * App.Config.STAGES_PER_CHAPTER + 1;
    });

    // ★ 右上角并排 4 个精美悬浮小图片挂件：【神兽副本】【铜钱商城】【天命抽奖】【福利活动】（与下方城池完全错开零遮挡！）
    const beastUnlocked = (st.lordLevel || 1) >= App.State.BEAST_UNLOCK_LORD_LV;
    drawFloatingImageBadge(
      ctx,
      'icon_beast_dungeon',
      W - 260,
      60,
      '神兽副本',
      beastUnlocked && (st.ropes || 0) > 0,
      time,
      () => App.Main.goScene('beastDungeon'),
      beastUnlocked ? '' : 'Lv.15开'
    );
    drawFloatingImageBadge(ctx, 'icon_forge', 22, 124, '锻器坊', false, time, () => App.Main.goScene('forge'));
    drawFloatingImageBadge(ctx, 'icon_camp', 84, 124, '演武营', false, time, () => App.Main.goScene('camp'));
    drawFloatingImageBadge(ctx, 'icon_market', 146, 124, '坊市', false, time, () => App.Main.goScene('market'));

    drawFloatingImageBadge(ctx, 'icon_mail', W - 322, 60, '邮件公告', App.API.hasUnclaimedMail(), time, () => {
      App.Main.goScene('mail');
    });
    drawFloatingImageBadge(ctx, 'icon_challenge', W - 198, 124, '征战秘境', false, time, () => App.Main.goScene('challenge'));
    drawFloatingImageBadge(
      ctx,
      'icon_tower',
      W - 136,
      124,
      '铜雀天梯',
      (st.towerFloor || 0) > 0 && st.towerIdleDate !== (() => { const d = new Date(App.API.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); })(),
      time,
      () => App.Main.goScene('tower')
    );
    drawFloatingImageBadge(
      ctx,
      'icon_demon',
      W - 74,
      124,
      '魔将挑战',
      Object.keys(App.Config.DEMONS).some((k) => ((st.demonTokens || {})[k] || 0) >= App.Config.DEMONS[k].tokensNeeded),
      time,
      () => App.Main.goScene('demon')
    );
    drawFloatingImageBadge(ctx, 'icon_shop', W - 198, 60, '铜钱商城', st.gold >= 900, time, () => {
      App.Main.goScene('shop');
    });
    drawFloatingImageBadge(ctx, 'icon_wheel', W - 136, 60, '天命抽奖', (st.wheelTickets || 0) > 0, time, () => {
      App.Main.goScene('wheel');
    });
    drawFloatingImageBadge(ctx, 'icon_welfare', W - 74, 60, '福利活动', App.State.hasUnclaimedActivity(), time, () => {
      App.Main.goScene('activity');
    });

    const chLevels = App.Config.getChapterStages(activeChapter, st.factionId);
    if (!chLevels.some((l) => l.order === selectedOrder)) {
      const unlockedInCh = chLevels.filter((l) => App.State.isStageUnlocked(l.order));
      selectedOrder = (unlockedInCh[unlockedInCh.length - 1] || chLevels[0]).order;
    }

    ctx.save();
    for (let i = 0; i < chLevels.length - 1; i++) {
      const a = chLevels[i], b = chLevels[i + 1];
      const unlocked = App.State.isStageUnlocked(b.order);
      ctx.strokeStyle = unlocked ? '#dc2626' : 'rgba(68, 64, 60, 0.45)';
      ctx.lineWidth = unlocked ? 3.5 : 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    chLevels.forEach((lv) => {
      const unlocked = App.State.isStageUnlocked(lv.order);
      const cleared = lv.order <= (st.maxClearedOrder || 0);
      drawCityNode(ctx, lv, unlocked, cleared, lv.order === selectedOrder, time);
      App.UI.addHit(lv.x - 42, lv.y - 46, 84, 88, () => { selectedOrder = lv.order; });
    });

    // 底部选中关隘精致紧凑详情条（轻巧窄框不遮挡九州山河，已攻克关卡主按钮显示【⚡ 扫 荡】）
    const sel = chLevels.find((l) => l.order === selectedOrder) || chLevels[0];
    const selUnlocked = App.State.isStageUnlocked(sel.order);
    const selCleared = sel.order <= (st.maxClearedOrder || 0);
    const boss = App.Config.GENERALS[sel.bossId];
    const tier = App.Config.RECRUIT_TIERS[boss.recruitTier];
    const eqTpl = App.Config.EQUIP_TEMPLATES[sel.fixedDrop];
    const cardX = 186, cardY = 458, cardW = 588, cardH = 68;

    App.UI.drawPanel(ctx, cardX, cardY, cardW, cardH, {
      r: 12, bg: 'rgba(245, 232, 200, 0.96)', border: '#7c4a21', lineWidth: 2.2,
    });
    App.Portraits.drawGeneralPortrait(ctx, boss.id, cardX + 10, cardY + 8, 52, { radius: 8, lineWidth: 1.8 });

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 13px "PingFang SC", sans-serif';
    ctx.fillText(
      `第 ${sel.order} 关 · ${sel.name}${selCleared ? ' [已攻克]' : ''}  (战力 ${sel.recommendedPower || sel.recommendedLv * 1150} · 经验+${sel.lordExp})`,
      cardX + 70, cardY + 26
    );
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    const bossTag = `守将：${boss.name} [${tier.label}·${st.ownedGenerals[boss.id] ? '已归顺' : '可招降'}]`;
    ctx.fillText(bossTag, cardX + 70, cardY + 50);
    const rwX = cardX + 70 + ctx.measureText(bossTag).width + 10;
    App.UI.drawMiniIcon(ctx, 'res_gold', rwX, cardY + 37, 15);
    ctx.fillStyle = '#b45309';
    ctx.fillText(`+${sel.rewardGold}`, rwX + 17, cardY + 50);
    App.UI.drawMiniIcon(ctx, 'res_soul', rwX + 58, cardY + 37, 15);
    ctx.fillStyle = '#7e22ce';
    ctx.fillText(`+${sel.rewardSoul}`, rwX + 75, cardY + 50);
    ctx.restore();

    // 若已收服任意神兽，出战前可直接一键切换【神兽上阵 / 休息】
    const ownedBeastIds = Object.keys(st.ownedBeasts || {});
    if (ownedBeastIds.length > 0) {
      const hasActiveBeast = !!(st.activeBeastId && st.ownedBeasts[st.activeBeastId]);
      const bShort = hasActiveBeast ? App.Config.BEASTS[st.activeBeastId].shortName : '神兽';
      App.UI.drawButton(ctx, cardX + 332, cardY + 34, 80, 22, hasActiveBeast ? `${bShort}:上阵✓` : '神兽:休息', {
        r: 6,
        grad: hasActiveBeast ? ['#15803d', '#166534'] : ['#57534e', '#44403c'],
        border: hasActiveBeast ? '#bbf7d0' : '#a8a29e',
        fontSize: 10,
      }, () => {
        if (st.activeBeastId) {
          App.State.setActiveBeast(null).then((res) => { if (res.ok) App.UI.showToast('已设神兽休息待命，本局神兽不上阵', '#fde047'); });
        } else {
          App.State.setActiveBeast(ownedBeastIds[0]).then((res) => { if (res.ok) App.UI.showToast(`已派【${App.Config.BEASTS[st.activeBeastId].name}】随军上阵！`, '#4ade80'); });
        }
      });
    }

    if (eqTpl) {
      App.Sprites.drawEquipIcon(ctx, eqTpl.id, cardX + 422, cardY + 7, 40, { radius: 7, lineWidth: 1.6 });
      ctx.save();
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(eqTpl.name.slice(0, 5), cardX + 442, cardY + 59);
      ctx.restore();
    }

    const hasSta = st.stamina >= App.State.getStaminaCost(sel.staminaCost);
    const btnX = cardX + 472, btnW = 106;
    if (selCleared) {
      // ★ 已攻克关卡：主按钮显示为【⚡ 扫 荡】（未收服守将时下方附带紧凑重战招降按钮）
      const needRecruitBtn = !st.ownedGenerals[boss.id];
      const sweepBtnH = needRecruitBtn ? 36 : 52;
      const sweepBtnY = needRecruitBtn ? (cardY + 6) : (cardY + 8);

      App.UI.drawButton(ctx, btnX, sweepBtnY, btnW, sweepBtnH, hasSta ? '⚡ 扫 荡' : '补粮草', {
        r: 8,
        grad: hasSta ? ['#d97706', '#92400e'] : ['#16a34a', '#15803d'],
        border: '#fef08a',
        fontSize: needRecruitBtn ? 13 : 14.5,
        subText: needRecruitBtn ? undefined : (hasSta ? `耗${App.State.getStaminaCost(sel.staminaCost)}粮秒领` : '+15粮草'),
      }, () => {
        if (!hasSta) {
          App.Platform.showRewardedAd('stamina', '观看激励视频，立刻恢复 +15 粮草体力！', () => {
            App.State.claimAd('stamina');
          });
          return;
        }
        App.State.sweepStage(sel).then((res) => { if (res.ok) sweepModal = { stage: sel, res: res.sweep }; });
      });

      if (needRecruitBtn) {
        App.UI.drawButton(ctx, btnX, cardY + 45, btnW, 18, `重战招降${boss.name}`, {
          r: 5, grad: ['#7f1d1d', '#450a0a'], border: '#fca5a5', fontSize: 9.5,
        }, () => {
          if (!hasSta) {
            App.UI.showToast('粮草不足，请点击顶部粮草+号恢复！', '#fbbf24');
            return;
          }
          App.Main.startBattle('city', sel.order, { level: sel });
        });
      }
    } else {
      App.UI.drawButton(ctx, btnX, cardY + 8, btnW, 52, !selUnlocked ? '🔒 未解锁' : (hasSta ? '击鼓应战' : '补粮草'), {
        r: 9,
        grad: hasSta ? ['#dc2626', '#991b1b'] : ['#16a34a', '#15803d'],
        border: '#fef08a',
        fontSize: 13.5,
        subText: !selUnlocked ? `先通第${sel.order - 1}关` : (hasSta ? `耗 ${App.State.getStaminaCost(sel.staminaCost)} 粮草` : '+15粮草'),
        disabled: !selUnlocked,
      }, () => {
        if (!hasSta) {
          App.Platform.showRewardedAd('stamina', '观看激励视频，立刻恢复 +15 粮草体力！', () => {
            App.State.claimAd('stamina');
          });
          return;
        }
        App.Main.startBattle('city', sel.order, { level: sel });
      });
    }

    drawTopBar(ctx);
    drawProfileModal(ctx);

    // ★ 扫荡战利品捷报弹窗（支持连续一键再扫荡！）
    if (sweepModal && sweepModal.res) {
      drawSweepModal(ctx, st, sweepModal);
    }
  }

  function drawSweepModal(ctx, st, modal) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const r = modal.res;
    const stage = modal.stage;

    // 拦截底层点击穿透
    App.UI.addHit(0, 0, W, H, () => {});

    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 2, 0.76)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const mw = 540, mh = 290;
    const mx = (W - mw) / 2, my = (H - mh) / 2 + 8;
    App.UI.drawPanel(ctx, mx, my, mw, mh, { r: 16, bg: '#271308', border: '#facc15', lineWidth: 2.8 });
    App.UI.drawPanel(ctx, mx + 7, my + 7, mw - 14, mh - 14, { r: 12, bg: 'rgba(54, 26, 12, 0.65)', border: 'rgba(250,204,21,0.35)', lineWidth: 1.2 });

    // 顶部标题牌匾
    App.UI.drawPanel(ctx, W / 2 - 135, my - 22, 270, 44, { r: 22, bg: '#b45309', border: '#fef08a', lineWidth: 2.4 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 20px "PingFang SC", serif';
    ctx.fillText(`⚡ 扫荡大捷 · ${r.stageName}`, W / 2, my + 6);

    if (r.lvInfo && r.lvInfo.leveledUp) {
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`🎉 恭喜主公升至 Lv.${r.lvInfo.newLv}！`, W / 2, my + 44);
    }
    ctx.restore();

    const eqTpl = r.droppedEquip ? App.Config.EQUIP_TEMPLATES[r.droppedEquip.tplId] : null;
    const eqQual = eqTpl ? App.Config.QUALITIES[eqTpl.quality] : null;
    const cards = [
      { kind: 'item', key: 'exp_scroll', title: `经验 +${r.expGain}`, sub: `主公 Lv.${st.lordLevel}`, border: '#38bdf8', col: '#bae6fd' },
      { kind: 'mini', key: 'res_gold', title: `铜钱 +${r.goldGain}`, sub: '军饷入账', border: '#facc15', col: '#fde047' },
      { kind: 'mini', key: 'res_soul', title: `将魂 +${r.soulGain}`, sub: '缚兽索+1', border: '#c084fc', col: '#f5d0fe' },
    ];
    if (eqTpl) {
      cards.push({
        kind: 'equip', key: eqTpl.id, title: eqTpl.name,
        sub: r.bonusChest ? `${eqQual.name}+额外宝箱!` : `${eqQual.name}·已入库`, border: eqQual.color, col: '#fef08a',
      });
    }

    const cw = 114, ch = 98, gap = 12;
    let sx = W / 2 - (cards.length * cw + (cards.length - 1) * gap) / 2;
    const cy = my + 58;
    cards.forEach((c) => {
      App.UI.drawPanel(ctx, sx, cy, cw, ch, { r: 10, bg: 'rgba(16, 8, 4, 0.80)', border: c.border, lineWidth: 1.8 });
      if (c.kind === 'equip') {
        App.Sprites.drawEquipIcon(ctx, c.key, sx + (cw - 44) / 2, cy + 8, 44, { radius: 8, border: c.border, lineWidth: 1.8 });
      } else if (c.kind === 'item') {
        const img = App.Assets.get('item_' + c.key);
        if (img) ctx.drawImage(img, sx + (cw - 42) / 2, cy + 9, 42, 42);
      } else {
        App.UI.drawMiniIcon(ctx, c.key, sx + (cw - 42) / 2, cy + 9, 42);
      }
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = c.col;
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(c.title, sx + cw / 2, cy + 70);
      ctx.fillStyle = '#a8a29e';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(c.sub, sx + cw / 2, cy + 86);
      ctx.restore();
      sx += cw + gap;
    });

    const canAgain = st.stamina >= App.State.getStaminaCost(stage.staminaCost);
    const onSweepAgain = () => {
      if (!canAgain) {
        App.Platform.showRewardedAd('stamina', '观看激励视频，立刻恢复 +15 粮草体力！', () => {
          App.State.claimAd('stamina');
        });
        return;
      }
      App.State.sweepStage(stage).then((res) => {
        if (!res.ok) return;
        sweepModal = { stage, res: res.sweep };
        App.UI.showToast('连续扫荡完成！战利品已入库！', '#4ade80');
      });
    };
    if (canAgain) {
      App.UI.drawButton(ctx, W / 2 - 196, my + mh - 62, 188, 44, `⚡ 再扫荡一次 (耗${App.State.getStaminaCost(stage.staminaCost)}粮)`, {
        r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13.5,
      }, onSweepAgain);
    } else {
      App.UI.drawAdButton(ctx, W / 2 - 196, my + mh - 62, 188, 44, '免费补粮再扫荡', {
        r: 10, fontSize: 13.5,
      }, onSweepAgain);
    }

    App.UI.drawButton(ctx, W / 2 + 8, my + mh - 62, 188, 44, '收下战利品', {
      r: 10, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 14,
    }, () => { sweepModal = null; });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.map = { enter, render, drawTopBar, drawBottomNav };
})(typeof globalThis !== 'undefined' ? globalThis : window);
