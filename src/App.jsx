import { useEffect, useRef, useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import {
  exampleRows,
  money,
  summarize,
  groupChartRows,
  validateRows,
  mergeRows,
  parseCsv,
  toCsv,
} from "./data.js";
import "./App.css";

const KEY = "gestao-tech-data-v1";
const blank = {
  date: "",
  description: "",
  category: "",
  type: "receita",
  amount: "",
};

function parseExcelFile(file) {
  return readXlsxFile(file).then((sheets) => {
    const rows = sheets[0]?.data || [];
    if (rows.length < 2) {
      throw new Error("A primeira aba precisa ter cabeçalho e pelo menos um registro.");
    }
    const normalize = (value) =>
      String(value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
    const aliases = {
      data: ["data", "date"],
      description: ["descricao", "description", "item", "produto"],
      category: ["categoria", "category", "grupo"],
      type: ["tipo", "type", "natureza"],
      amount: ["valor", "amount", "value", "total"],
    };
    const headers = rows[0].map(normalize);
    const indexes = Object.fromEntries(
      Object.entries(aliases).map(([field, names]) => [
        field,
        headers.findIndex((header) => names.includes(header)),
      ]),
    );
    const missing = Object.entries(indexes)
      .filter(([, index]) => index < 0)
      .map(([field]) =>
        ({
          description: "descrição",
          category: "categoria",
          amount: "valor",
          type: "tipo",
          data: "data",
        })[field],
      );
    if (missing.length) {
      throw new Error(`Não encontrei as colunas: ${missing.join(", ")}.`);
    }
    const excelDate = (value) => {
      if (value instanceof Date && !Number.isNaN(value.getTime()))
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
      if (typeof value === "number") {
        const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
        return date.toISOString().slice(0, 10);
      }
      const text = String(value ?? "").trim();
      const brDate = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
      return brDate
        ? `${brDate[3]}-${brDate[2].padStart(2, "0")}-${brDate[1].padStart(2, "0")}`
        : text;
    };
    const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell !== null && cell !== ""));
    if (dataRows.length > 5000) throw new Error("Use até 5.000 registros.");
    const converted = dataRows.map((row) => {
      const read = (field) => row[indexes[field]];
      const type = normalize(read("type"));
      const rawAmount = read("amount");
      const amount = typeof rawAmount === "number"
        ? rawAmount
        : Number(String(rawAmount ?? "").replace(/R\$|\s/g, "").replace(/\.(?=\d{3}(?:,|$))/g, "").replace(",", "."));
      return {
        date: excelDate(read("data")),
        description: String(read("description") ?? ""),
        category: String(read("category") ?? ""),
        type: ["receita", "revenue", "income", "entrada"].includes(type)
          ? "receita"
          : ["despesa", "expense", "saida"].includes(type)
            ? "despesa"
            : type,
        amount,
      };
    });
    return validateRows(converted);
  });
}

function Icon({ name, size = 20 }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="11" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <path d="M14 19h7" />
      </>
    ),
    data: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" />
      </>
    ),
    book: (
      <>
        <path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-2-1-6-2-10 1Z" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4" />
      </>
    ),
    trend: <path d="m3 17 6-6 4 4 8-10M15 5h6v6" />,
    wallet: (
      <>
        <rect x="3" y="5" width="18" height="15" rx="3" />
        <path d="M3 9h18m-5 4h5v4h-5z" />
      </>
    ),
    sparkle: <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />,
    check: <path d="m5 12 4 4 10-10" />,
    print: <path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z" />,
    edit: <path d="m4 16-1 5 5-1L21 7l-5-5zM13 5l5 5" />,
    trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function load() {
  try {
    const saved = localStorage.getItem(KEY);
    return {
      rows: saved ? validateRows(JSON.parse(saved)) : exampleRows,
      warning: "",
    };
  } catch {
    return {
      rows: exampleRows,
      warning:
        "Não foi possível ler os dados salvos. Os exemplos foram carregados.",
    };
  }
}
export default function App() {
  const [initial] = useState(load),
    [rows, setRows] = useState(initial.rows),
    [page, setPage] = useState("dashboard"),
    [model, setModel] = useState("financeiro"),
    [period, setPeriod] = useState("todos"),
    [search, setSearch] = useState(""),
    [notice, setNotice] = useState(initial.warning),
    [saved, setSaved] = useState(false),
    [online, setOnline] = useState(navigator.onLine);
  const [form, setForm] = useState(blank),
    [editing, setEditing] = useState(null),
    [showForm, setShowForm] = useState(false),
    [confirmation, setConfirmation] = useState(null);
  const [formError, setFormError] = useState("");
  const [offlineReady, setOfflineReady] = useState(false);
  const [chartGrouping, setChartGrouping] = useState("month");
  const [chartType, setChartType] = useState("columns");
  const fileInput = useRef(null),
    dialog = useRef(null);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(rows));
      setSaved(true);
    } catch {
      setSaved(false);
      setNotice(
        "Não foi possível salvar neste navegador. Exporte um CSV para guardar seu trabalho.",
      );
    }
  }, [rows]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (showForm || confirmation) dialog.current?.showModal();
    else dialog.current?.close();
  }, [showForm, confirmation]);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let active = true;
    const update = () => {
      if (active) setOfflineReady(Boolean(navigator.serviceWorker.controller));
    };
    navigator.serviceWorker.ready.then(update);
    navigator.serviceWorker.addEventListener("controllerchange", update);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", update);
    };
  }, []);
  const months = [...new Set(rows.map((row) => row.date.slice(0, 7)))].sort(),
    filtered = rows.filter(
      (row) => period === "todos" || row.date.startsWith(period),
    ),
    stats = summarize(filtered),
    sales = model === "vendas";
  const categories = groupChartRows(filtered, "category", sales)
      .map((group) => [group.key, sales ? group.income : group.expense])
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1]),
    total = categories.reduce((sum, [, amount]) => sum + amount, 0);
  const visible = filtered
    .filter((row) =>
      `${row.description} ${row.category}`
        .toLocaleLowerCase("pt-BR")
        .includes(search.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  function updateRows(next) {
    setRows(next);
    if (period !== "todos" && !next.some((row) => row.date.startsWith(period)))
      setPeriod("todos");
  }
  function close() {
    setShowForm(false);
    setConfirmation(null);
    setFormError("");
  }
  function open(row) {
    setFormError("");
    setEditing(row?.id || null);
    setForm(
      row
        ? { ...row, amount: String(row.amount) }
        : { ...blank, date: new Date().toLocaleDateString("sv-SE") },
    );
    setShowForm(true);
  }
  function submit(event) {
    event.preventDefault();
    try {
      if (!editing && rows.length >= 5000)
        throw new Error("O limite é de 5.000 registros.");
      const [row] = validateRows([
        {
          ...form,
          amount: Number(String(form.amount).replace(",", ".")),
          id: editing || crypto.randomUUID(),
        },
      ]);
      updateRows(
        editing
          ? rows.map((item) => (item.id === editing ? row : item))
          : [...rows, row],
      );
      close();
      setNotice("Registro salvo. Seu painel já está atualizado.");
    } catch (error) {
      setFormError(error.message);
    }
  }
  async function importFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2e6) {
      setNotice("Use uma planilha ou CSV de até 2 MB.");
      return;
    }
    try {
      const isExcel = /\.xlsx?$/i.test(file.name);
      const imported = isExcel
        ? await parseExcelFile(file)
        : parseCsv(await file.text());
      const merged = mergeRows(rows, imported);
      setConfirmation({
        type: "import",
        rows: merged.rows,
        title: merged.combinedCount
          ? "Dados iguais encontrados"
          : "Adicionar dados da planilha?",
        text: merged.combinedCount
          ? `Encontramos ${merged.combinedCount} registro(s) igual(is). Deseja continuar com o acréscimo? Os valores serão somados aos registros salvos, e ${merged.addedCount} registro(s) novo(s) serão adicionados. A comparação considera data, descrição, categoria e tipo; diferenças de maiúsculas, acentos e espaços são ignoradas.`
          : `${merged.addedCount} registro(s) novo(s) serão adicionados aos seus dados salvos.`,
      });
    } catch (error) {
      setNotice(error.message);
    }
  }
  function download(example = false) {
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + toCsv(example ? exampleRows : rows)], {
        type: "text/csv;charset=utf-8;",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = example
      ? "gestao-tech-exemplo.csv"
      : "gestao-tech-dados.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function handlePresentationExport(format) {
    try {
      const options = { rows: filtered, sales, period };
      if (format === "pptx") {
        const { exportPowerPoint } = await import("./pptx-export.js");
        await exportPowerPoint(options);
      } else {
        const { exportPdf } = await import("./pdf-export.js");
        exportPdf(options);
      }
      setNotice(
        `Apresentação ${format === "pptx" ? "PowerPoint" : "PDF"} exportada com sucesso.`,
      );
    } catch (error) {
      setNotice(`Não foi possível exportar a apresentação: ${error.message}`);
    }
  }
  function confirm() {
    if (confirmation.type === "delete")
      updateRows(rows.filter((row) => row.id !== confirmation.id));
    else {
      updateRows(
        confirmation.type === "example"
          ? exampleRows.map((row) => ({ ...row }))
          : confirmation.rows,
      );
      setPeriod("todos");
      setNotice(
        confirmation.type === "import"
          ? "Planilha mesclada. Registros iguais foram somados e os novos foram adicionados."
          : "Dados carregados. Explore seu painel!",
      );
    }
    close();
  }
  const metrics = sales
    ? [
        [
          "Receita de vendas",
          stats.income,
          "trend",
          "purple",
          "Soma dos registros de receita",
        ],
        [
          "Vendas registradas",
          stats.count,
          "data",
          "blue",
          "Quantidade de registros de receita",
        ],
        [
          "Ticket médio",
          stats.ticket,
          "wallet",
          "orange",
          "Receita ÷ vendas registradas",
        ],
      ]
    : [
        [
          "Receitas",
          stats.income,
          "trend",
          "purple",
          "Total de entradas do período",
        ],
        [
          "Despesas",
          stats.expense,
          "wallet",
          "orange",
          "Total de saídas do período",
        ],
        [
          "Saldo",
          stats.balance,
          "dashboard",
          "blue",
          "Receitas menos despesas",
        ],
      ];
  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("dashboard");
          }}
        >
          <span className="brand-icon">
            <Icon name="trend" size={25} />
          </span>
          <span>
            gestão<span className="brand-light">tech</span>
            <small>DADOS QUE FAZEM SENTIDO</small>
          </span>
        </a>
        <div className="workspace-label">SEU ESPAÇO DE CRIAÇÃO</div>
        <nav aria-label="Navegação principal">
          {[
            ["dashboard", "dashboard", "Meu painel"],
            ["data", "data", "Meus dados"],
            ["guide", "book", "Guia de uso"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? "active" : ""}`}
              aria-current={page === id ? "page" : undefined}
              onClick={() => setPage(id)}
            >
              <Icon name={icon} />
              {label}
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-tip">
          <div className="tip-spark">
            <Icon name="sparkle" />
          </div>
          <strong>
            Seu primeiro dashboard
            <br />
            começa com uma ideia.
          </strong>
          <p>Explore os exemplos e veja seus dados ganharem forma.</p>
          <button className="text-button" onClick={() => setPage("guide")}>
            Conhecer os recursos <Icon name="arrow" size={17} />
          </button>
          <span className="tip-orbit" />
        </div>
        <div className="sidebar-bottom">
          <span className={`status-dot ${online ? "" : "offline"}`} />
          {online ? "Você está online" : "Modo offline"}
          <small>
            {saved
              ? "Dados salvos neste navegador"
              : "Dados apenas nesta sessão"}
          </small>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Meu espaço <span>/</span>
            <strong>
              {page === "dashboard"
                ? "Dashboard"
                : page === "data"
                  ? "Dados"
                  : "Guia de uso"}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="product-badge">
              <span /> ANÁLISE DE DADOS
            </span>
            <div className="avatar" aria-label="Gestão Tech">
              GT
            </div>
          </div>
        </header>
        <div className="main-content">
          {notice && (
            <div className="notice no-print" role="status">
              <span>{notice}</span>
              <button aria-label="Fechar aviso" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}
          <section className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "guide" ? "COMECE COM CLAREZA" : "DO DADO À DECISÃO"}
              </span>
              <h1>
                {page === "dashboard" ? (
                  <>
                    Seu painel, <span>suas descobertas.</span>
                  </>
                ) : page === "data" ? (
                  <>
                    Tudo começa <span>com os dados.</span>
                  </>
                ) : (
                  <>
                    Explore <span>os recursos.</span>
                  </>
                )}
              </h1>
              <p>
                {page === "dashboard"
                  ? "Transforme números em uma visão clara do seu negócio."
                  : page === "data"
                    ? "Adicione, edite ou importe registros. Os gráficos acompanham você."
                    : "Um passo de cada vez para construir seu primeiro dashboard."}
              </p>
            </div>
            <button
              className="button primary no-print"
              onClick={() => {
                setPage("data");
                open();
              }}
            >
              <Icon name="plus" size={18} />
              Adicionar registro
            </button>
          </section>
          {page !== "guide" && (
            <div className="toolbar no-print">
              {page === "dashboard" && (
                <div className="segmented" aria-label="Modelo do painel">
                  <button
                    className={!sales ? "selected" : ""}
                    aria-pressed={!sales}
                    onClick={() => setModel("financeiro")}
                  >
                    <Icon name="wallet" size={17} />
                    Financeiro
                  </button>
                  <button
                    className={sales ? "selected" : ""}
                    aria-pressed={sales}
                    onClick={() => setModel("vendas")}
                  >
                    <Icon name="trend" size={17} />
                    Vendas
                  </button>
                </div>
              )}
              <div className="toolbar-actions">
                <label className="period">
                  Período
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="todos">Todo o período</option>
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {new Date(`${month}-02T12:00:00`).toLocaleDateString(
                          "pt-BR",
                          { month: "long", year: "numeric" },
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="button subtle" onClick={() => download()}>
                  <Icon name="download" size={17} />
                  Exportar CSV
                </button>
              </div>
            </div>
          )}
          {page === "dashboard" && (
            <>
              <section className="welcome-card no-print">
                <div>
                  <span className="small-pill">
                    <Icon name="sparkle" size={13} />
                    SEUS DADOS EM PERSPECTIVA
                  </span>
                  <h2>
                    Pequenos números.
                    <br />
                    <span>Grandes possibilidades.</span>
                  </h2>
                  <p>
                    Teste, compare e encontre a história por trás dos dados.
                    <br />
                    Comece com os exemplos ou traga os seus.
                  </p>
                  <button
                    className="button white"
                    onClick={() => {
                      setPage("data");
                      fileInput.current.click();
                    }}
                  >
                    Importar meus dados
                    <Icon name="arrow" size={17} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit" />
                  <div className="orbit orbit-two" />
                  <span className="art-star">✳</span>
                  <div className="mini-chart">
                    <div className="mini-top">
                      <span>Uma nova perspectiva</span>
                      <Icon name="trend" size={18} />
                    </div>
                    <strong>Você no controle.</strong>
                    <div className="mini-bars">
                      {[30, 47, 40, 68, 58, 83, 96].map((height, i) => (
                        <i key={i} style={{ height: `${height}%` }} />
                      ))}
                    </div>
                    <div className="mini-bottom">
                      Explore<span>→</span>Descubra<span>→</span>Decida
                    </div>
                  </div>
                  <span className="floating-chip">
                    <Icon name="check" size={15} />
                    Ideias em movimento
                  </span>
                </div>
              </section>
              <section className="metrics" aria-label="Indicadores do período">
                {metrics.map(([label, value, icon, color, caption]) => (
                  <article key={label} className={`metric-card ${color}`}>
                    <div className="metric-title">
                      {label}
                      <span className="metric-icon">
                        <Icon name={icon} />
                      </span>
                    </div>
                    <strong>
                      {label === "Vendas registradas" ? value : money(value)}
                    </strong>
                    <small>{caption}</small>
                  </article>
                ))}
              </section>
              <section className="charts-grid">
                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {chartType === "donut"
                          ? "Composição dos registros"
                          : chartGrouping === "category"
                            ? sales
                            ? "Vendas por categoria"
                            : "Receitas e despesas por categoria"
                          : sales
                            ? "Vendas ao longo do tempo"
                            : "Como seu dinheiro se movimenta"}
                      </h2>
                      <p>
                        {chartType === "donut"
                          ? "Veja como os valores se distribuem"
                          : chartGrouping === "category"
                          ? "Compare os valores de cada categoria no período"
                          : sales
                            ? "Receitas agrupadas por mês"
                            : "Compare entradas e saídas por mês"}
                      </p>
                    </div>
                    <span className="chart-tag">
                      {chartGrouping === "category" ? "CATEGORIAS" : "MENSAL"}
                    </span>
                  </div>
                  <div
                    className="chart-controls no-print"
                    aria-label="Agrupamento do gráfico"
                  >
                    <div className="chart-grouping" aria-label="Agrupar dados">
                      <button
                        aria-pressed={chartGrouping === "month"}
                        onClick={() => setChartGrouping("month")}
                      >
                        Por mês
                      </button>
                      <button
                        aria-pressed={chartGrouping === "category"}
                        onClick={() => setChartGrouping("category")}
                      >
                        Por categoria
                      </button>
                    </div>
                    <div className="chart-type" aria-label="Tipo de visualização">
                      {[["columns", "Colunas"], ["line", "Linha"], ["donut", "Rosca"]].map(([id, label]) => (
                        <button
                          key={id}
                          aria-pressed={chartType === id}
                          onClick={() => setChartType(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="legend">
                    <span>
                      <i className="purple-dot" />
                      {sales ? "Vendas" : "Receitas"}
                    </span>
                    {!sales && (
                      <span>
                        <i className="orange-dot" />
                        Despesas
                      </span>
                    )}
                  </div>
                  <ChartView
                    rows={filtered}
                    sales={sales}
                    grouping={chartGrouping}
                    type={chartType}
                  />
                </article>
                <article className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>
                        {sales
                          ? "De onde vêm as vendas?"
                          : "Para onde vai o dinheiro?"}
                      </h2>
                      <p>
                        {sales
                          ? "Receitas por categoria"
                          : "Despesas por categoria"}
                      </p>
                    </div>
                  </div>
                  {!categories.length ? (
                    <div className="empty-state">
                      Nenhum registro neste período.
                      <br />
                      Adicione dados para explorar seu painel.
                    </div>
                  ) : (
                    <>
                      <div className="category-total">
                        <span>Total do período</span>
                        <strong>{money(total)}</strong>
                      </div>
                      <div className="category-list">
                        {categories.map(([category, amount], i) => (
                          <div className="category-row" key={category}>
                            <div>
                              <span>
                                <i
                                  style={{
                                    background: [
                                      "#7860db",
                                      "#ffad70",
                                      "#459e93",
                                      "#91a5ed",
                                    ][i % 4],
                                  }}
                                />
                                {category}
                              </span>
                              <strong>{money(amount)}</strong>
                            </div>
                            <svg
                              className="category-bar"
                              width="100%"
                              height="16"
                              role="img"
                              aria-label={`${category}: ${money(amount)}`}
                            >
                              <rect
                                width="100%"
                                height="16"
                                rx="8"
                                fill="#f3eff9"
                              />
                              <rect
                                width={`${(amount / total) * 100}%`}
                                height="16"
                                rx="8"
                                fill={
                                  ["#7860db", "#ffad70", "#459e93", "#91a5ed"][
                                    i % 4
                                  ]
                                }
                              />
                            </svg>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </article>
              </section>
              <div className="presentation-actions no-print">
                <button
                  className="button subtle"
                  onClick={() => handlePresentationExport("pptx")}
                >
                  <Icon name="download" size={17} />
                  Exportar PowerPoint
                </button>
                <button
                  className="button subtle"
                  onClick={() => handlePresentationExport("pdf")}
                >
                  <Icon name="print" size={17} />
                  Exportar PDF
                </button>
              </div>
              <section className="insight">
                <span className="insight-icon">
                  <Icon name="sparkle" />
                </span>
                <div>
                  <strong>Uma pista para sua próxima decisão</strong>
                  <p>
                    {filtered.length
                      ? sales
                        ? `Seu ticket médio é ${money(stats.ticket)}. Compare períodos para entender o valor de cada venda.`
                        : `Seu saldo é ${money(stats.balance)}. Compare as categorias para entender o que mais influencia esse resultado.`
                      : "Carregue os exemplos para começar a descobrir padrões."}
                  </p>
                </div>
                <button
                  className="text-button no-print"
                  onClick={() => setPage("guide")}
                >
                  Entender os indicadores
                  <Icon name="arrow" size={17} />
                </button>
              </section>
            </>
          )}
          {page === "data" && (
            <>
              <div className="data-intro">
                <div>
                  <strong>Seu conjunto de dados</strong>
                  <p>
                    Os exemplos são fictícios. Seus registros ficam apenas neste
                    navegador.
                  </p>
                </div>
                <div className="data-buttons">
                  <button
                    className="button subtle"
                    onClick={() =>
                      setConfirmation({
                        type: "example",
                        title: "Carregar exemplos?",
                        text: "Os exemplos substituirão seus registros. Exporte um CSV antes para guardar seus dados.",
                      })
                    }
                  >
                    Carregar exemplos
                  </button>
                  <button
                    className="button primary"
                    onClick={() => fileInput.current.click()}
                  >
                    <Icon name="upload" size={17} />
                    Importar planilha
                  </button>
                </div>
              </div>
              <article className="panel data-panel">
                <div className="table-toolbar">
                  <h2>
                    Registros{" "}
                    <span className="count-badge">{visible.length}</span>
                  </h2>
                  <label className="search-label">
                    <span className="sr-only">
                      Buscar descrição ou categoria
                    </span>
                    <Icon name="search" size={18} />
                    <input
                      placeholder="Buscar descrição ou categoria…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Descrição</th>
                        <th>Categoria</th>
                        <th>Tipo</th>
                        <th className="amount-cell">Valor</th>
                        <th>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((row) => (
                        <tr key={row.id}>
                          <td>{row.date.split("-").reverse().join("/")}</td>
                          <td className="description-cell">
                            {row.description}
                          </td>
                          <td>{row.category}</td>
                          <td>
                            <span className={`type-pill ${row.type}`}>
                              {row.type === "receita" ? "Receita" : "Despesa"}
                            </span>
                          </td>
                          <td className="amount-cell">{money(row.amount)}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                aria-label={`Editar ${row.description}`}
                                onClick={() => open(row)}
                              >
                                <Icon name="edit" size={16} />
                              </button>
                              <button
                                className="icon-button"
                                aria-label={`Excluir ${row.description}`}
                                onClick={() =>
                                  setConfirmation({
                                    type: "delete",
                                    id: row.id,
                                    title: "Excluir registro?",
                                    text: `“${row.description}” será removido do painel.`,
                                  })
                                }
                              >
                                <Icon name="trash" size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visible.length && (
                    <div className="empty-state">
                      Nenhum registro encontrado. Adicione um registro ou ajuste
                      o filtro.
                    </div>
                  )}
                </div>
                <p className="table-note">
                  No modelo Vendas, cada receita representa uma venda. Use uma
                  linha por venda para calcular o ticket médio corretamente.
                </p>
              </article>
              <div className="csv-help">
                <Icon name="book" />
                <div>
                  <strong>Primeira vez importando?</strong>
                  <p>
                    Importe Excel (.xlsx) ou CSV. Use colunas de data,
                    descrição, categoria, tipo e valor; datas em AAAA-MM-DD e
                    tipo receita ou despesa.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => download(true)}
                  >
                    Baixar arquivo de exemplo
                    <Icon name="download" size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
          {page === "guide" && (
            <Guide
              onStart={() => setPage("data")}
              onExample={() => download(true)}
            />
          )}
          <p className="offline-note no-print">
            {offlineReady
              ? "Disponível para acesso offline neste navegador"
              : "Exporte seus dados em CSV para manter uma cópia de segurança."}
          </p>
          <footer>
            <span>
              <strong>gestão tech</strong> · Painéis financeiros e de vendas
            </span>
            <span>Seus dados ficam salvos neste navegador.</span>
          </footer>
        </div>
      </main>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={importFile}
      />
      <dialog
        ref={dialog}
        className="form-dialog"
        onCancel={close}
        onClose={close}
      >
        <div className="dialog-heading">
          <h2>
            {showForm
              ? editing
                ? "Editar registro"
                : "Um novo dado, uma nova ideia"
              : confirmation?.title}
          </h2>
          <button
            className="icon-button"
            aria-label="Fechar janela"
            onClick={close}
          >
            ×
          </button>
        </div>
        {showForm ? (
          <form onSubmit={submit}>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <p>Preencha os campos para atualizar seu painel.</p>
            <label>
              Data
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              Descrição
              <input
                required
                maxLength={120}
                placeholder="Ex.: Venda de camisetas"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            <label>
              Categoria
              <input
                required
                maxLength={60}
                placeholder="Ex.: Produtos, serviços, aluguel"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </label>
            <div className="form-columns">
              <label>
                Tipo
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="receita">Receita</option>
                  <option value="despesa">Despesa</option>
                </select>
              </label>
              <label>
                Valor (R$)
                <input
                  type="number"
                  min="0.01"
                  max="1000000000"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </label>
            </div>
            <div className="dialog-actions">
              <button type="button" className="button subtle" onClick={close}>
                Cancelar
              </button>
              <button className="button primary" type="submit">
                Salvar registro
                <Icon name="check" size={17} />
              </button>
            </div>
          </form>
        ) : (
          <>
            <p>{confirmation?.text}</p>
            <div className="dialog-actions">
              <button className="button subtle" onClick={close}>
                Cancelar
              </button>
              <button className="button primary" onClick={confirm}>
                Confirmar
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
function ChartView({ rows, sales, grouping, type }) {
  const values = groupChartRows(rows, grouping, sales);
  if (!values.length)
    return (
      <div className="empty-state">
        Seu gráfico aparecerá aqui.
        <br />
        Adicione registros para começar.
      </div>
    );
  if (type === "donut") return <DonutChart values={values} sales={sales} grouping={grouping} />;
  if (type === "line") return <LineChart values={values} sales={sales} grouping={grouping} />;
  const max = Math.max(
    1,
    ...values.flatMap((value) =>
      sales ? [value.income] : [value.income, value.expense],
    ),
  );
  return (
    <div className="chart-scroll">
      <div
        className={`bar-chart ${grouping === "category" ? "category-chart" : ""}`}
        role="img"
        aria-label={values
          .map(
            (v) =>
              `${v.key}: receitas ${money(v.income)}${sales ? "" : `, despesas ${money(v.expense)}`}`,
          )
          .join("; ")}
        style={{
          minWidth: Math.max(
            400,
            122 + values.length * (grouping === "category" ? 120 : 95),
          ),
        }}
      >
        <div className="chart-grid">
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <div key={fraction}>
              <span>{money(max * fraction)}</span>
              <i />
            </div>
          ))}
        </div>
        <div className="chart-columns">
          {values.map((value) => (
            <div className="chart-column" key={value.key}>
              <div className="bar-pair">
                <div
                  className="bar income-bar"
                  style={{ height: `${(value.income / max) * 100}%` }}
                  title={`${value.key} — receitas: ${money(value.income)}`}
                  tabIndex={0}
                >
                  <span className="bar-tooltip">{money(value.income)}</span>
                </div>
                {!sales && (
                  <div
                    className="bar expense-bar"
                    style={{ height: `${(value.expense / max) * 100}%` }}
                    title={`${value.key} — despesas: ${money(value.expense)}`}
                    tabIndex={0}
                  >
                    <span className="bar-tooltip">{money(value.expense)}</span>
                  </div>
                )}
              </div>
              <span>
                {grouping === "category"
                  ? value.key
                  : new Date(`${value.key}-02T12:00:00`).toLocaleDateString(
                      "pt-BR",
                      { month: "short", year: "2-digit" },
                    )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function chartLabel(value, grouping) {
  return grouping === "category"
    ? value
    : new Date(`${value}-02T12:00:00`).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });
}

function LineChart({ values, sales, grouping }) {
  const width = Math.max(660, values.length * 104);
  const height = 300;
  const left = 84;
  const right = width - 22;
  const top = 22;
  const bottom = 240;
  const max = Math.max(1, ...values.flatMap((row) => sales ? [row.income] : [row.income, row.expense]));
  const point = (value, index) => ({
    x: values.length === 1 ? (left + right) / 2 : left + (index * (right - left)) / (values.length - 1),
    y: bottom - (value / max) * (bottom - top),
  });
  const series = [
    { key: "income", label: sales ? "Vendas" : "Receitas", color: "#8069cf" },
    ...(!sales ? [{ key: "expense", label: "Despesas", color: "#e9a36f" }] : []),
  ];
  return (
    <div className="chart-scroll">
      <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de linhas">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = bottom - fraction * (bottom - top);
          return <g key={fraction}><text x="0" y={y + 4}>{money(max * fraction)}</text><line x1={left} x2={right} y1={y} y2={y} className="line-grid" /></g>;
        })}
        {series.map((item) => {
          const points = values.map((row, index) => point(row[item.key], index));
          return <g key={item.key}>
            <polyline points={points.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {points.map(({ x, y }, index) => <circle key={values[index].key} cx={x} cy={y} r="5" fill={item.color} stroke="white" strokeWidth="2"><title>{`${values[index].key} — ${item.label}: ${money(values[index][item.key])}`}</title></circle>)}
          </g>;
        })}
        {values.map((row, index) => <text className="line-x-label" key={row.key} x={point(0, index).x} y="274" textAnchor="middle">{chartLabel(row.key, grouping)}</text>)}
      </svg>
    </div>
  );
}

function DonutChart({ values, sales, grouping }) {
  const slices = values
    .map((row) => ({ key: row.key, amount: sales ? row.income : row.income + row.expense }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = slices.reduce((sum, row) => sum + row.amount, 0);
  if (!slices.length) return <div className="empty-state">Sem valores para compor o gráfico.</div>;
  const colors = ["#8069cf", "#e9a36f", "#55a69a", "#7293d2", "#d7829a", "#9e9a69", "#8e74aa"];
  const stops = slices.reduce((result, slice, index) => {
    const end = result.position + (slice.amount / total) * 100;
    const stop = `${colors[index % colors.length]} ${result.position}% ${end}%`;
    return {
      position: end,
      value: result.value ? `${result.value}, ${stop}` : stop,
    };
  }, { position: 0, value: "" }).value;
  return (
    <div className="donut-layout">
      <div className="donut" style={{ background: `conic-gradient(${stops})` }} role="img" aria-label={`Composição por ${grouping === "category" ? "categoria" : "mês"}: ${money(total)}`}>
        <div><span>Total</span><strong>{money(total)}</strong></div>
      </div>
      <div className="donut-legend">
        {slices.map((slice, index) => <div key={slice.key} title={`${slice.key}: ${money(slice.amount)}`}><span><i style={{ background: colors[index % colors.length] }} />{chartLabel(slice.key, grouping)}</span><strong>{(slice.amount / total * 100).toFixed(0)}%</strong></div>)}
      </div>
    </div>
  );
}

function Guide({ onStart, onExample }) {
  return (
    <>
      <section className="guide-banner">
        <span className="small-pill">GUIA DE USO</span>
        <h2>
          Crie sua primeira análise
          <br />e acompanhe os resultados do seu negócio.
        </h2>
        <p>
          Organize seus registros em um painel financeiro ou de vendas.
          <br />
          Comece pelos exemplos ou importe seus próprios dados.
        </p>
        <button className="button white" onClick={onStart}>
          Organizar meus dados
          <Icon name="arrow" size={18} />
        </button>
      </section>
      <section className="guide-steps">
        {[
          [
            "01",
            "Traga seus dados",
            "Em Meus dados, adicione registros ou importe um CSV. Os exemplos ajudam a conhecer os recursos.",
          ],
          [
            "02",
            "Escolha sua perspectiva",
            "Financeiro mostra receitas, despesas e saldo. Vendas mostra receitas, vendas registradas e ticket médio.",
          ],
          [
            "03",
            "Explore e compare",
            "Filtre um mês, veja as categorias e edite um registro para observar a mudança no gráfico.",
          ],
          [
            "04",
            "Salve seus resultados",
            "Exporte o CSV para manter uma cópia de segurança e use a impressão para salvar o painel em PDF.",
          ],
        ].map(([number, title, text]) => (
          <article className="panel guide-step" key={number}>
            <span className="step-number">{number}</span>
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>
      <div className="guide-bottom">
        <article className="panel">
          <h2>Os indicadores, sem complicação</h2>
          <dl>
            <dt>Saldo</dt>
            <dd>
              Receitas − despesas. Um valor negativo significa que as saídas
              superaram as entradas.
            </dd>
            <dt>Ticket médio</dt>
            <dd>
              Receita total ÷ quantidade de vendas. Registre uma receita por
              venda.
            </dd>
            <dt>Categorias</dt>
            <dd>
              Agrupam valores de mesma natureza. Padronize os nomes para
              facilitar a comparação.
            </dd>
          </dl>
        </article>
        <article className="panel">
          <h2>Experimente com seus dados</h2>
          <p>
            Registre suas vendas e despesas. Compare as categorias para
            identificar os principais custos e acompanhar seu saldo.
          </p>
          <div className="challenge">
            <Icon name="sparkle" />
            <span>
              Alterne para Vendas para acompanhar a receita e o ticket médio.
            </span>
          </div>
          <button className="button subtle" onClick={onExample}>
            <Icon name="download" size={17} />
            Baixar dados de exemplo
          </button>
          <p className="privacy-note">
            Os dados ficam neste navegador. Exporte um backup antes de trocar de
            computador. Quando o indicador de acesso offline estiver disponível,
            você poderá reabrir este site sem conexão.
          </p>
        </article>
      </div>
    </>
  );
}
