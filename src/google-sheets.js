let iframe;
let bridgeUrl = "";
let readyPromise;
const pending = new Map();

function handleBridgeMessage(event) {
  if (event.source !== iframe?.contentWindow) return;
  if (event.data?.type === "ready") return;
  const request = pending.get(event.data?.requestId);
  if (!request) return;
  window.clearTimeout(request.timeout);
  pending.delete(event.data.requestId);
  if (event.data.error) request.reject(new Error(event.data.error));
  else request.resolve(event.data.result);
}

function connectBridge(url) {
  if (iframe && bridgeUrl === url && readyPromise) return readyPromise;
  if (iframe) iframe.remove();
  window.removeEventListener("message", handleBridgeMessage);
  bridgeUrl = url;
  iframe = document.createElement("iframe");
  iframe.title = "Conexão segura com a planilha compartilhada";
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;bottom:-10px";
  const endpoint = new URL(url);
  endpoint.searchParams.set("view", "bridge");
  iframe.src = endpoint.href;
  window.addEventListener("message", handleBridgeMessage);
  const pendingReady = new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("A conexão com o serviço da planilha demorou demais. Confira o endereço publicado.")), 20000);
    const checkReady = (event) => {
      if (event.source !== iframe?.contentWindow || event.data?.type !== "ready") return;
      window.clearTimeout(timer);
      window.removeEventListener("message", checkReady);
      resolve();
    };
    window.addEventListener("message", checkReady);
    iframe.addEventListener("error", () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", checkReady);
      reject(new Error("Não foi possível abrir o serviço da planilha."));
    }, { once: true });
  });
  readyPromise = pendingReady.catch((error) => {
    iframe?.remove();
    iframe = null;
    readyPromise = null;
    throw error;
  });
  document.body.append(iframe);
  return readyPromise;
}

async function callBridge(url, method, args) {
  await connectBridge(url);
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      reject(new Error("O serviço da planilha não respondeu a tempo."));
    }, 30000);
    pending.set(requestId, { resolve, reject, timeout });
    iframe.contentWindow.postMessage({ requestId, method, args }, "*");
  });
}

export async function readGoogleRows(url, accessCode) {
  return callBridge(url, "readSharedRows", [accessCode]);
}

export async function writeGoogleRows(url, accessCode, rows, revision, baseRows) {
  return callBridge(url, "saveSharedRows", [accessCode, rows, revision, baseRows]);
}
