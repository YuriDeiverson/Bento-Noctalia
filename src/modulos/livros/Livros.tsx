import { useEffect, useMemo, useState } from "react";
import { BookOpen, NotebookPen, Plus, Search, Trash2, Upload, X, Check } from "lucide-react";
import { CabecalhoAba } from "../../componentes/CabecalhoAba";
import { ConfirmarModal } from "../../componentes/basicos";
import { useBiblioteca, type AnotacaoLivro } from "../../estado/biblioteca";
import { excluirArquivo, enviarArquivo, lerConteudo, LIMITE_ARQUIVO } from "../../ponte/arquivos";
import { gerarId } from "../../utilitarios/basicos";
import "./livros.css";

const PASTA_LIVROS = "biblioteca";
const bytes = (n: number) => n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

export default function Livros() {
  const livros = useBiblioteca((s) => s.livros);
  const adicionar = useBiblioteca((s) => s.adicionar);
  const atualizar = useBiblioteca((s) => s.atualizar);
  const remover = useBiblioteca((s) => s.remover);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [arquivoUrl, setArquivoUrl] = useState<string | null>(null);
  const [capaUrl, setCapaUrl] = useState<string | null>(null);
  const [totalPaginas, setTotalPaginas] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState("1");
  const [tipo, setTipo] = useState<AnotacaoLivro["tipo"]>("anotacao");
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [sucesso, setSucesso] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [leituraFiltro, setLeituraFiltro] = useState("Todos");
  const livro = livros.find((x) => x.id === selecionado);
  const categorias = useMemo(() => ["Todas", "Sem categoria", "Estudos", "Tecnologia", "Ficção", "Carreira", ...new Set(livros.map((x) => x.categoria).filter((x): x is string => Boolean(x)))], [livros]);
  const visiveis = useMemo(() => livros.filter((x) => x.nome.toLocaleLowerCase().includes(busca.toLocaleLowerCase()) && (categoriaFiltro === "Todas" || (categoriaFiltro === "Sem categoria" ? !x.categoria : (x.categoria ?? "Sem categoria") === categoriaFiltro)) && (leituraFiltro === "Todos" || (leituraFiltro === "Lidos" ? Boolean(x.lido) : !x.lido))), [livros, busca, categoriaFiltro, leituraFiltro]);

  useEffect(() => {
    let url: string | null = null;
    let vigente = true;
    setArquivoUrl(null);
    setCapaUrl(livro?.capa ?? null);
    setTotalPaginas(livro?.paginasTotal ?? null);
    if (livro) {
      setCarregando(true);
      void lerConteudo(PASTA_LIVROS, livro.id).then(async (blob) => {
        if (!vigente) return;
        url = URL.createObjectURL(blob);
        setArquivoUrl(url);
        try {
          const pdfjs = await import("pdfjs-dist");
          if (!pdfjs.GlobalWorkerOptions.workerSrc) {
            const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
            pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
          }
          const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
          if (!vigente) return;
          setTotalPaginas(pdf.numPages);
          atualizar(livro.id, { paginasTotal: pdf.numPages });
          const primeira = await pdf.getPage(1);
          const viewport = primeira.getViewport({ scale: 0.55 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const contexto = canvas.getContext("2d");
          if (contexto) {
            await primeira.render({ canvas, canvasContext: contexto, viewport }).promise;
            if (vigente) {
              const capa = canvas.toDataURL("image/jpeg", 0.78);
              setCapaUrl(capa);
              atualizar(livro.id, { capa });
            }
          }
        } catch { /* PDF protegido: mantem a capa ilustrada. */ }
      }).catch(() => { if (vigente) setErro("Não foi possível abrir este PDF. Confira se o arquivo ainda está disponível neste computador."); }).finally(() => { if (vigente) setCarregando(false); });
    }
    return () => { vigente = false; if (url) URL.revokeObjectURL(url); };
  }, [livro?.id]);

  const aoEnviar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") { setErro("Escolha um arquivo PDF."); return; }
    if (file.size > LIMITE_ARQUIVO) { setErro(`O arquivo ultrapassa o limite de ${bytes(LIMITE_ARQUIVO)}.`); return; }
    setErro(""); setSucesso(""); setCarregando(true);
    try {
      const meta = await enviarArquivo(PASTA_LIVROS, file);
      adicionar({ id: meta.id, nome: meta.nome, tamanho: meta.tamanho, adicionadoEm: meta.criadoEm, paginaAtual: 1, anotacoes: [], categoria: "Sem categoria", lido: false });
      setSelecionado(meta.id); setSucesso("Livro adicionado à biblioteca.");
    } catch (err) { setErro(err instanceof Error ? `Não foi possível salvar o PDF: ${err.message}` : "Não foi possível salvar o PDF."); }
    finally { setCarregando(false); }
  };

  const excluirLivro = async () => {
    if (!livro) return;
    setCarregando(true);
    try { await excluirArquivo(PASTA_LIVROS, livro.id); remover(livro.id); setSelecionado(null); setConfirmarExclusao(false); setErro(""); }
    catch { setErro("Não foi possível excluir o arquivo PDF."); }
    finally { setCarregando(false); }
  };

  const salvarAnotacao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!livro || !texto.trim()) return;
    const anotacao: AnotacaoLivro = { id: gerarId(), pagina: Math.max(1, Number(pagina) || 1), tipo, texto: texto.trim(), criadaEm: new Date().toISOString() };
    atualizar(livro.id, { paginaAtual: anotacao.pagina, anotacoes: [anotacao, ...livro.anotacoes] });
    setTexto("");
  };

  return <div className="livros-pagina">
    <CabecalhoAba rotulo="Organização" titulo="Biblioteca de livros" subtitulo="Leia seus PDFs e guarde anotações, questões e respostas junto de cada livro." acoes={<label className="botao botao-destaque livros-upload"><Upload size={15} /> Adicionar PDF<input type="file" accept="application/pdf,.pdf" onChange={aoEnviar} /></label>} />
    {erro && <div className="livros-alerta" role="alert">{erro}<button aria-label="Fechar aviso" onClick={() => setErro("")}><X size={14} /></button></div>}{sucesso && <p className="livros-sucesso" role="status">{sucesso}</p>}
    <div className={`livros-layout ${livro ? "livros-em-leitura" : ""}`}>
      <aside className="livros-estante"><label className="livros-busca"><Search size={15} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na biblioteca" /></label><label className="livros-categoria-filtro">Categoria<select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>{categorias.map((categoria) => <option key={categoria}>{categoria}</option>)}</select></label><label className="livros-categoria-filtro">Leitura<select value={leituraFiltro} onChange={(e) => setLeituraFiltro(e.target.value)}><option>Todos</option><option>Lidos</option><option>Quero ler</option></select></label>{livros.length === 0 ? <div className="livros-vazio"><BookOpen size={26} /><strong>Sua biblioteca esta vazia</strong><span>Adicione seus PDFs para comecar sua estante.</span></div> : visiveis.map((item) => <article className="livro-item" key={item.id} aria-current={item.id === selecionado ? "true" : undefined}><button className="livro-capa" onClick={() => { setSelecionado(item.id); setPagina(String(item.paginaAtual)); setErro(""); }}><span>{item.nome.slice(0, 1).toLocaleUpperCase()}</span></button><div className="livro-item-info"><button className="livro-titulo" onClick={() => { setSelecionado(item.id); setPagina(String(item.paginaAtual)); setErro(""); }}><strong>{item.nome}</strong><small>{bytes(item.tamanho)} - pag. {item.paginaAtual} - {item.anotacoes.length} notas</small></button><select aria-label={`Categoria de ${item.nome}`} value={item.categoria ?? "Sem categoria"} onChange={(e) => atualizar(item.id, { categoria: e.target.value })}>{categorias.filter((x) => x !== "Todas").map((categoria) => <option key={categoria}>{categoria}</option>)}</select><button className="livro-lido" onClick={() => atualizar(item.id, { lido: !item.lido })}>{item.lido ? <><Check size={12} /> Lido</> : "Marcar como lido"}</button></div></article>)}</aside>
      {livro ? <main className="livros-leitura"><div className="livros-leitura-topo"><button className="livros-voltar" onClick={() => setSelecionado(null)}><BookOpen size={15} /> Biblioteca</button><label>Pagina atual<input type="number" min="1" value={pagina} onChange={(e) => { setPagina(e.target.value); atualizar(livro.id, { paginaAtual: Math.max(1, Number(e.target.value) || 1) }); }} /></label></div><section className="livro-detalhe-resumo"><div className="livro-detalhe-capa">{capaUrl || livro.capa ? <img src={capaUrl ?? livro.capa} alt={`Capa de ${livro.nome}`} /> : <div className="livro-capa livro-capa-grande"><span>{livro.nome}</span></div>}</div><div><span>{livro.categoria ?? "Sem categoria"}</span><h3>{livro.nome}</h3><p>Adicionado em {new Date(livro.adicionadoEm).toLocaleDateString("pt-BR")} - {bytes(livro.tamanho)}</p><strong>{totalPaginas ? `Pagina ${livro.paginaAtual} de ${totalPaginas} ? ${Math.min(100, Math.round(livro.paginaAtual / totalPaginas * 100))}%` : `Pagina atual ${livro.paginaAtual}`}</strong><div className="livro-progresso-trilho"><i style={{ width: totalPaginas ? `${Math.min(100, Math.round(livro.paginaAtual / totalPaginas * 100))}%` : "0%" }} /></div><label>Categoria<select value={livro.categoria ?? "Sem categoria"} onChange={(e) => atualizar(livro.id, { categoria: e.target.value })}>{categorias.filter((x) => x !== "Todas").map((c) => <option key={c}>{c}</option>)}</select></label><button className="botao botao-fantasma" onClick={() => atualizar(livro.id, { lido: !livro.lido })}>{livro.lido ? "Marcar como nao lido" : "Marcar como lido"}</button></div></section>
        {carregando && !arquivoUrl ? <div className="livros-pdf-vazio">Abrindo PDF…</div> : arquivoUrl ? <iframe className="livros-pdf" src={arquivoUrl} title={`Leitor de ${livro.nome}`} /> : <div className="livros-pdf-vazio">O visualizador de PDF não ficou disponível.</div>}
        <section className="livros-anotacoes"><div className="livros-subtitulo"><NotebookPen size={16} /><h3>Anotações e questões</h3></div><form className="livros-form-nota" onSubmit={salvarAnotacao}><div><label>Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value as AnotacaoLivro["tipo"])}><option value="anotacao">Anotação</option><option value="questao">Questão</option><option value="resposta">Resposta</option></select></label><label>Página<input type="number" min="1" value={pagina} onChange={(e) => setPagina(e.target.value)} /></label></div><textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={tipo === "questao" ? "Escreva uma questão sobre o conteúdo…" : tipo === "resposta" ? "Registre sua resposta…" : "Escreva uma anotação sobre esta página…"} rows={3} /><button type="submit" className="botao botao-destaque" disabled={!texto.trim()}><Plus size={14} /> Salvar anotação</button></form><div className="livros-lista-notas">{livro.anotacoes.map((nota) => <article key={nota.id}><header><strong>{nota.tipo === "questao" ? "Questão" : nota.tipo === "resposta" ? "Resposta" : "Anotação"} · página {nota.pagina}</strong><button aria-label="Excluir anotação" onClick={() => atualizar(livro.id, { anotacoes: livro.anotacoes.filter((x) => x.id !== nota.id) })}><Trash2 size={13} /></button></header><p>{nota.texto}</p><small>{new Date(nota.criadaEm).toLocaleString("pt-BR")}</small></article>)}{livro.anotacoes.length === 0 && <p className="livros-sem-notas">Suas notas, questões e respostas ficarão associadas às páginas do livro.</p>}</div></section>
      </main> : <main className="livros-prateleiras"><header><div><h2>Minha estante</h2><p>{livros.length} {livros.length === 1 ? "livro" : "livros"} - {livros.filter((x) => x.lido).length} lidos</p></div><BookOpen size={22} /></header><div className="livros-filtros-acervo"><label className="livros-busca"><Search size={15} /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar livros" /></label><label>Categoria<select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>{categorias.map((c) => <option key={c}>{c}</option>)}</select></label><label>Leitura<select value={leituraFiltro} onChange={(e) => setLeituraFiltro(e.target.value)}><option>Todos</option><option>Lidos</option><option>Quero ler</option></select></label></div>{visiveis.length ? <div className="livros-capas">{visiveis.map((item, indice) => <article className="livro-estante-card" key={item.id}><button className={`livro-capa livro-capa-grande livro-capa-cor-${indice % 5}`} onClick={() => { setSelecionado(item.id); setPagina(String(item.paginaAtual)); setErro(""); }}>{item.capa ? <img className="livro-card-capa-img" src={item.capa} alt={`Capa de ${item.nome}`} /> : <span className="livro-capa-titulo">{item.nome}</span>}<small>{item.categoria ?? "Sem categoria"}</small></button><div className="livro-card-meta"><strong>{item.nome}</strong><span>{item.lido ? "Conclu\u00eddo" : item.paginaAtual > 1 ? "Em andamento" : "Quero ler"}</span>{item.paginasTotal && <><div className="livro-card-trilho"><i style={{ width: `${Math.min(100, Math.round(item.paginaAtual / item.paginasTotal * 100))}%` }} /></div><small>Pagina {item.paginaAtual} de {item.paginasTotal}</small></>}<button className="livro-card-lido" onClick={() => atualizar(item.id, { lido: !item.lido })}>{item.lido ? "Marcar n\u00e3o lido" : "Marcar lido"}</button></div></article>)}</div> : <div className="livros-vazio"><BookOpen size={30} /><strong>{livros.length ? "Nenhum livro nessa categoria" : "Sua estante esta vazia"}</strong><span>{livros.length ? "Experimente mudar os filtros." : "Adicione um PDF para montar sua biblioteca."}</span></div>}</main>}
    </div>
    <ConfirmarModal aberto={confirmarExclusao} titulo="Remover este livro?" texto="O PDF e as anotações associadas serão removidos da biblioteca." aoConfirmar={() => void excluirLivro()} aoFechar={() => setConfirmarExclusao(false)} />
  </div>;
}
