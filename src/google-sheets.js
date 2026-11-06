const SHEET_NAME = "Gestao Tech";
const HEADERS = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "ID"];
const REQUIRED_HEADERS = ["data", "descricao", "categoria", "tipo", "valor", "id"];
const SCOPE = "https://www.googleapis.com/auth/drive.file";
let identityLibrary;
let pickerLibrary;

function loadScript(src, ready, promise) {
  if (ready()) return Promise.resolve();
  if (promise) return promise;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => ready() ? resolve() : reject(new Error("A biblioteca do Google não carregou corretamente."));
    script.onerror = () => reject(new Error("Não foi possível carregar a conexão com o Google. Confira sua internet."));
    document.head.append(script);
  });
}

export function prepareGoogleLibraries() {
  identityLibrary ||= loadScript(
    "https://accounts.google.com/gsi/client",
    () => Boolean(window.google?.accounts?.oauth2),
  );
  pickerLibrary ||= loadScript(
    "https://apis.google.com/js/api.js",
    () => Boolean(window.gapi?.load),
  ).then(() => new Promise((resolve, reject) => {
    window.gapi.load("picker", {
      callback: resolve,
      onerror: () => reject(new Error("Não foi possível carregar o seletor de planilhas do Google.")),
      timeout: 10000,
      ontimeout: () => reject(new Error("O seletor do Google demorou demais para carregar.")),
    });
  }));
  return Promise.all([identityLibrary, pickerLibrary]);
}

export async function requestGoogleAccessToken(clientId) {
  if (!clientId) throw new Error("A conexão com Google ainda não foi configurada neste sistema.");
  await prepareGoogleLibraries();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) reject(new Error(`O Google não autorizou o acesso: ${response.error}`));
        else if (!response.access_token) reject(new Error("O Google não retornou a autorização. Tente novamente."));
        else resolve(response.access_token);
      },
      error_callback: (error) => reject(new Error(error?.message || "Não foi possível abrir a autorização do Google.")),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

export async function openGoogleSheetPicker({ token, apiKey, appId }) {
  await prepareGoogleLibraries();
  return new Promise((resolve, reject) => {
    const picker = new window.google.picker.PickerBuilder()
      .addView(new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS))
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setCallback((data) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const file = data[window.google.picker.Response.DOCUMENTS]?.[0];
          if (file) resolve({ id: file.id, name: file.name, url: file.url || `https://docs.google.com/spreadsheets/d/${file.id}/edit` });
          else reject(new Error("Nenhuma planilha foi selecionada."));
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve(null);
        }
      })
      .build();
    picker.setVisible(true);
  });
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function rowRevision(rows) {
  return JSON.stringify([...rows].sort((a, b) => a.id.localeCompare(b.id)).map((row) => [row.id, row.date, row.description, row.category, row.type, row.amount]));
}

function apiError(response, body) {
  if (response.status === 401) return new Error("Sua autorização Google expirou. Clique em Conectar com Google novamente.");
  if (response.status === 403) return new Error("Sua conta não tem permissão para editar esta planilha ou o acesso foi negado.");
  if (response.status === 404) return new Error("A planilha não foi encontrada ou não está compartilhada com esta conta Google.");
  return new Error(body?.error?.message || `Erro ao acessar o Google Sheets (${response.status}).`);
}

async function googleRequest(token, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw apiError(response, body);
  return body;
}

async function getSpreadsheet(token, spreadsheetId) {
  return googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount)))`);
}

async function ensureDataSheet(token, spreadsheet) {
  let sheet = spreadsheet.sheets?.find((item) => item.properties?.title === SHEET_NAME);
  if (!sheet) {
    const created = await googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetId)}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }),
    });
    sheet = { properties: created.replies?.[0]?.addSheet?.properties };
  }
  const current = await googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetId)}/values/${encodeURIComponent(`${SHEET_NAME}!A1:F1`)}?valueRenderOption=UNFORMATTED_VALUE`);
  const values = current.values?.[0] || [];
  if (!values.length) {
    await googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheet.spreadsheetId)}/values/${encodeURIComponent(`${SHEET_NAME}!A1:F1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [HEADERS] }),
    });
    return { ...sheet, headers: REQUIRED_HEADERS };
  }
  const headers = values.map(normalize);
  if (REQUIRED_HEADERS.some((header) => !headers.includes(header)))
    throw new Error(`A aba "${SHEET_NAME}" precisa ter estas colunas: ${HEADERS.join(", ")}.`);
  return { ...sheet, headers };
}

function sheetDate(value) {
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value || "").trim();
  const brDate = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  return brDate ? `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}` : text;
}

function sheetType(value) {
  const type = normalize(value);
  if (["ganho", "ganhos", "receita", "entrada", "income", "revenue"].includes(type)) return "receita";
  if (["gasto", "gastos", "despesa", "saida", "expense"].includes(type)) return "despesa";
  return type;
}

function rowsFromValues(values, headers) {
  const indexes = Object.fromEntries(REQUIRED_HEADERS.map((name) => [name, headers.indexOf(name)]));
  return (values || []).filter((row) => row.some((cell) => cell !== "" && cell !== null && cell !== undefined)).map((row) => ({
    id: String(row[indexes.id] || crypto.randomUUID()),
    date: sheetDate(row[indexes.data]),
    description: String(row[indexes.descricao] || "").trim(),
    category: String(row[indexes.categoria] || "").trim(),
    type: sheetType(row[indexes.tipo]),
    amount: Number(row[indexes.valor]),
  }));
}

export async function readGoogleRows(token, spreadsheetId) {
  const spreadsheet = await getSpreadsheet(token, spreadsheetId);
  const sheet = await ensureDataSheet(token, spreadsheet);
  const result = await googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(`${SHEET_NAME}!A2:F5001`)}?valueRenderOption=UNFORMATTED_VALUE`);
  const values = result.values || [];
  const rows = rowsFromValues(values, sheet.headers);
  const idIndex = sheet.headers.indexOf("id");
  const columnName = (index) => {
    let value = index + 1;
    let name = "";
    while (value) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
  };
  let rowIndex = 0;
  const idUpdates = [];
  values.forEach((row, index) => {
    if (!row.some((cell) => cell !== "" && cell !== null && cell !== undefined)) return;
    if (!row[idIndex]) idUpdates.push({ range: `${SHEET_NAME}!${columnName(idIndex)}${index + 2}`, values: [[rows[rowIndex].id]] });
    rowIndex++;
  });
  if (idUpdates.length) {
    await googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data: idUpdates }),
    });
  }
  return { rows, revision: rowRevision(rows), spreadsheetUrl: spreadsheet.spreadsheetUrl };
}

function sameRow(left, right) {
  return left.date === right.date && left.description === right.description && left.category === right.category && left.type === right.type && Number(left.amount) === Number(right.amount);
}

function mergeChanges(baseline, proposed, current) {
  const baseById = new Map(baseline.map((row) => [row.id, row]));
  const mineById = new Map(proposed.map((row) => [row.id, row]));
  const theirsById = new Map(current.map((row) => [row.id, row]));
  const mergedById = new Map(current.map((row) => [row.id, { ...row }]));
  const conflicts = [];
  for (const base of baseline) {
    const mine = mineById.get(base.id);
    const theirs = theirsById.get(base.id);
    if (!mine) {
      if (!theirs) continue;
      if (sameRow(base, theirs)) mergedById.delete(base.id);
      else conflicts.push({ id: base.id, description: base.description, action: "excluir" });
      continue;
    }
    if (sameRow(base, mine)) continue;
    if (!theirs) conflicts.push({ id: base.id, description: base.description, action: "editar" });
    else if (sameRow(base, theirs)) mergedById.set(base.id, { ...mine });
    else if (!sameRow(mine, theirs)) conflicts.push({ id: base.id, description: base.description, action: "editar" });
  }
  for (const mine of proposed) {
    if (baseById.has(mine.id)) continue;
    const theirs = theirsById.get(mine.id);
    if (!theirs) mergedById.set(mine.id, { ...mine });
    else if (!sameRow(mine, theirs)) conflicts.push({ id: mine.id, description: mine.description, action: "adicionar" });
  }
  return { rows: [...mergedById.values()], conflicts };
}

async function replaceData(token, spreadsheetId, rows) {
  const spreadsheet = await getSpreadsheet(token, spreadsheetId);
  const sheet = await ensureDataSheet(token, spreadsheet);
  const sheetId = sheet.properties?.sheetId;
  if (sheetId === undefined) throw new Error(`Não foi possível preparar a aba "${SHEET_NAME}".`);
  const oldRowCount = sheet.properties?.gridProperties?.rowCount || 1000;
  const endRowIndex = Math.max(oldRowCount, rows.length + 1);
  const data = [HEADERS, ...rows.map((row) => [row.date, row.description, row.category, row.type === "receita" ? "Ganho" : "Gasto", Number(row.amount), row.id])];
  const padded = Array.from({ length: endRowIndex - data.length }, () => []);
  const requests = [];
  if (endRowIndex > oldRowCount) requests.push({ appendDimension: { sheetId, dimension: "ROWS", length: endRowIndex - oldRowCount } });
  requests.push({ updateCells: {
    range: { sheetId, startRowIndex: 0, endRowIndex, startColumnIndex: 0, endColumnIndex: HEADERS.length },
    rows: [...data, ...padded].map((row) => ({ values: row.map((value) => ({ userEnteredValue: typeof value === "number" ? { numberValue: value } : { stringValue: String(value) } })) })),
    fields: "userEnteredValue",
  } });
  await googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
  return readGoogleRows(token, spreadsheetId);
}

export async function writeGoogleRows(token, spreadsheetId, proposedRows, baseRevision, baseRows) {
  if (rowRevision(baseRows) !== String(baseRevision || ""))
    throw new Error("A cópia local ficou inconsistente. Sincronize novamente antes de salvar.");
  const current = await readGoogleRows(token, spreadsheetId);
  if (current.revision === baseRevision) {
    const result = await replaceData(token, spreadsheetId, proposedRows);
    return { conflict: false, ...result };
  }
  const merge = mergeChanges(baseRows, proposedRows, current.rows);
  if (merge.conflicts.length) return { conflict: true, conflicts: merge.conflicts, ...current };
  const result = await replaceData(token, spreadsheetId, merge.rows);
  return { conflict: false, ...result };
}
