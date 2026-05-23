# TapList — overview

## Why this app exists

Navigating a beerfest and logging what you drink is harder than it should be. Beer lists are published in Google Sheets, PDFs, or hard-to-navigate web pages. The lists are often wrong — breweries cancel, kegs blow, last-minute swaps happen. Tracking what you tried, what you liked, and what you still want to try usually means juggling a separate notes app or spreadsheet, often on a phone, in a crowded venue, with one hand free.

TapList is a guidebook that lives on the festival-goer's phone. It loads the published beer list, lets the user flag beers to try, rate them, take quick notes, and patch the list when reality diverges from the spreadsheet. Everything works offline, because cell signal at festivals is unreliable.

## Target user and context

The primary user is a festival attendee, standing in line, holding a beer in one hand, on a phone in portrait mode, possibly outdoors in bright sun, possibly with poor signal. They want to glance at the list, decide quickly, and move on. A secondary use is pre-festival planning at home on a larger screen — scanning the full list and flagging beers to try before walking in the gate.

## Initial festival, future festivals

TapList ships first for the Washington Brewers Festival (WBF). It is architected so the dataset (JSON file) can be swapped to power other festivals in future versions, but v1 ships with WBF only — no in-app dataset switcher.

## Non-goals

- No user accounts, no authentication.
- No server-side components, no cross-device sync.
- No social features (sharing lists, following friends, leaderboards).
- No analytics or telemetry.
- No in-app payment, token tracking, or commerce features.
