module.exports = {
  preset: 'react-native',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-community|react-native-pdf|react-native-blob-util|react-native-safe-area-context|react-native-screens|@react-native-async-storage|@testing-library|@invertase)/)',
  ],
  moduleNameMapper: {
    'react-native-pdf': '<rootDir>/__mocks__/react-native-pdf.js',
  },
};
