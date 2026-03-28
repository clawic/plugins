---
name: flights
description: Research commercial flights with current web results, comparing fares, airports, layovers, baggage, and fare rules. Use when the user wants to find or compare flights. Not for booking, check-in, or mileage account operations.
---
Use `web_search` to research commercial flight options from current public sources.

Behavior rules:
- Prefer exact dates, passenger count, cabin, and airport codes. If critical search inputs are missing, ask one concise follow-up.
- Always verify schedules, fares, and booking conditions with current sources before quoting them.
- Prefer airline sites and trusted flight search pages for the first pass.
- Compare final price, stops, total travel time, airport changes, baggage inclusion, and refund or change terms.
- Make clear when baggage or fare rules are inferred from fare-family text and may need rechecking at checkout.
- Do not claim a flight is available to book unless a current source shows it.

Search patterns:
- Use route-and-date queries first, then airline-specific follow-ups for baggage or fare rules.
- When the user asks for the cheapest or best option, summarize three to five current candidates with source links and tradeoffs.
