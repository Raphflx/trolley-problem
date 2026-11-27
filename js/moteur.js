// moteur.js — chargement des données, déroulé des dilemmes, enregistrement
// des choix et chronométrage. Ne contient aucun texte de dilemme ni barème.

const FICHIERS = {
  axes: 'data/axes.json',
  dilemmes: 'data/dilemmes.json',
  profils: 'data/profils.json',
  textes: 'data/textes.json',
};

/** Charge tous les fichiers de data/. `base` permet de charger depuis outils/. */
export async function chargerDonnees(base = '') {
  const entrees = await Promise.all(
    Object.entries(FICHIERS).map(async ([cle, chemin]) => {
      const reponse = await fetch(base + chemin, { cache: 'no-cache' });
      if (!reponse.ok) throw new Error(`Impossible de charger ${chemin} (${reponse.status})`);
      return [cle, await reponse.json()];
    })
  );
  return Object.fromEntries(entrees);
}

/** Horloge monotone (indépendante d'un changement d'heure système). */
const maintenant = () => performance.now();

/**
 * Une partie : la liste des dilemmes dans l'ordre du fichier, l'index courant
 * et les choix déjà validés (aucun retour en arrière possible).
 */
export class Partie {
  constructor(dilemmes) {
    this.dilemmes = dilemmes;
    this.index = 0;
    this.choix = [];
    this.debutAffichage = null;
    this.debutPartie = new Date();
  }

  get total() {
    return this.dilemmes.length;
  }

  get terminee() {
    return this.index >= this.dilemmes.length;
  }

  get dilemmeCourant() {
    return this.terminee ? null : this.dilemmes[this.index];
  }

  /** À appeler quand le texte du dilemme courant est entièrement affiché. */
  demarrerChrono() {
    this.debutAffichage = maintenant();
  }

  /**
   * Enregistre le choix pour le dilemme courant et passe au suivant.
   * @param {string} optionId
   * @param {{auto?: boolean}} [infos] auto = choisi par le minuteur
   */
  choisir(optionId, { auto = false } = {}) {
    const d = this.dilemmeCourant;
    if (!d) throw new Error('La partie est terminée.');
    if (!d.options.some((o) => o.id === optionId)) throw new Error(`Option inconnue : ${optionId}`);
    const tempsMs = this.debutAffichage === null ? null : Math.round(maintenant() - this.debutAffichage);
    this.choix.push({ dilemmeId: d.id, optionId, tempsMs, auto });
    this.index++;
    this.debutAffichage = null;
  }
}

/** Option « ne rien faire » d'un dilemme (choisie quand le minuteur expire). */
export function optionPassive(dilemme) {
  return dilemme.options.find((o) => o.passive) || null;
}
