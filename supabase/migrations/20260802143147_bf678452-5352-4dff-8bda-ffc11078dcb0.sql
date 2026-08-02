CREATE TABLE public.nifty_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  as_of_date DATE NOT NULL,
  forecast_date DATE NOT NULL UNIQUE,
  last_close NUMERIC NOT NULL,
  india_vix NUMERIC NOT NULL,
  expected_move_points NUMERIC NOT NULL,
  expected_move_percent NUMERIC NOT NULL,
  expected_low NUMERIC NOT NULL,
  expected_high NUMERIC NOT NULL,
  expected_total_range_points NUMERIC NOT NULL,
  close_68_low NUMERIC NOT NULL,
  close_68_high NUMERIC NOT NULL,
  close_95_low NUMERIC NOT NULL,
  close_95_high NUMERIC NOT NULL,
  hv30_points NUMERIC NOT NULL,
  atr14_half_range_points NUMERIC NOT NULL,
  rv20_points NUMERIC NOT NULL,
  ewma_points NUMERIC NOT NULL,
  vix_implied_points NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nifty_forecasts TO anon;
GRANT SELECT ON public.nifty_forecasts TO authenticated;
GRANT ALL ON public.nifty_forecasts TO service_role;

ALTER TABLE public.nifty_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Forecasts are publicly readable"
ON public.nifty_forecasts FOR SELECT
TO anon, authenticated
USING (true);

CREATE INDEX idx_nifty_forecasts_forecast_date ON public.nifty_forecasts (forecast_date DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_nifty_forecasts_updated_at
BEFORE UPDATE ON public.nifty_forecasts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();