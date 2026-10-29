import UIKit
import WebKit
import UserNotifications
import Darwin

/// Error surfaced to JavaScript through the Mobix bridge envelope.
struct MobixBridgeError: Error {
    let code: String
    let message: String
    init(_ code: String, _ message: String) {
        self.code = code
        self.message = message
    }
}

/// Prevents the WKUserContentController -> handler -> controller -> webView retain cycle.
private final class WeakBridgeHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

private final class MobixNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        completionHandler([.banner, .sound])
    }
}

/// WKWebView host for Mobix applications.
///
/// Assets are loaded from the application bundle with a scoped file origin. The
/// bridge only accepts messages from the main frame inside that directory.
public final class MobixWebViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private let assetBundle: Bundle
    private let assetDirectory: String
    private let store = UserDefaults.standard
    private let notificationDelegate = MobixNotificationDelegate()
    private var webView: WKWebView!
    private var trustedDirectory: URL?
    private var bridgeHandler: WeakBridgeHandler?
    private lazy var database: MobixDatabase? = MobixDatabase(path: MobixWebViewController.databaseURL)

    public init(assetBundle: Bundle = .main, assetDirectory: String = "www") {
        self.assetBundle = assetBundle
        self.assetDirectory = assetDirectory
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("MobixWebViewController must be created programmatically")
    }

    private static var databaseURL: URL {
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return directory.appendingPathComponent("mobix.sqlite")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        UNUserNotificationCenter.current().delegate = notificationDelegate

        let contentController = WKUserContentController()
        let handler = WeakBridgeHandler(self)
        bridgeHandler = handler
        contentController.add(handler, name: "mobixBridge")
        contentController.addUserScript(WKUserScript(
            source: "window.mobixBridge={postMessage:function(s){window.webkit.messageHandlers.mobixBridge.postMessage(s)}}",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = .all

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
        ])

        loadApplicationAssets()
    }

    public override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        webView.becomeFirstResponder()
    }

    /// Navigate back inside the web application. Returns false when there is no history entry.
    @discardableResult
    public func goBack() -> Bool {
        guard webView.canGoBack else { return false }
        webView.goBack()
        return true
    }

    private func loadApplicationAssets() {
        guard let index = assetBundle.url(forResource: "index", withExtension: "html", subdirectory: assetDirectory) else {
            showStartupError("Missing \(assetDirectory)/index.html in the application bundle. Run `mobix sync ios` before building.")
            return
        }
        let directory = index.deletingLastPathComponent().standardizedFileURL
        trustedDirectory = directory
        webView.loadFileURL(index, allowingReadAccessTo: directory)
    }

    private func showStartupError(_ message: String) {
        let label = UILabel()
        label.numberOfLines = 0
        label.textAlignment = .center
        label.textColor = .label
        label.font = .preferredFont(forTextStyle: .body)
        label.text = message
        label.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            label.widthAnchor.constraint(lessThanOrEqualTo: view.widthAnchor, multiplier: 0.8),
        ])
    }

    private func isTrusted(_ url: URL) -> Bool {
        guard url.isFileURL, let directory = trustedDirectory else { return false }
        let path = url.standardizedFileURL.path
        return path == directory.path || path.hasPrefix(directory.path + "/")
    }

    // MARK: - WKNavigationDelegate

    public func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if isTrusted(url) {
            decisionHandler(.allow)
            return
        }
        if let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" {
            UIApplication.shared.open(url, options: [:], completionHandler: nil)
        }
        decisionHandler(.cancel)
    }

    public func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if DEBUG
        startSmokeTestIfRequested()
        #endif
    }

    public func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        NSLog("Mobix: navigation failed: %@", error.localizedDescription)
    }

    public func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        NSLog("Mobix: provisional navigation failed: %@", error.localizedDescription)
    }

    public func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // MARK: - Bridge

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "mobixBridge", message.frameInfo.isMainFrame else { return }
        let origin = message.frameInfo.securityOrigin
        guard origin.protocol == "file",
              let frameURL = message.frameInfo.request.url ?? webView.url, isTrusted(frameURL),
              let raw = message.body as? String, raw.utf8.count <= 65_536,
              let data = raw.data(using: .utf8),
              let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let id = request["id"] as? String, (1...128).contains(id.count),
              let plugin = request["plugin"] as? String, Self.isValidName(plugin),
              let method = request["method"] as? String, Self.isValidName(method)
        else { return }

        #if DEBUG
        if plugin == "Test" && method == "report" {
            let result = (request["params"] as? [String: Any])?["result"] as? String ?? "MISSING_RESULT"
            finishSmokeTest(result)
            return
        }
        #endif

        var response: [String: Any] = ["v": 1, "id": id, "ok": true]
        if (request["v"] as? Int) != 1 {
            response["ok"] = false
            response["error"] = ["code": "VERSION_MISMATCH", "message": "Expected bridge protocol 1"]
        } else if let params = request["params"] as? [String: Any] {
            do {
                response["result"] = try dispatch(plugin: plugin, method: method, params: params)
            } catch let error as MobixBridgeError {
                response["ok"] = false
                response["error"] = ["code": error.code, "message": error.message]
            } catch {
                response["ok"] = false
                response["error"] = ["code": "NATIVE_ERROR", "message": error.localizedDescription]
            }
        } else {
            response["ok"] = false
            response["error"] = ["code": "INVALID_REQUEST", "message": "Invalid native parameters"]
        }
        send(response)
    }

    private func dispatch(plugin: String, method: String, params: [String: Any]) throws -> Any {
        switch "\(plugin).\(method)" {
        case "Bridge.negotiate":
            let versions = (params["versions"] as? [Any])?.compactMap { ($0 as? NSNumber)?.intValue } ?? []
            guard versions.contains(1) else {
                throw MobixBridgeError("VERSION_MISMATCH", "No supported protocol")
            }
            return ["protocol": 1]
        case "Device.getInfo":
            return [
                "platform": "ios",
                "osVersion": UIDevice.current.systemVersion,
                "model": UIDevice.current.model,
            ]
        case "Storage.get":
            let key = try validatedKey(params)
            if let value = store.string(forKey: "mobix." + key) {
                return ["value": value]
            }
            return ["value": NSNull()]
        case "Storage.set":
            let key = try validatedKey(params)
            guard let value = params["value"] as? String else {
                throw MobixBridgeError("INVALID_REQUEST", "Invalid storage value")
            }
            guard value.count <= 16_384 else {
                throw MobixBridgeError("INVALID_REQUEST", "Value too long")
            }
            store.set(value, forKey: "mobix." + key)
            return ["saved": true]
        case "Storage.remove":
            let key = try validatedKey(params)
            store.removeObject(forKey: "mobix." + key)
            return ["removed": true]
        case "Navigation.openExternal":
            guard let raw = params["url"] as? String, let url = URL(string: raw),
                  let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https"
            else {
                throw MobixBridgeError("INVALID_REQUEST", "Only http(s) URLs allowed")
            }
            DispatchQueue.main.async {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
            return ["opened": true]
        case "Notifications.show":
            return try showNotification(params)
        case "SQLite.execute":
            let (sql, args) = try validatedSQL(params)
            guard let database else {
                throw MobixBridgeError("NATIVE_ERROR", "SQLite unavailable")
            }
            switch database.execute(sql: sql, args: args) {
            case .success(let changes):
                return ["rowsAffected": changes]
            case .failure(let error):
                throw MobixBridgeError(error.code, error.message)
            }
        case "SQLite.query":
            let (sql, args) = try validatedSQL(params)
            guard let database else {
                throw MobixBridgeError("NATIVE_ERROR", "SQLite unavailable")
            }
            switch database.query(sql: sql, args: args) {
            case .success(let rows):
                return ["rows": rows]
            case .failure(let error):
                throw MobixBridgeError(error.code, error.message)
            }
        default:
            throw MobixBridgeError("METHOD_NOT_FOUND", "Unsupported method")
        }
    }

    private func validatedKey(_ params: [String: Any]) throws -> String {
        guard let key = params["key"] as? String,
              key.range(of: "^[A-Za-z0-9_.-]{1,128}$", options: .regularExpression) != nil
        else {
            throw MobixBridgeError("INVALID_REQUEST", "Invalid storage key")
        }
        return key
    }

    private func validatedSQL(_ params: [String: Any]) throws -> (String, [Any]) {
        guard let sql = params["sql"] as? String else {
            throw MobixBridgeError("INVALID_REQUEST", "Invalid SQL statement")
        }
        let args = params["args"] as? [Any] ?? []
        guard args.count <= 100 else {
            throw MobixBridgeError("INVALID_REQUEST", "Too many parameters")
        }
        return (sql, args)
    }

    private func showNotification(_ params: [String: Any]) throws -> [String: Any] {
        let title = String((params["title"] as? String ?? "").prefix(120))
        let body = String((params["body"] as? String ?? "").prefix(500))
        guard !title.isEmpty else {
            throw MobixBridgeError("INVALID_REQUEST", "Title required")
        }

        let center = UNUserNotificationCenter.current()
        let semaphore = DispatchSemaphore(value: 0)
        var status: UNAuthorizationStatus = .notDetermined
        center.getNotificationSettings { settings in
            status = settings.authorizationStatus
            semaphore.signal()
        }
        _ = semaphore.wait(timeout: .now() + 1)

        var permissionRequested = false
        if status == .notDetermined {
            permissionRequested = true
            center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
        }
        let authorized = status == .authorized || status == .provisional
        if authorized {
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
            center.add(request, withCompletionHandler: nil)
        }
        return ["shown": authorized, "permissionRequested": permissionRequested]
    }

    private func send(_ response: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: response),
              let json = String(data: data, encoding: .utf8),
              let quoted = try? JSONSerialization.data(withJSONObject: json, options: [.fragmentsAllowed]),
              let encoded = String(data: quoted, encoding: .utf8)
        else { return }
        DispatchQueue.main.async { [weak self] in
            self?.webView.evaluateJavaScript("window.__mobixReceive && window.__mobixReceive(\(encoded))", completionHandler: nil)
        }
    }

    private static func isValidName(_ value: String) -> Bool {
        value.range(of: "^[A-Za-z][A-Za-z0-9]{0,63}$", options: .regularExpression) != nil
    }

    // MARK: - Debug smoke test

    #if DEBUG
    private func startSmokeTestIfRequested() {
        guard ProcessInfo.processInfo.arguments.contains("--mobix-smoke-test") else { return }
        let script = """
        (async () => {
          function call(plugin, method, params) {
            return new Promise((resolve, reject) => {
              const id = 'test-' + Math.random().toString(36).slice(2);
              const old = window.__mobixReceive;
              window.__mobixReceive = function (payload) {
                const message = JSON.parse(payload);
                if (message.id === id) {
                  window.__mobixReceive = old;
                  message.ok ? resolve(message.result) : reject(new Error(message.error && message.error.message));
                } else if (old) { old(payload); }
              };
              window.webkit.messageHandlers.mobixBridge.postMessage(JSON.stringify({v:1,id,plugin,method,params}));
            });
          }
          let result = 'PASS';
          try {
            const negotiated = await call('Bridge', 'negotiate', {versions: [1]});
            if (negotiated.protocol !== 1) throw new Error('NEGOTIATION_FAILED');
            const device = await call('Device', 'getInfo', {});
            if (device.platform !== 'ios') throw new Error('DEVICE_FAILED');
            await call('Storage', 'set', {key: 'mobix_smoke', value: 'tested'});
            const stored = await call('Storage', 'get', {key: 'mobix_smoke'});
            await call('Storage', 'remove', {key: 'mobix_smoke'});
            if (stored.value !== 'tested') throw new Error('STORAGE_FAILED');
            await call('SQLite', 'execute', {sql: 'CREATE TABLE IF NOT EXISTS smoke (id INTEGER PRIMARY KEY, value TEXT)', args: []});
            await call('SQLite', 'execute', {sql: 'INSERT INTO smoke (value) VALUES (?)', args: ['ok']});
            const rows = await call('SQLite', 'query', {sql: 'SELECT value FROM smoke ORDER BY id DESC LIMIT 1', args: []});
            if (!rows.rows.length || rows.rows[0].value !== 'ok') throw new Error('SQLITE_FAILED');
          } catch (error) {
            result = 'ERROR:' + String(error);
          }
          window.webkit.messageHandlers.mobixBridge.postMessage(JSON.stringify({v:1,id:'smoke-report',plugin:'Test',method:'report',params:{result}}));
        })();
        """
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func finishSmokeTest(_ result: String) {
        let url = Self.databaseURL.deletingLastPathComponent().appendingPathComponent("mobix-smoke.txt")
        try? result.write(to: url, atomically: true, encoding: .utf8)
        print("MOBIX_SMOKE_RESULT=\(result)")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            exit(result == "PASS" ? 0 : 1)
        }
    }
    #endif

    deinit {
        webView?.configuration.userContentController.removeScriptMessageHandler(forName: "mobixBridge")
        UNUserNotificationCenter.current().delegate = nil
    }
}
