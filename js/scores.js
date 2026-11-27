// scores.js — calcul et normalisation des scores, instinct / réflexion, cohérence.
// Toutes les fonctions sont pures : elles ne lisent que leurs arguments et ne
// touchent ni au DOM, ni au réseau, ni à la console.
//
// Format d'un choix (produit par moteur.js) :
//   { dilemmeId, optionId, tempsMs, auto }
//   - tempsMs : délai entre l'affichage du dilemme et le clic (null si inconnu)
//   - auto    : true si l'option a été choisie automatiquement (minuteur écoulé)

/** Bornes du curseur Instinctif / Réfléchi (en secondes, temps ajusté). */
export const BORNES_INSTINCT = { instinctif: 2, reflechi: 15 };

/** Vitesse de lecture estimée, en mots par seconde. */
export const MOTS_PAR_SECONDE = 4;

/** Points d'une option sur un axe (0 si l'axe est absent). */
function pointsSur(option, axeId) {
  return (option.points && option.points[axeId]) || 0;
}

/**
 * Min et max atteignables pour chaque axe, calculés à partir des dilemmes.
 * @returns {Object<string, {min:number, max:number, nbDilemmes:number}>}
 */
export function bornesAxes(dilemmes, axesIds) {
  const bornes = {};
  for (const axe of axesIds) {
    let min = 0;
    let max = 0;
    let nbDilemmes = 0;
    for (const d of dilemmes) {
      const valeurs = d.options.map((o) => pointsSur(o, axe));
      min += Math.min(...valeurs);
      max += Math.max(...valeurs);
      if (valeurs.some((v) => v !== 0)) nbDilemmes++;
    }
    bornes[axe] = { min, max, nbDilemmes };
  }
  return bornes;
}

/** Retrouve l'option choisie pour un choix donné (ou null). */
export function optionChoisie(dilemmes, choix) {
  const d = dilemmes.find((x) => x.id === choix.dilemmeId);
  if (!d) return null;
  return d.options.find((o) => o.id === choix.optionId) || null;
}

/** Score brut par axe : somme des points des options choisies. */
export function scoresBruts(dilemmes, choix, axesIds) {
  const bruts = Object.fromEntries(axesIds.map((a) => [a, 0]));
  for (const c of choix) {
    const option = optionChoisie(dilemmes, c);
    if (!option) continue;
    for (const axe of axesIds) bruts[axe] += pointsSur(option, axe);
  }
  return bruts;
}

/**
 * Normalise les scores bruts entre 0 et 100.
 * @returns {{ scores: Object<string, number>, anomalies: string[] }}
 *   anomalies : ids des axes jamais touchés (max == min), affichés à 50.
 */
export function normaliser(bruts, bornes) {
  const scores = {};
  const anomalies = [];
  for (const axe of Object.keys(bruts)) {
    const { min, max } = bornes[axe];
    if (max === min) {
      scores[axe] = 50;
      anomalies.push(axe);
    } else {
      scores[axe] = Math.round(((bruts[axe] - min) / (max - min)) * 100);
    }
  }
  return { scores, anomalies };
}

/** Raccourci : scores normalisés à partir des choix. */
export function calculerScores(dilemmes, choix, axesIds) {
  const bornes = bornesAxes(dilemmes, axesIds);
  const bruts = scoresBruts(dilemmes, choix, axesIds);
  const { scores, anomalies } = normaliser(bruts, bornes);
  return { bruts, scores, anomalies, bornes };
}

/** Nombre de mots d'un texte. */
export function compterMots(texte) {
  const mots = texte.trim().split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m));
  return mots.length;
}

/** Médiane d'une liste de nombres (null si vide). */
export function mediane(valeurs) {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

/**
 * Position du curseur Instinctif (0) / Réfléchi (100).
 * Les dilemmes à minuteur et les choix automatiques sont ignorés.
 * @returns {{ position: number|null, medianeSecondes: number|null }}
 */
export function scoreInstinct(dilemmes, choix, bornes = BORNES_INSTINCT, motsParSeconde = MOTS_PAR_SECONDE) {
  const ajustes = [];
  for (const c of choix) {
    const d = dilemmes.find((x) => x.id === c.dilemmeId);
    if (!d || d.minuteur || c.auto || typeof c.tempsMs !== 'number') continue;
    const lecture = compterMots(d.texte) / motsParSeconde;
    ajustes.push(c.tempsMs / 1000 - lecture);
  }
  const med = mediane(ajustes);
  if (med === null) return { position: null, medianeSecondes: null };
  const { instinctif, reflechi } = bornes;
  const ratio = (med - instinctif) / (reflechi - instinctif);
  const position = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return { position, medianeSecondes: med };
}

/**
 * Cohérence sur les groupes de dilemmes jumeaux.
 * Un groupe n'est évalué que si tous ses dilemmes ont reçu une réponse.
 * @returns {{ score: number|null, groupes: Array<{groupe, coherent, lettres}> }}
 *   score null s'il n'y a aucun groupe évaluable.
 */
export function scoreCoherence(dilemmes, choix) {
  const groupes = new Map();
  for (const d of dilemmes) {
    if (!d.jumeau || !d.jumeau.groupe) continue;
    if (!groupes.has(d.jumeau.groupe)) groupes.set(d.jumeau.groupe, []);
    groupes.get(d.jumeau.groupe).push(d);
  }
  const resultats = [];
  for (const [groupe, membres] of groupes) {
    if (membres.length < 2) continue;
    const lettres = [];
    for (const d of membres) {
      const c = choix.find((x) => x.dilemmeId === d.id);
      if (!c) break;
      lettres.push(d.jumeau.logique[c.optionId]);
    }
    if (lettres.length !== membres.length) continue;
    const coherent = lettres.every((l) => l !== undefined && l === lettres[0]);
    resultats.push({ groupe, coherent, lettres });
  }
  if (resultats.length === 0) return { score: null, groupes: [] };
  const nbCoherents = resultats.filter((r) => r.coherent).length;
  return { score: Math.round((nbCoherents / resultats.length) * 100), groupes: resultats };
}
