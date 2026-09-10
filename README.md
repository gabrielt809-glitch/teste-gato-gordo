# Gato Gordo

Aplicativo estático de finanças pessoais e compartilhadas.

## Backup e restauração

No menu do perfil, **Baixar backup completo** salva um JSON v2 com data,
perfis (incluindo PIN e configurações), grupos, grupo ativo e configuração de
sincronização. O arquivo é local, sem criptografia; guarde-o em local privado.

**Restaurar backup** aceita esse formato e o formato anterior `{ perfis, grupos }`.
O app valida o arquivo (até 20 MB), pede confirmação e salva uma cópia anterior
antes de substituir os dados deste aparelho. Em caso de erro de gravação, tenta
repor os valores anteriores. Outros aplicativos no mesmo domínio são preservados.

A opção **Baixar cópia anterior à restauração** exporta a última cópia de segurança
local. Ela é substituída na próxima restauração e não substitui guardar backups fora
do navegador. No primeiro acesso, use **Já tenho um backup**.

Após restaurar, a sincronização fica pausada. Confira os dados e reconecte pelo menu
de sincronização quando desejar. Reconectar pode buscar dados mais recentes da nuvem.
O PIN do perfil restaurado continua valendo.

## Uso offline

Sirva por HTTPS (ou localhost para desenvolvimento). A primeira visita precisa de
internet para instalar o Service Worker e guardar páginas, scripts, imagens e as
bibliotecas externas. Depois, o app pode reabrir offline, com dados locais.
A sincronização com Google Sheets continua exigindo internet; não há fila de envio
implementada nesta etapa. Fontes externas podem usar a fonte alternativa offline.

O cache é isolado pelo endereço do app e não intercepta a API de sincronização.
Atualizações entram após fechar as abas antigas e reabrir. Aumente `VERSION` em
`sw.js` sempre que alterar os arquivos essenciais, para atualizar o cache de forma
coerente. Não use o cache do Service Worker para guardar dados financeiros.

## Verificação

Sem dependências adicionais, execute:

```sh
node --test tests/*.test.cjs
node --check js/app.js
node --check js/backup.js
node --check js/pwa.js
node --check sw.js
```

Para conferir manualmente: abra em tela de celular, baixe um backup, tente importar
um JSON inválido, restaure uma cópia válida, confira a pausa da sincronização e
recarregue sem conexão depois da instalação do Service Worker.

Validação desta etapa: 10 testes automatizados de backup e Service Worker passaram.
O teste completo em navegador/iPhone permanece pendente; o download do Chromium
no ambiente de desenvolvimento não concluiu.
