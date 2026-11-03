/*
 * Interfaz del juego: login simple + render del estado del motor.
 * El login es un filtro del lado del cliente (no es seguridad real).
 */
(function () {
  'use strict';

  const T = window.Truco;
  const AUTH_KEY = 'pagina-web-truco-auth';
  const USER = 'Admin';
  const PASSWORD_HASH = '7045830c'; // FNV-1a de la contraseña; ofusca, no protege.

  const $ = function (id) { return document.getElementById(id); };

  const el = {
    loginView: $('login-view'),
    gameView: $('game-view'),
    loginForm: $('login-form'),
    loginUser: $('login-user'),
    loginPass: $('login-pass'),
    loginError: $('login-error'),
    scorePlayer: $('score-player'),
    scoreCpu: $('score-cpu'),
    handValue: $('hand-value'),
    status: $('status'),
    cpuHand: $('cpu-hand'),
    table: $('table'),
    playerHand: $('player-hand'),
    actions: $('actions'),
    log: $('log'),
    logout: $('logout'),
  };

  let game = null;
  let timer = null;

  function hash(text) {
    let value = 0x811c9dc5;
    for (const char of text) {
      value ^= char.charCodeAt(0);
      value = Math.imul(value, 0x01000193) >>> 0;
    }
    return value.toString(16).padStart(8, '0');
  }

  function showGame() {
    el.loginView.hidden = true;
    el.gameView.hidden = false;
    newGame();
  }

  function showLogin() {
    el.loginView.hidden = false;
    el.gameView.hidden = true;
    el.loginPass.value = '';
    el.loginError.hidden = true;
  }

  /* ---------- Login ---------- */

  el.loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const userOk = el.loginUser.value.trim().toLowerCase() === USER.toLowerCase();
    const passOk = hash(el.loginPass.value) === PASSWORD_HASH;

    if (userOk && passOk) {
      try { sessionStorage.setItem(AUTH_KEY, '1'); } catch (error) { /* modo privado */ }
      showGame();
    } else {
      el.loginError.hidden = false;
      el.loginPass.value = '';
      el.loginPass.focus();
    }
  });

  el.logout.addEventListener('click', function () {
    try { sessionStorage.removeItem(AUTH_KEY); } catch (error) { /* modo privado */ }
    clearTimeout(timer);
    game = null;
    showLogin();
  });

  /* ---------- Juego ---------- */

  function newGame() {
    clearTimeout(timer);
    game = T.createGame({ target: 15 });
    // La máquina puede cantar envido antes de la primera carta.
    render();
    schedule();
  }

  function cardElement(card, onClick) {
    const node = document.createElement(onClick ? 'button' : 'div');
    node.className = 'card suit-' + card.s;
    if (onClick) {
      node.type = 'button';
      node.addEventListener('click', onClick);
    }
    node.setAttribute('aria-label', T.cardLabel(card));

    const number = document.createElement('span');
    number.className = 'card-num';
    number.textContent = card.n;

    const suit = document.createElement('span');
    suit.className = 'card-suit';
    suit.textContent = T.SUIT_LABEL[card.s];

    node.append(number, suit);
    return node;
  }

  function cardBack() {
    const node = document.createElement('div');
    node.className = 'card back';
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function canPlay() {
    return game && game.phase === 'playing' && !game.pending && game.turn === 'player';
  }

  function render() {
    if (!game) return;

    el.scorePlayer.textContent = game.scores.player;
    el.scoreCpu.textContent = game.scores.cpu;
    el.handValue.textContent = game.handValue > 1 ? 'Mano vale ' + game.handValue : '';

    // Mano del jugador
    el.playerHand.replaceChildren();
    game.hands.player.forEach(function (card, index) {
      el.playerHand.append(cardElement(card, canPlay() ? function () { play(index); } : null));
    });

    // Mano de la máquina (tapada)
    el.cpuHand.replaceChildren();
    game.hands.cpu.forEach(function () { el.cpuHand.append(cardBack()); });

    // Mesa
    el.table.replaceChildren();
    game.table.forEach(function (entry) {
      const slot = document.createElement('div');
      slot.className = 'slot ' + entry.owner;
      slot.append(cardElement(entry.card, null));
      el.table.append(slot);
    });
    if (!game.table.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = game.round === 0 ? '— primera baza —' : '— baza ' + Math.min(game.round + 1, 3) + ' —';
      el.table.append(empty);
    }

    el.status.textContent = statusText();
    renderActions();
    renderLog();
  }

  function statusText() {
    if (game.phase === 'gameOver') {
      return game.winner === 'player' ? '¡Ganaste la partida! 🎉' : 'Ganó la máquina. ¿Revancha?';
    }
    if (game.phase === 'handOver') {
      const who = game.handWinner === 'player' ? 'Ganaste la mano' : 'La máquina ganó la mano';
      return who + ' (' + game.tricks.player + '-' + game.tricks.cpu + ').';
    }
    if (game.pending) {
      const caller = game.pending.caller === 'player' ? 'Cantaste' : 'La máquina cantó';
      const label = game.pending.type === 'envido'
        ? T.ENVIDO_LABEL[game.pending.step]
        : T.TRUCO_LABEL[game.pending.level - 1];
      if (game.pending.caller === 'player') return caller + ' ' + label + ' (' + game.pending.amount + '). Esperando respuesta…';
      return caller + ' ' + label + ' (' + game.pending.amount + '). ¿Querés?';
    }
    if (game.turn === 'cpu') return 'Turno de la máquina…';
    return game.table.length ? 'Tu turno: respondé la baza.' : 'Tu turno: tirá una carta.';
  }

  function button(text, className, onClick) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'btn ' + (className || '');
    node.textContent = text;
    node.addEventListener('click', onClick);
    return node;
  }

  function renderActions() {
    el.actions.replaceChildren();

    if (game.phase === 'gameOver') {
      el.actions.append(button('Jugar otra vez', 'primary', newGame));
      return;
    }

    if (game.phase === 'handOver') {
      el.actions.append(button('Siguiente mano', 'primary', function () {
        T.nextHand(game);
        render();
        schedule();
      }));
      return;
    }

    if (game.pending && game.pending.caller === 'cpu') {
      el.actions.append(
        button('Quiero', 'primary', function () { answer(true); }),
        button('No quiero', 'secondary', function () { answer(false); })
      );
      return;
    }

    if (game.pending) return; // esperando a la máquina

    if (game.turn !== 'player') {
      // El envido se puede cantar antes de la primera carta, aunque reparta la máquina.
      if (T.canCallEnvido(game)) {
        T.NEXT_ENVIDO[game.envido.lastStep].forEach(function (step) {
          el.actions.append(button(T.ENVIDO_LABEL[step], 'secondary', function () { callEnvido(step); }));
        });
      }
      const thinking = document.createElement('p');
      thinking.className = 'thinking';
      thinking.textContent = 'La máquina está pensando…';
      el.actions.append(thinking);
      return;
    }

    if (T.canCallEnvido(game)) {
      T.NEXT_ENVIDO[game.envido.lastStep].forEach(function (step) {
        el.actions.append(button(T.ENVIDO_LABEL[step], 'secondary', function () { callEnvido(step); }));
      });
    }

    if (T.canCallTruco(game)) {
      const label = T.TRUCO_LABEL[game.trucoLevel];
      el.actions.append(button(label, 'accent', function () { callTruco(); }));
    }

    el.actions.append(button('Irse al mazo', 'ghost', function () { fold(); }));
  }

  function renderLog() {
    el.log.replaceChildren();
    game.log.slice(-8).forEach(function (entry) {
      const item = document.createElement('li');
      item.className = entry.kind;
      item.textContent = entry.text;
      el.log.append(item);
    });
    el.log.scrollTop = el.log.scrollHeight;
  }

  /* ---------- Acciones ---------- */

  function play(index) {
    if (!canPlay()) return;
    T.playCard(game, 'player', index);
    render();
    schedule();
  }

  function callEnvido(step) {
    T.callEnvido(game, 'player', step);
    render();
    schedule();
  }

  function callTruco() {
    T.callTruco(game, 'player');
    render();
    schedule();
  }

  function answer(accept) {
    T.answer(game, accept);
    render();
    schedule();
  }

  function fold() {
    T.fold(game, 'player');
    render();
    schedule();
  }

  /* ---------- Turno de la máquina ---------- */

  function schedule() {
    clearTimeout(timer);
    if (!game || game.phase !== 'playing') return;

    if (game.pending) {
      if (game.pending.caller === 'player') timer = setTimeout(cpuRespond, 900);
      return; // si cantó la máquina, respondemos nosotros
    }

    if (game.turn === 'cpu') timer = setTimeout(cpuTurn, 900);
  }

  function cpuRespond() {
    if (!game || !game.pending || game.pending.caller !== 'player') return;

    if (game.pending.type === 'envido') {
      const raise = T.cpuEnvidoRaise(game);
      if (raise) T.callEnvido(game, 'cpu', raise);
      else T.answer(game, T.cpuAnswersEnvido(game));
    } else {
      T.answer(game, T.cpuAnswersTruco(game));
    }

    render();
    schedule();
  }

  function cpuTurn() {
    if (!game || game.phase !== 'playing' || game.turn !== 'cpu' || game.pending) return;

    if (T.canCallEnvido(game) && game.round === 0 && T.cpuMaybeCallEnvido(game)) {
      render();
      schedule();
      return;
    }

    if (T.canCallTruco(game) && T.cpuWantsTruco(game)) {
      T.callTruco(game, 'cpu');
      render();
      schedule();
      return;
    }

    T.playCard(game, 'cpu', T.cpuChooseCard(game));
    render();
    schedule();
  }

  /* ---------- Arranque ---------- */

  let stored = null;
  try { stored = sessionStorage.getItem(AUTH_KEY); } catch (error) { stored = null; }

  if (stored) showGame();
  else showLogin();
})();
