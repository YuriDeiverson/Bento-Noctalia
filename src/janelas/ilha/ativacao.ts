export const JANELA_PASSAGEM_DUPLA_MS = 900;

export function registrarPassagemDupla(ultimaPassagem: number | null, agora: number): { ativada: boolean; proximaPassagem: number | null } {
  if (ultimaPassagem !== null && agora >= ultimaPassagem && agora - ultimaPassagem <= JANELA_PASSAGEM_DUPLA_MS) {
    return { ativada: true, proximaPassagem: null };
  }
  return { ativada: false, proximaPassagem: agora };
}
