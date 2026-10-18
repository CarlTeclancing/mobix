# Mobix architecture contract

Protocol `v:1`: JSON requests `{v,id,plugin,method,params}` and responses `{v,id,ok,result}` or `{v,id,ok:false,error:{code,message}}`. IDs must be unique per outstanding call. Native bridge must reject untrusted origins, subframes, oversized payloads and unknown methods. Web assets should be bundled by default. Plugin versions follow semantic versioning; protocol major compatibility is explicit.

## Security gates before production
- Require trusted asset origin and main-frame isolation on both platforms.
- Restrict navigation and external intents to validated schemes.
- Use system permission prompts; never silently grant sensitive capabilities.
- Audit file URI access, content providers, camera output and credential storage.
- Store secrets in Keystore/Keychain, not general key-value storage.
- Test Android lifecycle and iOS WKWebView message delivery on real devices.
- Sign release artifacts using CI secrets; never commit signing keys.
