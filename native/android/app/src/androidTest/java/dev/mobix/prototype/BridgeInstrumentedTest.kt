package dev.mobix.prototype

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

@RunWith(AndroidJUnit4::class)
class BridgeInstrumentedTest {
 @Test fun deviceAndStorageRoundTrip() {
  val latch = CountDownLatch(1)
  var outcome = "NOT_STARTED"
  ActivityScenario.launch(MainActivity::class.java).use { scenario ->
   scenario.onActivity { activity ->
    activity.runBridgeSmokeTest { result -> outcome=result; latch.countDown() }
   }
   assertTrue("Bridge test timed out",latch.await(25,TimeUnit.SECONDS))
   assertEquals("PASS",outcome)
  }
 }
}
