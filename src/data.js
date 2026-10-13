export const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );
export const exampleRows = [
  ["2026-07-03", "Venda de camisetas", "Produtos", "receita", 2400],
  ["2026-07-14", "Consultoria", "Serviços", "receita", 1800],
  ["2026-07-18", "Venda de acessórios", "Produtos", "receita", 1200],
  ["2026-07-05", "Aluguel", "Estrutura", "despesa", 1400],
  ["2026-07-10", "Materiais", "Materiais", "despesa", 900],
  ["2026-07-22", "Divulgação", "Marketing", "despesa", 450],
  ["2026-08-04", "Venda de camisetas", "Produtos", "receita", 3100],
  ["2026-08-15", "Consultoria", "Serviços", "receita", 2100],
  ["2026-08-24", "Venda de acessórios", "Produtos", "receita", 1700],
  ["2026-08-05", "Aluguel", "Estrutura", "despesa", 1400],
  ["2026-08-12", "Materiais", "Materiais", "despesa", 1250],
  ["2026-08-20", "Divulgação", "Marketing", "despesa", 650],
  ["2026-09-03", "Venda de camisetas", "Produtos", "receita", 2800],
  ["2026-09-15", "Consultoria", "Serviços", "receita", 2800],
  ["2026-09-23", "Venda de acessórios", "Produtos", "receita", 1900],
  ["2026-09-05", "Aluguel", "Estrutura", "despesa", 1400],
  ["2026-09-10", "Materiais", "Materiais", "despesa", 1100],
  ["2026-09-18", "Divulgação", "Marketing", "despesa", 800],
  ["2026-10-02", "Venda de camisetas", "Produtos", "receita", 3600],
  ["2026-10-06", "Consultoria", "Serviços", "receita", 3200],
  ["2026-10-09", "Venda de acessórios", "Produtos", "receita", 2400],
  ["2026-10-05", "Aluguel", "Estrutura", "despesa", 1400],
  ["2026-10-08", "Materiais", "Materiais", "despesa", 1600],
  ["2026-10-11", "Divulgação", "Marketing", "despesa", 850],
].map(([date, description, category, type, amount], i) => ({
  id: `example-${i}`,
  date,
  description,
  category,
  type,
  amount,
}));
export function summarize(rows) {
  const income = rows
    .filter((row) => row.type === "receita")
    .reduce((sum, row) => sum + row.amount, 0);
  const expense = rows
    .filter((row) => row.type === "despesa")
    .reduce((sum, row) => sum + row.amount, 0);
  const count = rows.filter((row) => row.type === "receita").length;
  return {
    income,
    expense,
    balance: income - expense,
    count,
    ticket: count ? income / count : 0,
  };
}
export function groupChartRows(rows, grouping = "month", sales = false) {
  const groups = new Map();
  for (const row of rows) {
    if (sales && row.type !== "receita") continue;
    const key = grouping === "category" ? row.category : row.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, { key, income: 0, expense: 0 });
    groups.get(key)[row.type === "receita" ? "income" : "expense"] +=
      row.amount;
  }
  return [...groups.values()].sort((a, b) =>
    a.key.localeCompare(b.key, "pt-BR"),
  );
}

export function validateRows(rows) {
  if (!Array.isArray(rows) || rows.length > 5000)
    throw new Error("Use até 5.000 registros.");
  const ids = new Set();
  return rows.map((row, i) => {
    const line = i + 2;
    if (!row || typeof row !== "object")
      throw new Error(`Registro inválido na linha ${line}.`);
    const date = String(row.date || ""),
      parsed = new Date(`${date}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    )
      throw new Error(
        `Linha ${line}: use uma data válida no formato AAAA-MM-DD.`,
      );
    const description = String(row.description || "").trim(),
      category = String(row.category || "").trim(),
      type = String(row.type || "")
        .trim()
        .toLowerCase(),
      amount = Number(row.amount);
    if (
      !description ||
      !category ||
      description.length > 120 ||
      category.length > 60
    )
      throw new Error(
        `Linha ${line}: informe descrição (até 120 caracteres) e categoria (até 60).`,
      );
    if (!["receita", "despesa"].includes(type))
      throw new Error(`Linha ${line}: o tipo deve ser receita ou despesa.`);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > 1e9 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001
    )
      throw new Error(
        `Linha ${line}: informe um valor positivo com até duas casas decimais.`,
      );
    const id = row.id ? String(row.id) : crypto.randomUUID();
    if (ids.has(id)) throw new Error("Há identificadores duplicados.");
    ids.add(id);
    return {
      id,
      date,
      description,
      category,
      type,
      amount: Math.round(amount * 100) / 100,
    };
  });
}
export function parseCsv(text) {
  text = text.replace(/^\ufeff/, "");
  const delimiter = text.split(/\r?\n/)[0].includes(";") ? ";" : ",";
  const records = [];
  let record = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      record.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      record.push(cell);
      if (record.some((value) => value.trim())) records.push(record);
      cell = "";
      record = [];
    } else cell += char;
  }
  if (quoted) throw new Error("CSV inválido: há aspas sem fechamento.");
  record.push(cell);
  if (record.some((value) => value.trim())) records.push(record);
  const headers =
    records.shift()?.map((value) =>
      value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""),
    ) || [];
  if (
    ["data", "descricao", "categoria", "tipo", "valor"].some(
      (key) => !headers.includes(key),
    ) ||
    new Set(headers).size !== headers.length
  )
    throw new Error(
      "O CSV precisa das colunas data, descricao, categoria, tipo e valor, sem nomes duplicados.",
    );
  if (!records.length)
    throw new Error(
      "O arquivo não contém registros. Baixe o exemplo para conferir o formato.",
    );
  return validateRows(
    records.map((record, i) => {
      if (record.length !== headers.length)
        throw new Error(`Linha ${i + 2}: quantidade de colunas incorreta.`);
      const read = (key) => record[headers.indexOf(key)].trim();
      const value = read("valor"),
        normalized =
          delimiter === ";"
            ? value.replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")
            : value;
      if (!/^\d+(?:\.\d{1,2})?$/.test(normalized))
        throw new Error(
          `Linha ${i + 2}: valor inválido. Use um número sem R$ ou outros símbolos.`,
        );
      return {
        date: read("data"),
        description: read("descricao"),
        category: read("categoria"),
        type: read("tipo"),
        amount: Number(normalized),
      };
    }),
  );
}
export function toCsv(rows) {
  const escape = (value) =>
    '"' +
    String(value)
      .replace(/^([=+\-@\t\r])/, "'$1")
      .replaceAll('"', '""') +
    '"';
  return [
    "data;descricao;categoria;tipo;valor",
    ...rows.map((row) =>
      [
        row.date,
        row.description,
        row.category,
        row.type,
        row.amount.toFixed(2).replace(".", ","),
      ]
        .map(escape)
        .join(";"),
    ),
  ].join("\r\n");
}
