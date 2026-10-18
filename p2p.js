/* ============================================================
 * p2p.js — 大富翁 · 纯前端 P2P 联机（WebRTC）
 * 2026-10-18 v1
 * 原则（老爹定）：坚持前端白嫖，不碰后端
 *   房主浏览器跑逻辑，对方只发指令、收状态
 *   信令借用免费公共服务（PeerJS 官方），我方服务器零参与
 * 依赖：PeerJS（CDN，按需加载）
 * ============================================================ */
(function(){
  'use strict';

  var PEERJS_CDN = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  var PREFIX = 'ctn-mono-';   // 房间码前缀，降低撞车概率

  var S = {
    role: null,        // 'host' | 'guest'
    peer: null,
    conn: null,
    roomCode: null,
    connected: false,
    libLoading: false
  };

  /* ---------- 状态显示 ---------- */
  function setStatus(txt, color){
    var el = document.getElementById('onlineStatus');
    if(el){ el.textContent = txt; el.style.color = color || '#6a8fb0'; }
  }
  function showRoom(code){
    var box = document.getElementById('onlineRoomBox');
    var idEl = document.getElementById('onlineRoomId');
    if(idEl) idEl.textContent = code;
    if(box) box.style.display = 'block';
  }

  /* ---------- 动态加载 PeerJS ---------- */
  function loadLib(cb){
    if(window.Peer){ cb(null); return; }
    if(S.libLoading){ setTimeout(function(){ loadLib(cb); }, 200); return; }
    S.libLoading = true;
    setStatus('正在加载联机组件…');
    var s = document.createElement('script');
    s.src = PEERJS_CDN;
    s.onload = function(){ S.libLoading = false; cb(null); };
    s.onerror = function(){ S.libLoading = false; cb('组件加载失败（可能是网络问题）'); };
    document.head.appendChild(s);
  }

  /* ---------- 生成房间码（6 位，好念好输） ---------- */
  function genCode(){
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // 去掉易混的 I O 0 1
    var out = '';
    for(var i=0;i<6;i++) out += chars[Math.floor(Math.random()*chars.length)];
    return out;
  }

  /* ============================================================
   * 建房（房主）
   * ============================================================ */
  window.onlineCreate = function(){
    loadLib(function(err){
      if(err){ setStatus(err, '#ff9aa8'); return; }
      var code = genCode();
      setStatus('正在创建房间 ' + code + ' …');

      var peer = new Peer(PREFIX + code, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', function(){
        S.peer = peer; S.role = 'host'; S.roomCode = code;
        showRoom(code);
        setStatus('房间已创建 · 等待对方加入…\n把这串号码发给朋友', '#7fd4a8');
      });

      peer.on('connection', function(conn){
        if(S.conn){ try{ conn.close(); }catch(e){} return; }  // 只收一个
        S.conn = conn;
        bindConn(conn);
        conn.on('open', function(){
          S.connected = true;
          setStatus('对方已连接 · 你是房主', '#7fd4a8');
          if(window.addAlert) addAlert('【联机】对方已加入房间，可以开始了。');
          // 把初始状态发过去
          sendStateFull();
        });
      });

      peer.on('error', function(e){
        if(e.type === 'unavailable-id'){
          setStatus('房间码被占用，请重新创建', '#ff9aa8');
        } else if(e.type === 'peer-unavailable'){
          setStatus('找不到该房间，请检查房间码', '#ff9aa8');
        } else {
          setStatus('连接出错：' + (e.type || e.message), '#ff9aa8');
        }
      });

      peer.on('disconnected', function(){
        setStatus('与信令服务器断开，正在重连…', '#e0c56a');
        try{ peer.reconnect(); }catch(e){}
      });
    });
  };

  /* ============================================================
   * 加入（客方）
   * ============================================================ */
  window.onlineJoinPrompt = function(){
    var code = prompt('请输入对方的房间号（6 位）：');
    if(!code) return;
    code = code.trim().toUpperCase();
    if(code.length !== 6){ setStatus('房间号应为 6 位', '#ff9aa8'); return; }

    loadLib(function(err){
      if(err){ setStatus(err, '#ff9aa8'); return; }
      setStatus('正在连接房间 ' + code + ' …');

      var peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:34702' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', function(){
        S.peer = peer; S.role = 'guest'; S.roomCode = code;
        var conn = peer.connect(PREFIX + code, { reliable: true });
        S.conn = conn;
        bindConn(conn);
        conn.on('open', function(){
          S.connected = true;
          setStatus('已加入房间 ' + code + ' · 你是客方', '#7fd4a8');
          if(window.addAlert) addAlert('【联机】已连上房主。');
          send({ t: 'hello', name: (window.player && player[1] ? player[1].name : '客方') });
        });
      });

      peer.on('error', function(e){
        if(e.type === 'peer-unavailable'){
          setStatus('找不到该房间，请确认房间号', '#ff9aa8');
        } else {
          setStatus('连接出错：' + (e.type || e.message), '#ff9aa8');
        }
      });
    });
  };

  /* ============================================================
   * 连接绑定
   * ============================================================ */
  function bindConn(conn){
    conn.on('data', function(msg){
      try { handle(msg); } catch(e){ console.warn('[p2p]', e); }
    });
    conn.on('close', function(){
      S.connected = false;
      setStatus('对方已断开' + (S.role === 'host' ? ' · 房间还在，等他重连' : ' · 房主可能关了页面'), '#ff9aa8');
    });
    conn.on('error', function(e){
      setStatus('连接异常：' + (e.type || e), '#ff9aa8');
    });
  }

  function send(obj){
    if(S.conn && S.conn.open){ try{ S.conn.send(obj); }catch(e){} }
  }

  /* ============================================================
   * 消息处理
   * ============================================================ */
  function handle(msg){
    if(!msg || !msg.t) return;

    switch(msg.t){
      case 'hello':
        if(S.role === 'host'){
          if(window.addAlert) addAlert('【联机】' + (msg.name || '对方') + ' 已加入。');
          sendStateFull();
        }
        break;

      case 'op':
        // 房主收到客方指令 → 在本地执行
        if(S.role === 'host') applyGuestOp(msg.op);
        break;

      case 'state':
        // 客方收到房主状态 → 本地照做
        if(S.role === 'guest') applyState(msg.state);
        break;

      case 'alert':
        if(window.addAlert) addAlert(msg.text);
        break;

      case 'chat':
        if(window.addAlert) addAlert('【对手】' + msg.text);
        break;

      default:
        break;
    }
  }

  /* ---------- 房主：把完整状态发过去 ---------- */
  function sendStateFull(){
    if(typeof player === 'undefined' || typeof square === 'undefined') return;
    var ps = [];
    for(var i=1;i<=pcount;i++){
      var p = player[i]; if(!p) continue;
      ps.push({
        i: i, name: p.name, money: p.money, coins: p.coins || 0,
        pos: p.position, jail: p.jail, color: p.color
      });
    }
    var sq = [];
    for(var k=0;k<square.length;k++){
      var s = square[k];
      if(!s) continue;
      sq.push({ owner: s.owner, house: s.house || 0, hotel: s.hotel ? 1 : 0 });
    }
    send({
      t: 'state',
      state: {
        turn: turn,
        pcount: pcount,
        players: ps,
        squares: sq
      }
    });
  }

  /* ---------- 客方：应用房主状态 ---------- */
  function applyState(st){
    if(!st || typeof player === 'undefined') return;
    try {
      (st.players || []).forEach(function(x){
        var p = player[x.i]; if(!p) return;
        p.name = x.name; p.money = x.money; p.coins = x.coins;
        p.position = x.pos; p.jail = x.jail;
        if(x.color) p.color = x.color;
      });
      (st.squares || []).forEach(function(x, idx){
        var s = square[idx]; if(!s) return;
        s.owner = x.owner; s.house = x.house; s.hotel = x.hotel;
      });
      if(typeof updateMoney === 'function') updateMoney();
      if(typeof updateOwned === 'function') updateOwned();
      if(typeof updatePosition === 'function') updatePosition();
    } catch(e){ console.warn('[p2p] 应用状态失败', e); }
  }

  /* ---------- 房主：执行客方指令 ---------- */
  function applyGuestOp(op){
    if(!op || !op.type) return;
    try {
      switch(op.type){
        case 'roll':
          // 客方点掷骰子 → 房主代为执行（客方是 AI 控制或人类点按钮）
          if(typeof roll === 'function' && typeof turn !== 'undefined'){
            roll();
          }
          break;
        case 'buy':
          if(typeof buy === 'function') buy();
          break;
        case 'endturn':
          if(typeof next === 'function') next();
          break;
        default:
          break;
      }
    } catch(e){ console.warn('[p2p] 执行客方指令失败', e); }
    // 执行完把状态同步回去
    setTimeout(sendStateFull, 300);
  }

  /* ============================================================
   * 对外接口（兼容原 MonopolyOnline 的调用方式）
   * ============================================================ */
  window.MonopolyOnline = {
    isActive: function(){ return S.connected; },
    isHost: function(){ return S.role === 'host'; },
    state: S,
    push: function(op){
      // 客方把操作发给房主；房主自己不需要推
      if(S.role === 'guest') send({ t: 'op', op: op });
    },
    syncState: function(){
      if(S.role === 'host') sendStateFull();
    },
    alert: function(text){
      if(window.addAlert) addAlert(text);
      send({ t: 'alert', text: text });
    }
  };

  window.P2P = {
    create: window.onlineCreate,
    join: window.onlineJoinPrompt,
    status: function(){ return S; }
  };
})();
