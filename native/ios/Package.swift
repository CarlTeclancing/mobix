// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "MobixApp",
    platforms: [.iOS(.v17)],
    products: [.executable(name: "MobixApp", targets: ["MobixApp"])],
    targets: [
        .executableTarget(
            name: "MobixApp",
            path: "Sources/MobixApp",
            resources: [.copy("www")]
        )
    ]
)
