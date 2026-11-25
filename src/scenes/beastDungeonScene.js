(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();
    const dungeons = App.Config.getBeastDungeons();
    const lordLv = st.lordLevel || 1;
    const anyUnlocked = lordLv >= (App.State.BEAST_UNLOCK_LORD_LV || 15);

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 64, W - 28, 408, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });

    ctx.save();
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.textAlign = 'left';
    ctx.fillText('四象神兽高难抓捕副本（击败神兽立即判胜，战后开启几率抓捕！）', 28, 92, W - 150);
    ctx.fillStyle = anyUnlocked ? '#15803d' : '#dc2626';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(
      `阶梯解锁：青龙 Lv.15 · 朱雀 Lv.20 · 玄武 Lv.25 · 白虎 Lv.30（当前主公 Lv.${lordLv}）`,
      28, 114, W - 150
    );
    ctx.restore();

    App.UI.drawButton(ctx, W - 108, 76, 80, 34, '返回地图', {
      r: 8, bg: '#5c2c16', border: '#d4a34b', fontSize: 12,
    }, () => App.Main.goScene('map'));

    const cardW = 216;
    const cardH = 330;
    const gap = 12;

    dungeons.forEach((d, idx) => {
      const bCfg = App.Config.BEASTS[d.beastId];
      const owned = st.ownedBeasts[d.beastId];
      const reqLv = App.Config.getBeastUnlockLv ? App.Config.getBeastUnlockLv(d.beastId) : (d.unlockLordLv || 15);
      const cardUnlocked = lordLv >= reqLv;
      const cx = 28 + idx * (cardW + gap);
      const cy = 126;

      App.UI.drawPanel(ctx, cx, cy, cardW, cardH, {
        r: 12,
        bg: '#241811',
        border: cardUnlocked ? bCfg.glow : '#57534e',
        lineWidth: 2.2,
      });

      ctx.save();
      if (!cardUnlocked) ctx.globalAlpha = 0.50;
      App.Portraits.drawBeastPortrait(ctx, d.beastId, cx + 48, cy + 14, 120, { radius: 14, lineWidth: 2.5 });
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = bCfg.glow;
      ctx.font = 'bold 16px "PingFang SC", serif';
      ctx.fillText(bCfg.name, cx + cardW / 2, cy + 154);

      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`绝技【${bCfg.skillName}】`, cx + cardW / 2, cy + 174, cardW - 18);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, bCfg.skillDesc, cx + cardW / 2, cy + 190, cardW - 20, 14, 'center');

      ctx.fillStyle = owned ? '#4ade80' : (cardUnlocked ? '#fca5a5' : '#94a3b8');
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(
        owned ? `已抓捕 Lv.${owned.lv}（再抓进阶）` : `Lv.${reqLv}可抓 · 基础率 ${Math.round(bCfg.baseCatchRate * 100)}% (金索翻倍)`,
        cx + cardW / 2, cy + 236, cardW - 16
      );

      const recPower = App.Config.scaleRecommendedPower('beast', d.recommendedPower || d.recommendedLv * 1850, d);
      const canBeat = App.State.getTeamPower() >= recPower;
      ctx.fillStyle = canBeat ? '#86efac' : '#fca5a5';
      ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(`高难度 · 推荐战力 ${recPower}`, cx + cardW / 2, cy + 254, cardW - 18);
      ctx.restore();

      if (!cardUnlocked) {
        App.UI.drawButton(ctx, cx + 20, cy + 268, cardW - 40, 46, `🔒 主公 Lv.${reqLv} 解锁`, {
          r: 9, bg: '#57534e', border: '#a8a29e', fontSize: 12.5,
          subText: `当前 Lv.${lordLv} · 前往主线升级`,
        }, () => {
          App.UI.showToast(`当前主公 Lv.${lordLv}，达到 Lv.${reqLv} 方可挑战抓捕【${bCfg.name}】！`, '#fbbf24');
          App.Main.goScene('map');
        });
      } else {
        const hasSta = st.stamina >= App.State.getStaminaCost(d.staminaCost);
        const onBeastAct = () => {
          if (!hasSta) {
            App.Platform.showRewardedAd('stamina', '观看激励视频，立刻恢复 +15 军粮体力！', () => {
              App.State.claimAd('stamina');
            });
            return;
          }
          App.Main.startBattle('beast', d.id, { level: d });
        };
        if (hasSta) {
          App.UI.drawButton(ctx, cx + 20, cy + 268, cardW - 40, 46, '讨伐并抓捕', {
            r: 9,
            grad: [bCfg.color, bCfg.darkColor],
            border: '#fef08a',
            fontSize: 13,
            subText: `耗 ${App.State.getStaminaCost(d.staminaCost)} 体力`,
          }, onBeastAct);
        } else {
          App.UI.drawAdButton(ctx, cx + 20, cy + 268, cardW - 40, 46, '免费补粮 +15', {
            r: 9,
            fontSize: 13,
            subText: '恢复军粮后立即讨伐',
          }, onBeastAct);
        }
      }
    });

    App.Scenes.map.drawBottomNav(ctx, 'beastDungeon');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.beastDungeon = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
