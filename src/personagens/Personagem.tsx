import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { motion, useAnimate } from "motion/react";
import { Heart } from "lucide-react";
import type { AgenteId, EstadoAgente } from "../tipos";
import { COR_ESTADO, useEstadoAgente } from "../estado/agentes";
import { tocarSom, tocarSequencia } from "../ponte/sons";
import { caminhoPersonagem, ESTADOS_SVG, COR_AGENTE } from "./cores";
import "./personagens.css";

export interface ControlePersonagem {
  carinho: () => void;
}

interface Props {
  agente: AgenteId;
  estado?: EstadoAgente;
  tamanho?: number;
  interativo?: boolean;
  halo?: boolean;
  rotulo?: string;
}

const preCarregados = new Set<AgenteId>();
const agentesSemArte = new Set<AgenteId>();
const ouvintesSemArte = new Map<AgenteId, Set<(sem: boolean) => void>>();

function marcarSemArte(agente: AgenteId) {
  if (agentesSemArte.has(agente)) return;
  agentesSemArte.add(agente);
  ouvintesSemArte.get(agente)?.forEach((f) => f(true));
  window.setTimeout(() => void verificarArte(agente), 8000);
}

async function verificarArte(agente: AgenteId) {
  if (!agentesSemArte.has(agente) || document.hidden) {
    if (agentesSemArte.has(agente)) window.setTimeout(() => void verificarArte(agente), 8000);
    return;
  }
  try {
    const r = await fetch(caminhoPersonagem(agente, "ocioso"), { method: "HEAD", cache: "no-store" });
    if (r.ok) {
      agentesSemArte.delete(agente);
      ouvintesSemArte.get(agente)?.forEach((f) => f(false));
      return;
    }
  } catch {
    return;
  }
  window.setTimeout(() => void verificarArte(agente), 8000);
}

function ouvirSemArte(agente: AgenteId, f: (sem: boolean) => void) {
  if (!ouvintesSemArte.has(agente)) ouvintesSemArte.set(agente, new Set());
  ouvintesSemArte.get(agente)!.add(f);
  return () => {
    ouvintesSemArte.get(agente)?.delete(f);
  };
}

function preCarregar(agente: AgenteId) {
  if (preCarregados.has(agente)) return;
  preCarregados.add(agente);
  const carregar = () => new Set(ESTADOS_SVG.map((e) => caminhoPersonagem(agente, e))).forEach((src) => {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
  });
  window.setTimeout(carregar, 800);
}

export const Personagem = forwardRef<ControlePersonagem, Props>(function Personagem(
  { agente, estado: estadoFixo, tamanho = 48, interativo = true, halo = true, rotulo },
  ref,
) {
  const estadoVivo = useEstadoAgente(agente);
  const estado = estadoFixo ?? estadoVivo;
  const [escopo, animar] = useAnimate();
  const [reacao, setReacao] = useState<"feliz" | "tonto" | null>(null);
  const [coracoes, setCoracoes] = useState(0);
  const [sobre, setSobre] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const cliques = useRef<number[]>([]);
  const temporizadores = useRef<number[]>([]);
  const caixa = useRef<HTMLDivElement>(null);
  const [semArte, setSemArte] = useState(() => agentesSemArte.has(agente));
  useEffect(() => ouvirSemArte(agente, setSemArte), [agente]);


  const agendar = (fn: () => void, ms: number) => {
    temporizadores.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    preCarregar(agente);
  }, [agente]);

  useEffect(() => {
    const atual = temporizadores.current;
    return () => atual.forEach((t) => window.clearTimeout(t));
  }, []);

  useEffect(() => {
    const el = caixa.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(([entrada]) => setVisivel(entrada.isIntersecting), { rootMargin: "80px" });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const mostrarFeliz = (duracao = 1400) => {
    setReacao("feliz");
    setCoracoes((n) => n + 1);
    agendar(() => setReacao((r) => (r === "feliz" ? null : r)), duracao);
  };

  useImperativeHandle(ref, () => ({
    carinho: () => {
      mostrarFeliz(1900);
      void tocarSom("proud", "personagens");
    },
  }));

  useEffect(() => {
    if (!interativo || !sobre || reacao) return;
    const t = window.setTimeout(() => {
      mostrarFeliz(1900);
      void tocarSom("love", "personagens");
    }, 1900);
    return () => window.clearTimeout(t);
  }, [sobre, interativo, reacao]);

  const aoClicar = () => {
    if (!interativo) return;
    const agora = Date.now();
    cliques.current = [...cliques.current.filter((t) => agora - t < 1700), agora];
    if (cliques.current.length >= 3) {
      cliques.current = [];
      setReacao("tonto");
      void tocarSequencia(["slap", "dizzy"], "personagens", 220);
      void animar(escopo.current, { rotate: [0, 360, 720, 1080] }, { duration: 3.3, ease: "easeInOut" });
      agendar(() => setReacao(null), 3300);
      return;
    }
    if (reacao === "tonto") return;
    void animar(escopo.current, { scaleX: [1, 1.14, 0.94, 1], scaleY: [1, 0.84, 1.06, 1] }, { duration: 0.37, times: [0, 0.19, 0.54, 1], ease: "easeOut" });
    mostrarFeliz();
    void tocarSequencia(["pop", "love"], "personagens", 240);
  };

  const estadoExibido: EstadoAgente = reacao === "feliz" ? "sucesso" : reacao === "tonto" ? "erro" : sobre && interativo && estado === "ocioso" ? "ouvindo" : estado;
  const corHalo = reacao === "tonto" ? "#a855f7" : COR_ESTADO[estado];
  const mostrarHalo = halo && tamanho >= 32 && reacao === "tonto";

  return (
    <div
      ref={caixa}
      className="personagem"
      data-agente={agente}
      style={{ width: tamanho, height: tamanho }}
      role={interativo ? "button" : "img"}
      aria-label={rotulo}
      tabIndex={interativo ? 0 : undefined}
      onClick={aoClicar}
      onKeyDown={(e) => {
        if (interativo && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          aoClicar();
        }
      }}
      onPointerEnter={() => {
        if (!interativo) return;
        setSobre(true);
        void tocarSom("hover", "personagens");
      }}
      onPointerLeave={() => setSobre(false)}
    >
      {mostrarHalo && <span className="personagem-halo" style={{ background: corHalo }} />}
      <motion.div className="personagem-corpo" animate={{ scale: sobre && interativo ? 1.08 : 1 }} transition={{ type: "spring", visualDuration: 0.3, bounce: 0.35 }}>
        <div ref={escopo} className="personagem-giro">
          {visivel ? (
            semArte ? (
              <span className="personagem-sem-arte" style={{ width: tamanho, height: tamanho, background: COR_AGENTE[agente], fontSize: Math.round(tamanho * 0.42) }}>{agente.slice(0, 1).toUpperCase()}</span>
            ) : (
              <img src={caminhoPersonagem(agente, estadoExibido)} width={tamanho} height={tamanho} alt="" draggable={false} decoding="async" className="personagem-imagem" onError={() => marcarSemArte(agente)} />
            )
          ) : (
            <span style={{ width: tamanho, height: tamanho, display: "block" }} />
          )}
        </div>
      </motion.div>
      {coracoes > 0 && reacao === "feliz" && tamanho >= 28 && (
        <span key={coracoes} className="coracoes" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <Heart key={i} size={Math.max(10, tamanho * 0.2)} fill="#ff6fa8" color="#ff6fa8" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </span>
      )}
    </div>
  );
});
