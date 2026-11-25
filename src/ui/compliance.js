(function (root) {
  const App = (root.SiXiang = root.SiXiang || {});

  // 本地隐私授权存储键（版本号升级时可触发重新确认）
  const KEY_PRIVACY_AGREED = 'sixiang_privacy_agreed_v1';

  // 国家新闻出版署标准 48 字《健康游戏忠告》（一字不差）
  const HEALTH_ADVICE_LINES = [
    '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。',
    '适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。',
  ];

  // 三大内置合规文档全文（贴合本项目服务端存档、纯免费无内购、微信 OpenID 登录实际行为）
  const DOCS = {
    privacy: {
      tabLabel: '隐私保护指引',
      title: '《群英志》用户隐私保护指引',
      updatedAt: '生效日期：2026年11月24日',
      sections: [
        {
          h: '一、引言与适用范围',
          p: '欢迎您体验《群英志》微信小游戏！本指引由本游戏个人开发者制定，旨在按照《中华人民共和国个人信息保护法》及《微信小游戏平台运营规范》，向您清晰说明我们在游戏运行过程中如何收集、使用、存储和保护您的信息，以及您享有的各项权利。',
        },
        {
          h: '二、我们如何收集与使用信息（最小必要原则）',
          p: '1. 登录凭证与云端护档：在您点击“同意”本指引后，我们将调用微信登录接口（wx.login）获取临时登录凭证并生成平台匿名标识（OpenID），仅用于在开发者服务端为您创建、读取和实时同步游戏存档（阵营、等级、武将、神兽、关卡与演武进度），防止更换设备或清理微信缓存导致进度丢失。\n2. 主动输入的交互文本：当您主动起名或修改主公名号、提交体验反馈、申请创建联盟或编辑联盟公告时，相关文本会加密传输至服务端完成业务处理与合规内容审核。\n3. 剪贴板写入（仅您主动点击时触发）：仅当您在“系统设置”或“邀请好友”页主动点击“复制主公 ID / 邀请码”按钮时，才会调用 wx.setClipboardData 写入对应编码；我们绝不会在后台静默读取您的剪贴板内容。\n4. 本地存储与静态缓存：我们使用微信本地存储与小游戏用户目录保存您的音量、震动、画质开关及静态数值配置、美术贴图缓存，以提升加载速度并节省您的移动数据流量。\n5. 激励视频广告说明：本游戏为纯免费无内购休闲策略小游戏，不包含任何充值付费功能；若后续接入微信官方流量主广告组件，广告展示由腾讯微信平台提供并适用微信官方隐私政策。',
        },
        {
          h: '三、我们承诺绝不收集的敏感权限',
          p: '本游戏绝不申请、不收集您的手机号码、身份证号码、真实姓名、精确地理位置、通讯录、相册读写权限、摄像头或麦克风录音权限。',
        },
        {
          h: '四、数据存储、安全加密与共享承诺',
          p: '您的游戏存档存储于中国大陆境内合规云服务器，客户端与服务端通信全程附带动态令牌、时间戳与 HMAC-SHA256 签名校验。除法律法规另有规定外，我们不会向任何第三方出售、出租或共享您的信息。',
        },
        {
          h: '五、未成年人个人信息与防沉迷保护',
          p: '本游戏适龄提示等级为 12+，且无任何应用内购与充值消费入口。若您是未满 18 周岁的未成年人，请在父母或其他监护人的知情、陪同与指导下阅读本指引并合理安排游戏时间。',
        },
        {
          h: '六、您的权利（查阅、修改与撤回授权）',
          p: '您可随时在首屏加载页或游戏内【系统设置 -> 隐私与适龄】查阅本指引，在【系统设置】中修改主公名号；您也可以点击本窗口底部的【撤回授权并清理本地缓存】按钮，随时撤回本地隐私授权并清除本地缓存数据。',
        },
      ],
    },
    terms: {
      tabLabel: '用户服务协议',
      title: '《群英志》用户服务协议',
      updatedAt: '生效日期：2026年11月24日',
      sections: [
        {
          h: '一、协议确认与服务说明',
          p: '《群英志》是一款国风题材横版策略攻防闯关休闲小游戏。当您点击同意并进入游戏，即表示您已充分阅读、理解并同意遵守本协议全部条款。若您不同意本协议任何内容，请点击“暂不同意”并停止使用。',
        },
        {
          h: '二、账号规则与云端权威存档',
          p: '1. 游戏基于您的微信账号标识提供一对一云端存档服务，该账号仅限您本人正常娱乐使用。\n2. 游戏内所有战斗结算、概率抽取、装备锻造与排行数据均以服务端实时运算结果为准。严禁使用任何外挂、加速脚本、抓包篡改、重放攻击或利用程序漏洞牟利；一经风控系统核实，开发者有权采取回滚异常数据、限制排行或封禁账号等措施以维护全服公平环境。',
        },
        {
          h: '三、用户行为与文明言论规范',
          p: '您在设置主公名号、创建联盟名称及编写联盟公告时，不得发布任何违反国家法律法规、损害国家利益、违背公序良俗、含暴力色情低俗、侮辱诽谤他人或未经授权的商业广告信息。联盟名称与公告须经后台审核通过后方可公开生效。',
        },
        {
          h: '四、纯免费性质与虚拟道具声明',
          p: '本游戏由个人开发者独立运营，不设任何人民币充值渠道与虚拟支付内购项目。游戏内的“铜钱”“元宝”“将魂”“装备”等均属于游戏免费玩法产出的虚拟数值表现，不具有任何现实货币价值，严禁任何形式的场外现金买卖或线下交易。',
        },
        {
          h: '五、知识产权与服务变更说明',
          p: '本游戏的程序代码、界面设计、美术原画及数值体系均受著作权法及相关法律法规保护。为持续优化玩法体验或配合服务器维护，开发者有权在提前公告或版本更新后对游戏数值、活动规则进行合理调整。',
        },
      ],
    },
    age: {
      tabLabel: '适龄提示(12+)',
      title: '适龄提示（CADPA 12+）与健康游戏说明',
      updatedAt: '依据《网络游戏适龄提示》团体标准制定',
      sections: [
        {
          h: '一、国家新闻出版署《健康游戏忠告》',
          p: '抵制不良游戏，拒绝盗版游戏。注意自我保护，谨防受骗上当。\n适度游戏益脑，沉迷游戏伤身。合理安排时间，享受健康生活。',
        },
        {
          h: '二、适龄等级：12+（建议年满 12 周岁及以上用户使用）',
          p: '1. 题材与画面：游戏取材于中国古典三国历史演义与青龙、白虎、朱雀、玄武四象瑞兽传统文化，采用国风卡通绘卷美术风格，画面明朗健康，无血腥、恐怖、低俗及封建迷信内容。\n2. 策略复杂度：核心玩法涉及多兵种克制派遣、战场辎重资源分配、武将阵容搭配与套装共鸣养成，需要一定的逻辑统筹与阅读理解能力，因此建议 12 周岁及以上用户使用。',
        },
        {
          h: '三、无内购消费与社交安全保护',
          p: '1. 零充值风险：游戏内无任何付费充值功能或付费抽卡入口，彻底杜绝未成年人非理性充值消费风险。\n2. 轻量化安全社交：游戏内仅设演武校场异步切磋、风云榜单展示及联盟协作，无自由私聊与实时语音功能，且自定义联盟文本均经过后台人工审核过滤。',
        },
        {
          h: '四、健康作息与监护人指引',
          p: '请广大玩家合理控制连续游玩时长，注意用眼卫生，保持良好生活作息；未成年人请在家长或监护人的指导与监督下适度体验游戏。',
        },
      ],
    },
  };

  let agreed = false;
  let gateOpen = false;
  let declinedIdle = false;
  let docModalOpen = false;
  let revokeConfirmOpen = false;
  let currentTab = 'privacy';
  let scrollY = 0;
  let maxScrollY = 0;

  let onAgreedCallback = null;
  let pendingWxResolve = null;

  function markDirty() {
    if (App.Main && typeof App.Main.markDirty === 'function') App.Main.markDirty(350);
  }

  function init(onAgreeCb) {
    onAgreedCallback = onAgreeCb || null;
    agreed = !!App.Platform.loadStorage(KEY_PRIVACY_AGREED);

    // 接入微信官方原生隐私授权事件钩子（基础库 >= 2.32.3）
    if (App.Platform.isWechat && typeof wx !== 'undefined') {
      try {
        if (typeof wx.onNeedPrivacyAuthorization === 'function') {
          wx.onNeedPrivacyAuthorization((resolve) => {
            pendingWxResolve = resolve;
            if (agreed) {
              try { resolve({ event: 'agree' }); } catch (e) {}
              pendingWxResolve = null;
            } else {
              gateOpen = true;
              declinedIdle = false;
              markDirty();
            }
          });
        }
        if (typeof wx.getPrivacySetting === 'function') {
          wx.getPrivacySetting({
            success: (res) => {
              if (res && res.needAuthorization) {
                agreed = false;
                gateOpen = true;
                declinedIdle = false;
                markDirty();
              }
            },
          });
        }
      } catch (e) {}
    }

    if (agreed) {
      gateOpen = false;
      if (onAgreedCallback) onAgreedCallback();
    } else {
      gateOpen = true;
      declinedIdle = false;
      markDirty();
    }
  }

  function handleAgree() {
    agreed = true;
    gateOpen = false;
    declinedIdle = false;
    App.Platform.saveStorage(KEY_PRIVACY_AGREED, { v: 1, at: Date.now() });

    if (pendingWxResolve) {
      try { pendingWxResolve({ event: 'agree' }); } catch (e) {}
      pendingWxResolve = null;
    } else if (App.Platform.isWechat && typeof wx !== 'undefined' && typeof wx.requirePrivacyAuthorize === 'function') {
      try { wx.requirePrivacyAuthorize({ success: () => {}, fail: () => {} }); } catch (e) {}
    }

    markDirty();
    if (onAgreedCallback) onAgreedCallback();
  }

  function handleDecline() {
    gateOpen = false;
    declinedIdle = true;
    if (pendingWxResolve) {
      try { pendingWxResolve({ event: 'disagree' }); } catch (e) {}
      pendingWxResolve = null;
    }
    if (App.UI && App.UI.showToast) {
      App.UI.showToast('您已选择暂不同意，同意前不会连接服务器或收集任何信息', '#fde68a');
    }
    markDirty();
  }

  function revokeConsentAndReset() {
    agreed = false;
    revokeConfirmOpen = false;
    docModalOpen = false;
    gateOpen = true;
    declinedIdle = false;
    App.Platform.clearStorage(KEY_PRIVACY_AGREED);
    App.Platform.clearStorage('sixiang_client_uid');
    if (App.UI && App.UI.closeExchangeModal) App.UI.closeExchangeModal();
    if (App.Scenes && App.Scenes.settings && App.Scenes.settings.closeBattleModal) {
      App.Scenes.settings.closeBattleModal();
    }
    if (App.Main && App.Main.goScene) {
      App.Main.goScene('loading');
    }
    if (App.UI && App.UI.showToast) {
      App.UI.showToast('已撤回本地隐私授权并清理标识缓存', '#fde68a');
    }
    markDirty();
  }

  function openGate() {
    gateOpen = true;
    declinedIdle = false;
    markDirty();
  }

  function openDoc(tab) {
    currentTab = DOCS[tab] ? tab : 'privacy';
    scrollY = 0;
    docModalOpen = true;
    markDirty();
  }

  function closeDoc() {
    docModalOpen = false;
    revokeConfirmOpen = false;
    markDirty();
  }

  function isOpen() {
    return !!(gateOpen || docModalOpen || revokeConfirmOpen);
  }

  function onDrag(_dx, dy) {
    if (!docModalOpen) return;
    scrollY = Math.max(0, Math.min(maxScrollY, scrollY - dy));
    markDirty();
  }

  /**
   * 绘制严格符合中国音数协（CADPA）国家标准图样的【12+ 适龄提示】标识
   * 标准结构：白底圆角外框 -> 上方标准蓝块（上大白字 12+，下小白字 CADPA）-> 下方白底黑字“适龄提示”
   */
  const CADPA_LEVEL = '12+'; // 若微信后台适龄提示改为 16+ 或 8+，仅需改此常量（'8+' | '12+' | '16+'）
  function drawAgeBadge(ctx, x, y, opts) {
    const o = opts || {};
    const w = o.w || 48;
    const h = o.h || 60;
    const pad = 2.5;
    const innerW = w - pad * 2;
    const colorBoxH = Math.round((h - pad * 2) * 0.74);
    const badgeColor = CADPA_LEVEL === '8+' ? '#4ea638' : (CADPA_LEVEL === '16+' ? '#eaa01c' : '#1e78d6');

    ctx.save();
    // 柔和底影
    App.UI.roundRect(ctx, x + 1, y + 1.5, w, h, 5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // 标准纯白底板与细灰外框
    App.UI.roundRect(ctx, x, y, w, h, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 上半部标准彩色圆角方框
    App.UI.roundRect(ctx, x + pad, y + pad, innerW, colorBoxH, 3.5);
    ctx.fillStyle = badgeColor;
    ctx.fill();

    // 彩框内：上方大号白字“12+”，下方小白字“CADPA”（与微信官方预览100%一致）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(h * 0.31)}px "PingFang SC", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(CADPA_LEVEL, x + w / 2, y + pad + colorBoxH * 0.43);

    ctx.font = `bold ${Math.max(7, Math.round(h * 0.125))}px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText('CADPA', x + w / 2, y + pad + colorBoxH * 0.80);

    // 下半部白底黑字：“适龄提示”
    ctx.fillStyle = '#111827';
    ctx.font = `bold ${Math.max(8.5, Math.round(w * 0.19))}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillText('适龄提示', x + w / 2, y + pad + colorBoxH + (h - pad * 2 - colorBoxH) * 0.54, innerW);
    ctx.restore();

    App.UI.addHit(x - 4, y - 4, w + 8, h + 8, () => openDoc('age'));
  }

  /**
   * 绘制标准《健康游戏忠告》（独立标题行 + 两行完整 48 字）与底部协议链接栏
   */
  function drawHealthAdvice(ctx, cx, topY, opts) {
    const o = opts || {};
    const textCol = o.color || '#d6c5ab';
    const linkCol = o.linkColor || '#fcd34d';
    const showLinks = o.showLinks !== false;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (o.bgBox !== false) {
      const bw = o.boxW || 560;
      const bh = showLinks ? 76 : 56;
      App.UI.roundRect(ctx, cx - bw / 2, topY - 16, bw, bh, 8);
      ctx.fillStyle = 'rgba(18, 9, 4, 0.68)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(212, 163, 75, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = '#e7d5b8';
    ctx.font = 'bold 11.5px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText('《健康游戏忠告》', cx, topY - 4);

    ctx.fillStyle = textCol;
    ctx.font = `${o.fontSize || 11}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillText(HEALTH_ADVICE_LINES[0], cx, topY + 13);
    ctx.fillText(HEALTH_ADVICE_LINES[1], cx, topY + 28);

    if (showLinks) {
      const ly = topY + 46;
      ctx.font = 'bold 11px "PingFang SC", sans-serif';
      ctx.fillStyle = linkCol;
      ctx.fillText('《用户服务协议》     ｜     《隐私保护指引》', cx, ly);

      App.UI.addHit(cx - 140, ly - 10, 124, 20, () => openDoc('terms'));
      App.UI.addHit(cx + 16, ly - 10, 124, 20, () => openDoc('privacy'));
    }
    ctx.restore();
  }

  // ==================== 1. 首次启动《隐私与服务协议》授权门禁弹窗 ====================
  function drawGateModal(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;

    App.UI.addHit(0, 0, W, H, () => {}, { silent: true });
    ctx.save();
    ctx.fillStyle = 'rgba(8, 4, 2, 0.78)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const pw = 620, ph = 396;
    const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);

    App.UI.drawPanel(ctx, px, py, pw, ph, { r: 16, bg: '#f4e6c4', border: '#b45309', lineWidth: 2.6 });
    App.UI.drawWoodHeader(ctx, px + 12, py + 10, pw - 24, 44);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 18px "PingFang SC", "STKaiti", serif';
    ctx.fillText('用户服务协议与隐私保护指引', px + pw / 2, py + 32);

    // 内容说明内框
    const bx = px + 20, by = py + 64, bw = pw - 40, bh = 206;
    App.UI.drawPanel(ctx, bx, by, bw, bh, { r: 10, bg: '#fff8e7', border: '#c9a66b', lineWidth: 1.2 });

    ctx.textAlign = 'left';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 13px "PingFang SC", sans-serif';
    ctx.fillText('欢迎主公莅临《群英志》！在开始体验前，请您审阅并知悉：', bx + 16, by + 22);

    const bullets = [
      '1. 云端存档保护：在您同意后，我们将通过微信登录标识（OpenID）为您建立并实时同步云端游戏进度，同意前不会发起登录或收集任何个人信息。',
      '2. 交互与缓存：仅在您主动起名、提交反馈或点击复制 ID 时使用键盘输入与剪贴板写入，并在本地缓存静态配置与图片以节省您的流量。',
      '3. 纯免费与隐私安全：本作为无内购充值的纯免费策略小游戏，绝不收集手机号、通讯录、精确位置、相册或麦克风等无关敏感权限。',
    ];
    ctx.font = '12px "PingFang SC", sans-serif';
    ctx.fillStyle = '#5c2c16';
    let curY = by + 46;
    bullets.forEach((line) => {
      curY = App.UI.drawWrappedText(ctx, line, bx + 16, curY, bw - 32, 18.5, 'left') + 4;
    });
    ctx.restore();

    // 协议全文快捷书签行
    const linkY = py + 280;
    const tabW = 216, tabGap = 24;
    const startX = px + Math.round((pw - (tabW * 2 + tabGap)) / 2);
    App.UI.drawButton(ctx, startX, linkY, tabW, 32, '查阅《用户服务协议》', {
      r: 7, bg: '#6b381b', border: '#d4a34b', fontSize: 12,
    }, () => openDoc('terms'));
    App.UI.drawButton(ctx, startX + tabW + tabGap, linkY, tabW, 32, '查阅《隐私保护指引》', {
      r: 7, bg: '#6b381b', border: '#d4a34b', fontSize: 12,
    }, () => openDoc('privacy'));

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#78350f';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText('点击下方“同意并进入游戏”，即表示您已阅读并同意上述《用户服务协议》与《隐私保护指引》', px + pw / 2, py + 327);
    ctx.restore();

    // 底部【暂不同意】与【同意并进入游戏】双按钮
    const btnY = py + 342;
    App.UI.drawButton(ctx, px + 96, btnY, 176, 42, '暂不同意', {
      r: 10, bg: '#6b635b', border: '#d6d3d1', fontSize: 14,
    }, handleDecline);

    App.UI.drawButton(ctx, px + pw - 96 - 236, btnY, 236, 42, '同意并进入游戏', {
      r: 10, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 15,
    }, handleAgree);
  }

  // ==================== 2. 三合一可滚动《协议与适龄说明》全文阅读器 ====================
  function drawDocReaderModal(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    const doc = DOCS[currentTab] || DOCS.privacy;

    App.UI.addHit(0, 0, W, H, () => {}, { silent: true });
    ctx.save();
    ctx.fillStyle = 'rgba(8, 4, 2, 0.80)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    const pw = 740, ph = 468;
    const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);

    App.UI.drawPanel(ctx, px, py, pw, ph, { r: 16, bg: '#f4e6c4', border: '#b45309', lineWidth: 2.5 });
    App.UI.drawWoodHeader(ctx, px + 12, py + 10, pw - 24, 44);

    // 顶部双栏切换标签
    const tabs = ['privacy', 'terms'];
    tabs.forEach((tk, idx) => {
      const isCur = tk === currentTab;
      const tw = 148;
      const tx = px + 22 + idx * (tw + 8);
      App.UI.drawButton(ctx, tx, py + 15, tw, 34, DOCS[tk].tabLabel, {
        r: 8,
        grad: isCur ? ['#d97706', '#92400e'] : undefined,
        bg: isCur ? undefined : '#4a2511',
        border: isCur ? '#fef08a' : '#a16207',
        fontSize: 12.5,
      }, () => {
        if (currentTab !== tk) {
          currentTab = tk;
          scrollY = 0;
          markDirty();
        }
      });
    });

    App.UI.drawButton(ctx, px + pw - 98, py + 15, 78, 34, '关 闭', {
      r: 8, bg: '#5c2c16', border: '#fde047', fontSize: 12.5,
    }, closeDoc);

    // 正文可滚动视口区
    const vx = px + 18, vy = py + 62, vw = pw - 36, vh = ph - 122;
    App.UI.drawPanel(ctx, vx, vy, vw, vh, { r: 10, bg: '#fff8e7', border: '#c9a66b', lineWidth: 1.2 });

    // 预计算排版总高度
    const textW = vw - 44;
    ctx.save();
    let totalH = 54; // 标题与生效日期高度
    doc.sections.forEach((sec) => {
      totalH += 24;
      ctx.font = '12.5px "PingFang SC", sans-serif';
      const paras = String(sec.p || '').split('\n');
      paras.forEach((para) => {
        const lines = App.UI.wrapLinesCached(ctx, para, textW);
        totalH += lines.length * 19.5 + 6;
      });
      totalH += 8;
    });
    maxScrollY = Math.max(0, totalH - (vh - 20));
    if (scrollY > maxScrollY) scrollY = maxScrollY;

    // 裁剪并渲染正文
    App.UI.roundRect(ctx, vx + 2, vy + 2, vw - 4, vh - 4, 8);
    ctx.clip();

    let drawY = vy + 24 - scrollY;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#451a03';
    ctx.font = 'bold 16.5px "PingFang SC", serif';
    ctx.fillText(doc.title, vx + vw / 2, drawY);
    drawY += 22;

    ctx.fillStyle = '#92400e';
    ctx.font = '11px "PingFang SC", sans-serif';
    ctx.fillText(doc.updatedAt + '  ·  支持手指上下滑动或点击右下按钮翻阅', vx + vw / 2, drawY);
    drawY += 24;

    ctx.textAlign = 'left';
    doc.sections.forEach((sec) => {
      ctx.fillStyle = '#7c2d12';
      ctx.font = 'bold 13.5px "PingFang SC", sans-serif';
      ctx.fillText(sec.h, vx + 18, drawY);
      drawY += 22;

      ctx.fillStyle = '#451a03';
      ctx.font = '12.5px "PingFang SC", sans-serif';
      const paras = String(sec.p || '').split('\n');
      paras.forEach((para) => {
        const lines = App.UI.wrapLinesCached(ctx, para, textW);
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], vx + 18, drawY);
          drawY += 19.5;
        }
        drawY += 5;
      });
      drawY += 8;
    });

    // 右侧古典滚动进度条
    if (maxScrollY > 0) {
      const trackX = vx + vw - 12, trackY = vy + 10, trackH = vh - 20;
      App.UI.roundRect(ctx, trackX, trackY, 5, trackH, 2.5);
      ctx.fillStyle = 'rgba(180, 130, 56, 0.25)';
      ctx.fill();
      const thumbH = Math.max(28, (vh / totalH) * trackH);
      const thumbY = trackY + (scrollY / maxScrollY) * (trackH - thumbH);
      App.UI.roundRect(ctx, trackX, thumbY, 5, thumbH, 2.5);
      ctx.fillStyle = '#b45309';
      ctx.fill();
    }
    ctx.restore();

    // 底部功能操作栏
    const footY = py + ph - 48;
    if (currentTab === 'privacy' && App.Platform.isWechat && App.Platform.openWechatPrivacyContract) {
      App.UI.drawButton(ctx, vx, footY, 168, 36, '微信官方备案隐私指引', {
        r: 8, bg: '#5c3a1e', border: '#d4a34b', fontSize: 11.5,
      }, () => {
        App.Platform.openWechatPrivacyContract(() => {
          App.UI.showToast('当前展示即为完整《用户隐私保护指引》', '#fde68a');
        });
      });
    }

    if (currentTab === 'privacy' && agreed && !gateOpen) {
      const rx = (App.Platform.isWechat && App.Platform.openWechatPrivacyContract) ? (vx + 178) : vx;
      App.UI.drawButton(ctx, rx, footY, 174, 36, '撤回授权并清理缓存', {
        r: 8, bg: '#7f1d1d', border: '#fca5a5', fontSize: 11.5,
      }, () => {
        revokeConfirmOpen = true;
        markDirty();
      });
    }

    // 翻页辅助按钮 + 确定返回
    App.UI.drawButton(ctx, px + pw - 294, footY, 76, 36, '▲ 上翻', {
      r: 8, bg: '#6b381b', border: '#d4a34b', fontSize: 12, disabled: scrollY <= 2,
    }, () => { scrollY = Math.max(0, scrollY - 160); markDirty(); });

    App.UI.drawButton(ctx, px + pw - 210, footY, 76, 36, '▼ 下翻', {
      r: 8, bg: '#6b381b', border: '#d4a34b', fontSize: 12, disabled: scrollY >= maxScrollY - 2,
    }, () => { scrollY = Math.min(maxScrollY, scrollY + 160); markDirty(); });

    App.UI.drawButton(ctx, px + pw - 124, footY, 106, 36, gateOpen ? '返回授权' : '我已知悉', {
      r: 8, grad: ['#d97706', '#92400e'], border: '#fef08a', fontSize: 13,
    }, closeDoc);
  }

  // ==================== 3. 撤回隐私授权二次确认弹窗 ====================
  function drawRevokeConfirmModal(ctx) {
    const W = App.Platform.LOGICAL_W;
    const H = App.Platform.LOGICAL_H;
    App.UI.addHit(0, 0, W, H, () => {}, { silent: true });

    ctx.save();
    ctx.fillStyle = 'rgba(8, 4, 2, 0.72)';
    ctx.fillRect(0, 0, W, H);

    const pw = 440, ph = 216;
    const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);
    App.UI.drawPanel(ctx, px, py, pw, ph, { r: 14, bg: '#f4e6c4', border: '#b91c1c', lineWidth: 2.4 });
    App.UI.drawWoodHeader(ctx, px + 10, py + 10, pw - 20, 40);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 16px "PingFang SC", serif';
    ctx.fillText('确认撤回本地隐私授权？', px + pw / 2, py + 30);

    ctx.fillStyle = '#451a03';
    ctx.font = '12.5px "PingFang SC", sans-serif';
    App.UI.drawWrappedText(
      ctx,
      '撤回后将立即清除本地授权状态与设备标识缓存，并返回首屏暂停连接服务器（您的微信云端角色存档仍安全保留，下次重新授权即可恢复）。',
      px + 24,
      py + 74,
      pw - 48,
      20,
      'left'
    );
    ctx.restore();

    App.UI.drawButton(ctx, px + 56, py + ph - 54, 140, 38, '取 消', {
      r: 8, bg: '#6b635b', border: '#d6d3d1', fontSize: 13,
    }, () => { revokeConfirmOpen = false; markDirty(); });

    App.UI.drawButton(ctx, px + pw - 56 - 168, py + ph - 54, 168, 38, '确认撤回并退出', {
      r: 8, grad: ['#b91c1c', '#7f1d1d'], border: '#fef08a', fontSize: 13,
    }, revokeConsentAndReset);
  }

  function renderOverlay(ctx) {
    if (revokeConfirmOpen) {
      drawRevokeConfirmModal(ctx);
    } else if (docModalOpen) {
      drawDocReaderModal(ctx);
    } else if (gateOpen) {
      drawGateModal(ctx);
    }
  }

  App.Compliance = {
    HEALTH_ADVICE_LINES,
    init,
    hasAgreed: () => agreed,
    isDeclinedIdle: () => declinedIdle && !agreed,
    isOpen,
    openGate,
    openDoc,
    closeDoc,
    onDrag,
    drawAgeBadge,
    drawHealthAdvice,
    renderOverlay,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
