import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";
import {
  Activity, Stethoscope, ClipboardList, BarChart3, Users, LogOut,
  Plus, Search, Download, ShieldCheck, UserPlus, Eye, EyeOff, X,
  ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Lock,
} from "lucide-react";
import { api, getToken, setToken } from "./api.js";

/* ---------------------------------------------------------------------- */
/*  Dados clínicos de referência                                          */
/* ---------------------------------------------------------------------- */

const SIRS_ITEMS = [
  { id: "fc90", label: "FC > 90 bpm" },
  { id: "temp", label: "Temperatura > 37,5ºC ou < 35ºC" },
  { id: "fr20", label: "FR > 20 irpm ou PaCO2 < 32 mmHg" },
  { id: "leucocitos", label: "Leucócitos totais > 12.000 ou < 4.000, ou formas jovens ≥ 10%" },
  { id: "hipoxemia", label: "Hipoxemia — SpO2 < 90% ou PaO2/FiO2 < 300" },
  { id: "consciencia", label: "Alteração do nível/conteúdo de consciência (delirium)" },
  { id: "oliguria", label: "Oligúria — débito urinário < 0,5 mL/kg/h por 2h, ou creatinina > 2 mg/dL" },
  { id: "hipotensao", label: "Hipotensão arterial — PAS < 90 mmHg, queda de PAS > 40 mmHg, ou PAM ≤ 65 mmHg" },
  { id: "acidose", label: "Acidose metabólica inexplicada — déficit de bases ≤ 5 mEq/L e lactato ≥ 2 mmol/L" },
  { id: "coagulopatia", label: "Coagulopatia — RNI > 1,5 ou TTPa > 60s" },
  { id: "trombocitopenia", label: "Trombocitopenia — plaquetas < 100.000, ou queda ≥ 50% (últimos 3 dias)" },
  { id: "hiperbilirrubinemia", label: "Hiperbilirrubinemia — bilirrubina > 2x o valor de referência" },
];

const FOCOS_INFECCAO = [
  "Trato respiratório inferior/superior", "Trato urinário", "Trato gastrointestinal",
  "Cutâneo/partes moles", "Sistema nervoso", "Ginecológico", "Urológico",
  "Hematológico", "Cardíaco (Endocardite)", "Dentário",
];

const ANTIBIOTICOS = [
  "Amoxicilina", "Amoxicilina + Clavulanato", "Azitromicina", "Cefazolina",
  "Cefepima", "Ceftriaxona", "Ciprofloxacino", "Claritromicina", "Doxiciclina",
  "Eritromicina", "Ertapenem", "Levofloxacino", "Metronidazol", "Nitrofurantoína",
  "Piperacilina-Tazobactam", "Meropenem", "Oxacilina", "Polimixina",
  "Teicoplanina", "Trimetoprima-Sulfametoxazol", "Vancomicina",
];

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
  amber: "#c9741b",
  red: "#b3392c",
  redBg: "#fdecea",
  greenBg: "#eaf6ee",
  green: "#1f7a4c",
};

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function nowHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------------- */
/*  Componentes utilitários                                                */
/* ---------------------------------------------------------------------- */

function Badge({ children, tone = "teal" }) {
  const tones = {
    teal: { bg: "#e3f1f1", fg: C.tealDark },
    red: { bg: C.redBg, fg: C.red },
    green: { bg: C.greenBg, fg: C.green },
    amber: { bg: "#fbeee0", fg: C.amber },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        background: t.bg, color: t.fg, fontSize: 12, fontWeight: 700,
        padding: "3px 9px", borderRadius: 999, letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14,
        padding: "20px", boxShadow: "0 1px 2px rgba(15,42,51,0.04)", ...style,
      }}
    >
      {children}
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
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Activity color="#fff" size={28} />
          </div>
          <h1 style={{ color: "#fff", fontSize: 21, fontWeight: 800, margin: 0, letterSpacing: 0.2 }}>Protocolo Sepse</h1>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, margin: "4px 0 0" }}>Hospital Cardio Pulmonar · Rede D'Or São Luiz</p>
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
              <button type="submit" disabled={busy} style={primaryBtn}>{busy ? "Criando..." : "Criar acesso master"}</button>
            </form>
          ) : (
            <form onSubmit={handleLogin}>
              <label style={labelStyle}>CRM</label>
              <input value={crm} onChange={(e) => setCrm(e.target.value)} style={inputStyle} placeholder="Ex: 32.394" autoFocus />
              <label style={labelStyle}>Senha</label>
              <div style={{ position: "relative" }}>
                <input type={showPw ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} style={{ ...inputStyle, paddingRight: 40 }} />
                <button type="button" onClick={() => setShowPw((s) => !s)} style={{ position: "absolute", right: 10, top: 9, background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && <ErrorLine text={error} />}
              <button type="submit" disabled={busy} style={primaryBtn}>{busy ? "Entrando..." : "Entrar"}</button>
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
const primaryBtn = { width: "100%", marginTop: 20, padding: "11px 0", background: C.teal, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: "pointer" };
const secondaryBtn = { padding: "9px 16px", background: "#fff", color: C.teal, border: `1.5px solid ${C.teal}`, borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };

/* ---------------------------------------------------------------------- */
/*  Nova ficha de atendimento                                              */
/* ---------------------------------------------------------------------- */

function emptyFicha() {
  const sirs = {};
  SIRS_ITEMS.forEach((it) => (sirs[it.id] = false));
  return {
    dataAtendimento: todayISO(),
    horaAtendimento: nowHM(),
    nomePaciente: "",
    numeroAtendimento: "",
    sirs,
    focoInfeccao: [],
    antibioticos: [],
  };
}

function NovaFichaTab({ user, onSaved }) {
  const [f, setF] = useState(() => emptyFicha());
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const criteriaCount = SIRS_ITEMS.reduce((n, it) => n + (f.sirs[it.id] ? 1 : 0), 0);

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
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setBusy(true);
    try {
      await api.createFicha(f);
      setF(emptyFicha());
      setSaved(true);
      onSaved?.();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 880 }}>
      {saved && (
        <div style={{ background: C.greenBg, color: C.green, padding: "10px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} /> Ficha registrada com sucesso.
        </div>
      )}
      {error && <ErrorLine text={error} />}

      <Card>
        <SectionTitle icon={<ClipboardList size={16} />} title="Dados do atendimento" />
        <div style={grid2}>
          <Field label="Data do atendimento" error={errors.dataAtendimento}>
            <input type="date" value={f.dataAtendimento} onChange={(e) => setF({ ...f, dataAtendimento: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Hora do atendimento" error={errors.horaAtendimento}>
            <input type="time" value={f.horaAtendimento} onChange={(e) => setF({ ...f, horaAtendimento: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Nome do paciente" error={errors.nomePaciente}>
            <input value={f.nomePaciente} onChange={(e) => setF({ ...f, nomePaciente: e.target.value })} style={inputStyle} placeholder="Nome completo" />
          </Field>
          <Field label="Número do atendimento" error={errors.numeroAtendimento}>
            <input value={f.numeroAtendimento} onChange={(e) => setF({ ...f, numeroAtendimento: e.target.value })} style={inputStyle} placeholder="Ex: 2026001234" />
          </Field>
        </div>
        <div style={{ marginTop: 14, fontSize: 12.5, color: C.inkSoft }}>
          Médico responsável: <strong style={{ color: C.ink }}>{user.name}</strong> · CRM {user.crm}
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <SectionTitle icon={<Stethoscope size={16} />} title="Critérios SIRS / Sepse (qSOFA)" />
          <Badge tone={criteriaCount >= 2 ? "red" : criteriaCount === 1 ? "amber" : "teal"}>{criteriaCount} de 12 critérios marcados</Badge>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
          {SIRS_ITEMS.map((it) => (
            <label key={it.id} style={checkRow(f.sirs[it.id])}>
              <input type="checkbox" checked={f.sirs[it.id]} onChange={() => toggleSirs(it.id)} style={{ marginTop: 2 }} />
              <span>{it.label}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<Activity size={16} />} title="Foco de infecção identificado ou presumido" />
        <ChipGroup options={FOCOS_INFECCAO} selected={f.focoInfeccao} onToggle={toggleFoco} />
      </Card>

      <Card>
        <SectionTitle icon={<ShieldCheck size={16} />} title="Antibióticos prescritos" />
        <ChipGroup options={ANTIBIOTICOS} selected={f.antibioticos} onToggle={toggleAntibiotico} />
      </Card>

      <button type="submit" disabled={busy} style={{ ...primaryBtn, width: "auto", padding: "12px 28px", display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
        <Plus size={17} /> {busy ? "Registrando..." : "Registrar ficha"}
      </button>
    </form>
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
    <div>
      <label style={{ ...labelStyle, marginTop: 0 }}>{label}</label>
      {children}
      {error && <div style={{ color: C.red, fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
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
function checkRow(active) {
  return {
    display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, padding: "9px 10px",
    borderRadius: 8, cursor: "pointer", background: active ? "#e3f1f1" : "transparent", lineHeight: 1.4,
  };
}

/* ---------------------------------------------------------------------- */
/*  Histórico de fichas                                                    */
/* ---------------------------------------------------------------------- */

function HistoricoTab({ refreshKey }) {
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
    api.listFichas({ ...filters, page, perPage })
      .then((r) => !cancelled && setResult(r))
      .catch(() => !cancelled && setResult({ total: 0, items: [] }))
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
      const rows = await api.exportFichas(filters);
      const sheetRows = rows.map((f) => ({
        Data: f.data_atendimento?.split("-").reverse().join("/"),
        Hora: f.hora_atendimento?.slice(0, 5),
        Paciente: f.paciente_nome,
        "Nº Atendimento": f.numero_atendimento,
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
        { wch: 11 }, { wch: 7 }, { wch: 26 }, { wch: 14 }, { wch: 10 },
        { wch: 50 }, { wch: 28 }, { wch: 30 }, { wch: 22 }, { wch: 10 }, { wch: 19 },
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
      <Card>
        <SectionTitle icon={<Search size={16} />} title="Filtros" />
        <div style={grid2}>
          <Field label="Paciente"><input value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} placeholder="Nome do paciente" /></Field>
          <Field label="Nº atendimento"><input value={numero} onChange={(e) => setNumero(e.target.value)} style={inputStyle} placeholder="Número" /></Field>
          <Field label="De"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={inputStyle} /></Field>
          <Field label="Até"><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={inputStyle} /></Field>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 13, color: C.inkSoft }}>{result.total} ficha(s) encontrada(s)</span>
          <button type="button" onClick={exportExcel} style={secondaryBtn} disabled={!result.total || exporting}>
            <Download size={15} /> {exporting ? "Exportando..." : "Exportar Excel"}
          </button>
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#eef4f4", textAlign: "left" }}>
                {["Data", "Hora", "Paciente", "Nº Atend.", "Critérios", "Médico", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", fontWeight: 700, color: C.tealDark, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.items.map((f) => (
                <tr key={f.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={td}>{f.data_atendimento?.split("-").reverse().join("/")}</td>
                  <td style={td}>{f.hora_atendimento?.slice(0, 5)}</td>
                  <td style={td}>{f.paciente_nome}</td>
                  <td style={td}>{f.numero_atendimento}</td>
                  <td style={td}><Badge tone={f.total_criterios >= 2 ? "red" : f.total_criterios === 1 ? "amber" : "teal"}>{f.total_criterios}/12</Badge></td>
                  <td style={td}>{f.medico_nome}</td>
                  <td style={td}>
                    <button onClick={() => openDetail(f.id)} style={{ ...secondaryBtn, padding: "5px 10px", fontSize: 12 }}>Ver</button>
                  </td>
                </tr>
              ))}
              {!loading && !result.items.length && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: C.inkSoft }}>Nenhuma ficha encontrada para os filtros aplicados.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: C.inkSoft }}>Carregando…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {result.total > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: 14, borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 13, color: C.inkSoft }}>Página {page} de {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={pageBtn}><ChevronRight size={16} /></button>
          </div>
        )}
      </Card>

      {(detail || detailLoading) && <FichaDetailModal f={detail} loading={detailLoading} onClose={() => setDetail(null)} />}
    </div>
  );
}

const td = { padding: "10px 14px", verticalAlign: "top" };
const pageBtn = { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8, padding: 6, cursor: "pointer" };

function FichaDetailModal({ f, loading, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,42,51,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        {loading || !f ? (
          <div style={{ padding: 20, textAlign: "center", color: C.inkSoft }}>Carregando…</div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: C.ink }}>{f.paciente_nome}</h3>
                <div style={{ fontSize: 13, color: C.inkSoft }}>Nº {f.numero_atendimento} · {f.data_atendimento?.split("-").reverse().join("/")} às {f.hora_atendimento?.slice(0, 5)}</div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkSoft }}><X size={20} /></button>
            </div>
            <DetailBlock title={`Critérios SIRS/Sepse (${f.total_criterios}/12)`}>
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

const PIE_COLORS = ["#0e6b6b", "#c9741b", "#b3392c", "#3a6ea5", "#7a5195", "#1f7a4c", "#e6a01f", "#4c6570", "#9c4e2e", "#2f8f8f"];

function PainelTab({ refreshKey }) {
  const [de, setDe] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  });
  const [ate, setAte] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.painel(de, ate)
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [de, ate, refreshKey]);

  const byDay = data?.byDay || [];
  const byFoco = data?.byFoco || [];
  const byAtb = data?.byAtb || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <SectionTitle icon={<BarChart3 size={16} />} title="Período de análise" />
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Field label="De"><input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={inputStyle} /></Field>
          <Field label="Até"><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={inputStyle} /></Field>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 16, flexWrap: "wrap" }}>
          <Stat label="Fichas no período" value={loading ? "…" : (data?.periodoCount ?? 0)} />
          <Stat label="Média de critérios/ficha" value={loading ? "…" : (data?.avgCriteria ?? 0)} />
          <Stat label="Focos de infecção distintos" value={loading ? "…" : (data?.focosDistintos ?? 0)} />
        </div>
      </Card>

      <Card>
        <SectionTitle icon={<Activity size={16} />} title="Fichas abertas por dia" />
        {byDay.length ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
              <XAxis dataKey="data" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke={C.teal} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <EmptyChart />}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 16 }}>
        <Card>
          <SectionTitle icon={<Activity size={16} />} title="Foco de infecção" />
          {byFoco.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={byFoco} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} label={({ value }) => value}>
                  {byFoco.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
        <Card>
          <SectionTitle icon={<ShieldCheck size={16} />} title="Antibióticos mais usados" />
          {byAtb.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byAtb} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10.5 }} />
                <Tooltip />
                <Bar dataKey="total" fill={C.teal} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart />}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 800, color: C.tealDark }}>{value}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>{label}</div>
    </div>
  );
}
function EmptyChart() {
  return <div style={{ padding: 40, textAlign: "center", color: C.inkSoft, fontSize: 13 }}>Sem dados suficientes para o período selecionado.</div>;
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
    try {
      await api.createUser(form);
      setForm({ nome: "", crm: "", email: "", senha: "" });
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(crm) {
    await api.toggleUserActive(crm);
    reload();
  }

  async function resetPassword(crm, novaSenha) {
    await api.resetUserPassword(crm, novaSenha);
    setEditing(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 760 }}>
      <Card>
        <SectionTitle icon={<UserPlus size={16} />} title="Cadastrar novo médico" />
        <form onSubmit={addUser}>
          <div style={grid2}>
            <Field label="Nome completo"><input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} style={inputStyle} /></Field>
            <Field label="CRM"><input value={form.crm} onChange={(e) => setForm({ ...form, crm: e.target.value })} style={inputStyle} placeholder="Ex: 12.345" /></Field>
            <Field label="E-mail (opcional)"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} /></Field>
            <Field label="Senha provisória"><input value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} style={inputStyle} /></Field>
          </div>
          {error && <ErrorLine text={error} />}
          <button type="submit" style={{ ...primaryBtn, width: "auto", padding: "10px 22px", marginTop: 16, display: "inline-flex", gap: 8, alignItems: "center" }}>
            <Plus size={16} /> Adicionar médico
          </button>
        </form>
      </Card>

      <Card style={{ padding: 0 }}>
        <div style={{ padding: "16px 20px 4px" }}>
          <SectionTitle icon={<Users size={16} />} title={`Médicos cadastrados (${list.length})`} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#eef4f4", textAlign: "left" }}>
                {["Nome", "CRM", "Perfil", "Status", "Ações"].map((h) => <th key={h} style={{ padding: "10px 14px" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} style={{ padding: 20, textAlign: "center", color: C.inkSoft }}>Carregando…</td></tr>}
              {!loading && list.map((u) => (
                <tr key={u.crm} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={td}>{u.nome}</td>
                  <td style={td}>{u.crm}</td>
                  <td style={td}>{u.role === "master" ? <Badge tone="amber">Master</Badge> : <Badge>Médico</Badge>}</td>
                  <td style={td}>{u.active ? <Badge tone="green">Ativo</Badge> : <Badge tone="red">Inativo</Badge>}</td>
                  <td style={td}>
                    {u.role !== "master" && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => toggleActive(u.crm)} style={{ ...secondaryBtn, padding: "5px 10px", fontSize: 12 }}>{u.active ? "Desativar" : "Ativar"}</button>
                        <button onClick={() => setEditing(u.crm)} style={{ ...secondaryBtn, padding: "5px 10px", fontSize: 12 }}>Redefinir senha</button>
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
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,42,51,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, maxWidth: 360, width: "100%", padding: 22 }}>
        <h3 style={{ marginTop: 0, color: C.ink, fontSize: 15 }}>Redefinir senha — CRM {crm}</h3>
        <label style={{ ...labelStyle, marginTop: 4 }}>Nova senha</label>
        <input value={pw} onChange={(e) => setPw(e.target.value)} style={inputStyle} />
        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ ...secondaryBtn, flex: 1, justifyContent: "center" }}>Cancelar</button>
          <button onClick={() => pw.trim() && onConfirm(pw.trim())} style={{ ...primaryBtn, flex: 1, marginTop: 0 }}>Salvar</button>
        </div>
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
  const [tab, setTab] = useState("nova");
  const [summary, setSummary] = useState({ todayCount: 0, monthCount: 0, totalFichas: 0, activeMedicos: 0 });
  const [refreshKey, setRefreshKey] = useState(0);

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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.inkSoft, fontFamily: "system-ui" }}>
        Carregando…
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen needsBootstrap={needsBootstrap} onAuthenticated={handleAuthenticated} />;
  }

  const isMaster = currentUser.role === "master";

  const TABS = [
    { id: "nova", label: "Nova ficha", icon: <ClipboardList size={16} /> },
    { id: "historico", label: "Histórico", icon: <Search size={16} /> },
    { id: "painel", label: "Painel analítico", icon: <BarChart3 size={16} /> },
    ...(isMaster ? [{ id: "admin", label: "Administração", icon: <Users size={16} /> }] : []),
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif", color: C.ink }}>
      <div style={{ background: C.tealDark, color: "#fff", padding: "14px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Activity size={22} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Protocolo Sepse</div>
              <div style={{ fontSize: 11.5, opacity: 0.75 }}>Hospital Cardio Pulmonar · Rede D'Or São Luiz</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{currentUser.name}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>CRM {currentUser.crm}</div>
            </div>
            <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 8, padding: 8, cursor: "pointer", display: "flex" }} title="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 20px 0" }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
          <MiniStat label="Fichas hoje" value={summary.todayCount} />
          <MiniStat label="Fichas no mês atual" value={summary.monthCount} />
          <MiniStat label="Total geral de fichas" value={summary.totalFichas} />
          <MiniStat label="Médicos ativos" value={summary.activeMedicos} />
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
        {tab === "nova" && <NovaFichaTab user={currentUser} onSaved={handleFichaSaved} />}
        {tab === "historico" && <HistoricoTab refreshKey={refreshKey} />}
        {tab === "painel" && <PainelTab refreshKey={refreshKey} />}
        {tab === "admin" && isMaster && <AdminTab />}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 18px", minWidth: 140 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.tealDark }}>{value}</div>
      <div style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function tabBtn(active) {
  return {
    display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", background: "none",
    border: "none", borderBottom: active ? `2.5px solid ${C.teal}` : "2.5px solid transparent",
    color: active ? C.tealDark : C.inkSoft, fontWeight: active ? 800 : 600, fontSize: 13.5,
    cursor: "pointer", whiteSpace: "nowrap",
  };
}
