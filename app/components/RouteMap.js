'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './RouteMap.module.css'

const STORE_LAT = 18.466912246377394
const STORE_LNG = 73.87646919594413

export default function RouteMap({ deliveries, focusedStop, onClose }) {
  const mapRef = useRef(null)
  const wrapperRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const liveMarkerRef = useRef(null)
  const liveCircleRef = useRef(null)
  const watchIdRef = useRef(null)

  const [routeInfo, setRouteInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [routeError, setRouteError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const initMap = async () => {
      const L = (await import('leaflet')).default

      // Fix Leaflet default icon paths broken by webpack
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (cancelled || !mapRef.current || mapInstanceRef.current) return

      // Give the wrapper a concrete height so Leaflet measures correctly
      const wrapperEl = wrapperRef.current
      if (wrapperEl) {
        const available = wrapperEl.getBoundingClientRect().height
        mapRef.current.style.height = (available > 100 ? available : 480) + 'px'
      }

      // Init map centered on store
      const map = L.map(mapRef.current, { zoomControl: true }).setView([STORE_LAT, STORE_LNG], 13)
      mapInstanceRef.current = map

      // Re-invalidate when container resizes (e.g. mobile orientation change)
      if (typeof ResizeObserver !== 'undefined' && wrapperEl) {
        const ro = new ResizeObserver(() => {
          if (mapInstanceRef.current && wrapperEl) {
            const h = wrapperEl.getBoundingClientRect().height
            if (mapRef.current && h > 100) mapRef.current.style.height = h + 'px'
            mapInstanceRef.current.invalidateSize()
          }
        })
        ro.observe(wrapperEl)
      }

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // --- Store marker ---
      const storeIcon = L.divIcon({
        html: `<div style="
          background:#e74c3c;color:white;border-radius:50%;
          width:40px;height:40px;display:flex;align-items:center;
          justify-content:center;font-size:20px;
          border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.35)">🏪</div>`,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      })
      L.marker([STORE_LAT, STORE_LNG], { icon: storeIcon })
        .bindPopup('<strong>🏪 Store</strong><br>Starting Point')
        .addTo(map)

      // --- Collect stops with coordinates ---
      const stops = deliveries
        .filter(d => d.customer?.latitude != null && d.customer?.longitude != null)
        .map(d => ({
          lat: parseFloat(d.customer.latitude),
          lng: parseFloat(d.customer.longitude),
          name: d.customer.name || 'Customer',
          address: d.delivery_address || d.customer.address || '',
          slot: d.meal_slot || '',
          status: d.order_status,
        }))

      if (stops.length === 0) {
        setLoading(false)
        setRouteError(true)
        return
      }

      const allBounds = [[STORE_LAT, STORE_LNG], ...stops.map(s => [s.lat, s.lng])]

      // --- Try OSRM trip (optimized order) ---
      let optimizedOrder = stops.map((_, i) => i) // default: original order
      let routePolyline = null

      try {
        // OSRM expects lng,lat
        const coordStr = [
          `${STORE_LNG},${STORE_LAT}`,
          ...stops.map(s => `${s.lng},${s.lat}`),
        ].join(';')

        const url = `https://router.project-osrm.org/trip/v1/driving/${coordStr}?roundtrip=false&source=first&destination=last&geometries=geojson&annotations=false`
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
        const data = await res.json()

        if (data.code === 'Ok' && data.trips?.[0]) {
          const trip = data.trips[0]

          // Draw the actual road-following polyline
          const latlngs = trip.geometry.coordinates.map(c => [c[1], c[0]])
          routePolyline = L.polyline(latlngs, {
            color: '#667eea',
            weight: 5,
            opacity: 0.85,
          }).addTo(map)

          // Determine optimized stop order from waypoints
          // waypoints[i].waypoint_index = position in the optimal trip for input coordinate i
          const sorted = [...data.waypoints]
            .map((wp, inputIdx) => ({ waypoint_index: wp.waypoint_index, inputIdx }))
            .sort((a, b) => a.waypoint_index - b.waypoint_index)

          // sorted[0] = store (inputIdx 0), rest are stops in trip order
          optimizedOrder = sorted
            .filter(wp => wp.inputIdx > 0)
            .map(wp => wp.inputIdx - 1) // convert to 0-based stop index

          setRouteInfo({
            distance: (trip.distance / 1000).toFixed(1),
            duration: Math.round(trip.duration / 60),
            stops: stops.length,
          })
        } else {
          throw new Error('OSRM returned no route')
        }
      } catch {
        // OSRM failed — draw straight lines as fallback
        setRouteError(true)
        const pts = [[STORE_LAT, STORE_LNG], ...stops.map(s => [s.lat, s.lng])]
        routePolyline = L.polyline(pts, {
          color: '#667eea',
          weight: 3,
          opacity: 0.6,
          dashArray: '8 6',
        }).addTo(map)
      }

      // --- Numbered stop markers ---
      optimizedOrder.forEach((stopIdx, tripPos) => {
        const stop = stops[stopIdx]
        const num = tripPos + 1
        const isDelivered = stop.status === 'Delivered'

        const stopIcon = L.divIcon({
          html: `<div style="
            background:${isDelivered ? '#95a5a6' : '#27ae60'};
            color:white;border-radius:50%;
            width:32px;height:32px;
            display:flex;align-items:center;justify-content:center;
            font-weight:800;font-size:14px;
            border:3px solid white;
            box-shadow:0 2px 8px rgba(0,0,0,0.3)">
            ${isDelivered ? '✓' : num}
          </div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        L.marker([stop.lat, stop.lng], { icon: stopIcon })
          .bindPopup(`
            <strong>Stop ${num}: ${stop.name}</strong><br>
            ${stop.address ? `📍 ${stop.address}<br>` : ''}
            🕐 ${stop.slot}<br>
            <span style="color:${isDelivered ? '#27ae60' : '#e67e22'}">${stop.status}</span>
          `)
          .addTo(map)
      })

      // Fit all markers in view — invalidate size first so Leaflet knows
      // the container's actual rendered dimensions before fitting bounds
      map.invalidateSize()
      setTimeout(() => {
        if (!cancelled && mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(L.latLngBounds(allBounds), { padding: [60, 60] })
        }
      }, 100)
      setLoading(false)

      // --- Fly to focused stop if opened from a card ---
      if (focusedStop) {
        setTimeout(() => {
          if (cancelled || !mapInstanceRef.current) return
          mapInstanceRef.current.flyTo([focusedStop.lat, focusedStop.lng], 17, { duration: 1 })
          // Find and open the popup for this marker
          mapInstanceRef.current.eachLayer(layer => {
            if (layer.getLatLng) {
              const ll = layer.getLatLng()
              const dist = Math.abs(ll.lat - focusedStop.lat) + Math.abs(ll.lng - focusedStop.lng)
              if (dist < 0.0001) layer.openPopup()
            }
          })
        }, 300)
      }

      // --- Live location (pulsing blue dot) ---
      if (navigator.geolocation) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            if (cancelled) return
            const { latitude, longitude } = pos.coords

            if (!liveMarkerRef.current) {
              // Pulsing dot icon
              const liveIcon = L.divIcon({
                html: `<div class="${styles.liveDot}"></div>`,
                className: '',
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              })
              liveMarkerRef.current = L.marker([latitude, longitude], { icon: liveIcon, zIndexOffset: 1000 })
                .bindPopup('📍 Your live location')
                .addTo(map)

              // Accuracy circle
              liveCircleRef.current = L.circle([latitude, longitude], {
                radius: pos.coords.accuracy,
                color: '#3498db',
                fillColor: '#3498db',
                fillOpacity: 0.1,
                weight: 1,
              }).addTo(map)
            } else {
              liveMarkerRef.current.setLatLng([latitude, longitude])
              liveCircleRef.current.setLatLng([latitude, longitude])
              liveCircleRef.current.setRadius(pos.coords.accuracy)
            }
          },
          null,
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
        )
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.mapHeader}>
          <div className={styles.mapHeaderLeft}>
            <h2 className={styles.mapTitle}>
              {focusedStop ? `📍 ${focusedStop.name || 'Customer Location'}` : '🗺️ Delivery Route'}
            </h2>
            {loading && !routeInfo && (
              <p className={styles.mapSubtitle}>Loading route...</p>
            )}
            {routeInfo && (
              <p className={styles.mapSubtitle}>
                <strong>{routeInfo.stops}</strong> stops ·{' '}
                <strong>{routeInfo.distance} km</strong> ·{' '}
                ~<strong>{routeInfo.duration} min</strong>
                {routeError && <span className={styles.fallbackNote}> (straight-line estimate)</span>}
              </p>
            )}
            {!loading && !routeInfo && (
              <p className={styles.mapSubtitle}>No GPS coordinates available for stops</p>
            )}
          </div>
          <button onClick={onClose} className={styles.closeBtn}>✕ Close</button>
        </div>

        {/* Map */}
        <div ref={wrapperRef} className={styles.mapWrapper}>
          {loading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
              <p>Calculating optimal route...</p>
            </div>
          )}
          <div ref={mapRef} className={styles.map}></div>
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#e74c3c' }}></span>
            Store
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#27ae60' }}></span>
            Delivery Stop
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#95a5a6' }}></span>
            Delivered
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: '#3498db' }}></span>
            Your Location
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendLine} style={{ background: '#667eea' }}></span>
            Route
          </div>
        </div>
      </div>
    </div>
  )
}
