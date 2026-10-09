import type { SessaoPomodoro } from "../tipos";

export type PeriodoPomodoro = "hoje" | "semana" | "mes" | "tudo";

export interface ResumoPomodoro {
  focoHojeMs: number;
  focoSemanaMs: number;
  concluidas: number;
  interrompidas: number;
  mediaMs: number;
  planejadoMs: number;
  realizadoMs: number;
  sequenciaDias: number;
}

export function dataLocal(iso: string): string {
  const data = new Date(iso);
  if (!Number.isFinite(data.getTime())) return "";
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function filtrarPorPeriodo(sessoes: SessaoPomodoro[], periodo: PeriodoPomodoro, agora = new Date()): SessaoPomodoro[] {
  if (periodo === "tudo") return sessoes;
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const inicio = new Date(hoje);
  if (periodo === "semana") inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
  else if (periodo === "mes") inicio.setDate(1);
  const inicioMs = inicio.getTime();
  const fim = new Date(hoje);
  fim.setDate(fim.getDate() + 1);
  return sessoes.filter((sessao) => {
    const timestamp = new Date(sessao.inicio).getTime();
    return Number.isFinite(timestamp) && timestamp >= inicioMs && timestamp < fim.getTime();
  });
}

export function resumoPomodoro(sessoes: SessaoPomodoro[], agora = new Date()): ResumoPomodoro {
  const sessoesFoco = sessoes.filter((sessao) => sessao.etapa === "foco");
  const concluidasFoco = sessoes.filter((sessao) => sessao.etapa === "foco" && sessao.situacao === "concluida");
  const hoje = dataLocal(agora.toISOString());
  const inicioSemana = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  inicioSemana.setDate(inicioSemana.getDate() - ((inicioSemana.getDay() + 6) % 7));
  const inicioSemanaMs = inicioSemana.getTime();
  const focoHojeMs = sessoesFoco
    .filter((sessao) => dataLocal(sessao.inicio) === hoje && new Date(sessao.inicio).getTime() <= agora.getTime())
    .reduce((total, sessao) => total + tempoEfetivoMs(sessao), 0);
  const focoSemanaMs = sessoesFoco
    .filter((sessao) => {
      const timestamp = new Date(sessao.inicio).getTime();
      return Number.isFinite(timestamp) && timestamp >= inicioSemanaMs && timestamp <= agora.getTime();
    })
    .reduce((total, sessao) => total + tempoEfetivoMs(sessao), 0);
  const diasAtivos = new Set(sessoesFoco.filter((sessao) => tempoEfetivoMs(sessao) > 0).map((sessao) => dataLocal(sessao.inicio)).filter(Boolean));
  let referencia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  if (!diasAtivos.has(dataLocal(referencia.toISOString()))) referencia.setDate(referencia.getDate() - 1);
  let sequencia = 0;
  while (diasAtivos.has(dataLocal(referencia.toISOString()))) {
    sequencia++;
    referencia.setDate(referencia.getDate() - 1);
  }
  const planejadoMs = sessoesFoco.reduce((total, sessao) => total + (sessao.duracaoPlanejadaMs ?? sessao.minutos * 60000), 0);
  const realizadoMs = sessoesFoco.reduce((total, sessao) => total + tempoEfetivoMs(sessao), 0);
  return {
    focoHojeMs,
    focoSemanaMs,
    concluidas: sessoes.filter((sessao) => sessao.situacao === "concluida").length,
    interrompidas: sessoes.filter((sessao) => sessao.situacao === "interrompida").length,
    mediaMs: concluidasFoco.length ? concluidasFoco.reduce((total, sessao) => total + tempoEfetivoMs(sessao), 0) / concluidasFoco.length : 0,
    planejadoMs,
    realizadoMs,
    sequenciaDias: sequencia,
  };
}

export function tempoEfetivoMs(sessao: SessaoPomodoro): number {
  const informado = sessao.tempoFocadoMs;
  if (sessao.etapa === "foco" && informado != null && Number.isFinite(informado)) return Math.max(0, informado);
  return Math.max(0, sessao.minutos * 60000);
}
