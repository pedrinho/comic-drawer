import { useState } from 'react'
import './PanelLayoutModal.css'

interface PanelLayoutModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (rows: number, columns: number[]) => void
}

export default function PanelLayoutModal({ isOpen, onClose, onConfirm }: PanelLayoutModalProps) {
  const [rows, setRows] = useState(1)
  const [columnsPerRow, setColumnsPerRow] = useState<number[]>([1])

  const handleRowsChange = (newRows: number) => {
    setRows(newRows)
    // Adjust columns array to match new rows
    const newColumns = [...columnsPerRow]
    while (newColumns.length < newRows) {
      newColumns.push(1)
    }
    newColumns.splice(newRows)
    setColumnsPerRow(newColumns)
  }

  const handleColumnsChange = (rowIndex: number, newColumns: number) => {
    const newColumnsArray = [...columnsPerRow]
    newColumnsArray[rowIndex] = newColumns
    setColumnsPerRow(newColumnsArray)
  }

  const handleConfirm = () => {
    onConfirm(rows, columnsPerRow)
    // Reset form
    setRows(1)
    setColumnsPerRow([1])
    onClose()
  }

  const handleCancel = () => {
    // Reset form
    setRows(1)
    setColumnsPerRow([1])
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Configure Panel Layout</h2>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="rows">Number of Rows:</label>
            <input
              id="rows"
              type="number"
              min="1"
              max="5"
              value={rows}
              onChange={(e) => handleRowsChange(Number(e.target.value))}
            />
          </div>
          
          <div className="columns-config">
            <label>Columns per Row:</label>
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="row-config">
                <label htmlFor={`row-${i}`}>Row {i + 1}:</label>
                <input
                  id={`row-${i}`}
                  type="number"
                  min="1"
                  max="5"
                  value={columnsPerRow[i] || 1}
                  onChange={(e) => handleColumnsChange(i, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>
        
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleConfirm}>
            Create Panel
          </button>
        </div>
      </div>
    </div>
  )
}
