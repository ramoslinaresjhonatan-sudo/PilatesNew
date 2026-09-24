'use client';

import { useState } from 'react';
import { useApiResource, invalidateApiResourcesByPath } from '@/hooks/use-api-resource';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { AdminMembership } from '@/lib/types';
import { StatusState } from '@/components/status-state';

export function ClientMembershipClasses({ userId, clientName, onDone }: { userId: string; clientName: string; onDone: () => void }) {
  const resource = useApiResource<AdminMembership>(`/cliente/${userId}/membresia-actual`, true);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [operationId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const membership = resource.data;
  const count = Number(quantity);
  const valid = Number.isInteger(count) && count >= 1 && count <= 1000 && reason.trim().length >= 3;
  async function save() {
    if (!membership || !valid || busy || saved) return;
    setBusy(true); setError('');
    try {
      await apiRequest(`/cliente/${userId}/clases-adicionales`, { method: 'POST', authenticated: true, body: { membresia_id: membership.id, cantidad: count, motivo: reason.trim(), operacion_id: operationId } });
      setSaved(true);
      ['/cliente', '/membresia', '/perfil'].forEach(invalidateApiResourcesByPath);
    } catch (cause) { setError(getErrorMessage(cause)); } finally { setBusy(false); }
  }
  return <section className="staff-form">
    <h2>Agregar clases</h2><p>{clientName}</p>
    {resource.loading && <StatusState kind="loading" title="Consultando membresía actual" description="Buscando la vigencia y el saldo de clases del cliente." />}
    {resource.error && <StatusState kind="error" title="No se pudo consultar la membresía" description={resource.error} actionLabel="Reintentar" onAction={resource.retry} />}
    {error && <p role="alert">{error}</p>}
    {saved && <p role="status">Las clases adicionales se guardaron correctamente.</p>}
    {membership && !resource.loading && <>
      <p><strong>{membership.nombre_plan_snapshot}</strong> · Vence el {formatDateTime(membership.fecha_fin, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</p>
      <p>{membership.clases_ilimitadas_snapshot ? 'Esta membresía tiene clases ilimitadas; no necesita clases adicionales.' : `${membership.clases_disponibles ?? 0} clases disponibles · ${membership.clases_adicionales ?? 0} adicionales otorgadas.`}</p>
      {!membership.clases_ilimitadas_snapshot && !saved && <>
        <p>Las clases agregadas se podrán usar hasta el vencimiento actual. Esta acción no registra un cobro.</p>
        <label>Clases a agregar<input type="number" min={1} max={1000} step={1} value={quantity} disabled={busy} onChange={(event) => setQuantity(event.target.value)} /></label>
        <label>Motivo<textarea minLength={3} maxLength={500} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder="Por ejemplo: compensación por clase cancelada" /></label>
        {valid && <p>Disponibles después del ajuste: <strong>{(membership.clases_disponibles ?? 0) + count}</strong></p>}
        <button type="button" className="button button-dark" disabled={busy || !valid} onClick={() => void save()}>{busy ? 'Guardando…' : 'Guardar clases adicionales'}</button>
      </>}
      {!!membership.movimientos?.some((movement) => movement.clases_ajuste) && <div><h3>Historial de clases adicionales</h3>{membership.movimientos.filter((movement) => movement.clases_ajuste).map((movement) => <p key={movement.id}>+{movement.clases_ajuste} clases · {movement.motivo}<br /><small>{formatDateTime(movement.fecha_movimiento)}</small></p>)}</div>}
    </>}
    <button type="button" className="button button-outline" disabled={busy} onClick={onDone}>Cerrar</button>
  </section>;
}
