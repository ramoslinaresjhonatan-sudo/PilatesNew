'use client';

/* eslint-disable @next/next/no-img-element -- El QR se muestra sin transformaciones de imagen. */

import { useState } from 'react';
import { useApiResource, invalidateApiResourcesByPath } from '@/hooks/use-api-resource';
import { apiRequest, getErrorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { MembershipPlan } from '@/lib/types';
import { StatusState } from '@/components/status-state';

type Receipt = { pago: { id: string; estado: string; qr_imagen_url?: string | null; qr_expiracion?: string | null }; message: string };
function qrUrl(value?: string | null) {
  if (!value) return '';
  if (/^data:image\/(png|jpeg|webp);base64,/i.test(value)) return value;
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
export function ClientMembershipCheckout({ userId, initialPlanId, onDone }: { userId: string; initialPlanId: string; onDone: () => void }) {
  const plans = useApiResource<MembershipPlan[]>('/cliente/planes-venta', true);
  const [planId, setPlanId] = useState(initialPlanId);
  const [method, setMethod] = useState('EFECTIVO');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [operationId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const plan = plans.data?.find((item) => item.id === planId);
  function refresh() { ['/membresia', '/pago', '/orden-membresia', '/cliente'].forEach(invalidateApiResourcesByPath); }
  async function charge() {
    if (!plan || busy) return;
    setBusy(true); setError('');
    try {
      const result = await apiRequest<Receipt>(`/cliente/${userId}/cobro-membresia`, { method: 'POST', authenticated: true, body: method === 'QR' ? { metodo: method, plan_membresia_id: plan.id } : { metodo: method, plan_membresia_id: plan.id, monto: Number(plan.precio), referencia: reference.trim(), operacion_id: operationId } });
      setReceipt(result); refresh();
    } catch (reason) { setError(getErrorMessage(reason)); } finally { setBusy(false); }
  }
  async function verify() {
    if (!receipt || busy) return;
    setBusy(true); setError('');
    try { const result = await apiRequest<{ estado: string; message: string }>(`/pago/${receipt.pago.id}`, { authenticated: true }); setReceipt({ ...receipt, pago: { ...receipt.pago, estado: result.estado }, message: result.message }); refresh(); }
    catch (reason) { setError(getErrorMessage(reason)); } finally { setBusy(false); }
  }
  return <section className="staff-form" aria-label="Membresía del cliente">
    <h2>Asignar membresía</h2><p>Elige un plan y registra el cobro recibido en el local para activar la membresía.</p>
    {error && <p role="alert">{error}</p>}
    {plans.error && <StatusState kind="error" title="No pudimos cargar los planes" description={plans.error} actionLabel="Reintentar" onAction={plans.retry} />}
    {!receipt ? <>
      <label>Plan<select value={planId} disabled={busy || plans.loading} onChange={(event) => setPlanId(event.target.value)}><option value="">Selecciona un plan</option>{plans.data?.map((item) => <option key={item.id} value={item.id}>{item.nombre} · {formatMoney(item.precio, item.moneda)}</option>)}</select></label>
      {plan && <p><strong>{formatMoney(plan.precio, plan.moneda)}</strong> · {plan.duracion_dias} días · {plan.clases_ilimitadas ? 'Clases ilimitadas' : `${plan.limite_clases} clases`}</p>}
      <label>Forma de pago<select value={method} disabled={busy} onChange={(event) => { setMethod(event.target.value); setConfirmed(false); }}><option value="EFECTIVO">Cobrado en el local · Efectivo</option><option value="TRANSFERENCIA">Cobrado en el local · Transferencia</option><option value="QR">Generar QR</option></select></label>
      {method !== 'QR' && plan && <label>Monto cobrado en el local ({plan.moneda})<input value={Number(plan.precio).toFixed(2)} readOnly /><small>Se registrará el precio completo de la membresía, junto con el medio de pago y el responsable del cobro.</small></label>}
      {!plans.loading && !plans.error && plans.data?.length === 0 && <p>No hay planes activos disponibles para asignar.</p>}
      {method !== 'QR' && <><label>Referencia o número de recibo<input maxLength={180} value={reference} disabled={busy} onChange={(event) => setReference(event.target.value)} /></label><label><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => setConfirmed(event.target.checked)} />Confirmo que recibí el importe completo indicado.</label></>}
      <button type="button" className="button button-dark" disabled={busy || !plan || (method !== 'QR' && (!confirmed || reference.trim().length < 3))} onClick={() => void charge()}>{busy ? 'Procesando…' : method === 'QR' ? 'Generar QR' : 'Registrar pago y activar'}</button>
    </> : <>
      <p role="status"><strong>{receipt.pago.estado}</strong> · {receipt.pago.estado === 'APROBADO' ? 'Membresía activada.' : receipt.message}</p>
      {receipt.pago.estado === 'PENDIENTE' && <>{qrUrl(receipt.pago.qr_imagen_url) && <img src={qrUrl(receipt.pago.qr_imagen_url)} alt="QR para pagar la membresía" style={{ width: 240, maxWidth: '100%' }} />}<p>Vence: {receipt.pago.qr_expiracion ? new Date(receipt.pago.qr_expiracion).toLocaleString('es-BO', { timeZone: 'America/La_Paz' }) : 'Consultar con el proveedor'}</p><button className="button button-outline" type="button" disabled={busy} onClick={() => void verify()}>Consultar pago</button></>}
    </>}
    <button type="button" className="button button-outline" disabled={busy} onClick={onDone}>Cerrar</button>
  </section>;
}
