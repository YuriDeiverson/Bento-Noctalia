import { create } from "zustand";
import { persist } from "zustand/middleware";
import { armazenamento, chave } from "../ponte/armazenamento";
import type { EstadoSessaoPomodoro, EtapaPomodoro, SessaoPomodoro } from "../tipos";
import { gerarId } from "../utilitarios/basicos";
import { useConfig } from "./configuracoes";

interface EstadoPomodoro {
  etapa: EtapaPomodoro;
  estado: EstadoSessaoPomodoro;
  rodando: boolean;
  terminaEm: number | null;
  restanteMs: number | null;
  duracaoMs: number;
  inicioEtapa: string | null;
  sessaoId: string | null;
  inicioFocoEm: number | null;
  focoAcumuladoMs: number;
  inicioPausaEm: number | null;
  pausas: number;
  tempoPausaMs: number;
  ciclo: number;
  materiaId?: string;
  tarefaId?: string;
  projetoId?: string;
  sessoes: SessaoPomodoro[];
  iniciar: (minutos?: number) => void;
  pausar: () => void;
  continuar: () => void;
  alternar: () => void;
  reiniciar: () => void;
  encerrar: () => void;
  pular: () => void;
  concluirEtapa: (situacao?: "concluida" | "interrompida", iniciarProxima?: boolean) => EtapaPomodoro;
  escolherEtapa: (etapa: EtapaPomodoro) => void;
  definirVinculo: (materiaId?: string, tarefaId?: string, projetoId?: string) => void;
  atualizarDuracao: () => void;
  recuperar: () => void;
  substituir: (sessoes: SessaoPomodoro[]) => void;
}

function minutosDaEtapa(etapa: EtapaPomodoro): number {
  const p = useConfig.getState().pomodoro;
  return etapa === "foco" ? p.foco : etapa === "pausa_curta" ? p.curta : p.longa;
}

function obterTempoFocado(s: Pick<EstadoPomodoro, "focoAcumuladoMs" | "inicioFocoEm" | "rodando" | "duracaoMs">, agora: number): number {
  const atual = s.rodando && s.inicioFocoEm != null ? Math.max(0, agora - s.inicioFocoEm) : 0;
  return Math.min(s.duracaoMs, Math.max(0, s.focoAcumuladoMs + atual));
}

function obterTempoPausa(s: Pick<EstadoPomodoro, "tempoPausaMs" | "inicioPausaEm">, agora: number): number {
  return s.tempoPausaMs + (s.inicioPausaEm == null ? 0 : Math.max(0, agora - s.inicioPausaEm));
}

function dadosSessao(
  s: EstadoPomodoro,
  situacao: "concluida" | "interrompida",
  agora: number,
  motivo: NonNullable<SessaoPomodoro["motivo"]>,
): SessaoPomodoro | undefined {
  if (!s.inicioEtapa || !s.sessaoId) return undefined;
  const tempoFocadoMs = obterTempoFocado(s, agora);
  return {
    id: s.sessaoId,
    etapa: s.etapa,
    inicio: s.inicioEtapa,
    fim: new Date(agora).toISOString(),
    minutos: Math.round((s.etapa === "foco" ? tempoFocadoMs : Math.min(s.duracaoMs, s.duracaoMs - restanteAtual(s, agora))) / 600) / 100,
    materiaId: s.etapa === "foco" ? s.materiaId : undefined,
    tarefaId: s.etapa === "foco" ? s.tarefaId : undefined,
    projetoId: s.etapa === "foco" ? s.projetoId : undefined,
    situacao,
    duracaoPlanejadaMs: s.duracaoMs,
    tempoFocadoMs: s.etapa === "foco" ? tempoFocadoMs : 0,
    pausas: s.pausas,
    tempoPausaMs: obterTempoPausa(s, agora),
    motivo,
  };
}

function progressoDaEtapa(s: EstadoPomodoro, estado: EstadoSessaoPomodoro, proximaEtapa?: EtapaPomodoro, proximoCiclo = s.ciclo) {
  const etapa = proximaEtapa ?? s.etapa;
  return {
    etapa,
    estado,
    rodando: false,
    terminaEm: null,
    restanteMs: null,
    duracaoMs: minutosDaEtapa(etapa) * 60000,
    inicioEtapa: null,
    sessaoId: null,
    inicioFocoEm: null,
    focoAcumuladoMs: 0,
    inicioPausaEm: null,
    pausas: 0,
    tempoPausaMs: 0,
    ciclo: proximoCiclo,
  };
}

export const usePomodoro = create<EstadoPomodoro>()(
  persist(
    (set, get) => ({
      etapa: "foco",
      estado: "idle",
      rodando: false,
      terminaEm: null,
      restanteMs: null,
      duracaoMs: 25 * 60000,
      inicioEtapa: null,
      sessaoId: null,
      inicioFocoEm: null,
      focoAcumuladoMs: 0,
      inicioPausaEm: null,
      pausas: 0,
      tempoPausaMs: 0,
      ciclo: 1,
      sessoes: [],
      iniciar: (minutos) => {
        const s = get();
        if (s.estado === "running" || s.estado === "paused") return;
        const agora = Date.now();
        const duracaoMs = Math.round((minutos ?? minutosDaEtapa(s.etapa)) * 60000);
        set({
          estado: "running",
          rodando: true,
          duracaoMs,
          terminaEm: agora + duracaoMs,
          restanteMs: null,
          inicioEtapa: new Date(agora).toISOString(),
          sessaoId: gerarId(),
          inicioFocoEm: agora,
          focoAcumuladoMs: 0,
          inicioPausaEm: null,
          pausas: 0,
          tempoPausaMs: 0,
        });
      },
      pausar: () => {
        const s = get();
        if (s.estado !== "running" || s.terminaEm == null) return;
        const agora = Date.now();
        if (s.terminaEm <= agora) return;
        set({
          estado: "paused",
          rodando: false,
          restanteMs: Math.max(0, s.terminaEm - agora),
          terminaEm: null,
          focoAcumuladoMs: obterTempoFocado(s, agora),
          inicioFocoEm: null,
          inicioPausaEm: agora,
          pausas: s.pausas + 1,
        });
      },
      continuar: () => {
        const s = get();
        if (s.estado !== "paused" || s.restanteMs == null) return;
        const agora = Date.now();
        set({
          estado: "running",
          rodando: true,
          terminaEm: agora + s.restanteMs,
          restanteMs: null,
          inicioFocoEm: agora,
          inicioPausaEm: null,
          tempoPausaMs: obterTempoPausa(s, agora),
        });
      },
      alternar: () => {
        const s = get();
        if (s.estado === "running") s.pausar();
        else if (s.estado === "paused") s.continuar();
        else s.iniciar();
      },
      reiniciar: () => {
        const s = get();
        const agora = Date.now();
        if (s.rodando && s.terminaEm != null && s.terminaEm <= agora) return;
        const registro = dadosSessao(s, "interrompida", agora, "reinicio");
        set({
          ...progressoDaEtapa(s, registro ? "interrupted" : "idle"),
          duracaoMs: minutosDaEtapa(s.etapa) * 60000,
          sessoes: registro && !s.sessoes.some((x) => x.id === registro.id) ? [...s.sessoes, registro].slice(-5000) : s.sessoes,
        });
      },
      encerrar: () => {
        const s = get();
        if (s.estado !== "running" && s.estado !== "paused") return;
        const agora = Date.now();
        if (s.rodando && s.terminaEm != null && s.terminaEm <= agora) return;
        const registro = dadosSessao(s, "interrompida", agora, "interrupcao");
        set({
          ...progressoDaEtapa(s, "interrupted"),
          duracaoMs: minutosDaEtapa(s.etapa) * 60000,
          sessoes: registro && !s.sessoes.some((x) => x.id === registro.id) ? [...s.sessoes, registro].slice(-5000) : s.sessoes,
        });
      },
      pular: () => {
        const s = get();
        const agora = Date.now();
        if (s.rodando && s.terminaEm != null && s.terminaEm <= agora) return;
        const registro = dadosSessao(s, "interrompida", agora, "pulo");
        const proxima = proximaEtapa(s.etapa, s.ciclo);
        set({
          ...progressoDaEtapa(s, registro ? "interrupted" : "idle", proxima.etapa, proxima.ciclo),
          duracaoMs: minutosDaEtapa(proxima.etapa) * 60000,
          sessoes: registro && !s.sessoes.some((x) => x.id === registro.id) ? [...s.sessoes, registro].slice(-5000) : s.sessoes,
        });
      },
      concluirEtapa: (situacao = "concluida", iniciarProxima = true) => {
        const s = get();
        if ((s.estado !== "running" && s.estado !== "paused") || !s.inicioEtapa || !s.sessaoId) return s.etapa;
        const etapa = s.etapa;
        const agora = situacao === "concluida" && s.rodando && s.terminaEm != null && s.terminaEm <= Date.now()
          ? s.terminaEm
          : Date.now();
        const registro = dadosSessao(s, situacao, agora, situacao === "concluida" ? "conclusao" : "interrupcao");
        const proxima = proximaEtapa(etapa, s.ciclo);
        set({
          ...progressoDaEtapa(s, situacao === "concluida" ? "completed" : "interrupted", proxima.etapa, proxima.ciclo),
          duracaoMs: minutosDaEtapa(proxima.etapa) * 60000,
          sessoes: registro && !s.sessoes.some((x) => x.id === registro.id) ? [...s.sessoes, registro].slice(-5000) : s.sessoes,
        });
        const cfg = useConfig.getState().pomodoro;
        const deveIniciar =
          situacao === "concluida" &&
          iniciarProxima &&
          ((etapa === "foco" && cfg.autoPausas) || (etapa !== "foco" && cfg.autoProxima));
        if (deveIniciar) get().iniciar();
        return etapa;
      },
      escolherEtapa: (etapa) => {
        const s = get();
        if (s.estado === "running" || s.estado === "paused") return;
        set({
          ...progressoDaEtapa(s, "idle", etapa),
          duracaoMs: minutosDaEtapa(etapa) * 60000,
        });
      },
      definirVinculo: (materiaId, tarefaId, projetoId) => {
        const s = get();
        if (s.estado !== "running" && s.estado !== "paused") set({ materiaId, tarefaId, projetoId });
      },
      atualizarDuracao: () => {
        const s = get();
        if (s.estado === "idle" || s.estado === "completed" || s.estado === "interrupted") {
          set({ duracaoMs: minutosDaEtapa(s.etapa) * 60000 });
        }
      },
      recuperar: () => {
        const s = get();
        if (s.rodando) {
          const inicioFocoEm = s.inicioFocoEm ?? (s.inicioEtapa ? new Date(s.inicioEtapa).getTime() : Date.now());
          const sessaoId = s.sessaoId ?? gerarId();
          if (s.estado !== "running" || s.inicioFocoEm == null || s.sessaoId == null) {
            set({ estado: "running", inicioFocoEm, sessaoId });
          }
        } else if (s.restanteMs != null && s.inicioEtapa) {
          const inicioPausaEm = s.inicioPausaEm ?? Date.now();
          const sessaoId = s.sessaoId ?? gerarId();
          if (s.estado !== "paused" || s.inicioPausaEm == null || s.sessaoId == null) {
            set({ estado: "paused", inicioPausaEm, sessaoId });
          }
        }
        const atual = get();
        if (atual.rodando && atual.terminaEm != null && atual.terminaEm <= Date.now()) {
          get().concluirEtapa("concluida", false);
          return;
        }
        if (!atual.rodando && atual.estado === "paused" && atual.restanteMs === 0) get().concluirEtapa("concluida", false);
      },
      substituir: (sessoes) => set({ sessoes }),
    }),
    {
      name: chave("pomodoro"),
      storage: armazenamento,
      partialize: (s) => ({
        etapa: s.etapa,
        estado: s.estado,
        rodando: s.rodando,
        terminaEm: s.terminaEm,
        restanteMs: s.restanteMs,
        duracaoMs: s.duracaoMs,
        inicioEtapa: s.inicioEtapa,
        sessaoId: s.sessaoId,
        inicioFocoEm: s.inicioFocoEm,
        focoAcumuladoMs: s.focoAcumuladoMs,
        inicioPausaEm: s.inicioPausaEm,
        pausas: s.pausas,
        tempoPausaMs: s.tempoPausaMs,
        ciclo: s.ciclo,
        materiaId: s.materiaId,
        tarefaId: s.tarefaId,
        projetoId: s.projetoId,
        sessoes: s.sessoes,
      }),
      merge: (persistido, atual) => {
        const salvo = (persistido ?? {}) as Partial<EstadoPomodoro>;
        const rodando = salvo.rodando === true;
        const pausado = !rodando && salvo.restanteMs != null && Boolean(salvo.inicioEtapa);
        const duracaoMs = salvo.duracaoMs ?? atual.duracaoMs;
        const restanteMs = salvo.restanteMs ?? 0;
        const restanteRodando = salvo.terminaEm == null ? duracaoMs : Math.max(0, salvo.terminaEm - Date.now());
        return {
          ...atual,
          ...salvo,
          estado: rodando ? "running" : pausado ? "paused" : salvo.estado ?? "idle",
          sessaoId: rodando || pausado ? salvo.sessaoId ?? gerarId() : null,
          inicioFocoEm: rodando ? salvo.inicioFocoEm ?? Date.now() : null,
          focoAcumuladoMs: salvo.focoAcumuladoMs ?? (rodando ? Math.max(0, duracaoMs - restanteRodando) : pausado ? Math.max(0, duracaoMs - restanteMs) : 0),
          inicioPausaEm: pausado ? salvo.inicioPausaEm ?? Date.now() : null,
          pausas: salvo.pausas ?? 0,
          tempoPausaMs: salvo.tempoPausaMs ?? 0,
          sessoes: (salvo.sessoes ?? []).map((sessao) => ({
            ...sessao,
            tempoFocadoMs: sessao.tempoFocadoMs ?? (sessao.etapa === "foco" ? sessao.minutos * 60000 : 0),
          })),
        };
      },
      onRehydrateStorage: () => (estado) => estado?.recuperar(),
    },
  ),
);

function proximaEtapa(etapa: EtapaPomodoro, ciclo: number): { etapa: EtapaPomodoro; ciclo: number } {
  const ciclos = useConfig.getState().pomodoro.ciclos;
  if (etapa === "foco") return { etapa: ciclo >= ciclos ? "pausa_longa" : "pausa_curta", ciclo };
  if (etapa === "pausa_longa") return { etapa: "foco", ciclo: 1 };
  return { etapa: "foco", ciclo: ciclo + 1 };
}

export function restanteAtual(s: Pick<EstadoPomodoro, "rodando" | "terminaEm" | "restanteMs" | "duracaoMs">, agora: number): number {
  if (s.rodando && s.terminaEm != null) return Math.max(0, s.terminaEm - agora);
  if (s.restanteMs != null) return s.restanteMs;
  return s.duracaoMs;
}

export function formatarRelogio(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const seg = total % 60;
  return `${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
}
