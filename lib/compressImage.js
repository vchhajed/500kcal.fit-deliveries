/**
 * Compress an image File using the Canvas API before upload.
 *
 * @param {File} file           - Original image file
 * @param {object} options
 * @param {number} options.maxDimension - Longest edge in pixels (default 1280)
 * @param {number} options.quality      - JPEG quality 0-1 (default 0.82)
 * @returns {Promise<File>}     - Compressed File object
 */
export async function compressImage(file, { maxDimension = 1280, quality = 0.82 } = {}) {
  // Only compress actual images; pass PDFs through untouched
  if (!file.type.startsWith('image/')) return file

  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let { width, height } = img

      // Scale down if either side exceeds maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height / width) * maxDimension)
          width = maxDimension
        } else {
          width = Math.round((width / height) * maxDimension)
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      // White background so transparent PNGs become white-on-JPEG
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            // Canvas failed — return original file unchanged
            resolve(file)
            return
          }
          // Preserve original filename, force jpeg mime
          const compressed = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg', lastModified: Date.now() }
          )
          resolve(compressed)
        },
        'image/jpeg',
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file) // fallback: upload original
    }

    img.src = url
  })
}
