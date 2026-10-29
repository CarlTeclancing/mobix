package dev.mobix.prototype

import android.Manifest
import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var web: WebView
    private val worker = Executors.newSingleThreadExecutor()
    private val database by lazy { openOrCreateDatabase("mobix.sqlite", MODE_PRIVATE, null) }
    private val activeIds = ConcurrentHashMap.newKeySet<String>()
    @Volatile private var smokeCallback: ((String) -> Unit)? = null
    private val trustedOrigin = "https://appassets.androidplatform.net"
    private val backCallback = OnBackInvokedCallback { handleBack() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        configureWebView()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                backCallback,
            )
        }
        if (savedInstanceState != null && web.restoreState(savedInstanceState) != null) {
            Log.i(TAG, "Restored WebView state")
        } else {
            web.loadUrl("$trustedOrigin/assets/www/index.html")
        }
    }

    private fun configureWebView() {
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = false
        web.settings.allowContentAccess = false
        web.settings.javaScriptCanOpenWindowsAutomatically = false
        web.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.webChromeClient = WebChromeClient()

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                loader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return uri.scheme != "https" || uri.host != "appassets.androidplatform.net" || uri.port != -1
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
                if (request.isForMainFrame) Log.e(TAG, "Main frame failed to load: ${error.description}", null)
            }
        }

        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            throw IllegalStateException("WebView is missing required secure message listener support")
        }
        WebViewCompat.addWebMessageListener(web, "mobixBridge", setOf(trustedOrigin), object : WebViewCompat.WebMessageListener {
            override fun onPostMessage(
                view: WebView,
                message: WebMessageCompat,
                sourceOrigin: Uri,
                isMainFrame: Boolean,
                replyProxy: JavaScriptReplyProxy,
            ) {
                if (!isMainFrame || sourceOrigin.scheme != "https" ||
                    sourceOrigin.host != "appassets.androidplatform.net" || sourceOrigin.port != -1
                ) return
                val raw = message.data ?: return
                if (raw.toByteArray(Charsets.UTF_8).size > 65536) return
                if (BuildConfig.DEBUG) {
                    val testMessage = runCatching { JSONObject(raw) }.getOrNull()
                    if (testMessage?.optString("plugin") == "Test" && testMessage.optString("method") == "report") {
                        val callback = smokeCallback
                        smokeCallback = null
                        callback?.invoke(testMessage.optJSONObject("params")?.optString("result") ?: "MISSING_RESULT")
                        return
                    }
                }
                val id = runCatching { JSONObject(raw).getString("id") }.getOrNull() ?: return
                if (id.length !in 1..128 || !activeIds.add(id)) return
                worker.execute {
                    try {
                        dispatch(raw)
                    } finally {
                        activeIds.remove(id)
                    }
                }
            }
        })
    }

    private fun dispatch(raw: String) {
        val response = JSONObject()
        try {
            val req = JSONObject(raw)
            val id = req.getString("id")
            require(id.length in 1..128) { "Invalid request ID" }
            response.put("v", 1).put("id", id)
            require(req.getInt("v") == 1) { "Unsupported protocol version" }
            val plugin = req.getString("plugin")
            val method = req.getString("method")
            require(
                plugin.matches(Regex("[A-Za-z][A-Za-z0-9]{0,63}")) &&
                    method.matches(Regex("[A-Za-z][A-Za-z0-9]{0,63}"))
            ) { "Invalid method identifier" }
            val params = req.getJSONObject("params")
            val result = when ("$plugin.$method") {
                "Bridge.negotiate" -> {
                    val versions = params.getJSONArray("versions")
                    require((0 until versions.length()).any { versions.optInt(it) == 1 }) { "Unsupported protocol version" }
                    JSONObject().put("protocol", 1)
                }
                "Device.getInfo" -> JSONObject()
                    .put("platform", "android")
                    .put("osVersion", Build.VERSION.RELEASE)
                    .put("model", Build.MODEL)
                "Storage.get" -> {
                    val key = validatedKey(params)
                    JSONObject().put("value", getPreferences(0).getString(key, null) ?: JSONObject.NULL)
                }
                "Storage.set" -> {
                    val key = validatedKey(params)
                    val value = params.getString("value")
                    require(value.length <= 16384) { "Value too long" }
                    getPreferences(0).edit().putString(key, value).apply()
                    JSONObject().put("saved", true)
                }
                "Storage.remove" -> {
                    val key = validatedKey(params)
                    getPreferences(0).edit().remove(key).apply()
                    JSONObject().put("removed", true)
                }
                "Navigation.openExternal" -> {
                    val uri = Uri.parse(params.getString("url"))
                    require(uri.scheme == "https" || uri.scheme == "http") { "Only http(s) URLs allowed" }
                    runOnUiThread {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, uri))
                        } catch (e: ActivityNotFoundException) {
                            Log.w(TAG, "No browser for URL", e)
                        }
                    }
                    JSONObject().put("opened", true)
                }
                "Notifications.show" -> showNotification(params)
                "SQLite.execute" -> sqliteExecute(params)
                "SQLite.query" -> sqliteQuery(params)
                else -> throw NoSuchMethodException("Unknown native method")
            }
            response.put("ok", true).put("result", result)
        } catch (e: Exception) {
            val id = runCatching { JSONObject(raw).optString("id", "") }.getOrDefault("")
            response.put("v", 1).put("id", id).put("ok", false)
            response.put(
                "error",
                JSONObject()
                    .put(
                        "code",
                        if (e is NoSuchMethodException) "METHOD_NOT_FOUND"
                        else if (e.message == "Unsupported protocol version") "VERSION_MISMATCH"
                        else "INVALID_REQUEST",
                    )
                    .put("message", e.message ?: "Native call failed"),
            )
        }
        val js = "window.__mobixReceive && window.__mobixReceive(" + JSONObject.quote(response.toString()) + ")"
        runOnUiThread {
            if (!isFinishing && !isDestroyed && ::web.isInitialized && web.url?.startsWith("$trustedOrigin/") == true) {
                web.evaluateJavascript(js, null)
            }
        }
    }

    private fun showNotification(params: JSONObject): JSONObject {
        val title = params.getString("title").take(120)
        val body = params.getString("body").take(500)
        require(title.isNotBlank()) { "Title required" }
        val canNotify = Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if (!canNotify && Build.VERSION.SDK_INT >= 33) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_POST_NOTIFICATIONS)
        }
        runOnUiThread {
            if (!canNotify) return@runOnUiThread
            val manager = getSystemService(NotificationManager::class.java)
            val channel = NOTIFICATION_CHANNEL
            if (Build.VERSION.SDK_INT >= 26) {
                manager.createNotificationChannel(NotificationChannel(channel, "Mobix", NotificationManager.IMPORTANCE_DEFAULT))
            }
            val notification = Notification.Builder(this, channel)
                .setContentTitle(title)
                .setContentText(body)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setAutoCancel(true)
                .build()
            manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
        }
        return JSONObject().put("shown", canNotify).put("permissionRequested", !canNotify)
    }

    private fun sqlArgs(params: JSONObject): Array<String> {
        val input = params.optJSONArray("args") ?: return emptyArray()
        require(input.length() <= 100) { "Too many parameters" }
        return Array(input.length()) { i -> if (input.isNull(i)) "" else input.get(i).toString() }
    }

    private fun checkedSql(params: JSONObject, readOnly: Boolean): String {
        val sql = params.getString("sql").trim()
        require(sql.length in 1..10000) { "Invalid SQL size" }
        require(!sql.contains(';')) { "Only one SQL statement allowed" }
        val allowed = if (readOnly) Regex("(?is)^SELECT\\s+.*")
        else Regex("(?is)^(INSERT|UPDATE|DELETE|CREATE TABLE|CREATE INDEX|DROP TABLE)\\s+.*")
        require(allowed.matches(sql)) { "SQL statement not permitted" }
        return sql
    }

    private fun sqliteExecute(params: JSONObject): JSONObject {
        val sql = checkedSql(params, false)
        val args = sqlArgs(params)
        database.execSQL(sql, args)
        return JSONObject().put(
            "rowsAffected",
            android.database.DatabaseUtils.longForQuery(database, "SELECT changes()", null),
        )
    }

    private fun sqliteQuery(params: JSONObject): JSONObject {
        val sql = checkedSql(params, true)
        val args = sqlArgs(params)
        val rows = org.json.JSONArray()
        database.rawQuery(sql, args).use { cursor ->
            var count = 0
            while (cursor.moveToNext()) {
                require(++count <= 1000) { "Query result limit exceeded" }
                val item = JSONObject()
                for (i in 0 until cursor.columnCount) {
                    val value: Any? = when (cursor.getType(i)) {
                        Cursor.FIELD_TYPE_NULL -> JSONObject.NULL
                        Cursor.FIELD_TYPE_INTEGER -> cursor.getLong(i)
                        Cursor.FIELD_TYPE_FLOAT -> cursor.getDouble(i)
                        Cursor.FIELD_TYPE_BLOB -> android.util.Base64.encodeToString(cursor.getBlob(i), android.util.Base64.NO_WRAP)
                        else -> cursor.getString(i)
                    }
                    item.put(cursor.getColumnName(i), value)
                }
                rows.put(item)
            }
        }
        return JSONObject().put("rows", rows)
    }

    private fun validatedKey(params: JSONObject): String {
        val key = params.getString("key")
        require(key.matches(Regex("[A-Za-z0-9_.-]{1,128}"))) { "Invalid storage key" }
        return key
    }

    private fun handleBack() {
        if (::web.isInitialized && web.canGoBack()) web.goBack() else finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        handleBack()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        if (::web.isInitialized) web.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_POST_NOTIFICATIONS) {
            Log.i(TAG, "Notification permission result: ${grantResults.firstOrNull() ?: PackageManager.PERMISSION_DENIED}")
        }
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    override fun onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            onBackInvokedDispatcher.unregisterOnBackInvokedCallback(backCallback)
        }
        worker.shutdownNow()
        activeIds.clear()
        if (::web.isInitialized) web.destroy()
        super.onDestroy()
    }

    // Debug-only device test: exercise the same JavaScript-to-native bridge used by apps.
    fun runBridgeSmokeTest(complete: (String) -> Unit) {
        if (!BuildConfig.DEBUG) {
            complete("RELEASE_BUILD")
            return
        }
        smokeCallback = complete
        fun poll(remaining: Int) {
            web.evaluateJavascript("document.readyState") { state ->
                if (state != "\"complete\"" && remaining > 0) {
                    web.postDelayed({ poll(remaining - 1) }, 200)
                } else if (state != "\"complete\"") {
                    smokeCallback = null
                    complete("WEB_NOT_READY")
                } else {
                    val script = """(async()=>{
       function call(plugin,method,params){return new Promise((resolve,reject)=>{
         const id='test-'+Math.random().toString(36).slice(2);
         const old=window.__mobixReceive;
         window.__mobixReceive=function(payload){const msg=JSON.parse(payload);if(msg.id===id){window.__mobixReceive=old;msg.ok?resolve(msg.result):reject(new Error(msg.error?.message));}else if(old)old(payload)};
         window.mobixBridge.postMessage(JSON.stringify({v:1,id,plugin,method,params}));
       })}
       let result='PASS';
       try {
         const negotiated=await call('Bridge','negotiate',{versions:[1]});
         if(negotiated.protocol!==1)throw Error('NEGOTIATION_FAILED');
         const device=await call('Device','getInfo',{});
         if(device.platform!=='android')throw Error('DEVICE_FAILED');
         await call('Storage','set',{key:'mobix_smoke',value:'tested'});
         const stored=await call('Storage','get',{key:'mobix_smoke'});
         await call('Storage','remove',{key:'mobix_smoke'});
         if(stored.value!=='tested')throw Error('STORAGE_FAILED');
       } catch(e){result='ERROR:'+String(e)}
       window.mobixBridge.postMessage(JSON.stringify({v:1,id:'smoke-report',plugin:'Test',method:'report',params:{result}}));
      })()"""
                    web.evaluateJavascript(script, null)
                }
            }
        }
        runOnUiThread { poll(60) }
    }

    private companion object {
        const val TAG = "Mobix"
        const val NOTIFICATION_CHANNEL = "mobix_default"
        const val REQUEST_POST_NOTIFICATIONS = 4101
    }
}
