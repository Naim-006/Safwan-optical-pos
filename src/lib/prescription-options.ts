// Generate prescription dropdown options with proper ordering
export const generateSphereOptions = () => {
  const options: { value: string; label: string }[] = []
  
  // Positive values first (up to +30)
  for (let i = 30; i >= 0.25; i -= 0.25) {
    const value = i.toFixed(2)
    options.push({ value, label: `+${value} D` })
  }
  
  // Zero value
  options.push({ value: '0.00', label: '0.00 D' })
  
  // Negative values below (down to -30)
  for (let i = -0.25; i >= -30; i -= 0.25) {
    const value = i.toFixed(2)
    options.push({ value, label: `${value} D` })
  }
  
  return options
}

export const generateCylinderOptions = () => {
  const options: { value: string; label: string }[] = []
  
  // Positive values first (up to +20)
  for (let i = 20; i >= 0.25; i -= 0.25) {
    const value = i.toFixed(2)
    options.push({ value, label: `+${value} D` })
  }
  
  // Zero value
  options.push({ value: '0.00', label: '0.00 D' })
  
  // Negative values below (down to -20)
  for (let i = -0.25; i >= -20; i -= 0.25) {
    const value = i.toFixed(2)
    options.push({ value, label: `${value} D` })
  }
  
  return options
}

export const generateAxisOptions = () => {
  const options: { value: string; label: string }[] = []
  for (let i = 0; i <= 180; i++) {
    const value = i.toString()
    options.push({ value, label: `${i}°` })
  }
  return options
}

export const generateAddOptions = () => {
  const options: { value: string; label: string }[] = []
  for (let i = 5; i >= 0; i -= 0.25) {
    const value = i.toFixed(2)
    options.push({ value, label: `+${value} D` })
  }
  return options
}

export const generateIpdOptions = () => {
  const options: { value: string; label: string }[] = []
  for (let i = 80; i >= 50; i -= 0.5) {
    const value = i.toFixed(1)
    options.push({ value, label: `${value} mm` })
  }
  return options
}

// Pre-generated options for better performance
export const sphereOptions = generateSphereOptions()
export const cylinderOptions = generateCylinderOptions()
export const axisOptions = generateAxisOptions()
export const addOptions = generateAddOptions()
export const ipdOptions = generateIpdOptions()
