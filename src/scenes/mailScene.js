(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 邮件 / 公告活动 / 兑换码（数据全部来自后端运营后台）
  const TYPE_NAMES = {
    gold: '铜钱', soul: '将魂', stamina: '粮草体力', ropes: '缚兽索', goldRopes: '黄金缚兽索',
    arenaTickets: '演武挑战令', wheelTickets: '轮盘抽奖券', lordExp: '主公经验',
  };
  const ACT_TAGS = { EXP_BOOST: '经验加成', DROP_BOOST: '掉落加成', STAMINA_DISCOUNT: '体力折扣', LOGIN_GIFT: '登录礼包', NOTICE: '公告' };
  const PER_PAGE = 6;

  let tab = 'mail';
  let page = 0;
  let selectedId = null;
  let busy = false;
  let loading = false;

  const fmtTime = (t, from, to) => String(t || '').replace('T', ' ').slice(from, to);

  function rewardText(r) {
    const C = App.Config;
    if (r.type === 'general') return `名将【${(C.GENERALS[r.id] || {}).name || r.id}】`;
    if (r.type === 'beast') return `神兽【${(C.BEASTS[r.id] || {}).shortName || r.id}】`;
    if (r.type === 'equip') return `【${(C.EQUIP_TEMPLATES[r.id] || {}).name || r.id}】×${r.amount}`;
    if (r.type === 'item') return `${(C.ITEMS[r.id] || {}).name || r.id}×${r.amount}`;
    return `${TYPE_NAMES[r.type] || r.type}+${r.amount}`;
  }

  function rewardsText(list) {
    return (list || []).map(rewardText).join(' · ');
  }

  function enter() {
    tab = 'mail';
    page = 0;
    selectedId = null;
    loading = true;
    Promise.all([App.API.refreshMails(), App.API.refreshActivities()]).then(() => { loading = false; });
  }

  async function claim(id) {
    if (busy) return;
    busy = true;
    const res = await App.API.claimMail(id);
    busy = false;
    if (!res.ok) return App.UI.showToast(res.msg || '领取失败', '#f87171');
    const got = rewardsText(res.rewards);
    App.UI.showToast(got ? `领取成功：${got}` : '没有可领取的附件', got ? '#4ade80' : '#fde047');
  }

  function redeem() {
    if (!App.API.isLoggedIn()) return App.UI.showToast('当前未连接服务器，无法兑换', '#f87171');
    App.Platform.promptText('请输入兑换码', async (code) => {
      if (busy) return;
      busy = true;
      const res = await App.API.redeemCode(code);
      busy = false;
      if (!res.ok) return App.UI.showToast(res.msg || '兑换失败', '#f87171');
      App.UI.showToast(`兑换成功：${rewardsText(res.rewards)}`, '#4ade80');
    });
  }

  function drawTabs(ctx, W) {
    App.UI.drawPanel(ctx, 26, 74, W - 52, 54, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    const tabs = [
      { id: 'mail', label: '📜 军情邮件' },
      { id: 'notice', label: '📣 公告活动' },
      { id: 'redeem', label: '🎁 兑换码' },
    ];
    tabs.forEach((t, i) => {
      const on = tab === t.id;
      App.UI.drawButton(ctx, 40 + i * 132, 84, 122, 34, t.label, {
        r: 8, bg: on ? '#b45309' : '#5c2c16', border: on ? '#fef08a' : '#a16207', fontSize: 12.5,
      }, () => { tab = t.id; page = 0; });
    });
    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = App.API.isOnline() ? '#86efac' : '#fca5a5';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(App.API.isOnline() ? '● 已连接服务器' : '● 离线（联网后可收取邮件）', W - 124, 106);
    ctx.restore();
    App.UI.drawButton(ctx, W - 108, 84, 70, 34, '返回', { r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12 }, () => App.Main.goScene('map'));
  }

  function drawEmpty(ctx, W, text) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#92400e';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.fillText(text, W / 2, 300);
    ctx.restore();
  }

  function drawMailTab(ctx, W) {
    const mails = App.API.getMails();
    if (!mails.length) return drawEmpty(ctx, W, loading ? '正在收取邮件…' : '暂无邮件，主公静候佳音');

    const maxPage = Math.max(0, Math.ceil(mails.length / PER_PAGE) - 1);
    page = Math.min(page, maxPage);
    const sel = mails.find((m) => m.id === selectedId) || mails[page * PER_PAGE];
    selectedId = sel.id;

    // 左侧列表
    mails.slice(page * PER_PAGE, (page + 1) * PER_PAGE).forEach((m, idx) => {
      const y = 138 + idx * 48;
      const on = m.id === selectedId;
      const hasGift = m.attachments && m.attachments.length;
      App.UI.drawPanel(ctx, 26, y, 372, 42, { r: 8, bg: on ? '#fde68a' : (m.status === 2 ? '#e7d7b0' : '#fff7e0'), border: on ? '#b45309' : '#a16207', lineWidth: on ? 2 : 1.2 });
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = m.status === 2 ? '#78716c' : '#451a03';
      ctx.font = `${m.status === 0 ? 'bold ' : ''}13px "PingFang SC", sans-serif`;
      ctx.fillText((hasGift ? '🎁 ' : '✉ ') + m.title.slice(0, 16), 38, y + 18);
      ctx.fillStyle = '#92400e';
      ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(`${m.sender || '系统'} · ${fmtTime(m.createdAt, 5, 16)}`, 38, y + 33);
      ctx.textAlign = 'right';
      ctx.fillStyle = m.status === 2 ? '#78716c' : (hasGift ? '#b45309' : '#57534e');
      ctx.fillText(m.status === 2 ? '已领取' : (hasGift ? '待领取' : (m.status === 0 ? '未读' : '已读')), 388, y + 26);
      ctx.restore();
      if (m.status === 0) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(392, y + 8, 4, 0, Math.PI * 2); ctx.fill();
      }
      App.UI.addHit(26, y, 372, 42, () => { selectedId = m.id; App.API.markMailRead(m.id); });
    });

    if (maxPage > 0) {
      App.UI.drawButton(ctx, 26, 430, 80, 30, '上一页', { r: 6, fontSize: 11, disabled: page <= 0 }, () => { page -= 1; selectedId = null; });
      App.UI.drawButton(ctx, 318, 430, 80, 30, '下一页', { r: 6, fontSize: 11, disabled: page >= maxPage }, () => { page += 1; selectedId = null; });
      ctx.save();
      ctx.textAlign = 'center'; ctx.fillStyle = '#7c2d12'; ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(`${page + 1} / ${maxPage + 1}`, 212, 449);
      ctx.restore();
    }

    // 右侧详情
    App.UI.drawPanel(ctx, 410, 138, W - 436, 322, { r: 10, bg: '#fff7e0', border: '#7c4a21', lineWidth: 1.6 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText(sel.title, 428, 168);
    ctx.fillStyle = '#92400e';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(`发件人：${sel.sender || '系统'}　${fmtTime(sel.createdAt, 0, 16)}${sel.expireAt ? '　有效期至 ' + fmtTime(sel.expireAt, 0, 16) : ''}`, 428, 188);
    ctx.fillStyle = '#57301a';
    ctx.font = '13px "PingFang SC", sans-serif';
    App.UI.drawWrappedText(ctx, sel.content || '（无正文）', 428, 216, W - 472, 20, 'left');
    ctx.restore();

    const gifts = sel.attachments || [];
    if (gifts.length) {
      App.UI.drawPanel(ctx, 424, 330, W - 464, 64, { r: 8, bg: '#fdecc0', border: '#d4a34b', lineWidth: 1.2 });
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText('附件奖励', 436, 348);
      ctx.fillStyle = '#7c2d12';
      ctx.font = '12px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, rewardsText(gifts), 436, 366, W - 490, 16, 'left');
      ctx.restore();
    }

    const claimable = gifts.length && sel.status < 2;
    App.UI.drawButton(ctx, 428, 408, 190, 40, sel.status === 2 ? '✓ 已领取' : (gifts.length ? '领取附件' : '无附件'), {
      r: 9, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 14, disabled: !claimable || busy,
    }, () => claim(sel.id));
    const anyClaimable = mails.some((m) => m.status < 2 && m.attachments && m.attachments.length);
    App.UI.drawButton(ctx, W - 232, 408, 190, 40, '一键领取全部', {
      r: 9, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 14, disabled: !anyClaimable || busy,
    }, () => claim(null));
  }

  function drawNoticeTab(ctx, W) {
    const acts = App.API.getActivities();
    if (!acts.length) return drawEmpty(ctx, W, loading ? '正在获取活动…' : '当前暂无进行中的活动与公告');
    acts.slice(0, 5).forEach((a, idx) => {
      const y = 138 + idx * 64;
      App.UI.drawPanel(ctx, 26, y, W - 52, 58, { r: 10, bg: '#fff7e0', border: '#a16207', lineWidth: 1.4 });
      ctx.save();
      ctx.fillStyle = a.type === 'NOTICE' ? '#0369a1' : '#b91c1c';
      App.UI.roundRect(ctx, 38, y + 10, 66, 20, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(ACT_TAGS[a.type] || '活动', 71, y + 24);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 14px "PingFang SC", sans-serif';
      const p = a.params || {};
      const effect = a.type === 'EXP_BOOST' ? `（主公经验 ×${p.multiplier}）`
        : a.type === 'DROP_BOOST' ? `（铜钱将魂 ×${p.multiplier}）`
          : a.type === 'STAMINA_DISCOUNT' ? `（体力消耗 ${Math.round(p.discount * 100) / 10} 折）`
            : a.type === 'LOGIN_GIFT' ? '（每日登录邮件发放）' : '';
      ctx.fillText(a.name + effect, 114, y + 25);
      ctx.fillStyle = '#7c2d12';
      ctx.font = '11px "PingFang SC", sans-serif';
      const desc = a.type === 'LOGIN_GIFT' && p.rewards ? rewardsText(p.rewards) : (a.description || '');
      ctx.fillText(desc.slice(0, 60), 38, y + 46);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#92400e';
      ctx.fillText(`${fmtTime(a.startAt, 5, 16)} ~ ${fmtTime(a.endAt, 5, 16)}`, W - 40, y + 25);
      ctx.restore();
    });
  }

  function drawRedeemTab(ctx, W) {
    App.UI.drawPanel(ctx, W / 2 - 250, 170, 500, 230, { r: 14, bg: '#fff7e0', border: '#7c4a21', lineWidth: 2 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 20px "PingFang SC", serif';
    ctx.fillText('兑换码礼包', W / 2, 214);
    ctx.fillStyle = '#7c2d12';
    ctx.font = '13px "PingFang SC", sans-serif';
    ctx.fillText('输入官方发放的兑换码，奖励将直接发放到主公帐下', W / 2, 246);
    ctx.fillText('同一批礼包每位主公限兑换一次', W / 2, 268);
    ctx.restore();
    App.UI.drawButton(ctx, W / 2 - 110, 300, 220, 50, busy ? '兑换中…' : '输入兑换码', {
      r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 16, disabled: busy,
    }, redeem);
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);
    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    drawTabs(ctx, W);
    if (tab === 'mail') drawMailTab(ctx, W);
    else if (tab === 'notice') drawNoticeTab(ctx, W);
    else drawRedeemTab(ctx, W);
    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.mail = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
