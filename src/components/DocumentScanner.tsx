import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, FileUp, CheckCircle, FileText, User, Home, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const docTypeLabels: Record<string, string> = {
  dni: 'DNI', nie: 'NIE', pasaporte: 'Pasaporte', nota_simple: 'Nota Simple',
  escritura: 'Escritura', contrato: 'Contrato', recibo_ibi: 'Recibo IBI',
  certificado_energetico: 'Certificado Energético', otro: 'Otro',
};

type ExtractedField = {
  label: string;
  value: string | number;
};

type ExtractedOwner = {
  name?: string | null;
  id_number?: string | null;
  percentage?: string | null;
};

type ExtractedDocumentData = {
  document_type?: string;
  summary?: string;
  fields_found?: string[];
  full_name?: string;
  id_number?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  nationality?: string;
  birth_date?: string;
  property_address?: string;
  property_city?: string;
  property_province?: string;
  property_zip_code?: string;
  property_type?: string;
  cadastral_reference?: string;
  surface_area?: string | number;
  built_area?: string | number;
  bedrooms?: string | number;
  bathrooms?: string | number;
  floor?: string | number;
  price?: string | number;
  energy_cert?: string;
  registro?: string;
  cargas?: string;
  titulares?: ExtractedOwner[];
};

interface DocumentScannerProps {
  context: 'contact' | 'property';
  onExtracted: (data: ExtractedDocumentData) => void;
  buttonLabel?: string;
}

const DocumentScanner = ({ context, onExtracted, buttonLabel = 'Escanear documento' }: DocumentScannerProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ExtractedDocumentData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);

    setScanning(true);
    setResult(null);
    setDialogOpen(true);

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result as string;
          resolve(result.split(',')[1]);
        };
        r.readAsDataURL(file);
      });

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-document-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ image_base64: base64, file_name: file.name }),
      });

      const data = await resp.json();
      if (data.error) {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
        setDialogOpen(false);
      } else {
        setResult(data.extracted);
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo procesar el documento', variant: 'destructive' });
      setDialogOpen(false);
    }
    setScanning(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const applyData = () => {
    onExtracted(result);
    setDialogOpen(false);
    setResult(null);
    setPreviewUrl(null);
    toast({ title: 'Datos aplicados ✅', description: 'Los campos se han rellenado automáticamente' });
  };

  const contactFields: ExtractedField[] = result ? [
    result.full_name && { label: 'Nombre', value: result.full_name },
    result.id_number && { label: 'Documento', value: result.id_number },
    result.phone && { label: 'Teléfono', value: result.phone },
    result.email && { label: 'Email', value: result.email },
    result.address && { label: 'Dirección', value: result.address },
    result.city && { label: 'Ciudad', value: result.city },
    result.nationality && { label: 'Nacionalidad', value: result.nationality },
    result.birth_date && { label: 'Fecha nacimiento', value: result.birth_date },
  ].filter((field): field is ExtractedField => Boolean(field)) : [];

  const propertyFields: ExtractedField[] = result ? [
    result.property_address && { label: 'Dirección', value: result.property_address },
    result.property_city && { label: 'Ciudad', value: result.property_city },
    result.property_province && { label: 'Provincia', value: result.property_province },
    result.property_zip_code && { label: 'Código postal', value: result.property_zip_code },
    result.property_type && { label: 'Tipo', value: result.property_type },
    result.cadastral_reference && { label: 'Ref. Catastral', value: result.cadastral_reference },
    result.surface_area && { label: 'Superficie', value: `${result.surface_area} m²` },
    result.built_area && { label: 'Sup. construida', value: `${result.built_area} m²` },
    result.bedrooms && { label: 'Dormitorios', value: result.bedrooms },
    result.bathrooms && { label: 'Baños', value: result.bathrooms },
    result.floor && { label: 'Planta', value: result.floor },
    result.price && { label: 'Precio/Valor', value: `${Number(result.price).toLocaleString('es-ES')} €` },
    result.energy_cert && { label: 'Certificado energético', value: result.energy_cert },
    result.registro && { label: 'Registro', value: result.registro },
    result.cargas && { label: 'Cargas', value: result.cargas },
  ].filter((field): field is ExtractedField => Boolean(field)) : [];

  const hasContactData = result?.fields_found?.includes('contact');
  const hasPropertyData = result?.fields_found?.includes('property');

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*,.pdf" hidden onChange={handleFileSelect} />
      <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={scanning}>
        {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
        {buttonLabel}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {scanning ? 'Analizando documento...' : 'Datos extraídos'}
            </DialogTitle>
          </DialogHeader>

          {scanning && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analizando documento con IA...</p>
              {previewUrl && (
                <img src={previewUrl} alt="Preview" className="max-h-32 rounded-lg border opacity-50" />
              )}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Document type + summary */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-primary text-primary-foreground">
                  {docTypeLabels[result.document_type] || result.document_type}
                </Badge>
                {hasContactData && <Badge variant="outline" className="gap-1"><User className="h-3 w-3" />Datos persona</Badge>}
                {hasPropertyData && <Badge variant="outline" className="gap-1"><Home className="h-3 w-3" />Datos inmueble</Badge>}
              </div>

              {result.summary && (
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{result.summary}</p>
              )}

              {/* Preview + extracted side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {previewUrl && (
                  <div>
                    <img src={previewUrl} alt="Documento" className="w-full rounded-lg border" />
                  </div>
                )}

                <div className="space-y-3">
                  {hasContactData && contactFields.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1"><User className="h-3 w-3" />Datos de contacto</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-3 space-y-1">
                        {contactFields.map((field) => (
                          <div key={f.label} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{field.label}</span>
                            <span className="font-medium text-right max-w-[60%] truncate">{field.value}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {hasPropertyData && propertyFields.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs flex items-center gap-1"><Home className="h-3 w-3" />Datos del inmueble</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-3 space-y-1">
                        {propertyFields.map((field) => (
                          <div key={field.label} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{field.label}</span>
                            <span className="font-medium text-right max-w-[60%] truncate">{field.value}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {result.titulares?.length > 0 && (
                    <Card>
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-xs">Titulares</CardTitle>
                      </CardHeader>
                      <CardContent className="py-2 px-3 space-y-1">
                        {result.titulares.map((owner, i: number) => (
                          <div key={i} className="text-xs">
                            <span className="font-medium">{owner.name}</span>
                            {owner.id_number && <span className="text-muted-foreground ml-1">({owner.id_number})</span>}
                            {owner.percentage && <span className="text-muted-foreground ml-1">· {owner.percentage}</span>}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>

              {/* Warning if data doesn't match context */}
              {context === 'contact' && !hasContactData && (
                <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  No se encontraron datos de persona en este documento. Puedes aplicar los datos de inmueble igualmente.
                </div>
              )}
              {context === 'property' && !hasPropertyData && (
                <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  No se encontraron datos de inmueble en este documento. Puedes aplicar los datos de persona igualmente.
                </div>
              )}
            </div>
          )}

          {result && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); setResult(null); setPreviewUrl(null); }}>
                Descartar
              </Button>
              <Button onClick={applyData}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Aplicar datos
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentScanner;
