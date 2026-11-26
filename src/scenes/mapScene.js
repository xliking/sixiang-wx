(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let activeChapter = 1;
  let selectedOrder = 1;
  let sweepModal = null; // 扫荡战利品捷报弹窗状态
  let showDeployModal = false; // 排兵布阵 · 九州点将台弹窗
  let showPatrolModal = false; // 九州岁贡 · 离线挂机征饷弹窗
  let deployFilterTroop = 'all';
  let deployPage = 0;
  let selectedDeploySlot = -1;
  let inMapRender = false;

  function openDeployModal() {
    showDeployModal = true;
    selectedDeploySlot = -1;
  }

  function enter(params) {
    const st = App.State.get();
    const progressOrder = Math.min(App.Config.TOTAL_STAGES, (st.maxClearedOrder || 0) + 1);
    const targetOrder = (params && params.selectOrder)
      ? Math.max(1, Math.min(App.Config.TOTAL_STAGES, Number(params.selectOrder) || progressOrder))
      : progressOrder;
    activeChapter = Math.ceil(targetOrder / App.Config.STAGES_PER_CHAPTER);
    selectedOrder = targetOrder;
    sweepModal = null;
    showPatrolModal = false;
    showDeployModal = !!(params && params.openDeploy);
    deployFilterTroop = 'all';
    deployPage = 0;
    selectedDeploySlot = -1;
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
      ['名将', Object.keys(st.ownedGenerals || {}).length + ' 名'], ['神兽', Object.keys(st.ownedBeasts || {}).length + ' 只'], ['演武排名', (st.arenaRank || 9999) >= 9999 ? '未入榜' : '第 ' + st.arenaRank + ' 名'], ['登录天数', (pf.loginDays || 1) + ' 天']];
    ctx.font = '13px "PingFang SC", sans-serif';
    rows.forEach((r, i) => {
      const rx = x + 30 + (i % 2) * 190, ry = y + 160 + Math.floor(i / 2) * 26;
      ctx.fillStyle = '#92400e'; ctx.fillText(r[0], rx, ry);
      ctx.fillStyle = '#451a03'; ctx.fillText(String(r[1]), rx + 70, ry);
    });
    ctx.restore();
    App.UI.drawButton(ctx, x + 22, y + h - 54, 88, 38, '修改名号', { r: 9, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12.5 }, () => {
      App.Platform.promptText('请输入新的名号（2~8 个字）', (name) => App.State.rename(name));
    });
    App.UI.drawButton(ctx, x + 118, y + h - 54, 88, 38, '复制 ID', { r: 9, grad: ['#6b381b', '#43200d'], border: '#d4a34b', fontSize: 12.5 }, () => {
      App.Platform.copyText(String(pf.playerId));
      App.UI.showToast('ID 已复制：' + pf.playerId, '#fde68a');
    });
    App.UI.drawButton(ctx, x + 214, y + h - 54, 88, 38, '意见反馈', { r: 9, grad: ['#9a3412', '#6b2110'], border: '#fde68a', fontSize: 12.5 }, () => {
      showProfile = false;
      App.Main.goScene('mail', { tab: 'feedback' });
    });
    App.UI.drawButton(ctx, x + 310, y + h - 54, 88, 38, '关闭', { r: 9, grad: ['#574c43', '#3b322b'], border: '#d6be92', fontSize: 12.5 }, () => { showProfile = false; });
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
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    const pf = App.State.getProfile();
    ctx.fillText(`${(pf.nickname || '').slice(0, 6)} Lv.${st.lordLevel || 1} (${st.lordExp || 0}/${nextExp})`, 54, 26, 124);
    App.UI.drawBar(ctx, 54, 33, 122, 7.5, (st.lordExp || 0) / nextExp, '#38bdf8', '#1e293b');
    ctx.restore();

    // 点头像或名字查看个人信息
    App.UI.addHit(14, 8, 166, 44, () => { showProfile = true; });

    // ★ 单行一字排开全图形化胶囊栏（最右侧「破 X 城」右边实时统计展示已选出战英雄战力！）
    const sec = App.State.getNextStaminaSeconds();
    const tStr = st.stamina >= App.State.STAMINA_MAX
      ? '满'
      : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    const staAdLimit = ((App.Config.AD_REWARDS || {}).stamina || {}).dailyLimit || 8;
    const remainStaAds = Math.max(0, staAdLimit - ((st.adCounts || {}).stamina || 0));

    const adGoldAmt = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('gold_top', 'gold') : 2000;
    const adStaAmt = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('stamina', 'stamina') : 20;

    const claimGoldAd = () => {
      App.Platform.showRewardedAd('stamina', `观看激励视频，免费领取 +${adGoldAmt} 铜钱军饷！`, () => {
        App.State.claimAd('gold_top');
      });
    };

    const claimStaminaAd = () => {
      if (st.stamina >= App.State.STAMINA_MAX) {
        App.UI.showToast(`当前粮草体力已满（${App.State.STAMINA_MAX}/${App.State.STAMINA_MAX}），快去出征攻城吧！`, '#fde047');
        return;
      }
      if (remainStaAds <= 0) {
        if (App.API && App.API.subscribeNotice && App.API.getSubscribeQuota('stamina') <= 0) {
          App.API.subscribeNotice('stamina');
          return;
        }
        App.UI.showToast('今日广告补粮次数已用完，可使用仓库行军粮草丹！', '#fbbf24');
        return;
      }
      App.Platform.showRewardedAd('stamina', `观看激励视频，立刻恢复 +${adStaAmt} 粮草体力！`, () => {
        App.State.claimAd('stamina');
      });
    };

    const openExchange = () => {
      if (App.UI && App.UI.openExchangeModal) App.UI.openExchangeModal();
    };

    const cy = 18, ch = 24;
    const maxDep = (App.Config.PARAMS && App.Config.PARAMS.maxDeploy) || 5;
    const heroPower = App.State.getDeployHeroPower ? App.State.getDeployHeroPower() : App.State.getTeamPower();
    const adsOn = !!(App.Config && App.Config.isAdEnabled && App.Config.isAdEnabled());

    // 1. 铜钱胶囊（广告开启时展示右侧 + 号领军饷；关闭时隐藏 + 号）
    App.UI.drawResCapsule(ctx, 'res_gold', 180, cy, 104, ch, `${st.gold}`, {
      color: '#fbbf24', border: 'rgba(251, 191, 36, 0.60)', glow: 'rgba(251, 191, 36, 0.45)',
      fontSize: 10.5, plusBadge: adsOn, plusColor: '#d97706', onPlusClick: adsOn ? claimGoldAd : null,
    }, adsOn ? claimGoldAd : null);

    // 2. 元宝胶囊（点击打开九州钱庄·铜钱⇄元宝互转；广告关闭时不展示 + 号）
    App.UI.drawResCapsule(ctx, 'res_ingot', 290, cy, 92, ch, `${st.ingot || 0}`, {
      color: '#fef08a', border: 'rgba(250, 204, 21, 0.72)', glow: 'rgba(245, 158, 11, 0.52)',
      fontSize: 10.5, plusBadge: adsOn, plusColor: '#b45309', onPlusClick: adsOn ? openExchange : null,
    }, openExchange);

    // 3. 将魂胶囊
    App.UI.drawResCapsule(ctx, 'res_soul', 388, cy, 86, ch, `魂 ${st.soul}`, {
      color: '#f0abfc', border: 'rgba(232, 121, 249, 0.55)', glow: 'rgba(217, 70, 239, 0.40)', fontSize: 10.5,
    }, () => App.Main.goScene('roster'));

    // 4. 粮草体力胶囊（最多 60/60 满）
    const staFull = st.stamina >= App.State.STAMINA_MAX;
    App.UI.drawResCapsule(ctx, 'res_stamina', 480, cy, 138, ch, `${st.stamina}/${App.State.STAMINA_MAX} (${tStr})`, {
      color: '#bbf7d0',
      border: 'rgba(74, 222, 128, 0.58)',
      glow: 'rgba(74, 222, 128, 0.38)',
      fontSize: 10,
      ratio: Math.min(1, st.stamina / App.State.STAMINA_MAX),
      barColor: 'rgba(22, 163, 74, 0.42)',
      plusBadge: adsOn,
      plusColor: '#16a34a',
      plusDisabled: remainStaAds <= 0 || staFull,
      onPlusClick: adsOn ? claimStaminaAd : null,
    }, adsOn ? claimStaminaAd : null);

    // 5. 缚兽索/金索胶囊
    const ropeTxt = (st.goldRopes || 0) > 0
      ? `索${st.ropes}·金${st.goldRopes}`
      : `缚索 ${st.ropes}`;
    App.UI.drawResCapsule(ctx, 'res_rope', 624, cy, 96, ch, ropeTxt, {
      color: '#7dd3fc', border: 'rgba(56, 189, 248, 0.52)', glow: 'rgba(56, 189, 248, 0.38)', fontSize: 10,
    }, () => App.Main.goScene('beastDungeon'));

    // 6. 攻城进度胶囊
    App.UI.drawResCapsule(ctx, 'res_stage', 726, cy, 86, ch, `破 ${st.maxClearedOrder || 0} 城`, {
      color: '#fed7aa', border: 'rgba(251, 146, 60, 0.52)', glow: 'rgba(239, 68, 68, 0.38)', fontSize: 10,
    }, () => App.Main.goScene('map'));

    // 7. 出战英雄战力胶囊
    const pwrTxt = `战力 ${heroPower} (${st.deployIds.length}/${maxDep})`;
    ctx.save();
    ctx.font = 'bold 10px "PingFang SC", "Microsoft YaHei", sans-serif';
    const pwrW = Math.max(114, Math.min(132, Math.ceil(ctx.measureText(pwrTxt).width) + 34));
    ctx.restore();
    App.UI.drawResCapsule(ctx, 'res_power', 818, cy, pwrW, ch, pwrTxt, {
      color: '#fde047', border: 'rgba(250, 204, 21, 0.68)', glow: 'rgba(249, 115, 22, 0.46)', fontSize: 10,
    }, () => {
      if (inMapRender) openDeployModal();
      else App.Main.goScene('map', { openDeploy: true });
    });
  }

  // 子页面已全面统一为右上角【✕】关闭圆章按钮与满屏对称布局，不再绘制冗余底部返回条
  function drawBottomNav() {
    // no-op: kept for backward-compatibility
  }

  // 顶部双排紧凑古风圆章入口（40px 精致尺寸 + 统一鎏金圆盘底座，绝不遮挡下方任何城池关隘！）
  function drawFloatingImageBadge(ctx, imgKey, x, y, label, hasRedDot, time, onClick, topTag, fallbackGlyph) {
    const spr = App.Assets.get(imgKey);
    const size = 40;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const needsMedallion = !spr || imgKey.indexOf('res_') === 0;

    ctx.save();
    const g = ctx.createRadialGradient(cx, cy, 3, cx, cy, 23);
    g.addColorStop(0, 'rgba(250, 204, 21, 0.38)');
    g.addColorStop(1, 'rgba(250, 204, 21, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, 23, 0, Math.PI * 2);
    ctx.fill();

    if (needsMedallion) {
      // 为无圆框的资源小图（如九州岁贡、排兵布阵）补绘与其它功能图标完全一致的暗红古铜鎏金圆盘底框！
      const rg = ctx.createRadialGradient(cx, cy - 3, 2, cx, cy, 18.5);
      rg.addColorStop(0, '#6b2414');
      rg.addColorStop(1, '#2b0f08');
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, Math.PI * 2);
      ctx.fillStyle = rg;
      ctx.fill();

      const ringG = ctx.createLinearGradient(x, y, x, y + size);
      ringG.addColorStop(0, '#fef08a');
      ringG.addColorStop(0.5, '#d97706');
      ringG.addColorStop(1, '#78350f');
      ctx.strokeStyle = ringG;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, 19.2, 0, Math.PI * 2);
      ctx.stroke();

      if (spr) {
        const inner = 25;
        ctx.drawImage(spr, cx - inner / 2, cy - inner / 2, inner, inner);
      } else if (imgKey === 'icon_settings' && App.UI && App.UI.drawVectorGear) {
        App.UI.drawVectorGear(ctx, cx, cy, 10.5, '#fef08a');
      } else if (fallbackGlyph) {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 16px "PingFang SC", serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fallbackGlyph, cx, cy + 0.5);
      }
    } else {
      ctx.drawImage(spr, x, y, size, size);
    }

    if (topTag) {
      ctx.fillStyle = 'rgba(38, 18, 8, 0.92)';
      App.UI.roundRect(ctx, x - 1, y - 3, size + 2, 12, 6);
      ctx.fill();
      ctx.strokeStyle = '#d4a34b';
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 8px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(topTag, cx, y + 3);
    }

    ctx.fillStyle = 'rgba(42, 20, 10, 0.92)';
    App.UI.roundRect(ctx, x - 4, y + size - 6, size + 8, 15, 7.5);
    ctx.fill();
    ctx.strokeStyle = '#d4a34b';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 9px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, y + size + 1.8);

    if (hasRedDot) {
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(x + size - 3, y + 5, 4.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    App.UI.addHit(x - 4, y - 3, size + 8, size + 18, onClick);
  }

  // 精致小巧的古风檀木翻章侧签（26×54，面积缩减 64%，不挡视野且保留宽裕触控热区）
  function drawSideChapterArrow(ctx, dir, x, y, disabled, onClick) {
    const w = 26, h = 54;
    ctx.save();
    App.UI.roundRect(ctx, x, y, w, h, 8);
    if (disabled) {
      ctx.fillStyle = 'rgba(68, 64, 60, 0.45)';
    } else {
      const bg = ctx.createLinearGradient(x, y, x, y + h);
      bg.addColorStop(0, 'rgba(92, 44, 22, 0.90)');
      bg.addColorStop(1, 'rgba(51, 23, 10, 0.92)');
      ctx.fillStyle = bg;
    }
    ctx.fill();
    ctx.strokeStyle = disabled ? 'rgba(120, 113, 108, 0.65)' : '#d4a34b';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    const col = disabled ? '#a8a29e' : '#fde68a';
    ctx.fillStyle = col;
    const cx = x + w / 2, ay = y + 15;
    ctx.beginPath();
    if (dir < 0) {
      ctx.moveTo(cx - 4.2, ay);
      ctx.lineTo(cx + 3.2, ay - 5.2);
      ctx.lineTo(cx + 3.2, ay + 5.2);
    } else {
      ctx.moveTo(cx + 4.2, ay);
      ctx.lineTo(cx - 3.2, ay - 5.2);
      ctx.lineTo(cx - 3.2, ay + 5.2);
    }
    ctx.closePath();
    ctx.fill();

    ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(dir < 0 ? '上' : '下', cx, y + 30);
    ctx.fillText('章', cx, y + 42);
    ctx.restore();

    if (!disabled) App.UI.addHit(x - 6, y - 6, w + 12, h + 12, onClick);
  }

  // 章节城池防重叠布局与未解锁暗色城池贴图缓存（避免每帧 O(N^2) 迭代与 iOS 不兼容的 ctx.filter）
  let cachedLayoutKey = '';
  let cachedLayoutNodes = null;
  let cachedSortedBodies = null;
  let lockedCityCvs = null;
  let lockedCitySrc = null;
  let redDotRev = -1;
  let cachedChestCount = 0;
  let cachedDemonRedDot = false;

  function getLockedCityCanvas(spr, w, h) {
    if (lockedCityCvs && lockedCitySrc === spr) return lockedCityCvs;
    if (!App.Platform || !App.Platform.createOffscreen) return null;
    const cw = Math.max(32, Math.round(w * 2));
    const ch = Math.max(32, Math.round(h * 2));
    const cvs = App.Platform.createOffscreen(cw, ch);
    if (!cvs) return null;
    const g = cvs.getContext('2d');
    if (!g) return null;
    g.clearRect(0, 0, cw, ch);
    g.drawImage(spr, 0, 0, cw, ch);
    try {
      g.save();
      g.globalCompositeOperation = 'color';
      g.fillStyle = '#78716c';
      g.fillRect(0, 0, cw, ch);
      g.restore();
    } catch (e) {}
    g.save();
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(30, 41, 59, 0.42)';
    g.fillRect(0, 0, cw, ch);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(spr, 0, 0, cw, ch);
    g.restore();
    lockedCityCvs = cvs;
    lockedCitySrc = spr;
    return cvs;
  }

  // ★ 自动排布章节城池坐标与铭牌防重叠解算器（按章节缓存，零逐帧重算！）
  function layoutChapterCities(ctx, chLevels, cacheKey) {
    if (cacheKey && cacheKey === cachedLayoutKey && cachedLayoutNodes) {
      return cachedLayoutNodes;
    }
    ctx.save();
    ctx.font = 'bold 10px "PingFang SC", sans-serif';
    const nodes = chLevels.map((lv, idx) => {
      const label = `${lv.order}.${lv.name}`;
      const pillW = Math.max(82, Math.ceil(ctx.measureText(label).width + 14));
      return {
        lv,
        idx,
        label,
        pillW,
        nx: lv.x,
        ny: lv.y,
      };
    });
    ctx.restore();

    const clampNode = (n) => {
      const halfW = Math.max(38, Math.ceil(n.pillW / 2));
      // 严格避开左右翻章侧签（x<=36 与 x>=924）
      n.nx = Math.max(44 + halfW, Math.min(916 - halfW, n.nx));
      // 计入城池关隘本体半宽与顶部「★已攻克」角标高度（ny-54），100% 杜绝与左上/右上双排功能图标区重叠！
      const underSideBadges = (n.nx - halfW < 354) || (n.nx + halfW > 606);
      const minTopY = underSideBadges ? 244 : 194;
      n.ny = Math.max(minTopY, Math.min(402, n.ny));
    };

    nodes.forEach(clampNode);

    for (let iter = 0; iter < 12; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const minDx = (a.pillW + b.pillW) * 0.5 + 12;
          const minDy = 50;
          const dx = b.nx - a.nx;
          const dy = b.ny - a.ny;
          if (Math.abs(dx) < minDx && Math.abs(dy) < minDy) {
            const pushX = (minDx - Math.abs(dx)) * 0.36;
            const signX = dx >= 0 ? 1 : -1;
            a.nx -= signX * pushX;
            b.nx += signX * pushX;

            const pushY = (minDy - Math.abs(dy)) * 0.52;
            const signY = Math.abs(dy) < 6 ? ((i % 2 === 0) ? -1 : 1) : (dy >= 0 ? 1 : -1);
            a.ny -= signY * pushY;
            b.ny += signY * pushY;
          }
        }
      }
      nodes.forEach(clampNode);
    }

    nodes.forEach((n) => {
      n.labelX = n.nx;
      n.labelY = n.ny + 27;
    });

    // 最终铭牌级碰撞兜底：确保任何情况下两个名字框零像素重叠
    for (let iter = 0; iter < 4; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const minW = (a.pillW + b.pillW) * 0.5 + 5;
          const minH = 23;
          const dx = b.labelX - a.labelX;
          const dy = b.labelY - a.labelY;
          if (Math.abs(dx) < minW && Math.abs(dy) < minH) {
            const py = (minH - Math.abs(dy)) * 0.55;
            const sy = dy >= 0 ? 1 : -1;
            a.labelY -= sy * py;
            b.labelY += sy * py;
          }
        }
      }
    }

    if (cacheKey) {
      cachedLayoutKey = cacheKey;
      cachedLayoutNodes = nodes;
      cachedSortedBodies = nodes.slice().sort((a, b) => a.ny - b.ny);
    }
    return nodes;
  }

  function drawCityFortressBody(ctx, n, unlocked, isSel, time) {
    const x = n.nx, y = n.ny;
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
      if (!unlocked) {
        const lockedTex = getLockedCityCanvas(spr, w, h);
        if (lockedTex) {
          ctx.drawImage(lockedTex, x - w / 2, y - h + 16, w, h);
        } else {
          ctx.globalAlpha = 0.55;
          ctx.drawImage(spr, x - w / 2, y - h + 16, w, h);
        }
      } else {
        ctx.drawImage(spr, x - w / 2, y - h + 16, w, h);
      }
    }
    ctx.restore();
  }

  function drawCityNodeLabel(ctx, n, unlocked, cleared, isSel) {
    const x = n.nx, y = n.ny;
    const lx = n.labelX, ly = n.labelY;
    const pw = n.pillW;
    ctx.save();

    ctx.fillStyle = 'rgba(28, 16, 8, 0.94)';
    App.UI.roundRect(ctx, lx - pw / 2, ly - 10, pw, 20, 6);
    ctx.fill();
    ctx.strokeStyle = isSel ? '#fde047' : (cleared ? '#4ade80' : '#a16207');
    ctx.lineWidth = isSel ? 1.8 : 1.4;
    ctx.stroke();

    ctx.fillStyle = unlocked ? '#fef08a' : '#94a3b8';
    ctx.font = 'bold 10px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, lx, ly + 0.5);

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

  // 受「功能开启」等级限制的入口：未开启时角标显示开启等级、不亮红点，点击由 goScene 统一提示
  function drawFeatureBadge(ctx, feature, imgKey, x, y, label, hasRedDot, time, scene, topTag, fallbackGlyph) {
    const need = App.State.featureLockLv(feature);
    drawFloatingImageBadge(ctx, imgKey, x, y, label, !need && hasRedDot, time, () => App.Main.goScene(scene), need ? `Lv.${need}开` : topTag, fallbackGlyph);
  }

  function isWorldBossOpen() {
    const hour = new Date(App.API.now()).getHours();
    return ((App.Config.WORLD_BOSS || {}).windows || []).some((w) => hour >= w.start && hour < w.end);
  }

  function render(ctx, time) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    drawChapterWorldMap(ctx, activeChapter, W, H, time);

    // 顶部居中只展示当前章节名牌匾（绝不显示总章数与共800关！）
    const progressOrder = Math.min(App.Config.TOTAL_STAGES, (st.maxClearedOrder || 0) + 1);
    const progressCh = Math.ceil(progressOrder / App.Config.STAGES_PER_CHAPTER);
    const chInfo = App.Config.getChapterInfo(activeChapter);
    App.UI.drawPanel(ctx, W / 2 - 134, 60, 268, 34, { r: 17, bg: 'rgba(42, 22, 10, 0.92)', border: '#d4a34b', lineWidth: 1.7 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText(`群英志 · ${chInfo.name}`, W / 2, 82, 248);
    ctx.restore();

    // 若翻阅到后续章节预览时，牌匾正下方提供一键【◀ 回当前战线】胶囊签
    if (activeChapter !== progressCh) {
      App.UI.drawButton(ctx, W / 2 - 58, 98, 116, 22, '◀ 回当前战线', {
        r: 11, grad: ['#b45309', '#78350f'], border: '#fde047', fontSize: 10,
      }, () => {
        activeChapter = progressCh;
        selectedOrder = progressOrder;
      });
    }

    // ★ 左上角紧凑双排圆章挂件（x 间距 56px，总宽收窄至 x=338，底边收至 y=163）
    const curRev = App.State.getRevision ? App.State.getRevision() : -1;
    if (curRev !== redDotRev) {
      redDotRev = curRev;
      cachedChestCount = App.Config.ITEM_IDS.reduce((s, k) => s + (App.Config.ITEMS[k].kind === 'chest' ? App.State.getItemCount(k) : 0), 0);
      cachedDemonRedDot = Object.keys(App.Config.DEMONS).some((k) => ((st.demonTokens || {})[k] || 0) >= App.Config.DEMONS[k].tokensNeeded);
    }
    const chestCount = cachedChestCount;
    const ownedBeastCnt = Object.keys(st.ownedBeasts || {}).length;
    const deployableCnt = (App.State.getDeployableGeneralIds ? App.State.getDeployableGeneralIds() : Object.keys(st.ownedGenerals || {})).length;
    const row1Y = 58, row2Y = 114, stepX = 56, leftX0 = 18;
    drawFloatingImageBadge(ctx, 'icon_roster', leftX0, row1Y, '名将营', st.deployIds.length < Math.min(5, deployableCnt), time, () => {
      App.Main.goScene('roster');
    });
    drawFloatingImageBadge(ctx, 'icon_warehouse', leftX0 + stepX, row1Y, '军备仓库', chestCount > 0, time, () => {
      App.Main.goScene('warehouse');
    });
    drawFeatureBadge(ctx, 'arena', 'icon_arena', leftX0 + stepX * 2, row1Y, '演武场', (st.arenaTickets || 0) > 0, time, 'arena');
    const supIdleReady = ownedBeastCnt >= 2 && (st.supportBeastIds || []).filter((id) => id && st.ownedBeasts[id] && id !== st.activeBeastId).length < Math.min(2, ownedBeastCnt - (st.activeBeastId ? 1 : 0));
    drawFloatingImageBadge(
      ctx,
      'icon_beast_sanctuary',
      leftX0 + stepX * 3,
      row1Y,
      '四象兽栏',
      (ownedBeastCnt > 0 && !st.activeBeastId) || supIdleReady,
      time,
      () => App.Main.goScene('beast', supIdleReady && st.activeBeastId ? { subTab: 'guard' } : undefined),
      st.activeBeastId ? '上阵中' : (supIdleReady ? '可护法' : '')
    );
    drawFeatureBadge(ctx, 'hire', 'icon_hire', leftX0 + stepX * 4, row1Y, '聚贤佣馆', false, time, 'hire', '', '佣');
    drawFloatingImageBadge(ctx, 'icon_mail', leftX0 + stepX * 5, row1Y, '邮件公告', App.API.hasUnclaimedMail(), time, () => {
      App.Main.goScene('mail');
    });

    // ★ 左右两侧精致古风翻章侧签
    drawSideChapterArrow(ctx, -1, 8, 248, activeChapter <= 1, () => {
      activeChapter = Math.max(1, activeChapter - 1);
      selectedOrder = (activeChapter - 1) * App.Config.STAGES_PER_CHAPTER + 1;
    });
    drawSideChapterArrow(ctx, 1, W - 34, 248, activeChapter >= App.Config.TOTAL_CHAPTERS, () => {
      activeChapter = Math.min(App.Config.TOTAL_CHAPTERS, activeChapter + 1);
      selectedOrder = (activeChapter - 1) * App.Config.STAGES_PER_CHAPTER + 1;
    });

    const beastUnlocked = (st.lordLevel || 1) >= App.State.BEAST_UNLOCK_LORD_LV;
    const rx = (col) => W - 58 - col * stepX;

    drawFeatureBadge(ctx, 'forge', 'icon_forge', leftX0, row2Y, '锻器坊', false, time, 'forge');
    drawFeatureBadge(ctx, 'camp', 'icon_camp', leftX0 + stepX, row2Y, '演武营', false, time, 'camp');
    drawFeatureBadge(ctx, 'market', 'icon_market', leftX0 + stepX * 2, row2Y, '坊市', false, time, 'market');
    const maxDeployCap = (App.Config.PARAMS && App.Config.PARAMS.maxDeploy) || 5;
    drawFloatingImageBadge(
      ctx,
      'res_power',
      leftX0 + stepX * 3,
      row2Y,
      '排兵布阵',
      st.deployIds.length < Math.min(maxDeployCap, deployableCnt),
      time,
      () => openDeployModal(),
      `${st.deployIds.length}/${maxDeployCap}将`,
      '阵'
    );
    drawFeatureBadge(ctx, 'rank', 'icon_rank', leftX0 + stepX * 4, row2Y, '风云榜', false, time, 'rank', '', '榜');
    const pInfo = App.State.getPatrolInfo ? App.State.getPatrolInfo() : { canClaim: false, freeQuickLeft: 0, mins: 0 };
    const govReady = !!(pInfo.gov && pInfo.gov.canAutoAssign);
    const patrolTag = pInfo.mins >= 60 ? `${Math.floor(pInfo.mins / 60)}h待领` : (pInfo.freeQuickLeft > 0 ? '免费巡防' : (govReady ? '可任太守' : ''));
    drawFloatingImageBadge(
      ctx,
      'res_gold',
      leftX0 + stepX * 5,
      row2Y,
      '九州岁贡',
      pInfo.freeQuickLeft > 0 || pInfo.mins >= 30 || govReady,
      time,
      () => { showPatrolModal = true; },
      patrolTag,
      '贡'
    );

    drawFloatingImageBadge(
      ctx,
      'icon_beast_dungeon',
      rx(5),
      row1Y,
      '神兽副本',
      beastUnlocked && (st.ropes || 0) > 0,
      time,
      () => App.Main.goScene('beastDungeon'),
      beastUnlocked ? '' : 'Lv.15开'
    );
    drawFeatureBadge(ctx, 'shop', 'icon_shop', rx(4), row1Y, '铜钱商城', App.State.getShopRefreshSeconds() <= 0, time, 'shop');
    drawFeatureBadge(ctx, 'ingotShop', 'icon_ingot_shop', rx(3), row1Y, '元宝商店', App.State.getIngotShopRefreshSeconds() <= 0, time, 'ingotShop', '精品', '宝');
    drawFeatureBadge(ctx, 'wheel', 'icon_wheel', rx(2), row1Y, '天命抽奖', (st.wheelTickets || 0) > 0, time, 'wheel');
    drawFloatingImageBadge(ctx, 'icon_welfare', rx(1), row1Y, '福利活动', App.State.hasUnclaimedActivity(), time, () => {
      App.Main.goScene('activity');
    });
    drawFloatingImageBadge(ctx, 'icon_settings', rx(0), row1Y, '系统设置', false, time, () => {
      App.Main.goScene('settings');
    }, '', '设');

    drawFloatingImageBadge(ctx, 'icon_invite', rx(5), row2Y, '邀请好友', false, time, () => App.Main.goScene('invite'), '', '邀');
    drawFeatureBadge(ctx, 'guild', 'icon_guild', rx(4), row2Y, '联盟', false, time, 'guild', '', '盟');
    drawFeatureBadge(ctx, 'worldBoss', 'icon_worldboss', rx(3), row2Y, '世界BOSS', isWorldBossOpen(), time, 'worldBoss', isWorldBossOpen() ? '进行中' : '', '魔');
    drawFeatureBadge(ctx, 'challenge', 'icon_challenge', rx(2), row2Y, '征战秘境', false, time, 'challenge');
    drawFeatureBadge(
      ctx, 'tower', 'icon_tower', rx(1), row2Y, '铜雀天梯',
      (st.towerFloor || 0) > 0 && st.towerIdleDate !== App.State.getTodayKey(),
      time, 'tower'
    );
    drawFeatureBadge(
      ctx, 'demon', 'icon_demon', rx(0), row2Y, '魔将挑战',
      cachedDemonRedDot,
      time, 'demon'
    );

    const chLevels = App.Config.getChapterStages(activeChapter, st.factionId);
    if (!chLevels.some((l) => l.order === selectedOrder)) {
      const unlockedInCh = chLevels.filter((l) => App.State.isStageUnlocked(l.order));
      selectedOrder = (unlockedInCh[unlockedInCh.length - 1] || chLevels[0]).order;
    }

    const layoutKey = `${activeChapter}|${st.factionId || ''}|${chLevels.length}|${chLevels[0] ? chLevels[0].name : ''}`;
    const layoutNodes = layoutChapterCities(ctx, chLevels, layoutKey);

    ctx.save();
    for (let i = 0; i < layoutNodes.length - 1; i++) {
      const a = layoutNodes[i], b = layoutNodes[i + 1];
      const unlocked = App.State.isStageUnlocked(b.lv.order);
      ctx.strokeStyle = unlocked ? '#dc2626' : 'rgba(68, 64, 60, 0.45)';
      ctx.lineWidth = unlocked ? 3.5 : 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath(); ctx.moveTo(a.nx, a.ny); ctx.lineTo(b.nx, b.ny); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // 先按纵深绘制所有城池关隘原画，再统一在顶层绘制防重叠城池名牌，杜绝任何遮挡与叠字
    const sortedBodies = cachedSortedBodies || layoutNodes.slice().sort((a, b) => a.ny - b.ny);
    sortedBodies.forEach((n) => {
      const unlocked = App.State.isStageUnlocked(n.lv.order);
      drawCityFortressBody(ctx, n, unlocked, n.lv.order === selectedOrder, time);
    });

    layoutNodes.forEach((n) => {
      const lv = n.lv;
      const unlocked = App.State.isStageUnlocked(lv.order);
      const cleared = lv.order <= (st.maxClearedOrder || 0);
      drawCityNodeLabel(ctx, n, unlocked, cleared, lv.order === selectedOrder);
      App.UI.addHit(n.nx - 42, n.ny - 46, 84, 88, () => { selectedOrder = lv.order; });
    });

    // 底部选中关隘精致详情条（所有已攻克关卡统一并排展示【扫 荡】与【再次征战】双主按钮！）
    const sel = chLevels.find((l) => l.order === selectedOrder) || chLevels[0];
    const selUnlocked = App.State.isStageUnlocked(sel.order);
    const selCleared = sel.order <= (st.maxClearedOrder || 0);
    const boss = App.Config.GENERALS[sel.bossId];
    const tier = App.Config.RECRUIT_TIERS[boss.recruitTier];
    const eqTpl = App.Config.EQUIP_TEMPLATES[sel.fixedDrop];
    const matId = sel.matDrop || `art_mat_${String((((sel.chapter || Math.ceil(sel.order / 8)) - 1) % 36) + 1).padStart(2, '0')}_${Math.floor(((sel.order - 1) % 8) / 2) + 1}`;
    const matItem = App.Config.ITEMS[matId] || null;
    const bossOwnedOrHosted = !!(st.ownedGenerals[boss.id] || (st.hostedGenerals && st.hostedGenerals[boss.id]));

    const cardW = selCleared ? 792 : 684;
    const cardH = 70;
    const cardX = Math.round((W - cardW) / 2);
    const cardY = 456;

    const primaryBtnX = selCleared ? (cardX + cardW - 224) : (cardX + cardW - 122);
    const deployBtnW = 92;
    const deployBtnX = primaryBtnX - deployBtnW - 8;
    const matBoxX = matItem ? (deployBtnX - 46) : deployBtnX;
    const eqBoxX = eqTpl ? (matBoxX - 46) : matBoxX;

    App.UI.drawPanel(ctx, cardX, cardY, cardW, cardH, {
      r: 12, bg: 'rgba(245, 232, 200, 0.96)', border: '#7c4a21', lineWidth: 2.2,
    });
    App.Portraits.drawGeneralPortrait(ctx, boss.id, cardX + 10, cardY + 8, 54, { radius: 8, lineWidth: 1.8, raw: true });

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 13px "PingFang SC", sans-serif';
    const recPower = App.Config.scaleRecommendedPower('city', sel.recommendedPower || sel.recommendedLv * 1450, sel);
    const titleMaxW = eqBoxX - (cardX + 74) - 8;
    ctx.fillText(
      `第 ${sel.order} 关 · ${sel.name}${selCleared ? ' [已攻克]' : ''}  (战力 ${recPower} · 经验+${sel.lordExp})`,
      cardX + 72, cardY + 26, Math.max(180, titleMaxW)
    );
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    const bossTag = `守将：${boss.name} [${tier.label}·${bossOwnedOrHosted ? '已归顺' : '可招降'}]`;
    ctx.fillText(bossTag, cardX + 72, cardY + 51);
    const rwX = cardX + 72 + ctx.measureText(bossTag).width + 8;
    const fcMult = !selCleared ? (1 + ((App.Config.PARAMS && App.Config.PARAMS.stageFirstClearBonusMult) != null ? App.Config.PARAMS.stageFirstClearBonusMult : 1)) : 1;
    const dispGold = Math.round(sel.rewardGold * fcMult);
    const dispSoul = Math.round(sel.rewardSoul * fcMult);
    App.UI.drawMiniIcon(ctx, 'res_gold', rwX, cardY + 38, 15);
    ctx.fillStyle = '#b45309';
    const gTxt = `${!selCleared && fcMult > 1 ? '首通+' : '+'}${dispGold}`;
    ctx.fillText(gTxt, rwX + 16, cardY + 51);
    const sOff = rwX + 20 + ctx.measureText(gTxt).width + 6;
    App.UI.drawMiniIcon(ctx, 'res_soul', sOff, cardY + 38, 15);
    ctx.fillStyle = '#7e22ce';
    ctx.fillText(`+${dispSoul}`, sOff + 16, cardY + 51);
    ctx.restore();

    if (eqTpl) {
      App.Sprites.drawEquipIcon(ctx, eqTpl.id, eqBoxX, cardY + 8, 40, { radius: 7, lineWidth: 1.6 });
      ctx.save();
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 9px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(eqTpl.name.slice(0, 4), eqBoxX + 20, cardY + 60);
      ctx.restore();
    }

    if (matItem) {
      const mHave = App.State.getItemCount(matId);
      App.Sprites.drawEquipIcon(ctx, matId, matBoxX, cardY + 8, 40, { radius: 7, lineWidth: 1.6, noAnim: true });
      ctx.save();
      ctx.fillStyle = 'rgba(127, 29, 29, 0.88)';
      App.UI.roundRect(ctx, matBoxX + 2, cardY + 6, 26, 11, 3);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 7.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('灵材', matBoxX + 15, cardY + 14.5);
      ctx.fillStyle = '#991b1b';
      ctx.font = 'bold 9px "PingFang SC", sans-serif';
      ctx.fillText(matItem.name.slice(0, 4), matBoxX + 20, cardY + 60);
      ctx.restore();
      App.UI.addHit(matBoxX, cardY + 6, 42, 58, () => {
        const pairIdx = Math.floor(((sel.order - 1) % 8) / 2);
        const s1 = (sel.chapter - 1) * 8 + pairIdx * 2 + 1;
        App.UI.showToast(`法宝灵材【${matItem.name}】（库存×${mHave}）· 第${sel.chapter}章 第${s1}~${s1 + 1}关小概率掉落！`, '#fde047');
      });
    }

    // ★ 首页底部出战栏专属【排兵布阵】按钮（下方仅在有神兽上阵时展示「白虎已上阵」，无神兽上阵时不展示）
    const hasActiveBeast = !!(st.activeBeastId && st.ownedBeasts && st.ownedBeasts[st.activeBeastId] && App.Config.BEASTS[st.activeBeastId]);
    const beastSubText = hasActiveBeast
      ? `${App.Config.getBeastDisplayName ? App.Config.getBeastDisplayName(st.activeBeastId, st.ownedBeasts[st.activeBeastId], true) : App.Config.BEASTS[st.activeBeastId].shortName}已上阵`
      : undefined;
    App.UI.drawButton(ctx, deployBtnX, cardY + 9, deployBtnW, 52, '排兵布阵', {
      r: 9,
      grad: ['#7c2d12', '#451a03'],
      border: '#facc15',
      fontSize: 13.5,
      subText: beastSubText,
    }, () => openDeployModal());

    const staCost = App.State.getStaminaCost(sel.staminaCost);
    const hasSta = st.stamina >= staCost;
    const adsOn = !!(App.Config && App.Config.isAdEnabled && App.Config.isAdEnabled());
    const showAdSta = !hasSta && adsOn;
    const adStaGain = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('stamina', 'stamina') : 20;
    if (selCleared) {
      App.UI.drawButton(ctx, primaryBtnX, cardY + 9, 102, 52, showAdSta ? '补粮草' : '扫 荡', {
        r: 9,
        icon: showAdSta ? undefined : 'sweep',
        grad: showAdSta ? ['#9a4412', '#5c2408'] : ['#c86d19', '#85420e'],
        border: '#fde68a',
        fontSize: 14,
        subText: showAdSta ? `+${adStaGain}粮草` : `耗${staCost}粮秒领`,
      }, () => {
        if (!hasSta) {
          if (!adsOn) {
            App.UI.showToast('粮草体力不足，请等待恢复或前往军备仓库使用行军粮草丹！', '#fbbf24');
            return;
          }
          App.Platform.showRewardedAd('stamina', `观看激励视频，立刻恢复 +${adStaGain} 粮草体力！`, () => {
            App.State.claimAd('stamina');
          });
          return;
        }
        App.State.sweepStage(sel).then((res) => { if (res.ok) sweepModal = { stage: sel, res: res.sweep }; });
      });

      const replayBtnX = cardX + cardW - 114;
      App.UI.drawButton(ctx, replayBtnX, cardY + 9, 104, 52, '再次征战', {
        r: 9,
        grad: ['#b91c1c', '#7f1d1d'],
        border: '#fde68a',
        fontSize: 13.5,
        subText: !bossOwnedOrHosted ? `生擒·${boss.name}` : (showAdSta ? `+${adStaGain}粮草` : `耗 ${staCost} 粮草`),
      }, () => {
        if (!hasSta) {
          if (!adsOn) {
            App.UI.showToast('粮草体力不足，请等待恢复或前往军备仓库使用行军粮草丹！', '#fbbf24');
            return;
          }
          App.Platform.showRewardedAd('stamina', `粮草不足！观看激励视频立即恢复 +${adStaGain} 粮草并再次征战！`, () => {
            App.State.claimAd('stamina').then((res) => {
              if (res && res.ok) App.Main.startBattle('city', sel.order, { level: sel });
            });
          });
          return;
        }
        App.Main.startBattle('city', sel.order, { level: sel });
      });
    } else {
      App.UI.drawButton(ctx, primaryBtnX, cardY + 9, 112, 52, !selUnlocked ? '未解锁' : (showAdSta ? '补粮草' : '击鼓应战'), {
        r: 9,
        icon: !selUnlocked ? 'lock' : undefined,
        grad: showAdSta ? ['#9a4412', '#5c2408'] : ['#b91c1c', '#7f1d1d'],
        border: '#fde68a',
        fontSize: 14,
        subText: !selUnlocked ? `先通第${sel.order - 1}关` : (showAdSta ? `+${adStaGain}粮草` : `耗 ${staCost} 粮草`),
        disabled: !selUnlocked,
      }, () => {
        if (!hasSta) {
          if (!adsOn) {
            App.UI.showToast('粮草体力不足，请等待恢复或前往军备仓库使用行军粮草丹！', '#fbbf24');
            return;
          }
          App.Platform.showRewardedAd('stamina', `观看激励视频，立刻恢复 +${adStaGain} 粮草体力！`, () => {
            App.State.claimAd('stamina');
          });
          return;
        }
        App.Main.startBattle('city', sel.order, { level: sel });
      });
    }

    inMapRender = true;
    drawTopBar(ctx);
    inMapRender = false;
    drawProfileModal(ctx);

    if (showDeployModal) {
      drawDeployModal(ctx, st);
    }

    if (showPatrolModal) {
      drawPatrolModal(ctx, st);
    }

    // ★ 扫荡战利品捷报弹窗（支持连续一键再扫荡与连扫5次！）
    if (sweepModal && sweepModal.res) {
      drawSweepModal(ctx, st, sweepModal);
    }
  }

  function drawPatrolModal(ctx, st) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const p = App.State.getPatrolInfo ? App.State.getPatrolInfo() : {
      cleared: 0, goldPerHour: 450, soulPerHour: 20, expPerHour: 70,
      maxHours: 12, minClaimMinutes: 5, mins: 0, hrs: 0, gold: 0, soul: 0, exp: 0, boxes: 0,
      canClaim: false, freeQuickLeft: 0, quickHours: 2, quickGold: 900, quickSoul: 40, quickExp: 140, adLeft: 4,
    };

    App.UI.addHit(0, 0, W, H, () => {});
    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 2, 0.75)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const mw = 684, mh = 438;
    const mx = Math.round((W - mw) / 2), my = Math.round((H - mh) / 2) + 8;
    const gov = p.gov || (App.State.getGovernorInfo ? App.State.getGovernorInfo() : { slots: [], openCount: 0, activeCount: 0, idleCount: 0, canAutoAssign: false, totalBonusPct: 0, matBonusPct: 0 });

    App.UI.drawPanel(ctx, mx, my, mw, mh, { r: 16, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2.6 });
    App.UI.drawPanel(ctx, mx + 8, my + 8, mw - 16, mh - 16, { r: 12, bg: '#faf0d7', border: '#c9a368', lineWidth: 1.2 });
    App.UI.drawWoodHeader(ctx, mx + 16, my + 12, mw - 32, 38);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16.5px "PingFang SC", serif';
    ctx.fillText('九州城池岁贡 · 离线军饷 & 六督府太守委任', W / 2 - 48, my + 31);
    ctx.restore();

    const staSubCnt = (App.API && App.API.getSubscribeQuota) ? App.API.getSubscribeQuota('stamina') : 0;
    App.UI.drawButton(ctx, mx + mw - 136, my + 17, 112, 28, staSubCnt > 0 ? `已订满体(${staSubCnt})` : '满体微信提醒', {
      r: 7, grad: staSubCnt > 0 ? ['#15803d', '#166534'] : ['#0369a1', '#0c4a6e'], border: '#fde68a', fontSize: 10.5,
    }, () => {
      if (App.API && App.API.subscribeNotice) App.API.subscribeNotice('stamina');
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#5c2c16';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    const govExtraTxt = gov.totalBonusPct > 0 ? `  ·  ★太守加成 +${gov.totalBonusPct}% 岁贡 / +${gov.matBonusPct}% 灵材掉率` : '';
    ctx.fillText(`已收复关隘 ${p.cleared} 座  ·  +${p.goldPerHour} 铜钱/时  ·  +${p.soulPerHour} 将魂/时  ·  +${p.expPerHour} 经验/时${govExtraTxt}`, W / 2, my + 67, mw - 44);

    // 累计时长进度条
    const pct = Math.min(1, p.hrs / Math.max(1, p.maxHours));
    ctx.fillStyle = 'rgba(69, 26, 3, 0.86)';
    App.UI.roundRect(ctx, mx + 24, my + 75, mw - 48, 16, 8);
    ctx.fill();
    if (pct > 0) {
      const pg = ctx.createLinearGradient(mx + 24, my + 75, mx + 24 + (mw - 48) * pct, my + 75);
      pg.addColorStop(0, '#b45309');
      pg.addColorStop(1, '#f59e0b');
      ctx.fillStyle = pg;
      App.UI.roundRect(ctx, mx + 24, my + 75, Math.max(16, Math.round((mw - 48) * pct)), 16, 8);
      ctx.fill();
    }
    ctx.fillStyle = '#fffbeb';
    ctx.font = 'bold 10px "PingFang SC", sans-serif';
    const timeStr = p.mins >= 60 ? `${Math.floor(p.mins / 60)}小时${p.mins % 60}分` : `${p.mins}分钟`;
    ctx.fillText(`已积蓄 ${timeStr}（上限 ${p.maxHours} 小时，满 ${p.minClaimMinutes} 分钟可领）`, W / 2, my + 87);
    ctx.restore();

    const cards = [
      { icon: 'res_gold', title: `铜钱 +${p.gold}`, sub: `快速+${p.quickGold}`, border: '#c26a1b', col: '#7c2d12' },
      { icon: 'res_soul', title: `将魂 +${p.soul}`, sub: `快速+${p.quickSoul}`, border: '#9a5b25', col: '#581c87' },
      { icon: 'res_stage', title: `经验 +${p.exp}`, sub: p.boxes > 0 ? `附赠宝箱×${p.boxes}` : '每满3h掉宝箱', border: '#9a5b25', col: '#451a03' },
    ];
    cards.forEach((c, idx) => {
      const cw = 204, ch = 64, cx = mx + 24 + idx * 216, cy = my + 98;
      App.UI.drawPanel(ctx, cx, cy, cw, ch, { r: 9, bg: '#efe1be', border: c.border, lineWidth: 1.4 });
      App.UI.drawMiniIcon(ctx, c.icon, cx + 12, cy + 13, 38);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = c.col;
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(c.title, cx + 58, cy + 29);
      ctx.fillStyle = '#78350f';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText(c.sub, cx + 58, cy + 49);
      ctx.restore();
    });

    // 九州六督府 · 闲置名将太守委任栏
    const gx = mx + 20, gy = my + 170, gw = mw - 40, gh = 200;
    App.UI.drawPanel(ctx, gx, gy, gw, gh, { r: 10, bg: '#ead7b0', border: '#9a5b25', lineWidth: 1.5 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 12.5px "PingFang SC", serif';
    ctx.fillText(`九州六督府 · 闲置名将太守委任（已驻 ${gov.activeCount}/${gov.openCount} 府 · 闲置可派 ${gov.idleCount} 将）`, gx + 12, gy + 22);
    ctx.fillStyle = '#78350f';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText('未上阵名将入驻督府可大幅提高岁贡铜钱将魂，每入驻 1 府额外提升主线与扫荡法宝灵材掉率 +1.5%！', gx + 12, gy + 40, gw - 166);
    ctx.restore();

    App.UI.drawButton(ctx, gx + gw - 148, gy + 10, 136, 28, '⚡ 一键委任最优良将', {
      r: 7, grad: ['#c86d19', '#85420e'], border: '#fef08a', fontSize: 10.5,
      disabled: App.State.isBusy() || (gov.idleCount <= 0 && gov.activeCount >= gov.openCount),
    }, () => {
      App.State.assignGovernor(1, null, true);
    });

    const pickBestIdleForSlot = () => {
      const depSet = new Set(st.deployIds || []);
      const usedSet = new Set((gov.slots || []).map((s) => s.generalId).filter(Boolean));
      const cands = Object.keys(st.ownedGenerals || {}).filter((id) => !depSet.has(id) && !usedSet.has(id) && App.Config.GENERALS[id]);
      if (!cands.length) return null;
      cands.sort((a, b) => (App.State.getGovernorRateFor(b) - App.State.getGovernorRateFor(a)));
      return cands[0];
    };

    (gov.slots || []).forEach((sl, idx) => {
      const sw = 100, sh = 140;
      const sx = gx + 10 + idx * 105;
      const sy = gy + 49;
      const gCfg = sl.generalId ? App.Config.GENERALS[sl.generalId] : null;
      App.UI.drawPanel(ctx, sx, sy, sw, sh, {
        r: 8,
        bg: !sl.unlocked ? 'rgba(120, 113, 108, 0.22)' : (gCfg ? '#2f170b' : '#f7ebd2'),
        border: !sl.unlocked ? '#a8a29e' : (gCfg ? '#d97706' : '#b45309'),
        lineWidth: gCfg ? 1.8 : 1.2,
      });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = !sl.unlocked ? '#78716c' : (gCfg ? '#fde68a' : '#78350f');
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.fillText(sl.name, sx + sw / 2, sy + 16, sw - 8);

      if (!sl.unlocked) {
        ctx.fillStyle = '#78716c';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText('🔒', sx + sw / 2, sy + 64);
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(`破第${sl.unlockOrder}关开启`, sx + sw / 2, sy + 96);
      } else if (gCfg) {
        App.Portraits.drawGeneralPortrait(ctx, sl.generalId, sx + 23, sy + 24, 54, { radius: 8, lineWidth: 1.5 });
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(gCfg.name, sx + sw / 2, sy + 94, sw - 8);
        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.fillText(`岁贡+${Math.round((sl.rate || 0) * 100)}%`, sx + sw / 2, sy + 111);
        ctx.fillStyle = '#fca5a5';
        ctx.font = '9.5px "PingFang SC", sans-serif';
        ctx.fillText('点击卸任', sx + sw / 2, sy + 129);
      } else {
        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText('＋', sx + sw / 2, sy + 64);
        ctx.fillStyle = '#78350f';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(gov.idleCount > 0 ? '点击派将入驻' : '暂无闲置武将', sx + sw / 2, sy + 100, sw - 8);
      }
      ctx.restore();

      if (sl.unlocked) {
        App.UI.addHit(sx, sy, sw, sh, () => {
          if (sl.generalId) {
            App.State.assignGovernor(sl.slot, null, false);
          } else {
            const bestGid = pickBestIdleForSlot();
            if (!bestGid) {
              App.UI.showToast('当前没有未上阵的闲置名将可供委任，快去攻城招降吧！', '#fbbf24');
              return;
            }
            App.State.assignGovernor(sl.slot, bestGid, false);
          }
        });
      }
    });

    App.UI.drawButton(ctx, mx + 24, my + mh - 58, 198, 44, p.canClaim ? '征收当前岁贡' : `满${p.minClaimMinutes}分钟可领`, {
      r: 10,
      icon: p.canClaim ? 'tribute' : undefined,
      grad: p.canClaim ? ['#b91c1c', '#7f1d1d'] : ['#78716c', '#57534e'],
      border: '#fde68a',
      fontSize: 13,
      disabled: !p.canClaim,
    }, () => App.State.claimPatrol(false, false));

    const patrolAdsOn = !!(App.Config && App.Config.isAdEnabled && App.Config.isAdEnabled());
    if (p.freeQuickLeft > 0) {
      App.UI.drawButton(ctx, mx + 232, my + mh - 58, 256, 44, `免费快速巡防 ${p.quickHours}h`, {
        r: 10,
        icon: 'sweep',
        grad: ['#c86d19', '#85420e'],
        border: '#fde68a',
        fontSize: 12.5,
        subText: `立得 +${p.quickGold}铜钱 +宝箱×1`,
      }, () => App.State.claimPatrol(true, false));
    } else if (patrolAdsOn) {
      App.UI.drawAdButton(ctx, mx + 232, my + mh - 58, 256, 44, p.adLeft > 0 ? `快速巡防${p.quickHours}h (+${p.quickGold}钱)` : '今日巡防已满', {
        r: 10, fontSize: 11.5, disabled: p.adLeft <= 0,
      }, () => {
        App.Platform.showRewardedAd('stamina', `观看激励视频，立即征收 ${p.quickHours} 小时九州岁贡与关卡宝箱！`, () => {
          App.State.claimPatrol(true, true);
        });
      });
    } else {
      App.UI.drawButton(ctx, mx + 232, my + mh - 58, 256, 44, '今日快速巡防已用', {
        r: 10, grad: ['#78716c', '#57534e'], border: '#a8a29e', fontSize: 12.5,
        subText: '明日零点自动重置免费次数', disabled: true,
      });
    }

    App.UI.drawButton(ctx, mx + 498, my + mh - 58, 162, 44, '返回地图', {
      r: 10, grad: ['#6b3417', '#431d0b'], border: '#d4a34b', fontSize: 13,
    }, () => { showPatrolModal = false; });
  }

  function drawDeployModal(ctx, st) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const maxDep = (App.Config.PARAMS && App.Config.PARAMS.maxDeploy) || 5;
    const deployIds = (st.deployIds || []).slice(0, maxDep);
    const heroPower = App.State.getDeployHeroPower ? App.State.getDeployHeroPower() : App.State.getTeamPower();

    // 仅遮罩顶部状态栏下方区域，让顶部「破 X 城」右侧的「出战战力」胶囊全程可见并随布阵实时跳动！
    App.UI.addHit(0, 56, W, H - 56, () => {});
    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 2, 0.72)';
    ctx.fillRect(0, 56, W, H - 56);
    ctx.restore();

    const mx = 26, my = 58, mw = W - 52, mh = 472;
    App.UI.drawPanel(ctx, mx, my, mw, mh, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2.4 });

    // 1. 顶部点将台木匾标题栏（实时展示阵营共鸣与宿命羁绊激活状态）
    const lb = App.State.getLineupBondSummary ? App.State.getLineupBondSummary() : { activeFaction: null, activeBonds: [] };
    App.UI.drawPanel(ctx, mx + 10, my + 8, mw - 20, 40, { r: 9, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14.5px "PingFang SC", serif';
    ctx.fillText('九州点将台 · 排兵布阵', mx + 20, my + 28);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.fillText(`英雄战力 ${heroPower} · 军团总战力 ${App.State.getTeamPower()} (${deployIds.length}/${maxDep}将)`, mx + 188, my + 20, 386);

    const facBondStr = lb.activeFaction ? `★${lb.activeFaction.name || lb.activeFaction.label}` : '同阵营3人激活共鸣';
    const heroBondStr = (lb.activeBonds && lb.activeBonds.length)
      ? `羁绊：${lb.activeBonds.map((b) => '【' + b.name + '】').join('')}`
      : '同阵名将激活宿命羁绊';
    ctx.fillStyle = (lb.activeFaction || (lb.activeBonds && lb.activeBonds.length)) ? '#86efac' : '#fed7aa';
    ctx.font = 'bold 10px "PingFang SC", sans-serif';
    ctx.fillText(`${facBondStr}  |  ${heroBondStr}`, mx + 188, my + 36, 386);
    ctx.restore();

    // 一键最强上阵按钮（含已租用的在期佣将！）
    App.UI.drawButton(ctx, mx + mw - 322, my + 13, 118, 30, '一键最强上阵', {
      r: 7, grad: ['#c86d19', '#85420e'], border: '#fde68a', fontSize: 11,
    }, () => {
      const ownedIds = (App.State.getDeployableGeneralIds ? App.State.getDeployableGeneralIds() : Object.keys(st.ownedGenerals || {})).filter((id) => App.Config.GENERALS[id]);
      if (!ownedIds.length) return;
      ownedIds.sort((a, b) => App.State.getGeneralPower(b) - App.State.getGeneralPower(a));
      const bestLineup = ownedIds.slice(0, maxDep);
      const same = bestLineup.length === deployIds.length && bestLineup.every((id) => deployIds.indexOf(id) >= 0);
      if (same) {
        App.UI.showToast('当前已是战力最强的出战阵容！', '#fde047');
        return;
      }
      selectedDeploySlot = -1;
      App.State.setLineup(bestLineup);
    });

    App.UI.drawButton(ctx, mx + mw - 196, my + 13, 98, 30, '名将升星穿装', {
      r: 7, grad: ['#78350f', '#451a03'], border: '#d4a34b', fontSize: 11,
    }, () => {
      showDeployModal = false;
      App.Main.goScene('roster');
    });

    App.UI.drawButton(ctx, mx + mw - 90, my + 13, 72, 30, '✕ 完成', {
      r: 7, grad: ['#dc2626', '#991b1b'], border: '#fef08a', fontSize: 11.5,
    }, () => {
      showDeployModal = false;
      selectedDeploySlot = -1;
    });

    // 2. 上半区：5 个出战将领槽位 + 1 个随军神兽槽
    const slotLabels = ['先锋主将', '次锋猛将', '中军统帅', '左翼奇兵', '后军压阵'];
    const rarityColors = { SSS: '#f43f5e', SS: '#facc15', S: '#c084fc', A: '#38bdf8', B: '#4ade80' };
    const slotStartX = mx + 12;
    const slotY = my + 55;
    const slotW = 139;
    const slotH = 128;
    const slotGap = 7;

    for (let i = 0; i < maxDep; i++) {
      const sx = slotStartX + i * (slotW + slotGap);
      const gid = deployIds[i] || null;
      const isSel = selectedDeploySlot === i;

      if (gid && App.Config.GENERALS[gid]) {
        const g = App.Config.GENERALS[gid];
        const stats = App.State.getGeneralStats(gid);
        const pwr = stats ? stats.power : 0;
        const troopMeta = App.Config.getGeneralTroopMeta ? App.Config.getGeneralTroopMeta(gid) : { short: '兵', name: '步兵', color: '#fbbf24', bg: '#78350f' };
        const rarCol = rarityColors[g.rarity] || '#d4a34b';

        App.UI.drawPanel(ctx, sx, slotY, slotW, slotH, {
          r: 10,
          bg: isSel ? '#451a03' : '#2f170b',
          border: isSel ? '#fde047' : rarCol,
          lineWidth: isSel ? 2.4 : 1.7,
        });

        App.Portraits.drawGeneralPortrait(ctx, gid, sx + 8, slotY + 22, 52, { radius: 8, border: rarCol, lineWidth: 1.6 });

        // 顶部阵位签 + 统率兵种徽标
        ctx.save();
        ctx.fillStyle = isSel ? '#facc15' : '#fde68a';
        ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}号·${slotLabels[i] || '出战'}`, sx + 8, slotY + 15);

        const slotRarDisp = App.Config.getRarityLabel ? App.Config.getRarityLabel(gid, stats) : g.rarity;
        ctx.fillStyle = troopMeta.bg || '#78350f';
        App.UI.roundRect(ctx, sx + slotW - 50, slotY + 4, 44, 14, 4);
        ctx.fill();
        ctx.fillStyle = troopMeta.color || '#fef08a';
        ctx.font = 'bold 8px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${slotRarDisp}·${troopMeta.short}`, sx + slotW - 28, slotY + 14, 42);

        // 右侧武将名、星级等级与战力
        ctx.textAlign = 'left';
        ctx.fillStyle = stats && stats.isRented ? '#99f6e4' : '#fef08a';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        const slotPrefix = `${stats && stats.isRented ? '[佣]' : ''}${stats && stats.ascendInfo ? `[${stats.ascendInfo.glyph}]` : ''}`;
        ctx.fillText(`${slotPrefix}${g.name}`, sx + 66, slotY + 37, slotW - 72);

        ctx.fillStyle = '#e7d5b8';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(`Lv.${stats ? stats.lv : 1}  ${'★'.repeat(Math.min(5, stats ? stats.star : 1))}`, sx + 66, slotY + 54, slotW - 72);

        ctx.fillStyle = '#4ade80';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(`战力 ${pwr}`, sx + 66, slotY + 71, slotW - 72);

        ctx.fillStyle = '#fde68a';
        ctx.font = '9px "PingFang SC", sans-serif';
        ctx.fillText(`统兵：${troopMeta.name}`, sx + 8, slotY + 89);
        ctx.restore();

        // 点击上半卡片：选中/取消选中该槽位以便一键替换
        App.UI.addHit(sx, slotY, slotW, 94, () => {
          selectedDeploySlot = selectedDeploySlot === i ? -1 : i;
        });

        // 底部按钮组：选中换将 / 卸下
        App.UI.drawButton(ctx, sx + 6, slotY + 96, 62, 25, isSel ? '✓ 待替换' : '点此换将', {
          r: 6,
          grad: isSel ? ['#d97706', '#92400e'] : undefined,
          bg: isSel ? undefined : '#57301a',
          border: isSel ? '#fef08a' : '#b45309',
          fontSize: 9.5,
        }, () => {
          selectedDeploySlot = selectedDeploySlot === i ? -1 : i;
        });

        App.UI.drawButton(ctx, sx + 72, slotY + 96, 61, 25, '卸下阵位', {
          r: 6,
          bg: '#6b2118',
          border: '#fca5a5',
          fontSize: 9.5,
          disabled: deployIds.length <= 1,
        }, () => {
          selectedDeploySlot = -1;
          App.State.toggleDeploy(gid);
        });
      } else {
        App.UI.drawPanel(ctx, sx, slotY, slotW, slotH, {
          r: 10, bg: 'rgba(120, 53, 15, 0.12)', border: '#a16207', lineWidth: 1.4,
        });
        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#92400e';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(`${i + 1}号 · ${slotLabels[i] || '空位'}`, sx + slotW / 2, slotY + 26);
        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText('＋', sx + slotW / 2, slotY + 66);
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText('点击下方名将上阵', sx + slotW / 2, slotY + 96);
        ctx.restore();
      }
    }

    // 第 6 格：随军四象神兽快捷槽
    const bx = slotStartX + maxDep * (slotW + slotGap) + 2;
    const bw = mx + mw - 12 - bx;
    const ownedBeasts = Object.keys(st.ownedBeasts || {});
    const curBeastId = st.activeBeastId && st.ownedBeasts[st.activeBeastId] ? st.activeBeastId : null;
    const curBeastCfg = curBeastId ? App.Config.BEASTS[curBeastId] : null;
    const curBeastStats = curBeastId ? App.State.getBeastStats(curBeastId) : null;

    App.UI.drawPanel(ctx, bx, slotY, bw, slotH, {
      r: 10, bg: '#172554', border: curBeastCfg ? curBeastCfg.glow : '#60a5fa', lineWidth: 1.6,
    });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#bae6fd';
    ctx.font = 'bold 10px "PingFang SC", sans-serif';
    ctx.fillText('随军四象神兽', bx + bw / 2, slotY + 16);
    if (curBeastCfg) {
      const curBeastShort = App.Config.getBeastDisplayName ? App.Config.getBeastDisplayName(curBeastId, st.ownedBeasts[curBeastId], true) : curBeastCfg.shortName;
      App.Portraits.drawBeastPortrait(ctx, curBeastId, bx + (bw - 48) / 2, slotY + 22, 48, { radius: 8, border: curBeastCfg.glow, lineWidth: 1.6 });
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(`${curBeastShort} · 战+${curBeastStats ? curBeastStats.power : 0}`, bx + bw / 2, slotY + 84, bw - 8);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(ownedBeasts.length ? '当前神兽休息中' : `Lv.${App.State.BEAST_UNLOCK_LORD_LV} 解锁收服`, bx + bw / 2, slotY + 62, bw - 10);
    }
    ctx.restore();

    App.UI.drawButton(ctx, bx + 8, slotY + 96, bw - 16, 25, ownedBeasts.length ? '切换神兽' : '前往兽栏', {
      r: 6, grad: ['#0284c7', '#0369a1'], border: '#bae6fd', fontSize: 10,
    }, () => {
      if (!ownedBeasts.length) {
        showDeployModal = false;
        App.Main.goScene('beastDungeon');
        return;
      }
      const cycle = ownedBeasts.concat([null]);
      const nextIdx = (cycle.indexOf(curBeastId) + 1) % cycle.length;
      const nextBid = cycle[nextIdx];
      App.State.setActiveBeast(nextBid).then((res) => {
        if (res.ok) {
          const nextName = nextBid && App.Config.getBeastDisplayName ? App.Config.getBeastDisplayName(nextBid, st.ownedBeasts[nextBid]) : (nextBid ? App.Config.BEASTS[nextBid].name : '');
          App.UI.showToast(nextBid ? `已派【${nextName}】随军助阵！` : '神兽已切换为休息状态', '#fde047');
        }
      });
    });

    // 3. 下半区：麾下已招降名将候选池（支持兵种筛选 + 分页 + 点击一键上阵/替换）
    const poolY = my + 190;
    const poolH = mh - 200;
    App.UI.drawPanel(ctx, mx + 10, poolY, mw - 20, poolH, {
      r: 10, bg: '#ead7b0', border: '#9a5b25', lineWidth: 1.5,
    });

    const troopFilters = [
      { id: 'all', label: '全部名将' },
      { id: 'spear', label: '刀盾步兵' },
      { id: 'pike', label: '精锐枪兵' },
      { id: 'archer', label: '神射弓兵' },
      { id: 'cavalry', label: '铁甲骑兵' },
      { id: 'mage', label: '玄术方士' },
    ];
    let fx = mx + 20;
    troopFilters.forEach((tf) => {
      const active = deployFilterTroop === tf.id;
      App.UI.drawButton(ctx, fx, poolY + 8, 72, 25, tf.label, {
        r: 6,
        grad: active ? ['#b45309', '#78350f'] : undefined,
        bg: active ? undefined : '#d6be8f',
        border: active ? '#fef08a' : '#92400e',
        color: active ? '#fffbeb' : '#451a03',
        fontSize: 10,
      }, () => {
        deployFilterTroop = tf.id;
        deployPage = 0;
      });
      fx += 77;
    });

    const allDeployable = App.State.getDeployableGeneralIds ? App.State.getDeployableGeneralIds() : Object.keys(st.ownedGenerals || {});
    const allOwned = allDeployable.filter((gid) => {
      if (!App.Config.GENERALS[gid]) return false;
      if (deployFilterTroop === 'all') return true;
      const tid = App.Config.getGeneralTroopId ? App.Config.getGeneralTroopId(gid) : 'spear';
      return tid === deployFilterTroop;
    });

    // 排序：已上阵优先（保持槽位顺序），其余按单将战力由高到低排列
    allOwned.sort((a, b) => {
      const ia = deployIds.indexOf(a);
      const ib = deployIds.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return App.State.getGeneralPower(b) - App.State.getGeneralPower(a);
    });

    const perPage = 10; // 2 排 × 5 列
    const totalP = Math.max(1, Math.ceil(allOwned.length / perPage));
    if (deployPage >= totalP) deployPage = totalP - 1;
    if (deployPage < 0) deployPage = 0;
    const pageList = allOwned.slice(deployPage * perPage, (deployPage + 1) * perPage);

    App.UI.drawPagination(ctx, mx + mw - 332, poolY + 8, 310, 25, deployPage, totalP, (np) => {
      deployPage = np;
    }, { bg: '#5c2c16', border: '#a16207' });

    const cw = 166, chCard = 96, cGapX = 9, cGapY = 8;
    const gridX = mx + 20;
    const gridY = poolY + 40;

    pageList.forEach((gid, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const cx = gridX + col * (cw + cGapX);
      const cy = gridY + row * (chCard + cGapY);
      const g = App.Config.GENERALS[gid];
      const stats = App.State.getGeneralStats(gid);
      const pwr = stats ? stats.power : 0;
      const inLineup = deployIds.indexOf(gid) >= 0;
      const troopMeta = App.Config.getGeneralTroopMeta ? App.Config.getGeneralTroopMeta(gid) : { short: '兵', name: '步兵', color: '#fbbf24', bg: '#78350f' };
      const rarCol = rarityColors[g.rarity] || '#854d0e';

      App.UI.drawPanel(ctx, cx, cy, cw, chCard, {
        r: 9,
        bg: inLineup ? '#2f2414' : '#f7ebd2',
        border: inLineup ? '#4ade80' : rarCol,
        lineWidth: inLineup ? 2.0 : 1.4,
      });

      App.Portraits.drawGeneralPortrait(ctx, gid, cx + 8, cy + 10, 50, { radius: 7, border: rarCol, lineWidth: 1.5 });

      const cardRarDisp = App.Config.getRarityLabel ? App.Config.getRarityLabel(gid, stats) : g.rarity;
      ctx.save();
      ctx.fillStyle = troopMeta.bg || '#78350f';
      App.UI.roundRect(ctx, cx + 6, cy + 64, 54, 15, 4);
      ctx.fill();
      ctx.fillStyle = troopMeta.color || '#fef08a';
      ctx.font = 'bold 8px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cardRarDisp}·${troopMeta.short}`, cx + 33, cy + 75, 50);

      ctx.textAlign = 'left';
      ctx.fillStyle = inLineup ? '#fef08a' : (stats && stats.isRented ? '#0f766e' : '#451a03');
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      const cardPrefix = `${stats && stats.isRented ? '[佣]' : ''}${stats && stats.ascendInfo ? `[${stats.ascendInfo.glyph}]` : ''}`;
      ctx.fillText(`${cardPrefix}${g.name}`, cx + 64, cy + 24, cw - 70);

      ctx.fillStyle = inLineup ? '#e7d5b8' : '#78350f';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(`Lv.${stats ? stats.lv : 1} ${'★'.repeat(Math.min(5, stats ? stats.star : 1))}`, cx + 64, cy + 40, cw - 70);

      ctx.fillStyle = inLineup ? '#4ade80' : '#b45309';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`战力 ${pwr}`, cx + 64, cy + 56, cw - 70);
      ctx.restore();

      const canReplaceSlot = !inLineup && selectedDeploySlot >= 0 && selectedDeploySlot < deployIds.length;
      const actionLabel = inLineup
        ? '✓ 已上阵(卸下)'
        : (canReplaceSlot ? `替换${selectedDeploySlot + 1}号将位` : (deployIds.length >= maxDep ? '点上方换将' : '＋ 派遣上阵'));

      App.UI.drawButton(ctx, cx + 64, cy + 63, cw - 72, 25, actionLabel, {
        r: 6,
        grad: inLineup ? ['#15803d', '#166534'] : (canReplaceSlot ? ['#d97706', '#92400e'] : ['#dc2626', '#991b1b']),
        border: inLineup ? '#bbf7d0' : '#fef08a',
        fontSize: 9.5,
      }, () => {
        if (inLineup) {
          if (deployIds.length <= 1) {
            App.UI.showToast('至少需保留 1 位出战将领！', '#fbbf24');
            return;
          }
          selectedDeploySlot = -1;
          App.State.toggleDeploy(gid);
          return;
        }
        if (canReplaceSlot) {
          const nextIds = deployIds.slice();
          nextIds[selectedDeploySlot] = gid;
          selectedDeploySlot = -1;
          App.State.setLineup(nextIds);
          return;
        }
        if (deployIds.length < maxDep) {
          App.State.toggleDeploy(gid);
          return;
        }
        // 已满员时自动高亮最后一个槽位引导替换
        selectedDeploySlot = maxDep - 1;
        App.UI.showToast(`上阵已满 ${maxDep} 将！已为您选中 ${maxDep} 号阵位，再次点击即可直接替换！`, '#fde047');
      });
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = (lb.activeBonds && lb.activeBonds.length && selectedDeploySlot < 0) ? '#166534' : '#78350f';
    ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
    const hint = selectedDeploySlot >= 0 && deployIds[selectedDeploySlot]
      ? `正在替换【${selectedDeploySlot + 1}号阵位 · ${App.Config.GENERALS[deployIds[selectedDeploySlot]].name}】，点击下方任意未上阵名将即可一键换上！`
      : ((lb.activeBonds && lb.activeBonds.length)
        ? `★ 当前生效宿命羁绊：${lb.activeBonds.map((b) => `【${b.name}】(${b.desc})`).join('  ·  ')}`
        : '提示：上阵将领决定局内派兵兵种，凑齐同阵营 3/4/5 将或桃园/五虎/五子/四督等组合享巨幅羁绊加成！');
    ctx.fillText(hint, W / 2, poolY + poolH - 10, mw - 40);
    ctx.restore();
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
    const sweepCnt = r.count || 1;
    App.UI.drawPanel(ctx, W / 2 - 148, my - 22, 296, 44, { r: 22, bg: '#b45309', border: '#fef08a', lineWidth: 2.4 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 19px "PingFang SC", serif';
    ctx.fillText(`扫荡大捷 · ${r.stageName}${sweepCnt > 1 ? ' ×' + sweepCnt + '次' : ''}`, W / 2, my + 6);

    if (r.lvInfo && r.lvInfo.leveledUp) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`★ 恭喜主公升至 Lv.${r.lvInfo.newLv} ★`, W / 2, my + 44);
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
        kind: 'equip', key: eqTpl.id, title: eqTpl.name.slice(0, 6),
        sub: r.bonusChest ? `${eqQual.name}+额外宝箱!` : `${eqQual.name}·已入库`, border: eqQual.color, col: '#fef08a',
      });
    }
    if (r.droppedMat && (r.matCount || 0) > 0) {
      const mCfg = App.Config.ITEMS[r.droppedMat] || { name: r.droppedMatName || '法宝灵材', quality: 'purple' };
      const mQual = App.Config.QUALITIES[mCfg.quality] || { color: '#f43f5e' };
      cards.push({
        kind: 'item', key: r.droppedMat, title: `${mCfg.name.slice(0, 5)}×${r.matCount}`,
        sub: '法宝炼材·入库!', border: mQual.color || '#f43f5e', col: '#fda4af',
      });
    }

    const cw = cards.length >= 5 ? 95 : 114, ch = 98, gap = cards.length >= 5 ? 8 : 12;
    let sx = W / 2 - (cards.length * cw + (cards.length - 1) * gap) / 2;
    const cy = my + 58;
    cards.forEach((c) => {
      App.UI.drawPanel(ctx, sx, cy, cw, ch, { r: 10, bg: 'rgba(16, 8, 4, 0.80)', border: c.border, lineWidth: 1.8 });
      if (c.kind === 'equip' || c.kind === 'item') {
        App.Sprites.drawEquipIcon(ctx, c.key, sx + (cw - 44) / 2, cy + 8, 44, { radius: 8, border: c.border, lineWidth: 1.8 });
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

    const sta1 = App.State.getStaminaCost(stage.staminaCost);
    const canAgain = st.stamina >= sta1;
    const multiN = Math.min(5, Math.max(2, Math.floor((st.stamina || 0) / Math.max(1, sta1))));
    const canMulti = st.stamina >= sta1 * 2;
    const sweepAdsOn = !!(App.Config && App.Config.isAdEnabled && App.Config.isAdEnabled());
    const adStaAmt = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('stamina', 'stamina') : 20;

    const runSweep = (n) => {
      if (st.stamina < sta1) {
        if (!sweepAdsOn) {
          App.UI.showToast('粮草体力不足，请等待恢复或前往军备仓库使用行军粮草丹！', '#fbbf24');
          return;
        }
        App.Platform.showRewardedAd('stamina', `观看激励视频，立刻恢复 +${adStaAmt} 粮草体力！`, () => {
          App.State.claimAd('stamina');
        });
        return;
      }
      App.State.sweepStage(stage, n).then((res) => {
        if (!res.ok) return;
        sweepModal = { stage, res: res.sweep };
        App.UI.showToast(n > 1 ? `连扫 ${res.sweep.count || n} 次完成！战利品已入库！` : '连续扫荡完成！战利品已入库！', '#4ade80');
      });
    };
    if (canAgain || !sweepAdsOn) {
      App.UI.drawButton(ctx, mx + 22, my + mh - 62, 162, 44, `再扫1次 (${sta1}粮)`, {
        r: 10, icon: 'sweep', grad: ['#c86d19', '#85420e'], border: '#fde68a', fontSize: 12.5, disabled: !canAgain,
      }, () => runSweep(1));
    } else {
      App.UI.drawAdButton(ctx, mx + 22, my + mh - 62, 162, 44, '免费补粮再扫', {
        r: 10, fontSize: 12.5,
      }, () => runSweep(1));
    }

    App.UI.drawButton(ctx, mx + 194, my + mh - 62, 174, 44, `连扫${multiN}次 (${sta1 * multiN}粮)`, {
      r: 10, icon: 'sweep', grad: ['#b45309', '#78350f'], border: '#fde68a', fontSize: 12.5, disabled: !canMulti,
    }, () => runSweep(multiN));

    App.UI.drawButton(ctx, mx + 378, my + mh - 62, 140, 44, '收下战利品', {
      r: 10, grad: ['#b91c1c', '#7f1d1d'], border: '#fde68a', fontSize: 13.5,
    }, () => { sweepModal = null; });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.map = { enter, render, drawTopBar, drawBottomNav };
})(typeof globalThis !== 'undefined' ? globalThis : window);
