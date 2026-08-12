-- ============================================
-- MIGRATION: Thêm cờ phân biệt phần thưởng tặng điểm
-- Chạy script này trên Supabase SQL Editor
-- ============================================
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS is_point_reward BOOLEAN DEFAULT FALSE;
