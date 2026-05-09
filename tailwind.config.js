/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                hand: ["'Caveat'", "'Klee One'", 'cursive'],
                body: ["'Klee One'", "'Zen Kurenaido'", 'sans-serif'],
                mono: ["'DM Mono'", 'ui-monospace', 'monospace'],
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
