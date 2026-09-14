const path = require('path');
const express = require('express');
const { STORES } = require('./config');
const { generateReport, buscarContaPorCodigo } = require('./report');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/vendor/xlsx', express.static(path.join(__dirname, '..', 'node_modules', 'xlsx', 'dist')));
app.use('/vendor/jspdf', express.static(path.join(__dirname, '..', 'node_modules', 'jspdf', 'dist')));
app.use('/vendor/jspdf-autotable', express.static(path.join(__dirname, '..', 'node_modules', 'jspdf-autotable', 'dist')));

app.get('/api/lojas', (req, res) => {
  const lojas = Object.entries(STORES).map(([key, cfg]) => ({ key, label: cfg.label }));
  res.json(lojas);
});

app.get('/api/relatorio', async (req, res) => {
  const { loja, inicio, fim } = req.query;

  if (!loja || !STORES[loja]) {
    return res.status(400).json({ erro: 'Loja inválida ou não informada.' });
  }
  if (!inicio || !fim) {
    return res.status(400).json({ erro: 'Informe data/hora inicial e final.' });
  }

  const startDate = new Date(inicio);
  const endDate = new Date(fim);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(400).json({ erro: 'Datas inválidas.' });
  }
  if (startDate > endDate) {
    return res.status(400).json({ erro: 'A data inicial não pode ser depois da data final.' });
  }

  try {
    const { matched, unmatched, transferencias } = await generateReport(loja, startDate, endDate);
    res.json({
      loja: STORES[loja].label,
      periodo: { inicio, fim },
      matched,
      unmatched,
      transferencias,
    });
  } catch (err) {
    console.error('Erro ao gerar relatório:', err);
    res.status(500).json({ erro: `Erro ao consultar o banco de dados: ${err.message}` });
  }
});

app.get('/api/conta', async (req, res) => {
  const { loja, codigo } = req.query;

  if (!loja || !STORES[loja]) {
    return res.status(400).json({ erro: 'Loja inválida ou não informada.' });
  }
  const codigoNum = Number(codigo);
  if (!codigo || Number.isNaN(codigoNum)) {
    return res.status(400).json({ erro: 'Informe um código válido do Contas a Pagar.' });
  }

  try {
    const conta = await buscarContaPorCodigo(loja, codigoNum);
    if (!conta) {
      return res.status(404).json({ erro: `Código ${codigoNum} não encontrado no Contas a Pagar.` });
    }
    res.json(conta);
  } catch (err) {
    console.error('Erro ao buscar código do Contas a Pagar:', err);
    res.status(500).json({ erro: `Erro ao consultar o banco de dados: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Protocolo para financeiro rodando em http://localhost:${PORT}`);
});
