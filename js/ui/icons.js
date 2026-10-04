// Inline SVG icon set (24×24, stroke-based, inherits currentColor).
const P = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  path: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h5a4 4 0 0 0 0-8h-2a4 4 0 0 1 0-4h5"/>',
  cards: '<rect x="3" y="6" width="13" height="14" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v11"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  speaker: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8 6.5 19.7l1.2-6.1L3.2 9.4l6.1-.8z"/>',
  flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.2 2-4.2.2 1.4.8 2.2 1.7 2.7C10.3 8.3 10.5 5.5 12 3z"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  lotus: '<path d="M12 20c-4 0-7-3-7-7 3 0 5.5 1.4 7 4 1.5-2.6 4-4 7-4 0 4-3 7-7 7z"/><path d="M12 17c-2-2.5-2-6.500 0-10 2 3.500 2 7.500 0 10z"/>',
  scroll: '<path d="M7 4h11v13a3 3 0 0 1-3 3H6a3 3 0 0 0 3-3V6a2 2 0 0 0-2-2z"/><path d="M7 4a2 2 0 0 0-2 2v1h4"/><path d="M12 9h3M12 13h3"/>',
  wheel: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4v6M12 14v6M4 12h6M14 12h6M6.3 6.3l4.300 4.300M13.400 13.400l4.300 4.300M17.700 6.300l-4.300 4.300M10.600 13.400l-4.300 4.300"/>',
  bridge: '<path d="M3 17h18M5 17c0-5 3-8 7-8s7 3 7 8M8 17v-4M12 17V9M16 17v-4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.200"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 5 1V5a2 2 0 0 0-2-1z"/><path d="M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-5 1V5a2 2 0 0 1 2-1z"/>',
  gem: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l-1 5 4 11M15 4l1 5-4 11"/>',
  ring: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>',
  map: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="12" cy="11" r="1.500"/><path d="M6.600 7.200l4.200 2.800M17.400 7.200l-4.200 2.800M12 12.500V16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.400 1.400M17.600 17.600L19 19M5 19l1.400-1.400M17.600 6.400L19 5"/>',
  moon: '<path d="M20 14.500A8 8 0 1 1 9.500 4a6.500 6.500 0 0 0 10.500 10.500z"/>',
  sparkle: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z"/>',
  logout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
  google: '<path d="M21 12.200c0-.7-.1-1.300-.2-1.900H12v3.600h5.100a4.400 4.400 0 0 1-1.900 2.900v2.400h3.100c1.800-1.700 2.700-4.100 2.700-7z" fill="#4285F4" stroke="none"/><path d="M12 21.500c2.600 0 4.700-.9 6.300-2.300l-3.100-2.400c-.9.600-1.900.9-3.200.9-2.400 0-4.500-1.600-5.200-3.900H3.600v2.500A9.500 9.500 0 0 0 12 21.500z" fill="#34A853" stroke="none"/><path d="M6.800 13.800a5.700 5.700 0 0 1 0-3.600V7.700H3.600a9.500 9.500 0 0 0 0 8.600z" fill="#FBBC05" stroke="none"/><path d="M12 6.300c1.400 0 2.600.5 3.600 1.400l2.700-2.700A9.500 9.500 0 0 0 3.600 7.700l3.200 2.500C7.500 7.900 9.600 6.300 12 6.300z" fill="#EA4335" stroke="none"/>',
};

export function icon(name, size = 22, cls = '') {
  const el = document.createElement('span');
  el.className = `icon ${cls}`.trim();
  el.style.cssText = `display:inline-flex;width:${size}px;height:${size}px;flex:none`;
  el.setAttribute('aria-hidden', 'true');
  const filled = name === 'google';
  el.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ${filled ? '' : 'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'}>${P[name] || P.star}</svg>`;
  return el;
}
export const hasIcon = (n) => n in P;
