import AuthenticationServices
import Foundation
import React
import UIKit

@objc(SafariWebAuth)
class SafariWebAuth: NSObject, ASWebAuthenticationPresentationContextProviding {
  private var webAuthSession: ASWebAuthenticationSession?
  private var presentationWindow: UIWindow?

  private func activePresentationWindow() -> UIWindow? {
    let connectedScenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let scenes = connectedScenes.filter { $0.activationState == .foregroundActive } +
      connectedScenes.filter { $0.activationState == .foregroundInactive }

    for scene in scenes {
      if let window = scene.windows.first(where: { $0.isKeyWindow }) ??
        scene.windows.first(where: { !$0.isHidden && $0.alpha > 0 && $0.windowLevel == .normal }) {
        return window
      }
    }
    return nil
  }

  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    return presentationWindow!
  }

  @objc(requestAuth:callbackURLScheme:ephemeral:resolver:rejecter:)
  func requestAuth(
    url: String,
    callbackURLScheme: String,
    ephemeral: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard let parsedURL = URL(string: url) else {
      reject("auth_invalid_url", "The authentication URL is invalid.", nil)
      return
    }
    guard let window = activePresentationWindow() else {
      reject("auth_presentation_unavailable", "No active app window is available to present authentication.", nil)
      return
    }

    presentationWindow = window
    let session = ASWebAuthenticationSession(
      url: parsedURL,
      callbackURLScheme: callbackURLScheme
    ) { [weak self] callbackURL, error in
      defer {
        self?.webAuthSession = nil
        self?.presentationWindow = nil
      }
      if let error = error {
        reject("auth_session_failed", error.localizedDescription, error)
      } else if let callbackURL = callbackURL {
        resolve(callbackURL.absoluteString)
      } else {
        reject("auth_callback_missing", "Authentication completed without a callback URL.", nil)
      }
    }
    session.presentationContextProvider = self
    session.prefersEphemeralWebBrowserSession = ephemeral
    webAuthSession = session

    guard session.start() else {
      webAuthSession = nil
      presentationWindow = nil
      reject("auth_start_failed", "The authentication session could not be started.", nil)
      return
    }
  }
}
