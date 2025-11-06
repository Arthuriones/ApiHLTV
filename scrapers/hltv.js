// scrapers/hltv.js - tentativa múltipla: HLTV API -> proxy -> Puppeteer
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// config via .env
const PROXY_URL = process.env.PROXY_URL || 'https://hltv-api.vercel.app/api/matches';
const HLTV_API = process.env.HLTV_API || 'https://www.hltv.org/api/matches';
const USE_PUPPETEER = String(process.env.USE_PUPPETEER || 'true') === 'true';
const HEADLESS = String(process.env.HEADLESS || 'true') === 'true';
const CHROME_PATH = process.env.CHROME_PATH || null;
const DEBUG_DIR = path.join(__dirname, '..', 'debug');

// garante debug dir
if (!fs.existsSync(DEBUG_DIR)) fs.mkdirSync(DEBUG_DIR, { recursive: true });

/**
 * 1) tryHltvApiWithCookies
 *  - tenta /api/matches direto com headers
 *  - se 401/403: busca /matches (pagina) para coletar set-cookie e tenta de novo
 */
async function tryHltvApiWithCookies() {
  try {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://www.hltv.org/matches',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };

    console.log('[HLTV] tentativa: API direta (sem cookies)...');
    const res = await axios.get(HLTV_API, { headers, timeout: 10000, validateStatus: null });

    if (res.status === 200 && Array.isArray(res.data)) {
      console.log('[HLTV] API direta OK (200)');
      return res.data;
    }

    if ([401, 403].includes(res.status)) {
      console.warn(`[HLTV] API direta retornou ${res.status} — tentando obter cookies via GET /matches ...`);
      // tenta obter cookies via GET /matches (HTML) para pegar set-cookie
      const pageRes = await axios.get('https://www.hltv.org/matches', { headers, timeout: 10000, maxRedirects: 5, validateStatus: null });
      const setCookies = pageRes.headers['set-cookie'];
      if (setCookies && setCookies.length) {
        const cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ');
        console.log('[HLTV] set-cookie coletado, tentando API com cookie...');
        const res2 = await axios.get(HLTV_API, {
          headers: { ...headers, Cookie: cookieHeader },
          timeout: 10000,
          validateStatus: null
        });
        if (res2.status === 200 && Array.isArray(res2.data)) {
          console.log('[HLTV] API direta OK usando cookies da página.');
          return res2.data;
        } else {
          console.warn(`[HLTV] Segunda tentativa retornou ${res2.status}`);
        }
      } else {
        console.warn('[HLTV] Nenhum set-cookie recebido da página /matches');
      }
    } else {
      console.warn(`[HLTV] chamada direta retornou status ${res.status}`);
    }

    return null;
  } catch (err) {
    console.warn('[HLTV] erro em tryHltvApiWithCookies:', err.message);
    return null;
  }
}

/**
 * 2) tryProxy - fallback rápido pra proxy público (pode 404/ser instável)
 */
async function tryProxy() {
  try {
    console.log('[HLTV] tentando fallback proxy:', PROXY_URL);
    const res = await axios.get(PROXY_URL, { timeout: 10000, validateStatus: null });
    if (res.status === 200 && Array.isArray(res.data)) {
      console.log('[HLTV] proxy OK');
      return res.data;
    } else {
      console.warn(`[HLTV] proxy retornou status ${res.status}`);
      return null;
    }
  } catch (err) {
    console.warn('[HLTV] proxy erro:', err.message);
    return null;
  }
}


// tryPuppeteerScrape - versão com salvar/reusar sessão (cookies + localStorage)
const COOKIES_PATH = path.join(DEBUG_DIR, 'cookies.json');
const STORAGE_PATH = path.join(DEBUG_DIR, 'storage.json');

async function saveSession(page) {
  try {
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2), 'utf8');
    // salvar localStorage & sessionStorage
    const storage = await page.evaluate(() => {
      const ls = { local: {}, session: {} };
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i); ls.local[k] = localStorage.getItem(k);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i); ls.session[k] = sessionStorage.getItem(k);
      }
      return ls;
    });
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(storage, null, 2), 'utf8');
    console.log('[HLTV] sessão salva (cookies + storage).');
  } catch (e) {
    console.warn('[HLTV] erro ao salvar sessão:', e.message);
  }
}

async function loadSession(page) {
  try {
    if (fs.existsSync(COOKIES_PATH)) {
      const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
      // ajustar domínio se necessário
      for (const c of cookies) {
        // puppeteer requires 'expires' as number or undefined; keep as is
      }
      await page.setCookie(...cookies);
      console.log('[HLTV] cookies carregados:', cookies.length);
    }
    if (fs.existsSync(STORAGE_PATH)) {
      const storage = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8'));
      await page.evaluate((storage) => {
        try {
          Object.entries(storage.local || {}).forEach(([k, v]) => localStorage.setItem(k, v));
          Object.entries(storage.session || {}).forEach(([k, v]) => sessionStorage.setItem(k, v));
        } catch(e){}
      }, storage);
      console.log('[HLTV] storage carregado (local/session).');
    }
  } catch (e) {
    console.warn('[HLTV] erro ao carregar sessão:', e.message);
  }
}

async function tryPuppeteerScrape() {
  if (!USE_PUPPETEER) { console.warn('[HLTV] puppeteer disabled via env.'); return null; }
  try {
    console.log('[HLTV] fallback: iniciando Puppeteer (session-aware)...');
    const puppeteer = require('puppeteer');
    const launchOpts = { headless: HEADLESS, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu'] };
    if (CHROME_PATH) launchOpts.executablePath = CHROME_PATH;
    const browser = await puppeteer.launch(launchOpts);
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8' });
    page.setDefaultNavigationTimeout(60000);

    // 1) se houver sessão salva, carregue antes de ir para a página
    await page.goto('about:blank');
    await loadSession(page);

    // 2) navegue para /matches — com sessão carregada, pode pular challenge
    await page.goto('https://www.hltv.org/matches', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(()=>{});
    console.log('[HLTV] página carregada (domcontentloaded).');

    // 3) verificar se precisamos resolver challenge: procurar texto comum do Cloudflare
    const bodyText = await page.evaluate(() => document.documentElement.innerText.slice(0, 2000));
    if (bodyText && /checking your browser|just a moment|please enable javascript/i.test(bodyText)) {
      console.log('[HLTV] Cloudflare challenge detectado — aguarde e resolva manualmente no navegador.');
      console.log('[HLTV] Após resolver, pressione Enter aqui no terminal para salvar a sessão e continuar.');
      // abrir console para esperar o ENTER do usuário
      await new Promise((resolve) => {
        process.stdin.resume();
        process.stdin.once('data', async () => {
          process.stdin.pause();
          resolve();
        });
      });
      // dar 2s pra sessão estabilizar
      await new Promise(r => setTimeout(r, 2000));
      await saveSession(page);
    } else {
      // se não há challenge, salvar sessão automaticamente (primeira execução)
      await saveSession(page);
    }

    // 4) agora raspamos o HTML visível (equivalente à última versão visual scraper)
    await page.waitForTimeout ? await page.waitForTimeout(1000) : await new Promise(r=>setTimeout(r,1000));
    const matches = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('.upcomingMatch, .liveMatch-container, .match').forEach(m => {
        try {
          const teams = [...m.querySelectorAll('.matchTeamName')].map(e => e.textContent.trim()).filter(Boolean);
          const time = m.querySelector('.matchTime')?.textContent?.trim() || '';
          const event = m.querySelector('.matchEventName')?.textContent?.trim() || '';
          const linkEl = m.querySelector('a[href*="/matches/"]');
          const link = linkEl ? linkEl.href : '';
          const live = m.querySelector('.matchTeamScore') != null || m.classList.contains('liveMatch-container');
          out.push({ teams, time, event, link, live });
        } catch(e){}
      });
      return out;
    });

    // salvar debug
    try {
      const jsonPath = path.join(DEBUG_DIR, `hltv-scraped-${Date.now()}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(matches, null, 2), 'utf8');
      console.log('[HLTV] scraped salvo em', jsonPath);
    } catch(e){}

    await browser.close();
    return matches.map(m => ({
      id: m.link ? m.link.split('/').filter(Boolean).pop() : null,
      team1: m.teams[0] || 'TBD',
      team2: m.teams[1] || 'TBD',
      event: m.event || 'Evento',
      time: m.time || null,
      status: m.live ? 'live' : 'upcoming',
      link: m.link || null,
      raw: m
    }));
  } catch (err) {
    console.warn('[HLTV] Puppeteer session-aware erro:', err.message);
    return null;
  }
}


/**
 * fetchHLTVMatchesRaw - tenta em ordem e retorna array cru (ou [])
 */
async function fetchHLTVMatchesRaw() {
  // 1 - tentativa direta (com cookies fallback)
  const direct = await tryHltvApiWithCookies();
  if (Array.isArray(direct)) return direct;

  // 2 - proxy
  const proxy = await tryProxy();
  if (Array.isArray(proxy)) return proxy;

  // 3 - puppeteer
  const pupp = await tryPuppeteerScrape();
  if (Array.isArray(pupp)) return pupp;

  // nada deu certo
  return [];
}

/**
 * normalizeList - converte o array cru da HLTV para formato { live, upcoming, finished }
 */
function normalizeList(rawArray) {
  const live = [], upcoming = [], finished = [];
  for (const m of (rawArray || [])) {
    try {
      const liveFlag = !!m.live;
      // status se veio explícito
      const status = m.status || (liveFlag ? 'live' : (m.date && m.date < Date.now() ? 'finished' : 'upcoming'));
      const obj = {
        id: m.id || (m.matchId || null),
        team1: (m.team1 && m.team1.name) ? m.team1.name : (m.team1 || m.team1Name || 'TBD'),
        team2: (m.team2 && m.team2.name) ? m.team2.name : (m.team2 || m.team2Name || 'TBD'),
        event: (m.event && m.event.name) ? m.event.name : (m.event || null),
        time: m.date || null,
        status,
        link: m.id ? `https://www.hltv.org/matches/${m.id}` : (m.link || null),
        score: m.result || null,
        raw: m
      };
      if (status === 'live') live.push(obj);
      else if (status === 'finished') finished.push(obj);
      else upcoming.push(obj);
    } catch (e) {
      // pula item malformado
    }
  }
  return { live, upcoming, finished };
}

/**
 * exports públicos
 */
async function getAll() {
  const raw = await fetchHLTVMatchesRaw();
  return normalizeList(raw);
}
async function getLiveMatches() {
  const all = await getAll();
  return all.live;
}
async function getUpcomingMatches() {
  const all = await getAll();
  return all.upcoming;
}
async function getFinishedMatches() {
  const all = await getAll();
  return all.finished;
}

module.exports = {
  fetchHLTVMatchesRaw,
  getAll,
  getLiveMatches,
  getUpcomingMatches,
  getFinishedMatches
};
