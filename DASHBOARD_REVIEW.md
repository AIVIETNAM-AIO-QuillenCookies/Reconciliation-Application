# Dashboard đối soát bốn trang

Rà soát bổ sung ngày **13/11/2026**, commit `ed969a42233dfe191e6aac054a156c73ce8e55fc`. Tài liệu này mô tả cách trình bày kết quả; [bản đồ ứng dụng nghiên cứu](docs/RESEARCH_APPLICATION_MAP.md) phân biệt phạm vi triển khai, bằng chứng và phần còn thiếu. Các kết quả triển khai/kiểm thử của đợt trước bên dưới là ghi chép lịch sử; kết quả chạy lại trong lần này được tách ở phần Kiểm chứng.

Dashboard nằm tại mục **Tổng quan** trên sidebar. Bốn tab dùng chung nguồn kết quả và bộ lọc: **Tổng quan**, **Cầu nối chênh lệch**, **Đối soát chi tiết**, **Hoàn trả & chất lượng**. Bộ lọc dashboard đọc snapshot hiện tại, không khởi chạy lại pipeline Raw. Dữ liệu nhập, ánh xạ, correction overlay, hồ sơ và ghi chú tiếp tục thuộc shared store của phiên.

## Tài liệu thực tế có trong phiên

- Đã đọc yêu cầu trong tệp văn bản đính kèm, mã nguồn, `Memory.md`, lớp tính toán và workbook `public/reference/excel-reference.xlsx`.
- Không tìm thấy `Final.pbix`, ảnh web hoặc bốn ảnh Power BI trong attachments và cây thư mục dự án. Vì vậy chưa xác minh được layout gốc, quan hệ mô hình, tương tác visual, measure DAX hay ghi chú quốc gia trong PBIX. Không suy đoán công thức từ tên measure.
- Các workbook được liệt kê trong `outputs/pos-source-audit/corpus-inventory.json` là tài liệu kiểm toán nguồn từ bước trước; dashboard không tự đọc các đường dẫn máy cá nhân đó và không coi chúng là dữ liệu đã nhập của phiên hiện tại.

## Quy ước tính và phạm vi

- Tổng quan: **Δ = GL − Sales Flash**, **Δ% = Δ / Sales Flash**. GL và Flash biểu diễn doanh thu theo cùng chiều dương. Không đảo dấu GL đã chuẩn hóa thêm lần nữa.
- Cửa hàng: **Δ = GL − POS**; online: **Δ = GL − WEB**. Ngưỡng cửa hàng–tháng là **|Δ| > 200 USD VÀ |Δ / |GL|| > 1%**, theo `Memory.md`, mục IX và ghi chú tại dòng 1521. Thiếu một bên hoặc GL bằng 0 cần trạng thái riêng; tỷ lệ không xác định không được hiển thị là 0%.
- Tổng chênh lệch có dấu, tổng độ lớn chênh lệch, số cửa hàng và số ô cửa hàng–ngày là các chỉ tiêu riêng. Khoản tự bù cả năm vẫn được giữ theo tháng; đặc biệt `POS_TIMING` và `INTERFACE` trong Excel có tổng năm bằng 0.
- Waterfall bắt đầu từ Flash, cộng từng khoản điều chỉnh và kết thúc tại GL. Dòng tổng hoặc dòng kiểm tra không nằm trong mẫu số tỷ trọng điều chỉnh. Làm tròn chỉ dùng để hiển thị; Excel giữ độ chính xác USD gốc.
- Không quy đổi USD tham chiếu Excel qua FX lần nữa. Tỷ lệ hàng trả cần tổng giá trị trả / tổng doanh thu online đã giao trong cùng phạm vi và cơ sở FX; không cộng hoặc lấy trung bình tỷ lệ tháng.
- Quốc gia chỉ có thể lọc khi snapshot cung cấp phân bổ đáng tin cậy cho toàn phạm vi áp dụng. Có tiền tệ hoặc kênh không đủ để suy ra quốc gia.

## Đường sử dụng đã đối chiếu với code

- [DashboardSuite](src/components/dashboard/DashboardSuite.tsx) là component thực tế của trang Dashboard, đọc `activeResult` để chọn **Raw hoặc Excel**. Các tab, tháng, kênh và quốc gia nằm trong query URL; đổi bộ lọc chỉ gọi lại `buildDashboardModel`, không gọi processor. Thành phần `ReferenceDashboard` cũ vẫn còn, nay nằm riêng trong `ReferenceDashboard.tsx` và vẫn được xuất lại qua `ReferenceViews.tsx`; sự tồn tại của nó không phải bằng chứng rằng trang Dashboard hiện dùng thành phần đó.
- [buildDashboardModel](src/lib/dashboard-model.ts) dùng snapshot Raw do `captureDashboardSnapshot` lấy từ cùng run để tính các tổng tháng, đối soát chi tiết và chất lượng. Truy vết khoản mục cầu nối Raw lại dựa trên `result.evidence.tables`, là mẫu bị giới hạn; không được dùng số dòng hiển thị này để tính lại tổng.
- Excel dùng `Cau_noi` cho Flash, GL và các điều chỉnh; `Chi_tiet` cung cấp mã khoản, giao dịch, số lượng hủy/trả và dòng bị loại đã có sẵn. Inspector cầu nối giữ một dòng `Cau_noi` và tối đa **199 dòng chi tiết** trong kỳ, kèm nhãn cắt mẫu; màn hình bảng tham chiếu giữ toàn bộ dữ liệu được parser đọc. Không có bước chạy lại quy tắc Raw từ ba sheet này.
- Ở cả hai nguồn, chọn một kênh làm trống Flash, Δ, cầu nối và các kiểm tra cầu nối vì thiếu phân bổ Flash theo kênh đã xác minh. Raw vẫn lọc GL theo kênh và các phần chi tiết phù hợp; Excel chỉ lọc được các chỉ tiêu chi tiết có `Kenh`. Bộ lọc quốc gia hiện chưa có dữ liệu áp dụng cho **cả Raw và Excel**, dù cấu hình Store Master có thể chứa quốc gia.
- [Methodology](src/pages/Methodology.tsx) tách nhánh Excel sang `ReferenceMethodology`; nhánh Raw hiển thị sơ đồ, nguồn/joins, danh mục quy tắc và bằng chứng cùng run. [RecordProof](src/components/methodology/RecordProof.tsx) hiển thị đầu vào → logic → đầu ra đã giữ lại, không tính lại. [captureRunEvidence](src/lib/reconciliation-evidence.ts) giới hạn **50 dòng/bảng**, giữ tổng số dòng và cờ `truncated`; không có mẫu đầu vào thì màn hình ghi rõ thiếu.

Các ngưỡng và biểu đồ minh họa một phần khuyến nghị [Memory.md, X.3.3–X.3.5](Memory.md#muc-x): không thay cho việc xác nhận đủ bút toán trước khóa sổ, duyệt bằng chứng hoặc quyết định phát hành. Biểu đồ hiển thị đúng kết quả Excel cũng không xác nhận pipeline Raw đã hoàn tất.

## Đối chiếu workbook thật

Đọc workbook bằng chính `parseExcelReference` đang dùng trong ứng dụng, rồi cộng 12 cột tháng bằng `selectExcelReference`. Kết quả đã kiểm tra trực tiếp:

| Chỉ tiêu                      |           USD |
| ----------------------------- | ------------: |
| Sales Flash                   | 31.124.401,00 |
| GL                            | 28.698.496,23 |
| Δ = GL − Flash                | −2.425.904,77 |
| Chưa giải thích               |     +1.250,00 |
| Cầu nối sau điều chỉnh trừ GL |          0,00 |

Toàn bộ **58 kiểm tra số học** của parser đều đạt với workbook đi kèm. Các số trên là kết quả đọc nguồn, không phải giá trị đưa vào component.

Workbook có ba sheet:

| Sheet              | Dữ liệu và phạm vi                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `Cau_noi`          | 15 khoản mục × 12 tháng và Cả năm; gồm 11 khoản điều chỉnh, Flash, tổng cầu nối, Finance và kiểm tra. |
| `Nhat_ky_ngoai_le` | 10 ngoại lệ, trạng thái và người phụ trách theo Excel.                                                |
| `Chi_tiet`         | 39.062 dòng chi tiết; 11 tiêu đề lặp đã loại khỏi dữ liệu; giữ dòng worksheet và giá trị nguồn.       |

`Chi_tiet` có `Ma_khoan`, `Thang`, `Ngay`, `Kenh`, `Ma_giao_dich`, `Tien_te`, `Tien_goc_co_dau`, `Ty_gia_ngay`, `Ty_gia_thang`, `USD`, `Dong_nguon`, `USD_bao_cao`, `USD_chinh_xac`. Các mã khoản thực tế gồm `CANCEL`, `DISCOUNT`, `DUP_POS`, `FX`, `INTERFACE`, `POS_TIMING`, `RECLASS`, `RETURN`, `ROUND`, `SHIP`, `UNEXPLAINED`, `WEB_TIMING`.

Đếm mã giao dịch trong đúng phạm vi nguồn cho thấy 124 đơn `CANCEL`, 169 đơn `RETURN` và 12 dòng `DUP_POS` bị loại. Số 139 đơn hủy trong báo cáo bao gồm 15 đơn đặt tháng 12/2024, ngoài phạm vi Flash 2025 (`Memory.md`, mục X.2.3.3); dashboard không dùng 139 cho biểu đồ đơn đặt 2025. Giá trị `RETURN` ở Excel dùng tỷ giá ngày đặt và tháng trả; không đồng nhất mặc định với giá trị hoàn trả quy theo tỷ giá ghi nhận GL.

## Widget cần thêm nguồn

| Nội dung                                                       | Dữ liệu cần có                                                                                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ma trận doanh thu kênh × tháng, lọc kênh cho toàn bộ cầu nối   | Flash và GL đầy đủ theo tháng × kênh; chi tiết các khoản điều chỉnh cùng phạm vi. Riêng `Kenh` ở các dòng điều chỉnh không phân bổ được tổng Flash/GL. |
| Bộ lọc quốc gia                                                | Store Master và phân bổ quốc gia của cả Flash/GL/WEB đáng tin cậy.                                                                                     |
| Số ô cửa hàng–ngày, trước/sau chuẩn hóa, ngưỡng cửa hàng–tháng | POS và GL hoàn chỉnh cùng grain, danh mục cửa hàng, lịch hạch toán và cơ sở FX; không tính từ mẫu bằng chứng bị giới hạn.                              |
| Online theo ngày đặt/ngày giao; tỷ lệ trả theo tháng và cả kỳ  | WEB đầy đủ với ngày đặt, giao, trả, trạng thái, số tiền và cơ sở FX; GL giao/trả tương ứng.                                                            |
| Số bút toán tay và trạng thái bằng chứng                       | `glReview`/GL đầy đủ và hồ sơ rà soát thực tế; mã `SHIP`, `RECLASS` hoặc `UNEXPLAINED` trong chi tiết cầu nối không thay thế sổ bút toán tay.          |
| Kiểm tra chất lượng Raw chi tiết                               | Snapshot validation và dòng nguồn của cùng run. Kiểm tra số học Excel không phải kết quả kiểm tra Raw.                                                 |

Widget thiếu nguồn phải hiện thông báo và bảng cần bổ sung. Giá trị 0 chỉ được hiển thị khi đủ dữ liệu để tính kết quả bằng 0. Không dùng dữ liệu Raw để lấp chỗ trống trong dashboard đang chọn Excel.

## Nguồn, truy vết và phiên

Thanh Excel được thu gọn, giữ tên file, nhãn phiên xem thử, thao tác **File & tiến trình** và **Tắt xem thử · Quay lại xử lý Raw**. Dialog nguồn giải thích sheet, kỳ, cách tính và trạng thái Raw. Dữ liệu USD trong các panel giữ file, sheet, dòng worksheet và `Dong_nguon` khi có; ngoại lệ chỉ được liên kết khi xác định được khóa nguồn.

Chế độ Excel không xác nhận bằng chứng, đóng hồ sơ hay ghi đè luồng Raw. Có mã chứng từ chưa đủ để đánh dấu bằng chứng đã được xác minh. Refresh vẫn xóa dữ liệu trong phiên theo lifecycle hiện có.

## Kiểm chứng

Trong lần rà soát ngày 13/11/2026 đã chạy nhóm tám file kiểm thử Excel, session, dashboard và evidence: **42/42 đạt**. Lệnh và phạm vi cụ thể tại [EXCEL_REFERENCE_PREVIEW.md](EXCEL_REFERENCE_PREVIEW.md#kiểm-chứng). Nhóm này xác minh các tổng workbook, 58 kiểm tra số học, dấu GL − Flash, hạn chế nguồn, dữ liệu Raw cùng run, mẫu evidence và tương tác jsdom. Chưa kiểm chứng bằng trình duyệt thực, dữ liệu sản xuất hoặc bản deploy trong lần này.

Các đoạn sau ghi lại kiểm chứng của đợt cải thiện dashboard trước đó:

Đã chạy trực tiếp parser trên workbook thật và xác nhận các số đối chiếu, số dòng và toàn bộ 58 kiểm tra. `tests/excel-reference.test.mjs` đạt 9/9; `tests/excel-reference-ui.test.mjs` đạt 1/1; `tests/workspace-ui.test.mjs` đạt 11/11, gồm test cha và 10 trường hợp con. Kiểm thử tương tác xác nhận dấu GL − Flash, giữ bộ lọc khi chuyển đủ bốn tab, giữ source/snapshot/period Raw, không gọi lại processor khi lọc hoặc chuyển tab, truy vết file/sheet/dòng và quay lại đúng trạng thái Raw.

Kiểm thử JSDOM cấp kích thước vùng biểu đồ qua `getBoundingClientRect` và `ResizeObserver` giả lập để kiểm tra render và tương tác; không thay thế xác nhận trực quan trong browser.

Kết quả toàn dự án sau đợt cải thiện bố cục và phóng to: **226/226 kiểm thử đạt** bằng `npm.cmd test`; `npm.cmd run build` và `npm.cmd run format:check` đạt. `npm.cmd run lint` thoát thành công, còn 7 cảnh báo ở các tệp ngoài phần dashboard mới. Build còn cảnh báo kích thước bundle lớn hơn 500 kB. Chi tiết thao tác phóng to, bố cục viewport và giới hạn kiểm chứng xem [DASHBOARD_UX.md](DASHBOARD_UX.md).

Đã khởi động Vite và kiểm tra HTTP 200 cho trang chính cùng module dashboard. CUA trả về danh sách browser rỗng, nên chưa thể mở trình duyệt, chụp ảnh hoặc xác nhận trực quan overflow/kích thước tại 1920×1080, 1440×900 và mobile. CSS dùng grid responsive, cuộn bảng cục bộ, cột ma trận cố định và panel độc lập; không coi kiểm thử DOM là bằng chứng hoàn tất rà soát trực quan.

Kiểm thử tương tác bổ sung xác nhận xếp hạng dùng độ lớn trong đúng kỳ chọn; bộ chọn tháng của biểu đồ mở đúng tháng; đổi nguồn đóng panel của nguồn cũ. Link tới bút toán/ngoại lệ dùng ID thực, tự mở đúng bản ghi và giữ URL bộ lọc khi quay lại dashboard. Workbook không có khóa ngoại nối khoản mục cầu nối tới ngoại lệ; link Excel cùng kỳ chỉ mở nhật ký đúng kỳ, không tự gán một ngoại lệ.

Để mở: chạy `npm.cmd run dev`, vào **Tổng quan** trên sidebar rồi chọn một trong bốn tab. Có thể dùng **Xem thử Excel** khi chưa nhập Raw. Các bộ lọc tháng/kênh và tab nằm trong URL để trở lại đúng phạm vi; pipeline và dữ liệu phiên không bị chạy lại bởi các thao tác này.
