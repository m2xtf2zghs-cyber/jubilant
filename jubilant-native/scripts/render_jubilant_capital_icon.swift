import AppKit
import Foundation

// Generates a 1024x1024 PNG icon with:
// - (Optional) white background
// - Gold "JC" monogram (stroke with gradient)
// - "JUBILANT CAPITAL" text
//
// Usage:
//   swift scripts/render_jubilant_capital_icon.swift /path/to/out.png
//   swift scripts/render_jubilant_capital_icon.swift --transparent /path/to/out.png
//   swift scripts/render_jubilant_capital_icon.swift --transparent --mark /path/to/out.png

let args = Array(CommandLine.arguments.dropFirst())
let transparent = args.contains("--transparent")
let markOnly = args.contains("--mark")
let outPath =
  args
    .filter { !$0.hasPrefix("--") }
    .first ?? "/tmp/jubilant_capital_icon_1024.png"
let size: CGFloat = 1024

guard
  let rep =
    NSBitmapImageRep(
      bitmapDataPlanes: nil,
      pixelsWide: Int(size),
      pixelsHigh: Int(size),
      bitsPerSample: 8,
      samplesPerPixel: 4,
      hasAlpha: true,
      isPlanar: false,
      colorSpaceName: .deviceRGB,
      bytesPerRow: 0,
      bitsPerPixel: 0
    )
else {
  fputs("Failed to create bitmap\n", stderr)
  exit(2)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
defer { NSGraphicsContext.restoreGraphicsState() }

guard let ctx = NSGraphicsContext.current?.cgContext else {
  fputs("No graphics context\n", stderr)
  exit(2)
}

ctx.setAllowsAntialiasing(true)
ctx.setShouldAntialias(true)
ctx.interpolationQuality = .high

// Clear background (transparent by default).
ctx.setFillColor(NSColor.clear.cgColor)
ctx.fill(CGRect(x: 0, y: 0, width: size, height: size))

// Background: subtle radial tint so the white icon reads on light screens.
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
if !transparent {
  let bgGradient =
    CGGradient(
      colorsSpace: cs,
      colors: [
        NSColor.white.cgColor,
        NSColor(calibratedWhite: 0.965, alpha: 1).cgColor,
      ] as CFArray,
      locations: [0.0, 1.0]
    )!
  ctx.drawRadialGradient(
    bgGradient,
    startCenter: CGPoint(x: size * 0.5, y: size * 0.55),
    startRadius: 0,
    endCenter: CGPoint(x: size * 0.5, y: size * 0.5),
    endRadius: size * 0.88,
    options: [.drawsAfterEndLocation]
  )
}

// Build the "JC" monogram path (based on the existing icon geometry).
let base = CGMutablePath()

// J top
base.move(to: CGPoint(x: 316, y: 292))
base.addLine(to: CGPoint(x: 512, y: 292))

// J stem + tail (two cubic segments)
base.move(to: CGPoint(x: 512, y: 292))
base.addLine(to: CGPoint(x: 512, y: 520))
base.addCurve(
  to: CGPoint(x: 292, y: 748),
  control1: CGPoint(x: 512, y: 660),
  control2: CGPoint(x: 424, y: 748)
)
base.addCurve(
  to: CGPoint(x: 98, y: 654),
  control1: CGPoint(x: 208, y: 748),
  control2: CGPoint(x: 140, y: 714)
)

// C (four cubic segments: two 'c', one 's' equivalent, one 'c')
base.move(to: CGPoint(x: 784, y: 366))
base.addCurve(
  to: CGPoint(x: 550, y: 244),
  control1: CGPoint(x: 730, y: 290),
  control2: CGPoint(x: 652, y: 244)
)
base.addCurve(
  to: CGPoint(x: 246, y: 550),
  control1: CGPoint(x: 380, y: 244),
  control2: CGPoint(x: 246, y: 380)
)
// Smooth cubic: control1 is reflection of previous control2 around current point.
base.addCurve(
  to: CGPoint(x: 550, y: 856),
  control1: CGPoint(x: 246, y: 720),
  control2: CGPoint(x: 380, y: 856)
)
base.addCurve(
  to: CGPoint(x: 784, y: 734),
  control1: CGPoint(x: 652, y: 856),
  control2: CGPoint(x: 730, y: 810)
)

let bbox = base.boundingBoxOfPath

// Layout: keep plenty of safe padding (Android adaptive icons crop).
// Monogram sits above the text, centered.
let monogramTarget =
  if markOnly {
    CGRect(x: 0, y: 0, width: size, height: size)
  } else {
    CGRect(x: 0, y: 320, width: size, height: 470)
  }
let scale =
  if markOnly {
    min(monogramTarget.height / bbox.height, monogramTarget.width / bbox.width) * 0.62
  } else {
    min(monogramTarget.height / bbox.height, monogramTarget.width / bbox.width) * 0.78
  }
let newW = bbox.width * scale
let newH = bbox.height * scale
let originX = (size - newW) * 0.5
let originY =
  if markOnly {
    (size - newH) * 0.5
  } else {
    monogramTarget.minY + (monogramTarget.height - newH) * 0.5
  }

var t = CGAffineTransform(a: scale, b: 0, c: 0, d: scale, tx: originX - bbox.minX * scale, ty: originY - bbox.minY * scale)
guard let monogramPath = base.copy(using: &t) else {
  fputs("Failed to transform monogram path\n", stderr)
  exit(3)
}

// Gold gradient
let goldGradient =
  CGGradient(
    colorsSpace: cs,
    colors: [
      NSColor(calibratedRed: 0.96, green: 0.91, blue: 0.69, alpha: 1).cgColor,
      NSColor(calibratedRed: 0.91, green: 0.78, blue: 0.44, alpha: 1).cgColor,
      NSColor(calibratedRed: 0.79, green: 0.64, blue: 0.29, alpha: 1).cgColor,
      NSColor(calibratedRed: 0.95, green: 0.88, blue: 0.65, alpha: 1).cgColor,
    ] as CFArray,
    locations: [0.0, 0.35, 0.7, 1.0]
  )!

// Stroke path -> clip -> paint gradient
ctx.saveGState()
ctx.addPath(monogramPath)
ctx.setLineWidth(150 * scale)
ctx.setLineCap(.round)
ctx.setLineJoin(.round)
ctx.replacePathWithStrokedPath()
ctx.clip()
ctx.drawLinearGradient(
  goldGradient,
  start: CGPoint(x: originX, y: monogramTarget.minY),
  end: CGPoint(x: originX + newW, y: monogramTarget.minY + newH),
  options: []
)
ctx.restoreGState()

// Text
let paragraph = NSMutableParagraphStyle()
paragraph.alignment = .center

let textColor = NSColor(calibratedRed: 0.78, green: 0.64, blue: 0.30, alpha: 1)
let font = NSFont.systemFont(ofSize: 44, weight: .semibold)
let attrs: [NSAttributedString.Key: Any] = [
  .font: font,
  .foregroundColor: textColor,
  .kern: 7.5,
  .paragraphStyle: paragraph,
]

if !markOnly {
  let title = NSAttributedString(string: "JUBILANT CAPITAL", attributes: attrs)
  let titleRect = CGRect(x: 0, y: 210, width: size, height: 80)
  title.draw(in: titleRect)
}

// Export PNG
guard let png = rep.representation(using: .png, properties: [:])
else {
  fputs("Failed to export PNG\n", stderr)
  exit(4)
}

do {
  try png.write(to: URL(fileURLWithPath: outPath))
  print("Wrote \(outPath)")
} catch {
  fputs("Write failed: \(error)\n", stderr)
  exit(5)
}
