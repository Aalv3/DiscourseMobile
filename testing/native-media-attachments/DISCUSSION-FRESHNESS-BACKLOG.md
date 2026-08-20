# Native discussion freshness backlog

Status: non-blocking follow-up; intentionally excluded from the PDF attachment
debugging delta.

Observed on the staging native app: a newly submitted Ask/discussion can be
absent from Floor recent discussions / Network activity until the member leaves
and re-enters the surface or relaunches the app. The next mission should trace
Ask completion through the Floor/latest query cache and focus-refresh lifecycle,
then add deterministic invalidation or refresh without coupling that work to
media rendering.
