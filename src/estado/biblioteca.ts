import { create } from "zustand";
import { persist } from "zustand/middleware";
import { armazenamento, chave } from "../ponte/armazenamento";

export interface AnotacaoLivro {
  id: string;
  pagina: number;
  tipo: "anotacao" | "questao" | "resposta";
  texto: string;
  criadaEm: string;
}

export interface Livro {
  id: string;
  nome: string;
  tamanho: number;
  adicionadoEm: string;
  paginaAtual: number;
  anotacoes: AnotacaoLivro[];
  categoria?: string;
  lido?: boolean;
  paginasTotal?: number;
  capa?: string;
}

interface EstadoBiblioteca {
  livros: Livro[];
  adicionar: (livro: Livro) => void;
  atualizar: (id: string, dados: Partial<Omit<Livro, "id">>) => void;
  remover: (id: string) => void;
}

export const useBiblioteca = create<EstadoBiblioteca>()(persist((set) => ({
  livros: [],
  adicionar: (livro) => set((s) => ({ livros: [livro, ...s.livros.filter((x) => x.id !== livro.id)] })),
  atualizar: (id, dados) => set((s) => ({ livros: s.livros.map((x) => x.id === id ? { ...x, ...dados } : x) })),
  remover: (id) => set((s) => ({ livros: s.livros.filter((x) => x.id !== id) })),
}), { name: chave("biblioteca"), storage: armazenamento }));
