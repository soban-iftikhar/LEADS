# leads.agents

Status: not built yet. Celery queue: `agents`.

| File | Does |
|---|---|
| `campaign.py` | for a paid order: match buyers, score targets, queue messages (`agents.campaign_tick`) |
| `prospect.py` | contact a portal seller picked by the admin and walk them to signup |
| `classifier.py` | classify an inbound reply: keyword fast path for STOP, otherwise the model named in `GEMINI_MODEL` |
| `delivery.py` | create the lead and count it against the order in one transaction |

Rules:
- Selecting properties for campaigns is manual (admin). Agents never choose what to promote.
- Before every outbound message: contact not on do-not-contact, inside the monthly cap,
  outside quiet hours, under the daily send limit. The cap is checked and incremented in one transaction.
- `STOP` or `ANGRY` sets `app.contacts.dnc = true` immediately.
- Confidence below `classifier.min_confidence` goes to admin review; no automatic action.
