'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './profile.module.css'
import { compressImage } from '../../lib/compressImage'

// Common Indian bikes with typical mileage
const BIKE_PRESETS = [
  { model: 'Honda Activa 6G', mileage: 60 },
  { model: 'Honda Activa 125', mileage: 55 },
  { model: 'Hero Splendor+', mileage: 70 },
  { model: 'Hero HF Deluxe', mileage: 72 },
  { model: 'Bajaj Platina 110', mileage: 80 },
  { model: 'Bajaj CT110', mileage: 74 },
  { model: 'Bajaj Pulsar 150', mileage: 50 },
  { model: 'TVS Jupiter', mileage: 62 },
  { model: 'TVS XL100', mileage: 70 },
  { model: 'Honda CB Shine', mileage: 65 },
  { model: 'Honda CB Unicorn', mileage: 60 },
  { model: 'Yamaha FZ S', mileage: 45 },
  { model: 'Yamaha Fascino', mileage: 55 },
  { model: 'Royal Enfield Bullet 350', mileage: 35 },
  { model: 'Suzuki Access 125', mileage: 55 },
  { model: 'Other (enter manually)', mileage: null },
]

export default function ProfilePage() {
  const router = useRouter()
  const panInputRef = useRef(null)
  const aadharInputRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(null)
  const [message, setMessage] = useState({ text: '', type: '' })

  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    bike_model: '',
    bike_mileage: 40,
    avg_distance_per_order: 3,
    petrol_rate: 105,
    pan_card_url: null,
    aadhar_card_url: null,
  })

  const [selectedBikePreset, setSelectedBikePreset] = useState('')
  const [panPreview, setPanPreview] = useState(null)
  const [aadharPreview, setAadharPreview] = useState(null)

  useEffect(() => {
    const session = localStorage.getItem('deliverySession')
    const phone = localStorage.getItem('deliveryPhone')

    if (!session || !phone) {
      router.push('/login')
      return
    }

    fetchProfile(phone, session)
  }, [router])

  const fetchProfile = async (phone, session) => {
    try {
      const res = await fetch(`/api/profile?phone=${phone}&session=${session}`)
      const data = await res.json()

      if (data.success) {
        setProfile(data.profile)
        if (data.profile.bike_model) {
          const preset = BIKE_PRESETS.find(b => b.model === data.profile.bike_model)
          setSelectedBikePreset(preset ? data.profile.bike_model : 'Other (enter manually)')
        }
      } else if (res.status === 401) {
        localStorage.clear()
        router.push('/login')
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      showMessage('Failed to load profile', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type })
    setTimeout(() => setMessage({ text: '', type: '' }), 4000)
  }

  const handleBikePresetChange = (e) => {
    const selectedModel = e.target.value
    setSelectedBikePreset(selectedModel)
    const preset = BIKE_PRESETS.find(b => b.model === selectedModel)
    if (preset && preset.mileage) {
      setProfile(prev => ({
        ...prev,
        bike_model: selectedModel,
        bike_mileage: preset.mileage,
      }))
    } else if (selectedModel === 'Other (enter manually)') {
      setProfile(prev => ({ ...prev, bike_model: '' }))
    }
  }

  const handleSaveProfile = async () => {
    const phone = localStorage.getItem('deliveryPhone')
    const session = localStorage.getItem('deliverySession')

    if (!profile.bike_model.trim()) {
      showMessage('Please enter your bike model', 'error')
      return
    }
    if (!profile.bike_mileage || profile.bike_mileage <= 0) {
      showMessage('Please enter a valid bike mileage', 'error')
      return
    }
    if (!profile.avg_distance_per_order || profile.avg_distance_per_order <= 0) {
      showMessage('Please enter a valid average distance per order', 'error')
      return
    }
    if (!profile.petrol_rate || profile.petrol_rate <= 0) {
      showMessage('Please enter a valid petrol rate', 'error')
      return
    }

    try {
      setSaving(true)
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          session,
          bike_model: profile.bike_model,
          bike_mileage: profile.bike_mileage,
          avg_distance_per_order: profile.avg_distance_per_order,
          petrol_rate: profile.petrol_rate,
        }),
      })
      const data = await res.json()
      if (data.success) {
        showMessage('Profile saved successfully!', 'success')
      } else {
        showMessage(data.error || 'Failed to save profile', 'error')
      }
    } catch (err) {
      showMessage('Failed to save profile', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDocumentUpload = async (docType, file) => {
    if (!file) return

    const phone = localStorage.getItem('deliveryPhone')
    const session = localStorage.getItem('deliverySession')

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      showMessage('Only JPG, PNG, and PDF files are allowed', 'error')
      return
    }

    try {
      setUploadingDoc(docType)

      // Compress images (higher resolution for KYC docs so text stays readable)
      const fileToUpload = await compressImage(file, { maxDimension: 1600, quality: 0.88 })

      const formData = new FormData()
      formData.append('phone', phone)
      formData.append('session', session)
      formData.append('doc_type', docType)
      formData.append('file', fileToUpload)

      const res = await fetch('/api/profile/upload-documents', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setProfile(prev => ({ ...prev, [`${docType}_url`]: data.url }))
        showMessage(`${docType === 'pan_card' ? 'PAN Card' : 'Aadhaar Card'} uploaded successfully!`, 'success')
      } else {
        showMessage(data.error || 'Failed to upload document', 'error')
      }
    } catch (err) {
      showMessage('Failed to upload document', 'error')
    } finally {
      setUploadingDoc(null)
    }
  }

  const handleFilePreview = (file, setter) => {
    if (!file) return
    if (file.type === 'application/pdf') {
      setter('pdf')
    } else {
      const reader = new FileReader()
      reader.onloadend = () => setter(reader.result)
      reader.readAsDataURL(file)
    }
  }

  // Fuel cost calculation preview
  const totalOrdersEstimate = 10 // sample for demo
  const estimatedDistance = (profile.avg_distance_per_order || 3) * totalOrdersEstimate
  const fuelNeeded = estimatedDistance / (profile.bike_mileage || 40)
  const estimatedCost = fuelNeeded * (profile.petrol_rate || 105)

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading profile...</p>
      </div>
    )
  }

  return (
    <div className={styles.profilePage}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button onClick={() => router.push('/dashboard')} className={styles.backBtn}>
              ← Back to Dashboard
            </button>
            <h1>My Profile</h1>
            <p>{profile.name} | {profile.phone}</p>
          </div>
        </div>

        {message.text && (
          <div className={`${styles.messageBanner} ${message.type === 'error' ? styles.errorBanner : styles.successBanner}`}>
            {message.text}
          </div>
        )}

        {/* Documents Section */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>📋 KYC Documents</h2>
          <p className={styles.cardSubtitle}>Upload your PAN card and Aadhaar card for verification</p>

          <div className={styles.documentsGrid}>
            {/* PAN Card */}
            <div className={styles.documentCard}>
              <div className={styles.documentHeader}>
                <span className={styles.documentIcon}>🪪</span>
                <div>
                  <h3>PAN Card</h3>
                  <p className={profile.pan_card_url ? styles.uploadedStatus : styles.pendingStatus}>
                    {profile.pan_card_url ? '✓ Uploaded' : 'Not uploaded'}
                  </p>
                </div>
              </div>

              {profile.pan_card_url && (
                <a href={profile.pan_card_url} target="_blank" rel="noopener noreferrer" className={styles.viewDocLink}>
                  View Uploaded PAN Card
                </a>
              )}

              <input
                ref={panInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                className={styles.fileInput}
                onChange={(e) => {
                  const file = e.target.files[0]
                  handleFilePreview(file, setPanPreview)
                  handleDocumentUpload('pan_card', file)
                }}
              />

              {panPreview && panPreview !== 'pdf' && (
                <div className={styles.docPreview}>
                  <img src={panPreview} alt="PAN Card preview" />
                </div>
              )}

              <button
                onClick={() => panInputRef.current?.click()}
                disabled={uploadingDoc === 'pan_card'}
                className={styles.uploadDocBtn}
              >
                {uploadingDoc === 'pan_card' ? 'Uploading...' : profile.pan_card_url ? '↑ Replace PAN Card' : '↑ Upload PAN Card'}
              </button>
            </div>

            {/* Aadhaar Card */}
            <div className={styles.documentCard}>
              <div className={styles.documentHeader}>
                <span className={styles.documentIcon}>🪪</span>
                <div>
                  <h3>Aadhaar Card</h3>
                  <p className={profile.aadhar_card_url ? styles.uploadedStatus : styles.pendingStatus}>
                    {profile.aadhar_card_url ? '✓ Uploaded' : 'Not uploaded'}
                  </p>
                </div>
              </div>

              {profile.aadhar_card_url && (
                <a href={profile.aadhar_card_url} target="_blank" rel="noopener noreferrer" className={styles.viewDocLink}>
                  View Uploaded Aadhaar Card
                </a>
              )}

              <input
                ref={aadharInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                className={styles.fileInput}
                onChange={(e) => {
                  const file = e.target.files[0]
                  handleFilePreview(file, setAadharPreview)
                  handleDocumentUpload('aadhar_card', file)
                }}
              />

              {aadharPreview && aadharPreview !== 'pdf' && (
                <div className={styles.docPreview}>
                  <img src={aadharPreview} alt="Aadhaar Card preview" />
                </div>
              )}

              <button
                onClick={() => aadharInputRef.current?.click()}
                disabled={uploadingDoc === 'aadhar_card'}
                className={styles.uploadDocBtn}
              >
                {uploadingDoc === 'aadhar_card' ? 'Uploading...' : profile.aadhar_card_url ? '↑ Replace Aadhaar Card' : '↑ Upload Aadhaar Card'}
              </button>
            </div>
          </div>
        </div>

        {/* Bike & Fuel Section */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>🏍️ Vehicle & Fuel Settings</h2>
          <p className={styles.cardSubtitle}>These settings are used to calculate your delivery fuel cost</p>

          <div className={styles.formGrid}>
            {/* Bike Model Preset */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Select Bike Model</label>
              <select
                value={selectedBikePreset}
                onChange={handleBikePresetChange}
                className={styles.select}
              >
                <option value="">-- Select your bike --</option>
                {BIKE_PRESETS.map(b => (
                  <option key={b.model} value={b.model}>
                    {b.model}{b.mileage ? ` (~${b.mileage} km/l)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Bike Model (manual if Other) */}
            {selectedBikePreset === 'Other (enter manually)' && (
              <div className={styles.formGroup}>
                <label className={styles.label}>Bike Model Name</label>
                <input
                  type="text"
                  value={profile.bike_model}
                  onChange={(e) => setProfile(prev => ({ ...prev, bike_model: e.target.value }))}
                  placeholder="e.g. Honda Shine 125"
                  className={styles.input}
                />
              </div>
            )}

            {/* Mileage */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Bike Mileage (km/liter)</label>
              <input
                type="number"
                value={profile.bike_mileage}
                onChange={(e) => setProfile(prev => ({ ...prev, bike_mileage: e.target.value }))}
                placeholder="e.g. 60"
                min="1"
                max="200"
                className={styles.input}
              />
              <p className={styles.hint}>Check your bike's official mileage or average real-world mileage</p>
            </div>

            {/* Avg distance per order */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Avg. Distance Per Order (km)</label>
              <input
                type="number"
                value={profile.avg_distance_per_order}
                onChange={(e) => setProfile(prev => ({ ...prev, avg_distance_per_order: e.target.value }))}
                placeholder="e.g. 3"
                min="0.1"
                max="50"
                step="0.1"
                className={styles.input}
              />
              <p className={styles.hint}>Estimated km per delivery stop in your area (typically 2–5 km)</p>
            </div>

            {/* Petrol Rate */}
            <div className={styles.formGroup}>
              <label className={styles.label}>Current Petrol Rate (₹/liter)</label>
              <input
                type="number"
                value={profile.petrol_rate}
                onChange={(e) => setProfile(prev => ({ ...prev, petrol_rate: e.target.value }))}
                placeholder="e.g. 105"
                min="1"
                className={styles.input}
              />
              <p className={styles.hint}>Update to today's petrol price in your city</p>
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className={styles.saveBtn}
          >
            {saving ? 'Saving...' : '💾 Save Vehicle Settings'}
          </button>
        </div>

        {/* Fuel Cost Preview */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>⛽ Fuel Cost Formula</h2>
          <p className={styles.cardSubtitle}>How your delivery fuel cost is calculated</p>

          <div className={styles.formulaBox}>
            <div className={styles.formulaRow}>
              <span className={styles.formulaLabel}>Route Distance</span>
              <span className={styles.formulaEq}>=</span>
              <span className={styles.formulaValue}>Number of Orders × {profile.avg_distance_per_order || 3} km</span>
            </div>
            <div className={styles.formulaRow}>
              <span className={styles.formulaLabel}>Fuel Needed</span>
              <span className={styles.formulaEq}>=</span>
              <span className={styles.formulaValue}>Route Distance ÷ {profile.bike_mileage || 40} km/l</span>
            </div>
            <div className={styles.formulaRow}>
              <span className={styles.formulaLabel}>Fuel Cost</span>
              <span className={styles.formulaEq}>=</span>
              <span className={styles.formulaValue}>Fuel Needed × ₹{profile.petrol_rate || 105}/liter</span>
            </div>

            <div className={styles.formulaDivider}></div>

            <div className={styles.exampleBox}>
              <p className={styles.exampleTitle}>Example: 10 orders today</p>
              <div className={styles.exampleCalc}>
                <span>Distance: 10 × {profile.avg_distance_per_order || 3} = <strong>{estimatedDistance.toFixed(1)} km</strong></span>
                <span>Fuel: {estimatedDistance.toFixed(1)} ÷ {profile.bike_mileage || 40} = <strong>{fuelNeeded.toFixed(2)} L</strong></span>
                <span>Cost: {fuelNeeded.toFixed(2)} × ₹{profile.petrol_rate || 105} = <strong className={styles.costHighlight}>₹{estimatedCost.toFixed(2)}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
