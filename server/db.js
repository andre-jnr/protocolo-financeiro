const sql = require('mssql');
const { STORES } = require('./config');

const pools = new Map();

async function getPool(storeKey) {
  const storeConfig = STORES[storeKey];
  if (!storeConfig) {
    throw new Error(`Loja desconhecida: ${storeKey}`);
  }

  if (pools.has(storeKey)) {
    const existing = pools.get(storeKey);
    if (existing.connected) return existing;
    pools.delete(storeKey);
  }

  const { label, ...connectionConfig } = storeConfig;
  const pool = new sql.ConnectionPool(connectionConfig);
  pool.on('error', (err) => {
    console.error(`Erro na conexão com a loja "${label}":`, err.message);
  });

  await pool.connect();
  pools.set(storeKey, pool);
  return pool;
}

module.exports = { getPool, sql };
