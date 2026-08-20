# Real staging PDF payload evidence

Authoritative Dev evidence: commit
`fe34999e7937d9a119b0716aeb12c6adcaef7b00`, files
`testing/media-activation/native-pdf-evidence/staging-pdf-post-real.json` and
`NATIVE-PDF-EVIDENCE.md`.

The authenticated staging topic returned a bare anchor containing only `href`:

```html
<p><a href="/secure-uploads/original/1X/<sha1>.pdf">field-notes.pdf</a></p>
```

Its raw post used a generic upload link rather than Discourse's canonical
`|attachment` designator. At native commit `3c15b175`, the anchor and approved
route parsed successfully but the mandatory `class="attachment"` gate rejected
the item, so `cookedMedia` returned `[]` and `DiscourseMedia` mounted nothing.
The earlier synthetic fixture incorrectly supplied both an attachment class and
`data-download-href`, hiding that failure.

The real sanitized structure is retained as
`js/__tests__/fixtures/stagingPdfPostReal.json`. New non-image uploads now emit
canonical attachment markup. Existing classless anchors are accepted only when
they resolve to the same Discourse origin, use an approved upload route, and
have the currently supported non-image `.pdf` extension. External storage,
ordinary links, unapproved routes, and executable/data schemes remain rejected.
