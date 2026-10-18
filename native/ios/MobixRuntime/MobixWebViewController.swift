import UIKit
import WebKit

public final class MobixWebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    private var webView: WKWebView!
    private let trustedOrigin = "appassets.mobix.local"
    private let store = UserDefaults.standard
    public override func viewDidLoad() {
        super.viewDidLoad()
        let content = WKUserContentController()
        content.add(self, name: "mobixBridge")
        let config = WKWebViewConfiguration()
        config.userContentController = content
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.navigationDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(webView)
        // Production integration: register a WKURLSchemeHandler or loadFileURL with a scoped read-access URL.
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "www") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }
    public func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if navigationAction.targetFrame?.isMainFrame == true,
           let scheme = navigationAction.request.url?.scheme,
           scheme != "file" { decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "mobixBridge", message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "file",
              let raw = message.body as? String, raw.utf8.count <= 65536,
              let data = raw.data(using: .utf8),
              let request = try? JSONSerialization.jsonObject(with: data) as? [String:Any],
              let id = request["id"] as? String, id.count <= 128,
              request["v"] as? Int == 1,
              let plugin = request["plugin"] as? String,
              let method = request["method"] as? String else { return }
        var response: [String:Any] = ["v":1,"id":id,"ok":true]
        switch "\(plugin).\(method)" {
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
        guard let result=try? JSONSerialization.data(withJSONObject:response),let json=String(data:result,encoding:.utf8),
              let quoted=try? JSONSerialization.data(withJSONObject:[json],options:[.fragmentsAllowed]),
              let encoded=String(data:quoted,encoding:.utf8) else { return }
        let escaped=String(encoded.dropFirst().dropLast())
        webView.evaluateJavaScript("window.__mobixReceive(\(escaped))",completionHandler:nil)
    }
    deinit { webView?.configuration.userContentController.removeScriptMessageHandler(forName:"mobixBridge") }
}
