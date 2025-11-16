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
  ]

  return (
    <div className="font-picker-inline">
      <div className="font-selector-inline">
        <label htmlFor="font-picker">Font:</label>
        <select
          id="font-picker"
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
      <div className="font-size-selector-inline">
        <label htmlFor="font-size-picker">Size:</label>
        <input
          id="font-size-picker"
          type="number"
          min="8"
          max="200"
          value={fontSize}
          onChange={(e) => onFontSizeChange(parseInt(e.target.value) || 24)}
          title="Font size"
        />
      </div>
    </div>
  )
}

