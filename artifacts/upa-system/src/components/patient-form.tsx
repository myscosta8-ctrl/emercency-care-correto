import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreatePatient, 
  useUpdatePatient,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey,
  getGetPatientQueryKey
} from "@workspace/api-client-react";
import type { Patient, CreatePatientBody } from "@workspace/api-client-react/src/generated/api.schemas";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  age: z.coerce.number().min(0, "Invalid age"),
  bed: z.string().min(1, "Bed is required"),
  diagnosis: z.string().min(1, "Diagnosis is required"),
  heartRate: z.coerce.number().min(0, "Invalid rate"),
  respiratoryRate: z.coerce.number().min(0, "Invalid rate"),
  glucose: z.coerce.number().min(0, "Invalid glucose"),
  status: z.enum(["critical", "observation", "stable"]),
  sector: z.string().min(1, "Sector is required"),
});

type FormValues = z.infer<typeof formSchema>;

interface PatientFormProps {
  patient?: Patient;
  onSuccess: () => void;
  onCancel: () => void;
}

export function PatientForm({ patient, onSuccess, onCancel }: PatientFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: patient?.name || "",
      age: patient?.age || 0,
      bed: patient?.bed || "",
      diagnosis: patient?.diagnosis || "",
      heartRate: patient?.heartRate || 0,
      respiratoryRate: patient?.respiratoryRate || 0,
      glucose: patient?.glucose || 0,
      status: patient?.status || "stable",
      sector: patient?.sector || "",
    },
  });

  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();

  const isPending = createPatient.isPending || updatePatient.isPending;

  function onSubmit(data: FormValues) {
    if (patient) {
      updatePatient.mutate({ id: patient.id, data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientQueryKey(patient.id) });
          toast({ title: "Patient updated" });
          onSuccess();
        },
        onError: () => {
          toast({ title: "Failed to update patient", variant: "destructive" });
        }
      });
    } else {
      createPatient.mutate({ data }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
          toast({ title: "Patient added" });
          onSuccess();
        },
        onError: () => {
          toast({ title: "Failed to add patient", variant: "destructive" });
        }
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Patient Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="age"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Age</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bed / Room</FormLabel>
                <FormControl>
                  <Input placeholder="ICU-01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="sector"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sector</FormLabel>
                <FormControl>
                  <Input placeholder="Emergency" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="observation">Observation</SelectItem>
                    <SelectItem value="stable">Stable</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="diagnosis"
            render={({ field }) => (
              <FormItem className="col-span-2">
                <FormLabel>Diagnosis</FormLabel>
                <FormControl>
                  <Input placeholder="Initial diagnosis..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="col-span-2 mt-2 mb-1">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Vitals</h4>
          </div>
          <FormField
            control={form.control}
            name="heartRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Heart Rate (bpm)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="respiratoryRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resp. Rate (irpm)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="glucose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Glucose (mg/dL)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : patient ? "Update Patient" : "Add Patient"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
