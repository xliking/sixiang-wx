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

  // 'ticket' = 抽奖券抽奖 | 'ingot' = 元宝祈愿抽奖（最低1元宝起抽，消耗越多高品几率越好）
  let spinMode = 'ticket';
  let ingotStake = 1;
  const STAKE_PRESETS = [1, 5, 10, 25, 50];

  function calcPrizeWeight(p, stake) {
    const base = Math.max(0, Number(p.weight) || 0);
    if (base <= 0 || stake <= 0) return base;
    const rw = p.reward || {};
    if (rw.ingot > 0) return base * (1 + stake * 0.14);
    const tier = p.tier || (rw.randomHero ? 4 : (rw.itemId === 'chest_gold' ? 3 : ((rw.itemId === 'chest_silver' || rw.itemId === 'recruit_edict' || rw.goldRopes) ? 2 : 1)));
    if (tier === 1) return base / (1 + stake * 0.55);
    if (tier === 2) return (base * (1 + Math.min(stake, 6) * 0.22)) / (1 + Math.max(0, stake - 6) * 0.12);
    if (tier === 3) return base * (1 + stake * 0.65);
    return base * (1 + stake * 0.85);
  }

  function calcQualityRates(prizes, stake) {
    let w1 = 0, w2 = 0, wHigh = 0;
    (prizes || []).forEach((p) => {
      const w = calcPrizeWeight(p, stake);
      const rw = p.reward || {};
      const tier = p.tier || (rw.randomHero || rw.ingot ? 4 : (rw.itemId === 'chest_gold' ? 3 : ((rw.itemId === 'chest_silver' || rw.itemId === 'recruit_edict' || rw.goldRopes) ? 2 : 1)));
      if (tier >= 3) wHigh += w;
      else if (tier === 2) w2 += w;
      else w1 += w;
    });
    const sum = Math.max(0.0001, w1 + w2 + wHigh);
    return {
      highPct: (wHigh / sum) * 100,
      epicPct: (w2 / sum) * 100,
      commPct: (w1 / sum) * 100,
    };
  }

  function startSpin(costIngot) {
    if (spinning || waiting) return;
    const st = App.State.get();
    const useIngot = Number(costIngot) || 0;
    if (useIngot > 0) {
      if ((st.ingot || 0) < useIngot) {
        App.UI.showToast(`元宝不足 ${useIngot}（当前 ${st.ingot || 0}），可先用铜钱换算元宝！`, '#fde047');
        if (App.UI.openExchangeModal) App.UI.openExchangeModal();
        return;
      }
    } else if ((st.wheelTickets || 0) <= 0) {
      App.UI.showToast('抽奖次数不足，可看视频免费领券或切换至【元宝抽奖】！', '#fbbf24');
      return;
    }

    waiting = true;
    App.State.spinWheel(useIngot).then((res) => {
      waiting = false;
      if (!res.ok) return;
      pendingResult = res;
      beginSpin(res.prizeIdx);
    });
  }

  function beginSpin(prizeIdx) {
    pendingPrizeIdx = prizeIdx;
    const sliceDeg = 360 / 8;
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
    const ease = 1 - Math.pow(1 - t, 3.4);
    wheelAngle = startAngle + (targetAngle - startAngle) * ease;

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

    App.UI.drawPanel(ctx, 14, 62, W - 28, 418, { r: 14, bg: '#2c160c', border: '#d4a34b', lineWidth: 2.5 });

    // 右上返回大地图按钮
    App.UI.drawButton(ctx, W - 110, 72, 82, 32, '返回地图', {
      r: 8, bg: '#78350f', border: '#fde047', fontSize: 11.5,
    }, () => { if (!spinning) App.Main.goScene('map'); });

    // 左侧：华丽 8 格鎏金天命大转盘
    const cx = 252;
    const cy = 270;
    const R = 166;
    const prizes = App.Config.WHEEL_PRIZES || [];
    const sliceRad = (Math.PI * 2) / Math.max(1, prizes.length);

    ctx.save();
    ctx.translate(cx, cy);

    // 外圈鎏金灯珠底座
    ctx.beginPath();
    ctx.arc(0, 0, R + 16, 0, Math.PI * 2);
    ctx.fillStyle = spinMode === 'ingot' ? '#5c190c' : '#78350f';
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

      ctx.save();
      ctx.rotate(idx * sliceRad + Math.PI / 2);
      ctx.fillStyle = p.textCol;
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      const rw = p.reward || {};
      const dynLabel = (spinMode === 'ingot' && rw.ingot)
        ? `元宝 +${Math.max(rw.ingot, Math.round(ingotStake * 1.5))}`
        : p.label;
      ctx.fillText(dynLabel, 0, -R + 30);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText((spinMode === 'ingot' && rw.ingot) ? '天命暴击!' : p.sub, 0, -R + 46);

      if (rw.ingot) {
        App.UI.drawMiniIcon(ctx, 'res_ingot', -18, -R + 54, 36);
      } else if (rw.itemId) {
        App.Sprites.drawEquipIcon(ctx, rw.itemId, -18, -R + 54, 36, { radius: 6, isItem: true });
      } else if (rw.randomHero) {
        App.Sprites.drawEquipIcon(ctx, App.Config.ITEMS.item_chest_77 ? 'item_chest_77' : 'chest_gold', -18, -R + 54, 36, { radius: 6 });
      } else if (rw.gold) {
        App.UI.drawMiniIcon(ctx, 'res_gold', -17, -R + 55, 34);
      } else if (rw.soul) {
        App.UI.drawMiniIcon(ctx, 'res_soul', -17, -R + 55, 34);
      } else if (rw.goldRopes) {
        App.UI.drawMiniIcon(ctx, 'res_rope', -17, -R + 55, 34);
      }
      ctx.restore();
    });
    ctx.restore();

    // 中心太极金盘按钮
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.fillStyle = spinMode === 'ingot' ? '#b45309' : '#dc2626';
    ctx.fill();
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spinning ? '转运中' : (spinMode === 'ingot' ? `${ingotStake}元宝` : '抽奖'), 0, 0);

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

    App.UI.addHit(cx - 42, cy - 42, 84, 84, () => startSpin(spinMode === 'ingot' ? ingotStake : 0));

    // 右侧：双模式切换面板（免费券抽 + 元宝加权抽奖）
    const rx = 468;
    const rwPanel = 456;
    App.UI.drawPanel(ctx, rx, 112, rwPanel, 352, { r: 12, bg: '#f4e6c4', border: '#a16207', lineWidth: 2 });

    // 顶部双模式标签
    App.UI.drawButton(ctx, rx + 18, 124, 204, 34, `抽奖券抽奖 (剩${st.wheelTickets || 0}次)`, {
      r: 8,
      grad: spinMode === 'ticket' ? ['#dc2626', '#991b1b'] : undefined,
      bg: spinMode === 'ticket' ? undefined : '#e5d3ab',
      border: spinMode === 'ticket' ? '#fef08a' : '#b48238',
      color: spinMode === 'ticket' ? '#fffbeb' : '#573318',
      fontSize: 12.5,
      disabled: spinning,
    }, () => { spinMode = 'ticket'; });

    App.UI.drawButton(ctx, rx + 232, 124, 206, 34, '★ 元宝抽奖 (高品加权)', {
      r: 8,
      grad: spinMode === 'ingot' ? ['#d97706', '#92400e'] : undefined,
      bg: spinMode === 'ingot' ? undefined : '#e5d3ab',
      border: spinMode === 'ingot' ? '#fef08a' : '#b48238',
      color: spinMode === 'ingot' ? '#fffbeb' : '#573318',
      fontSize: 12.5,
      disabled: spinning,
    }, () => { spinMode = 'ingot'; });

    const pityEvery = (App.Config.PARAMS && App.Config.PARAMS.wheelPityEvery) || 10;
    const pityLeft = pityEvery - ((st.wheelTotalSpins || 0) % pityEvery);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`累计已抽 ${st.wheelTotalSpins || 0} 次 · 再抽 ${pityLeft} 次必额外获赠【四象黄金宝箱】！`, rx + 20, 178);
    ctx.restore();
    App.UI.drawBar(ctx, rx + 20, 185, rwPanel - 40, 8, ((st.wheelTotalSpins || 0) % pityEvery) / pityEvery, '#f59e0b', '#3b2112');

    if (spinMode === 'ticket') {
      const baseRates = calcQualityRates(prizes, 0);
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(`当前可用抽奖券：${st.wheelTickets || 0} 张  （每日登录免费送 1 次！）`, rx + 20, 218);

      ctx.fillStyle = '#573318';
      ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillText('奖池包含：稀世低概率【元宝大奖】、SSR/UR随机名将、四象黄金宝箱、', rx + 20, 244);
      ctx.fillText('白银秘宝箱、天子招降圣旨、行军粮草丹与丰厚铜钱将魂！', rx + 20, 264);
      ctx.fillStyle = '#92400e';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText(`基础概率：金品/名将/元宝 ${baseRates.highPct.toFixed(1)}% · 史诗紫品 ${baseRates.epicPct.toFixed(1)}%（切至元宝抽可大幅提升！）`, rx + 20, 288);

      if (lastWonText) {
        ctx.fillStyle = '#9a3412';
        ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
        App.UI.drawWrappedText(ctx, '★ ' + lastWonText, rx + 20, 314, rwPanel - 40, 17, 'left');
      }
      ctx.restore();

      App.UI.drawButton(ctx, rx + 20, 392, 198, 54, spinning ? '轮盘旋转中...' : `立即抽奖 (剩${st.wheelTickets || 0}次)`, {
        r: 10,
        grad: ['#dc2626', '#991b1b'],
        border: '#fef08a',
        fontSize: 14.5,
        subText: '有机会爆稀世元宝与神将',
        disabled: spinning || (st.wheelTickets || 0) <= 0,
      }, () => startSpin(0));

      App.UI.drawAdButton(ctx, rx + 230, 392, 206, 54, '免费领抽奖次数', {
        r: 10,
        fontSize: 14.5,
        subText: '每次免费 +1 次天命抽奖',
        disabled: spinning,
      }, () => {
        App.Platform.showRewardedAd('wheel', '观看激励视频，免费获得 +1 次天命轮盘抽奖机会！', () => {
          App.State.claimAd('wheel');
        });
      });
    } else {
      // ★ 元宝祈愿抽奖模式：最低1元宝起抽，消耗越多高品几率越高！
      const minIngot = (App.Config.PARAMS && App.Config.PARAMS.wheelMinIngot) || 1;
      const maxIngot = (App.Config.PARAMS && App.Config.PARAMS.wheelMaxIngot) || 100;
      const rates = calcQualityRates(prizes, ingotStake);

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
      ctx.fillText(`选择单次投入元宝（最低 ${minIngot} 元宝起抽，投入越多高品大奖率越高）：`, rx + 20, 214);
      ctx.restore();

      let sx = rx + 20;
      STAKE_PRESETS.forEach((val) => {
        const active = ingotStake === val;
        App.UI.drawButton(ctx, sx, 224, 64, 30, `${val}元宝`, {
          r: 7,
          grad: active ? ['#d97706', '#92400e'] : undefined,
          bg: active ? undefined : '#e7d5b2',
          border: active ? '#fef08a' : '#b48238',
          color: active ? '#fffbeb' : '#451a03',
          fontSize: 11.5,
          disabled: spinning,
        }, () => { ingotStake = val; });
        sx += 68;
      });
      const isCustom = STAKE_PRESETS.indexOf(ingotStake) < 0;
      App.UI.drawButton(ctx, sx, 224, 76, 30, isCustom ? `${ingotStake}元宝✎` : '自定义…', {
        r: 7,
        grad: isCustom ? ['#d97706', '#92400e'] : undefined,
        bg: isCustom ? undefined : '#5c2c16',
        border: '#fde68a',
        color: '#fef08a',
        fontSize: 11,
        disabled: spinning,
      }, () => {
        App.Platform.promptText(`请输入单次抽奖投入元宝数（${minIngot} ~ ${maxIngot} 元宝）`, (txt) => {
          const n = Math.floor(Number(String(txt || '').trim()));
          if (!n || n < minIngot || n > maxIngot) {
            App.UI.showToast(`请输入 ${minIngot} ~ ${maxIngot} 之间的整数元宝`, '#fca5a5');
            return;
          }
          ingotStake = n;
        });
      });

      // 品质概率动态分布可视化框
      App.UI.drawPanel(ctx, rx + 20, 262, rwPanel - 40, 74, { r: 9, bg: '#3b190b', border: '#d97706', lineWidth: 1.4 });
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(
        `当前投入 ${ingotStake} 元宝  ▶  金装/SSR·UR神将大奖率：${rates.highPct.toFixed(1)}%`,
        rx + 32,
        282
      );
      ctx.fillStyle = '#e9d5ff';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(
        `史诗紫品率：${rates.epicPct.toFixed(1)}%   ·   普通军需率：${rates.commPct.toFixed(1)}%   （持有 ${st.ingot || 0} 元宝）`,
        rx + 32,
        301
      );

      // 三色堆叠品质概率条
      const bx = rx + 32, by = 312, bw = rwPanel - 64, bh = 12;
      App.UI.roundRect(ctx, bx, by, bw, bh, 6);
      ctx.clip();
      const wGold = Math.round((bw * rates.highPct) / 100);
      const wEpic = Math.round((bw * rates.epicPct) / 100);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(bx, by, wGold, bh);
      ctx.fillStyle = '#9333ea';
      ctx.fillRect(bx + wGold, by, wEpic, bh);
      ctx.fillStyle = '#475569';
      ctx.fillRect(bx + wGold + wEpic, by, Math.max(0, bw - wGold - wEpic), bh);
      ctx.restore();

      if (lastWonText) {
        ctx.save();
        ctx.fillStyle = '#9a3412';
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        App.UI.drawWrappedText(ctx, '★ ' + lastWonText, rx + 20, 354, rwPanel - 40, 16, 'left');
        ctx.restore();
      }

      App.UI.drawButton(ctx, rx + 20, 392, 224, 54, spinning ? '祈愿转运中...' : `消耗 ${ingotStake} 元宝立即抽奖`, {
        r: 10,
        grad: ['#d97706', '#92400e'],
        border: '#fef08a',
        fontSize: 14.5,
        subText: `金品神将率 ${rates.highPct.toFixed(1)}% · 抽UR几率倍增`,
        disabled: spinning,
      }, () => startSpin(ingotStake));

      App.UI.drawButton(ctx, rx + 254, 392, 182, 54, `货币互转 (余${st.ingot || 0})`, {
        r: 10,
        grad: ['#6b381b', '#43200d'],
        border: '#fbbf24',
        fontSize: 13.5,
        subText: `1元宝 = ${App.State.INGOT_EXCHANGE_RATE}铜钱`,
        disabled: spinning,
      }, () => {
        if (App.UI.openExchangeModal) App.UI.openExchangeModal();
      });
    }

    App.Scenes.map.drawBottomNav(ctx, '');
  }

  function leave() {
    if (pendingResult) {
      spinning = false;
      const res = pendingResult;
      pendingResult = null;
      res.apply();
      lastWonText = res.msg || '';
    }
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.wheel = { update, render, leave, isSpinning: () => spinning || waiting };
})(typeof globalThis !== 'undefined' ? globalThis : window);
