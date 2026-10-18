import SwiftUI

@main
struct MobixApp: App {
    var body: some Scene {
        WindowGroup {
            MobixView().ignoresSafeArea()
        }
    }
}

struct MobixView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> MobixWebViewController { MobixWebViewController() }
    func updateUIViewController(_ controller: MobixWebViewController, context: Context) {}
}
