const express = require('express');
const session = require('express-session');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 3000;

const USERS_FILE = path.join(__dirname, 'Data', 'users.json');
const LATEST_FILE = path.join(__dirname, 'Data', 'latest.json');

// ---------- Helpers de senha ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(check, 'hex'));
}

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function loadLatest() {
  if (!fs.existsSync(LATEST_FILE)) return null;
  return JSON.parse(fs.readFileSync(LATEST_FILE, 'utf-8'));
}

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'Public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'antilhas-dashboard-secret-troque-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 12 } // 12 horas
}));

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  return res.status(403).send('Acesso restrito ao administrador.');
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

// ---------- Rotas de autenticação ----------
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'Views', 'login.html'));
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();
  const user = users[username];
  if (!user || !verifyPassword(password || '', user.password)) {
    return res.redirect('/login?erro=1');
  }
  req.session.user = { username, role: user.role };
  res.redirect('/dashboard');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/', (req, res) => res.redirect('/dashboard'));

// ---------- Dashboard ----------
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'Views', 'dashboard.html'));
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

app.get('/api/dashboard-data', requireAuth, (req, res) => {
  const data = loadLatest();
  if (!data) {
    return res.json({ empty: true });
  }
  res.json({ empty: false, ...data });
});

// ---------- Admin: upload da planilha ----------
app.get('/admin', requireAuth, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'Views', 'admin.html'));
});

app.post('/admin/upload', requireAuth, requireAdmin, upload.single('planilha'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, erro: 'Nenhum arquivo enviado.' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false });
    const result = processWorkbook(workbook);

    fs.writeFileSync(LATEST_FILE, JSON.stringify({
      ...result,
      atualizadoEm: new Date().toISOString(),
      atualizadoPor: req.session.user.username
    }, null, 2));

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, erro: 'Erro ao processar a planilha: ' + err.message });
  }
});

// ---------- Lógica de negócio: cálculo de OEE e etiquetas ----------
function sheetToRows(workbook, sheetName) {
  const ws = workbook.Sheets[sheetName];
  if (!ws) return null;
  // header:1 -> array de arrays (primeira linha = cabeçalho)
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  return rows;
}

function indexHeader(headerRow) {
  const idx = {};
  headerRow.forEach((h, i) => {
    if (h !== null && h !== undefined && h !== '') idx[String(h).trim()] = i;
  });
  return idx;
}

function isOpZerada(v) {
  return v === 0 || v === '0' || v === null || v === undefined || v === '';
}

function processWorkbook(workbook) {
  // ---- Produção / OEE ----
  const prodRows = sheetToRows(workbook, 'bd_producao_26');
  if (!prodRows) throw new Error("Aba 'bd_producao_26' não encontrada na planilha.");

  const idx = indexHeader(prodRows[0]);
  const required = ['Nº O.P.', 'Desc.SubGrupo Maq.', 'Quant. Prod. Final',
    'Capacidade produtiva utilizada', 'Tempo Trabalhando', 'Tempo Programado', 'Dia'];
  for (const col of required) {
    if (!(col in idx)) throw new Error(`Coluna esperada não encontrada: "${col}"`);
  }

  const porSubgrupo = {}; // subgrupo -> {qtd, cap, tt, tp}
  const porDia = {};      // dia -> {qtd, cap, tt, tp}
  let totalQtd = 0, totalCap = 0, totalTT = 0, totalTP = 0;

  for (let r = 1; r < prodRows.length; r++) {
    const row = prodRows[r];
    if (!row) continue;
    const op = row[idx['Nº O.P.']];
    if (isOpZerada(op)) continue;

    const subgrupo = row[idx['Desc.SubGrupo Maq.']] || 'Sem grupo';
    const dia = row[idx['Dia']];
    const qtd = Number(row[idx['Quant. Prod. Final']]) || 0;
    const cap = Number(row[idx['Capacidade produtiva utilizada']]) || 0;
    const tt = Number(row[idx['Tempo Trabalhando']]) || 0;
    const tp = Number(row[idx['Tempo Programado']]) || 0;

    if (!porSubgrupo[subgrupo]) porSubgrupo[subgrupo] = { qtd: 0, cap: 0, tt: 0, tp: 0 };
    porSubgrupo[subgrupo].qtd += qtd;
    porSubgrupo[subgrupo].cap += cap;
    porSubgrupo[subgrupo].tt += tt;
    porSubgrupo[subgrupo].tp += tp;

    if (dia !== null && dia !== undefined) {
      if (!porDia[dia]) porDia[dia] = { qtd: 0, cap: 0, tt: 0, tp: 0 };
      porDia[dia].qtd += qtd;
      porDia[dia].cap += cap;
      porDia[dia].tt += tt;
      porDia[dia].tp += tp;
    }

    totalQtd += qtd; totalCap += cap; totalTT += tt; totalTP += tp;
  }

  function toIndicadores(o) {
    const desempenho = o.cap ? o.qtd / o.cap : 0;
    const disponibilidade = o.tp ? o.tt / o.tp : 0;
    const oee = desempenho * disponibilidade;
    return {
      desempenho: round4(desempenho),
      disponibilidade: round4(disponibilidade),
      oee: round4(oee)
    };
  }

  function round4(v) { return Math.round(v * 10000) / 10000; }

  const subgrupos = Object.entries(porSubgrupo)
    .map(([nome, o]) => ({ nome, ...toIndicadores(o) }))
    .sort((a, b) => b.oee - a.oee);

  const evolucaoDiaria = Object.entries(porDia)
    .map(([dia, o]) => ({ dia: Number(dia), ...toIndicadores(o) }))
    .sort((a, b) => a.dia - b.dia);

  const totais = toIndicadores({ qtd: totalQtd, cap: totalCap, tt: totalTT, tp: totalTP });

  // ---- Etiquetas ----
  let etiquetas = { porStatus: {}, porPrioridade: {}, total: 0 };
  const etRows = sheetToRows(workbook, 'etiquetas_26');
  if (etRows) {
    const etIdx = indexHeader(etRows[0]);
    const statusCol = etIdx['Status'];
    const prioCol = etIdx['Prioridade'];
    for (let r = 1; r < etRows.length; r++) {
      const row = etRows[r];
      if (!row || row.every(v => v === null)) continue;
      etiquetas.total++;
      if (statusCol !== undefined) {
        const s = row[statusCol] || 'Não informado';
        etiquetas.porStatus[s] = (etiquetas.porStatus[s] || 0) + 1;
      }
      if (prioCol !== undefined) {
        const p = row[prioCol] || 'Não informado';
        etiquetas.porPrioridade[p] = (etiquetas.porPrioridade[p] || 0) + 1;
      }
    }
  }

  return { totais, subgrupos, evolucaoDiaria, etiquetas };
}

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
