import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, SkipForward, Square } from "lucide-react";
import { Anel } from "./Graficos";
import { Botao, ConfirmarModal } from "./basicos";
import { useConfig } from "../estado/configuracoes";
import { usePomodoro, formatarRelogio, restanteAtual } from "../estado/pomodoro";
import { useEstudos } from "../estado/estudos";
import { useRotina } from "../estado/rotina";
import { useProjetos } from "../estado/projetos";
import { tocarSom } from "../ponte/sons";
import { T } from "../textos/textos";
import { funcaoLigada } from "../utilitarios/funcoes";
import type { EtapaPomodoro } from "../tipos";

const ETAPAS: EtapaPomodoro[] = ["foco", "pausa_curta", "pausa_longa"];

export function CronometroPomodoro() {
  const p = usePomodoro();
  const estudos = useEstudos();
  const tarefas = useRotina((s) => s.tarefas);
  const projetos = useProjetos((s) => s.projetos).filter((projeto) => projeto.status === "ativo");
  const config = useConfig((s) => s.pomodoro);
  const comEstudos = useConfig((s) => funcaoLigada("estudos", s.funcoesDesligadas));
  const ciclos = useConfig((s) => s.pomodoro.ciclos);
  const [agora, setAgora] = useState(() => Date.now());
  const [confirmar, setConfirmar] = useState<"encerrar" | "reiniciar" | null>(null);
  const iniciado = p.estado === "running" || p.estado === "paused";
  const tarefasDaMateria = tarefas.filter((t) => (p.projetoId ? t.projetoId === p.projetoId : p.materiaId ? t.materiaId === p.materiaId : false) && t.status !== "concluida" && t.status !== "cancelada");
  const vinculo = p.projetoId ? `projeto:${p.projetoId}` : p.materiaId ? `estudo:${p.materiaId}` : "livre";

  useEffect(() => {
    if (!p.rodando) return;
    const t = window.setInterval(() => setAgora(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [p.rodando]);

  const restante = restanteAtual(p, agora);
  const progresso = p.duracaoMs > 0 ? 1 - restante / p.duracaoMs : 0;
  const cor = p.etapa === "foco" ? "var(--destaque)" : "var(--sucesso)";
  const alternar = () => {
    if (p.estado !== "running" && p.estado !== "paused" && config.sons && p.etapa === "foco") void tocarSom("work", "pomodoro");
    p.alternar();
  };
  const encerrar = () => {
    if (!iniciado) return;
    if (config.confirmarEncerramento) setConfirmar("encerrar");
    else p.encerrar();
  };
  const reiniciar = () => {
    if (!iniciado) return p.reiniciar();
    if (config.confirmarEncerramento) setConfirmar("reiniciar");
    else p.reiniciar();
  };

  return (
    <>
      <div className="foco-cronometro" data-rodando={p.rodando ? "sim" : "nao"}>
        <div className="foco-anel">
          <Anel progresso={iniciado ? progresso : 0} tamanho={132} espessura={8} cor={cor} />
          <div className="foco-anel-centro">
            <span className="foco-relogio">{formatarRelogio(restante)}</span>
            <span className="texto-3" style={{ fontSize: 11 }}>{T.pomodoro.etapas[p.etapa]}</span>
            {p.etapa === "foco" && <span className="texto-3" style={{ fontSize: 10 }}>{T.pomodoro.ciclo(p.ciclo, ciclos)}</span>}
          </div>
        </div>
        <div className="foco-lado">
          {p.estado === "completed" && <span className="etiqueta etiqueta-sucesso" role="status">{T.pomodoro.etapaConcluida}</span>}
          {p.estado === "interrupted" && <span className="etiqueta etiqueta-erro" role="status">{T.pomodoro.sessaoInterrompida}</span>}
          <div className="segmentado foco-etapas" role="tablist">
            {ETAPAS.map((etapa) => (
              <button key={etapa} type="button" role="tab" aria-selected={p.etapa === etapa} disabled={iniciado && p.etapa !== etapa} onClick={() => p.escolherEtapa(etapa)}>
                {T.pomodoro.etapasCurtas[etapa]}
              </button>
            ))}
          </div>
          {p.etapa === "foco" && (
            <>
              <select
                className="seletor"
                aria-label="Vincular foco a projeto ou estudo (opcional)"
                value={vinculo}
                disabled={iniciado}
                onChange={(e) => {
                  const valor = e.target.value;
                  if (valor.startsWith("projeto:")) p.definirVinculo(undefined, undefined, valor.slice(8));
                  else if (valor.startsWith("estudo:")) p.definirVinculo(valor.slice(7), undefined, undefined);
                  else p.definirVinculo(undefined, undefined, undefined);
                }}
              >
                <option value="livre">Foco livre (sem vínculo)</option>
                {projetos.length > 0 && <optgroup label="Projetos ativos">{projetos.map((projeto) => <option key={projeto.id} value={`projeto:${projeto.id}`}>{projeto.nome}</option>)}</optgroup>}
                {comEstudos && estudos.areas.map((area) => {
                  const materias = estudos.materias.filter((materia) => materia.areaId === area.id);
                  return materias.length ? <optgroup key={area.id} label={area.nome}>{materias.map((materia) => <option key={materia.id} value={`estudo:${materia.id}`}>{materia.nome}</option>)}</optgroup> : null;
                })}
              </select>
              {vinculo !== "livre" && <select
                className="seletor"
                aria-label={T.pomodoro.tarefa}
                value={p.tarefaId ?? ""}
                disabled={iniciado}
                onChange={(e) => p.definirVinculo(p.materiaId, e.target.value || undefined)}
              >
                <option value="">{T.pomodoro.semTarefa}</option>
                {tarefasDaMateria.map((tarefa) => <option key={tarefa.id} value={tarefa.id}>{tarefa.titulo}</option>)}
              </select>}
            </>
          )}
          <div className="linha" style={{ gap: 6 }}>
            <Botao variante={p.rodando ? "secundario" : "primario"} icone={p.rodando ? <Pause size={14} /> : <Play size={14} />} onClick={alternar} style={{ flex: 1 }}>
              {p.rodando ? T.pomodoro.pausar : p.estado === "paused" ? T.pomodoro.continuar : T.pomodoro.iniciar}
            </Botao>
            {iniciado && (
              <Botao soIcone icone={<Square size={13} />} aria-label={T.pomodoro.encerrar} title={T.pomodoro.encerrar} onClick={encerrar} />
            )}
            <Botao soIcone icone={<RotateCcw size={14} />} aria-label={T.pomodoro.reiniciar} title={T.pomodoro.reiniciar} onClick={reiniciar} />
            <Botao soIcone icone={<SkipForward size={14} />} aria-label={T.pomodoro.pular} title={T.pomodoro.pular} onClick={p.pular} />
          </div>
        </div>
      </div>
      <ConfirmarModal
        aberto={confirmar !== null}
        titulo={T.pomodoro.confirmacao}
        texto={T.pomodoro.confirmarEncerrar}
        rotuloConfirmar={T.pomodoro.encerrar}
        aoConfirmar={() => {
          if (confirmar === "reiniciar") p.reiniciar();
          else p.encerrar();
        }}
        aoFechar={() => setConfirmar(null)}
      />
    </>
  );
}
