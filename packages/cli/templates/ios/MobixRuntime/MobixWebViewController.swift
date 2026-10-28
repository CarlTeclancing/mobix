import UIKit
import WebKit

private final class WeakBridgeHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}

public final class MobixWebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    private var webView: WKWebView!
    private var trustedDirectory: URL?
        private let store = UserDefaults.standard
    public override func viewDidLoad() {
        super.viewDidLoad()
        let content = WKUserContentController()
        content.add(WeakBridgeHandler(self), name: "mobixBridge")
        content.addUserScript(WKUserScript(source: "window.mobixBridge={postMessage:function(s){window.webkit.messageHandlers.mobixBridge.postMessage(s)}}", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let config = WKWebViewConfiguration()
        config.userContentController = content
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.navigationDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(webView)
        // Production integration: register a WKURLSchemeHandler or loadFileURL with a scoped read-access URL.
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            trustedDirectory = url.deletingLastPathComponent().standardizedFileURL
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }
    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, isTrusted(url) else {
            decisionHandler(.cancel); return
        }
        decisionHandler(.allow)
    }
    private func isTrusted(_ url: URL) -> Bool {
        guard url.isFileURL, let directory = trustedDirectory else { return false }
        return url.standardizedFileURL.path.hasPrefix(directory.path + "/")
    }
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "mobixBridge", message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "file",
              let frameURL = message.frameInfo.request.url, isTrusted(frameURL),
              let raw = message.body as? String, raw.utf8.count <= 65536,
              let data = raw.data(using: .utf8),
              let request = try? JSONSerialization.jsonObject(with: data) as? [String:Any],
              let id = request["id"] as? String, !id.isEmpty, id.count <= 128,
              let plugin = request["plugin"] as? String,
              let method = request["method"] as? String else { return }
        var response: [String:Any] = ["v":1,"id":id,"ok":true]
        let params = request["params"] as? [String:Any]
        let validName = { (name: String) in name.range(of: "^[A-Za-z][A-Za-z0-9]{0,63}$", options: .regularExpression) != nil }
        let key = params?["key"] as? String
        let validKey = key?.range(of: "^[A-Za-z0-9_.-]{1,128}$", options: .regularExpression) != nil
        if request["v"] as? Int != 1 {
            response["ok"] = false; response["error"] = ["code":"VERSION_MISMATCH","message":"Expected protocol 1"]
        } else if !validName(plugin) || !validName(method) || params == nil ||
                    (plugin == "Storage" && !validKey) ||
                    (plugin == "Storage" && method == "set" && ((params?["value"] as? String)?.count ?? 16385) > 16384) {
            response["ok"] = false; response["error"] = ["code":"INVALID_REQUEST","message":"Invalid native parameters"]
        } else {
        switch "\(plugin).\(method)" {
        case "Bridge.negotiate":
            if let versions = params?["versions"] as? [Int], versions.contains(1) {
                response["result"] = ["protocol":1]
            } else {
                response["ok"] = false; response["error"] = ["code":"VERSION_MISMATCH","message":"No supported protocol"]
            }
        case "Device.getInfo": response["result"] = ["platform":"ios","osVersion":UIDevice.current.systemVersion,"model":UIDevice.current.model]
        case "Storage.get":
            guard let key = (request["params"] as? [String:Any])?["key"] as? String else { return }
            response["result"] = ["value":store.string(forKey:"mobix."+key) as Any? ?? NSNull()]
        case "Storage.set":
            guard let params = request["params"] as? [String:Any],let key=params["key"] as? String,let value=params["value"] as? String else { return }
            store.set(value,forKey:"mobix."+key); response["result"]=["saved":true]
        case "Storage.remove":
            guard let key = (request["params"] as? [String:Any])?["key"] as? String else { return }
            store.removeObject(forKey:"mobix."+key);response["result"]=["removed":true]
        default: response["ok"]=false;response["error"]=["code":"METHOD_NOT_FOUND","message":"Unsupported method"]
        }
        }
        guard let result=try? JSONSerialization.data(withJSONObject:response),let json=String(data:result,encoding:.utf8),
              let quoted=try? JSONSerialization.data(withJSONObject:json,options:[.fragmentsAllowed]),
              let encoded=String(data:quoted,encoding:.utf8) else { return }
        webView.evaluateJavaScript("window.__mobixReceive(\(encoded))",completionHandler:nil)
    }
    deinit { webView?.configuration.userContentController.removeScriptMessageHandler(forName:"mobixBridge") }
}
