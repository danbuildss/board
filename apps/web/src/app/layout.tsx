import './globals.css'
import { Providers } from '@/components/Providers'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

export const metadata = {
  title: 'BOARD',
  description: 'HOOD Board — 100 Seats. Take what you can hold.',
}

const themeScript = `(function(){try{var t=localStorage.getItem('board-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
