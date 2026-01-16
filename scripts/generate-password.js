#!/usr/bin/env node

/**
 * Password Hash Generator for Delivery Boy Accounts
 *
 * Usage:
 * node scripts/generate-password.js <password>
 *
 * Example:
 * node scripts/generate-password.js mySecurePassword123
 */

const crypto = require('crypto')

function generatePasswordHash(password) {
  // Generate random salt
  const salt = crypto.randomBytes(16).toString('hex')

  // Hash password with salt using PBKDF2 (same as main app)
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')

  return { hash, salt }
}

// Get password from command line argument
const password = process.argv[2]

if (!password) {
  console.error('Error: Please provide a password')
  console.log('\nUsage:')
  console.log('  node scripts/generate-password.js <password>')
  console.log('\nExample:')
  console.log('  node scripts/generate-password.js mySecurePassword123')
  process.exit(1)
}

const { hash, salt } = generatePasswordHash(password)

console.log('\n✅ Password hash generated successfully!\n')
console.log('Password:', password)
console.log('\nHash:', hash)
console.log('\nSalt:', salt)
console.log('\n📋 SQL to create delivery boy account:\n')
console.log(`INSERT INTO customer_accounts (phone_number, name, password_hash, password_salt, role, email)
VALUES (
  '1234567890',  -- Replace with actual phone number
  'Delivery Boy Name',  -- Replace with actual name
  '${hash}',
  '${salt}',
  'delivery_boy',
  'delivery@example.com'  -- Optional email
)
ON CONFLICT (phone_number) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    password_salt = EXCLUDED.password_salt,
    role = 'delivery_boy';

-- Also add to user_roles table
INSERT INTO user_roles (phone_number, name, role)
VALUES ('1234567890', 'Delivery Boy Name', 'delivery_boy')
ON CONFLICT (phone_number) DO UPDATE SET role = 'delivery_boy';
`)

console.log('\n⚠️  Remember to:')
console.log('  1. Replace phone_number with actual 10-digit number')
console.log('  2. Replace name with actual delivery personnel name')
console.log('  3. Keep the password secure and share it only with the delivery person')
console.log('')
