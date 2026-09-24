/* eslint-disable @next/next/no-img-element -- Las imágenes del plan y QR se validan contra el origen permitido. */
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { LandingSectionLink } from '@/components/landing-section-link';
import { useConfirm } from '@/components/confirm-dialog';
import { StatusState } from '@/components/status-state';
import { ResilientImage } from '@/components/resilient-image';
import { invalidateApiResourcesByPath, useApiResource } from '@/hooks/use-api-resource';
import { useAuthSession } from '@/hooks/use-auth-session';
import { ApiError, getErrorMessage, safeAssetUrl } from '@/lib/api';
import { cancelMembershipPayment, createMembershipOrder, getPaymentStatus, getPendingMembershipPayment, type MembershipOrderResponse } from '@/lib/client-api';
import { formatMoney, getMembershipCoverage } from '@/lib/format';
import type { MembershipPlan } from '@/lib/types';

type FlowState = 'review' | 'creating' | 'pending' | 'confirmed' | 'denied' | 'review-required' | 'error';

function normalizedPaymentState(value?: string) {
  return String(value || '').toUpperCase();
}

function paymentQrUrl(value?: string | null) {
  if (!value) return '';
  if (/^data:image\/(png|jpeg|webp);base64,/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function dateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export function MembershipPaymentView({ planSlug }: { planSlug: string }) {
  const router = useRouter();
  const session = useAuthSession();
  const { confirm, confirmDialog } = useConfirm();
  const request = useApiResource<MembershipPlan>(`/plan-membresia/${encodeURIComponent(planSlug)}`);
  const plan = request.data?.estado === 'ACTIVO' ? request.data : null;
  const [flow, setFlow] = useState<FlowState>('review');
  const [payment, setPayment] = useState<NonNullable<MembershipOrderResponse['pago']> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [recovering, setRecovering] = useState(true);

  useEffect(() => { if (flow !== 'pending') return undefined; const expires = payment?.qr_expiracion ? new Date(payment.qr_expiracion).getTime() : Date.now() + 180000; const timer = window.setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((expires - Date.now()) / 1000))), 1000); return () => window.clearInterval(timer); }, [flow, payment?.qr_expiracion]);

  const applyPaymentState = useCallback((state: string, nextMessage?: string) => {
    const normalized = normalizedPaymentState(state);
    if (normalized === 'APROBADO') {
      ['/perfil', '/membresia/activa', '/pago/pendiente', '/inscripcion/mias'].forEach(invalidateApiResourcesByPath);
      setFlow('confirmed');
      setMessage(nextMessage || 'El pago fue confirmado y tu membresía ya puede actualizarse.');
    } else if (normalized === 'EN_REVISION') {
      setFlow('review-required');
      setMessage(nextMessage || 'El pago requiere revisión administrativa. No realices otro pago hasta recibir confirmación.');
    } else if (['RECHAZADO', 'EXPIRADO', 'CANCELADO'].includes(normalized)) {
      setFlow('denied');
      setMessage(nextMessage || 'El pago no pudo confirmarse. No se activó ninguna membresía.');
    } else {
      setFlow('pending');
      setMessage(nextMessage || 'Estamos esperando la confirmación segura del proveedor de pago.');
    }
  }, []);

  useEffect(() => {
    let active = true;
    void getPendingMembershipPayment().then((pending) => {
      if (!active || !pending || pending.plan_slug !== planSlug) return;
      setPayment(pending.pago);
      applyPaymentState(pending.pago.estado, 'Retomamos tu pago pendiente.');
    }).catch(() => { /* El backend valida los pagos pendientes antes de crear otra orden. */ }).finally(() => { if (active) setRecovering(false); });
    return () => { active = false; };
  }, [applyPaymentState, planSlug]);

  const verifyPayment = useCallback(async () => {
    if (!payment?.id) return;
    try {
      const status = await getPaymentStatus(payment.id);
      applyPaymentState(status.estado, status.message);
    } catch (caught) {
      setMessage(getErrorMessage(caught));
    }
  }, [applyPaymentState, payment]);

  useEffect(() => {
    if (flow !== 'pending' || !payment?.id) return undefined;
    const timer = window.setInterval(() => { void verifyPayment(); }, 5000);
    return () => window.clearInterval(timer);
  }, [flow, payment?.id, verifyPayment]);

  async function startPayment() {
    if (!plan || recovering || flow === 'creating') return;
    setFlow('creating');
    setMessage(null);
    try {
      const response = await createMembershipOrder(plan.id);
      if (!response.pago?.id) throw new ApiError('No pudimos generar el código de pago. Intentá de nuevo en unos minutos.', 502, response);
      setPayment(response.pago);
      invalidateApiResourcesByPath('/pago/pendiente');
      applyPaymentState(response.pago.estado, response.message);
    } catch (caught) {
      setFlow('error');
      const unavailable = caught instanceof ApiError && [404, 405].includes(caught.status);
      setMessage(unavailable
        ? 'Todavía no se puede pagar en línea. No se te cobró nada: escribinos y lo resolvemos.'
        : getErrorMessage(caught));
    }
  }
  function downloadQr() { if (!qrImage) return; const link = document.createElement('a'); link.href = qrImage; link.download = `qr-${plan?.slug || 'membresia'}.png`; link.target = '_blank'; link.rel = 'noopener'; link.click(); }
  function returnToMemberships() { router.replace('/memberships#membership-plans'); }
  async function cancelPayment() {
    if (!payment?.id) { returnToMemberships(); return; }
    if (!(await confirm({ title: '¿Cancelar este pago?', description: 'Podrás elegir otra membresía. Si ya pagaste, actualizá el estado antes de cancelar.', confirmLabel: 'Cancelar pago', tone: 'danger' }))) return;
    try {
      await cancelMembershipPayment(payment.id);
      invalidateApiResourcesByPath('/pago/pendiente');
      returnToMemberships();
      router.refresh();
    } catch (caught) {
      setMessage(getErrorMessage(caught));
    }
  }

  const planImage = safeAssetUrl(plan?.imagenes?.[0]?.url, '', plan?.imagenes?.[0]?.id);
  const qrImage = paymentQrUrl(payment?.qr_imagen_url);

  return (
    <main className="payment-page" aria-labelledby="payment-title">
      {confirmDialog}
      <header className="payment-page__heading">
        <span>PAGO SEGURO PILATES HOUSE</span>
        <h1 id="payment-title">Completá tu membresía</h1>
        <p>{session?.user.nombre || 'Miembro House'}, revisá el plan y continuá con el pago. Nunca solicitamos datos de tarjeta directamente en esta pantalla.</p>
        <Link href="/mi-panel">Volver a mi panel</Link>
      </header>

      {request.loading && !plan && <StatusState kind="loading" title="Cargando el plan" description="Estamos consultando la membresía seleccionada." />}
      {!request.loading && !plan && <StatusState kind="error" title="Plan no disponible" description={request.error || 'El plan solicitado no existe o dejó de estar disponible.'} actionLabel="Reintentar" onAction={request.retry} />}

      {plan && <div className="payment-page__layout">
        <article className="payment-plan">
          <div className={`payment-plan__image${planImage ? '' : ' payment-plan__image--empty'}`}>{planImage && <ResilientImage src={planImage} alt={plan.imagenes?.[0]?.texto_alt || plan.nombre} />}</div>
          <div className="payment-plan__body"><span>PLAN SELECCIONADO</span><h2>{plan.nombre}</h2><strong>{formatMoney(plan.precio, plan.moneda)}</strong><ul>{getMembershipCoverage(plan).map((item) => <li key={item}>{item}</li>)}</ul><LandingSectionLink section="membresias">Cambiar de plan</LandingSectionLink></div>
        </article>

        <aside className="payment-process" aria-live="polite">
          {flow === 'review' && <><span>PAGO SEGURO</span><h2>Confirmar pago</h2><p>Usaremos los datos de tu cuenta House. La membresía se activa únicamente cuando el pago sea verificado.</p><dl><div><dt>Membresía</dt><dd>{plan.nombre}</dd></div><div><dt>Vigencia</dt><dd>{plan.duracion_dias} días</dd></div><div><dt>Total</dt><dd>{formatMoney(plan.precio, plan.moneda)}</dd></div></dl><button type="button" disabled={recovering} onClick={startPayment}>{recovering ? 'Consultando pagos pendientes…' : 'Generar QR de pago'}</button></>}
          {flow === 'creating' && <StatusState kind="loading" title="Creando pago" description="Estamos generando tu código de pago." />}
          {flow === 'pending' && <><span>COMPROBANTE DE PAGO</span><h2>Escaneá el código QR</h2>{qrImage ? <div className="payment-process__qr"><img src={qrImage} alt="Código QR de pago" /></div> : <div className="payment-process__qr payment-process__qr--empty"><span>Generando el código QR…</span></div>}<strong className="payment-process__amount">{formatMoney(plan.precio, plan.moneda)}</strong><dl className="payment-receipt__details"><div><dt>N.º de pago</dt><dd>{payment?.referencia || payment?.id.slice(0, 8).toUpperCase()}</dd></div><div><dt>Concepto</dt><dd>{plan.nombre}</dd></div><div><dt>Fecha de emisión</dt><dd>{dateTime(payment?.fecha_generacion)}</dd></div><div><dt>Válido hasta</dt><dd>{dateTime(payment?.qr_expiracion)}</dd></div><div><dt>Estado</dt><dd>Pendiente de pago</dd></div></dl><p className="payment-process__timer">Vence en {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}</p>{message && <p className="payment-process__message">{message}</p>}{qrImage && <button type="button" onClick={downloadQr}>Descargar comprobante QR</button>}<button type="button" className="payment-process__verify" onClick={verifyPayment}>Actualizar estado</button><button type="button" className="payment-process__cancel" onClick={() => void cancelPayment()}>Cancelar pago</button></>}
          {flow === 'confirmed' && <div className="payment-result payment-result--confirmed"><span aria-hidden="true">✓</span><h2>Pago confirmado</h2><p>{message}</p><p>Elegí tus clases y horarios desde tu panel. En Membresía podés consultar tu pago, la vigencia y todos los beneficios de tu plan.</p><Link href="/mi-panel/Clases">Elegir mis clases y horarios</Link><Link href="/mi-panel/Membresia">Ver mi membresía</Link></div>}
          {flow === 'denied' && <div className="payment-result payment-result--denied"><span aria-hidden="true">!</span><h2>Pago no confirmado</h2><p>{message}</p><button type="button" onClick={() => { setFlow('review'); setPayment(null); setMessage(null); }}>Intentar nuevamente</button><LandingSectionLink section="membresias">Volver a membresías</LandingSectionLink></div>}
          {flow === 'review-required' && <div className="payment-result payment-result--denied"><span aria-hidden="true">!</span><h2>Pago en revisión</h2><p>{message}</p><p>No generes ni pagues otro QR.</p><Link href="/mi-panel">Volver a mi panel</Link></div>}
          {flow === 'error' && <div className="payment-result payment-result--denied"><span aria-hidden="true">i</span><h2>No se pudo iniciar el pago</h2><p>{message}</p><button type="button" onClick={() => { setFlow('review'); setMessage(null); }}>Reintentar</button><LandingSectionLink section="membresias">Volver a membresías</LandingSectionLink></div>}
        </aside>
      </div>}
    </main>
  );
}
