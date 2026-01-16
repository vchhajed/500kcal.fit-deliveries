'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth } from '../../lib/firebase'
import styles from './signup.module.css'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: phone, 2: OTP, 3: create password
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [verificationId, setVerificationId] = useState(null)

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        window.recaptchaVerifier = null
      }
    }
  }, [])

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      try {
        console.log('Setting up reCAPTCHA verifier...')
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: (response) => {
            console.log('reCAPTCHA solved:', response)
          },
          'expired-callback': () => {
            console.log('reCAPTCHA expired - clearing verifier')
            if (window.recaptchaVerifier) {
              try {
                window.recaptchaVerifier.clear()
              } catch (e) {
                console.error('Error clearing expired reCAPTCHA:', e)
              }
              window.recaptchaVerifier = null
            }
          },
          'error-callback': (error) => {
            console.error('reCAPTCHA error callback:', error)
            setError('reCAPTCHA verification failed. Please refresh the page.')
          }
        })

        console.log('reCAPTCHA verifier created successfully')
      } catch (error) {
        console.error('Error setting up reCAPTCHA:', error)
        setError('Failed to initialize reCAPTCHA. Please refresh the page.')
      }
    } else {
      console.log('reCAPTCHA verifier already exists')
    }
  }

  const handleSendOTP = async (e) => {
    e.preventDefault()
    setError('')

    try {
      if (!name.trim()) {
        setError('Please enter your name')
        return
      }

      if (phone.length !== 10) {
        setError('Please enter a valid 10-digit phone number')
        return
      }

      setLoading(true)

      // Setup reCAPTCHA if not already setup
      if (!window.recaptchaVerifier) {
        console.log('Initializing reCAPTCHA...')
        setupRecaptcha()
      }

      const appVerifier = window.recaptchaVerifier

      if (!appVerifier) {
        throw new Error('Failed to initialize reCAPTCHA. Please refresh the page.')
      }

      const phoneNumber = `+91${phone}`
      console.log('Sending OTP to:', phoneNumber)

      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, appVerifier)
      console.log('OTP sent successfully!')

      setVerificationId(confirmationResult)
      setStep(2)
      setError('')
    } catch (err) {
      console.error('Error sending OTP:', err)
      console.error('Error code:', err.code)
      console.error('Error message:', err.message)

      let errorMessage = 'Failed to send OTP. Please try again.'

      if (err.code === 'auth/invalid-app-credential') {
        errorMessage = 'Firebase Phone Authentication is not enabled. Please enable it in Firebase Console.'
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many requests. Please try again later.'
      } else if (err.code === 'auth/invalid-phone-number') {
        errorMessage = 'Invalid phone number format.'
      } else if (err.code === 'auth/quota-exceeded') {
        errorMessage = 'SMS quota exceeded. Please try again later.'
      }

      setError(errorMessage)

      // Clear reCAPTCHA on error
      if (window.recaptchaVerifier) {
        try {
          window.recaptchaVerifier.clear()
        } catch (e) {
          console.error('Error clearing reCAPTCHA:', e)
        }
        window.recaptchaVerifier = null
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (otp.length !== 6) {
        setError('Please enter a valid 6-digit OTP')
        setLoading(false)
        return
      }

      // Verify OTP with Firebase
      const credential = PhoneAuthProvider.credential(verificationId.verificationId, otp)
      await signInWithCredential(auth, credential)
      console.log('OTP verified successfully')

      // OTP verified successfully, move to password creation
      setStep(3)
      setError('')
    } catch (err) {
      console.error('Error verifying OTP:', err)
      setError('Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAccount = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(false)
        return
      }

      if (password !== confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }

      // Create account in database
      const response = await fetch('/api/auth/signup/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          name,
          password,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Store session data
        localStorage.setItem('deliverySession', data.sessionToken)
        localStorage.setItem('deliveryPhone', phone)
        localStorage.setItem('deliveryName', name)
        localStorage.setItem('deliveryId', data.id)

        // Redirect to dashboard
        alert('Account created successfully!')
        router.push('/dashboard')
      } else {
        setError(data.error || 'Failed to create account')
      }
    } catch (err) {
      console.error('Error creating account:', err)
      setError('Failed to create account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.signupCard}>
        <div className={styles.logo}>
          <h1>🚚 500Kcal.fit</h1>
          <p>Delivery Portal - Sign Up</p>
        </div>

        {/* Step 1: Phone & Name */}
        {step === 1 && (
          <form onSubmit={handleSendOTP} className={styles.form}>
            <h2>Create Account</h2>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.inputGroup}>
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                placeholder="10-digit phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                required
                maxLength={10}
                disabled={loading}
              />
            </div>

            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>

            <div id="recaptcha-container"></div>

            <div className={styles.footer}>
              <p>Already have an account? <a href="/login">Login</a></p>
            </div>
          </form>
        )}

        {/* Step 2: Verify OTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyOTP} className={styles.form}>
            <h2>Verify Phone Number</h2>
            <p className={styles.subtitle}>Enter the OTP sent to +91{phone}</p>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.inputGroup}>
              <label htmlFor="otp">OTP Code</label>
              <input
                id="otp"
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                disabled={loading}
                autoFocus
              />
            </div>

            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1)
                setOtp('')
                setError('')
              }}
              className={styles.secondaryBtn}
              disabled={loading}
            >
              Change Phone Number
            </button>
          </form>
        )}

        {/* Step 3: Create Password */}
        {step === 3 && (
          <form onSubmit={handleCreateAccount} className={styles.form}>
            <h2>Create Password</h2>
            <p className={styles.subtitle}>Set a secure password for your account</p>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
                autoFocus
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
            </div>

            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
