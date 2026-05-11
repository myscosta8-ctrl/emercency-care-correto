import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const patientNursingFormsTable = pgTable("patient_nursing_forms", {
  id:        serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),

  // 2. Dados do Atendimento
  dataAtendimento:      text("data_atendimento").notNull().default(""),
  horaAtendimento:      text("hora_atendimento").notNull().default(""),
  classificacaoRisco:   text("classificacao_risco").notNull().default(""),
  origemPaciente:       jsonb("origem_paciente").$type<string[]>().notNull().default([]),
  origemOutro:          text("origem_outro").notNull().default(""),
  setor:                text("setor").notNull().default(""),
  enfermeiroResponsavel: text("enfermeiro_responsavel").notNull().default(""),
  coren:                text("coren").notNull().default(""),

  // 3. Queixa Principal
  queixaPrincipal: jsonb("queixa_principal").$type<string[]>().notNull().default([]),
  queixaOutros:    text("queixa_outros").notNull().default(""),

  // 4. História Clínica
  historiaClinica:      jsonb("historia_clinica").$type<string[]>().notNull().default([]),
  historiaObservacoes:  text("historia_observacoes").notNull().default(""),

  // 5. Sinais Vitais
  svPa:       text("sv_pa").notNull().default(""),
  svFc:       text("sv_fc").notNull().default(""),
  svFr:       text("sv_fr").notNull().default(""),
  svSpo2:     text("sv_spo2").notNull().default(""),
  svTemp:     text("sv_temp").notNull().default(""),
  svGlicemia: text("sv_glicemia").notNull().default(""),
  svEva:      text("sv_eva").notNull().default(""),

  // 6. Avaliação Geral
  avaliacaoEstadoGeral: text("avaliacao_estado_geral").notNull().default(""),
  avaliacaoConsciencia: jsonb("avaliacao_consciencia").$type<string[]>().notNull().default([]),
  avaliacaoPele:        jsonb("avaliacao_pele").$type<string[]>().notNull().default([]),
  avaliacaoRespiracao:  jsonb("avaliacao_respiracao").$type<string[]>().notNull().default([]),
  avaliacaoPerfusao:    jsonb("avaliacao_perfusao").$type<string[]>().notNull().default([]),
  avaliacaoMobilidade:  jsonb("avaliacao_mobilidade").$type<string[]>().notNull().default([]),
  tecCapilar:           text("tec_capilar").notNull().default(""),

  // 7. Antecedentes / Comorbidades
  antecedentes:       jsonb("antecedentes").$type<string[]>().notNull().default([]),
  antecedentesOutros: text("antecedentes_outros").notNull().default(""),

  // 8. Alergias
  alergia:     text("alergia").notNull().default("nao"),
  alergiaQual: text("alergia_qual").notNull().default(""),

  // 9. Uso Contínuo de Medicações
  medicacaoContinua:       text("medicacao_continua").notNull().default("nao"),
  medicacaoContinuaQuais:  text("medicacao_continua_quais").notNull().default(""),

  // 10. Procedimentos Realizados
  procedimentos:       jsonb("procedimentos").$type<string[]>().notNull().default([]),
  procedimentosOutros: text("procedimentos_outros").notNull().default(""),

  // 11. Medicações Administradas (array of {medicacao, dose, via, horario, enfermeiro})
  medicacoesAdministradas: jsonb("medicacoes_administradas")
    .$type<Array<{ medicacao: string; dose: string; via: string; horario: string; enfermeiro: string }>>()
    .notNull().default([]),

  // 12. Evolução de Enfermagem
  evolucaoEnfermagem:  jsonb("evolucao_enfermagem").$type<string[]>().notNull().default([]),
  intercorrenciaQual:  text("intercorrencia_qual").notNull().default(""),
  evolucaoObservacoes: text("evolucao_observacoes").notNull().default(""),

  // 13. Conduta
  conduta:            jsonb("conduta").$type<string[]>().notNull().default([]),
  condutaObservacoes: text("conduta_observacoes").notNull().default(""),

  // 14. Assinatura
  assinaturaEnfermeiro: text("assinatura_enfermeiro").notNull().default(""),
  assinaturaCoren:      text("assinatura_coren").notNull().default(""),
  assinaturaData:       text("assinatura_data").notNull().default(""),

  createdBy: integer("created_by").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
