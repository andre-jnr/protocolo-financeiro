const { getPool, sql } = require('./db');

// Conta_Corrente = 2 é a conta reservada para transferências internas (sem
// boleto físico). Comparado como texto porque a coluna é varchar e pode conter
// valores não numéricos em outras contas — evita erro de conversão no SQL.
const CONTA_CORRENTE_TRANSFERENCIA = '2';

function isTransferencia(contaCorrente) {
  return contaCorrente !== null && contaCorrente !== undefined && String(contaCorrente).trim() === CONTA_CORRENTE_TRANSFERENCIA;
}

// Condição de casamento entre Entrada_Produto (ep) e Contas_Pagar (cp), usada
// tanto no relatório por período quanto na busca manual por código.
//  - CAST(... AS DATE) compara só a data de emissão, ignorando a hora;
//  - a condição de documento aceita tanto igualdade exata quanto igualdade
//    numérica (TRY_CAST ... AS BIGINT), que ignora zeros à esquerda e
//    diferenças de tipo (varchar x int) entre Nota_Fiscal e N_Doc_Merc.
// A classificação por Conta_Corrente (transferência x lançamento normal) é
// feita depois, em JavaScript, para não arriscar erro de conversão no SQL.
const JOIN_CONDITION = `
     ON CAST(cp.Data_Emissao AS DATE) = CAST(ep.Data_emissao AS DATE)
    AND (
          CAST(cp.N_Doc_Merc AS VARCHAR(50)) = CAST(ep.Nota_Fiscal AS VARCHAR(50))
       OR TRY_CAST(cp.N_Doc_Merc AS BIGINT) = TRY_CAST(ep.Nota_Fiscal AS BIGINT)
        )
`;

async function generateReport(storeKey, startDate, endDate) {
  const pool = await getPool(storeKey);

  const request = pool.request();
  request.input('start', sql.DateTime, startDate);
  request.input('end', sql.DateTime, endDate);

  const result = await request.query(`
    SELECT
      ep.Nota_Fiscal      AS Entrada_Nota_Fiscal,
      ep.Data_emissao     AS Entrada_Data_Emissao,
      ep.Data_Cadastro,
      ep.Data_entrada,
      ep.Codigo_Fornecedor,
      ep.Valor_Produtos,
      p.Nome              AS Fornecedor_Nome,
      cp.Codigo           AS Contas_Codigo,
      cp.N_Doc_Merc,
      cp.Data_Emissao     AS Contas_Data_Emissao,
      cp.Data_Vencimento,
      cp.Parcela,
      cp.Valor,
      cp.Conta_Corrente
    FROM Entrada_Produto ep
    LEFT JOIN Pessoa p
      ON p.Codigo = ep.Codigo_Fornecedor
    LEFT JOIN Contas_Pagar cp
      ${JOIN_CONDITION}
    WHERE ep.Data_Cadastro >= @start AND ep.Data_Cadastro <= @end
  `);

  const matched = [];
  const unmatched = [];
  const transferencias = [];

  for (const row of result.recordset) {
    const fornecedorNome = row.Fornecedor_Nome
      || `Fornecedor cód. ${row.Codigo_Fornecedor ?? '?'} (não encontrado)`;

    if (row.Contas_Codigo !== null && row.Contas_Codigo !== undefined) {
      const entry = {
        notaFiscal: row.N_Doc_Merc,
        dataEmissao: row.Contas_Data_Emissao,
        dataVencimento: row.Data_Vencimento,
        fornecedor: fornecedorNome,
        parcela: row.Parcela,
        valor: row.Valor,
        codigoContasPagar: row.Contas_Codigo,
      };

      if (isTransferencia(row.Conta_Corrente)) {
        transferencias.push(entry);
      } else {
        matched.push(entry);
      }
    } else {
      unmatched.push({
        notaFiscal: row.Entrada_Nota_Fiscal,
        dataEmissao: row.Entrada_Data_Emissao,
        dataCadastro: row.Data_Cadastro,
        dataEntrada: row.Data_entrada,
        fornecedor: fornecedorNome,
        valorProdutos: row.Valor_Produtos,
      });
    }
  }

  ordenarPorDiaDeVencimento(matched);
  ordenarPorDiaDeVencimento(transferencias);
  unmatched.sort((a, b) => new Date(a.dataEmissao) - new Date(b.dataEmissao));

  return { matched, unmatched, transferencias };
}

// Ordena por dia de vencimento (01 a 31), ignorando mês e ano.
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

// Busca manual por código do Contas_Pagar — usada quando o faturista segura uma
// nota e ela acaba sendo lançada fora do período filtrado pela Data_Cadastro.
async function buscarContaPorCodigo(storeKey, codigo) {
  const pool = await getPool(storeKey);
  const request = pool.request();
  request.input('codigo', sql.Int, codigo);

  const result = await request.query(`
    SELECT
      cp.Codigo           AS Contas_Codigo,
      cp.N_Doc_Merc,
      cp.Data_Emissao     AS Contas_Data_Emissao,
      cp.Data_Vencimento,
      cp.Parcela,
      cp.Valor,
      cp.Conta_Corrente,
      ep.Codigo_Fornecedor,
      p.Nome              AS Fornecedor_Nome
    FROM Contas_Pagar cp
    LEFT JOIN Entrada_Produto ep
      ON CAST(ep.Data_emissao AS DATE) = CAST(cp.Data_Emissao AS DATE)
     AND (
           CAST(cp.N_Doc_Merc AS VARCHAR(50)) = CAST(ep.Nota_Fiscal AS VARCHAR(50))
        OR TRY_CAST(cp.N_Doc_Merc AS BIGINT) = TRY_CAST(ep.Nota_Fiscal AS BIGINT)
         )
    LEFT JOIN Pessoa p
      ON p.Codigo = ep.Codigo_Fornecedor
    WHERE cp.Codigo = @codigo
  `);

  const row = result.recordset[0];
  if (!row) return null;

  const fornecedorNome = row.Fornecedor_Nome
    || 'Fornecedor não identificado (sem Entrada_Produto correspondente)';

  return {
    notaFiscal: row.N_Doc_Merc,
    dataEmissao: row.Contas_Data_Emissao,
    dataVencimento: row.Data_Vencimento,
    fornecedor: fornecedorNome,
    parcela: row.Parcela,
    valor: row.Valor,
    codigoContasPagar: row.Contas_Codigo,
    transferencia: isTransferencia(row.Conta_Corrente),
  };
}

module.exports = { generateReport, buscarContaPorCodigo, ordenarPorDiaDeVencimento };
