# Bố cục và phóng to dashboard

Đợt cải thiện này chỉ thay đổi cách trình bày và tương tác. Lớp chỉ tiêu, công thức, dữ liệu và nghiệp vụ đối soát được giữ nguyên.

## Cách dùng

- Header giữ tiêu đề, nhãn Excel/Raw, nhập dữ liệu và nút tắt xem thử. Bấm nhãn nguồn để mở **Thông tin dữ liệu**, xem file, sheet, kỳ, cách tính và các lưu ý. **File & tiến trình** trong panel mở tiến trình hiện có.
- Tháng và kênh luôn nằm trên thanh bộ lọc. Quốc gia chuyển vào **Bộ lọc khác**. **Điểm chính** giữ một câu; **Xem thêm** mở đầy đủ nhận xét trong panel.
- Cả 17 khối biểu đồ, bảng và ma trận trên bốn tab có nút **Phóng to** ở góc phải. Bấm tên hoặc phần trống của header cũng mở rộng khối. Các điểm biểu đồ, dòng bảng, bộ chọn và link vẫn thực hiện thao tác dữ liệu của chúng.
- Vùng mở rộng dùng một dialog chung, rộng 96vw và cao 92dvh trên desktop, toàn viewport trên mobile. **Escape** hoặc nút đóng trả về dashboard và khôi phục focus. Truy vết dữ liệu sẽ đóng vùng mở rộng rồi mở một inspector.

## Bố cục và khả năng đọc

App shell giữ header cao 56px; dashboard dùng phần còn lại của `100dvh`, không trừ chiều cao header lần nữa trong widget. Với desktop từ 1200px và chiều cao từ 820px, các hàng header, bộ lọc, tab, điểm chính và KPI có chiều cao theo nội dung; lưới biểu đồ/bảng chiếm phần còn lại bằng `minmax(0, 1fr)`. Các cấp chứa có `min-width: 0` và `min-height: 0`.

Ở màn hình thấp như 1366×768 hoặc màn hình hẹp, dashboard trở về chiều cao tự nhiên và cuộn dọc. Không dùng zoom, transform hay che tràn toàn trang để ép vừa. Bảng cuộn dọc bên trong; chỉ ma trận nhiều tháng cuộn ngang và giữ cột tên khoản mục. Một số bảng hiển thị các cột thiết yếu trong bản xem trước; phóng to hiển thị đầy đủ. Bảng mở rộng trên mobile chuyển thành từng bản ghi có nhãn để giữ số tiền đọc được.

Biểu đồ dùng ResizeObserver của Recharts để đo lại vùng chứa. Waterfall mở rộng hiển thị tên đầy đủ; vùng hẹp dùng thanh ngang và cuộn dọc. Khoản rất nhỏ có vùng bấm bổ sung, tooltip và bộ chọn khoản mục. Chú giải, nhãn và bảng có cỡ chữ lớn hơn trong vùng mở rộng.

## Giữ trạng thái

`DashboardWidgetProvider` giữ một `activeWidgetId`. Widget render vào một portal host ổn định; khi mở rộng, host được chuyển sang dialog rồi chuyển về vị trí cũ. Không tạo bản sao dữ liệu và không remount bảng, nên tìm kiếm, sắp xếp, trang và vị trí cuộn được giữ. Tab, bộ lọc và kết quả tiếp tục dùng URL/shared store hiện có.

Đổi nguồn hoặc unmount widget đóng vùng đang mở. Tương tác bên trong host được nhận diện đúng dù React portal vẫn thuộc widget ban đầu; chúng không bị hiểu là click ngoài dialog. Chỉ các thao tác mở rộng có nút riêng, không biến toàn card thành button.

## Kiểm chứng và giới hạn

`npm.cmd test` đạt **226/226** kiểm thử. Kiểm thử mới xác nhận DOM bảng ổn định, tìm kiếm/sắp xếp/trang/cuộn được giữ, Escape và focus, không mở nhầm từ thao tác dữ liệu, cả bốn tab dùng cùng dialog, đổi nguồn đóng nội dung cũ và không gọi lại processor. SVG đo lại từ 650 → 1250 → 1020 px khi thay đổi vùng chứa giả lập. Build, lint và kiểm tra định dạng được chạy trên PowerShell; lint còn các cảnh báo hiện có ngoài phần UI mới, build còn cảnh báo bundle lớn.

Tệp đính kèm của đợt này chỉ có yêu cầu văn bản; không có ảnh dashboard để mở đối chiếu. CUA trả về `apps: []`, `browsers: []`, nên chưa thể chụp ảnh hoặc xác nhận trực quan tại 1920×1080, 1440×900 và 1366×768. Kiểm thử DOM/ResizeObserver không thay thế kiểm tra overflow và cân đối bằng trình duyệt thực.
