// Tema claro/escuro, com transição animada (View Transitions API).
// Compartilhado pela tela principal e pela tela de histórico.

(() => {
  const btnTema = document.getElementById('btn-tema');
  const CHAVE_TEMA = 'protocolo-financeiro-tema';

  function temaAtual() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem(CHAVE_TEMA, tema); } catch (e) { /* ambiente sem localStorage */ }
  }

  if (!btnTema) return;
  btnTema.addEventListener('click', (ev) => {
    const proximo = temaAtual() === 'dark' ? 'light' : 'dark';
    const rect = btnTema.getBoundingClientRect();
    const x = ev.clientX || (rect.left + rect.width / 2);
    const y = ev.clientY || (rect.top + rect.height / 2);
    document.documentElement.style.setProperty('--theme-toggle-x', `${x}px`);
    document.documentElement.style.setProperty('--theme-toggle-y', `${y}px`);

    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.startViewTransition(() => aplicarTema(proximo));
    } else {
      aplicarTema(proximo);
    }
  });
})();
