import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ChangeRequestButton', () => ({
  default: () => <button type="button">Cambio</button>,
}));

vi.mock('@/components/ContactHealthBadge', () => ({
  default: () => <span>Salud</span>,
}));

import ContactDetailHero from './ContactDetailHero';

const hapticLight = vi.fn();

vi.mock('@/lib/haptics', () => ({
  hapticLight: () => hapticLight(),
}));

const baseProps = () => ({
  contact: {
    id: 'contact-1',
    full_name: 'Ana Compradora',
    contact_type: 'comprador',
    status: 'activo',
    phone: '+34600000000',
    email: 'ana@example.com',
    city: 'Benidorm',
    pipeline_stage: 'Seguimiento',
    needs_mortgage: false,
  } as never,
  contactHealthInfo: null,
  typeLabels: { comprador: 'Comprador' },
  statusLabels: { activo: 'Activo' },
  isMobile: false,
  isAdmin: true,
  isCoordinadora: false,
  deleteOpen: false,
  deleting: false,
  ownedPropertiesCount: 0,
  primaryAction: {
    label: 'Llamar ahora',
    description: 'Retomar contacto y validar siguiente paso.',
    onClick: vi.fn(),
  },
  topBlockers: [] as string[],
  onBack: vi.fn(),
  onOpenWhatsApp: vi.fn(),
  onOpenInteraction: vi.fn(),
  onOpenEdit: vi.fn(),
  onOpenDeleteChange: vi.fn(),
  onDeleteContact: vi.fn(),
  onOpenTask: vi.fn(),
  onOpenFaktura: vi.fn(),
  onOpenPropertiesTab: vi.fn(),
  onNeedsMortgageChange: vi.fn(),
  onFetchSummary: vi.fn(),
  summaryLoading: false,
});

describe('ContactDetailHero', () => {
  beforeEach(() => {
    hapticLight.mockReset();
  });

  it('muestra fallback comercial y ejecuta la accion principal', () => {
    const props = baseProps();
    render(<ContactDetailHero {...props} />);

    expect(screen.getByText('La ficha esta bien orientada. Ahora toca empujar la siguiente accion comercial.')).toBeInTheDocument();
    expect(screen.getByLabelText('Necesita hipoteca')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Llamar ahora' }));

    expect(props.primaryAction.onClick).toHaveBeenCalledTimes(1);
  });

  it('dispara acciones del menu y permite marcar hipoteca', () => {
    const props = baseProps();
    render(<ContactDetailHero {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Resumen IA/i }));
    fireEvent.click(screen.getByRole('button', { name: /Editar contacto/i }));
    fireEvent.click(screen.getByLabelText('Necesita hipoteca'));

    expect(props.onFetchSummary).toHaveBeenCalledTimes(1);
    expect(props.onOpenEdit).toHaveBeenCalledTimes(1);
    expect(props.onNeedsMortgageChange).toHaveBeenCalledWith(true);
  });

  it('en movil prioriza el acceso a inmuebles cuando el contacto tiene propiedades', () => {
    const props = {
      ...baseProps(),
      isMobile: true,
      ownedPropertiesCount: 2,
    };

    render(<ContactDetailHero {...props} />);

    fireEvent.click(screen.getByRole('button', { name: /Inmuebles \(2\)/i }));

    expect(props.onOpenPropertiesTab).toHaveBeenCalledTimes(1);
    expect(hapticLight).toHaveBeenCalled();
  });
});
