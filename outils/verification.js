// verification.js — affichage de l'outil de vérification du barème.
import { chargerDonnees } from '../js/moteur.js';
import {
  PAIRES_SURVEILLEES, SEUIL_CORRELATION, PART_MAX_PROFIL,
  couvertureAxes, analyserPaire, analyserJumeaux, controlerFormat, simuler,
} from './analyse.js';

const $ = (s) => document.querySelector(s);
const echapper = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const statut = (alerte) => (alerte ? '<span class="alerte">⚠ alerte</span>' : '<span class="ok">✓</span>');

function tableau(entetes, lignes) {
  const tete = entetes.map((e) => `<th>${e}</th>`).join('');
  const corps = lignes.map(({ cellules, alerte }) =>
    `<tr class="${alerte ? 'ligne-alerte' : ''}">${cellules.join('')}</tr>`).join('');
  return `<table><thead><tr>${tete}</tr></thead><tbody>${corps}</tbody></table>`;
}
const td = (v, num = false) => `<td${num ? ' class="n"' : ''}>${v}</td>`;

let donnees;
let nbAlertes = 0;

function afficherAnalyses() {
  const { axes, dilemmes } = donnees;
  const axesIds = axes.map((a) => a.id);
  const nomAxe = (id) => axes.find((a) => a.id === id)?.nom ?? id;

  // Format
  const erreurs = controlerFormat(dilemmes, axesIds);
  nbAlertes += erreurs.length;
  const nbMinuteurs = dilemmes.filter((d) => d.minuteur).length;
  $('#format').innerHTML = (erreurs.length
    ? `<ul>${erreurs.map((e) => `<li class="alerte">${echapper(e)}</li>`).join('')}</ul>`
    : '<p class="ok">✓ Aucune erreur de format.</p>') +
    `<p class="aide">${dilemmes.length} dilemmes · ${nbMinuteurs} à minuteur.</p>`;

  // Couverture
  const couverture = couvertureAxes(dilemmes, axesIds);
  nbAlertes += couverture.filter((c) => c.alerte).length;
  $('#couverture').innerHTML = tableau(
    ['Axe', 'Dilemmes qui le touchent', 'min', 'max', 'État'],
    couverture.map((c) => ({
      alerte: c.alerte,
      cellules: [td(nomAxe(c.axe)), td(c.nbDilemmes, true), td(c.min, true), td(c.max, true), td(statut(c.alerte))],
    }))
  );

  // Paires
  const paires = PAIRES_SURVEILLEES.map(([a, b]) => analyserPaire(dilemmes, a, b));
  nbAlertes += paires.filter((p) => p.alerte).length;
  $('#paires').innerHTML = tableau(
    ['Paire', 'Même sens', 'Sens opposés', 'Un seul axe', `Corrélation (seuil ${SEUIL_CORRELATION})`, 'État'],
    paires.map((p) => ({
      alerte: p.alerte,
      cellules: [
        td(`${nomAxe(p.a)} / ${nomAxe(p.b)}`), td(p.memeSens, true), td(p.sensOpposes, true), td(p.unSeul, true),
        td(p.correlation === null ? '—' : p.correlation.toFixed(2), true), td(statut(p.alerte)),
      ],
    }))
  );

  // Jumeaux
  const jumeaux = analyserJumeaux(dilemmes);
  nbAlertes += jumeaux.filter((j) => !j.valide).length;
  $('#jumeaux').innerHTML = jumeaux.length === 0
    ? '<p class="aide">Aucun groupe de jumeaux : la jauge de cohérence ne sera pas affichée.</p>'
    : tableau(['Groupe', 'Dilemmes', 'Problèmes', 'État'], jumeaux.map((j) => ({
      alerte: !j.valide,
      cellules: [td(echapper(j.groupe)), td(j.dilemmes.map(echapper).join(', ')), td(j.problemes.map(echapper).join('<br>') || '—'), td(statut(!j.valide))],
    })));
}

function afficherSimulation() {
  const { axes, dilemmes, profils } = donnees;
  const axesIds = axes.map((a) => a.id);
  const nb = Math.max(10, parseInt($('#nb').value, 10) || 1000);
  const graine = parseInt($('#graine').value, 10) || 0;
  const t0 = performance.now();
  const sim = simuler(dilemmes, axesIds, profils, nb, graine);
  const duree = Math.round(performance.now() - t0);

  const lignesAxes = axes.map((a) => {
    const histo = sim.distributions[a.id];
    const maxH = Math.max(...histo);
    const barres = histo.map((n, i) => `<span title="${i * 10}${i < 10 ? `–${i * 10 + 9}` : ''} : ${n}" style="height:${(n / maxH) * 100}%"></span>`).join('');
    return { cellules: [td(a.nom), td(sim.moyennes[a.id].toFixed(1), true), td(`<div class="histo">${barres}</div>`)] };
  });

  const lignesProfils = profils.map((p) => {
    const n = sim.profils[p.id];
    const part = n / nb;
    const alerte = n === 0 || part > PART_MAX_PROFIL;
    return {
      alerte,
      cellules: [td(echapper(p.nom)), td(n, true), td(`<span class="barre" style="width:${part * 200}px"></span>${(part * 100).toFixed(1)} %`), td(statut(alerte))],
    };
  });

  $('#simulation').innerHTML =
    `<p class="aide">${nb} parties simulées en ${duree} ms (choix uniformément aléatoires).</p>` +
    '<h3>Distribution des scores par axe</h3>' +
    tableau(['Axe', 'Moyenne', 'Histogramme (0 → 100)'], lignesAxes) +
    `<h3>Profils attribués (alerte si jamais attribué ou plus de ${PART_MAX_PROFIL * 100} %)</h3>` +
    tableau(['Profil', 'Parties', 'Part', 'État'], lignesProfils) +
    (sim.alertes.length ? `<ul>${sim.alertes.map((a) => `<li class="alerte">${echapper(a)}</li>`).join('')}</ul>` : '');
  return sim.alertes.length;
}

function afficherResume(alertesSimulation) {
  const total = nbAlertes + alertesSimulation;
  $('#resume').innerHTML = total === 0
    ? '<span class="ok">✓ Aucune alerte.</span>'
    : `<span class="alerte">⚠ ${total} alerte${total > 1 ? 's' : ''} à examiner.</span>`;
}

async function demarrer() {
  try {
    donnees = await chargerDonnees('../');
  } catch (e) {
    $('#resume').innerHTML = `<span class="alerte">${echapper(e.message)}</span> — lancez un serveur local à la racine du projet.`;
    return;
  }
  afficherAnalyses();
  afficherResume(afficherSimulation());
  $('#relancer').addEventListener('click', () => afficherResume(afficherSimulation()));
}

demarrer();
