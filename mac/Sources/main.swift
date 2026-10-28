// CTRL ROOM for Mac
// A native window around the CTRL ROOM web app, plus Mac-only extras:
// drop mixes on the Dock icon, "Open With › CTRL ROOM" in Finder, ⌘U to pick files,
// and music keeps playing when the window is closed.

import Cocoa
import WebKit
import UniformTypeIdentifiers

let HOME = URL(string: Bundle.main.object(forInfoDictionaryKey: "CTRLHomeURL") as? String ?? "https://ctrl-room-eight.vercel.app")!
let AUDIO_EXT: Set<String> = ["wav", "wave", "aif", "aiff", "aifc", "flac", "mp3", "m4a", "aac", "ogg", "opus"]
let BG = NSColor(red: 0x0b / 255.0, green: 0x0b / 255.0, blue: 0x0c / 255.0, alpha: 1)
let CHUNK = 3 * 1024 * 1024

// Serves files the user handed to the app (and only those) to the page at ctrlroom-file://f/<id>
final class FileServer: NSObject, WKURLSchemeHandler {
    var files: [String: URL] = [:]
    private var stopped = Set<ObjectIdentifier>()

    func add(_ url: URL) -> String {
        let id = UUID().uuidString.lowercased()
        files[id] = url
        return id
    }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        let id = task.request.url?.lastPathComponent ?? ""
        guard let file = files[id], let data = try? Data(contentsOf: file, options: .mappedIfSafe) else {
            task.didFailWithError(NSError(domain: "CTRLROOM", code: 404))
            return
        }
        let headers = [
            "Content-Type": mimeType(file),
            "Content-Length": String(data.count),
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
        ]
        let res = HTTPURLResponse(url: task.request.url!, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!
        task.didReceive(res)
        var offset = 0
        while offset < data.count {
            if stopped.contains(ObjectIdentifier(task)) { return }
            let end = min(offset + CHUNK, data.count)
            task.didReceive(data.subdata(in: offset..<end))
            offset = end
        }
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        stopped.insert(ObjectIdentifier(task))
    }
}

func mimeType(_ url: URL) -> String {
    switch url.pathExtension.lowercased() {
    case "wav", "wave": return "audio/wav"
    case "aif", "aiff", "aifc": return "audio/aiff"
    case "flac": return "audio/flac"
    case "mp3": return "audio/mpeg"
    case "m4a", "aac": return "audio/mp4"
    case "ogg", "opus": return "audio/ogg"
    default: return UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    }
}

/// Folders become the audio files inside them (one level of sub-folders deep is plenty for bounces).
func expandAudio(_ urls: [URL]) -> [URL] {
    var out: [URL] = []
    let fm = FileManager.default
    for u in urls {
        var isDir: ObjCBool = false
        guard fm.fileExists(atPath: u.path, isDirectory: &isDir) else { continue }
        if isDir.boolValue {
            if let e = fm.enumerator(at: u, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles]) {
                for case let f as URL in e where AUDIO_EXT.contains(f.pathExtension.lowercased()) { out.append(f) }
            }
        } else if AUDIO_EXT.contains(u.pathExtension.lowercased()) {
            out.append(u)
        }
    }
    return out.sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, NSWindowDelegate {
    var window: NSWindow!
    var web: WKWebView!
    let server = FileServer()
    var pending: [URL] = []
    var pageReady = false

    // MARK: launch

    func applicationDidFinishLaunching(_ note: Notification) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // stay signed in between launches
        config.mediaTypesRequiringUserActionForPlayback = []
        config.applicationNameForUserAgent = "Version/17.0 Safari/605.1.15 CTRLROOM-Mac/" + (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1")
        config.setURLSchemeHandler(server, forURLScheme: "ctrlroom-file")
        config.userContentController.add(self, name: "ctrlroom")
        config.userContentController.addUserScript(WKUserScript(source: "window.ctrlRoomNative = { app: 'mac', version: 1 };", injectionTime: .atDocumentStart, forMainFrameOnly: true))

        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true
        web.allowsMagnification = true
        web.setValue(false, forKey: "drawsBackground")
        if #available(macOS 12.0, *) { web.underPageBackgroundColor = BG }

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1320, height: 860),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "CTRL ROOM"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.backgroundColor = BG
        window.appearance = NSAppearance(named: .darkAqua)
        window.minSize = NSSize(width: 880, height: 600)
        window.contentView = web
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.tabbingMode = .disallowed
        window.center()
        window.setFrameAutosaveName("CTRLROOMMain")
        window.makeKeyAndOrderFront(nil)

        buildMenu()
        web.load(URLRequest(url: HOME))
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        window.makeKeyAndOrderFront(nil)
        return true
    }

    // Closing the window keeps the app (and the music) going, like Music or Spotify.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        window.orderOut(nil)
        return false
    }

    // MARK: files from Finder / Dock / ⌘U

    func application(_ application: NSApplication, open urls: [URL]) {
        receive(urls)
    }

    func receive(_ urls: [URL]) {
        let audio = expandAudio(urls)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        guard !audio.isEmpty else {
            let a = NSAlert()
            a.messageText = "No audio files"
            a.informativeText = "CTRL ROOM takes WAV, AIFF, FLAC, MP3 and M4A files."
            a.runModal()
            return
        }
        pending.append(contentsOf: audio)
        deliverPending(attempt: 0)
    }

    func deliverPending(attempt: Int) {
        guard !pending.isEmpty else { return }
        guard pageReady else {
            if attempt < 60 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.deliverPending(attempt: attempt + 1) } }
            return
        }
        web.evaluateJavaScript("typeof window.ctrlRoomReceiveFiles === 'function'") { ready, _ in
            guard (ready as? Bool) == true else {
                if attempt < 60 { DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.deliverPending(attempt: attempt + 1) } }
                return
            }
            let list: [[String: Any]] = self.pending.map { u in
                let id = self.server.add(u)
                let size = (try? u.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
                return ["id": id, "name": u.lastPathComponent, "type": mimeType(u), "size": size, "url": "ctrlroom-file://f/\(id)"]
            }
            self.pending.removeAll()
            guard let json = try? JSONSerialization.data(withJSONObject: list), let s = String(data: json, encoding: .utf8) else { return }
            self.web.evaluateJavaScript("window.ctrlRoomReceiveFiles(\(s)); void 0", completionHandler: nil)
        }
    }

    @objc func uploadMixes(_ sender: Any?) {
        let p = NSOpenPanel()
        p.title = "Upload mixes"
        p.prompt = "Upload"
        p.allowsMultipleSelection = true
        p.canChooseDirectories = true
        p.canChooseFiles = true
        p.allowedContentTypes = [.audio, .folder]
        p.beginSheetModal(for: window) { r in
            if r == .OK { self.receive(p.urls) }
        }
    }

    // The page asks for a file in pieces when it can't read ctrlroom-file:// directly.
    func userContentController(_ uc: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        if type == "send", let id = body["id"] as? String, let url = server.files[id] {
            guard let data = try? Data(contentsOf: url, options: .mappedIfSafe) else {
                web.evaluateJavaScript("window.__ctrlChunkFail && window.__ctrlChunkFail('\(id)')", completionHandler: nil)
                return
            }
            let total = max(1, Int((Double(data.count) / Double(CHUNK)).rounded(.up)))
            sendChunk(id: id, data: data, index: 0, total: total)
        } else if type == "pick" {
            uploadMixes(nil)
        }
    }

    func sendChunk(id: String, data: Data, index: Int, total: Int) {
        let start = index * CHUNK, end = min(start + CHUNK, data.count)
        let b64 = data.subdata(in: start..<end).base64EncodedString()
        web.evaluateJavaScript("window.__ctrlChunk('\(id)', \(index), \(total), '\(b64)'); void 0") { _, _ in
            if index + 1 < total { self.sendChunk(id: id, data: data, index: index + 1, total: total) }
        }
    }

    // MARK: navigation

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.allow) }
        let scheme = url.scheme ?? ""
        if scheme == "mailto" || scheme == "tel" || scheme == "sms" || scheme == "spotify" {
            NSWorkspace.shared.open(url); return decisionHandler(.cancel)
        }
        let external = (scheme == "http" || scheme == "https") && url.host != HOME.host && action.targetFrame?.isMainFrame != false
        // sign-ins for other services (Dropbox) happen in the regular browser, where you're already signed in
        if external && (url.host ?? "").hasSuffix("dropbox.com") {
            NSWorkspace.shared.open(url); return decisionHandler(.cancel)
        }
        if external && action.navigationType == .linkActivated {
            NSWorkspace.shared.open(url); return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    // target=_blank / window.open: same site opens here, everything else in the browser
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url {
            if url.host == HOME.host { webView.load(URLRequest(url: url)) } else { NSWorkspace.shared.open(url) }
        }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        pageReady = true
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let e = error as NSError
        if e.code == NSURLErrorCancelled { return }
        showOffline()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let e = error as NSError
        if e.code == NSURLErrorCancelled || e.code == 102 { return }
        showOffline()
    }

    func showOffline() {
        pageReady = false
        let html = """
        <html><body style="margin:0;height:100vh;display:grid;place-items:center;background:#0b0b0c;color:#ececef;font:15px -apple-system,system-ui;text-align:center">
        <div><div style="font-weight:800;letter-spacing:.04em;font-size:22px;margin-bottom:8px">CTRL ROOM</div>
        <div style="opacity:.7;margin-bottom:18px">Can’t connect right now. Check your internet.</div>
        <a href="\(HOME.absoluteString)" style="color:#111;background:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:700">Try again</a></div></body></html>
        """
        web.loadHTMLString(html, baseURL: nil)
    }

    // MARK: file inputs and dialogs inside the page

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let p = NSOpenPanel()
        p.allowsMultipleSelection = parameters.allowsMultipleSelection
        p.canChooseDirectories = parameters.allowsDirectories
        p.canChooseFiles = true
        p.beginSheetModal(for: window) { r in completionHandler(r == .OK ? p.urls : nil) }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = message; a.addButton(withTitle: "OK")
        a.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = message; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = NSAlert(); a.messageText = prompt; a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 280, height: 24)); field.stringValue = defaultText ?? ""
        a.accessoryView = field
        a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn ? field.stringValue : nil) }
    }

    // MARK: menu

    @objc func goHome(_ s: Any?) { go("/") }
    @objc func goArtists(_ s: Any?) { go("/artists") }
    @objc func goPortal(_ s: Any?) { go("/portal/inbox") }
    @objc func goNews(_ s: Any?) { go("/whats-new") }
    func go(_ path: String) {
        window.makeKeyAndOrderFront(nil)
        web.load(URLRequest(url: URL(string: path, relativeTo: HOME)!))
    }
    @objc func reload(_ s: Any?) { if pageReady { web.reload() } else { web.load(URLRequest(url: HOME)) } }
    @objc func back(_ s: Any?) { web.goBack() }
    @objc func forward(_ s: Any?) { web.goForward() }
    @objc func zoomIn(_ s: Any?) { web.pageZoom = min(2, web.pageZoom + 0.1) }
    @objc func zoomOut(_ s: Any?) { web.pageZoom = max(0.5, web.pageZoom - 0.1) }
    @objc func zoomReset(_ s: Any?) { web.pageZoom = 1 }
    @objc func playPause(_ s: Any?) {
        web.evaluateJavaScript("document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true })); void 0", completionHandler: nil)
    }
    @objc func showMain(_ s: Any?) { window.makeKeyAndOrderFront(nil) }
    @objc func openInBrowser(_ s: Any?) { NSWorkspace.shared.open(web.url ?? HOME) }
    @objc func copyLink(_ s: Any?) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString((web.url ?? HOME).absoluteString, forType: .string)
    }

    func buildMenu() {
        let main = NSMenu()
        func item(_ title: String, _ action: Selector?, _ key: String = "", _ mods: NSEvent.ModifierFlags = [.command], target: AnyObject? = nil) -> NSMenuItem {
            let i = NSMenuItem(title: title, action: action, keyEquivalent: key)
            i.keyEquivalentModifierMask = mods
            i.target = target
            return i
        }
        func menu(_ title: String, _ items: [NSMenuItem]) {
            let m = NSMenu(title: title)
            items.forEach { m.addItem($0) }
            let top = NSMenuItem(); top.submenu = m
            main.addItem(top)
        }
        let appName = "CTRL ROOM"
        menu(appName, [
            item("About \(appName)", #selector(NSApplication.orderFrontStandardAboutPanel(_:)), "", target: NSApp),
            .separator(),
            item("Hide \(appName)", #selector(NSApplication.hide(_:)), "h", target: NSApp),
            item("Hide Others", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option], target: NSApp),
            item("Show All", #selector(NSApplication.unhideAllApplications(_:)), "", target: NSApp),
            .separator(),
            item("Quit \(appName)", #selector(NSApplication.terminate(_:)), "q", target: NSApp),
        ])
        menu("File", [
            item("Upload Mixes…", #selector(uploadMixes(_:)), "u", target: self),
            .separator(),
            item("Copy Page Link", #selector(copyLink(_:)), "l", [.command, .shift], target: self),
            item("Open in Browser", #selector(openInBrowser(_:)), "", target: self),
            .separator(),
            item("Close Window", #selector(NSWindow.performClose(_:)), "w"),
        ])
        menu("Edit", [
            item("Undo", Selector(("undo:")), "z"),
            item("Redo", Selector(("redo:")), "z", [.command, .shift]),
            .separator(),
            item("Cut", #selector(NSText.cut(_:)), "x"),
            item("Copy", #selector(NSText.copy(_:)), "c"),
            item("Paste", #selector(NSText.paste(_:)), "v"),
            item("Select All", #selector(NSText.selectAll(_:)), "a"),
        ])
        menu("View", [
            item("Reload", #selector(reload(_:)), "r", target: self),
            .separator(),
            item("Actual Size", #selector(zoomReset(_:)), "0", target: self),
            item("Zoom In", #selector(zoomIn(_:)), "+", target: self),
            item("Zoom Out", #selector(zoomOut(_:)), "-", target: self),
            .separator(),
            item("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]),
        ])
        menu("Go", [
            item("Home", #selector(goHome(_:)), "1", target: self),
            item("Artists", #selector(goArtists(_:)), "2", target: self),
            item("Portal", #selector(goPortal(_:)), "3", target: self),
            item("What’s New", #selector(goNews(_:)), "", target: self),
            .separator(),
            item("Back", #selector(back(_:)), "[", target: self),
            item("Forward", #selector(forward(_:)), "]", target: self),
        ])
        menu("Controls", [
            item("Play / Pause", #selector(playPause(_:)), "p", [.command, .option], target: self),
        ])
        let win = NSMenu(title: "Window")
        win.addItem(item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"))
        win.addItem(item("Zoom", #selector(NSWindow.performZoom(_:)), ""))
        win.addItem(.separator())
        win.addItem(item("CTRL ROOM", #selector(showMain(_:)), "0", [.command, .option], target: self))
        let winTop = NSMenuItem(); winTop.submenu = win
        main.addItem(winTop)
        NSApp.windowsMenu = win
        NSApp.mainMenu = main
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
