# Nifty Daily Forecast

the project is nfty daily prediction record dashborad
should be run daily and log every days predictions
attaching terminla output for your refrence 
C:\Users\pythongo\Desktop\final predictor\angel_nifty_predictor_v2>python nifty_range_predictor_v2.py

[I 260802 19:41:08 smartConnect:124] in pool

[I 260802 19:41:08 auth:62] Login Successful ✅

Downloading latest NIFTY and INDIA VIX data...

[I 260802 19:41:08 download_nifty_vix_daily:119] Downloading NIFTY_50: 2025-08-01 00:00 to 2026-08-01 23:59

[I 260802 19:41:11 download_nifty_vix_daily:119] Downloading INDIA_VIX: 2025-08-01 00:00 to 2026-08-01 23:59

==============================================================

NIFTY NEXT-DAY RANGE FORECAST - VERSION 2

==============================================================

Data date              : 2026-07-31

Forecast date          : 2026-08-03

Last close             : 24383.60

India VIX              : 11.76

--------------------------------------------------------------

Expected move          : +/- 159.93 points

Expected move %        : +/- 0.6559%

Expected low           : 24223.67

Expected high          : 24543.53

Expected total range   : 319.86 points

68% closing range      : 24223.67 - 24543.53

95% closing range      : 24070.14 - 24697.06

--------------------------------------------------------------

MODEL MOVES

HV(30)                 : 176.82

ATR(14) half range     : 98.08

Realized vol(20)       : 188.38

EWMA                    : 174.94

VIX implied            : 180.64

==============================================================

Saved CSV              : nifty_next_day_forecast_v2.csv

Saved JSON             : nifty_next_day_forecast_v2.json

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://daily-nifty-range.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6d6a686d-59c2-4d81-a39e-061a9a463a42).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
