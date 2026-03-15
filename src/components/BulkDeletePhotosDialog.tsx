import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, CheckSquare, Square, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface PhotoItem {
  url: string;
  name: string;
  label: string;
  isXml: boolean;
}

interface BulkDeletePhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: PhotoItem[];
  onDelete: (names: string[]) => Promise<void>;
}

const BulkDeletePhotosDialog = ({ open, onOpenChange, images, onDelete }: BulkDeletePhotosDialogProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Only storage images can be deleted (not XML)
  const deletableImages = images.filter(img => !img.isXml);
  const allSelected = deletableImages.length > 0 && deletableImages.every(img => selected.has(img.name));

  const toggleOne = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(deletableImages.map(img => img.name)));
    }
  };

  const handleConfirmDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    await onDelete(Array.from(selected));
    setSelected(new Set());
    setDeleting(false);
    onOpenChange(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) setSelected(new Set());
    onOpenChange(v);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Eliminar fotos ({selected.size} seleccionadas)
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3 pb-2 border-b">
            <Button
              size="sm"
              variant={allSelected ? 'default' : 'outline'}
              onClick={toggleAll}
              disabled={deletableImages.length === 0}
            >
              {allSelected ? <CheckSquare className="h-4 w-4 mr-1.5" /> : <Square className="h-4 w-4 mr-1.5" />}
              {allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}
            </Button>
            {images.some(img => img.isXml) && (
              <span className="text-xs text-muted-foreground">
                Las fotos XML no se pueden eliminar desde aquí
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 p-1">
              {images.map((img, i) => {
                const isSelected = selected.has(img.name);
                const canDelete = !img.isXml;

                return (
                  <div
                    key={`${img.isXml ? 'xml' : 'st'}-${img.name}`}
                    className={`relative rounded-lg overflow-hidden cursor-pointer transition-all duration-150 ${
                      canDelete
                        ? isSelected
                          ? 'ring-2 ring-destructive ring-offset-1 opacity-100'
                          : 'hover:ring-2 hover:ring-muted-foreground/30 opacity-100'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                    onClick={() => canDelete && toggleOne(img.name)}
                  >
                    <div className="aspect-square">
                      <img
                        src={img.url}
                        alt={img.label || img.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>

                    {/* Checkbox overlay */}
                    {canDelete && (
                      <div className="absolute top-1.5 left-1.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(img.name)}
                          className="h-5 w-5 bg-background/80 border-2"
                        />
                      </div>
                    )}

                    {/* XML badge */}
                    {img.isXml && (
                      <span className="absolute top-1.5 left-1.5 text-[10px] bg-primary/80 text-primary-foreground px-1.5 py-0.5 rounded">
                        XML
                      </span>
                    )}

                    {/* Number */}
                    <span className="absolute bottom-1 right-1.5 text-[10px] bg-black/60 text-white px-1 rounded">
                      {i + 1}
                    </span>

                    {/* Label */}
                    {img.label && (
                      <span className="absolute bottom-1 left-1.5 text-[10px] bg-black/60 text-white px-1 rounded truncate max-w-[80%]">
                        {img.label}
                      </span>
                    )}

                    {/* Selection overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-destructive/20 pointer-events-none" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2 border-t">
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={selected.size === 0 || deleting}
              onClick={() => setConfirmOpen(true)}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1.5" />
              )}
              Eliminar {selected.size} foto{selected.size !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} foto{selected.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las fotos se eliminarán permanentemente del almacenamiento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkDeletePhotosDialog;
