import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { KeywordManagementScreen } from "../KeywordManagementScreen";
import { useKeywordStore } from "../../store/keywordStore";
import { useAuthStore } from "../../store/authStore";

jest.mock("../../store/keywordStore");
jest.mock("../../store/authStore");

const mockKeywords = [
  { id: "kw-1", expression: "licitação", userId: "user-1", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "kw-2", expression: "concurso", userId: "user-1", createdAt: "2025-01-02", updatedAt: "2025-01-02" },
];

function setupMocks(overrides: Record<string, unknown> = {}) {
  const defaults = {
    keywords: [],
    isLoading: false,
    error: null,
    load: jest.fn(),
    add: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    clearError: jest.fn(),
  };

  const state = { ...defaults, ...overrides };

  (useKeywordStore as unknown as jest.Mock).mockImplementation((selector) => {
    return selector ? selector(state) : state;
  });

  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
    const authState = { token: "test-token", user: { id: "user-1" } };
    return selector ? selector(authState) : authState;
  });

  return state;
}

describe("KeywordManagementScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state when loading with no data", () => {
    setupMocks({ isLoading: true, keywords: [] });
    const { getByText } = render(<KeywordManagementScreen />);
    expect(getByText("Carregando expressões...")).toBeTruthy();
  });

  it("renders empty state when no keywords", () => {
    setupMocks({ keywords: [] });
    const { getByText } = render(<KeywordManagementScreen />);
    expect(getByText("Nenhuma expressão cadastrada")).toBeTruthy();
  });

  it("displays keyword count", () => {
    setupMocks({ keywords: mockKeywords });
    const { getByText } = render(<KeywordManagementScreen />);
    expect(getByText("2/5 expressões")).toBeTruthy();
  });

  it("displays keywords in list", () => {
    setupMocks({ keywords: mockKeywords });
    const { getByText } = render(<KeywordManagementScreen />);
    expect(getByText("licitação")).toBeTruthy();
    expect(getByText("concurso")).toBeTruthy();
  });

  it("validates keyword minimum length", () => {
    setupMocks({ keywords: [] });
    const { getByPlaceholderText, getByText } = render(
      <KeywordManagementScreen />,
    );
    fireEvent.changeText(getByPlaceholderText("Nova expressão..."), "ab");
    fireEvent.press(getByText("Adicionar"));
    expect(getByText("A expressão deve ter pelo menos 3 caracteres")).toBeTruthy();
  });

  it("prevents adding more than 5 keywords", () => {
    const fiveKeywords = Array.from({ length: 5 }, (_, i) => ({
      id: `kw-${i}`,
      expression: `keyword${i}`,
      userId: "user-1",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-01",
    }));
    setupMocks({ keywords: fiveKeywords });
    const { getByPlaceholderText, getByText } = render(
      <KeywordManagementScreen />,
    );
    fireEvent.changeText(getByPlaceholderText("Nova expressão..."), "new keyword");
    fireEvent.press(getByText("Adicionar"));
    expect(getByText("Limite de 5 expressões atingido")).toBeTruthy();
  });

  it("calls add when submitting valid keyword", async () => {
    const mocks = setupMocks({ keywords: [] });
    const { getByPlaceholderText, getByText } = render(
      <KeywordManagementScreen />,
    );
    fireEvent.changeText(getByPlaceholderText("Nova expressão..."), "licitação");
    fireEvent.press(getByText("Adicionar"));
    await waitFor(() => {
      expect(mocks.add).toHaveBeenCalledWith("test-token", "licitação");
    });
  });

  it("shows delete confirmation dialog", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    setupMocks({ keywords: mockKeywords });
    const { getAllByText } = render(<KeywordManagementScreen />);
    const removeButtons = getAllByText("Remover");
    fireEvent.press(removeButtons[0]!);
    expect(alertSpy).toHaveBeenCalledWith(
      "Remover expressão",
      'Deseja remover "licitação"?',
      expect.any(Array),
    );
    alertSpy.mockRestore();
  });

  it("enters edit mode when pressing edit button", () => {
    setupMocks({ keywords: mockKeywords });
    const { getAllByText, getByDisplayValue, getByText } = render(
      <KeywordManagementScreen />,
    );
    fireEvent.press(getAllByText("Editar")[0]!);
    expect(getByDisplayValue("licitação")).toBeTruthy();
    expect(getByText("Salvar")).toBeTruthy();
    expect(getByText("Cancelar")).toBeTruthy();
  });

  it("loads keywords on mount", () => {
    const mocks = setupMocks({ keywords: [] });
    render(<KeywordManagementScreen />);
    expect(mocks.load).toHaveBeenCalledWith("test-token");
  });

  it("renders error state with retry", () => {
    const mocks = setupMocks({ error: "Failed to load", keywords: [] });
    const { getByText } = render(<KeywordManagementScreen />);
    expect(getByText("Failed to load")).toBeTruthy();
    fireEvent.press(getByText("Tentar novamente"));
    expect(mocks.clearError).toHaveBeenCalled();
  });
});
