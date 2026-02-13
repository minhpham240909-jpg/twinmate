-- Allow users to delete their own leads
CREATE POLICY "Users can delete own leads"
  ON public.leads
  FOR DELETE
  USING (auth.uid() = user_id);
