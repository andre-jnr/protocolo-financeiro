// Montagem do PDF e do Excel do protocolo a partir de um "retrato" do documento.
// Usado pela tela principal (ao gerar) e pela tela de histórico (ao gerar de
// novo um documento antigo). O retrato traz tudo já formatado como texto, para
// que a reimpressão saia exatamente igual ao documento original.
//
// Formato do retrato:
// {
//   tipo: 'pdf' | 'excel', geradoEm: ISO, geradoEmTexto, nomeArquivo,
//   loja, periodoTexto, vencimentosTexto (ou null),
//   linhas: [{ codigo, notaFiscal, dataEmissao, dataVencimento,
//              fornecedor, parcela, valor (número), valorTexto }]
// }

window.DocumentoProtocolo = (() => {
  function pad2(n) { return String(n).padStart(2, '0'); }

  // protocolo-financeiro_dd-mm-aaaa.pdf (barra não é permitida em nome de arquivo)
  function nomeArquivo(geradoEm, extensao) {
    const d = new Date(geradoEm);
    return `protocolo-financeiro_${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}.${extensao}`;
  }

  function gerarExcel(retrato) {
    const linhas = retrato.linhas.map((l) => ({
      'Código': l.codigo,
      'Nota Fiscal': l.notaFiscal,
      'Data de Emissão': l.dataEmissao,
      'Data de Vencimento': l.dataVencimento,
      'Fornecedor': l.fornecedor,
      'Parcela': l.parcela,
      'Valor': Number(l.valor) || 0,
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
    XLSX.writeFile(wb, nomeArquivo(retrato.geradoEm, 'xlsx'));
  }

  function gerarPdf(retrato) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;

    doc.setFontSize(16);
    doc.setTextColor(26, 77, 143);
    doc.text('Protocolo para Financeiro', margin, 45);

    doc.setFontSize(10);
    doc.setTextColor(90, 102, 114);
    doc.text(`Loja: ${retrato.loja}`, margin, 64);
    doc.text(`Período (Data de Lançamento): ${retrato.periodoTexto}`, margin, 78);
    let linhaY = 92;
    if (retrato.vencimentosTexto) {
      doc.text(`Vencimentos: ${retrato.vencimentosTexto}`, margin, linhaY);
      linhaY += 14;
    }
    doc.text(`Gerado em: ${retrato.geradoEmTexto}`, margin, linhaY);

    const linhas = retrato.linhas.map((l) => [
      l.codigo, l.notaFiscal, l.dataEmissao, l.dataVencimento, l.fornecedor, l.parcela, l.valorTexto,
    ]);

    doc.autoTable({
      startY: linhaY + 14,
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

    doc.save(nomeArquivo(retrato.geradoEm, 'pdf'));
  }

  return { nomeArquivo, gerarExcel, gerarPdf };
})();
