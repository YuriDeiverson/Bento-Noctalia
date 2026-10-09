import { useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { BriefcaseBusiness, ExternalLink, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { Campo, ConfirmarModal, Modal } from "../../componentes/basicos";
import { useVagas, type EtapaVaga, type Vaga } from "../../estado/vagas";
import "./vagas.css";

const etapas: { id: EtapaVaga; nome: string; ajuda?: string }[] = [
  { id: "enviada", nome: "Enviada" }, { id: "teste", nome: "Teste técnico" }, { id: "entrevista", nome: "Entrevista" },
  { id: "consegui", nome: "Consegui" }, { id: "rejeitado", nome: "Rejeitado" }, { id: "lixeira", nome: "Lixeira", },
];

function CartaoVaga({ vaga, aoEditar, aoExcluir, aoMover }: { vaga: Vaga; aoEditar: () => void; aoExcluir: () => void; aoMover: (etapa: EtapaVaga) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: vaga.id });
  return <article ref={setNodeRef} className="vaga-card" style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? .55 : 1 }}>
    <header><button className="vaga-arrastar" aria-label={`Mover ${vaga.nome}`} {...attributes} {...listeners}><GripVertical size={14} /></button><strong>{vaga.nome}</strong><button className="vaga-acao" aria-label={`Editar ${vaga.nome}`} title="Editar vaga" onClick={aoEditar}><Pencil size={13} /></button></header>
    <a className="vaga-link" href={vaga.link} target="_blank" rel="noreferrer">Abrir anúncio <ExternalLink size={12} /></a>
    <label className="vaga-mover">Mover para<select value={vaga.etapa} onChange={(e) => aoMover(e.target.value as EtapaVaga)}>{etapas.map((etapa) => <option value={etapa.id} key={etapa.id}>{etapa.nome}</option>)}</select></label>
    {vaga.etapa === "lixeira" && <button className="vaga-excluir" onClick={aoExcluir}><Trash2 size={12} /> Excluir definitivamente</button>}
  </article>;
}

function ColunaVagas({ etapa, vagas, children }: { etapa: typeof etapas[number]; vagas: Vaga[]; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  return <section ref={setNodeRef} className="vagas-coluna" data-sobre={isOver ? "sim" : "nao"}><header><div><h2>{etapa.nome}</h2>{etapa.ajuda && <small>{etapa.ajuda}</small>}</div><span>{vagas.length}</span></header><div className="vagas-coluna-conteudo">{children}{vagas.length === 0 && <p className="vagas-sem-itens">Solte uma vaga aqui</p>}</div></section>;
}

export default function Vagas() {
  const vagas = useVagas((s) => s.vagas);
  const criar = useVagas((s) => s.criar);
  const editar = useVagas((s) => s.editar);
  const mover = useVagas((s) => s.mover);
  const remover = useVagas((s) => s.remover);
  const [modal, setModal] = useState(false);
  const [vagaEditando, setVagaEditando] = useState<Vaga | null>(null);
  const [aExcluir, setAExcluir] = useState<Vaga | null>(null);
  const [nome, setNome] = useState("");
  const [link, setLink] = useState("");
  const [erro, setErro] = useState("");
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const abrirNova = () => { setVagaEditando(null); setNome(""); setLink(""); setErro(""); setModal(true); };
  const abrirEdicao = (vaga: Vaga) => { setVagaEditando(vaga); setNome(vaga.nome); setLink(vaga.link); setErro(""); setModal(true); };
  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) { setErro("Informe o nome da vaga ou da empresa."); return; }
    let url: URL;
    try { url = new URL(link.trim()); } catch { setErro("Informe um link válido começando com https://"); return; }
    if (url.protocol !== "https:" && url.protocol !== "http:") { setErro("O link deve começar com http:// ou https://"); return; }
    if (vagaEditando) editar(vagaEditando.id, nome, url.toString()); else criar(nome, url.toString());
    setModal(false);
  };
  const aoSoltar = (e: DragEndEvent) => {
    if (!e.over) return;
    const destino = etapas.find((etapa) => etapa.id === e.over?.id);
    if (destino) mover(String(e.active.id), destino.id);
  };

  return <div className="vagas-pagina">
    <CabecalhoAba rotulo="Organização" titulo="Vagas" subtitulo="Acompanhe candidaturas e cada etapa do seu processo seletivo." acoes={<button className="botao botao-destaque" onClick={abrirNova}><Plus size={15} /> Cadastrar vaga</button>} />
    <div className="vagas-resumo"><span><strong>{vagas.length}</strong> candidaturas</span><span><strong>{vagas.filter((v) => !["consegui", "rejeitado", "lixeira"].includes(v.etapa)).length}</strong> em andamento</span><span><strong>{vagas.filter((v) => v.etapa === "consegui").length}</strong> conquistadas</span><span className="vagas-dica"><BriefcaseBusiness size={14} /> Arraste os cartões ou altere a etapa pelo menu.</span></div>
    <DndContext sensors={sensores} collisionDetection={closestCorners} onDragEnd={aoSoltar}><div className="vagas-quadro">{etapas.map((etapa) => { const daEtapa = vagas.filter((v) => v.etapa === etapa.id).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm)); return <ColunaVagas key={etapa.id} etapa={etapa} vagas={daEtapa}>{daEtapa.map((vaga) => <CartaoVaga key={vaga.id} vaga={vaga} aoEditar={() => abrirEdicao(vaga)} aoMover={(novaEtapa) => mover(vaga.id, novaEtapa)} aoExcluir={() => setAExcluir(vaga)} />)}</ColunaVagas>; })}</div></DndContext>
    <Modal aberto={modal} titulo={vagaEditando ? "Editar vaga" : "Cadastrar vaga"} aoFechar={() => setModal(false)}>
      <form className="formulario" onSubmit={salvar} noValidate><Campo id="vaga-nome" rotulo="Nome da vaga ou empresa" obrigatorio erro={erro && !nome.trim() ? erro : undefined}><input id="vaga-nome" className="campo" autoFocus maxLength={140} value={nome} onChange={(e) => { setNome(e.target.value); setErro(""); }} placeholder="Ex.: Desenvolvedor Front-end · Empresa" /></Campo><Campo id="vaga-link" rotulo="Link da vaga" obrigatorio erro={erro && nome.trim() ? erro : undefined}><input id="vaga-link" type="url" className="campo" value={link} onChange={(e) => { setLink(e.target.value); setErro(""); }} placeholder="https://..." /></Campo><div className="projetos-acoes"><button type="button" className="botao botao-fantasma" onClick={() => setModal(false)}>Cancelar</button><button className="botao botao-destaque" type="submit">{vagaEditando ? "Salvar" : "Adicionar à esteira"}</button></div></form>
    </Modal>
    <ConfirmarModal aberto={!!aExcluir} titulo="Excluir vaga definitivamente?" texto={`“${aExcluir?.nome ?? ""}” será removida da lixeira.`} aoConfirmar={() => { if (aExcluir) remover(aExcluir.id); setAExcluir(null); }} aoFechar={() => setAExcluir(null)} />
  </div>;
}
