'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import styles from './dashboard.module.css'
import { compressImage } from '../../lib/compressImage'

const RouteMap = dynamic(() => import('../components/RouteMap'), { ssr: false })

// Fixed store location
const STORE_LAT = 18.466912246377394
const STORE_LNG = 73.87646919594413

// Google Maps URL for navigating to a delivery
function getGoogleMapsUrl(delivery) {
  const lat = delivery.customer?.latitude
  const lng = delivery.customer?.longitude
  if (lat && lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  }
  const address = delivery.delivery_address || delivery.customer?.address
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
  }
  return null
}

// Haversine distance between two GPS points in km
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

// Calculate total route distance: store → stop1 → stop2 → ... → last stop
function calcRouteDistance(deliveryList, fallbackDistPerOrder) {
  const stops = deliveryList
    .map(d => ({
      lat: d.customer?.latitude,
      lng: d.customer?.longitude,
    }))
    .filter(s => s.lat != null && s.lng != null)

  if (stops.length === 0) {
    // No coords — fall back to estimate
    return deliveryList.length * (fallbackDistPerOrder || 3)
  }

  let total = 0
  let prevLat = STORE_LAT
  let prevLng = STORE_LNG

  for (const stop of stops) {
    total += haversineKm(prevLat, prevLng, stop.lat, stop.lng)
    prevLat = stop.lat
    prevLng = stop.lng
  }

  // Add distance back to store
  total += haversineKm(prevLat, prevLng, STORE_LAT, STORE_LNG)

  // For stops without coords, add fallback per missing stop
  const missingStops = deliveryList.length - stops.length
  total += missingStops * (fallbackDistPerOrder || 3)

  return total
}

export default function DashboardPage() {
  const router = useRouter()
  const [deliveryName, setDeliveryName] = useState('')
  const [loading, setLoading] = useState(true)
  const [deliveries, setDeliveries] = useState([])
  const [stats, setStats] = useState({
    todayTotal: 0,
    todayCompleted: 0,
    todayPending: 0,
    monthlyTotal: 0
  })
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState('All')
  const [updating, setUpdating] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(null)
  const [error, setError] = useState('')
  const [photoModalOpen, setPhotoModalOpen] = useState(false)
  const [routeModalOpen, setRouteModalOpen] = useState(false)
  const [selectedOrderForPhoto, setSelectedOrderForPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoSizeInfo, setPhotoSizeInfo] = useState(null)
  const compressedFileRef = useRef(null)
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [profile, setProfile] = useState(null)
  const [routeMapOpen, setRouteMapOpen] = useState(false)
  const [routeMapDeliveries, setRouteMapDeliveries] = useState([])
  const [focusedStop, setFocusedStop] = useState(null)
  const [liveLocation, setLiveLocation] = useState(null)
  const fileInputRef = useRef(null)
  const locationWatchRef = useRef(null)
  const locationIntervalRef = useRef(null)

  useEffect(() => {
    // Check authentication
    const session = localStorage.getItem('deliverySession')
    const phone = localStorage.getItem('deliveryPhone')
    const name = localStorage.getItem('deliveryName')

    if (!session || !phone) {
      router.push('/login')
      return
    }

    setDeliveryName(name || 'Delivery Personnel')
    setSelectedDate(new Date().toISOString().split('T')[0])
    setLoading(false)
    fetchDeliveries(phone, session)
    fetchProfile(phone, session)
    startLocationTracking(phone, session)

    return () => {
      if (locationWatchRef.current != null) navigator.geolocation?.clearWatch(locationWatchRef.current)
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current)
    }
  }, [router])

  const postLocation = async (phone, session, lat, lng) => {
    try {
      await fetch('/api/location/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, session, lat, lng }),
      })
    } catch {
      // silent — don't interrupt the delivery boy's workflow
    }
  }

  const startLocationTracking = (phone, session) => {
    if (!navigator.geolocation) return

    // Watch position continuously
    locationWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setLiveLocation({ lat: latitude, lng: longitude })
      },
      null,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    )

    // Push to server every 30 seconds
    locationIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => postLocation(phone, session, pos.coords.latitude, pos.coords.longitude),
        null,
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 10000 }
      )
    }, 30000)

    // Send immediately on start
    navigator.geolocation.getCurrentPosition(
      (pos) => postLocation(phone, session, pos.coords.latitude, pos.coords.longitude),
      null,
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
  }

  const fetchProfile = async (phone, session) => {
    try {
      const res = await fetch(`/api/profile?phone=${phone}&session=${session}`)
      const data = await res.json()
      if (data.success) {
        setProfile(data.profile)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
    }
  }

  const fetchDeliveries = async (phone, session, date = null) => {
    try {
      const phoneParam = phone || localStorage.getItem('deliveryPhone')
      const sessionParam = session || localStorage.getItem('deliverySession')

      let url = `/api/deliveries?phone=${phoneParam}&session=${sessionParam}`
      if (date) {
        url += `&date=${date}`
      }

      console.log('=== DEBUG: Fetching deliveries ===')
      console.log('Phone:', phoneParam)
      console.log('Session:', sessionParam)
      console.log('Date:', date)
      console.log('URL:', url)

      const response = await fetch(url)
      const data = await response.json()

      console.log('=== DEBUG: Response received ===')
      console.log('Success:', data.success)
      console.log('Deliveries count:', data.deliveries?.length || 0)
      console.log('Stats:', data.stats)
      console.log('Full response:', data)

      if (data.success) {
        setDeliveries(data.deliveries || [])
        setStats(data.stats || stats)
        setError('')
      } else {
        setError(data.error || 'Failed to fetch deliveries')
        if (response.status === 401) {
          localStorage.clear()
          router.push('/login')
        }
      }
    } catch (err) {
      console.error('Error fetching deliveries:', err)
      setError('Failed to load deliveries')
    }
  }

  const handleDateChange = (e) => {
    const date = e.target.value
    setSelectedDate(date)
    fetchDeliveries(null, null, date)
  }

  const handleStatusUpdate = async (orderId, newStatus) => {
    const delivery = deliveries.find(d => d.id === orderId)
    const orderType = delivery?.order_type || 'regular'

    // If marking as delivered, require photo upload
    if (newStatus === 'Delivered') {
      setSelectedOrderForPhoto({ orderId, orderType })
      setPhotoModalOpen(true)
      return
    }

    if (!confirm(`Mark this order as ${newStatus}?`)) {
      return
    }

    try {
      setUpdating(orderId)
      setError('')

      const phone = localStorage.getItem('deliveryPhone')
      const session = localStorage.getItem('deliverySession')

      const response = await fetch('/api/deliveries/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          session,
          orderId,
          status: newStatus,
          orderType,
        }),
      })

      const data = await response.json()

      if (data.success) {
        await fetchDeliveries(phone, session, selectedDate)
        alert(`Order marked as ${newStatus}!`)
      } else {
        setError(data.error || 'Failed to update status')
        alert('Failed to update status: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Error updating status:', err)
      setError('Failed to update status')
      alert('Failed to update status')
    } finally {
      setUpdating(null)
    }
  }

  const handlePhotoSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Compress before preview and upload (max 1280px, 82% quality)
    setPhotoSizeInfo({ original: file.size, compressed: null, compressing: true })
    const compressed = await compressImage(file, { maxDimension: 1280, quality: 0.82 })
    compressedFileRef.current = compressed
    setPhotoSizeInfo({ original: file.size, compressed: compressed.size, compressing: false })

    const reader = new FileReader()
    reader.onloadend = () => setPhotoPreview(reader.result)
    reader.readAsDataURL(compressed)
  }

  const handleUploadAndComplete = async () => {
    if (!photoPreview) {
      alert('Please select a photo first')
      return
    }

    const file = compressedFileRef.current || fileInputRef.current?.files[0]
    if (!file) {
      alert('Please select a photo')
      return
    }

    const currentOrderId = selectedOrderForPhoto?.orderId || selectedOrderForPhoto
    const currentOrderType = selectedOrderForPhoto?.orderType || 'regular'

    try {
      setUploadingPhoto(currentOrderId)

      const phone = localStorage.getItem('deliveryPhone')
      const session = localStorage.getItem('deliverySession')

      // Get current location
      let currentLocation = location
      if (!currentLocation) {
        try {
          currentLocation = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
              reject(new Error('Geolocation not supported'))
              return
            }
            navigator.geolocation.getCurrentPosition(
              (position) => {
                resolve({
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy
                })
              },
              (error) => {
                console.warn('Location access denied:', error)
                resolve(null) // Continue without location
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            )
          })
          if (currentLocation) {
            setLocation(currentLocation)
          }
        } catch (err) {
          console.warn('Could not get location:', err)
          // Continue without location
        }
      }

      // Upload photo
      const formData = new FormData()
      formData.append('phone', phone)
      formData.append('session', session)
      formData.append('orderId', currentOrderId)
      formData.append('photo', file)
      formData.append('orderType', currentOrderType)

      // Add location data if available
      if (currentLocation) {
        formData.append('latitude', currentLocation.latitude.toString())
        formData.append('longitude', currentLocation.longitude.toString())
        formData.append('accuracy', currentLocation.accuracy.toString())
        console.log('Uploading with location:', currentLocation)
      } else {
        console.warn('Uploading without location data')
      }

      const uploadResponse = await fetch('/api/deliveries/upload-photo', {
        method: 'POST',
        body: formData,
      })

      const uploadData = await uploadResponse.json()

      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Failed to upload photo')
      }

      // Update status to delivered
      const statusResponse = await fetch('/api/deliveries/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          session,
          orderId: currentOrderId,
          status: 'Delivered',
          orderType: currentOrderType,
        }),
      })

      const statusData = await statusResponse.json()

      if (statusData.success) {
        await fetchDeliveries(phone, session, selectedDate)
        alert('Order marked as delivered with photo!')
        closePhotoModal()
      } else {
        throw new Error(statusData.error || 'Failed to update status')
      }
    } catch (err) {
      console.error('Error completing delivery:', err)
      alert(err.message || 'Failed to complete delivery')
    } finally {
      setUploadingPhoto(null)
    }
  }

  const closePhotoModal = () => {
    setPhotoModalOpen(false)
    setSelectedOrderForPhoto(null)
    setPhotoPreview(null)
    setPhotoSizeInfo(null)
    setLocation(null)
    setLocationError(null)
    compressedFileRef.current = null
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Request location when modal opens
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location not supported')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        })
        setLocationError(null)
      },
      (error) => {
        console.error('Location error:', error)
        setLocationError('Location access denied')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // Auto-request location when photo modal opens
  useEffect(() => {
    if (photoModalOpen) {
      requestLocation()
    }
  }, [photoModalOpen])

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.clear()
      router.push('/login')
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Pending':
        return '#f39c12'
      case 'Confirmed':
        return '#3498db'
      case 'Preparing':
        return '#9b59b6'
      case 'Out for Delivery':
        return '#e67e22'
      case 'Delivered':
        return '#27ae60'
      case 'Cancelled':
        return '#e74c3c'
      default:
        return '#95a5a6'
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else {
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      })
    }
  }

  // Group deliveries by meal slot
  const groupBySlot = () => {
    const slots = [
      { name: 'Breakfast', emoji: '🌅' },
      { name: 'Lunch', emoji: '☀️' },
      { name: 'Dinner', emoji: '🌙' }
    ]

    // Filter by selected slot if not "All"
    const filteredSlots = selectedSlot === 'All'
      ? slots
      : slots.filter(s => s.name === selectedSlot)

    return filteredSlots.map(slot => ({
      ...slot,
      items: deliveries.filter(d => {
        // Case-insensitive comparison
        const slotName = d.meal_slot ? d.meal_slot.toLowerCase() : ''
        const filterName = slot.name.toLowerCase()
        return slotName === filterName
      })
    })).filter(group => group.items.length > 0)
  }

  const handlePlanRoute = () => {
    // Include all deliveries for selected slot (pending + delivered so they show on map)
    let slotDeliveries = selectedSlot === 'All'
      ? deliveries
      : deliveries.filter(d => (d.meal_slot || '').toLowerCase() === selectedSlot.toLowerCase())

    // At minimum need pending ones
    const pending = slotDeliveries.filter(d =>
      d.order_status !== 'Delivered' && d.order_status !== 'Cancelled'
    )

    if (pending.length === 0) {
      const slotMsg = selectedSlot !== 'All' ? ` for ${selectedSlot}` : ''
      alert(`No pending deliveries to route${slotMsg}`)
      return
    }

    // Pass pending first so they get lower stop numbers, then already-delivered ones for context
    const delivered = slotDeliveries.filter(d => d.order_status === 'Delivered')
    setRouteMapDeliveries([...pending, ...delivered])
    setFocusedStop(null)
    setRouteMapOpen(true)
  }

  const handleViewOnMap = (delivery) => {
    const lat = delivery.customer?.latitude
    const lng = delivery.customer?.longitude
    if (!lat || !lng) return
    // Show all today's deliveries for context, focused on this one
    setRouteMapDeliveries(deliveries)
    setFocusedStop({ lat: parseFloat(lat), lng: parseFloat(lng), name: delivery.customer?.name })
    setRouteMapOpen(true)
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className={styles.dashboardPage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1>🚚 Delivery Dashboard</h1>
            <p>
              Welcome, {deliveryName}!
              {liveLocation ? (
                <span className={styles.trackingBadge}>📡 Location tracking ON</span>
              ) : (
                <span className={styles.trackingBadgeOff}>📡 Location off</span>
              )}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button onClick={() => router.push('/profile')} className={styles.profileBtn}>
              👤 My Profile
            </button>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            {error}
          </div>
        )}

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📦</div>
            <div className={styles.statContent}>
              <p className={styles.statValue}>{stats.todayTotal}</p>
              <p className={styles.statLabel}>Today's Deliveries</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>✅</div>
            <div className={styles.statContent}>
              <p className={styles.statValue}>{stats.todayCompleted}</p>
              <p className={styles.statLabel}>Completed Today</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>⏳</div>
            <div className={styles.statContent}>
              <p className={styles.statValue}>{stats.todayPending}</p>
              <p className={styles.statLabel}>Pending</p>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={styles.statIcon}>🏆</div>
            <div className={styles.statContent}>
              <p className={styles.statValue}>{stats.monthlyTotal}</p>
              <p className={styles.statLabel}>This Month</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filterSection}>
          <div className={styles.filterGroup}>
            <label>Filter by date:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className={styles.dateInput}
            />
            <button
              onClick={() => {
                const today = new Date().toISOString().split('T')[0]
                setSelectedDate(today)
                fetchDeliveries(null, null, today)
              }}
              className={styles.todayBtn}
            >
              Today
            </button>
            <button
              onClick={() => {
                setSelectedDate('')
                fetchDeliveries()
              }}
              className={styles.allBtn}
            >
              Show All
            </button>
          </div>
          <div className={styles.filterGroup}>
            <label>Filter by meal:</label>
            <button
              onClick={() => setSelectedSlot('All')}
              className={`${styles.slotFilterBtn} ${selectedSlot === 'All' ? styles.active : ''}`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedSlot('Breakfast')}
              className={`${styles.slotFilterBtn} ${selectedSlot === 'Breakfast' ? styles.active : ''}`}
            >
              🌅 Breakfast
            </button>
            <button
              onClick={() => setSelectedSlot('Lunch')}
              className={`${styles.slotFilterBtn} ${selectedSlot === 'Lunch' ? styles.active : ''}`}
            >
              ☀️ Lunch
            </button>
            <button
              onClick={() => setSelectedSlot('Dinner')}
              className={`${styles.slotFilterBtn} ${selectedSlot === 'Dinner' ? styles.active : ''}`}
            >
              🌙 Dinner
            </button>
          </div>
        </div>

        {/* Plan Route Button + Fuel Cost */}
        {deliveries.filter(d => d.order_status !== 'Delivered' && d.order_status !== 'Cancelled').length > 0 && (
          <div className={styles.routeSection}>
            <button
              onClick={handlePlanRoute}
              className={styles.planRouteBtn}
            >
              🗺️ Plan {selectedSlot !== 'All' ? selectedSlot : 'Delivery'} Route
            </button>
            <p className={styles.routeHint}>
              Opens Google Maps with shortest optimized route for {selectedSlot !== 'All' ? `${selectedSlot.toLowerCase()} ` : ''}pending deliveries
            </p>

            {/* Starting point — fixed store */}
            <div className={styles.startingPointStatus}>
              <span className={styles.startingPointSet}>
                🏪 Starting from Store · {STORE_LAT.toFixed(4)}, {STORE_LNG.toFixed(4)}
              </span>
            </div>

            {/* Fuel Cost Estimate */}
            {(() => {
              const slotDeliveries = deliveries.filter(d =>
                selectedSlot === 'All' || (d.meal_slot || '').toLowerCase() === selectedSlot.toLowerCase()
              )
              const totalCount = slotDeliveries.length
              const mileage = profile?.bike_mileage || 40
              const petrolRate = profile?.petrol_rate || 105
              const fallbackDist = profile?.avg_distance_per_order || 3
              const totalDist = calcRouteDistance(slotDeliveries, fallbackDist)
              const fuelLiters = totalDist / mileage
              const fuelCost = fuelLiters * petrolRate
              const usingRealCoords = slotDeliveries.some(d => d.customer?.latitude != null)

              return (
                <div className={styles.fuelCostBox}>
                  <div className={styles.fuelStats}>
                    <div className={styles.fuelStat}>
                      <span className={styles.fuelStatIcon}>📦</span>
                      <div>
                        <p className={styles.fuelStatValue}>{totalCount}</p>
                        <p className={styles.fuelStatLabel}>Total Orders</p>
                      </div>
                    </div>
                    <div className={styles.fuelStat}>
                      <span className={styles.fuelStatIcon}>📍</span>
                      <div>
                        <p className={styles.fuelStatValue}>{totalDist.toFixed(1)} km</p>
                        <p className={styles.fuelStatLabel}>Est. Distance</p>
                      </div>
                    </div>
                    <div className={styles.fuelStat}>
                      <span className={styles.fuelStatIcon}>⛽</span>
                      <div>
                        <p className={styles.fuelStatValue}>{fuelLiters.toFixed(2)} L</p>
                        <p className={styles.fuelStatLabel}>Fuel Needed</p>
                      </div>
                    </div>
                    <div className={`${styles.fuelStat} ${styles.fuelCostHighlight}`}>
                      <span className={styles.fuelStatIcon}>💰</span>
                      <div>
                        <p className={styles.fuelStatValue}>₹{fuelCost.toFixed(2)}</p>
                        <p className={styles.fuelStatLabel}>Fuel Cost</p>
                      </div>
                    </div>
                  </div>
                  {!profile?.bike_model && (
                    <p className={styles.fuelSetupHint}>
                      ⚙️ <button onClick={() => router.push('/profile')} className={styles.setupProfileLink}>Set up your bike profile</button> for accurate fuel cost calculations
                    </p>
                  )}
                  {profile?.bike_model && (
                    <p className={styles.fuelNote}>
                      {usingRealCoords ? '📡 Using actual GPS coordinates' : '📐 Estimated distance'} · {profile.bike_model} · {mileage} km/l · ₹{petrolRate}/liter
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Delivery List */}
        <div className={styles.deliveriesSection}>
          <h2>📋 Deliveries</h2>
          {deliveries.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No deliveries assigned for selected date</p>
            </div>
          ) : (
            <>
              {/* Ala Carte Orders — always shown at top when selectedSlot is All */}
              {selectedSlot === 'All' && deliveries.filter(d => d.order_type === 'ala_carte').length > 0 && (
                <div className={styles.slotSection}>
                  <h3 className={styles.slotHeader}>🍽️ Ala Carte</h3>
                  <div className={styles.deliveriesList}>
                    {deliveries.filter(d => d.order_type === 'ala_carte').map((delivery) => (
                <div
                  key={delivery.id}
                  className={styles.deliveryCard}
                  style={{ borderLeftColor: getStatusColor(delivery.order_status) }}
                >
                  <div className={styles.deliveryContent}>
                    <div className={styles.deliveryMain}>
                      <div className={styles.customerInfo}>
                        <h3>{delivery.customer?.name || 'N/A'}</h3>
                        <p className={styles.phone}>📞 {delivery.customer?.phone_number || 'N/A'}</p>
                      </div>
                      <div className={styles.deliveryDetails}>
                        <div className={styles.detailRow}><span className={styles.detailLabel}>🧾 Order:</span><span>{delivery.order_number}</span></div>
                        <div className={styles.detailRow}><span className={styles.detailLabel}>🍽️ Items:</span><span>{delivery.menu_item?.name || 'N/A'}</span></div>
                        {delivery.total_amount_rs && <div className={styles.detailRow}><span className={styles.detailLabel}>💰 Total:</span><span>₹{delivery.total_amount_rs}</span></div>}
                        <div className={styles.detailRow}><span className={styles.detailLabel}>📍 Address:</span><span>{delivery.delivery_address || 'N/A'}</span></div>
                      </div>
                      <div className={styles.statusBadge}>
                        <span style={{ backgroundColor: getStatusColor(delivery.order_status) }}>{delivery.order_status}</span>
                      </div>
                    </div>
                    <div className={styles.actionButtons}>
                      {delivery.customer?.latitude && delivery.customer?.longitude && (
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${delivery.customer.latitude},${delivery.customer.longitude}`} target="_blank" rel="noopener noreferrer" className={styles.googleMapsBtn}>🗺️ Google Maps</a>
                      )}
                      {delivery.order_status !== 'Delivered' && delivery.order_status !== 'Cancelled' && (
                        <>
                          {delivery.order_status !== 'Out for Delivery' && (
                            <button onClick={() => handleStatusUpdate(delivery.id, 'Out for Delivery')} disabled={updating === delivery.id} className={styles.outForDeliveryBtn}>🚚 Out for Delivery</button>
                          )}
                          <button onClick={() => handleStatusUpdate(delivery.id, 'Delivered')} disabled={updating === delivery.id} className={styles.deliveredBtn}>✅ Mark Delivered</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                    ))}
                  </div>
                </div>
              )}

              {groupBySlot().map((slotGroup) => (
                <div key={slotGroup.name} className={styles.slotSection}>
                  <h3 className={styles.slotHeader}>{slotGroup.emoji} {slotGroup.name}</h3>
                  <div className={styles.deliveriesList}>
                    {slotGroup.items.map((delivery) => (
                <div
                  key={delivery.id}
                  className={styles.deliveryCard}
                  style={{
                    borderLeftColor: getStatusColor(delivery.order_status)
                  }}
                >
                  <div className={styles.deliveryContent}>
                    <div className={styles.deliveryMain}>
                      {/* Customer Info */}
                      <div className={styles.customerInfo}>
                        <h3>{delivery.customer?.name || 'N/A'}</h3>
                        <p className={styles.phone}>
                          📞 {delivery.customer?.phone_number || 'N/A'}
                        </p>
                      </div>

                      {/* Delivery Details */}
                      <div className={styles.deliveryDetails}>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>📅 Date:</span>
                          <span>{formatDate(delivery.delivery_date)}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>🕐 Slot:</span>
                          <span>{delivery.meal_slot}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>🍽️ Item:</span>
                          <span>{delivery.menu_item?.name || 'N/A'}</span>
                        </div>
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>📍 Address:</span>
                          <span>{delivery.delivery_address || delivery.customer?.address || 'N/A'}</span>
                        </div>
                        {delivery.customer?.latitude && delivery.customer?.longitude && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>🌐 Coords:</span>
                            <button
                              onClick={() => handleViewOnMap(delivery)}
                              className={styles.coordBtn}
                              title="View on map"
                            >
                              {Number(delivery.customer.latitude).toFixed(5)}, {Number(delivery.customer.longitude).toFixed(5)}
                              <span className={styles.coordMapIcon}>🗺️</span>
                            </button>
                          </div>
                        )}
                        {delivery.special_instructions && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>📝 Instructions:</span>
                            <span className={styles.instructions}>{delivery.special_instructions}</span>
                          </div>
                        )}
                        {delivery.delivery_photo_url && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>📸 Photo:</span>
                            <a href={delivery.delivery_photo_url} target="_blank" rel="noopener noreferrer" className={styles.photoLink}>
                              View Photo
                            </a>
                          </div>
                        )}
                        {delivery.delivery_latitude && delivery.delivery_longitude && (
                          <div className={styles.detailRow}>
                            <span className={styles.detailLabel}>📍 Delivered At:</span>
                            <a
                              href={`https://www.google.com/maps?q=${delivery.delivery_latitude},${delivery.delivery_longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.locationLink}
                            >
                              View on Map
                              {delivery.delivery_location_accuracy && (
                                <span className={styles.accuracy}> (±{Math.round(delivery.delivery_location_accuracy)}m)</span>
                              )}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Status Badge */}
                      <div className={styles.statusBadge}>
                        <span
                          style={{
                            backgroundColor: getStatusColor(delivery.order_status)
                          }}
                        >
                          {delivery.order_status}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className={styles.actionButtons}>
                      {getGoogleMapsUrl(delivery) && (
                        <a
                          href={getGoogleMapsUrl(delivery)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.googleMapsBtn}
                        >
                          🗺️ Google Maps
                        </a>
                      )}
                      {delivery.order_status !== 'Delivered' && delivery.order_status !== 'Cancelled' && (
                        <>
                          {delivery.order_status !== 'Out for Delivery' && (
                            <button
                              onClick={() => handleStatusUpdate(delivery.id, 'Out for Delivery')}
                              disabled={updating === delivery.id}
                              className={styles.outForDeliveryBtn}
                            >
                              🚚 Out for Delivery
                            </button>
                          )}
                          <button
                            onClick={() => handleStatusUpdate(delivery.id, 'Delivered')}
                            disabled={updating === delivery.id}
                            className={styles.deliveredBtn}
                          >
                            ✅ Mark Delivered
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
        </div>
      </div>

      {/* Photo Upload Modal */}
      {photoModalOpen && (
        <div className={styles.modal} onClick={closePhotoModal}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2>📸 Upload Delivery Photo</h2>
            <p className={styles.modalSubtitle}>Take a photo as proof of delivery</p>

            {/* Location Status */}
            <div className={styles.locationStatus}>
              {location ? (
                <p className={styles.locationSuccess}>
                  📍 Location captured (±{Math.round(location.accuracy)}m)
                </p>
              ) : locationError ? (
                <p className={styles.locationWarning}>
                  ⚠️ Location not available - Photo will be uploaded without GPS data
                </p>
              ) : (
                <p className={styles.locationPending}>
                  🔍 Getting location...
                </p>
              )}
            </div>

            <div className={styles.photoUploadSection}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className={styles.fileInput}
                id="photoInput"
              />

              {!photoPreview ? (
                <label htmlFor="photoInput" className={styles.uploadLabel}>
                  <div className={styles.uploadPlaceholder}>
                    {photoSizeInfo?.compressing ? (
                      <>
                        <span className={styles.cameraIcon}>⚙️</span>
                        <p>Compressing photo...</p>
                      </>
                    ) : (
                      <>
                        <span className={styles.cameraIcon}>📷</span>
                        <p>Take or Select Photo</p>
                      </>
                    )}
                  </div>
                </label>
              ) : (
                <div className={styles.photoPreview}>
                  <img src={photoPreview} alt="Preview" />
                  <button
                    onClick={() => {
                      setPhotoPreview(null)
                      setPhotoSizeInfo(null)
                      compressedFileRef.current = null
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className={styles.removePhotoBtn}
                  >
                    ✕ Remove
                  </button>
                  {photoSizeInfo?.compressed != null && (
                    <div className={styles.compressionBadge}>
                      {(photoSizeInfo.original / 1024 / 1024).toFixed(1)} MB → {(photoSizeInfo.compressed / 1024).toFixed(0)} KB
                      <span className={styles.compressionSaved}>
                        {' '}({Math.round((1 - photoSizeInfo.compressed / photoSizeInfo.original) * 100)}% smaller)
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                onClick={handleUploadAndComplete}
                disabled={!photoPreview || uploadingPhoto}
                className={styles.confirmBtn}
              >
                {uploadingPhoto ? 'Uploading...' : 'Confirm & Mark Delivered'}
              </button>
              <button
                onClick={closePhotoModal}
                disabled={uploadingPhoto}
                className={styles.cancelBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-browser Route Map */}
      {routeMapOpen && (
        <RouteMap
          deliveries={routeMapDeliveries}
          focusedStop={focusedStop}
          initialLocation={liveLocation}
          onClose={() => { setRouteMapOpen(false); setFocusedStop(null) }}
        />
      )}
    </div>
  )
}
