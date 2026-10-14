module.exports = {
  plugins: [
    '@babel/plugin-transform-export-namespace-from',
    require('./plugins/replace-better-auth-import-meta'),
  ],
  presets: ['module:@react-native/babel-preset'],
};
