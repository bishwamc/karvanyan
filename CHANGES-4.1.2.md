# Release 4.1.2 – slower start, fewer early decisions

- **Slower days.** A quiet day now lasts 3.5 s (was 1.8 s). Days with news wait about 330 ms per word, up to 9 s (was 250 ms, 6 s).
- **Quiet start.** No random road decisions (dilemma, checkpoint, robbers, strangers, trouble) in the first 5 travel days. The scripted day-3 lame-camel crisis still happens.
- **Breathing room.** After any road decision the next one waits at least 3 travel days.
- Not changed: the nightly "where do you sleep" question (Settings > Sleep in a sarai can answer it for you), stops, river crossings, arrival scenes.
- Numbers live in `js/config.js`: `QUIET_DAY_MILLISECONDS`, `READING_MILLISECONDS_PER_WORD`, `MAX_DAY_MILLISECONDS`, `EVENT_GRACE_TRAVEL_DAYS`, `EVENT_MIN_GAP_DAYS`.
- Test added: no random decision inside the quiet start and spacing holds over 60 seeds (fails if either number is loosened).
