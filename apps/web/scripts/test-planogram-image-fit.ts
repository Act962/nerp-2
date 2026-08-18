import { fitImageToFacing } from "@/features/planogram/engine/image-fit";

let pass = 0;
let fail = 0;

function check(name: string, got: unknown, want: unknown) {
  const isOk = JSON.stringify(got) === JSON.stringify(want);
  console.log(
    `${isOk ? "  ok " : "  XX "} ${name}${
      isOk
        ? ""
        : ` obtido=${JSON.stringify(got)} esperado=${JSON.stringify(want)}`
    }`,
  );
  isOk ? pass++ : fail++;
}

const round = (fit: ReturnType<typeof fitImageToFacing>) => ({
  w: Math.round(fit.drawWidthMm * 10) / 10,
  h: Math.round(fit.drawHeightMm * 10) / 10,
  x: Math.round(fit.offsetXMm * 10) / 10,
});

console.log("— foto mais 'larga' que a embalagem: trava na largura —");
// Frasco 90x250mm, foto 800x900px (razao 0,889 contra 0,36 da caixa).
const wide = round(fitImageToFacing(90, 250, 800, 900));
check("preenche a largura", wide.w, 90);
check("altura pela razao do bitmap", wide.h, 101.3);
check("sem deslocamento horizontal", wide.x, 0);
check("nao estoura a caixa", wide.h <= 250, true);

console.log("\n— foto mais 'alta' que a embalagem: trava na altura —");
// Mesma caixa, foto 200x900px (razao 0,222).
const tall = round(fitImageToFacing(90, 250, 200, 900));
check("preenche a altura", tall.h, 250);
check("largura pela razao do bitmap", tall.w, 55.6);
check("centrada na largura", tall.x, 17.2);
check("nao estoura a largura", tall.w <= 90, true);

console.log("\n— foto quadrada em caixa quadrada: preenche exato —");
const square = round(fitImageToFacing(100, 100, 500, 500));
check("preenche os dois eixos", [square.w, square.h], [100, 100]);
check("sem deslocamento", square.x, 0);

console.log("\n— proporcao preservada em todos os casos —");
for (const [boxW, boxH, imgW, imgH] of [
  [90, 250, 800, 900],
  [90, 250, 200, 900],
  [100, 100, 500, 500],
  [1300, 400, 64, 1024],
] as const) {
  const fit = fitImageToFacing(boxW, boxH, imgW, imgH);
  const drift = Math.abs(fit.drawWidthMm / fit.drawHeightMm - imgW / imgH);
  check(`razao mantida em ${imgW}x${imgH}`, drift < 1e-9, true);
}

console.log("\n— dimensao de imagem invalida cai no preenchimento total —");
for (const [label, imgW, imgH] of [
  ["zero", 0, 0],
  ["largura zero", 0, 900],
  ["altura zero", 800, 0],
  ["negativa", -800, 900],
  ["NaN", Number.NaN, 900],
  ["infinita", Number.POSITIVE_INFINITY, 900],
] as const) {
  const fit = round(fitImageToFacing(90, 250, imgW, imgH));
  check(`${label} preenche a caixa`, [fit.w, fit.h, fit.x], [90, 250, 0]);
}

console.log("\n— caso degenerado de 1px —");
const tiny = round(fitImageToFacing(90, 250, 1, 1));
check("1x1 vira quadrado centrado", [tiny.w, tiny.h, tiny.x], [90, 90, 0]);

console.log(
  `\n${fail === 0 ? "TODOS PASSARAM" : "FALHAS"}: ${pass} ok, ${fail} falhas`,
);
process.exit(fail === 0 ? 0 : 1);
