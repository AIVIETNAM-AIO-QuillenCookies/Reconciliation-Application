# Xem thử theo Excel

**Cập nhật 14/11/2026:** nút **Tạm xem theo Excel** mặc định nạp `public/demo/Nexa_Home_Recon_Dataset_Final.xlsx`, bản sao của workbook trong `docs/source`, để hiển thị đủ bốn dashboard. Chi tiết cửa hàng/online và hoàn trả lấy từ các sheet chuẩn hóa; bút toán tay từ GL; chất lượng từ `QC_Summary`, giữ nguyên những dòng chưa đánh giá. Xem [quy tắc và nguồn cho bốn dashboard](docs/EXCEL_DASHBOARD_RULES.md). Workbook cầu nối ba sheet bên dưới vẫn được hỗ trợ khi chọn file cũ; các số liệu và kiểm chứng ngày 13/11 mô tả chế độ cũ.

Rà soát tài liệu ngày **13/11/2026**, theo commit `ed969a42233dfe191e6aac054a156c73ce8e55fc`. Xem [bản đồ ứng dụng nghiên cứu](docs/RESEARCH_APPLICATION_MAP.md) để đối chiếu với luồng Raw và khuyến nghị trong [Memory.md](Memory.md). Các ghi chép về nguồn workbook và việc công khai bên dưới là lịch sử của repository; lần rà soát này không xác nhận một bản deploy đang hoạt động.

Chọn **Tạm xem theo Excel** tại thông báo đối soát bị chặn hoặc trên thanh công cụ. Ứng dụng đọc workbook đi kèm; **Chọn workbook** cho phép nhập lại file XLSX. Sau khi đọc xong, chọn **Hiển thị dashboard**. Có thể xem ba sheet bằng các nút xem bảng trong tiến trình hoặc trang Xử lý dữ liệu.

Chọn **Tắt xem thử · Quay lại xử lý Raw** trên thanh thông báo để trở về kết quả và pipeline Raw. Chế độ chỉ nằm trong bộ nhớ của tab, mặc định tắt và không tự bật lại khi tải lại trang. Hủy tải hoặc tắt sẽ vô hiệu hóa cả các callback nhập file còn chạy.

## Dữ liệu thực tế

`public/reference/excel-reference.xlsx` là bản sao nguyên file `bang-cau-noi&nhat-ki-ngoai-le (1).xlsx` tìm thấy trong Downloads khi triển khai. Đây là dữ liệu tài chính của workbook, được phục vụ cùng ứng dụng cục bộ.

Ngày 13/11/2026, người dùng xác nhận giữ workbook này để làm demo công khai trên bản deploy. File trong `public` được chép vào `dist/reference` và mọi người có thể tải; file upload của khách truy cập vẫn chỉ nằm trong phiên trình duyệt.

- `Cau_noi`: 15 dòng, 12 tháng năm 2025. Cột Cả năm chỉ dùng đối chiếu, không cộng lại vào 12 tháng.
- `Nhat_ky_ngoai_le`: 10 ngoại lệ. EX-05 vẫn là **Cần chứng từ**; dữ liệu này chỉ đọc và tách biệt với các hồ sơ Raw.
- `Chi_tiet`: 39.062 bản ghi, bỏ dòng trống và 11 tiêu đề bảng lặp. Giữ số dòng Excel vật lý và toàn bộ cột nguồn, kể cả các cách tính USD khác nhau.

Tổng năm đọc từ workbook: Sales Flash 31.124.401,00 USD; Finance 28.698.496,23 USD; phí vận chuyển 94.766,95 USD; chưa giải thích 1.250,00 USD. Adapter `selectExcelReference().varianceUSD` giữ quy ước Flash − Finance = **+2.425.904,77 USD**; dashboard chung chuyển về **Δ = GL − Flash = −2.425.904,77 USD**. Hai giá trị cùng độ lớn nhưng khác chiều; cần ghi công thức khi trích số.

Giá trị USD không quy đổi FX thêm; tính tổng có bù sai số số thực và chỉ làm tròn khi hiển thị. Ngưỡng kiểm tra tiền tệ là 0,01 USD. Các kiểm tra gồm tổng thành phần so với Finance từng tháng/năm, dòng tổng và dòng kiểm tra trong workbook, 12 tháng so với Cả năm và các giá trị đối chiếu người dùng cung cấp. Chênh lệch được hiển thị nguyên thực tế, không thêm khoản để cân về 0. Khớp số học không xác nhận bằng chứng kế toán.

Liên kết chi tiết dựa vào ý nghĩa khoản mục và `Ma_khoan` thực tế; lọc theo `Thang`. Các cột `USD`, `USD_bao_cao`, `USD_chinh_xac` không được cộng lẫn. Các khoản chuyển kênh có trong chi tiết được giữ ở bảng nguồn, không tạo thêm dòng cầu nối không có trong Excel. Workbook không cung cấp đối soát đầy đủ cửa hàng–ngày hoặc snapshot giao dịch Raw; các màn hình liên quan ghi rõ chưa có dữ liệu.

## Phạm vi nhập và ý nghĩa kiểm tra

Đây là adapter cho **kết quả đã tính trong Excel**, không thực thi lại các query làm sạch, FX, sự kiện ghi nhận hoặc đối soát Raw. [parseExcelReference](src/lib/excel-reference.ts) đọc giá trị ô bằng SheetJS; không có bước chạy lại công thức Excel trong adapter. Workbook có công thức cần cung cấp giá trị ô đã được tính và lưu phù hợp.

- Cấu trúc yêu cầu có ba sheet bắt buộc nêu trên, các cột bắt buộc, 12 tháng liên tiếp từ tháng 01 đến tháng 12 của cùng một năm, đúng một dòng Flash/Finance/tổng cầu nối/kiểm tra. File khác cấu trúc này cần chuyển đổi trước; không có wizard ánh xạ tự do như Raw.
- Cột Cả năm chỉ là tổng kiểm soát. Bộ chọn kỳ lấy **toàn bộ tháng** có giao với ngày đầu/cuối; không chia số tiền theo ngày trong một tháng.
- Lỗi cấu trúc hoặc ô số không hợp lệ làm nhập thất bại. Ngược lại, một kiểm tra số học không đạt vẫn được giữ trong `checks` và workbook có thể hiển thị; trạng thái `ready` không đồng nghĩa mọi kiểm tra đã đạt.
- Sáu kiểm soát tham chiếu cuối trong parser dùng số tiền và số ngoại lệ của workbook mẫu. Một workbook khác hợp lệ về cấu trúc có thể không đạt các kiểm soát này; đây không phải bộ tham số tùy chỉnh cho mọi doanh nghiệp.
- Nhãn khoản mục được ánh xạ sang mã chi tiết cố định trong hàm `classify`; nhãn chưa được nhận diện vẫn có thể thành dòng điều chỉnh nhưng không có `detailCodes` để liên kết chi tiết.

Tách năm mức kết luận: **hợp lệ cấu trúc** cho biết đọc được workbook; **khớp số học** cho biết các tổng kiểm soát khớp trong ngưỡng; **nguyên nhân** là phân loại đã có sẵn trong workbook; **bằng chứng được rà soát** cần hồ sơ/chứng từ và xác nhận riêng; **quyết định hoàn tất** cần người có trách nhiệm quyết định. Adapter không thực hiện hai mức cuối và không chứng minh pipeline Raw đã chạy thành công.

## Điểm tích hợp và cách gỡ

- `src/lib/excel-reference.ts`: adapter đọc, xác thực, lọc kỳ và liên kết chi tiết.
- `src/lib/excel-reference-session.ts`: điểm bật/tắt tập trung, nguồn kết quả đang hoạt động và bảo vệ tác vụ cũ.
- `src/lib/store.ts`: chỉ thêm state `excelReference`, các action của controller và selector `activeResult`; các field Raw vẫn giữ riêng.
- `src/components/excel-reference/`: thanh điều khiển, tiến trình và các màn hình tham chiếu.
- Năm trang Dashboard, ExceptionLog, DataProcessing, Methodology, AccountingReview dùng wrapper chọn Excel hoặc Raw theo `activeResult.source`. Rà soát kế toán có guard cho thay đổi chưa lưu trước khi chuyển nguồn.
- AppLayout chứa thanh thông báo, nút mở và dialog; ReconciliationRunStatus có nút mở tại lỗi; ProcessingDialog ẩn tiến trình Raw khi đang xem Excel.

Để gỡ chế độ: bỏ các wrapper nhánh Excel, các điểm gắn điều khiển nêu trên, state/controller/selector trong store; sau đó bỏ hai module, thư mục component, hai stylesheet, workbook đi kèm và các kiểm thử `excel-reference*`. Pipeline, mapping, bằng chứng và nghiệp vụ rà soát Raw không phụ thuộc vào adapter.

## Kiểm chứng

Ngày 13/11/2026 đã chạy:

```powershell
node --experimental-strip-types --test tests/excel-reference.test.mjs tests/excel-reference-session.test.mjs tests/excel-reference-ui.test.mjs tests/dashboard-model.test.mjs tests/dashboard-detail.test.mjs tests/dashboard-expansion.test.mjs tests/workspace-ui.test.mjs tests/evidence.test.mjs
```

Kết quả **42/42 kiểm thử đạt**, gồm kiểm thử con. [excel-reference.test.mjs](tests/excel-reference.test.mjs) đọc workbook đi kèm và xác minh các số tiền, số dòng ở trên cùng **58/58 kiểm tra số học**. Ví dụ đã xác minh: `POS_TIMING` tháng 05 = −41.464,784472934276 USD và tháng 06 = +41.464,784472934276 USD; ngoại lệ EX-03 giữ kỳ `05-06/2025`; tháng 09 có EX-05 **Cần chứng từ**, người phụ trách Finance, yêu cầu chứng từ/phê duyệt ADJ-0925, chi tiết `UNEXPLAINED` mang mã `JE20250904892` và 1.250 USD. Đây là kết quả có sẵn từ Excel, không phải phát hiện lại từ nguồn Raw trong test này.

[excel-reference-session.test.mjs](tests/excel-reference-session.test.mjs) xác minh bật/tắt, giữ kết quả và quyết định Raw riêng, hủy callback cũ, dùng workbook khi engine không sẵn sàng. [dashboard-model.test.mjs](tests/dashboard-model.test.mjs) xác minh dấu dashboard, giới hạn kênh/quốc gia và chỉ tiêu thiếu nguồn. Các kiểm thử giao diện dùng jsdom và kích thước giả lập. Lệnh kiểm tra toàn dự án: `npm.cmd test`, `npm.cmd run build`, `npm.cmd run lint`, `npm.cmd run format:check`; kết quả toàn dự án được ghi tại [RELEASE_CHECK.md](RELEASE_CHECK.md).

Lần rà soát tài liệu này chưa chạy trình duyệt thực tế hay kiểm tra bản deploy. Ghi chép triển khai trước đó cho biết CUA không có trình duyệt khả dụng, nên cũng chưa xác nhận trực quan bằng ảnh chụp trình duyệt thực tế.
