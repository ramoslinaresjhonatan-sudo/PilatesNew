/** Read-only browser smoke test. Uses real API data; never seeds or changes data. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const baseUrl = process.env.LANDING_TEST_URL || 'http://localhost:5173';
const outputDirectory = fileURLToPath(new URL('../../output/landing-redesign/', import.meta.url));
const widths = [1440, 1024, 768, 390];
const anchors = ['inicio', 'experiencia', 'horarios', 'membresias', 'comunidad', 'contacto'];
const report = { baseUrl, dataSource: 'real API (no fixtures)', generatedAt: new Date().toISOString(), pages: [] };
await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: process.env.LANDING_TEST_BROWSER || 'chrome' });

async function inspectPage(width, reducedMotion = false) {
  const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const result = { width, reducedMotion, api: [], pageErrors: [], checks: [], imageErrors: [] };
  const check = (name, passed, details = '') => result.checks.push({ name, passed: Boolean(passed), details });
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.includes('/api/') && !url.pathname.includes('/imagen/')) result.api.push({ path: url.pathname, status: response.status() });
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.pathname.includes('/api/') && !url.pathname.includes('/imagen/')) result.api.push({ path: url.pathname, error: request.failure()?.errorText });
  });
  const resourceResponses = ['actividad', 'plan-membresia', 'coach', 'landing/seccion/publicadas', 'agenda'].map(resource => page.waitForResponse(response => new URL(response.url()).pathname.endsWith(`/api/v1/${resource}`), { timeout: 30_000 }).catch(() => null));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.locator('#membresias').waitFor({ timeout: 20_000 });
  await Promise.all(resourceResponses);
  await page.waitForTimeout(2200);
  const heading = await page.locator('h1').allTextContents();
  check('One descriptive h1', heading.length === 1 && heading[0].trim().length > 8, heading);
  for (const id of anchors) check(`Anchor #${id}`, await page.locator(`#${id}`).count() === 1);

  const menu = page.locator('.landing-header__menu-button');
  if (await menu.isVisible()) {
    await menu.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    check('Mobile menu opens using Enter', await menu.getAttribute('aria-expanded') === 'true');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    check('Escape closes menu and returns focus', await menu.getAttribute('aria-expanded') === 'false' && await menu.evaluate(element => element === document.activeElement));
  }

  // Scroll as a visitor would: jumping between tall sections can skip reveals.
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let top = 0; top < pageHeight; top += 650) {
    await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), top);
    await page.waitForTimeout(reducedMotion ? 100 : 160);
  }
  await page.waitForTimeout(1500);
  await page.locator('#membresias').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const registrationLinks = await page.locator('#membresias a[href^="/afiliacion/"]').evaluateAll(elements => elements.map(element => element.getAttribute('href')));
  check('Membership CTAs preserve plan affiliation URLs', registrationLinks.length > 0 && registrationLinks.every(href => /^\/afiliacion\/[^/]+$/.test(href)), registrationLinks);
  const loginLinks = await page.locator('main a[href="/login"]').count();
  check('Reservation CTA points to login', loginLinks > 0, loginLinks);

  const toggles = page.locator('#membresias button[aria-controls][aria-expanded]').filter({ hasNot: page.locator('img') });
  let testedToggle = false;
  for (const toggle of await toggles.all()) {
    if (!(await toggle.isVisible()) || await toggle.getAttribute('tabindex') === '-1') continue;
    const detailsId = await toggle.getAttribute('aria-controls');
    const details = page.locator(`[id="${detailsId}"]`);
    if (!await details.count()) continue;
    await toggle.scrollIntoViewIfNeeded();
    const initial = await toggle.getAttribute('aria-expanded');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(850);
    check('Membership details expand via keyboard', initial === 'false' && await toggle.getAttribute('aria-expanded') === 'true' && await details.getAttribute('aria-hidden') !== 'true');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(850);
    check('Membership details collapse and hide content', await toggle.getAttribute('aria-expanded') === 'false' && (await details.getAttribute('aria-hidden') === 'true' || await details.evaluate(element => element.inert || element.hidden)));
    testedToggle = true;
    break;
  }
  check('Membership disclosure exists', testedToggle);

  const targets = await page.locator('.content-carousel__control').evaluateAll(elements => elements.flatMap(element => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    return [{ label: element.getAttribute('aria-label'), width: rect.width, height: rect.height }];
  }));
  check('Carousel controls are at least 44 × 44 px', targets.every(target => target.width >= 44 && target.height >= 44), targets);
  const overflow = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('body *')].filter(element => {
    if (element.closest('.content-carousel__track')) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && (rect.right > innerWidth + 2 || rect.left < -2) && getComputedStyle(element).position !== 'fixed';
  }).slice(0, 12).map(element => `${element.tagName.toLowerCase()}.${element.className}`) }));
  check('No document horizontal overflow', overflow.documentWidth <= overflow.viewport + 1, overflow);
  result.imageErrors = await page.locator('img').evaluateAll(elements => elements.filter(element => element.complete && element.naturalWidth === 0).map(element => ({ alt: element.alt, path: element.getAttribute('src')?.split('?')[0] })));
  check('Loaded images do not fail', result.imageErrors.length === 0, result.imageErrors);
  check('No browser JavaScript errors', result.pageErrors.length === 0, result.pageErrors);
  if (reducedMotion) {
    const motion = await page.evaluate(() => ({ reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, ongoingAnimations: document.getAnimations().filter(animation => animation.playState === 'running').length, scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior }));
    check('Reduced-motion preference honored', motion.reduced && motion.ongoingAnimations === 0 && motion.scrollBehavior !== 'smooth', motion);
  }
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(reducedMotion ? 100 : 800);
  await page.screenshot({ path: path.join(outputDirectory, `hero-${width}${reducedMotion ? '-reduced-motion' : ''}-real-api.png`), animations: 'disabled' });
  await page.screenshot({ path: path.join(outputDirectory, `landing-${width}${reducedMotion ? '-reduced-motion' : ''}-real-api.png`), fullPage: true, animations: 'disabled', timeout: 45_000 });
  report.pages.push(result);
  console.log(JSON.stringify({ width, reducedMotion, failures: result.checks.filter(item => !item.passed), api: result.api }, null, 2));
  await context.close();
}

try {
  for (const width of widths) await inspectPage(width);
  await inspectPage(390, true);
} finally {
  await browser.close();
  await writeFile(path.join(outputDirectory, 'smoke-report.json'), `${JSON.stringify(report, null, 2)}\n`);
}
const failures = report.pages.flatMap(page => page.checks.filter(check => !check.passed));
console.log(`Landing smoke: ${report.pages.length} viewports/modes, ${failures.length} failed checks. Artifacts: ${outputDirectory}`);
if (failures.length) process.exitCode = 1;
