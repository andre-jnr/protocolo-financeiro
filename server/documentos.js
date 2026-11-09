// Histórico dos documentos (PDF/Excel) gerados.
// Cada documento vira um arquivo JSON em dados/documentos/ com uma cópia
// congelada do que saiu nele (cabeçalho, filtros e linhas já formatadas).
// Esses arquivos nunca são alterados depois: a tela de histórico e a
// reimpressão usam exatamente o que foi gravado no momento da geração.

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const PASTA = path.join(__dirname, '..', 'dados', 'documentos');
const ID_VALIDO = /^[0-9]{13}-[0-9a-f]{8}$/;
const TIPOS = ['pdf', 'excel'];

function texto(valor, max = 500) {
  return String(valor ?? '').slice(0, max);
}

function normalizarLinha(l) {
  return {
    codigo: texto(l.codigo, 30),
    notaFiscal: texto(l.notaFiscal, 60),
    dataEmissao: texto(l.dataEmissao, 20),
    dataVencimento: texto(l.dataVencimento, 20),
    fornecedor: texto(l.fornecedor, 200),
    parcela: texto(l.parcela, 20),
    valor: Number(l.valor) || 0,
    valorTexto: texto(l.valorTexto, 40),
  };
}

// Valida e monta o registro a partir do que o navegador enviou. Lança erro
// com mensagem amigável se faltar algo essencial.
function montarRegistro(corpo, origem) {
  if (!corpo || typeof corpo !== 'object') throw new Error('Documento inválido.');
  if (!TIPOS.includes(corpo.tipo)) throw new Error('Tipo de documento inválido.');
  if (!Array.isArray(corpo.linhas)) throw new Error('Documento sem linhas.');
  const geradoEm = new Date(corpo.geradoEm);
  if (Number.isNaN(geradoEm.getTime())) throw new Error('Data de geração inválida.');

  const linhas = corpo.linhas.slice(0, 5000).map(normalizarLinha);
  return {
    id: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    tipo: corpo.tipo,
    geradoEm: geradoEm.toISOString(),
    geradoEmTexto: texto(corpo.geradoEmTexto, 40),
    registradoEm: new Date().toISOString(),
    origem: texto(origem, 60),
    nomeArquivo: texto(corpo.nomeArquivo, 120),
    loja: texto(corpo.loja, 80),
    periodoTexto: texto(corpo.periodoTexto, 120),
    vencimentosTexto: corpo.vencimentosTexto ? texto(corpo.vencimentosTexto, 60) : null,
    incluiVencidos: Boolean(corpo.incluiVencidos),
    quantidade: linhas.length,
    total: linhas.reduce((soma, l) => soma + l.valor, 0),
    linhas,
  };
}

async function salvarDocumento(corpo, origem) {
  const registro = montarRegistro(corpo, origem);
  await fs.mkdir(PASTA, { recursive: true });
  // flag 'wx': nunca sobrescreve um documento já gravado
  await fs.writeFile(path.join(PASTA, `${registro.id}.json`), JSON.stringify(registro, null, 2), { flag: 'wx' });
  return registro;
}

async function listarDocumentos() {
  let arquivos;
  try {
    arquivos = await fs.readdir(PASTA);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  const resumos = [];
  for (const arquivo of arquivos) {
    if (!arquivo.endsWith('.json')) continue;
    try {
      const doc = JSON.parse(await fs.readFile(path.join(PASTA, arquivo), 'utf8'));
      const { linhas, ...resumo } = doc;
      resumos.push(resumo);
    } catch (err) {
      console.error(`Histórico: não foi possível ler ${arquivo}:`, err.message);
    }
  }
  return resumos.sort((a, b) => String(b.geradoEm).localeCompare(String(a.geradoEm)));
}

async function obterDocumento(id) {
  if (!ID_VALIDO.test(String(id))) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(PASTA, `${id}.json`), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

module.exports = { salvarDocumento, listarDocumentos, obterDocumento };
