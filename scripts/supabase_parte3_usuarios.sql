-- ============================================================
--  UPA Breves — PARTE 3 de 4: Usuários (OBRIGATÓRIO PARA LOGIN)
--  Execute DEPOIS das Partes 1 e 2
--  Esta parte cria os usuários de acesso ao sistema
-- ============================================================

-- Usuários do sistema
-- Login: myscosta8@gmail.com  | Senha: (hash SHA256 existente)
-- Login: admin                | Senha: admin123
-- Login: newadmin99           | Senha: (hash SHA256 existente)

INSERT INTO public.staff (id, name, role, coren_crm, sector, login, password_hash, access_levels, signature, stamp, created_at, updated_at, email, active, must_change_password, setores_atuacao, turno, consultorio) VALUES
(1, 'Marcus Yan dos Santos Costa', 'enfermeiro', '577662', 'todos_os_setores', 'myscosta8@gmail.com', '662dbf0dcb47fe63d56fb415beebbfb7ea8fab0ba129f4581b98e1412c1b62e8', 'assistencial,admin,coordenacao_enfermagem', '', 'Marcus Yan dos Santos Costa
Enfermeiro
COREN: 577662
todos_os_setores', '2026-05-03 13:35:30.242128', '2026-05-03 13:35:30.242128', 'myscosta8@gmail.com', true, false, 'todos', '', ''),
(2, 'Administrador', 'administrador', 'ADM-001', 'Administração', 'admin', '86a51ca7f81768d3e5c429fa9963fb2e8fd5db934688018af3dcf6997a6c13dc', '', '', '', '2026-05-03 14:28:20.936512', '2026-05-03 14:28:20.936512', '', true, false, 'todos', '', ''),
(3, 'AdminTest', 'administrador', '', '', 'newadmin99', '76d9c1973e19397b8d5c025c7746550b904d09cfe0522f8fdc2a996a1a580ad6', '', '', '', '2026-05-03 14:59:46.123087', '2026-05-03 14:59:46.123087', '', true, false, 'todos', '', ''),
(5, 'Enfermeiro Teste', 'enfermeiro', '', '', 'enfteste', '$2b$12$1CpwHDGM0Gy8/gW7Mlpjt.vd4W0sHkab1TSa/eAcSLk3O19C./V3u', '', '', '', '2026-05-03 15:47:54.791785', '2026-05-03 16:43:33', '', true, false, 'todos', '', '');

-- Atualiza a sequence para continuar do ID correto
SELECT setval('public.staff_id_seq', (SELECT MAX(id) FROM public.staff));
