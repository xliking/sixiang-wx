(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  let currentScene = 'faction';
  let lastTime = 0;
  let elapsed = 0;

  function goScene(name, params) {
    currentScene = name;
    if (App.Audio) App.Audio.setSceneBGM(name, params);
    const sc = App.Scenes[name];
    if (sc && sc.enter) sc.enter(params);
  }

  /** 开战：先向服务端申请（校验解锁、扣体力 / 挑战令），成功后才进入战斗场景 */
  function startBattle(mode, target, params) {
    return App.State.startBattle(mode, target).then((res) => {
      if (res.ok) goScene('battle', Object.assign({ mode, serverBattle: res.battle }, params));
      return res;
    });
  }

  let connecting = false;
  function connect() {
    if (connecting) return;
    connecting = true;
    App.API.boot().then((ok) => {
      connecting = false;
      // 没起过名号的玩家（包括老玩家）必须先起名
      if (ok) goScene(!App.State.getProfile().named ? 'name' : (App.State.get().factionId ? 'map' : 'faction'));
    });
  }

  // 连接服务器 / 连接失败重试界面
  App.Scenes = App.Scenes || {};
  App.Scenes.loading = {
    render(ctx, time) {
      const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
      ctx.fillStyle = '#1b140d';
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 30px "PingFang SC", serif';
      ctx.fillText('四象三国志', W / 2, H / 2 - 50);
      ctx.font = '14px "PingFang SC", sans-serif';
      const err = App.API.getLoginError();
      if (connecting || !err) {
        ctx.fillStyle = '#fde68a';
        ctx.fillText('正在连接服务器' + '.'.repeat(1 + Math.floor(time * 2) % 3), W / 2, H / 2);
      } else {
        ctx.fillStyle = '#fca5a5';
        ctx.fillText(err, W / 2, H / 2);
      }
      ctx.restore();
      if (!connecting && err) {
        App.UI.drawButton(ctx, W / 2 - 80, H / 2 + 30, 160, 44, '重新连接', { r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 15 }, connect);
      }
    },
  };

  function start() {
    App.Platform.initCanvas();
    // 存档在服务端：先显示连接中，登录拿到存档后再进入游戏
    currentScene = 'loading';
    connect();

    let lastX = 0;
    let movedDist = 0;

    App.Platform.bindPointerEvents({
      onDown: (x, y) => {
        if (App.Audio) App.Audio.unlock();
        lastX = x;
        movedDist = 0;
      },
      onMove: (x, y) => {
        if (App.Platform.adOverlay.active) return;
        const dx = x - lastX;
        lastX = x;
        movedDist += Math.abs(dx);
        if (movedDist > 6 && y < 380) {
          const sc = App.Scenes[currentScene];
          if (sc && sc.onDrag) sc.onDrag(dx);
        }
      },
      onUp: (x, y) => {
        if (App.Platform.adOverlay.active) return;
        if (movedDist < 10) {
          const sc = App.Scenes[currentScene];
          // 优先响应战场手动选点释放将领大招！
          if (sc && sc.onBattleClick && sc.onBattleClick(x, y)) return;
          App.UI.dispatchClick(x, y);
        }
      },
    });

    lastTime = Date.now();
    const loop = () => {
      const now = Date.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += dt;

      App.Platform.updateAdOverlay(dt);
      App.UI.updateToasts(dt);
      if (App.Audio) App.Audio.update();

      const sc = App.Scenes[currentScene];
      if (sc && sc.update) sc.update(dt);

      const ctx = App.Platform.getCtx();
      App.Platform.beginFrame();
      App.UI.clearHits();
      if (sc && sc.render) sc.render(ctx, elapsed);
      App.UI.drawToasts(ctx);
      App.UI.drawAdOverlay(ctx);
      App.Platform.endFrame();

      App.Platform.requestFrame(loop);
    };
    App.Platform.requestFrame(loop);
  }

  App.Main = { start, goScene, startBattle, getScene: () => currentScene };
})(typeof globalThis !== 'undefined' ? globalThis : window);
