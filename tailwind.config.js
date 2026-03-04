export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        container: {
            center: true,
            padding: '1.5rem',
            screens: {
                '2xl': '1152px',
            },
        },
        extend: {
            colors: {
                brand: {
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Inter', 'system-ui', 'sans-serif'],
                mono: ['Inconsolata', 'Courier New', 'monospace'],
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-out forwards',
                'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
                'fade-in-down': 'fadeInDown 0.5s ease-out forwards',
                'slide-up': 'slideUp 0.6s ease-out forwards',
                'scale-in': 'scaleIn 0.4s ease-out forwards',
                'float': 'float 6s ease-in-out infinite',
                'pulse-slow': 'pulse 3s ease-in-out infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': {opacity: '0'},
                    '100%': {opacity: '1'},
                },
                fadeInUp: {
                    '0%': {opacity: '0', transform: 'translateY(30px)'},
                    '100%': {opacity: '1', transform: 'translateY(0)'},
                },
                fadeInDown: {
                    '0%': {opacity: '0', transform: 'translateY(-30px)'},
                    '100%': {opacity: '1', transform: 'translateY(0)'},
                },
                slideUp: {
                    '0%': {transform: 'translateY(20px)', opacity: '0'},
                    '100%': {transform: 'translateY(0)', opacity: '1'},
                },
                scaleIn: {
                    '0%': {opacity: '0', transform: 'scale(0.95)'},
                    '100%': {opacity: '1', transform: 'scale(1)'},
                },
                float: {
                    '0%, 100%': {transform: 'translateY(0px)'},
                    '50%': {transform: 'translateY(-20px)'},
                },
            },
        },
    },
    plugins: [],
}