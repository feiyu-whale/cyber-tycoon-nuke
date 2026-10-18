/* ============================================================
 * handbook.js — 游戏内手册（整局随时可查）
 * 2026-10-18 v1
 * 内容全部自动从运行时数据生成，改了卡牌/赐福不用再同步手册
 * ============================================================ */
(function(){
  'use strict';

  var GOLD = '\u91d1';
  var tab = 'boon';   // 当前页签

  function esc(s){
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ---------- 各分区数据 ---------- */
  function boonList(){
    var B = window.Boon;
    if(!B) return [];
    return B.BOONS.slice().sort(function(a,b){
      return B.TIER[b.tier].rank - B.TIER[a.tier].rank;
    }).map(function(x){
      return { id:x.id, name:x.name, tag:B.TIER[x.tier].name, color:B.TIER[x.tier].color, text:x.desc };
    });
  }

  function cardsList(kind){
    var C = window.CNCards;
    if(!C) return [];
    var arr = (kind === 'war') ? C.WARRIORS : (kind === 'god' ? C.GODS : C.MECHA);
    if(!arr) return [];
    return arr.map(function(x){
      return {
        name:x.name, icon:x.icon || '', tag:x.title || '',
        text:x.text || '',
        star3:x.star3 || ''
      };
    });
  }

  function starsList(kind){
    var E = window.StarEngine;
    if(!E || !E.stars) return [];
    var all = E.stars() || [];
    return all.filter(function(s){ return s.type === kind; }).sort(function(a,b){ return a.idx - b.idx; });
  }

  function ruleList(){
    return [
      { name:'金币体系', text:'1 金币 = 10000 现金，可按 1:1万 双向兑换。开局每人 5 金币（= 5 万现金），是给玩家的"风险资金"：换钱占位，或留着买卡抢位。' },
      { name:'商店价格', text:'地煞 4 金 / 天罡 · 神明 · 武将 5 金；刷新 1 金。每升一级，刷新与卡价 ×2（实际价 = 基准 × 2^(等级-1)）。' },
      { name:'商店等级', text:'1→2 级 10 金，之后每级 +20 金。等级越高，天罡/神明/武将出货概率越高，但东西也更贵。' },
      { name:'升星规则', text:'同名 3 张 → 二星（效果 ×2）；共 9 张 → 三星（天罡/武将/神明 ×10，地煞 ×8）；27 张 → 四星彩蛋（直接核弹）。' },
      { name:'三星绝版', text:'任一卡升到三星 → 该卡全服绝版，从此不再出现。' },
      { name:'机制卡', text:'每种全局限量 4 张，不参与升星、不绝版，抽完全服播报，用尽后回流武将卡池。' },
      { name:'白饭核弹', text:'集齐 5 张三星 → 引爆核弹，直接结算，第一名当场产生，本局结束。这是"告别两小时膀胱局"的核心设计。' },
      { name:'利息结算', text:'每经过棋盘四个角（0 起点 / 10 探监 / 20 免费停车 / 30 进监狱）各结算一次利息，踩到即算，被关进监狱那格也算。' },
      { name:'赐福投票', text:'开局随机抽 4 条赐福，每人各投一票（电脑随机投），票多者全队获得；平票直接随机定一个。' },
      { name:'买牌时机', text:'只能在自己回合买入 / 刷新 / 升级商店。' }
    ];
  }

  /* ---------- 渲染 ---------- */
  function renderBody(){
    if(tab === 'boon'){
      var bs = boonList();
      if(!bs.length) return '<div style="color:#8a7f68;font-size:11px;text-align:center;padding:20px">赐福数据未加载</div>';
      return bs.map(function(b){
        return '<div style="padding:8px;margin-bottom:6px;background:#1a1410;border-left:3px solid '+b.color+';border-radius:6px">'+
          '<div style="font-size:12.5px;color:'+b.color+';font-weight:700">'+esc(b.name)+
          ' <span style="font-size:10px;opacity:.85">'+esc(b.tag)+'</span></div>'+
          '<div style="font-size:10.5px;color:#9a8f78;line-height:1.6;margin-top:3px">'+esc(b.text)+'</div></div>';
      }).join('');
    }

    if(tab === 'rule'){
      return ruleList().map(function(r){
        return '<div style="padding:8px;margin-bottom:6px;background:#1a1410;border-left:3px solid #c9a961;border-radius:6px">'+
          '<div style="font-size:12.5px;color:#c9a961;font-weight:700">'+esc(r.name)+'</div>'+
          '<div style="font-size:10.5px;color:#9a8f78;line-height:1.6;margin-top:3px">'+esc(r.text)+'</div></div>';
      }).join('');
    }

    if(tab === 'war' || tab === 'god' || tab === 'mech'){
      var cs = cardsList(tab);
      var color = tab === 'war' ? '#ff9a4a' : (tab === 'god' ? '#c9a961' : '#9fe0ff');
      if(!cs.length) return '<div style="color:#8a7f68;font-size:11px;text-align:center;padding:20px">数据未加载</div>';
      return cs.map(function(c){
        return '<div style="padding:8px;margin-bottom:6px;background:#1a1410;border-left:3px solid '+color+';border-radius:6px">'+
          '<div style="font-size:12.5px;color:'+color+';font-weight:700">'+esc(c.icon)+' '+esc(c.name)+
          ' <span style="font-size:10px;opacity:.8">'+esc(c.tag)+'</span></div>'+
          '<div style="font-size:10.5px;color:#9a8f78;line-height:1.6;margin-top:3px">'+esc(c.text)+'</div>'+
          (c.star3 ? '<div style="font-size:10.5px;color:#ffd86a;line-height:1.6;margin-top:3px">三星：'+esc(c.star3)+'</div>' : '')+
          '</div>';
      }).join('');
    }

    if(tab === 'gang' || tab === 'di'){
      var ss = starsList(tab);
      if(!ss.length) return '<div style="color:#8a7f68;font-size:11px;text-align:center;padding:20px">星宿数据加载中，请稍后再开</div>';
      var cl = tab === 'gang' ? '#ffd86a' : '#9fe0ff';
      return ss.map(function(s){
        return '<div style="padding:6px 8px;margin-bottom:5px;background:#1a1410;border-left:3px solid '+cl+';border-radius:6px">'+
          '<div style="font-size:12px;color:'+cl+';font-weight:700">'+esc(s.name)+
          ' <span style="font-size:10px;color:#8a7f68">'+esc(s.person||'')+' · '+esc(s.title||'')+'</span></div>'+
          '<div style="font-size:10.5px;color:#9a8f78;line-height:1.55;margin-top:2px">'+esc(s.text||'')+'</div></div>';
      }).join('');
    }
    return '';
  }

  var TABS = [
    { k:'boon', n:'赐福' },
    { k:'rule', n:'规则' },
    { k:'gang', n:'天罡' },
    { k:'di',   n:'地煞' },
    { k:'war',  n:'武将' },
    { k:'god',  n:'神明' },
    { k:'mech', n:'机制' }
  ];

  function render(){
    var tabsHtml = TABS.map(function(t){
      var on = (t.k === tab);
      return '<button class="star-btn" style="width:auto;margin:0;padding:5px 9px;font-size:11px;'+
        (on ? 'background:linear-gradient(160deg,#c9a961,#8a6f30);color:#1a1208' : 'background:#1a1410;color:#9a8f78;border:1px solid #4a3f30')+
        '" onclick="Handbook._tab(\''+t.k+'\')">'+t.n+'</button>';
    }).join('');

    var html =
      '<div style="padding:14px 12px 8px">'+
        '<div style="text-align:center;font-size:15px;font-weight:900;color:#c9a961;letter-spacing:3px;margin-bottom:4px">📖 游 戏 手 册</div>'+
        '<div style="text-align:center;font-size:10px;color:#8a7f68;margin-bottom:9px">整局随时可查 · 咱们加的全部内容</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin-bottom:10px">'+tabsHtml+'</div>'+
        '<div id="hbBody" style="max-height:330px;overflow-y:auto;padding-right:2px">'+renderBody()+'</div>'+
      '</div>'+
      '<button class="star-btn" style="background:linear-gradient(160deg,#2a2219,#1a1410);color:#ddd2b8;border:1px solid #5a4f3a" onclick="Handbook.close()">关 闭</button>';

    var P = document.getElementById('popup'), txt = document.getElementById('popuptext');
    txt.innerHTML = html;
    P.className = 'star-popup';
    P.style.width = '350px'; P.style.minWidth = '350px'; P.style.padding = '0';
    P.style.background = 'linear-gradient(160deg,#241c16 0%,#12100c 100%)';
    P.style.borderColor = '#8a7040';
    var wrap = document.getElementById('popupwrap'), bgel = document.getElementById('popupbackground');
    if(bgel) bgel.style.display = 'block';
    wrap.style.display = 'block';
  }

  function open(t){
    if(t) tab = t;
    render();
  }

  function setTab(k){
    tab = k;
    render();
  }

  function close(){
    var bgel = document.getElementById('popupbackground');
    var wrap = document.getElementById('popupwrap');
    if(bgel) bgel.style.display = 'none';
    if(wrap) wrap.style.display = 'none';
    var P = document.getElementById('popup');
    if(P){ P.className = ''; P.style.background = ''; P.style.borderColor = ''; }
  }

  window.Handbook = { open: open, close: close, _tab: setTab };
})();
