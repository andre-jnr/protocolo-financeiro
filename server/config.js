// Credenciais e conexões dos bancos de dados de cada loja.
// Os valores reais ficam no arquivo .env (não versionado) — veja .env.example.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

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

// Loja sem servidor/banco no .env fica de fora: não aparece na lista da tela
// e a API recusa consultas para ela.
const LOJAS = [
  ['parque_dez', 'Parque Dez', 'STORE_PARQUE_DEZ'],
  ['ponta_negra', 'Ponta Negra', 'STORE_PONTA_NEGRA'],
  ['morada_do_sol', 'Morada do Sol', 'STORE_MORADA_DO_SOL'],
  ['monte_das_oliveiras', 'Monte das Oliveiras', 'STORE_MONTE_DAS_OLIVEIRAS'],
  ['cd', 'CD', 'STORE_CD'],
];

const STORES = {};
for (const [key, label, prefixo] of LOJAS) {
  const server = process.env[`${prefixo}_SERVER`];
  const database = process.env[`${prefixo}_DATABASE`];
  if (!server || !database) {
    console.warn(`Loja "${label}" ignorada: defina ${prefixo}_SERVER e ${prefixo}_DATABASE no .env para usá-la.`);
    continue;
  }
  STORES[key] = { label, ...BASE_OPTIONS, server, database };
}

if (Object.keys(STORES).length === 0) {
  console.warn('Nenhuma loja configurada no .env — a lista de lojas ficará vazia (veja .env.example).');
}

module.exports = { STORES };
