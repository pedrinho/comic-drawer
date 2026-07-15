import { describe, it, expect } from 'vitest'
import { floodFillImageData } from './floodFill'

// Build a bare ImageData-like buffer (avoids depending on the jsdom ImageData global).
const makeImageData = (width: number, height: number, fill: [number, number, number, number] = [255, 255, 255, 255]): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fill[0]
    data[i + 1] = fill[1]
    data[i + 2] = fill[2]
    data[i + 3] = fill[3]
  }
  return { data, width, height } as ImageData
}

const px = (img: ImageData, x: number, y: number): [number, number, number, number] => {
  const i = (y * img.width + x) * 4
  return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!]
}

const setPx = (img: ImageData, x: number, y: number, c: [number, number, number, number]) => {
  const i = (y * img.width + x) * 4
  img.data[i] = c[0]
  img.data[i + 1] = c[1]
  img.data[i + 2] = c[2]
  img.data[i + 3] = c[3]
}

describe('floodFillImageData', () => {
  it('fills a white region and stops at a colour boundary', () => {
    const img = makeImageData(5, 1) // white row
    setPx(img, 2, 0, [0, 0, 0, 255]) // black barrier at x=2

    floodFillImageData(img, 0, 0, '#ff0000') // fill from the left

    expect(px(img, 0, 0)).toEqual([255, 0, 0, 255])
    expect(px(img, 1, 0)).toEqual([255, 0, 0, 255])
    expect(px(img, 2, 0)).toEqual([0, 0, 0, 255]) // barrier untouched
    expect(px(img, 3, 0)).toEqual([255, 255, 255, 255]) // right side untouched
    expect(px(img, 4, 0)).toEqual([255, 255, 255, 255])
  })

  it('fills a bounded 2D region flood (4-connected)', () => {
    const img = makeImageData(3, 3)
    floodFillImageData(img, 1, 1, '#0000ff')
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(px(img, x, y)).toEqual([0, 0, 255, 255])
      }
    }
  })

  it('respects tolerance — near-target pixels are absorbed', () => {
    const img = makeImageData(2, 1, [255, 255, 255, 255])
    setPx(img, 1, 0, [250, 250, 250, 255]) // within the tolerance of 10

    floodFillImageData(img, 0, 0, '#000000')

    expect(px(img, 0, 0)).toEqual([0, 0, 0, 255])
    expect(px(img, 1, 0)).toEqual([0, 0, 0, 255]) // absorbed via tolerance
  })

  it('does not cross a boundary outside tolerance', () => {
    const img = makeImageData(2, 1, [255, 255, 255, 255])
    setPx(img, 1, 0, [200, 200, 200, 255]) // difference of 55 > tolerance

    floodFillImageData(img, 0, 0, '#000000')

    expect(px(img, 0, 0)).toEqual([0, 0, 0, 255])
    expect(px(img, 1, 0)).toEqual([200, 200, 200, 255]) // untouched
  })

  it('matches a transparent (erased) target and stops at opaque pixels', () => {
    const img = makeImageData(3, 1, [0, 0, 0, 0]) // fully transparent row
    setPx(img, 2, 0, [10, 20, 30, 255]) // opaque pixel

    floodFillImageData(img, 0, 0, '#00ff00') // click on a transparent pixel

    expect(px(img, 0, 0)).toEqual([0, 255, 0, 255])
    expect(px(img, 1, 0)).toEqual([0, 255, 0, 255])
    expect(px(img, 2, 0)).toEqual([10, 20, 30, 255]) // opaque pixel untouched
  })

  it('no-ops when the click is out of bounds (undefined target colour)', () => {
    const img = makeImageData(2, 2)
    const before = Uint8ClampedArray.from(img.data)
    floodFillImageData(img, 5, 5, '#ff0000')
    expect(img.data).toEqual(before)
  })
})
