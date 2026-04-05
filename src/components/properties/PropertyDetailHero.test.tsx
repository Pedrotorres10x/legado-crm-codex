import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Home } from 'lucide-react';

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder ?? 'value'}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({
    children,
    value,
    onClick,
  }: {
    children: React.ReactNode;
    value: string;
    onClick?: (value: string) => void;
  }) => (
    <button type="button" onClick={() => onClick?.(value)}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onCheckedChange?.(!checked)}>
      Switch
    </button>
  ),
}));

vi.mock('@/components/ChangeRequestButton', () => ({
  default: () => <button type="button">Cambio</button>,
}));

import PropertyDetailHero from './PropertyDetailHero';

const baseProps = () => ({
  property: {
    id: 'property-1',
    title: 'Villa en Altea',
    status: 'disponible',
    address: 'Calle Mediterraneo 12',
    city: 'Altea',
    bedrooms: 4,
    bathrooms: 3,
    surface_area: 220,
    price: 890000,
    owner_id: 'owner-1',
    crm_reference: 'LEG-100',
    property_type: 'villa',
    secondary_property_type: null,
    operation: 'venta',
    auto_match: true,
    images: null,
    image_order: null,
  } as never,
  safeTitle: 'Villa en Altea',
  originBadge: {
    label: 'Captacion propia',
    className: 'text-primary',
    icon: Home,
  },
  statusLabels: { disponible: 'Disponible', reservado: 'Reservado' },
  statusColors: { disponible: 'bg-success', reservado: 'bg-warning' },
  isMobile: false,
  fromSearch: 'villa',
  canSeePropertyContactData: true,
  propertyOwnersCount: 2,
  isPublished: true,
  propertyTypes: ['villa', 'atico', 'piso'] as const,
  operationTypes: ['venta', 'alquiler'] as const,
  statusOptions: ['disponible', 'reservado'] as const,
  primaryAction: {
    label: 'Llamar propietario',
    description: 'Confirmar disponibilidad y siguiente paso comercial.',
    onClick: vi.fn(),
  },
  topBlockers: [] as string[],
  propertyId: 'prop-1',
  onBack: vi.fn(),
  onNavigateOwner: vi.fn(),
  onOpenMatches: vi.fn(),
  onOpenVisitSheet: vi.fn(),
  onOpenFicha: vi.fn(),
  onOpenExpediente: vi.fn(),
  onTitleChange: vi.fn(),
  onTitleBlur: vi.fn(),
  onSaveStatus: vi.fn(),
  onTogglePublished: vi.fn(),
  onSaveAutoMatch: vi.fn(),
  onSavePropertyType: vi.fn(),
  onSaveSecondaryPropertyType: vi.fn(),
  onSaveOperation: vi.fn(),
  ownerActions: undefined,
  scannerAction: undefined,
});

describe('PropertyDetailHero', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('en desktop muestra fallback comercial y dispara acciones principales', () => {
    const props = baseProps();
    render(<PropertyDetailHero {...props} />);

    expect(screen.getByText(/Resultados de/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Villa en Altea')).toBeInTheDocument();
    expect(screen.getByText('La ficha esta ordenada. Aprovecha para mover la siguiente accion comercial.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Llamar propietario' }));
    fireEvent.click(screen.getByRole('button', { name: /Publicado/i }));
    fireEvent.click(screen.getByRole('switch'));
    fireEvent.click(screen.getByRole('button', { name: /Enviar hoja de visita/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ir al resumen del inmueble/i }));
    fireEvent.click(screen.getByRole('button', { name: /Ver documentacion/i }));
    fireEvent.click(screen.getByRole('button', { name: /Abrir cruces/i }));

    expect(props.primaryAction.onClick).toHaveBeenCalledTimes(1);
    expect(props.onTogglePublished).toHaveBeenCalledTimes(1);
    expect(props.onSaveAutoMatch).toHaveBeenCalledWith(false);
    expect(props.onOpenVisitSheet).toHaveBeenCalledTimes(1);
    expect(props.onOpenFicha).toHaveBeenCalledTimes(1);
    expect(props.onOpenExpediente).toHaveBeenCalledTimes(1);
    expect(props.onOpenMatches).toHaveBeenCalledTimes(1);
  });

  it('en movil prioriza propietario y cruces, y muestra contacto oculto si no hay acceso', () => {
    const props = {
      ...baseProps(),
      isMobile: true,
    };

    const { rerender } = render(<PropertyDetailHero {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Propietario/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cruces/i }));

    expect(props.onNavigateOwner).toHaveBeenCalledTimes(1);
    expect(props.onOpenMatches).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2')).toBeInTheDocument();

    rerender(
      <PropertyDetailHero
        {...props}
        canSeePropertyContactData={false}
        property={{ ...props.property, owner_id: null } as never}
      />,
    );

    expect(screen.getByText('Contacto oculto')).toBeInTheDocument();
  });
});
