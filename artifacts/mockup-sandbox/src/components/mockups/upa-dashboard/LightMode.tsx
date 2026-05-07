import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { icon: "🏠", label: "Painel Principal", active: true },
  { icon: "📋", label: "Fila de Atendimento", active: false },
  { icon: "🩺", label: "Triagem", active: false },
  { icon: "🚪", label: "Consultórios", active: false },
  { icon: "💊", label: "Medicação", active: false },
  { icon: "🛏", label: "Observação", active: false },
  { icon: "🚨", label: "Sala Vermelha", active: false },
  { icon: "🔬", label: "Exames", active: false },
  { icon: "🏥", label: "Internações", active: false },
  { icon: "✅", label: "Altas e Encerramentos", active: false },
  { icon: "📁", label: "Histórico de Pacientes", active: false },
  { icon: "📊", label: "Relatórios", active: false },
  { icon: "⚙️", label: "Configurações", active: false },
];

const SECTOR_TABS = [
  { id: "todos", label: "Todos", count: 1 },
  { id: "recepcao", label: "Recepção", count: 0 },
  { id: "consultorios", label: "Consultórios", count: 0 },
  { id: "medicacao", label: "Medicação", count: 1 },
  { id: "obs-adulto", label: "Obs. Adulto", count: 0 },
  { id: "obs-pediatrica", label: "Obs. Pediátrica", count: 0 },
  { id: "obs-pre-adulto", label: "Obs. Pré-Adulto", count: 0 },
  { id: "sala-vermelha", label: "Sala Vermelha", count: 0 },
];

const SECTORS = [
  {
    id: "triagem",
    label: "TRIAGEM",
    dot: "#1E88E5",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    count: 1,
    patients: [
      {
        name: "AIDA OLIVEIRA DE ARAUJO",
        age: "48a",
        triage: "Azul",
        triageColor: "#60A5FA",
        triageBg: "#EFF6FF",
        tag: "Ag. Exames",
        tagColor: "#7C3AED",
        tagBg: "#EDE9FE",
        diagnosis: "AVC INESPECÍFICO",
        location: "—",
      },
    ],
  },
  {
    id: "sala-vermelha",
    label: "SALA VERMELHA",
    dot: "#E53935",
    bg: "#FFF5F5",
    border: "#FECACA",
    count: 0,
    patients: [],
  },
  {
    id: "obs-adulto",
    label: "OBSERVAÇÃO ADULTO",
    dot: "#F9A825",
    bg: "#FFFBEB",
    border: "#FDE68A",
    count: 0,
    patients: [],
  },
  {
    id: "obs-pediatrica",
    label: "OBSERVAÇÃO PEDIÁTRICA",
    dot: "#43A047",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    count: 0,
    patients: [],
  },
  {
    id: "obs-pre-adulto",
    label: "OBSERVAÇÃO PRÉ-ADULTO",
    dot: "#1E88E5",
    bg: "#EFF6FF",
    border: "#BFDBFE",
    count: 0,
    patients: [],
  },
];

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const days = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const date = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const day = days[now.getDay()];
  return (
    <div style={{ textAlign: "right", lineHeight: 1.3 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#1F2937", letterSpacing: 1 }}>{time}</div>
      <div style={{ fontSize: 11, color: "#6B7280" }}>{date}</div>
      <div style={{ fontSize: 11, color: "#6B7280" }}>{day}</div>
    </div>
  );
}

function TriageBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 99,
      background: bg, color, fontSize: 11, fontWeight: 700, border: `1px solid ${color}30`
    }}>{label}</span>
  );
}

function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 99,
      background: bg, color, fontSize: 11, fontWeight: 600
    }}>{label}</span>
  );
}

function SectorBlock({ sector }: { sector: typeof SECTORS[0] }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: 10, borderRadius: 10, overflow: "hidden", border: `1px solid ${sector.border}`, background: "#fff" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", cursor: "pointer", background: sector.bg,
          borderBottom: open && sector.patients.length > 0 ? `1px solid ${sector.border}` : "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: sector.dot, display: "inline-block" }} />
          <span style={{ fontWeight: 700, fontSize: 12, color: "#374151", letterSpacing: 0.5 }}>{sector.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            background: sector.count > 0 ? sector.dot : "#E5E7EB",
            color: sector.count > 0 ? "#fff" : "#9CA3AF",
            borderRadius: 99, padding: "1px 10px", fontSize: 12, fontWeight: 700
          }}>{sector.count}</span>
          <span style={{ color: "#9CA3AF", fontSize: 14 }}>{open ? "∧" : "∨"}</span>
        </div>
      </div>
      {open && (
        sector.patients.length === 0 ? (
          <div style={{ padding: "14px 16px", color: "#9CA3AF", fontSize: 13, textAlign: "center" }}>
            Nenhum paciente
          </div>
        ) : (
          sector.patients.map((p, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", padding: "10px 16px", gap: 12,
              borderBottom: i < sector.patients.length - 1 ? "1px solid #F3F4F6" : "none",
              background: "#fff"
            }}>
              <span style={{ fontSize: 18, opacity: 0.4 }}>🛏</span>
              <TriageBadge label={p.triage} color={p.triageColor} bg={p.triageBg} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#1F2937", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {p.name}
                  <span style={{ fontWeight: 400, fontSize: 12, color: "#6B7280" }}>{p.age}</span>
                  {p.tag && <Tag label={p.tag} color={p.tagColor} bg={p.tagBg} />}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{p.diagnosis}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#6B7280", fontSize: 14 }}>↻</button>
                <button style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#6B7280", fontSize: 14 }}>✎</button>
                <button style={{ background: "#F3F4F6", border: "none", borderRadius: 6, padding: "5px 8px", cursor: "pointer", color: "#6B7280", fontSize: 14 }}>→</button>
              </div>
            </div>
          ))
        )
      )}
    </div>
  );
}

export function LightMode() {
  const [activeTab, setActiveTab] = useState("todos");

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh", width: "100%",
      fontFamily: "'Inter', 'Segoe UI', sans-serif", background: "#F5F7FA", color: "#1F2937", overflow: "hidden"
    }}>
      {/* TOP HEADER */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 24px",
        height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0, zIndex: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)"
      }}>
        {/* Logo + Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            background: "#1E88E5", color: "#fff", borderRadius: 8,
            padding: "4px 10px", fontWeight: 900, fontSize: 16, lineHeight: 1.2,
            letterSpacing: 0.5, flexShrink: 0
          }}>
            <div>UPA</div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>24h</div>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "#1F2937", letterSpacing: 0.2 }}>UPA BREVES</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>SEMSA — Prefeitura Municipal de Breves</div>
            <div style={{ fontSize: 10, color: "#9CA3AF" }}>Gestão de Pacientes</div>
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {["Fila Médica", "Laboratório", "Histórico", "Leitos", "Passagem de Plantão"].map((item) => (
            <button key={item} style={{
              background: "none", border: "none", padding: "6px 12px",
              borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 500,
              color: "#374151", display: "flex", alignItems: "center", gap: 5,
              transition: "background 0.15s"
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#F3F4F6")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}
            >
              {item === "Fila Médica" && "👨‍⚕️"}
              {item === "Laboratório" && "🔬"}
              {item === "Histórico" && "📋"}
              {item === "Leitos" && "🛏"}
              {item === "Passagem de Plantão" && "📋"}
              {item}
            </button>
          ))}
        </nav>

        {/* Right: bell + clock + user */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative" }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#6B7280" }}>🔔</button>
            <span style={{
              position: "absolute", top: -2, right: -2, background: "#E53935", color: "#fff",
              borderRadius: "50%", width: 16, height: 16, fontSize: 9, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>1</span>
          </div>
          <Clock />
          <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: "1px solid #E5E7EB", paddingLeft: 20 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", background: "#E3F2FD",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
            }}>👤</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: "#1F2937" }}>Dr. Marcus Yan</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>Médico · CRM 12345</div>
            </div>
            <span style={{ color: "#9CA3AF", fontSize: 12 }}>▾</span>
          </div>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* LEFT SIDEBAR */}
        <aside style={{
          width: 200, background: "#fff", borderRight: "1px solid #E5E7EB",
          display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden"
        }}>
          <nav style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
            {NAV_ITEMS.map((item) => (
              <button key={item.label} style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "9px 16px", border: "none", cursor: "pointer", textAlign: "left",
                fontSize: 12, fontWeight: item.active ? 700 : 500,
                background: item.active ? "#EBF5FB" : "none",
                color: item.active ? "#1E88E5" : "#374151",
                borderLeft: item.active ? "3px solid #1E88E5" : "3px solid transparent",
                transition: "all 0.15s"
              }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          {/* User status footer */}
          <div style={{
            padding: "12px 16px", borderTop: "1px solid #E5E7EB",
            display: "flex", alignItems: "center", gap: 8
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%", background: "#E3F2FD",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14
            }}>👤</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#1F2937" }}>Dr. Marcus Yan</div>
              <div style={{ fontSize: 10, color: "#6B7280" }}>Médico</div>
            </div>
          </div>
          <div style={{ padding: "4px 16px 12px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#43A047", display: "inline-block" }} />
            <span style={{ fontSize: 11, color: "#43A047", fontWeight: 600 }}>Online</span>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ flex: 1, overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* SUMMARY CARDS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { label: "Pacientes na Fila", sub: "Aguardando atendimento", value: 12, icon: "👥", color: "#1E88E5", bg: "#EFF6FF", border: "#BFDBFE" },
              { label: "Em Atendimento", sub: "Consultórios 1 e 2", value: 8, icon: "👨‍⚕️", color: "#43A047", bg: "#F0FDF4", border: "#BBF7D0" },
              { label: "Em Observação", sub: "Aguardando reavaliação", value: 15, icon: "🔔", color: "#F9A825", bg: "#FFFBEB", border: "#FDE68A" },
              { label: "Sala Vermelha", sub: "Pacientes críticos", value: 2, icon: "🛡", color: "#E53935", bg: "#FFF5F5", border: "#FECACA" },
            ].map((card) => (
              <div key={card.label} style={{
                background: "#fff", borderRadius: 12, padding: "16px 18px",
                border: `1px solid ${card.border}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                display: "flex", alignItems: "center", gap: 14
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, background: card.bg,
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0
                }}>{card.icon}</div>
                <div>
                  <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 500 }}>{card.label}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1.1 }}>{String(card.value).padStart(2, "0")}</div>
                  <div style={{ fontSize: 10, color: "#9CA3AF" }}>{card.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* SEARCH + FILTER BAR */}
          <div style={{
            background: "#fff", borderRadius: 10, padding: "12px 16px",
            border: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 8,
              background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px"
            }}>
              <span style={{ color: "#9CA3AF", fontSize: 15 }}>🔍</span>
              <input
                placeholder="Buscar nome ou leito..."
                style={{
                  border: "none", background: "none", outline: "none",
                  fontSize: 13, color: "#1F2937", width: "100%"
                }}
              />
            </div>
            <button style={{
              background: "none", border: "1px solid #E5E7EB", borderRadius: 8,
              padding: "8px 12px", cursor: "pointer", color: "#6B7280", fontSize: 13,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <span>⚡</span> Exames
            </button>
            <button style={{
              background: "#1E88E5", color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600
            }}>
              Por Setor
            </button>
            <button style={{
              background: "none", border: "1px solid #E5E7EB", borderRadius: 8,
              padding: "8px 14px", cursor: "pointer", fontSize: 13, color: "#6B7280"
            }}>
              Por Status
            </button>
          </div>

          {/* SECTOR TABS */}
          <div style={{
            background: "#fff", borderRadius: 10, padding: "10px 14px",
            border: "1px solid #E5E7EB", display: "flex", gap: 6, flexWrap: "wrap",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)"
          }}>
            {SECTOR_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: "6px 14px", border: "1px solid",
                  borderColor: activeTab === tab.id ? "#1E88E5" : "#E5E7EB",
                  borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 600,
                  background: activeTab === tab.id ? "#EBF5FB" : "#F9FAFB",
                  color: activeTab === tab.id ? "#1E88E5" : "#374151",
                  display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s"
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span style={{
                    background: activeTab === tab.id ? "#1E88E5" : "#E5E7EB",
                    color: activeTab === tab.id ? "#fff" : "#6B7280",
                    borderRadius: 99, padding: "0 6px", fontSize: 11, fontWeight: 700
                  }}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* PATIENT COUNT HEADER */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", letterSpacing: 0.8, textTransform: "uppercase" }}>
              Pacientes Ativos <span style={{
                background: "#1E88E5", color: "#fff", borderRadius: 99,
                padding: "1px 8px", fontSize: 11, marginLeft: 6
              }}>1</span>
            </div>
            <button style={{
              background: "#1E88E5", color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 6
            }}>
              + Nova Admissão
            </button>
          </div>

          {/* SECTOR BLOCKS */}
          {SECTORS.map((s) => <SectorBlock key={s.id} sector={s} />)}

          {/* FOOTER */}
          <div style={{
            borderTop: "1px solid #E5E7EB", marginTop: 4, paddingTop: 12,
            display: "flex", justifyContent: "space-between", color: "#9CA3AF", fontSize: 11
          }}>
            <span>Sistema de Gestão Hospitalar — UPA Breves</span>
            <span>Versão 2.5.0 &nbsp; © 2025 SEMSA — Prefeitura Municipal de Breves</span>
          </div>
        </main>
      </div>
    </div>
  );
}
