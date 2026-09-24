'use client';

import { useMemo, useState } from 'react';
import { StatusState } from '@/components/status-state';
import { formatDateTime, formatMoney } from '@/lib/format';
import { studioDateKey } from '@/lib/studio-time';
import type { AdminPayment, MembershipOrder, PaymentReconciliationQueue } from '@/lib/types';

type PaymentTab = 'payments' | 'orders' | 'review';
type Filters = { busqueda: string; desde: string; hasta: string };

const emptyFilters: Filters = { busqueda: '', desde: '', hasta: '' };

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (['APROBADO', 'PAGADA', 'ACTIVA'].includes(normalized)) return 'is-success';
  if (['RECHAZADO', 'FALLIDO', 'CANCELADO', 'EXPIRADO'].includes(normalized)) return 'is-danger';
  if (['EN_REVISION', 'IN_REVIEW'].includes(normalized)) return 'is-warning';
  return 'is-pending';
}

/** Compara por día en la zona del estudio, para que el rango incluya ambos extremos. */
function withinRange(isoDate: string | null | undefined, from: string, to: string) {
  if (!from && !to) return true;
  const day = isoDate ? studioDateKey(isoDate) : '';
  if (!day) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

/** Busca solo por nombre del cliente: el código de orden no entra en la búsqueda. */
function matchesSearch(haystack: Array<string | null | undefined>, term: string) {
  if (!term) return true;
  const needle = term.trim().toLocaleLowerCase('es');
  return haystack.filter(Boolean).join(' ').toLocaleLowerCase('es').includes(needle);
}

export function PaymentManager({
  payments,
  orders,
  reconciliation,
  reconciliationLoading,
  reconciliationError,
  retryReconciliation,
}: {
  payments: AdminPayment[];
  orders: MembershipOrder[];
  reconciliation: PaymentReconciliationQueue | null;
  reconciliationLoading: boolean;
  reconciliationError: string | null;
  retryReconciliation: () => void;
}) {
  const [tab, setTab] = useState<PaymentTab>('payments');
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const hasFilters = Boolean(filters.busqueda.trim() || filters.desde || filters.hasta);

  const visiblePayments = useMemo(
    () => payments.filter((payment) =>
      withinRange(payment.fecha_creacion, filters.desde, filters.hasta) &&
      matchesSearch([payment.cliente], filters.busqueda),
    ),
    [payments, filters],
  );

  const visibleOrders = useMemo(
    () => orders.filter((order) =>
      withinRange(order.fecha_creacion, filters.desde, filters.hasta) &&
      matchesSearch([order.cliente], filters.busqueda),
    ),
    [orders, filters],
  );

  const totals = useMemo(() => ({
    approved: payments.filter((payment) => payment.estado === 'APROBADO').length,
    pending: payments.filter((payment) => payment.estado === 'PENDIENTE').length,
    review: reconciliation?.total || 0,
  }), [payments, reconciliation]);

  const change = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

  const shownCount = tab === 'payments' ? visiblePayments.length : visibleOrders.length;
  const totalCount = tab === 'payments' ? payments.length : orders.length;

  return <section className="connected-manager payment-manager">
    <div className="integration-summary" aria-label="Resumen de cobros">
      <article><span>Pagos</span><strong>{payments.length}</strong><small>{totals.approved} aprobados</small></article>
      <article><span>Órdenes</span><strong>{orders.length}</strong><small>{totals.pending} pagos pendientes</small></article>
      <article><span>Por revisar</span><strong>{reconciliationLoading ? '—' : totals.review}</strong><small>Necesitan atención</small></article>
    </div>

    <div className="staff-tabs" role="tablist" aria-label="Cobros del estudio">
      <button type="button" role="tab" aria-selected={tab === 'payments'} className={tab === 'payments' ? 'is-active' : ''} onClick={() => setTab('payments')}>Pagos <span>{payments.length}</span></button>
      <button type="button" role="tab" aria-selected={tab === 'orders'} className={tab === 'orders' ? 'is-active' : ''} onClick={() => setTab('orders')}>Órdenes <span>{orders.length}</span></button>
      <button type="button" role="tab" aria-selected={tab === 'review'} className={tab === 'review' ? 'is-active' : ''} onClick={() => setTab('review')}>Por revisar <span>{totals.review}</span></button>
    </div>

    {tab !== 'review' && <div className="payment-filters">
      <label>
        <span>Nombre del cliente</span>
        <input
          type="search"
          value={filters.busqueda}
          placeholder="Ej.: Valentina Rojas"
          autoComplete="off"
          onChange={(event) => change('busqueda', event.target.value)}
        />
      </label>
      <label>
        <span>Desde</span>
        <input type="date" max={filters.hasta || undefined} value={filters.desde} onChange={(event) => change('desde', event.target.value)} />
      </label>
      <label>
        <span>Hasta</span>
        <input type="date" min={filters.desde || undefined} value={filters.hasta} onChange={(event) => change('hasta', event.target.value)} />
      </label>
      <div className="payment-filters__meta">
        <small>{hasFilters ? `${shownCount} de ${totalCount}` : `${totalCount} en total`}</small>
        {hasFilters && <button className="text-link" type="button" onClick={() => setFilters(emptyFilters)}>Limpiar</button>}
      </div>
    </div>}

    {tab === 'payments' && <div className="connected-list">{visiblePayments.length ? visiblePayments.map((payment) => <article key={payment.id}>
      <div className="connected-list__main"><span className={`state-pill ${statusClass(payment.estado)}`}>{payment.estado}</span><h3>{payment.cliente}</h3><p>Orden {payment.orden_codigo} · intento {payment.numero_intento}</p><small>{formatDateTime(payment.fecha_creacion)}</small></div>
      <div className="connected-list__numbers"><strong>{formatMoney(payment.monto_pagado ?? payment.monto_solicitado, payment.moneda)}</strong><small>{payment.proveedor}{payment.banco_pagador ? ` · ${payment.banco_pagador}` : ''}</small></div>
    </article>) : <p className="staff-empty">{hasFilters ? 'Ningún pago coincide con ese nombre o rango de fechas.' : 'Todavía no hay pagos registrados.'}</p>}</div>}

    {tab === 'orders' && <div className="connected-list">{visibleOrders.length ? visibleOrders.map((order) => <article key={order.id}>
      <div className="connected-list__main"><span className={`state-pill ${statusClass(order.estado)}`}>{order.estado}</span><h3>{order.cliente}</h3><p>{order.plan} · {order.correo}</p><small>{order.codigo} · {formatDateTime(order.fecha_creacion)}</small></div>
      <div className="connected-list__numbers"><strong>{formatMoney(order.monto_total, order.moneda)}</strong><small>{order.pagos} {order.pagos === 1 ? 'intento' : 'intentos'}</small></div>
    </article>) : <p className="staff-empty">{hasFilters ? 'Ninguna orden coincide con ese nombre o rango de fechas.' : 'Todavía no hay órdenes registradas.'}</p>}</div>}

    {tab === 'review' && <>
      {reconciliationLoading && <StatusState kind="loading" title="Buscando pagos por revisar" description="Un momento, estamos revisando los cobros observados." />}
      {reconciliationError && <StatusState kind="error" title="No pudimos cargar los pagos por revisar" description={reconciliationError} actionLabel="Reintentar" onAction={retryReconciliation} />}
      {!reconciliationLoading && !reconciliationError && <div className="connected-list">{reconciliation?.pagos.length ? reconciliation.pagos.map((payment) => <article key={payment.id}>
        <div className="connected-list__main"><span className={`state-pill ${statusClass(payment.status)}`}>{payment.status.replaceAll('_', ' ')}</span><h3>{payment.membershipOrder?.code || 'Pago sin código de orden'}</h3><p>{payment.membershipOrder?.planNameSnapshot || 'Plan no identificado'}</p><small>{payment.vendisQrId ? `QR ${payment.vendisQrId}` : 'Sin código QR'}</small></div>
        <div className="connected-list__numbers"><strong>{formatMoney(payment.paidAmount ?? payment.requestedAmount, payment.currency)}</strong><small>{payment.webhookEvents?.length || 0} {payment.webhookEvents?.length === 1 ? 'aviso con error' : 'avisos con error'}</small></div>
      </article>) : <p className="staff-empty">No hay pagos esperando revisión.</p>}</div>}
    </>}
  </section>;
}
