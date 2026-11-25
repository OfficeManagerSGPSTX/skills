// Builds the Sea Glass office map (SVG) for page 9 of the pricing deck.
// When an office opens or closes: edit `pins` below, then from this folder run
//   npm install
//   node make-map.js ../assets/img/office-map.svg
// and update the office list and count on page 9 in template/tail.html to match.
const fs = require("fs");
const d3 = require("d3-geo");
const topo = require("topojson-client");

const W = 340, H = 380;
const us = JSON.parse(fs.readFileSync(require.resolve("us-atlas/states-10m.json")));
const world = JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-50m.json")));
const states = topo.feature(us, us.objects.states);
const stateBorders = topo.mesh(us, us.objects.states, (a, b) => a !== b);
const countries = topo.feature(world, world.objects.countries);
// Keep only countries that reach into the frame, so the file stays small.
const inFrame = (f) => { const [[w, s], [e, n]] = d3.geoBounds(f); return e > -104 && w < -58 && n > 12 && s < 50; };
const others = { type: "FeatureCollection", features: countries.features.filter((f) => f.properties.name !== "United States of America" && inFrame(f)) };

// Frame: Rockport, Texas in the west to the Virgin Islands in the east, Maine to St. Croix.
const frame = { type: "MultiPoint", coordinates: [[-98.6, 46.2], [-63.6, 16.6]] };
const proj = d3.geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], frame);
const path = d3.geoPath(proj).digits(1);

// [label, lon, lat, label side]
const pins = [
  ["Rockland, ME", -69.11, 44.10, "r"],
  ["Edgartown, MA", -70.51, 41.39, "r"],
  ["Warwick, RI", -71.42, 41.70, "l"],
  ["Abingdon, Bristol & Marion, VA", -82.19, 36.60, "r"],
  ["Washington, NC", -77.05, 35.55, "r"],
  ["Carolina Beach, NC", -77.89, 34.04, "r"],
  ["South Carolina", -80.08, 32.61, "r"],
  ["Athens, GA", -83.38, 33.96, "l"],
  ["Fernandina Beach, FL", -81.46, 30.67, "r"],
  ["St. Petersburg, FL", -82.64, 27.77, "l"],
  ["Bokeelia, FL", -82.16, 26.71, "l"],
  ["Rockport, TX", -97.05, 28.02, "r"],
];
const vi = [[-64.93, 18.34], [-64.73, 18.33], [-64.70, 17.75]];

const esc = (s) => s.replace(/&/g, "&amp;");
let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
<rect width="${W}" height="${H}" fill="#E8EFF5"/>
<path d="${path(others)}" fill="#D5E0E8" stroke="#FFFFFF" stroke-width="0.6"/>
<path d="${path(states)}" fill="#D5E0E8"/>
<path d="${path(stateBorders)}" fill="none" stroke="#FFFFFF" stroke-width="0.7"/>
<g font-family="Georgia, 'Times New Roman', serif" font-size="7.6" fill="#1D3D5C">
`;
const pin = (x, y, fill) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.6" fill="#FFFFFF" stroke="#0090B4" stroke-width="0.8"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="${fill}"/>\n`;
for (const [label, lon, lat, side] of pins) {
  const [x, y] = proj([lon, lat]);
  out += pin(x, y, "#0090B4");
  const tx = side === "r" ? x + 7 : x - 7;
  out += `<text x="${tx.toFixed(1)}" y="${(y + 2.6).toFixed(1)}" text-anchor="${side === "r" ? "start" : "end"}">${esc(label)}</text>\n`;
}
for (const [lon, lat] of vi) { const [x, y] = proj([lon, lat]); out += pin(x, y, "#003E69"); }
const [vx, vy] = proj([-64.85, 18.34]);
out += `<text x="${(vx - 8).toFixed(1)}" y="${(vy - 14).toFixed(1)}" text-anchor="end" font-weight="bold">U.S. Virgin Islands</text>
<text x="${(vx - 8).toFixed(1)}" y="${(vy - 4).toFixed(1)}" text-anchor="end">St. Thomas · St. John · St. Croix</text>
</g></svg>
`;
fs.writeFileSync(process.argv[2] || "office-map.svg", out);
console.log("wrote", process.argv[2], (out.length / 1024).toFixed(0) + " KB");
