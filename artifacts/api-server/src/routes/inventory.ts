import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";

type DbClient = { query: <T extends object = object>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }> };

const router = Router();

// ── seed data from UPA Excel (Pedido UPA 2026) ───────────────────────────────

const SEED_ITEMS: Array<{
  code: string; name: string; unit: string;
  category: string; standard_qty: number; min_qty: number; location: string;
}> = [
  // ── Comprimidos — medicamento ──────────────────────────────────────────────
  { code:"8",   name:"AAS",                           unit:"Comprimidos", category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"71",  name:"Azitromicina 500mg",             unit:"Comprimidos", category:"medicamento",    standard_qty:50,   min_qty:10,  location:"" },
  { code:"33",  name:"Albendazol comp",                unit:"Comprimidos", category:"medicamento",    standard_qty:50,   min_qty:10,  location:"" },
  { code:"53",  name:"Amoxicilina 500mg",              unit:"Comprimidos", category:"medicamento",    standard_qty:60,   min_qty:10,  location:"" },
  { code:"216", name:"Ampicilina 500mg",               unit:"Comprimidos", category:"medicamento",    standard_qty:60,   min_qty:10,  location:"" },
  { code:"68",  name:"Atenolol 25mg",                  unit:"Comprimidos", category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"251", name:"Clopidogrel 75mg",               unit:"Comprimidos", category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"54",  name:"Captopril 25mg/50mg",            unit:"Comprimidos", category:"medicamento",    standard_qty:150,  min_qty:30,  location:"" },
  { code:"364", name:"Cefalexina comp",                unit:"Comprimidos", category:"medicamento",    standard_qty:60,   min_qty:10,  location:"" },
  { code:"217", name:"Ciprofloxacino 500mg",           unit:"Comprimidos", category:"medicamento",    standard_qty:150,  min_qty:30,  location:"" },
  { code:"",    name:"Carvão ativado",                 unit:"Comprimidos", category:"medicamento",    standard_qty:120,  min_qty:20,  location:"" },
  { code:"294", name:"Diclofenaco sódico/potássico",   unit:"Comprimidos", category:"medicamento",    standard_qty:120,  min_qty:20,  location:"" },
  { code:"344", name:"Dipirona comp",                  unit:"Comprimidos", category:"medicamento",    standard_qty:150,  min_qty:30,  location:"" },
  { code:"130", name:"Enalapril",                      unit:"Comprimidos", category:"medicamento",    standard_qty:60,   min_qty:10,  location:"" },
  { code:"131", name:"Fluconazol 150mg",               unit:"Comprimidos", category:"medicamento",    standard_qty:30,   min_qty:5,   location:"" },
  { code:"270", name:"Hidroclorotiazida 25mg",         unit:"Comprimidos", category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"199", name:"Ibuprofeno comprimido",          unit:"Comprimidos", category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"417", name:"Isordil 10mg",                   unit:"Comprimidos", category:"medicamento",    standard_qty:60,   min_qty:10,  location:"" },
  { code:"200", name:"Ivermectina",                    unit:"Comprimidos", category:"medicamento",    standard_qty:50,   min_qty:10,  location:"" },
  { code:"221", name:"Metronidazol comprimido",        unit:"Comprimidos", category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"180", name:"Nifedipino 20mg",                unit:"Comprimidos", category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"245", name:"Omeprazol comp",                 unit:"Comprimidos", category:"medicamento",    standard_qty:50,   min_qty:10,  location:"" },
  { code:"286", name:"Paracetamol",                    unit:"Comprimidos", category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"226", name:"Propranolol 40mg",               unit:"Comprimidos", category:"medicamento",    standard_qty:50,   min_qty:10,  location:"" },
  { code:"218", name:"Simeticona comprimido",          unit:"Comprimidos", category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"155", name:"Sinvastatina 20mg",              unit:"Comprimidos", category:"medicamento",    standard_qty:300,  min_qty:60,  location:"" },
  { code:"227", name:"Sinvastatina 40mg",              unit:"Comprimidos", category:"medicamento",    standard_qty:300,  min_qty:60,  location:"" },
  { code:"277", name:"Losartana 50mg",                 unit:"Comprimidos", category:"medicamento",    standard_qty:150,  min_qty:30,  location:"" },
  { code:"345", name:"Espironolactona 25mg",           unit:"Comprimidos", category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"",    name:"Carvedilol 3.125mg",             unit:"Comprimidos", category:"medicamento",    standard_qty:30,   min_qty:5,   location:"" },
  { code:"",    name:"Carvedilol 6.25mg",              unit:"Comprimidos", category:"medicamento",    standard_qty:30,   min_qty:5,   location:"" },
  // ── Ampolas — medicamento ──────────────────────────────────────────────────
  { code:"321", name:"ABD 10mL",                       unit:"Ampolas",     category:"medicamento",    standard_qty:400,  min_qty:80,  location:"" },
  { code:"16",  name:"Adenosina 3mg/ml",               unit:"Ampolas",     category:"medicamento",    standard_qty:50,   min_qty:10,  location:"" },
  { code:"330", name:"Adrenalina inj",                 unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"297", name:"Amicacina 500mg",                unit:"Ampolas",     category:"medicamento",    standard_qty:50,   min_qty:10,  location:"" },
  { code:"299", name:"Ampicilina 1g",                  unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"73",  name:"Benzilpenicilina Benzatina 1200UI", unit:"Ampolas",  category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"139", name:"Bromoprida",                     unit:"Ampolas",     category:"medicamento",    standard_qty:300,  min_qty:60,  location:"" },
  { code:"196", name:"Butilescopolamina composta inj", unit:"Ampolas",     category:"medicamento",    standard_qty:300,  min_qty:60,  location:"" },
  { code:"94",  name:"Butilescopolamina simples inj",  unit:"Ampolas",     category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"338", name:"Complexo B injetável",           unit:"Ampolas",     category:"medicamento",    standard_qty:400,  min_qty:80,  location:"" },
  { code:"272", name:"Cefalotina 1g",                  unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"289", name:"Ceftriaxona 1g",                 unit:"Ampolas",     category:"medicamento",    standard_qty:300,  min_qty:60,  location:"" },
  { code:"157", name:"Cetoprofeno IM",                 unit:"Ampolas",     category:"medicamento",    standard_qty:300,  min_qty:60,  location:"" },
  { code:"250", name:"Cetoprofeno EV",                 unit:"Ampolas",     category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"985", name:"Cimetidina 2ml",                 unit:"Ampolas",     category:"medicamento",    standard_qty:400,  min_qty:80,  location:"" },
  { code:"203", name:"Dexametasona injetável",         unit:"Ampolas",     category:"medicamento",    standard_qty:1000, min_qty:200, location:"" },
  { code:"328", name:"Diclofenaco injetável",          unit:"Ampolas",     category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"350", name:"Dipirona injetável",             unit:"Ampolas",     category:"medicamento",    standard_qty:1000, min_qty:200, location:"" },
  { code:"1014",name:"Deslanosídeo",                   unit:"Ampolas",     category:"medicamento",    standard_qty:20,   min_qty:5,   location:"" },
  { code:"512", name:"Furosemida 2ml",                 unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"144", name:"Gentamicina 80mg",               unit:"Ampolas",     category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"143", name:"Gentamicina 40mg",               unit:"Ampolas",     category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"142", name:"Gentamicina 20mg",               unit:"Ampolas",     category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"332", name:"Gluconato de cálcio 10%",        unit:"Ampolas",     category:"medicamento",    standard_qty:40,   min_qty:8,   location:"" },
  { code:"167", name:"Hidralazina",                    unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"258", name:"Hidrocortisona 100mg",           unit:"Ampolas",     category:"medicamento",    standard_qty:400,  min_qty:80,  location:"" },
  { code:"351", name:"Hidrocortisona 500mg",           unit:"Ampolas",     category:"medicamento",    standard_qty:400,  min_qty:80,  location:"" },
  { code:"231", name:"Omeprazol EV",                   unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"562", name:"Oxacilina 500mg/1g",             unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"147", name:"Metoclopramida (Plasil)",        unit:"Ampolas",     category:"medicamento",    standard_qty:300,  min_qty:60,  location:"" },
  { code:"208", name:"Prometazina injetável",          unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"9",   name:"Vitamina C",                     unit:"Ampolas",     category:"medicamento",    standard_qty:400,  min_qty:80,  location:"" },
  { code:"255", name:"Vitamina K",                     unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  { code:"160", name:"Cloreto de Sódio 10% 10ml",     unit:"Ampolas",     category:"medicamento",    standard_qty:50,   min_qty:10,  location:"" },
  { code:"198", name:"Cloreto de Potássio KCL",        unit:"Ampolas",     category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"256", name:"Glicose 50%",                    unit:"Ampolas",     category:"medicamento",    standard_qty:400,  min_qty:80,  location:"" },
  { code:"303", name:"Glicose 25%",                    unit:"Ampolas",     category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"248", name:"Ácido Tranexâmico injetável",    unit:"Ampolas",     category:"medicamento",    standard_qty:200,  min_qty:40,  location:"" },
  { code:"145", name:"Lidocaína 2%",                   unit:"Ampolas",     category:"medicamento",    standard_qty:30,   min_qty:5,   location:"" },
  { code:"260", name:"Sulfato de Magnésio",            unit:"Ampolas",     category:"medicamento",    standard_qty:25,   min_qty:5,   location:"" },
  { code:"1108",name:"Sulfato de Salbutamol Aerossol", unit:"Frascos",     category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"932", name:"Clindamicina",                   unit:"Ampolas",     category:"medicamento",    standard_qty:100,  min_qty:20,  location:"" },
  // ── Sala Vermelha ──────────────────────────────────────────────────────────
  { code:"249", name:"Amiodarona injetável",           unit:"Ampolas",     category:"sala_vermelha",  standard_qty:50,   min_qty:10,  location:"Sala Vermelha" },
  { code:"1001",name:"Heparina 5.000 UI",              unit:"Ampolas",     category:"sala_vermelha",  standard_qty:50,   min_qty:10,  location:"Sala Vermelha" },
  { code:"301", name:"Dobutamina injetável",           unit:"Ampolas",     category:"sala_vermelha",  standard_qty:50,   min_qty:10,  location:"Sala Vermelha" },
  { code:"1102",name:"Dopamina injetável",             unit:"Ampolas",     category:"sala_vermelha",  standard_qty:50,   min_qty:10,  location:"Sala Vermelha" },
  { code:"329", name:"Enoxaparina",                    unit:"Ampolas",     category:"sala_vermelha",  standard_qty:50,   min_qty:10,  location:"Sala Vermelha" },
  { code:"150", name:"Terbutalina 0.5mg/ml",           unit:"Ampolas",     category:"sala_vermelha",  standard_qty:20,   min_qty:5,   location:"Sala Vermelha" },
  { code:"212", name:"Metilprednisolona 125mg",        unit:"Ampolas",     category:"sala_vermelha",  standard_qty:100,  min_qty:20,  location:"Sala Vermelha" },
  { code:"752", name:"Noradrenalina",                  unit:"Ampolas",     category:"sala_vermelha",  standard_qty:100,  min_qty:20,  location:"Sala Vermelha" },
  { code:"925", name:"Nitroprussiato de Sódio",        unit:"Ampolas",     category:"sala_vermelha",  standard_qty:30,   min_qty:5,   location:"Sala Vermelha" },
  { code:"252", name:"Succinilcolina 100mg",           unit:"Ampolas",     category:"sala_vermelha",  standard_qty:100,  min_qty:20,  location:"Sala Vermelha" },
  { code:"305", name:"Vancomicina 500mg",              unit:"Ampolas",     category:"sala_vermelha",  standard_qty:50,   min_qty:10,  location:"Sala Vermelha" },
  { code:"",    name:"Atropina",                       unit:"Ampolas",     category:"sala_vermelha",  standard_qty:30,   min_qty:5,   location:"Sala Vermelha" },
  { code:"",    name:"Etilefrina (Efortil)",           unit:"Ampolas",     category:"sala_vermelha",  standard_qty:10,   min_qty:2,   location:"Sala Vermelha" },
  { code:"",    name:"Nitroglicerina (Tridil)",        unit:"Frascos",     category:"sala_vermelha",  standard_qty:30,   min_qty:5,   location:"Sala Vermelha/Controlado" },
  // ── Controlados ───────────────────────────────────────────────────────────
  { code:"435", name:"Etomidato 2mg/ml",               unit:"Ampolas",     category:"controlado",     standard_qty:100,  min_qty:20,  location:"Controlado" },
  { code:"924", name:"Fentanil 50mcg/10ml",            unit:"Ampolas",     category:"controlado",     standard_qty:60,   min_qty:10,  location:"Controlado" },
  { code:"346", name:"Fenitoína injetável",            unit:"Ampolas",     category:"controlado",     standard_qty:50,   min_qty:10,  location:"Controlado" },
  { code:"331", name:"Fenobarbital 100mg inj",         unit:"Ampolas",     category:"controlado",     standard_qty:50,   min_qty:10,  location:"Controlado" },
  { code:"1095",name:"Flumazenil injetável",           unit:"Ampolas",     category:"controlado",     standard_qty:20,   min_qty:5,   location:"Controlado" },
  { code:"257", name:"Haloperidol 5mg (Haldol)",       unit:"Ampolas",     category:"controlado",     standard_qty:50,   min_qty:10,  location:"Controlado" },
  { code:"327", name:"Diazepam 10mg injetável",        unit:"Ampolas",     category:"controlado",     standard_qty:50,   min_qty:10,  location:"Controlado" },
  { code:"980", name:"Ketamina",                       unit:"Ampolas",     category:"controlado",     standard_qty:50,   min_qty:10,  location:"Controlado" },
  { code:"335", name:"Morfina 10mg",                   unit:"Ampolas",     category:"controlado",     standard_qty:50,   min_qty:10,  location:"Controlado" },
  { code:"304", name:"Tramadol 100mg",                 unit:"Ampolas",     category:"controlado",     standard_qty:200,  min_qty:40,  location:"Controlado" },
  { code:"273", name:"Midazolam 5mg/10ml",             unit:"Ampolas",     category:"controlado",     standard_qty:50,   min_qty:10,  location:"Controlado" },
  { code:"175", name:"Biperideno 2mg",                 unit:"Comprimidos", category:"controlado",     standard_qty:30,   min_qty:5,   location:"Controlado" },
  { code:"105", name:"Carbamazepina 200mg",            unit:"Comprimidos", category:"controlado",     standard_qty:30,   min_qty:5,   location:"Controlado" },
  { code:"268", name:"Fenobarbital 100mg comp",        unit:"Comprimidos", category:"controlado",     standard_qty:30,   min_qty:5,   location:"Controlado" },
  { code:"238", name:"Risperidona 2mg",                unit:"Comprimidos", category:"controlado",     standard_qty:60,   min_qty:10,  location:"Controlado" },
  { code:"235", name:"Clonazepam gotas",               unit:"Frascos",     category:"controlado",     standard_qty:2,    min_qty:1,   location:"Controlado" },
  { code:"274", name:"Fenobarbital gotas",             unit:"Frascos",     category:"controlado",     standard_qty:1,    min_qty:1,   location:"Controlado" },
  { code:"",    name:"Naloxona",                       unit:"Frascos",     category:"controlado",     standard_qty:10,   min_qty:2,   location:"Controlado" },
  // ── Antimicrobianos ───────────────────────────────────────────────────────
  { code:"163", name:"Cefepima 1g",                    unit:"Ampolas",     category:"antimicrobiano", standard_qty:100,  min_qty:20,  location:"Antimicrobiano" },
  { code:"170", name:"Tazocin (Piperacilina+Tazob.)",  unit:"Ampolas",     category:"antimicrobiano", standard_qty:50,   min_qty:10,  location:"Antimicrobiano" },
  { code:"168", name:"Meropenem",                      unit:"Ampolas",     category:"antimicrobiano", standard_qty:50,   min_qty:10,  location:"Antimicrobiano" },
  // ── Soluções orais (vidros) ───────────────────────────────────────────────
  { code:"90",  name:"Atrovent",                       unit:"Vidros",      category:"medicamento",    standard_qty:30,   min_qty:5,   location:"" },
  { code:"34",  name:"Albendazol suspensão",           unit:"Vidros",      category:"medicamento",    standard_qty:20,   min_qty:5,   location:"" },
  { code:"52",  name:"Amoxicilina suspensão",          unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"291", name:"Ambroxol adulto",                unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"290", name:"Ambroxol pediátrico",            unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"70",  name:"Azitromicina suspensão",         unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"161", name:"Dexametasona suspensão",         unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"316", name:"Dipirona gotas",                 unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"133", name:"Hidróxido de alumínio",          unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"285", name:"Histamin xarope",                unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"296", name:"Ibuprofeno gotas",               unit:"Vidros",      category:"medicamento",    standard_qty:20,   min_qty:5,   location:"" },
  { code:"318", name:"Mebendazol suspensão",           unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"780", name:"Metronidazol suspensão",         unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"343", name:"Óleo mineral",                   unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"320", name:"Paracetamol gotas",              unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"201", name:"Sulfametoxazol+Trimetoprim susp",unit:"Vidros",      category:"medicamento",    standard_qty:10,   min_qty:2,   location:"" },
  { code:"129", name:"Simeticona gotas",               unit:"Vidros",      category:"medicamento",    standard_qty:20,   min_qty:5,   location:"" },
  // ── Soluções IV (frascos) ─────────────────────────────────────────────────
  { code:"21",  name:"ABD 500ml",                      unit:"Frascos",     category:"solucao",        standard_qty:90,   min_qty:18,  location:"" },
  { code:"20",  name:"ABD 250ml",                      unit:"Frascos",     category:"solucao",        standard_qty:120,  min_qty:24,  location:"" },
  { code:"322", name:"ABD 100ml",                      unit:"Frascos",     category:"solucao",        standard_qty:120,  min_qty:24,  location:"" },
  { code:"146", name:"Manitol",                        unit:"Frascos",     category:"solucao",        standard_qty:30,   min_qty:5,   location:"" },
  { code:"172", name:"Soro Fisiológico 0.9% 250ml",    unit:"Frascos",     category:"solucao",        standard_qty:300,  min_qty:60,  location:"" },
  { code:"339", name:"Soro Fisiológico 0.9% 100ml",    unit:"Frascos",     category:"solucao",        standard_qty:500,  min_qty:100, location:"" },
  { code:"601", name:"Soro Fisiológico 0.9% 500ml",    unit:"Frascos",     category:"solucao",        standard_qty:300,  min_qty:60,  location:"" },
  { code:"340", name:"Soro Ringer Simples 500ml",      unit:"Frascos",     category:"solucao",        standard_qty:90,   min_qty:18,  location:"" },
  { code:"659", name:"Soro Ringer Lactado",            unit:"Frascos",     category:"solucao",        standard_qty:90,   min_qty:18,  location:"" },
  { code:"173", name:"Soro Glicosado 250ml",           unit:"Frascos",     category:"solucao",        standard_qty:100,  min_qty:20,  location:"" },
  { code:"174", name:"Soro Glicosado 500ml",           unit:"Frascos",     category:"solucao",        standard_qty:200,  min_qty:40,  location:"" },
  { code:"202", name:"Ciprofloxacina EV injetável",    unit:"Frascos",     category:"solucao",        standard_qty:30,   min_qty:5,   location:"" },
  { code:"76",  name:"Bicarbonato de Sódio 8.4% 250ml",unit:"Frascos",     category:"solucao",        standard_qty:30,   min_qty:5,   location:"" },
  { code:"283", name:"Fluconazol 2mg/ml 100ml",        unit:"Frascos",     category:"solucao",        standard_qty:10,   min_qty:2,   location:"" },
  { code:"148", name:"Metronidazol EV",                unit:"Frascos",     category:"solucao",        standard_qty:120,  min_qty:24,  location:"" },
  // ── Materiais e insumos ───────────────────────────────────────────────────
  { code:"384", name:"Coletor de exames",              unit:"Unidades",    category:"material",       standard_qty:100,  min_qty:20,  location:"" },
  { code:"77",  name:"Bolsa coletora de urina",        unit:"Unidades",    category:"material",       standard_qty:20,   min_qty:5,   location:"" },
  { code:"591", name:"Escalp 25",                      unit:"Unidades",    category:"material",       standard_qty:200,  min_qty:40,  location:"" },
  { code:"590", name:"Escalp 23",                      unit:"Unidades",    category:"material",       standard_qty:600,  min_qty:120, location:"" },
  { code:"589", name:"Escalp 21",                      unit:"Unidades",    category:"material",       standard_qty:200,  min_qty:40,  location:"" },
  { code:"424", name:"Equipo macro",                   unit:"Unidades",    category:"material",       standard_qty:700,  min_qty:140, location:"" },
  { code:"1156",name:"Equipo micro",                   unit:"Unidades",    category:"material",       standard_qty:50,   min_qty:10,  location:"" },
  { code:"423", name:"Eletrodos",                      unit:"Unidades",    category:"material",       standard_qty:400,  min_qty:80,  location:"" },
  { code:"551", name:"Lanceta",                        unit:"Caixas",      category:"material",       standard_qty:5,    min_qty:1,   location:"" },
  { code:"352", name:"Lâmina de bisturi nº11",         unit:"Caixas",      category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"353", name:"Lâmina de bisturi nº15",         unit:"Caixas",      category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"356", name:"Lâmina de bisturi nº20",         unit:"Caixas",      category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"357", name:"Lâmina de bisturi nº23",         unit:"Caixas",      category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"355", name:"Lâmina de bisturi nº24",         unit:"Caixas",      category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"302", name:"Fleet Enema",                    unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"497", name:"Fita para glicemia",             unit:"Unidades",    category:"material",       standard_qty:500,  min_qty:100, location:"" },
  { code:"",    name:"Fio de sutura nylon nº1.0",      unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"",    name:"Fio de sutura nylon nº2.0",      unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"",    name:"Fio de sutura nylon nº3.0",      unit:"Unidades",    category:"material",       standard_qty:48,   min_qty:10,  location:"" },
  { code:"",    name:"Fio de sutura nylon nº4.0",      unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"",    name:"Fio de sutura nylon nº5.0",      unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"",    name:"Cat Gut Cromado 3.0",            unit:"Caixas",      category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"",    name:"Cat Gut Cromado 2.0",            unit:"Caixas",      category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"",    name:"Cat Gut Simples 3.0",            unit:"Caixas",      category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"123", name:"Cateter tipo óculos adulto",     unit:"Unidades",    category:"material",       standard_qty:30,   min_qty:5,   location:"" },
  { code:"124", name:"Cateter tipo óculos infantil",   unit:"Unidades",    category:"material",       standard_qty:30,   min_qty:5,   location:"" },
  { code:"",    name:"Sonda Foley nº08",               unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"827", name:"Sonda Foley nº10",               unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"609", name:"Sonda Foley nº12",               unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"610", name:"Sonda Foley nº14",               unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"611", name:"Sonda Foley nº16",               unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"612", name:"Sonda Foley nº18",               unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"613", name:"Sonda Foley nº20",               unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"629", name:"Sonda Foley nº22",               unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"",    name:"Sonda Foley nº20 3vias",         unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"",    name:"Sonda Foley nº22 3vias",         unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"604", name:"Sonda aspiração nº08",           unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"605", name:"Sonda aspiração nº10",           unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"606", name:"Sonda aspiração nº12",           unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"",    name:"Sonda aspiração nº18",           unit:"Unidades",    category:"material",       standard_qty:24,   min_qty:5,   location:"" },
  { code:"632", name:"Sonda Nasogástrica Curta nº08",  unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"940", name:"Sonda Nasogástrica Curta nº12",  unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"921", name:"Sonda Nasogástrica Curta nº14",  unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"919", name:"Sonda Nasogástrica Longa nº08",  unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"633", name:"Sonda Nasogástrica Longa nº10",  unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"634", name:"Sonda Nasogástrica Longa nº12",  unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"635", name:"Sonda Nasogástrica Longa nº14",  unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"637", name:"Sonda Nasogástrica Longa nº18",  unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"638", name:"Sonda Nasogástrica Longa nº20",  unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"",    name:"Sonda Nasogástrica LEVINE nº14", unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"",    name:"Sonda Nasogástrica LEVINE nº16", unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"",    name:"Sonda Nasogástrica LEVINE nº18", unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"",    name:"Sonda Nasogástrica LEVINE nº20", unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"630", name:"Sonda Nasoenteral nº12",         unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"640", name:"Sonda uretral nº06",             unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"639", name:"Sonda uretral nº08",             unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"644", name:"Sonda uretral nº18",             unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"616", name:"TOT 2.0",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"616", name:"TOT 2.5",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"626", name:"TOT 3.5",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"616", name:"TOT 5.0",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"617", name:"TOT 5.5",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"618", name:"TOT 6.5",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"737", name:"TOT 7.0",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"620", name:"TOT 7.5",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"622", name:"TOT 8.0",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"621", name:"TOT 8.5",                        unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"420", name:"Dreno de Penrose nº01",          unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"421", name:"Dreno de Penrose nº02",          unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"422", name:"Dreno de Penrose nº03",          unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"915", name:"Dreno de tórax nº20",            unit:"Unidades",    category:"material",       standard_qty:5,    min_qty:1,   location:"" },
  { code:"914", name:"Dreno de tórax nº28",            unit:"Unidades",    category:"material",       standard_qty:5,    min_qty:1,   location:"" },
  { code:"952", name:"Dreno de tórax nº30",            unit:"Unidades",    category:"material",       standard_qty:5,    min_qty:1,   location:"" },
  { code:"786", name:"Dreno de tórax nº32",            unit:"Unidades",    category:"material",       standard_qty:5,    min_qty:1,   location:"" },
  { code:"27",  name:"Agulha 40x12",                   unit:"Unidades",    category:"material",       standard_qty:1200, min_qty:200, location:"" },
  { code:"662", name:"Agulha 30x08",                   unit:"Unidades",    category:"material",       standard_qty:1000, min_qty:200, location:"" },
  { code:"26",  name:"Agulha 30x07",                   unit:"Unidades",    category:"material",       standard_qty:1000, min_qty:200, location:"" },
  { code:"25",  name:"Agulha 25x08",                   unit:"Unidades",    category:"material",       standard_qty:1000, min_qty:200, location:"" },
  { code:"24",  name:"Agulha 25x07",                   unit:"Unidades",    category:"material",       standard_qty:1000, min_qty:200, location:"" },
  { code:"23",  name:"Agulha 20x0.5",                  unit:"Unidades",    category:"material",       standard_qty:1000, min_qty:200, location:"" },
  { code:"22",  name:"Agulha 13x0.45",                 unit:"Unidades",    category:"material",       standard_qty:1000, min_qty:200, location:"" },
  { code:"31",  name:"Agulha de racker 25Gx3.5",       unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"32",  name:"Agulha de racker 27Gx3.5",       unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"111", name:"Jelco nº14",                     unit:"Unidades",    category:"material",       standard_qty:500,  min_qty:100, location:"" },
  { code:"113", name:"Jelco nº18",                     unit:"Unidades",    category:"material",       standard_qty:500,  min_qty:100, location:"" },
  { code:"658", name:"Jelco nº24",                     unit:"Unidades",    category:"material",       standard_qty:500,  min_qty:100, location:"" },
  { code:"115", name:"Jelco nº22",                     unit:"Unidades",    category:"material",       standard_qty:500,  min_qty:100, location:"" },
  { code:"114", name:"Jelco nº20",                     unit:"Unidades",    category:"material",       standard_qty:500,  min_qty:100, location:"" },
  { code:"595", name:"Seringa 20ml",                   unit:"Unidades",    category:"material",       standard_qty:2000, min_qty:400, location:"" },
  { code:"594", name:"Seringa 10ml",                   unit:"Unidades",    category:"material",       standard_qty:1250, min_qty:250, location:"" },
  { code:"596", name:"Seringa 5ml",                    unit:"Unidades",    category:"material",       standard_qty:1250, min_qty:250, location:"" },
  { code:"597", name:"Seringa 3ml",                    unit:"Unidades",    category:"material",       standard_qty:1250, min_qty:250, location:"" },
  { code:"598", name:"Seringa 1ml",                    unit:"Unidades",    category:"material",       standard_qty:100,  min_qty:20,  location:"" },
  { code:"",    name:"Seringa 60ml",                   unit:"Unidades",    category:"material",       standard_qty:100,  min_qty:20,  location:"" },
  { code:"653", name:"Torneirinha",                    unit:"Unidades",    category:"material",       standard_qty:1000, min_qty:200, location:"" },
  { code:"259", name:"Lidocaína Gel",                  unit:"Unidades",    category:"material",       standard_qty:20,   min_qty:5,   location:"" },
  { code:"181", name:"Sulfadiazina de prata",          unit:"Bisnagas",    category:"material",       standard_qty:20,   min_qty:5,   location:"" },
  { code:"164", name:"Colagenase pomada",              unit:"Bisnagas",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"665", name:"Álcool 75%",                     unit:"Unidades",    category:"material",       standard_qty:36,   min_qty:8,   location:"" },
  { code:"670", name:"Máscara descartável",            unit:"Unidades",    category:"material",       standard_qty:1000, min_qty:200, location:"" },
  { code:"791", name:"Máscara N95",                    unit:"Unidades",    category:"material",       standard_qty:50,   min_qty:10,  location:"" },
  { code:"39",  name:"Algodão em rolo",                unit:"Rolos",       category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"69",  name:"Avental descartável branco",     unit:"Unidades",    category:"material",       standard_qty:50,   min_qty:10,  location:"" },
  { code:"654", name:"Touca / Gorro",                  unit:"Unidades",    category:"material",       standard_qty:300,  min_qty:60,  location:"" },
  { code:"666", name:"Abaixador de língua",            unit:"Unidades",    category:"material",       standard_qty:1000, min_qty:200, location:"" },
  { code:"62",  name:"Atadura 10cm",                   unit:"Pacotes",     category:"material",       standard_qty:50,   min_qty:10,  location:"" },
  { code:"63",  name:"Atadura 15cm",                   unit:"Pacotes",     category:"material",       standard_qty:50,   min_qty:10,  location:"" },
  { code:"538", name:"Luva estéril 6.5",               unit:"Pares",       category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"693", name:"Luva estéril 7.0",               unit:"Pares",       category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"694", name:"Luva estéril 7.5",               unit:"Pares",       category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"537", name:"Luva estéril 8.0",               unit:"Pares",       category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"695", name:"Luva estéril 8.5",               unit:"Pares",       category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"541", name:"Luva com pó P",                  unit:"Caixas",      category:"material",       standard_qty:20,   min_qty:5,   location:"" },
  { code:"543", name:"Luva com pó M",                  unit:"Caixas",      category:"material",       standard_qty:20,   min_qty:5,   location:"" },
  { code:"539", name:"Luva com pó G",                  unit:"Caixas",      category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"543", name:"Luva de Procedimento M Vinil sem pó", unit:"Caixas", category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"388", name:"Gaze cortada em pacote",         unit:"Pacotes",     category:"material",       standard_qty:30,   min_qty:5,   location:"" },
  { code:"428", name:"Esparadrapo",                    unit:"Rolos",       category:"material",       standard_qty:50,   min_qty:10,  location:"" },
  { code:"495", name:"Fita micropore",                 unit:"Rolos",       category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"494", name:"Fita adesiva hospitalar",        unit:"Rolos",       category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"496", name:"Fita adesiva para autoclave",    unit:"Rolos",       category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"",    name:"Papel para eletro",              unit:"Unidades",    category:"material",       standard_qty:15,   min_qty:3,   location:"" },
  { code:"",    name:"Papel grau cirúrgico 200x100",   unit:"Caixas",      category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"566", name:"Papel grau cirúrgico 300x100",   unit:"Rolos",       category:"material",       standard_qty:1,    min_qty:1,   location:"" },
  { code:"528", name:"Máscara nebulização adulto",     unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"529", name:"Máscara nebulização infantil",   unit:"Unidades",    category:"material",       standard_qty:10,   min_qty:2,   location:"" },
  { code:"1060",name:"Água oxigenada vol.10%",         unit:"Garrafas",    category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"574", name:"Povidine tópico",                unit:"Garrafas",    category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"573", name:"Povidine degermante",            unit:"Garrafas",    category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"371", name:"Clorexidina degermante 0.5%",    unit:"Garrafas",    category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"",    name:"Clorexidina degermante 2%",      unit:"Garrafas",    category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  { code:"",    name:"Gaze rolo (para Carrel)",        unit:"Unidades",    category:"material",       standard_qty:2,    min_qty:1,   location:"" },
  // ── Raio-X ────────────────────────────────────────────────────────────────
  { code:"1",   name:"Químico Completo",               unit:"Unidades",    category:"rx",             standard_qty:2,    min_qty:1,   location:"Raio-X" },
  { code:"2",   name:"Filme 18x24",                    unit:"Unidades",    category:"rx",             standard_qty:3,    min_qty:1,   location:"Raio-X" },
  { code:"3",   name:"Filme 24x30",                    unit:"Unidades",    category:"rx",             standard_qty:3,    min_qty:1,   location:"Raio-X" },
  { code:"4",   name:"Filme 35x35",                    unit:"Unidades",    category:"rx",             standard_qty:3,    min_qty:1,   location:"Raio-X" },
  { code:"6",   name:"Filme 35x43",                    unit:"Unidades",    category:"rx",             standard_qty:3,    min_qty:1,   location:"Raio-X" },
  { code:"7",   name:"Malha 6cm",                      unit:"Caixas",      category:"rx",             standard_qty:3,    min_qty:1,   location:"Raio-X" },
  { code:"8",   name:"Gesso 15cm",                     unit:"Caixas",      category:"rx",             standard_qty:3,    min_qty:1,   location:"Raio-X" },
  { code:"9",   name:"Gesso 10cm",                     unit:"Caixas",      category:"rx",             standard_qty:3,    min_qty:1,   location:"Raio-X" },
  // ── Equipamentos ──────────────────────────────────────────────────────────
  { code:"1",   name:"Aparelho de PA adulto",          unit:"Unidades",    category:"equipamento",    standard_qty:6,    min_qty:2,   location:"" },
  { code:"2",   name:"Glicosímetro",                   unit:"Unidades",    category:"equipamento",    standard_qty:2,    min_qty:1,   location:"" },
  { code:"3",   name:"Termômetro",                     unit:"Unidades",    category:"equipamento",    standard_qty:5,    min_qty:2,   location:"" },
  { code:"4",   name:"Oxímetro",                       unit:"Unidades",    category:"equipamento",    standard_qty:2,    min_qty:1,   location:"" },
  { code:"5",   name:"Descartex",                      unit:"Caixas",      category:"equipamento",    standard_qty:3,    min_qty:1,   location:"" },
  { code:"6",   name:"Sistema de Drenagem Mediastinal 2L", unit:"Unidades",category:"equipamento",    standard_qty:3,    min_qty:1,   location:"" },
  { code:"7",   name:"Sistema de Drenagem Mediastinal 1L", unit:"Unidades",category:"equipamento",    standard_qty:3,    min_qty:1,   location:"" },
];

// ── helpers ───────────────────────────────────────────────────────────────────

async function ensureTables(client: DbClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.inventory_items (
      id serial PRIMARY KEY,
      code text NOT NULL DEFAULT '',
      name text NOT NULL,
      unit text NOT NULL DEFAULT 'Unidades',
      category text NOT NULL DEFAULT 'material',
      standard_qty integer NOT NULL DEFAULT 0,
      min_qty integer NOT NULL DEFAULT 0,
      barcode text NOT NULL DEFAULT '',
      location text NOT NULL DEFAULT '',
      active boolean NOT NULL DEFAULT true,
      notes text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS public.inventory_stock (
      id serial PRIMARY KEY,
      item_id integer NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      quantity integer NOT NULL DEFAULT 0,
      updated_at timestamp NOT NULL DEFAULT now(),
      updated_by_id integer NOT NULL DEFAULT 0,
      updated_by_name text NOT NULL DEFAULT '',
      UNIQUE(item_id)
    );
    CREATE TABLE IF NOT EXISTS public.inventory_batches (
      id serial PRIMARY KEY,
      item_id integer NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      lot_number text NOT NULL DEFAULT '',
      quantity integer NOT NULL DEFAULT 0,
      expiry_date date,
      received_at timestamp NOT NULL DEFAULT now(),
      notes text NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS public.inventory_transactions (
      id serial PRIMARY KEY,
      item_id integer NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
      type text NOT NULL,
      quantity integer NOT NULL,
      batch_id integer REFERENCES public.inventory_batches(id),
      patient_id integer,
      patient_name text NOT NULL DEFAULT '',
      staff_id integer NOT NULL DEFAULT 0,
      staff_name text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
}

async function seedIfEmpty(client: DbClient) {
  const { rows } = await client.query<{cnt: string}>("SELECT COUNT(*) as cnt FROM public.inventory_items");
  if (Number(rows[0]?.cnt) > 0) return;
  for (const item of SEED_ITEMS) {
    const r = await client.query<{id: number}>(
      `INSERT INTO public.inventory_items (code, name, unit, category, standard_qty, min_qty, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [item.code, item.name, item.unit, item.category, item.standard_qty, item.min_qty, item.location]
    );
    await client.query(
      `INSERT INTO public.inventory_stock (item_id, quantity) VALUES ($1, 0)`,
      [r.rows[0]!.id]
    );
  }
  logger.info({ count: SEED_ITEMS.length }, "inventory: seeded default items");
}

// ── routes ────────────────────────────────────────────────────────────────────

// Ensure tables exist and seed on first call
let initialized = false;
router.use(async (_req, _res, next) => {
  if (initialized) return next();
  const client = await pool.connect();
  try {
    await ensureTables(client);
    await seedIfEmpty(client);
    initialized = true;
  } finally {
    client.release();
  }
  next();
});

// GET /api/inventory/items
router.get("/items", async (req, res) => {
  const { category, search, lowstock } = req.query;
  let q = `
    SELECT i.*, COALESCE(s.quantity,0)::int AS current_qty
    FROM inventory_items i
    LEFT JOIN inventory_stock s ON s.item_id = i.id
    WHERE i.active = true`;
  const params: unknown[] = [];
  if (category && category !== "todos") {
    params.push(category);
    q += ` AND i.category = $${params.length}`;
  }
  if (search) {
    params.push(`%${search}%`);
    q += ` AND (i.name ILIKE $${params.length} OR i.code ILIKE $${params.length} OR i.barcode ILIKE $${params.length})`;
  }
  if (lowstock === "1") {
    q += ` AND COALESCE(s.quantity,0) <= i.min_qty`;
  }
  q += ` ORDER BY i.category, i.name`;
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// POST /api/inventory/items
router.post("/items", async (req, res) => {
  const { code, name, unit, category, standard_qty, min_qty, barcode, location, notes } = req.body as Record<string, string>;
  if (!name) { res.status(400).json({ error: "Nome é obrigatório" }); return; }
  const client = await pool.connect();
  try {
    const r = await client.query<{id: number}>(
      `INSERT INTO inventory_items (code,name,unit,category,standard_qty,min_qty,barcode,location,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [code||"", name, unit||"Unidades", category||"material",
       Number(standard_qty)||0, Number(min_qty)||0, barcode||"", location||"", notes||""]
    );
    const id = r.rows[0]!.id;
    await client.query(`INSERT INTO inventory_stock (item_id, quantity) VALUES ($1, 0)`, [id]);
    const { rows } = await client.query(
      `SELECT i.*, COALESCE(s.quantity,0)::int AS current_qty FROM inventory_items i LEFT JOIN inventory_stock s ON s.item_id=i.id WHERE i.id=$1`, [id]
    );
    res.status(201).json(rows[0]);
  } finally { client.release(); }
});

// PUT /api/inventory/items/:id
router.put("/items/:id", async (req, res) => {
  const id = Number(req.params["id"]);
  const { code, name, unit, category, standard_qty, min_qty, barcode, location, notes, active } = req.body as Record<string, string>;
  await pool.query(
    `UPDATE inventory_items SET code=$1,name=$2,unit=$3,category=$4,standard_qty=$5,min_qty=$6,
     barcode=$7,location=$8,notes=$9,active=$10,updated_at=now() WHERE id=$11`,
    [code||"", name, unit||"Unidades", category||"material", Number(standard_qty)||0,
     Number(min_qty)||0, barcode||"", location||"", notes||"", active !== "false", id]
  );
  const { rows } = await pool.query(
    `SELECT i.*, COALESCE(s.quantity,0)::int AS current_qty FROM inventory_items i LEFT JOIN inventory_stock s ON s.item_id=i.id WHERE i.id=$1`, [id]
  );
  res.json(rows[0]);
});

// POST /api/inventory/entry  — receive order (entrada)
router.post("/entry", async (req, res) => {
  const { item_id, quantity, lot_number, expiry_date, notes, staff_id, staff_name } = req.body as Record<string, string>;
  if (!item_id || !quantity) { res.status(400).json({ error: "item_id e quantity são obrigatórios" }); return; }
  const qty = Number(quantity);
  if (qty <= 0) { res.status(400).json({ error: "Quantidade deve ser positiva" }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // create batch if lot/expiry supplied
    let batchId: number | null = null;
    if (lot_number || expiry_date) {
      const br = await client.query<{id: number}>(
        `INSERT INTO inventory_batches (item_id,lot_number,quantity,expiry_date,notes)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [Number(item_id), lot_number||"", qty, expiry_date||null, notes||""]
      );
      batchId = br.rows[0]!.id;
    }
    // update stock
    await client.query(
      `INSERT INTO inventory_stock (item_id, quantity, updated_by_id, updated_by_name)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (item_id) DO UPDATE SET
         quantity = inventory_stock.quantity + $2,
         updated_at = now(),
         updated_by_id = $3,
         updated_by_name = $4`,
      [Number(item_id), qty, Number(staff_id)||0, staff_name||""]
    );
    // record transaction
    await client.query(
      `INSERT INTO inventory_transactions (item_id,type,quantity,batch_id,staff_id,staff_name,notes)
       VALUES ($1,'entrada',$2,$3,$4,$5,$6)`,
      [Number(item_id), qty, batchId, Number(staff_id)||0, staff_name||"", notes||""]
    );
    await client.query("COMMIT");
    const { rows } = await client.query(
      `SELECT i.*, COALESCE(s.quantity,0)::int AS current_qty FROM inventory_items i LEFT JOIN inventory_stock s ON s.item_id=i.id WHERE i.id=$1`, [Number(item_id)]
    );
    res.json(rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
});

// POST /api/inventory/exit  — dispensation/exit (saída)
router.post("/exit", async (req, res) => {
  const { item_id, quantity, notes, patient_id, patient_name, staff_id, staff_name } = req.body as Record<string, string>;
  if (!item_id || !quantity) { res.status(400).json({ error: "item_id e quantity são obrigatórios" }); return; }
  const qty = Number(quantity);
  if (qty <= 0) { res.status(400).json({ error: "Quantidade deve ser positiva" }); return; }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const stockRes = await client.query<{quantity: number}>(
      `SELECT quantity FROM inventory_stock WHERE item_id=$1`, [Number(item_id)]
    );
    const current = stockRes.rows[0]?.quantity ?? 0;
    if (current < qty) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: `Estoque insuficiente (atual: ${current})` });
      return;
    }
    await client.query(
      `UPDATE inventory_stock SET quantity = quantity - $1, updated_at=now(), updated_by_id=$2, updated_by_name=$3 WHERE item_id=$4`,
      [qty, Number(staff_id)||0, staff_name||"", Number(item_id)]
    );
    await client.query(
      `INSERT INTO inventory_transactions (item_id,type,quantity,patient_id,patient_name,staff_id,staff_name,notes)
       VALUES ($1,'saida',$2,$3,$4,$5,$6,$7)`,
      [Number(item_id), qty, patient_id ? Number(patient_id) : null, patient_name||"",
       Number(staff_id)||0, staff_name||"", notes||""]
    );
    await client.query("COMMIT");
    const { rows } = await client.query(
      `SELECT i.*, COALESCE(s.quantity,0)::int AS current_qty FROM inventory_items i LEFT JOIN inventory_stock s ON s.item_id=i.id WHERE i.id=$1`, [Number(item_id)]
    );
    res.json(rows[0]);
  } catch(e) {
    await client.query("ROLLBACK");
    throw e;
  } finally { client.release(); }
});

// PATCH /api/inventory/stock/:itemId  — direct adjustment
router.patch("/stock/:itemId", async (req, res) => {
  const itemId = Number(req.params["itemId"]);
  const { quantity, notes, staff_id, staff_name } = req.body as Record<string, string>;
  const qty = Number(quantity);
  const client = await pool.connect();
  try {
    const old = await client.query<{quantity:number}>(`SELECT COALESCE(s.quantity,0)::int AS quantity FROM inventory_stock s WHERE item_id=$1`,[itemId]);
    const oldQty = old.rows[0]?.quantity ?? 0;
    const diff = qty - oldQty;
    await client.query(
      `UPDATE inventory_stock SET quantity=$1, updated_at=now(), updated_by_id=$2, updated_by_name=$3 WHERE item_id=$4`,
      [qty, Number(staff_id)||0, staff_name||"", itemId]
    );
    await client.query(
      `INSERT INTO inventory_transactions (item_id,type,quantity,staff_id,staff_name,notes)
       VALUES ($1,'ajuste',$2,$3,$4,$5)`,
      [itemId, diff, Number(staff_id)||0, staff_name||"", notes||`Ajuste manual: ${oldQty} → ${qty}`]
    );
    const { rows } = await client.query(
      `SELECT i.*, COALESCE(s.quantity,0)::int AS current_qty FROM inventory_items i LEFT JOIN inventory_stock s ON s.item_id=i.id WHERE i.id=$1`, [itemId]
    );
    res.json(rows[0]);
  } finally { client.release(); }
});

// GET /api/inventory/transactions
router.get("/transactions", async (req, res) => {
  const { item_id, type, limit = "100", offset = "0" } = req.query;
  let q = `
    SELECT t.*, i.name AS item_name, i.unit AS item_unit
    FROM inventory_transactions t
    JOIN inventory_items i ON i.id = t.item_id
    WHERE 1=1`;
  const params: unknown[] = [];
  if (item_id) { params.push(Number(item_id)); q += ` AND t.item_id=$${params.length}`; }
  if (type)    { params.push(type);             q += ` AND t.type=$${params.length}`; }
  q += ` ORDER BY t.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
  params.push(Number(limit), Number(offset));
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// GET /api/inventory/batches
router.get("/batches", async (req, res) => {
  const { item_id, expiring_days } = req.query;
  let q = `
    SELECT b.*, i.name AS item_name, i.unit AS item_unit
    FROM inventory_batches b
    JOIN inventory_items i ON i.id = b.item_id
    WHERE b.quantity > 0`;
  const params: unknown[] = [];
  if (item_id) { params.push(Number(item_id)); q += ` AND b.item_id=$${params.length}`; }
  if (expiring_days) {
    params.push(Number(expiring_days));
    q += ` AND b.expiry_date IS NOT NULL AND b.expiry_date <= now() + ($${params.length} || ' days')::interval`;
  }
  q += ` ORDER BY b.expiry_date ASC NULLS LAST`;
  const { rows } = await pool.query(q, params);
  res.json(rows);
});

// POST /api/inventory/batches
router.post("/batches", async (req, res) => {
  const { item_id, lot_number, quantity, expiry_date, notes } = req.body as Record<string,string>;
  const { rows } = await pool.query<{id:number}>(
    `INSERT INTO inventory_batches (item_id,lot_number,quantity,expiry_date,notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [Number(item_id), lot_number||"", Number(quantity)||0, expiry_date||null, notes||""]
  );
  res.status(201).json(rows[0]);
});

// GET /api/inventory/reports/low-stock
router.get("/reports/low-stock", async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT i.*, COALESCE(s.quantity,0)::int AS current_qty,
           i.min_qty,
           CASE WHEN i.min_qty > 0 THEN ROUND((COALESCE(s.quantity,0)::numeric / i.min_qty * 100),1)
                ELSE 0 END AS pct_min
    FROM inventory_items i
    LEFT JOIN inventory_stock s ON s.item_id=i.id
    WHERE i.active=true AND COALESCE(s.quantity,0) <= i.min_qty
    ORDER BY pct_min ASC, i.name ASC
  `);
  res.json(rows);
});

// GET /api/inventory/reports/expiring?days=90
router.get("/reports/expiring", async (req, res) => {
  const days = Number(req.query["days"] ?? 90);
  const { rows } = await pool.query(`
    SELECT b.*, i.name AS item_name, i.unit AS item_unit,
           (b.expiry_date - now()::date) AS days_until_expiry
    FROM inventory_batches b
    JOIN inventory_items i ON i.id=b.item_id
    WHERE b.expiry_date IS NOT NULL
      AND b.quantity > 0
      AND b.expiry_date <= now() + ($1 || ' days')::interval
    ORDER BY b.expiry_date ASC
  `, [days]);
  res.json(rows);
});

// GET /api/inventory/reports/full
router.get("/reports/full", async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT i.*, COALESCE(s.quantity,0)::int AS current_qty
    FROM inventory_items i
    LEFT JOIN inventory_stock s ON s.item_id=i.id
    WHERE i.active=true
    ORDER BY i.category, i.name
  `);
  res.json(rows);
});

export default router;
