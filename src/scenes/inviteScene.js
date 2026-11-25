(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  let info = null;
  let loading = false;

  async function load() {
    loading = true;
    try {
      const res = await App.API.get('/api/invite/info');
      if (res && res.ok) info = res;
    } finally {
      loading = false;
    }
  }

  function enter() { load(); }

  function label(ctx, text, x, y, font, color, align, maxW) {
    ctx.save();
    ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = color; ctx.font = font;
    ctx.fillText(text, x, y, maxW);
    ctx.restore();
  }

  function doShare() {
    const titles = info.shareTitles || [];
    const title = titles[Math.floor(Math.random() * Math.max(1, titles.length))] || '群英志';
    const real = App.Platform.share(title, 'inviter=' + info.code);
    if (!real) App.UI.showToast('邀请文案已复制，发给好友吧（邀请码 ' + info.code + '）', '#93c5fd');
    if (info.shareLeft > 0) App.State.shareClaim().then((res) => { if (res.ok) load(); });
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    ctx.fillStyle = '#c8ad78';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 16, 58, W - 32, 474, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 66, W - 52, 42, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    label(ctx, '邀请好友 · 同袍共战', 42, 87, 'bold 16px "PingFang SC", serif', '#fef08a');
    App.UI.drawCloseButton(ctx, W - 66, 71, 32, () => App.Main.goScene('map'));

    if (!info) {
      App.UI.drawPanelLoading(ctx, W / 2, 300, '正在清点同袍名册…');
      return;
    }

    // 左：邀请码 + 分享 + 绑定邀请人（铺满 y=118..520）
    App.UI.drawPanel(ctx, 28, 118, 300, 402, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
    label(ctx, '我的专属邀请码', 178, 146, 'bold 13.5px "PingFang SC", sans-serif', '#92400e', 'center');
    label(ctx, info.code, 178, 188, 'bold 36px "PingFang SC", serif', '#b45309', 'center');
    App.UI.drawButton(ctx, 44, 222, 126, 40, '复制邀请码', { r: 8, grad: ['#0369a1', '#0c4a6e'], border: '#bae6fd', fontSize: 13 }, () => {
      App.Platform.copyText(info.code);
      App.UI.showToast('邀请码已复制：' + info.code, '#93c5fd');
    });
    App.UI.drawButton(ctx, 186, 222, 126, 40, '分享给好友', { r: 8, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 13 }, doShare);
    label(ctx, `每日分享奖励（剩余 ${info.shareLeft} 次）：`, 44, 288, '12px "PingFang SC", sans-serif', '#92400e');
    label(ctx, (info.shareRewards || []).join(' · '), 44, 310, 'bold 12.5px "PingFang SC", sans-serif', '#15803d', 'left', 268);

    App.UI.drawPanel(ctx, 44, 336, 268, 168, { r: 8, bg: '#f4e6c4', border: '#c9a66b', lineWidth: 1 });
    if (info.inviter) {
      label(ctx, '我的引荐同袍', 178, 388, '12.5px "PingFang SC", sans-serif', '#92400e', 'center');
      label(ctx, info.inviter, 178, 424, 'bold 19px "PingFang SC", serif', '#451a03', 'center', 240);
    } else {
      label(ctx, '填写好友的邀请码可得：', 58, 362, '12px "PingFang SC", sans-serif', '#92400e');
      ctx.save(); ctx.textBaseline = 'middle'; ctx.fillStyle = '#15803d'; ctx.font = 'bold 12px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, (info.inviteeRewards || []).join(' · '), 58, 388, 240, 18, 'left');
      ctx.restore();
      App.UI.drawButton(ctx, 58, 444, 240, 42, info.canBind ? '填写邀请码' : '已超过可填写的等级', { r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13, disabled: !info.canBind }, () => {
        App.Platform.promptText('输入好友的邀请码', (text) => App.State.bindInviter(String(text || '').trim()).then((res) => { if (res.ok) load(); }));
      });
    }

    // 中：阶梯奖励
    App.UI.drawPanel(ctx, 338, 118, 332, 402, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
    label(ctx, `有效邀请：${info.validCount} 人`, 354, 144, 'bold 14px "PingFang SC", serif', '#451a03');
    label(ctx, `好友主公达 Lv.${info.validLordLv} 计为有效`, 654, 144, '11px "PingFang SC", sans-serif', '#92400e', 'right');
    (info.milestones || []).slice(0, 4).forEach((m, i) => {
      const y = 166 + i * 86, reached = info.validCount >= m.count;
      App.UI.drawPanel(ctx, 350, y, 308, 76, { r: 8, bg: '#f4e6c4', border: '#c9a66b', lineWidth: 1 });
      label(ctx, `邀请 ${m.count} 位有效好友`, 364, y + 22, 'bold 13px "PingFang SC", sans-serif', '#451a03');
      ctx.save(); ctx.textBaseline = 'middle'; ctx.fillStyle = '#15803d'; ctx.font = '11.5px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, (m.rewards || []).join(' · '), 364, y + 46, 206, 16, 'left');
      ctx.restore();
      App.UI.drawButton(ctx, 578, y + 20, 68, 36, m.claimed ? '已领取' : (reached ? '领取' : `${info.validCount}/${m.count}`), {
        r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12.5, disabled: m.claimed || !reached,
      }, () => App.State.claimInvite(m.count).then((res) => { if (res.ok) load(); }));
    });

    // 右：已邀请的好友
    App.UI.drawPanel(ctx, 680, 118, 252, 402, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
    label(ctx, `我邀请的好友（${(info.invitees || []).length}）`, 694, 144, 'bold 14px "PingFang SC", serif', '#451a03');
    (info.invitees || []).slice(0, 13).forEach((p, i) => {
      const y = 176 + i * 26;
      label(ctx, `${p.name}`, 694, y, '12.5px "PingFang SC", sans-serif', '#451a03', 'left', 120);
      label(ctx, `Lv.${p.lv}`, 836, y, '12px "PingFang SC", sans-serif', '#92400e');
      label(ctx, p.valid ? '有效' : '未达标', 918, y, 'bold 12px "PingFang SC", sans-serif', p.valid ? '#15803d' : '#a8a29e', 'right');
    });
    if (!(info.invitees || []).length) label(ctx, '还没有好友应邀，快去分享吧', 806, 310, '12.5px "PingFang SC", sans-serif', '#92400e', 'center');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.invite = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
