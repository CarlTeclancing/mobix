// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MobixApp",
    platforms: [.iOS(.v17)],
    products: [
        .library(name: "MobixRuntime", targets: ["MobixRuntime"]),
        .executable(name: "MobixApp", targets: ["MobixApp"]),
    ],
    targets: [
        .target(
            name: "MobixRuntime",
            path: "MobixRuntime",
            linkerSettings: [.linkedLibrary("sqlite3")]
        ),
        .executableTarget(
            name: "MobixApp",
            dependencies: ["MobixRuntime"],
            path: "Sources/MobixApp",
            resources: [.copy("www")]
        ),
    ]
)
