/**
 * API base URL for GitHub Pages → Render.
 * Set in each HTML file: <meta name="api-base" content="https://your-app.onrender.com">
 * Leave empty when the Express server serves /client on the same origin (local dev).
 */
(function () {
  var meta = document.querySelector('meta[name="api-base"]');
  var raw = (meta && meta.getAttribute('content')) || '';
  window.API_URL = String(raw).replace(/\/+$/, '');
})();
