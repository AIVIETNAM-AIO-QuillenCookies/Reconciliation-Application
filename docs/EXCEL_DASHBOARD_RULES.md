# Quy tắc hiển thị 4 dashboard từ Excel

Ngày đối chiếu: 14/11/2026, múi giờ Europe/Berlin.

Chế độ **Tạm theo Excel** mặc định đọc [Nexa_Home_Recon_Dataset_Final.xlsx](source/Nexa_Home_Recon_Dataset_Final.xlsx), được phục vụ từ bản sao `public/demo/Nexa_Home_Recon_Dataset_Final.xlsx`. Mục tiêu hiện tại là hiển thị đủ bốn trang bằng các bảng và giá trị đã có trong dataset. Workbook nguồn được giữ nguyên; thao tác này không chạy pipeline Raw hoặc thay đổi dữ liệu, kết quả và hồ sơ rà soát của phiên Raw.

Nguồn quy tắc là [Báo cáo Đối soát Doanh thu.pdf](<source/Báo cáo Đối soát Doanh thu.pdf>) hiện có **54 trang**. Các số trang dưới đây là số trang của chính PDF này; khác bản chuyển cũ trong `Memory.md`.

## 1. Ánh xạ các dashboard

| Trang                     | Nguồn trong dataset                                                                   | Cách hiển thị                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01. Tổng quan             | `04a_Cau_noi_Flash_GL`; `02d_Flash_chuan_hoa`; `02c_GL_chuan_hoa`                     | Flash, GL, chênh lệch GL − Flash và các khoản cầu nối theo tháng; số theo kênh lấy từ các bảng chuẩn hóa. Giữ riêng GL `UNALLOCATED`.                                         |
| 02. Cầu nối chênh lệch    | `04a_Cau_noi_Flash_GL`; dữ liệu truy vết từ các bảng chuẩn hóa; `05_Nhat_ky_ngoai_le` | Đọc khoản điều chỉnh và giá trị tháng đã có; giữ liên hệ khoản, giao dịch và dòng nguồn. Bảy ngoại lệ là nội dung nhật ký hiện có, không tự đổi thành trạng thái đã hoàn tất. |
| 03. Đối soát chi tiết     | `02a_POS_chuan_hoa`; `02b_Web_chuan_hoa`; `02c_GL_chuan_hoa`                          | Tổng hợp cửa hàng theo ngày để so trước/sau chuẩn hóa; so online theo ngày đặt và ngày ghi nhận. Các công thức cụ thể ở phần 2.                                               |
| 04. Hoàn trả & chất lượng | `02b_Web_chuan_hoa`; `02a_POS_chuan_hoa`; `QC_Summary`; `02c_GL_chuan_hoa`            | Giá trị và tỷ lệ trả hàng, đơn hủy, dòng POS xuất lặp, các kết quả QC đã lưu và bút toán tay. Trang này không đòi người dùng tạo thêm cột để đọc dataset hiện tại.            |

Adapter chuyển cấu trúc dataset sang dạng tham chiếu của ứng dụng trong bộ nhớ. Workbook cũ gồm ba sheet `Cau_noi`, `Nhat_ky_ngoai_le`, `Chi_tiet` vẫn được đọc theo cấu trúc cũ; nếu không có các bảng chi tiết cần thiết thì không suy đoán dữ liệu còn thiếu.

## 2. Cơ sở tính chi tiết

### Cửa hàng

- **Trước chuẩn hóa:** cộng `net_usd_daily` theo `business_date` và `store_key`, gồm mọi phiên xuất POS. Đây là giá sau chiết khấu, chưa lọc bản xuất lặp.
- **Sau chuẩn hóa:** chỉ giữ `export_seq = 1`, cộng `net_usd_month_end` theo `posting_date` và `store_key`.
- **GL đối chiếu:** cộng `revenue_usd` của các `journal_type` bắt đầu bằng `POS`, gồm `POS_DAILY` và `POS_CATCHUP`, theo ngày ghi sổ và cửa hàng. Bút toán `MANUAL` được trình bày riêng.
- Chênh lệch hiển thị là **GL − nguồn**. Kiểm tra cửa hàng–tháng dùng đồng thời `|Δ| > 200 USD` và `|Δ| / |GL| > 1%`; GL bằng 0 không tạo ra tỷ lệ phần trăm hữu hạn.

PDF trang 36 đối soát **nội tệ** ở cấp cửa hàng × ngày × tiền tệ, chỉ dùng USD cuối tháng để xét ngưỡng. Trang hiện tại so các tổng **USD** nên có thể còn sai số do làm tròn dù nội tệ khớp. Không dùng số ô USD khớp để thay thế kết quả 5.118/5.120 ô nội tệ trong PDF. Sheet `03a_Doi_soat_Cua_hang` có `Chenh_Lech_NoiTe` theo dấu nguồn − GL; khi đối chiếu với quy ước ứng dụng cần đảo dấu.

### Online

- Cơ sở ngày đặt chỉ lấy `Delivered` và `Returned`, cộng `net_usd_daily` theo `order_date`; đơn `Cancelled` được theo dõi riêng ở trang 04.
- Cơ sở ghi nhận cộng `net_usd_month_end_delivery` theo `delivery_date`, rồi trừ `net_usd_month_end_return` theo `return_date`.
- GL đối chiếu chỉ gồm `WEB_DELIVERY` và `WEB_RETURN`. Phí vận chuyển và chuyển kênh thuộc `MANUAL` không được nhập vào tổng GL của biểu đồ đối chiếu sự kiện online.

PDF trang 36 còn trình bày riêng giao hàng và hàng trả: 1.647 ô giao khớp và 159 ô trả khớp theo nội tệ. Biểu đồ online hiện tại trình bày tổng giao trừ trả theo USD; đây là phạm vi khác với phép so **chỉ `WEB_DELIVERY`** với ngày đặt trong bảng của PDF. Sai số vài xu giữa tổng USD chuẩn hóa và GL không bị ép về 0.

### Hoàn trả, hủy và dòng xuất lặp

- **Giá trị trả:** cộng `net_usd_daily` của đơn `Returned` theo **ngày trả**.
- **Giá trị giao làm mẫu số:** cộng cùng `net_usd_daily` của đơn không hủy theo **ngày giao**, kể cả đơn về sau được trả.
- **Tỷ lệ trả:** tổng giá trị trả trong kỳ / tổng giá trị giao trong kỳ. Hai vế cùng cơ sở giá sau chiết khấu và tỷ giá ngày đặt theo PDF trang 20, 38. Không lấy trung bình các tỷ lệ tháng; mẫu số bằng 0 hiển thị không xác định.
- **Đơn hủy:** đếm mã đơn `Cancelled` khác nhau có **ngày đặt** thuộc kỳ.
- **POS xuất lặp:** đếm dòng có `export_seq > 1` theo tháng bán. Bảng `03c_POS_Dong_trung` chứa cả bản gốc và bản lặp nên không dùng toàn bộ số dòng của bảng làm số dòng bị loại.

## 3. Số đối chiếu của dataset

Các số sau được tính đọc độc lập từ giá trị trong workbook để xác định đúng phạm vi. Chúng không chứng minh một bộ kiểm tra chất lượng dữ liệu độc lập đã được chạy trong ứng dụng.

| Chỉ tiêu                            | Phạm vi                                           | Giá trị đối chiếu |
| ----------------------------------- | ------------------------------------------------- | ----------------: |
| Sales Flash                         | Năm 2025                                          | 31.124.401,00 USD |
| Doanh thu GL                        | Năm 2025, gồm mọi kênh                            | 28.698.496,23 USD |
| GL − Flash                          | Năm 2025                                          | −2.425.904,77 USD |
| Đơn nhận trả                        | Ngày trả trong 2025                               |           169 đơn |
| Giá trị trả, tỷ giá ngày đặt        | Ngày trả trong 2025                               |    349.148,23 USD |
| Giá trị giao, tỷ giá ngày đặt       | Ngày giao trong 2025; gồm đơn về sau trả          | 15.794.489,27 USD |
| Tỷ lệ giá trị trả                   | Tổng trả / tổng giao cùng cơ sở trên              |          2,21057% |
| Đơn hủy                             | Ngày đặt trong 2025                               |           124 đơn |
| Giá trị đơn hủy, tỷ giá ngày đặt    | Ngày đặt trong 2025                               |    215.658,92 USD |
| Dòng POS xuất lặp dư                | Toàn tệp POS năm 2025                             |           12 dòng |
| Bút toán tay                        | GL năm 2025, `journal_type = MANUAL`              |       15 bút toán |
| Tác động doanh thu của bút toán tay | Gồm vận chuyển, chuyển kênh và khoản chưa phân bổ |    +96.016,95 USD |

Tỷ lệ trả tháng 7 là 4,2020%, tháng 11 là 3,1816%. Số đơn hủy từ tháng 1 đến tháng 12 lần lượt: 8, 14, 5, 7, 13, 8, 9, 9, 6, 18, 13, 14.

Không trộn các cơ sở FX: GL ghi giao hàng 15.766.167,26 USD và trả hàng −349.066,23 USD theo tỷ giá cuối tháng; các số này không phải tử và mẫu của tỷ lệ trả nêu trên. Toàn tệp WEB có 9.441 đơn ở nhiều kỳ, gồm 139 đơn hủy và 181 đơn trả; các tổng trạng thái toàn tệp không thay thế số sự kiện trong FY2025.

## 4. QC đọc từ Excel và phần xử lý sẽ tách riêng

`QC_Summary` hiện có **15 dòng trạng thái Pass** ở phần kiểm tra cơ bản. Nhiều kiểm tra chi tiết còn trống kết quả, giá trị kỳ vọng, số lỗi hoặc trạng thái. Giữ nguyên các giá trị thiếu và hiển thị rõ nguồn Excel; không đổi ô trống thành 0 lỗi hoặc Pass. Kết quả QC này thuộc phạm vi tệp nguồn, không được diễn giải thành bộ kiểm tra đã chạy lại riêng cho tháng hoặc kênh đang lọc.

PDF trang 18, 40 và 46 phân biệt 32/32 kiểm tra tham chiếu với 3/7 kiểm tra nghiệp vụ có ngoại lệ. Không lấy các con số trong báo cáo để lấp dữ liệu chưa điền của `QC_Summary` hiện tại. PDF trang 40 nêu bốn kiểm tra: đơn hủy có ngày giao, giao trước ngày đặt, trả trước ngày giao và POS sau ngày đóng cửa. Báo cáo chưa cung cấp đủ định nghĩa máy đọc cho toàn bộ bảy phép để tự nhận đã tái hiện đúng bộ kiểm tra đó.

Phần chất lượng dữ liệu độc lập được **để cho bước sau**: danh mục quy tắc có phiên bản, điều kiện đầu vào, phạm vi chạy trước bộ lọc hiển thị, kết quả Pass/Fail/chưa cấu hình/chưa chạy và bằng chứng từng lỗi. Đây là hướng theo PDF trang 40, 46–51; chưa được tuyên bố đã triển khai bởi chế độ đọc Excel này.

Giữ hai ngưỡng khác nhau rõ ràng: adapter tham chiếu cũ vẫn dùng dung sai **0,01 USD** cho kiểm tra workbook; PDF trang 14 khuyến nghị kiểm tra cầu nối **≤1 USD** và làm tròn **<5 USD/tháng**. Việc hiển thị đủ bốn dashboard không tự thay đổi ngưỡng cũ hoặc nâng trạng thái kiểm tra thành đạt.

Bút toán ADJ-0925 1.250 USD vẫn thuộc `UNALLOCATED`. Có `source_ref` chỉ giúp truy vết, không chứng minh chứng từ, mục đích, phân bổ và phê duyệt đã đầy đủ; xem PDF trang 40.
