import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var privacyCover: UIVisualEffectView?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
        stashSharedPdfs(connectionOptions.urlContexts)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        stashSharedPdfs(URLContexts)
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    /// Copies PDFs sent from another app's share sheet into Caches/shared-pdf.
    /// The web side reads that folder at launch and on the "world:shared-pdf"
    /// event, so a page that is not loaded yet misses nothing. The folder name
    /// must match frontend/src/shared-pdf.ts.
    private func stashSharedPdfs(_ contexts: Set<UIOpenURLContext>) {
        let fileManager = FileManager.default
        guard let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else { return }
        let inbox = caches.appendingPathComponent("shared-pdf", isDirectory: true)
        var copied = false
        for context in contexts {
            let url = context.url
            guard url.isFileURL, url.pathExtension.lowercased() == "pdf" else { continue }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            do {
                try fileManager.createDirectory(at: inbox, withIntermediateDirectories: true)
                let target = inbox.appendingPathComponent(url.lastPathComponent)
                // Copied under a name the web side ignores, then renamed, so it
                // never reads a half-written file.
                let partial = inbox.appendingPathComponent(url.lastPathComponent + ".part")
                if fileManager.fileExists(atPath: partial.path) { try fileManager.removeItem(at: partial) }
                try fileManager.copyItem(at: url, to: partial)
                if fileManager.fileExists(atPath: target.path) { try fileManager.removeItem(at: target) }
                try fileManager.moveItem(at: partial, to: target)
                copied = true
            } catch {
                NSLog("World: could not copy shared PDF %@: %@", url.lastPathComponent, error.localizedDescription)
            }
        }
        if copied { notifyWeb() }
    }

    /// Wakes the page when the app was already running. Before the page has
    /// loaded this does nothing, and the launch check finds the file instead.
    private func notifyWeb() {
        guard let bridge = (window?.rootViewController as? CAPBridgeViewController)?.bridge else { return }
        DispatchQueue.main.async {
            bridge.webView?.evaluateJavaScript("window.dispatchEvent(new Event('world:shared-pdf'))")
        }
    }

    // iOS takes the app-switcher snapshot as the app leaves the foreground,
    // before the web layer can draw its own lock screen. A native blur added
    // here is in the snapshot whether or not the Face ID lock is on.
    func sceneWillResignActive(_ scene: UIScene) {
        guard let window = window, privacyCover == nil else { return }
        let cover = UIVisualEffectView(effect: UIBlurEffect(style: .systemThickMaterial))
        cover.frame = window.bounds
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        window.addSubview(cover)
        privacyCover = cover
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        privacyCover?.removeFromSuperview()
        privacyCover = nil
    }
}
