(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  let wheelAngle = 0;
  let spinning = false;
  let spinTimer = 0;
  let spinDuration = 3.2;
  let startAngle = 0;
  let targetAngle = 0;
  let pendingPrizeIdx = 0;
  let pendingResult = null;
  let waiting = false;
  let lastWonText = '';
  let lastSliceTick = -1;

  function startSpin() {
    if (spinning) return;
    const st = App.State.get();
    if ((st.wheelTickets || 0) <= 0) {
      App.UI.showToast('抽奖次数不足，点击右侧观看广告即可免费领取次数！', '#fbbf24');
      return;
    }
    // 抽中哪一格由服务端决定；先转动画，停下后再展示结果并更新存档
    if (waiting) return;
    waiting = true;
    App.State.spinWheel().then((res) => {
      waiting = false;
      if (!res.ok) return;
      pendingResult = res;
      beginSpin(res.prizeIdx);
    });
  }

  function beginSpin(prizeIdx) {
    pendingPrizeIdx = prizeIdx;
    const sliceDeg = 360 / 8;
    // 顶部指针在 -90deg (即 270deg)，让目标扇区中心对准顶部指针
    const targetSliceCenter = pendingPrizeIdx * sliceDeg;
    const desiredMod = (360 - targetSliceCenter) % 360;
    const curMod = ((wheelAngle % 360) + 360) % 360;
    let delta = desiredMod - curMod;
    if (delta < 0) delta += 360;

    startAngle = wheelAngle;
    targetAngle = wheelAngle + 360 * 5 + delta + (Math.random() - 0.5) * 16;
    spinTimer = 0;
    spinning = true;
    lastWonText = '';
    lastSliceTick = Math.floor(wheelAngle / 45);
    if (App.Audio) App.Audio.playSfx('wheel_tick', { speedRatio: 1 });
  }

  function update(dt) {
    if (!spinning) return;
    spinTimer += dt;
    const t = Math.min(1, spinTimer / spinDuration);
    // 三次缓出曲线，模拟真实转盘阻尼减速停顿
    const ease = 1 - Math.pow(1 - t, 3.4);
    wheelAngle = startAngle + (targetAngle - startAngle) * ease;

    // 轮盘每划过一格扇区，同步触发清脆拨片咔哒声（随转速自然由快变慢！）
    const curSlice = Math.floor(wheelAngle / 45);
    if (curSlice !== lastSliceTick) {
      lastSliceTick = curSlice;
      if (App.Audio) App.Audio.playSfx('wheel_tick', { speedRatio: 1 - t });
    }

    if (t >= 1) {
      spinning = false;
      const res = pendingResult;
      pendingResult = null;
      res.apply();
      lastWonText = res.msg;
      if (App.Audio) App.Audio.playSfx('wheel_win');
      App.UI.showToast(res.msg, '#fde047');
    }
  }

  function render(ctx, time) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#2c160c', border: '#d4a34b', lineWidth: 2.5 });

    // 右上返回大地图按钮
    App.UI.drawButton(ctx, W - 114, 74, 86, 34, '返回地图', {
      r: 8, bg: '#78350f', border: '#fde047', fontSize: 12,
    }, () => { if (!spinning) App.Main.goScene('map'); });

    // 左侧：华丽 8 格鎏金天命大转盘
    const cx = 258;
    const cy = 268;
    const R = 166;
    const prizes = App.Config.WHEEL_PRIZES;
    const sliceRad = (Math.PI * 2) / prizes.length;

    ctx.save();
    ctx.translate(cx, cy);

    // 外圈鎏金灯珠底座
    ctx.beginPath();
    ctx.arc(0, 0, R + 16, 0, Math.PI * 2);
    ctx.fillStyle = '#78350f';
    ctx.fill();
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 4;
    ctx.stroke();

    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      const blink = Math.floor(time * 6 + i) % 2 === 0;
      ctx.fillStyle = blink ? '#fef08a' : '#ef4444';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * (R + 8), Math.sin(a) * (R + 8), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // 旋转扇区层
    ctx.save();
    ctx.rotate(((wheelAngle - 90) * Math.PI) / 180);

    prizes.forEach((p, idx) => {
      const a0 = idx * sliceRad - sliceRad / 2;
      const a1 = a0 + sliceRad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R, a0, a1);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 扇区内奖品文字与图标
      ctx.save();
      ctx.rotate(idx * sliceRad + Math.PI / 2);
      ctx.fillStyle = p.textCol;
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.label, 0, -R + 30);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(p.sub, 0, -R + 46);

      if (p.reward.itemId) {
        App.Sprites.drawEquipIcon(ctx, p.reward.itemId, -18, -R + 54, 36, { radius: 6, isItem: true });
      }
      ctx.restore();
    });
    ctx.restore();

    // 中心太极金盘按钮
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 15px "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spinning ? '转运中' : '抽奖', 0, 0);

    // 顶部固定金红指针
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#7f1d1d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-14, -R - 22);
    ctx.lineTo(14, -R - 22);
    ctx.lineTo(0, -R + 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    App.UI.addHit(cx - 42, cy - 42, 84, 84, startSpin);

    // 右侧：天命轮盘说明、每日免费抽奖、看广告领抽奖次数、10抽保底黄金宝箱！
    const rx = 476;
    App.UI.drawPanel(ctx, rx, 118, 446, 336, { r: 12, bg: '#f4e6c4', border: '#a16207', lineWidth: 2 });

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7c2d12';
    ctx.font = 'bold 22px "PingFang SC", serif';
    ctx.fillText('🎡 天命八卦轮盘 · 每日幸运抽奖', rx + 22, 154);

    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 13px "PingFang SC", sans-serif';
    ctx.fillText(`当前可用抽奖次数：${st.wheelTickets || 0} 次   （每日登录免费送 1 次！）`, rx + 22, 186);

    const pityLeft = 10 - ((st.wheelTotalSpins || 0) % 10);
    ctx.fillStyle = '#b45309';
    ctx.fillText(`累计已抽 ${st.wheelTotalSpins || 0} 次 · 再抽 ${pityLeft} 次必额外获赠【四象黄金宝箱】！`, rx + 22, 212);
    App.UI.drawBar(ctx, rx + 22, 222, 400, 10, ((st.wheelTotalSpins || 0) % 10) / 10, '#f59e0b', '#3b2112');

    ctx.fillStyle = '#573318';
    ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText('奖池包含：SSR/UR随机名将、四象黄金宝箱、白银秘宝箱、', rx + 22, 256);
    ctx.fillText('天子招降圣旨、行军粮草丹、黄金缚兽索与海量铜钱将魂！', rx + 22, 276);

    if (lastWonText) {
      ctx.fillStyle = '#15803d';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, '🎁 ' + lastWonText, rx + 22, 304, 400, 18, 'left');
    }
    ctx.restore();

    App.UI.drawButton(ctx, rx + 22, 352, 192, 54, spinning ? '轮盘旋转中...' : `立即抽奖 (剩${st.wheelTickets || 0}次)`, {
      r: 10,
      grad: ['#dc2626', '#991b1b'],
      border: '#fef08a',
      fontSize: 15,
      subText: '抽取神装宝箱与名将',
      disabled: spinning || (st.wheelTickets || 0) <= 0,
    }, startSpin);

    App.UI.drawAdButton(ctx, rx + 226, 352, 198, 54, '免费领抽奖次数', {
      r: 10,
      fontSize: 14.5,
      subText: '每次免费 +1 次天命抽奖',
      disabled: spinning,
    }, () => {
      App.Platform.showRewardedAd('wheel', '观看激励视频，免费获得 +1 次天命轮盘抽奖机会！', () => {
        App.State.claimAd('wheel');
      });
    });

    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.wheel = { update, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
