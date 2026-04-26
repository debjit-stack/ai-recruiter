import './globals.css';

export const metadata = {
  title: 'AI Recruiting Agent',
  description: 'Automated candidate scoring and outreach pipeline.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}