const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Faqat keraksiz vaqtinchalik fayllarni block listga qo'shamiz
config.resolver.blockList = [
  /\.local\/.*/,       // Replit-ning ichki .local fayllari
  /\.tmp-.*/,          // Vaqtinchalik fayllar
  // node_modules-ni bu yerdan olib tashladik!
];

// Replit-da barqaror ishlashi uchun watchFolders-ni avtomatik aniqlashga qo'yib beramiz
config.watchFolders = [__dirname];

// Agar sizda SVG yoki boshqa maxsus fayllar bo'lsa, quyidagilarni ham qo'shish mumkin:
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

module.exports = config;