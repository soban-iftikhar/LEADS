# leads.messaging

Status: not built yet. Celery queue: `messaging`.

One interface, two implementations; the admin picks one in `config.app_settings` (`messaging.channel`).

| File | Does |
|---|---|
| `channel.py` | `MessageChannel` protocol: `send(contact, body, template) -> SendResult` |
| `wa_cloud.py` | WhatsApp Cloud API. First message to a contact must be an approved template |
| `wa_link.py` | creates a `PENDING_STAFF` message; staff send it from the admin send queue via a wa.me link |
| `templates.py` | renders `config.message_templates` with placeholders |

The phone number is decrypted here from `app.contacts.phone_enc`, used for the send, and never
written anywhere else. No number rotation.
