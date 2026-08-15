# Antigravity Rules cho dự án QLVN

## Kiểm tra cú pháp (Syntax Check)
Bất cứ khi nào bạn chỉnh sửa file `app.js` hoặc bất kỳ file Javascript nào trong dự án này, bạn **BẮT BUỘC** phải chạy lệnh `node -c app.js` bằng công cụ `run_command` ngay lập tức để kiểm tra cú pháp.
Việc này rất quan trọng để đảm bảo không có lỗi cú pháp (như khai báo trùng biến, thiếu ngoặc, sai chính tả) làm hỏng ứng dụng và gây ra lỗi trắng trang hoặc không đăng nhập được.
Chỉ khi lệnh trả về thành công (exit code 0), bạn mới được thông báo là đã sửa xong.
