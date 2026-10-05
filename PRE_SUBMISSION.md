# Pré-submissão — Simple AI Usage Indicator

Auditoria de 05/10/2026. Projeto **pessoal de Ivo Lopes**; o Plane da Mindsite é
usado somente para backlog/rastreabilidade. Esta execução não publica v22,
não cria tag e não envia nem altera uma submissão no GNOME Extensions (EGO).

## Baseline

| Verificação inicial | Evidência |
|---|---|
| Branch / HEAD | `main`, `ca1119c239940515a6ff5061bba9bf984636e4a4` |
| Working tree | Limpa; arquivos locais excluídos do Git foram preservados |
| Fetch | `git fetch --all --tags`; upstream configurado e consultado |
| Última tag / release | [v21](https://github.com/ivo-lopes/simple-ai-usage-indicator/releases/tag/v21), publicada em 05/10/2026 18:08:56 UTC |
| Commit da tag v21 | `420e468fc7722472b180b5c21f4ca93b18866e60` |
| Asset publicado | ZIP de 69.481 bytes e `SHA256SUMS`; ambos encontrados e baixados |
| SHA256 v21 verificado | `add347a4533b29892bc0fd4fad5e86e0b0c4d2eb71901d418ca4f7f3c670d344` |
| Metadata inicial | `version: 21`, Shell 45–51; UUID/schema/nome preservados |
| CI inicial | [37358026620](https://github.com/ivo-lopes/simple-ai-usage-indicator/actions/runs/37358026620), success no HEAD inicial |
| Plane inicial | 25 itens lidos integralmente; 1/4/5/6/7/9/10/11/15/16/17 Done, 12 In Progress; demais Backlog |

A primeira release foi publicada corretamente. Não houve tentativa de publicação
duplicada. O baseline de desenvolvimento já continha a segunda onda, posterior ao
snapshot publicado v21; portanto o changelog Unreleased também inclui esse hardening.

## Reconciliação

Cada descrição original foi comparada com código, testes e evidências; os comentários
no Plane registram critérios, commits e limites. Nenhuma tarefa foi criada por duplicação.

| SAUI | Antes | Evidência / gap | Depois |
|---|---|---|---|
| 2 | Backlog | Reset absoluto, data/hora local + duração relativa acima de 24h; 8 regressões determinísticas, UI pt_BR | Done |
| 3 | Backlog | Todos os buckets Antigravity preservados; falta uniformizar contrato de todos os providers e reduzir aliases legados | Backlog |
| 8 | Backlog | UserInfo e leitura de token no refresh removidos; 73 asserts offline, inventário de privacidade | Done |
| 12 | In Progress | Shells reais 45–51, orientação 51, ScrollView 45, popup/Prefs/lifecycle e logs | Done |
| 13 | Backlog | Remote/range upstream, classificação de 11 commits, fetch/review antes de releases, CHANGELOG/NOTICE | Done |
| 14 | Backlog | Ruído/comentários/wrappers/imports reduzidos; menu/controller permanecem na classe principal | In Progress |
| 18 | Backlog | 105 mensagens base, pt/pt_BR completos, plurais/datas/status, msgfmt e testes reais/unitários | Done |
| 19 | Backlog | Tema nativo, labels, teclado, AT-SPI, escala St 2 e monitor estreito; limites abaixo | Done |
| 21 | Backlog | Metadata mínimo sem version manual; descrição/topics/homepage/Issues públicos atualizados | Done |
| 22 | Backlog | Issues habilitado, dois formulários, avisos de secrets, CONTRIBUTING | Done |
| 23 | Backlog | SECURITY + reporte privado + inventário preciso de dados/credenciais/endpoints | Done |
| 24 | Backlog | Checklist reproduzível executado; suíte, matriz, install/update, CI e artifact auditados | Done |
| 25 | Backlog | CHANGELOG v20/v21/Unreleased, política manual tag/CI/ZIP/SHA/EGO independente | Done |

SAUI-3 permanece aberta por seu critério de **contrato único entre providers**,
sem perda dos buckets atuais. SAUI-14 permanece aberta pela extração estrutural
originalmente pedida. A instrução desta onda prioriza reviewability e estabilidade;
não foi feita uma refatoração ampla para encerrar essas tarefas por conveniência.
Ambas são dívida interna posterior à submissão, sem blocker funcional demonstrado.
SAUI-20 não foi executada. Os itens já Done da primeira/segunda onda foram preservados.

## Compatibility Matrix

O runner confere `gnome-shell --version` e executa o binário nativo, St, GTK e
Adwaita daquela distribuição. Não há substituição do número de versão. Os
contêineres rootless usam imagens oficiais com manifestos fixados, pacotes assinados,
rede desligada durante execução, repository mount somente leitura, HOME/XDG e
buses privados. login1/AccountsService/localed são scaffolding sintético de sessão;
não simulam Shell/St/GTK. O `agy` de laboratório devolve fixture sanitizada.

| GNOME | Ambiente | Shell real | Lifecycle | Preferences | Logs | Resultado |
|---|---|---|---|---|---|---|
| 45 | Fedora 39, container headless Wayland | 45.10 | PASS | Janela nativa PASS | Sem JS errors | PASS |
| 46 | Fedora 40, container headless Wayland | 46.10 | PASS | Janela nativa PASS | Sem JS errors | PASS |
| 47 | Fedora 41, container headless Wayland | 47.10 | PASS | Janela nativa PASS | Sem JS errors | PASS |
| 48 | Fedora 42, container headless Wayland | 48.8 | PASS | Janela nativa PASS | Sem JS errors | PASS |
| 49 | Fedora 43, container headless Wayland | 49.10 | PASS | Janela nativa PASS | Sem JS errors | PASS |
| 50 | Fedora 44, container headless Wayland | 50.5 | PASS | Janela nativa PASS | Sem JS errors | PASS |
| 51 | Fedora 45 **Container Image Prerelease**, development | 51.0 | PASS | Janela nativa PASS | Sem JS errors | PASS |
| 48 adicional | Debian 13, compositor privado no host | 48.7 | PASS | GTK, teclado/AT-SPI pt_BR PASS | Sem JS errors | PASS |

Para cada versão: instalação do ZIP, enable, início de refresh, disable antes do
resultado, morte do subprocesso em até cinco segundos, re-enable, JSON concluído,
popup real e foco de teclado, Preferences oficial, disable final e saída do
compositor verificada. Todos os 31 membros instalados foram comparados byte a byte
com o pacote validado. A matriz não afirma um desktop completo com GDM.

Evidências permanentes: [matrix.json](docs/validation/2026-10-05/matrix.json),
logs `gnome-*.shell.log/session.stdout/session.stderr` no mesmo diretório e
[procedimento do laboratório](tests/integration/README.md).
Manifestos Fedora, IDs locais das imagens e hashes dos membros estão no JSON.
O comando final foi:

```sh
python3 tests/integration/matrix.py \
  simple-ai-usage-indicator@ivo-lopes.github.com.shell-extension.zip \
  --docker /home/ivo/bin/docker --output /tmp/saui-wave3-complete-matrix-2112
```

Correções encontradas por testes reais:

- GNOME 45: `St.ScrollView` herda um `St.Bin.set_child`, mas nessa versão o caminho
  correto configura adjustments através de `Clutter.Container.add_actor`.
  O caminho antigo abortava no destroy. Feature detection usa add_actor em 45 e
  set_child nas versões posteriores; teste estrutural e 45.10 real passam.
- GNOME 45/47: libgnome-desktop abortava antes de carregar a extensão quando o lab
  não fornecia defaults localed. GDB identificou o callback; o stub locale1 e
  input source `us` corrigem a sessão descartável.
- GNOME 51: terminar o compositor com janelas Preferences Wayland abertas causava
  SIGSEGV nativo depois do disable, sem erro JS. GDB apontou
  `gnome_shell_plugin_kill_window_effects` durante `meta_context_dispose`.
  O lab fecha seus clientes antes de terminar Meta.Context; a repetição sem
  debugger passa, com exit status verificado. A falha inicial não foi contada como PASS.

[diagnostic-attempts.json](docs/validation/2026-10-05/diagnostic-attempts.json)
separa falhas iniciais, correções e resultados finais. Avisos de ausência de
GDM/PolKit/GeoClue/PipeWire/FUSE em containers e avisos nativos Adwaita de introspecção
foram inspecionados; não foram omitidos dos logs nem confundidos com erros JS.

## EGO review audit

Fontes oficiais consultadas em **05/10/2026**. As páginas não apresentaram uma
edição/data de revisão inequívoca; o ano do rodapé não foi tratado como updated-at.
A consulta IvoAI Memory e Context antecedeu fontes externas: os resultados não
continham evidência relevante suficiente para esta auditoria.

| Referência atual | Requisito diretamente relacionado | Arquivo / evidência |
|---|---|---|
| [Review Guidelines](https://gjs.guide/extensions/review-guidelines/review-guidelines.html) | Código legível, revisão humana, lifecycle, processos, licença, conteúdo mínimo do ZIP, metadata/URL | extension.js, prefs.js, providers, LICENSE/NOTICE/ASSETS, package.sh, inspector, matriz |
| [Best Practices](https://gjs.guide/extensions/review-guidelines/best-practices.html) | Ownership/cleanup explícito, timers/signals/requests sem trabalho após disable | destroy/dispose cancelam e desconectam; guards apenas protegem closures tardias, não substituem cleanup; lifecycle.test.js + real Shell |
| [Preferences](https://gjs.guide/extensions/development/preferences.html) | Separação dos processos Shell/GTK, widgets padrão, recursos/Settings corretos | prefs.js sem imports da UI Shell, widgets Adw/Gtk, janela oficial nas sete versões |
| [Extension Accessibility](https://gjs.guide/extensions/development/accessibility.html) | Names/labels, foco e teclado | Refresh/panel/bar labels; native keyboard focus; GTK SpinButton rotulado; AT-SPI |
| [HIG Accessibility](https://developer.gnome.org/hig/guidelines/accessibility.html) | Tema/contraste, navegação e controles nativos | BarLevel/CSS de tema, SVG symbolic, três temas, monitor estreito/St 200%, controles GTK |
| [45](https://gjs.guide/extensions/upgrading/gnome-shell-45.html) / [46](https://gjs.guide/extensions/upgrading/gnome-shell-46.html) / [47](https://gjs.guide/extensions/upgrading/gnome-shell-47.html) | ESM, APIs removidas/transições de containers/estado | Imports ESM, feature detection ScrollView; native 45–47; runner aceita ENABLED/ACTIVE |
| [48](https://gjs.guide/extensions/upgrading/gnome-shell-48.html) / [49](https://gjs.guide/extensions/upgrading/gnome-shell-49.html) / [50](https://gjs.guide/extensions/upgrading/gnome-shell-50.html) / [51](https://gjs.guide/extensions/upgrading/gnome-shell-51.html) | APIs/layout e teardown síncrono; mudança de orientation/vertical em 51 | makeBoxLayout feature detection + testes antigos/transicionais/51, disable síncrono e matriz real |

A fonte nativa [St.ScrollView 45.10](https://raw.githubusercontent.com/GNOME/gnome-shell/45.10/src/st/st-scroll-view.c)
foi inspecionada para justificar o fix específico, além dos guias.
A antiga etiqueta “EGO-P-006” não é apresentada como identificador oficial;
a regra técnica de excluir `gschemas.compiled` foi mantida.

A extensão não executa shell strings, instala software, solicita privilégios,
muda a sessão do usuário ou define unsafe_mode. O companion **test-only** permite
Eval exclusivamente no compositor/bus privado e não entra no ZIP.
Os flags de destruição são acompanhados de cancelamento HTTP/file/Secret Service,
force_exit do CLI e remoção de timers/signals, com regressões de late promises.

Reviewability: removidas aproximadamente 650 linhas redundantes no conjunto do
código, imports/wrappers mortos e mensagens inseguras; comentários de decisões
não óbvias permanecem. `extension.js` tem aproximadamente 29,4 KB. Helpers de
formatação/i18n estão separados; não houve rewrite de menu/controller. A aprovação
EGO continua sendo uma decisão do reviewer; este relatório não promete aprovação.

## Metadata

Antes: versão manual `21`, UUID/nome/schema estáveis, sete Shell majors.
Depois: somente `uuid`, `name`, `description`, `shell-version`, `settings-schema`,
`gettext-domain` e `url`. `version` removida conforme a guideline atual: é deprecated
e atribuída internamente pelo EGO. Não foram adicionados session-modes.
GitHub v21/v22 continuam tags próprias, independentes dessa versão interna.
Shell versions continuam **45, 46, 47, 48, 49, 50, 51**, agora com evidência nativa.

A URL aponta para o repositório pessoal e canal de suporte. Description pública:
“Personal GNOME Shell extension monitoring usage and quotas for Codex CLI,
Claude Code, and Antigravity CLI.” Homepage, topics e Issues foram atualizados e
verificados pela API. UUID/schema ID/nome não foram alterados.

## Privacy/Security

[PRIVACY.md](PRIVACY.md) contém o inventário completo; [SECURITY.md](SECURITY.md)
contém versões mantidas, reporte privado e remoção manual do antigo dconf.

| Provider | Credenciais / dados locais | Rede direta da extensão | Resultado da auditoria |
|---|---|---|---|
| Codex | `$CODEX_HOME/auth.json` ou `~/.codex/auth.json`; token/account ID/expiração | ChatGPT `backend-api/wham/usage` e `rate-limit-reset-credits` | Reads autorizados; bearer/header de conta, mensagens de erro sem corpo/credencial |
| Claude | `.claude/.credentials.json`, `.claude.json`, `stats-cache.json`; opcional `CLAUDE_CODE_OAUTH_TOKEN` | Anthropic `api/oauth/usage` | Nenhum token persistido pela extensão; ANTHROPIC_API_KEY não usado para quota OAuth |
| Antigravity | Secret Service somente para auth check em Preferences; fallback conta entradas de `brain`, sem ler conversas | **Nenhuma** | Quota via argv direto `agy --print /usage --print-timeout 8s --output-format json`; CLI cuida do backend/auth; UserInfo removido |

Refresh Antigravity não lê token/Keyring, mesmo quando um token existe. Testes
verificam presença/ausência e contadores de reads; a UI usa identificação genérica.
JSON/legacy text, unavailable/stale/cache/force e todos os buckets foram preservados.
Resets longos usam timestamp observado, data/hora locais e duração relativa; não
há reset semanal fabricado. Lista vazia de providers agora permanece desabilitada;
Claude sem tier conhecido não anuncia um plano Pro inventado.

Não há analytics/telemetry próprios, SDK de tracking, coleta centralizada nem venda
de dados. Informações são exibidas localmente; requests aos providers continuam
sujeitos às políticas deles. Secrets podem existir transitoriamente em memória;
JavaScript não oferece garantia de zeroização. Nenhum segredo foi impresso,
armazenado em fixtures, migrado do antigo dconf ou colocado no artifact.
Scans por padrões são limitados e não substituem a revisão de proveniência.

## UI/accessibility

| Teste real | Resultado | Evidência / limite |
|---|---|---|
| Claro, escuro, high contrast, todos os providers | PASS | Native 48.7 pt_BR e 51.0; imagens inspecionadas, BarLevel/SVG foreground legíveis |
| St theme scale 2, 1600×1200 | PASS | Popup 556×956, scroll e ações visíveis; não é prova de hardware HiDPI |
| Monitor 800×600, 100% | PASS | Native 51.0, popup cabe; pt_PT 48.7 popup 478×481 também observado |
| Popup foco Refresh | PASS | St.navigate_focus no actor nativo, accessible_name e can_focus |
| Preferences teclado | PASS | Tab via dispositivo virtual da seat nativa, 12 mudanças de foco entre widgets reais |
| Campo de intervalo | PASS | GtkSpinButton padrão, label explícito e valor exposto por AT-SPI |
| AT-SPI pt_BR 48.7 / inglês 51.0 | PASS | Names reais de Preferences, intervalo e combos; JSONs versionados |
| Orca enumeração de apps | PASS | `orca --list-apps` no bus privado encontra Preferences oficial |
| AT-SPI pt_PT 48.7 estreito | **FAIL** | Reader SIGTRAP/NoReply no bus privado; repetidas tentativas também falharam. Popup, traduções e teclado passaram antes desse erro; comando inteiro não é PASS |
| Speech output / leitura completa por Orca | NOT TESTED | Lab headless sem áudio e fluxo interativo de leitor de tela |
| Hardware HiDPI / desktop GDM completo | NOT TESTED | Monitores virtuais e escala St; estação normal não alterada |

O FAIL pt_PT é de conexão do harness ao bus de acessibilidade, sem erro JS da
extensão; não demonstra uma incompatibilidade do widget. Os critérios originais
SAUI-19 têm cobertura independente por native 48.7 pt_BR e 51.0. Não foi alegada
validação completa de screen reader em pt_PT. Widgets GNOME fornecem comportamento
padrão; não foi criado um sistema próprio de acessibilidade.

[visual-inspection.json](docs/validation/2026-10-05/visual-inspection.json) registra
hashes e observações dos screenshots locais; backgrounds de distro não foram
redistribuídos. [gnome51-ui](docs/validation/2026-10-05/gnome51-ui.result.json) e
[host48-ptBR](docs/validation/2026-10-05/host48-ptBR.result.json) têm resultados reais.

## Repository health

| Superfície | Estado |
|---|---|
| GitHub Issues | Habilitado e verificado |
| Templates | Bug report e provider compatibility; nunca solicitar tokens/cookies/credential files/Keyring |
| CONTRIBUTING | Setup, lint/test/schema/i18n/package/integration e regras de secrets |
| SECURITY | Canal privado GitHub habilitado, suporte latest release/main, legacy dconf reset sem leitura |
| PRIVACY / README | Inventário por provider, ausência de telemetry própria, autoria pessoal/fork GPL |
| CHANGELOG | v20, v21 e Unreleased/proposta v22, sem reconstruir história inventada |
| UPSTREAM | Remote/range/11 decisões e rotina antes de releases; NOTICE/autoria preservados |
| Checklist / policy | docs/EGO-CHECKLIST.md executável por humano; docs/RELEASING.md manual |

Upstream permanece `7d8c20ef0f3d959d45f3c31ac2cc6fe9a5e49984`, 11 commits desde a
base comum `f2bd496acb648bbf343e3ea7a4a1a54f6c0bbb55`. Orientação/tema já portados,
GPL/atribuição já preservados; merges/releases upstream não copiados cegamente.
Features de saldo/reset-credit continuam para SAUI-20; detalhes de cada commit
estão em UPSTREAM.md. Nenhuma correção de auth/API nova nesse range foi ignorada.

## Testes e instalação

| Comando / teste | Resultado | Evidência |
|---|---|---|
| npm ci --ignore-scripts --no-audit --no-fund | PASS | Dev linter pinado; host sem executável npm usou npm-cli 10.9.4 temporário; CI usa npm padrão |
| npm run lint / oxlint --deny-warnings . | PASS | Todas as fontes GJS, inclusive helpers de integração |
| node --check em JS tracked; bash -n | PASS | scripts/validate.sh |
| Python AST dos helpers de integração | PASS | Sem gerar bytecode no ZIP |
| Todos os 14 testes GJS unitários | PASS | Antigravity 73 asserts, providers, HTTP loopback, lifecycle, i18n, layout, resets, icons; sem conta/rede externa/CLI real |
| glib-compile-schemas --strict --dry-run schemas | PASS | Schema fonte válido, sem secret Claude |
| msgfmt -c e check-translations.py | PASS | 105 mensagens base, pt/pt_BR completos, plurais, sem fuzzy |
| git diff --check / --cached --check | PASS | Whitespace de logs normalizado antes de push |
| ./package.sh e scripts/inspect-package.py | PASS | Integridade, allowlist, 31 membros iguais às fontes, SVG/scan limitado |
| Matriz real 45–51 | PASS | Sete versões nativas, prefs/popup/refresh/disable/re-enable/process cleanup |
| Clean install ZIP | PASS | Sete homes privados novos; raw schemas compilados somente nas cópias instaladas |
| Update da v21 publicada | PASS | SHA256 verificado; old enable/Prefs/disable, Shell reiniciado, pacote novo instalado, settings ordinários (480s) preservados |
| Lifecycle durante refresh | PASS | Processo lento termina no disable; re-enable recebe fixture JSON rápida; late promise unitária não renderiza |
| UI/ATSPI pt_PT estreito (comando completo) | FAIL | Limitação de bus privado acima; não ocultada nem transformada em PASS |
| Journal da sessão principal / conta real de provider | NOT TESTED | Não se alterou o desktop principal nem se usaram credenciais pessoais; logs dos compositores privados inspecionados |
| EGO review/upload e nova GitHub Release | NOT TESTED | Fora da execução por instrução explícita |

Comandos UI reproduzíveis e flags de locale/timezone/scale/upgrade/orca estão em
tests/integration/README.md. O update usou o ZIP efetivamente publicado, não uma
simulação do número 21. Não se leu/migrou um token dconf antigo.

## Package

Nome: `simple-ai-usage-indicator@ivo-lopes.github.com.shell-extension.zip`.
Arquivo local medido na matriz: 66.198 bytes; SHA256
`d9bb410c06b13df0f20f89ece768db15cb7e7d8e793ee614f6859eee494a87c1`.
Timestamps do ZIP/MO podem variar entre builds; os hashes de cada membro e sua
igualdade com as fontes são verificados, além do checksum do artifact CI abaixo.

Conteúdo: **31 arquivos** — 14 JS runtime, nove SVG originais usados, stylesheet,
metadata, schema XML fonte, dois MO, LICENSE, NOTICE e ASSETS.md.
Lista/hashes completos em matrix.json. ZIP inspecionado por `unzip -tq`, allowlist
explícita e comparação byte a byte de cada membro; LICENSE/NOTICE/ASSETS presentes.
Nenhum import runtime depende de arquivo excluído.

Não contém `.git`, `.github`, tests, fixtures, docs, PRE_SUBMISSION, CHANGELOG,
SECURITY, CONTRIBUTING, package.json/lock, node_modules, scripts de build/CI,
PO/POT, PNG, temporários, credentials ou `gschemas.compiled`. O helper histórico
resetCreditExpiry.js, sem uso runtime, fica somente no repo/teste. Raw schema só
é compilado no ambiente instalado. Nove SVG genéricos originais têm proveniência
GPL/SPDX documentada; nenhum logo proprietário foi reintroduzido.

## CI

Workflow: [.github/workflows/validate.yml](.github/workflows/validate.yml), push/PR,
Ubuntu 24.04/Node22/GJS, actions pinadas por SHA, `contents: read`, checkout sem
persistir credentials. Instalação do linter sem scripts, lint, syntax, 14 testes,
schema strict, msgfmt/catalog, diff, package, unzip/allowlist/byte inspector e
artifact do ZIP por commit SHA, retenção 14 dias. Não publica release nem EGO.
A matriz pesada é integração opcional separada; CI comum continua determinística.

[Run 37374846937](https://github.com/ivo-lopes/simple-ai-usage-indicator/actions/runs/37374846937): **success**, 05/10/2026 21:18:06 UTC, commit runtime
`0a38ecc6a6062e19c5b4dfaace9853dcfe558bd6`. Todos os steps passaram.
Artifact ID `11369979564`, nome
`simple-ai-usage-indicator-0a38ecc6a6062e19c5b4dfaace9853dcfe558bd6`, baixado e aberto.
ZIP interno: **66.510 bytes**, SHA256
`a220ba1f9200a8f88321e3b377f330a4595dd9a07ab0c85726c2bfbac52e1263`.
Todos os **31 membros** são idênticos byte a byte às fontes e ao pacote testado
nos sete Shells. O digest GitHub do envelope do artifact é
`2863ae8ac5e2f75eec9b568b0cd079f2fdc3b4ee198554ce812c19b7908f4b25`;
não é o checksum do ZIP interno.

O relatório/evidências públicos não entram no ZIP. Uma mudança exclusivamente
documental posterior não altera os membros runtime atestados acima. A CI também
é conferida no commit documental final; para consultar o HEAD atual:

```sh
gh run list --repo ivo-lopes/simple-ai-usage-indicator --branch main \
  --limit 5 --json databaseId,headSha,status,conclusion,url
```

## Git e Plane

Commits lógicos desta onda, publicados em `main`:

| Commit | Mudança |
|---|---|
| d7bcfc9 | Privacidade Antigravity: remover UserInfo/leitura de token no refresh |
| e6c0db2 | Reset longo com duração relativa |
| d441f92 | Remover ruído/wrappers redundantes de revisão |
| 4e94c36 | Cobertura gettext de status/erros/prefs e catálogos |
| ccfbbfc | Preservar providers desabilitados e não presumir plano Claude |
| 0bcf1c0 | Tema/labels/ícones symbolic e lifecycle ScrollView 45 |
| 46e6692 | Metadata e suporte público |
| 3dc279a | Segurança/privacidade/contribuição/checklist/changelog/release policy |
| bd5739d | SpinButton nativo rotulado para AT-SPI |
| 0a38ecc | Laboratório reproduzível e evidências nativas 45–51/UI/upgrade |

Snapshot runtime validado/pushed: `0a38ecc6a6062e19c5b4dfaace9853dcfe558bd6`.
O commit deste relatório acrescenta somente documentação. Push normal, sem force,
sem reescrever histórico público e sem mudar tags/releases. Conferência final:
`git status --porcelain` vazio e HEAD igual a origin/main.

Plane: comentários iniciais, descobertas materiais, diagnóstico 45/51, critérios,
commits e testes foram adicionados. Estados finais estão na tabela de reconciliação.
Done não significa full desktop/speech não testados. SAUI-3 Backlog e SAUI-14 In
Progress preservam os gaps originais; nenhum blocker externo funcional permanece.
SAUI-24 foi fechada após a confirmação verde da CI/inspeção do artifact.
O read-back dos 25 estados está em docs/validation/2026-10-05/plane-final.json;
um HTTP 401 transitório durante a atualização foi recuperado sem alterar credenciais.

## Remaining backlog

- **Necessário antes da EGO:** nenhuma correção técnica bloqueante demonstrada
  pelos critérios desta onda. Na operação de upload, o mantenedor deve executar
  o checklist sobre o commit/pacote escolhido e assumir a manutenção do código;
  upload manual exige autorização separada e a revisão EGO pode pedir ajustes.
- **Recomendável antes da v22:** repetir o teste interativo de leitor de tela,
  principalmente pt_PT, em um desktop real; hardware HiDPI e temas adicionais.
  A falha de bus privado permanece registrada como limitação de laboratório.
- **Pós-EGO/pós-v22:** SAUI-3 contrato/aliases, SAUI-14 extração menu/controller,
  SAUI-20 robustez externa de Codex/Claude. Sem refatoração ampla nesta onda.

## Release recommendation

`V22_READY=true`

v22 é apropriada porque agrega o hardening de segurança/lifecycle/CI posterior à
v21 e esta preparação: compatibilidade nativa completa declarada, privacidade,
i18n, tema/accessibility, metadata e suporte público. Não requer bump do metadata
EGO. Publicação **não executada**; release v21 e seus assets permanecem intactos.

## EGO recommendation

`EGO_RESUBMISSION_READY=true`

Pacote mínimo auditado, GPL/atribuição/assets originais, schema válido, subprocessos
canceláveis, callbacks protegidos e todas as versões declaradas com smoke real.
A evidência cobre lifecycle e widgets nativos; não se vende como certificação de
screen reader/full desktop. Nenhuma submissão foi enviada/alterada nesta execução.

## Final verdict

**READY_FOR_V22_AND_EGO_RESUBMISSION**

Pronto tecnicamente para os próximos passos manuais. Os gaps internos de SAUI-3/14
não justificam uma refatoração arriscada antes da submissão. A limitação AT-SPI pt_PT
do laboratório, hardware/full desktop/speech não testados e possível instabilidade
futura de APIs externas estão explicitados, sem transformar ausência/falha em PASS.
