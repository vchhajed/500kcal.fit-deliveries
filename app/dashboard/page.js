'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'

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
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const fileInputRef = useRef(null)

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
  }, [router])

  const fetchDeliveries = async (phone, session, date = null) => {
    try {
      const phoneParam = phone || localStorage.getItem('deliveryPhone')
      const sessionParam = session || localStorage.getItem('deliverySession')
      const idParam = localStorage.getItem('deliveryId')

      let url = `/api/deliveries?phone=${phoneParam}&session=${sessionParam}`
      if (idParam) {
        url += `&id=${idParam}`
      }
      if (date) {
        url += `&date=${date}`
      }

      console.log('=== DEBUG: Fetching deliveries ===')
      console.log('Phone:', phoneParam)
      console.log('Session:', sessionParam)
      console.log('ID:', idParam)
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
    // If marking as delivered, require photo upload
    if (newStatus === 'Delivered') {
      setSelectedOrderForPhoto(orderId)
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
      const id = localStorage.getItem('deliveryId')

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
          id, // Include user ID for hardcoded users
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

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Photo size must be less than 5MB')
        return
      }

      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUploadAndComplete = async () => {
    if (!photoPreview) {
      alert('Please select a photo first')
      return
    }

    const file = fileInputRef.current?.files[0]
    if (!file) {
      alert('Please select a photo')
      return
    }

    try {
      setUploadingPhoto(selectedOrderForPhoto)

      const phone = localStorage.getItem('deliveryPhone')
      const session = localStorage.getItem('deliverySession')
      const id = localStorage.getItem('deliveryId')

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
      formData.append('orderId', selectedOrderForPhoto)
      formData.append('photo', file)
      if (id) {
        formData.append('id', id) // Include user ID for hardcoded users
      }

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
          orderId: selectedOrderForPhoto,
          status: 'Delivered',
          id, // Include user ID for hardcoded users
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
    setLocation(null)
    setLocationError(null)
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

  // Helper function to geocode addresses
  const geocodeAddress = async (address) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=YOUR_API_KEY`
      )
      const data = await response.json()
      if (data.results && data.results.length > 0) {
        return data.results[0].geometry.location
      }
    } catch (err) {
      console.error('Geocoding error:', err)
    }
    return null
  }

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // Distance in km
  }

  // Optimize route using nearest neighbor algorithm
  const optimizeRouteOrder = (deliveries, startLat, startLng) => {
    if (deliveries.length <= 1) return deliveries

    const unvisited = [...deliveries]
    const route = []
    let currentLat = startLat
    let currentLng = startLng

    while (unvisited.length > 0) {
      let nearestIndex = 0
      let nearestDistance = Infinity

      // Find nearest unvisited delivery
      unvisited.forEach((delivery, index) => {
        if (delivery.lat && delivery.lng) {
          const distance = calculateDistance(currentLat, currentLng, delivery.lat, delivery.lng)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearestIndex = index
          }
        }
      })

      // Add nearest to route and update current position
      const nearest = unvisited.splice(nearestIndex, 1)[0]
      route.push(nearest)
      if (nearest.lat && nearest.lng) {
        currentLat = nearest.lat
        currentLng = nearest.lng
      }
    }

    return route
  }

  const handlePlanRoute = async () => {
    // Get pending deliveries (not delivered or cancelled)
    const pendingDeliveries = deliveries.filter(d =>
      d.order_status !== 'Delivered' && d.order_status !== 'Cancelled'
    )

    if (pendingDeliveries.length === 0) {
      alert('No pending deliveries to plan a route for')
      return
    }

    // Extract delivery data with addresses
    const deliveryData = pendingDeliveries.map(d => ({
      id: d.id,
      address: (d.delivery_address || d.customer?.address || '').trim(),
      customerName: d.customer?.name || 'N/A',
      lat: null,
      lng: null
    })).filter(d => d.address)

    if (deliveryData.length === 0) {
      alert('No addresses found for pending deliveries')
      return
    }

    if (deliveryData.length === 1) {
      // Single destination - just open in Google Maps
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(deliveryData[0].address)}`
      window.open(mapsUrl, '_blank')
      return
    }

    try {
      // Show loading indicator
      alert('Planning optimal route... This may take a moment.')

      // Get current location as starting point
      const currentLocation = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          resolve(null)
          return
        }
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        )
      })

      let startLat, startLng

      if (currentLocation) {
        startLat = currentLocation.lat
        startLng = currentLocation.lng
        console.log('Starting from current location:', startLat, startLng)
      } else {
        // Default to first delivery if no location
        console.log('No current location, will use first address')
      }

      // Use Google Maps Directions API for optimization via URL
      // The web interface supports waypoint optimization
      const addresses = deliveryData.map(d => d.address)

      if (currentLocation) {
        // Build URL with current location as origin
        const origin = `${startLat},${startLng}`
        const destination = encodeURIComponent(addresses[addresses.length - 1])

        if (addresses.length > 2) {
          const waypoints = addresses.slice(0, -1).map(addr => encodeURIComponent(addr)).join('|')
          // Use dir_action=navigate for mobile optimization
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`
          window.open(mapsUrl, '_blank')
        } else {
          const waypoint = encodeURIComponent(addresses[0])
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoint}&travelmode=driving`
          window.open(mapsUrl, '_blank')
        }
      } else {
        // No current location - create route through all addresses
        const origin = encodeURIComponent(addresses[0])
        const destination = encodeURIComponent(addresses[addresses.length - 1])

        if (addresses.length > 2) {
          const waypoints = addresses.slice(1, -1).map(addr => encodeURIComponent(addr)).join('|')
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`
          window.open(mapsUrl, '_blank')
        } else {
          const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
          window.open(mapsUrl, '_blank')
        }
      }

      console.log('Route planned with', deliveryData.length, 'stops')

    } catch (err) {
      console.error('Error planning route:', err)
      // Fallback to simple multi-destination URL
      const addresses = deliveryData.map(d => d.address)
      const destinations = addresses.map(addr => encodeURIComponent(addr)).join('/')
      const mapsUrl = `https://www.google.com/maps/dir/${destinations}`
      window.open(mapsUrl, '_blank')
    }
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
            <p>Welcome, {deliveryName}!</p>
          </div>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>
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

        {/* Plan Route Button */}
        {deliveries.filter(d => d.order_status !== 'Delivered' && d.order_status !== 'Cancelled').length > 0 && (
          <div className={styles.routeSection}>
            <button
              onClick={handlePlanRoute}
              className={styles.planRouteBtn}
            >
              🗺️ Plan Delivery Route
            </button>
            <p className={styles.routeHint}>Opens Google Maps with optimized route for all pending deliveries</p>
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
                    {delivery.order_status !== 'Delivered' && delivery.order_status !== 'Cancelled' && (
                      <div className={styles.actionButtons}>
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
                      </div>
                    )}
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
                    <span className={styles.cameraIcon}>📷</span>
                    <p>Take or Select Photo</p>
                  </div>
                </label>
              ) : (
                <div className={styles.photoPreview}>
                  <img src={photoPreview} alt="Preview" />
                  <button
                    onClick={() => {
                      setPhotoPreview(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className={styles.removePhotoBtn}
                  >
                    ✕ Remove
                  </button>
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
    </div>
  )
}
