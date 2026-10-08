import type { AgenteId, EstadoAgente } from "../tipos";

export const COR_AGENTE: Record<AgenteId, string> = {
  organizador: "#FF5A5A",
  tutor: "#1C1C1E",
  java: "#5b8def",
  operador: "#FFC20E",
};

export const ESTADOS_SVG: EstadoAgente[] = ["ocioso", "ouvindo", "pensando", "escrevendo", "sucesso", "alerta", "erro", "dormindo"];

const ARTE_AGENTE: Record<AgenteId, string> = {
  organizador: "/personagens/bento/personagem.png",
  tutor: "/personagens/paco/personagem.png",
  operador: "/personagens/milo/personagem.png",
  java: "/personagens/toby/personagem.jpg",
};

export function caminhoPersonagem(agente: AgenteId, estado: EstadoAgente): string {
  if (agente === "organizador" && estado === "sucesso") return "/personagens/bento/comemorando.png";
  if (agente === "organizador" && (estado === "alerta" || estado === "erro")) return "/personagens/bento/comraiva.png";
  return ARTE_AGENTE[agente];
}
