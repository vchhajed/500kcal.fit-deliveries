'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { RecaptchaVerifier, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth } from '../../lib/firebase'
import styles from './forgot-password.module.css'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState(1) // 1: phone, 2: OTP, 3: new password
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
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
    setLoading(true)

    try {
      if (phone.length !== 10) {
        setError('Please enter a valid 10-digit phone number')
        setLoading(false)
        return
      }

      // Check if account exists
      const checkResponse = await fetch(`/api/auth/check-account?phone=${phone}`)
      const checkData = await checkResponse.json()

      if (!checkData.exists) {
        setError('No account found with this phone number')
        setLoading(false)
        return
      }

      if (checkData.role !== 'delivery_boy') {
        setError('This service is for delivery personnel only')
        setLoading(false)
        return
      }

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

      // OTP verified successfully, move to password reset
      setStep(3)
      setError('')
    } catch (err) {
      console.error('Error verifying OTP:', err)
      setError('Invalid OTP. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(false)
        return
      }

      if (newPassword !== confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }

      // Reset password
      const response = await fetch('/api/auth/forgot-password/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          newPassword,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Password reset successful! Please login with your new password.')
        router.push('/login')
      } else {
        setError(data.error || 'Failed to reset password')
      }
    } catch (err) {
      console.error('Error resetting password:', err)
      setError('Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.forgotCard}>
        <div className={styles.logo}>
          <h1>🚚 500Kcal.fit</h1>
          <p>Reset Password</p>
        </div>

        {/* Step 1: Phone Number */}
        {step === 1 && (
          <form onSubmit={handleSendOTP} className={styles.form}>
            <h2>Forgot Password?</h2>
            <p className={styles.subtitle}>Enter your phone number to reset password</p>

            {error && <div className={styles.error}>{error}</div>}

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
                autoFocus
              />
            </div>

            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>

            <div className={styles.footer}>
              <p>Remember password? <a href="/login">Login</a></p>
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

        {/* Step 3: New Password */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className={styles.form}>
            <h2>Create New Password</h2>
            <p className={styles.subtitle}>Enter your new password</p>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.inputGroup}>
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div id="recaptcha-container"></div>
      </div>
    </div>
  )
}
