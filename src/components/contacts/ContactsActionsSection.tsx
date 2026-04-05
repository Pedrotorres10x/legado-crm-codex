import { Building2, Bot, Plus, Sparkles, Users } from "lucide-react";
import BulkImportContacts from "@/components/BulkImportContacts";
import DocumentScanner from "@/components/DocumentScanner";
import PortalLeadUploadDialog from "@/components/PortalLeadUploadDialog";
import StatefoxProspectingDialog from "@/components/StatefoxProspectingDialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ContactsActionsSectionProps = {
  isMobile: boolean;
  isAgentMode: boolean;
  canBulkImport: boolean;
  setDialogOpen: (open: boolean) => void;
  setAiDialogOpen: (open: boolean) => void;
  statefoxOpen: boolean;
  setStatefoxOpen: (open: boolean) => void;
  bulkImportOpen: boolean;
  setBulkImportOpen: (open: boolean) => void;
  refreshContactsFirstPage: () => Promise<void>;
  handleAutoCreateContactFromDocument: (data: unknown) => Promise<void>;
  userId?: string;
};

export default function ContactsActionsSection({
  isMobile,
  isAgentMode,
  canBulkImport,
  setDialogOpen,
  setAiDialogOpen,
  statefoxOpen,
  setStatefoxOpen,
  bulkImportOpen,
  setBulkImportOpen,
  refreshContactsFirstPage,
  handleAutoCreateContactFromDocument,
  userId,
}: ContactsActionsSectionProps) {
  if (isMobile) return null;

  return (
    <>
      <div className="border-0 shadow-[var(--shadow-card)] rounded-xl bg-card">
        <Accordion type="single" collapsible defaultValue="actions">
          <AccordionItem value="actions" className="border-b-0">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="min-w-0 text-left">
                <p className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {isAgentMode ? 'Dar de alta contactos' : 'Altas y automatizaciones'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isAgentMode
                    ? 'Empieza por alta manual o DNI. Lo demás puede esperar.'
                    : 'Crear contactos manualmente o apoyarte en documento, IA e importación.'}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className={cn('grid gap-3 md:grid-cols-2', !isAgentMode && 'xl:grid-cols-4')}>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-sm font-medium">Alta manual</p>
                  <p className="text-xs text-muted-foreground mt-1">Crear un contacto nuevo con lo mínimo útil para empezar a trabajar.</p>
                  <Button className="mt-3 w-full" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />Añadir persona
                  </Button>
                </div>
                <div className="rounded-xl border border-border/60 p-4">
                  <p className="text-sm font-medium">Alta por DNI</p>
                  <p className="text-xs text-muted-foreground mt-1">Extraer datos desde documento y evitar duplicados.</p>
                  <div className="mt-3">
                    <DocumentScanner context="contact" buttonLabel="Escanear DNI" onExtracted={handleAutoCreateContactFromDocument} />
                  </div>
                </div>
                {!isAgentMode && (
                  <div className="rounded-xl border border-border/60 p-4">
                    <p className="text-sm font-medium">Crear con IA</p>
                    <p className="text-xs text-muted-foreground mt-1">Levantar un contacto a partir de texto guiado por IA.</p>
                    <Button variant="outline" className="mt-3 w-full hover-lift" onClick={() => setAiDialogOpen(true)}>
                      <Bot className="h-4 w-4 mr-2" />Crear con IA
                    </Button>
                  </div>
                )}
                {!isAgentMode && (
                  <div className="rounded-xl border border-border/60 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Importación y portales</p>
                      <p className="text-xs text-muted-foreground mt-1">Subir leads externos o lotes de contactos.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" onClick={() => setStatefoxOpen(true)}>
                        <Building2 className="h-4 w-4 mr-2" />Captar con Statefox
                      </Button>
                      <PortalLeadUploadDialog />
                      {canBulkImport && (
                        <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
                          <Users className="h-4 w-4 mr-2" />Importar contactos
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <StatefoxProspectingDialog
        open={statefoxOpen}
        onOpenChange={setStatefoxOpen}
        onImported={refreshContactsFirstPage}
      />

      {canBulkImport && (
        <BulkImportContacts
          open={bulkImportOpen}
          onClose={() => setBulkImportOpen(false)}
          onImported={refreshContactsFirstPage}
          agentId={userId ?? ''}
        />
      )}
    </>
  );
}
