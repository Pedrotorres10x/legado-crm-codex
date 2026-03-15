import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { registerDocument, unregisterDocument } from '@/lib/document-registry';
import {
  buildCatastroSnapshotContent,
  buildPropertyMediaFilesFromStorage,
  removeDeletedImagesFromProperty,
  resolvePropertyImageUrls,
  type PropertyImageOrderEntry,
} from '@/lib/property-detail-media';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type ToastFn = (options: {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}) => void;

type UsePropertyDetailCoreParams = {
  id?: string;
  userId?: string;
  toast: ToastFn;
};

export const usePropertyDetailCore = ({ id, userId, toast }: UsePropertyDetailCoreParams) => {
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<{ url: string; name: string; type: 'image' | 'video' }[]>([]);
  const [virtualTour, setVirtualTour] = useState('');
  const [savingTour, setSavingTour] = useState(false);
  const [savingField, setSavingField] = useState(false);

  const propertyRef = useRef<any>(null);
  const mediaFilesRef = useRef<typeof mediaFiles>([]);
  const skipAutoSync = useRef(false);

  useEffect(() => {
    propertyRef.current = property;
  }, [property]);

  useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);

  const resolveAllImageUrls = useCallback((freshFiles?: typeof mediaFiles): string[] => {
    if (!id) return [];

    return resolvePropertyImageUrls({
      supabaseUrl: SUPABASE_URL,
      propertyId: id,
      propertyImages: propertyRef.current?.images || [],
      imageOrder: (propertyRef.current?.image_order || []) as PropertyImageOrderEntry[],
      mediaFiles: freshFiles || mediaFilesRef.current,
    });
  }, [id]);

  const saveField = useCallback(async (updates: Record<string, any>) => {
    if (!id) return;

    setSavingField(true);
    const { error } = await supabase.from('properties').update(updates as any).eq('id', id);

    if (error) {
      toast({ title: 'Error guardando', description: error.message, variant: 'destructive' });
      setSavingField(false);
      return;
    }

    setProperty((prev: any) => ({ ...prev, ...updates }));

    const latestProp = { ...propertyRef.current, ...updates };
    if (updates.status === 'vendido' && propertyRef.current?.status !== 'vendido') {
      import('@/lib/erp-sync').then(({ notifyERP }) => {
        notifyERP('property_sold', {
          property_id: latestProp.id,
          property_title: latestProp.title,
          price: latestProp.price,
          city: latestProp.city,
          sold_at: new Date().toISOString(),
        });
      });
    }

    import('@/lib/erp-sync').then(({ notifyERP }) => {
      notifyERP('property_updated', {
        property_id: latestProp.id,
        title: latestProp.title,
        price: latestProp.price,
        city: latestProp.city,
        property_type: latestProp.property_type,
        operation: latestProp.operation,
        status: latestProp.status,
        reference: latestProp.crm_reference || latestProp.reference,
        images: resolveAllImageUrls(mediaFilesRef.current),
        bedrooms: latestProp.bedrooms,
        bathrooms: latestProp.bathrooms,
        surface_area: latestProp.surface_area,
      });
    });

    toast({ title: 'Guardado ✅' });
    setSavingField(false);
  }, [id, resolveAllImageUrls, toast]);

  const fetchProperty = useCallback(async () => {
    if (!id) return;

    const { data } = await supabase.from('properties').select('*').eq('id', id).single();
    if (data) {
      setProperty(data);
      setVirtualTour((data as any).virtual_tour_url || '');
    }
    setLoading(false);
  }, [id]);

  const fetchMedia = useCallback(async () => {
    if (!id) return [];

    const { data } = await supabase.storage.from('property-media').list(id);
    if (!data) return [];

    const files = buildPropertyMediaFilesFromStorage(SUPABASE_URL, id, data);
    setMediaFiles(files);
    return files;
  }, [id]);

  const syncCatastroSnapshot = useCallback(async (reference: string, catastroData: Record<string, any>) => {
    if (!id) return;

    const blob = new Blob([buildCatastroSnapshotContent(reference, catastroData)], { type: 'text/plain' });
    const fileName = `ficha_catastral_${reference}.txt`;
    const storagePath = `${id}/${fileName}`;

    const { data: existingAutoDocs } = await supabase
      .from('property_documents')
      .select('id, file_name, file_url')
      .eq('property_id', id)
      .eq('doc_type', 'catastro')
      .ilike('file_name', 'ficha_catastral_%');

    const oldStoragePaths = (existingAutoDocs || [])
      .map((doc: any) => doc.file_url?.split('/property-documents/')[1])
      .filter((path: string | undefined): path is string => Boolean(path));

    if (oldStoragePaths.length > 0) {
      await supabase.storage.from('property-documents').remove(oldStoragePaths);
      for (const oldPath of oldStoragePaths) {
        await unregisterDocument('property-documents', oldPath);
      }
    }

    if ((existingAutoDocs || []).length > 0) {
      await supabase
        .from('property_documents')
        .delete()
        .in('id', existingAutoDocs!.map((doc: any) => doc.id));
    }

    const { error: uploadError } = await supabase.storage.from('property-documents').upload(storagePath, blob, {
      contentType: 'text/plain',
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrl } = supabase.storage.from('property-documents').getPublicUrl(storagePath);

    await registerDocument({
      bucketId: 'property-documents',
      storagePath,
      fileName,
      title: `Ficha catastral ${reference}`,
      documentKind: 'catastro_report',
      sourceContext: 'property',
      mimeType: 'text/plain',
      sizeBytes: blob.size,
      uploadedBy: userId,
      propertyIds: [id],
    });

    const { error: propertyDocError } = await supabase.from('property_documents').insert({
      property_id: id,
      doc_type: 'catastro',
      label: 'Referencia Catastral',
      file_url: publicUrl.publicUrl,
      file_name: fileName,
      is_required: true,
      uploaded_by: userId,
    });

    if (propertyDocError) {
      throw propertyDocError;
    }
  }, [id, userId]);

  const logMediaAccess = useCallback(async (action: string) => {
    if (!id || !userId) return;
    await supabase.from('media_access_logs').insert({ user_id: userId, property_id: id, action } as any);
  }, [id, userId]);

  useEffect(() => {
    if (!id || !property || mediaFiles.length === 0) return;
    if (skipAutoSync.current) return;

    const storageImages = mediaFiles.filter((file) => file.type === 'image');
    if (storageImages.length === 0) return;

    const currentImages: string[] = property?.images || [];
    const normalize = (url: string) => url.split('?')[0];
    const currentNorm = new Set(currentImages.map(normalize));
    const storageUrls = storageImages.map((file) => `${SUPABASE_URL}/storage/v1/object/public/property-media/${id}/${file.name}`);
    const missingUrls = storageUrls.filter((url) => !currentNorm.has(normalize(url)));

    if (missingUrls.length > 0) {
      skipAutoSync.current = true;
      const merged = [...currentImages, ...missingUrls];
      const seen = new Set<string>();
      const deduped = merged.filter((url) => {
        const normalized = normalize(url);
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
      void saveField({ images: deduped });
    }
  }, [id, mediaFiles, property, saveField]);

  const uploadFiles = useCallback(async (files: FileList, type: 'image' | 'video') => {
    if (!id) return;

    skipAutoSync.current = true;
    setUploading(true);

    const maxSize = 20 * 1024 * 1024;
    const fileArray = Array.from(files);
    const tooLarge = fileArray.filter((file) => file.size > maxSize);
    if (tooLarge.length > 0) {
      toast({
        title: 'Archivos demasiado grandes',
        description: `${tooLarge.map((file) => file.name).join(', ')} superan 20 MB`,
        variant: 'destructive',
      });
    }

    const validFiles = fileArray.filter((file) => file.size <= maxSize);
    const results = await Promise.allSettled(
      validFiles.map(async (file) => {
        const ext = file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('property-media').upload(`${id}/${fileName}`, file);
        if (error) throw new Error(`${file.name}: ${error.message}`);
        return fileName;
      })
    );

    const succeeded = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.filter((result) => result.status === 'rejected') as PromiseRejectedResult[];

    if (failed.length > 0) {
      toast({
        title: `${failed.length} archivo(s) no se subieron`,
        description: failed.map((result) => result.reason?.message).join('\n'),
        variant: 'destructive',
      });
    }

    if (succeeded > 0) {
      toast({ title: `${succeeded} archivo(s) subido(s)` });
      const freshFiles = await fetchMedia();
      const newFileNames = results
        .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
        .map((result) => result.value);

      const latestProp = propertyRef.current;
      const currentOrder: { name: string; label: string; source: string }[] = latestProp?.image_order || [];
      const existingNames = new Set(currentOrder.map((entry) => entry.name));
      const newOrderEntries = newFileNames
        .filter((name) => !existingNames.has(name))
        .map((name) => ({ name, label: '', source: type === 'video' ? 'storage' : 'storage' }));
      const updatedOrder = [...currentOrder, ...newOrderEntries];

      const allUrls = resolveAllImageUrls(freshFiles);
      await saveField({ images: allUrls, image_order: updatedOrder });
    }

    setUploading(false);
  }, [fetchMedia, id, resolveAllImageUrls, saveField, toast]);

  const deleteFile = useCallback(async (name: string) => {
    if (!id) return;

    const isExternalUrl = name.startsWith('xmlurl_');
    if (!isExternalUrl) {
      const { error } = await supabase.storage.from('property-media').remove([`${id}/${name}`]);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
    }

    toast({ title: 'Archivo eliminado' });
    const freshFiles = isExternalUrl ? mediaFilesRef.current : await fetchMedia();
    const latestProp = propertyRef.current;

    const nextMediaState = removeDeletedImagesFromProperty({
      supabaseUrl: SUPABASE_URL,
      propertyId: id,
      propertyImages: latestProp?.images || [],
      imageOrder: (latestProp?.image_order || []) as PropertyImageOrderEntry[],
      deletedNames: [name],
      remainingStorageFiles: freshFiles,
    });

    skipAutoSync.current = true;
    await saveField({ image_order: nextMediaState.imageOrder, images: nextMediaState.images });
  }, [fetchMedia, id, saveField, toast]);

  const saveVirtualTour = useCallback(async () => {
    if (!id) return;

    setSavingTour(true);
    const { error } = await supabase
      .from('properties')
      .update({ virtual_tour_url: virtualTour || null } as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Tour virtual guardado' });
    }

    setSavingTour(false);
  }, [id, toast, virtualTour]);

  return {
    property,
    setProperty,
    loading,
    uploading,
    mediaFiles,
    virtualTour,
    setVirtualTour,
    savingTour,
    savingField,
    saveField,
    commitReadyPropertyRef: propertyRef,
    fetchProperty,
    fetchMedia,
    syncCatastroSnapshot,
    logMediaAccess,
    resolveAllImageUrls,
    uploadFiles,
    deleteFile,
    saveVirtualTour,
    disableAutoSync: () => {
      skipAutoSync.current = true;
    },
  };
};
