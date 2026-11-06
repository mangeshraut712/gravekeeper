# esrever (third-party, unmodified)

`upstream/` holds `esrever.js`, its MIT license, and its README, copied unmodified
from https://github.com/mathiasbynens/esrever at commit
`14b34013dad49106ca08c0e65919f1fc8fea5331` (Mathias Bynens and contributors, MIT).

Gravekeeper's `src/lib/restoration/reverse.mts` is a separate, original,
bounded reimplementation of the `reverse` API using `Intl.Segmenter`. It is not
a copy of esrever's code. `scripts/verify-restoration.mts` checks the pinned Git
blob hashes before executing the upstream file.
