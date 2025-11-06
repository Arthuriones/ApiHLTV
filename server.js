// server.js - versão final, limpa e pronta
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const {
  getAll,
  getLiveMatches,
  getUpcomingMatches,
  getFinishedMatches,
  fetchHLTVMatchesRaw // opcional: se quiser logs do raw
} = require('./scrapers/hltv');

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;
const CACHE_INTERVAL_MS = parseInt(process.env.REFRESH_INTERVAL || '300000', 10); // 5 min
let lastCacheTime = 0;
let cache = { live: [], upcoming: [], finished: [] };

// util simples de log com hora
function log(msg) {
  console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${msg}`);
}

// função para atualizar cache (usa getAll)
async function updateCache() {
  try {
    log('🔁 Atualizando cache HLTV...');
    const all = await getAll();
    cache.live = all.live || [];
    cache.upcoming = all.upcoming || [];
    cache.finished = all.finished || [];
    lastCacheTime = Date.now();
    log(`✅ Cache atualizado: live=${cache.live.length} upcoming=${cache.upcoming.length} finished=${cache.finished.length}`);
  } catch (err) {
    console.warn('[server] erro ao atualizar cache:', err && err.message ? err.message : err);
  }
}

// inicializa cache na subida (não await bloqueante)
updateCache().catch(()=>{});

// agendador periódica
setInterval(() => {
  updateCache().catch(()=>{});
}, CACHE_INTERVAL_MS);

// rota raiz com info
app.get('/', (req, res) => {
  res.json({
    service: "🔥 CS2 Results API (HLTV)",
    author: "Marcos Souza",
    endpoints: {
      all: "/api/cs2/all",
      live: "/api/cs2/live",
      upcoming: "/api/cs2/upcoming",
      results: "/api/cs2/results",
      refresh: "/api/cs2/refresh"
    },
    cache: {
      lastUpdated: lastCacheTime ? new Date(lastCacheTime).toISOString() : null,
      intervalMs: CACHE_INTERVAL_MS
    }
  });
});

// rota all (retorna objeto com live/upcoming/finished)
app.get('/api/cs2/all', async (req, res) => {
  // se cache estiver vazia, força atualização rápida
  if (!cache.live.length && !cache.upcoming.length && !cache.finished.length) {
    await updateCache();
  }
  res.json({ updated: new Date().toISOString(), ...cache });
});

// rota live
app.get('/api/cs2/live', async (req, res) => {
  if (!cache.live.length) await updateCache();
  res.json({ updated: new Date().toISOString(), count: cache.live.length, matches: cache.live });
});

// rota upcoming
app.get('/api/cs2/upcoming', async (req, res) => {
  if (!cache.upcoming.length) await updateCache();
  res.json({ updated: new Date().toISOString(), count: cache.upcoming.length, matches: cache.upcoming });
});

// rota results (finished)
app.get('/api/cs2/results', async (req, res) => {
  if (!cache.finished.length) await updateCache();
  res.json({ updated: new Date().toISOString(), count: cache.finished.length, matches: cache.finished });
});

// rota refresh manual (força update)
app.get('/api/cs2/refresh', async (req, res) => {
  try {
    await updateCache();
    res.json({ ok: true, updated: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// health / ping
app.get('/ping', (req, res) => res.send('pong'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// start
app.listen(PORT, () => {
  log(`🚀 API CS2 HLTV rodando em http://localhost:${PORT}`);
  log(`⏱ Cache automático: ${CACHE_INTERVAL_MS/60000} min`);
});
