/* RIHAM — tiny motion helpers (header shadow on scroll). Everything else is pure CSS. */
(function () {
  var header = document.querySelector('.site-header');
  if (!header) return;
  var ticking = false;
  function update() {
    header.classList.toggle('scrolled', window.scrollY > 8);
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();
})();
