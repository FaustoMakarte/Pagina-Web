'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../truco.js');

function seeded(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function card(n, s) {
  return { n: n, s: s };
}

test('el mazo tiene 40 cartas únicas', () => {
  const deck = T.createDeck();
  assert.equal(deck.length, 40);
  assert.equal(new Set(deck.map((c) => c.n + '-' + c.s)).size, 40);
});

test('jerarquía de cartas', () => {
  const order = [
    [1, 'espada'], [1, 'basto'], [7, 'espada'], [7, 'oro'],
    [3, 'copa'], [2, 'oro'], [1, 'copa'], [12, 'basto'],
    [11, 'oro'], [10, 'copa'], [7, 'copa'], [6, 'oro'], [5, 'basto'], [4, 'espada'],
  ];
  for (let i = 0; i < order.length - 1; i++) {
    const a = T.power(card(order[i][0], order[i][1]));
    const b = T.power(card(order[i + 1][0], order[i + 1][1]));
    assert.ok(a > b, `esperaba ${order[i]} > ${order[i + 1]}`);
  }
});

test('puntos de envido', () => {
  assert.equal(T.envidoPoints([card(7, 'oro'), card(6, 'oro'), card(1, 'copa')]), 33);
  assert.equal(T.envidoPoints([card(4, 'oro'), card(5, 'basto'), card(6, 'copa')]), 6);
  assert.equal(T.envidoPoints([card(10, 'oro'), card(11, 'basto'), card(12, 'copa')]), 0);
  assert.equal(T.envidoPoints([card(1, 'espada'), card(2, 'espada'), card(3, 'copa')]), 23);
});

test('envido no querido da 1 punto al que cantó', () => {
  const game = T.createGame({ rng: seeded(1) });
  assert.equal(T.callEnvido(game, 'player', 'envido'), true);
  assert.equal(game.pending.amount, 2);
  assert.equal(T.answer(game, false), true);
  assert.equal(game.scores.player, 1);
  assert.equal(game.envido.done, true);
});

test('envido querido se resuelve por puntos', () => {
  const game = T.createGame({ rng: seeded(2) });
  game.hands.player = [card(7, 'oro'), card(6, 'oro'), card(4, 'copa')];
  game.hands.cpu = [card(2, 'basto'), card(3, 'basto'), card(5, 'espada')];
  T.callEnvido(game, 'player', 'envido');
  T.answer(game, true);
  assert.equal(game.scores.player, 2);
});

test('envido empatado lo gana el mano', () => {
  const game = T.createGame({ rng: seeded(3) });
  game.mano = 'cpu';
  game.hands.player = [card(5, 'oro'), card(4, 'copa')];
  game.hands.cpu = [card(5, 'basto'), card(4, 'espada')];
  T.callEnvido(game, 'player', 'envido');
  T.answer(game, true);
  assert.equal(game.scores.cpu, 2);
});

test('truco no querido vale 1 y retruco no querido vale 2', () => {
  const game = T.createGame({ rng: seeded(4) });
  T.callTruco(game, 'cpu');
  T.answer(game, false);
  assert.equal(game.scores.cpu, 1);

  const second = T.createGame({ rng: seeded(5) });
  T.callTruco(second, 'player');
  T.answer(second, true);
  T.callTruco(second, 'cpu'); // retruco
  T.answer(second, false);
  assert.equal(second.scores.cpu, 2);
});

test('irse al mazo entrega el valor de la mano', () => {
  const game = T.createGame({ rng: seeded(6) });
  T.callTruco(game, 'player');
  T.answer(game, true);
  assert.equal(game.handValue, 2);
  T.fold(game, game.turn);
  assert.equal(game.scores[T.other(game.turn)] >= 0, true);
  assert.equal(game.phase, 'handOver');
});

test('ganar dos bazas termina la mano', () => {
  const game = T.createGame({ rng: seeded(7) });
  game.hands.player = [card(1, 'espada'), card(1, 'basto'), card(7, 'oro')];
  game.hands.cpu = [card(4, 'copa'), card(5, 'copa'), card(6, 'copa')];
  game.turn = 'player';
  T.playCard(game, 'player', 0); // 1 espada
  T.playCard(game, 'cpu', 0);    // 4 copa
  T.playCard(game, 'player', 0); // 1 basto
  T.playCard(game, 'cpu', 0);    // 5 copa
  assert.equal(game.phase, 'handOver');
  assert.equal(game.handWinner, 'player');
  assert.equal(game.scores.player, 1);
});

test('el juego siempre termina y no rompe con decisiones aleatorias', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = seeded(seed);
    const game = T.createGame({ rng: rng, target: 15 });
    let steps = 0;

    while (game.phase !== 'gameOver' && steps < 5000) {
      steps++;
      if (game.pending) {
        T.answer(game, rng() < 0.65);
        continue;
      }
      if (game.phase === 'handOver') {
        T.nextHand(game);
        continue;
      }
      if (game.turn === 'cpu') {
        if (!T.cpuMaybeCallEnvido(game) && rng() < 0.15 && T.canCallTruco(game)) {
          T.callTruco(game, 'cpu');
        } else if (!game.pending) {
          T.playCard(game, 'cpu', T.cpuChooseCard(game));
        }
        continue;
      }
      if (T.canCallEnvido(game) && rng() < 0.2) {
        T.callEnvido(game, 'player', 'envido');
      } else if (T.canCallTruco(game) && rng() < 0.2) {
        T.callTruco(game, 'player');
      } else {
        T.playCard(game, 'player', Math.floor(rng() * game.hands.player.length));
      }
    }

    assert.equal(game.phase, 'gameOver', 'seed ' + seed + ' no terminó');
    assert.ok(game.scores.player >= 15 || game.scores.cpu >= 15, 'seed ' + seed + ' sin puntaje final');
    assert.equal(game.winner, game.scores.player > game.scores.cpu ? 'player' : 'cpu');
  }
});
