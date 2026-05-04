-- ============================================================
--  UPA Breves — PARTE 4 de 4: Dados de Exemplo (OPCIONAL)
--  Execute DEPOIS das Partes 1, 2 e 3
--  Esta parte insere pacientes e leitos de exemplo
--  Pode pular esta parte se quiser começar com banco limpo
-- ============================================================

-- Pacientes de exemplo
INSERT INTO public.patients (id, full_name, age, bed, diagnosis, triage_level, sector, created_at, updated_at, nurse, internment_status, created_by, updated_by, birth_date, sex, mother_name, cns, cpf, rg, phone, email, symptoms, symptom_onset_date, attendance_date, attendance_time, health_unit, responsible_professional, agravo, data_notificacao, municipio_notificacao, codigo_ibge, evolucao_caso, classificacao_final, criterio_confirmacao, address, care_status, care_status_changed_at, prontuario_number, atendimento_number) VALUES
(1, 'Maria Silva', 0, 'L-01', 'IAM suspeito', 'orange', 'sala_vermelha', '2026-05-03 14:21:09.435474', '2026-05-03 17:09:39.765', '', 'nao_internado', '', '', '', 'O', '', '', '', '', '', '', '', '', '', '', 'UPA Breves - Breves/PA', '', '', '', '', '', '', '', '', '', 'Em Observação', '2026-05-03 17:09:39.765', '', ''),
(3, 'Ana Costa', 72, 'C2', 'AVC Isquêmico', 'orange', 'observacao_adulto', '2026-05-02 15:20:58.475148', '2026-05-02 15:20:58.475148', '', 'nao_internado', '', '', '', 'O', '', '', '', '', '', '', '', '', '', '', 'UPA Breves - Breves/PA', '', '', '', '', '', '', '', '', '', 'Em Triagem', '2026-05-03 17:03:01.718236', '', ''),
(4, 'Carlos Souza', 55, 'D4', 'Crise Hipertensiva', 'orange', 'observacao_adulto', '2026-05-02 15:20:58.475148', '2026-05-02 15:20:58.475148', '', 'nao_internado', '', '', '', 'O', '', '', '', '', '', '', '', '', '', '', 'UPA Breves - Breves/PA', '', '', '', '', '', '', '', '', '', 'Em Triagem', '2026-05-03 17:03:01.718236', '', ''),
(5, 'Lucia Ferreira', 38, 'E1', 'Fratura de Fêmur', 'green', 'observacao_adulto', '2026-05-02 15:20:58.475148', '2026-05-02 15:20:58.475148', '', 'nao_internado', '', '', '', 'O', '', '', '', '', '', '', '', '', '', '', 'UPA Breves - Breves/PA', '', '', '', '', '', '', '', '', '', 'Em Triagem', '2026-05-03 17:03:01.718236', '', ''),
(6, 'Roberto Lima', 62, 'F2', 'Diabetes Descompensada', 'orange', 'observacao_adulto', '2026-05-02 15:20:58.475148', '2026-05-02 15:20:58.475148', '', 'nao_internado', '', '', '', 'O', '', '', '', '', '', '', '', '', '', '', 'UPA Breves - Breves/PA', '', '', '', '', '', '', '', '', '', 'Em Triagem', '2026-05-03 17:03:01.718236', '', ''),
(7, 'Sandra Oliveira', 49, 'G3', 'Apendicite Aguda', 'green', 'observacao_adulto', '2026-05-02 15:20:58.475148', '2026-05-02 15:20:58.475148', '', 'nao_internado', '', '', '', 'O', '', '', '', '', '', '', '', '', '', '', 'UPA Breves - Breves/PA', '', '', '', '', '', '', '', '', '', 'Em Triagem', '2026-05-03 17:03:01.718236', '', ''),
(8, 'Teste CPF Válido', 36, '', '', 'green', 'observacao_adulto', '2026-05-03 12:33:35.93231', '2026-05-03 12:33:35.93', '', 'nao_internado', '', '', '1990-01-01', 'O', '', '', '529.982.247-25', '', '', '', '', '', '', '', 'UPA Breves - Breves/PA', '', '', '', '', '', '', '', '', '', 'Em Triagem', '2026-05-03 17:03:01.718236', '', '');

SELECT setval('public.patients_id_seq', (SELECT MAX(id) FROM public.patients));

-- Leitos
INSERT INTO public.beds (id, bed_id, sector, bed_number, is_isolation, is_occupied, patient_id, isolation_active, isolation_type, isolation_reason, created_at, updated_at, is_extra, extra_reason, admission_time) VALUES
(1,  'VS-01', 'sala_vermelha', 1, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(2,  'VS-02', 'sala_vermelha', 2, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(3,  'VS-03', 'sala_vermelha', 3, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(4,  'VS-04', 'sala_vermelha', 4, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(5,  'OA-01', 'observacao_adulto', 1, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(6,  'OA-02', 'observacao_adulto', 2, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(7,  'OA-03', 'observacao_adulto', 3, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(8,  'OA-04', 'observacao_adulto', 4, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(9,  'OA-05', 'observacao_adulto', 5, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(10, 'OA-06', 'observacao_adulto', 6, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(11, 'OA-07', 'observacao_adulto', 7, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(12, 'OA-08', 'observacao_adulto', 8, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(13, 'OA-09', 'observacao_adulto', 9, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(14, 'OA-10', 'observacao_adulto', 10, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(15, 'OA-11', 'observacao_adulto', 11, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(16, 'OA-12', 'observacao_adulto', 12, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(17, 'OA-13', 'observacao_adulto', 13, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(18, 'OA-14', 'observacao_adulto', 14, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(19, 'OA-15', 'observacao_adulto', 15, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(20, 'OA-16', 'observacao_adulto', 16, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(21, 'OA-ISO', 'observacao_adulto', 17, true, false, NULL, true, 'airborne', 'Suspeita de tuberculose', now(), now(), false, NULL, NULL),
(22, 'OP-01', 'observacao_pediatrica', 1, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(23, 'OP-02', 'observacao_pediatrica', 2, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(24, 'OP-03', 'observacao_pediatrica', 3, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(25, 'OP-04', 'observacao_pediatrica', 4, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(26, 'OP-05', 'observacao_pediatrica', 5, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(27, 'OP-ISO', 'observacao_pediatrica', 6, true, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(28, 'PA-01', 'observacao_pre_adulto', 1, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(29, 'PA-02', 'observacao_pre_adulto', 2, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(30, 'PA-03', 'observacao_pre_adulto', 3, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(31, 'PA-04', 'observacao_pre_adulto', 4, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(32, 'PA-05', 'observacao_pre_adulto', 5, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(33, 'PA-06', 'observacao_pre_adulto', 6, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(34, 'PA-07', 'observacao_pre_adulto', 7, false, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL),
(35, 'PA-ISO', 'observacao_pre_adulto', 8, true, false, NULL, false, NULL, NULL, now(), now(), false, NULL, NULL);

SELECT setval('public.beds_id_seq', (SELECT MAX(id) FROM public.beds));
