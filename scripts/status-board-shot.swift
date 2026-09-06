// Renders one page to a PNG through WebKit, for `capture-status-board.js`.
//
// The screenshot service the portfolio captures use renders a page without ever
// loading a lazily-loaded image, which is most of what the status board is: the
// client marks beside the site names never appear in one of its shots. So this
// asset is taken by a real engine instead, and WebKit is the one already on the
// machine.
//
//   swiftc -O status-board-shot.swift -o status-board-shot
//   ./status-board-shot --url https://www.taylorurl.com/console/status --out shot.png
//
// `--theme light|dark` picks the palette the page paints in. The setting is the
// reader's own, kept in localStorage and read by a script in the page head, so
// it is written there before the first navigation rather than asked for after
// one.
//
// `--scale` multiplies the rasterised density, so a 1200x750 layout asked for at
// 3 lands as 3600x2250 and survives being resized down to a committed asset.
//
// `--selector` frames the shot on one element instead of on the top of the page,
// and `--pad` is the air left above it. The element is measured after the page
// has settled, so the shot follows its subject down the page rather than holding
// an offset that was right on the day it was written.

import AppKit
import Foundation
import PDFKit
import WebKit

let args = CommandLine.arguments

func value(_ flag: String, _ fallback: String) -> String {
    guard let index = args.firstIndex(of: flag), index + 1 < args.count else { return fallback }
    return args[index + 1]
}

func fail(_ reason: String) -> Never {
    FileHandle.standardError.write("status-board-shot: \(reason)\n".data(using: .utf8)!)
    exit(1)
}

guard let url = URL(string: value("--url", "")) else { fail("--url is not a URL") }
let out = URL(fileURLWithPath: value("--out", "shot.png"))
let width = Double(value("--width", "1200"))!
let height = Double(value("--height", "750"))!
let scale = Double(value("--scale", "3"))!
let settle = Double(value("--settle", "8"))!
let selector = value("--selector", "")
let pad = Double(value("--pad", "0"))!
let theme = value("--theme", "light")
guard ["light", "dark"].contains(theme) else { fail("--theme is light or dark") }

// The selector reaches the page as a JSON string, so a quote in it cannot end
// the literal it is written into.
let selectorLiteral: String = {
    guard let data = try? JSONSerialization.data(withJSONObject: [selector]),
        let array = String(data: data, encoding: .utf8)
    else { return "\"\"" }
    return String(array.dropFirst().dropLast())
}()

// The ground the page paints on, which a printed PDF page does not carry and the
// rasteriser therefore has to lay down itself. `--plane-ground` in `index.css`.
let ground = theme == "dark"
    ? NSColor(red: 0x0b / 255.0, green: 0x0c / 255.0, blue: 0x0f / 255.0, alpha: 1)
    : NSColor.white

let app = NSApplication.shared
app.setActivationPolicy(.accessory)

let frame = NSRect(x: 0, y: 0, width: width, height: height)
let configuration = WKWebViewConfiguration()

// Written at document start, so the pre-paint script in the page head reads the
// asked-for setting on the first navigation and the page never paints light
// before turning dark.
configuration.userContentController.addUserScript(
    WKUserScript(
        source: """
        try { window.localStorage.setItem('taylorurl_theme', '\(theme)') } catch (error) {}
        document.documentElement.setAttribute('data-theme', '\(theme)')
        """,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
    )
)

let web = WKWebView(frame: frame, configuration: configuration)

// A view no window owns lays out at zero size, which prints a blank page. The
// window it is given is parked past the edge of every screen, so hosting it
// costs nothing anybody sees.
let window = NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: false)
window.contentView = web
window.setFrameOrigin(NSPoint(x: -100_000, y: -100_000))
window.orderFrontRegardless()

final class Loaded: NSObject, WKNavigationDelegate {
    var done = false
    var failure: String?

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        done = true
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        failure = error.localizedDescription
        done = true
    }

    func webView(
        _ webView: WKWebView,
        didFailProvisionalNavigation navigation: WKNavigation!,
        withError error: Error
    ) {
        failure = error.localizedDescription
        done = true
    }
}

/// Spins the run loop until `until` answers true, or the seconds run out.
func wait(seconds: Double, until: () -> Bool = { false }) {
    let deadline = Date().addingTimeInterval(seconds)
    while Date() < deadline && !until() {
        RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
    }
}

let loaded = Loaded()
web.navigationDelegate = loaded
web.load(URLRequest(url: url))
wait(seconds: 60) { loaded.done }
if let failure = loaded.failure { fail(failure) }
if !loaded.done { fail("the page did not finish loading inside 60s") }

// The board fills from a fetch, so the render waits past the load event.
wait(seconds: settle)

// Nothing offscreen crosses an IntersectionObserver, so every element waiting on
// one to fade in holds at zero opacity and the page prints blank. The entrance
// animations are stood down rather than waited on, because no wait ends them.
let standDown = """
(function () {
  const style = document.createElement('style')
  style.textContent = `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
    [class*="animate-"], [data-aos] {
      opacity: 1 !important;
      transform: none !important;
      visibility: visible !important;
    }
  `
  document.head.appendChild(style)
  return document.body.innerText.length
})()
"""

var stoodDown = false
var text = 0
web.evaluateJavaScript(standDown) { result, _ in
    text = (result as? Int) ?? 0
    stoodDown = true
}
wait(seconds: 10) { stoodDown }
if text == 0 { fail("the page rendered no text") }
wait(seconds: 1.5)

// Where on the page the shot starts. Left alone it is the top, which is what a
// page whose subject is the first thing on it wants. `--selector` is for the
// rest: the artefact is named rather than measured, so the offset is whatever
// the page currently puts it at and a shot cannot drift off its subject when
// the copy above it gains a line.
var top = 0.0
if !selector.isEmpty {
    let find = """
    (function () {
      const el = document.querySelector(\(selectorLiteral))
      if (!el) return -1
      return Math.round(el.getBoundingClientRect().top + window.scrollY)
    })()
    """
    var found = false
    var offset = -1.0
    web.evaluateJavaScript(find) { result, _ in
        offset = (result as? Double) ?? Double((result as? Int) ?? -1)
        found = true
    }
    wait(seconds: 10) { found }
    if offset < 0 { fail("--selector \(selector) matched nothing on the page") }
    top = max(0, offset - pad)
}

// takeSnapshot draws nothing for a view no screen ever showed, so the page is
// printed to PDF and rasterised from that.
let pdfConfig = WKPDFConfiguration()
pdfConfig.rect = CGRect(x: 0, y: top, width: width, height: height)

var written = false
web.createPDF(configuration: pdfConfig) { result in
    defer { written = true }
    guard case .success(let data) = result else {
        fail("the page would not print")
    }
    guard let page = PDFDocument(data: data)?.page(at: 0) else {
        fail("the printed page was unreadable")
    }
    let box = page.bounds(for: .mediaBox)
    let pixels = NSSize(width: box.width * scale, height: box.height * scale)
    guard
        let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: Int(pixels.width),
            pixelsHigh: Int(pixels.height),
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        )
    else { fail("no bitmap to draw into") }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let context = NSGraphicsContext.current!.cgContext
    // A PDF page carries no ground of its own, so the palette's is laid down.
    context.setFillColor(ground.cgColor)
    context.fill(CGRect(origin: .zero, size: pixels))
    context.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: context)
    NSGraphicsContext.restoreGraphicsState()

    guard let png = rep.representation(using: .png, properties: [:]) else {
        fail("the bitmap would not encode")
    }
    do {
        try png.write(to: out)
    } catch {
        fail("could not write \(out.path): \(error.localizedDescription)")
    }
    print("\(rep.pixelsWide)x\(rep.pixelsHigh)")
}
wait(seconds: 60) { written }
if !written { fail("the render did not finish") }
