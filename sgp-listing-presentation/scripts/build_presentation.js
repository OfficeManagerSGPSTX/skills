#!/usr/bin/env node
/*
 * Sea Glass Properties listing presentation builder.
 *
 *   node build_presentation.js spec.json
 *
 * Reads a presentation spec (see references/spec-format.md and
 * references/example-spec.json) and writes a branded, editable .docx to
 * spec.output. Standard Sea Glass copy (Why Sea Glass, marketing plan, global
 * reach, business details) is built in; the spec only has to carry what is
 * specific to this property, these owners and this agent. Any standard block
 * can be overridden from the spec.
 *
 * Requires the `docx` npm package (preinstalled in most Claude sandboxes; if
 * `require('docx')` fails, run `npm install docx` next to this script).
 */
const fs = require("fs");
const path = require("path");
let docx;
try {
  docx = require("docx");
} catch {
  console.error("The docx package is missing. Run: npm install docx");
  process.exit(1);
}
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType,
  AlignmentType, BorderStyle, ShadingType, LevelFormat, Footer, PageNumber, PageBreak,
  VerticalAlign, TableLayoutType,
} = docx;

const SKILL_DIR = path.resolve(__dirname, "..");
const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

// ------------------------------------------------------------ brand tokens
const NAVY = "003B6F", OCEAN = "0094C8", TEAL = "00C2C7", INK = "58595B", MIST = "E7ECEF", WHITE = "FFFFFF";
const SERIF = "Playfair Display", SANS = "Proxima Nova";
const PAGE_W = 12240, MARGIN = 1296, TEXT_W = PAGE_W - 2 * MARGIN; // Letter, 0.9" margins

// Brand copy rules: no em dashes, no exclamation points. Fail loudly rather
// than ship a seller-facing document that breaks them.
(function checkCopy() {
  const text = JSON.stringify(spec);
  const problems = [];
  if (/—/.test(text)) problems.push("an em dash (use a comma, colon or new sentence)");
  if (/!/.test(text)) problems.push("an exclamation point");
  if (problems.length) {
    console.error("Spec copy contains " + problems.join(" and ") + ". Fix the spec and rebuild.");
    process.exit(2);
  }
})();

// ------------------------------------------------------------ primitives
const run = (text, o = {}) => new TextRun({ text, font: o.font || SANS, size: o.size || 21, color: o.color || INK, bold: o.bold, italics: o.italics, characterSpacing: o.spacing });
const p = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 140, line: o.line ?? 300, lineRule: "auto" }, indent: o.indent, keepNext: o.keepNext, numbering: o.numbering });
const body = (text, o = {}) => p(run(text, o), o);
const small = (text, o = {}) => p(run(text, { size: 15, italics: true, ...o }), { before: 80, ...o });
const kicker = (text, color = OCEAN, o = {}) => p(run(text.toUpperCase(), { size: 17, bold: true, color, spacing: 40 }), { after: 60, keepNext: true, ...o });
const tealBar = (o = {}) => new Paragraph({ children: [], keepNext: true, spacing: { before: 0, after: o.after ?? 220 }, indent: { right: TEXT_W - 1260 }, border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: TEAL, space: 1 } } });
const h1 = (text) => [p(run(text, { font: SERIF, size: 36, color: NAVY, bold: true }), { before: 360, after: 80, keepNext: true, line: 260 }), tealBar()];
const h2 = (text) => p(run(text, { font: SERIF, size: 26, color: NAVY, bold: true }), { before: 200, after: 100, keepNext: true });
const bullet = (text) => p(run(text), { numbering: { reference: "bullets", level: 0 }, after: 80 });
const bullets = (list = []) => list.map(bullet);
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

const none = { style: BorderStyle.NONE, size: 0, color: WHITE };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
const hair = { style: BorderStyle.SINGLE, size: 4, color: "D4DCE2" };

function cell(children, width, o = {}) {
  return new TableCell({
    children: Array.isArray(children) ? children : [children],
    width: { size: width, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: o.pad ?? 90, bottom: o.pad ?? 90, left: 120, right: 120 },
    verticalAlign: o.valign || VerticalAlign.CENTER,
    columnSpan: o.span,
    borders: o.borders,
  });
}
const cp = (text, o = {}) => new Paragraph({ children: [run(text, o)], alignment: o.align, spacing: { before: 0, after: 0, line: o.line ?? 260 } });
const table = (cols, rows) => new Table({ width: { size: cols.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: cols, borders: noBorders, layout: TableLayoutType.FIXED, rows });

// Split TEXT_W across columns by relative weights, so specs give proportions.
function widths(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const out = weights.map((w) => Math.floor((w / total) * TEXT_W));
  out[out.length - 1] += TEXT_W - out.reduce((a, b) => a + b, 0);
  return out;
}

// Navy header row, hairline rows. Rows are arrays of strings, { note: "..." }
// for an italic line under the row above, or { group: "..." } for a band.
// The last column (and second-to-last, when there are more than three) is
// right-aligned for figures; boldCol is the name column.
function dataTable(t) {
  const cols = widths(t.columns.map((c) => c.weight ?? 1));
  const n = cols.length;
  const right = (i) => i === n - 1 || (n > 3 && i === n - 2);
  const boldCol = t.boldCol ?? 1;
  const total = TEXT_W;
  const borders = { top: hair, bottom: hair, left: none, right: none };
  const rows = [new TableRow({
    tableHeader: true,
    children: t.columns.map((c, i) => cell(cp(c.label.toUpperCase(), { size: 15, bold: true, color: WHITE, spacing: 20, align: right(i) ? AlignmentType.RIGHT : undefined }), cols[i], { fill: NAVY, pad: 70, borders })),
  })];
  t.rows.forEach((r, idx) => {
    const next = t.rows[idx + 1];
    if (r.note) {
      rows.push(new TableRow({ children: [cell(cp(r.note, { size: 17, italics: true }), total, { span: n, pad: 40, borders: { top: none, bottom: hair, left: none, right: none } })] }));
    } else if (r.group) {
      rows.push(new TableRow({ children: [cell(cp(r.group.toUpperCase(), { size: 15, bold: true, color: NAVY, spacing: 30 }), total, { span: n, fill: MIST, pad: 60, borders })] }));
    } else {
      const noteNext = next && next.note;
      rows.push(new TableRow({
        cantSplit: true,
        children: r.map((v, i) => cell(cp(String(v), { size: 18, bold: i === boldCol, color: i === boldCol ? NAVY : INK, align: right(i) ? AlignmentType.RIGHT : undefined }), cols[i], { pad: 60, borders: { top: hair, bottom: noteNext ? none : hair, left: none, right: none } })),
      }));
    }
  });
  return table(cols, rows);
}

function statRow(stats) {
  const cols = widths(stats.map(() => 1));
  const side = { style: BorderStyle.SINGLE, size: 12, color: WHITE };
  return table(cols, [new TableRow({ children: stats.map((s, i) => cell([
    new Paragraph({ children: [run(s.value, { font: SERIF, size: 40, bold: true, color: NAVY })], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 20 } }),
    new Paragraph({ children: [run(s.label.toUpperCase(), { size: 14, bold: true, spacing: 30 })], alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 } }),
  ], cols[i], { fill: MIST, pad: 120, borders: { top: none, bottom: none, left: side, right: side } })) })]);
}

function image(file, w, h) {
  const full = path.isAbsolute(file) ? file : path.join(SKILL_DIR, file);
  if (!fs.existsSync(full)) return null;
  const ext = path.extname(full).slice(1).toLowerCase().replace("jpeg", "jpg");
  return new ImageRun({ data: fs.readFileSync(full), transformation: { width: w, height: h }, type: ext });
}

// ------------------------------------------------------------ standard copy
const STD = {
  whySeaGlass: [
    "Current technology for photography, floor plans and online exposure",
    "Marketing reach on St. Croix, across the USVI and internationally",
    "A collaborative team that works every listing together",
    "Personal, lasting client relationships",
  ],
  // Professional photography with twilight/night images and drone work is part
  // of every Sea Glass listing, so it always leads the marketing plan.
  marketing: [
    "MLS exposure on St. Croix and St. Thomas, feeding Realtor.com and Zillow",
    "Professional photography, including twilight and night images",
    "Drone photography and video of the property and its setting",
    "Targeted print advertising: a Houses Magazine cover if available, or a full-page ad",
    "Exclusive Giraffe technology for HDR photography, floor plans and immersive layouts, the only one on island",
    "A dedicated property website hosted by Sea Glass, and a QR brochure",
    "Rotated exposure across Sea Glass social channels and an 11,000+ subscriber e-blast",
    "I, or a colleague, will open and close the property for every showing, present its features and upgrades, and gather feedback from buyers' agents",
    "Market updates sent to you every two weeks",
  ],
  events: [
    "An open house for local Realtors®, with food and giveaways to build turnout",
    "Weekly Sea Glass team meetings where your property is featured. Many sales start here.",
    "Social media on Instagram, Facebook, LinkedIn and YouTube",
    "A video walkthrough of the property",
  ],
  globalIntro: "Through our exclusive affiliation with Leading Real Estate Companies of the World® and membership in Luxury Portfolio International®, your property reaches buyers in 800+ cities while represented by a boutique brand. Your listing will also appear on:",
  globalSites: ["Mansion Global", "Luxury Portfolio", "Wall Street Journal Real Estate", "JamesEdition", "Juwai", "Financial Times Real Estate", "St. Croix Source"],
  compensation: "6% of the sale price, split between the listing agency and the selling agency. This is always negotiable. Following the 2024 class action settlement involving NAR, some sellers choose not to pay buyer brokerage. That is your choice, and we can discuss it as we agree on a list price.",
  companyStats: {
    kicker: "Sea Glass Properties St. Croix, 2025",
    stats: [
      { value: "113", label: "Sides closed" },
      { value: "$20.3M", label: "Sales volume" },
      { value: "No. 3", label: "USVI market share, closed sides" },
    ],
  },
  office: {
    phone: "340.715.7772",
    address: "56 & 56A King Street, Christiansted, VI 00820",
    licence: "U.S. Virgin Islands brokerage licence 2-54608-2B",
  },
  disclaimer: "Sea Glass Properties is a member of Luxury Portfolio International® and Leading Real Estate Companies of the World®. Comparable sales are closed MLS sales and are offered as an opinion of value, not an appraisal.",
};
const pick = (key) => (spec.overrides && spec.overrides[key] !== undefined ? spec.overrides[key] : STD[key]);

// ------------------------------------------------------------ sections
const A = spec.agent;
const firstName = A.name.split(" ")[0];
const office = pick("office");

function cover() {
  const out = [];
  const logo = image("assets/logos/seaglass-horizontal-color.png", 236, 36);
  if (logo) out.push(p(logo, { after: 600 }));
  out.push(
    kicker("Listing Presentation", OCEAN, { after: 120 }),
    p(run(spec.property.title, { font: SERIF, size: 72, color: NAVY, bold: true }), { after: 60, line: 240 }),
    p(run(spec.property.locality, { size: 24 }), { after: 200 }),
    tealBar({ after: 360 }),
    p(run("Prepared for " + spec.preparedFor, { size: 22 }), { after: 600 }),
  );
  const pr = spec.pricing;
  out.push(table([TEXT_W], [new TableRow({ children: [cell([
    new Paragraph({ children: [run(pr.coverLabel || "RECOMMENDED LIST PRICE", { size: 17, bold: true, color: TEAL, spacing: 50 })], spacing: { before: 120, after: 60 }, indent: { left: 240 } }),
    new Paragraph({ children: [run(pr.price, { font: SERIF, size: 64, bold: true, color: WHITE })], spacing: { before: 0, after: 60 }, indent: { left: 240 } }),
    ...(pr.coverNote ? [new Paragraph({ children: [run(pr.coverNote, { size: 19, color: "CCD8E2" })], spacing: { before: 0, after: 140 }, indent: { left: 240 } })] : []),
  ], TEXT_W, { fill: NAVY, pad: 120 })] })]));
  out.push(p([], { after: 600 }));
  const head = A.headshot ? image(path.isAbsolute(A.headshot) ? A.headshot : path.join("assets/headshots", A.headshot), 84, 84) : null;
  const lines = [
    cp("PRESENTED BY", { size: 15, bold: true, color: OCEAN, spacing: 40 }),
    new Paragraph({ children: [run(A.name, { font: SERIF, size: 30, bold: true, color: NAVY })], spacing: { before: 40, after: 20 } }),
    cp(`${A.title || "Realtor®"}, Sea Glass Properties`, { size: 19 }),
    cp([A.cell, A.email].filter(Boolean).join("  ·  "), { size: 19 }),
    cp(spec.date, { size: 19 }),
  ];
  out.push(head
    ? table([1500, TEXT_W - 1500], [new TableRow({ children: [cell(new Paragraph({ children: [head] }), 1500, { pad: 0 }), cell(lines, TEXT_W - 1500, { pad: 0 })] })])
    : table([TEXT_W], [new TableRow({ children: [cell(lines, TEXT_W, { pad: 0 })] })]));
  out.push(pageBreak());
  return out;
}

function intro() {
  const cs = pick("companyStats");
  const out = [
    ...h1("Thank You"),
    body(spec.thankYou || `Thank you for considering me and Sea Glass Properties to list, market and sell ${spec.property.title}. When buyers search for real estate on St. Croix, Sea Glass is consistently at the top. We lead the market with technology others try to match, paired with attentive service and lasting relationships with our buyers and sellers.`),
  ];
  if (cs) out.push(h2("Our Results"), kicker(cs.kicker, INK, { after: 120 }), statRow(cs.stats));
  const ag = spec.agentProfile;
  if (ag) {
    out.push(h2(`Why ${firstName}`));
    if (ag.stats && ag.stats.length) out.push(kicker(ag.statsKicker || `${A.name}, St. Croix closings`, INK, { after: 120 }), statRow(ag.stats), p([], { after: 100 }));
    for (const para of ag.paragraphs || []) out.push(body(para));
    if (ag.notable && ag.notable.length) {
      out.push(kicker(ag.notableHeading || "Notable listings sold", OCEAN, { before: 80, after: 80 }));
      out.push(dataTable({ columns: [{ label: "Property", weight: 3 }, { label: "Quarter", weight: 1.5 }, { label: "Sold Price", weight: 4.5 }], rows: ag.notable, boldCol: 0 }));
    }
    if (ag.source) out.push(small("Source: " + ag.source, { before: 100 }));
  }
  out.push(h2("Why Sea Glass"), body("All Realtors® start on equal footing. What sets us apart:", { keepNext: true }), ...bullets(pick("whySeaGlass")));
  return out;
}


// Pixel size of a JPEG or PNG, so photos keep their shape.
function imageSize(file) {
  const full = path.isAbsolute(file) ? file : path.join(SKILL_DIR, file);
  const b = fs.readFileSync(full);
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  throw new Error("Cannot read image size: " + file);
}

// Property photos: the first runs full width, the rest sit in pairs at a shared height.
function photos(list = []) {
  if (!list.length) return [];
  const FULL = Math.floor(TEXT_W / 15) - 4, GAP = 10, out = [];
  const caption = (t) => (t ? [p(run(t, { size: 15, italics: true, color: "5A6B78" }), { before: 40, after: 160 })] : []);
  const [hero, ...rest] = list;
  const hs = imageSize(hero.file);
  out.push(p(image(hero.file, FULL, Math.round((FULL * hs.h) / hs.w)), { after: 0, keepNext: !!hero.caption }), ...caption(hero.caption));
  for (let k = 0; k < rest.length; k += 2) {
    const pair = rest.slice(k, k + 2).map((ph) => ({ ...ph, s: imageSize(ph.file) }));
    const ratioSum = pair.reduce((a, ph) => a + ph.s.w / ph.s.h, 0);
    const h = Math.min(300, Math.floor((FULL - GAP * (pair.length - 1)) / ratioSum));
    const cells = pair.map((ph) => {
      const w = Math.round((h * ph.s.w) / ph.s.h);
      return cell([p(image(ph.file, w, h), { after: 0 }), ...caption(ph.caption)], (w + GAP) * 15, { pad: 0, borders: noBorders, valign: VerticalAlign.TOP });
    });
    out.push(new Table({ rows: [new TableRow({ children: cells, cantSplit: true })], width: { size: cells.length ? pair.reduce((a, ph) => a + (Math.round((h * ph.s.w) / ph.s.h) + GAP) * 15, 0) : 0, type: WidthType.DXA }, borders: noBorders }));
    out.push(p([], { after: 120 }));
  }
  return out;
}

function propertySection() {
  const ps = spec.propertySection;
  const out = [...h1("Your Property")];
  if (ps.intro) out.push(body(ps.intro));
  out.push(...photos(ps.photos));
  for (const g of ps.groups || []) out.push(h2(g.heading), ...(g.paragraphs || []).map((t) => body(t, { keepNext: !!(g.bullets && g.bullets.length) })), ...bullets(g.bullets));
  if (ps.footnote) out.push(small(ps.footnote, { size: 17 }));
  return out;
}

function market() {
  const m = spec.market;
  const out = [...h1("Market Overview")];
  if (m.intro) out.push(body(m.intro));
  m.tables.forEach((t, i) => {
    out.push(h2(t.heading));
    if (t.intro) out.push(body(t.intro, { keepNext: true }));
    out.push(dataTable(t));
    if (t.footnote) out.push(small(t.footnote));
    if (i < m.tables.length - 1) out.push(p([], { after: 120 }));
  });
  return out;
}

function pricing() {
  const pr = spec.pricing;
  const out = [pageBreak(), ...h1("Pricing Recommendation")];
  if (pr.intro) out.push(body(pr.intro, { keepNext: true }));
  const cols = [Math.round(TEXT_W * 0.71), TEXT_W - Math.round(TEXT_W * 0.71)];
  const row = (r) => {
    const style = r.style || "line"; // line | subtotal | total
    const light = style === "total";
    const fill = style === "total" ? NAVY : style === "subtotal" ? MIST : undefined;
    const bd = { top: hair, bottom: hair, left: none, right: none };
    return new TableRow({ cantSplit: true, children: [
      cell([cp(r.label, { size: 20, bold: true, color: light ? WHITE : NAVY }), ...(r.detail ? [new Paragraph({ children: [run(r.detail, { size: 17, color: light ? "CCD8E2" : INK })], spacing: { before: 40, after: 0, line: 250 } })] : [])], cols[0], { fill, pad: 110, borders: bd }),
      cell(cp(r.amount, { font: SERIF, size: style === "total" ? 30 : 24, bold: true, color: light ? WHITE : NAVY, align: AlignmentType.RIGHT }), cols[1], { fill, pad: 110, borders: bd }),
    ] });
  };
  if (pr.buildUp && pr.buildUp.length) out.push(table(cols, pr.buildUp.map(row)), p([], { after: 80 }));
  for (const t of pr.after || []) out.push(body(t));
  out.push(body(pr.closing || "If you work with me, I will be dedicated to your success and keep a detailed knowledge of your property. Final pricing is always your decision. I am here to advise and plan the strategy with you."));
  return out;
}

function value() {
  const v = spec.value;
  if (!v) return [];
  const out = [...h1("Value Considerations")];
  out.push(body(v.intro || "Some of the property's strongest features do not show up fully in standard comp data:", { keepNext: true }), ...bullets(v.bullets));
  if (v.buyerBullets && v.buyerBullets.length) out.push(body(v.buyerIntro || "A future buyer may also consider:", { keepNext: true }), ...bullets(v.buyerBullets));
  return out;
}

function prep() {
  const pm = spec.preparingForMarket;
  if (!pm || !pm.groups || !pm.groups.length) return [];
  const out = [...h1("Preparing for Market")];
  for (const g of pm.groups) out.push(h2(g.heading), ...(g.paragraphs || []).map((t) => body(t, { keepNext: !!(g.bullets && g.bullets.length) })), ...bullets(g.bullets));
  return out;
}

function plan() {
  const extra = spec.marketingExtras || {};
  return [
    ...h1("What I Will Do for You"),
    h2("Marketing and Exposure"), ...bullets([...pick("marketing"), ...(extra.marketing || [])]),
    h2("Events and Outreach"), ...bullets([...pick("events"), ...(extra.events || [])]),
    h2("Our Global Reach"), body(pick("globalIntro"), { keepNext: true }), ...bullets(pick("globalSites")),
  ];
}

function business() {
  const out = [...h1("Business Details"), h2("Compensation for Services"), body(pick("compensation"))];
  if (spec.stampTax) out.push(h2("Stamp Tax"), body(spec.stampTax));
  out.push(
    ...h1("In Summary"),
    body(spec.summary || `With Sea Glass Properties, you get current technology, global reach, team collaboration and proven results. I would be honoured to represent you and to show you how I will deliver for ${spec.property.title}.`),
    p([], { after: 240 }),
    p(run(A.name, { font: SERIF, size: 30, bold: true, color: NAVY }), { after: 20 }),
    body([A.title || "Realtor®", A.team, "Sea Glass Properties"].filter(Boolean).join(", "), { after: 20 }),
    body([A.cell && "Cell " + A.cell, office.phone && "Office " + office.phone, A.email].filter(Boolean).join("  ·  "), { after: 20 }),
    body([office.address, office.licence].filter(Boolean).join("  ·  "), { after: 400 }),
  );
  const lpi = image("assets/logos/luxury-portfolio-color.png", 150, 45);
  if (lpi) out.push(p(lpi, { after: 160 }));
  out.push(p(run(pick("disclaimer"), { size: 15 })));
  return out;
}

// ------------------------------------------------------------ document
const footer = new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [
    run(`SEA GLASS PROPERTIES  ·  ${spec.property.title.toUpperCase()} LISTING PRESENTATION  ·  `, { size: 14, color: "8795A1", spacing: 30 }),
    new TextRun({ children: [PageNumber.CURRENT], font: SANS, size: 14, color: "8795A1" }),
  ],
})] });

const doc = new Document({
  creator: "Sea Glass Properties",
  title: `${spec.property.title} Listing Presentation`,
  styles: { default: { document: { run: { font: SANS, size: 21, color: INK } } } },
  numbering: { config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "▪", alignment: AlignmentType.LEFT, style: { run: { color: TEAL }, paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 15840 }, margin: { top: 1152, bottom: 1152, left: MARGIN, right: MARGIN } }, titlePage: true },
    footers: { default: footer, first: new Footer({ children: [] }) },
    children: [...cover(), ...intro(), ...propertySection(), ...market(), ...pricing(), ...value(), ...prep(), ...plan(), ...business()],
  }],
});

Packer.toBuffer(doc).then((b) => {
  fs.mkdirSync(path.dirname(path.resolve(spec.output)), { recursive: true });
  fs.writeFileSync(spec.output, b);
  console.log("Wrote " + spec.output);
});
