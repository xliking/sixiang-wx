(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  let curTab = 'quest'; // 'quest' | 'achieve' | 'sign'
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

  function enter() {
    achPage = 0;
    if (App.State.canFreeSignToday()) curTab = 'sign';
    else if (App.State.hasUnclaimedQuestOrBox && App.State.hasUnclaimedQuestOrBox()) curTab = 'quest';
    else if (App.State.hasUnclaimedAchievement && App.State.hasUnclaimedAchievement()) curTab = 'achieve';
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

  function renderQuestTab(ctx, st, W) {
    const qProg = st.questProgress || { claimed: {}, boxClaimed: {} };
    const claimedMap = qProg.claimed || {};
    const boxClaimed = qProg.boxClaimed || {};
    const pts = App.State.getActivePoints ? App.State.getActivePoints() : 0;
    const boxes = App.State.QUEST_BOXES || [];
    const maxPts = boxes.length ? Math.max(...boxes.map((b) => b.needPoints || 140)) : 140;
    const anyReady = App.State.hasUnclaimedQuestOrBox ? App.State.hasUnclaimedQuestOrBox() : false;

    // 顶部：战令活跃度总览 + 4 档活跃宝箱 + 一键全领
    App.UI.drawPanel(ctx, 26, 114, W - 52, 92, { r: 11, bg: '#3b1d0c', border: '#d4a34b', lineWidth: 1.8 });

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText(`今日战令活跃：${pts} / ${maxPts}`, 40, 136);

    // 进度条
    ctx.fillStyle = 'rgba(15, 7, 3, 0.78)';
    App.UI.roundRect(ctx, 40, 144, 206, 12, 6);
    ctx.fill();
    if (pts > 0) {
      const pw = Math.max(10, Math.min(206, Math.round((pts / maxPts) * 206)));
      const pg = ctx.createLinearGradient(40, 144, 40 + pw, 144);
      pg.addColorStop(0, '#f59e0b');
      pg.addColorStop(1, '#fde047');
      ctx.fillStyle = pg;
      App.UI.roundRect(ctx, 40, 144, pw, 12, 6);
      ctx.fill();
    }
    ctx.fillStyle = '#fed7aa';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText(`随主公 Lv.${st.lordLevel || 1} 升值奖赏`, 40, 170);
    ctx.restore();

    App.UI.drawButton(ctx, 40, 176, 152, 24, anyReady ? '⚡ 一键全领战令与宝箱' : '完成下方战令领厚赏', {
      r: 6,
      grad: anyReady ? ['#16a34a', '#15803d'] : ['#5c2c16', '#3b1d0c'],
      border: '#fef08a',
      fontSize: 10.5,
      disabled: !anyReady,
    }, () => App.State.claimQuest('all'));

    // 右侧 4 档活跃宝箱卡
    boxes.slice(0, 4).forEach((bx, idx) => {
      const cx = 266 + idx * 164, cy = 121, cw = 156, ch = 78;
      const done = !!boxClaimed[bx.id];
      const ready = !done && pts >= (bx.needPoints || 35);
      const rw = App.State.getQuestBoxReward ? App.State.getQuestBoxReward(bx) : bx;

      App.UI.drawPanel(ctx, cx, cy, cw, ch, {
        r: 9,
        bg: done ? '#14532d' : (ready ? '#9a3412' : '#291509'),
        border: ready ? '#fde047' : (done ? '#4ade80' : '#78350f'),
        lineWidth: ready ? 2.2 : 1.3,
      });

      if (bx.itemId) {
        App.Sprites.drawEquipIcon(ctx, bx.itemId, cx + 8, cy + 18, 42, { radius: 7, lineWidth: 1.3, noAnim: true });
      } else {
        App.UI.drawMiniIcon(ctx, 'res_gold', cx + 10, cy + 20, 38);
      }

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`${bx.needPoints}活跃·${(bx.title || '').slice(0, 4)}`, cx + 55, cy + 20);
      ctx.fillStyle = '#fed7aa';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(`钱+${rw.gold} 魂+${rw.soul}`, cx + 55, cy + 37);
      const itemMeta = bx.itemId && App.Config.ITEMS[bx.itemId];
      if (itemMeta) {
        ctx.fillStyle = '#fde68a';
        ctx.fillText(`${itemMeta.name.slice(0, 5)}×${bx.itemCount || 1}`, cx + 55, cy + 52);
      }
      ctx.restore();

      App.UI.drawButton(ctx, cx + 55, cy + 56, 92, 18, done ? '✓ 已开启' : (ready ? '点击开启' : `差${Math.max(0, bx.needPoints - pts)}分`), {
        r: 5,
        grad: ready ? ['#16a34a', '#15803d'] : ['#5c2c16', '#3b1d0c'],
        border: ready ? '#fef08a' : '#78350f',
        fontSize: 9.5,
        disabled: !ready,
      }, () => App.State.claimQuestBox(bx.id));
    });

    // 下半区：8 项每日战令双列排布（4 行 × 2 列）
    const quests = (App.State.DAILY_QUEST_DEFS || []).slice(0, 8);
    quests.forEach((q, idx) => {
      const col = idx % 2, row = Math.floor(idx / 2);
      const x = 26 + col * 460, y = 214 + row * 62, w = 448, h = 56;
      const cur = Math.min(q.target || 1, qProg[q.id] || 0);
      const claimed = !!claimedMap[q.id];
      const done = cur >= (q.target || 1);
      const rw = App.State.getQuestReward ? App.State.getQuestReward(q) : q;

      App.UI.drawPanel(ctx, x, y, w, h, {
        r: 9,
        bg: claimed ? '#291c14' : (done ? '#4d230d' : '#3b2112'),
        border: done && !claimed ? '#fde047' : '#854d0e',
        lineWidth: done && !claimed ? 1.8 : 1.2,
      });

      if (q.itemId) {
        App.Sprites.drawEquipIcon(ctx, q.itemId, x + 8, y + 9, 38, { radius: 6, lineWidth: 1.2, noAnim: true });
      } else {
        App.UI.drawMiniIcon(ctx, 'res_gold', x + 10, y + 11, 34);
      }

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`${q.title} (${cur}/${q.target})`, x + 54, y + 21);

      const itemBonus = q.itemId && App.Config.ITEMS[q.itemId] ? ` · ${App.Config.ITEMS[q.itemId].name.slice(0, 5)}` : '';
      ctx.fillStyle = '#fde047';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText(`钱+${rw.gold} · 魂+${rw.soul} · 活跃+${q.points || 25}${itemBonus}`, x + 54, y + 41);
      ctx.restore();

      App.UI.drawButton(ctx, x + w - 92, y + 12, 82, 32, claimed ? '✓ 已领' : (done ? '领取' : '前往'), {
        r: 7,
        grad: done && !claimed ? ['#16a34a', '#15803d'] : ['#78350f', '#451a03'],
        border: '#fef08a',
        fontSize: 11,
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

  function renderAchieveTab(ctx, st, W) {
    const allList = App.State.ACHIEVEMENTS || [];
    const claimedMap = st.claimedAchievements || {};
    const valOf = (cat) => (App.State.getAchievementValue ? App.State.getAchievementValue(cat) : 0);

    const doneTotal = allList.filter((a) => !!claimedMap[a.id] || valOf(a.cat) >= (a.target || 1)).length;
    const anyClaimable = App.State.hasUnclaimedAchievement ? App.State.hasUnclaimedAchievement() : false;

    // 顶部汇总与分类筛选条
    App.UI.drawPanel(ctx, 26, 114, W - 52, 44, { r: 10, bg: '#3b1d0c', border: '#d4a34b', lineWidth: 1.6 });

    ACH_CATS.forEach((c, idx) => {
      const bx = 34 + idx * 78, by = 122;
      const on = achCat === c.id;
      App.UI.drawButton(ctx, bx, by, 72, 28, c.label, {
        r: 6,
        grad: on ? ['#d97706', '#92400e'] : ['#451a03', '#291509'],
        border: on ? '#fef08a' : '#78350f',
        fontSize: 11,
      }, () => { achCat = c.id; achPage = 0; });
    });

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(`已达成 ${doneTotal}/${allList.length}`, 510, 140);
    ctx.restore();

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
    achPage = Math.min(achPage, totalPages - 1);

    App.UI.drawPagination(ctx, 608, 122, 186, 28, achPage, totalPages, (p) => { achPage = p; }, { bg: '#5c2c16', border: '#fde047' });

    App.UI.drawButton(ctx, 804, 122, 120, 28, anyClaimable ? '⚡ 一键全领' : '暂无待领', {
      r: 7,
      grad: anyClaimable ? ['#16a34a', '#15803d'] : ['#5c2c16', '#3b1d0c'],
      border: '#fef08a',
      fontSize: 11,
      disabled: !anyClaimable,
    }, () => App.State.claimAchievement('all'));

    // 3 行 × 2 列霸业成就卡片
    filtered.slice(achPage * pageSize, achPage * pageSize + pageSize).forEach((a, idx) => {
      const col = idx % 2, row = Math.floor(idx / 2);
      const x = 26 + col * 460, y = 166 + row * 98, w = 448, h = 90;
      const cur = valOf(a.cat);
      const target = Math.max(1, a.target || 1);
      const claimed = !!claimedMap[a.id];
      const ready = !claimed && cur >= target;

      App.UI.drawPanel(ctx, x, y, w, h, {
        r: 10,
        bg: claimed ? '#241811' : (ready ? '#59250c' : '#361c0e'),
        border: ready ? '#fde047' : (claimed ? '#4ade80' : '#9a5b25'),
        lineWidth: ready ? 2.2 : 1.4,
      });

      // 左侧奖励图标
      if (a.generalId) {
        App.Portraits.drawGeneralPortrait(ctx, a.generalId, x + 10, y + 17, 56, { radius: 8, lineWidth: 1.5 });
      } else if (a.equipId) {
        App.Sprites.drawEquipIcon(ctx, a.equipId, x + 10, y + 17, 56, { radius: 8, lineWidth: 1.5, noAnim: true });
      } else if (a.itemId) {
        App.Sprites.drawEquipIcon(ctx, a.itemId, x + 10, y + 17, 56, { radius: 8, lineWidth: 1.5, noAnim: true });
      } else {
        App.UI.drawMiniIcon(ctx, 'res_gold', x + 16, y + 23, 44);
      }

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 13px "PingFang SC", serif';
      ctx.fillText(`【${a.title}】${a.desc || ''}`, x + 76, y + 24);

      // 进度条
      const pct = Math.min(1, cur / target);
      ctx.fillStyle = 'rgba(12, 6, 3, 0.72)';
      App.UI.roundRect(ctx, x + 76, y + 34, 248, 12, 6);
      ctx.fill();
      if (pct > 0) {
        ctx.fillStyle = ready || claimed ? '#22c55e' : '#f59e0b';
        App.UI.roundRect(ctx, x + 76, y + 34, Math.max(8, Math.round(248 * pct)), 12, 6);
        ctx.fill();
      }
      ctx.fillStyle = '#fffbeb';
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.min(cur, target)} / ${target}`, x + 200, y + 43.5);

      // 奖励文字
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fde68a';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      let extra = '';
      if (a.generalId && App.Config.GENERALS[a.generalId]) extra = ` · 名将【${App.Config.GENERALS[a.generalId].name}】`;
      else if (a.equipId && App.Config.EQUIP_TEMPLATES[a.equipId]) extra = ` · 【${App.Config.EQUIP_TEMPLATES[a.equipId].name}】`;
      else if (a.itemId && App.Config.ITEMS[a.itemId]) extra = ` · ${App.Config.ITEMS[a.itemId].name}×${a.itemCount || 1}`;
      ctx.fillText(`赏：铜钱+${a.gold || 0} · 将魂+${a.soul || 0}${extra}`, x + 76, y + 68);
      ctx.restore();

      App.UI.drawButton(ctx, x + w - 96, y + 26, 84, 36, claimed ? '✓ 已达成' : (ready ? '领取厚赏' : '进行中'), {
        r: 8,
        grad: ready ? ['#16a34a', '#15803d'] : ['#5c2c16', '#3b1d0c'],
        border: ready ? '#fef08a' : '#78350f',
        fontSize: 11.5,
        disabled: !ready,
      }, () => App.State.claimAchievement(a.id));
    });
  }

  function renderSignTab(ctx, st, W) {
    // 上半区：七日登录签到
    App.UI.drawPanel(ctx, 26, 114, W - 52, 184, { r: 12, bg: '#451a03', border: '#d4a34b', lineWidth: 2 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14.5px "PingFang SC", serif';
    ctx.fillText('七日登录豪礼（次日送【孙尚香】· 五日送【方天画戟】· 七日送【诸葛亮】！）', 40, 136);
    ctx.restore();

    App.State.SIGN_REWARDS.forEach((rw, idx) => {
      const cw = 118;
      const cx = 38 + idx * (cw + 8);
      const cy = 146;
      const claimed = idx < st.signDays;
      const isNext = idx === st.signDays;

      App.UI.drawPanel(ctx, cx, cy, cw, 100, {
        r: 10,
        bg: claimed ? '#14532d' : (isNext ? '#9a3412' : '#291810'),
        border: isNext ? '#fde047' : (claimed ? '#4ade80' : '#78350f'),
        lineWidth: isNext ? 2.5 : 1.4,
      });

      if (rw.generalId) {
        App.Portraits.drawGeneralPortrait(ctx, rw.generalId, cx + 34, cy + 22, 50, { radius: 8, lineWidth: 1.5 });
      } else if (rw.equipId) {
        App.Sprites.drawEquipIcon(ctx, rw.equipId, cx + 34, cy + 22, 50, { radius: 8, lineWidth: 1.5 });
      } else if (rw.itemId) {
        App.Sprites.drawEquipIcon(ctx, rw.itemId, cx + 34, cy + 22, 50, { radius: 8, lineWidth: 1.5 });
        if ((rw.itemCount || 1) > 1) {
          ctx.save();
          ctx.fillStyle = 'rgba(15, 8, 4, 0.88)';
          App.UI.roundRect(ctx, cx + 62, cy + 56, 22, 15, 4);
          ctx.fill();
          ctx.strokeStyle = '#fde047';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('×' + rw.itemCount, cx + 73, cy + 63.5);
          ctx.restore();
        }
      } else if (rw.gold) {
        App.UI.drawMiniIcon(ctx, 'res_gold', cx + 37, cy + 25, 44);
      } else if (rw.soul) {
        App.UI.drawMiniIcon(ctx, 'res_soul', cx + 37, cy + 25, 44);
      } else {
        App.UI.drawMiniIcon(ctx, 'res_stamina', cx + 37, cy + 25, 44);
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`第${rw.day}天 · ${rw.title}`, cx + cw / 2, cy + 16);
      ctx.fillStyle = claimed ? '#86efac' : '#fffbeb';
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.fillText(claimed ? '✓ 已领取' : rw.desc.replace('送SSR名将', '').replace('送UR神将', '').slice(0, 10), cx + cw / 2, cy + 88);
      ctx.restore();
    });

    if (st.signDays < 7) {
      const canFree = App.State.canFreeSignToday();
      App.UI.drawButton(ctx, 276, 254, 186, 34, canFree ? `免费签到领第${st.signDays + 1}天豪礼` : '今日已免费签到', {
        r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12, disabled: !canFree,
      }, () => App.State.claimSignDay(false));

      App.UI.drawAdButton(ctx, 476, 254, 214, 34, `提前解锁第${st.signDays + 1}天豪礼`, {
        r: 8, fontSize: 12,
      }, () => {
        App.Platform.showRewardedAd('stamina', `观看激励视频，提前解锁第 ${st.signDays + 1} 天签到豪礼！`, () => {
          App.State.claimSignDay(true);
        });
      });
    } else {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#86efac';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText('✦ 七日登录名将神兵豪礼已圆满领毕！请前往【每日战令】与【霸业成就】领取更多军饷 ✦', W / 2, 276);
      ctx.restore();
    }

    // 下半区：免费军需补给阁（铜钱/将魂随主公等级动态升值！）
    App.UI.drawPanel(ctx, 26, 306, W - 52, 158, { r: 12, bg: '#3b2112', border: '#d4a34b', lineWidth: 1.8 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText(`免费军需补给阁（物资随主公等级动态升值 · 当前 Lv.${st.lordLevel || 1}）`, 40, 329);
    ctx.restore();

    const adGold = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('welfare_gold', 'gold') : 2400;
    const adSta = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('welfare_stamina', 'stamina') : 24;
    const adSoul = App.State.getAdRewardAmount ? App.State.getAdRewardAmount('welfare_soul', 'soul') : 100;

    const adCards = [
      { type: 'welfare_gold', icon: 'res_gold', title: '皇叔军饷特批', desc: `立领 +${adGold} 铜钱`, btn: '免费领铜钱' },
      { type: 'welfare_stamina', icon: 'res_stamina', title: '三军粮草急运', desc: `立领 +${adSta} 点粮草体力`, btn: '免费领粮草' },
      { type: 'welfare_soul', icon: 'res_soul', title: '太庙聚魂赐福', desc: `立领 +${adSoul} 将魂 + 黄金索×1`, btn: '免费领将魂' },
    ];

    adCards.forEach((ac, idx) => {
      const cx = 38 + idx * 298, cy = 342, cw = 286, ch = 110;
      const limit = ((App.Config.AD_REWARDS || {})[ac.type] || {}).dailyLimit || 5;
      const used = (st.adCounts && st.adCounts[ac.type]) || 0;
      const left = Math.max(0, limit - used);

      App.UI.drawPanel(ctx, cx, cy, cw, ch, { r: 10, bg: '#5c2c16', border: '#a16207', lineWidth: 1.4 });
      App.UI.drawMiniIcon(ctx, ac.icon, cx + 14, cy + 14, 38);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(ac.title, cx + 60, cy + 28);
      ctx.fillStyle = '#fffbeb';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(ac.desc, cx + 60, cy + 48);
      ctx.fillStyle = '#fed7aa';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(`今日剩余 ${left}/${limit} 次`, cx + 60, cy + 64);
      ctx.restore();

      App.UI.drawAdButton(ctx, cx + 16, cy + 72, cw - 32, 30, left > 0 ? ac.btn : '今日已领满', {
        r: 7, fontSize: 11, disabled: left <= 0,
      }, () => {
        App.Platform.showRewardedAd('stamina', `${ac.title}：${ac.desc}`, () => App.State.claimAd(ac.type));
      });
    });
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });

    // 顶部三页签导航栏
    App.UI.drawPanel(ctx, 26, 68, W - 52, 40, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.6 });

    const tabs = [
      { id: 'quest', label: '每日战令', dot: App.State.hasUnclaimedQuestOrBox && App.State.hasUnclaimedQuestOrBox() },
      { id: 'achieve', label: '霸业成就', dot: App.State.hasUnclaimedAchievement && App.State.hasUnclaimedAchievement() },
      { id: 'sign', label: '七日签到·补给阁', dot: App.State.canFreeSignToday() },
    ];
    tabs.forEach((tb, i) => {
      const tx = 34 + i * 184, ty = 73, tw = 176, th = 30;
      const active = curTab === tb.id;
      App.UI.drawButton(ctx, tx, ty, tw, th, tb.label, {
        r: 7,
        grad: active ? ['#d97706', '#92400e'] : ['#5c2c16', '#32170a'],
        border: active ? '#fef08a' : '#78350f',
        fontSize: 12,
      }, () => { curTab = tb.id; });
      if (tb.dot) drawRedDot(ctx, tx + tw - 8, ty + 6);
    });

    App.UI.drawButton(ctx, W - 216, 74, 92, 28, '去天命抽奖', {
      r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11,
    }, () => App.Main.goScene('wheel'));

    App.UI.drawButton(ctx, W - 116, 74, 78, 28, '返回地图', {
      r: 7, bg: '#5c2c16', border: '#fde047', fontSize: 11,
    }, () => App.Main.goScene('map'));

    if (curTab === 'achieve') renderAchieveTab(ctx, st, W);
    else if (curTab === 'sign') renderSignTab(ctx, st, W);
    else renderQuestTab(ctx, st, W);

    App.Scenes.map.drawBottomNav(ctx, 'activity');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.activity = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
