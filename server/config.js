// Credenciais e conexões dos bancos de dados de cada loja.
// Os valores reais ficam no arquivo .env (não versionado) — veja .env.example.

require('dotenv').config();

const USER = process.env.DB_USER;
const PASSWORD = process.env.DB_PASSWORD;

if (!USER || !PASSWORD) {
  throw new Error(
    'DB_USER e/ou DB_PASSWORD não definidos. Crie um arquivo .env na raiz do projeto '
    + '(copie .env.example) e preencha as credenciais do banco.'
  );
}

const BASE_OPTIONS = {
  user: USER,
  password: PASSWORD,
  port: 1433,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    // As colunas de data no SISMoura não têm fuso horário (são horário local).
    // Sem isso, o driver interpreta/serializa como UTC e, no fuso do Brasil
    // (UTC-3), datas "de meia-noite" (Data_emissao, Data_Vencimento, etc.)
    // voltam um dia — quebrando o cruzamento com Contas_Pagar.
    useUTC: false,
  },
  connectionTimeout: 15000,
  requestTimeout: 30000,
};

function buildStore(label, server, database) {
  if (!server || !database) {
    throw new Error(
      `Configuração incompleta para a loja "${label}" — defina o servidor e o banco `
      + 'correspondentes no arquivo .env (veja .env.example).'
    );
  }
  return { label, ...BASE_OPTIONS, server, database };
}

const STORES = {
  parque_dez: buildStore('Parque Dez', process.env.STORE_PARQUE_DEZ_SERVER, process.env.STORE_PARQUE_DEZ_DATABASE),
  ponta_negra: buildStore('Ponta Negra', process.env.STORE_PONTA_NEGRA_SERVER, process.env.STORE_PONTA_NEGRA_DATABASE),
  morada_do_sol: buildStore('Morada do Sol', process.env.STORE_MORADA_DO_SOL_SERVER, process.env.STORE_MORADA_DO_SOL_DATABASE),
  monte_das_oliveiras: buildStore('Monte das Oliveiras', process.env.STORE_MONTE_DAS_OLIVEIRAS_SERVER, process.env.STORE_MONTE_DAS_OLIVEIRAS_DATABASE),
  cd: buildStore('CD', process.env.STORE_CD_SERVER, process.env.STORE_CD_DATABASE),
};

module.exports = { STORES };
