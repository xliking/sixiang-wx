(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 聚贤佣馆：把自己的武将托管在市场按小时出租（金币/铜钱结算），租客编入5人阵容出战，时间到自动返馆继续出租
  let tab = 'browse'; // browse | rented | mine | publish
  let filterAscend = 'all'; // all | idle | xian | mo
  let keyword = '';
  let page = 1;
  let total = 0;
  let list = [];
  let myListings = [];
  let myRentals = [];
  let pubPage = 0;
  let loading = false;
  let rentModal = null; // { mode: 'rent' | 'extend', item, hours }
  let pubModal = null;  // { gid, pricePerHour }
  let lastAutoCheck = 0;

  function formatRemain(endMs) {
    const diffSec = Math.max(0, Math.ceil((endMs - App.API.now()) / 1000));
    if (diffSec <= 0) return '即将返馆';
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    if (h > 0) return `${h}时${String(m).padStart(2, '0')}分`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async function loadBrowse() {
    loading = true;
    try {
      const onlyIdle = filterAscend === 'idle';
      const asc = (filterAscend === 'xian' || filterAscend === 'mo') ? filterAscend : '';
      const q = `?page=${page}&onlyIdle=${onlyIdle}`
        + (asc ? `&ascend=${encodeURIComponent(asc)}` : '')
        + (keyword ? `&keyword=${encodeURIComponent(keyword)}` : '');
      const res = await App.API.get('/api/hire/list' + q);
      if (res && res.ok) {
        list = res.list || [];
        total = res.total || list.length;
      }
    } finally {
      loading = false;
      if (App.Main && App.Main.markDirty) App.Main.markDirty();
    }
  }

  async function loadMine() {
    loading = true;
    try {
      const res = await App.API.get('/api/hire/mine');
      if (res && res.ok) {
        myListings = res.myListings || [];
        myRentals = res.myRentals || [];
      }
    } finally {
      loading = false;
      if (App.Main && App.Main.markDirty) App.Main.markDirty();
    }
  }

  function refreshCurrent() {
    if (tab === 'browse') loadBrowse();
    else if (tab === 'mine' || tab === 'rented') loadMine();
  }

  function enter(params) {
    const p = params || {};
    tab = p.tab || 'browse';
    filterAscend = 'all';
    keyword = '';
    page = 1;
    pubPage = 0;
    rentModal = null;
    pubModal = null;
    if (p.publishGid && App.State.get().ownedGenerals[p.publishGid]) {
      tab = 'publish';
      openPublishModal(p.publishGid);
    }
    loadBrowse();
    loadMine();
  }

  function openPublishModal(gid, initPrice, repriceId) {
    const gNode = App.State.get().ownedGenerals[gid] || App.State.get().hostedGenerals[gid] || { lv: 1, star: 1 };
    const pwr = App.State.getStandaloneGeneralPower
      ? App.State.getStandaloneGeneralPower(gid, gNode)
      : App.State.getGeneralPower(gid);
    const rec = Math.max(200, Math.min(200000, Math.round(pwr / 15 / 50) * 50));
    pubModal = {
      gid,
      repriceId: repriceId || null,
      pricePerHour: initPrice || rec,
    };
  }

  function update() {
    // 每秒驱动倒计时刷新；若有租单刚刚到期，自动拉取刷新使武将即时回到待租状态
    const now = Date.now();
    if (now - lastAutoCheck >= 1000) {
      lastAutoCheck = now;
      if (App.Main && App.Main.markDirty) App.Main.markDirty();
      const srvNow = App.API.now();
      const hasJustExpired = list.concat(myListings, myRentals).some((it) => it && it.status === 1 && it.rentEndAtMs > 0 && it.rentEndAtMs <= srvNow);
      if (hasJustExpired && !loading) {
        refreshCurrent();
      }
    }
  }

  function drawAscendChip(ctx, asc, tier, x, y) {
    if (asc !== 'xian' && asc !== 'mo') return 0;
    const info = App.Config.getAscendInfo ? App.Config.getAscendInfo({ ascend: asc, ascendTier: tier || 1 }) : null;
    const txt = info ? info.title : (asc === 'xian' ? `神·${tier}重` : `魔·${tier}重`);
    ctx.save();
    ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
    const w = Math.ceil(ctx.measureText(txt).width) + 12;
    ctx.fillStyle = asc === 'xian' ? '#083344' : '#4a044e';
    App.UI.roundRect(ctx, x, y, w, 16, 5);
    ctx.fill();
    ctx.strokeStyle = asc === 'xian' ? '#67e8f9' : '#f472b6';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.fillStyle = asc === 'xian' ? '#a5f3fc' : '#fbcfe8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x + w / 2, y + 8.5);
    ctx.restore();
    return w + 4;
  }

  function render(ctx, time) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const st = App.State.get(), C = App.Config, hc = C.HIRE || {};
    const myNick = App.State.getProfile().nickname || '';

    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    App.UI.drawPanel(ctx, 26, 58, W - 52, 474, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 36, 66, W - 72, 42, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });

    const activeRentCnt = Object.keys(st.rentedGenerals || {}).filter((k) => st.rentedGenerals[k] && st.rentedGenerals[k].expireAt > App.API.now()).length;
    const hostedCnt = Object.keys(st.hostedGenerals || {}).length;
    const tabs = [
      ['browse', '逛佣馆'],
      ['rented', `已租助战(${activeRentCnt})`],
      ['mine', `我的托管(${hostedCnt})`],
      ['publish', '上架出租'],
    ];
    tabs.forEach(([id, label], i) => {
      App.UI.drawButton(ctx, 44 + i * 116, 72, 110, 30, label, {
        r: 7,
        grad: tab === id ? ['#d97706', '#92400e'] : ['#5c2c16', '#3b1d0e'],
        border: tab === id ? '#fef08a' : '#a16207',
        fontSize: 12,
      }, () => {
        tab = id;
        page = 1;
        if (id === 'browse') loadBrowse();
        else if (id === 'mine' || id === 'rented') loadMine();
      });
    });

    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde68a';
    ctx.font = '11px "PingFang SC", sans-serif';
    const taxPct = Math.round(((hc.taxRate != null ? hc.taxRate : 0.05)) * 100);
    ctx.fillText(`按时计费 · 馆税${taxPct}% · 到期自动返馆`, W - 90, 87);
    ctx.restore();

    App.UI.drawCloseButton(ctx, W - 74, 71, 32, () => App.Main.goScene('map'));

    if (tab === 'browse') {
      renderBrowse(ctx, W, st, C, myNick, time);
    } else if (tab === 'rented') {
      renderRented(ctx, W, st, C, time);
    } else if (tab === 'mine') {
      renderMine(ctx, W, st, C, time);
    } else {
      renderPublish(ctx, W, st, C, time);
    }

    App.Scenes.map.drawBottomNav(ctx, 'hire');

    if (rentModal) drawRentModal(ctx, W, H, st, hc);
    if (pubModal) drawPublishModal(ctx, W, H, st, hc);
  }

  function renderBrowse(ctx, W, st, C, myNick) {
    // 顶部筛选条
    const filters = [
      ['all', '全部名将'],
      ['idle', '仅看待租'],
      ['xian', '神道神将'],
      ['mo', '魔道魔尊'],
    ];
    filters.forEach(([fid, label], idx) => {
      const on = filterAscend === fid;
      App.UI.drawButton(ctx, 28 + idx * 88, 121, 82, 25, label, {
        r: 6,
        grad: on ? ['#b45309', '#78350f'] : undefined,
        bg: on ? undefined : '#e7d5b4',
        border: on ? '#fef08a' : '#a16207',
        color: on ? '#fffbeb' : '#451a03',
        fontSize: 10.5,
      }, () => {
        filterAscend = fid;
        page = 1;
        loadBrowse();
      });
    });

    App.UI.drawButton(ctx, 388, 121, 114, 25, keyword ? `筛选:${keyword.slice(0, 4)} ✕` : '搜将名/原主', {
      r: 6,
      icon: keyword ? undefined : 'search',
      grad: keyword ? ['#9a3412', '#6b210b'] : ['#ead8b5', '#d6be92'],
      border: keyword ? '#fde68a' : '#9a6b32',
      color: keyword ? '#fffbeb' : '#451a03',
      fontSize: 10.5,
    }, () => {
      if (keyword) {
        keyword = '';
        page = 1;
        loadBrowse();
        return;
      }
      App.Platform.promptText('输入要查找的武将名或原主昵称：', (txt) => {
        keyword = String(txt || '').trim();
        page = 1;
        loadBrowse();
      });
    });

    App.UI.drawButton(ctx, 510, 121, 72, 25, '刷新', {
      r: 6,
      icon: 'refresh',
      grad: ['#ead8b5', '#d6be92'],
      border: '#9a6b32',
      color: '#451a03',
      fontSize: 10.5,
    }, () => loadBrowse());

    ctx.save();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#78350f';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText('租入武将可直接编入常规 5 人阵容出战，租期满自动归还市场继续待租', W - 30, 137);
    ctx.restore();

    list.slice(0, 8).forEach((l, i) => {
      const x = 38 + (i % 2) * 446;
      const y = 152 + Math.floor(i / 2) * 90;
      const g = C.GENERALS[l.generalId] || { name: l.generalId, rarity: 'A' };
      const isIdle = l.status === 0;
      const isMine = myNick && l.ownerName === myNick;

      App.UI.drawPanel(ctx, x, y, 438, 80, {
        r: 9,
        bg: isIdle ? '#fff8e6' : '#efe3c8',
        border: l.ascend === 'xian' ? '#0891b2' : (l.ascend === 'mo' ? '#a21caf' : '#a16207'),
        lineWidth: l.ascend ? 1.8 : 1.2,
      });

      App.Portraits.drawGeneralPortrait(ctx, l.generalId, x + 9, y + 10, 60, {
        radius: 8,
        border: l.ascend === 'xian' ? '#22d3ee' : (l.ascend === 'mo' ? '#e879f9' : '#d97706'),
        lineWidth: 1.8,
        ascend: l.ascend,
      });

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
      const rarLabel = C.getRarityLabel ? C.getRarityLabel(l.generalId, l) : (g.rarity || 'A');
      const baseTitle = `[${rarLabel}] ${g.name}`;
      ctx.fillText(baseTitle, x + 78, y + 24);
      const nw = ctx.measureText(baseTitle).width;
      drawAscendChip(ctx, l.ascend, l.ascendTier, x + 82 + nw, y + 16);

      ctx.fillStyle = '#78350f';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(`Lv.${l.lv} · ${l.star}★ · 战力 ${l.power} · 原主:${(l.ownerName || '').slice(0, 6)}`, x + 78, y + 54, 196);

      // 时薪展示（金币图标 + 每小时金币）
      App.UI.drawMiniIcon(ctx, 'res_gold', x + 276, y + 17, 15);
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`${l.pricePerHour}/时`, x + 293, y + 25);

      if (!isIdle) {
        ctx.fillStyle = '#9a3412';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.fillText(`${formatRemain(l.rentEndAtMs)}后返馆`, x + 276, y + 54);
      } else {
        ctx.fillStyle = '#15803d';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.fillText('● 待租中 · 即租即战', x + 276, y + 54);
      }
      ctx.restore();

      if (isIdle) {
        if (isMine) {
          App.UI.drawButton(ctx, x + 358, y + 22, 72, 36, '我的挂单', {
            r: 7, bg: '#78350f', border: '#fde68a', fontSize: 11,
          }, () => { tab = 'mine'; loadMine(); });
        } else {
          App.UI.drawButton(ctx, x + 358, y + 22, 72, 36, '租用助战', {
            r: 7, grad: ['#c86d19', '#85420e'], border: '#fde68a', fontSize: 11.5,
          }, () => { rentModal = { mode: 'rent', item: l, hours: 1 }; });
        }
      } else {
        App.UI.drawButton(ctx, x + 358, y + 22, 72, 36, '出租中', {
          r: 7, bg: '#78716c', border: '#d6d3d1', fontSize: 11, disabled: true,
        }, () => {});
      }
    });

    if (loading && !list.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 318, '正在寻访聚贤佣馆名将…');
    } else if (!list.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#92400e';
      ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillText('当前暂无符合条件的出租武将，快去【上架出租】挂出第一位猛将吧！', W / 2, 318);
      ctx.restore();
    }

    const totalPages = Math.max(1, Math.ceil((total || list.length) / 8));
    App.UI.drawSidePageButtons(ctx, page - 1, totalPages, (p) => {
      page = p + 1;
      loadBrowse();
    }, { cy: 328, grad: ['#78350f', '#3b1806'], border: '#f59e0b' });
  }

  function renderRented(ctx, W, st, C) {
    const now = App.API.now();
    const activeKeys = Object.keys(st.rentedGenerals || {}).filter((gid) => st.rentedGenerals[gid] && st.rentedGenerals[gid].expireAt > now);

    App.UI.drawButton(ctx, W - 236, 122, 108, 28, '排兵布阵上阵', {
      r: 7, grad: ['#7c2d12', '#451a03'], border: '#facc15', fontSize: 11,
    }, () => App.Main.goScene('map', { openDeploy: true }));

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`当前租用中佣将：${activeKeys.length} / ${(C.HIRE && C.HIRE.maxActiveRentals) || 3} 名（到期后自动撤出阵容并返回聚贤佣馆）`, 30, 139);
    ctx.restore();

    if (!activeKeys.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#92400e';
      ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillText('你当前没有租用中的佣将，可前往【逛佣馆】租借高阶神魔神将助战通关！', W / 2, 286);
      ctx.restore();
      return;
    }

    activeKeys.slice(0, 6).forEach((gid, idx) => {
      const rg = st.rentedGenerals[gid];
      const g = C.GENERALS[gid] || { name: gid, rarity: 'A' };
      const stats = App.State.getGeneralStats(gid);
      const deployed = (st.deployIds || []).includes(gid);
      const x = 28 + (idx % 2) * 454;
      const y = 158 + Math.floor(idx / 2) * 86;

      App.UI.drawPanel(ctx, x, y, 448, 78, {
        r: 10, bg: deployed ? '#fef9c3' : '#fff8e6', border: deployed ? '#16a34a' : '#b45309', lineWidth: 1.8,
      });
      App.Portraits.drawGeneralPortrait(ctx, gid, x + 8, y + 10, 58, { radius: 8, ascend: rg.ascend });

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
      const title = `[佣] ${g.name}`;
      ctx.fillText(title, x + 74, y + 20);
      drawAscendChip(ctx, rg.ascend, rg.ascendTier, x + 78 + ctx.measureText(title).width, y + 12);

      ctx.fillStyle = '#78350f';
      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(`Lv.${rg.lv} · ${rg.star}★ · 战力 ${stats ? stats.power : 0} · 原主:${rg.ownerName || '-'}`, x + 74, y + 42, 240);

      ctx.fillStyle = '#9a3412';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`租期剩余：${formatRemain(rg.expireAt)}（时薪 ${rg.pricePerHour || 0}/时）`, x + 74, y + 61);
      ctx.restore();

      App.UI.drawButton(ctx, x + 356, y + 10, 82, 27, deployed ? '撤下阵位' : '编入出战', {
        r: 6, grad: deployed ? ['#57534e', '#44403c'] : ['#b91c1c', '#7f1d1d'], border: '#fde68a', fontSize: 11,
      }, () => App.State.toggleDeploy(gid));

      App.UI.drawButton(ctx, x + 356, y + 43, 82, 26, '续租时长', {
        r: 6, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11,
      }, () => {
        rentModal = {
          mode: 'extend',
          hours: 1,
          item: {
            id: rg.listingId,
            generalId: gid,
            lv: rg.lv,
            star: rg.star,
            ascend: rg.ascend,
            ascendTier: rg.ascendTier,
            pricePerHour: rg.pricePerHour || 500,
            ownerName: rg.ownerName,
          },
        };
      });
    });
  }

  function renderMine(ctx, W, st, C) {
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`我的托管摊位：${myListings.length} / ${(C.HIRE && C.HIRE.maxListings) || 5} 名 · 租金实时发放至【邮件公告】，租期满自动返回待租！`, 30, 139);
    ctx.restore();

    if (loading && !myListings.length) {
      App.UI.drawPanelLoading(ctx, W / 2, 286, '正在核对本营托管名册…');
      return;
    }
    if (!myListings.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#92400e';
      ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillText('你还没有托管出租的武将，点击上方【上架出租】把闲置强将挂上赚金币吧！', W / 2, 286);
      ctx.restore();
      return;
    }

    myListings.slice(0, 6).forEach((l, idx) => {
      const g = C.GENERALS[l.generalId] || { name: l.generalId, rarity: 'A' };
      const isRentedOut = l.status === 1;
      const x = 28 + (idx % 2) * 454;
      const y = 156 + Math.floor(idx / 2) * 88;

      App.UI.drawPanel(ctx, x, y, 448, 80, {
        r: 10, bg: isRentedOut ? '#fef3c7' : '#fff8e6', border: isRentedOut ? '#d97706' : '#a16207', lineWidth: 1.6,
      });
      App.Portraits.drawGeneralPortrait(ctx, l.generalId, x + 8, y + 11, 58, { radius: 8, ascend: l.ascend });

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      const title = `${g.name} Lv.${l.lv}`;
      ctx.fillText(title, x + 74, y + 19);
      drawAscendChip(ctx, l.ascend, l.ascendTier, x + 78 + ctx.measureText(title).width, y + 11);

      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText(`时薪 ${l.pricePerHour}/时 · 累计租出 ${l.totalHours || 0}h · 共赚 +${l.totalEarned || 0}`, x + 74, y + 41, 272);

      ctx.fillStyle = isRentedOut ? '#dc2626' : '#15803d';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(
        isRentedOut
          ? `● 租客【${(l.renterName || '').slice(0, 6)}】租用中 · ${formatRemain(l.rentEndAtMs)}后自动返馆续租`
          : '● 待租中（随时可改时薪或召回本营）',
        x + 74, y + 62, 276
      );
      ctx.restore();

      if (!isRentedOut) {
        App.UI.drawButton(ctx, x + 360, y + 11, 78, 26, '修改时薪', {
          r: 6, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11,
        }, () => openPublishModal(l.generalId, l.pricePerHour, l.id));

        App.UI.drawButton(ctx, x + 360, y + 43, 78, 26, '下架召回', {
          r: 6, grad: ['#dc2626', '#991b1b'], border: '#fecaca', fontSize: 11,
        }, () => App.State.recallHire(l.id).then(() => loadMine()));
      } else {
        App.UI.drawButton(ctx, x + 360, y + 25, 78, 30, '赚金中', {
          r: 6, bg: '#92400e', border: '#fde68a', fontSize: 11, disabled: true,
        }, () => {});
      }
    });
  }

  function renderPublish(ctx, W, st, C) {
    const ownedIds = Object.keys(st.ownedGenerals || {}).filter((gid) => C.GENERALS[gid]);
    ownedIds.sort((a, b) => App.State.getGeneralPower(b) - App.State.getGeneralPower(a));

    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(`点击麾下名将即可设定时薪挂牌出租（托管期间穿戴装备自动归库，至少需留 1 名武将镇守本营）`, 30, 136);
    ctx.restore();

    const per = 12; // 6列 × 2排
    const totalPubPages = Math.max(1, Math.ceil(ownedIds.length / per));
    pubPage = Math.max(0, Math.min(pubPage, totalPubPages - 1));

    ownedIds.slice(pubPage * per, (pubPage + 1) * per).forEach((gid, idx) => {
      const g = C.GENERALS[gid];
      const gNode = st.ownedGenerals[gid];
      const pwr = App.State.getStandaloneGeneralPower ? App.State.getStandaloneGeneralPower(gid, gNode) : App.State.getGeneralPower(gid);
      const deployed = (st.deployIds || []).includes(gid);
      const ascInfo = C.getAscendInfo ? C.getAscendInfo(gNode) : null;
      const x = 38 + (idx % 6) * 149;
      const y = 148 + Math.floor(idx / 6) * 184;

      App.UI.drawPanel(ctx, x, y, 141, 172, {
        r: 10, bg: '#fff8e6', border: ascInfo ? ascInfo.border : '#a16207', lineWidth: ascInfo ? 1.8 : 1.2,
      });
      App.Portraits.drawGeneralPortrait(ctx, gid, x + 36, y + 12, 68, { radius: 9, ascend: gNode.ascend });

      if (deployed) {
        ctx.save();
        ctx.fillStyle = '#15803d';
        App.UI.roundRect(ctx, x + 6, y + 6, 34, 15, 4);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('出战', x + 23, y + 16.5);
        ctx.restore();
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#451a03';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`${ascInfo ? `[${ascInfo.shortTag}]` : ''}${g.name}`, x + 70.5, y + 98, 133);
      ctx.fillStyle = '#78350f';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText(`Lv.${gNode.lv} · ${gNode.star}★ · 战${pwr}`, x + 70.5, y + 118, 133);
      ctx.restore();

      App.UI.drawButton(ctx, x + 14, y + 132, 113, 28, ownedIds.length <= 1 ? '留守主将' : '挂牌出租', {
        r: 7, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 11, disabled: ownedIds.length <= 1,
      }, () => openPublishModal(gid));
    });

    App.UI.drawSidePageButtons(ctx, pubPage, totalPubPages, (p) => { pubPage = p; }, {
      cy: 328, grad: ['#78350f', '#3b1806'], border: '#f59e0b',
    });
  }

  function drawRentModal(ctx, W, H, st, hc) {
    const m = rentModal;
    const l = m.item;
    const g = App.Config.GENERALS[l.generalId] || { name: l.generalId, skillName: '', skillDesc: '' };
    const opts = Array.isArray(hc.hourOptions) && hc.hourOptions.length ? hc.hourOptions : [1, 2, 4, 8, 12, 24];
    const cost = (l.pricePerHour || 0) * (m.hours || 1);

    App.UI.addHit(0, 0, W, H, () => {});
    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 2, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const mw = 480, mh = 310;
    const mx = (W - mw) / 2, my = (H - mh) / 2;
    App.UI.drawPanel(ctx, mx, my, mw, mh, { r: 14, bg: '#f4e6c4', border: '#d97706', lineWidth: 2.4 });
    App.UI.drawWoodHeader(ctx, mx + 10, my + 10, mw - 20, 38);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText(m.mode === 'extend' ? '续租佣将契约' : '聚贤佣馆 · 签约租将', W / 2, my + 29);
    ctx.restore();

    App.Portraits.drawGeneralPortrait(ctx, l.generalId, mx + 22, my + 60, 66, { radius: 9, ascend: l.ascend });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 14px "PingFang SC", sans-serif';
    const nameStr = `${g.name}  Lv.${l.lv} · ${l.star}★`;
    ctx.fillText(nameStr, mx + 100, my + 78);
    drawAscendChip(ctx, l.ascend, l.ascendTier, mx + 104 + ctx.measureText(nameStr).width, my + 66);

    ctx.fillStyle = '#78350f';
    ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(`原主：${l.ownerName || '-'}   |   单价：${l.pricePerHour} 金币(铜钱)/小时`, mx + 100, my + 101);
    ctx.fillText(`绝技【${g.skillName || '无双'}】：${(g.skillDesc || '').slice(0, 26)}`, mx + 100, my + 121, mw - 118);

    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText('选择租用时长（到期后自动返回佣馆市场）：', mx + 22, my + 154);
    ctx.restore();

    opts.slice(0, 6).forEach((hr, idx) => {
      const sel = m.hours === hr;
      App.UI.drawButton(ctx, mx + 22 + idx * 74, my + 166, 68, 32, `${hr} 小时`, {
        r: 7,
        grad: sel ? ['#d97706', '#92400e'] : undefined,
        bg: sel ? undefined : '#e7d5b4',
        border: sel ? '#fef08a' : '#a16207',
        color: sel ? '#fffbeb' : '#451a03',
        fontSize: 12,
      }, () => { m.hours = hr; });
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = st.gold >= cost ? '#b45309' : '#dc2626';
    ctx.font = 'bold 14px "PingFang SC", sans-serif';
    ctx.fillText(`应付总租金：${cost} 金币(铜钱)   （当前持有：${st.gold}）`, W / 2, my + 226);
    ctx.restore();

    App.UI.drawButton(ctx, mx + 76, my + mh - 56, 152, 40, m.mode === 'extend' ? '确认付款续租' : '确认付款租用', {
      r: 9, grad: ['#b91c1c', '#7f1d1d'], border: '#fde68a', fontSize: 13.5, disabled: st.gold < cost,
    }, () => {
      const action = m.mode === 'extend' ? App.State.extendHire(l.id, m.hours) : App.State.rentHire(l.id, m.hours);
      action.then((res) => {
        if (res && res.ok) {
          rentModal = null;
          tab = 'rented';
          loadMine();
          loadBrowse();
        }
      });
    });

    App.UI.drawButton(ctx, mx + 252, my + mh - 56, 152, 40, '取消', {
      r: 9, bg: '#57534e', border: '#cbd5e1', fontSize: 13.5,
    }, () => { rentModal = null; });
  }

  function drawPublishModal(ctx, W, H, st, hc) {
    const m = pubModal;
    const g = App.Config.GENERALS[m.gid] || { name: m.gid };
    const gNode = st.ownedGenerals[m.gid] || st.hostedGenerals[m.gid] || { lv: 1, star: 1 };
    const minP = hc.minPricePerHour || 100;
    const maxP = hc.maxPricePerHour || 500000;
    const presets = [300, 1000, 3000, 8000, 20000];

    App.UI.addHit(0, 0, W, H, () => {});
    ctx.save();
    ctx.fillStyle = 'rgba(10, 5, 2, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const mw = 480, mh = 304;
    const mx = (W - mw) / 2, my = (H - mh) / 2;
    App.UI.drawPanel(ctx, mx, my, mw, mh, { r: 14, bg: '#f4e6c4', border: '#d97706', lineWidth: 2.4 });
    App.UI.drawWoodHeader(ctx, mx + 10, my + 10, mw - 20, 38);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText(m.repriceId ? '调整佣将每小时租金' : '挂牌出租名将 · 设定时薪', W / 2, my + 29);
    ctx.restore();

    App.Portraits.drawGeneralPortrait(ctx, m.gid, mx + 22, my + 60, 62, { radius: 9, ascend: gNode.ascend });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 14px "PingFang SC", sans-serif';
    ctx.fillText(`${g.name}  Lv.${gNode.lv} · ${gNode.star}★`, mx + 96, my + 80);
    ctx.fillStyle = '#78350f';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText('托管期间本营暂不可用该将；有人租用即收金币，到期自动返馆继续出租！', mx + 96, my + 104, mw - 114);

    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`设定每小时租金（范围 ${minP} ~ ${maxP}）：`, mx + 22, my + 146);
    ctx.restore();

    presets.forEach((val, idx) => {
      const sel = m.pricePerHour === val;
      App.UI.drawButton(ctx, mx + 22 + idx * 72, my + 158, 66, 30, `${val}/时`, {
        r: 6,
        grad: sel ? ['#d97706', '#92400e'] : undefined,
        bg: sel ? undefined : '#e7d5b4',
        border: sel ? '#fef08a' : '#a16207',
        color: sel ? '#fffbeb' : '#451a03',
        fontSize: 11,
      }, () => { m.pricePerHour = val; });
    });

    App.UI.drawButton(ctx, mx + 22 + 5 * 72, my + 158, 76, 30, '自定义…', {
      r: 6, bg: '#5c2c16', border: '#fde047', fontSize: 11,
    }, () => {
      App.Platform.promptText(`输入【${g.name}】每小时租金（${minP} ~ ${maxP} 金币/铜钱）：`, (txt) => {
        const n = Math.floor(Number(String(txt || '').trim()));
        if (!n || n < minP || n > maxP) {
          App.UI.showToast(`请输入 ${minP} ~ ${maxP} 之间的整数`, '#f87171');
          return;
        }
        m.pricePerHour = n;
      });
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b45309';
    ctx.font = 'bold 15px "PingFang SC", sans-serif';
    ctx.fillText(`当前设定时薪：${m.pricePerHour} 金币(铜钱) / 小时`, W / 2, my + 218);
    ctx.restore();

    App.UI.drawButton(ctx, mx + 76, my + mh - 54, 152, 38, m.repriceId ? '确认改价' : '确认挂牌出租', {
      r: 9, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13.5,
    }, () => {
      const act = m.repriceId
        ? App.State.repriceHire(m.repriceId, m.pricePerHour)
        : App.State.publishHire(m.gid, m.pricePerHour);
      act.then((res) => {
        if (res && res.ok) {
          pubModal = null;
          tab = 'mine';
          loadMine();
          loadBrowse();
        }
      });
    });

    App.UI.drawButton(ctx, mx + 252, my + mh - 54, 152, 38, '取消', {
      r: 9, bg: '#57534e', border: '#cbd5e1', fontSize: 13.5,
    }, () => { pubModal = null; });
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.hire = { enter, update, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
