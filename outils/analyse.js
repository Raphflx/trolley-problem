// analyse.js — analyses du barème utilisées par verification.html (et les tests).
// Fonctions pures, sans DOM.

import { bornesAxes, calculerScores } from '../js/scores.js';
import { choisirProfil } from '../js/profils.js';

/** Paires d'axes à ne pas confondre (CLAUDE.md, section 4.3). */
export const PAIRES_SURVEILLEES = [
  ['interventionnisme', 'risque'],
  ['empathie', 'loyaute'],
  ['principes', 'interventionnisme'],
  ['principes', 'autorite'],
];

export const MIN_DILEMMES_PAR_AXE = 4;
export const SEUIL_CORRELATION = 0.7;
export const PART_MAX_PROFIL = 0.4;

/** Couverture de chaque axe : nombre de dilemmes, min, max. */
export function couvertureAxes(dilemmes, axesIds) {
  const bornes = bornesAxes(dilemmes, axesIds);
  return axesIds.map((axe) => ({
    axe,
    ...bornes[axe],
    alerte: bornes[axe].nbDilemmes < MIN_DILEMMES_PAR_AXE,
  }));
}

/** Corrélation de Pearson (null si une des séries est constante). */
function correlation(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (xs[i] - mx) * (ys[i] - my);
    vx += (xs[i] - mx) ** 2;
    vy += (ys[i] - my) ** 2;
  }
  if (vx === 0 || vy === 0) return null;
  return cov / Math.sqrt(vx * vy);
}

/**
 * Pour une paire d'axes : options où les deux varient dans le même sens,
 * en sens opposés, ou un seul des deux. Alerte si la corrélation des points
 * (sur les options qui touchent au moins un des axes) dépasse le seuil.
 */
export function analyserPaire(dilemmes, a, b) {
  let memeSens = 0, sensOpposes = 0, unSeul = 0;
  const xs = [], ys = [];
  for (const d of dilemmes) {
    for (const o of d.options) {
      const pa = (o.points && o.points[a]) || 0;
      const pb = (o.points && o.points[b]) || 0;
      if (pa === 0 && pb === 0) continue;
      xs.push(pa);
      ys.push(pb);
      if (pa !== 0 && pb !== 0) {
        if (Math.sign(pa) === Math.sign(pb)) memeSens++;
        else sensOpposes++;
      } else unSeul++;
    }
  }
  const r = correlation(xs, ys);
  return { a, b, memeSens, sensOpposes, unSeul, correlation: r, alerte: r !== null && r > SEUIL_CORRELATION };
}

/** Validité des groupes de jumeaux. */
export function analyserJumeaux(dilemmes) {
  const groupes = new Map();
  for (const d of dilemmes) {
    if (!d.jumeau) continue;
    const g = d.jumeau.groupe;
    if (!groupes.has(g)) groupes.set(g, []);
    groupes.get(g).push(d);
  }
  return [...groupes].map(([groupe, membres]) => {
    const problemes = [];
    if (membres.length < 2) problemes.push('moins de 2 dilemmes');
    for (const d of membres) {
      const logique = d.jumeau.logique || {};
      for (const o of d.options) {
        if (!logique[o.id]) problemes.push(`« ${d.id} / ${o.id} » sans lettre`);
      }
      for (const cle of Object.keys(logique)) {
        if (!d.options.some((o) => o.id === cle)) problemes.push(`« ${d.id} » : option « ${cle} » inconnue`);
      }
    }
    const lettresParDilemme = membres.map((d) => new Set(Object.values(d.jumeau.logique || {})));
    if (lettresParDilemme.length >= 2) {
      const communes = [...lettresParDilemme[0]].filter((l) => lettresParDilemme.every((s) => s.has(l)));
      if (communes.length === 0) problemes.push('aucune lettre commune : cohérence impossible');
    }
    return { groupe, dilemmes: membres.map((d) => d.id), valide: problemes.length === 0, problemes };
  });
}

/** Contrôles de format de dilemmes.json (règles de la section 5.1). */
export function controlerFormat(dilemmes, axesIds) {
  const erreurs = [];
  const ids = new Set();
  let nbMinuteurs = 0;
  for (const d of dilemmes) {
    if (ids.has(d.id)) erreurs.push(`id en double : ${d.id}`);
    ids.add(d.id);
    if (!Array.isArray(d.options) || d.options.length < 2 || d.options.length > 3) {
      erreurs.push(`${d.id} : il faut 2 à 3 options`);
    }
    const mots = d.texte.trim().split(/\s+/).length;
    if (mots < 60 || mots > 120) erreurs.push(`${d.id} : texte de ${mots} mots (attendu 60 à 120)`);
    for (const o of d.options || []) {
      for (const [axe, v] of Object.entries(o.points || {})) {
        if (!axesIds.includes(axe)) erreurs.push(`${d.id} / ${o.id} : axe inconnu « ${axe} »`);
        if (!Number.isInteger(v) || v < -2 || v > 2) erreurs.push(`${d.id} / ${o.id} : ${axe} = ${v} (attendu entier de −2 à +2)`);
      }
    }
    if (d.minuteur) {
      nbMinuteurs++;
      if (!d.options.some((o) => o.passive)) erreurs.push(`${d.id} : minuteur sans option passive`);
    }
  }
  if (nbMinuteurs > 3) erreurs.push(`${nbMinuteurs} dilemmes à minuteur (3 au maximum)`);
  return erreurs;
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
export function aleatoire(graine) {
  let t = graine >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simule des parties avec des choix aléatoires.
 * @returns {{ nb, distributions: Object<axe, number[]>, profils: Object<id, number>, alertes: string[] }}
 *   distributions : histogramme des scores par tranche de 10 (11 cases, la dernière = 100).
 */
export function simuler(dilemmes, axesIds, profils, nb = 1000, graine = 42) {
  const hasard = aleatoire(graine);
  const distributions = Object.fromEntries(axesIds.map((a) => [a, new Array(11).fill(0)]));
  const moyennes = Object.fromEntries(axesIds.map((a) => [a, 0]));
  const compteProfils = Object.fromEntries(profils.map((p) => [p.id, 0]));
  for (let i = 0; i < nb; i++) {
    const choix = dilemmes.map((d) => ({
      dilemmeId: d.id,
      optionId: d.options[Math.floor(hasard() * d.options.length)].id,
      tempsMs: null,
      auto: false,
    }));
    const { scores } = calculerScores(dilemmes, choix, axesIds);
    for (const a of axesIds) {
      distributions[a][Math.floor(scores[a] / 10)]++;
      moyennes[a] += scores[a] / nb;
    }
    const { profil } = choisirProfil(profils, scores, axesIds);
    if (profil) compteProfils[profil.id]++;
  }
  const alertes = [];
  for (const [id, n] of Object.entries(compteProfils)) {
    if (n === 0) alertes.push(`Le profil « ${id} » n'est jamais attribué.`);
    else if (n / nb > PART_MAX_PROFIL) alertes.push(`Le profil « ${id} » est attribué dans ${Math.round((n / nb) * 100)} % des cas.`);
  }
  return { nb, distributions, moyennes, profils: compteProfils, alertes };
}
