import './FontPicker.css'

interface FontPickerProps {
  isOpen: boolean
  font: string
  onFontChange: (font: string) => void
  fontSize: number
  onFontSizeChange: (fontSize: number) => void
}

export default function FontPicker({ isOpen, font, onFontChange, fontSize, onFontSizeChange }: FontPickerProps) {
  if (!isOpen) return null

  const fonts = [
    'Arial',
    'Times New Roman',
    'Courier New',
    'Georgia',
    'Verdana',
    'Comic Sans MS',
    'Impact',
    'Trebuchet MS',
    'Helvetica',
    '-apple-system'
  ]

  const handleDecreaseSize = () => onFontSizeChange(Math.max(8, fontSize - 2))
  const handleIncreaseSize = () => onFontSizeChange(Math.min(200, fontSize + 2))

  return (
    <div className="font-picker-container">
      <div className="font-control-row">
        <select
          className="font-select"
          value={font}
          onChange={(e) => onFontChange(e.target.value)}
          title="Select font"
        >
          {fonts.map((fontOption) => (
            <option key={fontOption} value={fontOption}>
              {fontOption}
            </option>
          ))}
        </select>
      </div>

      <div className="font-size-controls">
        <button className="font-size-btn" onClick={handleDecreaseSize} title="Decrease size">
          A-
        </button>
        <div className="font-size-display">{fontSize}px</div>
        <button className="font-size-btn" onClick={handleIncreaseSize} title="Increase size">
          A+
        </button>
      </div>
    </div>
  )
}

