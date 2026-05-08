import { useState } from "react";

const TRIAGE_COLOR = "#dc2626"; // Vermelho

const GROUPS = [
  {
    id: "clinico",
    icon: "📋",
    label: "Clínico",
    desc: "Resumo e dados do paciente",
    color: "#3b82f6",
    tabs: [
      { id: "resumo", label: "Resumo Clínico", icon: "🗂️" },
      { id: "admissao", label: "Admissão", icon: "📝" },
      { id: "vitais", label: "Sinais Vitais", icon: "❤️" },
      { id: "timeline", label: "Linha do Tempo", icon: "🕐" },
    ],
  },
  {
    id: "evolucao",
    icon: "🩺",
    label: "Evolução",
    desc: "Registros multiprofissionais",
    color: "#8b5cf6",
    tabs: [
      { id: "medico", label: "Evolução Médica", icon: "👨‍⚕️" },
      { id: "enfermagem", label: "Enfermagem", icon: "💉" },
      { id: "sae", label: "SAE", icon: "📊" },
      { id: "tecnico", label: "Técnico Enf.", icon: "🩹" },
      { id: "social", label: "Serviço Social", icon: "🤝" },
      { id: "nutricao", label: "Nutrição", icon: "🥗" },
    ],
  },
  {
    id: "tratamento",
    icon: "💊",
    label: "Tratamento",
    desc: "Prescrições e exames",
    color: "#10b981",
    tabs: [
      { id: "prescricao", label: "Prescrição", icon: "📄" },
      { id: "exames", label: "Sol. Exames", icon: "🔬" },
      { id: "laboratorio", label: "Laboratório", icon: "🧪" },
      { id: "farmacia", label: "Farmácia", icon: "💊" },
      { id: "dispositivos", label: "Dispositivos", icon: "🩺" },
    ],
  },
  {
    id: "internacao",
    icon: "🏥",
    label: "Internação",
    desc: "Fluxo e documentos",
    color: "#f59e0b",
    tabs: [
      { id: "regulacao", label: "Regulação / NIR", icon: "📡" },
      { id: "transferencia", label: "Transferência", icon: "🚑" },
      { id: "sinan", label: "SINAN", icon: "📋" },
      { id: "procedimentos", label: "Procedimentos", icon: "⚙️" },
      { id: "tcle", label: "TCLE", icon: "✍️" },
      { id: "obito", label: "Óbito", icon: "⚠️", danger: true },
    ],
  },
];

const CONTENT_PLACEHOLDERS: Record<string, { title: string; body: string }> = {
  resumo: {
    title: "Resumo Clínico",
    body: "Visão consolidada: dados de admissão, últimos sinais vitais, prescrições ativas e última evolução do paciente.",
  },
  admissao: {
    title: "Dados de Admissão",
    body: "Nome completo, CPF, data de nascimento, endereço, responsável, convênio, queixa principal e história clínica.",
  },
  vitais: {
    title: "Sinais Vitais",
    body: "PA: 130/85 mmHg · FC: 98 bpm · FR: 20 irpm · SpO₂: 97% · Temp: 38,2 °C · HGT: 104 mg/dL · Dor: 6/10",
  },
  timeline: {
    title: "Linha do Tempo",
    body: "Todos os eventos do atendimento em ordem cronológica: admissão, triagem, evoluções, prescrições, exames e transferências.",
  },
  medico: {
    title: "Evolução Médica",
    body: "HDA · Exame físico · Hipótese diagnóstica · CID-10 · Conduta médica · Assinatura CRM.",
  },
  enfermagem: {
    title: "Prescrição de Enfermagem",
    body: "Avaliação por sistemas · Diagnósticos NANDA · Prescrição de enfermagem · Resultados esperados · COREN.",
  },
  sae: {
    title: "SAE — Sistematização da Assistência de Enfermagem",
    body: "Processo de enfermagem estruturado com coleta de dados, diagnóstico, planejamento, implementação e avaliação.",
  },
  tecnico: {
    title: "Anotação de Técnico de Enfermagem",
    body: "Turno · Procedimentos realizados · Intercorrências · Observações gerais do turno.",
  },
  social: {
    title: "Serviço Social",
    body: "Moradia · Renda familiar · Composição familiar · Demandas identificadas · Intervenções · Encaminhamentos · CRESS.",
  },
  nutricao: {
    title: "Avaliação Nutricional",
    body: "Peso · Altura · IMC calculado · Via de alimentação · Diagnóstico nutricional · Plano alimentar · CRN.",
  },
  prescricao: {
    title: "Prescrição Médica",
    body: "Dipirona 500mg IV 6/6h · SF 0,9% 500ml EV · Omeprazol 40mg VO 1x/dia · Ondansetrona 4mg IV se náusea.",
  },
  exames: {
    title: "Solicitação de Exames",
    body: "Hemograma completo (urgente) · PCR · Glicemia · Ureia/Creatinina · ECG · Rx Tórax PA.",
  },
  laboratorio: {
    title: "Resultados de Laboratório",
    body: "Inserção de resultados em texto ou upload de arquivo. Exames pendentes são destacados automaticamente.",
  },
  farmacia: {
    title: "Farmácia",
    body: "Dispensação de medicamentos · Controle de estoque · Conferência de prescrições · Registro de entrega.",
  },
  dispositivos: {
    title: "Dispositivos Invasivos",
    body: "Cateter periférico · Sonda vesical · Acesso venoso central · Data de inserção e previsão de troca.",
  },
  regulacao: {
    title: "Regulação / NIR",
    body: "Tipo de regulação · Conteúdo do pedido · Status da vaga · Prioridade · Destino solicitado.",
  },
  transferencia: {
    title: "Transferência",
    body: "Destino · Motivo · Meio de transporte · Documento de referência · Status da regulação.",
  },
  sinan: {
    title: "Notificação SINAN",
    body: "Formulário digital da notificação compulsória preenchível. PDF gerado com dados do paciente (apenas assinaturas em branco).",
  },
  procedimentos: {
    title: "Procedimentos",
    body: "Registro de procedimentos realizados durante o atendimento com data, hora, responsável e intercorrências.",
  },
  tcle: {
    title: "Termo de Consentimento (TCLE)",
    body: "Registro do consentimento informado do paciente ou responsável para procedimentos e internação.",
  },
  obito: {
    title: "Registro de Óbito",
    body: "Hora do óbito · CID-10 causas · Médico declarante · Geração da Declaração de Óbito.",
  },
};

export function GroupedTabs() {
  const [activeGroup, setActiveGroup] = useState("clinico");
  const [activeTab, setActiveTab] = useState("resumo");

  const group = GROUPS.find((g) => g.id === activeGroup)!;
  const content = CONTENT_PLACEHOLDERS[activeTab] ?? {
    title: activeTab,
    body: "Conteúdo desta aba.",
  };

  function selectGroup(gid: string) {
    setActiveGroup(gid);
    const g = GROUPS.find((x) => x.id === gid)!;
    setActiveTab(g.tabs[0].id);
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#0d1117", fontFamily: "system-ui, sans-serif", color: "#e2e8f0" }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          background: "#161b22",
          borderBottom: "1px solid #21262d",
          padding: "10px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            style={{
              background: "none",
              border: "none",
              color: "#8b949e",
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ← Voltar
          </button>
          <div style={{ width: 1, height: 20, background: "#21262d" }} />
          {/* Triage dot */}
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: TRIAGE_COLOR,
              flexShrink: 0,
              boxShadow: "0 0 6px #dc262699",
            }}
          />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#f0f6fc", lineHeight: 1.2 }}>
              MARIA ANTÔNIA SOUZA FERREIRA
            </div>
            <div style={{ fontSize: 11, color: "#8b949e" }}>
              52 anos · Prontuário #000047 · Atend. #000089
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              background: "#21262d",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <span style={{ color: "#8b949e", fontSize: 10 }}>LEITO</span>
            <span style={{ fontWeight: 700, color: "#f0f6fc" }}>A-04</span>
          </div>
          <div
            style={{
              background: "#21262d",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <span style={{ color: "#8b949e", fontSize: 10 }}>STATUS</span>
            <span style={{ fontWeight: 700, color: "#f59e0b" }}>Em Observação</span>
          </div>
          <div
            style={{
              background: "#21262d",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <span style={{ color: "#8b949e", fontSize: 10 }}>TRIAGEM</span>
            <span style={{ fontWeight: 700, color: TRIAGE_COLOR }}>Vermelho</span>
          </div>
          <div
            style={{
              background: "#21262d",
              borderRadius: 8,
              padding: "6px 14px",
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <span style={{ color: "#8b949e", fontSize: 10 }}>INTERNADA HÁ</span>
            <span style={{ fontWeight: 700, color: "#f0f6fc" }}>14h 32m</span>
          </div>
          <button
            style={{
              background: "#21262d",
              border: "1px solid #30363d",
              borderRadius: 8,
              padding: "8px 16px",
              color: "#e2e8f0",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ✏️ Editar
          </button>
          <button
            style={{
              background: "#dc2626",
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Alta
          </button>
        </div>
      </div>

      {/* ── Group tabs ── */}
      <div
        style={{
          background: "#161b22",
          borderBottom: "1px solid #21262d",
          padding: "0 20px",
          display: "flex",
          gap: 4,
        }}
      >
        {GROUPS.map((g) => {
          const active = g.id === activeGroup;
          return (
            <button
              key={g.id}
              onClick={() => selectGroup(g.id)}
              style={{
                background: active ? g.color + "22" : "none",
                border: "none",
                borderBottom: active ? `2px solid ${g.color}` : "2px solid transparent",
                borderRadius: 0,
                padding: "14px 22px",
                color: active ? g.color : "#8b949e",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: active ? 700 : 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 18 }}>{g.icon}</span>
              <div style={{ textAlign: "left" }}>
                <div>{g.label}</div>
                <div style={{ fontSize: 10, color: active ? g.color + "cc" : "#8b949e", fontWeight: 400 }}>
                  {g.desc}
                </div>
              </div>
              <span
                style={{
                  marginLeft: 4,
                  background: active ? g.color : "#21262d",
                  color: active ? "#fff" : "#8b949e",
                  borderRadius: 10,
                  padding: "1px 7px",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {g.tabs.length}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Sub-tabs ── */}
      <div
        style={{
          background: "#0d1117",
          borderBottom: "1px solid #21262d",
          padding: "0 20px",
          display: "flex",
          gap: 2,
          overflowX: "auto",
        }}
      >
        {group.tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: active ? "#21262d" : "none",
                border: "none",
                borderRadius: "6px 6px 0 0",
                padding: "8px 14px",
                color: active ? "#f0f6fc" : "#8b949e",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                borderBottom: active ? `2px solid ${group.color}` : "2px solid transparent",
                transition: "all 0.1s",
                ...(("danger" in tab && tab.danger) ? { color: active ? "#f87171" : "#8b949e" } : {}),
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Content area ── */}
      <div style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Breadcrumb */}
        <div style={{ fontSize: 11, color: "#8b949e", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: group.color }}>{group.icon} {group.label}</span>
          <span>›</span>
          <span style={{ color: "#f0f6fc" }}>{content.title}</span>
        </div>

        {/* Content card */}
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 12,
            padding: 24,
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: "1px solid #21262d",
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#f0f6fc", margin: 0 }}>
              {content.title}
            </h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  background: group.color,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  color: "#fff",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                + Novo Registro
              </button>
              <button
                style={{
                  background: "#21262d",
                  border: "1px solid #30363d",
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: "#8b949e",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                🖨️ Imprimir
              </button>
            </div>
          </div>

          {/* Demo content */}
          <div
            style={{
              background: "#0d1117",
              border: "1px solid #21262d",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              borderLeft: `3px solid ${group.color}`,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, color: "#c9d1d9", lineHeight: 1.7 }}>
              {content.body}
            </p>
          </div>

          {/* Skeleton rows to simulate real content */}
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                background: "#0d1117",
                border: "1px solid #21262d",
                borderRadius: 8,
                padding: "12px 16px",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
                opacity: 1 - i * 0.18,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#21262d", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 12, background: "#21262d", borderRadius: 4, width: `${70 - i * 8}%`, marginBottom: 6 }} />
                <div style={{ height: 10, background: "#21262d", borderRadius: 4, width: `${45 - i * 5}%` }} />
              </div>
              <div style={{ height: 24, width: 60, background: "#21262d", borderRadius: 6 }} />
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div
          style={{
            background: "#161b22",
            border: "1px solid #21262d",
            borderRadius: 8,
            padding: "10px 16px",
            fontSize: 11,
            color: "#8b949e",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: group.color }}>ℹ</span>
          <span>
            Clique nas categorias acima para navegar entre os grupos. As abas secundárias mostram
            apenas o conteúdo relevante para o grupo selecionado.
          </span>
        </div>
      </div>
    </div>
  );
}
