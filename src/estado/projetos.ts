import { create } from "zustand";
import { persist } from "zustand/middleware";
import { armazenamento, chave } from "../ponte/armazenamento";
import { gerarId } from "../utilitarios/basicos";
import type { ColunaKanban } from "../tipos";

export type StatusProjeto = "planejamento" | "ativo" | "pausado" | "concluido" | "arquivado";
export interface PaginaProjeto {
  id: string;
  titulo: string;
  markdown: string;
  atualizadaEm: string;
}

export interface Projeto {
  id: string;
  nome: string;
  descricao: string;
  status: StatusProjeto;
  tipo: string;
  tecnologias: string[];
  tags: string[];
  cor: string;
  repositorio?: string;
  documentacao?: string;
  publicado?: string;
  colunasKanban?: ColunaKanban[];
  inicioEm?: string;
  prazo?: string;
  pastaRepositorio?: string;
  paginas?: PaginaProjeto[];
  criadoEm: string;
  atualizadoEm: string;
}
interface EstadoProjetos {
  projetos: Projeto[];
  criar: (dados: Omit<Projeto, "id" | "criadoEm" | "atualizadoEm">) => Projeto;
  atualizar: (id: string, dados: Partial<Omit<Projeto, "id" | "criadoEm">>) => void;
  excluir: (id: string) => void;
}

export const useProjetos = create<EstadoProjetos>()(persist((set) => ({
  projetos: [],
  criar: (dados) => {
    const agora = new Date().toISOString();
    const projeto = { ...dados, id: gerarId(), criadoEm: agora, atualizadoEm: agora };
    set((s) => ({ projetos: [projeto, ...s.projetos] }));
    return projeto;
  },
  atualizar: (id, dados) => set((s) => ({ projetos: s.projetos.map((p) => p.id === id ? { ...p, ...dados, atualizadoEm: new Date().toISOString() } : p) })),
  excluir: (id) => set((s) => ({ projetos: s.projetos.filter((p) => p.id !== id) })),
}), { name: chave("projetos"), storage: armazenamento }));
