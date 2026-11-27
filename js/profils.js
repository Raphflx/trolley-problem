// profils.js — choix du profil final et des textes d'interprétation.
// Fonctions pures : entrée = données + scores, sortie = profil / textes.

/** Nombre d'axes du joueur pris en compte pour le profil (« top 3 »). */
export const TAILLE_TOP = 3;

/**
 * Axes classés par score décroissant. À score égal, l'ordre de axes.json
 * est conservé (tri stable).
 */
export function classerAxes(scores, axesIds) {
  return [...axesIds].sort((a, b) => scores[b] - scores[a]);
}

/**
 * Choisit le profil final.
 * 1. Profil « équilibré » (condition.equilibre) si l'écart entre l'axe le plus
 *    haut et le plus bas est inférieur à condition.ecartMax.
 * 2. Sinon, le profil dont le plus d'axes « dominants » sont dans le top 3 ;
 *    à égalité, la plus grande somme des scores de ces axes.
 * 3. Si aucun profil n'a d'axe dans le top 3, profil équilibré.
 * @returns {{ profil: object, top: string[], detail: Array }}
 */
export function choisirProfil(profils, scores, axesIds) {
  const classement = classerAxes(scores, axesIds);
  const top = classement.slice(0, TAILLE_TOP);
  const equilibre = profils.find((p) => p.condition && p.condition.equilibre) || null;

  if (equilibre) {
    const valeurs = axesIds.map((a) => scores[a]);
    const ecart = Math.max(...valeurs) - Math.min(...valeurs);
    if (ecart < (equilibre.condition.ecartMax ?? 25)) {
      return { profil: equilibre, top, detail: [] };
    }
  }

  const detail = profils
    .filter((p) => p.condition && Array.isArray(p.condition.dominants))
    .map((p) => {
      const communs = p.condition.dominants.filter((a) => top.includes(a));
      const somme = communs.reduce((s, a) => s + scores[a], 0);
      return { profil: p, correspondances: communs.length, somme };
    })
    .sort((a, b) => b.correspondances - a.correspondances || b.somme - a.somme);

  const meilleur = detail[0];
  if (!meilleur || meilleur.correspondances === 0) {
    return { profil: equilibre, top, detail };
  }
  return { profil: meilleur.profil, top, detail };
}

/**
 * Textes d'interprétation les plus marqués : seuls les axes au-dessus du seuil
 * « élevé » ou en dessous du seuil « faible » sont retenus, triés par écart à 50.
 * @returns {Array<{axe, niveau:'eleve'|'faible', score, texte}>}
 */
export function textesMarques(textes, scores, axesIds) {
  const { eleve, faible, nombreAffiches } = textes.seuils;
  const candidats = [];
  for (const axe of axesIds) {
    const s = scores[axe];
    const t = textes.axes[axe];
    if (!t) continue;
    if (s >= eleve) candidats.push({ axe, niveau: 'eleve', score: s, texte: t.eleve });
    else if (s <= faible) candidats.push({ axe, niveau: 'faible', score: s, texte: t.faible });
  }
  return candidats
    .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
    .slice(0, nombreAffiches);
}

/** Texte de la zone correspondant à une valeur (zones triées par « max » croissant). */
export function texteZone(zones, valeur) {
  if (valeur === null || valeur === undefined) return null;
  const zone = zones.find((z) => valeur <= z.max) || zones[zones.length - 1];
  return zone.texte;
}
