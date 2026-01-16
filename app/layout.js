import './globals.css'

export const metadata = {
  title: '500Kcal.fit - Delivery Portal',
  description: 'Delivery management system for 500Kcal.fit',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://www.google.com/recaptcha/api.js?render=explicit" async defer></script>
      </head>
      <body>{children}</body>
    </html>
  )
}
