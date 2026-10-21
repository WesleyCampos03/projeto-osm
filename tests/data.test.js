import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  parseCsv,
  parseSpreadsheet,
  toCsv,
  validateRows,
  summarize,
  groupChartRows,
  exampleRows,
} from "../src/data.js";

test("the workshop example gives consistent financial and sales results", () => {
  const result = summarize(
    exampleRows.filter((row) => row.date.startsWith("2026-10")),
  );
  assert.deepEqual(result, {
    income: 9200,
    expense: 3850,
    balance: 5350,
    count: 3,
    ticket: 9200 / 3,
  });
  assert.equal(summarize([]).ticket, 0);
});
test("expense categories include Marketing and respect the selected period", () => {
  const all = groupChartRows(exampleRows, "category");
  assert.deepEqual(
    all.find((group) => group.key === "Marketing"),
    { key: "Marketing", income: 0, expense: 2750 },
  );
  const october = groupChartRows(
    exampleRows.filter((row) => row.date.startsWith("2026-10")),
    "category",
  );
  assert.equal(october.find((group) => group.key === "Marketing").expense, 850);
  assert.equal(
    groupChartRows(exampleRows, "category", true).some(
      (group) => group.key === "Marketing",
    ),
    false,
  );
  assert.equal(
    all.reduce((sum, group) => sum + group.expense, 0),
    summarize(exampleRows).expense,
  );
});
test("Brazilian currency and quoted multiline descriptions import correctly", () => {
  const rows = parseCsv(
    'data;descrição;categoria;tipo;valor\r\n2026-10-01;"Venda; especial\ncom ""aspas""";Produtos;receita;1.250,50',
  );
  assert.equal(rows[0].amount, 1250.5);
  assert.equal(rows[0].description, 'Venda; especial\ncom "aspas"');
});
test("exported records can be imported without changing amounts or categories", () => {
  const actual = parseCsv("\ufeff" + toCsv(exampleRows));
  assert.deepEqual(
    actual.map(({ id, ...row }) => row),
    exampleRows.map(({ id, ...row }) => row),
  );
});
test("comma delimited files support decimal points and quoted commas", () => {
  const rows = parseCsv(
    'data,descricao,categoria,tipo,valor\n2026-10-01,"Venda, cliente A",Produtos,receita,12.50',
  );
  assert.equal(rows[0].amount, 12.5);
  assert.equal(rows[0].description, "Venda, cliente A");
});
test("XLSX selects the first sheet with the required columns", async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["outra", "aba"], ["x", "y"]]),
    "Resumo",
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["data", "descrição", "categoria", "tipo", "valor"],
      ["31/12/2026", "Venda", "Produtos", "receita", 125.5],
    ]),
    "Dados",
  );
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const rows = await parseSpreadsheet({ size: buffer.length, arrayBuffer: async () => buffer });
  assert.equal(rows[0].date, "2026-12-31");
  assert.equal(rows[0].description, "Venda");
  assert.equal(rows[0].amount, 125.5);
});

test("XLSX rejects duplicate headers", async () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["data", "descricao", "categoria", "tipo", "valor", "valor"],
    ["2026-12-31", "Venda", "Produtos", "receita", 10, 20],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Dados");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  await assert.rejects(() =>
    parseSpreadsheet({ size: buffer.length, arrayBuffer: async () => buffer }),
  );
});

test("Brazilian dates are normalized and validated", () => {
  const rows = parseCsv(
    "data;descricao;categoria;tipo;valor\n31/12/2026;Venda;Produtos;receita;10,50",
  );
  assert.equal(rows[0].date, "2026-12-31");
  assert.throws(() =>
    parseCsv(
      "data;descricao;categoria;tipo;valor\n31/02/2026;Venda;Produtos;receita;10,50",
    ),
  );
});

test("invalid data is rejected before replacing current records", () => {
  const valid = { ...exampleRows[0] };
  for (const patch of [
    { date: "2026-02-30" },
    { amount: 0 },
    { amount: -1 },
    { amount: 1.234 },
    { amount: Infinity },
    { type: "outro" },
    { category: " " },
  ]) {
    assert.throws(() => validateRows([{ ...valid, ...patch }]));
  }
  assert.throws(() => validateRows([valid, valid]));
  assert.throws(() =>
    parseCsv(
      "data;descricao;categoria;tipo;valor\n2026-10-01;Venda;Produtos;receita;",
    ),
  );
  assert.throws(() =>
    parseCsv(
      'data;descricao;categoria;tipo;valor\n2026-10-01;"Venda;Produtos;receita;1',
    ),
  );
  assert.throws(() => parseCsv("data;descricao;categoria;tipo;valor"));
  assert.throws(() =>
    parseCsv(
      "data;descricao;categoria;tipo;valor\n2026-10-01;Venda;Produtos;receita;1;extra",
    ),
  );
});
