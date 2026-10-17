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
    timer: null
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

  window.onlineCreate = function () {
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

  window.onlineJoinPrompt = function () {
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
            setStatus('双方已就位 · 房间 ' + state.roomId, '#7fd4a8');
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
  window.pushOp = function (op) {
    if (!state.roomId) return;
    post('/op', { id: state.roomId, seat: state.seat, op: op }).catch(function () {});
  };

  /* ---------- 重放对方操作 ---------- */
  function replayOp(op) {
    if (!op || !op.type) return;
    try {
      switch (op.type) {
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

  window.MonopolyOnline = {
    state: state,
    isActive: function () { return !!state.roomId; },
    mySeat: function () { return state.seat; },
    push: function (op) { window.pushOp(op); }
  };
})();
