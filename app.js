/* =========================================================
   DMAIC POCKET – Vanilla JS PWA
   Commentaires pédagogiques « prof »
   ========================================================= */
const COACH_MODE = true; // true = alertes + console pédago

/* ---------- UTILS ---------- */
const log = (...a) => { if (COACH_MODE) console.log('[DMAIC]', ...a); };
const $ = q => document.querySelector(q);
const LS_KEY = 'sixSigmaProject';

/* ---------- STATE ---------- */
let state = {
  define: {},
  measure: { rows: [], stats: {} },
  analyse: { anova: null, doe: null },
  improve: { solutions: new Array(8).fill(false), pugh: [], roi: {} },
  control: { realtime: [] }
};

/* ---------- DARK MODE ---------- */
const darkToggle = $('#darkToggle');
darkToggle.onclick = () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('dark', document.body.classList.contains('dark'));
};
if (localStorage.getItem('dark') === 'true') document.body.classList.add('dark');

/* ---------- PWA : SERVICE-WORKER ---------- */
const SW = `
self.addEventListener('install', e => e.waitUntil(skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
self.addEventListener('fetch', e => e.respondWith(fetch(e.request).catch(() => caches.match(e.request))));
`;
const blob = new Blob([SW], { type: 'application/javascript' });
const swUrl = URL.createObjectURL(blob);
navigator.serviceWorker.register(swUrl);

/* ---------- LOCALSTORAGE ---------- */
function saveProject() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
  log('Projet sauvegardé');
}
function loadProject() {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    if (confirm('Reprendre le dernier projet ?')) {
      state = JSON.parse(raw);
      // réparer prototypes
      if (state.improve && state.improve.solutions) state.improve.solutions = state.improve.solutions.map(Boolean);
      log('Projet chargé');
    }
  }
}
window.addEventListener('beforeunload', saveProject);
loadProject();

/* ---------- NAV ---------- */
const main = $('#main');
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
tabButtons.forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

function switchTab(tab) {
  tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  main.innerHTML = '';
  switch (tab) {
    case 'define': renderDefine(); break;
    case 'measure': renderMeasure(); break;
    case 'analyse': renderAnalyse(); break;
    case 'improve': renderImprove(); break;
    case 'control': renderControl(); break;
  }
}
/* Swipe horizontal */
let touchstartX = 0;
document.addEventListener('touchstart', e => touchstartX = e.changedTouches[0].screenX);
document.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].screenX - touchstartX;
  if (Math.abs(dx) < 50) return;
  const idx = tabButtons.findIndex(b => b.classList.contains('active'));
  const next = dx > 0 ? idx - 1 : idx + 1;
  if (tabButtons[next]) tabButtons[next].click();
});

/* ---------- DEFINE ---------- */
function renderDefine() {
  const s = state.define;
  main.innerHTML = `
    <label>Titre <span class="tooltip" data-tip="Nom du projet">?</span>
      <input id="dTitle" value="${s.title || ''}">
    </label>
    <label>Problem
      <textarea id="dProblem" rows="2">${s.problem || ''}</textarea>
    </label>
    <label>Goal
      <textarea id="dGoal" rows="2">${s.goal || ''}</textarea>
    </label>
    <label>CTQ
      <input id="dCTQ" value="${s.ctq || ''}">
    </label>
    <label>LSL
      <input id="dLSL" type="number" step="any" value="${s.lsl || ''}">
    </label>
    <label>USL
      <input id="dUSL" type="number" step="any" value="${s.usl || ''}">
    </label>
    <label>Unité
      <input id="dUnit" value="${s.unit || ''}">
    </label>
    <label>Business case
      <textarea id="dBiz" rows="2">${s.biz || ''}</textarea>
    </label>
    <button class="cta" onclick="saveDefine()">Enregistrer</button>
  `;
}
function saveDefine() {
  state.define = {
    title: $('#dTitle').value.trim(),
    problem: $('#dProblem').value.trim(),
    goal: $('#dGoal').value.trim(),
    ctq: $('#dCTQ').value.trim(),
    lsl: parseFloat($('#dLSL').value) || 0,
    usl: parseFloat($('#dUSL').value) || 0,
    unit: $('#dUnit').value.trim(),
    biz: $('#dBiz').value.trim()
  };
  saveProject();
  alert('Étape Define enregistrée');
}

/* ---------- MEASURE ---------- */
function renderMeasure() {
  main.innerHTML = `
    <button class="cta" onclick="downloadTemplate()">📥 Télécharger template Excel</button>
    <label>Choisir fichier CSV/Excel
      <input type="file" id="fileInput" accept=".csv,.xlsx,.xls">
    </label>
    <div id="measureStats"></div>
    <div class="chart-container"><canvas id="hist"></canvas></div>
    <div class="chart-container"><canvas id="imr"></canvas></div>
  `;
  $('#fileInput').onchange = e => readFile(e.target.files[0]);
  if (state.measure.stats.mean) showMeasureStats();
}
function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['Valeur', 'Facteur (optionnel)']]);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, 'template_dmaic.xlsx');
}
function readFile(file) {
  const reader = new FileReader();
  reader.onload = evt => {
    const data = new Uint8Array(evt.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const rows = json.slice(1).filter(r => r[0] !== undefined && r[0] !== '');
    if (rows.length < 30) return alert('n doit être > 30');
    const vals = rows.map(r => parseFloat(r[0])).filter(v => !isNaN(v));
    const missing = rows.length - vals.length;
    if (missing / rows.length > 0.05) return alert('Trop de données manquantes (>5 %)');
    const { lsl, usl } = state.define;
    if (isNaN(lsl) || isNaN(usl)) return alert('Veuillez renseigner LSL/USL dans Define');
    const mean = ss.mean(vals);
    const std = ss.standardDeviation(vals);
    const cp = (usl - lsl) / (6 * std);
    const cpu = (usl - mean) / (3 * std);
    const cpl = (mean - lsl) / (3 * std);
    const cpk = Math.min(cpu, cpl);
    const dpmo = (1 - ss.cumulativeStandardNormal(cpk * 3)) * 1e6 * 2; // approx bilat
    const sigmaLevel = cpk * 3 + 1.5; // shift 1.5
    state.measure = {
      rows: rows.map((r, i) => ({ val: parseFloat(r[0]), factor: r[1] || '' })),
      stats: { mean, std, cp, cpk, dpmo, sigmaLevel, lsl, usl }
    };
    saveProject();
    showMeasureStats();
    drawHist(vals);
    drawIMR(vals);
  };
  reader.readAsArrayBuffer(file);
}
function showMeasureStats() {
  const st = state.measure.stats;
  $('#measureStats').innerHTML = `
    <p>Moyenne : ${st.mean.toFixed(2)}</p>
    <p>σ : ${st.std.toFixed(3)}</p>
    <p>Cp : ${st.cp.toFixed(2)} <span class="tooltip" data-tip="Cp>1 capacité potentielle">?</span></p>
    <p>Cpk : ${st.cpk.toFixed(2)} <span class="tooltip" data-tip="Cpk>1,33 = capable">?</span></p>
    <p>DPMO : ${Math.round(st.dpmo)}</p>
    <p>Sigma level : ${st.sigmaLevel.toFixed(1)}</p>
  `;
}
function drawHist(vals) {
  const bins = 10;
  const { min, max } = ss.minMax(vals);
  const step = (max - min) / bins;
  const labels = Array.from({ length: bins }, (_, i) => (min + i * step).toFixed(1));
  const data = new Array(bins).fill(0);
  vals.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    data[idx]++;
  });
  new Chart($('#hist'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Effectif', data, backgroundColor: '#90caf9' }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}
function drawIMR(vals) {
  const mr = vals.slice(1).map((v, i) => Math.abs(v - vals[i]));
  const cl = ss.mean(vals);
  const mrBar = ss.mean(mr);
  const ucl = cl + 2.66 * mrBar;
  const lcl = cl - 2.66 * mrBar;
  new Chart($('#imr'), {
    type: 'line',
    data: {
      labels: vals.map((_, i) => i + 1),
      datasets: [{
        label: 'I',
        data: vals,
        borderColor: '#90caf9',
        tension: .1
      }, {
        label: 'UCL',
        data: Array(vals.length).fill(ucl),
        borderColor: '#f44336',
        borderDash: [5, 5],
        pointRadius: 0
      }, {
        label: 'LCL',
        data: Array(vals.length).fill(lcl),
        borderColor: '#f44336',
        borderDash: [5, 5],
        pointRadius: 0
      }]
    },
    options: { plugins: { legend: { display: false } } }
  });
}

/* ---------- ANALYSE ---------- */
function renderAnalyse() {
  main.innerHTML = `
    <button class="cta" onclick="runANOVA()">🔍 ANOVA 1-way (si facteur)</button>
    <div id="anovaResult"></div>
    <hr>
    <h3>DOE 2² simulation</h3>
    <label>Facteur A : <input type="range" id="a" min="-1" max="1" step=".1" value="0"><span id="aVal">0</span></label>
    <label>Facteur B : <input type="range" id="b" min="-1" max="1" step=".1" value="0"><span id="bVal">0</span></label>
    <label>Réponse Y mesurée : <input id="yReal" type="number" step="any"></label>
    <button class="cta" onclick="addDOE()">Ajouter essai</button>
    <div id="doeTable"></div>
    <div id="doeModel"></div>
  `;
  ['a', 'b'].forEach(id => {
    $(`#${id}`).oninput = e => $(`#${id}Val`).textContent = e.target.value;
  });
  if (state.analyse.doe) showDOE();
}
function runANOVA() {
  const rows = state.measure.rows;
  const hasFactor = rows.length && rows[0].factor !== '';
  if (!hasFactor) return alert('Pas de colonne Facteur');
  const groups = {};
  rows.forEach(r => {
    if (!groups[r.factor]) groups[r.factor] = [];
    groups[r.factor].push(r.val);
  });
  const anova = ss.oneWayANOVA(Object.values(groups));
  state.analyse.anova = anova;
  $('#anovaResult').innerHTML = `<p>F = ${anova.fStatistic.toFixed(2)}, p = ${anova.pValue.toFixed(4)}</p>`;
  saveProject();
}
function addDOE() {
  const a = parseFloat($('#a').value);
  const b = parseFloat($('#b').value);
  const y = parseFloat($('#yReal').value);
  if (isNaN(y)) return alert('Entrer une réponse Y');
  if (!state.analyse.doe) state.analyse.doe = { runs: [] };
  state.analyse.doe.runs.push({ a, b, y });
  saveProject();
  showDOE();
}
function showDOE() {
  const runs = state.analyse.doe.runs;
  if (runs.length < 4) return $('#doeModel').textContent = 'Encore ' + (4 - runs.length) + ' essais';
  const ybar = ss.mean(runs.map(r => r.y));
  const aEff = ss.mean(runs.filter(r => r.a === 1).map(r => r.y)) - ss.mean(runs.filter(r => r.a === -1).map(r => r.y));
  const bEff = ss.mean(runs.filter(r => r.b === 1).map(r => r.y)) - ss.mean(runs.filter(r => r.b === -1).map(r => r.y));
  const ab = runs.reduce((s, r) => s + r.a * r.b * r.y, 0) / 4;
  $('#doeModel').innerHTML = `
    <p>Modèle : Y = ${ybar.toFixed(2)} ${aEff >= 0 ? '+' : ''}${aEff.toFixed(2)} A ${bEff >= 0 ? '+' : ''}${bEff.toFixed(2)} B ${ab >= 0 ? '+' : ''}${ab.toFixed(2)} AB</p>
    <p>Coach : si |effet| > 10 % de la moyenne → significatif</p>
  `;
}

/* ---------- IMPROVE ---------- */
function renderImprove() {
  main.innerHTML = `
    <h3>Idées de solutions</h3>
    ${state.improve.solutions.map((c, i) => `
      <label><input type="checkbox" onchange="toggleSol(${i})" ${c ? 'checked' : ''}> Solution ${i + 1}</label>
    `).join('')}
    <h3>Matrice Pugh</h3>
    <table id="pughTable"></table>
    <h3>ROI</h3>
    <label>Défauts évités/an
      <input id="defAvoid" type="number" min="0" value="${state.improve.roi.defAvoid || 0}">
    </label>
    <label>Coût unitaire défaut (€)
      <input id="costDef" type="number" min="0" step="any" value="${state.improve.roi.costDef || 0}">
    </label>
    <label>Volume annuel
      <input id="vol" type="number" min="0" value="${state.improve.roi.vol || 0}">
    </label>
    <button class="cta" onclick="calcROI()">Calculer ROI</button>
    <p id="roiRes"></p>
  `;
  renderPugh();
}
function toggleSol(i) {
  state.improve.solutions[i] = !state.improve.solutions[i];
  saveProject();
}
function renderPugh() {
  const sols = state.improve.solutions.map((on, i) => ({ id: i, on }));
  const ref = 0; // solution 0 = réf
  if (!state.improve.pugh.length) state.improve.pugh = sols.map((s, i) => (i === ref ? 0 : (Math.random() > .5 ? 1 : -1)));
  const rows = sols.map((s, i) => `<tr><td>Solution ${i + 1}</td><td>${i === ref ? 'Ref' : state.improve.pugh[i]}</td></tr>`);
  $('#pughTable').innerHTML = `<table border="1" cellpadding="4">${rows.join('')}</table>`;
}
function calcROI() {
  const def = parseFloat($('#defAvoid').value) || 0;
  const cost = parseFloat($('#costDef').value) || 0;
  const vol = parseFloat($('#vol').value) || 0;
  const gain = def * cost * vol;
  state.improve.roi = { defAvoid: def, costDef: cost, vol, gain };
  saveProject();
  $('#roiRes').textContent = `Gain estimé : ${gain.toLocaleString('fr-FR')} €/an`;
}

/* ---------- CONTROL ---------- */
function renderControl() {
  main.innerHTML = `
    <button class="cta" onclick="addRealtime()">Ajouter mesure</button>
    <div class="chart-container"><canvas id="rtImr"></canvas></div>
    <button class="cta" onclick="exportPDF()">Export check-list PDF</button>
  `;
  drawRealtime();
}
function addRealtime() {
  const val = prompt('Valeur mesurée :');
  if (val === null) return;
  const v = parseFloat(val);
  if (isNaN(v)) return alert('Nombre invalide');
  state.control.realtime.push(v);
  if (state.control.realtime.length > 50) state.control.realtime.shift();
  saveProject();
  drawRealtime();
}
function drawRealtime() {
  const vals = state.control.realtime;
  if (vals.length < 2) return;
  const mr = vals.slice(1).map((v, i) => Math.abs(v - vals[i]));
  const cl = ss.mean(vals);
  const mrBar = ss.mean(mr);
  const ucl = cl + 2.66 * mrBar;
  const lcl = cl - 2.66 * mrBar;
  new Chart($('#rtImr'), {
    type: 'line',
    data: {
      labels: vals.map((_, i) => i + 1),
      datasets: [{
        label: 'I',
        data: vals,
        borderColor: '#90caf9',
        tension: .1
      }, {
        label: 'UCL',
        data: Array(vals.length).fill(ucl),
        borderColor: '#f44336',
        borderDash: [5, 5],
        pointRadius: 0
      }, {
        label: 'LCL',
        data: Array(vals.length).fill(lcl),
        borderColor: '#f44336',
        borderDash: [5, 5],
        pointRadius: 0
      }]
    },
    options: { plugins: { legend: { display: false } } }
  });
}
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text('Check-list DMAIC – Contrôle', 10, 10);
  doc.text('Dernière mesure : ' + (state.control.realtime.slice(-1)[0] || '—'), 10, 20);
  doc.save('checklist.pdf');
}

/* ---------- GLOBAL EXPORT ---------- */
const fab = document.createElement('button');
fab.textContent = '📦';
fab.style.position = 'fixed';
fab.style.bottom = '80px';
fab.style.right = '16px';
fab.style.width = '56px';
fab.style.height = '56px';
fab.style.borderRadius = '50%';
fab.style.border = 'none';
fab.style.background = '#90caf9';
fab.style.fontSize = '24px';
fab.style.zIndex = 20;
fab.onclick = async () => {
  const zip = new JSZip();
  // pptx
  const pres = new PptxGenJS();
  pres.addSlide().addText('DMAIC Project', { x: 1, y: 1, fontSize: 36 });
  const pptx = await pres.write('base64');
  zip.file('presentation.pptx', pptx, { base64: true });
  // xlsx
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(state.measure.rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  const xlsx = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  zip.file('data_collection.xlsx', xlsx, { base64: true });
  // pdf A3
  const { jsPDF } = window.jspud;
  const pdf = new jsPDF();
  pdf.text('A3 Charter', 10, 10);
  const pdfblob = pdf.output('blob');
  zip.file('A3_charter.pdf', pdfblob);
  // zip
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dmaic_dossier.zip';
  a.click();
};
document.body.appendChild(fab);

/* ---------- CLEAR ---------- */
$('#clearBtn').onclick = () => {
  if (confirm('Effacer tout le projet ?')) {
    localStorage.removeItem(LS_KEY);
    location.reload();
  }
};

/* ---------- INIT ---------- */
switchTab('define');
