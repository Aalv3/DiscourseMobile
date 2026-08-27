import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
  private let appGroup = "group.org.adjusternetwork.app"
  private let payloadName = "pending-share.json"
  private let maximumImageBytes: Int64 = 15 * 1024 * 1024
  private let supportedImageTypes: [UTType] = [.jpeg, .png, .heic, .heif, .gif, .webP]

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

    if let provider = providers.first(where: { provider in
      supportedImageTypes.contains {
        provider.hasItemConformingToTypeIdentifier($0.identifier)
      }
    }), let type = supportedImageTypes.first(where: {
      provider.hasItemConformingToTypeIdentifier($0.identifier)
    }) {
      consumeImage(provider, type: type)
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

  private func consumeImage(_ provider: NSItemProvider, type: UTType) {
    provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { [weak self] source, _ in
      guard let self, let source,
            let container = FileManager.default.containerURL(
              forSecurityApplicationGroupIdentifier: self.appGroup
            ) else {
        self?.finish()
        return
      }
      let extensionName = type.preferredFilenameExtension ?? "image"
      let filename = "shared-image-\(UUID().uuidString.lowercased()).\(extensionName)"
      let destination = container.appendingPathComponent(filename, isDirectory: false)
      do {
        removePreviouslyPendingImage(in: container)
        let values = try source.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true,
              let byteCount = values.fileSize,
              byteCount > 0,
              Int64(byteCount) <= self.maximumImageBytes else {
          self.finish()
          return
        }
        try FileManager.default.copyItem(at: source, to: destination)
        try FileManager.default.setAttributes(
          [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
          ofItemAtPath: destination.path
        )
        let copiedSize = try destination.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard copiedSize == byteCount else {
          try? FileManager.default.removeItem(at: destination)
          self.finish()
          return
        }
        self.persistAndOpen(
          kind: "image",
          value: filename,
          limit: 128,
          metadata: [
            "name": provider.suggestedName.map { String($0.prefix(128)) } ?? filename,
            "mime_type": type.preferredMIMEType ?? "application/octet-stream",
            "size": byteCount,
          ],
          cleanupURL: destination
        )
      } catch {
        try? FileManager.default.removeItem(at: destination)
        self.finish()
      }
    }
  }

  private func removePreviouslyPendingImage(in container: URL) {
    let descriptor = container.appendingPathComponent(payloadName)
    guard let data = try? Data(contentsOf: descriptor), data.count <= 4096,
          let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          payload["kind"] as? String == "image",
          let filename = payload["value"] as? String,
          filename.range(
            of: #"^shared-image-[0-9a-f-]{36}\.(jpe?g|png|heic|heif|gif|webp)$"#,
            options: [.regularExpression, .caseInsensitive]
          ) != nil else { return }
    try? FileManager.default.removeItem(at: container.appendingPathComponent(filename))
  }

  private func isApprovedURL(_ url: URL) -> Bool {
    url.scheme?.lowercased() == "https" && url.host?.lowercased() == "adjusternetwork.org"
  }

  private func persistAndOpen(
    kind: String,
    value: String,
    limit: Int,
    metadata: [String: Any] = [:],
    cleanupURL: URL? = nil
  ) {
    let bounded = String(value.prefix(limit)).trimmingCharacters(in: .whitespacesAndNewlines)
    guard !bounded.isEmpty,
          let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroup
          ) else {
      finish()
      return
    }
    var payload: [String: Any] = [
      "schema": "an.share-intent.v1",
      "id": UUID().uuidString,
      "created_at": Date().timeIntervalSince1970,
      "kind": kind,
      "value": bounded,
    ]
    metadata.forEach { payload[$0.key] = $0.value }
    let destination = container.appendingPathComponent(payloadName)
    do {
      let data = try JSONSerialization.data(withJSONObject: payload)
      guard data.count <= 4096 else { throw CocoaError(.fileWriteUnknown) }
      try data.write(to: destination, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
      let callback = URL(string: "adjusternetwork://share")!
      extensionContext?.open(callback) { [weak self] _ in self?.finish() }
    } catch {
      if let cleanupURL { try? FileManager.default.removeItem(at: cleanupURL) }
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
