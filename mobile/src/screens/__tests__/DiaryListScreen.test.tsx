import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { DiaryListScreen } from "../DiaryListScreen";
import { usePublicationStore } from "../../store/publicationStore";
import { useAuthStore } from "../../store/authStore";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("../../store/publicationStore");
jest.mock("../../store/authStore");

const mockPublication = {
  id: "pub-1",
  doeId: 1234,
  edition: "6991",
  publishedDate: "2025-01-20",
  pdfUrl: "https://example.com/pdf/1234",
  thumbnailUrl: null,
  pageCount: 42,
  title: "Edição 6991",
  content: null,
  supplement: false,
};

function setupMocks(overrides: Partial<ReturnType<typeof usePublicationStore>> = {}) {
  const defaults = {
    publications: [],
    isLoading: false,
    isRefreshing: false,
    hasMore: false,
    error: null,
    load: jest.fn(),
    loadMore: jest.fn(),
    refresh: jest.fn(),
    loadCached: jest.fn(),
  };

  (usePublicationStore as unknown as jest.Mock).mockImplementation((selector) => {
    const state = { ...defaults, ...overrides };
    return selector ? selector(state) : state;
  });

  (useAuthStore as unknown as jest.Mock).mockImplementation((selector) => {
    const state = { token: "test-token", user: { id: "user-1", name: "Test" } };
    return selector ? selector(state) : state;
  });

  return defaults;
}

describe("DiaryListScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state when loading with no data", () => {
    setupMocks({ isLoading: true, publications: [] });
    const { getByText } = render(<DiaryListScreen />);
    expect(getByText("Carregando diários...")).toBeTruthy();
  });

  it("renders error state with retry button", () => {
    const mocks = setupMocks({ error: "Network error", publications: [] });
    const { getByText } = render(<DiaryListScreen />);
    expect(getByText("Network error")).toBeTruthy();
    fireEvent.press(getByText("Tentar novamente"));
    expect(mocks.load).toHaveBeenCalledWith("test-token");
  });

  it("renders empty state when no publications", () => {
    setupMocks({ publications: [] });
    const { getByText } = render(<DiaryListScreen />);
    expect(getByText("Nenhum diário disponível")).toBeTruthy();
  });

  it("renders publication cards", () => {
    setupMocks({ publications: [mockPublication] });
    const { getByText } = render(<DiaryListScreen />);
    expect(getByText("Edição 6991")).toBeTruthy();
    expect(getByText("42 páginas")).toBeTruthy();
  });

  it("navigates to DiaryViewer on card press", () => {
    setupMocks({ publications: [mockPublication] });
    const { getByText } = render(<DiaryListScreen />);
    fireEvent.press(getByText("Edição 6991"));
    expect(mockNavigate).toHaveBeenCalledWith("DiaryViewer", {
      publicationId: "pub-1",
      pdfUrl: "https://example.com/pdf/1234",
      title: "Edição 6991",
    });
  });

  it("calls loadCached and load on mount", () => {
    const mocks = setupMocks();
    render(<DiaryListScreen />);
    expect(mocks.loadCached).toHaveBeenCalled();
    expect(mocks.load).toHaveBeenCalledWith("test-token");
  });
});
