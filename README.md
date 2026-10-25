# Protocolo para Financeiro

Porta: **3006** (configurável por `PORT` no `.env`).

Sistema local para conferência dos lançamentos do faturista (Entrada de Produtos) com os títulos do Contas a Pagar, por período de cadastro.

## Como funciona

- Um pequeno servidor local (Node.js) conecta diretamente no banco SQL Server de cada loja e roda as consultas.
- O navegador acessa esse servidor local (`http://localhost:3006`) para gerar o relatório e exportar Excel/PDF.
- O cruzamento é feito por **Data de Emissão + Nota Fiscal** (`Entrada_Produto`) com **Data_Emissao + N_Doc_Merc** (`Contas_Pagar`), ignorando hora, zeros à esquerda e diferenças de tipo (varchar x int) entre os dois números de documento.
- Lançamentos com **Conta_Corrente = 2** (transferência interna, sem boleto físico) vão para uma tabela separada de "Transferências", não para a de lançamentos encontrados.
- A lista de lançamentos encontrados é ordenada apenas pelo **dia do vencimento** (01 a 31), ignorando mês/ano, e pode ser reordenada manualmente arrastando as linhas (drag and drop) — a ordem manual vale para a exportação.
- Cada linha mostra o código do lançamento no Contas a Pagar. Se o faturista segurar uma nota e ela for lançada fora do período (Data de Lançamento), dá pra adicionar manualmente pelo código do Contas a Pagar — a linha é inserida já na posição correta pelo dia de vencimento.
- Boletos **vencidos** (vencimento antes de hoje) ficam ocultos da tabela e da exportação por padrão; marcando **"Incluir boletos vencidos"** eles voltam, com a etiqueta "Vencido".
- Qualquer lançamento pode ser tirado da exportação pelo **X** da linha (com confirmação). Só sai da lista em tela; nada é apagado do banco.
- Entradas sem título correspondente e as transferências aparecem só na tela, em seções separadas (não entram no Excel/PDF).

## Como rodar (usuário do dia a dia)

Dê **dois cliques** no arquivo **`Iniciar Protocolo Financeiro.bat`**, na pasta principal do sistema.

- Na primeira vez, ele instala tudo sozinho (pode demorar um pouco — precisa de internet nessa etapa).
- Depois disso, ele abre uma janela chamada **"Protocolo para Financeiro - Servidor"** (essa é a janela que mantém o sistema funcionando) e o navegador já abre com a página pronta.
- Para **encerrar** o sistema, feche a janela do servidor.
- Se quiser um atalho na área de trabalho: clique com o botão direito no arquivo `.bat` → **Enviar para** → **Área de trabalho (criar atalho)**.

Se o Node.js não estiver instalado no computador, o script avisa e pede para instalar em [nodejs.org](https://nodejs.org/) (versão LTS).

## Como rodar (linha de comando / desenvolvimento)

1. Instale as dependências (uma vez só):
   ```
   npm install
   ```
2. Inicie o servidor:
   ```
   npm start
   ```
3. Abra no navegador: `http://localhost:3006`

## Publicar no servidor (Windows)

1. Copie a pasta do projeto para o servidor (sem `node_modules`).
2. Tenha o Node.js LTS instalado.
3. Crie o `.env` a partir do `.env.example`.
4. Clique duas vezes em `servidor\instalar.bat` e confirme o pedido de administrador.

Sobe sozinho ao ligar o computador (tarefa agendada "Protocolo para financeiro (3006)"), reinicia se cair,
e fica acessível em http://NOME-DO-SERVIDOR:3006. Log: `logs\servidor.log`.
Para atualizar: copie os arquivos novos e rode o `instalar.bat` de novo.
Para remover: `servidor\desinstalar.bat` (não apaga dados).

## Configuração de conexão

As credenciais e servidores de cada loja **não ficam no código** — ficam em um arquivo `.env` na raiz do projeto, que não é versionado no Git.

1. Copie `.env.example` para `.env`.
2. Preencha `DB_USER`, `DB_PASSWORD` e o servidor/banco de cada loja:

| Variável | Exemplo |
|---|---|
| `STORE_PARQUE_DEZ_SERVER` / `STORE_PARQUE_DEZ_DATABASE` | serverprq10 / sismoura |
| `STORE_PONTA_NEGRA_SERVER` / `STORE_PONTA_NEGRA_DATABASE` | server_pn / sismoura |
| `STORE_MORADA_DO_SOL_SERVER` / `STORE_MORADA_DO_SOL_DATABASE` | serverad / sismoura_srv |
| `STORE_MONTE_DAS_OLIVEIRAS_SERVER` / `STORE_MONTE_DAS_OLIVEIRAS_DATABASE` | 200.150.200.180 / SISMOURA_SRV_MONTE |
| `STORE_CD_SERVER` / `STORE_CD_DATABASE` | serverprq10 / sismoura_cd |

Só aparecem no sistema as lojas com `_SERVER` **e** `_DATABASE` preenchidos. Para esconder uma loja, deixe as duas linhas dela vazias (ou apague-as) e reinicie o sistema; o log avisa quais lojas foram ignoradas.

Esses nomes de servidor só resolvem dentro da rede interna da empresa — rode o sistema em uma máquina com acesso a essa rede.

Se algum servidor usar criptografia/certificado próprio ou porta diferente de 1433, ajuste as opções em `server/config.js` (`options.encrypt`, `port`, etc.).

**Atenção:** o arquivo `.env` contém a senha do usuário `sa` do banco — ele já está no `.gitignore` e nunca deve ser commitado. O arquivo `dados.md` (anotações antigas com as mesmas credenciais) também está ignorado pelo Git. Ao clonar o repositório em uma máquina nova, sempre recrie o `.env` localmente a partir do `.env.example`.

## Estrutura

```
Iniciar Protocolo Financeiro.bat  -> atalho para o usuário final (dois cliques)
server/
  server.js               -> servidor Express + rotas da API
  config.js               -> credenciais e dados de conexão por loja
  db.js                   -> pool de conexão com o SQL Server (mssql)
  report.js               -> consultas e cruzamento dos dados
  iniciar-servidor.bat    -> roda "node server.js" numa janela própria (usado pelo .bat principal)
servidor/                 -> publicação no servidor Windows (instalar.bat, desinstalar.bat, config.ps1)
public/
  index.html   -> tela do sistema
  style.css
  app.js       -> lógica do front-end, exportação Excel/PDF
```
