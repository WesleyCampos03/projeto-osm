import pptxgen from "pptxgenjs";
import { palette, periodName, monthName, reportData } from "./presentation-utils.js";

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
  const addFooter = (slide, page) => {
    slide.addText(`GESTÃO TECH  ·  ${periodName(period)}`, {
      x: 0.55,
      y: 7.12,
      w: 9,
      h: 0.18,
      fontFace: "Aptos",
      fontSize: 8,
      color: palette.muted,
      margin: 0,
    });
    slide.addText(String(page).padStart(2, "0"), {
      x: 12.15,
      y: 7.08,
      w: 0.55,
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
      x: 0.65,
      y: 0.45,
      w: 11.8,
      h: 0.2,
      fontFace: "Aptos",
      fontSize: 9,
      bold: true,
      charSpacing: 1.4,
      color: palette.purple,
      margin: 0,
    });
    slide.addText(title, {
      x: 0.65,
      y: 0.78,
      w: 12,
      h: 0.48,
      fontFace: "Aptos Display",
      fontSize: 25,
      bold: true,
      color: palette.ink,
      margin: 0,
    });
    slide.addText(subtitle, {
      x: 0.65,
      y: 1.34,
      w: 12,
      h: 0.3,
      fontFace: "Aptos",
      fontSize: 11,
      color: palette.muted,
      margin: 0,
    });
  };

  const cover = pptx.addSlide();
  cover.background = { color: palette.paper };
  cover.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 2.55,
    line: { color: palette.purple, transparency: 100 },
    fill: { color: palette.purple },
  });
  cover.addText("GESTÃO TECH  /  PAINEL EXECUTIVO", {
    x: 0.68,
    y: 0.48,
    w: 8.5,
    h: 0.22,
    fontFace: "Aptos",
    fontSize: 10,
    bold: true,
    charSpacing: 1.4,
    color: "E7E1F8",
    margin: 0,
  });
  cover.addText(sales ? "Visão de vendas" : "Visão financeira", {
    x: 0.68,
    y: 0.92,
    w: 9.5,
    h: 0.72,
    fontFace: "Aptos Display",
    fontSize: 33,
    bold: true,
    color: palette.white,
    margin: 0,
  });
  cover.addText(periodName(period), {
    x: 0.7,
    y: 1.84,
    w: 8,
    h: 0.28,
    fontFace: "Aptos",
    fontSize: 13,
    color: "F2EFFA",
    margin: 0,
  });
  const metricX = 0.68;
  const metricGap = 0.24;
  const metricW = (12 - metricGap * 2) / 3;
  data.metrics.forEach(([label, value], index) => {
    const x = metricX + index * (metricW + metricGap);
    cover.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 3.18,
      w: metricW,
      h: 2.05,
      rectRadius: 0.12,
      line: { color: palette.line, pt: 1 },
      fill: { color: palette.white },
    });
    cover.addText(label.toUpperCase(), {
      x: x + 0.25,
      y: 3.52,
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
      y: 4.02,
      w: metricW - 0.5,
      h: 0.55,
      fontFace: "Aptos Display",
      fontSize: value.length > 17 ? 22 : 27,
      bold: true,
      color: palette.ink,
      margin: 0,
      fit: "shrink",
    });
  });
  cover.addText(
    `${rows.length} registros analisados  ·  Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    {
      x: 0.7,
      y: 6.55,
      w: 11.6,
      h: 0.25,
      fontFace: "Aptos",
      fontSize: 10,
      color: palette.muted,
      margin: 0,
    },
  );
  addFooter(cover, 1);

  const evolution = pptx.addSlide();
  evolution.background = { color: palette.white };
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
      x: 0.78,
      y: 1.9,
      w: 11.75,
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
      chartArea: { fill: { color: palette.white }, border: { color: palette.white, pt: 0 } },
      plotArea: { fill: { color: palette.white }, border: { color: palette.white, pt: 0 } },
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
    "Composição",
    sales ? "Vendas por categoria" : "Despesas por categoria",
    sales
      ? "Categorias com maior participação na receita"
      : "Categorias com maior participação nas despesas",
  );
  if (data.categories.length) {
    breakdown.addChart(
      pptx.ChartType.bar,
      [
        {
          name: sales ? "Vendas" : "Despesas",
          labels: data.categories.map(({ key }) => key),
          values: data.categories.map(({ amount }) => amount),
        },
      ],
      {
        x: 0.85,
        y: 1.85,
        w: 11.55,
        h: 4.65,
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
        chartColors: [sales ? palette.purple : palette.orange],
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
      w: 11,
      h: 0.4,
      align: "center",
      fontSize: 16,
      color: palette.muted,
    });
  }
  addFooter(breakdown, 3);

  const fileName = `gestao-tech-${sales ? "vendas" : "financeiro"}.pptx`;
  await pptx.writeFile({ fileName });
}

