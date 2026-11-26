(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 邮件 / 公告活动 / 兑换码 / 意见反馈（数据全部来自后端运营后台）
  const TYPE_NAMES = {
    gold: '铜钱', ingot: '元宝', soul: '将魂', stamina: '粮草体力', ropes: '缚兽索', goldRopes: '黄金缚兽索',
    arenaTickets: '演武挑战令', wheelTickets: '轮盘抽奖券', lordExp: '主公经验', guildCoin: '联盟贡献',
  };
  const ACT_TAGS = { EXP_BOOST: '经验加成', DROP_BOOST: '掉落加成', STAMINA_DISCOUNT: '体力折扣', LOGIN_GIFT: '登录礼包', NOTICE: '公告' };
  const FB_CATS = [
    { id: 'BUG', label: '异常反馈' },
    { id: 'SUGGEST', label: '玩法建议' },
    { id: 'BALANCE', label: '数值体验' },
    { id: 'OTHER', label: '其他问题' },
  ];
  const PER_PAGE = 6;
  const PER_FB_PAGE = 3;

  let tab = 'mail';
  let page = 0;
  let selectedId = null;
  let fbPage = 0;
  let selectedFbId = null;
  let busy = false;
  let loading = false;

  const fbDraft = {
    category: 'BUG',
    content: '',
    contact: '',
  };

  const fmtTime = (t, from, to) => String(t || '').replace('T', ' ').slice(from, to);

  function rewardText(r) {
    const C = App.Config || {};
    if (r.type === 'general') return `名将【${((C.GENERALS || {})[r.id] || {}).name || r.id}】`;
    if (r.type === 'beast') return `神兽【${((C.BEASTS || {})[r.id] || {}).shortName || r.id}】`;
    if (r.type === 'equipSet') return `整套【${((C.EQUIP_SETS || {})[r.id] || {}).name || r.id}】×${r.amount}`;
    if (r.type === 'equip') return `【${((C.EQUIP_TEMPLATES || {})[r.id] || {}).name || r.id}】×${r.amount}`;
    if (r.type === 'artifact') return `法宝【${((C.ARTIFACTS || {})[r.id] || {}).name || r.id}】×${r.amount}`;
    if (r.type === 'item') return `${((C.ITEMS || {})[r.id] || {}).name || r.id}×${r.amount}`;
    return `${TYPE_NAMES[r.type] || r.type}+${r.amount}`;
  }

  function rewardsText(list) {
    return (list || []).map(rewardText).join(' · ');
  }

  function enter(params) {
    tab = (params && params.tab) || 'mail';
    page = 0;
    selectedId = null;
    fbPage = 0;
    selectedFbId = null;
    loading = true;
    Promise.all([
      App.API.refreshMails(),
      App.API.refreshActivities(),
      App.API.refreshFeedbacks ? App.API.refreshFeedbacks() : Promise.resolve(),
    ]).then(() => {
      loading = false;
      if (App.Main && App.Main.markDirty) App.Main.markDirty();
    });
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

  async function submitFeedbackForm() {
    if (!App.API.isLoggedIn()) return App.UI.showToast('当前未连接服务器，无法提交反馈', '#f87171');
    const text = String(fbDraft.content || '').trim();
    if (text.length < 4) {
      App.Platform.promptText('请输入反馈详细描述（4~300 个字）', (val) => {
        fbDraft.content = val;
        if (App.Main && App.Main.markDirty) App.Main.markDirty();
      }, { maxLength: 300, defaultValue: fbDraft.content });
      return;
    }
    if (busy) return;
    busy = true;
    const st = App.State.get();
    const clientInfo = `Lv.${st.lordLevel || 1} · 通关${st.maxClearedOrder || 0}城 · ${App.Platform.isWechat ? '微信小游戏' : '网页端'}`;
    const res = await App.API.submitFeedback(fbDraft.category, text, fbDraft.contact, clientInfo);
    busy = false;
    if (!res || !res.ok) {
      App.UI.showToast((res && res.msg) || '提交失败，请稍后再试', '#f87171');
      return;
    }
    fbDraft.content = '';
    fbPage = 0;
    selectedFbId = res.id || null;
    if (App.Audio) App.Audio.playSfx('coin');
    App.UI.showToast(res.msg || '反馈已提交！核实有效将通过邮件发放谢礼', '#4ade80');
  }

  async function refreshFeedbackList() {
    if (loading) return;
    loading = true;
    await Promise.all([
      App.API.refreshFeedbacks ? App.API.refreshFeedbacks() : Promise.resolve(),
      App.API.refreshMails(),
    ]);
    loading = false;
    App.UI.showToast('已刷新最新反馈处理进度与邮件', '#fde68a');
  }

  function drawTabs(ctx, W) {
    App.UI.drawPanel(ctx, 26, 66, W - 52, 46, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    const tabs = [
      { id: 'mail', label: '军情邮件' },
      { id: 'notice', label: '公告活动' },
      { id: 'feedback', label: '意见反馈' },
    ];
    tabs.forEach((t, i) => {
      const on = tab === t.id;
      const bx = 38 + i * 124;
      App.UI.drawButton(ctx, bx, 73, 116, 32, t.label, {
        r: 8, bg: on ? '#b45309' : '#5c2c16', border: on ? '#fef08a' : '#a16207', fontSize: 12.5,
      }, () => { tab = t.id; page = 0; });
      if (t.id === 'mail' && App.API.hasUnclaimedMail()) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(bx + 110, 78, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
    App.UI.drawCloseButton(ctx, W - 66, 73, 32, () => App.Main.goScene('map'));
  }

  function drawEmpty(ctx, W, text, isSpin) {
    if (isSpin && App.UI.drawPanelLoading) {
      App.UI.drawPanelLoading(ctx, W / 2, 295, text);
      return;
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#92400e';
    ctx.font = '14px "PingFang SC", sans-serif';
    ctx.fillText(text, W / 2, 300);
    ctx.restore();
  }

  function drawMailTab(ctx, W) {
    const mails = App.API.getMails();
    if (!mails.length) return drawEmpty(ctx, W, loading ? '正在快马传书收取军情…' : '暂无邮件，主公静候佳音', loading);

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
      ctx.fillText((hasGift ? '【礼】' : '【信】') + m.title.slice(0, 15), 38, y + 18);
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

    App.UI.drawPagination(ctx, 26, 482, 372, 28, page, maxPage + 1, (p) => { page = p; selectedId = null; });

    // 右侧详情（满高铺展至 y=518）
    App.UI.drawPanel(ctx, 410, 122, W - 436, 396, { r: 10, bg: '#fff7e0', border: '#7c4a21', lineWidth: 1.6 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText(sel.title, 428, 154);
    ctx.fillStyle = '#92400e';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(`发件人：${sel.sender || '系统'}　${fmtTime(sel.createdAt, 0, 16)}${sel.expireAt ? '　有效期至 ' + fmtTime(sel.expireAt, 0, 16) : ''}`, 428, 176);
    ctx.fillStyle = '#57301a';
    ctx.font = '13px "PingFang SC", sans-serif';
    App.UI.drawWrappedText(ctx, sel.content || '（无正文）', 428, 206, W - 472, 20, 'left');
    ctx.restore();

    const gifts = sel.attachments || [];
    if (gifts.length) {
      App.UI.drawPanel(ctx, 424, 372, W - 464, 76, { r: 8, bg: '#fdecc0', border: '#d4a34b', lineWidth: 1.2 });
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#92400e';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText('附件奖励', 436, 390);
      let gx = 436;
      const gy = 398;
      gifts.slice(0, 6).forEach((r) => {
        if (r.type === 'equip' || r.type === 'item') {
          App.Sprites.drawEquipIcon(ctx, r.id, gx, gy, 34, { radius: 6, lineWidth: 1.4, noAnim: true });
          gx += 40;
        } else if (r.type === 'equipSet') {
          const s = App.Config.EQUIP_SETS && App.Config.EQUIP_SETS[r.id];
          const firstPiece = s && s.pieceIds && s.pieceIds[0];
          if (firstPiece) {
            App.Sprites.drawEquipIcon(ctx, firstPiece, gx, gy, 34, {
              radius: 6,
              lineWidth: 1.8,
              border: s.ascendAffinity === 'xian' ? '#67e8f9' : (s.ascendAffinity === 'mo' ? '#e879f9' : '#facc15'),
              noAnim: true,
            });
            gx += 40;
          }
        } else if (r.type === 'general') {
          App.Portraits.drawGeneralPortrait(ctx, r.id, gx, gy, 34, { radius: 6, lineWidth: 1.4 });
          gx += 40;
        } else if (r.type === 'beast') {
          App.Portraits.drawBeastPortrait(ctx, r.id, gx, gy, 34, { radius: 6, lineWidth: 1.4 });
          gx += 40;
        } else {
          const iconMap = { gold: 'res_gold', ingot: 'res_ingot', soul: 'res_soul', stamina: 'res_stamina', ropes: 'res_rope', goldRopes: 'res_gold_rope' };
          if (iconMap[r.type]) {
            App.UI.drawMiniIcon(ctx, iconMap[r.type], gx, gy + 2, 30);
            gx += 35;
          }
        }
      });
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      App.UI.drawWrappedText(ctx, rewardsText(gifts), gx + 4, 411, Math.max(120, W - 46 - gx), 15, 'left');
      ctx.restore();
    }

    const claimable = gifts.length && sel.status < 2;
    App.UI.drawButton(ctx, 428, 460, 190, 42, sel.status === 2 ? '✓ 已领取' : (gifts.length ? '领取附件' : '无附件'), {
      r: 9, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 14, disabled: !claimable || busy,
    }, () => claim(sel.id));
    const anyClaimable = mails.some((m) => m.status < 2 && m.attachments && m.attachments.length);
    App.UI.drawButton(ctx, W - 232, 460, 190, 42, '一键领取全部', {
      r: 9, grad: ['#16a34a', '#15803d'], border: '#bbf7d0', fontSize: 14, disabled: !anyClaimable || busy,
    }, () => claim(null));
  }

  function drawNoticeTab(ctx, W) {
    const acts = App.API.getActivities();
    if (!acts.length) return drawEmpty(ctx, W, loading ? '正在调阅朝廷邸报与活动…' : '当前暂无进行中的活动与公告', loading);
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

  function drawFeedbackTab(ctx, W) {
    const leftX = 26, leftW = 424, topY = 122, boxH = 396;
    const rightX = 462, rightW = W - 26 - rightX; // 472

    // ==================== 左栏：撰写并提交意见反馈 ====================
    App.UI.drawPanel(ctx, leftX, topY, leftW, boxH, { r: 10, bg: '#fff7e0', border: '#7c4a21', lineWidth: 1.6 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 15px "PingFang SC", serif';
    ctx.fillText('建言献策 · 问题反馈', leftX + 14, topY + 20);

    App.UI.roundRect(ctx, leftX + leftW - 144, topY + 10, 130, 20, 10);
    ctx.fillStyle = '#fde68a';
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 10px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('有效采纳赠邮件好礼', leftX + leftW - 79, topY + 20.5);
    ctx.restore();

    // 4 大反馈分类胶囊
    const catGap = 6;
    const catW = Math.floor((leftW - 28 - catGap * 3) / 4);
    FB_CATS.forEach((c, idx) => {
      const cx = leftX + 14 + idx * (catW + catGap);
      const on = fbDraft.category === c.id;
      App.UI.drawButton(ctx, cx, topY + 38, catW, 28, c.label, {
        r: 7,
        grad: on ? ['#d97706', '#92400e'] : undefined,
        bg: on ? undefined : '#e7d7b0',
        border: on ? '#fef08a' : '#b48238',
        color: on ? '#fffbeb' : '#57301a',
        fontSize: 11.5,
      }, () => { fbDraft.category = c.id; });
    });

    // 反馈内容输入预览框
    const contentX = leftX + 14, contentY = topY + 74, contentW = leftW - 28, contentH = 114;
    App.UI.drawPanel(ctx, contentX, contentY, contentW, contentH, {
      r: 9, bg: '#f4e6c4', border: fbDraft.content ? '#b45309' : '#c9a66b', lineWidth: 1.3,
    });
    ctx.save();
    ctx.textAlign = 'left';
    if (fbDraft.content) {
      ctx.fillStyle = '#451a03';
      ctx.font = '12.5px "PingFang SC", sans-serif';
      const lines = App.UI.wrapLinesCached(ctx, fbDraft.content, contentW - 24).slice(0, 4);
      lines.forEach((ln, i) => {
        const suffix = (i === 3 && fbDraft.content.length > ln.length * 4) ? '…' : '';
        ctx.fillText(ln + suffix, contentX + 12, contentY + 22 + i * 20, contentW - 24);
      });
    } else {
      ctx.fillStyle = '#9a7b56';
      ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillText('点击此处输入遇到的问题详情或改进建议（4~300 个字）…', contentX + 12, contentY + 26, contentW - 24);
      ctx.fillText('例如：关卡异常、技能显示问题、新玩法构想等', contentX + 12, contentY + 48, contentW - 24);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#92400e';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText(`${fbDraft.content.length}/300 · 点击编辑`, contentX + contentW - 10, contentY + contentH - 10);
    ctx.restore();

    App.UI.addHit(contentX, contentY, contentW, contentH, () => {
      App.Platform.promptText('请输入反馈详细描述（4~300 个字）', (val) => {
        fbDraft.content = val;
        if (App.Main && App.Main.markDirty) App.Main.markDirty();
      }, { maxLength: 300, defaultValue: fbDraft.content });
    });

    // 选填联系方式栏
    const ctX = leftX + 14, ctY = topY + 196, ctW = leftW - 28, ctH = 34;
    App.UI.drawPanel(ctx, ctX, ctY, ctW, ctH, { r: 8, bg: '#f4e6c4', border: '#c9a66b', lineWidth: 1.1 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText('联系方式：', ctX + 12, ctY + ctH / 2);
    ctx.fillStyle = fbDraft.contact ? '#451a03' : '#9a7b56';
    ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(fbDraft.contact || '选填微信号 / 手机号，方便核实沟通', ctX + 74, ctY + ctH / 2, ctW - (fbDraft.contact ? 126 : 86));
    ctx.restore();

    if (fbDraft.contact) {
      App.UI.drawButton(ctx, ctX + ctW - 46, ctY + 5, 38, 24, '清空', {
        r: 5, bg: '#785233', border: '#d4a34b', fontSize: 10,
      }, () => { fbDraft.contact = ''; });
      App.UI.addHit(ctX, ctY, ctW - 50, ctH, () => {
        App.Platform.promptText('请输入联系方式（选填，最多 40 个字）', (val) => { fbDraft.contact = val; }, { maxLength: 40, defaultValue: fbDraft.contact });
      });
    } else {
      App.UI.addHit(ctX, ctY, ctW, ctH, () => {
        App.Platform.promptText('请输入联系方式（选填，最多 40 个字）', (val) => { fbDraft.contact = val; }, { maxLength: 40, defaultValue: fbDraft.contact });
      });
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#92400e';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText('后台核实反馈有效后，物品谢礼将直接发往【军情邮件】', leftX + leftW / 2, topY + 250);
    ctx.restore();

    App.UI.drawButton(ctx, leftX + 92, topY + 266, leftW - 184, 44, busy ? '正在呈交…' : (fbDraft.content ? '呈交军机处' : '填写并提交反馈'), {
      r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 14.5, disabled: busy,
    }, submitFeedbackForm);

    // ==================== 右栏：我的反馈记录与处理回复 ====================
    App.UI.drawPanel(ctx, rightX, topY, rightW, boxH, { r: 10, bg: '#fff7e0', border: '#7c4a21', lineWidth: 1.6 });
    const list = App.API.getFeedbacks ? App.API.getFeedbacks() : [];

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 15px "PingFang SC", serif';
    ctx.fillText(`我的反馈记录（${list.length}）`, rightX + 14, topY + 20);
    ctx.restore();

    App.UI.drawButton(ctx, rightX + rightW - 82, topY + 8, 68, 24, '刷新进度', {
      r: 6, bg: '#5c3a1e', border: '#d4a34b', fontSize: 10.5, disabled: loading,
    }, refreshFeedbackList);

    if (!list.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#92400e';
      ctx.font = '13px "PingFang SC", sans-serif';
      ctx.fillText(loading ? '正在调阅反馈记录…' : '暂无提交记录，欢迎主公随时建言献策', rightX + rightW / 2, topY + 158);
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillStyle = '#a16207';
      ctx.fillText('被采纳的有效反馈将获赠元宝、铜钱或稀有道具好礼！', rightX + rightW / 2, topY + 184);
      ctx.restore();
      return;
    }

    const maxFbPage = Math.max(0, Math.ceil(list.length / PER_FB_PAGE) - 1);
    fbPage = Math.min(fbPage, maxFbPage);
    const pageItems = list.slice(fbPage * PER_FB_PAGE, (fbPage + 1) * PER_FB_PAGE);
    const selFb = list.find((x) => x.id === selectedFbId) || pageItems[0];
    selectedFbId = selFb.id;

    pageItems.forEach((item, idx) => {
      const iy = topY + 38 + idx * 38;
      const isSel = item.id === selectedFbId;
      App.UI.drawPanel(ctx, rightX + 12, iy, rightW - 24, 34, {
        r: 7,
        bg: isSel ? '#fde68a' : '#f4e6c4',
        border: isSel ? '#b45309' : '#c9a66b',
        lineWidth: isSel ? 1.8 : 1.1,
      });

      const statusText = item.status === 1 ? '✓ 有效赠礼' : (item.status === 2 ? '已回复' : '待处理');
      const statusCol = item.status === 1 ? '#15803d' : (item.status === 2 ? '#57534e' : '#b45309');

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#451a03';
      ctx.font = `${isSel ? 'bold ' : ''}12px "PingFang SC", sans-serif`;
      const summary = `【${item.categoryName || '反馈'}】${String(item.content || '').replace(/\s+/g, ' ')}`;
      ctx.fillText(summary.slice(0, 22) + (summary.length > 22 ? '…' : ''), rightX + 20, iy + 17, rightW - 148);

      ctx.textAlign = 'right';
      ctx.fillStyle = statusCol;
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(statusText, rightX + rightW - 20, iy + 12);
      ctx.fillStyle = '#92400e';
      ctx.font = '9.5px "PingFang SC", sans-serif';
      ctx.fillText(fmtTime(item.createdAt, 5, 16), rightX + rightW - 20, iy + 25);
      ctx.restore();

      App.UI.addHit(rightX + 12, iy, rightW - 24, 34, () => { selectedFbId = item.id; });
    });

    // 选中反馈详情与军机处回复卡片
    const detX = rightX + 12, detY = topY + 154, detW = rightW - 24, detH = 132;
    App.UI.drawPanel(ctx, detX, detY, detW, detH, { r: 9, bg: '#f4e6c4', border: '#a16207', lineWidth: 1.3 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = '11.5px "PingFang SC", sans-serif';
    const contentLines = App.UI.wrapLinesCached(ctx, `我的反馈：${selFb.content || ''}`, detW - 20).slice(0, 2);
    contentLines.forEach((ln, i) => {
      ctx.fillText(ln, detX + 10, detY + 18 + i * 16, detW - 20);
    });
    ctx.restore();

    // 回复与奖励子框
    const repX = detX + 8, repY = detY + 52, repW = detW - 16, repH = 72;
    App.UI.drawPanel(ctx, repX, repY, repW, repH, {
      r: 7,
      bg: selFb.status === 1 ? '#fef3c7' : '#fff7e0',
      border: selFb.status === 1 ? '#d97706' : '#d6be92',
      lineWidth: 1.1,
    });
    ctx.save();
    ctx.textAlign = 'left';
    if (selFb.status === 0) {
      ctx.fillStyle = '#92400e';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText('军机处正在加紧核实处理中，请主公稍候佳音…', repX + 10, repY + 28, repW - 20);
      ctx.fillStyle = '#a16207';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText('一旦采纳，系统将自动发送奖励邮件至【军情邮件】', repX + 10, repY + 48, repW - 20);
    } else {
      const hasRewards = selFb.status === 1 && selFb.rewards && selFb.rewards.length;
      ctx.fillStyle = '#57301a';
      ctx.font = '11px "PingFang SC", sans-serif';
      const maxReplyLines = hasRewards ? 2 : 3;
      const repLines = App.UI.wrapLinesCached(ctx, `官方回复：${selFb.reply || '已处理'}`, repW - 20).slice(0, maxReplyLines);
      repLines.forEach((ln, i) => {
        ctx.fillText(ln, repX + 10, repY + 17 + i * 15, repW - 20);
      });
      if (hasRewards) {
        ctx.fillStyle = '#b45309';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(`赠礼：${rewardsText(selFb.rewards)}`, repX + 10, repY + 58, repW - 96);
      }
    }
    ctx.restore();

    if (selFb.status === 1 && selFb.rewards && selFb.rewards.length) {
      App.UI.drawButton(ctx, repX + repW - 80, repY + 44, 72, 22, '查收邮件', {
        r: 5, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 10.5,
      }, () => {
        tab = 'mail';
        page = 0;
        App.API.refreshMails();
      });
    }

    App.UI.drawPagination(ctx, detX, topY + 358, detW, 26, fbPage, maxFbPage + 1, (p) => {
      fbPage = p;
      selectedFbId = null;
    });
  }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    ctx.fillStyle = '#c8ad78';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);
    App.UI.drawPanel(ctx, 16, 58, W - 32, 474, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    drawTabs(ctx, W);
    if (tab === 'mail') drawMailTab(ctx, W);
    else if (tab === 'notice') drawNoticeTab(ctx, W);
    else drawFeedbackTab(ctx, W);
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.mail = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
