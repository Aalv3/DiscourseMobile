# frozen_string_literal: true
#
# Appends the AN Preview callback to allowed_user_api_auth_redirects on the
# PRODUCTION Discourse. Run from the production rails console.
#
# Bounded by construction: it appends one exact URI, refuses wildcards, removes
# nothing, and touches no other setting. Scopes, allowed groups, admission, the
# member-photo credential boundary, revocation and private-network controls are
# all untouched.
#
# Modelled on testing/native-auth/apply-native-auth-setting.rb in the server
# repository, which certified the production callback on 2026-08-11.

require "json"

required_redirect = "anpreview://adjusternetwork.org/auth_redirect"

before = SiteSetting.allowed_user_api_auth_redirects.split("|")
after = (before + [required_redirect]).uniq

raise "refusing wildcard redirect" if after.any? { |value| value.include?("*") }
raise "refusing to remove an existing redirect" unless (before - after).empty?

SiteSetting.allowed_user_api_auth_redirects = after.join("|")

puts JSON.generate(
  setting: "allowed_user_api_auth_redirects",
  before: before,
  after: SiteSetting.allowed_user_api_auth_redirects.split("|"),
  changed: before != after,
  preview_redirect_present:
    SiteSetting.allowed_user_api_auth_redirects.split("|").include?(required_redirect),
  wildcard_present: SiteSetting.allowed_user_api_auth_redirects.include?("*"),
)
