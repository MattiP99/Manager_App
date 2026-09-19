module.exports = {
  preset: 'jest-expo/node',
  transformIgnorePatterns: [
    'node_modules/(?!(@noble|@react-native-async-storage|@supabase|@tanstack|expo.*|react-native.*|@react-navigation)/)',
  ],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
