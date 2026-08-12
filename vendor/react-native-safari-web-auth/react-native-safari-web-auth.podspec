require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name = package["name"]
  s.version = package["version"]
  s.summary = package["description"]
  s.license = package["license"]
  s.authors = "Adjuster Network"
  s.homepage = "https://adjusternetwork.org"
  s.platform = :ios, "15.1"
  s.source = { :path => "." }
  s.source_files = "ios/**/*.{h,m,mm}"
  s.frameworks = "AuthenticationServices", "UIKit"
  s.dependency "React-Core"
end
