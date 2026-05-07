import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAddPatientTransfer,
  getGetPatientTransfersQueryKey,
} from "@workspace/api-client-react";
import type { CreateTransferBody, CreateTransferBodyTransferStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/use-auth";

const DESTINATION_HOSPITALS = [
  "Hospital Municipal de Breves",
  "Hospital Regional Público do Marajó de Breves",
  "Hospital de Clínicas Gaspar Vianna (Belém)",
  "Hospital Abelardo Santos (Belém)",
  "Santa Casa de Misericórdia (Belém)",
  "Hospital Ordem Terceira (Belém)",
  "Hospital Maradei (Belém)",
  "Hospital Metropolitano (Belém)",
] as const;

const SPECIALTIES = [
  "Cardiologia",
  "Psiquiatria",
  "Clínica Médica",
  "Cirurgia",
  "Outros",
] as const;

const TRANSFER_STATUSES = [
  "Solicitado",
  "Autorizado",
  "Em transferência",
  "Transferido",
  "Recusado",
] as const;

const TRANSPORT_TYPES = [
  "Ambulância básica",
  "Ambulância avançada (UTI)",
  "Outros",
] as const;

interface TransferFormProps {
  patientId: number;
  onSuccess: () => void;
  onCancel:  () => void;
}

export function TransferForm({ patientId, onSuccess, onCancel }: TransferFormProps) {
  const { activeUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const addTransfer = useAddPatientTransfer();

  const [form, setForm] = useState({
    destinationHospital: "",
    specialty:           "",
    reasonForTransfer:   "",
    transferStatus:      "Solicitado",
    transportType:       "",
    regulationContact:   "",
    departureDatetime:   "",
    arrivalConfirmation: false,
    arrivalDatetime:     "",
  });

  const set = (key: keyof typeof form) => (value: string | boolean) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.destinationHospital) {
      toast({ title: "Selecione o hospital de destino", variant: "destructive" });
      return;
    }
    if (!form.reasonForTransfer.trim()) {
      toast({ title: "Motivo do encaminhamento é obrigatório", variant: "destructive" });
      return;
    }

    const body: CreateTransferBody = {
      userId:              activeUser?.id ?? 0,
      destinationHospital: form.destinationHospital,
      specialty:           form.specialty,
      reasonForTransfer:   form.reasonForTransfer.trim(),
      transferStatus:      form.transferStatus as CreateTransferBodyTransferStatus,
      transportType:       form.transportType,
      regulationContact:   form.regulationContact.trim(),
      departureDatetime:   form.departureDatetime || undefined,
      arrivalConfirmation: form.arrivalConfirmation,
      arrivalDatetime:     form.arrivalDatetime || undefined,
    };

    addTransfer.mutate(
      { id: patientId, data: body },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetPatientTransfersQueryKey(patientId) });
          toast({ title: "Encaminhamento registrado com sucesso" });
          onSuccess();
        },
        onError: () => {
          toast({ title: "Erro ao registrar encaminhamento", variant: "destructive" });
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1.5">
          <Label>Hospital de Destino <span className="text-destructive">*</span></Label>
          <Select value={form.destinationHospital} onValueChange={set("destinationHospital")}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o hospital…" />
            </SelectTrigger>
            <SelectContent>
              {DESTINATION_HOSPITALS.map(h => (
                <SelectItem key={h} value={h}>{h}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Especialidade</Label>
          <Select value={form.specialty} onValueChange={set("specialty")}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a especialidade…" />
            </SelectTrigger>
            <SelectContent>
              {SPECIALTIES.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Motivo do Encaminhamento <span className="text-destructive">*</span></Label>
          <Textarea
            placeholder="Descreva o motivo clínico do encaminhamento…"
            value={form.reasonForTransfer}
            onChange={e => set("reasonForTransfer")(e.target.value)}
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Status do Encaminhamento</Label>
            <Select value={form.transferStatus} onValueChange={set("transferStatus")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSFER_STATUSES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de Transporte</Label>
            <Select value={form.transportType} onValueChange={set("transportType")}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent>
                {TRANSPORT_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Contato NIR / Central de Regulação</Label>
          <Input
            placeholder="Número de protocolo ou contato da regulação"
            value={form.regulationContact}
            onChange={e => set("regulationContact")(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Data/Hora de Saída</Label>
          <Input
            type="datetime-local"
            value={form.departureDatetime}
            onChange={e => set("departureDatetime")(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            id="arrival-confirm"
            checked={form.arrivalConfirmation}
            onCheckedChange={v => set("arrivalConfirmation")(Boolean(v))}
          />
          <Label htmlFor="arrival-confirm" className="cursor-pointer">
            Chegada confirmada no hospital de destino
          </Label>
        </div>

        {form.arrivalConfirmation && (
          <div className="space-y-1.5">
            <Label>Data/Hora de Chegada</Label>
            <Input
              type="datetime-local"
              value={form.arrivalDatetime}
              onChange={e => set("arrivalDatetime")(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={addTransfer.isPending}>
          {addTransfer.isPending ? "Salvando…" : "Registrar Encaminhamento"}
        </Button>
      </div>
    </form>
  );
}
