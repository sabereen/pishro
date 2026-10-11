import { defineConfig, presetWind3 } from 'unocss'

export default defineConfig({
  presets: [presetWind3()],
  theme: {
    colors: {
      ink: '#10214d',
      muted: '#627084',
      canvas: '#f6f8fb',
      line: '#e0e6ed',
      brand: { 50: '#ecfcf7', 100: '#d1f7eb', 500: '#17b995', 600: '#07846b', 700: '#076a58' },
    },
    fontFamily: { sans: 'Estedad, Tahoma, Arial, sans-serif' },
  },
  shortcuts: {
    panel: 'rounded-[18px] border border-line bg-white',
    field: 'w-full rounded-[10px] border border-line bg-white px-4 py-3 text-ink outline-none transition-colors focus:border-brand-600 disabled:opacity-60',
    'button-primary': 'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-ink px-5 py-3 font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50',
    'button-secondary': 'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border border-line bg-white px-4 py-3 font-bold text-ink transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50',
  },
})
