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
          ["Receita de vendas", money(stats.income)],
          ["Vendas registradas", String(stats.count)],
          ["Ticket médio", money(stats.ticket)],
        ]
      : [
          ["Receitas", money(stats.income)],
          ["Despesas", money(stats.expense)],
          ["Saldo", money(stats.balance)],
        ],
  };
}

