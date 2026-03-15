import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PropertyDocumentsDialogsProps {
  linkDialogOpen: boolean;
  setLinkDialogOpen: (open: boolean) => void;
  linkingOwnerName: string;
  loadingSuggestions: boolean;
  ownerSuggestions: any[];
  linkingDoc: any | null;
  resolvingHolder: string | null;
  handleLinkExistingOwner: (contact: any) => void;
  resetLinkingState: () => void;
  showAdd: boolean;
  setShowAdd: (open: boolean) => void;
  newDoc: { doc_type: string; label: string; expires_at: string; file: File | null };
  setNewDoc: React.Dispatch<React.SetStateAction<{ doc_type: string; label: string; expires_at: string; file: File | null }>>;
  allDocTypes: { value: string; label: string }[];
  handleUpload: () => void;
  uploading: boolean;
  analyzing: boolean;
}

const PropertyDocumentsDialogs = ({
  linkDialogOpen,
  setLinkDialogOpen,
  linkingOwnerName,
  loadingSuggestions,
  ownerSuggestions,
  linkingDoc,
  resolvingHolder,
  handleLinkExistingOwner,
  resetLinkingState,
  showAdd,
  setShowAdd,
  newDoc,
  setNewDoc,
  allDocTypes,
  handleUpload,
  uploading,
  analyzing,
}: PropertyDocumentsDialogsProps) => {
  return (
    <>
      <Dialog
        open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) resetLinkingState();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular titular existente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {linkingOwnerName
                ? `Titular detectado: ${linkingOwnerName}`
                : 'Selecciona un contacto existente para vincularlo como propietario.'}
            </p>
            {loadingSuggestions ? (
              <p className="text-sm text-muted-foreground">Buscando coincidencias en CRM...</p>
            ) : ownerSuggestions.length > 0 ? (
              ownerSuggestions.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium">{contact.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[contact.contact_type, contact.email, contact.phone, contact.id_number].filter(Boolean).join(' · ') || 'Sin datos adicionales'}
                    </p>
                    {contact.match_reason ? (
                      <p className="text-xs text-emerald-700">
                        Coincidencia: {contact.match_reason}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleLinkExistingOwner(contact)}
                    disabled={resolvingHolder === `${linkingDoc?.id}:${linkingOwnerName}:link:${contact.id}`}
                  >
                    {resolvingHolder === `${linkingDoc?.id}:${linkingOwnerName}:link:${contact.id}` ? 'Vinculando...' : 'Vincular'}
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No he encontrado coincidencias claras en CRM para este titular.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de documento</Label>
              <Select
                value={newDoc.doc_type}
                onValueChange={(value) => {
                  const match = allDocTypes.find((docType) => docType.value === value);
                  setNewDoc((prev) => ({ ...prev, doc_type: value, label: match?.label || '' }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {allDocTypes.map((docType) => (
                    <SelectItem key={docType.value} value={docType.value}>{docType.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newDoc.doc_type === 'otro' && (
              <div>
                <Label>Nombre del documento</Label>
                <Input
                  value={newDoc.label}
                  onChange={(event) => setNewDoc((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="Ej: Licencia de obras"
                />
              </div>
            )}
            <div>
              <Label>Fecha de vencimiento (opcional)</Label>
              <Input
                type="date"
                value={newDoc.expires_at}
                onChange={(event) => setNewDoc((prev) => ({ ...prev, expires_at: event.target.value }))}
              />
            </div>
            <div>
              <Label>Archivo</Label>
              <Input
                type="file"
                onChange={(event) => setNewDoc((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={uploading || !newDoc.doc_type}>
              {uploading || analyzing ? 'Subiendo y analizando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PropertyDocumentsDialogs;
