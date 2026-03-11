'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './signup.module.css'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: details, 2: welcome
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async (e) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) { setError('Please enter your full name'); return }
    if (phone.length !== 10) { setError('Please enter a valid 10-digit phone number'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, password }),
      })
      const data = await res.json()

      if (data.success) {
        localStorage.setItem('deliverySession', data.sessionToken)
        localStorage.setItem('deliveryPhone', data.phone)
        localStorage.setItem('deliveryName', data.name)
        localStorage.setItem('deliveryId', data.id)
        setStep(2)
      } else {
        setError(data.error || 'Failed to create account')
      }
    } catch {
      setError('Failed to connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const passwordStrength = () => {
    if (!password) return null
    if (password.length < 6) return { label: 'Too short', color: '#e74c3c', width: '25%' }
    if (password.length < 8) return { label: 'Weak', color: '#e67e22', width: '50%' }
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) return { label: 'Strong', color: '#27ae60', width: '100%' }
    return { label: 'Good', color: '#3498db', width: '75%' }
  }

  const strength = passwordStrength()

  return (
    <div className={styles.container}>
      <div className={styles.signupCard}>
        <div className={styles.logo}>
          <h1>🚚 500Kcal.fit</h1>
          <p>Delivery Partner Registration</p>
        </div>

        {/* Step 1 — Sign Up Form */}
        {step === 1 && (
          <form onSubmit={handleSignup} className={styles.form}>
            <h2>Create Account</h2>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.inputGroup}>
              <label>Full Name</label>
              <input
                type="text"
                placeholder="e.g. Arman Khan"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Phone Number</label>
              <div className={styles.phoneInput}>
                <span className={styles.countryCode}>+91</span>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  disabled={loading}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Password</label>
              <div className={styles.passwordInput}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} className={styles.togglePassword}>
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {strength && (
                <>
                  <div className={styles.strengthBar}>
                    <div className={styles.strengthFill} style={{ width: strength.width, background: strength.color }} />
                  </div>
                  <p className={styles.strengthLabel} style={{ color: strength.color }}>{strength.label}</p>
                </>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label>Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
              {confirmPassword && password !== confirmPassword && (
                <p className={styles.mismatch}>Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              className={styles.primaryBtn}
              disabled={loading || !name.trim() || phone.length !== 10 || password.length < 6 || password !== confirmPassword}
            >
              {loading && <span className={styles.btnSpinner} />}
              {loading ? 'Creating Account...' : 'Create Account →'}
            </button>

            <p className={styles.footerLink}>
              Already have an account? <a href="/login">Login</a>
            </p>
          </form>
        )}

        {/* Step 2 — Welcome */}
        {step === 2 && (
          <div className={styles.welcomeCard}>
            <div className={styles.welcomeIcon}>🎉</div>
            <h2>Welcome, {name}!</h2>
            <p className={styles.welcomeText}>Your account is ready. Complete your profile to start delivering.</p>

            <div className={styles.nextSteps}>
              <div className={styles.nextStep}>
                <span className={styles.nextStepNum}>1</span>
                <div>
                  <strong>Add your bike details</strong>
                  <p>Set mileage to track fuel costs</p>
                </div>
              </div>
              <div className={styles.nextStep}>
                <span className={styles.nextStepNum}>2</span>
                <div>
                  <strong>Upload KYC documents</strong>
                  <p>PAN card and Aadhaar card</p>
                </div>
              </div>
              <div className={styles.nextStep}>
                <span className={styles.nextStepNum}>3</span>
                <div>
                  <strong>Start delivering</strong>
                  <p>View your assigned orders</p>
                </div>
              </div>
            </div>

            <button onClick={() => router.push('/profile')} className={styles.primaryBtn}>
              Complete Profile
            </button>
            <button onClick={() => router.push('/dashboard')} className={styles.skipBtn}>
              Go to Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
