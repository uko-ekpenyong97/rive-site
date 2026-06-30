// build-tokens.mjs
// Reads the design tokens exported from Figma and writes two files your app uses:
//   1) dist/tokens.css            -> CSS variables (the actual colors/sizes the site reads)
//   2) dist/tailwind.tokens.cjs   -> a small Tailwind theme so classes like `bg-surface-default` work
//
// No libraries needed. Run it with:  node build-tokens.mjs
// Edit tokens in FIGMA, re-export to tokens/rive-tokens.json, run this again. That's the loop.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SRC = "tokens/rive-tokens.json";
const OUT_DIR = "dist";

const tokens = JSON.parse(readFileSync(SRC, "utf8"));

// --- helpers ----------------------------------------------------------------

// Turn a token's location (e.g. ["primitive","neutral","1000"]) into a CSS variable
// name (e.g. "--neutral-1000"). We trim the top group so names stay short and stable.
function cssVarName(pathArr) {
  let p = [...pathArr];
  if (p[0] === "primitive") p = p.slice(1);                       // primitive.neutral.0   -> neutral-0
  else if (p[0] === "semantic") p = p.slice(2);                   // semantic.dark.surface.canvas -> surface-canvas
  else if (p[0] === "fontSize") p = ["font-size", ...p.slice(1)]; // fontSize.h1 -> font-size-h1
  else if (p[0] === "font" && p[1] === "family") p = ["font", ...p.slice(2)];        // font.family.display -> font-display
  else if (p[0] === "font" && p[1] === "weight") p = ["font-weight", ...p.slice(2)];
  else if (p[0] === "motion" && p[1] === "duration") p = ["duration", ...p.slice(2)];
  else if (p[0] === "motion" && p[1] === "easing") p = ["ease", ...p.slice(2)];
  return "--" + p.join("-");
}

// An alias like "{primitive.neutral.1000}" becomes "var(--neutral-1000)".
// This is what keeps the Figma idea of "this role POINTS AT that primitive" alive in CSS.
function aliasToVar(value) {
  const path = value.slice(1, -1).split(".");
  return `var(${cssVarName(path)})`;
}

// Format one token's value for CSS.
function formatValue(token) {
  const v = token.$value;
  if (typeof v === "string" && v.startsWith("{")) return aliasToVar(v); // alias -> var(...)
  if (token.$type === "cubicBezier") return `cubic-bezier(${v.join(", ")})`;
  return String(v); // hex, rgba, "8px", "240ms", "Tomorrow, sans-serif", 400, etc.
}

// Visit every leaf token (anything with a $value) and hand it to fn.
function walk(node, path, fn) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    if (child && typeof child === "object" && "$value" in child) fn([...path, key], child);
    else if (child && typeof child === "object") walk(child, [...path, key], fn);
  }
}

// --- collect the CSS variables ----------------------------------------------

const rootLines = [];  // go in :root  -> primitives + the DARK theme (our default)
const lightLines = []; // go in [data-theme="light"] -> only the values that differ in light

walk(tokens, [], (path, token) => {
  const line = `  ${cssVarName(path)}: ${formatValue(token)};`;
  if (path[0] === "semantic" && path[1] === "light") lightLines.push(line);
  else rootLines.push(line); // primitives, dark semantics, radius, space, fonts, motion
});

const css = `/* AUTO-GENERATED from ${SRC}. Don't edit by hand — change tokens in Figma and re-run. */
:root {
${rootLines.join("\n")}
}

[data-theme="light"] {
${lightLines.join("\n")}
}
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/tokens.css`, css);

// --- a small Tailwind theme fragment ----------------------------------------
// Lets you write classes like bg-surface-default / text-accent-default / rounded-md.

const tw = { colors: {}, borderRadius: {}, spacing: {}, fontFamily: {}, fontSize: {} };
walk(tokens, [], (path, token) => {
  const name = cssVarName(path).slice(2); // drop the leading "--"
  if (token.$type === "color") tw.colors[name] = `var(--${name})`;
  else if (path[0] === "radius") tw.borderRadius[name.replace("radius-", "")] = `var(--${name})`;
  else if (path[0] === "space") tw.spacing[name.replace("space-", "")] = `var(--${name})`;
  else if (path[0] === "fontSize") tw.fontSize[name.replace("font-size-", "")] = `var(--${name})`;
  else if (path[0] === "font" && path[1] === "family") tw.fontFamily[path[2]] = [`var(--${name})`];
});

writeFileSync(
  `${OUT_DIR}/tailwind.tokens.cjs`,
  `/* AUTO-GENERATED. In tailwind.config.js do: theme: { extend: require("./dist/tailwind.tokens.cjs") } */\nmodule.exports = ${JSON.stringify(tw, null, 2)};\n`
);

console.log(`✓ Built ${rootLines.length + lightLines.length} CSS variables`);
console.log(`  → ${OUT_DIR}/tokens.css`);
console.log(`  → ${OUT_DIR}/tailwind.tokens.cjs`);
