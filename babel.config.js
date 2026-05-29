module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Worklets-plugin MOET als laatste staan — vereist door react-native-reanimated 4.
    plugins: ['react-native-worklets/plugin'],
  };
};
