'use client';

import { useMemo, useState } from 'react';
import { StatusState } from '@/components/status-state';
import { formatDateTime, formatMoney, getFullName, getMembershipCoverage } from '@/lib/format';
import type { Activity, AdminMembership, MembershipPlan } from '@/lib/types';
import { MembershipPlanManager } from './membership-plan-manager';

export function MembershipModule({ plans, activities, memberships, membershipsLoading, membershipsError, retryMemberships, reloadPlans, canManage }: { plans: MembershipPlan[]; activities: Activity[]; memberships: AdminMembership[]; membershipsLoading: boolean; membershipsError: string | null; retryMemberships: () => void; reloadPlans: () => void; canManage: boolean }) {
  const [view, setView] = useState<'plans' | 'memberships'>(canManage ? 'plans' : 'memberships');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('TODAS');
  const [planId, setPlanId] = useState('TODOS');
  const [order, setOrder] = useState('vencimiento');
  const [page, setPage] = useState(1);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  const statuses = [...new Set(memberships.map((item) => item.estado))].sort();
  const planOptions = [...new Map(memberships.map((item) => [item.plan_membresia_id, item.nombre_plan_snapshot || item.plan?.nombre || 'Plan sin nombre'])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  const terms = normalize(search).split(/\s+/).filter(Boolean);
  const filtered = memberships.filter((item) => {
    const text = normalize(`${getFullName(item.cliente)} ${item.cliente.correo || ''} ${item.nombre_plan_snapshot || ''}`);
    return terms.every((term) => text.includes(term)) && (status === 'TODAS' || item.estado === status) && (planId === 'TODOS' || item.plan_membresia_id === planId);
  }).sort((a, b) => {
    if (order === 'cliente') return getFullName(a.cliente).localeCompare(getFullName(b.cliente), 'es');
    if (order === 'recientes') return Date.parse(b.fecha_inicio) - Date.parse(a.fecha_inicio);
    return Date.parse(a.fecha_fin) - Date.parse(b.fecha_fin);
  });
  const pages = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  function clearFilters() { setSearch(''); setStatus('TODAS'); setPlanId('TODOS'); setOrder('vencimiento'); setPage(1); }
  const active = useMemo(() => memberships.filter((item) => item.estado === 'ACTIVA').length, [memberships]);
  return <section className="membership-module connected-manager">
    <div className="staff-tabs module-view-tabs" role="tablist" aria-label="Gestión de membresías"><button type="button" role="tab" aria-selected={view === 'plans'} className={view === 'plans' ? 'is-active' : ''} onClick={() => setView('plans')}>Planes <span>{plans.length}</span></button><button type="button" role="tab" aria-label="Membresías adquiridas" aria-selected={view === 'memberships'} className={view === 'memberships' ? 'is-active' : ''} onClick={() => setView('memberships')}>Adquiridas <span>{memberships.length}</span></button></div>
    {view === 'plans' && (canManage
      ? <MembershipPlanManager plans={plans} activities={activities} reload={reloadPlans} />
      : <MembershipPlanCatalog plans={plans} />)}
    {view === 'memberships' && <>
      {membershipsLoading && <StatusState kind="loading" title="Cargando membresías adquiridas" description="Un momento, estamos buscando las membresías." />}
      {membershipsError && <StatusState kind="error" title="No pudimos cargar las membresías" description={membershipsError} actionLabel="Reintentar" onAction={retryMemberships} />}
      {!membershipsLoading && !membershipsError && <><div className="integration-summary"><article><span>Total</span><strong>{memberships.length}</strong><small>Membresías registradas</small></article><article><span>Activas</span><strong>{active}</strong><small>Con vigencia actual</small></article></div><div className="connected-toolbar membership-filters">
        <label><span>Buscar cliente</span><input type="search" placeholder="Nombre, correo o plan" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <label><span>Estado</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="TODAS">Todos los estados</option>{statuses.map((value) => <option key={value} value={value}>{value.toLocaleLowerCase('es')}</option>)}</select></label>
        <label><span>Plan</span><select value={planId} onChange={(event) => { setPlanId(event.target.value); setPage(1); }}><option value="TODOS">Todos los planes</option>{planOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label><span>Ordenar por</span><select value={order} onChange={(event) => { setOrder(event.target.value); setPage(1); }}><option value="vencimiento">Vencimiento más cercano</option><option value="recientes">Inicio más reciente</option><option value="cliente">Nombre del cliente</option></select></label>
        <button type="button" className="button button-outline" onClick={clearFilters}>Limpiar</button>
      </div>
      <p role="status">{filtered.length} de {memberships.length} membresías · {filtered.length ? `Mostrando ${(currentPage - 1) * 10 + 1}–${Math.min(currentPage * 10, filtered.length)}` : 'Sin resultados'}</p>
      <div className="connected-list">{visible.length ? visible.map((membership) => <article key={membership.id}>
        <div className="connected-list__main"><span className={`state-pill ${membership.estado === 'ACTIVA' ? 'is-success' : 'is-pending'}`}>{membership.estado}</span><h3>{getFullName(membership.cliente)}</h3><p>{membership.nombre_plan_snapshot} · {membership.cliente.correo}</p><small>{formatDateTime(membership.fecha_inicio, { day: 'numeric', month: 'short', year: 'numeric' })} — {formatDateTime(membership.fecha_fin, { day: 'numeric', month: 'short', year: 'numeric' })}</small></div>
        <div className="connected-list__numbers"><strong>{formatMoney(membership.precio_pagado, membership.moneda)}</strong><small>{membership.clases_ilimitadas_snapshot ? 'Clases ilimitadas' : `${membership.clases_disponibles ?? 0} disponibles`}</small></div>
      </article>) : <p className="staff-empty">{memberships.length ? 'No hay membresías que coincidan con los filtros.' : 'No hay membresías adquiridas.'}</p>}</div>
      {pages > 1 && <nav className="connected-toolbar" aria-label="Paginación de membresías"><button type="button" className="button button-outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><span>Página {currentPage} de {pages}</span><button type="button" className="button button-outline" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Siguiente</button></nav>}</>}
    </>}
  </section>;
}

function MembershipPlanCatalog({ plans }: { plans: MembershipPlan[] }) {
  return <section className="plan-manager" aria-label="Consulta de planes">
    <header className="staff-manager__header"><div><h2>Planes de membresía</h2><p>Consulta precios, duración y beneficios de cada plan.</p></div></header>
    <div className="plan-card-list plan-card-list--showcase">{plans.length ? plans.map((plan) => <article className={`plan-card plan-card--showcase${plan.slug.trim().toLowerCase() === 'black' ? ' plan-card--black' : plan.destacado || plan.slug.trim().toLowerCase() === 'gold' ? ' plan-card--featured' : ''}`} key={plan.id}>
      <div>
        <span className={`state-pill ${plan.estado === 'ACTIVO' ? 'is-success' : 'is-pending'}`}>{plan.estado || 'Sin estado'}</span>
        <div className="plan-card__heading"><h3>{plan.nombre}</h3></div>
        <p>{plan.subtitulo || plan.descripcion || 'Sin descripción'}</p>
        <strong>{formatMoney(plan.precio, plan.moneda)} · {plan.duracion_dias} días</strong>
        <ul>{getMembershipCoverage(plan).map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </article>) : <p className="staff-empty">No hay planes registrados.</p>}</div>
  </section>;
}
