import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, LabelList,
} from "recharts";
import * as XLSX from "xlsx";
import {
  Activity, Stethoscope, ClipboardList, BarChart3, Users, LogOut,
  Plus, Search, Download, ShieldCheck, UserPlus, Eye, EyeOff, X,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Lock,
  Timer, Check, Syringe, HeartPulse, CalendarRange, Inbox, TrendingUp, KeyRound,
} from "lucide-react";
import { api, getToken, setToken } from "./api.js";

/* ---------------------------------------------------------------------- */
/*  Dados clínicos de referência (fallback — a fonte é a API/catálogo)     */
/* ---------------------------------------------------------------------- */

const SIRS_ITEMS_FALLBACK = [
  { id: "fc90", label: "FC > 90 bpm", categoria: "sirs" },
  { id: "temp", label: "Temperatura > 37,5ºC ou < 35ºC", categoria: "sirs" },
  { id: "fr20", label: "FR > 20 irpm ou PaCO2 < 32 mmHg", categoria: "sirs" },
  { id: "leucocitos", label: "Leucócitos totais > 12.000 ou < 4.000, ou formas jovens ≥ 10%", categoria: "sirs" },
  { id: "hipoxemia", label: "Hipoxemia — SpO2 < 90% ou PaO2/FiO2 < 300", categoria: "disfuncao" },
  { id: "consciencia", label: "Alteração do nível/conteúdo de consciência (delirium)", categoria: "disfuncao" },
  { id: "oliguria", label: "Oligúria — débito urinário < 0,5 mL/kg/h por 2h, ou creatinina > 2 mg/dL", categoria: "disfuncao" },
  { id: "hipotensao", label: "Hipotensão arterial — PAS < 90 mmHg, queda de PAS > 40 mmHg, ou PAM ≤ 65 mmHg", categoria: "disfuncao" },
  { id: "acidose", label: "Acidose metabólica inexplicada — déficit de bases ≤ 5 mEq/L e lactato ≥ 2 mmol/L", categoria: "disfuncao" },
  { id: "coagulopatia", label: "Coagulopatia — RNI > 1,5 ou TTPa > 60s", categoria: "disfuncao" },
  { id: "trombocitopenia", label: "Trombocitopenia — plaquetas < 100.000, ou queda ≥ 50% (últimos 3 dias)", categoria: "disfuncao" },
  { id: "hiperbilirrubinemia", label: "Hiperbilirrubinemia — bilirrubina > 2x o valor de referência", categoria: "disfuncao" },
];

const FOCOS_FALLBACK = [
  "Trato respiratório inferior/superior", "Trato urinário", "Trato gastrointestinal",
  "Cutâneo/partes moles", "Sistema nervoso", "Ginecológico", "Urológico",
  "Hematológico", "Cardíaco (Endocardite)", "Dentário",
  "Corrente sanguínea / cateter (CVC)", "Indeterminado / a esclarecer",
];

const ANTIBIOTICOS_FALLBACK = [
  "Amicacina", "Amoxicilina", "Amoxicilina + Clavulanato", "Ampicilina", "Azitromicina",
  "Cefazolina", "Cefepima", "Ceftriaxona", "Ciprofloxacino", "Claritromicina",
  "Clindamicina", "Doxiciclina", "Eritromicina", "Ertapenem", "Fluconazol",
  "Gentamicina", "Levofloxacino", "Linezolida", "Meropenem", "Metronidazol",
  "Nitrofurantoína", "Oxacilina", "Piperacilina-Tazobactam", "Polimixina",
  "Teicoplanina", "Trimetoprima-Sulfametoxazol", "Vancomicina",
];

const CLASSIF = [
  { id: "sirs", label: "SIRS sem disfunção", hint: "≥ 2 critérios SIRS, sem disfunção orgânica" },
  { id: "sepse", label: "Sepse", hint: "Infecção suspeita + disfunção orgânica" },
  { id: "choque_septico", label: "Choque séptico", hint: "Vasopressor p/ PAM ≥ 65 + lactato > 2" },
];
const CLASSIF_LABEL = {
  sirs: "SIRS", sepse: "Sepse", choque_septico: "Choque séptico", nao_classificado: "Não classificado",
};

const STATUS_META = {
  pendente_atb: { label: "ATB pendente", tone: "red" },
  aguardando_desfecho: { label: "Aguardando desfecho", tone: "amber" },
  encerrado: { label: "Encerrado", tone: "green" },
};

const CLASSIF_FINAL = [
  { id: "sepse_confirmada", label: "Sepse confirmada" },
  { id: "choque_septico", label: "Choque séptico" },
  { id: "infeccao_sem_sepse", label: "Infecção sem sepse" },
  { id: "descartado", label: "Descartado" },
];
const CLASSIF_FINAL_LABEL = Object.fromEntries(CLASSIF_FINAL.map((c) => [c.id, c.label]));

const DESTINOS = [
  { id: "alta", label: "Alta" },
  { id: "enfermaria", label: "Enfermaria" },
  { id: "uti", label: "UTI" },
  { id: "obito", label: "Óbito" },
  { id: "transferencia", label: "Transferência" },
];
const DESTINO_LABEL = Object.fromEntries(DESTINOS.map((d) => [d.id, d.label]));

const META_MIN = 60; // meta institucional: antibiótico em até 60 minutos

/* ---------------------------------------------------------------------- */
/*  Paleta / estilo                                                       */
/* ---------------------------------------------------------------------- */
const C = {
  bg: "#f4f7f8",
  panel: "#ffffff",
  ink: "#0f2a33",
  inkSoft: "#4c6570",
  line: "#dbe6e8",
  teal: "#0e6b6b",
  tealDark: "#0a4f4f",
  tealBg: "#e3f1f1",
  amber: "#c9741b",
  amberBg: "#fbeee0",
  red: "#b3392c",
  redBg: "#fdecea",
  greenBg: "#eaf6ee",
  green: "#1f7a4c",
};

function GlobalStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { margin: 0; }
      button, input, select { font-family: inherit; }
      :focus-visible { outline: 2px solid ${C.teal}; outline-offset: 2px; border-radius: 4px; }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes popIn { 0% { transform: scale(.5); opacity: 0; } 70% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
      @keyframes drawCheck { to { stroke-dashoffset: 0; } }
      @keyframes pulseRed { 0%,100% { box-shadow: 0 0 0 0 rgba(179,57,44,.30); } 50% { box-shadow: 0 0 0 12px rgba(179,57,44,0); } }
      @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
      .anim-card { animation: fadeInUp .25s ease both; }
      .modal-overlay { animation: overlayIn .15s ease both; }
      .modal-card { animation: fadeInUp .2s ease both; }
      .pulse-red { animation: pulseRed 1.6s ease-in-out infinite; }
      .skel { background: linear-gradient(90deg, #eef3f4 25%, #e2ebec 37%, #eef3f4 63%); background-size: 400px 100%; animation: shimmer 1.3s linear infinite; border-radius: 8px; }
      button.btn-primary:hover:not(:disabled) { filter: brightness(1.12); }
      button.btn-secondary:hover:not(:disabled) { background: ${C.tealBg}; }
      button.chip:hover { border-color: ${C.teal}; }
      button:disabled { opacity: .6; cursor: not-allowed; }
      tr.rowh { transition: background .12s; }
      tr.rowh:hover { background: #f6fafa; }
      .crit-card { transition: border-color .12s, background .12s, transform .08s; }
      .crit-card:hover { border-color: ${C.teal}; }
      .crit-card:active { transform: scale(.985); }
    `}</style>
  );
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/* Delta em minutos entre abertura e administração do ATB (vira o dia se preciso) */
function portaAtbMin(horaAbertura, horaAtb) {
  if (!horaAbertura || !horaAtb) return null;
  const [h1, m1] = horaAbertura.split(":").map(Number);
  const [h2, m2] = horaAtb.split(":").map(Number);
  let delta = h2 * 60 + m2 - (h1 * 60 + m1);
  if (delta < 0) delta += 1440;
  return delta;
}
function fmtMin(min) {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------------- */
/*  Componentes utilitários                                                */
/* ---------------------------------------------------------------------- */

function Badge({ children, tone = "teal" }) {
  const tones = {
    teal: { bg: C.tealBg, fg: C.tealDark },
    red: { bg: C.redBg, fg: C.red },
    green: { bg: C.greenBg, fg: C.green },
    amber: { bg: C.amberBg, fg: C.amber },
    gray: { bg: "#eef1f2", fg: C.inkSoft },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        background: t.bg, color: t.fg, fontSize: 12, fontWeight: 700,
        padding: "3px 9px", borderRadius: 999, letterSpacing: 0.2, whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Card({ children, style, className }) {
  return (
    <div
      className={className}
      style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: "20px", boxShadow: "0 1px 3px rgba(15,42,51,0.06), 0 4px 14px rgba(15,42,51,0.04)", ...style,
      }}
    >
      {children}
    </div>
  );
}

function Skeleton({ h = 16, w = "100%", style }) {
  return <div className="skel" style={{ height: h, width: w, ...style }} />;
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div style={{ padding: "36px 20px", textAlign: "center", color: C.inkSoft }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: C.line }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12.5, marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Tela de login                                                          */
/* ---------------------------------------------------------------------- */

function LoginScreen({ needsBootstrap, onAuthenticated }) {
  const [crm, setCrm] = useState("");
  const [senha, setSenha] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [novaSenha, setNovaSenha] = useState("");
  const [novaSenha2, setNovaSenha2] = useState("");

  async function handleBootstrap(e) {
    e.preventDefault();
    setError("");
    if (novaSenha.length < 6) return setError("A senha precisa ter ao menos 6 caracteres.");
    if (novaSenha !== novaSenha2) return setError("As senhas não coincidem.");
    setBusy(true);
    try {
      const { token, user } = await api.bootstrap(novaSenha);
      setToken(token);
      onAuthenticated(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { token, user } = await api.login(crm.trim(), senha);
      setToken(token);
      onAuthenticated(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${C.tealDark}, #123840 55%, ${C.ink})`, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 400 }} className="anim-card">
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Activity color="#fff" size={28} />
          </div>
          <h1 style={{ color: "#fff", fontSize: 21, fontWeight: 800, margin: 0, letterSpacing: 0.2 }}>Protocolo Sepse</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: "4px 0 0" }}>Hospital Cardio Pulmonar · Rede D'Or São Luiz</p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, background: "rgba(255,255,255,0.1)", color: "#cde7e2", fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999 }}>
            <Timer size={13} /> Meta institucional: antibiótico em até 1 hora
          </div>
        </div>

        <Card style={{ background: "rgba(255,255,255,0.98)" }}>
          {needsBootstrap ? (
            <form onSubmit={handleBootstrap}>
              <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 0, marginBottom: 16, lineHeight: 1.5 }}>
                Primeiro acesso. Defina a senha do usuário master para começar.
              </p>
              <label style={labelStyle}>Nova senha</label>
              <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} style={inputStyle} placeholder="Mínimo 6 caracteres" />
              <label style={labelStyle}>Confirmar senha</label>
              <input type="password" value={novaSenha2} onChange={(e) => setNovaSenha2(e.target.value)} style={inputStyle} />
              {error && <ErrorLine text={error} />}
              <button type="submit" disabled={busy} className="btn-primary" style={primaryBtn}>{busy ? "Criando..." : "Criar acesso master"}</button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <label style={labelStyle}>CRM ou e-mail</label>
              <input value={crm} onChange={(e) => setCrm(e.target.value)} style={inputStyle} placeholder="Ex: 32.394 ou nome@hospital.com" autoComplete="username" autoFocus />
              <label style={labelStyle}>Senha</label>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} style={{ ...inputStyle, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Ocultar senha" : "Mostrar senha"} style={{ position: "absolute", right: 10, top: 9, background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && <ErrorLine text={error} />}
              <button type="submit" disabled={busy} className="btn-primary" style={primaryBtn}>{busy ? "Entrando..." : "Entrar"}</button>
              <p style={{ fontSize: 12, color: C.inkSoft, textAlign: "center", marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Lock size={13} /> Acesso restrito a médicos cadastrados pelo administrador
              </p>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

function ErrorLine({ text }) {
  return (
    <div style={{ background: C.redBg, color: C.red, fontSize: 13, padding: "8px 12px", borderRadius: 8, margin: "10px 0", display: "flex", gap: 6, alignItems: "center" }}>
      <AlertTriangle size={14} /> {text}
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: C.inkSoft, marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.4 };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 9, border: `1.5px solid ${C.line}`, fontSize: 14, outline: "none", fontFamily: "inherit", color: C.ink };
const primaryBtn = { width: "100%", marginTop: 20, padding: "11px 0", background: C.teal, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "filter .12s" };
const secondaryBtn = { padding: "9px 16px", background: "#fff", color: C.teal, border: `1.5px solid ${C.teal}`, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, transition: "background .12s" };

/* ---------------------------------------------------------------------- */
/*  Cronômetro da meta de 1 hora                                           */
/* ---------------------------------------------------------------------- */

function MetaTimer({ dataAtendimento, horaAtendimento, horaAntibiotico }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // ATB já administrado: mostra o resultado consolidado
  if (horaAntibiotico) {
    const delta = portaAtbMin(horaAtendimento, horaAntibiotico);
    const ok = delta <= META_MIN;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 14,
        background: ok ? C.greenBg : C.redBg, border: `1.5px solid ${ok ? "#bfe3cc" : "#f3c4bd"}`,
      }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: ok ? C.green : C.red, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {ok ? <Check color="#fff" size={24} strokeWidth={3} /> : <AlertTriangle color="#fff" size={22} />}
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: ok ? C.green : C.red }}>
            Porta-antibiótico: {fmtMin(delta)} — {ok ? "dentro da meta" : "fora da meta"}
          </div>
          <div style={{ fontSize: 12.5, color: C.inkSoft }}>
            Abertura {horaAtendimento} · Administração {horaAntibiotico} · Meta institucional: {META_MIN} min
          </div>
        </div>
      </div>
    );
  }

  const abertura = new Date(`${dataAtendimento}T${horaAtendimento || "00:00"}:00`);
  const elapsedSec = Math.max(0, Math.floor((Date.now() - abertura.getTime()) / 1000));
  const remainingSec = META_MIN * 60 - elapsedSec;
  const over = remainingSec < 0;
  const shown = Math.abs(remainingSec);
  const mm = String(Math.floor(shown / 60)).padStart(2, "0");
  const ss = String(shown % 60).padStart(2, "0");
  const frac = Math.min(1, elapsedSec / (META_MIN * 60));

  const tone = over || remainingSec <= 10 * 60 ? "red" : remainingSec <= 30 * 60 ? "amber" : "green";
  const toneColor = { green: C.green, amber: C.amber, red: C.red }[tone];
  const toneBg = { green: C.greenBg, amber: C.amberBg, red: C.redBg }[tone];

  // anel de progresso
  const R = 24, CIRC = 2 * Math.PI * R;

  return (
    <div className={tone === "red" ? "pulse-red" : ""} style={{
      display: "flex", alignItems: "center", gap: 16, padding: "14px 18px", borderRadius: 14,
      background: toneBg, border: `1.5px solid ${toneColor}33`,
    }}>
      <svg width="58" height="58" viewBox="0 0 58 58" style={{ flexShrink: 0 }}>
        <circle cx="29" cy="29" r={R} fill="none" stroke="#ffffff" strokeWidth="6" />
        <circle
          cx="29" cy="29" r={R} fill="none" stroke={toneColor} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - frac)}
          transform="rotate(-90 29 29)" style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }}
        />
        <g transform="translate(29 29)"><Timer size={18} x={-9} y={-9} color={toneColor} /></g>
      </svg>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Meta: antibiótico em até 1 hora
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, color: toneColor, fontVariantNumeric: "tabular-nums", lineHeight: 1.15 }}>
          {over ? `+${mm}:${ss} além da meta` : `${mm}:${ss} restantes`}
        </div>
        <div style={{ fontSize: 12, color: C.inkSoft }}>
          Contando desde a abertura ({horaAtendimento}). Registre a hora da administração ao infundir o ATB.
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Nova ficha de atendimento                                              */
/* ---------------------------------------------------------------------- */

function emptyFicha() {
  return {
    dataAtendimento: todayISO(),
    horaAtendimento: nowHM(),
    nomePaciente: "",
    numeroAtendimento: "",
    sirs: {},
    focoInfeccao: [],
    antibioticos: [],
    horaPrescricao: "",
    horaAntibiotico: "",
    classificacao: null,
  };
}

/* Gate: confirma a hora REAL de abertura antes de liberar o formulário —
   quem digita geralmente o faz minutos depois da abertura, e o cronômetro
   só é fidedigno contando do horário confirmado. */
function AberturaGate({ onConfirm }) {
  const [data, setData] = useState(todayISO());
  const [hora, setHora] = useState(nowHM());
  return (
    <Card className="anim-card pulse-red" style={{ maxWidth: 560, margin: "24px auto", border: `2px solid ${C.red}`, padding: 28 }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <div style={{ width: 62, height: 62, borderRadius: 999, background: C.redBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Timer size={30} color={C.red} />
        </div>
      </div>
      <h2 style={{ margin: "0 0 6px", textAlign: "center", fontSize: 19, fontWeight: 800, color: C.ink }}>
        Qual foi a hora real da abertura da ficha?
      </h2>
      <p style={{ margin: "0 0 18px", textAlign: "center", fontSize: 13.5, color: C.inkSoft, lineHeight: 1.55 }}>
        A meta de <strong style={{ color: C.red }}>antibiótico em até 1 hora</strong> conta a partir da abertura do protocolo
        à beira-leito — <strong>não</strong> da hora em que você está digitando. Confirme o horário para iniciar o cronômetro
        com dado fidedigno.
      </p>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Data da abertura</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inputStyle, fontSize: 16 }} />
        </div>
        <div>
          <label style={{ ...labelStyle, marginTop: 0 }}>Hora da abertura</label>
          <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={{ ...inputStyle, fontSize: 20, fontWeight: 700, color: C.red }} autoFocus />
        </div>
      </div>
      <button
        type="button" className="btn-primary"
        onClick={() => data && hora && onConfirm({ data, hora })}
        style={{ ...primaryBtn, background: C.red, marginTop: 22, fontSize: 15, padding: "13px 0" }}
      >
        Confirmar abertura e iniciar cronômetro
      </button>
    </Card>
  );
}

function NovaFichaTab({ user, catalogos, onSaved }) {
  const [f, setF] = useState(() => emptyFicha());
  const [aberturaOk, setAberturaOk] = useState(false);
  const [savedFicha, setSavedFicha] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const criterios = catalogos.criterios;
  const sirsClassicos = criterios.filter((c) => c.categoria === "sirs");
  const disfuncoes = criterios.filter((c) => c.categoria === "disfuncao");
  const sirsCount = sirsClassicos.filter((c) => f.sirs[c.id]).length;
  const disfCount = disfuncoes.filter((c) => f.sirs[c.id]).length;
  const criteriaCount = sirsCount + disfCount;
  const protocoloAtivado = sirsCount >= 2;

  const sugestao = sirsCount >= 2 && disfCount >= 1 ? "sepse" : sirsCount >= 2 ? "sirs" : null;

  function toggleSirs(id) {
    setF((p) => ({ ...p, sirs: { ...p.sirs, [id]: !p.sirs[id] } }));
  }
  function toggleFoco(v) {
    setF((p) => ({ ...p, focoInfeccao: p.focoInfeccao.includes(v) ? p.focoInfeccao.filter((x) => x !== v) : [...p.focoInfeccao, v] }));
  }
  function toggleAntibiotico(v) {
    setF((p) => ({ ...p, antibioticos: p.antibioticos.includes(v) ? p.antibioticos.filter((x) => x !== v) : [...p.antibioticos, v] }));
  }

  function validate() {
    const e = {};
    if (!f.nomePaciente.trim()) e.nomePaciente = "Informe o nome do paciente.";
    if (!f.numeroAtendimento.trim()) e.numeroAtendimento = "Informe o número do atendimento.";
    if (!f.dataAtendimento) e.dataAtendimento = "Informe a data.";
    if (!f.horaAtendimento) e.horaAtendimento = "Informe a hora.";
    if (f.horaAntibiotico && !f.antibioticos.length) e.horaAntibiotico = "Selecione o(s) antibiótico(s) administrado(s).";
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector("[data-field-error]")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    }
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setBusy(true);
    try {
      await api.createFicha(f);
      setSavedFicha({
        nome: f.nomePaciente.trim(),
        criterios: criteriaCount,
        antibioticos: f.antibioticos,
        portaMin: portaAtbMin(f.horaAtendimento, f.horaAntibiotico),
        classificacao: f.classificacao,
        pendente: !f.horaAntibiotico,
      });
      setF(emptyFicha());
      setAberturaOk(false);
      setErrors({});
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!aberturaOk) {
    return (
      <>
        <AberturaGate onConfirm={({ data, hora }) => { setF((p) => ({ ...p, dataAtendimento: data, horaAtendimento: hora })); setAberturaOk(true); }} />
        {savedFicha && <SavedOverlay ficha={savedFicha} onClose={() => setSavedFicha(null)} />}
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 880 }}>
      {error && <ErrorLine text={error} />}

      <MetaTimer dataAtendimento={f.dataAtendimento} horaAtendimento={f.horaAtendimento} horaAntibiotico={f.horaAntibiotico} />

      <Card className="anim-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <SectionTitle icon={<ClipboardList size={16} />} title="Dados do atendimento" />
          <button type="button" onClick={() => setAberturaOk(false)} style={{ background: "none", border: "none", color: C.teal, fontSize: 12.5, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>
            Corrigir hora de abertura
          </button>
        </div>
        <div style={grid2}>
          <Field label="Abertura confirmada">
            <div style={{ ...inputStyle, background: "#f6fafa", display: "flex", alignItems: "center", gap: 8, fontWeight: 700, color: C.tealDark }}>
              <Timer size={15} /> {f.dataAtendimento.split("-").reverse().join("/")} às {f.horaAtendimento}
            </div>
          </Field>
          <Field label="Nome do paciente" error={errors.nomePaciente}>
            <input value={f.nomePaciente} onChange={(e) => setF({ ...f, nomePaciente: e.target.value })} style={fieldInput(errors.nomePaciente)} placeholder="Nome completo" />
          </Field>
          <Field label="Número do atendimento" error={errors.numeroAtendimento}>
            <input value={f.numeroAtendimento} onChange={(e) => setF({ ...f, numeroAtendimento: e.target.value })} style={fieldInput(errors.numeroAtendimento)} placeholder="Ex: 2026001234" />
          </Field>
        </div>
        <div style={{ marginTop: 14, fontSize: 12.5, color: C.inkSoft }}>
          Médico responsável: <strong style={{ color: C.ink }}>{user.name}</strong> · CRM {user.crm}
        </div>
      </Card>

      <Card className="anim-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <SectionTitle icon={<Stethoscope size={16} />} title="Critérios do protocolo" />
          <Badge tone={criteriaCount >= 2 ? "red" : criteriaCount === 1 ? "amber" : "teal"}>{criteriaCount} critério(s) marcado(s)</Badge>
        </div>

        <CriterioGroup title="SIRS" subtitle="Síndrome da resposta inflamatória sistêmica" items={sirsClassicos} sirs={f.sirs} onToggle={toggleSirs} />
        {protocoloAtivado && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.redBg, color: C.red, fontSize: 13, fontWeight: 700, padding: "10px 14px", borderRadius: 10, margin: "12px 0 2px" }} className="anim-card">
            <AlertTriangle size={16} /> ≥ 2 critérios SIRS — protocolo ativado, meta de 1 hora em contagem.
          </div>
        )}
        <CriterioGroup title="Disfunção orgânica" subtitle="SIRS + ≥ 1 disfunção caracteriza sepse" items={disfuncoes} sirs={f.sirs} onToggle={toggleSirs} />
      </Card>

      <Card className="anim-card">
        <SectionTitle icon={<HeartPulse size={16} />} title="Classificação do caso" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px,1fr))", gap: 10 }}>
          {CLASSIF.map((c) => {
            const on = f.classificacao === c.id;
            return (
              <button
                key={c.id} type="button" className="crit-card"
                onClick={() => setF({ ...f, classificacao: on ? null : c.id })}
                style={{
                  textAlign: "left", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
                  border: `1.5px solid ${on ? C.teal : C.line}`, background: on ? C.tealBg : "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: 13.5, color: on ? C.tealDark : C.ink }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    border: `2px solid ${on ? C.teal : C.line}`, background: on ? C.teal : "#fff",
                  }}>
                    {on && <Check size={11} color="#fff" strokeWidth={3.5} />}
                  </span>
                  {c.label}
                </div>
                <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 4, lineHeight: 1.4 }}>{c.hint}</div>
              </button>
            );
          })}
        </div>
        {sugestao && !f.classificacao && (
          <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 10 }}>
            Sugestão pelos critérios marcados: <strong style={{ color: C.tealDark }}>{CLASSIF_LABEL[sugestao]}</strong>
          </div>
        )}
      </Card>

      <Card className="anim-card">
        <SectionTitle icon={<Activity size={16} />} title="Foco de infecção identificado ou presumido" />
        <ChipGroup options={catalogos.focos} selected={f.focoInfeccao} onToggle={toggleFoco} />
      </Card>

      <Card className="anim-card">
        <SectionTitle icon={<ShieldCheck size={16} />} title="Antibióticos prescritos" />
        <ChipGroup options={catalogos.antibioticos} selected={f.antibioticos} onToggle={toggleAntibiotico} />

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px dashed ${C.line}` }}>
          <TemposAtb
            horaAbertura={f.horaAtendimento}
            horaPrescricao={f.horaPrescricao}
            horaAntibiotico={f.horaAntibiotico}
            error={errors.horaAntibiotico}
            onChange={(patch) => setF({ ...f, ...patch })}
          />
          <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 6 }}>
            Se o antibiótico ainda não foi prescrito/administrado, deixe em branco — o caso ficará
            <strong> em acompanhamento</strong> e os horários podem ser lançados depois.
          </div>
        </div>
      </Card>

      <button type="submit" disabled={busy} className="btn-primary" style={{ ...primaryBtn, width: "auto", padding: "12px 28px", display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
        <Plus size={17} /> {busy ? "Registrando..." : "Registrar ficha"}
      </button>

      {savedFicha && <SavedOverlay ficha={savedFicha} onClose={() => setSavedFicha(null)} />}
    </form>
  );
}

function CriterioGroup({ title, subtitle, items, sirs, onToggle }) {
  const count = items.filter((it) => sirs[it.id]).length;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: C.tealDark, textTransform: "uppercase", letterSpacing: 0.4 }}>{title}</span>
        <span style={{ fontSize: 11.5, color: C.inkSoft }}>{subtitle}</span>
        <span style={{ marginLeft: "auto" }}><Badge tone={count ? "teal" : "gray"}>{count}/{items.length}</Badge></span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 8 }}>
        {items.map((it) => {
          const on = !!sirs[it.id];
          return (
            <button
              key={it.id} type="button" className="crit-card"
              onClick={() => onToggle(it.id)}
              style={{
                display: "flex", gap: 10, alignItems: "flex-start", textAlign: "left",
                fontSize: 13, lineHeight: 1.4, padding: "11px 12px", borderRadius: 10, cursor: "pointer",
                border: `1.5px solid ${on ? C.teal : C.line}`,
                background: on ? C.tealBg : "#fff", color: C.ink, fontWeight: on ? 600 : 400,
              }}
            >
              <span style={{
                width: 18, height: 18, borderRadius: 999, flexShrink: 0, marginTop: 1,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${on ? C.teal : C.line}`, background: on ? C.teal : "#fff",
                transition: "all .12s",
              }}>
                {on && <Check size={12} color="#fff" strokeWidth={3.5} />}
              </span>
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Prescrição e administração do ATB, lado a lado, com botão "Agora" e delta ao vivo */
function TemposAtb({ horaAbertura, horaPrescricao, horaAntibiotico, error, onChange }) {
  const delta = portaAtbMin(horaAbertura, horaAntibiotico);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 18, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div style={{ minWidth: 170 }}>
          <Field label="Hora da prescrição">
            <input type="time" value={horaPrescricao} onChange={(e) => onChange({ horaPrescricao: e.target.value })} style={inputStyle} />
          </Field>
        </div>
        <button type="button" className="btn-secondary" style={{ ...secondaryBtn, marginBottom: 1 }} onClick={() => onChange({ horaPrescricao: nowHM() })}>
          Agora
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
        <div style={{ minWidth: 170 }}>
          <Field label="Hora da administração" error={error}>
            <input type="time" value={horaAntibiotico} onChange={(e) => onChange({ horaAntibiotico: e.target.value })} style={fieldInput(error)} />
          </Field>
        </div>
        <button type="button" className="btn-secondary" style={{ ...secondaryBtn, marginBottom: error ? 22 : 1 }} onClick={() => onChange({ horaAntibiotico: nowHM() })}>
          <Syringe size={15} /> Agora
        </button>
      </div>
      {delta != null && (
        <div style={{ marginBottom: 4 }}>
          <Badge tone={delta <= META_MIN ? "green" : "red"}>Porta-antibiótico: {fmtMin(delta)} {delta <= META_MIN ? "· dentro da meta" : "· fora da meta"}</Badge>
        </div>
      )}
    </div>
  );
}

function SavedOverlay({ ficha, onClose }) {
  const ok = ficha.portaMin != null && ficha.portaMin <= META_MIN;
  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,42,51,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 420, width: "100%", padding: 28, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 999, background: C.greenBg, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", animation: "popIn .35s ease both" }}>
          <svg width="40" height="40" viewBox="0 0 40 40">
            <path d="M9 21 L17 29 L31 12" fill="none" stroke={C.green} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray="40" strokeDashoffset="40" style={{ animation: "drawCheck .5s .2s ease forwards" }} />
          </svg>
        </div>
        <h3 style={{ margin: "0 0 6px", color: C.ink, fontSize: 18, fontWeight: 800 }}>Ficha registrada</h3>
        <div style={{ fontSize: 13.5, color: C.inkSoft, lineHeight: 1.6 }}>
          <strong style={{ color: C.ink }}>{ficha.nome}</strong>
          {ficha.classificacao && <> · {CLASSIF_LABEL[ficha.classificacao]}</>}
          <> · {ficha.criterios} critério(s)</>
          {ficha.antibioticos.length > 0 && <><br />{ficha.antibioticos.join(", ")}</>}
        </div>
        {ficha.portaMin != null && (
          <div style={{ marginTop: 12 }}>
            <Badge tone={ok ? "green" : "red"}>Porta-antibiótico: {fmtMin(ficha.portaMin)} {ok ? "· dentro da meta" : "· fora da meta"}</Badge>
          </div>
        )}
        {ficha.pendente && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: C.amber, background: C.amberBg, borderRadius: 9, padding: "8px 12px", fontWeight: 600 }}>
            Antibiótico ainda não administrado — o caso entrou na fila de <strong>Acompanhamento</strong> para lançamento dos horários e do desfecho.
          </div>
        )}
        <button onClick={onClose} className="btn-primary" style={{ ...primaryBtn, marginTop: 20 }}>Nova ficha</button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, color: C.tealDark, fontWeight: 800, fontSize: 14.5 }}>
      {icon} {title}
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div data-field-error={error ? "" : undefined}>
      <label style={{ ...labelStyle, marginTop: 0 }}>{label}</label>
      {children}
      {error && <div style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
function fieldInput(error) {
  return error ? { ...inputStyle, borderColor: C.red } : inputStyle;
}

function ChipGroup({ options, selected, onToggle }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => {
        const on = selected.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            className="chip"
            onClick={() => onToggle(opt)}
            style={{
              padding: "7px 13px", borderRadius: 999, fontSize: 13, cursor: "pointer",
              border: `1.5px solid ${on ? C.teal : C.line}`,
              background: on ? C.teal : "#fff", color: on ? "#fff" : C.ink, fontWeight: on ? 700 : 500,
              transition: "all .12s",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

const grid2 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 14 };

/* ---------------------------------------------------------------------- */
/*  Acompanhamento — fila de casos por status                              */
/* ---------------------------------------------------------------------- */

const STATUS_COLOR = { pendente_atb: C.red, aguardando_desfecho: C.amber, encerrado: C.green };

const ACOMP_FILTERS = [
  { id: "aberto", label: "Casos abertos" },
  { id: "pendente_atb", label: "ATB pendente" },
  { id: "aguardando_desfecho", label: "Aguardando desfecho" },
  { id: "encerrado", label: "Encerrados" },
  { id: "", label: "Todos" },
];

function tempoAberto(f) {
  const abertura = new Date(`${f.data_atendimento}T${(f.hora_atendimento || "00:00").slice(0, 5)}:00`);
  const min = Math.max(0, Math.floor((Date.now() - abertura.getTime()) / 60000));
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.floor(min / 60)}h`;
  return `${Math.floor(min / 1440)} dias`;
}

function AcompanhamentoTab({ refreshKey, onNovaFicha }) {
  const [statusFilter, setStatusFilter] = useState("aberto");
  const [page, setPage] = useState(1);
  const perPage = 8;
  const [result, setResult] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(null);
  const [bump, setBump] = useState(0);

  useEffect(() => setPage(1), [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    const params = { page, perPage };
    if (statusFilter) params.status = statusFilter;
    api.listFichas(params)
      .then((r) => !cancelled && setResult(r))
      .catch(() => {
        if (!cancelled) { setResult({ total: 0, items: [] }); setLoadError(true); }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [statusFilter, page, refreshKey, bump]);

  const totalPages = Math.max(1, Math.ceil(result.total / perPage));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card className="anim-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <SectionTitle icon={<HeartPulse size={16} />} title="Pacientes em acompanhamento" />
          <span style={{ fontSize: 12.5, color: C.inkSoft }}>{result.total} caso(s)</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ACOMP_FILTERS.map((s) => {
            const on = statusFilter === s.id;
            const dot = STATUS_COLOR[s.id];
            return (
              <button key={s.id} type="button" className="chip" onClick={() => setStatusFilter(s.id)}
                style={{
                  padding: "7px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                  display: "inline-flex", alignItems: "center", gap: 7,
                  border: `1.5px solid ${on ? C.teal : C.line}`, background: on ? C.tealBg : "#fff", color: C.tealDark,
                }}>
                {dot && <span style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />}
                {s.label}
              </button>
            );
          })}
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading && [...Array(4)].map((_, i) => <Card key={i}><Skeleton h={54} /></Card>)}
        {!loading && loadError && (
          <Card><EmptyState icon={<AlertTriangle size={44} />} title="Não foi possível carregar os casos" subtitle="Verifique a conexão e tente novamente." /></Card>
        )}
        {!loading && !loadError && !result.items.length && (
          <Card>
            <EmptyState icon={<CheckCircle2 size={44} />} title={statusFilter === "pendente_atb" ? "Nenhum paciente aguardando antibiótico" : "Nenhum caso neste filtro"} subtitle="Bom sinal — a fila está em dia." />
            {onNovaFicha && (
              <div style={{ textAlign: "center", paddingBottom: 10 }}>
                <button type="button" onClick={onNovaFicha} className="btn-secondary" style={secondaryBtn}><Plus size={15} /> Abrir novo protocolo</button>
              </div>
            )}
          </Card>
        )}
        {!loading && result.items.map((f) => {
          const st = STATUS_META[f.status] || { label: f.status, tone: "gray" };
          const cor = STATUS_COLOR[f.status] || C.inkSoft;
          return (
            <Card key={f.id} className="anim-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderLeft: `5px solid ${cor}`, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14.5, color: C.ink }}>{f.paciente_nome}</div>
                  <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>
                    Nº {f.numero_atendimento} · aberto em {f.data_atendimento?.split("-").reverse().join("/")} às {f.hora_atendimento?.slice(0, 5)} · {f.medico_nome}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                  <Badge tone={st.tone}>{st.label}</Badge>
                  {f.status === "pendente_atb" && <Badge tone="red">aberto há {tempoAberto(f)}</Badge>}
                  {f.classificacao && <Badge tone="gray">{CLASSIF_LABEL[f.classificacao]}</Badge>}
                  {f.porta_atb_min != null && <PortaAtbBadge min={f.porta_atb_min} />}
                  {f.classificacao_final && <Badge tone="teal">{CLASSIF_FINAL_LABEL[f.classificacao_final]}</Badge>}
                  {f.destino && <Badge tone={f.destino === "obito" ? "red" : "gray"}>{DESTINO_LABEL[f.destino]}</Badge>}
                </div>
                <button onClick={() => setEditing(f.id)} className={f.status === "encerrado" ? "btn-secondary" : "btn-primary"}
                  style={f.status === "encerrado"
                    ? { ...secondaryBtn, padding: "7px 14px", fontSize: 12.5 }
                    : { ...primaryBtn, width: "auto", marginTop: 0, padding: "8px 16px", fontSize: 12.5 }}>
                  {f.status === "encerrado" ? "Revisar" : "Lançar dados"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {result.total > perPage && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn} aria-label="Página anterior"><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 13, color: C.inkSoft }}>Página {page} de {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn} aria-label="Próxima página"><ChevronRight size={16} /></button>
        </div>
      )}

      {editing && (
        <LancamentoModal
          fichaId={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setBump((b) => b + 1); }}
        />
      )}
    </div>
  );
}

/* Modal de lançamento posterior: tempos do ATB, classificação e desfecho */
function LancamentoModal({ fichaId, onClose, onSaved }) {
  const [ficha, setFicha] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.fichaDetail(fichaId).then((d) => {
      setFicha(d);
      setForm({
        horaPrescricao: d.hora_prescricao_atb?.slice(0, 5) || "",
        horaAntibiotico: d.hora_administracao_atb?.slice(0, 5) || "",
        classificacao: d.classificacao || null,
        classificacaoFinal: d.classificacao_final || null,
        destino: d.destino || null,
        indicacaoAdequada: d.indicacao_adequada,
        focoConfirmado: d.foco_confirmado,
        culturasColhidas: d.culturas_colhidas,
        culturaPositiva: d.cultura_positiva,
        dataDesfecho: d.data_desfecho || "",
      });
    }).catch(() => setError("Não foi possível carregar a ficha."));
  }, [fichaId]);

  const desfechoCompleto = form?.classificacaoFinal && form?.destino;
  const desfechoParcial = form && !desfechoCompleto && (form.classificacaoFinal || form.destino);

  async function handleSave() {
    setError("");
    if (desfechoParcial) {
      setError("Para encerrar o caso, selecione a classificação final E o destino — ou limpe ambos para salvar só os horários.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        horaPrescricao: form.horaPrescricao || null,
        horaAntibiotico: form.horaAntibiotico || null,
        classificacao: form.classificacao,
      };
      if (desfechoCompleto) {
        payload.desfecho = {
          classificacaoFinal: form.classificacaoFinal,
          destino: form.destino,
          indicacaoAdequada: form.indicacaoAdequada,
          focoConfirmado: form.focoConfirmado,
          culturasColhidas: form.culturasColhidas,
          culturaPositiva: form.culturaPositiva,
          dataDesfecho: form.dataDesfecho || null,
        };
      }
      await api.updateFicha(fichaId, payload);
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,42,51,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 620, width: "100%", maxHeight: "88vh", overflowY: "auto", padding: 24 }}>
        {!ficha || !form ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton h={22} w="55%" /><Skeleton h={70} /><Skeleton h={90} /><Skeleton h={70} />
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <h3 style={{ margin: 0, color: C.ink }}>{ficha.paciente_nome}</h3>
                <div style={{ fontSize: 13, color: C.inkSoft }}>
                  Nº {ficha.numero_atendimento} · aberto em {ficha.data_atendimento?.split("-").reverse().join("/")} às {ficha.hora_atendimento?.slice(0, 5)}
                </div>
              </div>
              <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><X size={20} /></button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <Badge tone={(STATUS_META[ficha.status] || {}).tone || "gray"}>{(STATUS_META[ficha.status] || {}).label || ficha.status}</Badge>
            </div>

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
              <SectionTitle icon={<Syringe size={16} />} title="Tempos do antibiótico" />
              <TemposAtb
                horaAbertura={ficha.hora_atendimento?.slice(0, 5)}
                horaPrescricao={form.horaPrescricao}
                horaAntibiotico={form.horaAntibiotico}
                onChange={(patch) => setForm({ ...form, ...patch })}
              />
            </div>

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, marginTop: 16 }}>
              <SectionTitle icon={<HeartPulse size={16} />} title="Classificação na abertura" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {CLASSIF.map((c) => {
                  const on = form.classificacao === c.id;
                  return (
                    <button key={c.id} type="button" className="chip" onClick={() => setForm({ ...form, classificacao: on ? null : c.id })}
                      style={{ padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${on ? C.teal : C.line}`, background: on ? C.teal : "#fff", color: on ? "#fff" : C.ink }}>
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14, marginTop: 16 }}>
              <SectionTitle icon={<CheckCircle2 size={16} />} title="Desfecho e revisão do caso" />
              <Field label="Classificação final (era mesmo sepse?)">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {CLASSIF_FINAL.map((c) => {
                    const on = form.classificacaoFinal === c.id;
                    return (
                      <button key={c.id} type="button" className="chip" onClick={() => setForm({ ...form, classificacaoFinal: on ? null : c.id })}
                        style={{ padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${on ? C.teal : C.line}`, background: on ? C.teal : "#fff", color: on ? "#fff" : C.ink }}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <div style={{ marginTop: 12 }}>
                <Field label="Destino do paciente">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {DESTINOS.map((d) => {
                      const on = form.destino === d.id;
                      return (
                        <button key={d.id} type="button" className="chip" onClick={() => setForm({ ...form, destino: on ? null : d.id })}
                          style={{ padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${on ? C.teal : C.line}`, background: on ? C.teal : "#fff", color: on ? "#fff" : C.ink }}>
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 10, marginTop: 14 }}>
                <SimNao label="Indicação de abertura adequada?" value={form.indicacaoAdequada} onChange={(v) => setForm({ ...form, indicacaoAdequada: v })} />
                <SimNao label="Foco de infecção confirmado?" value={form.focoConfirmado} onChange={(v) => setForm({ ...form, focoConfirmado: v })} />
                <SimNao label="Culturas colhidas?" value={form.culturasColhidas} onChange={(v) => setForm({ ...form, culturasColhidas: v })} />
                <SimNao label="Cultura positiva?" value={form.culturaPositiva} onChange={(v) => setForm({ ...form, culturaPositiva: v })} />
              </div>
              <div style={{ marginTop: 14, maxWidth: 220 }}>
                <Field label="Data do desfecho">
                  <input type="date" value={form.dataDesfecho} onChange={(e) => setForm({ ...form, dataDesfecho: e.target.value })} style={inputStyle} />
                </Field>
              </div>
            </div>

            {error && <ErrorLine text={error} />}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={onClose} className="btn-secondary" style={{ ...secondaryBtn, flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button onClick={handleSave} disabled={busy} className="btn-primary" style={{ ...primaryBtn, flex: 2, marginTop: 0 }}>
                {busy ? "Salvando..." : desfechoCompleto ? "Salvar e encerrar caso" : "Salvar lançamentos"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SimNao({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 12px" }}>
      <span style={{ fontSize: 12.5, color: C.ink, fontWeight: 600 }}>{label}</span>
      <div style={{ display: "flex", gap: 4 }}>
        {[{ v: true, l: "Sim" }, { v: false, l: "Não" }].map(({ v, l }) => {
          const on = value === v;
          return (
            <button key={l} type="button" onClick={() => onChange(on ? null : v)}
              style={{
                padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: `1.5px solid ${on ? C.teal : C.line}`, background: on ? C.teal : "#fff", color: on ? "#fff" : C.inkSoft,
              }}>
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Histórico de fichas                                                    */
/* ---------------------------------------------------------------------- */

function PortaAtbBadge({ min }) {
  if (min == null) return <span style={{ color: C.inkSoft, fontSize: 12.5 }}>—</span>;
  return <Badge tone={min <= META_MIN ? "green" : "red"}>{fmtMin(min)}</Badge>;
}

function HistoricoTab({ refreshKey, onNovaFicha }) {
  const [nome, setNome] = useState("");
  const [numero, setNumero] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [result, setResult] = useState({ total: 0, items: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(() => {
    const p = {};
    if (nome) p.nome = nome;
    if (numero) p.numero = numero;
    if (de) p.de = de;
    if (ate) p.ate = ate;
    return p;
  }, [nome, numero, de, ate]);

  useEffect(() => setPage(1), [nome, numero, de, ate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    api.listFichas({ ...filters, page, perPage })
      .then((r) => !cancelled && setResult(r))
      .catch(() => {
        if (!cancelled) { setResult({ total: 0, items: [] }); setLoadError(true); }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [filters, page, refreshKey]);

  const totalPages = Math.max(1, Math.ceil(result.total / perPage));

  async function openDetail(id) {
    setDetailLoading(true);
    try {
      const d = await api.fichaDetail(id);
      setDetail(d);
    } finally {
      setDetailLoading(false);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const res = await api.exportFichas(filters);
      const rows = res.rows || [];
      if (res.truncated) {
        alert(`A exportação foi limitada às ${res.max.toLocaleString("pt-BR")} fichas mais recentes. Refine os filtros (ex.: período) para exportar o restante.`);
      }
      const sheetRows = rows.map((f) => ({
        Data: f.data_atendimento?.split("-").reverse().join("/"),
        Hora: f.hora_atendimento?.slice(0, 5),
        Paciente: f.paciente_nome,
        "Nº Atendimento": f.numero_atendimento,
        Status: STATUS_META[f.status]?.label || "",
        Classificação: f.classificacao ? CLASSIF_LABEL[f.classificacao] : "",
        "Hora prescrição": f.hora_prescricao_atb?.slice(0, 5) || "",
        "Hora administração": f.hora_administracao_atb?.slice(0, 5) || "",
        "Porta-ATB (min)": f.porta_atb_min ?? "",
        "Dentro da meta 1h": f.porta_atb_min == null ? "" : f.porta_atb_min <= META_MIN ? "Sim" : "Não",
        "Classificação final": f.classificacao_final ? CLASSIF_FINAL_LABEL[f.classificacao_final] : "",
        "Indicação adequada": f.indicacao_adequada == null ? "" : f.indicacao_adequada ? "Sim" : "Não",
        "Foco confirmado": f.foco_confirmado == null ? "" : f.foco_confirmado ? "Sim" : "Não",
        "Culturas colhidas": f.culturas_colhidas == null ? "" : f.culturas_colhidas ? "Sim" : "Não",
        "Cultura positiva": f.cultura_positiva == null ? "" : f.cultura_positiva ? "Sim" : "Não",
        Destino: f.destino ? DESTINO_LABEL[f.destino] : "",
        "Data desfecho": f.data_desfecho?.split("-").reverse().join("/") || "",
        "Critérios SIRS/Sepse": f.total_criterios,
        "Detalhe critérios": f.criterios_detalhe || "",
        "Foco de infecção": f.focos || "",
        Antibióticos: f.antibioticos || "",
        Médico: f.medico_nome,
        CRM: f.medico_crm,
        "Registrado em": new Date(f.created_at).toLocaleString("pt-BR"),
      }));
      const ws = XLSX.utils.json_to_sheet(sheetRows);
      ws["!cols"] = [
        { wch: 11 }, { wch: 7 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 15 },
        { wch: 9 }, { wch: 9 }, { wch: 14 }, { wch: 16 },
        { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 13 }, { wch: 12 },
        { wch: 10 }, { wch: 50 }, { wch: 28 }, { wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 19 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Fichas Sepse");
      XLSX.writeFile(wb, `fichas-sepse-${todayISO()}.xlsx`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card className="anim-card">
        <SectionTitle icon={<Search size={16} />} title="Filtros" />
        <div style={grid2}>
          <Field label="Paciente"><input value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} placeholder="Nome do paciente" /></Field>
          <Field label="Nº atendimento"><input value={numero} onChange={(e) => setNumero(e.target.value)} style={inputStyle} placeholder="Número" /></Field>
          <Field label="De"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={inputStyle} /></Field>
          <Field label="Até"><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={inputStyle} /></Field>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 13, color: C.inkSoft }}>{result.total} ficha(s) encontrada(s)</span>
          <button type="button" onClick={exportExcel} className="btn-secondary" style={secondaryBtn} disabled={!result.total || exporting}>
            <Download size={15} /> {exporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
      </Card>

      <Card className="anim-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#eef4f4", textAlign: "left" }}>
                {["Data", "Hora", "Paciente", "Nº Atend.", "Status", "Classificação", "Critérios", "Porta-ATB", "Médico", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontWeight: 700, color: C.tealDark, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && result.items.map((f) => (
                <tr key={f.id} className="rowh" style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={td}>{f.data_atendimento?.split("-").reverse().join("/")}</td>
                  <td style={td}>{f.hora_atendimento?.slice(0, 5)}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{f.paciente_nome}</td>
                  <td style={td}>{f.numero_atendimento}</td>
                  <td style={td}>{STATUS_META[f.status] ? <Badge tone={STATUS_META[f.status].tone}>{STATUS_META[f.status].label}</Badge> : <span style={{ color: C.inkSoft }}>—</span>}</td>
                  <td style={td}>{f.classificacao ? <Badge tone={f.classificacao === "choque_septico" ? "red" : f.classificacao === "sepse" ? "amber" : "teal"}>{CLASSIF_LABEL[f.classificacao]}</Badge> : <span style={{ color: C.inkSoft }}>—</span>}</td>
                  <td style={td}><Badge tone={f.total_criterios >= 2 ? "red" : f.total_criterios === 1 ? "amber" : "teal"}>{f.total_criterios}</Badge></td>
                  <td style={td}><PortaAtbBadge min={f.porta_atb_min} /></td>
                  <td style={td}>{f.medico_nome}</td>
                  <td style={td}>
                    <button onClick={() => openDetail(f.id)} className="btn-secondary" style={{ ...secondaryBtn, padding: "5px 10px", fontSize: 12 }}>Ver</button>
                  </td>
                </tr>
              ))}
              {!loading && loadError && (
                <tr><td colSpan={10}>
                  <EmptyState icon={<AlertTriangle size={44} />} title="Não foi possível carregar as fichas" subtitle="Verifique a conexão e tente novamente." />
                </td></tr>
              )}
              {!loading && !loadError && !result.items.length && (
                <tr><td colSpan={10}>
                  <EmptyState icon={<Inbox size={44} />} title="Nenhuma ficha encontrada" subtitle="Ajuste os filtros ou registre uma nova ficha na aba ao lado." />
                  {onNovaFicha && (
                    <div style={{ textAlign: "center", paddingBottom: 24 }}>
                      <button type="button" onClick={onNovaFicha} className="btn-secondary" style={secondaryBtn}><Plus size={15} /> Registrar primeira ficha</button>
                    </div>
                  )}
                </td></tr>
              )}
              {loading && [...Array(5)].map((_, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                  {[...Array(10)].map((_, j) => <td key={j} style={td}><Skeleton h={14} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.total > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: 14, borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn} aria-label="Página anterior"><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 13, color: C.inkSoft }}>Página {page} de {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn} aria-label="Próxima página"><ChevronRight size={16} /></button>
          </div>
        )}
      </Card>

      {(detail || detailLoading) && <FichaDetailModal f={detail} loading={detailLoading} onClose={() => setDetail(null)} />}
    </div>
  );
}

const td = { padding: "10px 14px", verticalAlign: "middle" };
const pageBtn = { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8, padding: 6, cursor: "pointer" };

function FichaDetailModal({ f, loading, onClose }) {
  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,42,51,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        {loading || !f ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 8 }}>
            <Skeleton h={22} w="60%" /><Skeleton h={14} w="40%" /><Skeleton h={60} /><Skeleton h={40} /><Skeleton h={40} />
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: C.ink }}>{f.paciente_nome}</h3>
                <div style={{ fontSize: 13, color: C.inkSoft }}>Nº {f.numero_atendimento} · {f.data_atendimento?.split("-").reverse().join("/")} às {f.hora_atendimento?.slice(0, 5)}</div>
              </div>
              <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><X size={20} /></button>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {f.classificacao && <Badge tone={f.classificacao === "choque_septico" ? "red" : f.classificacao === "sepse" ? "amber" : "teal"}>{CLASSIF_LABEL[f.classificacao]}</Badge>}
              <PortaAtbBadge min={f.porta_atb_min} />
            </div>
            <DetailBlock title="Tempo porta-antibiótico">
              {f.porta_atb_min != null
                ? <>Abertura {f.hora_atendimento?.slice(0, 5)} → administração {f.hora_administracao_atb?.slice(0, 5)} · <strong>{fmtMin(f.porta_atb_min)}</strong> ({f.porta_atb_min <= META_MIN ? "dentro" : "fora"} da meta de 1h)</>
                : "Hora de administração do antibiótico não registrada."}
            </DetailBlock>
            <DetailBlock title={`Critérios do protocolo (${f.total_criterios})`}>
              {f.criterios?.length ? f.criterios.map((c) => <div key={c.id} style={{ fontSize: 13, padding: "3px 0" }}>• {c.label}</div>) : <div style={{ fontSize: 13, color: C.inkSoft }}>Nenhum critério marcado.</div>}
            </DetailBlock>
            <DetailBlock title="Foco de infecção">
              {f.focoInfeccao?.length ? f.focoInfeccao.join(", ") : "—"}
            </DetailBlock>
            <DetailBlock title="Antibióticos">
              {f.antibioticos?.length ? f.antibioticos.join(", ") : "—"}
            </DetailBlock>
            <DetailBlock title="Médico responsável">
              {f.medico_nome} — CRM {f.medico_crm}
            </DetailBlock>
          </>
        )}
      </div>
    </div>
  );
}
function DetailBlock({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.tealDark, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Painel analítico                                                       */
/* ---------------------------------------------------------------------- */

const PERIOD_PRESETS = [
  { label: "7 dias", days: 6 },
  { label: "30 dias", days: 29 },
  { label: "90 dias", days: 89 },
];

function kpiTone(pct) {
  if (pct == null) return "gray";
  if (pct >= 85) return "green";
  if (pct >= 70) return "amber";
  return "red";
}
const TONE_COLOR = { green: C.green, amber: C.amber, red: C.red, gray: C.inkSoft };

function Gauge({ pct }) {
  const tone = kpiTone(pct);
  const color = TONE_COLOR[tone];
  const value = pct ?? 0;
  const data = [{ v: value }, { v: 100 - value }];
  return (
    <div style={{ position: "relative", width: 190, height: 120 }}>
      <ResponsiveContainer width="100%" height={190}>
        <PieChart>
          <Pie
            data={data} dataKey="v" startAngle={180} endAngle={0}
            cx="50%" cy="50%" innerRadius={62} outerRadius={82}
            stroke="none" isAnimationActive
          >
            <Cell fill={color} cornerRadius={6} />
            <Cell fill="#e7eef0" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{ position: "absolute", left: 0, right: 0, top: 52, textAlign: "center" }}>
        <div style={{ fontSize: 34, fontWeight: 800, color, lineHeight: 1 }}>{pct == null ? "—" : `${pct}%`}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 4 }}>dentro da meta</div>
      </div>
    </div>
  );
}

function PainelTab({ refreshKey }) {
  const [de, setDe] = useState(() => isoDaysAgo(29));
  const [ate, setAte] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    api.painel(de, ate)
      .then((r) => !cancelled && setData(r))
      .catch(() => {
        if (!cancelled) { setData(null); setLoadError(true); }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [de, ate, refreshKey]);

  function applyPreset(days) {
    setDe(isoDaysAgo(days));
    setAte(todayISO());
  }
  function applyThisMonth() {
    const d = new Date();
    setDe(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    setAte(todayISO());
  }

  const kpi = data?.kpi;
  const byMonth = (data?.byMonth || []).map((m) => ({
    ...m,
    mesLabel: `${m.mes.slice(5)}/${m.mes.slice(2, 4)}`,
  }));
  const byDay = data?.byDay || [];
  const byFoco = data?.byFoco || [];
  const byAtb = data?.byAtb || [];
  const byClassif = (data?.byClassif || []).map((c) => ({ ...c, label: CLASSIF_LABEL[c.name] || c.name }));
  const desfechos = data?.desfechos;
  const byStatus = data?.byStatus || [];
  const byClassifFinal = (desfechos?.byClassifFinal || []).map((c) => ({ ...c, label: CLASSIF_FINAL_LABEL[c.name] || c.name }));
  const byDestino = (desfechos?.byDestino || []).map((d) => ({ ...d, label: DESTINO_LABEL[d.name] || d.name }));

  // delta em pontos percentuais vs mês anterior (tendência mensal)
  const meses = byMonth.filter((m) => m.pctMeta != null);
  const deltaPp = meses.length >= 2 ? meses[meses.length - 1].pctMeta - meses[meses.length - 2].pctMeta : null;

  const CLASSIF_COLORS = { sirs: C.teal, sepse: C.amber, choque_septico: C.red, nao_classificado: "#9db3ba" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card className="anim-card">
        <SectionTitle icon={<CalendarRange size={16} />} title="Período de análise" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {PERIOD_PRESETS.map((p) => (
            <button key={p.label} type="button" className="chip" onClick={() => applyPreset(p.days)}
              style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${de === isoDaysAgo(p.days) && ate === todayISO() ? C.teal : C.line}`, background: de === isoDaysAgo(p.days) && ate === todayISO() ? C.tealBg : "#fff", color: C.tealDark }}>
              {p.label}
            </button>
          ))}
          <button type="button" className="chip" onClick={applyThisMonth}
            style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer", border: `1.5px solid ${C.line}`, background: "#fff", color: C.tealDark }}>
            Este mês
          </button>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Field label="De"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={inputStyle} /></Field>
          <Field label="Até"><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={inputStyle} /></Field>
        </div>
      </Card>

      {loadError && (
        <Card className="anim-card">
          <EmptyState icon={<AlertTriangle size={44} />} title="Não foi possível carregar o painel" subtitle="Verifique a conexão e tente novamente." />
        </Card>
      )}

      {/* HERO — KPI porta-antibiótico */}
      {!loadError && (
      <Card className="anim-card" style={{ padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <SectionTitle icon={<Timer size={16} />} title="Porta-antibiótico — meta institucional: até 1 hora" />
          {deltaPp != null && !loading && (
            <Badge tone={deltaPp >= 0 ? "green" : "red"}>
              {deltaPp >= 0 ? "▲" : "▼"} {Math.abs(deltaPp)} p.p. vs mês anterior
            </Badge>
          )}
        </div>
        {loading ? (
          <div style={{ display: "flex", gap: 30, flexWrap: "wrap", alignItems: "center" }}>
            <Skeleton h={120} w={190} /><Skeleton h={70} w={130} /><Skeleton h={70} w={130} /><Skeleton h={70} w={130} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 34, flexWrap: "wrap", alignItems: "center" }}>
            <Gauge pct={kpi?.pctDentroMeta ?? null} />
            <Stat big label="Mediana porta-ATB" value={kpi?.medianaMin != null ? fmtMin(kpi.medianaMin) : "—"} tone={kpi?.medianaMin != null ? (kpi.medianaMin <= META_MIN ? "green" : "red") : undefined} />
            <Stat big label="Fichas com ATB registrado" value={kpi?.comAtb ?? 0} sub={`${kpi?.dentroMeta ?? 0} dentro da meta`} />
            <Stat big label="Fichas no período" value={data?.periodoCount ?? 0} sub={`média de ${data?.avgCriteria ?? 0} critérios/ficha`} />
          </div>
        )}
      </Card>
      )}

      {/* Tendência mensal — dois gráficos, um eixo cada */}
      {!loadError && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}>
        <Card className="anim-card">
          <SectionTitle icon={<TrendingUp size={16} />} title="% dentro da meta — últimos 6 meses" />
          {loading ? <Skeleton h={220} /> : byMonth.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={byMonth} margin={{ top: 8, right: 14, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.line }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip formatter={(v) => [`${v}%`, "Dentro da meta"]} />
                <ReferenceLine y={85} stroke={C.green} strokeDasharray="5 4" label={{ value: "alvo 85%", fontSize: 10.5, fill: C.green, position: "insideBottomRight" }} />
                <Line type="monotone" dataKey="pctMeta" stroke={C.teal} strokeWidth={2.5} dot={{ r: 4, fill: C.teal }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={<Inbox size={40} />} title="Sem dados" />}
        </Card>
        <Card className="anim-card">
          <SectionTitle icon={<BarChart3 size={16} />} title="Protocolos abertos por mês" />
          {loading ? <Skeleton h={220} /> : byMonth.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byMonth} margin={{ top: 16, right: 14, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.line }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [v, "Fichas"]} />
                <Bar dataKey="total" fill={C.teal} radius={[4, 4, 0, 0]} maxBarSize={44}>
                  <LabelList dataKey="total" position="top" style={{ fontSize: 11, fontWeight: 700, fill: C.tealDark }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={<Inbox size={40} />} title="Sem dados" />}
        </Card>
      </div>
      )}

      {!loadError && (
      <Card className="anim-card">
        <SectionTitle icon={<Activity size={16} />} title="Fichas abertas por dia no período" />
        {loading ? <Skeleton h={220} /> : byDay.length ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={byDay} margin={{ top: 8, right: 14, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: C.line }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" name="Fichas" stroke={C.teal} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyState icon={<Inbox size={40} />} title="Sem dados suficientes" subtitle="Nenhuma ficha no período selecionado." />}
      </Card>
      )}

      {!loadError && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}>
        <Card className="anim-card">
          <SectionTitle icon={<Activity size={16} />} title="Foco de infecção" />
          {loading ? <Skeleton h={260} /> : byFoco.length ? (
            <ResponsiveContainer width="100%" height={Math.max(200, byFoco.length * 30)}>
              <BarChart data={byFoco} layout="vertical" margin={{ left: 30, right: 30 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [v, "Fichas"]} />
                <Bar dataKey="value" fill={C.teal} radius={[0, 4, 4, 0]} maxBarSize={18}>
                  <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700, fill: C.tealDark }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={<Inbox size={40} />} title="Sem dados" />}
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card className="anim-card">
            <SectionTitle icon={<HeartPulse size={16} />} title="Classificação dos casos" />
            {loading ? <Skeleton h={90} /> : byClassif.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {byClassif.map((c) => {
                  const total = byClassif.reduce((s, x) => s + x.value, 0);
                  const pct = Math.round((100 * c.value) / total);
                  return (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: CLASSIF_COLORS[c.name] || C.inkSoft, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, width: 120, color: C.ink }}>{c.label}</span>
                      <div style={{ flex: 1, height: 16, background: "#eef3f4", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: CLASSIF_COLORS[c.name] || C.inkSoft, borderRadius: 4, transition: "width .4s" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, width: 60, textAlign: "right" }}>{c.value} · {pct}%</span>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState icon={<Inbox size={40} />} title="Sem dados" />}
          </Card>
          <Card className="anim-card" style={{ flex: 1 }}>
            <SectionTitle icon={<ShieldCheck size={16} />} title="Antibióticos mais usados" />
            {loading ? <Skeleton h={200} /> : byAtb.length ? (
              <ResponsiveContainer width="100%" height={Math.max(180, byAtb.length * 28)}>
                <BarChart data={byAtb} layout="vertical" margin={{ left: 30, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [v, "Prescrições"]} />
                  <Bar dataKey="total" fill={C.teal} radius={[0, 4, 4, 0]} maxBarSize={18}>
                    <LabelList dataKey="total" position="right" style={{ fontSize: 11, fontWeight: 700, fill: C.tealDark }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={<Inbox size={40} />} title="Sem dados" />}
          </Card>
        </div>
      </div>
      )}

      {/* Desfechos e fila de acompanhamento */}
      {!loadError && (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}>
        <Card className="anim-card">
          <SectionTitle icon={<CheckCircle2 size={16} />} title="Desfecho — era mesmo sepse?" />
          {loading ? <Skeleton h={200} /> : desfechos?.encerrados ? (
            <>
              <div style={{ display: "flex", gap: 26, flexWrap: "wrap", marginBottom: 16 }}>
                <Stat label="Casos encerrados" value={desfechos.encerrados} />
                <Stat label="Taxa de confirmação" value={desfechos.taxaConfirmacao != null ? `${desfechos.taxaConfirmacao}%` : "—"} sub="sepse ou choque confirmados" />
                <Stat label="Mortalidade" value={desfechos.mortalidade != null ? `${desfechos.mortalidade}%` : "—"} tone={desfechos.mortalidade > 20 ? "red" : undefined} sub="dos casos encerrados" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {byClassifFinal.map((c) => {
                  const total = byClassifFinal.reduce((s, x) => s + x.value, 0);
                  const pct = Math.round((100 * c.value) / total);
                  const cor = { sepse_confirmada: C.teal, choque_septico: C.red, infeccao_sem_sepse: C.amber, descartado: "#9db3ba" }[c.name] || C.inkSoft;
                  return (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: cor, flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, width: 140, color: C.ink }}>{c.label}</span>
                      <div style={{ flex: 1, height: 16, background: "#eef3f4", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: cor, borderRadius: 4, transition: "width .4s" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.inkSoft, width: 62, textAlign: "right" }}>{c.value} · {pct}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : <EmptyState icon={<Inbox size={40} />} title="Nenhum caso encerrado no período" subtitle="Os desfechos aparecem aqui conforme os casos são revisados e encerrados." />}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card className="anim-card">
            <SectionTitle icon={<HeartPulse size={16} />} title="Fila de acompanhamento no período" />
            {loading ? <Skeleton h={70} /> : byStatus.length ? (
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {["pendente_atb", "aguardando_desfecho", "encerrado"].map((s) => {
                  const item = byStatus.find((x) => x.name === s);
                  const meta = STATUS_META[s];
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 12, height: 12, borderRadius: 999, background: STATUS_COLOR[s] }} />
                      <div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: STATUS_COLOR[s], lineHeight: 1 }}>{item?.value ?? 0}</div>
                        <div style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 600, marginTop: 2 }}>{meta.label}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState icon={<Inbox size={40} />} title="Sem dados" />}
          </Card>

          <Card className="anim-card" style={{ flex: 1 }}>
            <SectionTitle icon={<Users size={16} />} title="Destino dos pacientes" />
            {loading ? <Skeleton h={160} /> : byDestino.length ? (
              <ResponsiveContainer width="100%" height={Math.max(150, byDestino.length * 30)}>
                <BarChart data={byDestino} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v) => [v, "Pacientes"]} />
                  <Bar dataKey="value" fill={C.teal} radius={[0, 4, 4, 0]} maxBarSize={18}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700, fill: C.tealDark }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={<Inbox size={40} />} title="Sem desfechos no período" />}
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, big, tone }) {
  return (
    <div>
      <div style={{ fontSize: big ? 30 : 26, fontWeight: 800, color: tone ? TONE_COLOR[tone] : C.tealDark, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600, marginTop: 3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Administração de usuários                                             */
/* ---------------------------------------------------------------------- */

function AdminTab() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: "", crm: "", email: "", senha: "" });
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    api.users().then(setList).finally(() => setLoading(false));
  }, []);

  useEffect(() => reload(), [reload]);

  async function addUser(e) {
    e.preventDefault();
    setError("");
    if (!form.nome.trim() || !form.crm.trim() || !form.senha.trim()) return setError("Preencha nome, CRM e senha.");
    if (form.senha.trim().length < 6) return setError("A senha provisória precisa ter ao menos 6 caracteres.");
    try {
      await api.createUser(form);
      setForm({ nome: "", crm: "", email: "", senha: "" });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(crm) {
    setError("");
    try {
      await api.toggleUserActive(crm);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  // Repassa erro para o modal decidir (não fecha em caso de falha).
  async function resetPassword(crm, novaSenha) {
    await api.resetUserPassword(crm, novaSenha);
    reload();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      <Card className="anim-card">
        <SectionTitle icon={<UserPlus size={16} />} title="Cadastrar novo médico" />
        <form onSubmit={addUser}>
          <div style={grid2}>
            <Field label="Nome completo"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} /></Field>
            <Field label="CRM"><input value={form.crm} onChange={(e) => setForm({ ...form, crm: e.target.value })} style={inputStyle} placeholder="Ex: 12.345" /></Field>
            <Field label="E-mail (opcional)"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} /></Field>
            <Field label="Senha provisória"><input value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} style={inputStyle} /></Field>
          </div>
          {error && <ErrorLine text={error} />}
          <button type="submit" className="btn-primary" style={{ ...primaryBtn, width: "auto", padding: "10px 22px", marginTop: 16, display: "inline-flex", gap: 8, alignItems: "center" }}>
            <Plus size={16} /> Adicionar médico
          </button>
        </form>
      </Card>

      <Card className="anim-card" style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px 4px" }}>
          <SectionTitle icon={<Users size={16} />} title={`Médicos cadastrados (${list.length})`} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#eef4f4", textAlign: "left" }}>
                {["Nome", "CRM", "Perfil", "Status", "Ações"].map((h) => <th key={h} style={{ padding: "10px 14px", fontWeight: 700, color: C.tealDark }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && [...Array(3)].map((_, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                  {[...Array(5)].map((_, j) => <td key={j} style={td}><Skeleton h={14} /></td>)}
                </tr>
              ))}
              {!loading && list.map((u) => (
                <tr key={u.crm} className="rowh" style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={td}>{u.nome}</td>
                  <td style={td}>{u.crm}</td>
                  <td style={td}>{u.role === "master" ? <Badge tone="amber">Master</Badge> : <Badge>Médico</Badge>}</td>
                  <td style={td}>{u.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</td>
                  <td style={td}>
                    {u.role !== "master" && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => toggleActive(u.crm)} className="btn-secondary" style={{ ...secondaryBtn, padding: "5px 10px", fontSize: 12 }}>{u.active ? "Desativar" : "Ativar"}</button>
                        <button onClick={() => setEditing(u.crm)} className="btn-secondary" style={{ ...secondaryBtn, padding: "5px 10px", fontSize: 12 }}>Redefinir senha</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing && (
        <ResetPasswordModal crm={editing} onClose={() => setEditing(null)} onConfirm={(pw) => resetPassword(editing, pw)} />
      )}
    </div>
  );
}

function ResetPasswordModal({ crm, onClose, onConfirm }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    setError("");
    if (pw.trim().length < 6) return setError("A senha precisa ter ao menos 6 caracteres.");
    if (pw !== pw2) return setError("As senhas não coincidem.");
    setBusy(true);
    try {
      await onConfirm(pw.trim());
      setDone(true);
      setTimeout(onClose, 1100);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,42,51,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 360, width: "100%", padding: 22 }}>
        <h3 style={{ marginTop: 0, color: C.ink, fontSize: 15 }}>Redefinir senha — CRM {crm}</h3>
        {done ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.green, background: C.greenBg, borderRadius: 9, padding: "10px 12px", fontSize: 13, fontWeight: 600, marginTop: 10 }}>
            <CheckCircle2 size={16} /> Senha redefinida com sucesso.
          </div>
        ) : (
          <>
            <label style={{ ...labelStyle, marginTop: 4 }}>Nova senha</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={inputStyle} placeholder="Mínimo 6 caracteres" autoFocus />
            <label style={labelStyle}>Confirmar nova senha</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={inputStyle} onKeyDown={(e) => e.key === "Enter" && handleSave()} />
            {error && <ErrorLine text={error} />}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={onClose} className="btn-secondary" style={{ ...secondaryBtn, flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button onClick={handleSave} disabled={busy} className="btn-primary" style={{ ...primaryBtn, flex: 1, marginTop: 0 }}>{busy ? "Salvando..." : "Salvar"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  Troca da própria senha (usuário autenticado)                           */
/* ---------------------------------------------------------------------- */

function ChangePasswordModal({ onClose, onChanged }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [nova2, setNova2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSave() {
    setError("");
    if (!atual) return setError("Informe a senha atual.");
    if (nova.trim().length < 6) return setError("A nova senha precisa ter ao menos 6 caracteres.");
    if (nova !== nova2) return setError("As senhas não coincidem.");
    if (nova === atual) return setError("A nova senha deve ser diferente da atual.");
    setBusy(true);
    try {
      const { token } = await api.changePassword(atual, nova.trim());
      if (token) setToken(token); // o token antigo foi revogado no backend
      setDone(true);
      setTimeout(() => { onClose(); onChanged?.(); }, 1100);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(15,42,51,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 60 }} onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 380, width: "100%", padding: 22 }}>
        <h3 style={{ marginTop: 0, color: C.ink, fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
          <KeyRound size={17} /> Trocar minha senha
        </h3>
        {done ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.green, background: C.greenBg, borderRadius: 9, padding: "10px 12px", fontSize: 13, fontWeight: 600, marginTop: 10 }}>
            <CheckCircle2 size={16} /> Senha alterada com sucesso.
          </div>
        ) : (
          <>
            <label style={{ ...labelStyle, marginTop: 4 }}>Senha atual</label>
            <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} style={inputStyle} autoFocus />
            <label style={labelStyle}>Nova senha</label>
            <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} style={inputStyle} placeholder="Mínimo 6 caracteres" />
            <label style={labelStyle}>Confirmar nova senha</label>
            <input type="password" value={nova2} onChange={(e) => setNova2(e.target.value)} style={inputStyle} onKeyDown={(e) => e.key === "Enter" && handleSave()} />
            {error && <ErrorLine text={error} />}
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={onClose} className="btn-secondary" style={{ ...secondaryBtn, flex: 1, justifyContent: "center" }}>Cancelar</button>
              <button onClick={handleSave} disabled={busy} className="btn-primary" style={{ ...primaryBtn, flex: 1, marginTop: 0 }}>{busy ? "Salvando..." : "Salvar"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/*  App raiz                                                               */
/* ---------------------------------------------------------------------- */

export default function App() {
  const [loading, setLoading] = useState(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tab, setTab] = useState("acompanhamento");
  const [summary, setSummary] = useState({ todayCount: 0, monthCount: 0, totalFichas: 0, activeMedicos: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  const [showChangePw, setShowChangePw] = useState(false);
  const [catalogos, setCatalogos] = useState({
    criterios: SIRS_ITEMS_FALLBACK,
    focos: FOCOS_FALLBACK,
    antibioticos: ANTIBIOTICOS_FALLBACK,
  });

  useEffect(() => {
    (async () => {
      const token = getToken();
      let user = null;
      if (token) {
        try {
          const r = await api.me();
          user = r.user;
        } catch {
          setToken(null);
        }
      }
      if (user) {
        setCurrentUser(user);
      } else {
        try {
          const status = await api.authStatus();
          setNeedsBootstrap(status.needsBootstrap);
        } catch {
          setNeedsBootstrap(false);
        }
      }
      setLoading(false);
    })();
  }, []);

  // catálogos clínicos vêm da API (o protocolo pode evoluir sem redeploy do frontend)
  useEffect(() => {
    if (!currentUser) return;
    Promise.all([api.criterios(), api.focos(), api.antibioticos()])
      .then(([criterios, focos, antibioticos]) => {
        setCatalogos({
          criterios,
          focos: focos.map((f) => f.nome),
          antibioticos: antibioticos.map((a) => a.nome),
        });
      })
      .catch(() => {}); // mantém o fallback local
  }, [currentUser]);

  const loadSummary = useCallback(() => {
    api.statsSummary().then(setSummary).catch(() => {});
  }, []);

  useEffect(() => {
    if (currentUser) loadSummary();
  }, [currentUser, refreshKey, loadSummary]);

  function handleAuthenticated(user) {
    setCurrentUser(user);
  }

  function handleLogout() {
    setToken(null);
    setCurrentUser(null);
    setTab("nova");
  }

  function handleFichaSaved() {
    setRefreshKey((k) => k + 1);
  }

  if (loading) {
    return (
      <>
        <GlobalStyles />
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.inkSoft, fontFamily: "'Inter', system-ui, sans-serif" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 300 }}>
            <Skeleton h={40} /><Skeleton h={16} w="70%" /><Skeleton h={16} w="50%" />
          </div>
        </div>
      </>
    );
  }

  if (!currentUser) {
    return (
      <>
        <GlobalStyles />
        <LoginScreen needsBootstrap={needsBootstrap} onAuthenticated={handleAuthenticated} />
      </>
    );
  }

  const isMaster = currentUser.role === "master";
  const initials = currentUser.name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  const TABS = [
    { id: "acompanhamento", label: "Acompanhamento", icon: <HeartPulse size={16} /> },
    { id: "nova", label: "Nova ficha", icon: <ClipboardList size={16} /> },
    { id: "historico", label: "Histórico", icon: <Search size={16} /> },
    { id: "painel", label: "Painel analítico", icon: <BarChart3 size={16} /> },
    ...(isMaster ? [{ id: "admin", label: "Administração", icon: <Users size={16} /> }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif", color: C.ink }}>
      <GlobalStyles />
      <div style={{ background: `linear-gradient(120deg, ${C.tealDark}, #12454c 70%, #16525a)`, color: "#fff", padding: "14px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={21} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Protocolo Sepse</div>
              <div style={{ fontSize: 11.5, opacity: 0.75 }}>Hospital Cardio Pulmonar · Rede D'Or São Luiz</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{currentUser.name}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>CRM {currentUser.crm}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, letterSpacing: 0.5 }}>
              {initials}
            </div>
            <button onClick={() => setShowChangePw(true)} aria-label="Trocar minha senha" style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex" }} title="Trocar minha senha">
              <KeyRound size={16} />
            </button>
            <button onClick={handleLogout} aria-label="Sair" style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex" }} title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 20px 0" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <MiniStat icon={<ClipboardList size={15} />} label="Fichas hoje" value={summary.todayCount} />
          <MiniStat icon={<CalendarRange size={15} />} label="Fichas no mês atual" value={summary.monthCount} />
          <MiniStat icon={<BarChart3 size={15} />} label="Total geral de fichas" value={summary.totalFichas} />
          <MiniStat icon={<Users size={15} />} label="Médicos ativos" value={summary.activeMedicos} />
        </div>

        <div style={{ display: "flex", gap: 4, borderBottom: `1.5px solid ${C.line}`, marginBottom: 20, overflowX: "auto" }}>
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 20px 40px" }}>
        {tab === "acompanhamento" && <AcompanhamentoTab refreshKey={refreshKey} onNovaFicha={() => setTab("nova")} />}
        {tab === "nova" && <NovaFichaTab user={currentUser} catalogos={catalogos} onSaved={handleFichaSaved} />}
        {tab === "historico" && <HistoricoTab refreshKey={refreshKey} onNovaFicha={() => setTab("nova")} />}
        {tab === "painel" && <PainelTab refreshKey={refreshKey} />}
        {tab === "admin" && isMaster && <AdminTab />}
      </div>

      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </div>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 18px", minWidth: 150, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: C.tealBg, color: C.tealDark, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.tealDark, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

function tabBtn(active) {
  return {
    display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", background: "none",
    border: "none", borderBottom: active ? `2.5px solid ${C.teal}` : "2.5px solid transparent",
    color: active ? C.tealDark : C.inkSoft, fontWeight: active ? 800 : 600, fontSize: 13.5,
    cursor: "pointer", whiteSpace: "nowrap", transition: "color .12s",
  };
}
