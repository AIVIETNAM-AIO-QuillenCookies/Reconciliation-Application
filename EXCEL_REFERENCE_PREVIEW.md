# Xem thử theo Excel

Chọn **Tạm xem theo Excel** tại thông báo đối soát bị chặn hoặc trên thanh công cụ. Ứng dụng đọc workbook đi kèm; **Chọn workbook** cho phép nhập lại file XLSX. Sau khi đọc xong, chọn **Hiển thị dashboard**. Có thể xem ba sheet bằng các nút xem bảng trong tiến trình hoặc trang Xử lý dữ liệu.

Chọn **Tắt xem thử · Quay lại xử lý Raw** trên thanh thông báo để trở về kết quả và pipeline Raw. Chế độ chỉ nằm trong bộ nhớ của tab, mặc định tắt và không tự bật lại khi tải lại trang. Hủy tải hoặc tắt sẽ vô hiệu hóa cả các callback nhập file còn chạy.

## Dữ liệu thực tế

`public/reference/excel-reference.xlsx` là bản sao nguyên file `bang-cau-noi&nhat-ki-ngoai-le (1).xlsx` tìm thấy trong Downloads khi triển khai. Đây là dữ liệu tài chính của workbook, được phục vụ cùng ứng dụng cục bộ.

- `Cau_noi`: 15 dòng, 12 tháng năm 2025. Cột Cả năm chỉ dùng đối chiếu, không cộng lại vào 12 tháng.
- `Nhat_ky_ngoai_le`: 10 ngoại lệ. EX-05 vẫn là **Cần chứng từ**; dữ liệu này chỉ đọc và tách biệt với các hồ sơ Raw.
- `Chi_tiet`: 39.062 bản ghi, bỏ dòng trống và 11 tiêu đề bảng lặp. Giữ số dòng Excel vật lý và toàn bộ cột nguồn, kể cả các cách tính USD khác nhau.

Tổng năm đọc từ workbook: Sales Flash 31.124.401,00 USD; Finance 28.698.496,23 USD; chênh lệch 2.425.904,77 USD; phí vận chuyển 94.766,95 USD; chưa giải thích 1.250,00 USD.

Giá trị USD không quy đổi FX thêm; tính tổng có bù sai số số thực và chỉ làm tròn khi hiển thị. Ngưỡng kiểm tra tiền tệ là 0,01 USD. Các kiểm tra gồm tổng thành phần so với Finance từng tháng/năm, dòng tổng và dòng kiểm tra trong workbook, 12 tháng so với Cả năm và các giá trị đối chiếu người dùng cung cấp. Chênh lệch được hiển thị nguyên thực tế, không thêm khoản để cân về 0. Khớp số học không xác nhận bằng chứng kế toán.

Liên kết chi tiết dựa vào ý nghĩa khoản mục và `Ma_khoan` thực tế; lọc theo `Thang`. Các cột `USD`, `USD_bao_cao`, `USD_chinh_xac` không được cộng lẫn. Các khoản chuyển kênh có trong chi tiết được giữ ở bảng nguồn, không tạo thêm dòng cầu nối không có trong Excel. Workbook không cung cấp đối soát đầy đủ cửa hàng–ngày hoặc snapshot giao dịch Raw; các màn hình liên quan ghi rõ chưa có dữ liệu.

## Điểm tích hợp và cách gỡ

- `src/lib/excel-reference.ts`: adapter đọc, xác thực, lọc kỳ và liên kết chi tiết.
- `src/lib/excel-reference-session.ts`: điểm bật/tắt tập trung, nguồn kết quả đang hoạt động và bảo vệ tác vụ cũ.
- `src/lib/store.ts`: chỉ thêm state `excelReference`, các action của controller và selector `activeResult`; các field Raw vẫn giữ riêng.
- `src/components/excel-reference/`: thanh điều khiển, tiến trình và các màn hình tham chiếu.
- Năm trang Dashboard, ExceptionLog, DataProcessing, Methodology, AccountingReview dùng wrapper chọn Excel hoặc Raw theo `activeResult.source`. Rà soát kế toán có guard cho thay đổi chưa lưu trước khi chuyển nguồn.
- AppLayout chứa thanh thông báo, nút mở và dialog; ReconciliationRunStatus có nút mở tại lỗi; ProcessingDialog ẩn tiến trình Raw khi đang xem Excel.

Để gỡ chế độ: bỏ các wrapper nhánh Excel, các điểm gắn điều khiển nêu trên, state/controller/selector trong store; sau đó bỏ hai module, thư mục component, hai stylesheet, workbook đi kèm và các kiểm thử `excel-reference*`. Pipeline, mapping, bằng chứng và nghiệp vụ rà soát Raw không phụ thuộc vào adapter.

## Kiểm chứng

Kiểm thử dùng workbook thực tế, kiểm tra tháng/năm, dấu, độ chính xác, ngoại lệ, liên kết chi tiết, các trường hợp file lỗi, chênh lệch thật, giữ hồ sơ Raw và ngăn tác vụ tải cũ. Các kiểm thử giao diện chạy qua jsdom. Chạy `npm.cmd test`, `npm.cmd run build`, `npm.cmd run lint`, `npm.cmd run format:check`.

CUA không có trình duyệt khả dụng trong phiên triển khai, nên chưa xác nhận trực quan bằng ảnh chụp trình duyệt thực tế.
