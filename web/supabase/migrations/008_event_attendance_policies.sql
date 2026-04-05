-- ─── Event Attendance RSVP Policies ──────────────────────────────────────────
-- Allows users to delete their own attendance (un-RSVP).

CREATE POLICY "Users can delete own attendance"
  ON event_attendance FOR DELETE
  USING (user_id = auth.uid());
