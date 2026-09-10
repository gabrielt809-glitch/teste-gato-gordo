# Gato Gordo

Aplicativo estático de finanças pessoais e compartilhadas. Sirva os arquivos por
HTTPS (ou localhost para desenvolvimento); não há etapa de build.

## Persistência e recuperação

`js/storage.js` centraliza o acesso aos dados. Nesta migração gradual, o
`localStorage` continua sendo a origem dos dados em uso, com uma segunda cópia
local automática em IndexedDB. A origem existente é validada antes de abrir o app
ou gravar uma cópia; dados corrompidos não são substituídos silenciosamente.

Após alterações, a cópia mais recente é atualizada com debounce de 200 ms. São
mantidas também até cinco versões anteriores, com intervalo mínimo de dez minutos
entre a criação dessas versões. As transações IndexedDB gravam a cópia e limitam o
histórico em uma única operação. O menu oferece o download dessas cópias como JSON
v2 compatível com a restauração normal.

Se os dados principais desaparecerem ou estiverem corrompidos, a inicialização
oferece download dos dados brutos, importação de arquivo e recuperação das cópias
automáticas disponíveis. Recuperar exige confirmação, conserva uma cópia bruta do
estado anterior no registro de restauração e deixa a sincronização pausada.

Falhas de gravação exibem um aviso e bloqueiam novas edições, com opção de baixar os
dados da sessão. Uma aba desatualizada também é bloqueada antes de sobrescrever
alterações de outra aba; não há mesclagem automática entre abas nesta etapa.

**Limite:** as duas formas de armazenamento pertencem ao mesmo navegador. Limpar
os dados do site pode apagar ambas. IndexedDB não é um backup externo nem oferece
criptografia; o PIN continua sendo um bloqueio de interface. Exporte arquivos para
manter uma cópia fora do aparelho. Quando IndexedDB estiver indisponível, o app
continua usando os dados principais e avisa que a segunda cópia não está disponível.

## Backup e restauração de arquivos

**Baixar backup completo** salva um JSON v2 com versão, data, perfis (incluindo PIN),
grupos, grupo ativo e configuração de sincronização. O menu mostra a data da última
exportação iniciada; o navegador não informa se o usuário concluiu o salvamento.
O arquivo é local e sem criptografia; guarde-o em local privado.

**Restaurar backup** aceita esse formato e o formato anterior `{ perfis, grupos }`.
O app valida o arquivo (até 20 MB), pede confirmação e salva uma cópia anterior
antes de substituir os dados deste aparelho. Em caso de erro de gravação, tenta
repor os valores anteriores. Outros aplicativos no mesmo domínio são preservados.

**Baixar cópia anterior à restauração** exporta a última cópia salva antes
de restaurar (em formato bruto para análise se os dados anteriores estavam corrompidos). No primeiro acesso, use **Já tenho um backup**. A sincronização fica
pausada após qualquer recuperação. Confira os dados antes de reconectá-la; reconectar
pode buscar dados mais recentes da nuvem. O PIN do perfil restaurado continua valendo.

## Sincronização compartilhada

Não existe mais uma URL padrão de Google Apps Script no código. Configure
explicitamente sua implantação HTTPS em **Sincronização Compartilhada**. A validação
aceita links `https://script.google.com/macros/s/ID/exec`, sem credenciais,
parâmetros ou fragmentos. Implantações válidas já salvas no aparelho são mantidas;
aparelhos que dependiam da URL padrão precisam configurar o link.

Respostas atrasadas de uma configuração anterior são ignoradas após desconectar ou
alterar o link. A sincronização continua dependendo da implementação do Apps Script,
com polling; fila offline e resolução de conflitos entre aparelhos ainda não foram
implementadas.

## Uso offline e atualizações

A primeira visita precisa de internet para instalar o Service Worker e guardar
páginas, scripts, imagens e bibliotecas externas. Depois, o app pode reabrir offline
com dados locais. Fontes externas podem usar a fonte alternativa offline.

O cache é isolado pelo endereço do app e não intercepta a API de sincronização.
Atualizações entram após fechar as abas antigas e reabrir. Aumente `VERSION` em
`sw.js` sempre que alterar arquivos essenciais. Dados financeiros não são guardados
no cache do Service Worker.

## Organização atual

- `js/storage.js`: armazenamento, cópias automáticas e detecção de conflitos entre abas.
- `js/backup.js`: exportação/importação versionada e recuperação após falha.
- `js/bootstrap.js`: inicialização e telas de recuperação.
- `js/sync-config.js`: validação e leitura da conexão explicitamente configurada.
- `js/pwa.js` e `sw.js`: experiência offline e cache.
- `js/app.js`: lógica financeira e telas existentes; extração gradual em andamento.

## Testes

Node.js 20.19 ou superior. As dependências são apenas para testes:

```sh
npm ci
npm test
```

Os testes cobrem migração, corrupção, perda parcial de chaves, indisponibilidade de
IndexedDB, falhas de gravação, histórico limitado, conflitos entre abas, backup,
restauração, configuração de sincronização, respostas atrasadas e cache offline.
Os testes de interface usam um DOM simulado e não baixam recursos externos.
A validação visual e o funcionamento real do Service Worker em Safari/iPhone
continuam pendentes; o download do Chromium de teste foi bloqueado neste ambiente.

Validação desta entrega: 35 testes automatizados passaram, incluindo seis cenários
de interface em DOM simulado; verificações de sintaxe também passaram.
