(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 王者荣耀式左栏活动导航状态：'sign' | 'quest' | 'supply' | 'achieve' | 'wheel'
  let curTab = 'sign';
  let achPage = 0;
  let achCat = 'all';

  const ACH_CATS = [
    { id: 'all', label: '全部' },
    { id: 'stage', label: '征战' },
    { id: 'general', label: '名将' },
    { id: 'tower', label: '天梯' },
    { id: 'power', label: '战力' },
    { id: 'rare', label: '神兽/神器' },
  ];

  // 右侧活动主舞台坐标常量（外框 x=18..942, y=58..532；左栏 x=26..212；右舞台 x=220..934）
  const STAGE_X = 220;
  const STAGE_Y = 66;
  const STAGE_W = 714;
  const STAGE_H = 458;

  function hasSupplyQuota(st) {
    const types = ['welfare_gold', 'welfare_stamina', 'welfare_soul'];
    return types.some((t) => {
      const limit = ((App.Config.AD_REWARDS || {})[t] || {}).dailyLimit || 5;
      const used = (st.adCounts && st.adCounts[t]) || 0;
      return used < limit;
    });
  }

  function enter(params) {
    achPage = 0;
    if (params && params.tab) {
      curTab = params.tab;
      return;
    }
    if (App.State.canFreeSignToday()) curTab = 'sign';
    else if (App.State.hasUnclaimedQuestOrBox && App.State.hasUnclaimedQuestOrBox()) curTab = 'quest';
    else if (App.State.hasUnclaimedAchievement && App.State.hasUnclaimedAchievement()) curTab = 'achieve';
    else curTab = 'sign';
  }

  function drawRedDot(ctx, x, y) {
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  // 右侧活动舞台通用顶部主题横幅（带角饰、副标题与右上角 ✕ 关闭按钮）
  function drawStageBanner(ctx, opts) {
    const bx = STAGE_X;
    const by = STAGE_Y;
    const bw = STAGE_W;
    const bh = 54;

    ctx.save();
    App.UI.roundRect(ctx, bx, by, bw, bh, 11);
    const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    g.addColorStop(0, opts.grad ? opts.grad[0] : '#5c1d0c');
    g.addColorStop(0.55, opts.grad ? opts.grad[1] : '#3b1508');
    g.addColorStop(1, opts.grad ? opts.grad[2] : '#220c05');
    ctx.fillStyle = g;
    ctx.fill();

    // 右侧暗金斜纹流光装饰
    ctx.save();
    App.UI.roundRect(ctx, bx, by, bw, bh, 11);
    ctx.clip();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.06)';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      const sx = bx + 360 + i * 72;
      ctx.moveTo(sx, by);
      ctx.lineTo(sx + 42, by);
      ctx.lineTo(sx + 12, by + bh);
      ctx.lineTo(sx - 30, by + bh);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    App.UI.roundRect(ctx, bx, by, bw, bh, 11);
    ctx.strokeStyle = opts.border || '#d97706';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // 左侧菱形金章标头
    const dCx = bx + 22;
    const dCy = by + bh / 2;
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(dCx, dCy - 7);
    ctx.lineTo(dCx + 7, dCy);
    ctx.lineTo(dCx, dCy + 7);
    ctx.lineTo(dCx - 7, dCy);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 17px "PingFang SC", "STKaiti", serif';
    ctx.fillText(opts.title || '', bx + 36, by + 20);

    if (opts.tag) {
      const titleW = ctx.measureText(opts.title || '').width;
      const tagX = bx + 44 + titleW;
      const tagY = by + 10;
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      const tagW = ctx.measureText(opts.tag).width + 14;
      App.UI.roundRect(ctx, tagX, tagY, tagW, 18, 9);
      ctx.fillStyle = opts.tagBg || 'rgba(180, 83, 9, 0.88)';
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = '#fffbeb';
      ctx.textAlign = 'center';
      ctx.fillText(opts.tag, tagX + tagW / 2, tagY + 9.5);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fed7aa';
    ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(opts.subtitle || '', bx + 36, by + 40, bw - 240);
    ctx.restore();

    // 右上角统一 ✕ 关闭圆章按钮
    App.UI.drawCloseButton(ctx, bx + bw - 42, by + 11, 32, () => App.Main.goScene('map'));
  }

  function drawRewardIcon(ctx, rw, x, y, sz) {
    if (rw.generalId) {
      App.Portraits.drawGeneralPortrait(ctx, rw.generalId, x, y, sz, { radius: 8, lineWidth: 1.5 });
    } else if (rw.equipId) {
      App.Sprites.drawEquipIcon(ctx, rw.equipId, x, y, sz, { radius: 8, lineWidth: 1.5, noAnim: true });
    } else if (rw.itemId) {
      App.Sprites.drawEquipIcon(ctx, rw.itemId, x, y, sz, { radius: 8, lineWidth: 1.5, noAnim: true });
      if ((rw.itemCount || 1) > 1) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 8, 4, 0.90)';
        App.UI.roundRect(ctx, x + sz - 24, y + sz - 16, 23, 15, 4);
        ctx.fill();
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('×' + rw.itemCount, x + sz - 12.5, y + sz - 8.5);
        ctx.restore();
      }
    } else if (rw.ingot) {
      App.UI.drawMiniIcon(ctx, 'res_ingot', x + 4, y + 4, sz - 8);
    } else if (rw.gold) {
      App.UI.drawMiniIcon(ctx, 'res_gold', x + 4, y + 4, sz - 8);
    } else if (rw.soul) {
      App.UI.drawMiniIcon(ctx, 'res_soul', x + 4, y + 4, sz - 8);
    } else {
      App.UI.drawMiniIcon(ctx, 'res_stamina', x + 4, y + 4, sz - 8);
    }
  }

  // ==================== 1. 七日庆典（王者荣耀式海报主视觉 + 4上3下压轴大奖卡） ====================
  function renderSignTab(ctx, st) {
    drawStageBanner(ctx, {
      title: '七日庆典 · 卧龙出山',
      tag: '登录送SSS神将',
      tagBg: '#991b1b',
      subtitle: '累计登录七日，免费招揽【孙尚香】、绝世神兵【方天画戟】与无双军师【诸葛亮】！',
      grad: ['#7c1d12', '#451409', '#240b05'],
      border: '#f59e0b',
    });

    // 上部核心大奖高光展台（y=126..226）
    const hx = STAGE_X;
    const hy = 126;
    const hw = STAGE_W;
    const hh = 98;
    App.UI.drawPanel(ctx, hx, hy, hw, hh, {
      r: 11, bg: '#2e1509', border: '#d97706', lineWidth: 1.6,
    });

    // 左侧三档核心里程碑大奖预览
    const milestones = [
      { day: '次日豪礼', generalId: 'sunshangxiang', name: '孙尚香', badge: '弓腰姬' },
      { day: '五日神兵', equipId: 'eq_fangtian', itemId: 'chest_gold', name: '神兵重宝', badge: '五日礼' },
      { day: '七日压轴', generalId: 'zhugeliang', name: '诸葛亮', badge: '卧龙SSS' },
    ];
    // 尝试从真实 SIGN_REWARDS 提取第2、5、7天配置
    const sList = App.State.SIGN_REWARDS || [];
    if (sList[1]) milestones[0] = Object.assign({}, sList[1], { day: '次日领', badge: sList[1].title || '枭姬' });
    if (sList[4]) milestones[1] = Object.assign({}, sList[4], { day: '五日领', badge: sList[4].title || '神兵' });
    if (sList[6]) milestones[2] = Object.assign({}, sList[6], { day: '七日领', badge: sList[6].title || '卧龙' });

    milestones.forEach((ms, i) => {
      const mx = hx + 12 + i * 138;
      const my = hy + 11;
      App.UI.drawPanel(ctx, mx, my, 130, 76, {
        r: 9,
        bg: i === 2 ? '#4c1d0c' : '#231007',
        border: i === 2 ? '#fde047' : '#92400e',
        lineWidth: i === 2 ? 1.8 : 1.2,
      });
      drawRewardIcon(ctx, ms, mx + 8, my + 12, 52);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = i === 2 ? '#fde047' : '#fed7aa';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(ms.day, mx + 66, my + 24);
      ctx.fillStyle = '#fffbeb';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText((ms.badge || '').slice(0, 4), mx + 66, my + 48, 58);
      ctx.restore();
    });

    // 右侧签到进度与双行动按钮
    const signDays = Math.min(7, st.signDays || 0);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 13px "PingFang SC", sans-serif';
    ctx.fillText(`当前累计登录进度：${signDays} / 7 天`, hx + 568, hy + 24);
    ctx.restore();

    if (signDays < 7) {
      const canFree = App.State.canFreeSignToday();
      App.UI.drawButton(ctx, hx + 432, hy + 44, 130, 40, canFree ? `签到领第${signDays + 1}天` : '今日已签到', {
        r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12, disabled: !canFree,
      }, () => App.State.claimSignDay(false));

      App.UI.drawAdButton(ctx, hx + 570, hy + 44, 132, 40, `提前领第${signDays + 1}天`, {
        r: 8, fontSize: 11.5,
      }, () => {
        App.Platform.showRewardedAd('stamina', `观看激励视频，提前解锁第 ${signDays + 1} 天签到豪礼！`, () => {
          App.State.claimSignDay(true);
        });
      });
    } else {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText('✦ 七日庆典豪礼已全部收入麾下 ✦', hx + 568, hy + 64);
      ctx.restore();
    }

    // 下部七日签到卡片矩阵（第1~4天在第一排，第5、6天 + 超宽第7天卧龙金卡在第二排，y=232..522）
    sList.slice(0, 7).forEach((rw, idx) => {
      const isRow2 = idx >= 4;
      const isDay7 = idx === 6;
      const gap = 10;
      let cx, cy, cw, ch;
      if (!isRow2) {
        cw = Math.floor((STAGE_W - gap * 3) / 4); // 171
        ch = 138;
        cx = STAGE_X + idx * (cw + gap);
        cy = 232;
      } else if (!isDay7) {
        cw = 171;
        ch = 140;
        cx = STAGE_X + (idx - 4) * (cw + gap);
        cy = 380;
      } else {
        // 第7天压轴横版大金卡（占满右侧两格宽度！）
        cx = STAGE_X + 2 * (171 + gap);
        cy = 380;
        cw = STAGE_W - 2 * (171 + gap); // 352
        ch = 140;
      }

      const claimed = idx < signDays;
      const isNext = idx === signDays;

      App.UI.drawPanel(ctx, cx, cy, cw, ch, {
        r: 11,
        bg: claimed ? '#163c24' : (isNext ? '#7c2d12' : (isDay7 ? '#3f1a09' : '#26130a')),
        border: isNext ? '#fde047' : (claimed ? '#4ade80' : (isDay7 ? '#f59e0b' : '#78350f')),
        lineWidth: isNext ? 2.4 : (isDay7 ? 1.9 : 1.3),
      });

      // 顶部天数铭牌条
      ctx.save();
      App.UI.roundRect(ctx, cx + 2, cy + 2, cw - 4, 26, 9);
      ctx.fillStyle = claimed ? 'rgba(20, 83, 45, 0.72)' : (isNext || isDay7 ? 'rgba(180, 83, 9, 0.55)' : 'rgba(69, 26, 3, 0.55)');
      ctx.fill();

      ctx.textAlign = isDay7 ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`第 ${rw.day} 天 · ${rw.title}`, isDay7 ? cx + 14 : cx + cw / 2, cy + 15);
      ctx.restore();

      const cleanDesc = (rw.desc || '').replace(/送(SSS|SS|S|UR|SSR)名?神?将/, '');
      if (isDay7) {
        drawRewardIcon(ctx, rw, cx + 18, cy + 38, 84);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 15px "PingFang SC", serif';
        ctx.fillText('七日终极大奖 · 无双名将', cx + 116, cy + 54);
        ctx.fillStyle = '#fffbeb';
        ctx.font = '12px "PingFang SC", sans-serif';
        ctx.fillText(rw.desc || '立得【诸葛亮】入帐助阵！', cx + 116, cy + 80, cw - 128);

        ctx.fillStyle = claimed ? '#86efac' : (isNext ? '#fde047' : '#fed7aa');
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.fillText(claimed ? '✓ 已圆满领取' : (isNext ? '● 今日可立即领取！' : `再签 ${7 - signDays} 天即可免费招揽`), cx + 116, cy + 108);
        ctx.restore();
      } else {
        drawRewardIcon(ctx, rw, cx + Math.floor((cw - 58) / 2), cy + 36, 58);
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = claimed ? '#86efac' : (isNext ? '#fde047' : '#fed7aa');
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(claimed ? '✓ 已领取' : cleanDesc.slice(0, 12), cx + cw / 2, cy + 114, cw - 12);
        ctx.restore();
      }

      if (isNext && App.State.canFreeSignToday()) {
        App.UI.addHit(cx, cy, cw, ch, () => App.State.claimSignDay(false));
      }
    });
  }

  // ==================== 2. 每日战令（活跃进度宝箱轨道 + 双列战令任务） ====================
  function renderQuestTab(ctx, st) {
    const qProg = st.questProgress || { claimed: {}, boxClaimed: {} };
    const claimedMap = qProg.claimed || {};
    const boxClaimed = qProg.boxClaimed || {};
    const pts = App.State.getActivePoints ? App.State.getActivePoints() : 0;
    const boxes = App.State.QUEST_BOXES || [];
    const maxPts = boxes.length ? Math.max(...boxes.map((b) => b.needPoints || 140)) : 140;
    const anyReady = App.State.hasUnclaimedQuestOrBox ? App.State.hasUnclaimedQuestOrBox() : false;

    drawStageBanner(ctx, {
      title: '每日战令 · 军功活跃',
      tag: `今日活跃 ${pts}/${maxPts}`,
      tagBg: '#92400e',
      subtitle: `每日零点刷新战令，随主公等级 Lv.${st.lordLevel || 1} 动态提升铜钱与将魂厚赏`,
      grad: ['#5c280e', '#3b1808', '#1f0c04'],
      border: '#d97706',
    });

    if (anyReady) {
      App.UI.drawButton(ctx, STAGE_X + STAGE_W - 178, STAGE_Y + 12, 124, 30, '一键全领战令', {
        r: 7, grad: ['#16a34a', '#15803d'], border: '#fef08a', fontSize: 11.5,
      }, () => App.State.claimQuest('all'));
    }

    // 顶部战令活跃宝箱横栏（y=126..218）
    App.UI.drawPanel(ctx, STAGE_X, 126, STAGE_W, 92, {
      r: 11, bg: '#2c1509', border: '#b45309', lineWidth: 1.5,
    });

    // 左侧活跃度圆环/进度摘要
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 22px "PingFang SC", sans-serif';
    ctx.fillText(`${pts}`, STAGE_X + 16, 154);
    const ptsW = ctx.measureText(`${pts}`).width;
    ctx.fillStyle = '#fed7aa';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.fillText(`/ ${maxPts} 活跃`, STAGE_X + 20 + ptsW, 156);

    App.UI.drawBar(ctx, STAGE_X + 16, 174, 124, 9, pts / maxPts, '#f59e0b', '#140904');
    ctx.fillStyle = '#a89070';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText('达成节点开启宝箱', STAGE_X + 16, 198);
    ctx.restore();

    boxes.slice(0, 4).forEach((bx, idx) => {
      const cw = 132;
      const cx = STAGE_X + 154 + idx * 138;
      const cy = 133;
      const ch = 78;
      const done = !!boxClaimed[bx.id];
      const ready = !done && pts >= (bx.needPoints || 35);
      const rw = App.State.getQuestBoxReward ? App.State.getQuestBoxReward(bx) : bx;

      App.UI.drawPanel(ctx, cx, cy, cw, ch, {
        r: 9,
        bg: done ? '#144327' : (ready ? '#853110' : '#211007'),
        border: ready ? '#fde047' : (done ? '#4ade80' : '#78350f'),
        lineWidth: ready ? 2.1 : 1.2,
      });

      if (bx.itemId) {
        App.Sprites.drawEquipIcon(ctx, bx.itemId, cx + 6, cy + 18, 40, { radius: 6, lineWidth: 1.2, noAnim: true });
      } else {
        App.UI.drawMiniIcon(ctx, 'res_gold', cx + 8, cy + 20, 36);
      }

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(`${bx.needPoints}分·${(bx.title || '').slice(0, 3)}`, cx + 50, cy + 18);
      ctx.fillStyle = '#fed7aa';
      ctx.font = '9.5px "PingFang SC", sans-serif';
      ctx.fillText(`钱+${rw.gold} 魂+${rw.soul}`, cx + 50, cy + 36, 76);
      ctx.restore();

      App.UI.drawButton(ctx, cx + 50, cy + 50, 74, 21, done ? '✓ 已开' : (ready ? '开启' : `差${Math.max(0, bx.needPoints - pts)}分`), {
        r: 5,
        grad: ready ? ['#16a34a', '#15803d'] : ['#451a03', '#291509'],
        border: ready ? '#fef08a' : '#78350f',
        fontSize: 9.5,
        disabled: !ready,
      }, () => App.State.claimQuestBox(bx.id));
    });

    // 下部 2×4 战令任务矩阵（y=226..522）
    const quests = (App.State.DAILY_QUEST_DEFS || []).slice(0, 8);
    quests.forEach((q, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const w = 352;
      const h = 68;
      const x = STAGE_X + col * (w + 10);
      const y = 226 + row * 75;
      const cur = Math.min(q.target || 1, qProg[q.id] || 0);
      const target = Math.max(1, q.target || 1);
      const claimed = !!claimedMap[q.id];
      const done = cur >= target;
      const rw = App.State.getQuestReward ? App.State.getQuestReward(q) : q;

      App.UI.drawPanel(ctx, x, y, w, h, {
        r: 9,
        bg: claimed ? '#20150f' : (done ? '#4d220c' : '#2d170c'),
        border: done && !claimed ? '#fde047' : '#854d0e',
        lineWidth: done && !claimed ? 1.9 : 1.2,
      });

      if (q.itemId) {
        App.Sprites.drawEquipIcon(ctx, q.itemId, x + 9, y + 12, 44, { radius: 7, lineWidth: 1.2, noAnim: true });
      } else {
        App.UI.drawMiniIcon(ctx, 'res_gold', x + 11, y + 14, 40);
      }

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(`${q.title}`, x + 60, y + 19, 148);

      // 任务小进度条
      App.UI.drawBar(ctx, x + 60, y + 32, 130, 7, cur / target, done ? '#22c55e' : '#f59e0b', '#140904');
      ctx.fillStyle = '#fed7aa';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(`${cur}/${target}`, x + 196, y + 35.5);

      const itemBonus = q.itemId && App.Config.ITEMS[q.itemId] ? ` · ${App.Config.ITEMS[q.itemId].name.slice(0, 4)}` : '';
      ctx.fillStyle = '#fde047';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText(`钱+${rw.gold} · 魂+${rw.soul} · 活跃+${q.points || 25}${itemBonus}`, x + 60, y + 53, 206);
      ctx.restore();

      App.UI.drawButton(ctx, x + w - 78, y + 16, 68, 36, claimed ? '✓ 已领' : (done ? '领取' : '前往'), {
        r: 7,
        grad: done && !claimed ? ['#16a34a', '#15803d'] : ['#78350f', '#451a03'],
        border: '#fef08a',
        fontSize: 11.5,
        disabled: claimed,
      }, () => {
        if (done) {
          App.State.claimQuest(q.id);
        } else {
          const targetScene = q.scene || (q.id === 'enhance_eq' ? 'warehouse' : (q.id === 'arena_pk' ? 'arena' : 'map'));
          App.Main.goScene(targetScene);
        }
      });
    });
  }

  // ==================== 3. 军需补给（三尊立柱式免费军饷粮草将魂补给阁） ====================
  function renderSupplyTab(ctx, st) {
    drawStageBanner(ctx, {
      title: '军需补给 · 皇叔特批',
      tag: `主公 Lv.${st.lordLevel || 1} 升值中`,
      tagBg: '#15803d',
      subtitle: '每日三军免费特批补给，主公等级越高，单次批发的铜钱、粮草与将魂越丰厚！',
      grad: ['#4a2511', '#2f1609', '#1c0c05'],
      border: '#d97706',
    });

    const adGold = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('welfare_gold', 'gold') : 2400;
    const adSta = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('welfare_stamina', 'stamina') : 24;
    const adSoul = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('welfare_soul', 'soul') : 100;

    const adCards = [
      {
        type: 'welfare_gold',
        icon: 'res_gold',
        title: '皇叔军饷特批',
        sub: '国库拨款 · 招兵买马',
        amountTxt: `+${adGold} 铜钱`,
        detail: '用于强化神兵、集市采买与点兵升阶',
        btn: '免费领铜钱',
        accent: '#f59e0b',
        bg: ['#451f0a', '#241005'],
      },
      {
        type: 'welfare_stamina',
        icon: 'res_stamina',
        title: '三军粮草急运',
        sub: '兵马未动 · 粮草先行',
        amountTxt: `+${adSta} 粮草体力`,
        detail: '用于主线攻城、征战秘境与神兽讨伐',
        btn: '免费领粮草',
        accent: '#22c55e',
        bg: ['#19381f', '#0e2012'],
      },
      {
        type: 'welfare_soul',
        icon: 'res_soul',
        title: '太庙聚魂赐福',
        sub: '英魂觉醒 · 金索缚兽',
        amountTxt: `+${adSoul} 将魂`,
        extraTxt: '额外附赠：黄金缚兽索 ×1',
        detail: '用于名将升星突破与神兽双倍抓捕',
        btn: '免费领将魂',
        accent: '#c084fc',
        bg: ['#3b1740', '#1e0b24'],
      },
    ];

    const gap = 12;
    const cw = Math.floor((STAGE_W - gap * 2) / 3); // 230
    const ch = 392;
    const cy = 128;

    adCards.forEach((ac, idx) => {
      const cx = STAGE_X + idx * (cw + gap);
      const limit = ((App.Config.AD_REWARDS || {})[ac.type] || {}).dailyLimit || 5;
      const used = (st.adCounts && st.adCounts[ac.type]) || 0;
      const left = Math.max(0, limit - used);

      ctx.save();
      App.UI.roundRect(ctx, cx, cy, cw, ch, 12);
      const cg = ctx.createLinearGradient(cx, cy, cx, cy + ch);
      cg.addColorStop(0, ac.bg[0]);
      cg.addColorStop(1, ac.bg[1]);
      ctx.fillStyle = cg;
      ctx.fill();
      ctx.strokeStyle = left > 0 ? ac.accent : '#57534e';
      ctx.lineWidth = left > 0 ? 1.8 : 1.2;
      ctx.stroke();

      // 顶部副标锦带
      App.UI.roundRect(ctx, cx + 16, cy + 14, cw - 32, 24, 12);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(ac.sub, cx + cw / 2, cy + 26);

      // 中央光晕圆坛与大图标
      const icCx = cx + cw / 2;
      const icCy = cy + 114;
      const halo = ctx.createRadialGradient(icCx, icCy, 6, icCx, icCy, 56);
      halo.addColorStop(0, 'rgba(254, 240, 138, 0.36)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(icCx, icCy, 56, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(icCx, icCy, 42, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 8, 4, 0.55)';
      ctx.fill();
      ctx.strokeStyle = ac.accent;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      App.UI.drawMiniIcon(ctx, ac.icon, icCx - 28, icCy - 28, 56);

      // 标题与大字号奖励数值
      ctx.fillStyle = '#fffbeb';
      ctx.font = 'bold 16px "PingFang SC", serif';
      ctx.fillText(ac.title, icCx, cy + 184);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 19px "PingFang SC", sans-serif';
      ctx.fillText(ac.amountTxt, icCx, cy + 218);

      if (ac.extraTxt) {
        ctx.fillStyle = '#f0abfc';
        ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
        ctx.fillText(ac.extraTxt, icCx, cy + 242);
      }

      ctx.fillStyle = '#fed7aa';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(ac.detail, icCx, cy + 270, cw - 24);

      // 剩余次数进度槽
      App.UI.drawBar(ctx, cx + 26, cy + 296, cw - 52, 8, left / Math.max(1, limit), ac.accent, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = left > 0 ? '#fde68a' : '#a8a29e';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`今日剩余次数：${left} / ${limit}`, icCx, cy + 318);
      ctx.restore();

      App.UI.drawAdButton(ctx, cx + 20, cy + ch - 54, cw - 40, 40, left > 0 ? ac.btn : '今日已领满', {
        r: 9, fontSize: 12.5, disabled: left <= 0,
      }, () => {
        App.Platform.showRewardedAd('stamina', `${ac.title}：${ac.amountTxt}`, () => App.State.claimAd(ac.type));
      });
    });
  }

  // ==================== 4. 霸业成就（分类筛选 + 2×3 成就丰碑卡 + 舞台内左右翻页） ====================
  function renderAchieveTab(ctx, st) {
    const allList = App.State.ACHIEVEMENTS || [];
    const claimedMap = st.claimedAchievements || {};
    const valOf = (cat) => (App.State.getAchievementValue ? App.State.getAchievementValue(cat) : 0);

    const doneTotal = allList.filter((a) => !!claimedMap[a.id] || valOf(a.cat) >= (a.target || 1)).length;
    const anyClaimable = App.State.hasUnclaimedAchievement ? App.State.hasUnclaimedAchievement() : false;

    drawStageBanner(ctx, {
      title: '霸业成就 · 九州丰碑',
      tag: `已达成 ${doneTotal}/${allList.length}`,
      tagBg: '#78350f',
      subtitle: '攻城拔寨、招揽名将、收服太古与上古神兽，解锁永久霸业里程碑大奖！',
      grad: ['#4c220d', '#311508', '#1b0b04'],
      border: '#d97706',
    });

    if (anyClaimable) {
      App.UI.drawButton(ctx, STAGE_X + STAGE_W - 178, STAGE_Y + 12, 124, 30, '一键全领成就', {
        r: 7, grad: ['#16a34a', '#15803d'], border: '#fef08a', fontSize: 11.5,
      }, () => App.State.claimAchievement('all'));
    }

    // 分类筛选胶囊栏（y=126..162）
    App.UI.drawPanel(ctx, STAGE_X, 126, STAGE_W, 38, {
      r: 9, bg: '#291409', border: '#92400e', lineWidth: 1.3,
    });
    ACH_CATS.forEach((c, idx) => {
      const bw = 96;
      const bx = STAGE_X + 10 + idx * 104;
      const by = 131;
      const on = achCat === c.id;
      App.UI.drawButton(ctx, bx, by, bw, 28, c.label, {
        r: 6,
        grad: on ? ['#d97706', '#92400e'] : ['#451a03', '#241007'],
        border: on ? '#fef08a' : '#78350f',
        fontSize: 11,
      }, () => { achCat = c.id; achPage = 0; });
    });

    const filtered = allList.filter((a) => {
      if (achCat === 'all') return true;
      if (achCat === 'rare') return a.cat === 'beast' || a.cat === 'artifact';
      return a.cat === achCat;
    }).slice().sort((a, b) => {
      const ca = !!claimedMap[a.id], cb = !!claimedMap[b.id];
      const ra = !ca && valOf(a.cat) >= (a.target || 1);
      const rb = !cb && valOf(b.cat) >= (b.target || 1);
      const sa = ra ? 0 : (ca ? 2 : 1);
      const sb = rb ? 0 : (cb ? 2 : 1);
      return sa - sb;
    });

    const pageSize = 6;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    achPage = Math.max(0, Math.min(achPage, totalPages - 1));

    // 留出右舞台左右两侧各 28px 给悬浮侧边翻页键
    const gridX = STAGE_X + 30;
    const cardW = 322;
    const cardH = 108;

    filtered.slice(achPage * pageSize, achPage * pageSize + pageSize).forEach((a, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = gridX + col * (cardW + 10);
      const y = 172 + row * 116;
      const cur = valOf(a.cat);
      const target = Math.max(1, a.target || 1);
      const claimed = !!claimedMap[a.id];
      const ready = !claimed && cur >= target;

      App.UI.drawPanel(ctx, x, y, cardW, cardH, {
        r: 10,
        bg: claimed ? '#1f150f' : (ready ? '#59250c' : '#2e180c'),
        border: ready ? '#fde047' : (claimed ? '#4ade80' : '#9a5b25'),
        lineWidth: ready ? 2.1 : 1.3,
      });

      drawRewardIcon(ctx, a, x + 10, y + 26, 56);

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 13px "PingFang SC", serif';
      ctx.fillText(`【${a.title}】`, x + 74, y + 24, 166);

      const pct = Math.min(1, cur / target);
      App.UI.drawBar(ctx, x + 74, y + 42, 156, 13, pct, ready || claimed ? '#22c55e' : '#f59e0b', '#140904');
      ctx.fillStyle = '#fffbeb';
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.min(cur, target)} / ${target}`, x + 152, y + 49);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#fde68a';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      let extra = '';
      if (a.generalId && App.Config.GENERALS[a.generalId]) extra = ` · 【${App.Config.GENERALS[a.generalId].name}】`;
      else if (a.equipId && App.Config.EQUIP_TEMPLATES[a.equipId]) extra = ` · 【${App.Config.EQUIP_TEMPLATES[a.equipId].name}】`;
      else if (a.itemId && App.Config.ITEMS[a.itemId]) extra = ` · ${App.Config.ITEMS[a.itemId].name}`;
      ctx.fillText(`钱+${a.gold || 0} 魂+${a.soul || 0}${extra}`, x + 74, y + 80, 166);
      ctx.restore();

      App.UI.drawButton(ctx, x + cardW - 78, y + 34, 68, 38, claimed ? '✓ 已领' : (ready ? '领厚赏' : '进行中'), {
        r: 7,
        grad: ready ? ['#16a34a', '#15803d'] : ['#5c2c16', '#3b1d0c'],
        border: ready ? '#fef08a' : '#78350f',
        fontSize: 11,
        disabled: !ready,
      }, () => App.State.claimAchievement(a.id));
    });

    // 右侧舞台专属左右侧翻页按钮（不遮挡左侧活动菜单栏）
    App.UI.drawSidePageButtons(ctx, achPage, totalPages, (p) => { achPage = p; }, {
      lx: STAGE_X + 1,
      rx: STAGE_X + STAGE_W - 27,
      bw: 26,
      bh: 80,
      cy: 344,
      grad: ['#78350f', '#3b1806'],
      border: '#f59e0b',
    });
  }

  // ==================== 5. 天命祈愿（天命轮盘联动活动展台） ====================
  function renderWheelPromoTab(ctx, st) {
    const tickets = st.wheelTickets || 0;
    drawStageBanner(ctx, {
      title: '天命祈愿 · 八卦寻宝',
      tag: `持有天命券 ×${tickets}`,
      tagBg: '#6d28d9',
      subtitle: '转动天命轮盘，抽取 SSS 无双神将、传世黄金宝箱与海量元宝军饷！',
      grad: ['#4c1d6e', '#2e1047', '#180826'],
      border: '#c084fc',
    });

    App.UI.drawPanel(ctx, STAGE_X, 128, STAGE_W, 392, {
      r: 12, bg: '#21102e', border: '#a855f7', lineWidth: 1.6,
    });

    // 左侧八卦紫金轮盘纹章视觉区
    const wCx = STAGE_X + 168;
    const wCy = 316;
    ctx.save();
    const glow = ctx.createRadialGradient(wCx, wCy, 12, wCx, wCy, 126);
    glow.addColorStop(0, 'rgba(250, 204, 21, 0.34)');
    glow.addColorStop(0.55, 'rgba(168, 85, 247, 0.22)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(wCx, wCy, 126, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(wCx, wCy, 94, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(wCx, wCy, 72, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(wCx + Math.cos(ang) * 28, wCy + Math.sin(ang) * 28);
      ctx.lineTo(wCx + Math.cos(ang) * 94, wCy + Math.sin(ang) * 94);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(wCx, wCy, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#581c87';
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 15px "PingFang SC", serif';
    ctx.fillText('天命', wCx, wCy - 8);
    ctx.fillText('轮盘', wCx, wCy + 10);

    ctx.fillStyle = '#e9d5ff';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`当前可用天命抽奖券：${tickets} 张`, wCx, 446);
    ctx.restore();

    // 右侧轮盘奖池一览（2×4 格）与直达按钮
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14.5px "PingFang SC", serif';
    ctx.fillText('✦ 本期天命轮盘核心奖池一览 ✦', STAGE_X + 332, 156);
    ctx.restore();

    const prizes = (App.Config.WHEEL_PRIZES || []).slice(0, 8);
    prizes.forEach((p, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const px = STAGE_X + 332 + col * 90;
      const py = 178 + row * 106;
      const rw = p.reward || {};
      const isRare = !!(rw.generalId || rw.ingot >= 50 || (rw.itemId && rw.itemId.includes('gold')));

      App.UI.drawPanel(ctx, px, py, 82, 94, {
        r: 9,
        bg: isRare ? '#4c1d4b' : '#2b1638',
        border: isRare ? '#fde047' : '#7e22ce',
        lineWidth: isRare ? 1.8 : 1.2,
      });
      drawRewardIcon(ctx, rw, px + 15, py + 10, 52);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isRare ? '#fde047' : '#f3e8ff';
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.fillText((p.label || '').slice(0, 6), px + 41, py + 78, 74);
      ctx.restore();
    });

    App.UI.drawButton(ctx, STAGE_X + 382, 418, 256, 48, '立即前往天命轮盘祈愿', {
      r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 14,
      subText: tickets > 0 ? `当前可免费祈愿 ${tickets} 次` : '支持天命券或元宝祈愿',
    }, () => App.Main.goScene('wheel'));
  }

  // ==================== 主渲染：王者荣耀式左栏活动菜单 + 右侧满屏舞台 ====================
  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#140a05';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 满屏暗金帝王庆典主画框（y=58..532，彻底消除底部留白）
    App.UI.drawPanel(ctx, 18, 58, W - 36, 474, {
      r: 14, bg: '#1b0d06', border: '#b4782c', lineWidth: 2,
    });

    // ==================== 左侧垂直活动菜单栏（王者荣耀活动中心风格） ====================
    const sideX = 26;
    const sideY = 66;
    const sideW = 186;
    const sideH = 458;
    App.UI.drawPanel(ctx, sideX, sideY, sideW, sideH, {
      r: 11, bg: '#120804', border: '#784418', lineWidth: 1.4,
    });

    // 左栏顶部【福利盛典】铭牌头
    ctx.save();
    App.UI.roundRect(ctx, sideX + 4, sideY + 4, sideW - 8, 46, 9);
    const hg = ctx.createLinearGradient(sideX, sideY, sideX + sideW, sideY + 48);
    hg.addColorStop(0, '#6b240c');
    hg.addColorStop(1, '#361206');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 15.5px "PingFang SC", "STKaiti", serif';
    ctx.fillText('✦ 福利活动 ✦', sideX + sideW / 2, sideY + 19);
    ctx.fillStyle = '#fed7aa';
    ctx.font = '10px "PingFang SC", sans-serif';
    ctx.fillText('盛世庆典 · 厚赏三军', sideX + sideW / 2, sideY + 37);
    ctx.restore();

    const menus = [
      {
        id: 'sign',
        title: '七日庆典',
        sub: '七日登录送诸葛亮',
        badge: '送SSS',
        badgeCol: '#dc2626',
        dot: App.State.canFreeSignToday(),
      },
      {
        id: 'quest',
        title: '每日战令',
        sub: '活跃宝箱 · 每日刷新',
        badge: '日常',
        badgeCol: '#d97706',
        dot: !!(App.State.hasUnclaimedQuestOrBox && App.State.hasUnclaimedQuestOrBox()),
      },
      {
        id: 'supply',
        title: '军需补给',
        sub: '免费铜钱 · 粮草将魂',
        badge: '免费',
        badgeCol: '#16a34a',
        dot: hasSupplyQuota(st),
      },
      {
        id: 'achieve',
        title: '霸业成就',
        sub: '九州征伐 · 丰碑厚赏',
        badge: '永久',
        badgeCol: '#0284c7',
        dot: !!(App.State.hasUnclaimedAchievement && App.State.hasUnclaimedAchievement()),
      },
      {
        id: 'wheel',
        title: '天命祈愿',
        sub: '八卦轮盘 · 抽无双将',
        badge: '祈愿',
        badgeCol: '#7e22ce',
        dot: (st.wheelTickets || 0) > 0,
      },
    ];

    menus.forEach((m, i) => {
      const mx = sideX + 8;
      const my = sideY + 58 + i * 78;
      const mw = sideW - 16;
      const mh = 70;
      const active = curTab === m.id;

      ctx.save();
      App.UI.roundRect(ctx, mx, my, mw, mh, 9);
      if (active) {
        const mg = ctx.createLinearGradient(mx, my, mx + mw, my);
        mg.addColorStop(0, '#9a3412');
        mg.addColorStop(0.65, '#5c1f0a');
        mg.addColorStop(1, '#331105');
        ctx.fillStyle = mg;
      } else {
        ctx.fillStyle = '#221008';
      }
      ctx.fill();

      ctx.strokeStyle = active ? '#fde047' : '#5c3314';
      ctx.lineWidth = active ? 1.9 : 1.1;
      ctx.stroke();

      // 选中态左侧王者荣耀式亮金竖向流光条 + 右侧指向小三角
      if (active) {
        App.UI.roundRect(ctx, mx + 2, my + 8, 4.5, mh - 16, 2.2);
        ctx.fillStyle = '#fde047';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(mx + mw - 8, my + mh / 2 - 5);
        ctx.lineTo(mx + mw - 2, my + mh / 2);
        ctx.lineTo(mx + mw - 8, my + mh / 2 + 5);
        ctx.closePath();
        ctx.fill();
      }

      // 右上角活动小角标胶囊
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      const bw = ctx.measureText(m.badge).width + 10;
      const bx = mx + mw - bw - 10;
      const by = my + 9;
      App.UI.roundRect(ctx, bx, by, bw, 16, 5);
      ctx.fillStyle = m.badgeCol;
      ctx.fill();
      ctx.fillStyle = '#fffbeb';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.badge, bx + bw / 2, by + 8.5);

      // 主标题与副标题
      ctx.textAlign = 'left';
      ctx.fillStyle = active ? '#fffbeb' : '#fde68a';
      ctx.font = `bold ${active ? 15 : 14}px "PingFang SC", sans-serif`;
      ctx.fillText(m.title, mx + 14, my + 24);

      ctx.fillStyle = active ? '#fde68a' : '#a89070';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText(m.sub, mx + 14, my + 49, mw - 26);
      ctx.restore();

      if (m.dot) drawRedDot(ctx, mx + mw - 5, my + 6);

      App.UI.addHit(mx, my, mw, mh, () => { curTab = m.id; });
    });

    // ==================== 右侧具体活动内容舞台 ====================
    if (curTab === 'quest') renderQuestTab(ctx, st);
    else if (curTab === 'supply') renderSupplyTab(ctx, st);
    else if (curTab === 'achieve') renderAchieveTab(ctx, st);
    else if (curTab === 'wheel') renderWheelPromoTab(ctx, st);
    else renderSignTab(ctx, st);
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.activity = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
