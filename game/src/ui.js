// LAST DAWN — ui.js
// DOM UI: HUD (phase + wave name, resources, score, health bars, boss bar,
// build bar), the title screen, the result screens, banners, toasts and the
// build-selection state. All text here is sized to survive being shrunk to a
// ~256px-wide thumbnail: few words, big numerals, high contrast.
import { CONFIG } from './config.js';

const BEST_KEY = 'lastDawn.best';   // localStorage key for the best score

export function createUI() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud'), title = el('title'), end = el('end');
  const phase = el('phase'), phaseLabel = el('phaselabel'), phaseValue = el('phasevalue');
  const phaseName = el('phasename');
  const rWood = el('rwood'), rStone = el('rstone'), rEss = el('ressence');
  const rIron = el('riron'), rFiber = el('rfiber');
  const scoreVal = el('scoreval');
  const emberFill = el('emberfill'), emberLbl = el('emberlbl');
  const hpFill = el('hpfill'), hpLbl = el('hplbl');
  const toast = el('toast'), buildHint = el('buildhint'), verdict = el('verdict');
  const endSub = el('endsub'), endStats = el('endstats'), endBest = el('endbest');
  const startBtn = el('startbtn'), restartBtn = el('restartbtn');
  const waveInfo = el('waveinfo');
  const banner = el('banner'), bannerTitle = el('bannertitle'), bannerSub = el('bannersub');
  const bossBar = el('bossbar'), bossName = el('bossname'), bossFill = el('bossfill');
  const buildButtons = Array.from(document.querySelectorAll('.bb'));

  let selectedBuild = null;   // 'wall' | 'tower' | 'beacon' | null
  let toastTimer = 0, bannerTimer = 0;

  function setPhase(kind, value, label, name) {
    phase.className = 'box ' + kind;
    phaseValue.textContent = value;
    if (label) phaseLabel.textContent = label;
    if (name !== undefined) phaseName.textContent = name;
  }

  // Right-hand briefing plate: bold headline + one plain sentence of threat.
  function setWaveInfo(headline, body) {
    waveInfo.innerHTML = '';
    const h = document.createElement('strong');
    h.textContent = headline;
    waveInfo.appendChild(h);
    waveInfo.appendChild(document.createTextNode(body));
  }

  function setResources(wood, stone, essence, iron = 0, fiber = 0) {
    rWood.textContent = wood; rStone.textContent = stone; rEss.textContent = essence;
    if (rIron) rIron.textContent = iron;
    if (rFiber) rFiber.textContent = fiber;
  }
  function setScore(s) { scoreVal.textContent = s; }

  function setEmberHp(hp) {
    const pct = Math.max(0, Math.round(100 * hp / CONFIG.ember.maxHp));
    emberFill.style.width = pct + '%';
    emberLbl.textContent = 'Emberheart ' + pct + '%';
  }
  function setPlayerHp(hp) {
    const pct = Math.max(0, Math.round(100 * hp / CONFIG.player.maxHp));
    hpFill.style.width = pct + '%';
    hpLbl.textContent = hp <= 0 ? 'Fallen' : 'Dawnkeeper ' + pct + '%';
  }

  // Boss plate: shown only while a wave boss is alive and hurt.
  function showBoss(name, pct) {
    bossBar.style.display = 'block';
    bossName.textContent = 'BOSS · ' + name;
    bossFill.style.width = Math.max(0, Math.min(100, pct)) + '%';
  }
  function hideBoss() { bossBar.style.display = 'none'; }

  function showToast(text, hold = 1.6) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), hold * 1000);
  }

  // Big centred announcement used when a night begins.
  function showBanner(title, sub, hold = 2.2) {
    bannerTitle.textContent = title;
    bannerSub.textContent = sub || '';
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => banner.classList.remove('show'), hold * 1000);
  }

  function setBuildHint(text) { buildHint.textContent = text || ''; }

  function selectBuild(kind) {
    selectedBuild = kind;
    buildButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.build === kind);
      if (kind) {
        const cost = costText(CONFIG.buildings[b.dataset.build].cost);
        b.querySelector('.cost').textContent = cost;
      }
    });
    document.getElementById('game').classList.toggle('building', !!kind);
    const help = document.body.classList.contains('touch') ? 'face with joystick; Strike places; tap selected build to cancel' : 'click to place; right-click or R cancels';
    setBuildHint(kind ? (CONFIG.buildings[kind].name + ' — ' + help) : '');
  }

  function costText(cost) {
    const parts = [];
    if (cost.wood) parts.push(cost.wood + 'w');
    if (cost.stone) parts.push(cost.stone + 's');
    if (cost.essence) parts.push(cost.essence + 'e');
    if (cost.iron) parts.push(cost.iron + 'i');
    if (cost.fiber) parts.push(cost.fiber + 'f');
    return parts.join(' ');
  }

  function refreshAffordability(resources) {
    buildButtons.forEach(b => {
      const cost = CONFIG.buildings[b.dataset.build].cost;
      const ok = (cost.wood ?? 0) <= resources.wood &&
                 (cost.stone ?? 0) <= resources.stone &&
                 (cost.essence ?? 0) <= resources.essence;
      b.classList.toggle('disabled', !ok);
    });
  }

  function showHud(on) { hud.style.display = on ? 'block' : 'none'; }
  function showTitle(on) { title.style.display = on ? '' : 'none'; }
  function showEnd(on) { end.style.display = on ? '' : 'none'; }

  // ---- best score (localStorage; wrapped so a blocked store never breaks play)
  function readBest() {
    try { return Number(localStorage.getItem(BEST_KEY) || 0) || 0; } catch (e) { return 0; }
  }
  function writeBest(score) {
    try {
      if (score > readBest()) { localStorage.setItem(BEST_KEY, String(score)); return true; }
    } catch (e) { /* storage unavailable — the run just doesn't persist */ }
    return false;
  }

  function statGrid(cells) {
    endStats.innerHTML = cells
      .map(([value, label]) => `<div class="stat"><div class="n">${value}</div><div class="t">${label}</div></div>`)
      .join('');
  }

  function showVictory(stats) {
    const best = readBest();
    const newBest = writeBest(stats.score);
    verdict.textContent = 'DAWN BREAKS';
    verdict.className = 'verdict win';
    endSub.textContent = 'You held the last light';
    statGrid([
      [stats.score, 'Final score'],
      [stats.night + '/7', 'Nights survived'],
      [stats.kills, 'Dusk slain'],
      [stats.hp + '%', 'Ember remaining'],
    ]);
    endBest.innerHTML = newBest
      ? 'New best score!'
      : 'Best score <b>' + Math.max(best, stats.score) + '</b>';
    restartBtn.textContent = 'Play Again';
    showEnd(true); showHud(false);
  }

  function showDefeat(stats) {
    const best = Math.max(readBest(), stats.score);
    writeBest(stats.score);
    verdict.textContent = 'THE EMBER DIES';
    verdict.className = 'verdict lose';
    endSub.textContent = 'The long night wins — try again';
    statGrid([
      [stats.score, 'Final score'],
      [stats.night + '/7', 'Nights survived'],
      [stats.kills, 'Dusk slain'],
      [stats.hp + '%', 'Ember remaining'],
    ]);
    endBest.innerHTML = 'Best score <b>' + best + '</b>';
    restartBtn.textContent = 'Try Again';
    showEnd(true); showHud(false);
  }

  return {
    el, setPhase, setWaveInfo, setResources, setScore, setEmberHp, setPlayerHp,
    showToast, showBanner, setBuildHint, selectBuild, refreshAffordability,
    showBoss, hideBoss,
    showHud, showTitle, showEnd, showVictory, showDefeat,
    get selectedBuild() { return selectedBuild; },
    startBtn, restartBtn, buildButtons,
  };
}
