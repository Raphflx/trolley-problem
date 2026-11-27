// Tests des fonctions pures de calcul. Lancer depuis la racine :  node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  bornesAxes, scoresBruts, normaliser, calculerScores,
  compterMots, mediane, scoreInstinct, scoreCoherence,
} from '../js/scores.js';
import { choisirProfil, textesMarques, texteZone } from '../js/profils.js';
import { controlerFormat, analyserJumeaux, couvertureAxes, simuler } from '../outils/analyse.js';

const lire = (f) => JSON.parse(fs.readFileSync(new URL(`../data/${f}`, import.meta.url)));

// Jeu de données minimal
const AXES = ['a', 'b', 'c'];
const DILEMMES = [
  {
    id: 'd1', texte: 'un deux trois quatre', minuteur: null,
    options: [
      { id: 'x', passive: false, points: { a: 2, b: -1 } },
      { id: 'y', passive: true, points: { b: 1 } },
    ],
    jumeau: { groupe: 'g', logique: { x: 'A', y: 'B' } },
  },
  {
    id: 'd2', texte: 'un deux', minuteur: 10,
    options: [
      { id: 'x', passive: false, points: { a: 1 } },
      { id: 'y', passive: true, points: { a: -2 } },
    ],
    jumeau: { groupe: 'g', logique: { x: 'A', y: 'B' } },
  },
];

test('bornesAxes : somme des min et max par dilemme, 0 si absent', () => {
  const b = bornesAxes(DILEMMES, AXES);
  assert.deepEqual(b.a, { min: 0 + -2, max: 2 + 1, nbDilemmes: 2 });
  assert.deepEqual(b.b, { min: -1, max: 1, nbDilemmes: 1 });
  assert.deepEqual(b.c, { min: 0, max: 0, nbDilemmes: 0 });
});

test('scoresBruts et normalisation', () => {
  const choix = [{ dilemmeId: 'd1', optionId: 'x' }, { dilemmeId: 'd2', optionId: 'y' }];
  const bruts = scoresBruts(DILEMMES, choix, AXES);
  assert.deepEqual(bruts, { a: 0, b: -1, c: 0 });
  const { scores, anomalies } = normaliser(bruts, bornesAxes(DILEMMES, AXES));
  assert.equal(scores.a, 40); // (0 - -2) / (3 - -2) = 0.4
  assert.equal(scores.b, 0);
  assert.equal(scores.c, 50); // axe jamais touché
  assert.deepEqual(anomalies, ['c']);
});

test('extrêmes : choix maximisant un axe → 100', () => {
  const choix = [{ dilemmeId: 'd1', optionId: 'x' }, { dilemmeId: 'd2', optionId: 'x' }];
  assert.equal(calculerScores(DILEMMES, choix, AXES).scores.a, 100);
});

test('compterMots et mediane', () => {
  assert.equal(compterMots("  L'aiguillage : un test — oui. "), 4);
  assert.equal(mediane([5, 1, 3]), 3);
  assert.equal(mediane([4, 1, 3, 2]), 2.5);
  assert.equal(mediane([]), null);
});

test('scoreInstinct : retire la lecture, ignore les minuteurs, bornes 2 s / 15 s', () => {
  // d1 = 4 mots → 1 s de lecture
  const rapide = scoreInstinct(DILEMMES, [{ dilemmeId: 'd1', optionId: 'x', tempsMs: 2500 }, { dilemmeId: 'd2', optionId: 'x', tempsMs: 60000 }]);
  assert.equal(rapide.position, 0); // 1,5 s ajusté ≤ 2 s ; d2 ignoré (minuteur)
  const lent = scoreInstinct(DILEMMES, [{ dilemmeId: 'd1', optionId: 'x', tempsMs: 30000 }]);
  assert.equal(lent.position, 100);
  const milieu = scoreInstinct(DILEMMES, [{ dilemmeId: 'd1', optionId: 'x', tempsMs: 9500 }]);
  assert.equal(milieu.position, 50); // 8,5 s → (8,5-2)/13 = 0,5
  assert.equal(scoreInstinct(DILEMMES, []).position, null);
});

test('scoreCoherence', () => {
  const coherent = scoreCoherence(DILEMMES, [{ dilemmeId: 'd1', optionId: 'x' }, { dilemmeId: 'd2', optionId: 'x' }]);
  assert.equal(coherent.score, 100);
  const incoherent = scoreCoherence(DILEMMES, [{ dilemmeId: 'd1', optionId: 'x' }, { dilemmeId: 'd2', optionId: 'y' }]);
  assert.equal(incoherent.score, 0);
  assert.equal(scoreCoherence([{ ...DILEMMES[0], jumeau: undefined }], []).score, null);
});

test('choisirProfil : équilibré, puis meilleure correspondance, puis somme', () => {
  const axes = ['u', 'p', 'e', 'l'];
  const profils = [
    { id: 'eq', condition: { equilibre: true, ecartMax: 25 } },
    { id: 'up', condition: { dominants: ['u', 'p'] } },
    { id: 'el', condition: { dominants: ['e', 'l'] } },
    { id: 'ue', condition: { dominants: ['u', 'e'] } },
  ];
  assert.equal(choisirProfil(profils, { u: 60, p: 50, e: 45, l: 40 }, axes).profil.id, 'eq');
  assert.equal(choisirProfil(profils, { u: 90, p: 80, e: 20, l: 10 }, axes).profil.id, 'up');
  // top 3 = u, e, p : 'up' et 'ue' ont 2 correspondances ; somme u+e (170) > u+p (150)
  assert.equal(choisirProfil(profils, { u: 90, p: 60, e: 80, l: 10 }, axes).profil.id, 'ue');
});

test('textesMarques : seuils 70 / 30, 3 au maximum, les plus éloignés de 50', () => {
  const textes = {
    seuils: { eleve: 70, faible: 30, nombreAffiches: 3 },
    axes: Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((x) => [x, { eleve: `${x}+`, faible: `${x}-` }])),
  };
  const r = textesMarques(textes, { a: 70, b: 5, c: 50, d: 95, e: 31 }, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(r.map((t) => t.texte), ['b-', 'd+', 'a+']);
});

test('texteZone', () => {
  const zones = [{ max: 49, texte: 'bas' }, { max: 79, texte: 'moyen' }, { max: 100, texte: 'haut' }];
  assert.equal(texteZone(zones, 49), 'bas');
  assert.equal(texteZone(zones, 50), 'moyen');
  assert.equal(texteZone(zones, 80), 'haut');
  assert.equal(texteZone(zones, null), null);
});

// --- Données réelles --------------------------------------------------------

test('data/ : format valide, axes couverts, jumeaux valides', () => {
  const axes = lire('axes.json').map((a) => a.id);
  const dilemmes = lire('dilemmes.json');
  assert.equal(axes.length, 8);
  assert.ok(dilemmes.length >= 12 && dilemmes.length <= 15, 'entre 12 et 15 dilemmes');
  assert.deepEqual(controlerFormat(dilemmes, axes), []);
  assert.ok(couvertureAxes(dilemmes, axes).every((c) => !c.alerte));
  assert.ok(analyserJumeaux(dilemmes).every((j) => j.valide));
});

test('data/ : chaque axe a ses textes, chaque profil cite des axes existants', () => {
  const axes = lire('axes.json').map((a) => a.id);
  const textes = lire('textes.json');
  for (const a of axes) assert.ok(textes.axes[a]?.eleve && textes.axes[a]?.faible, `textes de ${a}`);
  for (const p of lire('profils.json')) {
    for (const a of p.condition.dominants || []) assert.ok(axes.includes(a), `${p.id} : ${a}`);
  }
});

test('data/ : simulation sans alerte de profil', () => {
  const axes = lire('axes.json').map((a) => a.id);
  const sim = simuler(lire('dilemmes.json'), axes, lire('profils.json'), 1000);
  assert.deepEqual(sim.alertes, []);
});
