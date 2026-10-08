<div align="center">

<img src="src-tauri/icons/128x128@2x.png" alt="Logo do Bento" width="112" />

# Bento

---

## Sobre

O Bento é um aplicativo desktop que fica junto do Windows, e não dentro de uma aba do navegador. Ele aparece em três camadas:

| Camada | Onde fica | Para que serve |
| ------ | --------- | -------------- |
| **Ilha** | Topo da tela | Mídia tocando, pomodoro, tarefas do dia, captura rápida e avisos do time |
| **Dock** | Base da tela, opcional | Pode substituir a barra de tarefas e mostrar os apps abertos com prévias; por padrão, a barra de tarefas do Windows continua visível |
| **Sistema** | Janela própria | Todas as áreas do app: início, chat, finanças, estudos, metas, calendário e configurações |

Três princípios guiam o projeto:

- **Funciona sem IA.** Toda função principal tem um caminho próprio. A IA é uma camada opcional que melhora o que já funciona.
- **O Chat continua útil sem IA.** Comandos locais permitem registrar tarefas, gastos e lembretes.
- **Seus dados ficam com você.** Os dados do app ficam no computador. Mensagens enviadas a um provedor externo de IA são transmitidas a esse serviço; não existe conta do Bento nem servidor do Bento.

## Funcionalidades

### Ilha

Uma barra discreta no topo da tela, com três estados: escondida, compacta e expandida. As abas são configuráveis:

- **Calendário:** a hora, o que tem marcado hoje e o mês, com uma marca nos dias com compromisso. Um clique no dia abre o calendário completo.
- **Hoje:** tarefas do dia, com entrada em linguagem natural ("ligar pro banco 15h").
- **Capturar:** tarefa, gasto, link, nota ou lembrete em poucos segundos.
- **Mídia:** o que está tocando no Windows, com capa e controles.
- **Foco:** pomodoro com etapas de foco e pausa.
- **Hábitos e Agenda:** marcação rápida e próximos compromissos.
- **Chat:** conversa rápida com o time, com anexos.
- **Conexões:** números e últimas atividades de cada serviço, como cobranças do Stripe, Actions do GitHub, e-mails do Resend e tráfego do Cloudflare.
- **Avisos:** os alertas do time.

Por padrão, a ilha fica **isolada no centro do topo**. Se quiser, você pode ativar nas configurações as abas laterais ligadas por uma faixa fina:

- **Esquerda:** personalização (tema, cor de destaque, cor e opacidade da ilha e do dock, tamanho e repouso da ilha), o Iniciar do Windows e as tarefas do dia.
- **Direita:** os apps em segundo plano (os ícones da bandeja do Windows), Wi-Fi, volume, bateria e um painel de controles rápidos, com Wi-Fi e Bluetooth, não perturbe, mudo, microfone, captura de tela, teclado virtual, modo escuro, volume de cada app, brilho, mídia e energia.

Modos **fixo**, **esconder** e **inteligente**. Durante jogos, vídeos em tela cheia e apresentações, a ilha e o dock somem por completo. O **modo privacidade** esconde valores e textos sensíveis quando você compartilha a tela.

### Dock

Opcional. Quando ativado, substitui a barra de tarefas do Windows com a logo do Bento e os apps abertos, agrupados por programa. Ao passar o mouse, mostra uma prévia ao vivo de cada janela, de onde dá para focar ou fechar. Também tem os modos fixo, esconder e inteligente. Por padrão, o dock fica desligado, a taskbar do Windows permanece embaixo e a ilha funciona sozinha no topo.

### Sistema

| Área | O que faz |
| ---- | --------- |
| **Início** | Painel do dia com blocos configuráveis: time, tarefas, foco, finanças, revisões e conquistas |
| **Chat** | Conversa com os agentes, com comandos locais |
| **Journal** | Tarefas, hábitos, humor, notas e calendário do dia, com desfazer e refazer |
| **Estudos** | Matérias com páginas, quadro, datas de prova, links e revisão espaçada |
| **Finanças** | Contas, cartões, transações, orçamento, recorrentes, metas de economia, divisão de contas, lista de compras e relatórios |
| **Metas** | Pilares de vida, metas medidas por hábitos, horas de estudo, economia ou tarefas, e quadro de visão |
| **Calendário** | Tudo que tem data no Bento, nas vistas de mês, semana e agenda, com eventos e lembretes recorrentes |
| **Conexões** | Stripe, GitHub, Vercel, Resend, Notion, Cal.com, n8n, Gmail, Supabase e Cloudflare, cada um com janela própria |
| **Conquistas** | Marcos e mapa de calor da sua rotina |
| **Configurações** | Aparência, ilha, dock, sons, atalhos, privacidade, backup e dados |

### O time

| Agente | Cuida de |
| ------ | -------- |
| **Bento · Gerente de Projetos** | Rotina, tarefas, hábitos e agenda |
| **Paco · Professor** | Estudos, revisões e provas |
| **Milo · Analista de Operações** | Finanças e serviços conectados |
| **Toby · Engenharia** | Código, repositórios e pull requests |

Cada agente tem oito estados visíveis (ocioso, ouvindo, pensando, escrevendo, sucesso, alerta, erro e dormindo) e reage ao que está acontecendo de verdade no app.

## Atalhos

| Atalho | Ação |
| ------ | ---- |
| `Ctrl` `Alt` `Espaço` | Captura rápida |
| `Ctrl` `Alt` `N` | Abrir ou esconder o sistema |
| `Ctrl` `Alt` `P` | Iniciar ou pausar o pomodoro |
| `Ctrl` `Alt` `M` | Tocar ou pausar a mídia |
| `Ctrl` `Alt` `H` | Modo privacidade |
| `Ctrl` `K` | Busca global e comandos |
| `Ctrl` `N` | Novo item na área atual |
| `Ctrl` `B` | Recolher ou expandir a barra lateral |
| `Ctrl` `1` a `Ctrl` `9` | Ir para as áreas da barra lateral |
| `Esc` | Fechar modal, painel ou ilha |

## Recursos do chat

O pomodoro, a lista de capacidades e o relatório semanal funcionam sem provedor de IA:

- `/pomodoro 25` inicia o foco, sem sobrescrever uma sessão existente.
- `/pomodoro pausar`, `/pomodoro continuar` e `/pomodoro encerrar` controlam a sessão atual. Encerrar registra somente os minutos utilizados e não inicia outra etapa.
- `/pomodoro status` consulta o estado e o tempo restante real.
- `/capacidades` lista as ferramentas cadastradas, respeitando as permissões e conexões atuais. Não comprova que o modelo escolhido aceita ferramentas.
- `/relatorio` calcula os últimos sete dias a partir dos registros locais. Não inclui finanças e não preenche dias sem registro.

Anexos de texto têm botões para resumir, explicar, criar perguntas e extrair texto. Extrair funciona localmente; as demais análises usam o provedor escolhido, com ferramentas de ação desativadas e sem enviar o contexto pessoal do Bento. O conteúdo enviado para análise é limitado a 45 mil caracteres. Imagens não usam esses botões e precisam de um modelo com visão; PDF e pesquisa web ainda não estão disponíveis.

Perguntas sobre Cloudflare e Supabase são encaminhadas ao Java. Menções explícitas continuam escolhendo o agente. Confirmações e resultados de ações vêm das ferramentas, sem anunciar um cartão pendente como salvo. As respostas do modelo são verificadas antes de aparecer, mas isso não elimina todos os possíveis erros de uma IA.

A ilha compacta destaca mídia somente enquanto o Windows informa reprodução ativa. Uma música pausada continua acessível na aba Mídia, sem ocupar automaticamente a compacta. Quando Mídia é escolhida para repouso, a compacta mostra o relógio enquanto não há reprodução.

## Tecnologias

| Camada | Tecnologia |
| ------ | ---------- |
| Desktop | Tauri 2 e Rust, com APIs nativas do Windows |
| Interface | React 19, TypeScript e Vite |

## Como rodar

### Publicar uma atualização

As atualizações são instaladas pelo próprio Bento. Para publicar uma versão, envie uma tag no formato `vX.Y.Z`; o GitHub Actions sincroniza os números de versão, compila o instalador assinado e cria a release com o manifesto que o app consulta.

No GitHub, configure os segredos `TAURI_SIGNING_PRIVATE_KEY` e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` em **Settings → Secrets and variables → Actions**. Use a chave privada correspondente à chave pública em `src-tauri/tauri.conf.json`. Depois, crie e envie uma tag, por exemplo: `git tag v0.2.1` e `git push origin v0.2.1`.

### Requisitos

- Windows 10 ou 11
- Node 22 ou mais novo e pnpm
- Rust estável, para a versão desktop
- WebView2, que já vem no Windows 11

