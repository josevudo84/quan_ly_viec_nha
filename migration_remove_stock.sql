-- ============================================================
-- BỎ TÍNH NĂNG TỒN KHO CHO PHẦN THƯỞNG / QUÀ
-- ============================================================
-- Lý do: tồn kho không được yêu cầu và gây nhầm lẫn. Giao diện
-- đã bỏ ô "Tồn kho"; phần quản trị giờ hiển thị "đã trao N lần".
--
-- Cột `stock` vẫn giữ lại trong bảng (không DROP) để không phá
-- các bản cũ đang chạy, nhưng đặt về NULL cho mọi phần thưởng.
-- Hàm redeem_reward() chỉ kiểm tra khi `stock IS NOT NULL`, nên
-- để NULL là bỏ qua hoàn toàn kiểm tra OUT_OF_STOCK.
--
-- Cách chạy: mở Supabase -> SQL Editor -> dán toàn bộ file này -> Run.
-- ============================================================

UPDATE rewards SET stock = NULL WHERE stock IS NOT NULL;

-- Kiểm tra lại: câu này phải trả về 0 dòng.
SELECT id, reward_name, stock FROM rewards WHERE stock IS NOT NULL;
