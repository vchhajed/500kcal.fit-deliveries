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
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
