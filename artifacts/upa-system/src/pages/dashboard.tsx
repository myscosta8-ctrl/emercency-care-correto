import { useState } from "react";
import { Link } from "wouter";
import { useListPatients, useGetPatientsSummary } from "@workspace/api-client-react";
import { Activity, HeartPulse, Stethoscope, UserPlus, Users, AlertTriangle, Eye, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PatientForm } from "@/components/patient-form";

export default function Dashboard() {
  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);
  const { data: patients, isLoading: isLoadingPatients } = useListPatients();
  const { data: summary, isLoading: isLoadingSummary } = useGetPatientsSummary();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "critical":
        return <Badge variant="default" className="bg-critical hover:bg-critical text-critical-foreground border-critical">Critical</Badge>;
      case "observation":
        return <Badge variant="default" className="bg-observation hover:bg-observation text-observation-foreground border-observation">Observation</Badge>;
      case "stable":
        return <Badge variant="default" className="bg-stable hover:bg-stable text-stable-foreground border-stable">Stable</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight">UPA Command Center</h1>
          </div>
          <Button onClick={() => setIsNewPatientOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            New Patient
          </Button>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Patients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{summary?.total || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="border-critical/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-critical">Critical</CardTitle>
              <AlertTriangle className="h-4 w-4 text-critical" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-critical">{summary?.critical || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="border-observation/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-observation">Observation</CardTitle>
              <Eye className="h-4 w-4 text-observation" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-observation">{summary?.observation || 0}</div>
              )}
            </CardContent>
          </Card>
          <Card className="border-stable/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-stable">Stable</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-stable" />
            </CardHeader>
            <CardContent>
              {isLoadingSummary ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-stable">{summary?.stable || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold tracking-tight">Active Patients</h2>
        </div>

        {isLoadingPatients ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="flex flex-col border-border/50">
                <CardHeader className="pb-2"><Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
                <CardContent className="pb-2"><Skeleton className="h-16 w-full" /></CardContent>
                <CardFooter><Skeleton className="h-4 w-1/3" /></CardFooter>
              </Card>
            ))}
          </div>
        ) : !patients || patients.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <Stethoscope className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No patients currently</h3>
            <p className="text-muted-foreground mt-1">Click 'New Patient' to admit someone to the unit.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map(patient => (
              <Link key={patient.id} href={`/patients/${patient.id}`} className="block group">
                <Card className={`h-full transition-all hover:bg-muted/30 hover:border-primary/50 cursor-pointer ${
                  patient.status === 'critical' ? 'border-critical/30' : 
                  patient.status === 'observation' ? 'border-observation/30' : 'border-border/50'
                }`}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {patient.name}
                        </CardTitle>
                        <CardDescription>Age {patient.age} &bull; Bed: {patient.bed}</CardDescription>
                      </div>
                      {getStatusBadge(patient.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="text-sm font-medium mb-3 truncate text-muted-foreground" title={patient.diagnosis}>
                      {patient.diagnosis}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-background/50 rounded p-2 border border-border/50">
                        <div className="text-muted-foreground flex items-center gap-1 mb-1">
                          <HeartPulse className="h-3 w-3" /> HR
                        </div>
                        <div className="font-mono text-sm text-foreground">{patient.heartRate} <span className="text-[10px] text-muted-foreground">bpm</span></div>
                      </div>
                      <div className="bg-background/50 rounded p-2 border border-border/50">
                        <div className="text-muted-foreground mb-1">Resp</div>
                        <div className="font-mono text-sm text-foreground">{patient.respiratoryRate} <span className="text-[10px] text-muted-foreground">irpm</span></div>
                      </div>
                      <div className="bg-background/50 rounded p-2 border border-border/50">
                        <div className="text-muted-foreground mb-1">Gluc</div>
                        <div className="font-mono text-sm text-foreground">{patient.glucose}</div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="text-xs text-muted-foreground border-t border-border/50 mt-2 pt-3 flex justify-between">
                    <span>{patient.sector}</span>
                    <span>Admitted: {format(new Date(patient.createdAt), "MMM d, HH:mm")}</span>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <Dialog open={isNewPatientOpen} onOpenChange={setIsNewPatientOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Admit New Patient</DialogTitle>
            <DialogDescription>
              Enter patient details and initial vitals.
            </DialogDescription>
          </DialogHeader>
          <PatientForm 
            onSuccess={() => setIsNewPatientOpen(false)}
            onCancel={() => setIsNewPatientOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
