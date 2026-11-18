import { ANIMALS } from '@beast/shared/animals'
import type { Animal, Player, Snapshot } from '@beast/shared/protocol'
import { WILDLINE_GATES } from '@beast/shared/wildlines'
import { animalPortrait } from '../game/Portrait.js'
import { icon } from './icons.js'

export const abilityNotes: Record<Animal, string> = {
  elephant: 'Blast forward and scatter the pack.',
  penguin: 'Dive into a downhill slide. Mind the mud.',
  gorilla: 'Grab a rival with F. Throw them with E.',
  turtle: 'Tuck in and ricochet through the field.',
}

export function escapeText(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  )
}

export function ordinal(n: number) {
  return ['1st', '2nd', '3rd'][n - 1] ?? n + 'th'
}

export function raceTime(seconds: number, detailed = false) {
  const hundredths = Math.floor(Math.max(0, seconds) * 100)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    Math.floor(hundredths / 6000) +
    ':' +
    pad(Math.floor(hundredths / 100) % 60) +
    (detailed ? '.' + pad(hundredths % 100) : '')
  )
}

export function personalBest(animal: Animal): number | null {
  try {
    const best = Number(localStorage.getItem('wildline.cup.best.' + animal))
    return best > 0 && Number.isFinite(best) ? best : null
  } catch {
    return null
  }
}
export function recordRun(me: Player) {
  const old = personalBest(me.animal)
  const t = me.finishTime
  if (t === null || t <= 0 || !Number.isFinite(t) || (old !== null && t >= old))
    return false
  try {
    localStorage.setItem('wildline.cup.best.' + me.animal, String(t))
    return true
  } catch {
    return false
  }
}

export function cupLoadout(selected: Animal) {
  const spec = ANIMALS[selected]
  const best = personalBest(selected)
  const cards = Object.entries(ANIMALS)
    .map(
      ([id, racer]) =>
        `<button data-action="cup-animal" data-animal="${id}" aria-pressed="${selected === id}" style="--coat:${racer.color}">
      <img src="${animalPortrait(id as Animal)}" alt="" draggable="false"><span>${racer.name}</span>
    </button>`,
    )
    .join('')
  return `<section class="cup-loadout" aria-label="Starting grid">
    <div class="loadout-heading"><h2>Pick your racer</h2><span>${best ? 'Best ' + raceTime(best, true) : ''}</span></div>
    <div class="cup-cast">${cards}</div>
    <div class="cup-special"><span class="bolt">${icon('bolt', 17)}</span>
      <div><strong>${spec.special}</strong><span>${abilityNotes[selected]}</span></div></div>
  </section>`
}

export function cupMenu(header: string, selected: Animal, online: boolean) {
  return `${header}<div class="cup-menu">
    <section class="race-ticket"><div class="ticket-inner">
      <div class="ticket-head"><span class="race-stripes" aria-hidden="true"></span>Jungle Breakdown</div>
      <h1>Wildline<span>Cup<span class="title-slashes" aria-hidden="true">///</span></span></h1>
      <p class="cup-intro">Four animals. One finish line. Thread three gold gates in a row to launch a burst.</p>
      <div id="cup-loadout">${cupLoadout(selected)}</div>
      <button class="cup-launch" data-action="cup">${icon('flag', 25)}<strong>Race the cup</strong><span>Solo vs 3 rivals</span>${icon('arrow', 21)}</button>
    </div></section>
    <aside class="cup-view" aria-label="Jungle Breakdown course preview"><div class="location-tape">
      <span class="map-pin">${icon('mountain', 24)}</span><div><small>Volcanic island circuit</small><strong>Jungle Breakdown</strong></div>
      <b>1.47 <small>km</small></b></div>
    </aside></div>
    <footer class="cup-footer"><span class="practice-mode">${icon('run', 18)}<button data-action="practice">Solo practice</button></span>
    ${online ? '<div class="room-links"><span>' + icon('users', 17) + ' Private multiplayer</span><button data-action="create">Create room</button><button data-action="join">Join room</button></div>' : ''}
    <span class="footer-mark" aria-hidden="true"></span></footer>`
}

export function cupResults(s: Snapshot, me: Player, isRecord: boolean) {
  const sorted = [...s.players].sort((a, b) => a.place - b.place)
  const podium = sorted
    .slice(0, 3)
    .map(
      (r) =>
        `<li class="podium-p${r.place}" style="--coat:${ANIMALS[r.animal].color}"><div class="podium-animal"><img alt="" src="${animalPortrait(r.animal)}"></div><div class="podium-name">
       <b>${String(r.place).padStart(2, '0')}</b><strong>${escapeText(r.name)}</strong><small>${r.id === me.id ? 'You' : ANIMALS[r.animal].name}</small></div></li>`,
    )
    .join('')
  const best = personalBest(me.animal)
  return `<div class="cup-finish"><section class="finish-ticket">
    <header><span class="race-stripes"></span> Wildline Cup <span>Final classification</span></header>
    <div class="finish-content"><h1>${me.finishTime === null ? 'Time’s up!' : me.place === 1 ? 'Cup champion!' : 'Across the line!'}</h1>
    <p>${me.finishTime === null ? 'The clock ran out on Jungle Breakdown.' : 'You finished ' + ordinal(me.place) + ' with ' + ANIMALS[me.animal].name + '.'}</p>
    <ol class="podium" aria-label="Podium standings">${podium}</ol>
    ${sorted
      .slice(3)
      .map(
        (p) =>
          `<div class="fourth-place"><b>${ordinal(p.place)}</b> ${escapeText(p.name)} <span>${p.id === me.id ? 'You' : ANIMALS[p.animal].name}</span></div>`,
      )
      .join('')}
    <div class="run-stats">
      <div><small>Your time</small><strong>${me.finishTime === null ? 'DNF' : raceTime(me.finishTime, true)}</strong></div>
      <div><small>Gold gates</small><strong>${me.wildline.hits}<em>/${WILDLINE_GATES.length}</em></strong></div>
      <div><small>Best chain</small><strong>×${me.wildline.best}</strong></div>
    </div>
    ${best ? `<div class="result-best">${icon('clock', 16)}<b>${isRecord ? 'New personal best' : 'Personal best'}</b><span>${ANIMALS[me.animal].name} · ${raceTime(best, true)}</span></div>` : ''}
    <button class="save-photo" data-action="photo">${icon('camera', 16)} Save race photo</button>
    <div class="cup-replay"><button class="cup-launch" data-action="rematch">${icon('flag', 21)}<strong>Race again</strong>${icon('arrow', 20)}</button><button data-action="leave">Change racer</button></div>
    </div></section></div>`
}
