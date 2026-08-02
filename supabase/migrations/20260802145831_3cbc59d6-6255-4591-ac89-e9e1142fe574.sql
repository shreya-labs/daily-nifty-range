ALTER TABLE public.nifty_forecasts
  ADD COLUMN IF NOT EXISTS actual_open numeric,
  ADD COLUMN IF NOT EXISTS actual_high numeric,
  ADD COLUMN IF NOT EXISTS actual_low numeric,
  ADD COLUMN IF NOT EXISTS actual_close numeric;