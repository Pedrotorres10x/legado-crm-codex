import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, GripVertical, Home } from 'lucide-react';

interface PhotoItem {
  url: string;
  name: string;
  label: string;
  isXml: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: PhotoItem[];
  onSave: (newOrder: { name: string; label: string; source: string }[]) => Promise<void>;
  onApplyDefaultOrder: () => void;
}

const PhotoOrderDialog = ({ open, onOpenChange, images, onSave, onApplyDefaultOrder }: Props) => {
  const [localImages, setLocalImages] = useState<PhotoItem[]>([]);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Touch drag state
  const touchState = useRef<{
    idx: number;
    startY: number;
    startX: number;
    clone: HTMLElement | null;
    scrollInterval: number | null;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalImages([...images]);
      setDirty(false);
      setDraggingIdx(null);
      setOverIdx(null);
    }
  }, [open, images]);

  const reorder = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setLocalImages(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setDirty(true);
  }, []);

  // ─── Native drag (desktop) ───
  const onDragStart = useCallback((e: React.DragEvent, idx: number) => {
    setDraggingIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    if (e.dataTransfer.setDragImage) {
      const el = e.currentTarget as HTMLElement;
      e.dataTransfer.setDragImage(el, el.offsetWidth / 2, 40);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setOverIdx(idx);
  }, []);

  const onDrop = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggingIdx !== null && draggingIdx !== idx) {
      reorder(draggingIdx, idx);
    }
    setDraggingIdx(null);
    setOverIdx(null);
  }, [draggingIdx, reorder]);

  const onDragEnd = useCallback(() => {
    setDraggingIdx(null);
    setOverIdx(null);
  }, []);

  // ─── Touch drag (mobile) ───
  const getItemAtPoint = useCallback((x: number, y: number): number | null => {
    for (const [idx, el] of itemRefs.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return idx;
      }
    }
    return null;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent, idx: number) => {
    const touch = e.touches[0];
    const el = itemRefs.current.get(idx);
    if (!el) return;

    // Create floating clone
    const rect = el.getBoundingClientRect();
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.position = 'fixed';
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.zIndex = '9999';
    clone.style.pointerEvents = 'none';
    clone.style.opacity = '0.85';
    clone.style.transform = 'scale(1.05)';
    clone.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)';
    clone.style.borderRadius = '0.75rem';
    clone.style.transition = 'transform 0.1s ease';
    document.body.appendChild(clone);

    touchState.current = {
      idx,
      startY: touch.clientY - rect.top,
      startX: touch.clientX - rect.left,
      clone,
      scrollInterval: null,
    };
    setDraggingIdx(idx);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchState.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const { clone, startX, startY } = touchState.current;

    if (clone) {
      clone.style.left = `${touch.clientX - startX}px`;
      clone.style.top = `${touch.clientY - startY}px`;
    }

    // Auto-scroll
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const scrollZone = 60;
      if (touch.clientY < rect.top + scrollZone) {
        container.scrollTop -= 8;
      } else if (touch.clientY > rect.bottom - scrollZone) {
        container.scrollTop += 8;
      }
    }

    const targetIdx = getItemAtPoint(touch.clientX, touch.clientY);
    setOverIdx(targetIdx);
  }, [getItemAtPoint]);

  const onTouchEnd = useCallback(() => {
    if (!touchState.current) return;
    const { idx: fromIdx, clone } = touchState.current;

    if (clone) {
      clone.remove();
    }

    if (overIdx !== null && fromIdx !== overIdx) {
      reorder(fromIdx, overIdx);
    }

    touchState.current = null;
    setDraggingIdx(null);
    setOverIdx(null);
  }, [overIdx, reorder]);

  // Cleanup clone on unmount
  useEffect(() => {
    return () => {
      if (touchState.current?.clone) {
        touchState.current.clone.remove();
      }
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const newOrder = localImages.map(img => ({
      name: img.name,
      label: img.label || '',
      source: img.isXml ? 'xml' : 'storage',
    }));
    await onSave(newOrder);
    setSaving(false);
    setDirty(false);
    onOpenChange(false);
  };

  const handleClose = () => {
    if (dirty) {
      handleSave();
    } else {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v); }}>
      <DialogContent className="max-w-[95vw] w-full max-h-[95vh] h-[95vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ArrowUpDown className="h-5 w-5 text-primary" />
            Ordenar fotos ({localImages.length})
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Arrastra y suelta para reordenar las fotos</p>
        </DialogHeader>

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto min-h-0 pr-1 -mr-1"
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {localImages.map((img, i) => (
              <div
                key={`order-${img.isXml ? 'xml' : 'storage'}-${img.name}`}
                ref={(el) => { if (el) itemRefs.current.set(i, el); else itemRefs.current.delete(i); }}
                className={`relative rounded-xl overflow-hidden bg-muted select-none border-2 transition-all duration-200 ease-out ${
                  draggingIdx === i
                    ? 'opacity-30 scale-90 border-primary/40'
                    : 'border-transparent hover:border-primary/20 hover:shadow-md'
                } ${
                  overIdx === i && draggingIdx !== null && draggingIdx !== i
                    ? 'ring-2 ring-primary ring-offset-2 scale-[1.04] shadow-lg border-primary'
                    : ''
                }`}
                draggable
                onDragStart={(e) => onDragStart(e, i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDragLeave={() => setOverIdx(null)}
                onDrop={(e) => onDrop(e, i)}
                onDragEnd={onDragEnd}
                onTouchStart={(e) => onTouchStart(e, i)}
              >
                <div className="aspect-[4/3]">
                  <img
                    src={img.url}
                    alt={img.label || img.name}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                </div>
                <div className="absolute top-1.5 right-1.5 bg-background/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 shadow-sm">
                  <span className="text-xs font-bold text-foreground">{i + 1}</span>
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 pt-4">
                  <div className="flex items-center gap-1">
                    <GripVertical className="h-3.5 w-3.5 text-white/70 shrink-0" />
                    <span className="text-xs font-medium text-white truncate">
                      {img.label || img.name.replace(/^\d+_/, '').replace(/\.[^.]+$/, '')}
                    </span>
                  </div>
                </div>
                {img.isXml && (
                  <span className="absolute top-1.5 left-1.5 text-[9px] bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded-md font-semibold">
                    XML
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 shrink-0 border-t">
          <Button variant="ghost" size="sm" onClick={onApplyDefaultOrder}>
            <Home className="h-3.5 w-3.5 mr-1" />Ordenar por estancia
          </Button>
          <Button variant="default" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : dirty ? 'Guardar orden' : 'Listo'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoOrderDialog;
