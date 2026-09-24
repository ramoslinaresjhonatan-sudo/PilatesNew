import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.log('BROWSER_ERROR:', error.message));
  await page.goto('http://localhost:5173/login');
  await page.locator('#login-email').fill(process.env.CLIENT_TEST_EMAIL || '');
  await page.locator('#login-password').fill(process.env.CLIENT_TEST_PASSWORD || '');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await page.waitForURL('**/mi-panel', { timeout: 30000 });
  await page.getByRole('link', { name: 'Elegir mi membresía' }).waitFor();
  await page.getByText('Todavía no tenés una membresía activa', { exact: true }).waitFor();
  assert.equal(await page.locator('#reservar').count(), 0);
  console.log('PASS: real login and client without membership');
  await page.getByRole('link', { name: 'Elegir mi membresía' }).click();
  const planResponse = page.waitForResponse((response) => /\/api\/v1\/plan-membresia\/[^?]+$/.test(response.url()));
  await page.getByRole('link', { name: 'Elegir membresía', exact: true }).first().click();
  const plan = await (await planResponse).json();
  await page.getByRole('button', { name: 'Generar QR de pago' }).waitFor();
  console.log('PASS: session preserved from panel to memberships and checkout');
  await page.reload();
  await page.getByRole('button', { name: 'Generar QR de pago' }).waitFor();
  console.log('PASS: checkout session survives reload');
  if (process.env.CLIENT_TEST_QR === '1') {
    const orderResponse = page.waitForResponse((response) => response.url().endsWith('/orden-membresia') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Generar QR de pago' }).click();
    const response = await orderResponse;
    if (!response.ok()) {
      await page.getByRole('heading', { name: 'No se pudo iniciar el pago' }).waitFor();
      console.log('REAL_QR_BLOCKED:', response.status(), await page.locator('.payment-result p').first().innerText());
    } else {
      await page.getByRole('heading', { name: 'Escaneá el código QR' }).waitFor();
      await page.getByRole('button', { name: 'Cancelar pago', exact: true }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar pago', exact: true }).click();
      await page.waitForURL('**/memberships#membership-plans');
      console.log('PASS (real sandbox provider): QR generated and test payment cancelled');
      await page.goto('http://localhost:5173/mi-panel');
    }
  }
  if (!page.url().endsWith('/mi-panel')) await page.getByRole('link', { name: 'Volver a mi panel' }).click();
  await page.getByRole('link', { name: 'Elegir mi membresía' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile panel overflows');
  console.log('PASS: return to panel and mobile width');
  await page.getByText('Todavía no tenés una membresía activa', { exact: true }).waitFor();
  await page.screenshot({ path: 'outputs/client-panel-empty.png', fullPage: true });

  // Isolated provider responses: no payments or enrollments written to the real account.
  let paid = false;
  let reserved = false;
  let reservationRequests = 0;
  const start = new Date(Date.now() + 60_000).toISOString();
  const end = new Date(Date.now() + 3_600_000).toISOString();
  const membership = { id: 'test-membership', estado: 'ACTIVA', fecha_inicio: new Date().toISOString(), fecha_fin: new Date(Date.now() + 30 * 86400000).toISOString(), nombre_plan_snapshot: plan.nombre, limite_clases_snapshot: 3, clases_disponibles: 3, clases_usadas: 0, plan, beneficios: [] };
  const enrollment = { id: 'test-enrollment', agenda_actividad_id: 'test-class', actividad: 'Clase de prueba', estado: 'RESERVADA', fecha_inicio: start, fecha_fin: end, coach: 'Coach' };
  const payment = { id: 'test-payment', estado: 'PENDIENTE', qr_expiracion: new Date(Date.now() + 900000).toISOString() };
  const json = (route, data) => route.fulfill({ json: data });
  await page.route('**/api/v1/perfil', async (route) => {
    const response = await route.fetch();
    const profile = await response.json();
    await json(route, { ...profile, membresia_activa: paid ? membership : null });
  });
  await page.route('**/api/v1/pago/pendiente', (route) => json(route, null));
  await page.route('**/api/v1/orden-membresia', (route) => json(route, { pago: payment }));
  await page.route('**/api/v1/pago/test-payment', (route) => { paid = true; return json(route, { id: payment.id, estado: 'APROBADO', membresia: membership }); });
  await page.route('**/api/v1/inscripcion/mias', (route) => json(route, reserved ? [enrollment] : []));
  await page.route('**/api/v1/agenda?*', (route) => json(route, [{ ...enrollment, categoria: 'CLASE', estado: 'PROGRAMADA', estado_clase: 'PROGRAMADA', cupos: 10, cupos_disponibles: 10 }]));
  await page.route('**/api/v1/agenda/test-class/reserva', (route) => { reserved = true; reservationRequests++; return json(route, { id: enrollment.id, estado: 'RESERVADA' }); });
  await page.getByRole('link', { name: 'Elegir mi membresía' }).click();
  await page.getByRole('link', { name: 'Elegir membresía', exact: true }).first().click();
  await page.getByRole('button', { name: 'Generar QR de pago' }).click();
  await page.getByRole('button', { name: 'Actualizar estado' }).click();
  await page.getByRole('link', { name: 'Elegir mis clases y horarios' }).click();
  await page.locator('#reservar').waitFor();
  console.log('PASS (simulated provider): approved payment refreshes cached membership and enables classes');
  await page.getByRole('button', { name: 'Reservar', exact: true }).click();
  await page.getByRole('alertdialog').waitFor();
  assert.equal(reservationRequests, 0);
  await page.getByRole('button', { name: 'Reservar clase', exact: true }).click();
  await page.getByText('Tu clase quedó reservada.', { exact: true }).waitFor();
  assert.equal(reservationRequests, 1);
  await page.reload();
  await page.locator('#reservar').getByText('Reservada', { exact: true }).waitFor();
  await page.locator('.client-month-calendar').getByText(/Clase de prueba/).waitFor();
  assert.equal(await page.getByText('Actividades de muestra mientras preparamos las reservas del mes.').count(), 0);
  await page.getByRole('button', { name: 'Ver horarios', exact: true }).click();
  await page.getByRole('button', { name: /Clase de prueba,/ }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Mobile reservations overflow');
  await page.screenshot({ path: 'outputs/client-panel-active-simulated.png', fullPage: true });
  console.log('PASS (simulated provider): confirmation, reservation, calendar refresh and duplicate prevention');
} finally {
  await browser.close();
}
