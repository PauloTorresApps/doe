export type RootStackParamList = {
  Main: undefined;
  DiaryList: undefined;
  DiaryViewer: {
    publicationId: string;
    pdfUrl: string;
    title: string;
  };
  Keywords: undefined;
  Search: undefined;
  Profile: undefined;
  Login: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  ProfileTab: undefined;
};
