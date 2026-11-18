const marks = {
  bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-8z"/>',
  camera: '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
  gate: '<path d="M3 21V9l5-6h8l5 6v12M6 21V10l3.5-4h5l3.5 4v11"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  flag: '<path d="m5 21 2-16c4-4 8 4 14-1l-2 10c-5 4-9-3-13 0"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M2 20v-2c0-3 2-5 7-5s7 2 7 5v2m0-15a3.5 3.5 0 0 1 0 7m1.8 2.2c2.3.4 4.2 2.3 4.2 4.8v1"/>',
  run: '<circle cx="15" cy="4.5" r="1.6"/><path d="m5 12 3-3 4.5-1.2 2.8 4 4.7.6m-8.2-3.6L9 14l4 2-2 5m-1.6-7L6 18l-4 .5"/>',
  volume:
    '<path d="M3 9h4l5-4v14l-5-4H3zm13-1a7 7 0 0 1 0 8m3-11a11 11 0 0 1 0 14"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3zm13 0 6 6m0-6-6 6"/>',
  settings:
    '<path d="m10 3 .6-1h2.8l.6 2 2 .9 2-.7 1.8 2.5-1.2 1.8.3 2.1 1.7 1.4-1 3-2.3.3-1.4 1.6-.1 2.2-3 .9-1.6-1.6-2-.3-1.8 1.1-2.5-1.9.7-2-1-2-2-.7V9.7l2.1-.8.9-1.9-.6-2.1 2.5-1.8 1.8 1.1z"/><circle cx="11.8" cy="11.2" r="3"/>',
  keys: '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M6 10h.1m4 0h.1m4 0h.1m4 0h.1M6 14h.1m4 0h6"/>',
  clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 1M9.5 2h5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8c0 1.2 1 2 2 2h3"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-6 5-6 13 0 18 6-5 6-13 0-18z"/>',
  mountain: '<path d="m2 19 7-13 5 8 3-6 5 11zm5-9 2 2 2-2"/>',
  gauge: '<path d="M3 18a9 9 0 1 1 18 0zM12 16l4-6"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  ticket:
    '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zm12 .5v2m0 2v2m0 2V17"/>',
  pin: '<path d="M19 10c0 4-7 11-7 11S5 14 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.4"/>',
  sound: '<path d="M3 11v2m4-7v12m5-16v20m5-17v14m4-9v4"/>',
}
export const icon = (name: keyof typeof marks, size = 20) =>
  '<svg aria-hidden="true" width="' +
  size +
  '" height="' +
  size +
  '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  marks[name] +
  '</svg>'
export const paw =
  '<svg aria-hidden="true" viewBox="0 0 40 40"><g fill="currentColor" transform="rotate(-11 20 20)"><ellipse cx="7" cy="17" rx="3.8" ry="5.2"/><ellipse cx="15" cy="10.4" rx="3.9" ry="5.6"/><ellipse cx="24.4" cy="10.4" rx="3.9" ry="5.6"/><ellipse cx="32" cy="17" rx="3.8" ry="5.1"/><path d="M8 28c0-4 3.8-5.5 6.5-9.3 2.3-3.4 8.2-3.6 10.5 0 2.5 3.8 6.4 5.3 6.4 9.3 0 4.5-5 6.4-8.8 4.7-2-.7-3.5-.8-5.4 0-4.4 1.8-9.2 0-9.2-4.7Z"/></g></svg>'
