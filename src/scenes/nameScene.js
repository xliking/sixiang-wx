(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 新玩家必须先起名号，起名成功后才能选择阵营
  function ask() {
    App.Platform.promptText('请为自己起一个名号（2~8 个字）', (name) => {
      App.State.rename(name).then((res) => { if (res.ok) App.Main.goScene(App.State.get().factionId ? 'map' : 'faction'); });
    });
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    ctx.fillStyle = '#1b140d';
    ctx.fillRect(0, 0, W, H);
    App.UI.drawPanel(ctx, W / 2 - 250, 130, 500, 280, { r: 16, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2.4 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#451a03'; ctx.font = 'bold 26px "PingFang SC", serif';
    ctx.fillText('敢问主公尊姓大名？', W / 2, 196);
    ctx.fillStyle = '#7c2d12'; ctx.font = '14px "PingFang SC", sans-serif';
    ctx.fillText('乱世将启，请先为自己起一个响亮的名号', W / 2, 236);
    ctx.fillText('2~8 个字，可用汉字、字母、数字；之后可在名帖中修改', W / 2, 260);
    ctx.restore();
    App.UI.drawButton(ctx, W / 2 - 120, 300, 240, 56, '起 名 号', { r: 12, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 18, disabled: App.State.isBusy() }, ask);
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.name = { render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
