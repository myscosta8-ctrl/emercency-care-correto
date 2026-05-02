import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ClipboardCheck, Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useNurse } from "@/hooks/use-nurse";
import {
  useCreatePatientPrescription,
  getGetPatientPrescriptionsQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "pendente",    label: "Pendente",      color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "em_andamento", label: "Em andamento", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "concluido",   label: "Concluído",     color: "bg-green-500/20 text-green-400 border-green-500/30" },
] as const;

type PrescriptionStatus = typeof STATUS_OPTIONS[number]["value"];

interface StandardItem {
  id: string;
  label: string;
  hasInterval?: boolean;
}

const STANDARD_ITEMS: StandardItem[] = [
  { id: "vitals",      label: "Monitorizar sinais vitais a cada ___ min", hasInterval: true },
  { id: "iv_access",   label: "Manter acesso venoso pérvio" },
  { id: "medication",  label: "Administrar medicação conforme prescrição médica" },
  { id: "glucose",     label: "Controlar glicemia capilar" },
  { id: "rest",        label: "Manter paciente em repouso" },
  { id: "oxygen",      label: "Oxigenoterapia conforme necessidade" },
  { id: "diuresis",    label: "Controle de diurese" },
  { id: "decubitus",   label: "Mudança de decúbito" },
];

const formSchema = z.object({
  responsible: z.string().min(1, "Informe o nome do responsável"),
  scheduledTime: z.string().default(""),
  status: z.enum(["pendente", "em_andamento", "concluido"]).default("pendente"),
});

type FormValues = z.infer<typeof formSchema>;

interface PrescriptionFormProps {
  patientId: number;
  patientName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PrescriptionForm({ patientId, patientName, onSuccess, onCancel }: PrescriptionFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createPrescription = useCreatePatientPrescription();
  const { nurseName, setNurseName } = useNurse();

  const now = new Date();
  const dateLabel = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [vitalInterval, setVitalInterval] = useState("30");
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [newCustomItem, setNewCustomItem] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      responsible: nurseName,
      scheduledTime: format(now, "HH:mm"),
      status: "pendente",
    },
  });

  const toggleItem = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addCustomItem = () => {
    const trimmed = newCustomItem.trim();
    if (!trimmed) return;
    setCustomItems(prev => [...prev, trimmed]);
    setNewCustomItem("");
  };

  const removeCustomItem = (idx: number) => {
    setCustomItems(prev => prev.filter((_, i) => i !== idx));
  };

  function buildItemsList(): string[] {
    const result: string[] = [];
    for (const item of STANDARD_ITEMS) {
      if (!checkedItems.has(item.id)) continue;
      if (item.hasInterval) {
        result.push(`Monitorizar sinais vitais a cada ${vitalInterval || "___"} min`);
      } else {
        result.push(item.label);
      }
    }
    result.push(...customItems);
    return result;
  }

  function onSubmit(data: FormValues) {
    const itemsList = buildItemsList();
    if (itemsList.length === 0) {
      toast({ title: "Selecione ao menos uma intervenção", variant: "destructive" });
      return;
    }

    createPrescription.mutate(
      {
        id: patientId,
        data: {
          items: JSON.stringify(itemsList),
          status: data.status,
          responsible: data.responsible,
          scheduledTime: data.scheduledTime,
        },
      },
      {
        onSuccess: () => {
          setNurseName(data.responsible);
          queryClient.invalidateQueries({ queryKey: getGetPatientPrescriptionsQueryKey(patientId) });
          toast({ title: "Prescrição registrada com sucesso" });
          onSuccess();
        },
        onError: () => {
          toast({ title: "Não foi possível registrar a prescrição", variant: "destructive" });
        },
      }
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Header */}
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-border/50">
          <div className="flex items-center gap-2 mb-0.5">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">Prescrição de Enfermagem</span>
          </div>
          <p className="text-xs text-muted-foreground">{patientName} · {dateLabel}</p>
        </div>

        {/* Standard intervention checklist */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Intervenções</Label>
          <div className="space-y-1.5 border border-border/50 rounded-lg p-3 bg-card/30">
            {STANDARD_ITEMS.map(item => (
              <div key={item.id} className="flex items-center gap-3 min-h-[44px] py-1">
                <Checkbox
                  id={`item-${item.id}`}
                  checked={checkedItems.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                  className="shrink-0 h-5 w-5"
                />
                <label
                  htmlFor={`item-${item.id}`}
                  className="text-sm cursor-pointer select-none flex-1 flex items-center gap-2"
                >
                  {item.hasInterval ? (
                    <>
                      <span>Monitorizar sinais vitais a cada</span>
                      <input
                        type="number"
                        min={5}
                        max={240}
                        value={vitalInterval}
                        onChange={e => { setVitalInterval(e.target.value); if (!checkedItems.has(item.id)) toggleItem(item.id); }}
                        onClick={e => e.stopPropagation()}
                        className="w-14 h-6 text-center text-xs rounded border border-border/60 bg-background font-mono px-1"
                      />
                      <span>min</span>
                    </>
                  ) : (
                    item.label
                  )}
                </label>
              </div>
            ))}

            {/* Custom items already added */}
            {customItems.map((text, idx) => (
              <div key={`custom-${idx}`} className="flex items-center gap-3">
                <Checkbox checked disabled className="shrink-0" />
                <span className="text-sm flex-1">{text}</span>
                <button
                  type="button"
                  onClick={() => removeCustomItem(idx)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Add custom item */}
            <div className="flex gap-2 mt-2 pt-2 border-t border-border/40">
              <Input
                placeholder="Adicionar outra intervenção..."
                value={newCustomItem}
                onChange={e => setNewCustomItem(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomItem(); } }}
                className="h-7 text-xs"
              />
              <Button type="button" size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={addCustomItem}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="flex gap-2">
                    {STATUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className={cn(
                          "flex-1 py-1.5 rounded-md border text-xs font-medium transition-all",
                          field.value === opt.value
                            ? opt.color + " border-current"
                            : "border-border/50 text-muted-foreground hover:border-border"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Responsible + Time row */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="responsible"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Responsável <span className="text-destructive">*</span></FormLabel>
                <FormControl>
                  <Input placeholder="Nome do enfermeiro(a)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="scheduledTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Horário</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" className="flex-1" disabled={createPrescription.isPending}>
            {createPrescription.isPending ? "Registrando..." : "Registrar Prescrição"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
