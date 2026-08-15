import UIKit
import UniformTypeIdentifiers

private struct ShareIntent: Encodable {
  let schema = "an.share-intent.v1"
  let id: String
  let created_at: TimeInterval
  let kind: String
  let value: String
}

final class ShareViewController: UIViewController {
  private let appGroup = "group.org.adjusternetwork.app"
  private let payloadName = "pending-share.json"

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = .clear
    consumeFirstSupportedAttachment()
  }

  private func consumeFirstSupportedAttachment() {
    guard
      let items = extensionContext?.inputItems as? [NSExtensionItem],
      let providers = items.first?.attachments
    else {
      finish()
      return
    }

    if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }) {
      provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
        guard let self, let url = item as? URL, self.isApprovedURL(url) else {
          self?.finish()
          return
        }
        self.persistAndOpen(kind: "url", value: url.absoluteString, limit: 2048)
      }
      return
    }

    if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }) {
      provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, _ in
        guard let self, let text = item as? String else {
          self?.finish()
          return
        }
        self.persistAndOpen(kind: "text", value: text, limit: 8192)
      }
      return
    }

    finish()
  }

  private func isApprovedURL(_ url: URL) -> Bool {
    url.scheme?.lowercased() == "https" && url.host?.lowercased() == "adjusternetwork.org"
  }

  private func persistAndOpen(kind: String, value: String, limit: Int) {
    let bounded = String(value.prefix(limit)).trimmingCharacters(in: .whitespacesAndNewlines)
    guard !bounded.isEmpty,
          let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroup
          ) else {
      finish()
      return
    }
    let payload = ShareIntent(
      id: UUID().uuidString,
      created_at: Date().timeIntervalSince1970,
      kind: kind,
      value: bounded
    )
    let destination = container.appendingPathComponent(payloadName)
    do {
      let data = try JSONEncoder().encode(payload)
      try data.write(to: destination, options: [.atomic, .completeFileProtection])
      finish()
    } catch {
      try? FileManager.default.removeItem(at: destination)
      finish()
    }
  }

  private func finish() {
    DispatchQueue.main.async { [weak self] in
      self?.extensionContext?.completeRequest(returningItems: nil)
    }
  }
}
