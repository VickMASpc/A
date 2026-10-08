export const navigationItems = [
  { route: 'today', label: 'Today', icon: '◉' },
  { route: 'learn', label: 'Learn', icon: 'あ' },
  { route: 'review', label: 'Review', icon: '↻' },
  { route: 'progress', label: 'Progress', icon: '◔' },
  { route: 'settings', label: 'Settings', icon: '⚙' }
];

/** @param {string} hash */
export function readRoute(hash) {
  return hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'today';
}
