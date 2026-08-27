import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
  private let appGroup = "group.org.adjusternetwork.app"
  private let payloadName = "pending-share.json"
  private let diagnosticName = "share-extension.ndjson"
  private let maximumImageBytes: Int64 = 15 * 1024 * 1024
  private let maximumDiagnosticBytes = 64 * 1024
  private let supportedImageTypes: [UTType] = [.jpeg, .png, .heic, .heif, .gif, .webP]
  private let titleLabel = UILabel()
  private let messageLabel = UILabel()
  private let closeButton = UIButton(type: .system)
  private let spinner = UIActivityIndicatorView(style: .medium)

  override func viewDidLoad() {
    super.viewDidLoad()
    configureView()
    record(stage: "extension", category: "lifecycle", outcome: "started")
    consumeFirstSupportedAttachment()
  }

  private func configureView() {
    view.backgroundColor = .systemBackground
    titleLabel.font = .preferredFont(forTextStyle: .headline)
    titleLabel.textColor = .label
    titleLabel.textAlignment = .center
    titleLabel.numberOfLines = 0
    titleLabel.text = "Saving to Adjuster Network…"
    messageLabel.font = .preferredFont(forTextStyle: .body)
    messageLabel.textColor = .secondaryLabel
    messageLabel.textAlignment = .center
    messageLabel.numberOfLines = 0
    closeButton.setTitle("Done", for: .normal)
    closeButton.titleLabel?.font = .preferredFont(forTextStyle: .headline)
    closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)
    closeButton.isHidden = true
    spinner.startAnimating()
    let stack = UIStackView(arrangedSubviews: [spinner, titleLabel, messageLabel, closeButton])
    stack.axis = .vertical
    stack.spacing = 16
    stack.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(stack)
    NSLayoutConstraint.activate([
      stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 28),
      stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -28),
      stack.centerYAnchor.constraint(equalTo: view.safeAreaLayoutGuide.centerYAnchor),
      closeButton.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
    ])
    preferredContentSize = CGSize(width: 0, height: 260)
  }

  private func consumeFirstSupportedAttachment() {
    guard let items = extensionContext?.inputItems as? [NSExtensionItem],
          let providers = items.first?.attachments else {
      showFailure("No shareable item was provided.", category: "missing_input")
      return
    }
    if let provider = providers.first(where: { provider in
      supportedImageTypes.contains { provider.hasItemConformingToTypeIdentifier($0.identifier) }
    }), let type = supportedImageTypes.first(where: {
      provider.hasItemConformingToTypeIdentifier($0.identifier)
    }) {
      record(stage: "provider", category: "image", outcome: "selected")
      consumeImage(provider, type: type)
      return
    }
    if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }) {
      provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, error in
        guard let self else { return }
        guard error == nil, let url = item as? URL, self.isApprovedURL(url) else {
          self.showFailure("That link cannot be shared to Adjuster Network.", category: "invalid_url", error: error)
          return
        }
        self.persist(kind: "url", value: url.absoluteString, limit: 2048)
      }
      return
    }
    if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }) {
      provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, error in
        guard let self else { return }
        guard error == nil, let text = item as? String else {
          self.showFailure("The shared text could not be read.", category: "text_load", error: error)
          return
        }
        self.persist(kind: "text", value: text, limit: 8192)
      }
      return
    }
    showFailure("This item type is not supported.", category: "unsupported_type")
  }

  private func consumeImage(_ provider: NSItemProvider, type: UTType) {
    provider.loadFileRepresentation(forTypeIdentifier: type.identifier) { [weak self] source, error in
      guard let self else { return }
      guard error == nil, let source else {
        self.showFailure("The selected image could not be read.", category: "image_load", error: error)
        return
      }
      guard let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: self.appGroup
      ) else {
        self.showFailure("Shared storage is unavailable. Please try again.", category: "app_group")
        return
      }
      let extensionName = type.preferredFilenameExtension ?? "image"
      let filename = "shared-image-\(UUID().uuidString.lowercased()).\(extensionName)"
      let destination = container.appendingPathComponent(filename, isDirectory: false)
      do {
        let values = try source.resourceValues(forKeys: [.fileSizeKey, .isRegularFileKey])
        guard values.isRegularFile == true, let byteCount = values.fileSize, byteCount > 0 else {
          self.showFailure("The selected image is not a readable file.", category: "invalid_image")
          return
        }
        guard Int64(byteCount) <= self.maximumImageBytes else {
          self.showFailure("Choose an image smaller than 15 MiB.", category: "image_too_large")
          return
        }
        let replacedImage = self.previouslyPendingImage(in: container)
        try FileManager.default.copyItem(at: source, to: destination)
        try FileManager.default.setAttributes(
          [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
          ofItemAtPath: destination.path
        )
        let copiedSize = try destination.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard copiedSize == byteCount else { throw CocoaError(.fileWriteUnknown) }
        self.record(stage: "image", category: "copy", outcome: "succeeded")
        self.persist(
          kind: "image", value: filename, limit: 128,
          metadata: [
            "name": provider.suggestedName.map { String($0.prefix(128)) } ?? filename,
            "mime_type": type.preferredMIMEType ?? "application/octet-stream",
            "size": byteCount,
          ],
          cleanupURL: destination,
          replacedURL: replacedImage
        )
      } catch {
        try? FileManager.default.removeItem(at: destination)
        self.showFailure("The image could not be saved. Please try again.", category: "image_copy", error: error)
      }
    }
  }

  private func previouslyPendingImage(in container: URL) -> URL? {
    let descriptor = container.appendingPathComponent(payloadName)
    guard let data = try? Data(contentsOf: descriptor), data.count <= 4096,
          let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
          payload["kind"] as? String == "image", let filename = payload["value"] as? String,
          filename.range(
            of: #"^shared-image-[0-9a-f-]{36}\.(jpe?g|png|heic|heif|gif|webp)$"#,
            options: [.regularExpression, .caseInsensitive]
          ) != nil else { return nil }
    return container.appendingPathComponent(filename)
  }

  private func isApprovedURL(_ url: URL) -> Bool {
    url.scheme?.lowercased() == "https" && url.host?.lowercased() == "adjusternetwork.org"
  }

  private func persist(
    kind: String, value: String, limit: Int,
    metadata: [String: Any] = [:], cleanupURL: URL? = nil,
    replacedURL: URL? = nil
  ) {
    let bounded = String(value.prefix(limit)).trimmingCharacters(in: .whitespacesAndNewlines)
    guard !bounded.isEmpty,
          let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroup
          ) else {
      if let cleanupURL { try? FileManager.default.removeItem(at: cleanupURL) }
      showFailure("Shared storage is unavailable. Please try again.", category: "descriptor_container")
      return
    }
    var payload: [String: Any] = [
      "schema": "an.share-intent.v1", "id": UUID().uuidString,
      "created_at": Date().timeIntervalSince1970, "kind": kind, "value": bounded,
    ]
    metadata.forEach { payload[$0.key] = $0.value }
    let destination = container.appendingPathComponent(payloadName)
    do {
      let data = try JSONSerialization.data(withJSONObject: payload)
      guard data.count <= 4096 else { throw CocoaError(.fileWriteUnknown) }
      try data.write(
        to: destination,
        options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
      )
      if let replacedURL, replacedURL != cleanupURL {
        try? FileManager.default.removeItem(at: replacedURL)
      }
      record(stage: "descriptor", category: kind, outcome: "persisted")
      showSuccess()
    } catch {
      if let cleanupURL { try? FileManager.default.removeItem(at: cleanupURL) }
      try? FileManager.default.removeItem(at: destination)
      showFailure("The share could not be saved. Please try again.", category: "descriptor_write", error: error)
    }
  }

  private func showSuccess() {
    DispatchQueue.main.async { [weak self] in
      self?.spinner.stopAnimating()
      self?.titleLabel.text = "Saved to Adjuster Network"
      self?.messageLabel.text = "Open Adjuster Network to finish your Ask."
      self?.closeButton.setTitle("Done", for: .normal)
      self?.closeButton.isHidden = false
    }
  }

  private func showFailure(_ message: String, category: String, error: Error? = nil) {
    record(stage: "extension", category: category, outcome: "failed", error: error)
    DispatchQueue.main.async { [weak self] in
      self?.spinner.stopAnimating()
      self?.titleLabel.text = "Couldn't save to Adjuster Network"
      self?.messageLabel.text = message
      self?.closeButton.setTitle("Close", for: .normal)
      self?.closeButton.isHidden = false
    }
  }

  private func record(stage: String, category: String, outcome: String, error: Error? = nil) {
    guard let container = FileManager.default.containerURL(
      forSecurityApplicationGroupIdentifier: appGroup
    ) else { return }
    let url = container.appendingPathComponent(diagnosticName)
    let nsError = error as NSError?
    var entry: [String: Any] = [
      "timestamp": Int64(Date().timeIntervalSince1970 * 1000),
      "stage": String(stage.prefix(32)), "category": String(category.prefix(48)),
      "outcome": String(outcome.prefix(16)),
    ]
    if let nsError {
      entry["error_domain"] = String(nsError.domain.prefix(64))
      entry["error_code"] = nsError.code
    }
    guard var line = try? JSONSerialization.data(withJSONObject: entry) else { return }
    line.append(0x0A)
    var existing = (try? Data(contentsOf: url)) ?? Data()
    if existing.count + line.count > maximumDiagnosticBytes {
      existing = Data(existing.suffix(maximumDiagnosticBytes / 2))
      if let newline = existing.firstIndex(of: 0x0A) {
        existing = Data(existing.suffix(from: existing.index(after: newline)))
      }
    }
    existing.append(line)
    try? existing.write(
      to: url,
      options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication]
    )
  }

  @objc private func close() {
    record(stage: "extension", category: "ui", outcome: "completed")
    extensionContext?.completeRequest(returningItems: nil)
  }
}
