import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Loader2, GitMerge, Phone, Mail, RefreshCw, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

interface DuplicatePair {
  contact_id_1: string;
  contact_id_2: string;
  name_1: string;
  name_2: string;
  match_field: string;
  match_value: string;
}

const DuplicateContacts = () => {
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [mergeDialog, setMergeDialog] = useState<DuplicatePair | null>(null);
  const [merging, setMerging] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchDuplicates = async () => {
    setLoading(true);
    setSelected(new Set());
    const { data, error } = await supabase.rpc('find_duplicate_contacts');
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setDuplicates(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchDuplicates(); }, []);

  const mergePair = async (pair: DuplicatePair) => {
    const keepId = pair.contact_id_1;
    const removeId = pair.contact_id_2;
    await supabase.from('interactions').update({ contact_id: keepId } as any).eq('contact_id', removeId);
    await supabase.from('visits').update({ contact_id: keepId } as any).eq('contact_id', removeId);
    await supabase.from('offers').update({ contact_id: keepId } as any).eq('contact_id', removeId);
    await supabase.from('demands').update({ contact_id: keepId } as any).eq('contact_id', removeId);
    await supabase.from('tasks').update({ contact_id: keepId } as any).eq('contact_id', removeId);
    
    await supabase.from('owner_reengagement').update({ contact_id: keepId } as any).eq('contact_id', removeId);
    await supabase.from('properties').update({ owner_id: keepId } as any).eq('owner_id', removeId);
    await supabase.from('contacts').delete().eq('id', removeId);
  };

  const handleMerge = async (pair: DuplicatePair) => {
    setMerging(true);
    const { error } = await (async () => {
      try {
        await mergePair(pair);
        return { error: null };
      } catch (e: any) {
        return { error: e };
      }
    })();
    if (error) {
      toast({ title: 'Error al fusionar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Contactos fusionados ✅', description: `Se mantuvo "${pair.name_1}" y se eliminó "${pair.name_2}"` });
      fetchDuplicates();
    }
    setMerging(false);
    setMergeDialog(null);
  };

  const handleBulkMerge = async () => {
    const pairs = Array.from(selected).map(i => duplicates[i]);
    setBulkTotal(pairs.length);
    setBulkProgress(0);
    setMerging(true);

    let done = 0;
    let errors = 0;
    for (const pair of pairs) {
      try {
        await mergePair(pair);
      } catch {
        errors++;
      }
      done++;
      setBulkProgress(done);
    }

    setMerging(false);
    setBulkDialog(false);
    if (errors > 0) {
      toast({ title: `Fusión parcial`, description: `${done - errors} fusionados, ${errors} con error.`, variant: 'destructive' });
    } else {
      toast({ title: `${done} pares fusionados ✅`, description: 'Todos los duplicados seleccionados se han procesado.' });
    }
    fetchDuplicates();
  };

  const toggleSelect = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === duplicates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(duplicates.map((_, i) => i)));
    }
  };

  const fieldIcon = (field: string) => {
    if (field === 'phone' || field === 'phone2') return <Phone className="h-3.5 w-3.5" />;
    return <Mail className="h-3.5 w-3.5" />;
  };

  const fieldLabel = (field: string) => {
    if (field === 'phone') return 'Teléfono';
    if (field === 'phone2') return 'Teléfono 2';
    return 'Email';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Buscando duplicados...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Contactos duplicados
          </h2>
          <p className="text-sm text-muted-foreground">
            {duplicates.length === 0 ? 'No se encontraron duplicados' : `${duplicates.length} posible(s) duplicado(s) detectado(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button size="sm" onClick={() => setBulkDialog(true)} className="gap-1.5">
              <GitMerge className="h-4 w-4" />
              Fusionar {selected.size} seleccionados
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchDuplicates}>
            <RefreshCw className="h-4 w-4 mr-1" />Actualizar
          </Button>
        </div>
      </div>

      {duplicates.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === duplicates.length && duplicates.length > 0}
                    onCheckedChange={toggleAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead>Contacto 1</TableHead>
                <TableHead>Contacto 2</TableHead>
                <TableHead>Coincidencia</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duplicates.map((d, i) => (
                <TableRow key={i} className={selected.has(i) ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(i)}
                      onCheckedChange={() => toggleSelect(i)}
                    />
                  </TableCell>
                  <TableCell
                    className="font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/contacts/${d.contact_id_1}`)}
                  >
                    {d.name_1}
                  </TableCell>
                  <TableCell
                    className="font-medium cursor-pointer hover:text-primary transition-colors"
                    onClick={() => navigate(`/contacts/${d.contact_id_2}`)}
                  >
                    {d.name_2}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      {fieldIcon(d.match_field)}
                      {fieldLabel(d.match_field)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.match_value}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setMergeDialog(d)} className="gap-1">
                      <GitMerge className="h-3.5 w-3.5" />Fusionar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Single merge dialog */}
      <AlertDialog open={!!mergeDialog} onOpenChange={() => setMergeDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Fusionar estos contactos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se mantendrá <strong>"{mergeDialog?.name_1}"</strong> y se moverán todas las interacciones, visitas, ofertas y tareas de <strong>"{mergeDialog?.name_2}"</strong> al contacto principal. Luego se eliminará el duplicado.
              <br /><br />
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={merging}
              onClick={() => mergeDialog && handleMerge(mergeDialog)}
              className="bg-primary"
            >
              {merging ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <GitMerge className="h-4 w-4 mr-1" />}
              Fusionar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk merge dialog */}
      <AlertDialog open={bulkDialog} onOpenChange={v => { if (!merging) setBulkDialog(v); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fusionar {selected.size} pares en bloque</AlertDialogTitle>
            <AlertDialogDescription>
              Se procesarán <strong>{selected.size} pares</strong> de duplicados. En cada par se conservará el <em>Contacto 1</em> y se eliminarán los duplicados, migrando todo el historial.
              <br /><br />
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {merging && bulkTotal > 0 && (
            <div className="px-1 space-y-2">
              <Progress value={(bulkProgress / bulkTotal) * 100} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {bulkProgress} / {bulkTotal} fusionados...
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={merging}
              onClick={handleBulkMerge}
              className="bg-primary"
            >
              {merging
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Procesando...</>
                : <><GitMerge className="h-4 w-4 mr-1" />Fusionar todo</>
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DuplicateContacts;
