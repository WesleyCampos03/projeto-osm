/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "../src/App.jsx";
import { exampleRows } from "../src/data.js";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("gestao-tech-data-v1", JSON.stringify(exampleRows));
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: vi.fn(function () {
      this.setAttribute("open", "");
    }),
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: vi.fn(function () {
      this.removeAttribute("open");
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("dashboard and data filters", () => {
  it("compares the selected months and updates when the model changes", () => {
    render(<App />);

    const table = screen.getByRole("table");
    const incomeRow = within(table).getByRole("row", { name: /Receitas/ });
    expect(incomeRow.textContent).toContain("7.500,00");
    expect(incomeRow.textContent).toContain("9.200,00");
    expect(incomeRow.textContent).toContain("1.700,00");

    fireEvent.change(screen.getByLabelText("Período A"), {
      target: { value: "2026-08" },
    });
    fireEvent.change(screen.getByLabelText("Período B"), {
      target: { value: "2026-09" },
    });
    expect(incomeRow.textContent).toContain("6.900,00");
    expect(incomeRow.textContent).toContain("7.500,00");

    fireEvent.click(screen.getByRole("button", { name: "Vendas" }));
    const salesRow = within(table).getByRole("row", {
      name: /Receita de vendas/,
    });
    expect(salesRow.textContent).toContain("6.900,00");
    expect(within(table).getByRole("row", { name: /Ticket médio/ }).textContent)
      .toContain("2.300,00");
  });

  it("combines the category filter with the text search", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Meus dados" }));
    fireEvent.change(screen.getByLabelText("Filtrar por categoria"), {
      target: { value: "Produtos" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("Buscar descrição ou categoria…"),
      { target: { value: "acessórios" } },
    );

    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getAllByText("Venda de acessórios")).toHaveLength(4);
    expect(screen.queryByText("Venda de camisetas")).toBeNull();
    expect(screen.queryByText("Aluguel")).toBeNull();
  });

  it("does not overwrite unreadable saved data until replacement is confirmed", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage is unavailable");
    });
    render(<App />);

    expect(screen.getByRole("alert").textContent).toContain(
      "preservados sem alterações",
    );
    expect(setItem).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Continuar e substituir" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(setItem).toHaveBeenCalledWith(
      "gestao-tech-data-v1",
      "[]",
    );
  });
});
