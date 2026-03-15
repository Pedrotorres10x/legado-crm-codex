import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockNavigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Evita que PriceSparkline haga fetch real a Supabase
vi.mock('@/components/PriceSparkline', () => ({
  default: () => null,
}));

// Mock mínimo del cliente de Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      }),
    }),
  },
}));

// Mock de HealthDot para simplificar el renderizado
vi.mock('@/components/HealthDot', () => ({
  default: () => <span data-testid="health-dot" />,
}));

import {
  PropertyCard,
  statusLabels,
  statusColors,
} from './PropertyCard';

// ── Fixture base ───────────────────────────────────────────────────────────
const BASE_PROPERTY = {
  id: 'prop-001',
  title: 'Piso en el centro',
  city: 'Madrid',
  bedrooms: 3,
  bathrooms: 2,
  surface_area: 90,
  price: 250000,
  status: 'disponible',
  mandate_type: 'exclusiva',
  crm_reference: 'RK-123',
  images: [
    'https://cdn.example.com/foto-abc.jpg',
    'https://cdn.example.com/foto-def.jpg',
  ],
  image_order: null,
};

// ── Helpers ────────────────────────────────────────────────────────────────
const renderMobile = (overrides = {}) =>
  render(
    <PropertyCard
      property={{ ...BASE_PROPERTY, ...overrides }}
      healthInfo={undefined}
      mode="mobile"
    />
  );

const renderGrid = (overrides = {}) =>
  render(
    <PropertyCard
      property={{ ...BASE_PROPERTY, ...overrides }}
      healthInfo={undefined}
      mode="grid"
    />
  );

// ══════════════════════════════════════════════════════════════════════════
// MODO MOBILE
// ══════════════════════════════════════════════════════════════════════════
describe('PropertyCard – modo mobile', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renderiza el título', () => {
    renderMobile();
    expect(screen.getByText('Piso en el centro')).toBeInTheDocument();
  });

  it('renderiza la ciudad', () => {
    renderMobile();
    expect(screen.getByText('Madrid')).toBeInTheDocument();
  });

  it('no muestra ciudad si no existe', () => {
    renderMobile({ city: null });
    expect(screen.queryByText('Madrid')).not.toBeInTheDocument();
  });

  it('renderiza la imagen de portada (images[0] cuando image_order es null)', () => {
    renderMobile();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/foto-abc.jpg');
  });

  it('selecciona imagen según xml_N en image_order', () => {
    renderMobile({ image_order: ['xml_1'] });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/foto-def.jpg');
  });

  it('no muestra <img> cuando no hay imágenes (placeholder)', () => {
    renderMobile({ images: [], image_order: null });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('muestra el badge de estado "Disponible"', () => {
    renderMobile();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
  });

  it('muestra el badge "Arras" para status arras', () => {
    renderMobile({ status: 'arras' });
    expect(screen.getByText('Arras')).toBeInTheDocument();
  });

  it('muestra el badge "Vendido" para status vendido', () => {
    renderMobile({ status: 'vendido' });
    expect(screen.getByText('Vendido')).toBeInTheDocument();
  });

  it('muestra badge "Exclusiva" cuando mandate_type es exclusiva', () => {
    renderMobile({ mandate_type: 'exclusiva' });
    expect(screen.getByText('Exclusiva')).toBeInTheDocument();
  });

  it('no muestra badge "Exclusiva" cuando mandate_type no es exclusiva', () => {
    renderMobile({ mandate_type: 'compartida' });
    expect(screen.queryByText('Exclusiva')).not.toBeInTheDocument();
  });

  it('muestra el CRM reference', () => {
    renderMobile();
    expect(screen.getByText('RK-123')).toBeInTheDocument();
  });

  it('no muestra CRM reference si no existe', () => {
    renderMobile({ crm_reference: null });
    expect(screen.queryByText('RK-123')).not.toBeInTheDocument();
  });

  it('llama a navigate con la ruta correcta al hacer click', () => {
    renderMobile();
    fireEvent.click(screen.getByRole('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/properties/prop-001');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// MODO GRID
// ══════════════════════════════════════════════════════════════════════════
describe('PropertyCard – modo grid', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('renderiza el título en un h3', () => {
    renderGrid();
    const h3 = screen.getByRole('heading', { level: 3 });
    expect(h3).toHaveTextContent('Piso en el centro');
  });

  it('muestra badge "Publicado" cuando status es disponible', () => {
    renderGrid();
    expect(screen.getByText('Publicado')).toBeInTheDocument();
  });

  it('muestra badge "No publicado" cuando status no es disponible', () => {
    renderGrid({ status: 'vendido' });
    expect(screen.getByText('No publicado')).toBeInTheDocument();
  });

  it('aplica opacity-70 cuando status no es disponible', () => {
    const { container } = renderGrid({ status: 'vendido' });
    // El Card raíz es el primer div hijo
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('opacity-70');
  });

  it('no aplica opacity-70 cuando status es disponible', () => {
    const { container } = renderGrid({ status: 'disponible' });
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain('opacity-70');
  });

  it('renderiza el precio formateado en español', () => {
    renderGrid({ price: 250000 });
    // El formato español usa punto como separador de miles
    expect(screen.getByText(/250\.000/)).toBeInTheDocument();
  });

  it('selecciona la imagen correcta según xml_N en image_order', () => {
    renderGrid({ image_order: ['xml_1'] });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/foto-def.jpg');
  });

  it('muestra images[0] como portada cuando image_order es null', () => {
    renderGrid();
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/foto-abc.jpg');
  });

  it('llama a navigate con la ruta correcta al hacer click en el card', () => {
    const { container } = renderGrid();
    fireEvent.click(container.firstChild as HTMLElement);
    expect(mockNavigate).toHaveBeenCalledWith('/properties/prop-001');
  });

  it('muestra la ciudad', () => {
    renderGrid();
    expect(screen.getByText('Madrid')).toBeInTheDocument();
  });

  it('muestra el CRM reference', () => {
    renderGrid();
    expect(screen.getByText('RK-123')).toBeInTheDocument();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// statusLabels y statusColors
// ══════════════════════════════════════════════════════════════════════════
describe('statusLabels', () => {
  const expectedStatuses = [
    'disponible', 'arras', 'vendido',
    'no_disponible', 'reservado', 'alquilado', 'retirado',
  ];

  it('tiene un label para cada estado conocido', () => {
    for (const s of expectedStatuses) {
      expect(statusLabels[s]).toBeDefined();
      expect(typeof statusLabels[s]).toBe('string');
      expect(statusLabels[s].length).toBeGreaterThan(0);
    }
  });
});

describe('statusColors', () => {
  const expectedStatuses = [
    'disponible', 'arras', 'vendido',
    'no_disponible', 'reservado', 'alquilado', 'retirado',
  ];

  it('tiene una clase de color para cada estado conocido', () => {
    for (const s of expectedStatuses) {
      expect(statusColors[s]).toBeDefined();
      expect(typeof statusColors[s]).toBe('string');
      expect(statusColors[s]).toMatch(/^bg-/);
    }
  });
});
