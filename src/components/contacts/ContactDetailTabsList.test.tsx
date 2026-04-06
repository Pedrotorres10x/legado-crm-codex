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
    <Tabs defaultValue="actividad">
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
  it('muestra los 5 tabs consolidados', () => {
    renderTabs();
    expect(screen.getByText(/Actividad/)).toBeInTheDocument();
    expect(screen.getByText(/Agenda/)).toBeInTheDocument();
    expect(screen.getByText(/Negocio/)).toBeInTheDocument();
    expect(screen.getByText(/Pipeline/)).toBeInTheDocument();
    expect(screen.getByText(/Documentos/)).toBeInTheDocument();
  });

  it('agrega contador en Actividad cuando hay llamadas', () => {
    renderTabs();
    // callsCount=1
    expect(screen.getByText('Actividad (1)')).toBeInTheDocument();
  });

  it('agrega contador en Agenda (tareas pendientes + visitas)', () => {
    renderTabs();
    // pendingTasks=0 + visitsCount=3 = 3
    expect(screen.getByText('Agenda (3)')).toBeInTheDocument();
  });

  it('agrega contador en Negocio (demandas + matches)', () => {
    renderTabs();
    // demandsCount=2 + matchesCount=4 = 6
    expect(screen.getByText('Negocio (6)')).toBeInTheDocument();
  });

  it('agrega contador en Pipeline (ofertas + reengagement)', () => {
    renderTabs();
    // offersCount=5 + reengagementCount=6 = 11
    expect(screen.getByText('Pipeline (11)')).toBeInTheDocument();
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
