(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 锻器坊：装备的强化、升星、进阶都在这里（费用与上限来自后台「锻器坊」配置，实际扣费由服务端执行）
  const PER_PAGE = 10;
  let page = 0;
  let selectedUid = null;

  function enter() { page = 0; }

  function render(ctx) {
    const W = App.Platform.LOGICAL_W, H = App.Platform.LOGICAL_H;
    const st = App.State.get(), C = App.Config, F = C.FORGE;
    ctx.fillStyle = '#d9c08c';
    ctx.fillRect(0, 0, W, H);
    App.Scenes.map.drawTopBar(ctx);
    App.UI.drawPanel(ctx, 14, 62, W - 28, 412, { r: 14, bg: '#f4e6c4', border: '#7c4a21', lineWidth: 2 });
    App.UI.drawPanel(ctx, 26, 74, W - 52, 44, { r: 10, bg: '#451a03', border: '#d4a34b', lineWidth: 1.8 });
    const forgeIcon = App.Assets.get('icon_forge');
    if (forgeIcon) ctx.drawImage(forgeIcon, 36, 77, 38, 38);
    ctx.save();
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a'; ctx.font = 'bold 17px "PingFang SC", serif';
    ctx.fillText('神兵锻器坊 · 强化 / 升星 / 进阶', 82, 96);
    ctx.restore();
    App.UI.drawButton(ctx, W - 108, 79, 70, 34, '返回', { r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12 }, () => App.Main.goScene('map'));

    const list = st.inventory.filter((e) => C.EQUIP_TEMPLATES[e.tplId]);
    const maxPage = Math.max(0, Math.ceil(list.length / PER_PAGE) - 1);
    page = Math.min(page, maxPage);
    const sel = list.find((e) => e.uid === selectedUid) || list[page * PER_PAGE];
    if (sel) selectedUid = sel.uid;

    list.slice(page * PER_PAGE, (page + 1) * PER_PAGE).forEach((eq, i) => {
      const x = 28 + (i % 5) * 84, y = 128 + Math.floor(i / 5) * 132;
      const tpl = C.EQUIP_TEMPLATES[eq.tplId];
      const on = eq.uid === selectedUid;
      App.UI.drawPanel(ctx, x, y, 78, 124, { r: 9, bg: on ? '#fde68a' : '#fff7e0', border: on ? '#b45309' : '#a16207', lineWidth: on ? 2.2 : 1.2 });
      App.Sprites.drawEquipIcon(ctx, eq.tplId, x + 9, y + 8, 60, { radius: 8 });
      ctx.save();
      ctx.textAlign = 'center'; ctx.fillStyle = '#451a03'; ctx.font = 'bold 10.5px "PingFang SC", sans-serif';
      ctx.fillText(tpl.name.slice(0, 6), x + 39, y + 84);
      ctx.fillStyle = '#b45309'; ctx.font = '10px "PingFang SC", sans-serif';
      ctx.fillText(`+${eq.enhance || 0} · ${eq.star || 0}★ · ${eq.advance || 0}阶`, x + 39, y + 100);
      ctx.fillStyle = '#78716c';
      ctx.fillText(eq.equippedBy ? (C.GENERALS[eq.equippedBy] || {}).name || '' : (eq.equippedByBeast ? (C.BEASTS[eq.equippedByBeast] || {}).shortName || '' : '闲置'), x + 39, y + 115);
      ctx.restore();
      App.UI.addHit(x, y, 78, 124, () => { selectedUid = eq.uid; });
    });
    if (maxPage > 0) {
      App.UI.drawButton(ctx, 28, 400, 80, 30, '上一页', { r: 6, fontSize: 11, disabled: page <= 0 }, () => { page -= 1; selectedUid = null; });
      App.UI.drawButton(ctx, 362, 400, 80, 30, '下一页', { r: 6, fontSize: 11, disabled: page >= maxPage }, () => { page += 1; selectedUid = null; });
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#7c2d12'; ctx.font = '11px "PingFang SC", sans-serif';
      ctx.fillText(`${page + 1} / ${maxPage + 1}（共 ${list.length} 件）`, 235, 419); ctx.restore();
    }

    App.UI.drawPanel(ctx, 456, 128, W - 482, 334, { r: 10, bg: '#fff7e0', border: '#7c4a21', lineWidth: 1.6 });
    if (!sel) {
      ctx.save(); ctx.textAlign = 'center'; ctx.fillStyle = '#92400e'; ctx.font = '14px "PingFang SC", sans-serif';
      ctx.fillText('暂无装备，去征战或商城获取', 456 + (W - 482) / 2, 300); ctx.restore();
    } else {
      const tpl = C.EQUIP_TEMPLATES[sel.tplId], q = C.QUALITIES[tpl.quality] || {}, b = C.getEquipBonus(sel);
      const en = sel.enhance || 0, star = sel.star || 0, adv = sel.advance || 0;
      App.Sprites.drawEquipIcon(ctx, sel.tplId, 472, 144, 84, { radius: 10, lineWidth: 2 });
      ctx.save();
      ctx.textAlign = 'left';
      ctx.fillStyle = '#451a03'; ctx.font = 'bold 17px "PingFang SC", serif';
      ctx.fillText(tpl.name, 570, 166);
      ctx.fillStyle = '#92400e'; ctx.font = '12px "PingFang SC", sans-serif';
      ctx.fillText(`${q.name || ''}${tpl.setName ? ' · ' + tpl.setName : ''}`, 570, 188);
      ctx.fillStyle = '#b45309'; ctx.font = 'bold 13px "PingFang SC", sans-serif';
      ctx.fillText(`强化 +${en}    ${'★'.repeat(star)}${'☆'.repeat(Math.max(0, (F.starMax || 5) - star))}    ${adv} 阶`, 570, 212);
      ctx.fillStyle = '#57301a'; ctx.font = '13px "PingFang SC", sans-serif';
      ctx.fillText(`武力 +${b.atk}    气血 +${b.hp}    防御 +${b.def}    暴击 +${Math.round(b.crit * 1000) / 10}%`, 472, 254);
      ctx.restore();

      const needEn = (F.advanceEnhanceStep || 5) * (adv + 1);
      const ops = [
        { title: `强化至 +${en + 1}`, sub: `${App.State.getCost('enhance', en)} 铜钱`, off: en >= App.Config.PARAMS.equipEnhanceMax, offText: '强化已满', grad: ['#ea580c', '#9a3412'], fn: () => App.State.enhanceEquip(sel.uid) },
        { title: `升星至 ${star + 1}★`, sub: `${(F.starGoldBase || 0) * (star + 1)} 铜钱 + ${(F.starSoulBase || 0) * (star + 1)} 将魂`, off: star >= (F.starMax || 5), offText: '已满星', grad: ['#7e22ce', '#581c87'], fn: () => App.State.starUpEquip(sel.uid) },
        { title: `进阶至 ${adv + 1} 阶`, sub: en < needEn ? `需先强化至 +${needEn}` : `${(F.advanceGoldBase || 0) * (adv + 1)} 铜钱 + ${(F.advanceSoulBase || 0) * (adv + 1)} 将魂`, off: adv >= (F.advanceMax || 4), offText: '已满阶', grad: ['#0369a1', '#0c4a6e'], fn: () => App.State.advanceEquip(sel.uid) },
      ];
      ops.forEach((o, i) => {
        App.UI.drawButton(ctx, 472, 282 + i * 56, W - 514, 48, o.off ? o.offText : o.title, {
          r: 10, grad: o.grad, border: '#fef08a', fontSize: 14, subText: o.off ? undefined : o.sub, disabled: o.off || App.State.isBusy(),
        }, o.fn);
      });
    }
    App.Scenes.map.drawBottomNav(ctx, '');
  }

  App.Scenes = App.Scenes || {};
  App.Scenes.forge = { enter, render };
})(typeof globalThis !== 'undefined' ? globalThis : window);
