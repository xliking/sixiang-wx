(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });

    // ================= 上半区：七日登录签到送名将神装（类王者荣耀福利系统） =================
    App.UI.drawPanel(ctx, 26, 74, W - 52, 186, { r: 12, bg: '#451a03', border: '#d4a34b', lineWidth: 2 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 15px "PingFang SC", serif';
    ctx.fillText('🎁 七日登录签到（次日送【孙尚香】· 五日送【方天画戟】· 七日送【诸葛亮】！）', 40, 98);
    ctx.restore();

    App.UI.drawButton(ctx, W - 216, 80, 92, 26, '去天命抽奖', {
      r: 6, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11,
    }, () => App.Main.goScene('wheel'));

    App.UI.drawButton(ctx, W - 116, 80, 78, 26, '返回地图', {
      r: 6, bg: '#5c2c16', border: '#fde047', fontSize: 11,
    }, () => App.Main.goScene('map'));

    App.State.SIGN_REWARDS.forEach((rw, idx) => {
      const cw = 112;
      const cx = 38 + idx * (cw + 8);
      const cy = 110;
      const claimed = idx < st.signDays;
      const isNext = idx === st.signDays;

      App.UI.drawPanel(ctx, cx, cy, cw, 102, {
        r: 10,
        bg: claimed ? '#14532d' : (isNext ? '#9a3412' : '#291810'),
        border: isNext ? '#fde047' : (claimed ? '#4ade80' : '#78350f'),
        lineWidth: isNext ? 2.5 : 1.4,
      });

      if (rw.generalId) {
        App.Portraits.drawGeneralPortrait(ctx, rw.generalId, cx + 31, cy + 22, 50, { radius: 8, lineWidth: 1.5 });
      } else if (rw.equipId) {
        App.Sprites.drawEquipIcon(ctx, rw.equipId, cx + 31, cy + 22, 50, { radius: 8, lineWidth: 1.5 });
      } else {
        ctx.save();
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 22px "PingFang SC", serif';
        ctx.textAlign = 'center';
        ctx.fillText('礼', cx + cw / 2, cy + 54);
        ctx.restore();
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`第${rw.day}天 · ${rw.title}`, cx + cw / 2, cy + 16);
      ctx.fillStyle = claimed ? '#86efac' : '#fffbeb';
      ctx.font = 'bold 9px "PingFang SC", sans-serif';
      ctx.fillText(claimed ? '✓ 已领取' : rw.desc.replace('送SSR名将', '').replace('送UR神将', '').slice(0, 9), cx + cw / 2, cy + 90);
      ctx.restore();
    });

    if (st.signDays < 7) {
      const canFree = App.State.canFreeSignToday();
      App.UI.drawButton(ctx, 290, 218, 176, 34, canFree ? `免费签到领第${st.signDays + 1}天豪礼` : '今日已签', {
        r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12, disabled: !canFree,
      }, () => {
        App.State.claimSignDay(false);
      });

      App.UI.drawAdButton(ctx, 480, 218, 210, 34, `提前领第${st.signDays + 1}天豪礼`, {
        r: 8, fontSize: 12,
      }, () => {
        App.Platform.showRewardedAd('stamina', `观看激励视频，提前解锁第 ${st.signDays + 1} 天签到豪礼！`, () => {
          App.State.claimSignDay(true);
        });
      });
    }

    // ================= 左下：每日战令活跃任务 =================
    App.UI.drawPanel(ctx, 26, 268, 536, 194, { r: 12, bg: '#ead4a2', border: '#854d0e', lineWidth: 1.8 });
    ctx.save();
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 14px "PingFang SC", sans-serif';
    ctx.fillText('📜 每日战令任务（完成领大量铜钱、将魂与主公经验）', 38, 290);
    ctx.restore();

    App.State.DAILY_QUEST_DEFS.forEach((q, idx) => {
      const y = 300 + idx * 38;
      const cur = Math.min(q.target, st.questProgress[q.id] || 0);
      const claimed = !!st.questProgress.claimed[q.id];
      const done = cur >= q.target;

      ctx.save();
      ctx.fillStyle = '#3b2112';
      App.UI.roundRect(ctx, 38, y, 510, 32, 7);
      ctx.fill();
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${q.title} (${cur}/${q.target})`, 48, y + 20);
      ctx.fillStyle = '#fde047';
      ctx.fillText(`铜钱+${q.gold} 魂+${q.soul}`, 306, y + 20);
      ctx.restore();

      App.UI.drawButton(ctx, 456, y + 4, 84, 24, claimed ? '已领取' : (done ? '领取奖励' : '去完成'), {
        r: 6,
        grad: done && !claimed ? ['#16a34a', '#15803d'] : ['#78350f', '#451a03'],
        border: '#fef08a', fontSize: 10, disabled: claimed,
      }, () => {
        if (done) {
          App.State.claimQuest(q.id);
        } else {
          App.Main.goScene(q.id === 'enhance_eq' ? 'warehouse' : (q.id === 'arena_pk' ? 'arena' : 'map'));
        }
      });
    });

    // ================= 右下：观看激励广告军需宝库（看广告得铜钱、粮草体力、将魂金索） =================
    App.UI.drawPanel(ctx, 574, 268, 360, 194, { r: 12, bg: '#3b2112', border: '#d4a34b', lineWidth: 1.8 });
    ctx.save();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px "PingFang SC", sans-serif';
    ctx.fillText('🎬 免费军需补给阁（看广告领丰厚物资）', 588, 292);
    ctx.restore();

    const adCards = [
      { title: '观看广告 · 领 1800 铜钱军饷', btn: '免费领铜钱', fn: () => App.State.claimAd('welfare_gold') },
      { title: '观看广告 · 领 18 点粮草体力', btn: '免费领粮草', fn: () => App.State.claimAd('welfare_stamina') },
      { title: '观看广告 · 领 80 将魂 + 黄金索', btn: '免费领将魂', fn: () => App.State.claimAd('welfare_soul') },
    ];

    adCards.forEach((ac, idx) => {
      const y = 304 + idx * 48;
      App.UI.drawPanel(ctx, 586, y, 336, 40, { r: 8, bg: '#5c2c16', border: '#a16207' });
      ctx.save();
      ctx.fillStyle = '#fef3c7';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(ac.title, 598, y + 25);
      ctx.restore();

      App.UI.drawAdButton(ctx, 814, y + 6, 100, 28, ac.btn, {
        r: 7, fontSize: 10.5,
      }, () => {
        App.Platform.showRewardedAd('stamina', ac.title, ac.fn);
      });
    });

    App.Scenes.map.drawBottomNav(ctx, 'activity');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.activity = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
