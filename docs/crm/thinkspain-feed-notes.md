# thinkSPAIN feed notes

This project does not currently contain a dedicated thinkSPAIN exporter.

The sample provided by the user was close, but it had a few structural and data-shape issues that are worth keeping in mind before wiring an exporter:

- The document must open with `<root>` and close with `</root>`.
- `import_version` belongs under `<thinkspain>`, which itself must sit inside the root node.
- `unique_id` should be a stable integer and must never change for the same property.
- `euro_price_high` only applies to `sale_type=holiday`; for `sale` and `longterm` it should be omitted.
- `property_type` should match one of thinkSPAIN's accepted labels.
- `full_address` should stay coherent with the granular address fields.
- `catastral` is safer when exported without spaces unless the upstream source explicitly preserves formatting.
- Optional fields like `floor_number` and `door_number` should only be sent when they make sense for the asset type.

Reference template:

- `docs/crm/thinkspain-feed-template.xml`
