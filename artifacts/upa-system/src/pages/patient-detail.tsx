import { useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { format } from "date-fns";
import { 
  useGetPatient, 
  getGetPatientQueryKey,
  useDeletePatient,
  getListPatientsQueryKey,
  getGetPatientsSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Activity, ArrowLeft, Edit, Trash2, HeartPulse, 
  Wind, Droplet, Clock, MapPin, BedDouble 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { PatientForm } from "@/components/patient-form";

export default function PatientDetail() {
  const [, params] = useRoute("/patients/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : 0;
  
  const { data: patient, isLoading, isError } = useGetPatient(id, {
    query: {
      enabled: !!id,
      queryKey: getGetPatientQueryKey(id)
    }
  });

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  const deletePatient = useDeletePatient();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = () => {
    deletePatient.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetPatientsSummaryQueryKey() });
        toast({ title: "Patient discharged/deleted" });
        setLocation("/");
      },
      onError: () => {
        toast({ title: "Failed to delete patient", variant: "destructive" });
        setIsDeleteOpen(false);
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "critical":
        return <Badge variant="default" className="text-base px-3 py-1 bg-critical hover:bg-critical text-critical-foreground">Critical</Badge>;
      case "observation":
        return <Badge variant="default" className="text-base px-3 py-1 bg-observation hover:bg-observation text-observation-foreground">Observation</Badge>;
      case "stable":
        return <Badge variant="default" className="text-base px-3 py-1 bg-stable hover:bg-stable text-stable-foreground">Stable</Badge>;
      default:
        return <Badge variant="outline" className="text-base px-3 py-1">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="container mx-auto max-w-4xl">
          <Skeleton className="h-10 w-32 mb-6" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div className="min-h-screen bg-background p-6 flex flex-col items-center justify-center">
        <Activity className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Patient Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested patient record could not be loaded.</p>
        <Button asChild>
          <Link href="/">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="shrink-0">
              <Link href="/">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <span className="font-semibold tracking-tight hidden sm:inline">UPA Command Center</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Discharge
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="md:col-span-2 space-y-6">
            <Card className={`border-border/50 shadow-md ${
              patient.status === 'critical' ? 'border-critical/30' : 
              patient.status === 'observation' ? 'border-observation/30' : ''
            }`}>
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
                  <div>
                    <CardTitle className="text-3xl font-bold tracking-tight text-primary">
                      {patient.name}
                    </CardTitle>
                    <CardDescription className="text-base mt-1 flex items-center gap-2 text-muted-foreground">
                      <span>Age: {patient.age}</span>
                      <span>&bull;</span>
                      <span className="flex items-center"><MapPin className="h-3 w-3 mr-1"/> {patient.sector}</span>
                      <span>&bull;</span>
                      <span className="flex items-center"><BedDouble className="h-3 w-3 mr-1"/> Bed {patient.bed}</span>
                    </CardDescription>
                  </div>
                  <div className="shrink-0">
                    {getStatusBadge(patient.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Diagnosis</h3>
                  <p className="text-lg font-medium">{patient.diagnosis}</p>
                </div>
              </CardContent>
            </Card>

            <h3 className="text-xl font-bold tracking-tight flex items-center gap-2 mt-8">
              <Activity className="h-5 w-5 text-primary" />
              Current Vitals
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="border-border/50 shadow-sm bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Heart Rate</CardTitle>
                  <HeartPulse className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-mono font-bold">{patient.heartRate}</span>
                    <span className="text-sm text-muted-foreground">bpm</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Resp. Rate</CardTitle>
                  <Wind className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-mono font-bold">{patient.respiratoryRate}</span>
                    <span className="text-sm text-muted-foreground">irpm</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 shadow-sm bg-card/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Glucose</CardTitle>
                  <Droplet className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-mono font-bold">{patient.glucose}</span>
                    <span className="text-sm text-muted-foreground">mg/dL</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Admission Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Admitted</div>
                    <div className="font-medium">{format(new Date(patient.createdAt), "MMM d, yyyy")}</div>
                    <div className="text-sm text-muted-foreground">{format(new Date(patient.createdAt), "HH:mm")}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Sector</div>
                    <div className="font-medium">{patient.sector}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BedDouble className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Bed/Room</div>
                    <div className="font-medium">{patient.bed}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
        </div>
      </main>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Patient Record</DialogTitle>
            <DialogDescription>
              Update vitals and patient details.
            </DialogDescription>
          </DialogHeader>
          <PatientForm 
            patient={patient}
            onSuccess={() => setIsEditOpen(false)}
            onCancel={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discharge / Delete Patient</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this patient from the active unit roster? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePatient.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePatient.isPending}
            >
              {deletePatient.isPending ? "Processing..." : "Confirm Discharge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
