import { useMemo, useState } from "react";
import { Clock3, Timer } from "lucide-react";
import { BarrasHorizontais } from "../../componentes/Graficos";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { Cartao, Vazio } from "../../componentes/basicos";
import { CronometroPomodoro } from "../../componentes/CronometroPomodoro";
import { usePomodoro } from "../../estado/pomodoro";
import { useEstudos } from "../../estado/estudos";
import { useRotina } from "../../estado/rotina";
import { useProjetos } from "../../estado/projetos";
import { T } from "../../textos/textos";
import { dataLocal, filtrarPorPeriodo, resumoPomodoro, tempoEfetivoMs, type PeriodoPomodoro } from "../../utilitarios/pomodoro";
import type { SessaoPomodoro } from "../../tipos";

type FiltroSituacao = "todas" | SessaoPomodoro["situacao"];

function formatarDuracao(ms: number): string {
  const minutos = Math.round(ms / 60000);
  const horas = Math.floor(minutos / 60);
  const restante = minutos % 60;
  if (horas === 0) return T.pomodoro.minutos(minutos);
  return restante ? `${horas} h ${restante} min` : `${horas} h`;
}

function dataEHora(iso: string): string {
  const data = new Date(iso);
  return Number.isFinite(data.getTime())
    ? data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : iso;
}

function Metrica({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <Cartao className="col-3">
      <div className="coluna" style={{ gap: 2 }}>
        <span className="texto-3" style={{ fontSize: 12 }}>{rotulo}</span>
        <strong className="numero-medio">{valor}</strong>
        {detalhe && <span className="texto-3" style={{ fontSize: 11 }}>{detalhe}</span>}
      </div>
    </Cartao>
  );
}

export default function Pomodoro() {
  const sessoes = usePomodoro((s) => s.sessoes);
  const materias = useEstudos((s) => s.materias);
  const areas = useEstudos((s) => s.areas);
  const tarefas = useRotina((s) => s.tarefas);
  const projetos = useProjetos((s) => s.projetos);
  const [periodo, setPeriodo] = useState<PeriodoPomodoro>("semana");
  const [areaId, setAreaId] = useState("");
  const [tarefaId, setTarefaId] = useState("");
  const [situacao, setSituacao] = useState<FiltroSituacao>("todas");
  const resumo = useMemo(() => resumoPomodoro(sessoes), [sessoes]);
  const doPeriodo = useMemo(() => filtrarPorPeriodo(sessoes, periodo), [sessoes, periodo]);
  const tarefasDoProjeto = tarefas.filter((t) => {
    if (areaId && !materias.some((m) => m.areaId === areaId && m.id === t.materiaId)) return false;
    return true;
  });
  const historico = doPeriodo
    .filter((s) => !areaId || materias.find((m) => m.id === s.materiaId)?.areaId === areaId)
    .filter((s) => !tarefaId || s.tarefaId === tarefaId)
    .filter((s) => situacao === "todas" || s.situacao === situacao)
    .sort((a, b) => b.inicio.localeCompare(a.inicio));
  const estatisticas = resumoPomodoro(historico);
  const nomesProjeto = new Map<string, string>([...areas.map((a) => [`estudo:${a.id}`, a.nome] as const), ...projetos.map((p) => [`projeto:${p.id}`, p.nome] as const)]);
  const nomesMateria = new Map(materias.map((m) => [m.id, m.nome]));
  const nomesTarefa = new Map(tarefas.map((t) => [t.id, t.titulo]));
  const porProjeto = new Map<string, number>();
  const porTarefa = new Map<string, number>();
  for (const sessao of historico) {
    if (sessao.etapa !== "foco") continue;
    const valor = tempoEfetivoMs(sessao) / 60000;
    const idProjeto = sessao.projetoId ? `projeto:${sessao.projetoId}` : sessao.materiaId ? `estudo:${materias.find((m) => m.id === sessao.materiaId)?.areaId ?? ""}` : "livre";
    porProjeto.set(idProjeto, (porProjeto.get(idProjeto) ?? 0) + valor);
    const idTarefa = sessao.tarefaId ?? "";
    porTarefa.set(idTarefa, (porTarefa.get(idTarefa) ?? 0) + valor);
  }

  return (
    <div className="modulo coluna">
      <CabecalhoAba titulo={T.rotas.pomodoro} subtitulo={T.pomodoro.subtitulo} agente="organizador" />
      <div className="grade">
        <Cartao className="col-6" titulo={T.rotas.pomodoro} icone={<Timer size={16} />}>
          <CronometroPomodoro />
        </Cartao>
        <Metrica rotulo={T.pomodoro.focoHoje} valor={formatarDuracao(resumo.focoHojeMs)} />
        <Metrica rotulo={T.pomodoro.focoSemana} valor={formatarDuracao(resumo.focoSemanaMs)} />
        <Metrica rotulo={T.pomodoro.concluidas} valor={String(resumo.concluidas)} detalhe={`${resumo.interrompidas} ${T.pomodoro.interrompidas.toLowerCase()}`} />
        <Metrica rotulo={T.pomodoro.mediaSessao} valor={formatarDuracao(resumo.mediaMs)} />
        <Metrica rotulo={T.pomodoro.sequencia} valor={`${resumo.sequenciaDias}`} detalhe={T.pomodoro.dias} />
      </div>

      <Cartao titulo={T.pomodoro.historico} icone={<Clock3 size={16} />}>
        <div className="formulario-linha" style={{ alignItems: "end", marginBottom: 14 }}>
          <label className="campo-grupo">
            <span className="campo-rotulo">{T.pomodoro.periodo}</span>
            <select className="campo" value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoPomodoro)}>
              <option value="hoje">{T.pomodoro.hoje}</option>
              <option value="semana">{T.pomodoro.semana}</option>
              <option value="mes">{T.pomodoro.mes}</option>
              <option value="tudo">{T.pomodoro.tudo}</option>
            </select>
          </label>
          <label className="campo-grupo">
            <span className="campo-rotulo">{T.pomodoro.filtroProjeto}</span>
            <select className="campo" value={areaId} onChange={(e) => { setAreaId(e.target.value); setTarefaId(""); }}>
              <option value="">{T.pomodoro.todos}</option>
              {areas.map((area) => <option key={area.id} value={area.id}>{area.nome}</option>)}
            </select>
          </label>
          <label className="campo-grupo">
            <span className="campo-rotulo">{T.pomodoro.filtroTarefa}</span>
            <select className="campo" value={tarefaId} onChange={(e) => setTarefaId(e.target.value)}>
              <option value="">{T.pomodoro.todos}</option>
              {tarefasDoProjeto.map((tarefa) => <option key={tarefa.id} value={tarefa.id}>{tarefa.titulo}</option>)}
            </select>
          </label>
          <label className="campo-grupo">
            <span className="campo-rotulo">{T.pomodoro.filtroEstado}</span>
            <select className="campo" value={situacao} onChange={(e) => setSituacao(e.target.value as FiltroSituacao)}>
              <option value="todas">{T.pomodoro.todos}</option>
              <option value="concluida">{T.pomodoro.statusConcluida}</option>
              <option value="interrompida">{T.pomodoro.statusInterrompida}</option>
            </select>
          </label>
        </div>
        <p className="texto-3" style={{ marginTop: 0 }}>{T.pomodoro.planejadoRealizado(Math.round(estatisticas.planejadoMs / 60000), Math.round(estatisticas.realizadoMs / 60000))}</p>
        {historico.length === 0 ? (
          <Vazio icone={<Clock3 size={24} />} titulo={sessoes.length ? T.pomodoro.semDados : T.pomodoro.semHistorico} />
        ) : (
          <div className="lista">
            {historico.map((sessao) => {
              const area = areas.find((a) => a.id === materias.find((m) => m.id === sessao.materiaId)?.areaId);
              const projeto = (sessao.projetoId ? projetos.find((p) => p.id === sessao.projetoId)?.nome : undefined) ?? area?.nome ?? (sessao.materiaId ? nomesMateria.get(sessao.materiaId) : undefined) ?? "Foco livre";
              const planejadoMs = sessao.duracaoPlanejadaMs ?? sessao.minutos * 60000;
              const efetivoMs = sessao.etapa === "foco" ? tempoEfetivoMs(sessao) : sessao.minutos * 60000;
              return (
                <div key={sessao.id} className="lista-item">
                  <div className="lista-item-principal">
                    <span className="lista-item-titulo">{T.pomodoro.etapas[sessao.etapa]} · {projeto}</span>
                    <span className="lista-item-sub">
                      {dataEHora(sessao.inicio)} · {sessao.tarefaId ? nomesTarefa.get(sessao.tarefaId) ?? T.pomodoro.semTarefa : T.pomodoro.semTarefa}
                    </span>
                    <span className="lista-item-sub">
                      {T.pomodoro.realizado}: {formatarDuracao(efetivoMs)} / {T.pomodoro.planejado}: {formatarDuracao(planejadoMs)} · {T.pomodoro.pausas}: {sessao.pausas ?? 0}
                    </span>
                  </div>
                  <span className={`etiqueta ${sessao.situacao === "concluida" ? "etiqueta-sucesso" : "etiqueta-erro"}`}>
                    {sessao.situacao === "concluida" ? T.pomodoro.statusConcluida : T.pomodoro.statusInterrompida}
                  </span>
                  {sessao.fim && <span className="texto-3 numero">{dataLocal(sessao.fim)}</span>}
                </div>
              );
            })}
          </div>
        )}
      </Cartao>

      <div className="grade">
        <Cartao className="col-6" titulo={T.pomodoro.projetos}>
          {[...porProjeto].some(([, valor]) => valor > 0) ? (
            <BarrasHorizontais
              formatar={(valor) => T.pomodoro.minutos(valor)}
              barras={[...porProjeto].filter(([, valor]) => valor > 0).map(([id, valor]) => ({
                rotulo: nomesProjeto.get(id) ?? (id === "livre" ? "Foco livre" : T.pomodoro.semProjeto),
                valor,
              }))}
            />
          ) : <Vazio titulo={T.pomodoro.semDados} />}
        </Cartao>
        <Cartao className="col-6" titulo={T.pomodoro.tarefas}>
          {[...porTarefa].some(([, valor]) => valor > 0) ? (
            <BarrasHorizontais
              formatar={(valor) => T.pomodoro.minutos(valor)}
              barras={[...porTarefa].filter(([, valor]) => valor > 0).map(([id, valor]) => ({
                rotulo: nomesTarefa.get(id) ?? T.pomodoro.semTarefa,
                valor,
              }))}
            />
          ) : <Vazio titulo={T.pomodoro.semDados} />}
        </Cartao>
      </div>
    </div>
  );
}
