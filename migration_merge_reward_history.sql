-- ============================================================
-- GỘP LỊCH SỬ ĐỔI QUÀ CỦA PHẦN THƯỞNG ĐÃ ĐỔI TÊN
-- ============================================================
-- Bối cảnh: thống kê "đã trao N lần" trong Quản trị đếm theo reward_name
-- (vì đơn cũ có reward_id = NULL). Khi một phần thưởng bị đổi tên, các đơn
-- cũ vẫn giữ tên cũ nên không được cộng vào phần thưởng hiện tại.
--
-- File này gộp tên cũ "100K" (10 lượt đã trao) vào phần thưởng hiện tại
-- "Tiền mặt 100K", chỉ trong gia đình 00000000-0000-0000-0000-000000000001.
-- Vừa đổi reward_name, vừa gán reward_id để bền vững về sau.
--
-- Cách chạy: Supabase -> SQL Editor -> dán toàn bộ -> Run.
-- ============================================================

UPDATE reward_redemptions AS r
SET reward_name = 'Tiền mặt 100K',
    reward_id = (
      SELECT id FROM rewards
      WHERE reward_name = 'Tiền mặt 100K'
        AND family_id = '00000000-0000-0000-0000-000000000001'
      LIMIT 1
    )
WHERE r.reward_name = '100K'
  AND r.family_id = '00000000-0000-0000-0000-000000000001';

-- Kiểm tra lại: câu này phải trả về 0 dòng (không còn tên cũ "100K").
SELECT id, reward_name, reward_id
FROM reward_redemptions
WHERE reward_name = '100K'
  AND family_id = '00000000-0000-0000-0000-000000000001';

-- Xem tổng số lần "đã trao" của "Tiền mặt 100K" sau khi gộp (nên = 13):
SELECT reward_name, COUNT(*) AS da_trao
FROM reward_redemptions
WHERE reward_name = 'Tiền mặt 100K'
  AND family_id = '00000000-0000-0000-0000-000000000001'
  AND status IN ('completed', 'claimed', 'delivered')
GROUP BY reward_name;
