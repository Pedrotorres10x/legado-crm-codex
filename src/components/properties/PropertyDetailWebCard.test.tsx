import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
}));

import PropertyDetailWebCard from './PropertyDetailWebCard';

const writeText = vi.fn();
const openSpy = vi.fn();
const onToast = vi.fn();

Object.defineProperty(globalThis.navigator, 'clipboard', {
  value: { writeText },
  configurable: true,
});

Object.defineProperty(window, 'open', {
  value: openSpy,
  configurable: true,
});

const BASE_PROPERTY = {
  id: '12345678-1234-1234-1234-abcdef123456',
  title: 'Ático en Finestrat',
  city: 'Finestrat',
  province: 'Alicante',
  bedrooms: 3,
  bathrooms: 2,
  price: 450000,
  status: 'disponible',
  images: ['https://cdn.example.com/main.jpg'],
  image_order: null,
};

const renderCard = (overrides = {}) =>
  render(
    <PropertyDetailWebCard
      property={{ ...BASE_PROPERTY, ...overrides }}
      propertyId="prop-123"
      supabaseUrl="https://project.supabase.co"
      onToast={onToast}
    />
  );

describe('PropertyDetailWebCard', () => {
  beforeEach(() => {
    writeText.mockReset();
    openSpy.mockReset();
    onToast.mockReset();
  });

  it('muestra estado live para inmuebles publicados', () => {
    renderCard();
    expect(screen.getByText('Live')).toBeInTheDocument();
  });

  it('muestra estado off para inmuebles no publicados', () => {
    renderCard({ status: 'vendido' });
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('renderiza el resumen comercial con habitaciones, baños y precio', () => {
    renderCard();
    expect(screen.getByText('3 hab. · 2 baños · 450.000 €')).toBeInTheDocument();
  });

  it('abre la URL pública correcta', async () => {
    renderCard();
    fireEvent.click(await screen.findByText('Ver en web'));
    expect(openSpy).toHaveBeenCalledWith(
      'https://legadocoleccion.es/propiedad/atico-en-finestrat-finestrat-23456',
      '_blank',
    );
  });

  it('copia la URL social y lanza toast', async () => {
    renderCard();
    fireEvent.click(await screen.findByText('Copiar enlace redes sociales'));
    expect(writeText).toHaveBeenCalledWith('https://legadocoleccion.es/s/prop-123');
    expect(onToast).toHaveBeenCalledWith(
      'Enlace redes copiado ✓',
      'Pégalo en LinkedIn, WhatsApp o Facebook — verás preview con foto y precio',
    );
  });

  it('copia el enlace de ficha ciega desde Supabase', async () => {
    renderCard();
    fireEvent.click(await screen.findByText('Copiar enlace ficha ciega (redes)'));
    expect(writeText).toHaveBeenCalledWith('https://project.supabase.co/functions/v1/og-blind?id=prop-123');
    expect(onToast).toHaveBeenCalledWith(
      'Enlace ficha ciega copiado ✓',
      'Sin datos de la inmobiliaria — ideal para compartir con otras agencias',
    );
  });
});
