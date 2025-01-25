import { useState, useEffect, useRef } from 'react'
import './App.css'

function generateRandomPastelColor() {
  // Generate base RGB values between 128-230 for pastel/muted effect
  const r = Math.floor(Math.random() * 102) + 128
  const g = Math.floor(Math.random() * 102) + 128
  const b = Math.floor(Math.random() * 102) + 128

  // Convert to hex
  const toHex = (n) => {
    const hex = n.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function App() {
  const [params, setParams] = useState({
    strips: 10,
    startColor: generateRandomPastelColor(),
    midColor: generateRandomPastelColor(),
    endColor: generateRandomPastelColor(),
    noiseScale: 0.02,
    verticalBias: 0.7,
    text: '',
    fontSize: 48,
    textColor: '#ffffff',
    waveAmplitude: 30,
    waveFrequency: 2,
    waveOffset: 0.5
  })

  const canvasRef = useRef(null)
  const gradientCacheRef = useRef({})
  const animationFrameRef = useRef(null)

  const handleParamChange = (e) => {
    const { name, value } = e.target
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      setParams(prev => ({
        ...prev,
        [name]: value
      }))
    })
  }

  // Linear interpolation function
  const lerp = (start, end, t) => {
    return start * (1 - t) + end * t
  }

  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  // Map grayscale value to color gradient
  const mapToColor = (value, startColor, midColor, endColor) => {
    const start = hexToRgb(startColor)
    const mid = hexToRgb(midColor)
    const end = hexToRgb(endColor)

    // If value is in first half, interpolate between start and mid
    // If value is in second half, interpolate between mid and end
    if (value <= 0.5) {
      const t = value * 2  // Scale 0-0.5 to 0-1
      const r = Math.floor(lerp(start.r, mid.r, t))
      const g = Math.floor(lerp(start.g, mid.g, t))
      const b = Math.floor(lerp(start.b, mid.b, t))
      return `rgb(${r},${g},${b})`
    } else {
      const t = (value - 0.5) * 2  // Scale 0.5-1 to 0-1
      const r = Math.floor(lerp(mid.r, end.r, t))
      const g = Math.floor(lerp(mid.g, end.g, t))
      const b = Math.floor(lerp(mid.b, end.b, t))
      return `rgb(${r},${g},${b})`
    }
  }

  const getGradientColor = (y, stripPosition) => {
    const key = `${y}-${stripPosition}-${params.startColor}-${params.midColor}-${params.endColor}-${params.verticalBias}`

    if (gradientCacheRef.current[key]) {
      return gradientCacheRef.current[key]
    }

    const baseValue = y
    const biasedValue = lerp(baseValue, stripPosition, params.verticalBias)
    const value = Math.max(0, Math.min(1, biasedValue))
    const color = mapToColor(value, params.startColor, params.midColor, params.endColor)
    const rgbaColor = color.replace('rgb', 'rgba').replace(')', ', 0.5)')

    gradientCacheRef.current[key] = rgbaColor
    return rgbaColor
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (params.startColor || params.midColor || params.endColor || params.verticalBias) {
      gradientCacheRef.current = {}
    }

    canvas.width = window.innerWidth * 0.8
    canvas.height = window.innerHeight * 0.8

    const stripHeight = canvas.height / params.strips

    if (params.text) {
      ctx.font = `${params.fontSize}px Arial`
      ctx.fillStyle = params.textColor
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(params.text, canvas.width / 2, canvas.height / 2)
    }

    for (let i = 0; i < params.strips; i++) {
      const stripPosition = i / (params.strips - 1)
      const yOffset = i * stripHeight

      ctx.beginPath()
      ctx.moveTo(0, yOffset)

      const stripOffset = i * params.waveOffset * Math.PI

      for (let x = 0; x <= canvas.width; x++) {
        const wave = Math.sin((x * params.waveFrequency * 0.01) + stripOffset) * params.waveAmplitude
        ctx.lineTo(x, yOffset + wave)
      }

      ctx.lineTo(canvas.width, yOffset + stripHeight)
      for (let x = canvas.width; x >= 0; x--) {
        const wave = Math.sin((x * params.waveFrequency * 0.01) + stripOffset) * params.waveAmplitude
        ctx.lineTo(x, yOffset + stripHeight + wave)
      }
      ctx.closePath()

      const gradient = ctx.createLinearGradient(
        0, yOffset, 0, yOffset + stripHeight
      )

      for (let y = 0; y <= 1; y += 0.2) {
        const color = getGradientColor(y, stripPosition)
        gradient.addColorStop(y, color)
      }

      ctx.fillStyle = gradient
      ctx.fill()
    }

    if (params.noiseScale > 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 16) {
        const noise = (Math.random() - 0.5) * params.noiseScale * 3

        data[i] = Math.max(0, Math.min(255, data[i] + noise))
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise))
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise))
      }

      ctx.putImageData(imageData, 0, 0)
      ctx.filter = `blur(${params.noiseScale * 0.2}px)`
      ctx.drawImage(canvas, 0, 0)
      ctx.filter = 'none'
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [params])

  return (
    <div className="app">
      <div className="controls">
        <div className="control-group">
          <label>Strips:</label>
          <input
            type="range"
            name="strips"
            min="1"
            max="50"
            value={params.strips}
            onChange={handleParamChange}
          />
          <span>{params.strips}</span>
        </div>

        <div className="control-group">
          <label>Frost Effect:</label>
          <input
            type="range"
            name="noiseScale"
            min="0"
            max="20"
            step="0.1"
            value={params.noiseScale}
            onChange={handleParamChange}
          />
          <span>{params.noiseScale}</span>
        </div>

        <div className="control-group">
          <label>Vertical Bias:</label>
          <input
            type="range"
            name="verticalBias"
            min="0"
            max="1"
            step="0.1"
            value={params.verticalBias}
            onChange={handleParamChange}
          />
          <span>{params.verticalBias}</span>
        </div>

        <div className="control-group">
          <label>Start Color:</label>
          <input
            type="color"
            name="startColor"
            value={params.startColor}
            onChange={handleParamChange}
          />
        </div>

        <div className="control-group">
          <label>Mid Color:</label>
          <input
            type="color"
            name="midColor"
            value={params.midColor}
            onChange={handleParamChange}
          />
        </div>

        <div className="control-group">
          <label>End Color:</label>
          <input
            type="color"
            name="endColor"
            value={params.endColor}
            onChange={handleParamChange}
          />
        </div>

        <div className="control-group text-controls">
          <label>Text:</label>
          <input
            type="text"
            name="text"
            value={params.text}
            onChange={handleParamChange}
            placeholder="Enter text..."
          />
        </div>

        <div className="control-group">
          <label>Font Size:</label>
          <input
            type="range"
            name="fontSize"
            min="12"
            max="200"
            value={params.fontSize}
            onChange={handleParamChange}
          />
          <span>{params.fontSize}px</span>
        </div>

        <div className="control-group">
          <label>Text Color:</label>
          <input
            type="color"
            name="textColor"
            value={params.textColor}
            onChange={handleParamChange}
          />
        </div>

        <div className="control-group">
          <label>Wave Size:</label>
          <input
            type="range"
            name="waveAmplitude"
            min="0"
            max="100"
            value={params.waveAmplitude}
            onChange={handleParamChange}
          />
          <span>{params.waveAmplitude}</span>
        </div>

        <div className="control-group">
          <label>Wave Freq:</label>
          <input
            type="range"
            name="waveFrequency"
            min="0.1"
            max="10"
            step="0.1"
            value={params.waveFrequency}
            onChange={handleParamChange}
          />
          <span>{params.waveFrequency}</span>
        </div>

        <div className="control-group">
          <label>Wave Offset:</label>
          <input
            type="range"
            name="waveOffset"
            min="0"
            max="2"
            step="0.1"
            value={params.waveOffset}
            onChange={handleParamChange}
          />
          <span>{params.waveOffset}</span>
        </div>
      </div>

      <canvas ref={canvasRef} className="canvas"></canvas>
    </div>
  )
}

export default App