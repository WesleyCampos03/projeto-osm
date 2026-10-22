import { jsPDF } from "jspdf";
import { groupChartRows, money } from "./data.js";
import { periodName, monthName, reportData } from "./presentation-utils.js";

function pdfText(doc, text, x, y, options = {}) {
  doc.setFont(options.bold ? "helvetica" : "helvetica", options.bold ? "bold" : "normal");
  doc.setFontSize(options.size || 10);
  doc.setTextColor(...(options.color || [41, 38, 58]));
  doc.text(String(text), x, y, options.align ? { align: options.align } : undefined);
}

function pdfSlideBase(doc, title, subtitle, period, page) {
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setFillColor(248, 247, 251);
  doc.rect(0, 0, width, height, "F");
  pdfText(doc, "GESTÃO TECH  /  PAINEL EXECUTIVO", width / 2, 12, {
    bold: true,
    size: 8,
    color: [119, 96, 207],
    align: "center",
  });
  pdfText(doc, title, width / 2, 25, { bold: true, size: 21, align: "center" });
  pdfText(doc, subtitle, width / 2, 33, { size: 10, color: [119, 115, 134], align: "center" });
  doc.setDrawColor(232, 229, 239);
  doc.line(20, height - 13, width - 20, height - 13);
  pdfText(doc, `GESTÃO TECH  ·  ${period}`, width / 2, height - 7, {
    size: 7,
    color: [119, 115, 134],
    align: "center",
  });
  pdfText(doc, `${String(page).padStart(2, "0")} / 03`, width - 20, height - 7, {
    bold: true, size: 8, color: [119, 96, 207], align: "right",
  });
  return { width, height };
}

function pdfMetricCard(doc, x, y, w, h, title, value, accent) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(232, 229, 239);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");
  doc.setFillColor(...accent);
  doc.roundedRect(x, y, 2, h, 1, 1, "F");
  pdfText(doc, title.toUpperCase(), x + 7, y + 12, {
    bold: true,
    size: 8,
    color: [119, 115, 134],
  });
  pdfText(doc, value, x + 7, y + 28, {
    bold: true,
    size: value.length > 17 ? 16 : 19,
  });
}

function pdfMonthlyChart(doc, rows, sales) {
  const values = groupChartRows(rows, "month", sales).slice(-12);
  const max = Math.max(
    1,
    ...values.flatMap((value) =>
      sales ? [value.income] : [value.income, value.expense],
    ),
  );
  const left = 38;
  const top = 55;
  const chartW = 221;
  const chartH = 82;
  const baseline = top + chartH;
  doc.setDrawColor(223, 220, 230);
  doc.setLineWidth(0.25);
  [0, 0.25, 0.5, 0.75, 1].forEach((fraction) => {
    const y = baseline - fraction * chartH;
    doc.line(left, y, left + chartW, y);
    pdfText(doc, money(max * fraction), left - 3, y + 1, {
      size: 6.5,
      color: [119, 115, 134],
      align: "right",
    });
  });
  if (!values.length) {
    pdfText(doc, "Não há registros no período selecionado.", 148.5, 98, {
      size: 12,
      color: [119, 115, 134],
      align: "center",
    });
    return;
  }
  const groupW = chartW / values.length;
  const barW = Math.min(12, groupW * (sales ? 0.48 : 0.34));
  values.forEach((value, index) => {
    const center = left + groupW * (index + 0.5);
    const firstX = center - (sales ? barW / 2 : barW + 1);
    const incomeH = (value.income / max) * chartH;
    doc.setFillColor(119, 96, 207);
    doc.roundedRect(firstX, baseline - incomeH, barW, incomeH, 1.2, 1.2, "F");
    if (!sales) {
      const expenseH = (value.expense / max) * chartH;
      doc.setFillColor(233, 163, 111);
      doc.roundedRect(
        center + 1,
        baseline - expenseH,
        barW,
        expenseH,
        1.2,
        1.2,
        "F",
      );
    }
    if (values.length <= 8 || index % Math.ceil(values.length / 8) === 0) {
      pdfText(doc, monthName(value.key), center, baseline + 7, {
        size: 7,
        color: [119, 115, 134],
        align: "center",
      });
    }
  });
  const legendY = 158;
  const legendStart = sales ? 134 : 111;
  doc.setFillColor(119, 96, 207);
  doc.circle(legendStart, legendY - 1.3, 1.6, "F");
  pdfText(doc, sales ? "Vendas" : "Receitas", legendStart + 4, legendY, {
    size: 8,
    color: [119, 115, 134],
  });
  if (!sales) {
    doc.setFillColor(233, 163, 111);
    doc.circle(151, legendY - 1.3, 1.6, "F");
    pdfText(doc, "Despesas", 155, legendY, {
      size: 8,
      color: [119, 115, 134],
    });
  }
}

function pdfCategories(doc, rows, sales) {
  const categories = groupChartRows(rows, "category", sales)
    .map(({ key, income, expense }) => ({
      key,
      amount: sales ? income : expense,
    }))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const max = Math.max(1, ...categories.map(({ amount }) => amount));
  const x = 77;
  const width = 145;
  const firstY = 51;
  const rowH = 15;
  if (!categories.length) {
    pdfText(doc, "Não há valores para detalhar neste período.", 148.5, 105, {
      size: 12,
      color: [119, 115, 134],
      align: "center",
    });
    return;
  }
  categories.forEach(({ key, amount }, index) => {
    const y = firstY + index * rowH;
    pdfText(doc, key, x - 7, y + 4, {
      size: 8,
      color: [41, 38, 58],
      align: "right",
    });
    doc.setFillColor(239, 236, 246);
    doc.roundedRect(x, y, width, 6, 2, 2, "F");
    doc.setFillColor(...(sales ? [119, 96, 207] : [233, 163, 111]));
    doc.roundedRect(x, y, Math.max(1, (amount / max) * width), 6, 2, 2, "F");
    pdfText(doc, money(amount), x + width + 7, y + 4, {
      size: 8,
      color: [119, 115, 134],
    });
  });
}

function pdfFinancialInsights(doc, rows, stats) {
  const categoryTotals = groupChartRows(rows, "category")
    .map(({ key, expense }) => ({ key, amount: expense }))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const months = groupChartRows(rows, "month");
  const monthlyChange = months.length > 1
    ? months.at(-1).expense - months.at(-2).expense
    : null;
  const largestExpense = rows
    .filter((row) => row.type === "despesa")
    .sort((a, b) => b.amount - a.amount)[0];
  const share = stats.income ? (stats.expense / stats.income) * 100 : null;
  const cards = [];

  cards.push({
    title: share === null ? "Inclua receitas para ampliar a análise" : "Peso das despesas nas receitas",
    detail: share === null
      ? "Com entradas registradas, fica mais fácil entender quanto dos recebimentos está sendo usado nos gastos."
      : `As despesas correspondem a ${share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% das receitas. ${share > 85 ? "Revise custos recorrentes e avalie oportunidades de renegociação." : share > 60 ? "Acompanhe os principais custos para preservar seu saldo." : "Neste período, as despesas estão abaixo das receitas registradas."}`,
  });
  if (categoryTotals[0]) {
    const top = categoryTotals[0];
    const concentration = stats.expense ? (top.amount / stats.expense) * 100 : 0;
    cards.push({
      title: `Maior categoria: ${top.key}`,
      detail: `${money(top.amount)} (${concentration.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos gastos). Confira os lançamentos e avalie se há custos que podem ser reduzidos.`,
    });
  }
  if (largestExpense) {
    cards.push({
      title: "Maior lançamento individual",
      detail: `${largestExpense.description} — ${largestExpense.category}: ${money(largestExpense.amount)}. Revise se o valor e a classificação estão corretos.`,
    });
  }
  if (monthlyChange !== null) {
    cards.push({
      title: monthlyChange > 0 ? "Despesas aumentaram no mês mais recente" : monthlyChange < 0 ? "Despesas diminuíram no mês mais recente" : "Despesas estáveis no mês mais recente",
      detail: monthlyChange === 0
        ? "O total ficou igual ao mês anterior. Confira as categorias para entender a composição dos gastos."
        : `Variação de ${money(Math.abs(monthlyChange))} em relação ao mês anterior. Compare os lançamentos recentes para identificar o que mudou.`,
    });
  }
  if (!categoryTotals.length && share === null) {
    cards.push({
      title: "Sem despesas no período",
      detail: "Adicione registros de despesas para ver categorias de maior peso e tendências de gastos.",
    });
  }

  const x = 38;
  const width = 221;
  const top = 47;
  const rowHeight = cards.length > 3 ? 32 : 39;
  const gap = 4;
  cards.slice(0, 4).forEach(({ title, detail }, index) => {
    const y = top + index * (rowHeight + gap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(232, 229, 239);
    doc.roundedRect(x, y, width, rowHeight, 3, 3, "FD");
    doc.setFillColor(...(index === 1 ? [233, 163, 111] : [119, 96, 207]));
    doc.roundedRect(x, y, 2, rowHeight, 1, 1, "F");
    pdfText(doc, title, x + 9, y + 11, { bold: true, size: 9 });
    const lines = doc.splitTextToSize(detail, width - 20).slice(0, 2);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(119, 115, 134);
    doc.text(lines, x + 9, y + 19);
  });
}

export function exportPdf({ rows, sales, period }) {
  const data = reportData(rows, sales);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setFillColor(119, 96, 207);
  doc.rect(0, 0, width, 64, "F");
  pdfText(doc, "GESTÃO TECH  /  PAINEL EXECUTIVO", width / 2, 18, {
    bold: true,
    size: 8,
    color: [231, 225, 248],
    align: "center",
  });
  pdfText(doc, sales ? "Visão de vendas" : "Visão financeira", width / 2, 39, {
    bold: true,
    size: 25,
    color: [255, 255, 255],
    align: "center",
  });
  pdfText(doc, periodName(period), width / 2, 52, {
    size: 11,
    color: [242, 239, 250],
    align: "center",
  });
  const gap = 8;
  const cardW = 78;
  const x0 = (width - (cardW * 3 + gap * 2)) / 2;
  data.metrics.forEach(([title, value], index) => {
    pdfMetricCard(
      doc,
      x0 + index * (cardW + gap),
      82,
      cardW,
      48,
      title,
      value,
      [[119, 96, 207], [233, 163, 111], [85, 157, 144]][index],
    );
  });
  pdfText(
    doc,
    `${rows.length} registros analisados  ·  Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    width / 2,
    height - 25,
    { size: 8, color: [119, 115, 134], align: "center" },
  );

  doc.addPage("a4", "landscape");
  pdfSlideBase(
    doc,
    "Evolução mensal",
    sales ? "Receita registrada em cada mês" : "Comparação entre receitas e despesas",
    periodName(period),
    2,
  );
  pdfMonthlyChart(doc, rows, sales);

  doc.addPage("a4", "landscape");
  pdfSlideBase(
    doc,
    sales ? "Vendas por categoria" : "Sugestões e análises",
    sales
      ? "Categorias com maior participação na receita"
      : "Leituras para ajudar você a entender os gastos",
    periodName(period),
    3,
  );
  if (sales) pdfCategories(doc, rows, true);
  else pdfFinancialInsights(doc, rows, data.stats);

  doc.save(`gestao-tech-${sales ? "vendas" : "financeiro"}.pdf`);
}
