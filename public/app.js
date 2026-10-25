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
  const addCodigoForm = document.getElementById('add-codigo-form');
  const codigoInput = document.getElementById('codigo-contas-pagar');
  const btnAddCodigo = document.getElementById('btn-add-codigo');
  const mensagemAddCodigo = document.getElementById('mensagem-add-codigo');
  const btnTema = document.getElementById('btn-tema');
  const chkVencidos = document.getElementById('chk-vencidos');
  const dialogExcluir = document.getElementById('dialog-excluir');
  const dialogExcluirTexto = document.getElementById('dialog-excluir-texto');

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

  // --- Tema claro/escuro, com transição animada (View Transitions API) ---

  const CHAVE_TEMA = 'protocolo-financeiro-tema';

  function temaAtual() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    try { localStorage.setItem(CHAVE_TEMA, tema); } catch (e) { /* ambiente sem localStorage */ }
  }

  if (btnTema) {
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
  }

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

  // Boleto vencido = vencimento antes de hoje. Por padrão fica fora da tela e
  // da exportação; a caixa "Incluir boletos vencidos" traz de volta.
  function estaVencido(item) {
    const venc = new Date(item.dataVencimento);
    if (Number.isNaN(venc.getTime())) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    venc.setHours(0, 0, 0, 0);
    return venc < hoje;
  }

  function mostrarVencidos() {
    return chkVencidos.checked;
  }

  function matchedVisiveis() {
    if (!ultimoRelatorio) return [];
    return mostrarVencidos()
      ? ultimoRelatorio.matched
      : ultimoRelatorio.matched.filter((item) => !estaVencido(item));
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
    const incluirVencidos = mostrarVencidos();
    let visiveis = 0;
    matched.forEach((item, index) => {
      const vencido = estaVencido(item);
      if (vencido && !incluirVencidos) return;
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
    const qtd = data.matched.filter(estaVencido).length;
    if (!qtd) return '';
    return mostrarVencidos()
      ? ` (inclui ${qtd} vencido${qtd > 1 ? 's' : ''})`
      : ` (${qtd} vencido${qtd > 1 ? 's' : ''} oculto${qtd > 1 ? 's' : ''})`;
  }

  function renderResumo(data) {
    const inicioFmt = new Date(data.periodo.inicio).toLocaleString('pt-BR');
    const fimFmt = new Date(data.periodo.fim).toLocaleString('pt-BR');
    resumoInfo.innerHTML = `
      <div><strong>Loja:</strong> ${data.loja}</div>
      <div><strong>Período (Data de Lançamento):</strong> ${inicioFmt} até ${fimFmt}</div>
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
    const indice = indiceParaExcluir;
    indiceParaExcluir = null;
    if (dialogExcluir.returnValue !== 'confirmar' || indice === null || !ultimoRelatorio) return;
    const [removido] = ultimoRelatorio.matched.splice(indice, 1);
    renderMatched(ultimoRelatorio.matched);
    renderResumo(ultimoRelatorio);
    if (removido) {
      setMensagemAddCodigo(`Lançamento ${removido.notaFiscal ?? '-'} (código ${removido.codigoContasPagar ?? '-'}) excluído da exportação. Para trazê-lo de volta, adicione pelo código.`, 'info');
    }
  });

  chkVencidos.addEventListener('change', () => {
    if (!ultimoRelatorio) return;
    renderMatched(ultimoRelatorio.matched);
    renderResumo(ultimoRelatorio);
  });

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
        if (estaVencido(conta) && !mostrarVencidos()) {
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

  btnExcel.addEventListener('click', () => {
    if (!ultimoRelatorio) return;
    const linhas = matchedVisiveis().map((item) => ({
      'Código': item.codigoContasPagar,
      'Nota Fiscal': item.notaFiscal,
      'Data de Emissão': formatDate(item.dataEmissao),
      'Data de Vencimento': formatDate(item.dataVencimento),
      'Fornecedor': item.fornecedor,
      'Parcela': item.parcela,
      'Valor': Number(item.valor) || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(linhas);
    ws['!cols'] = [
      { wch: 10 }, // Código
      { wch: 16 }, // Nota Fiscal
      { wch: 16 }, // Data Emissão
      { wch: 18 }, // Data Vencimento
      { wch: 36 }, // Fornecedor
      { wch: 10 }, // Parcela
      { wch: 14 }, // Valor
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Protocolo Financeiro');

    const nomeArquivo = `protocolo_financeiro_${ultimoRelatorio.loja.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, nomeArquivo);
  });

  btnPdf.addEventListener('click', () => {
    if (!ultimoRelatorio) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    doc.setFontSize(16);
    doc.setTextColor(26, 77, 143);
    doc.text('Protocolo para Financeiro', margin, 45);

    doc.setFontSize(10);
    doc.setTextColor(90, 102, 114);
    const inicioFmt = new Date(ultimoRelatorio.periodo.inicio).toLocaleString('pt-BR');
    const fimFmt = new Date(ultimoRelatorio.periodo.fim).toLocaleString('pt-BR');
    doc.text(`Loja: ${ultimoRelatorio.loja}`, margin, 64);
    doc.text(`Período (Data de Lançamento): ${inicioFmt} até ${fimFmt}`, margin, 78);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, margin, 92);

    const linhas = matchedVisiveis().map((item) => [
      String(item.codigoContasPagar ?? '-'),
      String(item.notaFiscal ?? '-'),
      formatDate(item.dataEmissao),
      formatDate(item.dataVencimento),
      item.fornecedor ?? '-',
      String(item.parcela ?? '-'),
      formatCurrency(item.valor),
    ]);

    doc.autoTable({
      startY: 106,
      head: [['Código', 'Nota Fiscal', 'Data Emissão', 'Data Vencimento', 'Fornecedor', 'Parcela', 'Valor']],
      body: linhas,
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [26, 77, 143], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 246, 249] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 65 },
        2: { cellWidth: 65 },
        3: { cellWidth: 70 },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 40, halign: 'center' },
        6: { cellWidth: 70, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      didDrawPage: () => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Página ${doc.internal.getCurrentPageInfo().pageNumber} de ${pageCount}`,
          pageWidth - margin,
          doc.internal.pageSize.getHeight() - 20,
          { align: 'right' }
        );
      },
    });

    let finalY = doc.lastAutoTable.finalY + 20;
    const pageHeight = doc.internal.pageSize.getHeight();
    if (finalY > pageHeight - 70) {
      doc.addPage();
      finalY = 40;
    }

    const boxHeight = 34;
    doc.setFillColor(255, 244, 229);
    doc.setDrawColor(240, 180, 41);
    doc.setLineWidth(1);
    doc.roundedRect(margin, finalY, pageWidth - margin * 2, boxHeight, 4, 4, 'FD');
    doc.setTextColor(122, 74, 0);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('ATENÇÃO: confira os boletos no ato da entrega.', pageWidth / 2, finalY + boxHeight / 2 + 4, { align: 'center' });
    doc.setFont(undefined, 'normal');

    const nomeArquivo = `protocolo_financeiro_${ultimoRelatorio.loja.replace(/\s+/g, '_')}.pdf`;
    doc.save(nomeArquivo);
  });

  definirPeriodoPadrao();
  carregarLojas();
})();
