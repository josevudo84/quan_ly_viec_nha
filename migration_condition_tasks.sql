-- ============================================
-- MIGRATION: Tính năng Điều kiện (Condition Tasks)
-- Chạy script này trên Supabase SQL Editor
-- ============================================

-- 1. Thêm cột is_condition vào bảng tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_condition BOOLEAN DEFAULT FALSE;

-- 2. Thêm cột points_awarded vào bảng task_logs
ALTER TABLE task_logs ADD COLUMN IF NOT EXISTS points_awarded BOOLEAN DEFAULT FALSE;

-- 3. Data migration: Đánh dấu points_awarded = true cho tất cả log đã duyệt trước đó
-- (vì điểm của chúng đã được trao theo hệ thống cũ)
UPDATE task_logs SET points_awarded = TRUE WHERE status = 'Approved';

-- ============================================
-- XONG! Kiểm tra bằng cách chạy:
-- SELECT column_name, data_type, column_default FROM information_schema.columns
-- WHERE table_name IN ('tasks', 'task_logs') AND column_name IN ('is_condition', 'points_awarded');
-- ============================================
