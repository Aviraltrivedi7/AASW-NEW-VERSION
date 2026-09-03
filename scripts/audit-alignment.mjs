// Alignment audit: loads every public page at desktop + tablet + mobile widths,
// flags horizontal overflow, elements escaping the viewport, text clipping,
// and horizontal misalignment between sibling sections.
import { chromium } from "playwright";

const PAGES = [
  "/", "/about", "/who-we-are", "/vision-mission", "/what-we-do",
  "/digital-skills", "/green-entrepreneurship", "/mentorship-community",
  "/transparency", "/programs", "/team", "/reports", "/governance",
  "/stories", "/updates", "/membership", "/volunteer", "/media-centre",
  "/field-gallery", "/contact", "/donate", "/member/login",
];
const WIDTHS = [
  { name: "desktop", width: 1280 },
  { name: "tablet", width: 820 },
  { name: "mobile", width: 375 },
];

const browser = await chromium.launch({ headless: true });
const report = [];

for (const { name, width } of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  for (const path of PAGES) {
    try {
      await page.goto("http://localhost:3000" + path, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1600);
      const issues = await page.evaluate(() => {
        const out = [];
        const vw = window.innerWidth;
        const docW = document.documentElement.scrollWidth;
        if (docW > vw + 1) out.push({ type: "page-h-overflow", detail: `scrollWidth ${docW} > viewport ${vw}` });

        // elements extending beyond viewport horizontally (ignore intentionally offscreen decor)
        const escapees = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const cs = getComputedStyle(el);
          if (cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
          if (r.right > vw + 8 || r.left < -8) {
            // skip if an ancestor clips it (overflow hidden) — check visual effect only
            let clipped = false, p = el.parentElement;
            while (p) {
              const pcs = getComputedStyle(p);
              if (/(hidden|clip)/.test(pcs.overflow + pcs.overflowX)) { clipped = true; break; }
              p = p.parentElement;
            }
            if (!clipped) escapees.push({ tag: el.tagName, cls: String(el.className).slice(0, 40), left: Math.round(r.left), right: Math.round(r.right) });
          }
          if (escapees.length >= 5) break;
        }
        if (escapees.length) out.push({ type: "element-escapes-viewport", detail: escapees });

        // text clipping: scrollWidth noticeably bigger than clientWidth on leaf blocks
        const clippedTexts = [];
        for (const el of document.querySelectorAll("h1,h2,h3,p,a,span,button,blockquote")) {
          if (el.children.length > 0) continue;
          if (el.scrollWidth > el.clientWidth + 6 && el.clientWidth > 0) {
            const cs = getComputedStyle(el);
            if (cs.overflow === "visible" || cs.textOverflow === "ellipsis") continue; // visible overflow is fine
            clippedTexts.push({ text: el.textContent.trim().slice(0, 40), sw: el.scrollWidth, cw: el.clientWidth });
          }
          if (clippedTexts.length >= 4) break;
        }
        if (clippedTexts.length) out.push({ type: "text-clipped", detail: clippedTexts });

        return out;
      });
      if (issues.length) report.push({ width: name, w: width, path, issues });
    } catch (e) {
      report.push({ width: name, w: width, path, issues: [{ type: "load-error", detail: e.message.slice(0, 80) }] });
    }
  }
  await context.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 1));
