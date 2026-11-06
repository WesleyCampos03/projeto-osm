import { groupChartRows, money, summarize } from "./data.js";

export const palette = {
  ink: "29263A",
  muted: "777386",
  purple: "7760CF",
  softPurple: "F1EEFA",
  orange: "E9A36F",
  green: "559D90",
  blue: "7895D0",
  line: "E8E5EF",
  paper: "F8F7FB",
  white: "FFFFFF",
};

export function periodName(period) {
  if (period === "todos") return "Todo o período";
  return new Date(`${period}-02T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

export function monthName(month) {
  return new Date(`${month}-02T12:00:00`).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

export function reportData(rows, sales) {
  const stats = summarize(rows);
  const months = groupChartRows(rows, "month", sales).slice(-12);
  const categories = groupChartRows(rows, "category", sales)
    .map(({ key, income, expense }) => ({
      key,
      amount: sales ? income : expense,
    }))
    .filter(({ amount }) => amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)
    .reverse();
  return {
    stats,
    months,
    categories,
    metrics: sales
      ? [
          ["Ganhos com vendas", money(stats.income)],
          ["Vendas registradas", String(stats.count)],
          ["Ticket médio", money(stats.ticket)],
        ]
      : [
          ["Ganhos", money(stats.income)],
          ["Gastos", money(stats.expense)],
          ["Saldo", money(stats.balance)],
        ],
  };
}

export function financialInsights(rows, stats = summarize(rows)) {
  const expenseCategories = groupChartRows(rows, "category")
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
  const expenseShare = stats.income ? (stats.expense / stats.income) * 100 : null;
  const insights = [{
    title: expenseShare === null ? "Inclua ganhos para ampliar a análise" : "Peso dos gastos nos ganhos",
    detail: expenseShare === null
      ? "Com ganhos registrados, fica mais fácil entender quanto do dinheiro recebido está sendo usado nos gastos."
      : `Os gastos correspondem a ${expenseShare.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos ganhos. ${expenseShare > 85 ? "Revise custos recorrentes e avalie oportunidades de renegociação." : expenseShare > 60 ? "Acompanhe os principais custos para preservar seu saldo." : "Neste período, os gastos estão abaixo dos ganhos registrados."}`,
  }];

  if (expenseCategories[0]) {
    const top = expenseCategories[0];
    const share = stats.expense ? (top.amount / stats.expense) * 100 : 0;
    insights.push({
      title: `Maior categoria: ${top.key}`,
      detail: `${money(top.amount)} (${share.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% dos gastos). Confira os lançamentos e avalie se há custos que podem ser reduzidos.`,
    });
  }

  if (largestExpense) {
    const sameCategory = largestExpense.description.localeCompare(
      largestExpense.category,
      "pt-BR",
      { sensitivity: "base" },
    ) === 0;
    const date = new Date(`${largestExpense.date}T12:00:00`).toLocaleDateString(
      "pt-BR",
      { day: "numeric", month: "long", year: "numeric" },
    );
    insights.push({
      title: "Maior gasto deste período",
      detail: `${largestExpense.description} · ${money(largestExpense.amount)} · ${date}${sameCategory ? ". Confira se este gasto era esperado." : ` · Categoria: ${largestExpense.category}. Confira se o lançamento está classificado corretamente.`}`,
    });
  }

  if (monthlyChange !== null) {
    insights.push({
      title: monthlyChange > 0 ? "Gastos aumentaram no mês mais recente" : monthlyChange < 0 ? "Gastos diminuíram no mês mais recente" : "Gastos estáveis no mês mais recente",
      detail: monthlyChange === 0
        ? "O total ficou igual ao mês anterior. Confira as categorias para entender a composição dos gastos."
        : `Variação de ${money(Math.abs(monthlyChange))} em relação ao mês anterior. Compare os lançamentos recentes para identificar o que mudou.`,
    });
  }

  if (!expenseCategories.length && expenseShare === null) {
    insights.push({
      title: "Sem gastos no período",
      detail: "Adicione registros de gastos para ver categorias de maior peso e tendências.",
    });
  }

  return insights.slice(0, 4);
}

