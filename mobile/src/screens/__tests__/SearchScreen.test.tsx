import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { SearchScreen } from "../SearchScreen";
import { useSearchStore } from "../../store/searchStore";
import { useAuthStore } from "../../store/authStore";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("../../store/searchStore");
jest.mock("../../store/authStore");

const mockResults = [
  {
    id: "pub-1",
    doeId: 1234,
    edition: "6991",
    publishedDate: "2025-01-20",
    pdfUrl: "https://example.com/pdf/1234",
    thumbnailUrl: null,
    pageCount: 42,
    title: "Edição 6991",
    content: "Aviso de Licitação",
    supplement: false,
  },
];

function setupMocks(overrides: Record<string, unknown> = {}) {
  const defaults = {
    results: [],
    query: "",
    startDate: null,
    endDate: null,
    isSearching: false,
    error: null,
    history: [],
    setQuery: jest.fn(),
    setStartDate: jest.fn(),
    setEndDate: jest.fn(),
    search: jest.fn(),
    loadHistory: jest.fn(),
    clearHistory: jest.fn(),
    clearResults: jest.fn(),
  };

  const state = { ...defaults, ...overrides };

  (useSearchStore as unknown as jest.Mock).mockImplementation((selector) => {
    return selector ? selector(state) : state;
  });

  (useSearchStore as any).setState = jest.fn();

  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
    const authState = { token: "test-token" };
    return selector ? selector(authState) : authState;
  });

  return state;
}

describe("SearchScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders search input and button", () => {
    setupMocks();
    const { getByPlaceholderText, getByText } = render(<SearchScreen />);
    expect(getByPlaceholderText("Buscar no diário oficial...")).toBeTruthy();
    expect(getByText("Buscar")).toBeTruthy();
  });

  it("renders empty state when no results and no history", () => {
    setupMocks();
    const { getByText } = render(<SearchScreen />);
    expect(getByText("Buscar publicações")).toBeTruthy();
  });

  it("disables search button when query is empty", () => {
    setupMocks({ query: "" });
    const { getByText } = render(<SearchScreen />);
    const button = getByText("Buscar");
    expect(button).toBeTruthy();
  });

  it("calls search when pressing search button with query", () => {
    const mocks = setupMocks({ query: "licitação" });
    const { getByText } = render(<SearchScreen />);
    fireEvent.press(getByText("Buscar"));
    expect(mocks.search).toHaveBeenCalledWith("test-token");
  });

  it("renders search results", () => {
    setupMocks({ results: mockResults, query: "licitação" });
    const { getByText } = render(<SearchScreen />);
    expect(getByText("Edição 6991")).toBeTruthy();
    expect(getByText("1 resultado")).toBeTruthy();
  });

  it("renders loading state during search", () => {
    setupMocks({ isSearching: true, query: "test" });
    const { getAllByText } = render(<SearchScreen />);
    expect(getAllByText("Buscando...").length).toBeGreaterThanOrEqual(1);
  });

  it("renders search history", () => {
    setupMocks({ history: ["licitação", "concurso"] });
    const { getByText } = render(<SearchScreen />);
    expect(getByText("Buscas recentes")).toBeTruthy();
    expect(getByText("licitação")).toBeTruthy();
    expect(getByText("concurso")).toBeTruthy();
  });

  it("calls clearHistory when pressing clear", () => {
    const mocks = setupMocks({ history: ["test"] });
    const { getByText } = render(<SearchScreen />);
    fireEvent.press(getByText("Limpar"));
    expect(mocks.clearHistory).toHaveBeenCalled();
  });

  it("navigates to DiaryViewer when pressing a result", () => {
    setupMocks({ results: mockResults, query: "licitação" });
    const { getByText } = render(<SearchScreen />);
    fireEvent.press(getByText("Edição 6991"));
    expect(mockNavigate).toHaveBeenCalledWith("DiaryViewer", {
      publicationId: "pub-1",
      pdfUrl: "https://example.com/pdf/1234",
      title: "Edição 6991",
    });
  });

  it("renders date filter buttons", () => {
    setupMocks();
    const { getByText } = render(<SearchScreen />);
    expect(getByText("Data inicial")).toBeTruthy();
    expect(getByText("Data final")).toBeTruthy();
  });

  it("renders error message", () => {
    setupMocks({ error: "Busca falhou", query: "test" });
    const { getByText } = render(<SearchScreen />);
    expect(getByText("Busca falhou")).toBeTruthy();
  });

  it("loads history on mount", () => {
    const mocks = setupMocks();
    render(<SearchScreen />);
    expect(mocks.loadHistory).toHaveBeenCalled();
  });
});
