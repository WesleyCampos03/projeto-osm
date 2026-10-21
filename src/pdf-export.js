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
  pdfText(doc, "GESTÃO TECH  /  PAINEL EXECUTIVO", 16, 12, {
    bold: true,
    size: 8,
    color: [119, 96, 207],
  });
  pdfText(doc, title, 16, 25, { bold: true, size: 21 });
  pdfText(doc, subtitle, 16, 33, { size: 10, color: [119, 115, 134] });
  doc.setDrawColor(232, 229, 239);
  doc.line(16, height - 13, width - 16, height - 13);
  pdfText(doc, `GESTÃO TECH  ·  ${period}`, 16, height - 7, {
    size: 7,
    color: [119, 115, 134],
  });
  pdfText(doc, String(page).padStart(2, "0"), width - 16, height - 7, {
    bold: true,
    size: 8,
    color: [119, 96, 207],
    align: "right",
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
  const left = 36;
  const top = 55;
  const chartW = 245;
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
  const legendY = 151;
  doc.setFillColor(119, 96, 207);
  doc.circle(112, legendY - 1.3, 1.6, "F");
  pdfText(doc, sales ? "Vendas" : "Receitas", 116, legendY, {
    size: 8,
    color: [119, 115, 134],
  });
  if (!sales) {
    doc.setFillColor(233, 163, 111);
    doc.circle(150, legendY - 1.3, 1.6, "F");
    pdfText(doc, "Despesas", 154, legendY, {
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
  const x = 82;
  const width = 192;
  const firstY = 54;
  const rowH = 12;
  if (!categories.length) {
    pdfText(doc, "Não há valores para detalhar por categoria.", 148.5, 98, {
      size: 12,
      color: [119, 115, 134],
      align: "center",
    });
    return;
  }
  categories.forEach(({ key, amount }, index) => {
    const y = firstY + index * rowH;
    pdfText(doc, key, x - 5, y + 4, {
      size: 8,
      color: [41, 38, 58],
      align: "right",
    });
    doc.setFillColor(239, 236, 246);
    doc.roundedRect(x, y, width, 6, 2, 2, "F");
    doc.setFillColor(...(sales ? [119, 96, 207] : [233, 163, 111]));
    doc.roundedRect(x, y, Math.max(1, (amount / max) * width), 6, 2, 2, "F");
    pdfText(doc, money(amount), x + width + 4, y + 4, {
      size: 7.5,
      color: [119, 115, 134],
    });
  });
}

export function exportPdf({ rows, sales, period }) {
  const data = reportData(rows, sales);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [297, 167.06] });
  const width = 297;
  doc.setFillColor(119, 96, 207);
  doc.rect(0, 0, width, 57, "F");
  pdfText(doc, "GESTÃO TECH  /  PAINEL EXECUTIVO", 16, 16, {
    bold: true,
    size: 8,
    color: [231, 225, 248],
  });
  pdfText(doc, sales ? "Visão de vendas" : "Visão financeira", 16, 34, {
    bold: true,
    size: 25,
    color: [255, 255, 255],
  });
  pdfText(doc, periodName(period), 16, 46, {
    size: 11,
    color: [242, 239, 250],
  });
  const gap = 7;
  const x0 = 16;
  const cardW = (width - x0 * 2 - gap * 2) / 3;
  data.metrics.forEach(([title, value], index) => {
    pdfMetricCard(
      doc,
      x0 + index * (cardW + gap),
      72,
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
    16,
    145,
    { size: 8, color: [119, 115, 134] },
  );

  doc.addPage([297, 167.06], "landscape");
  pdfSlideBase(
    doc,
    "Evolução mensal",
    sales ? "Receita registrada em cada mês" : "Comparação entre receitas e despesas",
    periodName(period),
    2,
  );
  pdfMonthlyChart(doc, rows, sales);

  doc.addPage([297, 167.06], "landscape");
  pdfSlideBase(
    doc,
    sales ? "Vendas por categoria" : "Despesas por categoria",
    sales
      ? "Categorias com maior participação na receita"
      : "Categorias com maior participação nas despesas",
    periodName(period),
    3,
  );
  pdfCategories(doc, rows, sales);

  doc.save(`gestao-tech-${sales ? "vendas" : "financeiro"}.pdf`);
}
