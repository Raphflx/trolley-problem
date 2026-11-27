// resultats.js — affichage du radar, du curseur, de la jauge et export PNG.
/* global Chart */

let radar = null;

/** Lit une variable CSS du thème. */
function couleur(nom) {
  return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
}

/** Plugin Chart.js : affiche la valeur de chaque point du radar. */
const pluginValeurs = {
  id: 'valeursRadar',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const valeurs = chart.data.datasets[0].data;
    const centre = { x: chart.scales.r.xCenter, y: chart.scales.r.yCenter };
    ctx.save();
    ctx.font = `600 ${chart.options.plugins.valeursRadar.taille}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    meta.data.forEach((point, i) => {
      // Décale l'étiquette vers l'extérieur pour ne pas masquer le point.
      const dx = point.x - centre.x;
      const dy = point.y - centre.y;
      const dist = Math.hypot(dx, dy) || 1;
      const decalage = chart.options.plugins.valeursRadar.taille * 1.2;
      const x = point.x + (dx / dist) * decalage;
      const y = point.y + (dy / dist) * decalage;
      const texte = String(valeurs[i]);
      const largeur = ctx.measureText(texte).width + 8;
      ctx.fillStyle = chart.options.plugins.valeursRadar.fond;
      ctx.beginPath();
      const h = chart.options.plugins.valeursRadar.taille * 1.5;
      ctx.roundRect(x - largeur / 2, y - h / 2, largeur, h, 4);
      ctx.fill();
      ctx.fillStyle = chart.options.plugins.valeursRadar.texte;
      ctx.fillText(texte, x, y + 0.5);
    });
    ctx.restore();
  },
};

/** Dessine (ou redessine) le radar à 8 axes. */
export function afficherRadar(canvas, axes, scores) {
  if (radar) radar.destroy();
  const accent = couleur('--accent');
  const texte = couleur('--texte');
  const grille = couleur('--bordure');
  radar = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: axes.map((a) => a.nom),
      datasets: [{
        label: 'Votre profil',
        data: axes.map((a) => scores[a.id]),
        backgroundColor: accent + '33',
        borderColor: accent,
        pointBackgroundColor: accent,
        pointRadius: 4,
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 1.25,
      animation: { duration: 600 },
      layout: { padding: 8 },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false, stepSize: 25 },
          grid: { color: grille },
          angleLines: { color: grille },
          pointLabels: { color: texte, padding: 22, font: { size: window.innerWidth < 480 ? 11 : 13 } },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => axes[items[0].dataIndex].nom,
            label: (item) => `${item.raw} / 100 — ${axes[item.dataIndex].description}`,
          },
        },
        valeursRadar: { taille: 12, fond: couleur('--fond-carte'), texte },
      },
    },
    plugins: [pluginValeurs],
  });
  return radar;
}

/** Positionne le curseur Instinctif / Réfléchi (position 0-100 ou null). */
export function afficherCurseur(conteneur, position, texte) {
  const bloc = conteneur.querySelector('.curseur');
  const pastille = conteneur.querySelector('.curseur-pastille');
  const legende = conteneur.querySelector('.curseur-texte');
  if (position === null) {
    bloc.hidden = true;
  } else {
    bloc.hidden = false;
    pastille.style.left = `${position}%`;
    bloc.setAttribute('aria-valuenow', String(position));
    bloc.setAttribute('aria-valuetext', `${position} sur 100, de instinctif (0) à réfléchi (100)`);
  }
  legende.textContent = texte || '';
}

/** Remplit la jauge de cohérence, ou la masque si score est null. */
export function afficherJauge(conteneur, score, texte) {
  if (score === null) {
    conteneur.hidden = true;
    return;
  }
  conteneur.hidden = false;
  conteneur.querySelector('.jauge-valeur').textContent = `${score} %`;
  conteneur.querySelector('.jauge-remplissage').style.width = `${score}%`;
  const barre = conteneur.querySelector('.jauge');
  barre.setAttribute('aria-valuenow', String(score));
  conteneur.querySelector('.jauge-texte').textContent = texte;
}

/** Découpe un texte en lignes tenant dans `largeur` pixels. */
function decouperLignes(ctx, texte, largeur) {
  const mots = texte.split(' ');
  const lignes = [];
  let ligne = '';
  for (const mot of mots) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ctx.measureText(essai).width > largeur && ligne) {
      lignes.push(ligne);
      ligne = mot;
    } else {
      ligne = essai;
    }
  }
  if (ligne) lignes.push(ligne);
  return lignes;
}

/**
 * Génère une image PNG (profil + radar + curseur + cohérence) et la télécharge.
 * Tout se fait dans le navigateur.
 */
export function telechargerProfil({ titreJeu, profil, axes, scores, instinct, coherence }) {
  const L = 1080;
  const marge = 64;
  const largeurTexte = L - 2 * marge;

  // Radar redessiné hors écran, en grand et sans animation, sur fond clair.
  const toile = document.createElement('canvas');
  toile.width = 900;
  toile.height = 900;
  const radarExport = new Chart(toile, {
    type: 'radar',
    data: {
      labels: axes.map((a) => a.nom),
      datasets: [{ data: axes.map((a) => scores[a.id]), backgroundColor: '#3a5ba033', borderColor: '#3a5ba0', pointBackgroundColor: '#3a5ba0', borderWidth: 3, pointRadius: 6 }],
    },
    options: {
      responsive: false,
      animation: false,
      devicePixelRatio: 1,
      scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 25 }, grid: { color: '#cfd4dc' }, angleLines: { color: '#cfd4dc' }, pointLabels: { color: '#1d2330', padding: 40, font: { size: 26 } } } },
      plugins: { legend: { display: false }, tooltip: { enabled: false }, valeursRadar: { taille: 24, fond: '#ffffff', texte: '#1d2330' } },
    },
    plugins: [pluginValeurs],
  });

  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = '28px system-ui, sans-serif';
  const lignesDescription = decouperLignes(ctx, profil.description, largeurTexte);
  const hauteur = marge + 50 + 80 + lignesDescription.length * 40 + 40 + 900 + 40 + (instinct !== null ? 120 : 0) + (coherence !== null ? 90 : 0) + marge;

  const image = document.createElement('canvas');
  image.width = L;
  image.height = hauteur;
  const c = image.getContext('2d');
  c.fillStyle = '#f7f6f2';
  c.fillRect(0, 0, L, hauteur);
  c.fillStyle = '#1d2330';
  c.textBaseline = 'top';

  let y = marge;
  c.font = '26px system-ui, sans-serif';
  c.fillStyle = '#5a6272';
  c.fillText(titreJeu, marge, y);
  y += 50;
  c.font = 'bold 60px system-ui, sans-serif';
  c.fillStyle = '#1d2330';
  c.fillText(profil.nom, marge, y);
  y += 80;
  c.font = '28px system-ui, sans-serif';
  for (const ligne of lignesDescription) {
    c.fillText(ligne, marge, y);
    y += 40;
  }
  y += 40;
  c.drawImage(toile, (L - 900) / 2, y);
  y += 940;
  radarExport.destroy();

  if (instinct !== null) {
    c.font = '26px system-ui, sans-serif';
    c.fillStyle = '#1d2330';
    c.fillText('Instinctif', marge, y);
    c.textAlign = 'right';
    c.fillText('Réfléchi', L - marge, y);
    c.textAlign = 'left';
    const yBarre = y + 50;
    c.fillStyle = '#cfd4dc';
    c.fillRect(marge, yBarre, largeurTexte, 8);
    c.fillStyle = '#1d2330';
    c.beginPath();
    c.arc(marge + (largeurTexte * instinct) / 100, yBarre + 4, 16, 0, Math.PI * 2);
    c.fill();
    y += 120;
  }
  if (coherence !== null) {
    c.font = '26px system-ui, sans-serif';
    c.fillStyle = '#1d2330';
    c.fillText(`Cohérence : ${coherence} %`, marge, y);
    c.fillStyle = '#cfd4dc';
    c.fillRect(marge, y + 44, largeurTexte, 14);
    c.fillStyle = '#3a5ba0';
    c.fillRect(marge, y + 44, (largeurTexte * coherence) / 100, 14);
  }

  image.toBlob((blob) => {
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = 'mon-profil-moral.png';
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  }, 'image/png');
}
