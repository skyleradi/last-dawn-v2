// LAST DAWN — ui.js
// DOM UI: HUD (phase, resources, score, health bars, build bar), the title
// screen, the end screen, pause, toasts and the build-selection state.
import { CONFIG } from './config.js';

export function createUI() {
  const el = (id) => document.getElementById(id);
  const hud = el('hud'), title = el('title'), end = el('end');
  const phase = el('phase'), phaseLabel = el('phaselabel'), phaseValue = el('phasevalue');
  const rWood = el('rwood'), rStone = el('rstone'), rEss = el('ressence');
  const scoreVal = el('scoreval');
  const emberFill = el('emberfill'), hpFill = el('hpfill'), hpLbl = el('hplbl');
  const toast = el('toast'), buildHint = el('buildhint'), verdict = el('verdict');
  const endSub = el('endsub'), endStats = el('endstats');
  const startBtn = el('startbtn'), restartBtn = el('restartbtn');
  const buildButtons = Array.from(document.querySelectorAll('.bb'));

  let selectedBuild = null;   // 'wall' | 'tower' | 'beacon' | null
  let toastTimer = 0;

  function setPhase(kind, value, label) {
    phase.className = 'box';
    phase.classList.add(kind);
    phaseValue.textContent = value;
    if (label) phaseLabel.textContent = label;
  }
  function setResources(wood, stone, essence) {
    rWood.textContent = wood; rStone.textContent = stone; rEss.textContent = essence;
  }
  function setScore(s) { scoreVal.textContent = s; }
  function setEmberHp(hp) { emberFill.style.width = Math.max(0, 100 * hp / CONFIG.ember.maxHp) + '%'; }
  function setPlayerHp(hp) {
    hpFill.style.width = Math.max(0, 100 * hp / CONFIG.player.maxHp) + '%';
    hpLbl.textContent = hp <= 0 ? 'Fallen' : 'Dawnkeeper';
  }

  function showToast(text, hold = 1.6) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), hold * 1000);
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
    setBuildHint(kind ? (CONFIG.buildings[kind].name + ' — click to place, right-click to cancel') : '');
  }

  function costText(cost) {
    const parts = [];
    if (cost.wood) parts.push(cost.wood + 'w');
    if (cost.stone) parts.push(cost.stone + 's');
    if (cost.essence) parts.push(cost.essence + 'e');
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

  function showVictory(stats) {
    verdict.textContent = 'DAWN BREAKS';
    verdict.className = 'verdict win';
    endSub.textContent = 'You held the last light';
    endStats.innerHTML =
      `Score <b>${stats.score}</b> &nbsp;·&nbsp; Nights <b>${stats.night}</b>/7` +
      `<br>Kills <b>${stats.kills}</b> &nbsp;·&nbsp; Ember remaining <b>${stats.hp}%</b>`;
    showEnd(true); showHud(false);
  }
  function showDefeat(stats) {
    verdict.textContent = 'THE EMBER DIES';
    verdict.className = 'verdict lose';
    endSub.textContent = 'The long night wins';
    endStats.innerHTML =
      `Score <b>${stats.score}</b> &nbsp;·&nbsp; Survived <b>${stats.night}</b>/7 nights` +
      `<br>Kills <b>${stats.kills}</b>`;
    showEnd(true); showHud(false);
  }

  return {
    el, setPhase, setResources, setScore, setEmberHp, setPlayerHp,
    showToast, setBuildHint, selectBuild, refreshAffordability,
    showHud, showTitle, showEnd, showVictory, showDefeat,
    get selectedBuild() { return selectedBuild; },
    startBtn, restartBtn, buildButtons,
  };
}