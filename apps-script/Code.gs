const TAB_NAME = "Gestao Tech";
const HEADERS = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "ID"];

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Bridge")
    .setTitle("Gestão Tech · Conexão")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function authorizeSpreadsheetAccess() {
  return spreadsheet_().getName();
}

function readSharedRows(accessCode) {
  verifyAccessCode_(accessCode);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const rows = readRows_();
    return { rows: rows, revision: revision_(rows) };
  } finally {
    lock.releaseLock();
  }
}

function saveSharedRows(accessCode, proposedRows, baseRevision, baseRows) {
  verifyAccessCode_(accessCode);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const current = readRows_();
    const baseline = validateRows_(baseRows);
    const proposed = validateRows_(proposedRows);
    const currentRevision = revision_(current);
    if (revision_(baseline) !== String(baseRevision || ""))
      throw new Error("A cópia local ficou inconsistente. Sincronize novamente antes de salvar.");
    const merge = mergeChanges_(baseline, proposed, current);
    if (merge.conflicts.length) {
      return {
        conflict: true,
        conflicts: merge.conflicts,
        rows: current,
        revision: currentRevision,
      };
    }
    const rows = validateRows_(merge.rows);
    writeRows_(rows);
    const nextRevision = revision_(rows);
    return { conflict: false, rows: rows, revision: nextRevision };
  } finally {
    lock.releaseLock();
  }
}

function verifyAccessCode_(accessCode) {
  const expected = PropertiesService.getScriptProperties().getProperty("ACCESS_CODE");
  if (!expected) throw new Error("O responsável ainda não configurou o código de acesso compartilhado.");
  if (String(accessCode || "") !== expected) throw new Error("Código de acesso incorreto.");
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("O responsável ainda não configurou a planilha do sistema.");
  return SpreadsheetApp.openById(id);
}

function sheet_() {
  const spreadsheet = spreadsheet_();
  let sheet = spreadsheet.getSheetByName(TAB_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(TAB_NAME);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  const header = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0]
    .map(function (value) { return normalizeHeader_(value); });
  const required = ["data", "descricao", "categoria", "tipo", "valor", "id"];
  if (required.some(function (name) { return header.indexOf(name) < 0; })) {
    if (sheet.getLastRow() > 1) throw new Error("A aba Gestao Tech já contém dados em outro formato.");
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
  return sheet;
}

function readRows_() {
  const sheet = sheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const header = sheet.getRange(1, 1, 1, HEADERS.length).getDisplayValues()[0]
    .map(function (value) { return normalizeHeader_(value); });
  const indexes = {
    date: header.indexOf("data"),
    description: header.indexOf("descricao"),
    category: header.indexOf("categoria"),
    type: header.indexOf("tipo"),
    amount: header.indexOf("valor"),
    id: header.indexOf("id"),
  };
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const rows = values.filter(function (row) {
    return row.some(function (cell) { return cell !== "" && cell !== null; });
  }).map(function (row) {
    const rawDate = row[indexes.date];
    const date = rawDate instanceof Date
      ? Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd")
      : String(rawDate || "").trim();
    return {
      id: String(row[indexes.id] || Utilities.getUuid()),
      date: date,
      description: String(row[indexes.description] || "").trim(),
      category: String(row[indexes.category] || "").trim(),
      type: normalizeType_(row[indexes.type]),
      amount: Number(row[indexes.amount]),
    };
  });
  const validated = validateRows_(rows);
  if (values.some(function (row) { return !String(row[indexes.id] || "").trim(); })) writeRows_(validated);
  return validated;
}

function writeRows_(rows) {
  const sheet = sheet_();
  const oldLastRow = sheet.getLastRow();
  if (oldLastRow > 0) sheet.getRange(1, 1, oldLastRow, HEADERS.length).clearContent();
  const values = [HEADERS].concat(rows.map(function (row) {
    return [row.date, row.description, row.category,
      row.type === "receita" ? "Ganho" : "Gasto", row.amount, row.id];
  }));
  sheet.getRange(1, 1, values.length, HEADERS.length).setValues(values);
  SpreadsheetApp.flush();
}

function validateRows_(rows) {
  if (!Array.isArray(rows) || rows.length > 5000) throw new Error("A tabela deve ter até 5.000 registros.");
  const ids = Object.create(null);
  return rows.map(function (row, index) {
    const date = String(row.date || "").trim();
    const description = String(row.description || "").trim();
    const category = String(row.category || "").trim();
    const type = normalizeType_(row.type);
    const amount = Number(row.amount);
    const parsed = new Date(date + "T12:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
      throw new Error("Data inválida no registro " + (index + 1) + ".");
    if (!description || description.length > 120 || !category || category.length > 60)
      throw new Error("Descrição e categoria precisam estar preenchidas dentro do limite de caracteres.");
    if (type !== "receita" && type !== "despesa") throw new Error("Tipo deve ser ganho ou gasto.");
    if (!isFinite(amount) || amount <= 0 || amount > 1000000000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001)
      throw new Error("Valor inválido no registro " + (index + 1) + ".");
    const id = String(row.id || Utilities.getUuid());
    if (ids[id]) throw new Error("Há identificadores duplicados na tabela.");
    ids[id] = true;
    return { id: id, date: date, description: description, category: category, type: type, amount: Math.round(amount * 100) / 100 };
  });
}

function mergeChanges_(baseline, proposed, current) {
  const baseById = indexRows_(baseline);
  const proposedById = indexRows_(proposed);
  const currentById = indexRows_(current);
  let merged = current.map(function (row) { return Object.assign({}, row); });
  const conflicts = [];

  baseline.forEach(function (base) {
    const mine = proposedById[base.id];
    const theirs = currentById[base.id];
    if (!mine) {
      if (!theirs) return;
      if (sameRow_(base, theirs)) merged = merged.filter(function (row) { return row.id !== base.id; });
      else conflicts.push({ id: base.id, description: base.description, action: "excluir" });
      return;
    }
    if (sameRow_(base, mine)) return;
    if (!theirs) {
      conflicts.push({ id: base.id, description: base.description, action: "editar" });
    } else if (sameRow_(base, theirs)) {
      merged = merged.map(function (row) { return row.id === base.id ? Object.assign({}, mine) : row; });
    } else if (!sameRow_(mine, theirs)) {
      conflicts.push({ id: base.id, description: base.description, action: "editar" });
    }
  });

  proposed.forEach(function (mine) {
    if (baseById[mine.id]) return;
    const theirs = currentById[mine.id];
    if (!theirs) merged.push(Object.assign({}, mine));
    else if (!sameRow_(mine, theirs)) conflicts.push({ id: mine.id, description: mine.description, action: "adicionar" });
  });
  return { rows: merged, conflicts: conflicts };
}

function indexRows_(rows) {
  return rows.reduce(function (index, row) { index[row.id] = row; return index; }, Object.create(null));
}

function sameRow_(left, right) {
  return left.date === right.date && left.description === right.description &&
    left.category === right.category && left.type === right.type && Number(left.amount) === Number(right.amount);
}

function revision_(rows) {
  const normalized = rows.map(function (row) {
    return [row.id, row.date, row.description, row.category, row.type, row.amount];
  });
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(normalized))
    .map(function (byte) { return (byte + 256).toString(16).slice(-2); }).join("");
}

function normalizeHeader_(value) {
  return String(value || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeType_(value) {
  const type = String(value || "").trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["receita", "revenue", "income", "entrada", "ganho", "ganhos"].indexOf(type) >= 0) return "receita";
  if (["despesa", "expense", "saida", "gasto", "gastos"].indexOf(type) >= 0) return "despesa";
  return type;
}
