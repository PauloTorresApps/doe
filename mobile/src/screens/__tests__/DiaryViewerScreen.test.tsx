import React from "react";
import { render } from "@testing-library/react-native";
import { DiaryViewerScreen } from "../DiaryViewerScreen";

jest.mock("react-native-pdf", () => {
  const RN = require("react");
  return {
    __esModule: true,
    default: (props: any) => {
      RN.useEffect(() => {
        if (props.onLoadComplete) props.onLoadComplete(10);
      }, []);
      return RN.createElement("Pdf", props);
    },
  };
});

const mockRoute = {
  params: {
    publicationId: "pub-1",
    pdfUrl: "https://example.com/test.pdf",
    title: "Edição 6991",
  },
} as any;

const mockNavigation = {} as any;

describe("DiaryViewerScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders page indicator after PDF loads", () => {
    const { getByText } = render(
      <DiaryViewerScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(getByText("1 / 10")).toBeTruthy();
  });

  it("renders without crashing", () => {
    const { toJSON } = render(
      <DiaryViewerScreen navigation={mockNavigation} route={mockRoute} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
