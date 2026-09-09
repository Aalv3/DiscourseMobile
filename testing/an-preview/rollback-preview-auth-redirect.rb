# frozen_string_literal: true
#
# Removes the AN Preview callback. Leaves every other redirect in place.

require "json"

removed_redirect = "anpreview://adjusternetwork.org/auth_redirect"

before = SiteSetting.allowed_user_api_auth_redirects.split("|")
after = before - [removed_redirect]

raise "refusing to empty the redirect allowlist" if after.empty?

SiteSetting.allowed_user_api_auth_redirects = after.join("|")

puts JSON.generate(
  setting: "allowed_user_api_auth_redirects",
  before: before,
  after: SiteSetting.allowed_user_api_auth_redirects.split("|"),
  changed: before != after,
)
