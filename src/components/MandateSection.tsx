import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, AlertTriangle, Shield, ShieldCheck } from 'lucide-react';
import { differenceInDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface MandateSectionProps {
  mandateType: string | null;
  mandateStart: string | null;
  mandateEnd: string | null;
  mandateNotes: string | null;
  onSave: (updates: Record<string, string | null>) => Promise<void>;
}

const mandateLabels: Record<string, string> = {
  exclusiva: 'Exclusiva',
  compartida: 'Compartida',
  sin_mandato: 'Sin mandato',
};

const MandateSection = ({ mandateType, mandateStart, mandateEnd, mandateNotes, onSave }: MandateSectionProps) => {
  const [type, setType] = useState(mandateType || '');
  const [start, setStart] = useState(mandateStart || '');
  const [end, setEnd] = useState(mandateEnd || '');
  const [notes, setNotes] = useState(mandateNotes || '');

  const daysLeft = end ? differenceInDays(parseISO(end), new Date()) : null;

  const getStatusBadge = () => {
    if (!type || type === 'sin_mandato') return null;
    if (!end) return <Badge variant="secondary">Sin fecha fin</Badge>;
    if (daysLeft !== null && daysLeft < 0) return <Badge variant="destructive">Vencido</Badge>;
    if (daysLeft !== null && daysLeft <= 15) return <Badge className="bg-amber-500 text-white border-0">Vence en {daysLeft} días</Badge>;
    if (daysLeft !== null && daysLeft <= 30) return <Badge variant="outline" className="border-amber-400 text-amber-600">Vence en {daysLeft} días</Badge>;
    return <Badge variant="outline" className="border-emerald-400 text-emerald-600">Vigente ({daysLeft} días)</Badge>;
  };

  const getMandateIcon = () => {
    if (type === 'exclusiva') return <ShieldCheck className="h-4 w-4 text-primary" />;
    if (type === 'compartida') return <Shield className="h-4 w-4 text-muted-foreground" />;
    return <FileText className="h-4 w-4 text-muted-foreground" />;
  };

  const showAlert = daysLeft !== null && daysLeft >= 0 && daysLeft <= 15;

  return (
    <Card className="animate-fade-in-up">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          {getMandateIcon()}
          Mandato / Exclusividad
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAlert && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-amber-700 dark:text-amber-300">
              {daysLeft === 0
                ? '¡El mandato vence hoy!'
                : `El mandato vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}. Contacta con el propietario para renovar.`}
            </span>
          </div>
        )}
        {daysLeft !== null && daysLeft < 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span className="text-destructive">
              El mandato venció hace {Math.abs(daysLeft)} día{Math.abs(daysLeft) === 1 ? '' : 's'} ({format(parseISO(end), 'dd/MM/yyyy')}).
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo de mandato</Label>
            <Select
              value={type || 'none'}
              onValueChange={v => {
                const val = v === 'none' ? null : v;
                setType(val || '');
                onSave({ mandate_type: val });
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin definir</SelectItem>
                <SelectItem value="exclusiva">Exclusiva</SelectItem>
                <SelectItem value="compartida">Compartida</SelectItem>
                <SelectItem value="sin_mandato">Sin mandato</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha inicio</Label>
            <Input
              type="date"
              value={start}
              onChange={e => setStart(e.target.value)}
              onBlur={() => onSave({ mandate_start: start || null })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fecha fin</Label>
            <Input
              type="date"
              value={end}
              onChange={e => setEnd(e.target.value)}
              onBlur={() => onSave({ mandate_end: end || null })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Notas del mandato</Label>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => onSave({ mandate_notes: notes || null })}
            placeholder="Condiciones especiales, acuerdos..."
            rows={2}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default MandateSection;
