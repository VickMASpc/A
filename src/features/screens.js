/** @param {string} eyebrow @param {string} title @param {string} description */
const privateScreen = (eyebrow, title, description) => `
  <section class="screen" aria-labelledby="screen-title">
    <p class="eyebrow">${eyebrow}</p>
    <h1 id="screen-title">${title}</h1>
    <p class="screen-copy">${description}</p>
  </section>`;

export const screenContent = {
  today: `
    <section class="screen" aria-labelledby="screen-title">
      <p class="eyebrow">TODAY</p>
      <h1 id="screen-title">A small step in Japanese.</h1>
      <p class="screen-copy">Sign in to open your private daily session.</p>
    </section>`,
  learn: privateScreen('LEARN', 'Build your foundation.', 'Sign in to read and practise your lessons.'),
  review: privateScreen('REVIEW', 'Keep it familiar.', 'Sign in to revisit your private review material.'),
  progress: privateScreen('PROGRESS', 'Notice the pattern.', 'Sign in to view your course progress and study history.'),
  settings: privateScreen('SETTINGS', 'Make it yours.', 'Sign in to load your account study preferences.')
};
