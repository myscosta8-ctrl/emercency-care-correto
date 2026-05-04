-- ============================================================
--  UPA Breves — PARTE 2 de 4: Defaults, Chaves e Índices
--  Execute DEPOIS da Parte 1
-- ============================================================

-- Defaults das sequences
ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);
ALTER TABLE ONLY public.beds ALTER COLUMN id SET DEFAULT nextval('public.beds_id_seq'::regclass);
ALTER TABLE ONLY public.exam_results ALTER COLUMN id SET DEFAULT nextval('public.exam_results_id_seq'::regclass);
ALTER TABLE ONLY public.nutritional_assessments ALTER COLUMN id SET DEFAULT nextval('public.nutritional_assessments_id_seq'::regclass);
ALTER TABLE ONLY public.patient_devices ALTER COLUMN id SET DEFAULT nextval('public.patient_devices_id_seq'::regclass);
ALTER TABLE ONLY public.patient_evolutions ALTER COLUMN id SET DEFAULT nextval('public.patient_evolutions_id_seq'::regclass);
ALTER TABLE ONLY public.patient_exam_requests ALTER COLUMN id SET DEFAULT nextval('public.patient_exam_requests_id_seq'::regclass);
ALTER TABLE ONLY public.patient_notifications ALTER COLUMN id SET DEFAULT nextval('public.patient_notifications_id_seq'::regclass);
ALTER TABLE ONLY public.patient_prescriptions ALTER COLUMN id SET DEFAULT nextval('public.patient_prescriptions_id_seq'::regclass);
ALTER TABLE ONLY public.patient_tasks ALTER COLUMN id SET DEFAULT nextval('public.patient_tasks_id_seq'::regclass);
ALTER TABLE ONLY public.patients ALTER COLUMN id SET DEFAULT nextval('public.patients_id_seq'::regclass);
ALTER TABLE ONLY public.pharmacy_entries ALTER COLUMN id SET DEFAULT nextval('public.pharmacy_entries_id_seq'::regclass);
ALTER TABLE ONLY public.social_notes ALTER COLUMN id SET DEFAULT nextval('public.social_notes_id_seq'::regclass);
ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);
ALTER TABLE ONLY public.transfers ALTER COLUMN id SET DEFAULT nextval('public.transfers_id_seq'::regclass);
ALTER TABLE ONLY public.vitals ALTER COLUMN id SET DEFAULT nextval('public.vitals_id_seq'::regclass);

-- Chaves primárias (PRIMARY KEY)
ALTER TABLE ONLY public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.beds ADD CONSTRAINT beds_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.exam_results ADD CONSTRAINT exam_results_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.nutritional_assessments ADD CONSTRAINT nutritional_assessments_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.password_resets ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.patient_devices ADD CONSTRAINT patient_devices_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.patient_evolutions ADD CONSTRAINT patient_evolutions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.patient_exam_requests ADD CONSTRAINT patient_exam_requests_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.patient_notifications ADD CONSTRAINT patient_notifications_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.patient_prescriptions ADD CONSTRAINT patient_prescriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.patient_tasks ADD CONSTRAINT patient_tasks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.patients ADD CONSTRAINT patients_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.pharmacy_entries ADD CONSTRAINT pharmacy_entries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.social_notes ADD CONSTRAINT social_notes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.staff ADD CONSTRAINT staff_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.transfers ADD CONSTRAINT transfers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.vitals ADD CONSTRAINT vitals_pkey PRIMARY KEY (id);

-- Restrições UNIQUE
ALTER TABLE ONLY public.beds ADD CONSTRAINT beds_bed_id_unique UNIQUE (bed_id);
ALTER TABLE ONLY public.password_resets ADD CONSTRAINT password_resets_token_unique UNIQUE (token);
ALTER TABLE ONLY public.staff ADD CONSTRAINT staff_login_unique UNIQUE (login);

-- Chaves estrangeiras (FOREIGN KEY)
ALTER TABLE ONLY public.beds
    ADD CONSTRAINT beds_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.nutritional_assessments
    ADD CONSTRAINT nutritional_assessments_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_user_id_staff_id_fk FOREIGN KEY (user_id) REFERENCES public.staff(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.patient_devices
    ADD CONSTRAINT patient_devices_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.patient_evolutions
    ADD CONSTRAINT patient_evolutions_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.patient_exam_requests
    ADD CONSTRAINT patient_exam_requests_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.patient_exam_requests
    ADD CONSTRAINT patient_exam_requests_prescription_id_patient_prescriptions_id_ FOREIGN KEY (prescription_id) REFERENCES public.patient_prescriptions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.patient_notifications
    ADD CONSTRAINT patient_notifications_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.patient_prescriptions
    ADD CONSTRAINT patient_prescriptions_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.patient_tasks
    ADD CONSTRAINT patient_tasks_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.pharmacy_entries
    ADD CONSTRAINT pharmacy_entries_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.social_notes
    ADD CONSTRAINT social_notes_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_patient_id_patients_id_fk FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;
