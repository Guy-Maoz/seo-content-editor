import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '100%',
            h1: {
              fontWeight: '600',
              marginBottom: '1rem',
            },
            h2: {
              fontWeight: '600',
              marginBottom: '0.75rem',
            },
            h3: {
              fontWeight: '600',
              marginBottom: '0.5rem',
            },
            p: {
              marginBottom: '0.5rem',
            },
            'ul > li': {
              marginTop: '0.25rem',
              marginBottom: '0.25rem',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config; 