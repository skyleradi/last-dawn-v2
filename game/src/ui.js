// ui.js — DOM layer: HUD chips, the build/craft side panel, and overlay screens.
// Reads state; never mutates the simulation directly except through callbacks.

import {
  BUILDINGS,
  RECIPES,
  DAY,
} from './config.js';
import {
  RESOURCE_ICONS,
  canAfford,
  costText,
  recipeUnlocked,
  recipeAffordable,
} from './state.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(state, handlers) {
    this.state = state;
    this.handlers = handlers;

    this.el = {
      hpVal: $('hpVal'),
      castleVal: $('castleVal'),
      clockVal: $('clockVal'),
      res: $('res'),
      side: $('side'),
      sideBar: $('sideBar'),
      sideBody: $('sideBody'),
      sideTitle: $('sideTitle'),
      sr: $('sr'),
      over: $('over'),
      overTitle: $('overTitle'),
      stats: $('stats'),
      paused: $('paused'),
      title: $('title'),
    };

    this.tab = 'build';
    this.lastRender = 0;
    this.lastSignature = '';

    this.el.sideBar.addEventListener('click', () => {
      this.el.side.classList.toggle('collapsed');
    });

    $('btnStart').addEventListener('click', () => this.handlers.start());
    $('btnRetry').addEventListener('click', () => this.handlers.restart());
    $('btnResume').addEventListener('click', () => this.handlers.resume());
  }

  hideScreens() {
    this.el.title.hidden = true;
    this.el.over.hidden = true;
    this.el.paused.hidden = true;
  }

  showPaused(show) {
    this.el.paused.hidden = !show;
  }

  showGameOver(state) {
    const won = state.victory;
    this.el.overTitle.textContent = won ? 'The Dawn Holds' : 'The Kingdom Fell';
    const s = state.stats;
    this.el.stats.innerHTML = [
      `Nights survived: <b>${s.nightsSurvived}</b>`,
      `Raiders slain: <b>${s.kills}</b>`,
      `Built: <b>${s.built}</b>`,
      `Crafted: <b>${s.crafted}</b>`,
      `Gathered: <b>${s.gathered}</b>`,
    ].join('<br>');
    this.el.over.hidden = false;
  }

  setTab(tab) {
    if (this.tab === tab) {
      this.el.side.classList.toggle('collapsed');
      return;
    }
    this.tab = tab;
    this.el.side.classList.remove('collapsed');
    this.lastSignature = '';
  }

  announce(text) {
    this.el.sr.textContent = text;
  }

  /** Coarse signature so we only rebuild panel DOM when something visible changed. */
  signature() {
    const st = this.state;
    const inv = Object.keys(st.store)
      .filter((k) => RESOURCE_ICONS[k])
      .map((k) => `${k}:${Math.floor(st.store[k])}`)
      .join(',');
    return [
      this.tab,
      st.phase,
      st.day,
      st.selectedBuild,
      inv,
      st.player.shieldOn ? 'S' : '-',
      st.player.bladeLife > 0 ? 'B' : '-',
      Math.round(st.player.hp),
      Math.round(st.castle.hp),
    ].join('|');
  }

  renderHud() {
    const st = this.state;
    this.el.hpVal.textContent = String(Math.ceil(st.player.hp));
    this.el.castleVal.textContent = String(Math.ceil(st.castle.hp));

    const h = Math.floor(st.hour);
    const m = Math.floor((st.hour - h) * 60);
    const icon = st.phase === 'night' ? '🌙' : '☀';
    const label = st.phase === 'night' ? 'Night' : 'Day';
    this.el.clockVal.textContent = `${icon} ${label} ${st.day} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const keys = ['wood', 'stone', 'iron', 'food'];
    let html = '';
    for (const k of keys) {
      html += `<div class="res"><span class="ico">${RESOURCE_ICONS[k]}</span><b>${Math.floor(st.store[k])}</b></div>`;
    }
    for (const k of ['plank', 'cutStone', 'blade', 'shield']) {
      if (st.store[k] > 0) {
        html += `<div class="res"><span class="ico">${RESOURCE_ICONS[k]}</span><b>${Math.floor(st.store[k])}</b></div>`;
      }
    }
    this.el.res.innerHTML = html;
  }

  renderPanel() {
    const st = this.state;
    this.el.sideTitle.textContent = this.tab === 'build' ? 'Build' : 'Craft';
    let html = '';

    if (this.tab === 'build') {
      html += `<div class="sec">Defenses ${st.phase === 'night' ? '· stonemasons asleep' : ''}</div>`;
      for (const b of BUILDINGS) {
        const afford = st.phase === 'day' && canAfford(st, b.cost);
        const active = st.selectedBuild === b.id;
        const cls = ['item'];
        if (active) cls.push('active');
        html += `<button class="${cls.join(' ')}" data-build="${b.id}" ${afford ? '' : 'disabled'}>
          <span class="ico">${b.icon}</span>
          <span class="n">${b.name}</span>
          <span class="c ${afford ? 'ook' : 'no'}">${costText(b.cost)}<br><small>${b.key}</small></span>
        </button>`;
      }
      if (st.phase === 'night') {
        html += '<div class="sec">You can only build by daylight.</div>';
      }
    } else {
      html += `<div class="sec">Workshop · day ${st.day}</div>`;
      for (const r of RECIPES) {
        const unlocked = recipeUnlocked(st, r);
        const afford = recipeAffordable(st, r);
        html += `<button class="item" data-craft="${r.id}" ${afford ? '' : 'disabled'}>
          <span class="ico">${RESOURCE_ICONS[Object.keys(r.out)[0]] || '⚒'}</span>
          <span class="n">${r.name}</span>
          <span class="c ${afford ? 'ook' : 'no'}"><span class="cost">${costText(r.cost)}</span>${
            unlocked ? '' : `<small>day ${r.unlockDay}</small>`
          }</span>
        </button>`;
      }
      if (st.player.bladeLife > 0) {
        html += `<div class="sec">Iron Blade · ${st.player.bladeLife} strikes left</div>`;
      }
    }

    this.el.sideBody.innerHTML = html;

    this.el.sideBody.querySelectorAll('[data-build]').forEach((btn) => {
      btn.addEventListener('click', () => this.handlers.selectBuild(btn.dataset.build));
    });
    this.el.sideBody.querySelectorAll('[data-craft]').forEach((btn) => {
      btn.addEventListener('click', () => this.handlers.craft(btn.dataset.craft));
    });
  }

  tick(dt, force) {
    this.renderHud();
    const sig = this.signature();
    if (force || sig !== this.lastSignature) {
      this.lastSignature = sig;
      this.renderPanel();
    }
  }
}
