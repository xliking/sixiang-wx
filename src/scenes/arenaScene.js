(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});
  let matches = [];

  function enter() {
    refreshMatches();
  }

  // 对手由服务端生成并保存，客户端只展示
  async function refreshMatches(isManual) {
    const list = await App.API.fetchArenaMatches(!!isManual);
    if (list.length) matches = list;
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 14, 64, W - 28, 408, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });

    App.UI.drawPanel(ctx, 28, 78, W - 56, 54, { r: 10, bg: '#5c2c16', border: '#d4a34b' });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText(`天下演武场 · 微信玩家军团匹配 PK`, 44, 104);
    ctx.fillStyle = '#fde68a';
    ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText(`我的排名：第 ${st.arenaRank} 名   主公 Lv.${st.lordLevel}   我的战力：${App.State.getTeamPower()}   挑战令：${st.arenaTickets}`, 44, 123);
    ctx.restore();

    App.UI.drawButton(ctx, W - 270, 88, 108, 34, '🔄 换一批对手', {
      r: 8, grad: ['#b45309', '#78350f'], border: '#fde047', fontSize: 12,
    }, () => {
      refreshMatches(true);
      App.UI.showToast('已为您刷新一批全新演武场对手！', '#fef08a');
    });

    App.UI.drawAdButton(ctx, W - 154, 88, 118, 34, '挑战令 +3', {
      r: 8, fontSize: 11.5,
    }, () => {
      App.Platform.showRewardedAd('arena_ticket', '观看激励视频，免费领取演武场挑战令 +3！', () => {
        App.State.claimAd('arena_ticket');
      });
    });

    const cardW = 290;
    const cardH = 304;
    matches.slice(0, 3).forEach((m, idx) => {
      const cx = 28 + idx * (cardW + 17);
      const cy = 146;

      App.UI.drawPanel(ctx, cx, cy, cardW, cardH, { r: 12, bg: '#e8d4a6', border: '#9a3412', lineWidth: 2 });
      App.UI.drawWoodHeader(ctx, cx + 8, cy + 8, cardW - 16, 48);

      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 15px "PingFang SC", sans-serif';
      ctx.fillText(`第 ${m.rank} 名 · ${m.playerName}`, cx + 18, cy + 30);
      ctx.fillStyle = '#fde68a';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(`${m.title}   军团战力：${m.power}`, cx + 18, cy + 48);

      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`对方出战阵容（最多5将）：`, cx + 14, cy + 78);
      ctx.restore();

      m.generals.slice(0, 4).forEach((gid, gIdx) => {
        const px = cx + 14 + gIdx * 66;
        App.Portraits.drawGeneralPortrait(ctx, gid, px, cy + 88, 58, { radius: 8, lineWidth: 1.6 });
        ctx.save();
        ctx.fillStyle = '#451a03';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(App.Config.GENERALS[gid].name, px + 29, cy + 160);
        ctx.restore();
      });

      ctx.save();
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      const bName = m.beast ? App.Config.BEASTS[m.beast].name : '无守护神兽';
      ctx.fillText(`守护神兽：${bName}`, cx + 14, cy + 186);
      ctx.fillStyle = '#15803d';
      ctx.fillText(`奖励：经验+140 铜钱+${m.rewardGold} 必掉神装`, cx + 14, cy + 210);
      ctx.restore();

      App.UI.drawButton(ctx, cx + 28, cy + 236, cardW - 56, 48, st.arenaTickets > 0 ? '发起军团 PK' : '挑战令不足', {
        r: 10,
        grad: ['#dc2626', '#991b1b'],
        border: '#fef08a',
        fontSize: 15,
        subText: st.arenaTickets > 0 ? '消耗1张挑战令' : '点击上方看广告领取',
        disabled: st.arenaTickets <= 0,
      }, () => {
        App.Main.startBattle('arena', m.id, { arenaMatch: m, level: { biome: 'plains', order: 8, lordExp: 140 } }).then((res) => { if (!res.ok) refreshMatches(false); });
      });
    });

    App.Scenes.map.drawBottomNav(ctx, 'arena');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.arena = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
