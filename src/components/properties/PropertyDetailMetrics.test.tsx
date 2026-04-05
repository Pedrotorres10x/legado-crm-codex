import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import PropertyDetailMetrics from './PropertyDetailMetrics';

describe('PropertyDetailMetrics', () => {
  it('muestra helpers de estado vacio cuando no hay actividad', () => {
    render(
      <PropertyDetailMetrics
        visitsCount={0}
        offersCount={0}
        matchesCount={0}
        hasMandate={false}
        documentsReady={false}
        propertyIssueCount={3}
      />,
    );

    expect(screen.getByText('Aun no hay visitas cargadas')).toBeInTheDocument();
    expect(screen.getByText('Todavia no hay propuestas')).toBeInTheDocument();
    expect(screen.getByText('No hay cruces vivos ahora mismo')).toBeInTheDocument();
    expect(screen.getByText('3 puntos por revisar')).toBeInTheDocument();
  });

  it('muestra estado listo cuando la documentacion esta completa', () => {
    render(
      <PropertyDetailMetrics
        visitsCount={4}
        offersCount={2}
        matchesCount={6}
        hasMandate
        documentsReady
        propertyIssueCount={0}
      />,
    );

    expect(screen.getByText('Visitas ya registradas')).toBeInTheDocument();
    expect(screen.getByText('Negociacion en marcha')).toBeInTheDocument();
    expect(screen.getByText('Compradores compatibles')).toBeInTheDocument();
    expect(screen.getByText('Ficha lista para trabajar')).toBeInTheDocument();
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});
