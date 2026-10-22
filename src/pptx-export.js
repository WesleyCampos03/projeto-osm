import pptxgen from "pptxgenjs";
import { financialInsights, palette, periodName, monthName, reportData } from "./presentation-utils.js";

export async function exportPowerPoint({ rows, sales, period }) {
  const data = reportData(rows, sales);
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Gestão Tech";
  pptx.subject = "Dashboard financeiro e de vendas";
  pptx.title = sales ? "Painel de vendas" : "Painel financeiro";
  pptx.company = "Gestão Tech";
  pptx.lang = "pt-BR";
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
    lang: "pt-BR",
  };
  const slideWidth = 13.333;
  const addFooter = (slide, page) => {
    slide.addText(`GESTÃO TECH  ·  ${periodName(period)}`, {
      x: 1.5,
      y: 7.12,
      w: 10.33,
      h: 0.18,
      fontFace: "Aptos",
      fontSize: 8,
      color: palette.muted,
      margin: 0,
      align: "center",
    });
    slide.addText(`${String(page).padStart(2, "0")} / 03`, {
      x: 12.05,
      y: 7.08,
      w: 0.75,
      h: 0.22,
      align: "right",
      fontFace: "Aptos",
      fontSize: 9,
      color: palette.purple,
      margin: 0,
    });
  };
  const addHeading = (slide, eyebrow, title, subtitle) => {
    slide.addText(eyebrow.toUpperCase(), {
      x: 0.8,
      y: 0.45,
      w: 11.73,
      h: 0.2,
      fontFace: "Aptos",
      fontSize: 9,
      bold: true,
      charSpacing: 1.4,
      color: palette.purple,
      margin: 0,
      align: "center",
    });
    slide.addText(title, {
      x: 0.8,
      y: 0.78,
      w: 11.73,
      h: 0.48,
      fontFace: "Aptos Display",
      fontSize: 25,
      bold: true,
      color: palette.ink,
      margin: 0,
      align: "center",
    });
    slide.addText(subtitle, {
      x: 0.8,
      y: 1.34,
      w: 11.73,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 11,
      color: palette.muted,
      margin: 0,
      align: "center",
    });
  };

  const cover = pptx.addSlide();
  cover.background = { color: palette.paper };
  cover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 2.28,
    line: { color: palette.purple, transparency: 100 },
    fill: { color: palette.purple },
  });
  cover.addText("GESTÃO TECH  /  PAINEL EXECUTIVO", {
    x: 0.8,
    y: 0.36,
    w: 11.73,
    h: 0.22,
    fontFace: "Aptos",
    fontSize: 10,
    bold: true,
    charSpacing: 1.4,
    color: "E7E1F8",
    margin: 0,
    align: "center",
  });
  cover.addText(sales ? "Visão de vendas" : "Visão financeira", {
    x: 0.8,
    y: 0.77,
    w: 11.73,
    h: 0.72,
    fontFace: "Aptos Display",
    fontSize: 32,
    bold: true,
    color: palette.white,
    margin: 0,
    align: "center",
  });
  cover.addText(periodName(period), {
    x: 0.8,
    y: 1.55,
    w: 11.73,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 13,
    color: "F2EFFA",
    margin: 0,
    align: "center",
  });
  const metricGap = 0.28;
  const metricW = 3.65;
  const metricX = (slideWidth - (metricW * 3 + metricGap * 2)) / 2;
  data.metrics.forEach(([label, value], index) => {
    const x = metricX + index * (metricW + metricGap);
    cover.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 2.92,
      w: metricW,
      h: 1.72,
      rectRadius: 0.12,
      line: { color: palette.line, pt: 1 },
      fill: { color: palette.white },
    });
    cover.addText(label.toUpperCase(), {
      x: x + 0.25,
      y: 3.24,
      w: metricW - 0.5,
      h: 0.25,
      fontFace: "Aptos",
      fontSize: 9,
      bold: true,
      charSpacing: 0.8,
      color: palette.muted,
      margin: 0,
    });
    cover.addText(value, {
      x: x + 0.25,
      y: 3.77,
      w: metricW - 0.5,
      h: 0.55,
      fontFace: "Aptos Display",
      fontSize: value.length > 17 ? 20 : 25,
      bold: true,
      color: palette.ink,
      margin: 0,
      fit: "shrink",
    });
  });
  cover.addText(
    `${rows.length} registros analisados  ·  Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    {
      x: 0.8,
      y: 6.52,
      w: 11.73,
      h: 0.25,
      fontFace: "Aptos",
      fontSize: 10,
      color: palette.muted,
      margin: 0,
      align: "center",
    },
  );
  addFooter(cover, 1);

  const evolution = pptx.addSlide();
  evolution.background = { color: palette.paper };
  addHeading(
    evolution,
    "Acompanhamento",
    "Evolução mensal",
    sales
      ? "Receita registrada em cada mês"
      : "Comparação entre receitas e despesas",
  );
  if (data.months.length) {
    const series = [
      {
        name: sales ? "Vendas" : "Receitas",
        labels: data.months.map(({ key }) => monthName(key)),
        values: data.months.map(({ income }) => income),
      },
      ...(!sales
        ? [
            {
              name: "Despesas",
              labels: data.months.map(({ key }) => monthName(key)),
              values: data.months.map(({ expense }) => expense),
            },
          ]
        : []),
    ];
    evolution.addChart(pptx.ChartType.bar, series, {
      x: 0.8,
      y: 1.9,
      w: 11.73,
      h: 4.55,
      catAxisLabelFontFace: "Aptos",
      catAxisLabelFontSize: 10,
      catAxisLabelColor: palette.muted,
      catAxisLineColor: palette.line,
      catAxisMajorTickMark: "none",
      valAxisLabelFontFace: "Aptos",
      valAxisLabelFontSize: 9,
      valAxisLabelColor: palette.muted,
      valAxisMinVal: 0,
      valAxisLabelFormatCode: '"R$" #,##0',
      valGridLine: { color: palette.line, width: 1 },
      chartColors: [palette.purple, palette.orange],
      showLegend: true,
      legendPos: "b",
      legendFontFace: "Aptos",
      legendFontSize: 10,
      legendColor: palette.muted,
      showValue: false,
      showTitle: false,
      showCatName: false,
      showValAxisTitle: false,
      showCatAxisTitle: false,
      showBorder: false,
      showMarker: true,
      chartArea: { fill: { color: palette.paper }, border: { color: palette.paper, pt: 0 } },
      plotArea: { fill: { color: palette.paper }, border: { color: palette.paper, pt: 0 } },
      showCatAxis: true,
      showValAxis: true,
      showGridLines: true,
      showDataLabel: false,
      showLabel: false,
    });
  } else {
    evolution.addText("Não há registros no período selecionado.", {
      x: 1,
      y: 3.5,
      w: 11,
      h: 0.4,
      align: "center",
      fontSize: 16,
      color: palette.muted,
    });
  }
  addFooter(evolution, 2);

  const breakdown = pptx.addSlide();
  breakdown.background = { color: palette.paper };
  addHeading(
    breakdown,
    sales ? "Composição" : "Leitura financeira",
    sales ? "Vendas por categoria" : "Sugestões e análises",
    sales
      ? "Categorias com maior participação na receita"
      : "Leituras para ajudar você a entender os gastos",
  );
  if (sales) {
    if (data.categories.length) {
      breakdown.addChart(
        pptx.ChartType.bar,
        [
          {
            name: "Vendas",
            labels: data.categories.map(({ key }) => key),
            values: data.categories.map(({ amount }) => amount),
          },
        ],
        {
          x: 0.8,
          y: 1.9,
          w: 11.73,
          h: 4.55,
          barDir: "bar",
          catAxisLabelFontFace: "Aptos",
          catAxisLabelFontSize: 11,
          catAxisLabelColor: palette.ink,
          catAxisLineShow: false,
          catAxisMajorTickMark: "none",
          valAxisLabelFontFace: "Aptos",
          valAxisLabelFontSize: 9,
          valAxisLabelColor: palette.muted,
          valAxisMinVal: 0,
          valAxisLabelFormatCode: '"R$" #,##0',
          valGridLine: { color: palette.line, width: 1 },
          chartColors: [palette.purple],
          showLegend: false,
          showValue: true,
          dataLabelPosition: "outEnd",
          dataLabelColor: palette.ink,
          dataLabelFormatCode: '"R$" #,##0',
          dataLabelFormat: "currency",
          chartArea: { fill: { color: palette.paper }, border: { color: palette.paper, pt: 0 } },
          plotArea: { fill: { color: palette.paper }, border: { color: palette.paper, pt: 0 } },
        },
      );
    } else {
      breakdown.addText("Não há valores para detalhar por categoria.", {
        x: 1,
        y: 3.5,
        w: 11.33,
        h: 0.4,
        align: "center",
        fontSize: 16,
        color: palette.muted,
      });
    }
  } else {
    const insights = financialInsights(rows, data.stats);
    const cardX = 1.04;
    const cardW = 11.25;
    const cardH = insights.length > 3 ? 0.96 : 1.08;
    const cardGap = 0.16;
    const startY = insights.length > 3 ? 1.83 : 2.05;
    insights.forEach(({ title, detail }, index) => {
      const y = startY + index * (cardH + cardGap);
      breakdown.addShape(pptx.ShapeType.roundRect, {
        x: cardX,
        y,
        w: cardW,
        h: cardH,
        rectRadius: 0.1,
        line: { color: palette.line, pt: 1 },
        fill: { color: palette.white },
      });
      breakdown.addShape(pptx.ShapeType.rect, {
        x: cardX + 0.16,
        y: y + 0.16,
        w: 0.045,
        h: cardH - 0.32,
        line: { color: index === 1 ? palette.orange : palette.purple, transparency: 100 },
        fill: { color: index === 1 ? palette.orange : palette.purple },
      });
      breakdown.addText(title, {
        x: cardX + 0.36,
        y: y + 0.16,
        w: cardW - 0.66,
        h: 0.23,
        fontFace: "Aptos",
        fontSize: 12,
        bold: true,
        color: palette.ink,
        margin: 0,
        fit: "shrink",
      });
      breakdown.addText(detail, {
        x: cardX + 0.36,
        y: y + 0.44,
        w: cardW - 0.66,
        h: cardH - 0.51,
        fontFace: "Aptos",
        fontSize: 10.5,
        color: palette.muted,
        margin: 0,
        valign: "mid",
        breakLine: false,
        fit: "shrink",
      });
    });
  }
  addFooter(breakdown, 3);

  const fileName = `gestao-tech-${sales ? "vendas" : "financeiro"}.pptx`;
  await pptx.writeFile({ fileName });
}

