import { supabase } from '@/integrations/supabase/client';
import {
  buildImageOrderUpdatePayload,
  getEstanciaGroup,
  getPropertyImageSource,
  removeDeletedImagesFromProperty,
  type PropertyImageOrderEntry,
} from '@/lib/property-detail-media';
import { useState } from 'react';

type PropertyImageItem = {
  name: string;
  label?: string;
  url?: string;
};

type UsePropertyMediaManagerParams = {
  propertyId: string;
  supabaseUrl: string;
  images: PropertyImageItem[];
  mediaFiles: File[];
  propertyRef: React.MutableRefObject<any>;
  disableAutoSync: () => void;
  saveField: (updates: Record<string, any>) => Promise<any>;
  fetchMedia: () => Promise<any>;
  toast: (options: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
};

export function usePropertyMediaManager({
  propertyId,
  supabaseUrl,
  images,
  mediaFiles,
  propertyRef,
  disableAutoSync,
  saveField,
  fetchMedia,
  toast,
}: UsePropertyMediaManagerParams) {
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editingLabelValue, setEditingLabelValue] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [photoOrderOpen, setPhotoOrderOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const saveImageOrder = async (newOrder: { name: string; label: string; source: string }[]) => {
    const latestProp = propertyRef.current;
    const nextPayload = buildImageOrderUpdatePayload({
      supabaseUrl,
      propertyId,
      propertyImages: latestProp?.images || [],
      imageOrder: newOrder,
    });

    disableAutoSync();
    await saveField({ image_order: newOrder, images: nextPayload.images, floor_plans: nextPayload.floorPlans });
  };

  const moveImage = async (index: number, direction: 'up' | 'down') => {
    const newOrder = images.map((img) => ({
      name: img.name,
      label: img.label || '',
      source: getPropertyImageSource(img),
    }));
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    await saveImageOrder(newOrder);
  };

  const handleDragDrop = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newOrder = images.map((img) => ({
      name: img.name,
      label: img.label || '',
      source: getPropertyImageSource(img),
    }));
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    await saveImageOrder(newOrder);
  };

  const updateImageLabel = async (imageName: string, label: string) => {
    const currentOrder = images.map((img) => ({
      name: img.name,
      label: img.name === imageName ? label : (img.label || ''),
      source: getPropertyImageSource(img),
    }));
    await saveImageOrder(currentOrder);
    setEditingLabel(null);
  };

  const applyDefaultOrder = async () => {
    const sorted = [...images].sort((a, b) => {
      const ga = getEstanciaGroup(a.label || a.name);
      const gb = getEstanciaGroup(b.label || b.name);
      return ga - gb;
    });
    const newOrder = sorted.map((img) => ({
      name: img.name,
      label: img.label || '',
      source: getPropertyImageSource(img),
    }));
    await saveImageOrder(newOrder);
    toast({ title: 'Fotos ordenadas por estancia ✅' });
  };

  const bulkDeletePhotos = async (names: string[]) => {
    if (!propertyId || names.length === 0) return;

    const storageNames = names.filter((name) => !name.startsWith('xmlurl_'));

    if (storageNames.length > 0) {
      const paths = storageNames.map((name) => `${propertyId}/${name}`);
      const { error } = await supabase.storage.from('property-media').remove(paths);
      if (error) {
        toast({ title: 'Error eliminando fotos', description: error.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: `${names.length} foto(s) eliminada(s) ✅` });
    const freshFiles = storageNames.length > 0 ? await fetchMedia() : mediaFiles;

    const latestProp = propertyRef.current;
    const nextMediaState = removeDeletedImagesFromProperty({
      supabaseUrl,
      propertyId,
      propertyImages: latestProp?.images || [],
      imageOrder: (latestProp?.image_order || []) as PropertyImageOrderEntry[],
      deletedNames: names,
      remainingStorageFiles: freshFiles,
    });

    disableAutoSync();
    await saveField({ image_order: nextMediaState.imageOrder, images: nextMediaState.images });
  };

  return {
    editingLabel,
    setEditingLabel,
    editingLabelValue,
    setEditingLabelValue,
    dragIndex,
    setDragIndex,
    dragOverIndex,
    setDragOverIndex,
    photoOrderOpen,
    setPhotoOrderOpen,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    moveImage,
    handleDragDrop,
    updateImageLabel,
    applyDefaultOrder,
    bulkDeletePhotos,
  };
}
