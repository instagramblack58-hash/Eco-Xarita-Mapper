module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // ES module import meta bilan ishlash uchun kerak (agar "type": "module" bo'lsa)
          unstable_transformImportMeta: true,
        },
      ],
    ],
    plugins: [
      // React Compiler – agar ishlatmoqchi boʻlsangiz, quyidagi qatorni oching.
      // Eslatma: ba'zi hollarda build xatoliklariga olib kelishi mumkin, shuning uchun hozircha oʻchirilgan.
      // 'babel-plugin-react-compiler',

      // Reanimated plagini DOIM oxirida boʻlishi kerak
      "react-native-reanimated/plugin",
    ],
  };
};