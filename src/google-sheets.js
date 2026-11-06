const SHEET_NAME = "Gestao Tech";
const HEADERS = ["Data", "Descrição", "Categoria", "Tipo", "Valor", "ID"];
const REQUIRED_HEADERS = ["data", "descricao", "categoria", "tipo", "valor", "id"];
const SCOPE = "https://www.googleapis.com/auth/drive.file";
let identityLibrary;
let pickerLibrary;
const formattedSheets = new Set();

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

function prepareGoogleIdentity() {
  identityLibrary ||= loadScript(
    "https://accounts.google.com/gsi/client",
    () => Boolean(window.google?.accounts?.oauth2),
  );
  return identityLibrary;
}

function prepareGooglePicker() {
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
  return pickerLibrary;
}

export function prepareGoogleLibraries() {
  return Promise.all([prepareGoogleIdentity(), prepareGooglePicker()]);
}

export async function requestGoogleAccessToken(clientId) {
  if (!clientId) throw new Error("A conexão com Google ainda não foi configurada neste sistema.");
  await prepareGoogleIdentity();
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
  await prepareGooglePicker();
  return new Promise((resolve, reject) => {
    const picker = new window.google.picker.PickerBuilder()
      .addView(new window.google.picker.DocsView(window.google.picker.ViewId.SPREADSHEETS))
      .setOAuthToken(token)
      .setDeveloperKey(apiKey)
      .setAppId(appId)
      .setCallback((data) => {
        const action = data[window.google.picker.Response.ACTION] || data.action;
        if (action === window.google.picker.Action.PICKED) {
          const file = data[window.google.picker.Response.DOCUMENTS]?.[0];
          if (file) {
            const id = String(file.id || "");
            if (!/^[A-Za-z0-9_-]+$/.test(id)) {
              reject(new Error("O seletor retornou um identificador de planilha inválido."));
              return;
            }
            resolve({ id, name: String(file.name || "Planilha").slice(0, 200), url: spreadsheetUrl(id) });
          }
          else reject(new Error("Nenhuma planilha foi selecionada."));
        } else if (action === window.google.picker.Action.CANCEL) {
          resolve(null);
        } else if (action === window.google.picker.Action.ERROR) {
          const details = typeof data.error === "string" ? data.error : data.error?.message;
          reject(new Error(details
            ? `O Google Picker falhou: ${details}`
            : "O seletor do Google encontrou um erro. Confira se a Google Picker API está ativada e se a chave de API permite o domínio do site e docs.google.com."));
        } else {
          reject(new Error(`O Google Picker foi fechado sem concluir a seleção${action ? ` (ação: ${action})` : ""}. Tente novamente.`));
        }
      })
      .build();
    picker.setVisible(true);
  });
}

function normalize(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function spreadsheetUrl(spreadsheetId) {
  const id = String(spreadsheetId || "");
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("A planilha selecionada tem um identificador inválido.");
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
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
  spreadsheetUrl(spreadsheetId);
  return googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,properties(title),sheets(properties(sheetId,title,gridProperties(rowCount)))`);
}

async function formatDataSheet(token, spreadsheetId, sheet, headers) {
  const sheetId = sheet.properties?.sheetId;
  if (sheetId === undefined) throw new Error(`Não foi possível preparar a aba "${SHEET_NAME}".`);
  const cacheKey = `${spreadsheetId}:${sheetId}`;
  if (formattedSheets.has(cacheKey)) return;

  const rowCount = Math.max(sheet.properties?.gridProperties?.rowCount || 1000, 2);
  const column = (name) => headers.indexOf(name);
  const dataRange = (name) => ({
    sheetId,
    startRowIndex: 1,
    endRowIndex: rowCount,
    startColumnIndex: column(name),
    endColumnIndex: column(name) + 1,
  });
  const requests = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HEADERS.length },
        cell: { userEnteredFormat: {
          backgroundColor: { red: 0.35, green: 0.27, blue: 0.57 },
          textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
          horizontalAlignment: "CENTER",
          verticalAlignment: "MIDDLE",
          wrapStrategy: "WRAP",
        } },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    },
    ...[
      { startIndex: 0, endIndex: 1, pixelSize: 125 },
      { startIndex: 1, endIndex: 2, pixelSize: 280 },
      { startIndex: 2, endIndex: 3, pixelSize: 180 },
      { startIndex: 3, endIndex: 4, pixelSize: 130 },
      { startIndex: 4, endIndex: 5, pixelSize: 150 },
      { startIndex: 5, endIndex: 6, pixelSize: 250 },
    ].map(({ startIndex, endIndex, pixelSize }) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex, endIndex },
        properties: { pixelSize },
        fields: "pixelSize",
      },
    })),
    {
      repeatCell: {
        range: dataRange("data"),
        cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: "dd/mm/yyyy" }, horizontalAlignment: "CENTER" } },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    },
    {
      repeatCell: {
        range: dataRange("valor"),
        cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: '"R$" #,##0.00' }, horizontalAlignment: "RIGHT" } },
        fields: "userEnteredFormat(numberFormat,horizontalAlignment)",
      },
    },
    ...["descricao", "categoria", "tipo", "id"].map((name) => ({
      repeatCell: {
        range: dataRange(name),
        cell: { userEnteredFormat: { numberFormat: { type: "TEXT", pattern: "@" } } },
        fields: "userEnteredFormat.numberFormat",
      },
    })),
    ...[
      { name: "data", condition: { type: "DATE_IS_VALID" }, inputMessage: "Informe uma data válida." },
      { name: "descricao", condition: { type: "NOT_BLANK" }, inputMessage: "Informe a descrição do registro." },
      { name: "categoria", condition: { type: "NOT_BLANK" }, inputMessage: "Informe uma categoria." },
      { name: "tipo", condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Ganho" }, { userEnteredValue: "Gasto" }] }, inputMessage: "Escolha Ganho ou Gasto na lista." },
      { name: "valor", condition: { type: "NUMBER_GREATER", values: [{ userEnteredValue: "0" }] }, inputMessage: "Informe um valor numérico maior que zero." },
    ].map(({ name, condition, inputMessage }) => ({
      setDataValidation: {
        range: dataRange(name),
        rule: { condition, inputMessage, strict: true, showCustomUi: name === "tipo" },
      },
    })),
  ];

  await googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
  formattedSheets.add(cacheKey);
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
  }
  const headers = values.length ? values.map(normalize) : REQUIRED_HEADERS;
  if (REQUIRED_HEADERS.some((header) => !headers.includes(header)))
    throw new Error(`A aba "${SHEET_NAME}" precisa ter estas colunas: ${HEADERS.join(", ")}.`);
  await formatDataSheet(token, spreadsheet.spreadsheetId, sheet, headers);
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

function sheetDateSerial(value) {
  const canonical = sheetDate(value);
  const match = canonical.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return timestamp / 86400000 + 25569;
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
  const dateIndex = sheet.headers.indexOf("data");
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
  const cellUpdates = [];
  values.forEach((row, index) => {
    if (!row.some((cell) => cell !== "" && cell !== null && cell !== undefined)) return;
    if (!row[idIndex]) cellUpdates.push({ range: `${SHEET_NAME}!${columnName(idIndex)}${index + 2}`, values: [[rows[rowIndex].id]] });
    if (typeof row[dateIndex] === "string") {
      const serial = sheetDateSerial(row[dateIndex]);
      if (serial !== null) cellUpdates.push({ range: `${SHEET_NAME}!${columnName(dateIndex)}${index + 2}`, values: [[serial]] });
    }
    rowIndex++;
  });
  if (cellUpdates.length) {
    await googleRequest(token, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data: cellUpdates }),
    });
  }
  return { rows, revision: rowRevision(rows), spreadsheetUrl: spreadsheetUrl(spreadsheetId) };
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
  const data = [HEADERS, ...rows.map((row) => [sheetDateSerial(row.date) ?? row.date, row.description, row.category, row.type === "receita" ? "Ganho" : "Gasto", Number(row.amount), row.id])];
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

export async function createExampleGoogleSheet(token, rows) {
  const title = "Gestão Tech - Modelo de exemplo";
  const created = await googleRequest(token, "https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: SHEET_NAME, gridProperties: { rowCount: 1000, columnCount: HEADERS.length } } }],
    }),
  });
  if (!created.spreadsheetId) throw new Error("O Google não retornou o endereço da planilha de exemplo.");
  const saved = await replaceData(token, created.spreadsheetId, rows);
  return { ...saved, id: created.spreadsheetId, name: title, spreadsheetUrl: spreadsheetUrl(created.spreadsheetId) };
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
