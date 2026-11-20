(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  function drawEquipIcon(ctx, tplId, x, y, size, opts) {
    const o = opts || {};
    const tpl = App.Config.EQUIP_TEMPLATES[tplId] || (App.Config.ITEMS && App.Config.ITEMS[tplId]);
    if (!tpl) return;
    const q = App.Config.QUALITIES[tpl.quality] || App.Config.QUALITIES.blue;
    const r = o.radius != null ? o.radius : 8;

    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.clip();
    const img = App.Assets.get(tpl.imgKey || ('eq_' + tplId));
    if (img) ctx.drawImage(img, x, y, size, size);
    else { ctx.fillStyle = q.bg; ctx.fillRect(x, y, size, size); }
    ctx.restore();

    ctx.save();
    App.UI.roundRect(ctx, x, y, size, size, r);
    ctx.strokeStyle = o.border || q.color;
    ctx.lineWidth = o.lineWidth || 2;
    ctx.stroke();
    ctx.restore();
  }

  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /**
   * ★ 三段式协调攻击运动学解算器（蓄力前摇 Anticipation -> 爆发打击/离弦挥扇 Release -> 柔和收势 Recovery）
   * 针对【弯弓射箭 bow】【羽扇施法 fan】【破空枪刺 thrust】【刀盾重劈 cleave】分别定制人体/马术重心曲线！
   */
  function computeAttackPose(u) {
    const p = u.atkProg > 0 ? Math.min(1, u.atkProg) : (u.attackAnim > 0 ? Math.min(1, 1 - u.attackAnim) : 0);
    const style = u.atkStyle || 'cleave';
    const pose = {
      active: p > 0.001,
      p,
      style,
      lungeX: 0,
      riderPitch: 0,
      horsePitch: 0,
      scaleX: 1,
      scaleY: 1,
      bowPull: 0,
      stringVib: 0,
      fanAngle: -0.35,
      fanSweepAlpha: 0,
      meleeSwing: 0,
      strikeFlash: 0,
    };
    if (!pose.active) return pose;

    if (style === 'bow') {
      // 弯弓射箭：0~0.45 沉腰后仰拉满弓弦 -> 0.45 崩弦激射后坐 -> 0.45~1.0 弓弦余振与柔和回正
      const rel = 0.45;
      if (p < rel) {
        const k = easeOutQuad(p / rel);
        pose.bowPull = k;
        pose.lungeX = -4.5 * k;
        pose.riderPitch = -0.10 * k;
        pose.scaleX = 1 - 0.02 * k;
        pose.scaleY = 1 + 0.02 * k;
      } else {
        const r = (p - rel) / (1 - rel);
        const decay = 1 - easeOutCubic(r);
        pose.bowPull = Math.max(0, 0.12 * decay);
        pose.stringVib = Math.sin(r * 38) * 3.2 * decay;
        pose.lungeX = (-4.5 + 3.0 * Math.sin(Math.min(1, r * 3) * Math.PI)) * decay;
        pose.riderPitch = -0.10 * decay;
        pose.strikeFlash = r < 0.28 ? (1 - r / 0.28) : 0;
      }
    } else if (style === 'fan') {
      // 羽扇施法：0~0.40 扬扇聚气后仰 -> 0.40~0.74 潇洒挥扇横扫130度 -> 0.74~1.0 从容收扇
      const rel = 0.40;
      if (p < rel) {
        const k = easeOutCubic(p / rel);
        pose.fanAngle = -0.25 - 1.15 * k; // 扬起羽扇至头顶后上方 (-1.40 rad)
        pose.lungeX = -3.8 * k;
        pose.riderPitch = -0.08 * k;
      } else if (p < 0.76) {
        const s = easeOutCubic((p - rel) / 0.36);
        pose.fanAngle = -1.40 + 2.25 * s; // 挥扇劈落至前方 (+0.85 rad)
        pose.fanSweepAlpha = Math.sin(s * Math.PI);
        pose.lungeX = -3.8 * (1 - s) + 6.5 * Math.sin(s * Math.PI);
        pose.riderPitch = -0.08 * (1 - s) + 0.11 * Math.sin(s * Math.PI);
        pose.strikeFlash = s < 0.45 ? (1 - s / 0.45) : 0;
      } else {
        const r = easeOutQuad((p - 0.76) / 0.24);
        pose.fanAngle = 0.85 * (1 - r) - 0.25 * r;
        pose.riderPitch = 0.03 * (1 - r);
      }
    } else if (style === 'thrust') {
      // 长枪铁骑直刺：0~0.32 蓄势回拉扬蹄 -> 0.32~0.62 破空猛刺拉伸 -> 0.62~1.0 收枪回位
      const rel = 0.32;
      const maxLunge = u.kind === 'general' ? 21 : (u.isMounted ? 17 : 14);
      if (p < rel) {
        const k = easeOutQuad(p / rel);
        pose.lungeX = -8.5 * k;
        pose.riderPitch = -0.09 * k;
        pose.horsePitch = -0.08 * k; // 战马蓄势微扬前蹄
        pose.meleeSwing = -0.55 * k;
        pose.scaleX = 1 - 0.04 * k;
        pose.scaleY = 1 + 0.03 * k;
      } else if (p < 0.64) {
        const s = easeOutCubic((p - rel) / 0.32);
        pose.lungeX = -8.5 * (1 - s) + maxLunge * Math.sin(s * Math.PI * 0.65);
        pose.riderPitch = 0.13 * s;
        pose.horsePitch = 0.05 * s;
        pose.meleeSwing = 1.0 * s;
        pose.scaleX = 1 + 0.07 * Math.sin(s * Math.PI);
        pose.scaleY = 1 - 0.04 * Math.sin(s * Math.PI);
        pose.strikeFlash = 1 - s;
      } else {
        const r = easeOutQuad((p - 0.64) / 0.36);
        pose.lungeX = maxLunge * 0.88 * (1 - r);
        pose.riderPitch = 0.13 * (1 - r);
        pose.horsePitch = 0.05 * (1 - r);
        pose.meleeSwing = 1.0 * (1 - r);
      }
    } else {
      // 刀盾步兵/猛将重劈：0~0.35 拧腰扬刀蓄力 -> 0.35~0.68 雷霆前扑重斩 -> 0.68~1.0 沉稳收刀
      const rel = 0.35;
      const maxLunge = u.kind === 'general' ? 18 : 12;
      if (p < rel) {
        const k = easeOutQuad(p / rel);
        pose.lungeX = -6.5 * k;
        pose.riderPitch = -0.14 * k;
        pose.horsePitch = -0.06 * k;
        pose.meleeSwing = -1.15 * k; // 高高举起刀斧
        pose.scaleY = 1 + 0.035 * k;
      } else if (p < 0.68) {
        const s = easeOutCubic((p - rel) / 0.33);
        pose.lungeX = -6.5 * (1 - s) + maxLunge * Math.sin(s * Math.PI * 0.65);
        pose.riderPitch = 0.20 * s;
        pose.horsePitch = 0.05 * s;
        pose.meleeSwing = -1.15 + 2.15 * s; // 150度大开大合劈落
        pose.scaleX = 1 + 0.06 * Math.sin(s * Math.PI);
        pose.scaleY = 1 - 0.045 * Math.sin(s * Math.PI);
        pose.strikeFlash = 1 - s;
      } else {
        const r = easeOutQuad((p - 0.68) / 0.32);
        pose.lungeX = maxLunge * 0.88 * (1 - r);
        pose.riderPitch = 0.20 * (1 - r);
        pose.horsePitch = 0.05 * (1 - r);
        pose.meleeSwing = 1.0 * (1 - r);
      }
    }
    return pose;
  }

  /**
   * ★ 三层骨骼协调骑乘奔袭 & 步卒迈步 & 待机呼吸渲染器！
   * - 骑乘单位(isMounted)：拆分为【骑手躯干披风(0~51%)】【战马头颈胸腹(48~73%)】【后蹄髋部 & 前蹄肩部(71~100%)】三层独立相位！
   *   奔跑时呈现真实战马三拍颠簸腾跃(boundY)、前后蹄异步屈伸抬腿、骑手腰腹缓冲跟随(riderLag)；攻击时骑手独立后仰拉弓/挥扇/前扑劈砍！
   * - 步战单位(!isMounted)：前后靴交替抬脚迈步 + 躯干协调前倾 + 待机自然胸腹呼吸！
   */
  function drawArticulatedSprite(ctx, img, w, h, moving, runPhase, hitFlash, opts) {
    if (!img) return;
    const o = opts || {};
    const isMounted = !!o.isMounted;
    const pose = o.pose || { riderPitch: 0, horsePitch: 0, scaleX: 1, scaleY: 1 };
    const time = o.time || 0;
    const uid = o.uid || 1;
    const iw = img.width;
    const ih = img.height;
    const baseTopY = -h + 10;

    ctx.save();
    if (hitFlash > 0) ctx.filter = 'brightness(1.85)';
    ctx.scale(pose.scaleX || 1, pose.scaleY || 1);

    if (isMounted) {
      // ================= 战马三层马术骨骼（马腿屈伸 + 马躯颠簸 + 骑手跟随/独立出招） =================
      const rRiderEnd = 0.51;
      const rLegStart = 0.71;
      const syRiderEnd = Math.floor(ih * rRiderEnd);
      const syHorseStart = Math.floor(ih * 0.48);
      const syLeg = Math.floor(ih * rLegStart);

      const dhRider = h * rRiderEnd;
      const dhHorseStart = h * 0.48;
      const dhLegTop = h * rLegStart;
      const dhLeg = h - dhLegTop;
      const hipY = baseTopY + dhLegTop;

      const idleBreath = Math.sin(time * 2.8 + uid * 1.7);
      const boundY = moving ? (-Math.abs(Math.sin(runPhase)) * 3.8) : (idleBreath * 0.8);
      const canterPitch = moving ? (Math.sin(runPhase) * 0.065) : (idleBreath * 0.008);
      const totalHorsePitch = canterPitch + (pose.horsePitch || 0);

      const hindSwing = moving ? (Math.sin(runPhase - 0.65) * 0.32) : 0;
      const hindLift = moving ? (Math.max(0, -Math.cos(runPhase - 0.65)) * 2.6) : 0;
      const foreSwing = moving ? (Math.sin(runPhase + 0.85) * 0.34) : (pose.horsePitch < -0.02 ? -0.22 : 0);
      const foreLift = moving ? (Math.max(0, Math.sin(runPhase + 0.85)) * 3.2) : (pose.horsePitch < -0.02 ? 3.5 : 0);

      // 1. 战马后腿（绕后髋关节蓄力蹬地）
      ctx.save();
      ctx.translate(-w * 0.20, hipY + boundY * 0.55 - hindLift);
      ctx.rotate(hindSwing);
      ctx.drawImage(img, 0, syLeg, Math.floor(iw * 0.5), ih - syLeg, -w * 0.30, -2, w * 0.5, dhLeg + 2);
      ctx.restore();

      // 2. 战马前腿（绕前肩关节高抬前踏）
      ctx.save();
      ctx.translate(w * 0.20, hipY + boundY * 0.55 - foreLift);
      ctx.rotate(foreSwing);
      ctx.drawImage(img, Math.floor(iw * 0.5), syLeg, iw - Math.floor(iw * 0.5), ih - syLeg, -w * 0.20, -2, w * 0.5, dhLeg + 2);
      ctx.restore();

      // 3. 战马头颈胸腹躯干（随三拍马步俯仰腾跃）
      ctx.save();
      ctx.translate(moving ? Math.cos(runPhase) * 1.1 : 0, boundY);
      ctx.rotate(totalHorsePitch);
      ctx.drawImage(
        img,
        0, syHorseStart, iw, Math.min(ih - syHorseStart, syLeg - syHorseStart + 4),
        -w / 2, baseTopY + dhHorseStart, w, (dhLegTop - dhHorseStart) + 3
      );

      // 4. 马背骑手上半身与披风头翎（带马鞍滞后缓冲 + 独立拉弓/挥扇/劈刺倾角！）
      const riderLag = moving ? Math.sin(runPhase - 0.55) : idleBreath * 0.4;
      ctx.save();
      ctx.translate(0, baseTopY + dhRider);
      ctx.translate(riderLag * 0.9, (moving ? Math.abs(riderLag) * 1.2 : idleBreath * 0.6));
      ctx.rotate((moving ? 0.038 + riderLag * 0.028 : 0) + (pose.riderPitch || 0));
      ctx.drawImage(
        img,
        0, 0, iw, Math.min(ih, syRiderEnd + 4),
        -w / 2, -dhRider, w, dhRider + 3
      );
      ctx.restore();
      ctx.restore();
    } else {
      // ================= 步战兵种双足骨骼（抬靴迈步 + 躯干前倾 + 待机呼吸） =================
      const splitRatio = 0.69;
      const syLeg = Math.floor(ih * splitRatio);
      const legSrcH = ih - syLeg;
      const dhTop = h * splitRatio;
      const dhLeg = h - dhTop;
      const hipY = baseTopY + dhTop;

      const idleBreath = Math.sin(time * 3.1 + uid * 2.1);
      const stepBob = moving ? (-Math.abs(Math.sin(runPhase)) * 2.5) : (idleBreath * 0.6);
      const swing = moving ? (Math.sin(runPhase) * 0.30) : 0;
      const liftL = moving ? (Math.max(0, -Math.sin(runPhase)) * 2.3) : 0;
      const liftR = moving ? (Math.max(0, Math.sin(runPhase)) * 2.3) : 0;

      // 1. 后脚绕髋摆动并离地抬靴
      ctx.save();
      ctx.translate(-w * 0.16, hipY + stepBob * 0.4 - liftL);
      ctx.rotate(-swing);
      ctx.drawImage(img, 0, syLeg, Math.floor(iw * 0.5), legSrcH, -w * 0.34, -1, w * 0.5, dhLeg + 1);
      ctx.restore();

      // 2. 前脚反向跨步抬靴
      ctx.save();
      ctx.translate(w * 0.16, hipY + stepBob * 0.4 - liftR);
      ctx.rotate(swing);
      ctx.drawImage(img, Math.floor(iw * 0.5), syLeg, iw - Math.floor(iw * 0.5), legSrcH, -w * 0.16, -1, w * 0.5, dhLeg + 1);
      ctx.restore();

      // 3. 步卒上半身协调摆臂/蓄力拉弓/挥刀突刺
      ctx.save();
      ctx.translate(moving ? Math.sin(runPhase) * 1.1 : 0, hipY + stepBob);
      ctx.rotate((moving ? 0.05 + Math.cos(runPhase * 2) * 0.02 : 0) + (pose.riderPitch || 0));
      ctx.scale(1 - (!moving ? idleBreath * 0.01 : 0), 1 + (!moving ? idleBreath * 0.018 : 0));
      ctx.drawImage(img, 0, 0, iw, Math.min(ih, syLeg + 4), -w / 2, -dhTop, w, dhTop + 3);
      ctx.restore();
    }

    ctx.filter = 'none';
    ctx.restore();
  }

  // ★ 1. 专属【弯弓搭箭·拉弦满月】动态动作特效层（清晰呈现弓身弯曲、弓弦回拉、箭矢上弦与崩弦余振！）
  function drawBowActionOverlay(ctx, u, pose, isGeneral) {
    if (!pose.active) return;
    const bx = isGeneral ? 18 : 13;
    const by = isGeneral ? -49 : -27;
    const bowR = isGeneral ? 18 : 13;
    const pull = pose.bowPull * (isGeneral ? 16 : 12);
    const vib = pose.stringVib || 0;
    const isJadeBow = u.spriteKey === 'unit_gen_female';

    ctx.save();
    ctx.translate(bx, by);

    // 弹性反曲良弓弓臂（随拉弦深度自然弯曲）
    const bend = pose.bowPull * 3.5;
    ctx.strokeStyle = isJadeBow ? '#34d399' : (isGeneral ? '#f59e0b' : '#92400e');
    ctx.lineWidth = isGeneral ? 3.0 : 2.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2 - bend, -bowR);
    ctx.quadraticCurveTo(9 + bend * 0.5, 0, -2 - bend, bowR);
    ctx.stroke();

    // 金色弓弰护口
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-2 - bend, -bowR); ctx.lineTo(-4 - bend, -bowR - 2);
    ctx.moveTo(-2 - bend, bowR); ctx.lineTo(-4 - bend, bowR + 2);
    ctx.stroke();

    // 紧绷双段动态弓弦（蓄力时向后拉成锐角，离弦后高频余振）
    const nockX = -2 - bend - pull + vib;
    ctx.strokeStyle = 'rgba(254, 249, 195, 0.92)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-2 - bend, -bowR);
    ctx.lineTo(nockX, 0);
    ctx.lineTo(-2 - bend, bowR);
    ctx.stroke();

    // 蓄力阶段(p < 0.45)：弓弦上清晰搭着一支蓄势待发的雕翎利箭 + 箭簇聚力寒芒！
    if (pose.p < 0.45) {
      const arrowLen = isGeneral ? 26 : 19;
      const tipX = nockX + arrowLen;
      // 箭杆
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = isGeneral ? 2.1 : 1.7;
      ctx.beginPath();
      ctx.moveTo(nockX, 0);
      ctx.lineTo(tipX, 0);
      ctx.stroke();
      // 赤红雕翎箭羽
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(nockX + 4, 0); ctx.lineTo(nockX - 1, -3.5);
      ctx.moveTo(nockX + 4, 0); ctx.lineTo(nockX - 1, 3.5);
      ctx.stroke();
      // 破甲精钢箭簇
      ctx.fillStyle = isGeneral ? '#fde047' : '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(tipX + 6, 0);
      ctx.lineTo(tipX - 1, -3.5);
      ctx.lineTo(tipX - 1, 3.5);
      ctx.closePath();
      ctx.fill();

      // 满弓瞬间箭尖寒星闪耀
      if (pose.bowPull > 0.55) {
        const gl = (pose.bowPull - 0.55) / 0.45;
        ctx.strokeStyle = isJadeBow ? '#6ee7b7' : '#fef08a';
        ctx.globalAlpha = gl * 0.9;
        ctx.lineWidth = 1.5;
        const sr = (isGeneral ? 8 : 5.5) * gl;
        ctx.beginPath();
        ctx.moveTo(tipX + 4 - sr, 0); ctx.lineTo(tipX + 4 + sr, 0);
        ctx.moveTo(tipX + 4, -sr); ctx.lineTo(tipX + 4, sr);
        ctx.stroke();
      }
    } else if (pose.strikeFlash > 0) {
      // 离弦瞬间破空白色气浪环
      ctx.globalAlpha = pose.strikeFlash * 0.85;
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(6, 0, 4, (1 - pose.strikeFlash * 0.4) * bowR * 0.9, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ★ 2. 专属【方士/谋士挥扇施法】动态动作特效层（五明灵光羽扇扬起聚气 -> 130度流光扇面挥洒！）
  function drawFanActionOverlay(ctx, u, pose, isGeneral, time) {
    const px = isGeneral ? 12 : 10;
    const py = isGeneral ? -50 : -34;
    const fanLen = isGeneral ? 20 : 15;
    const isPurple = u.isMagic || (u.cfg && u.cfg.skillElement === 'shadow');
    const mainCol = isPurple ? '#c084fc' : '#2dd4bf';
    const coreCol = isPurple ? '#f5d0fe' : '#ccfbf1';

    ctx.save();
    ctx.translate(px, py);

    // 挥扇瞬间的丝绸流光扇弧残影
    if (pose.active && pose.fanSweepAlpha > 0.05) {
      ctx.save();
      ctx.globalAlpha = pose.fanSweepAlpha * 0.58;
      const sweepGrad = ctx.createRadialGradient(0, 0, 6, 0, 0, fanLen + 18);
      sweepGrad.addColorStop(0, 'rgba(255,255,255,0)');
      sweepGrad.addColorStop(0.55, mainCol);
      sweepGrad.addColorStop(1, coreCol);
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, fanLen + 18, -1.35, pose.fanAngle, false);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 待机微摇羽扇 / 施法大幅扬扇挥落
    const ang = pose.active ? pose.fanAngle : (-0.45 + Math.sin(time * 3.4 + (u.uid || 1)) * 0.14);
    ctx.save();
    ctx.rotate(ang);

    // 乌木鎏金扇柄
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(fanLen * 0.42, 0);
    ctx.stroke();

    // 五明灵羽扇叶（5片层叠白羽镶青紫灵光）
    for (let i = -2; i <= 2; i++) {
      ctx.save();
      ctx.rotate(i * 0.19);
      ctx.fillStyle = i % 2 === 0 ? coreCol : mainCol;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(fanLen * 0.68, 0, fanLen * 0.44, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 蓄力聚气时羽扇顶端凝聚旋转灵符法球
    if (pose.active && pose.p < 0.44) {
      const charge = pose.p / 0.40;
      ctx.globalAlpha = Math.min(1, charge);
      ctx.fillStyle = mainCol;
      ctx.beginPath();
      ctx.arc(fanLen + 4, 0, 5.5 * charge, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(fanLen + 4, 0, 2.5 * charge, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  }

  // ★ 3. 专属【近战挥砍 / 长枪突刺】兵器与刀罡轨迹层（告别生硬单线条圆弧！）
  function drawMeleeActionOverlay(ctx, u, pose, wTpl, isGeneral) {
    const style = u.atkStyle || 'cleave';
    const handX = isGeneral ? 16 : 10;
    const handY = isGeneral ? -38 : -22;

    if (wTpl && isGeneral) {
      ctx.save();
      ctx.translate(handX, handY);
      if (style === 'thrust') {
        const thrustX = pose.active ? pose.meleeSwing * 16 : 0;
        ctx.translate(thrustX, 0);
        ctx.rotate(-0.08);
      } else {
        ctx.rotate(-0.32 + (pose.active ? pose.meleeSwing * 0.85 : 0));
      }
      ctx.strokeStyle = wTpl.id === 'fangtian_halberd' ? '#991b1b' : '#78350f';
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(-18, 12); ctx.lineTo(28, -20); ctx.stroke();
      ctx.fillStyle = wTpl.bladeColor || '#fde047';
      ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(22, -15); ctx.lineTo(40, -30); ctx.lineTo(30, -10); ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (wTpl.weaponShape === 'halberd_gold') {
        ctx.strokeStyle = '#fde047'; ctx.lineWidth = 2.8;
        ctx.beginPath(); ctx.arc(24, -17, 9, -Math.PI * 0.85, Math.PI * 0.35); ctx.stroke();
      } else if (wTpl.weaponShape === 'sword_cyan') {
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(8, -10); ctx.lineTo(16, 0); ctx.stroke();
      }
      ctx.restore();
    }

    if (!pose.active || pose.strikeFlash <= 0.04) return;

    ctx.save();
    ctx.globalAlpha = Math.min(1, pose.strikeFlash * 1.15);
    const glowCol = wTpl ? (wTpl.glowColor || '#fde047') : (u.side === 'player' ? '#fef08a' : '#fca5a5');

    if (style === 'thrust') {
      // 破空直刺枪芒：细长锐利银白枪影 + 破风气环
      const len = isGeneral ? 56 : 38;
      ctx.translate(handX + 6, handY + 2);
      ctx.fillStyle = glowCol;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(len, 0);
      ctx.lineTo(-6, 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -1.8);
      ctx.lineTo(len + 6, 0);
      ctx.lineTo(0, 1.8);
      ctx.closePath();
      ctx.fill();
    } else {
      // 渐变宽肚尖尾新月刀光（非等宽生硬圆线！）
      const r = isGeneral ? 38 : 23;
      ctx.translate(handX, handY);
      ctx.fillStyle = glowCol;
      ctx.beginPath();
      ctx.arc(0, 0, r, -1.10, 0.95, false);
      ctx.arc(-5, 1, r * 0.84, 0.95, -1.10, true);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(1, 0, r * 0.96, -0.85, 0.72, false);
      ctx.arc(-3, 0, r * 0.87, 0.72, -0.85, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // 1. 温润护眼横版古风沙场背景地图（采用原画级旷野与峡谷关隘底图，彻底移除刺眼变色滤镜！）
  function drawBattlefieldTerrain(ctx, battle, viewX, viewW, time) {
    const ch = battle.chapter || 1;
    const theme = battle.chapterTheme || (App.Config.getChapterMapTheme ? App.Config.getChapterMapTheme(ch) : null);
    const preferCanyon = (theme && theme.battleKey === 'bg_battle_canyon') || battle.biome === 'canyon';
    const bgImg = (preferCanyon && App.Assets.get('bg_battle_canyon')) || App.Assets.get('bg_battle');
    const tileW = 960;
    const tileH = 425;

    if (bgImg) {
      ctx.save();
      if (theme && theme.flipX) {
        ctx.save();
        ctx.translate(tileW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(bgImg, 0, 0, tileW, tileH);
        ctx.restore();
        ctx.drawImage(bgImg, tileW, 0, tileW, tileH);
      } else {
        ctx.drawImage(bgImg, 0, 0, tileW, tileH);
        ctx.save();
        ctx.translate(tileW * 2, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(bgImg, 0, 0, tileW, tileH);
        ctx.restore();
      }
      if (theme && theme.tint) {
        ctx.fillStyle = theme.tint;
        ctx.fillRect(viewX, 0, viewW, tileH);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = '#d4a359';
      ctx.fillRect(viewX, 0, viewW, tileH);
    }

    // 仅在当前无随机自然灾害激活时绘制冰原飘雪，严防雪花与暴雨/风沙/狂风同时叠加！
    if (battle.biome === 'snow' && !battle.activeDisaster) {
      ctx.save();
      ctx.fillStyle = 'rgba(186, 230, 253, 0.22)';
      ctx.fillRect(viewX, 0, viewW, tileH);
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      for (let i = 0; i < 18; i++) {
        const sx = viewX + ((i * 89 + time * 45) % viewW);
        const sy = (i * 53 + time * 55) % 390;
        ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // 绘制手绘精细【伐木营】与【军粮仓】精灵！
    drawBuildingSprite(ctx, 'building_lumber', 66, 214, 78, '伐木营 +10/2s', '#fde047');
    drawBuildingSprite(ctx, 'building_granary', 66, 368, 82, '军粮仓 +10/2s', '#86efac');

    // 绘制手绘精细【中军金矿】精灵！
    const node = battle.centerNode;
    if (node) {
      const isPlayer = node.owner === 'player';
      drawBuildingSprite(
        ctx, 'building_goldmine', node.x, node.y + 12, 92,
        isPlayer ? '★已占中军矿(+12木粮/2s)' : '中军辎重矿(推进占领)',
        isPlayer ? '#4ade80' : '#fef08a',
        isPlayer ? '#22c55e' : null
      );
    }

    // 地面预警圈
    (battle.aoeZones || []).forEach((z) => {
      if (z.isVisualBurst) return;
      ctx.save();
      const pulse = 1 - z.timer / z.maxTimer;
      ctx.strokeStyle = z.color || '#ef4444';
      ctx.fillStyle = z.fill || 'rgba(239, 68, 68, 0.25)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.radius, z.radius * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.radius * pulse, z.radius * 0.42 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
      if (z.label) {
        ctx.font = 'bold 12px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fef08a';
        ctx.fillText(z.label, z.x, z.y - 6);
      }
      ctx.restore();
    });
  }

  function drawBuildingSprite(ctx, key, x, y, w, label, txtCol, ringCol) {
    const spr = App.Assets.get(key);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.32)';
    ctx.beginPath(); ctx.ellipse(x, y + 4, w * 0.44, 11, 0, 0, Math.PI * 2); ctx.fill();
    if (ringCol) {
      ctx.strokeStyle = ringCol;
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }
    if (spr) {
      const h = (spr.height / spr.width) * w;
      ctx.drawImage(spr, x - w / 2, y - h + 8, w, h);
      ctx.font = 'bold 10px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2.8;
      ctx.strokeText(label, x, y - h + 2);
      ctx.fillStyle = txtCol;
      ctx.fillText(label, x, y - h + 2);
    }
    ctx.restore();
  }

  function drawWatchTower(ctx, t) {
    const x = t.x, y = t.y;
    const spr = App.Assets.get('tower_sprite');
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath(); ctx.ellipse(x, y + 6, 36, 12, 0, 0, Math.PI * 2); ctx.fill();
    if (spr) {
      const w = 96;
      const h = (spr.height / spr.width) * w;
      if (t.hitFlash > 0) ctx.filter = 'brightness(1.65)';
      ctx.drawImage(spr, x - w / 2, y - h + 10, w, h);
      ctx.filter = 'none';
    }
    App.UI.drawBar(ctx, x - 28, y - 104, 56, 7, t.hp / t.maxHp, '#ef4444');
    ctx.restore();
  }

  function drawMountedGeneral(ctx, u, time) {
    const facing = u.facing || (u.side === 'player' ? 1 : -1);
    const eq = u.equips || {};
    const spr = App.Assets.get(u.spriteKey) || App.Assets.get('unit_gen_silver');
    const pose = computeAttackPose(u);
    const style = u.atkStyle || 'cleave';

    const wTpl = eq.weapon ? App.Config.EQUIP_TEMPLATES[eq.weapon.tplId] : null;
    const mTpl = eq.mount ? App.Config.EQUIP_TEMPLATES[eq.mount.tplId] : null;
    const aTpl = eq.armor ? App.Config.EQUIP_TEMPLATES[eq.armor.tplId] : null;
    const hTpl = eq.helm ? App.Config.EQUIP_TEMPLATES[eq.helm.tplId] : null;
    const jTpl = eq.jade ? App.Config.EQUIP_TEMPLATES[eq.jade.tplId] : null;
    const bTpl = eq.book ? App.Config.EQUIP_TEMPLATES[eq.book.tplId] : null;

    const shadowScale = u.moving ? (1 - Math.abs(Math.sin(u.runPhase)) * 0.12) : 1;

    ctx.save();
    ctx.translate(u.x + pose.lungeX * facing + (u.knockX || 0), u.y);
    if (u.scale) ctx.scale(u.scale, u.scale); // 魔将等巨型单位

    // 脚底阵营圈 + 随马步腾跃呼吸缩放的物理投影 + 坐骑/宝玉光效
    ctx.save();
    ctx.fillStyle = u.side === 'player' ? 'rgba(34, 197, 94, 0.28)' : 'rgba(239, 68, 68, 0.30)';
    ctx.beginPath(); ctx.ellipse(0, 5, 30 * shadowScale, 10 * shadowScale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = u.side === 'player' ? '#4ade80' : '#f87171';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    if (jTpl || bTpl) {
      ctx.strokeStyle = (jTpl && jTpl.auraRing) || (bTpl && bTpl.auraRing) || '#fde047';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([7, 4]);
      ctx.beginPath(); ctx.ellipse(0, 5, 39, 13, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    if (mTpl) {
      ctx.strokeStyle = mTpl.mountTrail || '#f97316';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 5, 25 * shadowScale, 8.5 * shadowScale, 0, 0, Math.PI * 2); ctx.stroke();
      if (mTpl.id === 'chitu' || mTpl.id === 'dilu') {
        for (let i = 0; i < 3; i++) {
          const px = -facing * (14 + i * 9) + Math.sin(time * 12 + i) * 3;
          ctx.fillStyle = mTpl.mountTrail;
          ctx.globalAlpha = 0.65 - i * 0.18;
          ctx.beginPath(); ctx.arc(px, 4 - i * 3, 4.5 - i, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();

    ctx.save();
    ctx.scale(facing, 1);

    if (aTpl) {
      ctx.save();
      ctx.strokeStyle = aTpl.armorAura || '#facc15';
      ctx.fillStyle = aTpl.id === 'dragon_armor' ? 'rgba(250, 204, 21, 0.18)' : 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, -38, 28, 34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    const w = 92;
    const h = spr ? (spr.height / spr.width) * w : 92;
    drawArticulatedSprite(ctx, spr, w, h, u.moving, u.runPhase, u.hitFlash, {
      isMounted: u.isMounted !== false,
      pose,
      time: time || 0,
      uid: u.uid,
    });

    if (hTpl) {
      ctx.save();
      ctx.fillStyle = hTpl.helmCrest || '#c084fc';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-6, -h + 14); ctx.lineTo(0, -h + 2); ctx.lineTo(6, -h + 14);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // ★ 按武将战斗风格渲染专属动态动作（拉弓满月 / 挥动五明灵羽扇 / 蓄势突刺或宽刃劈斩！）
    if (style === 'bow') {
      drawBowActionOverlay(ctx, u, pose, true);
    } else if (style === 'fan') {
      drawFanActionOverlay(ctx, u, pose, true, time || 0);
    } else {
      drawMeleeActionOverlay(ctx, u, pose, wTpl, true);
    }
    ctx.restore();

    const topY = -88;
    const eqItems = Object.values(eq);
    if (eqItems.length > 0) {
      const iconSz = 16, gap = 2;
      let startX = -(eqItems.length * iconSz + (eqItems.length - 1) * gap) / 2;
      eqItems.forEach((item) => {
        drawEquipIcon(ctx, item.tplId, startX, topY - 34, iconSz, { radius: 3, lineWidth: 1.2 });
        startX += iconSz + gap;
      });
    }

    if (u.stunTimer > 0) {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★眩晕', 0, topY - 38);
    }

    App.UI.drawBar(ctx, -28, topY, 56, 6.5, u.hp / u.maxHp, u.side === 'player' ? '#22c55e' : '#ef4444');
    const mountTag = mTpl ? `·${mTpl.mountName}` : '';
    const label = `${u.name}${mountTag} ${Math.ceil(u.hp)}`;
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(label, 0, topY - 4);
    ctx.fillStyle = u.isBoss ? '#fde047' : '#ffffff';
    ctx.fillText(label, 0, topY - 4);
    ctx.restore();
  }

  // ★ 秘境副本战场高清实体精灵绘制器（宝箱车 / 皇陵金矿 / 木牛流马 / 帅帐大营 / 龙头冲车，彻底移除丑陋方框与Emoji！）
  function drawProp(ctx, u, time) {
    const t = time || 0;
    let sprKey = u.propSprite;
    if (!sprKey) {
      if (u.isCart || String(u.name).includes('木牛')) sprKey = 'prop_wooden_ox';
      else if (u.isBase || String(u.name).includes('帅帐')) sprKey = 'prop_command_tent';
      else if (u.isRam || String(u.name).includes('冲车')) sprKey = 'prop_siege_ram';
      else if (String(u.name).includes('矿')) sprKey = 'building_goldmine';
      else sprKey = 'prop_treasure_cart';
    }
    const spr = App.Assets && App.Assets.get(sprKey);
    const sz = u.isBase ? 124 : (u.isCart || u.isRam ? 104 : 88);
    const isMoving = !!(u.moving || u.isCart || u.isRam);
    const bob = isMoving ? Math.abs(Math.sin(t * 8.5 + (u.uid || 0))) * 2.6 : 0;
    const tilt = isMoving ? Math.sin(t * 8.5 + (u.uid || 0)) * 0.025 : 0;

    ctx.save();
    ctx.translate(u.x + (u.knockX || 0), u.y);

    // 地面自然接触椭圆阴影 + 阵营/宝物微光圈
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 4, sz * 0.42, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = u.side === 'player' ? 'rgba(74, 222, 128, 0.55)' : 'rgba(250, 204, 21, 0.50)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 4, sz * 0.44, 12, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 绘制手绘透明底高清物件精灵
    ctx.save();
    ctx.translate(0, -bob);
    ctx.rotate(tilt);
    if (u.hitFlash > 0 && typeof ctx.filter === 'string') {
      ctx.filter = 'brightness(1.65) contrast(1.15)';
    }
    if (spr) {
      ctx.drawImage(spr, -sz / 2, -sz + 10, sz, sz);
    } else {
      ctx.fillStyle = '#78350f';
      ctx.beginPath(); ctx.arc(0, -sz * 0.42, sz * 0.32, 0, Math.PI * 2); ctx.fill();
    }
    if (typeof ctx.filter === 'string') ctx.filter = 'none';
    ctx.restore();

    // 皇陵秘宝与金矿闪烁金星微光
    if (u.isLoot) {
      const tw = 0.45 + 0.55 * Math.abs(Math.sin(t * 5 + (u.uid || 0) * 1.7));
      ctx.save();
      ctx.globalAlpha = tw;
      ctx.fillStyle = '#fef08a';
      const gx = Math.sin((u.uid || 1) * 2.3 + Math.floor(t * 2)) * 18;
      const gy = -sz * 0.58;
      ctx.beginPath();
      ctx.moveTo(gx, gy - 6); ctx.lineTo(gx + 2, gy - 2); ctx.lineTo(gx + 6, gy);
      ctx.lineTo(gx + 2, gy + 2); ctx.lineTo(gx, gy + 6); ctx.lineTo(gx - 2, gy + 2);
      ctx.lineTo(gx - 6, gy); ctx.lineTo(gx - 2, gy - 2);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // 头顶血条与古风描边名称
    const barW = Math.max(58, sz * 0.68);
    const topY = -sz + 4;
    App.UI.drawBar(ctx, -barW / 2, topY, barW, 6.5, u.hp / u.maxHp, u.side === 'player' ? '#22c55e' : '#f59e0b', '#1c1917');
    ctx.font = 'bold 11px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#090402';
    ctx.lineWidth = 3;
    ctx.strokeText(u.name, 0, topY - 5);
    ctx.fillStyle = u.side === 'player' ? '#bbf7d0' : '#fef08a';
    ctx.fillText(u.name, 0, topY - 5);
    ctx.restore();
  }

  function drawSoldierSprite(ctx, u, time) {
    const facing = u.facing || (u.side === 'player' ? 1 : -1);
    const spr = App.Assets.get(u.spriteKey) || App.Assets.get('unit_infantry');
    const isCav = u.unitType === 'cavalry';
    const isMounted = !!u.isMounted;
    const isPike = u.id === 'pike';
    const style = u.atkStyle || 'cleave';
    const pose = computeAttackPose(u);
    const shadowScale = u.moving ? (1 - Math.abs(Math.sin(u.runPhase)) * 0.12) : 1;

    ctx.save();
    ctx.translate(u.x + pose.lungeX * facing + (u.knockX || 0), u.y);

    ctx.fillStyle = u.side === 'player' ? 'rgba(37, 99, 235, 0.34)' : 'rgba(220, 38, 38, 0.36)';
    ctx.beginPath();
    ctx.ellipse(0, 4, (isMounted ? 22 : 15) * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.scale(facing, 1);

    const w = isMounted ? 66 : (isPike ? 58 : 48);
    const h = spr ? (spr.height / spr.width) * w : 48;
    drawArticulatedSprite(ctx, spr, w, h, u.moving, u.runPhase, u.hitFlash, {
      isMounted,
      pose,
      time: time || 0,
      uid: u.uid,
    });

    // ★ 按兵种专属动作绘制：神射弓兵拉弦射箭、玄术方士挥动灵扇、精锐枪/铁甲骑突刺、刀盾步挥刀！
    if (style === 'bow') {
      drawBowActionOverlay(ctx, u, pose, false);
    } else if (style === 'fan') {
      drawFanActionOverlay(ctx, u, pose, false, time || 0);
    } else {
      drawMeleeActionOverlay(ctx, u, pose, null, false);
    }
    ctx.restore();

    const barY = isMounted ? -62 : -50;
    App.UI.drawBar(ctx, -15, barY, 30, 4.5, u.hp / u.maxHp, u.side === 'player' ? '#4ade80' : '#f87171');
    ctx.restore();
  }

  function drawGiantBeastSprite(ctx, u, time) {
    const facing = u.facing || (u.side === 'player' ? 1 : -1);
    const bCfg = App.Config.BEASTS[u.id] || App.Config.BEASTS.baihu;
    const spr = App.Assets.get('beast_sprite_' + u.id);
    const eq = u.equips || {};
    const clawTpl = eq.beast_claw ? App.Config.EQUIP_TEMPLATES[eq.beast_claw.tplId] : null;
    const scaleTpl = eq.beast_scale ? App.Config.EQUIP_TEMPLATES[eq.beast_scale.tplId] : null;
    const hornTpl = eq.beast_horn ? App.Config.EQUIP_TEMPLATES[eq.beast_horn.tplId] : null;
    const coreTpl = eq.beast_core ? App.Config.EQUIP_TEMPLATES[eq.beast_core.tplId] : null;

    const isFlyer = u.id === 'qinglong' || u.id === 'zhuque';
    const hover = isFlyer ? 10 + Math.sin(time * 3.5 + u.uid) * 5 : 0;
    const pose = computeAttackPose(u);
    const lungeX = pose.lungeX * 1.3 * facing;

    ctx.save();
    ctx.translate(u.x + lungeX + (u.knockX || 0), u.y);

    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath(); ctx.ellipse(0, 6, 54, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = bCfg.glow;
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.ellipse(0, 6, 58 + Math.sin(time * 5) * 4, 18, 0, 0, Math.PI * 2); ctx.stroke();

    // 穿戴【灵鳞】时：脚下与周身浮现护体玄鳞光阵
    if (scaleTpl) {
      ctx.save();
      ctx.strokeStyle = scaleTpl.scaleAura || '#4ade80';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([8, 5]);
      ctx.beginPath(); ctx.ellipse(0, 6, 68, 22, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(250, 204, 21, 0.12)';
      ctx.beginPath(); ctx.ellipse(0, -52 - hover, 58, 48, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(0, -hover);
    ctx.scale(facing * pose.scaleX, pose.scaleY);
    ctx.rotate(pose.riderPitch * 0.8);

    const w = 146;
    const h = spr ? (spr.height / spr.width) * w : 130;
    if (isFlyer) {
      if (spr) {
        if (u.hitFlash > 0) ctx.filter = 'brightness(1.8)';
        const wingBob = Math.sin(time * 6 + u.uid) * 2.5;
        ctx.drawImage(spr, -w / 2, -h + 14 + wingBob, w, h - wingBob * 0.5);
        ctx.filter = 'none';
      }
    } else {
      drawArticulatedSprite(ctx, spr, w, h, u.moving, u.runPhase, u.hitFlash, {
        isMounted: true,
        pose,
        time: time || 0,
        uid: u.uid,
      });
    }

    // 穿戴【兽角/翎冠】时：头顶神辉王冠印记
    if (hornTpl) {
      ctx.save();
      ctx.fillStyle = hornTpl.hornColor || '#fde047';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-10, -h + 16); ctx.lineTo(0, -h - 2); ctx.lineTo(10, -h + 16);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }

    // 穿戴【兽爪】时：强化暴烈三道撕裂金爪弧光！
    if (pose.strikeFlash > 0.1) {
      ctx.globalAlpha = Math.min(1, pose.strikeFlash * 1.2);
      ctx.strokeStyle = clawTpl ? (clawTpl.clawColor || '#facc15') : bCfg.glow;
      ctx.lineWidth = clawTpl ? 5.8 : 4.2;
      ctx.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(32, -62 + k * 15);
        ctx.quadraticCurveTo(62, -52 + k * 15, 88, -28 + k * 15);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // 穿戴【内丹】时：环绕神兽周身旋转的流光妖丹/圣丹！
    if (coreTpl) {
      const orbAng = time * 3.6;
      const ox = Math.cos(orbAng) * 58;
      const oy = -52 - hover + Math.sin(orbAng) * 18;
      ctx.save();
      ctx.fillStyle = coreTpl.orbColor || '#fde047';
      ctx.shadowColor = coreTpl.orbColor || '#fde047';
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(ox, oy, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ox - 2, oy - 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // 头顶实时展示神兽已穿戴的【兽装小图标徽章】！
    const eqItems = Object.values(eq);
    if (eqItems.length > 0) {
      const iconSz = 17, gap = 3;
      let startX = -(eqItems.length * iconSz + (eqItems.length - 1) * gap) / 2;
      eqItems.forEach((item) => {
        drawEquipIcon(ctx, item.tplId, startX, -152, iconSz, { radius: 3, lineWidth: 1.2 });
        startX += iconSz + gap;
      });
    }

    App.UI.drawBar(ctx, -44, -122, 88, 8, u.hp / u.maxHp, u.side === 'player' ? '#22c55e' : '#ef4444');
    App.UI.drawBar(ctx, -44, -112, 88, 4, (u.rage || 0) / 100, bCfg.glow);
    ctx.font = 'bold 12px "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    const lvLabel = u.lv ? `Lv.${u.lv} ${bCfg.name}` : bCfg.name;
    ctx.strokeText(`${lvLabel} ${Math.ceil(u.hp)}`, 0, -128);
    ctx.fillStyle = bCfg.glow;
    ctx.fillText(`${lvLabel} ${Math.ceil(u.hp)}`, 0, -128);
    ctx.restore();
  }

  /**
   * ★ 10 大截然不同实体造型技能渲染器（含 5 种震撼全屏大招 + 5 种召唤/巨兵/贯通/龙卷/锁阵实体动画，绝非换色圆圈！）
   */
  function drawSkillEffect(ctx, fx, viewX, viewW) {
    if (App.SkillVFX && App.SkillVFX.render) {
      App.SkillVFX.render(ctx, fx, viewX, viewW);
    }
  }

  // ★ 战场全屏自然灾害视觉特效层（狂风 / 暴雨 / 冰雹 / 瘟疫 / 风沙）
  function drawDisasterOverlay(ctx, battle, viewX, viewW, time) {
    const dis = battle.activeDisaster;
    if (!dis) return;
    const H = 418;

    ctx.save();
    ctx.fillStyle = dis.tint || 'rgba(0,0,0,0.12)';
    ctx.fillRect(viewX, 0, viewW, H);

    if (dis.id === 'gale') {
      // 狂风：高速逆向气流风刃条纹
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.58)';
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 22; i++) {
        const gx = viewX + viewW - ((time * 620 + i * 97) % (viewW + 140));
        const gy = 55 + ((i * 53) % 340);
        ctx.beginPath();
        ctx.moveTo(gx, gy);
        ctx.quadraticCurveTo(gx + 42, gy - 8, gx + 88, gy - 2);
        ctx.stroke();
      }
    } else if (dis.id === 'rain') {
      // 暴雨：密集斜织银蓝雨幕 + 地面水花涟漪
      ctx.strokeStyle = 'rgba(147, 197, 253, 0.65)';
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 48; i++) {
        const rx = viewX + ((i * 67 - time * 240 + 9600) % viewW);
        const ry = (time * 540 + i * 43) % H;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 10, ry + 22);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(191, 219, 254, 0.45)';
      for (let r = 0; r < 10; r++) {
        const px = viewX + ((r * 113 + Math.floor(time * 4) * 37) % viewW);
        const py = 210 + ((r * 41) % 185);
        const rr = ((time * 3 + r * 0.3) % 1) * 14;
        ctx.beginPath();
        ctx.ellipse(px, py, rr, rr * 0.38, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (dis.id === 'hail') {
      // 冰雹：硕大晶莹冰雹急速坠地
      for (let i = 0; i < 26; i++) {
        const hx = viewX + ((i * 83 - time * 150 + 9600) % viewW);
        const hy = (time * 430 + i * 59) % H;
        ctx.fillStyle = '#e0f2fe';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(hx, hy, 4.2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (dis.id === 'plague') {
      // 瘟疫：惨绿紫黑毒瘴浓雾漂浮与毒泡升腾
      for (let i = 0; i < 8; i++) {
        const mx = viewX + ((i * 155 + time * 32) % (viewW + 120)) - 60;
        const my = 185 + ((i * 37) % 190);
        const g = ctx.createRadialGradient(mx, my, 8, mx, my, 82);
        g.addColorStop(0, 'rgba(132, 204, 22, 0.32)');
        g.addColorStop(0.6, 'rgba(107, 33, 168, 0.18)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx, my, 82, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(190, 242, 100, 0.68)';
      for (let b = 0; b < 18; b++) {
        const bx = viewX + ((b * 79) % viewW);
        const by = 390 - ((time * 65 + b * 31) % 210);
        ctx.beginPath();
        ctx.arc(bx, by, 2.8 + (b % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (dis.id === 'sandstorm') {
      // 风沙：漫天黄沙席卷视野
      ctx.fillStyle = 'rgba(253, 224, 71, 0.55)';
      for (let i = 0; i < 42; i++) {
        const sx = viewX + viewW - ((time * 520 + i * 73) % (viewW + 80));
        const sy = 50 + ((i * 39 + Math.sin(time * 4 + i) * 18 + 400) % 355);
        ctx.beginPath();
        ctx.ellipse(sx, sy, 6 + (i % 4) * 3, 2, -0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawDyingUnit(ctx, d) {
    const p = 1 - d.dieTimer / d.maxDie;
    const facing = d.facing || 1;
    const spr = App.Assets.get(d.spriteKey);
    if (!spr) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - p);
    ctx.translate(d.x - facing * p * 14, d.y);
    ctx.scale(facing, 1);
    ctx.rotate(-p * 1.35);
    const w = d.kind === 'beast' ? 124 : (d.kind === 'general' ? 86 : 46);
    const h = (spr.height / spr.width) * w;
    ctx.drawImage(spr, -w / 2, -h + 8, w, h);
    ctx.restore();
  }

  /**
   * ★ 高精度物理弹道飞行物 & 刀光枪芒渲染器
   * 包含：抛物线切线对齐雕翎羽箭、名将穿云神箭、箭塔烈火弩箭、羽扇半月罡风灵刃、渐变新月刀光、破空枪芒与命中气环！
   */
  function drawProjectile(ctx, p, time) {
    if (!p) return;

    // 1. 真实飞行弹道类（羽箭 / 烈火箭 / 羽扇罡风灵刃）
    if (p.ballistic) {
      const cx = p.cx != null ? p.cx : p.x1;
      const cy = p.cy != null ? p.cy : p.y1;
      const ang = p.ang != null ? p.ang : 0;
      const trail = p.trail || [];
      const isFan = p.kind === 'fan_wave' || p.kind === 'gen_fan';
      const isGen = p.kind === 'gen_arrow' || p.kind === 'gen_fan';
      const isTower = p.kind === 'tower_arrow';

      ctx.save();
      // 绘制平滑渐变弹道破风尾迹丝带
      if (trail.length >= 2) {
        for (let i = 1; i < trail.length; i++) {
          const ratio = i / trail.length;
          ctx.strokeStyle = isFan ? p.color : (isTower ? '#fb923c' : (isGen ? '#fde047' : 'rgba(255,255,255,0.78)'));
          ctx.globalAlpha = ratio * (isFan ? 0.65 : 0.52);
          ctx.lineWidth = (isGen ? 4.2 : 2.6) * ratio;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      if (isFan) {
        // 羽扇挥出的【半月罡风灵刃 + 旋转灵符星尘】
        const scale = isGen ? 1.28 : 0.95;
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.scale(scale, scale);

        // 外层灵气光晕
        ctx.fillStyle = p.color || '#2dd4bf';
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // 弯月形破空风刃（宽腹尖角向前切裂空气）
        ctx.fillStyle = p.color || '#2dd4bf';
        ctx.beginPath();
        ctx.arc(-2, 0, 13, -1.15, 1.15, false);
        ctx.arc(-8, 0, 11.5, 1.05, -1.05, true);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 10.5, -0.85, 0.85, false);
        ctx.arc(-4.5, 0, 9.2, 0.78, -0.78, true);
        ctx.closePath();
        ctx.fill();

        // 核心旋转灵珠 + 尾随星点
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(2, 0, 3.2, 0, Math.PI * 2);
        ctx.fill();
        for (let s = 0; s < 3; s++) {
          const sa = (time || 0) * 14 + s * 2.1;
          ctx.fillStyle = s === 0 ? '#ffffff' : (p.color || '#c084fc');
          ctx.beginPath();
          ctx.arc(-8 - s * 4, Math.sin(sa) * 4.5, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // 严格沿抛物线切线角度飞行的【雕翎利箭 / 名将穿云箭 / 箭塔火箭】
        const scale = isGen ? 1.25 : (isTower ? 1.12 : 0.96);
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.scale(scale, scale);

        // 箭杆（木纹金漆）
        ctx.strokeStyle = isGen ? '#fde047' : '#d97706';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-15, 0);
        ctx.lineTo(8, 0);
        ctx.stroke();

        // 尾端双叉雕翎箭羽
        ctx.fillStyle = isTower ? '#f97316' : (p.side === 'player' ? '#ef4444' : '#cbd5e1');
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(-17, -4.2); ctx.lineTo(-14, 0); ctx.lineTo(-17, 4.2);
        ctx.closePath();
        ctx.fill();

        // 菱形破甲钢簇
        ctx.fillStyle = isGen ? '#fef08a' : '#f8fafc';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(5, -3.6);
        ctx.lineTo(7, 0);
        ctx.lineTo(5, 3.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 箭塔烈火箭 / 名将神箭簇头流焰
        if (isTower || isGen) {
          ctx.fillStyle = isTower ? 'rgba(251, 146, 60, 0.72)' : 'rgba(250, 204, 21, 0.65)';
          ctx.beginPath();
          ctx.ellipse(6, 0, 8, 3.2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      return;
    }

    // 2. 命中瞬间扩散冲击环 & 近战宽刃新月刀罡 / 破空枪芒
    const ratio = Math.max(0, Math.min(1, 1 - p.life / p.maxLife));
    ctx.save();

    if (p.kind === 'impact_ring') {
      ctx.globalAlpha = Math.max(0, 1 - ratio);
      ctx.strokeStyle = p.color || '#fef08a';
      ctx.lineWidth = 2.6 * (1 - ratio * 0.6);
      const r = 6 + ratio * (p.isFan ? 24 : 17);
      ctx.beginPath();
      ctx.ellipse(p.x2, p.y2, r, r * 0.65, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'thrust') {
      // 破空枪芒 + 双层气浪环
      const sc = p.scale || 1;
      const ang = Math.atan2((p.y2 || 0) - (p.y1 || 0), (p.x2 || 0) - (p.x1 || 0));
      ctx.globalAlpha = Math.max(0, 1 - ratio * 0.88);
      ctx.translate(p.x1, p.y1);
      ctx.rotate(ang);
      const len = (36 + ratio * 26) * sc;

      ctx.fillStyle = p.color || '#fef08a';
      ctx.beginPath();
      ctx.moveTo(-6, -5 * sc);
      ctx.lineTo(len, 0);
      ctx.lineTo(-6, 5 * sc);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -2.2 * sc);
      ctx.lineTo(len + 8, 0);
      ctx.lineTo(0, 2.2 * sc);
      ctx.closePath();
      ctx.fill();

      // 枪杆破风气浪椭圆环
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(len * 0.45, 0, 3.5, (9 + ratio * 6) * sc, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // 渐变宽腹尖尾新月刀罡（彻底取代旧版单根细圆线！）
      const dir = p.dir || 1;
      const sc = p.scale || 1;
      const r = (20 + ratio * 18) * sc;
      ctx.globalAlpha = Math.max(0, 1 - ratio * 0.85);
      ctx.translate(p.x2, p.y2);
      ctx.scale(dir, 1);
      ctx.rotate(-0.12 + ratio * 0.28);

      ctx.fillStyle = p.color || '#fef08a';
      ctx.beginPath();
      ctx.arc(0, 0, r, -1.08, 1.08, false);
      ctx.arc(-6 * sc, 0, r * 0.80, 1.02, -1.02, true);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(1, 0, r * 0.95, -0.78, 0.78, false);
      ctx.arc(-3.5 * sc, 0, r * 0.84, 0.72, -0.72, true);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  App.Sprites = {
    drawEquipIcon,
    drawBattlefieldTerrain,
    drawWatchTower,
    drawMountedGeneral,
    drawProp,
    drawSoldierSprite,
    drawGiantBeastSprite,
    drawSkillEffect,
    drawDisasterOverlay,
    drawDyingUnit,
    drawProjectile,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
