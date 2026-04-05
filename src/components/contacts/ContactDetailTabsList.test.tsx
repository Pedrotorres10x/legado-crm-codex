import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tabs } from '@/components/ui/tabs';
import ContactDetailTabsList from './ContactDetailTabsList';

const BASE_CONTACT = {
  id: 'contact-1',
  full_name: 'Ana Propietaria',
  contact_type: 'propietario',
} as const;

const renderTabs = ({
  contact = BASE_CONTACT,
  tasks = [],
}: {
  contact?: { id: string; full_name: string; contact_type: string };
  tasks?: Array<{ id: string; completed: boolean; due_date: string }>;
} = {}) =>
  render(
    <Tabs defaultValue="timeline">
      <ContactDetailTabsList
        contact={contact as never}
        demandsCount={2}
        matchesCount={4}
        callsCount={1}
        visitsCount={3}
        offersCount={5}
        tasks={tasks as never}
        reengagementCount={6}
      />
    </Tabs>
  );

describe('ContactDetailTabsList', () => {
  it('muestra los contadores principales', () => {
    renderTabs();
    expect(screen.getByText('Demandas (2)')).toBeInTheDocument();
    expect(screen.getByText('Cruces (4)')).toBeInTheDocument();
    expect(screen.getByText('Visitas (3)')).toBeInTheDocument();
    expect(screen.getByText('Ofertas (5)')).toBeInTheDocument();
  });

  it('muestra fidelización para tipos con reengagement', () => {
    renderTabs();
    expect(screen.getByText('Fidelización (6)')).toBeInTheDocument();
  });

  it('oculta fidelización para compradores abiertos', () => {
    renderTabs({
      contact: {
        id: 'contact-2',
        full_name: 'Carlos Comprador',
        contact_type: 'comprador',
      },
    });
    expect(screen.queryByText('Fidelización (6)')).not.toBeInTheDocument();
  });

  it('marca tareas vencidas con indicador visual', () => {
    const { container } = renderTabs({
      tasks: [{ id: 'task-1', completed: false, due_date: '2020-01-01T10:00:00.000Z' }],
    });
    expect(container.querySelector('.bg-destructive')).toBeTruthy();
  });

  it('no marca indicador si las tareas no están vencidas', () => {
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { container } = renderTabs({
      tasks: [{ id: 'task-1', completed: false, due_date: futureDate }],
    });
    expect(container.querySelector('.bg-destructive')).toBeFalsy();
  });
});
