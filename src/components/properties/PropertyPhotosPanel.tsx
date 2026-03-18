import * as AccordionUI from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import PhotoOrderDialog from '@/components/PhotoOrderDialog';
import BulkDeletePhotosDialog from '@/components/BulkDeletePhotosDialog';
import {
  ArrowUpDown,
  GripVertical,
  Image,
  Loader2,
  Pencil,
  Trash2,
  Upload,
} from 'lucide-react';

type PropertyPhoto = {
  url: string;
  name: string;
  label?: string | null;
  isXml?: boolean;
};

type Props = {
  images: PropertyPhoto[];
  isAdmin: boolean;
  isCoordinadora: boolean;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUploadFiles: (files: FileList, type: 'image') => void;
  dragIndex: number | null;
  setDragIndex: (index: number | null) => void;
  dragOverIndex: number | null;
  setDragOverIndex: (index: number | null) => void;
  handleDragDrop: (fromIndex: number, toIndex: number) => void;
  editingLabel: string | null;
  setEditingLabel: (value: string | null) => void;
  editingLabelValue: string;
  setEditingLabelValue: (value: string) => void;
  updateImageLabel: (imageName: string, nextLabel: string) => void;
  deleteFile: (fileName: string) => void;
  setLightboxIndex: (index: number) => void;
  setLightboxOpen: (open: boolean) => void;
  logMediaAccess: (action: string) => void;
  photoOrderOpen: boolean;
  setPhotoOrderOpen: (open: boolean) => void;
  saveImageOrder: (newOrder: { name: string; label: string; source: string }[]) => Promise<void>;
  applyDefaultOrder: () => void;
  bulkDeleteOpen: boolean;
  setBulkDeleteOpen: (open: boolean) => void;
  bulkDeletePhotos: (names: string[]) => Promise<void>;
  userEmail?: string | null;
};

const PropertyPhotosPanel = ({
  images,
  isAdmin,
  isCoordinadora,
  uploading,
  fileInputRef,
  onUploadFiles,
  dragIndex,
  setDragIndex,
  dragOverIndex,
  setDragOverIndex,
  handleDragDrop,
  editingLabel,
  setEditingLabel,
  editingLabelValue,
  setEditingLabelValue,
  updateImageLabel,
  deleteFile,
  setLightboxIndex,
  setLightboxOpen,
  logMediaAccess,
  photoOrderOpen,
  setPhotoOrderOpen,
  saveImageOrder,
  applyDefaultOrder,
  bulkDeleteOpen,
  setBulkDeleteOpen,
  bulkDeletePhotos,
  userEmail,
}: Props) => {
  const canManagePhotos = isAdmin || isCoordinadora;

  return (
    <>
      <Card className="animate-fade-in-up">
        <AccordionUI.Accordion type="single" collapsible>
          <AccordionUI.AccordionItem value="photos" className="border-b-0">
            <div className="px-6 pt-6 pb-2 flex items-center justify-between gap-2 flex-wrap">
              <AccordionUI.AccordionTrigger className="py-0 hover:no-underline flex-1 min-w-0">
                <span className="text-base font-semibold flex items-center gap-2">
                  <Image className="h-4 w-4 text-primary" />
                  Fotos ({images.length})
                </span>
              </AccordionUI.AccordionTrigger>
              <div className="flex items-center gap-2 flex-wrap" onClick={(event) => event.stopPropagation()}>
                {canManagePhotos && images.length > 1 && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setPhotoOrderOpen(true)}>
                      <ArrowUpDown className="h-3.5 w-3.5 mr-1" />Ordenar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setBulkDeleteOpen(true)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />Eliminar
                    </Button>
                  </>
                )}
                {canManagePhotos && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(event) => event.target.files && onUploadFiles(event.target.files, 'image')}
                    />
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
                      Subir Fotos
                    </Button>
                  </>
                )}
              </div>
            </div>
            <AccordionUI.AccordionContent className="px-6 pb-6">
              {images.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  <Image className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>Sin fotos. Sube imágenes del inmueble.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {images.map((img, index) => (
                    <div
                      key={`${img.isXml ? 'xml' : 'storage'}-${img.name}`}
                      className={`relative group rounded-xl overflow-hidden bg-muted select-none transition-all duration-200 ${
                        dragIndex === index ? 'opacity-50 scale-95' : ''
                      } ${dragOverIndex === index && dragIndex !== index ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                      draggable={canManagePhotos && images.length > 1}
                      onDragStart={(event) => {
                        setDragIndex(index);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDragOverIndex(index);
                      }}
                      onDragLeave={() => setDragOverIndex(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dragIndex !== null && dragIndex !== index) {
                          handleDragDrop(dragIndex, index);
                        }
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                      onDragEnd={() => {
                        setDragIndex(null);
                        setDragOverIndex(null);
                      }}
                    >
                      <div
                        className="aspect-[4/3] cursor-pointer"
                        onClick={() => {
                          setLightboxIndex(index);
                          setLightboxOpen(true);
                          logMediaAccess('open_lightbox');
                        }}
                        onContextMenu={(event) => event.preventDefault()}
                      >
                        <img
                          src={img.url}
                          alt={img.label || img.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                          draggable={false}
                          style={{ WebkitUserDrag: 'none' } as any}
                        />
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-[0.15]">
                          <div className="rotate-[-35deg] whitespace-nowrap text-foreground font-bold text-sm tracking-widest select-none">
                            {userEmail} • {userEmail} • {userEmail}
                          </div>
                        </div>
                        {img.isXml && (
                          <span className="absolute top-2 left-2 text-[10px] bg-primary/80 text-primary-foreground px-1.5 py-0.5 rounded">
                            XML
                          </span>
                        )}
                      </div>

                      <div className="p-2 space-y-1">
                        {editingLabel === img.name ? (
                          <Input
                            autoFocus
                            className="h-7 text-xs"
                            placeholder="Ej: Salón, Cocina, Dormitorio 1..."
                            value={editingLabelValue}
                            onChange={(event) => setEditingLabelValue(event.target.value)}
                            onBlur={() => updateImageLabel(img.name, editingLabelValue)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') updateImageLabel(img.name, editingLabelValue);
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-1 min-h-[28px]">
                            <span className="text-xs text-muted-foreground truncate flex-1">
                              {img.label || img.name.replace(/^\d+_/, '').replace(/\.[^.]+$/, '')}
                            </span>
                            {canManagePhotos && (
                              <button
                                className="shrink-0 h-6 w-6 rounded flex items-center justify-center hover:bg-accent transition-colors"
                                onClick={() => {
                                  setEditingLabel(img.name);
                                  setEditingLabelValue(img.label || '');
                                }}
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        )}

                        {canManagePhotos && (
                          <div className="flex items-center gap-1">
                            {images.length > 1 && (
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
                            )}
                            <span className="text-[10px] text-muted-foreground ml-1">{index + 1}/{images.length}</span>
                            {!img.isXml && (
                              <button
                                className="ml-auto h-6 w-6 rounded flex items-center justify-center hover:bg-destructive/10 text-destructive transition-colors"
                                onClick={() => deleteFile(img.name)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionUI.AccordionContent>
          </AccordionUI.AccordionItem>
        </AccordionUI.Accordion>
      </Card>

      <PhotoOrderDialog
        open={photoOrderOpen}
        onOpenChange={setPhotoOrderOpen}
        images={images.map((img) => ({ url: img.url, name: img.name, label: img.label || '', isXml: !!img.isXml }))}
        onSave={saveImageOrder}
        onApplyDefaultOrder={applyDefaultOrder}
      />

      <BulkDeletePhotosDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        images={images.map((img) => ({ url: img.url, name: img.name, label: img.label || '', isXml: !!img.isXml }))}
        onDelete={bulkDeletePhotos}
      />
    </>
  );
};

export default PropertyPhotosPanel;
