import SwiftUI

#if SWIFT_PACKAGE
import MobixRuntime
#endif

#if SWIFT_PACKAGE
private let mobixAssetBundle = Bundle.module
#else
// Xcode / XcodeGen builds copy the www folder into the app bundle.
private let mobixAssetBundle = Bundle.main
#endif

@main
struct MobixApp: App {
    var body: some Scene {
        WindowGroup {
            MobixView()
        }
    }
}

struct MobixView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> MobixWebViewController {
        MobixWebViewController(assetBundle: mobixAssetBundle)
    }

    func updateUIViewController(_ controller: MobixWebViewController, context: Context) {}
}
