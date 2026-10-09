import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Activity, ArrowLeft, ExternalLink, FileText, FolderKanban, GitBranch, GripVertical, ListChecks, NotebookPen, Pencil, Plus, Search, Timer, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { Campo, ConfirmarModal, Modal } from "../../componentes/basicos";
import { useProjetos, type Projeto, type StatusProjeto } from "../../estado/projetos";
import { usePomodoro } from "../../estado/pomodoro";
import { useRotina } from "../../estado/rotina";
import { gerarId } from "../../utilitarios/basicos";
import { tempoEfetivoMs } from "../../utilitarios/pomodoro";
import type { ColunaKanban, ItemChecklist, Prioridade, StatusTarefa, Tarefa } from "../../tipos";
import "./projetos.css";

const statusNome: Record<StatusProjeto, string> = {
  planejamento: "Planejamento",
  ativo: "Ativo",
  pausado: "Pausado",
  concluido: "Concluído",
  arquivado: "Arquivado",
};

const colunasPadrao: ColunaKanban[] = [
  { id: "a_fazer", nome: "Backlog", conclui: false },
  { id: "em_andamento", nome: "Em andamento", conclui: false },
  { id: "concluida", nome: "Concluídas", conclui: true },
];

const estadoPorColuna: Partial<Record<string, StatusTarefa>> = {
  a_fazer: "a_fazer",
  em_andamento: "em_andamento",
  concluida: "concluida",
};

const abasProjeto: { id: "visao" | "tarefas" | "notas" | "atividade"; nome: string; icone: LucideIcon }[] = [
  { id: "visao", nome: "Visão geral", icone: FolderKanban },
  { id: "tarefas", nome: "Tarefas", icone: ListChecks },
  { id: "notas", nome: "Notas e documentação", icone: NotebookPen },
  { id: "atividade", nome: "Atividade e métricas", icone: Activity },
];

interface DadosProjetoTarefa {
  titulo: string;
  descricao: string;
  estimativaMinutos?: number;
  prioridade: Prioridade;
  colunaId: string;
  data?: string;
  checklist: ItemChecklist[];
}

function FormProjeto({
  projeto,
  aoSalvar,
  aoCancelar,
}: {
  projeto?: Projeto;
  aoSalvar: (p: Omit<Projeto, "id" | "criadoEm" | "atualizadoEm">) => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(projeto?.nome ?? "");
  const [descricao, setDescricao] = useState(projeto?.descricao ?? "");
  const [status, setStatus] = useState<StatusProjeto>(projeto?.status ?? "planejamento");
  const [tipo, setTipo] = useState(projeto?.tipo ?? "Desenvolvimento");
  const [tecnologias, setTecnologias] = useState(projeto?.tecnologias.join(", ") ?? "");
  const [tags, setTags] = useState(projeto?.tags.join(", ") ?? "");
  const [repositorio, setRepositorio] = useState(projeto?.repositorio ?? "");
  const [documentacao, setDocumentacao] = useState(projeto?.documentacao ?? "");
  const [pastaRepositorio, setPastaRepositorio] = useState(projeto?.pastaRepositorio ?? "");
  const [publicado, setPublicado] = useState(projeto?.publicado ?? "");
  const [inicioEm, setInicioEm] = useState(projeto?.inicioEm ?? "");
  const [prazo, setPrazo] = useState(projeto?.prazo ?? "");
  const [erro, setErro] = useState("");

  return (
    <form className="projetos-form" onSubmit={(e) => {
      e.preventDefault();
      if (!nome.trim()) return setErro("Informe o nome do projeto.");
      if (repositorio && !/^https?:\/\//i.test(repositorio)) return setErro("O repositório deve começar com https://");
      setErro("");
      aoSalvar({
        nome: nome.trim(),
        descricao: descricao.trim(),
        status,
        tipo,
        tecnologias: tecnologias.split(",").map((x) => x.trim()).filter(Boolean),
        tags: tags.split(",").map((x) => x.trim()).filter(Boolean),
        cor: projeto?.cor ?? "#8b7cf6",
        repositorio: repositorio.trim() || undefined,
        documentacao: documentacao.trim() || undefined,
        colunasKanban: projeto?.colunasKanban,
        inicioEm: inicioEm || undefined,
        prazo: prazo || undefined,
        paginas: projeto?.paginas ?? [],
        pastaRepositorio: pastaRepositorio.trim() || undefined,
        publicado: publicado.trim() || undefined,
      });
    }}>
      <label>Nome<input autoFocus value={nome} maxLength={100} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Bento Desk" /></label>
      <label>Descrição<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="O que você está desenvolvendo?" /></label>
      <div className="projetos-form-linha">
        <label>Status<select value={status} onChange={(e) => setStatus(e.target.value as StatusProjeto)}>{Object.entries(statusNome).map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></label>
        <label>Tipo<input value={tipo} onChange={(e) => setTipo(e.target.value)} /></label>
      </div>
      <label>Tecnologias <small>separadas por vírgula</small><input value={tecnologias} onChange={(e) => setTecnologias(e.target.value)} placeholder="React, TypeScript" /></label>
      <label>Tags <small>separadas por vírgula</small><input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="pessoal, desktop" /></label>
      <div className="projetos-form-linha"><label>Data de início <small>opcional</small><input type="date" value={inicioEm} onChange={(e) => setInicioEm(e.target.value)} /></label><label>Prazo previsto <small>opcional</small><input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label></div>
      <label>Repositório <small>opcional</small><input type="url" value={repositorio} onChange={(e) => setRepositorio(e.target.value)} placeholder="https://github.com/usuario/repo" /></label>
      <label>Caminho local do repositório <small>opcional · apenas informativo</small><input value={pastaRepositorio} onChange={(e) => setPastaRepositorio(e.target.value)} placeholder="C:\\Projetos\\meu-projeto" /></label>
      <label>Documentação <small>opcional</small><input type="url" value={documentacao} onChange={(e) => setDocumentacao(e.target.value)} placeholder="https://..." /></label>
      <label>Ambiente publicado <small>opcional</small><input type="url" value={publicado} onChange={(e) => setPublicado(e.target.value)} placeholder="https://..." /></label>
      {erro && <p className="projetos-erro" role="alert">{erro}</p>}
      <div className="projetos-acoes">
        <button type="button" className="botao botao-fantasma" onClick={aoCancelar}>Cancelar</button>
        <button className="botao botao-destaque" type="submit">Salvar projeto</button>
      </div>
    </form>
  );
}

function FormTarefa({
  tarefa,
  colunas,
  colunaInicial,
  aoSalvar,
  aoCancelar,
}: {
  tarefa?: Tarefa;
  colunas: ColunaKanban[];
  colunaInicial: string;
  aoSalvar: (dados: DadosProjetoTarefa) => void;
  aoCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(tarefa?.titulo ?? "");
  const [descricao, setDescricao] = useState(tarefa?.descricao ?? "");
  const [estimativa, setEstimativa] = useState(tarefa?.estimativaMinutos?.toString() ?? "");
  const [prioridade, setPrioridade] = useState<Prioridade>(tarefa?.prioridade ?? "media");
  const [colunaId, setColunaId] = useState(tarefa?.colunaId && colunas.some((c) => c.id === tarefa.colunaId) ? tarefa.colunaId : colunaInicial);
  const [data, setData] = useState(tarefa?.data ?? "");
  const [subtarefas, setSubtarefas] = useState((tarefa?.checklist ?? []).map((item) => item.texto).join("\n"));
  const [erro, setErro] = useState("");

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    const minutos = estimativa.trim() ? Number(estimativa) : undefined;
    if (!titulo.trim()) return setErro("Informe o título da tarefa.");
    if (minutos !== undefined && (!Number.isInteger(minutos) || minutos < 1 || minutos > 10080)) {
      return setErro("A estimativa deve ser um número inteiro entre 1 e 10080 minutos.");
    }
    setErro("");
    const checklist = subtarefas.split("\n").map((texto) => texto.trim()).filter(Boolean).map((texto) => ({ id: gerarId(), texto, feito: tarefa?.checklist.find((item) => item.texto === texto)?.feito ?? false }));
    aoSalvar({ titulo: titulo.trim(), descricao: descricao.trim(), estimativaMinutos: minutos, prioridade, colunaId, data: data || undefined, checklist });
  };

  return (
    <form className="formulario" onSubmit={salvar} noValidate>
      <Campo id="projeto-tarefa-titulo" rotulo="Título" obrigatorio erro={erro && !titulo.trim() ? erro : undefined}>
        <input id="projeto-tarefa-titulo" className="campo" autoFocus value={titulo} maxLength={200} onChange={(e) => { setTitulo(e.target.value); setErro(""); }} />
      </Campo>
      <Campo id="projeto-tarefa-descricao" rotulo="Descrição">
        <textarea id="projeto-tarefa-descricao" className="area-texto" value={descricao} maxLength={2000} rows={4} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes do que precisa ser feito" />
      </Campo>
      <div className="formulario-linha">
        <Campo id="projeto-tarefa-estimativa" rotulo="Tempo estimado" erro={erro && titulo.trim() ? erro : undefined} dica="Em minutos; opcional.">
          <input id="projeto-tarefa-estimativa" className="campo" type="number" min={1} max={10080} step={1} value={estimativa} onChange={(e) => { setEstimativa(e.target.value); setErro(""); }} placeholder="Ex.: 45" />
        </Campo>
        <Campo id="projeto-tarefa-prioridade" rotulo="Prioridade">
          <select id="projeto-tarefa-prioridade" className="seletor" value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
          </select>
        </Campo>
      </div>
      <Campo id="projeto-tarefa-coluna" rotulo="Coluna do quadro">
        <select id="projeto-tarefa-coluna" className="seletor" value={colunaId} onChange={(e) => setColunaId(e.target.value)}>
          {colunas.map((coluna) => <option key={coluna.id} value={coluna.id}>{coluna.nome}</option>)}
        </select>
      </Campo>
      <div className="formulario-linha"><Campo id="projeto-tarefa-prazo" rotulo="Prazo"><input id="projeto-tarefa-prazo" className="campo" type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo><Campo id="projeto-tarefa-subtarefas" rotulo="Subtarefas" dica="Uma subtarefa por linha."><textarea id="projeto-tarefa-subtarefas" className="area-texto" rows={3} value={subtarefas} onChange={(e) => setSubtarefas(e.target.value)} placeholder="Definir estrutura\nRevisar implementação" /></Campo></div>
      {erro && <p className="projetos-erro" role="alert">{erro}</p>}
      <div className="projetos-acoes">
        <button type="button" className="botao botao-fantasma" onClick={aoCancelar}>Cancelar</button>
        <button className="botao botao-destaque" type="submit">{tarefa ? "Salvar alterações" : "Adicionar tarefa"}</button>
      </div>
    </form>
  );
}

function CartaoTarefa({
  tarefa,
  aoEditar,
  aoExcluir,
  aoMudarSubtarefa,
}: {
  tarefa: Tarefa;
  aoEditar: () => void;
  aoExcluir: () => void;
  aoMudarSubtarefa: (id: string, feito: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: tarefa.id });
  return (
    <article
      ref={setNodeRef}
      className="projetos-tarefa"
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.55 : undefined,
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      <div className="projetos-tarefa-topo">
        <button type="button" className="projetos-arrastar" aria-label={`Arrastar tarefa ${tarefa.titulo}`} {...attributes} {...listeners}>
          <GripVertical size={15} />
        </button>
        <strong>{tarefa.titulo}</strong>
        <button type="button" className="projetos-acao-tarefa" aria-label={`Editar tarefa ${tarefa.titulo}`} title="Editar tarefa" onClick={aoEditar}>
          <Pencil size={14} />
        </button>
        <button type="button" className="projetos-acao-tarefa projetos-apagar-tarefa" aria-label={`Excluir tarefa ${tarefa.titulo}`} title="Excluir tarefa" onClick={aoExcluir}>
          <Trash2 size={14} />
        </button>
      </div>
      {tarefa.descricao && <p>{tarefa.descricao}</p>}
      {tarefa.checklist.length > 0 && <div className="projetos-subtarefas">{tarefa.checklist.map((item) => <label key={item.id}><input type="checkbox" checked={item.feito} onChange={(e) => aoMudarSubtarefa(item.id, e.target.checked)} /><span className={item.feito ? "subtarefa-feita" : ""}>{item.texto}</span></label>)}</div>}
      <div className="projetos-tarefa-detalhes">
        <span className={`projetos-prioridade prioridade-${tarefa.prioridade}`}>{tarefa.prioridade === "media" ? "Média" : tarefa.prioridade === "alta" ? "Alta" : "Baixa"}</span>
        {tarefa.estimativaMinutos != null && <span>{tarefa.estimativaMinutos} min</span>}
        {tarefa.data && <span>Prazo {new Date(`${tarefa.data}T00:00:00`).toLocaleDateString("pt-BR")}</span>}
        {tarefa.checklist.length > 0 && <span>{tarefa.checklist.filter((item) => item.feito).length}/{tarefa.checklist.length} subtarefas</span>}
      </div>
    </article>
  );
}

function ColunaProjeto({
  coluna,
  quantidade,
  children,
  aoAdicionar,
  aoExcluir,
}: {
  coluna: ColunaKanban;
  quantidade: number;
  children: React.ReactNode;
  aoAdicionar: () => void;
  aoExcluir?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  return (
    <section ref={setNodeRef} className="projetos-coluna" data-sobre={isOver ? "sim" : "nao"}>
      <header>
        <h2>{coluna.nome}</h2>
        <span>{quantidade}</span>
        <button type="button" className="projetos-acao-coluna" aria-label={`Adicionar tarefa em ${coluna.nome}`} title="Adicionar tarefa" onClick={aoAdicionar}>
          <Plus size={14} />
        </button>
        {aoExcluir && (
          <button type="button" className="projetos-acao-coluna projetos-apagar-coluna" aria-label={`Excluir coluna ${coluna.nome}`} title="Excluir coluna" onClick={aoExcluir}>
            <Trash2 size={14} />
          </button>
        )}
      </header>
      {children}
      {quantidade === 0 && <p className="projetos-vazio-coluna">Arraste uma tarefa para cá ou adicione uma nova.</p>}
    </section>
  );
}

export default function Projetos() {
  const projetos = useProjetos((s) => s.projetos);
  const criar = useProjetos((s) => s.criar);
  const atualizar = useProjetos((s) => s.atualizar);
  const excluir = useProjetos((s) => s.excluir);
  const tarefas = useRotina((s) => s.tarefas);
  const criarTarefa = useRotina((s) => s.criarTarefa);
  const atualizarTarefa = useRotina((s) => s.atualizarTarefa);
  const excluirTarefa = useRotina((s) => s.excluirTarefa);
  const sessoesFoco = usePomodoro((s) => s.sessoes);
  const [selecionado, setSelecionado] = useState<string>();
  const [form, setForm] = useState<"novo" | "editar" | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [ordenacao, setOrdenacao] = useState("atualizado");
  const [visualizacao, setVisualizacao] = useState<"cards" | "lista">("cards");
  const [tarefaModal, setTarefaModal] = useState<{ tarefa?: Tarefa; colunaId: string } | null>(null);
  const [confirmacao, setConfirmacao] = useState<{ tipo: "tarefa" | "coluna"; id: string; nome: string } | null>(null);
  const [dialogColuna, setDialogColuna] = useState(false);
  const [nomeColuna, setNomeColuna] = useState("");
  const [erroColuna, setErroColuna] = useState("");
  const [abaProjeto, setAbaProjeto] = useState<"visao" | "tarefas" | "notas" | "atividade">("visao");
  const [paginaAtiva, setPaginaAtiva] = useState<string | null>(null);

  const projeto = projetos.find((p) => p.id === selecionado);
  const colunas = projeto?.colunasKanban?.length ? projeto.colunasKanban : colunasPadrao;
  const tarefasProjeto = tarefas.filter((t) => t.projetoId === selecionado && t.status !== "cancelada");
  const sessoesProjeto = sessoesFoco.filter((s) => s.etapa === "foco" && s.projetoId === selecionado);
  const agoraMs = Date.now();
  const focoProjetoMs = sessoesProjeto.reduce((soma, sessao) => soma + tempoEfetivoMs(sessao), 0);
  const focoSemanaProjetoMs = sessoesProjeto.filter((s) => agoraMs - new Date(s.inicio).getTime() <= 7 * 86400000).reduce((soma, sessao) => soma + tempoEfetivoMs(sessao), 0);
  const mediaSessaoProjetoMs = sessoesProjeto.length ? focoProjetoMs / sessoesProjeto.length : 0;
  const paginaSelecionada = projeto?.paginas?.find((p) => p.id === paginaAtiva) ?? projeto?.paginas?.[0];
  const visiveis = useMemo(
    () => projetos
      .filter((p) => (filtro === "todos" || p.status === filtro) && `${p.nome} ${p.descricao} ${p.tecnologias.join(" ")} ${p.tags.join(" ")}`.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => ordenacao === "nome" ? a.nome.localeCompare(b.nome) : b.atualizadoEm.localeCompare(a.atualizadoEm)),
    [projetos, filtro, busca, ordenacao],
  );
  const progresso = (id: string) => {
    const ts = tarefas.filter((t) => t.projetoId === id && t.status !== "cancelada");
    const feitas = ts.filter((t) => t.status === "concluida").length;
    return { total: ts.length, feitas, pct: ts.length ? Math.round(feitas / ts.length * 100) : 0 };
  };
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const colunaDaTarefa = (tarefa: Tarefa) => {
    const colunaSalva = tarefa.colunaId && colunas.some((c) => c.id === tarefa.colunaId) ? tarefa.colunaId : undefined;
    return colunaSalva ?? (tarefa.status === "concluida" ? "concluida" : tarefa.status === "em_andamento" ? "em_andamento" : "a_fazer");
  };
  const tarefasDaColuna = (coluna: ColunaKanban) => tarefasProjeto.filter((t) => colunaDaTarefa(t) === coluna.id);

  const moverTarefa = (evento: DragEndEvent) => {
    if (!evento.over || evento.over.id === evento.active.id) return;
    const coluna = colunas.find((c) => c.id === evento.over?.id);
    const tarefa = tarefasProjeto.find((t) => t.id === evento.active.id);
    if (!coluna || !tarefa || colunaDaTarefa(tarefa) === coluna.id) return;
    const status = coluna.conclui ? "concluida" : estadoPorColuna[coluna.id] ?? "a_fazer";
    atualizarTarefa(tarefa.id, {
      colunaId: coluna.id,
      status,
      concluidaEm: status === "concluida" ? new Date().toISOString() : undefined,
    });
    if (projeto) atualizar(projeto.id, {});
  };

  const salvarTarefa = (dados: DadosProjetoTarefa) => {
    const destino = colunas.find((c) => c.id === dados.colunaId);
    const status = destino?.conclui ? "concluida" : estadoPorColuna[dados.colunaId] ?? "a_fazer";
    if (tarefaModal?.tarefa) {
      atualizarTarefa(tarefaModal.tarefa.id, {
        titulo: dados.titulo,
        descricao: dados.descricao,
        estimativaMinutos: dados.estimativaMinutos,
        prioridade: dados.prioridade,
        colunaId: dados.colunaId,
        status,
        data: dados.data,
        checklist: dados.checklist,
        concluidaEm: status === "concluida" ? tarefaModal.tarefa.concluidaEm ?? new Date().toISOString() : undefined,
      });
    } else if (projeto) {
      criarTarefa({
        titulo: dados.titulo,
        descricao: dados.descricao,
        estimativaMinutos: dados.estimativaMinutos,
        prioridade: dados.prioridade,
        projetoId: projeto.id,
        colunaId: dados.colunaId,
        status,
        data: dados.data,
        checklist: dados.checklist,
      });
    }
    if (projeto) atualizar(projeto.id, {});
    setTarefaModal(null);
  };

  const adicionarColuna = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projeto) return;
    const nome = nomeColuna.trim();
    if (!nome) return setErroColuna("Informe o nome da coluna.");
    if (colunas.some((c) => c.nome.toLocaleLowerCase() === nome.toLocaleLowerCase())) {
      return setErroColuna("Já existe uma coluna com esse nome.");
    }
    const nova: ColunaKanban = { id: `projeto-${gerarId()}`, nome, conclui: false };
    atualizar(projeto.id, { colunasKanban: [...colunas, nova] });
    setDialogColuna(false);
    setNomeColuna("");
    setErroColuna("");
  };

  const confirmarExclusao = () => {
    if (!confirmacao || !projeto) return;
    if (confirmacao.tipo === "tarefa") {
      excluirTarefa(confirmacao.id);
    } else {
      const backlog = colunas.find((c) => c.id === "a_fazer");
      if (!backlog) return;
      tarefasDaColuna(colunas.find((c) => c.id === confirmacao.id)!).forEach((t) => {
        atualizarTarefa(t.id, { colunaId: backlog.id, status: "a_fazer", concluidaEm: undefined });
      });
      atualizar(projeto.id, { colunasKanban: colunas.filter((c) => c.id !== confirmacao.id) });
    }
    atualizar(projeto.id, {});
    setConfirmacao(null);
  };

  if (projeto) {
    const pct = progresso(projeto.id);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const diasRestantes = projeto.prazo ? Math.ceil((new Date(`${projeto.prazo}T00:00:00`).getTime() - hoje.getTime()) / 86400000) : null;
    const proximaEntrega = tarefasProjeto.filter((t) => t.status !== "concluida").sort((a, b) => ({ alta: 0, media: 1, baixa: 2 }[a.prioridade] - { alta: 0, media: 1, baixa: 2 }[b.prioridade]) || (a.data ?? "9999").localeCompare(b.data ?? "9999"))[0];
    const paginasProjeto = projeto.paginas ?? [];
    return (
      <div className="projetos-pagina">
        <button className="botao botao-fantasma projetos-voltar" onClick={() => setSelecionado(undefined)}><ArrowLeft size={15} /> Todos os projetos</button>
        <CabecalhoAba
          rotulo="Projetos / detalhes"
          titulo={projeto.nome}
          subtitulo={projeto.descricao || "Quadro de trabalho do projeto."}
          acoes={<><button className="botao botao-fantasma" onClick={() => setForm("editar")}>Editar</button><span className={`projeto-status status-${projeto.status}`}>{statusNome[projeto.status]}</span></>}
        />
        <nav className="projetos-abas" role="tablist" aria-label="Seções do projeto">
          {abasProjeto.map(({ id, nome, icone: Icone }) => <button key={id} type="button" role="tab" aria-selected={abaProjeto === id} onClick={() => setAbaProjeto(id)}><Icone size={15} />{nome}</button>)}
        </nav>
        <section className="projetos-secao" hidden={abaProjeto !== "visao"}>
          <div className="projetos-overview-grid">
            <article className="projetos-bloco projetos-progresso-destaque"><span>Progresso</span><strong>{pct.pct}%</strong><div className="projetos-barra"><i style={{ width: `${pct.pct}%` }} /></div><small>{pct.feitas} de {pct.total} tarefas concluídas</small></article>
            <article className="projetos-bloco"><span>Status</span><strong><span className={`projeto-status status-${projeto.status}`}>{statusNome[projeto.status]}</span></strong><small>{projeto.tipo}</small></article>
            <article className="projetos-bloco"><span>Prazo e planejamento</span><strong>{projeto.prazo ? new Date(`${projeto.prazo}T00:00:00`).toLocaleDateString("pt-BR") : "Sem prazo definido"}</strong><small>{projeto.inicioEm ? `Início em ${new Date(`${projeto.inicioEm}T00:00:00`).toLocaleDateString("pt-BR")}` : "Data inicial não informada"}{diasRestantes !== null ? ` · ${diasRestantes < 0 ? `${Math.abs(diasRestantes)} dias de atraso` : diasRestantes === 0 ? "Prazo hoje" : `${diasRestantes} dias restantes`}` : ""}</small>{diasRestantes !== null && diasRestantes < 0 && pct.pct < 100 && <em className="projetos-atraso">Projeto atrasado</em>}</article>
            <article className="projetos-bloco"><span>Tempo investido</span><strong>{(focoProjetoMs / 3600000).toFixed(1)} h</strong><small>Últimos 7 dias: {(focoSemanaProjetoMs / 3600000).toFixed(1)} h</small></article>
          </div>
          <article className="projetos-bloco projetos-stack"><span>Stack e links</span><div className="projeto-tags">{projeto.tecnologias.map((x) => <span className="projeto-tag" key={x}>{x}</span>)}{projeto.tags.map((x) => <span className="projeto-tag" key={`tag-${x}`}>#{x}</span>)}</div><div className="projetos-links">{projeto.repositorio && <a href={projeto.repositorio} target="_blank" rel="noreferrer">Repositório <ExternalLink size={13} /></a>}{projeto.documentacao && <a href={projeto.documentacao} target="_blank" rel="noreferrer">Documentação <ExternalLink size={13} /></a>}{projeto.publicado && <a href={projeto.publicado} target="_blank" rel="noreferrer">Ambiente publicado <ExternalLink size={13} /></a>}</div></article>
          <div className="projetos-overview-grid projetos-overview-baixo"><article className="projetos-bloco"><span>Próxima entrega</span><strong>{proximaEntrega?.titulo ?? "Nenhuma tarefa prioritária"}</strong><small>{proximaEntrega ? `${proximaEntrega.prioridade} prioridade${proximaEntrega.data ? ` · prazo ${new Date(`${proximaEntrega.data}T00:00:00`).toLocaleDateString("pt-BR")}` : ""}` : "Adicione tarefas para definir o próximo passo."}</small><button className="botao botao-fantasma" onClick={() => setAbaProjeto("tarefas")}>Abrir tarefas</button></article><article className="projetos-bloco"><span>Atividade recente</span>{sessoesProjeto.length ? sessoesProjeto.slice(-3).reverse().map((s) => <small key={s.id}>Pomodoro · {Math.round(tempoEfetivoMs(s) / 60000)} min · {new Date(s.inicio).toLocaleDateString("pt-BR")}</small>) : <small>As sessões de foco aparecerão aqui.</small>}</article></div>
        </section>
        <section className="projetos-secao" hidden={abaProjeto !== "notas"}>
          <div className="projetos-notas-cabecalho"><div><h2>Notas e documentação</h2><p>Especificações, decisões técnicas e páginas Markdown.</p></div><button className="botao botao-destaque" onClick={() => { const nova = { id: gerarId(), titulo: "Nova página", markdown: "# Nova página\n\n", atualizadaEm: new Date().toISOString() }; atualizar(projeto.id, { paginas: [...paginasProjeto, nova] }); setPaginaAtiva(nova.id); }}><Plus size={15} /> Nova página</button></div>
          {paginasProjeto.length === 0 ? <div className="projetos-vazio"><FileText size={28} /><strong>Sem páginas ainda</strong><span>Crie notas para registrar especificações e decisões.</span></div> : <div className="projetos-notas-layout"><aside className="projetos-notas-lista">{paginasProjeto.map((p) => <button type="button" key={p.id} aria-current={(paginaSelecionada?.id ?? paginaAtiva) === p.id ? "page" : undefined} onClick={() => setPaginaAtiva(p.id)}><FileText size={14} />{p.titulo}</button>)}</aside><div className="projetos-nota-editor"><input aria-label="Título da página" value={paginaSelecionada?.titulo ?? ""} onChange={(e) => paginaSelecionada && atualizar(projeto.id, { paginas: paginasProjeto.map((p) => p.id === paginaSelecionada.id ? { ...p, titulo: e.target.value, atualizadaEm: new Date().toISOString() } : p) })} /><textarea aria-label="Conteúdo Markdown" value={paginaSelecionada?.markdown ?? ""} onChange={(e) => paginaSelecionada && atualizar(projeto.id, { paginas: paginasProjeto.map((p) => p.id === paginaSelecionada.id ? { ...p, markdown: e.target.value, atualizadaEm: new Date().toISOString() } : p) })} placeholder="# Decisão técnica\n\nEscreva em Markdown…" /><small>Markdown · alterações salvas automaticamente</small>{paginaSelecionada && paginasProjeto.filter((p) => p.id !== paginaSelecionada.id && p.markdown.includes(`[[${paginaSelecionada.titulo}]]`)).map((p) => <small key={p.id}>Backlink de: {p.titulo}</small>)}</div></div>}
        </section>
        <section className="projetos-secao" hidden={abaProjeto !== "atividade"}>
          <div className="projetos-indicadores projetos-metricas"><div className="projetos-indicador"><span>Tempo focado</span><strong>{(focoProjetoMs / 3600000).toFixed(1)} h</strong></div><div className="projetos-indicador"><span>Últimos 7 dias</span><strong>{(focoSemanaProjetoMs / 3600000).toFixed(1)} h</strong></div><div className="projetos-indicador"><span>Média por sessão</span><strong>{Math.round(mediaSessaoProjetoMs / 60000)} min</strong></div><div className="projetos-indicador"><span>Tarefas concluídas</span><strong>{pct.feitas}</strong></div></div>
          <article className="projetos-bloco projetos-git"><div><GitBranch size={16} /><strong>Atividade no Git</strong></div>{projeto.repositorio ? <><a href={projeto.repositorio} target="_blank" rel="noreferrer">Abrir repositório remoto <ExternalLink size={13} /></a><small>{projeto.pastaRepositorio ? `Caminho local: ${projeto.pastaRepositorio}` : "Nenhum caminho local associado."}</small><p>Branch, último commit e alterações locais não estão disponíveis sem conexão com o repositório local.</p></> : <p>Este projeto não tem repositório. O Kanban e o controle de foco funcionam sem Git.</p>}</article>
          <article className="projetos-bloco"><h2>Histórico recente</h2><div className="projetos-timeline">{[...sessoesProjeto.map((s) => ({ id: s.id, data: s.inicio, nome: `Pomodoro · ${Math.round(tempoEfetivoMs(s) / 60000)} min de foco`, fonte: "Bento" })), ...tarefasProjeto.map((t) => ({ id: t.id, data: t.alteradaEm ?? t.concluidaEm ?? t.criadaEm, nome: `${t.status === "concluida" ? "Concluída" : "Tarefa"} · ${t.titulo}`, fonte: "Bento" }))].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 20).map((evento) => <div key={evento.id}><strong>{evento.nome}</strong><small>{evento.fonte} · {new Date(evento.data).toLocaleString("pt-BR")}</small></div>)}{!sessoesProjeto.length && !tarefasProjeto.length && <p>As atividades aparecerão conforme você trabalhar.</p>}</div></article>
        </section>
        <div className="projetos-detalhe-resumo" hidden>
          <div><strong>{pct.pct}%</strong><span>progresso</span><div className="projetos-barra"><i style={{ width: `${pct.pct}%` }} /></div></div>
          <div><strong>{tarefasProjeto.length}</strong><span>tarefas abertas/concluídas</span></div>
          <div><strong>{pct.feitas}</strong><span>concluídas</span></div>
          <div className="projetos-links">
            {projeto.tecnologias.map((x) => <span className="projeto-tag" key={x}>{x}</span>)}
            {projeto.repositorio && <a href={projeto.repositorio} target="_blank" rel="noreferrer">Repositório <ExternalLink size={13} /></a>}
            {projeto.documentacao && <a href={projeto.documentacao} target="_blank" rel="noreferrer">Documentação <ExternalLink size={13} /></a>}
          </div>
        </div>
        <section className="projetos-secao projetos-secao-tarefas" hidden={abaProjeto !== "tarefas"}>
        <div className="projetos-tempo-faixa"><Timer size={16} /><span>Tempo investido neste projeto</span><strong>{(focoProjetoMs / 3600000).toFixed(1)} h</strong><small>7 dias: {(focoSemanaProjetoMs / 3600000).toFixed(1)} h · média por sessão: {Math.round(mediaSessaoProjetoMs / 60000)} min</small></div>
        <div className="projetos-quadro-acoes">
          <button className="botao botao-destaque" onClick={() => setTarefaModal({ colunaId: colunas[0]?.id ?? "a_fazer" })}><Plus size={15} /> Adicionar tarefa</button>
          <button className="botao botao-fantasma" onClick={() => { setNomeColuna(""); setErroColuna(""); setDialogColuna(true); }}><Plus size={15} /> Nova coluna</button>
        </div>
        <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={moverTarefa}>
          <div className="projetos-kanban">
            {colunas.map((coluna) => {
              const daColuna = tarefasDaColuna(coluna);
              const customizada = !colunasPadrao.some((base) => base.id === coluna.id);
              return (
                <ColunaProjeto
                  key={coluna.id}
                  coluna={coluna}
                  quantidade={daColuna.length}
                  aoAdicionar={() => setTarefaModal({ colunaId: coluna.id })}
                  aoExcluir={customizada ? () => setConfirmacao({ tipo: "coluna", id: coluna.id, nome: coluna.nome }) : undefined}
                >
                  {daColuna.map((t) => (
                    <CartaoTarefa
                      key={t.id}
                      tarefa={t}
                      aoEditar={() => setTarefaModal({ tarefa: t, colunaId: coluna.id })}
                      aoExcluir={() => setConfirmacao({ tipo: "tarefa", id: t.id, nome: t.titulo })}
                      aoMudarSubtarefa={(id, feito) => atualizarTarefa(t.id, { checklist: t.checklist.map((item) => item.id === id ? { ...item, feito } : item) })}
                    />
                  ))}
                </ColunaProjeto>
              );
            })}
          </div>
        </DndContext>
        </section>
        {form === "editar" && (
          <div className="projetos-sobreposicao">
            <section className="projetos-modal">
              <h2>Editar projeto</h2>
              <FormProjeto projeto={projeto} aoCancelar={() => setForm(null)} aoSalvar={(dados) => { atualizar(projeto.id, dados); setForm(null); }} />
            </section>
          </div>
        )}
        <Modal aberto={!!tarefaModal} titulo={tarefaModal?.tarefa ? "Editar tarefa" : "Adicionar tarefa"} aoFechar={() => setTarefaModal(null)} largo>
          {tarefaModal && <FormTarefa tarefa={tarefaModal.tarefa} colunas={colunas} colunaInicial={tarefaModal.colunaId} aoSalvar={salvarTarefa} aoCancelar={() => setTarefaModal(null)} />}
        </Modal>
        <Modal aberto={dialogColuna} titulo="Nova coluna" aoFechar={() => setDialogColuna(false)}>
          <form className="formulario" onSubmit={adicionarColuna} noValidate>
            <Campo id="projetos-nome-coluna" rotulo="Nome da coluna" obrigatorio erro={erroColuna}>
              <input id="projetos-nome-coluna" className="campo" autoFocus maxLength={40} value={nomeColuna} onChange={(e) => { setNomeColuna(e.target.value); setErroColuna(""); }} placeholder="Ex.: Em revisão" />
            </Campo>
            <div className="projetos-acoes">
              <button type="button" className="botao botao-fantasma" onClick={() => setDialogColuna(false)}>Cancelar</button>
              <button className="botao botao-destaque" type="submit">Criar coluna</button>
            </div>
          </form>
        </Modal>
        <ConfirmarModal
          aberto={!!confirmacao}
          titulo={confirmacao?.tipo === "coluna" ? "Excluir coluna?" : "Excluir tarefa?"}
          texto={confirmacao?.tipo === "coluna"
            ? `As tarefas de "${confirmacao.nome}" serão movidas para o Backlog.`
            : `A tarefa "${confirmacao?.nome}" será removida do quadro.`}
          aoConfirmar={confirmarExclusao}
          aoFechar={() => setConfirmacao(null)}
        />
      </div>
    );
  }

  return (
    <div className="projetos-pagina">
      <CabecalhoAba
        rotulo="Organização"
        titulo="Projetos"
        subtitulo="Acompanhe seus projetos de desenvolvimento e o trabalho de cada um."
        acoes={<button className="botao botao-destaque" onClick={() => setForm("novo")}><Plus size={16} /> Novo projeto</button>}
      />
      <div className="projetos-indicadores">
        {[
          ["Projetos", projetos.length],
          ["Ativos", projetos.filter((p) => p.status === "ativo").length],
          ["Arquivados", projetos.filter((p) => p.status === "arquivado").length],
          ["Tarefas pendentes", tarefas.filter((t) => !!t.projetoId && t.status !== "concluida" && t.status !== "cancelada").length],
          ["Tarefas concluídas", tarefas.filter((t) => !!t.projetoId && t.status === "concluida").length],
        ].map(([label, quantidade]) => <div className="projetos-indicador" key={label}><span>{label}</span><strong>{quantidade}</strong></div>)}
      </div>
      <div className="projetos-filtros">
        <label className="projetos-busca"><Search size={16} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar projetos" /></label>
        <select value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar por status">
          <option value="todos">Todos os status</option>
          {Object.entries(statusNome).map(([v, n]) => <option key={v} value={v}>{n}</option>)}
        </select>
        <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} aria-label="Ordenar projetos">
          <option value="atualizado">Atualizados recentemente</option><option value="nome">Nome</option>
        </select>
        <div className="projetos-visao">
          <button aria-pressed={visualizacao === "cards"} onClick={() => setVisualizacao("cards")}>Cards</button>
          <button aria-pressed={visualizacao === "lista"} onClick={() => setVisualizacao("lista")}>Lista</button>
        </div>
      </div>
      {visiveis.length ? (
        <div className={`projetos-grade ${visualizacao === "lista" ? "projetos-grade-lista" : ""}`}>
          {visiveis.map((p) => {
            const pg = progresso(p.id);
            return (
              <article
                className="projeto-card"
                key={p.id}
                tabIndex={0}
                role="button"
                onClick={() => setSelecionado(p.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelecionado(p.id); }}
              >
                <div className="projeto-card-topo">
                  <span className="projeto-icone"><FolderKanban size={18} /></span>
                  <span className={`projeto-status status-${p.status}`}>{statusNome[p.status]}</span>
                  <button
                    className="projeto-excluir"
                    title="Excluir projeto"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Excluir o projeto “${p.nome}”? As tarefas também serão removidas.`)) {
                        tarefas.filter((t) => t.projetoId === p.id).forEach((t) => excluirTarefa(t.id));
                        excluir(p.id);
                      }
                    }}
                  ><Trash2 size={15} /></button>
                </div>
                <h2>{p.nome}</h2>
                <p className="projeto-descricao">{p.descricao || "Sem descrição"}</p>
                <div className="projeto-tags">{p.tecnologias.slice(0, 4).map((x) => <span className="projeto-tag" key={x}>{x}</span>)}</div>
                <div className="projeto-progresso">
                  <div><span>Progresso</span><b>{pg.pct}%</b></div>
                  <div className="projetos-barra"><i style={{ width: `${pg.pct}%` }} /></div>
                  <small>{pg.total - pg.feitas} pendentes · {pg.feitas} concluídas</small>
                </div>
                <footer>Atualizado {new Date(p.atualizadoEm).toLocaleDateString("pt-BR")}{p.repositorio && <a href={p.repositorio} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} aria-label="Abrir repositório"><ExternalLink size={14} /></a>}</footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="projetos-vazio">
          <FolderKanban size={30} />
          <strong>{projetos.length ? "Nenhum projeto encontrado" : "Comece criando seu primeiro projeto"}</strong>
          <span>{projetos.length ? "Ajuste a busca ou os filtros." : "Cadastre um projeto para abrir um quadro Kanban e organizar as tarefas."}</span>
          {!projetos.length && <button className="botao botao-destaque" onClick={() => setForm("novo")}><Plus size={15} /> Novo projeto</button>}
        </div>
      )}
      {form === "novo" && (
        <div className="projetos-sobreposicao">
          <section className="projetos-modal">
            <h2>Novo projeto</h2>
            <FormProjeto aoCancelar={() => setForm(null)} aoSalvar={(dados) => { const novo = criar(dados); setForm(null); setSelecionado(novo.id); }} />
          </section>
        </div>
      )}
    </div>
  );
}
