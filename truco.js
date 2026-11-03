/*
 * Motor del Truco (2 jugadores, mazo español de 40 cartas, sin flor).
 * Sin dependencias: funciona en el navegador (window.Truco) y en Node (module.exports).
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Truco = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SUITS = ['espada', 'basto', 'oro', 'copa'];
  const SUIT_LABEL = { espada: 'Espada', basto: 'Basto', oro: 'Oro', copa: 'Copa' };
  const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
  const FIGURE = { 10: 'Sota', 11: 'Caballo', 12: 'Rey' };

  // Jerarquía de las cartas: 1 espada > 1 basto > 7 espada > 7 oro > 3 > 2 > 1 > 12 > 11 > 10 > 7 > 6 > 5 > 4
  const SPECIAL_POWER = { '1-espada': 28, '1-basto': 27, '7-espada': 26, '7-oro': 25 };
  const NUMBER_POWER = { 3: 24, 2: 23, 1: 22, 12: 21, 11: 20, 10: 19, 7: 18, 6: 17, 5: 16, 4: 15 };

  const ENVIDO_AMOUNT = { 'envido': 2, 'envido envido': 2, 'real envido': 3 };
  const ENVIDO_LABEL = {
    'envido': 'Envido',
    'envido envido': 'Envido, envido',
    'real envido': 'Real envido',
    'falta envido': 'Falta envido',
  };
  const NEXT_ENVIDO = {
    '': ['envido'],
    'envido': ['envido envido', 'real envido'],
    'envido envido': ['real envido', 'falta envido'],
    'real envido': ['falta envido'],
    'falta envido': [],
  };
  const TRUCO_LABEL = ['Truco', 'Retruco', 'Vale cuatro'];

  function other(who) {
    return who === 'player' ? 'cpu' : 'player';
  }

  function name(who) {
    return who === 'player' ? 'Vos' : 'La máquina';
  }

  function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const number of NUMBERS) deck.push({ n: number, s: suit });
    }
    return deck;
  }

  function shuffle(cards, rng) {
    const random = rng || Math.random;
    const deck = cards.slice();
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  function power(card) {
    return SPECIAL_POWER[card.n + '-' + card.s] ?? NUMBER_POWER[card.n];
  }

  function envidoValue(number) {
    return number <= 7 ? number : 0;
  }

  function envidoPoints(cards) {
    let best = 0;
    for (const suit of SUITS) {
      const group = cards.filter((card) => card.s === suit);
      if (!group.length) continue;
      const sum = group.reduce((total, card) => total + envidoValue(card.n), 0);
      best = Math.max(best, group.length >= 2 ? 20 + sum : sum);
    }
    return best;
  }

  function cardLabel(card) {
    return (FIGURE[card.n] || card.n) + ' de ' + SUIT_LABEL[card.s];
  }

  function log(game, text, kind) {
    game.log.push({ text: text, kind: kind || 'info' });
    if (game.log.length > 60) game.log.shift();
  }

  function createGame(options) {
    const opts = options || {};
    const game = {
      rng: opts.rng || Math.random,
      target: opts.target || 15,
      scores: { player: 0, cpu: 0 },
      mano: 'player',
      handNumber: 0,
      phase: 'playing', // playing | handOver | gameOver
      winner: null,
      handWinner: null,
      log: [],
      hands: { player: [], cpu: [] },
      table: [],
      tricks: { player: 0, cpu: 0 },
      round: 0,
      handValue: 1,
      trucoLevel: 0,
      envido: { lastStep: '', total: 0, done: false },
      pending: null, // { type: 'envido'|'truco', caller, amount, step?, level? }
      turn: 'player',
    };
    startHand(game);
    return game;
  }

  function startHand(game) {
    game.handNumber += 1;
    const deck = shuffle(createDeck(), game.rng);
    game.hands = { player: deck.slice(0, 3), cpu: deck.slice(3, 6) };
    game.table = [];
    game.tricks = { player: 0, cpu: 0 };
    game.round = 0;
    game.handValue = 1;
    game.trucoLevel = 0;
    game.envido = { lastStep: '', total: 0, done: false };
    game.pending = null;
    game.phase = 'playing';
    game.handWinner = null;
    game.winner = null;
    game.turn = game.mano;
    log(game, 'Mano ' + game.handNumber + ': juega primero ' + name(game.mano).toLowerCase() + '.', 'info');
  }

  function nextHand(game) {
    if (game.phase !== 'handOver') return false;
    startHand(game);
    return true;
  }

  function canCallEnvido(game) {
    return game.phase === 'playing' && !game.pending && !game.envido.done &&
      game.round === 0 && game.table.length === 0 &&
      NEXT_ENVIDO[game.envido.lastStep].length > 0;
  }

  function canCallTruco(game) {
    return game.phase === 'playing' && !game.pending && game.trucoLevel < 3;
  }

  function envidoAmount(game, step) {
    if (step === 'falta envido') {
      return Math.max(1, game.target - Math.max(game.scores.player, game.scores.cpu));
    }
    return ENVIDO_AMOUNT[step];
  }

  function award(game, who, points, reason) {
    game.scores[who] += points;
    log(game, name(who) + ' suma ' + points + (points === 1 ? ' punto' : ' puntos') + ' (' + reason + ').', 'score');
    if (game.scores[who] >= game.target) {
      game.phase = 'gameOver';
      game.winner = who;
      log(game, '¡Ganó ' + name(who) + ' la partida!', 'end');
    }
  }

  function endHand(game, winner, points, reason) {
    game.handWinner = winner;
    award(game, winner, points, reason);
    if (game.phase !== 'gameOver') {
      game.phase = 'handOver';
      game.mano = winner;
    }
  }

  function callEnvido(game, caller, step) {
    if (!canCallEnvido(game)) return false;
    if (!NEXT_ENVIDO[game.envido.lastStep].includes(step)) return false;

    const amount = envidoAmount(game, step);
    const total = game.envido.total + amount;
    game.envido.lastStep = step;
    game.envido.total = total;
    game.pending = { type: 'envido', caller: caller, amount: total, step: step };

    log(game, name(caller) + ' canta ' + ENVIDO_LABEL[step] + ' (' + total + ').', 'call');
    return true;
  }

  function callTruco(game, caller) {
    if (!canCallTruco(game)) return false;
    const level = game.trucoLevel + 1;
    game.pending = { type: 'truco', caller: caller, level: level, amount: level };
    log(game, name(caller) + ' canta ' + TRUCO_LABEL[level - 1] + ' (' + level + ').', 'call');
    return true;
  }

  function resolveEnvido(game, pending) {
    const playerPoints = envidoPoints(game.hands.player);
    const cpuPoints = envidoPoints(game.hands.cpu);
    let winner;
    if (playerPoints === cpuPoints) winner = game.mano;
    else winner = playerPoints > cpuPoints ? 'player' : 'cpu';

    log(game, 'Envido: vos ' + playerPoints + ' — máquina ' + cpuPoints + '.', 'info');
    award(game, winner, pending.amount, 'envido');
    game.envido.done = true;
    game.pending = null;
    if (game.phase === 'playing') game.turn = game.mano;
  }

  function answer(game, accept) {
    const pending = game.pending;
    if (!pending) return false;

    if (pending.type === 'envido') {
      if (accept) {
        log(game, name(other(pending.caller)) + ' dice: ¡Quiero!', 'answer');
        resolveEnvido(game, pending);
      } else {
        log(game, name(other(pending.caller)) + ' dice: No quiero.', 'answer');
        game.envido.done = true;
        game.pending = null;
        award(game, pending.caller, 1, 'envido no querido');
        if (game.phase === 'playing') game.turn = game.mano;
      }
      return true;
    }

    if (pending.type === 'truco') {
      if (accept) {
        game.trucoLevel = pending.level;
        game.handValue = pending.level + 1;
        game.pending = null;
        log(game, name(other(pending.caller)) + ' dice: ¡Quiero! La mano vale ' + game.handValue + '.', 'answer');
      } else {
        log(game, name(other(pending.caller)) + ' dice: No quiero.', 'answer');
        game.pending = null;
        endHand(game, pending.caller, pending.level, 'truco no querido');
      }
      return true;
    }

    return false;
  }

  function playCard(game, who, index) {
    if (game.phase !== 'playing' || game.pending || game.turn !== who) return false;
    const hand = game.hands[who];
    if (!hand || index < 0 || index >= hand.length) return false;

    const card = hand.splice(index, 1)[0];
    game.table.push({ owner: who, card: card });
    log(game, name(who) + ' juega ' + cardLabel(card) + '.', 'play');

    if (game.table.length < 2) {
      game.turn = other(who);
      return true;
    }

    resolveTrick(game);
    return true;
  }

  function resolveTrick(game) {
    const [first, second] = game.table;
    const firstPower = power(first.card);
    const secondPower = power(second.card);
    const winner = firstPower === secondPower ? null : (firstPower > secondPower ? first.owner : second.owner);

    game.round += 1;
    game.table = [];

    if (winner) {
      game.tricks[winner] += 1;
      log(game, 'Baza ' + game.round + ': la gana ' + name(winner).toLowerCase() + '.', 'trick');
    } else {
      log(game, 'Baza ' + game.round + ': parda.', 'trick');
    }

    if (game.tricks.player >= 2 || game.tricks.cpu >= 2 || game.round === 3) {
      const handWinner = game.tricks.player > game.tricks.cpu
        ? 'player'
        : game.tricks.cpu > game.tricks.player
          ? 'cpu'
          : game.mano;
      log(game, 'Mano para ' + name(handWinner).toLowerCase() + ' (' + game.tricks.player + '-' + game.tricks.cpu + ').', 'trick');
      endHand(game, handWinner, game.handValue, 'mano ganada');
      return;
    }

    game.turn = winner || game.mano;
  }

  function fold(game, who) {
    if (game.phase !== 'playing' || game.pending || game.turn !== who) return false;
    log(game, name(who) + ' se va al mazo.', 'answer');
    endHand(game, other(who), game.handValue, 'mazo');
    return true;
  }

  /* ---------- Decisiones de la máquina ---------- */

  function cpuStrength(game) {
    const cards = game.hands.cpu;
    if (!cards.length) return 0;
    return cards.reduce((total, card) => total + power(card), 0) / cards.length;
  }

  function cpuWantsTruco(game) {
    const strength = cpuStrength(game);
    const chance = strength >= 23 ? 0.55 : strength >= 20 ? 0.25 : 0.08;
    return game.rng() < chance;
  }

  function cpuAnswersTruco(game) {
    const strength = cpuStrength(game);
    const need = 16 + game.pending.level * 1.5;
    return strength >= need || game.rng() < 0.15;
  }

  function cpuEnvidoRaise(game) {
    const points = envidoPoints(game.hands.cpu);
    const options = NEXT_ENVIDO[game.envido.lastStep];
    if (points < 30 || !options.length || game.rng() > 0.45) return null;
    return options[options.length - 1];
  }

  function cpuAnswersEnvido(game) {
    const points = envidoPoints(game.hands.cpu);
    const need = game.pending.amount >= 7 ? 30 : game.pending.amount >= 4 ? 27 : 25;
    return points >= need || game.rng() < 0.1;
  }

  function cpuMaybeCallEnvido(game) {
    if (!canCallEnvido(game)) return false;
    const points = envidoPoints(game.hands.cpu);
    if (points < 28) return false;
    if (game.rng() > 0.5) return false;
    return callEnvido(game, 'cpu', 'envido');
  }

  function cpuChooseCard(game) {
    const hand = game.hands.cpu;
    if (hand.length === 1) return 0;

    const powers = hand.map(power);
    const lowest = powers.indexOf(Math.min(...powers));
    const highest = powers.indexOf(Math.max(...powers));

    if (!game.table.length) {
      // Si la mano vale puntos, asegura con la más alta; si no, tantea con la más baja.
      return game.handValue > 1 ? highest : lowest;
    }

    const rivalPower = power(game.table[0].card);
    let best = -1;
    for (let i = 0; i < powers.length; i++) {
      if (powers[i] > rivalPower && (best === -1 || powers[i] < powers[best])) best = i;
    }
    if (best !== -1) return best;

    // No puede ganar la baza: en la última, tira la más alta; si no, la más baja.
    return game.round === 2 ? highest : lowest;
  }

  return {
    SUITS,
    SUIT_LABEL,
    TRUCO_LABEL,
    ENVIDO_LABEL,
    createDeck,
    shuffle,
    power,
    envidoPoints,
    envidoValue,
    cardLabel,
    createGame,
    startHand,
    nextHand,
    canCallEnvido,
    canCallTruco,
    callEnvido,
    callTruco,
    answer,
    playCard,
    fold,
    other,
    name,
    cpuWantsTruco,
    cpuAnswersTruco,
    cpuAnswersEnvido,
    cpuEnvidoRaise,
    cpuMaybeCallEnvido,
    cpuChooseCard,
    cpuStrength,
    NEXT_ENVIDO,
  };
});
