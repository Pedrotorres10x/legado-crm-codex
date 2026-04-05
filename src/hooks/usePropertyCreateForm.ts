import { useState, type ChangeEvent } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getProvinceFromZip } from '@/lib/spanish-geo';
import { useCatastroLookup } from '@/hooks/useCatastroLookup';

export interface PropertyFormData {
  title: string; property_type: string; operation: string;
  price: string; surface_area: string; built_area: string;
  bedrooms: string; bathrooms: string; city: string; province: string;
  country: string;
  address: string; zip_code: string; floor: string; energy_cert: string; year_built: string;
  description: string; status: string;
  has_elevator: boolean; has_garage: boolean; has_pool: boolean;
  has_terrace: boolean; has_garden: boolean;
  features: string; reference: string; virtual_tour_url: string; video_url: string;
}

export const defaultFormData: PropertyFormData = {
  title: '', property_type: 'piso', operation: 'venta',
  price: '', surface_area: '', built_area: '', bedrooms: '', bathrooms: '',
  city: '', province: '', country: 'España', address: '', zip_code: '', floor: '',
  energy_cert: '', year_built: '', description: '', status: 'disponible',
  has_elevator: false, has_garage: false, has_pool: false, has_terrace: false, has_garden: false,
  features: '', reference: '', virtual_tour_url: '', video_url: '',
};

type UsePropertyCreateFormArgs = {
  onCreated: () => void;
  onOpenChange: (open: boolean) => void;
};

type CatastroResult = {
  rc: string;
  address?: string;
  municipio?: string;
  provincia?: string;
};

type AiPhotoTagResponse = {
  labels?: Array<{ index: number; label: string; score?: number }>;
};

export function usePropertyCreateForm({ onCreated, onOpenChange }: UsePropertyCreateFormArgs) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<PropertyFormData>(defaultFormData);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [refWarning, setRefWarning] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageLabels, setImageLabels] = useState<string[]>([]);
  const [imageScores, setImageScores] = useState<number[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [taggingImages, setTaggingImages] = useState(false);
  const [catastroLoading, setCatastroLoading] = useState(false);
  const [catastroResults, setCatastroResults] = useState<CatastroResult[]>([]);
  const [catastroDialogOpen, setCatastroDialogOpen] = useState(false);
  const [catastroTab, setCatastroTab] = useState<'rc' | 'address'>('rc');
  const [catastroAddress, setCatastroAddress] = useState({ provincia: '', municipio: '', calle: '', numero: '' });
  const catastro = useCatastroLookup();

  const patch = (partial: Partial<PropertyFormData>) => setForm((current) => ({ ...current, ...partial }));

  const applyFichaCatastral = async (rc: string) => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/catastro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ rc }),
      });
      const data = await resp.json();
      if (data.found) {
        const d = data.data;
        patch({
          reference: rc,
          city: d.municipio || form.city,
          province: d.provincia || form.province,
          address: d.address || form.address,
          zip_code: d.zip_code || form.zip_code,
          floor: d.floor || form.floor,
          surface_area: d.superficie ? String(d.superficie) : form.surface_area,
          property_type: d.property_type || form.property_type,
          title: form.title || `${(d.property_type || 'piso').charAt(0).toUpperCase() + (d.property_type || 'piso').slice(1)} en ${d.municipio || ''}`.trim(),
        });
        toast({ title: 'Ficha catastral descargada ✅', description: `${d.address}, ${d.municipio}` });
      } else {
        toast({ title: 'No se pudo descargar la ficha catastral', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error al descargar ficha catastral', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setForm(defaultFormData);
    setImageFiles([]);
    setImagePreviews([]);
    setImageLabels([]);
    setImageScores([]);
    setCatastroTab('rc');
    setCatastroAddress({ provincia: '', municipio: '', calle: '', numero: '' });
    setRefWarning(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const featuresArray = form.features ? form.features.split(',').map((feature) => feature.trim()).filter(Boolean) : [];

    const imageUrls: string[] = [];
    if (imageFiles.length > 0) {
      setUploadingImages(true);
      for (const file of imageFiles) {
        const ext = file.name.split('.').pop();
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('property-media').upload(path, file);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('property-media').getPublicUrl(path);
          imageUrls.push(urlData.publicUrl);
        }
      }
      setUploadingImages(false);
    }

    const videosArray = form.video_url ? [form.video_url.trim()] : [];

    const { error } = await supabase.from('properties').insert([{
      title: form.title,
      property_type: form.property_type,
      operation: form.operation,
      description: form.description || null,
      status: form.status,
      country: form.country || 'España',
      city: form.city || null,
      province: form.province || null,
      address: form.address || null,
      zip_code: form.zip_code || null,
      floor: form.floor || null,
      energy_cert: form.energy_cert || null,
      year_built: form.year_built ? parseInt(form.year_built) : null,
      price: form.price ? parseFloat(form.price) : null,
      surface_area: form.surface_area ? parseFloat(form.surface_area) : null,
      built_area: form.built_area ? parseFloat(form.built_area) : null,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : 0,
      bathrooms: form.bathrooms ? parseInt(form.bathrooms) : 0,
      has_elevator: form.has_elevator,
      has_garage: form.has_garage,
      has_pool: form.has_pool,
      has_terrace: form.has_terrace,
      has_garden: form.has_garden,
      features: featuresArray.length > 0 ? featuresArray : [],
      reference: form.reference || null,
      agent_id: user?.id,
      images: imageUrls.length > 0 ? imageUrls : [],
      videos: videosArray.length > 0 ? videosArray : [],
      virtual_tour_url: form.virtual_tour_url || null,
    }]);

    setLoading(false);
    if (error) {
      let msg = error.message;
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        if (error.message.includes('crm_reference')) msg = 'Error interno con la referencia CRM. Inténtalo de nuevo.';
        else if (error.message.includes('xml_id')) msg = 'Ya existe un inmueble importado con ese identificador XML.';
        else msg = 'Ya existe un inmueble con datos duplicados. Revisa los campos.';
      }
      toast({ title: 'Error al crear inmueble', description: msg, variant: 'destructive' });
      return;
    }

    import('@/lib/erp-sync').then(({ notifyERP }) => {
      notifyERP('property_created', {
        property_id: '',
        title: form.title,
        price: form.price ? parseFloat(form.price) : null,
        city: form.city || null,
        property_type: form.property_type,
        operation: form.operation,
        status: form.status,
        reference: form.reference || null,
        images: imageUrls.length > 0 ? imageUrls : null,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        surface_area: form.surface_area ? parseFloat(form.surface_area) : null,
      });
    });

    toast({ title: 'Inmueble añadido' });
    resetForm();
    onOpenChange(false);
    onCreated();
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const dataUrls = await Promise.all(files.map((file) => new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    })));

    const allFiles = [...imageFiles, ...files];
    const allPreviews = [...imagePreviews, ...dataUrls];
    const allLabels = [...imageLabels, ...files.map(() => '...')];
    const allScores = [...imageScores, ...files.map(() => 0)];
    setImageFiles(allFiles);
    setImagePreviews(allPreviews);
    setImageLabels(allLabels);
    setImageScores(allScores);
    e.target.value = '';

    setTaggingImages(true);
    try {
      const images = dataUrls.map((url, index) => ({ url, index: imageFiles.length + index }));
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-photo-tag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ images }),
      });
      const data = (await resp.json()) as AiPhotoTagResponse;
      if (data.labels && Array.isArray(data.labels)) {
        const updatedLabels = [...allLabels];
        const updatedScores = [...allScores];
        for (const item of data.labels) {
          if (item.index < updatedLabels.length) {
            updatedLabels[item.index] = item.label;
            updatedScores[item.index] = item.score ?? 50;
          }
        }
        const indices = updatedLabels.map((_, index) => index);
        indices.sort((a, b) => (updatedScores[b] ?? 0) - (updatedScores[a] ?? 0));
        setImageFiles(indices.map((index) => allFiles[index]));
        setImagePreviews(indices.map((index) => allPreviews[index]));
        setImageLabels(indices.map((index) => updatedLabels[index]));
        setImageScores(indices.map((index) => updatedScores[index]));
        const bestScore = updatedScores[indices[0]] ?? 0;
        toast({ title: 'Fotos analizadas y ordenadas ✨', description: `Portada seleccionada con ${bestScore}/100 pts de atractivo` });
      }
    } catch {
      toast({ title: 'Etiquetado', description: 'No se pudieron etiquetar automáticamente', variant: 'destructive' });
    }
    setTaggingImages(false);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setImagePreviews((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setImageLabels((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
    setImageScores((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleReferenceChange = async (value: string) => {
    patch({ reference: value });
    setRefWarning(null);
    if (value && value.length >= 14) {
      const { data } = await supabase.from('properties').select('id, title').eq('reference', value).limit(1);
      if (data && data.length > 0) {
        setRefWarning(`⚠️ Ya existe "${data[0].title}" con esta referencia. Se permitirá crear, pero revisa que no sea duplicado.`);
      }
    }
  };

  const handleZipCodeChange = (value: string) => {
    const updates: Partial<PropertyFormData> = { zip_code: value };
    if (form.country === 'España' && value.length >= 2) {
      const province = getProvinceFromZip(value);
      if (province && !form.province) {
        updates.province = province;
        catastro.fetchMunicipios(province);
      }
    }
    patch(updates);
  };

  return {
    form,
    loading,
    aiLoading,
    refWarning,
    imagePreviews,
    imageLabels,
    imageScores,
    uploadingImages,
    taggingImages,
    catastroLoading,
    catastroResults,
    catastroDialogOpen,
    catastroTab,
    catastroAddress,
    catastro,
    patch,
    setAiLoading,
    setCatastroLoading,
    setCatastroResults,
    setCatastroDialogOpen,
    setCatastroTab,
    setCatastroAddress,
    applyFichaCatastral,
    resetForm,
    handleSubmit,
    handleImageSelect,
    removeImage,
    handleReferenceChange,
    handleZipCodeChange,
  };
}
