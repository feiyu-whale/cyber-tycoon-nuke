/* ============================================================
 * online.js — 大富翁 · 双人联机
 * 作用：建房/加入/推操作/拉操作（轻中继，服务器不算游戏逻辑）
 * 依赖：无（原生 fetch）
 * 输入输出：操作 op 推给服务器，收到对方 op 后本地重放
 *
 * 设计（老爹 2026-10-17 定）：
 *   1. 双人，不做八人
 *   2. 服务器只当"邮局"，不裁判、不防作弊
 *   3. 逻辑全在浏览器
 * ============================================================ */
(function () {
  'use strict';

  var API = '/api/mono-room';
  var state = {
    active: false,
    roomId: null,
    seat: null,
    since: 0,
    timer: null,
    started: false,     // 2026-10-20 v43 联机是否已开局
    seed: null,
    mySeat: 0
  };

  function setStatus(txt, color) {
    var el = document.getElementById('onlineStatus');
    if (el) {
      el.textContent = txt;
      el.style.color = color || '#6a8fb0';
    }
  }

  function post(path, body) {
    return fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json(); });
  }

  /* ---------- 界面 ---------- */
  window.openOnlinePanel = function () {
    var p = document.getElementById('onlinePanel');
    if (!p) return;
    p.style.display = p.style.display === 'none' ? 'block' : 'none';
  };

  window.roomCreate = function () {
    setStatus('正在创建房间…');
    post('/create', {}).then(function (d) {
      if (!d.ok) { setStatus('创建失败：' + (d.err || '未知'), '#ff9aa8'); return; }
      state.roomId = d.id;
      state.seat = d.seat;
      var box = document.getElementById('onlineRoomBox');
      document.getElementById('onlineRoomId').textContent = d.id;
      if (box) box.style.display = 'block';
      setStatus('房间已创建 · 等待对方加入…', '#7fd4a8');
      pollLoop();
    }).catch(function () {
      setStatus('网络错误，连不上服务器', '#ff9aa8');
    });
  };

  window.roomJoinPrompt = function () {
    var rid = prompt('请输入对方的房间号：');
    if (!rid) return;
    rid = rid.trim().toLowerCase();
    setStatus('正在加入…');
    post('/join', { id: rid }).then(function (d) {
      if (!d.ok) {
        var msg = d.err === 'no-room' ? '房间不存在' : (d.err === 'room-full' ? '房间已满' : d.err);
        setStatus('加入失败：' + msg, '#ff9aa8');
        return;
      }
      state.roomId = d.id;
      state.seat = d.seat;
      setStatus('已加入房间 ' + d.id + ' · 你是座位 ' + (d.seat + 1), '#7fd4a8');
      pollLoop();
    }).catch(function () {
      setStatus('网络错误，连不上服务器', '#ff9aa8');
    });
  };

  /* ---------- 轮询 ---------- */
  function pollLoop() {
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(function () {
      fetch(API + '/poll?id=' + encodeURIComponent(state.roomId) + '&since=' + state.since)
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d.ok) {
            if (d.err === 'no-room') {
              setStatus('房间已关闭', '#ff9aa8');
              stop();
            }
            return;
          }
          if (d.seats >= 2) {
            if (!state.started) {
              setStatus('双方已就位 · 房间 ' + state.roomId, '#7fd4a8');
              // 2026-10-20 v43：双方就位 -> 房主可点开始
              var sb = document.getElementById('onlineStartBox');
              if (sb) sb.style.display = 'block';
            }
          }
          if (d.ops && d.ops.length) {
            d.ops.forEach(function (op) {
              state.since++;
              // 只重放对方（不是自己座位）的操作
              if (op._seat !== state.seat) {
                replayOp(op);
              }
            });
          }
          state.since = d.seq;
        })
        .catch(function () {});
    }, 900);
  }

  function stop() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
  }

  /* ---------- 推操作 ---------- */
  window.roomPushOp = function (op) {
    if (!state.roomId) return;
    post('/op', { id: state.roomId, seat: state.seat, op: op }).catch(function () {});
  };

  /* ---------- 2026-10-20 v43 开局 ---------- */
  window.roomStartGame = function () {
    if (!state.roomId) { setStatus('还没进房间', '#ff9aa8'); return; }
    if (state.seat !== 0) { setStatus('只有房主能开始对局', '#ff9aa8'); return; }
    if (state.started) return;
    if (state.seat === null || state.seat === undefined) { setStatus('座位信息丢失，请重新建房', '#ff9aa8'); return; }

    state.started = true;
    // 房主生成种子（1 ~ 2^31），推给对方
    var seed = (Math.floor(Math.random() * 2147483646) + 1);
    state.seed = seed;
    window.roomPushOp({ type: 'start', seed: seed });

    var sb = document.getElementById('onlineStartBox');
    if (sb) sb.style.display = 'none';
    var pnl = document.getElementById('onlinePanel');
    if (pnl) pnl.style.display = 'none';
    setStatus('对局开始 · 房间 ' + state.roomId, '#7fd4a8');

    // 房主本地同样用这个种子开局
    if (typeof setup === 'function') setup(seed);
  };

  /* ---------- 重放对方操作 ---------- */
  function replayOp(op) {
    if (!op || !op.type) return;
    try {
      switch (op.type) {
        case 'start':
          // 2026-10-20 v43 联机开局：收到房主的开始信号 -> 用同一个种子开局
          if (!state.started) {
            state.started = true;
            var sb2 = document.getElementById('onlineStartBox');
            if (sb2) sb2.style.display = 'none';
            var pnl = document.getElementById('onlinePanel');
            if (pnl) pnl.style.display = 'none';
            setStatus('对局开始 · 房间 ' + state.roomId, '#7fd4a8');
            if (typeof setup === 'function') setup(op.seed);
          }
          break;

        case 'buy':
          // 对方买下地皮：本地把该格归属改过去
          if (typeof square !== 'undefined' && square[op.pos]) {
            square[op.pos].owner = op.owner;
            if (typeof updateOwned === 'function') updateOwned();
            if (typeof updateMoney === 'function') updateMoney();
            if (typeof addAlert === 'function') {
              addAlert('对方买下了 ' + square[op.pos].name + '。');
            }
          }
          break;

        case 'roll':
          // 对方掷骰：本地只显示提示（不重放走位动画，避免两边不同步）
          if (typeof addAlert === 'function') {
            addAlert('对方掷出 ' + op.total + ' 点。');
          }
          break;

        case 'move':
          // 对方移动：更新对方棋子位置
          if (typeof player !== 'undefined' && player[op.who]) {
            player[op.who].position = op.pos;
            if (typeof updatePosition === 'function') updatePosition();
          }
          break;

        case 'money':
          if (typeof player !== 'undefined' && player[op.who]) {
            player[op.who].money = op.amount;
            if (typeof updateMoney === 'function') updateMoney();
          }
          break;

        case 'endturn':
          if (typeof addAlert === 'function') {
            addAlert('对方结束了回合。');
          }
          break;

        default:
          break;
      }
    } catch (e) {
      console.warn('[联机] 重放失败', op, e);
    }
  }

  /* ============================================================
   * 2026-10-20 v43 两套联机并存 · 模式调度
   * mode = 'room'  -> 服务器中转（online.js / RoomOnline）
   * mode = 'p2p'   -> WebRTC 直连（p2p.js / MonopolyOnline）
   * 页面按钮统一走 onlineDispatch()
   * ============================================================ */
  var onlineMode = 'room';

  window.setOnlineMode = function (m) {
    if (m !== 'room' && m !== 'p2p') return;
    onlineMode = m;
    var rb = document.getElementById('modeRoomBtn');
    var pb = document.getElementById('modeP2PBtn');
    var tip = document.getElementById('onlineModeTip');
    if (rb && pb) {
      if (m === 'room') {
        rb.style.background = 'linear-gradient(160deg,#2a7a4a,#1a5030)';
        rb.style.borderColor = '#3fa06a';
        rb.style.color = '#d0ffe0';
        pb.style.background = '#243818';
        pb.style.borderColor = '#4a6a2a';
        pb.style.color = '#a8c090';
      } else {
        pb.style.background = 'linear-gradient(160deg,#2a7a4a,#1a5030)';
        pb.style.borderColor = '#3fa06a';
        pb.style.color = '#d0ffe0';
        rb.style.background = '#243818';
        rb.style.borderColor = '#4a6a2a';
        rb.style.color = '#a8c090';
      }
    }
    if (tip) {
      tip.textContent = (m === 'room')
        ? '服务器中转：只要两边能打开网页就能玩，稳。适合手机与电脑联机。'
        : '直连 P2P：数据不经过服务器、延迟更低，但部分网络环境打不通。';
    }
    setStatus(m === 'room' ? '模式：服务器中转（未连接）' : '模式：直连 P2P（未连接）');
  };

  /* 统一入口：页面所有联机按钮都调这个 */
  window.onlineDispatch = function (action) {
    if (onlineMode === 'p2p') {
      var P = window.MonopolyOnline;
      if (!P) { setStatus('P2P 模块未加载', '#ff9aa8'); return; }
      if (action === 'create') { if (typeof window.onlineCreate === 'function') window.onlineCreate(); }
      else if (action === 'join') { if (typeof window.onlineJoinPrompt === 'function') window.onlineJoinPrompt(); }
      else if (action === 'start') {
        if (typeof window.p2pStartGame === 'function') window.p2pStartGame();
        else setStatus('P2P 开局功能未就绪', '#ff9aa8');
      }
      return;
    }
    // room 模式
    if (action === 'create') { window.roomCreate(); }
    else if (action === 'join') { window.roomJoinPrompt(); }
    else if (action === 'start') { window.roomStartGame(); }
  };

  window.getOnlineMode = function () { return onlineMode; };

  /* 2026-10-20 v43 改名：原来叫 MonopolyOnline，被 p2p.js 覆盖
   * 现在两套并存：RoomOnline = 服务器中转 / MonopolyOnline = P2P 直连 */
  window.RoomOnline = {
    state: state,
    isActive: function () { return !!state.roomId; },
    mySeat: function () { return state.seat; },
    create: function () { window.roomCreate(); },
    join: function () { window.roomJoinPrompt(); },
    start: function () { window.roomStartGame(); },
    push: function (op) { window.roomPushOp(op); }
  };
})();
