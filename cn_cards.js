/* ============================================================
 * cn_cards.js — 中国版专属：武将卡 / 神明卡 / 彩票站
 * 2026-10-18 v1
 * 规则：纯前端，抽卡即结算，全部中文
 * ============================================================ */
(function(){
  'use strict';

  /* ---------- 武将卡（天罡系：偏收益） ---------- */
  var WARRIORS = [
    { name:'关羽', icon:'⚔️', title:'武圣附体', text:'随机夺取一名对手的一块空地', fn:function(p){ stealProperty(p); } },
    { name:'张飞', icon:'🌪️', title:'当阳怒吼', text:'所有对手失去 3000', fn:function(p){ allOpponents(p, function(o){ lose(o, 3000); }); } },
    { name:'赵云', icon:'🐎', title:'七进七出', text:'立即再掷一次骰子', fn:function(p){ p.starExtraRoll = true; } },
    { name:'诸葛亮', icon:'🪶', title:'草船借箭', text:'从银行领取 12000', fn:function(p){ gain(p, 12000); } },
    { name:'吕布', icon:'🗡️', title:'无双乱舞', text:'随机指定一名对手，该对手向你支付 8000', fn:function(p){ takeFromOne(p, 8000); } },
    { name:'黄忠', icon:'🏹', title:'百步穿杨', text:'随机拆掉一名对手的一栋建筑', fn:function(p){ demolishOne(p); } },
    { name:'马超', icon:'🐴', title:'西凉铁骑', text:'向前移动 3 格', fn:function(p){ move(p, 3); } },
    { name:'周瑜', icon:'🔥', title:'火烧连营', text:'所有对手各失去 10% 现金', fn:function(p){ allOpponents(p, function(o){ lose(o, Math.round(o.money*0.1)); }); } },
    { name:'张辽', icon:'🛡️', title:'威震逍遥津', text:'下 2 次踩地免交过路费', fn:function(p){ p.starFreeRent = (p.starFreeRent||0) + 2; } },
    { name:'甘宁', icon:'⛵', title:'百骑劫营', text:'随机指定一名对手，夺走该对手 15% 现金', fn:function(p){ takePercentOne(p, 15); } }
  ];

  /* ---------- 神明卡（地煞系：偏运气，有正有负） ---------- */
  var GODS = [
    { name:'土地公', icon:'🏮', title:'土地庇佑', text:'领取 9000', fn:function(p){ gain(p, 9000); } },
    { name:'财神爷', icon:'💰', title:'财源广进', text:'领取当前现金的 12%', fn:function(p){ gain(p, Math.round(p.money*0.12)); } },
    { name:'穷神', icon:'👻', title:'穷神缠身', text:'失去 7000', fn:function(p){ lose(p, 7000); } },
    { name:'灶王爷', icon:'🍚', title:'上天言好事', text:'领取 6000，所有对手各领 2000', fn:function(p){ gain(p, 6000); allOpponents(p, function(o){ gain(o, 2000); }); } },
    { name:'月老', icon:'❤️', title:'红线牵连', text:'随机指定一名对手，与其平分现金', fn:function(p){ balanceOne(p); } },
    { name:'阎王爷', icon:'💀', title:'生死簿', text:'随机指定一名对手，该对手直接进监狱', fn:function(p){ jailOne(p); } },
    { name:'龙王', icon:'🐉', title:'行云布雨', text:'随机传送到一块无主地', fn:function(p){ teleportFree(p); } },
    { name:'观音', icon:'🪷', title:'普渡众生', text:'全场每人领取 4000', fn:function(p){ for(var i=1;i<=pcount;i++) gain(player[i], 4000); } },
    { name:'雷公', icon:'⚡', title:'五雷轰顶', text:'随机指定一名对手，该对手失去 30% 现金', fn:function(p){ takePercentOne(p, 30); } },
    { name:'和合二仙', icon:'🎎', title:'和气生财', text:'领取 5000，解除自身所有负面状态', fn:function(p){ gain(p, 5000); p.starIsolate=0; p.starLimitMove=0; } }
  ];

  /* ---------- 机制怪卡（超模专属） ---------- */
  var MECHA = [
    { name:'复制', icon:'🪞', title:'镜花水月', text:'复制上一张抽到的卡，再执行一次', fn:function(p){ repeatLast(p); } },
    { name:'倍数', icon:'✖️', title:'三倍暴击', text:'立即领取当前现金的 200%', fn:function(p){ gain(p, p.money*2); } },
    { name:'翻倍', icon:'🎲', title:'孤注一掷', text:'现金翻倍，但 50% 概率全部归零', fn:function(p){ if(rnd(2)===0){ gain(p, p.money); } else { var l=p.money-1000; if(l>0){ p.money=1000; addAlert('【孤注一掷】'+p.name+' 输光了，只剩 $1000。'); } } } },
    { name:'吸血', icon:'🩸', title:'血魔附体', text:'每名对手各被夺走 10% 现金', fn:function(p){ allOpponents(p, function(o){ var t=Math.round(o.money*0.1); o.money-=t; p.money+=t; addAlert(o.name+' 被抽走 $'+t+'。'); }); } },
    { name:'清零', icon:'💧', title:'散财童子', text:'随机一名对手现金减半', fn:function(p){ halveOne(p); } },
    { name:'税收', icon:'📜', title:'苛政猛于虎', text:'所有对手按总资产 5% 缴税给你', fn:function(p){ allOpponents(p, function(o){ var t=Math.round(o.money*0.05); if(t>0){ o.money-=t; p.money+=t; addAlert(o.name+' 缴税 $'+t+'。'); } }); } },
    { name:'拆迁', icon:'🚜', title:'推土机', text:'拆掉所有对手建筑', fn:function(p){ var me=player.indexOf(p), n=0; for(var i=0;i<square.length;i++){ var s=square[i]; if(s.owner>0&&s.owner!==me&&(s.house>0||s.hotel)){ s.house=0; s.hotel=0; n++; } } gain(p, n*15000); } },
    { name:'天命', icon:'☯️', title:'天命所归', text:'免费获得一块无主空地', fn:function(p){ teleportFree(p); } }
  ];

  /* 2026-10-18：机制卡全局限量——每种一局只有 4 张 */
  var MECH_TOTAL = 4;
  var mechLeft = {};
  MECHA.forEach(function(c){ mechLeft[c.name] = MECH_TOTAL; });

  /* 已抽出、可储存的机制卡（每名玩家各存一份） */
  var mechBag = {};
  function bagOf(p){
    var i = player.indexOf(p);
    if(i < 1) i = 0;
    if(!mechBag[i]) mechBag[i] = [];
    return mechBag[i];
  }
  function mechRemaining(){ var n=0; for(var k in mechLeft) n += mechLeft[k]; return n; }

  var lastCard = null;

  function repeatLast(p){
    if(!lastCard){ gain(p, 20000); return; }
    try { lastCard.fn(p); } catch(e){}
    addAlert('【复制】'+p.name+' 复制了上一张卡：'+lastCard.name);
  }
  function halveOne(p){
    var o=opponents(p); if(!o.length){ gain(p,10000); return; }
    var t=o[rnd(o.length)]; var cut=Math.round(t.money*0.5);
    t.money-=cut; addAlert('【随机】'+p.name+' 抽中 '+t.name+'，该对手现金减半（-$'+cut+'）。');
  }

  /* ---------- 工具函数 ---------- */
  function opponents(p){
    var me = player.indexOf(p), list=[];
    for(var i=1;i<=pcount;i++){ if(i!==me && player[i] && player[i].money>0) list.push(player[i]); }
    return list;
  }
  function rnd(n){ return Math.floor(Math.random()*n); }
  /* 2026-10-18：卡片金额改成「百分比 + 兜底」
   * 实际金额 = max(固定值, 当前现金 × 比例)，后期自动跟着资产涨 */
  var PCT_IN = 0.10;      // 自身获得
  var PCT_OUT = 0.05;     // 自身失去
  var PCT_FROM = 0.08;    // 从单个对手拿

  function gain(p,v){
    var amt = Math.max(v, Math.round(p.money * PCT_IN)) * (window.__STAR_MULT||1);
    p.money += amt;
    addAlert(p.name + ' 获得 $' + amt + '。');
  }
  function lose(p,v){
    var amt = Math.min(Math.max(v, Math.round(p.money * PCT_OUT)), p.money) * (window.__STAR_MULT||1);
    p.money -= amt;
    addAlert(p.name + ' 失去 $' + amt + '。');
  }
  function allOpponents(p,fn){ var o=opponents(p); for(var i=0;i<o.length;i++) fn(o[i]); }
  function stealProperty(p){
    var me=player.indexOf(p), cand=[];
    for(var i=0;i<square.length;i++){
      var s=square[i];
      if(s.owner>0 && s.owner!==me && s.price>0 && s.house===0 && !s.hotel) cand.push(s);
    }
    if(!cand.length){ gain(p,8000); return; }
    var t=cand[rnd(cand.length)]; t.owner=me; addAlert('【随机】'+p.name+' 抽中 '+t.name+'，夺取了该对手的 '+t.name+'。');
  }
  function takeFromOne(p,v){
    var o=opponents(p); if(!o.length){ gain(p,5000); return; }
    var t=o[rnd(o.length)];
    var amt=Math.min(Math.max(v, Math.round(t.money * PCT_FROM)), t.money);
    t.money-=amt; p.money+=amt; addAlert('【随机】'+p.name+' 抽中 '+t.name+'，'+t.name+' 向 '+p.name+' 支付了 $'+amt+'。');
  }
  function takePercentOne(p,pct){
    var o=opponents(p); if(!o.length){ gain(p,5000); return; }
    var t=o[rnd(o.length)], amt=Math.round(t.money*pct/100);
    t.money-=amt; p.money+=amt; addAlert('【随机】'+p.name+' 抽中 '+t.name+'，夺走该对手 $'+amt+'。');
  }
  function demolishOne(p){
    var me=player.indexOf(p), cand=[];
    for(var i=0;i<square.length;i++){ var s=square[i]; if(s.owner>0&&s.owner!==me&&(s.house>0||s.hotel)) cand.push(s); }
    if(!cand.length){ gain(p,600); return; }
    var t=cand[rnd(cand.length)]; t.house=0; t.hotel=0; addAlert('【随机】'+p.name+' 抽中 '+t.name+'，拆掉了 '+t.name+' 上的建筑。');
  }
  function move(p,n){ p.position=(p.position+n)%40; updatePosition(); addAlert(p.name+' 前进 '+n+' 格。'); }
  function jailOne(p){
    var o=opponents(p); if(!o.length){ gain(p,600); return; }
    var t=o[rnd(o.length)]; t.jail=true; t.jailroll=0; addAlert('【随机】'+p.name+' 抽中 '+t.name+'，该对手被抓进监狱。');
  }
  function balanceOne(p){
    var o=opponents(p); if(!o.length){ gain(p,400); return; }
    var t=o[rnd(o.length)], avg=Math.round((p.money+t.money)/2);
    p.money=avg; t.money=avg; addAlert('【随机】'+p.name+' 抽中 '+t.name+'，两人平分了现金。');
  }
  function teleportFree(p){
    var free=[]; for(var i=0;i<square.length;i++){ if(square[i].price>0 && square[i].owner===0) free.push(i); }
    if(!free.length){ gain(p,5000); return; }
    p.position=free[rnd(free.length)]; updatePosition(); addAlert(p.name+' 被传送到 '+square[p.position].name+'。');
  }

  /* ---------- 弹窗 ---------- */
  function showCard(card, kind, p, after){
    var isWar = kind==='war';
    var isMech = kind==='mech';
    var accent = isMech ? '#c9a961' : (isWar ? '#ff9a4a' : '#9fe0ff');
    var bg = isMech ? 'linear-gradient(160deg,#241c16 0%,#12100c 100%)' : (isWar ? 'linear-gradient(160deg,#2a1408 0%,#0d0704 100%)' : 'linear-gradient(160deg,#08181f 0%,#04101a 100%)');
    var border = isMech ? '#8a7040' : (isWar ? '#8a5010' : '#1e5a7a');

    var html =
      '<div style="padding:18px 18px 12px;text-align:center">' +
        '<div style="font-size:11px;letter-spacing:4px;color:'+accent+';opacity:.8;margin-bottom:10px">'+(isMech?'机制降临':(isWar?'武将降临':'神明降临'))+'</div>' +
        '<div style="font-size:32px;line-height:1;margin-bottom:8px">'+card.icon+'</div>' +
        '<div style="font-size:24px;font-weight:900;color:'+accent+';letter-spacing:3px;text-shadow:0 0 18px '+accent+'55">'+card.name+'</div>' +
        '<div style="font-size:12px;color:'+accent+';opacity:.7;margin-top:5px;letter-spacing:1px">'+card.title+'</div>' +
        '<div style="height:1px;background:linear-gradient(90deg,transparent,'+accent+'66,transparent);margin:14px 0 12px"></div>' +
        '<div style="font-size:14px;color:#e8dcc8;line-height:1.8;padding:0 2px">'+card.text+'</div>' +
      '</div>' +
      '<button class="star-btn" id="cncardbtn" style="background:linear-gradient(160deg,'+accent+',#c07a20);color:#1a1208">收 下</button>';

    var P = document.getElementById('popup');
    var txt = document.getElementById('popuptext');
    txt.innerHTML = html;
    P.className='star-popup';
    P.style.width='300px'; P.style.minWidth='300px'; P.style.padding='0';
    P.style.background=bg; P.style.borderColor=border;

    var wrap=document.getElementById('popupwrap');
    var bgel=document.getElementById('popupbackground');
    if(bgel) bgel.style.display='block';
    wrap.style.display='block';

    var btn=document.getElementById('cncardbtn');
    function done(){
      if(bgel) bgel.style.display='none';
      wrap.style.display='none';
      P.className=''; P.style.background=''; P.style.borderColor='';
      if(after) after();
    }
    btn.addEventListener('click', done);
    btn.addEventListener('touchend', function(e){ e.preventDefault(); done(); });
  }

  /* ---------- 卡袋界面：手动查看 + 手动使用 ---------- */
  function openBag(p){
    if(!p){ return; }
    if(!p.human){ popup('<div style="text-align:center;padding:10px">机制卡袋只能由人类玩家操作。</div>'); return; }
    var bag = bagOf(p);
    var rows = '';
    if(!bag.length){
      rows = '<div style="text-align:center;color:#7a6a52;font-size:13px;padding:18px 0">卡袋空空如也<br><span style="font-size:11px">抽到机制卡会自动存入这里</span></div>';
    } else {
      var count = {};
      bag.forEach(function(n){ count[n] = (count[n]||0)+1; });
      Object.keys(count).forEach(function(n, i){
        var card = null;
        MECHA.forEach(function(c){ if(c.name===n) card=c; });
        if(!card) return;
        rows += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;margin-bottom:6px;background:#1a1410;border:1px solid #4a3f30;border-radius:9px">' +
          '<span style="font-size:13px;color:#e8dcc8">'+card.icon+' '+card.name+' <b style="color:#c9a961">×'+count[n]+'</b></span>' +
          '<button class="star-btn" style="width:auto;margin:0;padding:7px 14px;font-size:12px" onclick="CNCards.useFromBag(\''+n+'\', player[turn])">使 用</button>' +
        '</div>';
      });
    }
    var total = mechRemaining();
    var html =
      '<div style="padding:16px 14px 10px">' +
        '<div style="text-align:center;font-size:15px;font-weight:900;color:#c9a961;letter-spacing:3px;margin-bottom:4px">🎴 机制卡袋</div>' +
        '<div style="text-align:center;font-size:10.5px;color:#7a6a52;margin-bottom:12px">全服机制卡剩余 '+total+' 张 · 使用后立刻生效</div>' +
        rows +
      '</div>' +
      '<button class="star-btn" style="background:linear-gradient(160deg,#2a2219,#1a1410);color:#ddd2b8;border:1px solid #5a4f3a" onclick="document.getElementById(\'popupbackground\').style.display=\'none\';document.getElementById(\'popupwrap\').style.display=\'none\';document.getElementById(\'popup\').className=\'\';document.getElementById(\'popup\').style.background=\'\';">关 闭</button>';

    var P=document.getElementById('popup'), txt=document.getElementById('popuptext');
    txt.innerHTML = html;
    P.className='star-popup';
    P.style.width='320px'; P.style.minWidth='320px'; P.style.padding='0';
    P.style.background='linear-gradient(160deg,#241c16 0%,#12100c 100%)';
    P.style.borderColor='#8a7040';
    var wrap=document.getElementById('popupwrap'), bgel=document.getElementById('popupbackground');
    if(bgel) bgel.style.display='block';
    wrap.style.display='block';
  }

  function useFromBag(name, p){
    var bag = bagOf(p);
    var idx = bag.indexOf(name);
    if(idx < 0){ return; }
    var card = null;
    MECHA.forEach(function(c){ if(c.name===name) card=c; });
    if(!card){ return; }
    bag.splice(idx, 1);                    // 从卡袋移除
    try { card.fn(p); } catch(e){ console.warn('[使用机制卡]', e); }
    updateMoney(); updateOwned(); updatePosition();
    if(window.addAlert) addAlert('【使用】'+p.name+' 使用了机制卡「'+name+'」。');
    showCard(card, 'mech', p, null);
  }

  /* ---------- 对外：抽取 ---------- */
  function trigger(kind, p, after){
    var pool, card;
    if(kind==='mech'){
      // 只剩还有库存的机制卡
      var avail = MECHA.filter(function(c){ return mechLeft[c.name] > 0; });
      if(!avail.length){ kind = 'war'; }   // 机制卡抽完，退回武将卡
      else {
        card = avail[rnd(avail.length)];
        mechLeft[card.name]--;
        bagOf(p).push(card.name);           // 存入该玩家的卡袋
        // 全服播报
        if(window.addAlert) addAlert('【机制播报】'+p.name+' 抽到了机制卡「'+card.name+'」（全服剩余 '+mechRemaining()+' 张）');
        if(kind==='mech') lastCard = card;
        try { card.fn(p); } catch(e){ console.warn('[机制卡]', e); }
        updateMoney(); updateOwned(); updatePosition();
        showCard(card, 'mech', p, after);
        return;
      }
    }
    pool = (kind==='war') ? WARRIORS : GODS;
    card = pool[rnd(pool.length)];
    if(kind!=='mech' || card.name!=='复制'){ lastCard = card; }

    // 2026-10-18：所有卡（神明/武将/机制）都走升星流程
    // 星级越高效果越强，集齐五张三星 → 白饭核弹
    if(window.CNStars){
      window.CNStars.drawAndApply(p, card, kind);
      if(after) after();
      return;
    }

    try { card.fn(p); } catch(e){ console.warn('[中国版卡片]', e); }
    updateMoney(); updateOwned(); updatePosition();
    showCard(card, kind, p, after);
  }

  window.CNCards = { trigger: trigger, WARRIORS: WARRIORS, GODS: GODS, MECHA: MECHA, mechLeft: mechLeft, mechRemaining: mechRemaining, bagOf: bagOf, openBag: openBag, useFromBag: useFromBag };
})();
