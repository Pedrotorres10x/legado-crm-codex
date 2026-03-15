import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2, CheckCircle2, AlertCircle, User, Phone, Mail, Clipboard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function FbLeadUploadDialog() {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
    setUploading(false);
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten imágenes');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
    setResult(null);
    setError(null);
  };

  // Listen for paste events when dialog is open
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) handleFile(file);
          return;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open]);

  const handleUpload = async () => {
    if (!preview) return;
    setUploading(true);
    setError(null);

    try {
      // Extract base64 data
      const [header, base64] = preview.split(',');
      const mimeMatch = header.match(/data:(.*?);/);
      const mimeType = mimeMatch?.[1] || 'image/png';

      const { data, error: fnErr } = await supabase.functions.invoke('ai-fb-lead-extract', {
        body: { image_base64: base64, mime_type: mimeType },
      });

      if (fnErr) throw fnErr;
      if (!data?.ok) throw new Error(data?.error || 'Error desconocido');

      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['web-leads-simple'] });
      toast.success(data.duplicate ? 'Lead existente actualizado' : 'Lead de Facebook creado correctamente');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al procesar la imagen');
      toast.error('Error al procesar el pantallazo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Camera className="h-4 w-4" />
          Lead FB (pantallazo)
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Subir lead de Facebook Ads
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pega un pantallazo con <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-xs font-mono">Ctrl+V</kbd> o arrastra una imagen del "Centro de clientes potenciales" de Facebook.
          </p>

          {/* Upload area */}
          {!preview && (
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
            >
              <Clipboard className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">Pega aquí (Ctrl+V) o haz clic para subir</p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG — pantallazo de Facebook Lead Ads</p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />

          {/* Preview */}
          {preview && !result && (
            <div className="space-y-3">
              <img src={preview} alt="Preview" className="rounded-lg border border-border max-h-64 w-full object-contain bg-muted/20" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset} disabled={uploading}>
                  Cambiar imagen
                </Button>
                <Button size="sm" onClick={handleUpload} disabled={uploading} className="flex-1 gap-1.5">
                  {uploading ? <><Loader2 className="h-4 w-4 animate-spin" />Extrayendo datos…</> : 'Extraer y crear lead'}
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                {result.duplicate ? 'Lead existente actualizado' : 'Lead creado correctamente'}
              </div>
              <div className="rounded-lg border border-border p-4 space-y-2 bg-muted/20">
                {result.extracted?.full_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{result.extracted.full_name}</span>
                  </div>
                )}
                {result.extracted?.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{result.extracted.phone}</span>
                  </div>
                )}
                {result.extracted?.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{result.extracted.email}</span>
                  </div>
                )}
                {result.extracted?.form_responses?.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-2 space-y-1 border-t border-border pt-2">
                    {result.extracted.form_responses.map((r: any, i: number) => (
                      <p key={i}><strong>{r.question}</strong> → {r.answer}</p>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={reset} className="w-full">
                Subir otro lead
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
