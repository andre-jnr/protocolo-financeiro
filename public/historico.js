(() => {
  const corpoLista = document.querySelector('#tabela-historico tbody');
  const semDocumentosEl = document.getElementById('sem-documentos');
  const mensagemEl = document.getElementById('mensagem');
  const filtroLoja = document.getElementById('filtro-loja');
  const filtroTipo = document.getElementById('filtro-tipo');
  const detalheSection = document.getElementById('detalhe');
  const detalheTitulo = document.getElementById('detalhe-titulo');
  const detalheInfo = document.getElementById('detalhe-info');
  const corpoDetalhe = document.querySelector('#tabela-detalhe tbody');
  const rodapeDetalhe = document.querySelector('#tabela-detalhe tfoot');
  const semLinhasEl = document.getElementById('sem-linhas');
  const btnPdf = document.getElementById('btn-pdf');
  const btnExcel = document.getElementById('btn-excel');

  const TIPOS = { pdf: 'PDF', excel: 'Excel' };

  let documentos = [];
  let documentoAberto = null;

  function setMensagem(texto, tipo) {
    mensagemEl.textContent = texto || '';
    mensagemEl.className = `mensagem ${tipo || ''}`.trim();
  }

  function formatCurrency(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // Os textos vêm do arquivo gravado; escapados para não virarem HTML.
  function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function documentosFiltrados() {
    return documentos.filter((d) => (!filtroLoja.value || d.loja === filtroLoja.value)
      && (!filtroTipo.value || d.tipo === filtroTipo.value));
  }

  function renderLista() {
    const lista = documentosFiltrados();
    corpoLista.innerHTML = '';
    semDocumentosEl.hidden = lista.length > 0;
    semDocumentosEl.textContent = documentos.length
      ? 'Nenhum documento com esses filtros.'
      : 'Nenhum documento gerado ainda.';
    for (const d of lista) {
      const tr = document.createElement('tr');
      tr.className = 'linha-clicavel';
      tr.tabIndex = 0;
      tr.dataset.id = d.id;
      if (documentoAberto && documentoAberto.id === d.id) tr.classList.add('selecionada');
      tr.innerHTML = `
        <td>${esc(d.geradoEmTexto)}</td>
        <td><span class="tag-tipo tag-tipo--${esc(d.tipo)}">${esc(TIPOS[d.tipo] || d.tipo)}</span></td>
        <td>${esc(d.loja)}</td>
        <td>${esc(d.periodoTexto)}</td>
        <td>${d.vencimentosTexto ? esc(d.vencimentosTexto) : 'Todos'}</td>
        <td>${esc(d.quantidade)}</td>
        <td>${esc(formatCurrency(d.total))}</td>
      `;
      corpoLista.appendChild(tr);
    }
  }

  function preencherFiltroLojas() {
    const lojas = [...new Set(documentos.map((d) => d.loja))].sort();
    filtroLoja.innerHTML = '<option value="">Todas</option>'
      + lojas.map((l) => `<option value="${esc(l)}">${esc(l)}</option>`).join('');
  }

  async function carregarLista() {
    setMensagem('Carregando histórico...', 'info');
    try {
      const res = await fetch('/api/documentos');
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.erro || 'Erro ao carregar o histórico.');
      documentos = dados;
      preencherFiltroLojas();
      renderLista();
      setMensagem('', '');
    } catch (err) {
      setMensagem(err.message, 'erro');
    }
  }

  function renderDetalhe(doc) {
    detalheTitulo.textContent = doc.nomeArquivo;
    detalheInfo.innerHTML = `
      <div><strong>Tipo:</strong> ${esc(TIPOS[doc.tipo] || doc.tipo)} &nbsp;|&nbsp; <strong>Gerado em:</strong> ${esc(doc.geradoEmTexto)}</div>
      <div><strong>Loja:</strong> ${esc(doc.loja)}</div>
      <div><strong>Período (Data de Lançamento):</strong> ${esc(doc.periodoTexto)}</div>
      <div><strong>Vencimentos:</strong> ${doc.vencimentosTexto ? esc(doc.vencimentosTexto) : 'todos os dias'} &nbsp;|&nbsp; <strong>Boletos vencidos:</strong> ${doc.incluiVencidos ? 'incluídos' : 'ocultos'}</div>
    `;

    corpoDetalhe.innerHTML = '';
    for (const l of doc.linhas) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(l.codigo)}</td>
        <td>${esc(l.notaFiscal)}</td>
        <td>${esc(l.dataEmissao)}</td>
        <td>${esc(l.dataVencimento)}</td>
        <td>${esc(l.fornecedor)}</td>
        <td>${esc(l.parcela)}</td>
        <td>${esc(l.valorTexto)}</td>
      `;
      corpoDetalhe.appendChild(tr);
    }
    semLinhasEl.hidden = doc.linhas.length > 0;
    rodapeDetalhe.innerHTML = doc.linhas.length
      ? `<tr><td colspan="6">${esc(doc.quantidade)} lançamento${doc.quantidade > 1 ? 's' : ''}</td><td>${esc(formatCurrency(doc.total))}</td></tr>`
      : '';

    detalheSection.hidden = false;
  }

  async function abrirDocumento(id) {
    setMensagem('Abrindo documento...', 'info');
    try {
      const res = await fetch(`/api/documentos/${encodeURIComponent(id)}`);
      const doc = await res.json();
      if (!res.ok) throw new Error(doc.erro || 'Erro ao abrir o documento.');
      documentoAberto = doc;
      renderLista();
      renderDetalhe(doc);
      setMensagem('', '');
      detalheSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      setMensagem(err.message, 'erro');
    }
  }

  corpoLista.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) abrirDocumento(tr.dataset.id);
  });

  corpoLista.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    e.preventDefault();
    abrirDocumento(tr.dataset.id);
  });

  filtroLoja.addEventListener('change', renderLista);
  filtroTipo.addEventListener('change', renderLista);

  // Reimpressão: usa o retrato gravado, com a data e os dados originais.
  // Não cria um novo registro no histórico.
  btnPdf.addEventListener('click', () => {
    if (documentoAberto) DocumentoProtocolo.gerarPdf(documentoAberto);
  });
  btnExcel.addEventListener('click', () => {
    if (documentoAberto) DocumentoProtocolo.gerarExcel(documentoAberto);
  });

  carregarLista();
})();
