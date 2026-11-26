(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  /**
   * 神兵锻器坊 · 六大独立分殿：
   * 1. 强化（赤焰百炼铁砧台）  2. 升星（紫微七曜观星台）  3. 合成（乾坤八卦炼宝炉）
   * 4. 进阶（九霄玄冥破阶坛）  5. 洗炼（翠微灵玉洗炼盘）  6. 法宝（四象镇军万宝阁）
   * 所有数值计算与存档变更均通过服务端权威接口执行。
   */
  const TABS = [
    { id: 'enhance', label: '强化', title: '赤焰淬火 · 精炼兵甲', accent: '#f97316', grad: ['#c2410c', '#7c2d12'] },
    { id: 'star', label: '升星', title: '紫微引魂 · 七曜铭星', accent: '#c084fc', grad: ['#7e22ce', '#4c1d95'] },
    { id: 'synth', label: '合成', title: '乾坤熔炉 · 三合升品', accent: '#fbbf24', grad: ['#b45309', '#78350f'] },
    { id: 'advance', label: '进阶', title: '九霄破障 · 神兵晋阶', accent: '#38bdf8', grad: ['#0369a1', '#0c4a6e'] },
    { id: 'reforge', label: '洗炼', title: '翠玉雕纹 · 灵石洗炼', accent: '#34d399', grad: ['#047857', '#064e3b'] },
    { id: 'artifact', label: '法宝', title: '四象万宝 · 镇军圣器', accent: '#f87171', grad: ['#b91c1c', '#7f1d1d'] },
  ];

  const FILTERS = [
    { id: 'all', label: '全部' },
    { id: 'worn', label: '穿戴中' },
    { id: 'idle', label: '闲置' },
    { id: 'beast', label: '兽装' },
  ];

  const TIER_NAMES = ['凡品胚器', '壹阶·百炼', '贰阶·天工', '叁阶·鬼神', '肆阶·无双'];
  const AFFIX_META = {
    atk: { name: '锋锐 · 武力', unit: '', max: { blue: 20, purple: 38, gold: 64, red: 96 } },
    valor: { name: '神勇 · 武力', unit: '', max: { blue: 24, purple: 44, gold: 72, red: 108 } },
    hp: { name: '固本 · 气血', unit: '', max: { blue: 150, purple: 280, gold: 500, red: 780 } },
    vitality: { name: '磐石 · 气血', unit: '', max: { blue: 185, purple: 330, gold: 560, red: 860 } },
    def: { name: '玄甲 · 防御', unit: '', max: { blue: 13, purple: 26, gold: 45, red: 70 } },
    crit: { name: '破军 · 暴击', unit: '%', isPct: true, max: { blue: 0.015, purple: 0.028, gold: 0.046, red: 0.070 } },
    critDmg: { name: '破煞 · 暴伤', unit: '%', isPct: true, max: { blue: 0.045, purple: 0.085, gold: 0.140, red: 0.200 } },
    lifesteal: { name: '嗜血 · 吸血', unit: '%', isPct: true, max: { blue: 0.018, purple: 0.032, gold: 0.050, red: 0.075 } },
    dmgReduce: { name: '不动 · 免伤', unit: '%', isPct: true, max: { blue: 0.018, purple: 0.032, gold: 0.050, red: 0.072 } },
    skillDmg: { name: '天威 · 技伤', unit: '%', isPct: true, max: { blue: 0.032, purple: 0.060, gold: 0.095, red: 0.145 } },
  };
  const AFFIX_QUAL = {
    blue: { label: '凡品', color: '#38bdf8', bg: 'rgba(14, 116, 144, 0.28)', border: '#0284c7' },
    purple: { label: '灵品', color: '#d8b4fe', bg: 'rgba(107, 33, 168, 0.30)', border: '#9333ea' },
    gold: { label: '仙品', color: '#fde047', bg: 'rgba(180, 83, 9, 0.34)', border: '#f59e0b' },
    red: { label: '绝世', color: '#fca5a5', bg: 'rgba(185, 28, 28, 0.38)', border: '#ef4444' },
  };
  const QUAL_COLOR = { blue: '#38bdf8', purple: '#c084fc', gold: '#facc15' };

  const PER_PAGE = 8;
  const ART_FILTERS = [
    { id: 'all', label: '全部' },
    { id: 'blue', label: '精良' },
    { id: 'purple', label: '史诗' },
    { id: 'gold', label: '至宝' },
    { id: 'owned', label: '已炼化' },
  ];
  let activeTab = 'enhance';
  let filterMode = 'all';
  let page = 0;
  let artFilter = 'all';
  let artPage = 0;
  let selectedUid = null;
  let synthUids = [];
  let lastForgedEquip = null;
  let selectedArtifactId = null;
  let flashTimer = 0;

  function enter(params) {
    if (params && params.tab && TABS.some((t) => t.id === params.tab)) activeTab = params.tab;
    page = 0;
    lastForgedEquip = null;
  }

  function update(dt) {
    if (flashTimer > 0) flashTimer = Math.max(0, flashTimer - dt);
  }

  function triggerFlash() {
    flashTimer = 0.75;
  }

  function switchTab(tabId) {
    if (activeTab === tabId) return;
    activeTab = tabId;
    page = 0;
    lastForgedEquip = null;
  }

  // ---------------------------------------------------------------- 通用装饰绘制

  function drawCornerOrnaments(ctx, x, y, w, h, color) {
    const s = 11;
    ctx.save();
    ctx.strokeStyle = color || 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 1.6;
    const corners = [
      [x + 5, y + 5, 1, 1],
      [x + w - 5, y + 5, -1, 1],
      [x + 5, y + h - 5, 1, -1],
      [x + w - 5, y + h - 5, -1, -1],
    ];
    corners.forEach(([cx, cy, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + dy * s);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + dx * s, cy);
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawStageBox(ctx, x, y, w, h, topBg, botBg, borderCol) {
    ctx.save();
    App.UI.roundRect(ctx, x, y, w, h, 12);
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, topBg);
    g.addColorStop(1, botBg);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = borderCol || '#b45309';
    ctx.lineWidth = 1.8;
    ctx.stroke();
    App.UI.roundRect(ctx, x + 3, y + 3, w - 6, h - 6, 9);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    drawCornerOrnaments(ctx, x + 2, y + 2, w - 4, h - 4, borderCol);
  }

  // 顶部导航页签小徽标（纯矢量精绘，清晰不乱码）
  function drawTabGlyph(ctx, id, cx, cy, col) {
    ctx.save();
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (id === 'enhance') {
      // 锻锤
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy + 5); ctx.lineTo(cx + 2, cy - 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx + 2, cy - 2); ctx.rotate(-Math.PI / 4);
      ctx.fillRect(-5, -3, 10, 5);
      ctx.restore();
    } else if (id === 'star') {
      // 五芒星
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a1 = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const a2 = a1 + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(a1) * 6.5, cy + Math.sin(a1) * 6.5);
        ctx.lineTo(cx + Math.cos(a2) * 2.8, cy + Math.sin(a2) * 2.8);
      }
      ctx.closePath(); ctx.fill();
    } else if (id === 'synth') {
      // 乾坤鼎炉
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 5.2, 0, Math.PI);
      ctx.closePath(); ctx.fill();
      ctx.fillRect(cx - 6, cy - 2.5, 12, 2.2);
      ctx.beginPath();
      ctx.moveTo(cx - 3.5, cy + 5); ctx.lineTo(cx - 5, cy + 7.5);
      ctx.moveTo(cx + 3.5, cy + 5); ctx.lineTo(cx + 5, cy + 7.5);
      ctx.stroke();
    } else if (id === 'advance') {
      // 破阶双翼剑锋
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7); ctx.lineTo(cx + 4.5, cy + 1); ctx.lineTo(cx, cy - 1); ctx.lineTo(cx - 4.5, cy + 1);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - 4, cy + 5); ctx.lineTo(cx, cy + 1.5); ctx.lineTo(cx + 4, cy + 5);
      ctx.stroke();
    } else if (id === 'reforge') {
      // 灵玉菱晶
      ctx.beginPath();
      ctx.moveTo(cx, cy - 6.5); ctx.lineTo(cx + 5.5, cy); ctx.lineTo(cx, cy + 6.5); ctx.lineTo(cx - 5.5, cy);
      ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
    } else if (id === 'artifact') {
      // 仙葫宝印
      ctx.beginPath();
      ctx.arc(cx, cy - 2.8, 3, 0, Math.PI * 2);
      ctx.arc(cx, cy + 3, 4.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawArtifactIcon(ctx, art, x, y, size, opts) {
    const o = opts || {};
    const qCol = QUAL_COLOR[art.quality] || '#facc15';
    const r = o.radius != null ? o.radius : 10;
    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.clip();
    ctx.fillStyle = '#2a1208';
    ctx.fillRect(x, y, size, size);
    const img = App.Assets.get(art.imgKey);
    if (img) ctx.drawImage(img, x, y, size, size);
    else if (App.Assets.isLoading && App.Assets.isLoading(art.imgKey) && App.UI.drawSpinner) {
      App.UI.drawSpinner(ctx, x + size / 2, y + size / 2, Math.min(10, size * 0.2), qCol);
    } else {
      const g = ctx.createRadialGradient(x + size / 2, y + size / 2, 4, x + size / 2, y + size / 2, size * 0.65);
      g.addColorStop(0, qCol);
      g.addColorStop(1, '#1c0a05');
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = g;
      ctx.fillRect(x, y, size, size);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fef08a';
      ctx.font = `bold ${Math.max(12, Math.round(size * 0.28))}px "PingFang SC", serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(art.name || '法宝').slice(0, 2), x + size / 2, y + size / 2);
    }
    ctx.restore();

    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.strokeStyle = o.border || qCol;
    ctx.lineWidth = o.lineWidth || 2;
    ctx.stroke();
    ctx.restore();
  }

  function ownerLabel(eq) {
    const C = App.Config;
    const st = App.State.get();
    if (eq.equippedBy) return (C.GENERALS[eq.equippedBy] || {}).name || '名将';
    if (eq.equippedByBeast) {
      return C.getBeastDisplayName
        ? C.getBeastDisplayName(eq.equippedByBeast, st.ownedBeasts && st.ownedBeasts[eq.equippedByBeast], true)
        : ((C.BEASTS[eq.equippedByBeast] || {}).shortName || '神兽');
    }
    return '';
  }

  // 计算如果强化/升星/进阶变化后的预览基础属性（保留当前洗炼词条）
  function previewEquipBonus(eq, nextEn, nextStar, nextAdv) {
    return App.Config.getEquipBonus({
      tplId: eq.tplId,
      enhance: nextEn != null ? nextEn : (eq.enhance || 0),
      star: nextStar != null ? nextStar : (eq.star || 0),
      advance: nextAdv != null ? nextAdv : (eq.advance || 0),
      affixes: eq.affixes || [],
    });
  }

  // ---------------------------------------------------------------- 左侧通用装备选择栏（强化 / 升星 / 进阶 / 洗炼共用，带模式角标）

  function getFilteredInventory(st) {
    const C = App.Config;
    return (st.inventory || []).filter((e) => {
      const tpl = C.EQUIP_TEMPLATES[e.tplId];
      if (!tpl) return false;
      const worn = !!(e.equippedBy || e.equippedByBeast);
      if (filterMode === 'worn') return worn;
      if (filterMode === 'idle') return !worn;
      if (filterMode === 'beast') return !!tpl.isBeastEquip;
      return true;
    });
  }

  function renderEquipListPane(ctx, st, modeAccent) {
    const C = App.Config;
    const px = 24, py = 118, pw = 398, ph = 400;
    drawStageBox(ctx, px, py, pw, ph, '#28150b', '#190c06', '#92400e');

    // 顶部筛选胶囊栏
    FILTERS.forEach((f, i) => {
      const fx = px + 12 + i * 94, fy = py + 10, fw = 88, fh = 26;
      const on = filterMode === f.id;
      App.UI.drawButton(ctx, fx, fy, fw, fh, f.label, {
        r: 13,
        grad: on ? ['#d97706', '#92400e'] : ['#3b1f10', '#271309'],
        border: on ? '#fef08a' : '#78350f',
        color: on ? '#fffbeb' : '#d6c4a8',
        fontSize: 11.5,
      }, () => { filterMode = f.id; page = 0; });
    });

    const list = getFilteredInventory(st);
    const maxPage = Math.max(0, Math.ceil(list.length / PER_PAGE) - 1);
    page = Math.min(page, maxPage);

    let sel = list.find((e) => e.uid === selectedUid);
    if (!sel && list.length) {
      sel = list[page * PER_PAGE] || list[0];
      selectedUid = sel.uid;
    }

    if (!list.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#d6c4a8';
      ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
      ctx.fillText('当前分类下暂无装备', px + pw / 2, py + 195);
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillStyle = '#a89070';
      ctx.fillText('可切换上方筛选，或前往九州征战获取神兵', px + pw / 2, py + 220);
      ctx.restore();
      return null;
    }

    list.slice(page * PER_PAGE, (page + 1) * PER_PAGE).forEach((eq, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const cx = px + 12 + col * 95, cy = py + 46 + row * 154, cw = 89, ch = 144;
      const tpl = C.EQUIP_TEMPLATES[eq.tplId];
      const qCol = QUAL_COLOR[tpl.quality] || '#38bdf8';
      const on = eq.uid === selectedUid;
      const owner = ownerLabel(eq);

      App.UI.drawPanel(ctx, cx, cy, cw, ch, {
        r: 10,
        bg: on ? '#4a2511' : '#241209',
        border: on ? '#fde047' : qCol,
        lineWidth: on ? 2.4 : 1.3,
      });

      if (on) {
        ctx.save();
        const glow = ctx.createRadialGradient(cx + cw / 2, cy + 40, 6, cx + cw / 2, cy + 40, 46);
        glow.addColorStop(0, 'rgba(250, 204, 21, 0.34)');
        glow.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(cx + 2, cy + 2, cw - 4, 82);
        ctx.restore();
      }

      App.Sprites.drawEquipIcon(ctx, eq.tplId, cx + 14.5, cy + 10, 60, {
        radius: 9, border: on ? '#fef08a' : qCol, lineWidth: on ? 2.2 : 1.6,
      });

      // 右上角模式专属角标
      let badge = '+' + (eq.enhance || 0);
      if (activeTab === 'star') badge = (eq.star || 0) + '★';
      else if (activeTab === 'advance') badge = (eq.advance || 0) + '阶';
      if (activeTab !== 'reforge') {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 7, 3, 0.86)';
        App.UI.roundRect(ctx, cx + cw - 34, cy + 6, 28, 16, 6);
        ctx.fill();
        ctx.strokeStyle = modeAccent;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badge, cx + cw - 20, cy + 14);
        ctx.restore();
      }

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = on ? '#fef9c3' : '#f3e5c3';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(tpl.name.slice(0, 6), cx + cw / 2, cy + 86);

      if (activeTab === 'reforge') {
        // 洗炼分栏展示 3 枚词条品质宝珠点
        const affs = eq.affixes || [];
        for (let k = 0; k < 3; k++) {
          const af = affs[k];
          const dotX = cx + cw / 2 - 16 + k * 16, dotY = cy + 103;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = af ? (AFFIX_QUAL[af.quality] || AFFIX_QUAL.blue).color : '#44403c';
          ctx.fill();
          ctx.strokeStyle = '#0c0a09';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(`+${eq.enhance || 0} · ${eq.star || 0}★ · ${eq.advance || 0}阶`, cx + cw / 2, cy + 104);
      }

      // 穿戴归属胶囊
      ctx.fillStyle = owner ? 'rgba(21, 128, 61, 0.35)' : 'rgba(68, 64, 60, 0.35)';
      App.UI.roundRect(ctx, cx + 12, cy + 116, cw - 24, 20, 6);
      ctx.fill();
      ctx.fillStyle = owner ? '#86efac' : '#a8a29e';
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.fillText(owner ? `${owner} 装备` : '闲置在库', cx + cw / 2, cy + 129);
      ctx.restore();

      App.UI.addHit(cx, cy, cw, ch, () => { selectedUid = eq.uid; });
    });

    // 底部分页栏（支持页码直选）
    const fy = py + ph - 38;
    App.UI.drawPagination(ctx, px + 10, fy + 1, pw - 20, 26, page, maxPage + 1, (p) => {
      page = p;
      selectedUid = null;
    }, { bg: '#451a03', border: '#d97706' });

    return sel;
  }

  function renderEmptyRight(ctx, rx, ry, rw, rh, tip) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 15px "PingFang SC", serif';
    ctx.fillText(tip || '请先在左侧选择一件神兵防具', rx + rw / 2, ry + rh / 2);
    ctx.restore();
  }

  // 四维属性前后对比卡片组（2×2）
  function drawStatCompareGrid(ctx, x, y, w, curB, nextB, isMax, accentCol) {
    const items = [
      { label: '武力加成', c: curB.atk, n: nextB.atk, unit: '' },
      { label: '气血加成', c: curB.hp, n: nextB.hp, unit: '' },
      { label: '防御加成', c: curB.def, n: nextB.def, unit: '' },
      { label: '暴击率', c: +(curB.crit * 100).toFixed(1), n: +(nextB.crit * 100).toFixed(1), unit: '%' },
    ];
    const cw = Math.floor((w - 10) / 2), ch = 46;
    items.forEach((it, i) => {
      const ix = x + (i % 2) * (cw + 10), iy = y + Math.floor(i / 2) * (ch + 8);
      App.UI.drawPanel(ctx, ix, iy, cw, ch, { r: 8, bg: 'rgba(15, 8, 4, 0.62)', border: 'rgba(245, 158, 11, 0.32)', lineWidth: 1.1 });
      ctx.save();
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#d6c4a8';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText(it.label, ix + 12, iy + ch / 2);

      ctx.textAlign = 'right';
      const diff = +(it.n - it.c).toFixed(1);
      if (isMax) {
        ctx.fillStyle = '#fde047';
        ctx.font = 'bold 13px "PingFang SC", sans-serif';
        ctx.fillText(`+${it.c}${it.unit} (圆满)`, ix + cw - 12, iy + ch / 2);
      } else {
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
        const gainStr = diff > 0 ? ` (+${diff}${it.unit})` : '';
        ctx.fillText(`+${it.c}${it.unit} → +${it.n}${it.unit}`, ix + cw - 12 - (gainStr ? ctx.measureText(gainStr).width + 2 : 0), iy + ch / 2);
        if (gainStr) {
          ctx.fillStyle = accentCol || '#4ade80';
          ctx.fillText(gainStr, ix + cw - 10, iy + ch / 2);
        }
      }
      ctx.restore();
    });
  }

  // ================================================================ 1. 强化专页：赤焰百炼铁砧台

  function renderEnhancePage(ctx, st, time) {
    const sel = renderEquipListPane(ctx, st, '#f97316');
    const rx = 432, ry = 118, rw = 504, rh = 400;
    drawStageBox(ctx, rx, ry, rw, rh, '#2d1209', '#160804', '#ea580c');
    if (!sel) return renderEmptyRight(ctx, rx, ry, rw, rh);

    const C = App.Config, F = C.FORGE, P = C.PARAMS;
    const tpl = C.EQUIP_TEMPLATES[sel.tplId], q = C.QUALITIES[tpl.quality] || {};
    const en = sel.enhance || 0, maxEn = P.equipEnhanceMax || 30, isMax = en >= maxEn;
    const curB = C.getEquipBonus(sel);
    const nextB = isMax ? curB : previewEquipBonus(sel, en + 1, null, null);

    // 顶部赤焰炉火光晕 + 铁砧底座 + 装备主图标
    const icX = rx + 26, icY = ry + 22, icSz = 86;
    ctx.save();
    const pulse = 0.85 + Math.sin(time * 3.5) * 0.15;
    const ember = ctx.createRadialGradient(icX + icSz / 2, icY + icSz / 2, 8, icX + icSz / 2, icY + icSz / 2, 66);
    ember.addColorStop(0, `rgba(249, 115, 22, ${0.48 * pulse})`);
    ember.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = ember;
    ctx.beginPath(); ctx.arc(icX + icSz / 2, icY + icSz / 2, 66, 0, Math.PI * 2); ctx.fill();

    // 鎏金铁砧托盘底座
    ctx.fillStyle = '#431407';
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1.4;
    App.UI.roundRect(ctx, icX - 6, icY + icSz - 6, icSz + 12, 14, 5);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    App.Sprites.drawEquipIcon(ctx, sel.tplId, icX, icY, icSz, { radius: 12, border: QUAL_COLOR[tpl.quality] || '#fb923c', lineWidth: 2.4 });

    // 装备标题与强化刻度条
    const tx = icX + icSz + 18, tw = rw - (icSz + 68);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 18px "PingFang SC", serif';
    ctx.fillText(`${tpl.name}  +${en}`, tx, ry + 42);

    ctx.fillStyle = '#fdba74';
    ctx.font = '12px "PingFang SC", sans-serif';
    const owner = ownerLabel(sel);
    ctx.fillText(`${q.name || '神兵'}${tpl.setName ? ' · ' + tpl.setName : ''}${owner ? ' · [' + owner + ' 穿戴中]' : ''}`, tx, ry + 64);

    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    const stepAdv = F.advanceEnhanceStep || 5;
    const nextGate = Math.min(maxEn, (Math.floor(en / stepAdv) + 1) * stepAdv);
    ctx.fillText(`淬火进度：+${en} / +${maxEn}（每强化 +${stepAdv} 解锁下一重神兵破阶，下个门槛 +${nextGate}）`, tx, ry + 86);
    ctx.restore();

    App.UI.drawBar(ctx, tx, ry + 96, tw, 12, en / Math.max(1, maxEn), '#f97316', '#291007');

    // 中部：四维属性前后对比卡
    ctx.save();
    ctx.fillStyle = '#fed7aa';
    ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('✦ 淬火精炼属性跃升预览（每级基础属性 +14%，暴击 +4%）', rx + 24, ry + 140);
    ctx.restore();

    drawStatCompareGrid(ctx, rx + 24, ry + 152, rw - 48, curB, nextB, isMax, '#4ade80');

    // 计算单次与连强5次费用
    const cost1 = App.State.getCost('enhance', en);
    const steps5 = Math.min(5, maxEn - en);
    let cost5 = 0;
    for (let k = 0; k < steps5; k++) cost5 += App.State.getCost('enhance', en + k);

    // 资源状态条
    App.UI.drawPanel(ctx, rx + 24, ry + 266, rw - 48, 38, { r: 8, bg: 'rgba(12, 5, 2, 0.65)', border: '#7c2d12', lineWidth: 1 });
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.fillText(`单次淬火消耗：${isMax ? '-' : cost1 + ' 铜钱'}`, rx + 38, ry + 285);
    ctx.textAlign = 'right';
    ctx.fillStyle = st.gold >= cost1 ? '#86efac' : '#fca5a5';
    ctx.fillText(`库藏铜钱：${st.gold}`, rx + rw - 38, ry + 285);
    ctx.restore();

    // 底部双按钮：淬火 +1 与 连锤 +5
    const btnY = ry + 318, btnW = Math.floor((rw - 60) / 2), btnH = 58;
    App.UI.drawButton(ctx, rx + 24, btnY, btnW, btnH, isMax ? '已达淬火满级' : `🔥 淬火强化 +1`, {
      r: 10,
      grad: ['#ea580c', '#9a3412'],
      border: '#fef08a',
      fontSize: 15,
      subText: isMax ? undefined : `升至 +${en + 1} · 耗 ${cost1} 铜钱`,
      disabled: isMax || App.State.isBusy(),
    }, () => App.State.enhanceEquip(sel.uid, 1).then((r) => { if (r.ok) triggerFlash(); }));

    App.UI.drawButton(ctx, rx + 36 + btnW, btnY, btnW, btnH, isMax ? '神兵已臻圆满' : `⚡ 连锤精炼 +${steps5}`, {
      r: 10,
      grad: ['#d97706', '#78350f'],
      border: '#fde047',
      fontSize: 15,
      subText: isMax ? undefined : `连强至 +${en + steps5} · 共耗 ${cost5} 铜钱`,
      disabled: isMax || App.State.isBusy(),
    }, () => App.State.enhanceEquip(sel.uid, 5).then((r) => { if (r.ok) triggerFlash(); }));
  }

  // ================================================================ 2. 升星专页：紫微七曜观星台

  function renderStarPage(ctx, st, time) {
    const sel = renderEquipListPane(ctx, st, '#c084fc');
    const rx = 432, ry = 118, rw = 504, rh = 400;
    drawStageBox(ctx, rx, ry, rw, rh, '#1e1136', '#0e071c', '#9333ea');
    if (!sel) return renderEmptyRight(ctx, rx, ry, rw, rh);

    const C = App.Config, F = C.FORGE;
    const tpl = C.EQUIP_TEMPLATES[sel.tplId];
    const star = sel.star || 0, maxStar = F.starMax || 5, isMax = star >= maxStar;
    const starMult = Math.round((F.starStatMult || 0.12) * 100);
    const curB = C.getEquipBonus(sel);
    const nextB = isMax ? curB : previewEquipBonus(sel, null, star + 1, null);

    // 顶部左侧标题说明
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f3e8ff';
    ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText(`${tpl.name} · 星魂第 ${star} 重`, rx + 22, ry + 34);
    ctx.fillStyle = '#d8b4fe';
    ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(`每点亮 1 颗将星，装备基础攻防血额外乘算 +${starMult}%（当前累计 +${star * starMult}%）`, rx + 22, ry + 54);
    ctx.restore();

    // 中央：动态旋转紫微五芒星魂罗盘阵
    const cx = rx + 132, cy = ry + 168, ringR = 74;
    ctx.save();
    const aura = ctx.createRadialGradient(cx, cy, 10, cx, cy, ringR + 24);
    aura.addColorStop(0, 'rgba(168, 85, 247, 0.42)');
    aura.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(cx, cy, ringR + 24, 0, Math.PI * 2); ctx.fill();

    // 双层星轨虚线环
    ctx.strokeStyle = 'rgba(216, 180, 254, 0.30)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath(); ctx.arc(cx, cy, ringR, time * 0.25, time * 0.25 + Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // 计算 5 颗将星节点坐标并连线
    const pts = [];
    for (let i = 0; i < maxStar; i++) {
      const ang = -Math.PI / 2 + (i * 2 * Math.PI) / maxStar;
      pts.push({ x: cx + Math.cos(ang) * ringR, y: cy + Math.sin(ang) * ringR });
    }
    ctx.lineWidth = 1.6;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      ctx.strokeStyle = i < star ? '#facc15' : 'rgba(147, 51, 234, 0.35)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();

    // 阵眼装备图标
    App.Sprites.drawEquipIcon(ctx, sel.tplId, cx - 32, cy - 32, 64, { radius: 10, border: '#e9d5ff', lineWidth: 2.2 });

    // 绘制 5 颗星辰节点
    pts.forEach((p, idx) => {
      const lit = idx < star;
      const isNext = idx === star;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, lit ? 13 : 11, 0, Math.PI * 2);
      ctx.fillStyle = lit ? '#7e22ce' : (isNext ? '#3b0764' : '#1e1b2e');
      ctx.fill();
      ctx.strokeStyle = lit ? '#fde047' : (isNext ? '#c084fc' : '#6b7280');
      ctx.lineWidth = lit ? 2.2 : 1.4;
      ctx.stroke();
      drawTabGlyph(ctx, 'star', p.x, p.y, lit ? '#fde047' : (isNext ? '#e9d5ff' : '#6b7280'));
      ctx.restore();
    });

    // 右半侧：升星属性对比面板
    const sx = rx + 242, sy = ry + 78, sw = rw - 262;
    App.UI.drawPanel(ctx, sx, sy, sw, 186, { r: 10, bg: 'rgba(14, 7, 28, 0.72)', border: '#7e22ce', lineWidth: 1.4 });
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
    ctx.fillText(isMax ? '★ 五曜齐聚 · 星魂圆满 ★' : `${star}★ (+${star * starMult}%)  ──▶  ${star + 1}★ (+${(star + 1) * starMult}%)`, sx + sw / 2, sy + 26);

    const rows = [
      ['武力', curB.atk, nextB.atk],
      ['气血', curB.hp, nextB.hp],
      ['防御', curB.def, nextB.def],
      ['暴击', +(curB.crit * 100).toFixed(1) + '%', +(nextB.crit * 100).toFixed(1) + '%'],
    ];
    rows.forEach(([lbl, cv, nv], i) => {
      const ryRow = sy + 56 + i * 32;
      ctx.fillStyle = 'rgba(88, 28, 135, 0.28)';
      App.UI.roundRect(ctx, sx + 12, ryRow - 12, sw - 24, 25, 6);
      ctx.fill();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#e9d5ff';
      ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillText(lbl, sx + 22, ryRow + 4);
      ctx.textAlign = 'right';
      ctx.fillStyle = isMax ? '#fde047' : '#86efac';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(isMax ? `+${cv}` : `+${cv} → +${nv}`, sx + sw - 20, ryRow + 4);
    });
    ctx.restore();

    // 消耗与升星主按钮（锦缎甲革自动抵扣将魂）
    const silkCount = App.State.getItemCountByCat('silk');
    const needGold = (F.starGoldBase || 600) * (star + 1);
    const rawSoul = (F.starSoulBase || 40) * (star + 1);
    const needSoul = silkCount > 0 ? Math.max(0, rawSoul - (F.starSilkSaveSoul || 15)) : rawSoul;
    App.UI.drawPanel(ctx, rx + 24, ry + 280, rw - 48, 36, { r: 8, bg: 'rgba(12, 6, 24, 0.72)', border: '#6b21a8', lineWidth: 1 });
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillStyle = st.gold >= needGold ? '#fde68a' : '#fca5a5';
    ctx.fillText(`所需铜钱：${isMax ? '-' : needGold}（存 ${st.gold}）`, rx + 34, ry + 298);
    ctx.textAlign = 'right';
    ctx.fillStyle = st.soul >= needSoul ? '#e9d5ff' : '#fca5a5';
    ctx.fillText(`所需将魂：${isMax ? '-' : needSoul}${!isMax && silkCount > 0 ? `(锦缎抵-${rawSoul - needSoul})` : ''}（存 ${st.soul}）`, rx + rw - 34, ry + 298);
    ctx.restore();

    App.UI.drawButton(ctx, rx + 24, ry + 328, rw - 48, 54, isMax ? '★ 星魂已升至满星 ★' : `✦ 引魂冲星 · 突破至 ${star + 1}★`, {
      r: 10,
      grad: ['#7e22ce', '#4c1d95'],
      border: '#fef08a',
      fontSize: 15.5,
      subText: isMax ? undefined : `消耗 ${needGold} 铜钱 + ${needSoul} 将魂${silkCount > 0 ? ' + 1匹锦缎甲革' : ''}`,
      disabled: isMax || App.State.isBusy(),
    }, () => App.State.starUpEquip(sel.uid).then((r) => { if (r.ok) triggerFlash(); }));
  }

  // ================================================================ 3. 合成专页：乾坤八卦炼宝炉

  function toggleSynthUid(uid, st) {
    lastForgedEquip = null;
    const idx = synthUids.indexOf(uid);
    if (idx >= 0) {
      synthUids.splice(idx, 1);
      return;
    }
    const eq = (st.inventory || []).find((x) => x.uid === uid);
    const tpl = eq && App.Config.EQUIP_TEMPLATES[eq.tplId];
    if (!tpl) return;
    if (synthUids.length > 0) {
      const firstEq = (st.inventory || []).find((x) => x.uid === synthUids[0]);
      const firstTpl = firstEq && App.Config.EQUIP_TEMPLATES[firstEq.tplId];
      if (firstTpl && firstTpl.quality !== tpl.quality) {
        synthUids = [uid];
        App.UI.showToast('已切换为同品质合成材料', '#fde047');
        return;
      }
    }
    if (synthUids.length >= 3) synthUids.shift();
    synthUids.push(uid);
  }

  function autoFillSynth(qual, st) {
    lastForgedEquip = null;
    const C = App.Config;
    const pool = (st.inventory || []).filter((e) => {
      const t = C.EQUIP_TEMPLATES[e.tplId];
      return t && t.quality === qual && !e.equippedBy && !e.equippedByBeast;
    }).sort((a, b) => (a.enhance || 0) - (b.enhance || 0));
    if (pool.length < 3) {
      App.UI.showToast(`闲置的${qual === 'blue' ? '精良蓝装' : '史诗紫装'}不足 3 件`, '#fca5a5');
      return;
    }
    synthUids = pool.slice(0, 3).map((e) => e.uid);
  }

  function renderSynthPage(ctx, st, time) {
    const C = App.Config, F = C.FORGE;
    // 清理已不存在或已穿戴的材料 uid
    synthUids = synthUids.filter((id) => {
      const e = (st.inventory || []).find((x) => x.uid === id);
      return e && !e.equippedBy && !e.equippedByBeast && C.EQUIP_TEMPLATES[e.tplId] && C.EQUIP_TEMPLATES[e.tplId].quality !== 'gold';
    });

    // 左侧：可合成闲置蓝/紫装材料池
    const px = 24, py = 118, pw = 398, ph = 400;
    drawStageBox(ctx, px, py, pw, ph, '#28150b', '#190c06', '#b45309');

    App.UI.drawButton(ctx, px + 12, py + 10, 122, 26, '一键放入3蓝装', {
      r: 13, grad: ['#0369a1', '#0c4a6e'], border: '#7dd3fc', fontSize: 11,
    }, () => autoFillSynth('blue', st));
    App.UI.drawButton(ctx, px + 142, py + 10, 122, 26, '一键放入3紫装', {
      r: 13, grad: ['#7e22ce', '#4c1d95'], border: '#d8b4fe', fontSize: 11,
    }, () => autoFillSynth('purple', st));
    App.UI.drawButton(ctx, px + 272, py + 10, 114, 26, '清空炉槽', {
      r: 13, grad: ['#44403c', '#292524'], border: '#a8a29e', fontSize: 11, disabled: !synthUids.length,
    }, () => { synthUids = []; });

    const mats = (st.inventory || []).filter((e) => {
      const t = C.EQUIP_TEMPLATES[e.tplId];
      return t && (t.quality === 'blue' || t.quality === 'purple') && !e.equippedBy && !e.equippedByBeast;
    });
    const maxPage = Math.max(0, Math.ceil(mats.length / PER_PAGE) - 1);
    page = Math.min(page, maxPage);

    if (!mats.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText('暂无闲置蓝装或紫装可供熔炼', px + pw / 2, py + 195);
      ctx.fillStyle = '#a89070';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText('也可直接使用右侧【玄铁矿玉铸宝】锻造神装！', px + pw / 2, py + 220);
      ctx.restore();
    } else {
      mats.slice(page * PER_PAGE, (page + 1) * PER_PAGE).forEach((eq, i) => {
        const col = i % 4, row = Math.floor(i / 4);
        const cx = px + 12 + col * 95, cy = py + 46 + row * 154, cw = 89, ch = 144;
        const tpl = C.EQUIP_TEMPLATES[eq.tplId];
        const qCol = QUAL_COLOR[tpl.quality] || '#38bdf8';
        const slotIdx = synthUids.indexOf(eq.uid);
        const picked = slotIdx >= 0;

        App.UI.drawPanel(ctx, cx, cy, cw, ch, {
          r: 10, bg: picked ? '#4d280d' : '#241209', border: picked ? '#fde047' : qCol, lineWidth: picked ? 2.4 : 1.3,
        });
        App.Sprites.drawEquipIcon(ctx, eq.tplId, cx + 14.5, cy + 10, 60, { radius: 9, border: picked ? '#fef08a' : qCol });

        ctx.save();
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(tpl.name.slice(0, 6), cx + cw / 2, cy + 86);
        ctx.fillStyle = qCol;
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(`${tpl.quality === 'blue' ? '精良蓝品' : '史诗紫品'} +${eq.enhance || 0}`, cx + cw / 2, cy + 104);

        ctx.fillStyle = picked ? '#d97706' : 'rgba(68, 64, 60, 0.4)';
        App.UI.roundRect(ctx, cx + 12, cy + 116, cw - 24, 20, 6);
        ctx.fill();
        ctx.fillStyle = picked ? '#fffbeb' : '#a8a29e';
        ctx.font = 'bold 10px "PingFang SC", sans-serif';
        ctx.fillText(picked ? `✓ 炉槽 ${slotIdx + 1}` : '点击入炉', cx + cw / 2, cy + 129);
        ctx.restore();

        App.UI.addHit(cx, cy, cw, ch, () => toggleSynthUid(eq.uid, st));
      });
    }

    const fy = py + ph - 38;
    App.UI.drawButton(ctx, px + 14, fy, 74, 28, '◀ 上页', { r: 7, grad: ['#78350f', '#451a03'], border: '#d97706', fontSize: 11, disabled: page <= 0 }, () => { page -= 1; });
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fde68a'; ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(`闲置材料 ${mats.length} 件 · 第 ${page + 1}/${maxPage + 1} 页`, px + pw / 2, fy + 14);
    ctx.restore();
    App.UI.drawButton(ctx, px + pw - 88, fy, 74, 28, '下页 ▶', { r: 7, grad: ['#78350f', '#451a03'], border: '#d97706', fontSize: 11, disabled: page >= maxPage }, () => { page += 1; });

    // 右侧：乾坤八卦炼宝炉主阵
    const rx = 432, ry = 118, rw = 504, rh = 400;
    drawStageBox(ctx, rx, ry, rw, rh, '#291708', '#150b03', '#f59e0b');

    const idleBlueCnt = mats.filter((e) => C.EQUIP_TEMPLATES[e.tplId].quality === 'blue').length;
    const idlePurpleCnt = mats.filter((e) => C.EQUIP_TEMPLATES[e.tplId].quality === 'purple').length;
    App.UI.drawButton(ctx, rx + 14, ry + 10, 154, 26, `⚡ 批量合紫 (${Math.floor(idleBlueCnt / 3)}组)`, {
      r: 13, grad: ['#0284c7', '#0c4a6e'], border: '#7dd3fc', fontSize: 10.5,
      disabled: idleBlueCnt < 3 || App.State.isBusy(),
    }, () => {
      App.State.batchSynthesizeEquip('blue').then((res) => {
        if (res.ok) {
          synthUids = [];
          lastForgedEquip = res.newEquip || (res.newEquips && res.newEquips[res.newEquips.length - 1]) || null;
          triggerFlash();
        }
      });
    });
    App.UI.drawButton(ctx, rx + rw - 168, ry + 10, 154, 26, `⚡ 批量合金 (${Math.floor(idlePurpleCnt / 3)}组)`, {
      r: 13, grad: ['#7e22ce', '#4c1d95'], border: '#e9d5ff', fontSize: 10.5,
      disabled: idlePurpleCnt < 3 || App.State.isBusy(),
    }, () => {
      App.State.batchSynthesizeEquip('purple').then((res) => {
        if (res.ok) {
          synthUids = [];
          lastForgedEquip = res.newEquip || (res.newEquips && res.newEquips[res.newEquips.length - 1]) || null;
          triggerFlash();
        }
      });
    });

    const centerX = rx + rw / 2, centerY = ry + 162;
    const slotCoords = [
      { x: centerX - 152, y: centerY - 26, label: '材料槽 · 壹' },
      { x: centerX, y: centerY - 96, label: '材料槽 · 贰' },
      { x: centerX + 152, y: centerY - 26, label: '材料槽 · 叁' },
    ];

    // 八卦丹炉光环与导流火线
    ctx.save();
    const fireGlow = ctx.createRadialGradient(centerX, centerY + 34, 8, centerX, centerY + 34, 96);
    fireGlow.addColorStop(0, 'rgba(245, 158, 11, 0.45)');
    fireGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = fireGlow;
    ctx.beginPath(); ctx.arc(centerX, centerY + 34, 96, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.32)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(centerX, centerY + 34, 62, -time * 0.4, -time * 0.4 + Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    slotCoords.forEach((sc, idx) => {
      const active = !!synthUids[idx];
      ctx.strokeStyle = active ? '#fbbf24' : 'rgba(180, 83, 9, 0.35)';
      ctx.lineWidth = active ? 2.4 : 1.3;
      ctx.beginPath();
      ctx.moveTo(sc.x, sc.y + 30);
      ctx.lineTo(centerX, centerY + 34);
      ctx.stroke();
    });
    ctx.restore();

    // 绘制 3 个材料槽
    slotCoords.forEach((sc, idx) => {
      const uid = synthUids[idx];
      const eq = uid ? (st.inventory || []).find((x) => x.uid === uid) : null;
      const sx = sc.x - 32, sy = sc.y - 32;
      App.UI.drawPanel(ctx, sx, sy, 64, 64, {
        r: 10, bg: eq ? '#3b1d0a' : 'rgba(18, 9, 4, 0.78)', border: eq ? '#fde047' : '#92400e', lineWidth: eq ? 2 : 1.4,
      });
      if (eq) {
        App.Sprites.drawEquipIcon(ctx, eq.tplId, sx + 4, sy + 4, 56, { radius: 8 });
        App.UI.addHit(sx, sy, 64, 64, () => toggleSynthUid(uid, st));
      } else {
        ctx.save();
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sc.x - 8, sc.y);
        ctx.lineTo(sc.x + 8, sc.y);
        ctx.moveTo(sc.x, sc.y - 8);
        ctx.lineTo(sc.x, sc.y + 8);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = eq ? '#fde68a' : '#a89070';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText(eq ? C.EQUIP_TEMPLATES[eq.tplId].name.slice(0, 5) : sc.label, sc.x, sy + 78);
      ctx.restore();
    });

    // 中央乾坤鼎产出槽
    const outX = centerX - 42, outY = centerY - 8;
    const firstEq = synthUids[0] ? (st.inventory || []).find((x) => x.uid === synthUids[0]) : null;
    const inQual = firstEq && C.EQUIP_TEMPLATES[firstEq.tplId] ? C.EQUIP_TEMPLATES[firstEq.tplId].quality : null;
    const outQual = inQual === 'purple' ? 'gold' : 'purple';
    const synthFee = inQual === 'purple' ? (F.synthPurpleGold || 2600) : (F.synthBlueGold || 800);

    App.UI.drawPanel(ctx, outX, outY, 84, 84, {
      r: 14, bg: '#3f1d0b', border: lastForgedEquip ? '#fef08a' : (QUAL_COLOR[outQual] || '#fbbf24'), lineWidth: 2.6,
    });
    if (lastForgedEquip && C.EQUIP_TEMPLATES[lastForgedEquip.tplId]) {
      App.Sprites.drawEquipIcon(ctx, lastForgedEquip.tplId, outX + 6, outY + 6, 72, { radius: 10, border: '#fef08a', lineWidth: 2 });
    } else {
      ctx.save();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = QUAL_COLOR[outQual];
      ctx.font = 'bold 28px "PingFang SC", serif';
      ctx.fillText('鼎', centerX, outY + 36);
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.fillText(inQual === 'purple' ? '必出金装' : '必出紫装', centerX, outY + 64);
      ctx.restore();
    }

    // 规则提示横条
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = lastForgedEquip ? '#4ade80' : '#fde68a';
    ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
    const forgedName = lastForgedEquip && C.EQUIP_TEMPLATES[lastForgedEquip.tplId] ? C.EQUIP_TEMPLATES[lastForgedEquip.tplId].name : '';
    ctx.fillText(
      forgedName ? `✦ 恭喜炼成新神兵【${forgedName}】！已收入兵甲库 ✦` : '3 件同品闲置装备 100% 升品（材料曾强化的铜钱自动返还 80%）',
      centerX, ry + 286
    );
    ctx.restore();

    const oreCount = App.State.getItemCountByCat('ore');
    const needOre = F.oreForgeCount || 5;
    const oreGold = F.oreForgeGold || 1500;
    const goldRate = Math.round((F.oreForgeGoldEquipRate || 0.30) * 100);
    const silkCount = App.State.getItemCountByCat('silk');
    const needSilk = F.silkForgeCount || 5;
    const silkGold = F.silkForgeGold || 1500;
    const silkGoldRate = Math.round((F.silkForgeGoldEquipRate || 0.30) * 100);

    // 底部三大锻造通道：三合一升品 + 矿玉铸兵玉 + 锦缎裁甲驹
    const btnY = ry + 312, btnW = Math.floor((rw - 56) / 3), btnH = 64;
    const canSynth = synthUids.length === 3;
    App.UI.drawButton(ctx, rx + 20, btnY, btnW, btnH, `🔥 三合升品(${synthUids.length}/3)`, {
      r: 10,
      grad: ['#d97706', '#7c2d12'],
      border: '#fef08a',
      fontSize: 12.5,
      subText: canSynth ? `${synthFee}钱·必出${outQual === 'gold' ? '金' : '紫'}` : '左侧选满3件同品',
      disabled: !canSynth || App.State.isBusy(),
    }, () => {
      App.State.synthesizeEquip(synthUids.slice()).then((res) => {
        if (res.ok) {
          synthUids = [];
          lastForgedEquip = res.newEquip || null;
          triggerFlash();
        }
      });
    });

    App.UI.drawButton(ctx, rx + 28 + btnW, btnY, btnW, btnH, `⚒ 矿玉铸兵书`, {
      r: 10,
      grad: ['#0f766e', '#134e4a'],
      border: '#99f6e4',
      fontSize: 12.5,
      subText: `${needOre}矿+${oreGold}钱(存${oreCount})·${goldRate}%金`,
      disabled: App.State.isBusy(),
    }, () => {
      App.State.forgeOreEquip().then((res) => {
        if (res.ok) {
          lastForgedEquip = res.newEquip || null;
          triggerFlash();
        }
      });
    });

    App.UI.drawButton(ctx, rx + 36 + btnW * 2, btnY, btnW, btnH, `🧵 锦缎裁甲驹`, {
      r: 10,
      grad: ['#7e22ce', '#4c1d95'],
      border: '#e9d5ff',
      fontSize: 12.5,
      subText: `${needSilk}锦+${silkGold}钱(存${silkCount})·${silkGoldRate}%金`,
      disabled: App.State.isBusy(),
    }, () => {
      App.State.forgeSilkEquip().then((res) => {
        if (res.ok) {
          lastForgedEquip = res.newEquip || null;
          triggerFlash();
        }
      });
    });
  }

  // ================================================================ 4. 进阶专页：九霄玄冥破阶坛

  function renderAdvancePage(ctx, st) {
    const sel = renderEquipListPane(ctx, st, '#38bdf8');
    const rx = 432, ry = 118, rw = 504, rh = 400;
    drawStageBox(ctx, rx, ry, rw, rh, '#0d2636', '#07141e', '#0284c7');
    if (!sel) return renderEmptyRight(ctx, rx, ry, rw, rh);

    const C = App.Config, F = C.FORGE;
    const tpl = C.EQUIP_TEMPLATES[sel.tplId];
    const en = sel.enhance || 0, adv = sel.advance || 0, maxAdv = F.advanceMax || 4;
    const isMax = adv >= maxAdv;
    const stepEn = F.advanceEnhanceStep || 5;
    const needEn = stepEn * (adv + 1);
    const advMultPct = Math.round((F.advanceStatMult || 0.25) * 100);
    const curB = C.getEquipBonus(sel);
    const nextB = isMax ? curB : previewEquipBonus(sel, null, null, adv + 1);

    // 顶部装备与当前品阶横栏
    App.Sprites.drawEquipIcon(ctx, sel.tplId, rx + 24, ry + 18, 70, { radius: 10, border: '#38bdf8', lineWidth: 2.2 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 17.5px "PingFang SC", serif';
    ctx.fillText(`${tpl.name} · 【${TIER_NAMES[adv] || (adv + '阶')}】`, rx + 108, ry + 42);
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillText(`当前强化 +${en}  ·  每破 1 阶全基础属性巨幅乘算 +${advMultPct}%！`, rx + 108, ry + 66);
    ctx.restore();

    // 四重破阶石碑阶梯卡
    const colW = Math.floor((rw - 66) / 4);
    for (let t = 1; t <= maxAdv; t++) {
      const tx = rx + 24 + (t - 1) * (colW + 6), ty = ry + 100, th = 100;
      const done = adv >= t;
      const cur = adv + 1 === t;
      App.UI.drawPanel(ctx, tx, ty, colW, th, {
        r: 9,
        bg: done ? 'rgba(3, 105, 161, 0.42)' : (cur ? 'rgba(180, 83, 9, 0.34)' : 'rgba(15, 23, 42, 0.65)'),
        border: done ? '#38bdf8' : (cur ? '#fbbf24' : '#334155'),
        lineWidth: cur ? 2.2 : 1.3,
      });
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = done ? '#7dd3fc' : (cur ? '#fde047' : '#94a3b8');
      ctx.font = 'bold 12.5px "PingFang SC", serif';
      ctx.fillText(TIER_NAMES[t] || `${t}阶`, tx + colW / 2, ty + 24);

      ctx.fillStyle = done || cur ? '#f8fafc' : '#64748b';
      ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText(`属性 +${t * advMultPct}%`, tx + colW / 2, ty + 50);

      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillStyle = done ? '#4ade80' : (en >= t * stepEn ? '#fde68a' : '#fca5a5');
      ctx.fillText(done ? '✓ 已破阶' : `需强化 +${t * stepEn}`, tx + colW / 2, ty + 78);
      ctx.restore();
    }

    // 属性跃升预览
    drawStatCompareGrid(ctx, rx + 24, ry + 212, rw - 48, curB, nextB, isMax, '#38bdf8');

    const silkCount = App.State.getItemCountByCat('silk');
    const needGold = (F.advanceGoldBase || 3000) * (adv + 1);
    const rawSoul = (F.advanceSoulBase || 150) * (adv + 1);
    const needSoul = silkCount > 0 ? Math.max(0, rawSoul - (F.advanceSilkSaveSoul || 40)) : rawSoul;
    const enShort = !isMax && en < needEn;

    if (enShort) {
      App.UI.drawButton(ctx, rx + 24, ry + 324, rw - 48, 56, `⚠ 需先强化至 +${needEn}（当前 +${en}）· 点击前往淬火强化`, {
        r: 10,
        grad: ['#c2410c', '#7c2d12'],
        border: '#fde047',
        fontSize: 14,
        subText: `破阶至【${TIER_NAMES[adv + 1]}】需消耗 ${needGold} 铜钱 + ${needSoul} 将魂${silkCount > 0 ? '(锦缎已减免)' : ''}`,
      }, () => switchTab('enhance'));
    } else {
      App.UI.drawButton(ctx, rx + 24, ry + 324, rw - 48, 56, isMax ? '✦ 已登临【肆阶·无双】至高品阶 ✦' : `⚔ 神兵破阶 · 晋升【${TIER_NAMES[adv + 1]}】`, {
        r: 10,
        grad: ['#0284c7', '#0c4a6e'],
        border: '#bae6fd',
        fontSize: 15,
        subText: isMax ? undefined : `消耗 ${needGold} 铜钱（存${st.gold}） + ${needSoul} 将魂（存${st.soul}）${silkCount > 0 ? ' + 1匹锦缎' : ''}`,
        disabled: isMax || App.State.isBusy(),
      }, () => App.State.advanceEquip(sel.uid).then((r) => { if (r.ok) triggerFlash(); }));
    }
  }

  // ================================================================ 5. 洗炼专页：翠微灵玉洗炼盘
  let confirmReforgeUid = null;

  function renderReforgePage(ctx, st) {
    const sel = renderEquipListPane(ctx, st, '#34d399');
    const rx = 432, ry = 118, rw = 504, rh = 400;
    drawStageBox(ctx, rx, ry, rw, rh, '#0e291e', '#06150f', '#10b981');
    if (!sel) return renderEmptyRight(ctx, rx, ry, rw, rh);

    const C = App.Config, F = C.FORGE;
    const tpl = C.EQUIP_TEMPLATES[sel.tplId];
    const b = C.getEquipBonus(sel);
    const maxSlots = F.reforgeSlots || 3;
    const affixes = sel.affixes || [];

    // 顶部装备信息与概率标尺
    App.Sprites.drawEquipIcon(ctx, sel.tplId, rx + 22, ry + 16, 62, { radius: 9, border: '#34d399', lineWidth: 2 });
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#d1fae5';
    ctx.font = 'bold 16.5px "PingFang SC", serif';
    ctx.fillText(`${tpl.name} · 灵纹词条洗炼`, rx + 96, ry + 36);
    ctx.fillStyle = '#6ee7b7';
    ctx.font = '11.5px "PingFang SC", sans-serif';
    ctx.fillText(`当前总属性：武+${b.atk}  血+${b.hp}  防+${b.def}  暴+${+(b.crit * 100).toFixed(1)}%`, rx + 96, ry + 56);
    ctx.fillStyle = '#a7f3d0';
    ctx.font = '10.5px "PingFang SC", sans-serif';
    ctx.fillText('品质概率：凡品蓝 45%  ·  灵品紫 35%  ·  仙品金 16%  ·  绝世红 4%（可锁定心仪词条）', rx + 96, ry + 74);
    ctx.restore();

    // 3 条灵纹词条槽
    let lockedCount = 0;
    for (let i = 0; i < maxSlots; i++) {
      const af = affixes[i];
      if (af && af.locked) lockedCount += 1;
      const sy = ry + 92 + i * 64, sx = rx + 22, sw = rw - 44, sh = 56;
      const qInfo = af ? (AFFIX_QUAL[af.quality] || AFFIX_QUAL.blue) : null;

      App.UI.drawPanel(ctx, sx, sy, sw, sh, {
        r: 9,
        bg: qInfo ? qInfo.bg : 'rgba(15, 23, 42, 0.55)',
        border: qInfo ? qInfo.border : '#1f2937',
        lineWidth: af && (af.quality === 'gold' || af.quality === 'red') ? 2 : 1.3,
      });

      if (!af) {
        ctx.save();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = '#9ca3af';
        ctx.font = 'bold 12.5px "PingFang SC", sans-serif';
        ctx.fillText(`◇ 第 ${i + 1} 灵纹槽 · 尚未洗炼唤醒（点击下方淬灵洗炼即刻开启）`, sx + 16, sy + sh / 2);
        ctx.restore();
      } else {
        const meta = AFFIX_META[af.type] || { name: '灵纹加持', unit: '', max: { red: 100 } };
        const valText = meta.isPct ? `+${+(af.val * 100).toFixed(1)}%` : `+${af.val}`;
        const maxRef = meta.max.red || 100;
        const ratio = Math.min(1, (af.val || 0) / maxRef);

        ctx.save();
        // 品质印章
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        App.UI.roundRect(ctx, sx + 10, sy + 10, 48, 22, 6);
        ctx.fill();
        ctx.strokeStyle = qInfo.color;
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = qInfo.color;
        ctx.font = 'bold 11px "PingFang SC", sans-serif';
        ctx.fillText(qInfo.label, sx + 34, sy + 21);

        // 词条名与数值
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px "PingFang SC", sans-serif';
        ctx.fillText(`${meta.name}  ${valText}`, sx + 68, sy + 21);

        ctx.fillStyle = '#d1fae5';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.fillText(`灵韵满度 ${Math.round(ratio * 100)}%`, sx + 68, sy + 42);
        ctx.restore();

        App.UI.drawBar(ctx, sx + 148, sy + 37, 198, 8, ratio, qInfo.color, 'rgba(0,0,0,0.5)');

        // 右侧锁定开关按钮
        App.UI.drawButton(ctx, sx + sw - 92, sy + 12, 80, 32, af.locked ? '已锁定' : '未锁定', {
          r: 7,
          grad: af.locked ? ['#d97706', '#92400e'] : ['#1e293b', '#0f172a'],
          border: af.locked ? '#fef08a' : '#64748b',
          color: af.locked ? '#fef08a' : '#cbd5e1',
          fontSize: 11.5,
        }, () => App.State.lockEquipAffix(sel.uid, i));
      }
    }

    // 洗炼费用与矿玉减免计算
    const oreCount = App.State.getItemCountByCat('ore');
    const goldCost = (F.reforgeGoldBase || 400) + lockedCount * (F.reforgeGoldPerLock || 350);
    const rawSoul = (F.reforgeSoulBase || 15) + lockedCount * (F.reforgeSoulPerLock || 15);
    const saveSoul = F.reforgeOreSaveSoul || 10;
    const soulCost = oreCount > 0 ? Math.max(0, rawSoul - saveSoul) : rawSoul;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = oreCount > 0 ? '#6ee7b7' : '#fde68a';
    ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
    ctx.fillText(
      oreCount > 0
        ? `✦ 仓库备有锻造矿玉 ${oreCount} 枚：本次洗炼自动耗 1 枚矿玉，减免 ${rawSoul - soulCost} 点将魂消耗！`
        : `已锁 ${lockedCount} 条词条  ·  获取锻造矿玉（剑阁死守掉落）每次洗炼可自动抵扣 ${saveSoul} 将魂`,
      rx + rw / 2, ry + 302
    );
    ctx.restore();

    const hasUnlockedRare = affixes.some((af) => af && !af.locked && (af.quality === 'gold' || af.quality === 'red'));
    if (!hasUnlockedRare && confirmReforgeUid === sel.uid) confirmReforgeUid = null;
    const needWarnConfirm = hasUnlockedRare && confirmReforgeUid === sel.uid;

    App.UI.drawButton(ctx, rx + 22, ry + 320, rw - 44, 58, needWarnConfirm ? '⚠ 含未锁金/红珍稀词条 · 再点确认重洗' : '✦ 淬灵洗炼词条', {
      r: 10,
      grad: needWarnConfirm ? ['#dc2626', '#7f1d1d'] : ['#059669', '#064e3b'],
      border: needWarnConfirm ? '#fef08a' : '#a7f3d0',
      fontSize: needWarnConfirm ? 14 : 15.5,
      subText: `消耗 ${goldCost} 铜钱（存${st.gold}） + ${soulCost} 将魂（存${st.soul}）${oreCount > 0 ? ' + 1枚矿玉' : ''}`,
      disabled: App.State.isBusy(),
    }, () => {
      if (hasUnlockedRare && confirmReforgeUid !== sel.uid) {
        confirmReforgeUid = sel.uid;
        App.UI.showToast('检测到未锁定的【仙品金/绝世红】词条！建议先锁定，或再次点击确认重洗', '#fbbf24');
        return;
      }
      confirmReforgeUid = null;
      App.State.reforgeEquip(sel.uid).then((r) => { if (r.ok) triggerFlash(); });
    });
  }

  // ================================================================ 6. 法宝专页：四象镇军万宝阁

  function formatArtAuraLine(art, F, lv) {
    const auraStep = (F && F.artifactUpgradeAuraStep != null) ? F.artifactUpgradeAuraStep : 0.03;
    const m = 1 + Math.max(0, (lv || 1) - 1) * auraStep;
    const rage = art.activeRage != null ? art.activeRage : (F.artifactActiveRage || 10);
    const parts = [`怒气+${rage}`];
    if (art.activeCritDmg) parts.push(`暴伤+${+(art.activeCritDmg * m * 100).toFixed(1).replace(/\.0$/, '')}%`);
    if (art.activeLifesteal) parts.push(`吸血+${+(art.activeLifesteal * m * 100).toFixed(1).replace(/\.0$/, '')}%`);
    if (art.activeDmgReduce) parts.push(`免伤+${+(art.activeDmgReduce * m * 100).toFixed(1).replace(/\.0$/, '')}%`);
    if (art.activeSkillPct) parts.push(`技伤+${+(art.activeSkillPct * m * 100).toFixed(1).replace(/\.0$/, '')}%`);
    if (art.activeSpdPct) parts.push(`攻速+${+(art.activeSpdPct * m * 100).toFixed(1).replace(/\.0$/, '')}%`);
    return parts.join(' ');
  }

  function renderArtifactPage(ctx, st, time) {
    const C = App.Config, F = C.FORGE || {};
    const allIds = C.ARTIFACT_IDS || [];
    const ownedMap = st.ownedArtifacts || {};
    const activeId = st.activeArtifactId || null;

    const filteredIds = allIds.filter((aid) => {
      const a = C.ARTIFACTS[aid];
      if (!a) return false;
      if (artFilter === 'owned') return (ownedMap[aid] || 0) > 0;
      if (artFilter === 'blue' || artFilter === 'purple' || artFilter === 'gold') return a.quality === artFilter;
      return true;
    });

    if (!selectedArtifactId || !filteredIds.includes(selectedArtifactId)) {
      selectedArtifactId = (activeId && filteredIds.includes(activeId)) ? activeId : (filteredIds[0] || allIds[0] || null);
    }

    // 左侧：36 件传世镇军法宝陈列阁（支持五档筛选 + 分页浏览！）
    const px = 24, py = 118, pw = 398, ph = 400;
    drawStageBox(ctx, px, py, pw, ph, '#28120c', '#160805', '#dc2626');

    ART_FILTERS.forEach((f, idx) => {
      const fx = px + 11 + idx * 76, fy = py + 10, fw = 71, fh = 25;
      const on = artFilter === f.id;
      App.UI.drawButton(ctx, fx, fy, fw, fh, f.label, {
        r: 12,
        grad: on ? ['#dc2626', '#991b1b'] : ['#3b1a12', '#260e08'],
        border: on ? '#fef08a' : '#7f1d1d',
        color: on ? '#fffbeb' : '#d6c4a8',
        fontSize: 11,
      }, () => { artFilter = f.id; artPage = 0; });
    });

    const totalArt = C.computeArtifactBonus(ownedMap, activeId);
    const maxArtPage = Math.max(0, Math.ceil(filteredIds.length / PER_PAGE) - 1);
    artPage = Math.min(artPage, maxArtPage);
    const pageIds = filteredIds.slice(artPage * PER_PAGE, (artPage + 1) * PER_PAGE);

    if (!pageIds.length) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
      ctx.fillText('该分类暂无镇军法宝', px + pw / 2, py + 195);
      ctx.fillStyle = '#a89070';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      ctx.fillText('攻克章节关卡收集灵材，即可炼化认主你的第一尊圣器！', px + pw / 2, py + 220);
      ctx.restore();
    }

    const maxLv = F.artifactMaxLv || 20;
    pageIds.forEach((aid, i) => {
      const a = C.ARTIFACTS[aid];
      const lv = ownedMap[aid] || 0;
      const isAct = activeId === aid && lv > 0;
      const on = selectedArtifactId === aid;
      const col = i % 4, row = Math.floor(i / 4);
      const cx = px + 12 + col * 95, cy = py + 44 + row * 152, cw = 89, ch = 142;
      const qCol = QUAL_COLOR[a.quality] || '#facc15';

      App.UI.drawPanel(ctx, cx, cy, cw, ch, {
        r: 10,
        bg: on ? '#4c1810' : (lv > 0 ? '#2b120b' : '#1c120e'),
        border: on ? '#fef08a' : (lv > 0 ? qCol : '#57534e'),
        lineWidth: on ? 2.4 : 1.4,
      });

      ctx.save();
      if (lv <= 0) ctx.globalAlpha = 0.58;
      drawArtifactIcon(ctx, a, cx + 14.5, cy + 9, 60, { radius: 10, border: lv > 0 ? qCol : '#78716c' });
      ctx.restore();

      if (isAct) {
        ctx.save();
        ctx.fillStyle = '#dc2626';
        App.UI.roundRect(ctx, cx + 4, cy + 5, 42, 16, 5);
        ctx.fill();
        ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fffbeb'; ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('★出战', cx + 25, cy + 13);
        ctx.restore();
      }

      const matProg = lv <= 0 && C.getArtifactMaterialProgress ? C.getArtifactMaterialProgress(st.items, a) : { readyCount: 4, totalKinds: 4, allEnough: true };
      const canAffordUnlock = lv <= 0 && (C.canUnlockArtifact ? C.canUnlockArtifact(st, a) : (st.gold >= (a.unlockGold || 0) && st.soul >= (a.unlockSoul || 0)));
      const upGoldCard = lv > 0 ? ((a.upGoldBase || 3600) + (lv - 1) * (a.upGoldStep || 1800)) : 0;
      const canUpgradeCard = lv > 0 && lv < maxLv && st.gold >= upGoldCard;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = lv > 0 ? '#fef3c7' : '#a8a29e';
      ctx.font = 'bold 10.8px "PingFang SC", sans-serif';
      ctx.fillText(a.name.slice(0, 6), cx + cw / 2, cy + 84);

      ctx.fillStyle = lv > 0 ? '#fbbf24' : qCol;
      ctx.font = '9.8px "PingFang SC", sans-serif';
      const qName = a.quality === 'gold' ? '传世至宝' : (a.quality === 'purple' ? '史诗秘宝' : '精良镇器');
      ctx.fillText(lv > 0 ? `强化 Lv.${lv}` : `${qName}·${a.chapter || a.order}章`, cx + cw / 2, cy + 102);

      let badgeBg = 'rgba(41, 37, 36, 0.65)';
      let badgeCol = '#a8a29e';
      let badgeTxt = `材料 ${matProg.readyCount}/${matProg.totalKinds || 4}`;
      if (lv > 0) {
        if (lv >= maxLv) { badgeBg = 'rgba(22, 101, 52, 0.48)'; badgeCol = '#86efac'; badgeTxt = '强化已满'; }
        else if (canUpgradeCard) { badgeBg = 'rgba(180, 83, 9, 0.58)'; badgeCol = '#fef08a'; badgeTxt = '↑ 可强化'; }
        else { badgeBg = 'rgba(22, 101, 52, 0.42)'; badgeCol = '#86efac'; badgeTxt = '已认主共鸣'; }
      } else if (canAffordUnlock) {
        badgeBg = 'rgba(180, 83, 9, 0.62)'; badgeCol = '#fef08a'; badgeTxt = '✦ 可炼化';
      } else if (matProg.allEnough) {
        badgeBg = 'rgba(88, 28, 135, 0.45)'; badgeCol = '#e9d5ff'; badgeTxt = '四材已齐';
      }
      ctx.fillStyle = badgeBg;
      App.UI.roundRect(ctx, cx + 8, cy + 114, cw - 16, 20, 6);
      ctx.fill();
      ctx.fillStyle = badgeCol;
      ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
      ctx.fillText(badgeTxt, cx + cw / 2, cy + 127);
      ctx.restore();

      App.UI.addHit(cx, cy, cw, ch, () => { selectedArtifactId = aid; });
    });

    // 左下全军总加成提示 + 页码直选分页条
    const fy = py + ph - 48;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fca5a5'; ctx.font = 'bold 9.8px "PingFang SC", sans-serif';
    ctx.fillText(`已炼化 ${totalArt.count}/${allIds.length} · 全军共鸣：武+${totalArt.atk} 血+${totalArt.hp} 防+${totalArt.def}`, px + pw / 2, fy + 6, pw - 20);
    ctx.restore();
    App.UI.drawPagination(ctx, px + 10, fy + 16, pw - 20, 25, artPage, maxArtPage + 1, (p) => {
      artPage = p;
    }, { activeGrad: ['#dc2626', '#7f1d1d'], bg: '#450a0a', border: '#f87171' });

    // 右侧：法宝炼化四材与铜钱强化祭坛详情
    const rx = 432, ry = 118, rw = 504, rh = 400;
    drawStageBox(ctx, rx, ry, rw, rh, '#2c100b', '#150604', '#ef4444');
    const art = selectedArtifactId ? C.ARTIFACTS[selectedArtifactId] : null;
    if (!art) return renderEmptyRight(ctx, rx, ry, rw, rh, '暂无可用法宝配置');

    const lv = ownedMap[art.id] || 0;
    const isMax = lv >= maxLv;
    const isAct = activeId === art.id && lv > 0;
    const actMult = F.artifactActiveMult || 1.5;
    const auraStep = F.artifactUpgradeAuraStep != null ? F.artifactUpgradeAuraStep : 0.03;

    // 祭坛法轮光环 + 法宝大图（紧凑精致排布，为下方四材槽与铜钱强化留出充裕空间）
    const icX = rx + 22, icY = ry + 14, icSz = 74;
    const haloCx = icX + icSz / 2, haloCy = icY + icSz / 2;
    ctx.save();
    const rad = ctx.createRadialGradient(haloCx, haloCy, 8, haloCx, haloCy, 54);
    rad.addColorStop(0, lv > 0 ? 'rgba(250, 204, 21, 0.48)' : 'rgba(148, 163, 184, 0.22)');
    rad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rad;
    ctx.beginPath(); ctx.arc(haloCx, haloCy, 54, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = lv > 0 ? 'rgba(253, 224, 71, 0.42)' : 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1.3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.arc(haloCx, haloCy, 45, time * 0.45, time * 0.45 + Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if ((art.quality !== 'blue' || isAct) && App.Sprites.drawUiSetAura) {
      App.Sprites.drawUiSetAura(ctx, haloCx, haloCy, icSz * 0.62, {
        auraVfx: isAct ? 'golden_emperor' : (art.quality === 'gold' ? 'golden_emperor' : 'shadow_phantom'),
        auraColor: isAct ? '#fde047' : (QUAL_COLOR[art.quality] || '#facc15'),
        auraSubColor: '#ffffff',
        vfxTier: isAct ? 3 : (art.quality === 'gold' ? 3 : 2),
      });
    }
    drawArtifactIcon(ctx, art, icX, icY, icSz, { radius: 12, border: QUAL_COLOR[art.quality] || '#facc15', lineWidth: 2.4 });

    // 右侧名称、状态角标与典故
    const tx = icX + icSz + 16;
    const chNum = art.chapter || art.order || 1;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText(`${art.name}  ${lv > 0 ? '强化 Lv.' + lv + '/' + maxLv : '[未炼化]'}`, tx, ry + 31, rw - (icSz + 118));

    // 右上角章节归属/出战状态胶囊
    const tagTxt = isAct ? '★ 出战显化中' : `第 ${chNum} 章圣器`;
    ctx.fillStyle = isAct ? 'rgba(22, 163, 74, 0.45)' : 'rgba(127, 29, 29, 0.55)';
    App.UI.roundRect(ctx, rx + rw - 98, ry + 15, 78, 20, 6);
    ctx.fill();
    ctx.strokeStyle = isAct ? '#86efac' : '#f87171';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = isAct ? '#bbf7d0' : '#fecaca';
    ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
    ctx.fillText(tagTxt, rx + rw - 59, ry + 28.5);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 11.2px "PingFang SC", sans-serif';
    ctx.fillText(`✦ ${art.title || '镇军圣器'} · 炼化后可使用铜钱升级强化 · 对战悬浮助阵 ✦`, tx, ry + 50, rw - (icSz + 52));
    ctx.fillStyle = '#e7d5b8';
    ctx.font = '11px "PingFang SC", sans-serif';
    App.UI.drawWrappedText(ctx, art.desc || '', tx, ry + 68, rw - (icSz + 52), 14.5, 'left');
    ctx.restore();

    const effLv = Math.max(1, lv);
    const auraMultCur = 1 + (effLv - 1) * auraStep;
    const pHp = (art.hp || 0) + (effLv - 1) * (art.hpStep || 0);
    const pAtk = (art.atk || 0) + (effLv - 1) * (art.atkStep || 0);
    const pDef = (art.def || 0) + (effLv - 1) * (art.defStep || 0);
    const pCrit = +((art.crit || 0) * auraMultCur * 100).toFixed(1);

    if (lv <= 0) {
      // ==================== 未炼化状态：双栏属性预览 + 4种章节灵材槽 + 凝魂炼化按钮 ====================
      const cardW = Math.floor((rw - 50) / 2), cardY = ry + 96, cardH = 104;
      App.UI.drawPanel(ctx, rx + 20, cardY, cardW, cardH, { r: 9, bg: 'rgba(20, 8, 5, 0.75)', border: '#b45309', lineWidth: 1.3 });
      App.UI.drawPanel(ctx, rx + 30 + cardW, cardY, cardW, cardH, { r: 9, bg: 'rgba(20, 8, 5, 0.75)', border: '#dc2626', lineWidth: 1.3 });

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a'; ctx.font = 'bold 11.5px "PingFang SC", sans-serif';
      ctx.fillText('【收集共鸣 · 全军常驻】', rx + 20 + cardW / 2, cardY + 19);
      ctx.fillStyle = '#fca5a5';
      ctx.fillText(`【出战本命 · 属性×${actMult} + 沙场真身】`, rx + 30 + cardW + cardW / 2, cardY + 19);

      ctx.textAlign = 'left';
      ctx.font = '11px "PingFang SC", sans-serif';
      const lx = rx + 30, rx2 = rx + 40 + cardW;
      ctx.fillStyle = '#f3e5c3';
      ctx.fillText(`全军武力 +${pAtk}   全军气血 +${pHp}`, lx, cardY + 42, cardW - 18);
      ctx.fillText(`全军防御 +${pDef}   全军暴击 +${pCrit}%`, lx, cardY + 63, cardW - 18);
      ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(`↑ 铜钱强化每级：武+${art.atkStep || 0} 血+${art.hpStep || 0} 防+${art.defStep || 0}`, lx, cardY + 86, cardW - 18);

      ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(`本命武力 +${Math.round(pAtk * actMult)}   气血 +${Math.round(pHp * actMult)}`, rx2, cardY + 42, cardW - 18);
      ctx.fillText(`本命防御 +${Math.round(pDef * actMult)}   暴击 +${+(pCrit * actMult).toFixed(1)}%`, rx2, cardY + 63, cardW - 18);
      ctx.fillStyle = '#4ade80'; ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(`★ ${formatArtAuraLine(art, F, 1)}`, rx2, cardY + 86, cardW - 18);
      ctx.restore();

      // 4种章节掉落灵材卡片（每章 8 关，每 2 关掉落同一种材料，点击卡片直达对应关卡！）
      const matProg = C.getArtifactMaterialProgress ? C.getArtifactMaterialProgress(st.items, art) : { list: [], readyCount: 0, totalKinds: 0, allEnough: true };
      const matSecY = ry + 207;
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 10.8px "PingFang SC", sans-serif';
      ctx.fillText(`◆ 炼化所需四材（第 ${chNum} 章共8关 · 每两关随机掉落同一种材料，点击灵材前往讨伐/扫荡）`, rx + 22, matSecY + 12, rw - 44);
      ctx.restore();

      const mw = 110, mh = 86, mGap = 8;
      const mStartX = rx + Math.floor((rw - (mw * 4 + mGap * 3)) / 2);
      const my = matSecY + 20;
      matProg.list.slice(0, 4).forEach((m, idx) => {
        const mx = mStartX + idx * (mw + mGap);
        const itCfg = m.item || { name: m.id, quality: art.quality };
        const stArr = Array.isArray(itCfg.dropStages) && itCfg.dropStages.length >= 2
          ? itCfg.dropStages
          : [(chNum - 1) * 8 + idx * 2 + 1, (chNum - 1) * 8 + idx * 2 + 2];
        const stageUnlocked = App.State.isStageUnlocked ? App.State.isStageUnlocked(stArr[0]) : true;
        const targetStage = (App.State.isStageUnlocked && App.State.isStageUnlocked(stArr[1])) ? stArr[1] : stArr[0];

        App.UI.drawPanel(ctx, mx, my, mw, mh, {
          r: 8,
          bg: m.enough ? 'rgba(20, 83, 45, 0.36)' : 'rgba(32, 14, 10, 0.85)',
          border: m.enough ? '#4ade80' : (QUAL_COLOR[itCfg.quality] || '#b45309'),
          lineWidth: m.enough ? 1.8 : 1.3,
        });

        App.Sprites.drawEquipIcon(ctx, m.id, mx + 6, my + 8, 38, {
          radius: 6,
          border: m.enough ? '#86efac' : (QUAL_COLOR[itCfg.quality] || '#facc15'),
          lineWidth: 1.5,
          noAnim: true,
        });

        ctx.save();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fef3c7';
        ctx.font = 'bold 10.2px "PingFang SC", sans-serif';
        ctx.fillText(String(itCfg.name || '灵材').slice(0, 5), mx + 48, my + 21, mw - 52);

        ctx.fillStyle = m.enough ? '#4ade80' : '#f87171';
        ctx.font = 'bold 11.5px sans-serif';
        ctx.fillText(`${m.have} / ${m.need}`, mx + 48, my + 40, mw - 52);

        App.UI.roundRect(ctx, mx + 6, my + 55, mw - 12, 23, 5);
        ctx.fillStyle = m.enough ? 'rgba(22, 101, 52, 0.55)' : (stageUnlocked ? 'rgba(146, 64, 14, 0.55)' : 'rgba(41, 37, 36, 0.65)');
        ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillStyle = m.enough ? '#bbf7d0' : (stageUnlocked ? '#fef08a' : '#a8a29e');
        ctx.font = 'bold 9.5px "PingFang SC", sans-serif';
        ctx.fillText(m.enough ? `✓ 第${stArr[0]}~${stArr[1]}关已齐` : `第${stArr[0]}~${stArr[1]}关 ${stageUnlocked ? '▶' : '未通'}`, mx + mw / 2, my + 70, mw - 16);
        ctx.restore();

        App.UI.addHit(mx, my, mw, mh, () => {
          if (!stageUnlocked) {
            App.UI.showToast(`请先推进主线至第 ${chNum} 章（第 ${stArr[0]}~${stArr[1]} 关）收集【${itCfg.name}】！`, '#fbbf24');
            return;
          }
          App.Main.goScene('map', { selectOrder: targetStage });
        });
      });

      // 底部凝魂炼化主按钮
      const uGold = art.unlockGold || 18000, uSoul = art.unlockSoul || 320;
      const canUnlock = C.canUnlockArtifact ? C.canUnlockArtifact(st, art) : (st.gold >= uGold && st.soul >= uSoul && matProg.allEnough);
      const goldOk = st.gold >= uGold, soulOk = st.soul >= uSoul;
      App.UI.drawButton(ctx, rx + 20, ry + 322, rw - 40, 62, `✦ 凝魂炼化【${art.name}】`, {
        r: 11,
        grad: canUnlock ? ['#dc2626', '#7f1d1d'] : ['#442722', '#261310'],
        border: canUnlock ? '#fef08a' : '#78716c',
        color: canUnlock ? '#fffbeb' : '#d6d3d1',
        fontSize: 15.5,
        subText: `耗 ${uGold}铜钱(${goldOk ? '足' : '存' + st.gold}) + ${uSoul}将魂(${soulOk ? '足' : '存' + st.soul}) + 四材(${matProg.readyCount}/${matProg.totalKinds || 4}齐)`,
        disabled: App.State.isBusy(),
      }, () => App.State.unlockArtifact(art.id).then((r) => { if (r.ok) triggerFlash(); }));
    } else {
      // ==================== 已炼化状态：当前→下级强化对比 + 纯铜钱强化升级 + 设为出战法宝 ====================
      const nextLv = Math.min(maxLv, lv + 1);
      const nextAuraMult = 1 + (nextLv - 1) * auraStep;
      const nHp = (art.hp || 0) + (nextLv - 1) * (art.hpStep || 0);
      const nAtk = (art.atk || 0) + (nextLv - 1) * (art.atkStep || 0);
      const nDef = (art.def || 0) + (nextLv - 1) * (art.defStep || 0);
      const nCrit = +((art.crit || 0) * nextAuraMult * 100).toFixed(1);

      const cardW = Math.floor((rw - 50) / 2), cardY = ry + 98, cardH = 148;
      App.UI.drawPanel(ctx, rx + 20, cardY, cardW, cardH, { r: 10, bg: 'rgba(20, 8, 5, 0.74)', border: '#b45309', lineWidth: 1.4 });
      App.UI.drawPanel(ctx, rx + 30 + cardW, cardY, cardW, cardH, { r: 10, bg: isAct ? 'rgba(127, 29, 29, 0.48)' : 'rgba(20, 8, 5, 0.74)', border: isAct ? '#fde047' : '#dc2626', lineWidth: isAct ? 2 : 1.4 });

      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde68a'; ctx.font = 'bold 12px "PingFang SC", sans-serif';
      ctx.fillText('【收集共鸣 · 全军常驻】', rx + 20 + cardW / 2, cardY + 22);
      ctx.fillStyle = '#fca5a5';
      ctx.fillText(`【出战本命 · 属性×${actMult}】`, rx + 30 + cardW + cardW / 2, cardY + 22);

      ctx.textAlign = 'left';
      ctx.font = '11.5px "PingFang SC", sans-serif';
      const lx = rx + 32, rx2 = rx + 42 + cardW;
      ctx.fillStyle = '#f3e5c3';
      ctx.fillText(`全军武力：+${pAtk}${!isMax ? ' → +' + nAtk : ''}`, lx, cardY + 50, cardW - 20);
      ctx.fillText(`全军气血：+${pHp}${!isMax ? ' → +' + nHp : ''}`, lx, cardY + 76, cardW - 20);
      ctx.fillText(`全军防御：+${pDef}${!isMax ? ' → +' + nDef : ''}`, lx, cardY + 102, cardW - 20);
      ctx.fillText(`全军暴击：+${pCrit}%${!isMax && nCrit > pCrit ? ' → +' + nCrit + '%' : ''}`, lx, cardY + 128, cardW - 20);

      ctx.fillStyle = '#fef08a';
      ctx.fillText(`本命武力：+${Math.round(pAtk * actMult)}  气血 +${Math.round(pHp * actMult)}`, rx2, cardY + 50, cardW - 20);
      ctx.fillText(`本命防御：+${Math.round(pDef * actMult)}  暴击 +${+(pCrit * actMult).toFixed(1)}%`, rx2, cardY + 76, cardW - 20);
      ctx.fillStyle = '#86efac'; ctx.font = 'bold 10.8px "PingFang SC", sans-serif';
      ctx.fillText('★ 出战流派特技 & 沙场显化：', rx2, cardY + 103);
      ctx.fillStyle = '#4ade80';
      ctx.fillText(formatArtAuraLine(art, F, lv), rx2, cardY + 125, cardW - 20);
      ctx.fillStyle = '#fde68a'; ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText('✦ 对战中悬浮护军，周期轰击敌阵', rx2, cardY + 141, cardW - 20);
      ctx.restore();

      // 铜钱强化等级进度条
      const progY = ry + 258;
      App.UI.drawPanel(ctx, rx + 20, progY, rw - 40, 44, { r: 8, bg: 'rgba(28, 12, 6, 0.80)', border: '#9a3412', lineWidth: 1.2 });
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillText(`强化进度：Lv.${lv} / Lv.${maxLv}`, rx + 32, progY + 17);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fbbf24';
      ctx.font = '10.5px "PingFang SC", sans-serif';
      ctx.fillText(isMax ? '已强化至最高等级' : '使用铜钱直接强化升级 · 全面放大共鸣与沙场神威', rx + rw - 32, progY + 17);
      ctx.restore();
      App.UI.drawBar(ctx, rx + 32, progY + 25, rw - 64, 10, Math.min(1, lv / maxLv), '#f59e0b', '#1c0a05');

      // 底部按钮区（主推纯铜钱强化升级 + 出战法宝切换；拥有九州奇珍时保留奇珍直升入口）
      const btnY = ry + 314;
      const upGold = (art.upGoldBase || 3600) + (lv - 1) * (art.upGoldStep || 1800);
      const tribCount = App.State.getItemCountByCat('tribute');

      if (tribCount > 0) {
        const w1 = 192, w2 = 122, w3 = rw - 40 - w1 - w2 - 16;
        App.UI.drawButton(ctx, rx + 20, btnY, w1, 66, isMax ? '强化已满级' : `🔥 铜钱强化 Lv.${lv + 1}`, {
          r: 10,
          grad: (!isMax && st.gold >= upGold) ? ['#ea580c', '#9a3412'] : ['#4a2518', '#2a120a'],
          border: (!isMax && st.gold >= upGold) ? '#fef08a' : '#78716c',
          fontSize: 13.5,
          subText: isMax ? `圆满 Lv.${maxLv}` : `消耗 ${upGold} 铜钱(存${st.gold})`,
          disabled: isMax || App.State.isBusy(),
        }, () => App.State.upgradeArtifact(art.id, false).then((r) => { if (r.ok) triggerFlash(); }));

        App.UI.drawButton(ctx, rx + 28 + w1, btnY, w2, 66, isMax ? '已圆满' : '奇珍直升 +1', {
          r: 10,
          grad: ['#7e22ce', '#4c1d95'],
          border: '#e9d5ff',
          fontSize: 12.5,
          subText: isMax ? undefined : `耗1奇珍(存${tribCount})`,
          disabled: isMax || App.State.isBusy(),
        }, () => App.State.upgradeArtifact(art.id, true).then((r) => { if (r.ok) triggerFlash(); }));

        App.UI.drawButton(ctx, rx + 36 + w1 + w2, btnY, w3, 66, isAct ? '✓ 出战镇军中' : '★ 设为出战', {
          r: 10,
          grad: isAct ? ['#15803d', '#14532d'] : ['#b45309', '#78350f'],
          border: isAct ? '#bbf7d0' : '#fde047',
          fontSize: 12.5,
          subText: isAct ? '沙场真身助战' : '对战悬浮显化',
          disabled: isAct || App.State.isBusy(),
        }, () => App.State.equipArtifact(art.id));
      } else {
        const wUpgrade = 286, wEquip = rw - 40 - wUpgrade - 10;
        App.UI.drawButton(ctx, rx + 20, btnY, wUpgrade, 66, isMax ? '强化已圆满' : `🔥 铜钱强化升级 → Lv.${lv + 1}`, {
          r: 10,
          grad: (!isMax && st.gold >= upGold) ? ['#ea580c', '#9a3412'] : ['#4a2518', '#2a120a'],
          border: (!isMax && st.gold >= upGold) ? '#fef08a' : '#78716c',
          fontSize: 14.5,
          subText: isMax ? `已达最高等级 Lv.${maxLv}` : `消耗 ${upGold} 铜钱（当前库存 ${st.gold}）`,
          disabled: isMax || App.State.isBusy(),
        }, () => App.State.upgradeArtifact(art.id, false).then((r) => { if (r.ok) triggerFlash(); }));

        App.UI.drawButton(ctx, rx + 30 + wUpgrade, btnY, wEquip, 66, isAct ? '✓ 出战镇军中' : '★ 设为出战法宝', {
          r: 10,
          grad: isAct ? ['#15803d', '#14532d'] : ['#b45309', '#78350f'],
          border: isAct ? '#bbf7d0' : '#fde047',
          fontSize: 13.5,
          subText: isAct ? `属性×${actMult}·沙场助战` : '激活光环·对战显化',
          disabled: isAct || App.State.isBusy(),
        }, () => App.State.equipArtifact(art.id));
      }
    }
  }

  // ================================================================ 主渲染入口

  function render(ctx, rawTime) {
    const time = rawTime || 0;
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const st = App.State.get();

    // 1. 深檀鎏金熔炉背景大底板
    ctx.fillStyle = '#1b0e07';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);

    // 2. 外层宫殿画框（对称饱满铺满 58~528 区域）
    drawStageBox(ctx, 14, 58, W - 28, 474, '#3a1d0e', '#241108', '#d97706');

    // 3. 顶部六大分殿导航横匾（强化 / 升星 / 合成 / 进阶 / 洗炼 / 法宝）
    App.UI.drawPanel(ctx, 24, 65, W - 48, 46, { r: 10, bg: '#1c0b05', border: '#b45309', lineWidth: 1.6 });

    const forgeIcon = App.Assets.get('icon_forge');
    if (forgeIcon) ctx.drawImage(forgeIcon, 32, 70, 36, 36);
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText('锻器坊', 73, 88);
    ctx.restore();

    TABS.forEach((tab, idx) => {
      const tx = 136 + idx * 116, ty = 71, tw = 110, th = 34;
      const on = activeTab === tab.id;
      ctx.save();
      App.UI.roundRect(ctx, tx, ty, tw, th, 8);
      if (on) {
        const g = ctx.createLinearGradient(tx, ty, tx, ty + th);
        g.addColorStop(0, tab.grad[0]);
        g.addColorStop(1, tab.grad[1]);
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = 'rgba(56, 28, 14, 0.72)';
      }
      ctx.fill();
      ctx.strokeStyle = on ? '#fef08a' : 'rgba(217, 119, 6, 0.45)';
      ctx.lineWidth = on ? 2 : 1.1;
      ctx.stroke();

      drawTabGlyph(ctx, tab.id, tx + 22, ty + th / 2, on ? '#fef08a' : tab.accent);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = on ? '#fffbeb' : '#e7d5b8';
      ctx.font = `bold ${on ? 14 : 13}px "PingFang SC", sans-serif`;
      ctx.fillText(tab.label, tx + 38, ty + th / 2 + 0.5);

      if (on) {
        ctx.fillStyle = '#fde047';
        App.UI.roundRect(ctx, tx + 18, ty + th - 3, tw - 36, 3, 1.5);
        ctx.fill();
      }
      ctx.restore();

      App.UI.addHit(tx, ty, tw, th, () => switchTab(tab.id));
    });

    App.UI.drawCloseButton(ctx, W - 68, 72, 32, () => App.Main.goScene('map'));

    // 4. 按当前页签渲染对应独立分殿页面
    if (activeTab === 'enhance') renderEnhancePage(ctx, st, time);
    else if (activeTab === 'star') renderStarPage(ctx, st, time);
    else if (activeTab === 'synth') renderSynthPage(ctx, st, time);
    else if (activeTab === 'advance') renderAdvancePage(ctx, st, time);
    else if (activeTab === 'reforge') renderReforgePage(ctx, st, time);
    else if (activeTab === 'artifact') renderArtifactPage(ctx, st, time);

    // 5. 锻造成功金芒闪耀反馈层
    if (flashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = (flashTimer / 0.75) * 0.24;
      const g = ctx.createRadialGradient(684, 280, 10, 684, 280, 260);
      g.addColorStop(0, '#fef08a');
      g.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(432, 118, 504, 400);
      ctx.restore();
    }
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.forge = { enter, update, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
