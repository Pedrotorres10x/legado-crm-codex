import { Users } from "lucide-react";
import AISectionGuide from "@/components/ai/AISectionGuide";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type ContactsOverviewSectionProps = {
  uviCount: number;
  prospectCount: number;
  buyerCount: number;
  peopleBaseTotal: number;
  relationshipBaseCount: number;
};

export default function ContactsOverviewSection({
  uviCount,
  prospectCount,
  buyerCount,
  peopleBaseTotal,
  relationshipBaseCount,
}: ContactsOverviewSectionProps) {
  return (
    <>
      <AISectionGuide
        title="Personas: aqui empieza casi todo"
        context="Aqui trabajas personas y relaciones: circulo, zona, prospectos vendedores y compradores. Si esta base esta viva, el negocio nace solo."
        doNow={`Ahora mismo tienes ${uviCount} contacto${uviCount === 1 ? '' : 's'} en UVI, ${prospectCount} prospecto${prospectCount === 1 ? '' : 's'} vendedor${prospectCount === 1 ? '' : 'es'} y ${buyerCount} comprador${buyerCount === 1 ? '' : 'es'} activos. Empieza por ahi.`}
        dontForget="Prospecto es el dueño que aun no ha firmado. Propietario es cliente. Si clasificas mal, luego haces toques malos y pierdes negocio."
        risk="Una base fria o mal segmentada te deja sin visitas de captacion, sin recomendaciones y sin ventas futuras."
        actions={[
          { label: 'Que hago primero aqui', description: 'Revisa UVI, sube contactos nuevos y marca bien si son circulo, zona, prospecto o comprador.' },
          { label: 'Que contacto tiene mas valor', description: 'El que te puede abrir un propietario, una visita de captacion o una venta en el corto plazo.' },
          { label: 'Cuando un dueno deja de ser prospecto', description: 'Cuando firma con nosotros y pasa a ser propietario cliente.' },
        ]}
      />

      <Card className="border-0 shadow-[var(--shadow-card)]">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Base de negocio</p>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Personas</h1>
            <p className="text-sm text-muted-foreground">
              Tu negocio nace aqui: relaciones, prospectos vendedores, compradores y contactos que te pueden abrir la siguiente captacion.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Base total</p>
              <p className="mt-2 text-2xl font-bold">{peopleBaseTotal}</p>
              <p className="mt-1 text-xs text-muted-foreground">Personas registradas para trabajar negocio.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Circulo de influencia</p>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Relacional</Badge>
              </div>
              <p className="mt-2 text-2xl font-bold">{relationshipBaseCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Base relacional que puede abrir referrals, propietarios y negocio futuro.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Prospectos vendedores</p>
              <p className="mt-2 text-2xl font-bold">{prospectCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Dueños que aun no han firmado con nosotros.</p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Compradores + UVI</p>
              <p className="mt-2 text-2xl font-bold">{buyerCount + uviCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Negocio activo que pide seguimiento y siguiente paso.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
