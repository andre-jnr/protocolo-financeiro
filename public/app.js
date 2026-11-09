(() => {
  const lojaSelect = document.getElementById('loja');
  const inicioInput = document.getElementById('inicio');
  const fimInput = document.getElementById('fim');
  const form = document.getElementById('filtro-form');
  const btnGerar = document.getElementById('btn-gerar');
  const mensagemEl = document.getElementById('mensagem');
  const resultadoSection = document.getElementById('resultado');
  const resumoInfo = document.getElementById('resumo-info');
  const matchedBody = document.querySelector('#tabela-matched tbody');
  const unmatchedBody = document.querySelector('#tabela-unmatched tbody');
  const transferenciasBody = document.querySelector('#tabela-transferencias tbody');
  const semMatchedEl = document.getElementById('sem-matched');
  const semUnmatchedEl = document.getElementById('sem-unmatched');
  const semTransferenciasEl = document.getElementById('sem-transferencias');
  const btnExcel = document.getElementById('btn-excel');
  const btnPdf = document.getElementById('btn-pdf');
  const mensagemExportEl = document.getElementById('mensagem-export');
  const addCodigoForm = document.getElementById('add-codigo-form');
  const codigoInput = document.getElementById('codigo-contas-pagar');
  const btnAddCodigo = document.getElementById('btn-add-codigo');
  const mensagemAddCodigo = document.getElementById('mensagem-add-codigo');
  const chkVencidos = document.getElementById('chk-vencidos');
  const diaInicialInput = document.getElementById('dia-inicial');
  const diaFinalInput = document.getElementById('dia-final');
  const dialogExcluir = document.getElementById('dialog-excluir');
  const dialogExcluirTexto = document.getElementById('dialog-excluir-texto');
  const btnConfirmarExcluir = document.getElementById('btn-confirmar-excluir');

  let ultimoRelatorio = null;
  let lojaAtual = null;
  let dragSrcIndex = null;
  let indiceParaExcluir = null;

  const ICONE_ARRASTAR = `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
      <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
      <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
    </svg>
  `;

  const ICONE_EXCLUIR = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18"/>
    </svg>
  `;

  function setMensagem(texto, tipo) {
    mensagemEl.textContent = texto || '';
    mensagemEl.className = `mensagem ${tipo || ''}`.trim();
  }

  function setMensagemAddCodigo(texto, tipo) {
    mensagemAddCodigo.textContent = texto || '';
    mensagemAddCodigo.className = `mensagem ${tipo || ''}`.trim();
  }

  function formatDate(value) {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('pt-BR');
  }

  function formatCurrency(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function toLocalDateTimeInputValue(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function definirPeriodoPadrao() {
    const agora = new Date();
    const inicioDoDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0);
    inicioInput.value = toLocalDateTimeInputValue(inicioDoDia);
    fimInput.value = toLocalDateTimeInputValue(agora);
  }

  // Ordena por dia de vencimento (01 a 31), ignorando mês e ano — mesma regra
  // usada no servidor. Reaplicada aqui sempre que um lançamento é adicionado
  // manualmente pelo código do Contas a Pagar.
  function ordenarPorDiaDeVencimento(matched) {
    matched.sort((a, b) => {
      const dayA = new Date(a.dataVencimento).getDate();
      const dayB = new Date(b.dataVencimento).getDate();
      if (dayA !== dayB) return dayA - dayB;
      const dateDiff = new Date(a.dataVencimento) - new Date(b.dataVencimento);
      if (dateDiff !== 0) return dateDiff;
      return String(a.notaFiscal).localeCompare(String(b.notaFiscal));
    });
    return matched;
  }

  // Boleto vencido = vencimento até hoje (inclusive). Por padrão fica fora da tela e
  // da exportação; a caixa "Incluir boletos vencidos" traz de volta.
  function estaVencido(item) {
    const venc = new Date(item.dataVencimento);
    if (Number.isNaN(venc.getTime())) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    venc.setHours(0, 0, 0, 0);
    return venc <= hoje;
  }

  function mostrarVencidos() {
    return chkVencidos.checked;
  }

  // Filtro por dia do vencimento (01 a 31), ignorando mês e ano. Se o dia
  // inicial for maior que o final (ex.: 25 a 05), pega a virada do mês:
  // 25 a 31 e 01 a 05.
  function lerDia(input, padrao) {
    const n = Number.parseInt(input.value, 10);
    if (Number.isNaN(n)) return padrao;
    return Math.min(31, Math.max(1, n));
  }

  function diasVencimento() {
    return { inicial: lerDia(diaInicialInput, 1), final: lerDia(diaFinalInput, 31) };
  }

  function filtroDiasAtivo() {
    const { inicial, final } = diasVencimento();
    return inicial !== 1 || final !== 31;
  }

  function dentroDosDias(item) {
    const venc = new Date(item.dataVencimento);
    if (Number.isNaN(venc.getTime())) return true;
    const dia = venc.getDate();
    const { inicial, final } = diasVencimento();
    return inicial <= final
      ? dia >= inicial && dia <= final
      : dia >= inicial || dia <= final;
  }

  function estaVisivel(item) {
    return dentroDosDias(item) && (mostrarVencidos() || !estaVencido(item));
  }

  function matchedVisiveis() {
    if (!ultimoRelatorio) return [];
    return ultimoRelatorio.matched.filter(estaVisivel);
  }

  async function carregarLojas() {
    try {
      const res = await fetch('/api/lojas');
      const lojas = await res.json();
      lojaSelect.innerHTML = '<option value="">Selecione...</option>' +
        lojas.map((l) => `<option value="${l.key}">${l.label}</option>`).join('');
    } catch (err) {
      lojaSelect.innerHTML = '<option value="">Erro ao carregar lojas</option>';
      setMensagem('Não foi possível carregar a lista de lojas. Verifique se o servidor está rodando.', 'erro');
    }
  }

  function renderMatched(matched) {
    matchedBody.innerHTML = '';
    let visiveis = 0;
    matched.forEach((item, index) => {
      if (!estaVisivel(item)) return;
      const vencido = estaVencido(item);
      visiveis += 1;
      const tr = document.createElement('tr');
      if (vencido) tr.classList.add('linha-vencida');
      tr.dataset.index = String(index);
      tr.innerHTML = `
        <td class="drag-handle" draggable="true" title="Arraste para reordenar">${ICONE_ARRASTAR}</td>
        <td>${item.codigoContasPagar ?? '-'}</td>
        <td>${item.notaFiscal ?? '-'}</td>
        <td>${formatDate(item.dataEmissao)}</td>
        <td>${formatDate(item.dataVencimento)}${vencido ? ' <span class="tag-vencido">Vencido</span>' : ''}</td>
        <td>${item.fornecedor ?? '-'}</td>
        <td>${item.parcela ?? '-'}</td>
        <td>${formatCurrency(item.valor)}</td>
        <td class="col-acao"><button type="button" class="btn-excluir" data-index="${index}" title="Excluir da exportação" aria-label="Excluir lançamento ${item.notaFiscal ?? ''}">${ICONE_EXCLUIR}</button></td>
      `;
      matchedBody.appendChild(tr);
    });
    semMatchedEl.hidden = visiveis > 0;
  }

  function renderUnmatched(unmatched) {
    unmatchedBody.innerHTML = '';
    semUnmatchedEl.hidden = unmatched.length > 0;
    for (const item of unmatched) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.notaFiscal ?? '-'}</td>
        <td>${formatDate(item.dataEmissao)}</td>
        <td>${formatDate(item.dataCadastro)}</td>
        <td>${item.fornecedor ?? '-'}</td>
        <td>${formatCurrency(item.valorProdutos)}</td>
      `;
      unmatchedBody.appendChild(tr);
    }
  }

  function renderTransferencias(transferencias) {
    transferenciasBody.innerHTML = '';
    semTransferenciasEl.hidden = transferencias.length > 0;
    for (const item of transferencias) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.codigoContasPagar ?? '-'}</td>
        <td>${item.notaFiscal ?? '-'}</td>
        <td>${formatDate(item.dataEmissao)}</td>
        <td>${formatDate(item.dataVencimento)}</td>
        <td>${item.fornecedor ?? '-'}</td>
        <td>${item.parcela ?? '-'}</td>
        <td>${formatCurrency(item.valor)}</td>
      `;
      transferenciasBody.appendChild(tr);
    }
  }

  function textoVencidos(data) {
    const partes = [];
    const qtd = data.matched.filter((item) => dentroDosDias(item) && estaVencido(item)).length;
    if (qtd) {
      partes.push(mostrarVencidos()
        ? `inclui ${qtd} vencido${qtd > 1 ? 's' : ''}`
        : `${qtd} vencido${qtd > 1 ? 's' : ''} oculto${qtd > 1 ? 's' : ''}`);
    }
    const foraDosDias = data.matched.filter((item) => !dentroDosDias(item)).length;
    if (foraDosDias) {
      partes.push(`${foraDosDias} fora dos dias de vencimento`);
    }
    return partes.length ? ` (${partes.join(' · ')})` : '';
  }

  function textoDiasVencimento() {
    const { inicial, final } = diasVencimento();
    return `dia ${pad2(inicial)} ao dia ${pad2(final)}`;
  }

  function renderResumo(data) {
    const inicioFmt = new Date(data.periodo.inicio).toLocaleString('pt-BR');
    const fimFmt = new Date(data.periodo.fim).toLocaleString('pt-BR');
    resumoInfo.innerHTML = `
      <div><strong>Loja:</strong> ${data.loja}</div>
      <div><strong>Período (Data de Lançamento):</strong> ${inicioFmt} até ${fimFmt}</div>
      ${filtroDiasAtivo() ? `<div><strong>Vencimentos:</strong> ${textoDiasVencimento()}</div>` : ''}
      <div><strong>Lançamentos encontrados:</strong> ${matchedVisiveis().length}${textoVencidos(data)} &nbsp;|&nbsp; <strong>Transferências:</strong> ${data.transferencias.length} &nbsp;|&nbsp; <strong>Sem lançamento no financeiro:</strong> ${data.unmatched.length}</div>
    `;
  }

  // --- Excluir lançamento da lista (não sai no Excel/PDF) ---
  // Remove só da lista em memória; gerar o relatório de novo ou adicionar
  // pelo código traz o lançamento de volta.

  matchedBody.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-excluir');
    if (!btn || !ultimoRelatorio) return;
    indiceParaExcluir = Number(btn.dataset.index);
    const item = ultimoRelatorio.matched[indiceParaExcluir];
    if (!item) return;
    dialogExcluirTexto.textContent = `Nota ${item.notaFiscal ?? '-'} · ${item.fornecedor ?? '-'} · parcela ${item.parcela ?? '-'} · ${formatCurrency(item.valor)}`;
    dialogExcluir.returnValue = '';
    dialogExcluir.showModal();
  });

  // Clique fora da caixa (no fundo escurecido) cancela.
  dialogExcluir.addEventListener('click', (e) => {
    if (e.target === dialogExcluir) dialogExcluir.close('cancelar');
  });

  dialogExcluir.addEventListener('close', () => {
    indiceParaExcluir = null;
  });

  // A exclusão acontece no próprio clique do "Sim, excluir", e não no evento
  // "close" do dialog: o navegador dispara o "close" depois, em outra tarefa, e
  // um clique rápido em Exportar logo em seguida ainda pegava o lançamento.
  btnConfirmarExcluir.addEventListener('click', (e) => {
    e.preventDefault();
    const indice = indiceParaExcluir;
    indiceParaExcluir = null;
    dialogExcluir.close('confirmar');
    if (indice === null || !ultimoRelatorio) return;
    const [removido] = ultimoRelatorio.matched.splice(indice, 1);
    renderMatched(ultimoRelatorio.matched);
    renderResumo(ultimoRelatorio);
    if (removido) {
      setMensagemAddCodigo(`Lançamento ${removido.notaFiscal ?? '-'} (código ${removido.codigoContasPagar ?? '-'}) excluído da exportação. Para trazê-lo de volta, adicione pelo código.`, 'info');
    }
  });

  function aplicarFiltrosDaTabela() {
    if (!ultimoRelatorio) return;
    renderMatched(ultimoRelatorio.matched);
    renderResumo(ultimoRelatorio);
  }

  chkVencidos.addEventListener('change', aplicarFiltrosDaTabela);

  // Os dias valem na hora, sem consultar o banco de novo. Ao sair do campo,
  // o valor é corrigido para 01-31 com dois dígitos.
  for (const input of [diaInicialInput, diaFinalInput]) {
    input.addEventListener('input', aplicarFiltrosDaTabela);
    input.addEventListener('change', () => {
      const padrao = input === diaInicialInput ? 1 : 31;
      input.value = pad2(lerDia(input, padrao));
      aplicarFiltrosDaTabela();
    });
  }

  // --- Drag and drop das linhas da tabela de lançamentos encontrados ---

  matchedBody.addEventListener('dragstart', (e) => {
    const tr = e.target.closest('tr');
    if (!tr) return;
    dragSrcIndex = Number(tr.dataset.index);
    tr.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragSrcIndex));
  });

  matchedBody.addEventListener('dragend', () => {
    matchedBody.querySelectorAll('tr').forEach((r) => {
      r.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
    });
    dragSrcIndex = null;
  });

  matchedBody.addEventListener('dragover', (e) => {
    if (dragSrcIndex === null) return;
    e.preventDefault();
    const tr = e.target.closest('tr');
    if (!tr) return;
    const rect = tr.getBoundingClientRect();
    const isAfter = (e.clientY - rect.top) > rect.height / 2;
    matchedBody.querySelectorAll('tr').forEach((r) => r.classList.remove('drag-over-top', 'drag-over-bottom'));
    tr.classList.add(isAfter ? 'drag-over-bottom' : 'drag-over-top');
  });

  matchedBody.addEventListener('drop', (e) => {
    e.preventDefault();
    const tr = e.target.closest('tr');
    if (!tr || dragSrcIndex === null || !ultimoRelatorio) return;

    const targetIndex = Number(tr.dataset.index);
    const rect = tr.getBoundingClientRect();
    const isAfter = (e.clientY - rect.top) > rect.height / 2;

    if (targetIndex !== dragSrcIndex) {
      const arr = ultimoRelatorio.matched;
      const [moved] = arr.splice(dragSrcIndex, 1);
      let insertAt = targetIndex;
      if (dragSrcIndex < targetIndex) insertAt -= 1;
      if (isAfter) insertAt += 1;
      arr.splice(insertAt, 0, moved);
      renderMatched(arr);
    }

    dragSrcIndex = null;
  });

  // --- Geração do relatório ---

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const loja = lojaSelect.value;
    const inicio = inicioInput.value;
    const fim = fimInput.value;

    if (!loja) {
      setMensagem('Selecione uma loja.', 'erro');
      return;
    }
    if (!inicio || !fim) {
      setMensagem('Informe o período completo.', 'erro');
      return;
    }

    btnGerar.disabled = true;
    setMensagem('Consultando o banco de dados...', 'info');
    resultadoSection.hidden = true;

    try {
      const params = new URLSearchParams({ loja, inicio, fim });
      const res = await fetch(`/api/relatorio?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.erro || 'Erro desconhecido ao gerar relatório.');
      }

      ultimoRelatorio = data;
      lojaAtual = loja;
      setMensagemAddCodigo('', '');
      codigoInput.value = '';
      renderResumo(data);
      renderMatched(data.matched);
      renderTransferencias(data.transferencias);
      renderUnmatched(data.unmatched);
      resultadoSection.hidden = false;
      setMensagem('', '');
    } catch (err) {
      setMensagem(err.message, 'erro');
    } finally {
      btnGerar.disabled = false;
    }
  });

  // --- Adicionar lançamento manualmente pelo código do Contas a Pagar ---
  // Cobre o caso do faturista segurar uma nota até algo ser corrigido: quando
  // ela é lançada, a Data_Cadastro fica fora do período filtrado e o
  // relatório automático não a encontra.

  addCodigoForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();

    if (!ultimoRelatorio || !lojaAtual) {
      setMensagemAddCodigo('Gere um relatório antes de adicionar um código manualmente.', 'erro');
      return;
    }

    const codigo = codigoInput.value.trim();
    if (!codigo) {
      setMensagemAddCodigo('Informe o código do Contas a Pagar.', 'erro');
      return;
    }

    btnAddCodigo.disabled = true;
    setMensagemAddCodigo('Buscando...', 'info');

    try {
      const params = new URLSearchParams({ loja: lojaAtual, codigo });
      const res = await fetch(`/api/conta?${params.toString()}`);
      const conta = await res.json();

      if (!res.ok) {
        throw new Error(conta.erro || 'Não foi possível localizar o código informado.');
      }

      const existente = ultimoRelatorio.matched.find((m) => m.codigoContasPagar === conta.codigoContasPagar);
      if (existente && !dentroDosDias(existente)) {
        throw new Error(`O código ${conta.codigoContasPagar} já está na lista, mas o vencimento está fora dos dias filtrados (${textoDiasVencimento()}).`);
      }
      if (existente && estaVencido(existente) && !mostrarVencidos()) {
        throw new Error(`O código ${conta.codigoContasPagar} já está na lista, mas está vencido e oculto. Marque "Incluir boletos vencidos" para vê-lo.`);
      }
      const jaExiste = Boolean(existente)
        || ultimoRelatorio.transferencias.some((t) => t.codigoContasPagar === conta.codigoContasPagar);
      if (jaExiste) {
        throw new Error(`O código ${conta.codigoContasPagar} já está na tabela.`);
      }

      let aviso;
      if (conta.transferencia) {
        ultimoRelatorio.transferencias.push(conta);
        ordenarPorDiaDeVencimento(ultimoRelatorio.transferencias);
        renderTransferencias(ultimoRelatorio.transferencias);
        aviso = `Lançamento ${conta.notaFiscal} (parcela ${conta.parcela ?? '-'}) é uma transferência (Conta Corrente = 2) e foi adicionado à tabela de Transferências.`;
      } else {
        ultimoRelatorio.matched.push(conta);
        ordenarPorDiaDeVencimento(ultimoRelatorio.matched);
        renderMatched(ultimoRelatorio.matched);
        aviso = `Lançamento ${conta.notaFiscal} (parcela ${conta.parcela ?? '-'}) adicionado com sucesso.`;
        if (!dentroDosDias(conta)) {
          aviso += ` O vencimento está fora dos dias filtrados (${textoDiasVencimento()}), então ele fica oculto e não sai na exportação.`;
        } else if (estaVencido(conta) && !mostrarVencidos()) {
          aviso += ' Ele está vencido e fica oculto: marque "Incluir boletos vencidos" para vê-lo e exportá-lo.';
        }
      }
      renderResumo(ultimoRelatorio);
      setMensagemAddCodigo(aviso, 'info');
      codigoInput.value = '';
    } catch (err) {
      setMensagemAddCodigo(err.message, 'erro');
    } finally {
      btnAddCodigo.disabled = false;
    }
  });

  // --- Exportação ---
  // Monta um retrato do documento com tudo já formatado, gera o arquivo a
  // partir dele (documento.js) e grava o mesmo retrato no histórico. Assim a
  // tela de histórico mostra e reimprime exatamente o que saiu no documento.

  function montarRetrato(tipo) {
    const agora = new Date();
    const inicioFmt = new Date(ultimoRelatorio.periodo.inicio).toLocaleString('pt-BR');
    const fimFmt = new Date(ultimoRelatorio.periodo.fim).toLocaleString('pt-BR');
    return {
      tipo,
      geradoEm: agora.toISOString(),
      geradoEmTexto: agora.toLocaleString('pt-BR'),
      nomeArquivo: DocumentoProtocolo.nomeArquivo(agora, tipo === 'pdf' ? 'pdf' : 'xlsx'),
      loja: ultimoRelatorio.loja,
      periodoTexto: `${inicioFmt} até ${fimFmt}`,
      vencimentosTexto: filtroDiasAtivo() ? textoDiasVencimento() : null,
      incluiVencidos: mostrarVencidos(),
      linhas: matchedVisiveis().map((item) => ({
        codigo: String(item.codigoContasPagar ?? '-'),
        notaFiscal: String(item.notaFiscal ?? '-'),
        dataEmissao: formatDate(item.dataEmissao),
        dataVencimento: formatDate(item.dataVencimento),
        fornecedor: item.fornecedor ?? '-',
        parcela: String(item.parcela ?? '-'),
        valor: Number(item.valor) || 0,
        valorTexto: formatCurrency(item.valor),
      })),
    };
  }

  function setMensagemExport(texto, tipo) {
    mensagemExportEl.textContent = texto || '';
    mensagemExportEl.className = `mensagem ${tipo || ''}`.trim();
  }

  async function registrarNoHistorico(retrato) {
    try {
      const res = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retrato),
      });
      const resposta = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(resposta.erro || 'Erro desconhecido.');
      setMensagemExport(`${retrato.nomeArquivo} gerado e registrado no histórico.`, 'info');
    } catch (err) {
      setMensagemExport(`O arquivo foi gerado, mas não foi registrado no histórico: ${err.message}`, 'erro');
    }
  }

  function exportar(tipo) {
    if (!ultimoRelatorio) return;
    const retrato = montarRetrato(tipo);
    if (tipo === 'pdf') {
      DocumentoProtocolo.gerarPdf(retrato);
    } else {
      DocumentoProtocolo.gerarExcel(retrato);
    }
    registrarNoHistorico(retrato);
  }

  btnExcel.addEventListener('click', () => exportar('excel'));
  btnPdf.addEventListener('click', () => exportar('pdf'));

  definirPeriodoPadrao();
  carregarLojas();
})();
