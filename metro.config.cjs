const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Keraksiz vaqtinchalik fayllarni kuzatishdan chiqarib tashlash
config.resolver.blockList = [
  /\.local\/.*/,       // Replit-ning ichki .local fayllari
  /\.tmp-.*/,          // Vaqtinchalik fayllar
];

// Loyiha papkasini kuzatish
config.watchFolders = [__dirname];

// Qoʻshimcha fayl kengaytmalarini qoʻshish
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;