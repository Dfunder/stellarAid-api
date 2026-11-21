# Analytics events

Analytics event ingestion uses `AnalyticsService.ingest` in
`src/modules/analytics/`. The service validates the full event using the
discriminated Zod schema before forwarding it to the configured event store.
Unknown event names, missing fields, invalid values, and extra fields are
rejected with a `400 BAD_REQUEST`. An unconfigured store returns
`503 SERVICE_UNAVAILABLE`; events are never reported as accepted without being
stored.

## Event catalog

Each event must have exactly the listed properties:

| Event type | Properties |
| --- | --- |
| `user_signed_up` | `method`: `email` or `wallet` |
| `campaign_created` | `campaignId`: non-empty string |
| `campaign_viewed` | `campaignId`: non-empty string |
| `donation_created` | `campaignId`: non-empty string; `amount`: positive decimal string; `assetCode`: non-empty string |
| `donation_completed` | `campaignId`: non-empty string; `amount`: positive decimal string; `assetCode`: non-empty string; `transactionHash`: non-empty string |

Amounts are strings to preserve decimal precision. Keep event property objects
strict and add a schema and catalog entry together when introducing an event.

The Prisma schema defines the event record shape with a JSON `properties`
column. This repository does not currently configure Prisma persistence; an
`ANALYTICS_EVENT_STORE` provider must be registered before valid events can be
ingested. The service fails explicitly until that adapter exists.
