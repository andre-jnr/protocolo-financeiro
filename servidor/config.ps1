# Configuração da publicação deste sistema no servidor Windows.
# Lida por instalar.ps1, iniciar.ps1 e desinstalar.ps1 (que são iguais em todos os sistemas).

$NOME_SISTEMA = "Protocolo para financeiro"   # SEM acentos: vira o nome da tarefa agendada e da regra de firewall
$PORTA_PADRAO = 3006            # da tabela de orientacoes-projetos-ia.md (PORT no .env tem prioridade)
$TIPO         = "node"           # "python" ou "node"
$ENTRADA      = "server/server.js"        # arquivo principal, relativo à raiz do projeto (ex.: app.py, server/index.js)
$ARGUMENTOS   = ""     # argumentos do modo produção (ex.: --producao) ou ""
$ROTA_TESTE   = "/api/lojas"     # rota que responde 200 com o sistema no ar (ex.: /, /api/saude)
$PASTAS_DADOS = @()  # pastas onde o sistema grava; a conta SYSTEM recebe escrita (logs já incluso)
