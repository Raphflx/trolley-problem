// main.js — enchaînement des écrans.
import { chargerDonnees, Partie, optionPassive } from './moteur.js';
import { calculerScores, scoreInstinct, scoreCoherence } from './scores.js';
import { choisirProfil, textesMarques, texteZone } from './profils.js';
import { afficherRadar, afficherCurseur, afficherJauge, telechargerProfil } from './resultats.js';

const TITRE_JEU = 'Dilemmes';
/** Secondes restantes à partir desquelles le minuteur est annoncé aux lecteurs d'écran. */
const ANNONCES_MINUTEUR = [10, 5];

const $ = (sel) => document.querySelector(sel);

const etat = {
  donnees: null,
  partie: null,
  infos: null,
  minuteur: null, // { id, fin, duree, annonces:Set }
  resultatPartie: null,
};

// ---------------------------------------------------------------------------
// Navigation entre écrans

function afficherEcran(id) {
  document.querySelectorAll('.ecran').forEach((e) => { e.hidden = e.id !== id; });
  const ecran = document.getElementById(id);
  window.scrollTo(0, 0);
  // Place le focus sur l'écran pour les lecteurs d'écran et le clavier.
  ecran.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Informations facultatives (section 8)

function majChampsConditionnels() {
  const situation = $('#champ-situation').value;
  $('#bloc-niveau').hidden = situation !== 'etudes';
  $('#bloc-categorie').hidden = situation !== 'activite';
}

function lireInfos() {
  const valeur = (id) => $(id).value || null;
  const situation = valeur('#champ-situation');
  return {
    age: valeur('#champ-age'),
    situation,
    niveau: situation === 'etudes' ? valeur('#champ-niveau') : null,
    categorie: situation === 'activite' ? valeur('#champ-categorie') : null,
  };
}

// ---------------------------------------------------------------------------
// Dilemmes

function arreterMinuteur() {
  if (etat.minuteur) {
    cancelAnimationFrame(etat.minuteur.id);
    etat.minuteur = null;
  }
}

function demarrerMinuteur(dilemme) {
  const passive = optionPassive(dilemme);
  const bloc = $('#minuteur');
  if (!dilemme.minuteur || !passive) {
    bloc.hidden = true;
    return;
  }
  bloc.hidden = false;
  $('#minuteur-annonce').textContent =
    `Situation minutée : sans réponse de votre part dans les ${dilemme.minuteur} secondes, ` +
    `le choix « ${passive.libelle} » sera retenu.`;
  $('#minuteur-alerte').textContent = '';

  const duree = dilemme.minuteur * 1000;
  const fin = performance.now() + duree;
  etat.minuteur = { id: 0, fin, duree, annonces: new Set() };

  const tick = () => {
    const reste = Math.max(0, fin - performance.now());
    const secondes = Math.ceil(reste / 1000);
    $('#minuteur-secondes').textContent = `${secondes} s`;
    $('#minuteur-remplissage').style.width = `${(reste / duree) * 100}%`;
    for (const seuil of ANNONCES_MINUTEUR) {
      if (secondes <= seuil && !etat.minuteur.annonces.has(seuil) && seuil < dilemme.minuteur) {
        etat.minuteur.annonces.add(seuil);
        $('#minuteur-alerte').textContent = `Plus que ${seuil} secondes.`;
      }
    }
    if (reste <= 0) {
      etat.minuteur = null;
      valider(passive.id, true);
      return;
    }
    etat.minuteur.id = requestAnimationFrame(tick);
  };
  tick();
}

function afficherDilemme() {
  const { partie } = etat;
  const d = partie.dilemmeCourant;
  const numero = partie.index + 1;

  $('#progression-texte').textContent = `${numero} / ${partie.total}`;
  $('#progression-remplissage').style.width = `${((numero - 1) / partie.total) * 100}%`;
  $('#titre-dilemme').textContent = d.titre;
  $('#texte-dilemme').textContent = d.texte;

  const zone = $('#options');
  zone.replaceChildren();
  zone.classList.toggle('options-trois', d.options.length === 3);
  for (const option of d.options) {
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bouton bouton-option';
    bouton.textContent = option.libelle;
    bouton.dataset.option = option.id;
    bouton.addEventListener('click', () => valider(option.id, false));
    zone.appendChild(bouton);
  }

  afficherEcran('ecran-dilemme');
  // Le chrono démarre une fois le texte réellement peint à l'écran.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    partie.demarrerChrono();
    demarrerMinuteur(d);
  }));
}

function valider(optionId, auto) {
  const { partie } = etat;
  if (!partie || partie.terminee) return;
  arreterMinuteur();
  // Évite un double clic qui validerait aussi le dilemme suivant.
  document.querySelectorAll('#options button').forEach((b) => { b.disabled = true; });
  partie.choisir(optionId, { auto });
  if (partie.terminee) afficherResultats();
  else afficherDilemme();
}

// ---------------------------------------------------------------------------
// Résultats

/**
 * Regroupe tout ce que la partie a produit. Prêt à être envoyé plus tard à une
 * API (section 8) — AUCUN ENVOI n'est fait dans cette version.
 */
function construireResultatPartie() {
  const { donnees, partie, infos } = etat;
  const axesIds = donnees.axes.map((a) => a.id);
  const { bruts, scores, anomalies } = calculerScores(donnees.dilemmes, partie.choix, axesIds);
  anomalies.forEach((axe) => console.warn(`[scores] L'axe « ${axe} » n'est touché par aucun dilemme : score affiché à 50.`));
  const instinct = scoreInstinct(donnees.dilemmes, partie.choix);
  const coherence = scoreCoherence(donnees.dilemmes, partie.choix);
  const { profil, top } = choisirProfil(donnees.profils, scores, axesIds);
  return {
    version: 1,
    debut: partie.debutPartie.toISOString(),
    fin: new Date().toISOString(),
    infos,
    choix: partie.choix.map((c) => ({ ...c })),
    scores: { bruts, normalises: scores },
    instinct,
    coherence,
    profil: { id: profil.id, top },
  };
}

function afficherResultats() {
  const { donnees } = etat;
  const resultat = construireResultatPartie();
  etat.resultatPartie = resultat;
  const axesIds = donnees.axes.map((a) => a.id);
  const scores = resultat.scores.normalises;
  const profil = donnees.profils.find((p) => p.id === resultat.profil.id);

  $('#nom-profil').textContent = profil.nom;
  $('#description-profil').textContent = profil.description;

  // Liste texte des scores : alternative accessible au radar.
  const liste = $('#liste-scores');
  liste.replaceChildren(...donnees.axes.map((a) => {
    const li = document.createElement('li');
    li.title = a.description;
    li.innerHTML = '<span></span><strong></strong>';
    li.firstChild.textContent = a.nom;
    li.lastChild.textContent = scores[a.id];
    return li;
  }));

  const { textes } = donnees;
  $('#titre-instinct').textContent = textes.instinct.titre;
  afficherCurseur(
    $('#bloc-instinct'),
    resultat.instinct.position,
    resultat.instinct.position === null ? textes.instinct.absent : texteZone(textes.instinct.zones, resultat.instinct.position)
  );
  $('#titre-coherence').textContent = textes.coherence.titre;
  afficherJauge($('#bloc-coherence'), resultat.coherence.score, texteZone(textes.coherence.zones, resultat.coherence.score));

  const marques = textesMarques(textes, scores, axesIds);
  $('#bloc-textes').hidden = marques.length === 0;
  $('#textes-marques').replaceChildren(...marques.map((t) => {
    const li = document.createElement('li');
    li.textContent = t.texte;
    return li;
  }));

  afficherEcran('ecran-resultats');
  afficherRadar($('#radar'), donnees.axes, scores);
}

// ---------------------------------------------------------------------------
// Démarrage

function nouvellePartie() {
  arreterMinuteur();
  etat.partie = new Partie(etat.donnees.dilemmes);
  etat.resultatPartie = null;
  afficherDilemme();
}

function brancherEvenements() {
  document.addEventListener('click', (e) => {
    const bouton = e.target.closest('[data-action]');
    if (!bouton) return;
    switch (bouton.dataset.action) {
      case 'commencer':
        afficherEcran('ecran-avertissement');
        break;
      case 'vers-infos':
        afficherEcran('ecran-infos');
        break;
      case 'passer':
        etat.infos = null;
        nouvellePartie();
        break;
      case 'telecharger': {
        const r = etat.resultatPartie;
        telechargerProfil({
          titreJeu: TITRE_JEU,
          profil: etat.donnees.profils.find((p) => p.id === r.profil.id),
          axes: etat.donnees.axes,
          scores: r.scores.normalises,
          instinct: r.instinct.position,
          coherence: r.coherence.score,
        });
        break;
      }
      case 'rejouer':
        nouvellePartie();
        break;
    }
  });
  $('#formulaire-infos').addEventListener('submit', (e) => {
    e.preventDefault();
    etat.infos = lireInfos();
    nouvellePartie();
  });
  $('#champ-situation').addEventListener('change', majChampsConditionnels);
}

async function demarrer() {
  brancherEvenements();
  try {
    etat.donnees = await chargerDonnees();
    $('#nb-dilemmes').textContent = String(etat.donnees.dilemmes.length);
  } catch (erreur) {
    console.error(erreur);
    $('#message-erreur').textContent = erreur.message;
    afficherEcran('ecran-erreur');
  }
}

demarrer();
