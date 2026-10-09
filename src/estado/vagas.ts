import { create } from "zustand";
import { persist } from "zustand/middleware";
import { armazenamento, chave } from "../ponte/armazenamento";
import { gerarId } from "../utilitarios/basicos";

export type EtapaVaga = "enviada" | "teste" | "entrevista" | "consegui" | "rejeitado" | "lixeira";
export interface Vaga {
  id: string;
  nome: string;
  link: string;
  etapa: EtapaVaga;
  criadaEm: string;
  atualizadaEm: string;
}
interface EstadoVagas {
  vagas: Vaga[];
  criar: (nome: string, link: string) => void;
  mover: (id: string, etapa: EtapaVaga) => void;
  editar: (id: string, nome: string, link: string) => void;
  remover: (id: string) => void;
}

export const useVagas = create<EstadoVagas>()(persist((set) => ({
  vagas: [],
  criar: (nome, link) => set((s) => ({ vagas: [{ id: gerarId(), nome: nome.trim(), link: link.trim(), etapa: "enviada", criadaEm: new Date().toISOString(), atualizadaEm: new Date().toISOString() }, ...s.vagas] })),
  mover: (id, etapa) => set((s) => ({ vagas: s.vagas.map((v) => v.id === id ? { ...v, etapa, atualizadaEm: new Date().toISOString() } : v) })),
  editar: (id, nome, link) => set((s) => ({ vagas: s.vagas.map((v) => v.id === id ? { ...v, nome: nome.trim(), link: link.trim(), atualizadaEm: new Date().toISOString() } : v) })),
  remover: (id) => set((s) => ({ vagas: s.vagas.filter((v) => v.id !== id) })),
}), { name: chave("vagas"), storage: armazenamento }));
