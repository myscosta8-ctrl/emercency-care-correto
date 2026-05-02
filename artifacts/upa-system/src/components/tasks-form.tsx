import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ListTodo, Plus, X, Clock } from "lucide-react";
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
  useCreatePatientTask,
  getGetPatientTasksQueryKey,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "pendente",     label: "Pendente",      color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "em_andamento", label: "Em andamento",  color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "concluido",    label: "Concluído",     color: "bg-green-500/20 text-green-400 border-green-500/30" },
] as const;

type TaskStatus = typeof STATUS_OPTIONS[number]["value"];

interface StandardItem {
  id: string;
  label: string;
  hasTime?: boolean;
}

const STANDARD_ITEMS: StandardItem[] = [
  { id: "medication",  label: "Administrar medicação às",     hasTime: true },
  { id: "pain",        label: "Reavaliar dor às",             hasTime: true },
  { id: "vitals",      label: "Verificar sinais vitais às",   hasTime: true },
  { id: "exam",        label: "Coletar exame" },
  { id: "transfer",    label: "Encaminhar para setor" },
];

const formSchema = z.object({
  responsible: z.string().min(1, "Informe o nome do responsável"),
  status: z.enum(["pendente", "em_andamento", "concluido"]).default("pendente"),
});

type FormValues = z.infer<typeof formSchema>;

interface TasksFormProps {
  patientId: number;
  patientName: string;
  defaultResponsible?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TasksForm({ patientId, patientName, defaultResponsible = "", onSuccess, onCancel }: TasksFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createTask = useCreatePatientTask();
  const { nurseName, setNurseName } = useNurse();

  const now = new Date();
  const dateLabel = format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [itemTimes, setItemTimes] = useState<Record<string, string>>({});
  const [customItems, setCustomItems] = useState<{ text: string; time: string }[]>([]);
  const [newCustomText, setNewCustomText] = useState("");
  const [newCustomTime, setNewCustomTime] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { responsible: nurseName || defaultResponsible, status: "pendente" },
  });

  const toggleItem = (id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const setItemTime = (id: string, time: string) => {
    setItemTimes(prev => ({ ...prev, [id]: time }));
    if (!checkedItems.has(id)) toggleItem(id);
  };

  const addCustomItem = () => {
    const trimmed = newCustomText.trim();
    if (!trimmed) return;
    setCustomItems(prev => [...prev, { text: trimmed, time: newCustomTime }]);
    setNewCustomText("");
    setNewCustomTime("");
  };

  const removeCustomItem = (idx: number) => setCustomItems(prev => prev.filter((_, i) => i !== idx));

  function buildItemsList(): { text: string; time: string }[] {
    const result: { text: string; time: string }[] = [];
    for (const item of STANDARD_ITEMS) {
      if (!checkedItems.has(item.id)) continue;
      const time = itemTimes[item.id] ?? "";
      result.push({
        text: item.hasTime
          ? `${item.label}${time ? " " + time : " ___"}`
          : item.label,
        time,
      });
    }
    result.push(...customItems);
    return result;
  }

  function onSubmit(data: FormValues) {
    const itemsList = buildItemsList();
    if (itemsList.length === 0) {
      toast({ title: "Selecione ao menos uma pendência", variant: "destructive" });
      return;
    }
    createTask.mutate(
      {
        id: patientId,
        data: {
          items: JSON.stringify(itemsList),
          status: data.status,
          responsible: data.responsible,
        },
      },
      {
        onSuccess: () => {
          setNurseName(data.responsible);
          queryClient.invalidateQueries({ queryKey: getGetPatientTasksQueryKey(patientId) });
          toast({ title: "Pendências registradas com sucesso" });
          onSuccess();
        },
        onError: () => toast({ title: "Não foi possível registrar as pendências", variant: "destructive" }),
      }
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Header */}
        <div className="bg-muted/30 rounded-lg px-4 py-3 border border-border/50">
          <div className="flex items-center gap-2 mb-0.5">
            <ListTodo className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">Pendências</span>
          </div>
          <p className="text-xs text-muted-foreground">{patientName} · {dateLabel}</p>
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tarefas</Label>
          <div className="space-y-2 border border-border/50 rounded-lg p-3 bg-card/30">
            {STANDARD_ITEMS.map(item => (
              <div key={item.id} className="flex items-center gap-3 min-h-[44px] py-1">
                <Checkbox
                  id={`task-${item.id}`}
                  checked={checkedItems.has(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                  className="shrink-0 h-5 w-5"
                />
                <label
                  htmlFor={`task-${item.id}`}
                  className="text-sm cursor-pointer select-none flex-1 flex items-center gap-2 flex-wrap"
                >
                  {item.hasTime ? (
                    <>
                      <span>{item.label}</span>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <input
                          type="time"
                          value={itemTimes[item.id] ?? ""}
                          onChange={e => setItemTime(item.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="h-6 w-24 text-xs rounded border border-border/60 bg-background px-1.5 font-mono"
                        />
                      </div>
                    </>
                  ) : (
                    item.label
                  )}
                </label>
              </div>
            ))}

            {/* Custom items already added */}
            {customItems.map((ci, idx) => (
              <div key={`custom-${idx}`} className="flex items-center gap-3">
                <Checkbox checked disabled className="shrink-0" />
                <span className="text-sm flex-1">
                  {ci.text}
                  {ci.time && <span className="text-muted-foreground ml-1 font-mono text-xs">({ci.time})</span>}
                </span>
                <button type="button" onClick={() => removeCustomItem(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {/* Add custom */}
            <div className="flex gap-2 mt-2 pt-2 border-t border-border/40">
              <Input
                placeholder="Outra pendência..."
                value={newCustomText}
                onChange={e => setNewCustomText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomItem(); } }}
                className="h-7 text-xs flex-1"
              />
              <input
                type="time"
                value={newCustomTime}
                onChange={e => setNewCustomTime(e.target.value)}
                className="h-7 w-24 text-xs rounded border border-border/60 bg-background px-1.5 font-mono shrink-0"
              />
              <Button type="button" size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={addCustomItem}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Inicial</Label>
          <FormField control={form.control} name="status" render={({ field }) => (
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
          )} />
        </div>

        {/* Responsible */}
        <FormField control={form.control} name="responsible" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Responsável <span className="text-destructive">*</span></FormLabel>
            <FormControl>
              <Input placeholder="Nome do profissional" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancelar</Button>
          <Button type="submit" className="flex-1" disabled={createTask.isPending}>
            {createTask.isPending ? "Registrando..." : "Registrar Pendências"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
