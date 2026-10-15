import AppKit
import Foundation
import React
import WidgetKit

@objc(DoitWidgetBridge)
final class DoitWidgetBridge: NSObject {
  private static let appGroup = "group.com.osbyrne.doit"
  private static let sessionKey = "betterAuthSessionToken"
  private static let pendingURLKey = "pendingIncomingURL"

  @objc
  static func requiresMainQueueSetup() -> Bool { false }

  @objc(storeSessionToken:resolver:rejecter:)
  func storeSessionToken(
    _ token: String,
    resolver resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
      reject("shared_storage_unavailable", "Could not access Doit's shared widget storage.", nil)
      return
    }
    defaults.set(token, forKey: Self.sessionKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }

  @objc(loadSessionToken:rejecter:)
  func loadSessionToken(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    resolve(UserDefaults(suiteName: Self.appGroup)?.string(forKey: Self.sessionKey) as Any? ?? NSNull())
  }

  @objc(clearSessionToken:rejecter:)
  func clearSessionToken(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
      reject("shared_storage_unavailable", "Could not access Doit's shared widget storage.", nil)
      return
    }
    defaults.removeObject(forKey: Self.sessionKey)
    WidgetCenter.shared.reloadAllTimelines()
    resolve(true)
  }

  @objc(takePendingURL:rejecter:)
  func takePendingURL(
    _ resolve: RCTPromiseResolveBlock,
    rejecter reject: RCTPromiseRejectBlock
  ) {
    guard let defaults = UserDefaults(suiteName: Self.appGroup) else {
      resolve(NSNull())
      return
    }
    let url = defaults.string(forKey: Self.pendingURLKey)
    defaults.removeObject(forKey: Self.pendingURLKey)
    resolve(url as Any? ?? NSNull())
  }

  @objc
  func clearPendingURL() {
    UserDefaults(suiteName: Self.appGroup)?.removeObject(forKey: Self.pendingURLKey)
  }

  @objc
  func reloadTasksWidget() {
    WidgetCenter.shared.reloadAllTimelines()
  }

  static func receiveIncomingURL(_ url: URL) {
    UserDefaults(suiteName: appGroup)?.set(url.absoluteString, forKey: pendingURLKey)
    DispatchQueue.main.async {
      NSApp.activate(ignoringOtherApps: true)
      NotificationCenter.default.post(
        name: Notification.Name("RCTOpenURLNotification"),
        object: nil,
        userInfo: ["url": url.absoluteString]
      )
    }
  }
}
