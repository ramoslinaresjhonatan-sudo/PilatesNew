import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// All API calls are intercepted: this smoke check never edits the real site.
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const failures = [];
  page.on('console', message => { if (message.type() === 'error') console.log('Browser:', message.text().slice(0, 600)); });
  page.on('pageerror', error => failures.push(error.message));
  const sections = [{ id: 'hero', clave: 'HERO_TEXTO', titulo: 'Portada de prueba', subtitulo: 'Subtítulo', descripcion: 'Descubrir | Reservar', orden: 0, estado: 'ACTIVO', fecha_actualizacion: '2026-09-20T12:00:00Z', imagenes: [] }];
  let published = 0;
  await page.addInitScript(() => sessionStorage.setItem('pilates_house_session', JSON.stringify({ token: 'mock-editor-test', expiresAt: '2099-01-01T00:00:00Z', user: { id: 'test-editor', nombre: 'Editor', correo: 'editor@example.test', roles: ['ADMINISTRADOR'], permisos: [] } })));
  await page.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/landing/editor/bloque')) {
      const input = route.request().postDataJSON();
      assert.equal(input.clave, 'HERO_TEXTO');
      sections[0] = { ...sections[0], titulo: input.titulo }; published++;
      return route.fulfill({ json: { message: 'Publicado' } });
    }
    if (url.pathname.includes('/landing/seccion')) return route.fulfill({ json: sections });
    if (url.pathname.endsWith('/perfil')) return route.fulfill({ json: { usuario: { nombre: 'Editor', correo: 'editor@example.test' }, roles: ['ADMINISTRADOR'], permisos: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto('http://localhost:5173/panel/gestion/galeria/web');
  try { await page.getByRole('heading', { name: 'Editor de página principal', exact: true }).waitFor(); }
  catch (error) { console.log('URL:', page.url(), 'Errors:', failures, 'Page:', (await page.locator('body').innerText()).slice(0, 2000)); throw error; }
  await page.getByRole('button', { name: '✎ Editar portada', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Título', { exact: true }).fill('Cambios descartables');
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Descartar cambios', exact: true }).click();
  assert.equal(published, 0);
  await page.getByRole('button', { name: '✎ Editar portada', exact: true }).click();
  assert.equal(await dialog.getByLabel('Título', { exact: true }).inputValue(), 'Portada de prueba');
  await dialog.getByLabel('Título', { exact: true }).fill('Nueva portada publicada');
  await dialog.getByRole('button', { name: 'Publicar cambios', exact: true }).click();
  await page.getByText('Publicado', { exact: true }).waitFor();
  assert.equal(published, 1);
  const preview = page.frameLocator('iframe');
  await preview.locator('.landing-hero__subtitle').filter({ hasText: 'Nueva portada publicada' }).waitFor();
  await page.getByRole('button', { name: 'Móvil', exact: true }).click();
  await page.locator('iframe.is-mobile').waitFor();
  await page.frameLocator('iframe').locator('.landing-hero__subtitle').filter({ hasText: 'Nueva portada publicada' }).waitFor();
  assert.equal(await page.locator('iframe').evaluate(element => element.clientWidth), 390);
  await page.getByRole('button', { name: '✎ Editar portada', exact: true }).click();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.closest('[role=dialog]') !== null), true);
  await page.keyboard.press('Escape');
  await page.frameLocator('iframe').locator('.landing-hero__configured-image, .landing-hero__media img').first().evaluate(async image => { if (!image.complete) await new Promise(resolve => { image.onload = resolve; image.onerror = resolve; }); });
  await mkdir('.playwright-cli', { recursive: true });
  await page.screenshot({ path: '.playwright-cli/home-editor-check.png', fullPage: true });
  assert.deepEqual(failures, []);
  console.log('PASS: cancelar, publicar, landing sincronizada, móvil y foco del modal. APIs simuladas.');
} finally { await browser.close(); }
