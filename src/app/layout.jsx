import './globals.css';
import AuthProvider from '@/components/AuthProvider';
export const metadata = { title: 'HCM Lite', description: 'AI-assisted Human Capital Management' };
export default function RootLayout({ children }) {
  return (<html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com" /><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" /></head>
    <body><AuthProvider>{children}</AuthProvider></body></html>);
}
