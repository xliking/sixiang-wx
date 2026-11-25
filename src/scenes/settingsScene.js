(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  const REWARD_NAMES = {
    gold: '铜钱', ingot: '元宝', soul: '将魂', stamina: '粮草体力', ropes: '缚兽索', goldRopes: '黄金缚兽索',
    arenaTickets: '演武挑战令', wheelTickets: '轮盘抽奖券', lordExp: '主公经验', guildCoin: '联盟贡献',
  };

  let busy = false;
  let syncing = false;
  let battleModalOpen = false;
  let activeBattleRef = null;

  function enter() {
    busy = false;
  }

  function openBattleModal(battle) {
    battleModalOpen = true;
    activeBattleRef = battle || null;
    if (activeBattleRef) {
      activeBattleRef.settingsPaused = true;
      if (App.BattleEngine && App.BattleEngine.syncPaused) App.BattleEngine.syncPaused(activeBattleRef);
      else activeBattleRef.paused = true;
    }
    if (App.Main && App.Main.markDirty) App.Main.markDirty();
  }

  function closeBattleModal() {
    battleModalOpen = false;
    if (activeBattleRef) {
      activeBattleRef.settingsPaused = false;
      if (App.BattleEngine && App.BattleEngine.syncPaused) App.BattleEngine.syncPaused(activeBattleRef);
      else activeBattleRef.paused = !!(activeBattleRef.userPaused || activeBattleRef.adPaused || activeBattleRef.retreatConfirmOpen);
    }
    activeBattleRef = null;
    if (App.Main && App.Main.markDirty) App.Main.markDirty();
  }

  function isBattleModalOpen() {
    return battleModalOpen;
  }

  function formatReward(r) {
    const C = App.Config || {};
    if (r.type === 'general') return `名将【${((C.GENERALS || {})[r.id] || {}).name || r.id}】`;
    if (r.type === 'beast') return `神兽【${((C.BEASTS || {})[r.id] || {}).shortName || r.id}】`;
    if (r.type === 'equipSet') return `整套【${((C.EQUIP_SETS || {})[r.id] || {}).name || r.id}】×${r.amount}`;
    if (r.type === 'equip') return `【${((C.EQUIP_TEMPLATES || {})[r.id] || {}).name || r.id}】×${r.amount}`;
    if (r.type === 'artifact') return `法宝【${((C.ARTIFACTS || {})[r.id] || {}).name || r.id}】×${r.amount}`;
    if (r.type === 'item') return `${((C.ITEMS || {})[r.id] || {}).name || r.id}×${r.amount}`;
    return `${REWARD_NAMES[r.type] || r.type}+${r.amount}`;
  }

  function openFeedbackEntry(isInBattle) {
    if (!isInBattle) {
      App.Main.goScene('mail', { tab: 'feedback' });
      return;
    }
    if (!App.API.isLoggedIn()) return App.UI.showToast('当前未连接服务器，无法提交反馈', '#f87171');
    App.Platform.promptText('请描述当前战局遇到的问题或建议（4~300 个字）', async (content) => {
      const trimmed = String(content || '').trim();
      if (trimmed.length < 4) return App.UI.showToast('请填写不少于 4 个字的反馈描述', '#fbbf24');
      if (busy) return;
      busy = true;
      const st = App.State.get();
      const modeTag = activeBattleRef && activeBattleRef.mode ? `战局:${activeBattleRef.mode}` : '战局中';
      const info = `Lv.${st.lordLevel || 1} · ${modeTag} · 通关${st.maxClearedOrder || 0}城`;
      const res = await App.API.submitFeedback('BUG', trimmed, '', info);
      busy = false;
      if (!res || !res.ok) return App.UI.showToast((res && res.msg) || '提交失败', '#f87171');
      App.UI.showToast(res.msg || '战局异常反馈已成功提交，感谢主公指正！', '#4ade80');
    }, { maxLength: 300 });
  }

  async function syncRemoteConfig() {
    if (syncing) return;
    syncing = true;
    try {
      const ok = await App.API.boot();
      App.UI.showToast(ok ? '已同步最新服务端配置与美术清单！' : '同步未完成，请检查网络连接', ok ? '#4ade80' : '#fbbf24');
    } finally {
      syncing = false;
      if (App.Main && App.Main.markDirty) App.Main.markDirty();
    }
  }

  // ★ 古风开合拨块按钮
  function drawSwitchPill(ctx, x, y, on, onClick) {
    const w = 64, h = 26, r = 13;
    ctx.save();
    App.UI.roundRect(ctx, x, y, w, h, r);
    if (on) {
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#c86d19');
      g.addColorStop(1, '#85420e');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
    } else {
      ctx.fillStyle = '#574c43';
      ctx.fill();
      ctx.strokeStyle = '#a89f91';
    }
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const knobR = 9.5;
    const kx = on ? (x + w - 13) : (x + 13);
    const ky = y + h / 2;
    ctx.beginPath();
    ctx.arc(kx, ky, knobR, 0, Math.PI * 2);
    ctx.fillStyle = on ? '#fef9c3' : '#d6d3d1';
    ctx.fill();

    ctx.fillStyle = on ? '#fef9c3' : '#e7e5e4';
    ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(on ? '开启' : '关闭', on ? (x + 24) : (x + w - 24), ky + 0.5);
    ctx.restore();

    App.UI.addHit(x - 4, y - 3, w + 8, h + 6, onClick);
  }

  // ★ 5 段式可点击鎏金音量进度控制器（含 [-]/[+] 微调与点击任意格直达）
  function drawVolumeControl(ctx, x, y, w, labelText, enabledKey, volKey, playSample) {
    const S = App.Settings;
    const muted = S.get('muted');
    const enabled = !muted && S.get(enabledKey);
    const vol = S.get(volKey);
    const pct = enabled ? Math.round(vol * 100) : 0;

    App.UI.drawPanel(ctx, x, y, w, 74, { r: 9, bg: '#f4e6c4', border: '#c9a66b', lineWidth: 1 });

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 13px "PingFang SC", sans-serif';
    ctx.fillText(labelText, x + 12, y + 20);

    ctx.fillStyle = enabled ? '#b45309' : '#78716c';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(enabled ? `${pct}%` : '静音', x + 114, y + 20);
    ctx.restore();

    drawSwitchPill(ctx, x + w - 76, y + 7, enabled, () => {
      const next = !enabled;
      if (next && muted) S.set('muted', false);
      S.set(enabledKey, next);
      if (next && S.get(volKey) <= 0.05) S.set(volKey, 0.5);
      if (next && playSample && App.Audio) App.Audio.playSfx('coin');
    });

    // 底部：[-] + 5 段音量金砖 + [+]
    const btnY = y + 40;
    App.UI.drawButton(ctx, x + 12, btnY, 28, 24, '－', {
      r: 6, bg: '#6b381b', border: '#d4a34b', fontSize: 13,
    }, () => {
      const nextV = Math.max(0, Math.round((vol - 0.2) * 100) / 100);
      S.set(volKey, nextV);
      if (nextV <= 0) S.set(enabledKey, false);
      else if (playSample && App.Audio) App.Audio.playSfx('coin');
    });

    const segCount = 5;
    const segAreaX = x + 48;
    const segAreaW = w - 96;
    const segGap = 5;
    const segW = (segAreaW - segGap * (segCount - 1)) / segCount;
    for (let i = 0; i < segCount; i++) {
      const threshold = (i + 1) * 0.2;
      const active = enabled && vol >= threshold - 0.05;
      const sx = segAreaX + i * (segW + segGap);
      ctx.save();
      App.UI.roundRect(ctx, sx, btnY + 3, segW, 18, 5);
      if (active) {
        const sg = ctx.createLinearGradient(sx, btnY + 3, sx, btnY + 21);
        sg.addColorStop(0, '#f59e0b');
        sg.addColorStop(1, '#b45309');
        ctx.fillStyle = sg;
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
      } else {
        ctx.fillStyle = 'rgba(120, 113, 108, 0.28)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(120, 113, 108, 0.45)';
      }
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.restore();

      App.UI.addHit(sx, btnY, segW, 24, () => {
        if (muted) S.set('muted', false);
        S.set(enabledKey, true);
        S.set(volKey, threshold);
        if (playSample && App.Audio) App.Audio.playSfx('coin');
      });
    }

    App.UI.drawButton(ctx, x + w - 40, btnY, 28, 24, '＋', {
      r: 6, bg: '#6b381b', border: '#d4a34b', fontSize: 13,
    }, () => {
      if (muted) S.set('muted', false);
      S.set(enabledKey, true);
      const nextV = Math.min(1, Math.round((vol + 0.2) * 100) / 100);
      S.set(volKey, nextV || 0.2);
      if (playSample && App.Audio) App.Audio.playSfx('coin');
    });
  }

  function drawOptionRow(ctx, x, y, w, title, desc, key, onAfterChange) {
    const S = App.Settings;
    const on = !!S.get(key);
    App.UI.drawPanel(ctx, x, y, w, 54, { r: 9, bg: '#f4e6c4', border: '#c9a66b', lineWidth: 1 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
    ctx.fillText(title, x + 12, y + 18);
    ctx.fillStyle = '#92400e';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText(desc, x + 12, y + 38, w - 96);
    ctx.restore();

    drawSwitchPill(ctx, x + w - 74, y + 14, on, () => {
      const val = S.toggle(key);
      if (onAfterChange) onAfterChange(val);
    });
  }

  function drawSettingsContent(ctx, panelX, panelY, panelW, panelH, isInBattle, onClose) {
    const S = App.Settings;
    const st = App.State.get();
    const pf = App.State.getProfile();
    const fac = (App.Config.FACTIONS && App.Config.FACTIONS[st.factionId]) || {};

    App.UI.drawPanel(ctx, panelX, panelY, panelW, panelH, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2.2 });
    const headX = panelX + 12, headY = panelY + 10, headW = panelW - 24, headH = 44;
    App.UI.drawPanel(ctx, headX, headY, headW, headH, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });

    const iconSpr = App.Assets && App.Assets.get ? App.Assets.get('icon_settings') : null;
    if (iconSpr) {
      ctx.drawImage(iconSpr, headX + 8, headY + 3, 38, 38);
    } else if (App.UI.drawVectorGear) {
      App.UI.drawVectorGear(ctx, headX + 27, headY + 22, 12, '#fde047');
    }

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText(isInBattle ? '沙场军机设置 · 战局已暂停' : '系统设置 · 音律画质与主公档案', headX + 52, headY + 22);
    ctx.restore();

    if (isInBattle) {
      const battleCloseLabel = (activeBattleRef && activeBattleRef.userPaused) ? '返回战场' : '继续作战';
      App.UI.drawButton(ctx, headX + headW - 134, headY + 5, 82, 34, battleCloseLabel, {
        r: 8, grad: ['#b91c1c', '#7f1d1d'], border: '#fde047', fontSize: 12.5,
      }, onClose);
      App.UI.drawCloseButton(ctx, headX + headW - 42, headY + 6, 32, onClose);
    } else {
      App.UI.drawCloseButton(ctx, headX + headW - 42, headY + 6, 32, onClose);
    }

    const bodyY = headY + headH + 10;
    const colH = panelH - (bodyY - panelY) - 12;
    const gap = 10;
    const colW = Math.floor((panelW - 24 - gap * 2) / 3);
    const c1X = panelX + 12;
    const c2X = c1X + colW + gap;
    const c3X = c2X + colW + gap;

    // ==================== 左栏：音律雅乐与声效 ====================
    App.UI.drawPanel(ctx, c1X, bodyY, colW, colH, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText('音律雅乐 · 声效调节', c1X + 14, bodyY + 20);
    ctx.restore();

    const isMuted = S.get('muted');
    App.UI.drawPanel(ctx, c1X + 12, bodyY + 36, colW - 24, 46, { r: 9, bg: '#f4e6c4', border: '#c9a66b', lineWidth: 1 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
    ctx.fillText('全局声音总开关', c1X + 24, bodyY + 59);
    ctx.fillStyle = isMuted ? '#dc2626' : '#15803d';
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.fillText(isMuted ? '（已全静音）' : '（正常播放）', c1X + 116, bodyY + 59);
    ctx.restore();
    drawSwitchPill(ctx, c1X + colW - 86, bodyY + 46, !isMuted, () => {
      const nowMuted = App.Audio.toggleMute();
      if (!nowMuted && App.Audio) App.Audio.playSfx('coin');
    });

    drawVolumeControl(ctx, c1X + 12, bodyY + 90, colW - 24, '国风背景音乐', 'bgmEnabled', 'bgmVolume', false);
    drawVolumeControl(ctx, c1X + 12, bodyY + 172, colW - 24, '战斗与界面音效', 'sfxEnabled', 'sfxVolume', true);

    drawOptionRow(ctx, c1X + 12, bodyY + 254, colW - 24, '战鼓大招震动反馈', '释放绝技、破城与招降时轻微震动', 'vibrate', (v) => {
      if (v && App.Platform.vibrateShort) App.Platform.vibrateShort('medium');
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#92400e';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText('点击音量格或 ＋/－ 可分段微调音量大小', c1X + colW / 2, bodyY + colH - 12);
    ctx.restore();

    // ==================== 中栏：沙场战斗与画质偏好 ====================
    App.UI.drawPanel(ctx, c2X, bodyY, colW, colH, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText('沙场画面 · 操控偏好', c2X + 14, bodyY + 20);
    ctx.restore();

    drawOptionRow(ctx, c2X + 12, bodyY + 36, colW - 24, '镜头自动跟随先锋', '开战自动推进视角；关闭可自由滑屏', 'autoCamera', (val) => {
      if (activeBattleRef) activeBattleRef.autoCam = val;
    });
    drawOptionRow(ctx, c2X + 12, bodyY + 98, colW - 24, '受击与大招震屏', '名将释放无双绝技或攻破城池时震动画面', 'screenShake');
    drawOptionRow(ctx, c2X + 12, bodyY + 160, colW - 24, '普通兵卒伤害飘字', '关闭后仅保留暴击与绝技大字，混战更清爽', 'damageFloat');
    drawOptionRow(ctx, c2X + 12, bodyY + 222, colW - 24, '高清天象与神装流光', '关闭切换流畅省电模式，降低长战发热', 'highQualityVfx');

    App.UI.drawButton(ctx, c2X + 20, bodyY + colH - 46, colW - 40, 34, '恢复默认音画设置', {
      r: 8, grad: ['#785233', '#52341c'], border: '#d4a34b', fontSize: 12,
    }, () => {
      S.reset();
      if (activeBattleRef) activeBattleRef.autoCam = true;
      if (App.Audio) App.Audio.playSfx('coin');
      App.UI.showToast('已恢复默认音律音量与画面设置', '#fde68a');
    });

    // ==================== 右栏：主公名帖与系统工具 ====================
    App.UI.drawPanel(ctx, c3X, bodyY, colW, colH, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.2 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText('主公名帖 · 系统工具', c3X + 14, bodyY + 20);
    ctx.restore();

    // 主公简明档案卡
    const pCardX = c3X + 12, pCardY = bodyY + 34, pCardW = colW - 24, pCardH = 82;
    App.UI.drawPanel(ctx, pCardX, pCardY, pCardW, pCardH, { r: 9, bg: '#f4e6c4', border: '#c9a66b', lineWidth: 1 });
    ctx.save();
    ctx.fillStyle = fac.color || '#78716c';
    App.UI.roundRect(ctx, pCardX + 10, pCardY + 11, 44, 44, 10);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 21px "PingFang SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fac.badge || '主', pCardX + 32, pCardY + 33);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 14px "PingFang SC", serif';
    ctx.fillText(`${pf.nickname || '主公'}  Lv.${st.lordLevel || 1}`, pCardX + 64, pCardY + 23, pCardW - 74);
    ctx.fillStyle = '#92400e';
    ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(`主公 ID：${pf.playerId || '-'}  ·  ${fac.name || '群雄'}`, pCardX + 64, pCardY + 44, pCardW - 74);

    const online = App.API && App.API.isOnline && App.API.isOnline();
    ctx.fillStyle = online ? '#15803d' : '#dc2626';
    ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
    ctx.fillText(online ? '● 云端存档已实时同步连接' : '● 网络重连中（操作将自动重试）', pCardX + 12, pCardY + 69);
    ctx.restore();

    const halfBtnW = Math.floor((pCardW - 8) / 2);
    App.UI.drawButton(ctx, pCardX, bodyY + 126, halfBtnW, 36, '修改名号', {
      r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 12.5,
    }, () => {
      App.Platform.promptText('请输入新的主公名号（2~8 个字）', (name) => App.State.rename(name));
    });
    App.UI.drawButton(ctx, pCardX + halfBtnW + 8, bodyY + 126, halfBtnW, 36, '复制主公 ID', {
      r: 8, grad: ['#6b381b', '#43200d'], border: '#d4a34b', fontSize: 12.5,
    }, () => {
      App.Platform.copyText(String(pf.playerId || ''));
      App.UI.showToast('主公 ID 已复制：' + (pf.playerId || '-'), '#fde68a');
    });

    App.UI.drawButton(ctx, pCardX, bodyY + 172, pCardW, 40, isInBattle ? '上报战局异常反馈' : '意见反馈 · 问题建议', {
      r: 9, grad: ['#9a3412', '#6b2110'], border: '#fde68a', fontSize: 12.5,
      subText: '提交游戏体验建议与战局异常报告',
    }, () => openFeedbackEntry(isInBattle));

    App.UI.drawButton(ctx, pCardX, bodyY + 222, pCardW, 40, syncing ? '正在同步最新资源…' : '刷新配置与美术资源', {
      r: 9, grad: ['#5c3a1e', '#3b2310'], border: '#d4a34b', fontSize: 12.5,
      subText: '重新拉取最新关卡数值与原画清单',
      disabled: syncing,
    }, syncRemoteConfig);

    if (App.Compliance) {
      App.UI.drawButton(ctx, pCardX, bodyY + 272, halfBtnW, 34, '用户服务协议', {
        r: 8, bg: '#5c3a1e', border: '#d4a34b', fontSize: 12,
      }, () => App.Compliance.openDoc('terms'));
      App.UI.drawButton(ctx, pCardX + halfBtnW + 8, bodyY + 272, halfBtnW, 34, '隐私保护指引', {
        r: 8, bg: '#5c3a1e', border: '#d4a34b', fontSize: 12,
      }, () => App.Compliance.openDoc('privacy'));
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#92400e';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText(`群英志 · 已通关 ${st.maxClearedOrder || 0} 城 · 云端护档`, c3X + colW / 2, bodyY + colH - 13);
    ctx.restore();
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    ctx.fillStyle = '#c8ad78';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);
    drawSettingsContent(ctx, 16, 58, W - 32, 474, false, () => App.Main.goScene('map'));
  }

  function drawBattleModal(ctx) {
    if (!battleModalOpen) return;
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    App.UI.addHit(0, 0, W, H, () => {});
    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 2, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    drawSettingsContent(ctx, 16, 52, W - 32, 434, true, closeBattleModal);
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.settings = {
    enter,
    render,
    openBattleModal,
    closeBattleModal,
    isBattleModalOpen,
    drawBattleModal,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
