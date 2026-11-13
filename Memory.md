# Báo cáo đối soát doanh thu

**Chương trình:** AI VIET NAM – eDA Conquer 2026  
**Nhóm thực hiện:** eDA_Sale, We Analyze  
**Thành viên:** Lê Thị Thanh Uyên, Huỳnh Lê Đình Trung và Phạm Trọng Quý

## Ghi chú chuyển đổi

Bản Markdown được chuyển từ tài liệu PDF 50 trang “Báo cáo đối soát doanh thu”. Nội dung báo cáo, số liệu, định danh kỹ thuật, các quy ước dấu và những chỗ còn để trống được giữ theo bản gốc. Đây là bản chuyển định dạng, không phải bản hiệu đính hay bản tóm tắt.

- Các bảng được dựng lại dưới dạng bảng Markdown; công thức được viết thành biểu thức văn bản để AI dễ đọc.
- Các biểu đồ được thay bằng mô tả, tham chiếu bảng số liệu và các nhãn số có thể đọc trực tiếp trong hình; không suy đoán dữ liệu không ghi nhãn.
- Mục lục chấm và đầu/chân trang lặp được lược bỏ. Các chú thích `Trang PDF` giúp đối chiếu với tài liệu nguồn.
- Những chỗ như `[Điền]`, `[CẦN XÁC NHẬN]` và hướng dẫn trong ngoặc vuông là nội dung có sẵn trong PDF, không được tự điền thêm.

## Mục lục

- [Mục A. Bối cảnh và phương pháp](#muc-a)
- [I. Tóm tắt báo cáo](#muc-i)
- [II. Bối cảnh, mục tiêu và phạm vi](#muc-ii)
- [III. Câu hỏi phân tích](#muc-iii)
- [Mục B. Dữ liệu và kết quả đối soát](#muc-b)
- [IV. Nguồn dữ liệu và phạm vi](#muc-iv)
- [V. Cấu trúc dữ liệu và quy tắc ghi nhận](#muc-v)
- [VI. Làm sạch dữ liệu](#muc-vi)
- [VII. Chuyển đổi và tích hợp dữ liệu](#muc-vii)
- [VIII. Kiểm tra chất lượng dữ liệu](#muc-viii)
- [IX. Định nghĩa các chỉ số](#muc-ix)
- [X. Phân tích chính](#muc-x)
- [XI. Phát hiện chính và hàm ý](#muc-xi)
- [XII. Khuyến nghị cải thiện quy trình](#muc-xii)
- [XIII. Hạn chế và bước tiếp theo](#muc-xiii)
- [XIV. Tài liệu tham khảo và Phụ lục](#muc-xiv)

<!-- Trang PDF: 3 -->

<a id="muc-a"></a>

## Mục A. Bối cảnh và phương pháp

<a id="muc-i"></a>

### I. Tóm tắt báo cáo

[Tóm tắt mục tiêu, kỳ báo cáo, chênh lệch chính, nguyên nhân có bằng chứng và hành động ưu tiên. Viết phần này sau khi hoàn tất phân tích.]

<a id="muc-ii"></a>

### II. Bối cảnh, mục tiêu và phạm vi

#### 1. Bối cảnh và vấn đề kinh doanh

Nexa Home là doanh nghiệp bán lẻ đồ gia dụng và điện tử, vận hành 57 cửa hàng tại 8 quốc gia cùng một kênh bán hàng trực tuyến. Với mô hình kinh doanh đa quốc gia và đa kênh, doanh thu được ghi nhận và tổng hợp bởi nhiều hệ thống phục vụ những mục đích khác nhau.

Vào đầu tháng 01/2026, bộ phận Kinh doanh (Sales) công bố doanh số năm tài chính đạt 31.124.401 USD thông qua báo cáo Sales Flash. Trong khi đó, bộ phận Tài chính (Finance) ghi nhận doanh thu trên sổ cái (General Ledger – GL) là 28.698.496,23 USD.

Sự khác biệt giữa hai nguồn tạo ra khoản chênh lệch 2.425.904,77 USD, tương đương khoảng 7,79% doanh số Sales Flash.

Tuy nhiên, chênh lệch này không nhất thiết phản ánh sai sót trong dữ liệu. Sales Flash và Finance GL có thể áp dụng những quy tắc khác nhau về thời điểm ghi nhận, giá trị doanh thu, phạm vi giao dịch và tỷ giá quy đổi.

Vấn đề đặt ra là xác định mức độ chênh lệch, giải thích các nguyên nhân hình thành và phân biệt những khác biệt hợp lệ về quy tắc ghi nhận với các lỗi dữ liệu thực sự cần khắc phục.

Việc thiếu một quy trình đối soát thống nhất có thể làm giảm tính nhất quán giữa báo cáo quản trị hay báo cáo tài chính, đồng thời gây khó khăn trong việc phát hiện và xử lý các sai lệch trước khi khóa sổ.

#### 2. Mục tiêu phân tích

Dự án hướng đến việc xây dựng một quy trình phân tích và đối soát doanh thu đa nguồn nhằm làm rõ sự khác biệt giữa Sales Flash và Finance GL trong năm tài chính 2025.

Các mục tiêu chính bao gồm

- Lượng hóa chênh lệch doanh thu. Xác định tổng giá trị và tỷ lệ chênh lệch giữa Sales Flash và Finance GL theo tháng và kênh bán hàng.

- Xác định và phân loại nguyên nhân. Phân tích và lượng hóa các nguyên nhân gây chênh lệch, phân biệt giữa khác biệt do quy tắc ghi nhận, lỗi dữ liệu, sai số chấp nhận được và các khoản chưa được giải thích.

<!-- Trang PDF: 4 -->

- Cải thiện kiểm soát đối soát. Đề xuất các biện pháp kiểm soát và cải thiện quy trình đối soát nhằm nâng cao tính chính xác, nhất quán và khả năng phát hiện sai lệch trong những kỳ tiếp theo.

<a id="muc-iii"></a>

### III. Câu hỏi phân tích

Để đạt được các mục tiêu trên, dự án tập trung trả lời ba câu hỏi phân tích.

#### 1. Phân tích chênh lệch doanh thu

Sales Flash và Finance GL chênh lệch bao nhiêu về giá trị và tỷ lệ phần trăm theo từng tháng và từng kênh bán hàng trong năm tài chính 2025?

#### 2. Phân rã chênh lệch và nguyên nhân gốc

Những khoản nào tạo nên chênh lệch giữa Sales Flash và Finance GL? Mức đóng góp của từng nguyên nhân là bao nhiêu và khoản nào được xác định là lỗi dữ liệu cần xử lý?

#### 3. Cải thiện quy trình đối soát

Dựa trên những nguyên nhân đã xác định, cần cải thiện những bước nào trong quy trình ghi nhận, kiểm tra và đối soát để nâng cao hiệu quả và độ tin cậy của các kỳ báo cáo tiếp theo?

<!-- Trang PDF: 5 -->

<a id="muc-b"></a>

## Mục B. Dữ liệu và kết quả đối soát

<a id="muc-iv"></a>

### IV. Nguồn dữ liệu và phạm vi

#### 1. Nguồn gốc và bối cảnh dữ liệu

Bộ dữ liệu được sử dụng trong dự án là một tập hợp các dữ liệu trong Nexa Home Dataset, một bộ dữ liệu giả lập được xây dựng dựa trên Contoso Data Generator V2 nhằm mô phỏng hoạt động bán hàng và ghi nhận doanh thu từ nhiều hệ thống nghiệp vụ.

Phạm vi đối soát chính tập trung vào năm tài chính 2025 (FY2025), từ ngày 01/01/2025 đến ngày 31/12/2025. Tuy nhiên, dữ liệu giao dịch còn bao gồm các thời điểm nằm ngoài năm tài chính này, trong đó bảng Calendar và các bảng tỉ giá được cung cấp cho giai đoạn từ tháng 12/2024 đến tháng 01/2026. Phạm vi mở rộng như thế nhằm hỗ trợ xác định những giao dịch phát sinh và được ghi nhận ở các kỳ kế toán khác nhau.

Bộ dữ liệu bao gồm bốn nguồn nghiệp vụ chính: POS Sales, WEB Orders, Finance General Ledger và Sales Flash; cùng bốn bảng tham chiếu: Store Master, Calendar, FX Daily và FX Month End.

Các nguồn dữ liệu có mức độ chi tiết, cấu trúc và quy ước ghi nhận khác nhau. Vì vậy, việc xác định chính xác đặc điểm của từng nguồn là điều kiện cần thiết trước khi thực hiện các bước chuẩn bị và đối soát doanh thu.

Thông tin về quy mô, vai trò và đặc điểm của từng nguồn được trình bày trong các mục tiếp theo.

#### 2. Các nguồn dữ liệu nghiệp vụ

Dự án sử dụng bốn nguồn dữ liệu nghiệp vụ chính, đại diện cho hoạt động bán hàng tại cửa hàng, bán hàng trực tuyến, ghi nhận kế toán và báo cáo doanh số tổng hợp. Các nguồn dữ liệu được cung cấp dưới định dạng CSV và Excel, với tổng cộng 33.661 dòng dữ liệu gốc.

<a id="bang-1"></a>

**Bảng 1. Tổng quan các nguồn dữ liệu chính**

| Bộ dữ liệu                  | Quy mô gốc                | Vai trò trong phân tích                                                                                                      |
| --------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| POS Sales                   | 17.124 dòng hàng          | Ghi nhận hoạt động bán hàng tại cửa hàng, cung cấp thông tin hóa đơn, sản phẩm, số lượng, giá bán và chiết khấu.             |
| WEB Orders                  | 9.441 đơn hàng            | Ghi nhận hoạt động bán hàng trực tuyến, bao gồm trạng thái đơn hàng, giá trị giao dịch và các thời điểm đặt, giao, trả hàng. |
| Finance General Ledger (GL) | 6.940 bút toán            | Lưu trữ doanh thu và các khoản điều chỉnh đã được hạch toán, đóng vai trò nguồn chuẩn để đối chiếu doanh thu kế toán.        |
| Sales Flash                 | 156 dòng báo cáo chi tiết | Tổng hợp doanh số nhanh theo tháng, kênh bán hàng và thị trường, làm cơ sở so sánh với Finance GL.                           |

_Nguồn: Tổng hợp từ `POS_Sales_Export_2025.csv`, `WEB_Orders_Export.csv`, `Finance_GL_Revenue_FY2025.xlsx` và `Sales_Flash_Report_2025.xlsx`._

<!-- Trang PDF: 6 -->

Trong đó, POS Sales và WEB Orders cung cấp dữ liệu về các giao dịch phát sinh từ hoạt động kinh doanh. Finance GL phản ánh kết quả ghi nhận trên sổ kế toán, bao gồm cả những bút toán điều chỉnh liên quan đến doanh thu. Trong khi đó, Sales Flash là nguồn báo cáo tổng hợp được bộ phận Kinh doanh sử dụng để theo dõi doanh số.

#### 3. Các bảng dữ liệu tham chiếu

Bên cạnh bốn nguồn dữ liệu nghiệp vụ chính, dự án sử dụng bốn bảng tham chiếu (Reference Data) nhằm hỗ trợ chuẩn hóa định danh, thời gian và tỷ giá quy đổi.

<a id="bang-2"></a>

**Bảng 2. Các bảng dữ liệu tham chiếu**

| Bảng tham chiếu | Quy mô dữ liệu gốc | Vai trò                                                                                                                  |
| --------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `Store_Master`  | 74 dòng            | Cung cấp thông tin định danh cửa hàng, quốc gia, loại tiền tệ và ánh xạ giữa mã cửa hàng POS với mã cửa hàng Finance.    |
| Calendar        | 427 dòng           | Cung cấp thông tin lịch, kỳ báo cáo và ngày làm việc, hỗ trợ xác định thời điểm ghi nhận giao dịch.                      |
| `FX_Daily`      | 2.135 dòng         | Cung cấp tỷ giá theo ngày và loại tiền tệ, phục vụ quy đổi giá trị giao dịch sang USD theo tỷ giá ngày.                  |
| `FX_Month_End`  | 70 dòng            | Cung cấp tỷ giá cuối tháng theo từng loại tiền tệ, phục vụ chuẩn hóa và đối chiếu với giá trị doanh thu trên Finance GL. |

_Nguồn: `Nexa_Home_Master_Data.xlsx`_

`Store_Master` là bảng chứa 74 dòng mã điểm bán.

Calendar bao phủ giai đoạn từ ngày 01/12/2024 đến ngày 31/01/2026.

`FX_Daily` và `FX_Month_End` cung cấp hai loại tỷ giá được sử dụng trong dự án: AUD, CAD, EUR, GBP và USD.

Việc sử dụng các bảng tham chiếu giúp thiết lập cơ sở dữ liệu thống nhất để thực các bước Data Transformation và Reconciliation trong những giai đoạn tiếp theo.

#### 4. Phạm vi và đặc điểm giới hạn của dữ liệu nguồn

Phạm vi phân tích của dự án được giới hạn trong dữ liệu doanh số và doanh thu liên quan đến năm tài chính 2025, bao gồm hoạt động kinh doanh tại cửa hàng và trên website của Nexa Home.

Mặc dù bộ dữ liệu cung cấp thông tin từ nhiều nguồn nghiệp vụ, một số đặc điểm cần được xem xét khi sử dụng dữ liệu cho phân tích:

Thứ nhất, dữ liệu mang tính chất mô phỏng. Bộ dữ liệu được xây dựng phục vụ mục đích học tập và thực hành đối soát, không phản ánh trực tiếp hoạt động tài chính thực tế của một doanh nghiệp. Do đó, các kết quả phân tích chỉ được diễn giải trong phạm vi tình huống Nexa Home.

Thứ hai, các nguồn dữ liệu có mức độ chi tiết không đồng nhất. POS ghi nhận từng dòng hàng trong hóa đơn, WEB ghi nhận theo đơn hàng, GL theo bút toán kế toán và Flash

<!-- Trang PDF: 7 -->

theo các nhóm tổng hợp định kỳ. Sự khác biệt này yêu cầu dữ liệu được đưa về mức tổng hợp phù hợp trước khi thực hiện so sánh.

Thứ ba, phạm vi thời gian ghi nhận không hoàn toàn trùng khớp. Một số đơn hàng được đặt trong năm 2024 nhưng có thể được giao trong năm 2025; tương tự, đơn hàng đặt cuối năm 2025 có thể được giao hoặc trả vào năm 2026. Vì vậy, việc lựa chọn cột ngày và kỳ kế toán có thể ảnh hưởng trực tiếp đến kết quả đối soát.

Thứ tư, dữ liệu sử dụng nhiều loại tiền tệ và cách quy đổi khác nhau. Những nguồn giao dịch chứa giá trị nguyên tệ, trong khi báo cáo tổng hợp và Finance GL sử dụng USD theo các quy ước tỷ giá riêng. Vì thế, giá trị từ các nguồn không thể được cộng hoặc đối chiếu trực tiếp nếu chưa thống nhất đơn vị tiền tệ và làm rõ phương pháp quy đổi

Ngoài ra, Sales Flash tổng hợp doanh số theo các khu vực thị trường, trong đó có những nhóm như Eurozone không tương ứng trực tiếp với một quốc gia riêng lẻ. Điều này cần được xem xét khi thực hiện phân tích hoặc so sánh doanh thu theo quốc gia.

Những đặc điểm trên được xem là các điều kiện của nguồn dữ liệu cần tính đến trong quá trình chuẩn bị và phân tích, thay vì mặc định là lỗi dữ liệu.

Các vấn đề về chất lượng, tính hợp lệ và mức độ đầy đủ sẽ được đánh giá chi tiết trong phần Data Cleaning và Data Quality Validation.

<a id="muc-v"></a>

### V. Cấu trúc dữ liệu và quy tắc ghi nhận

Các hệ thống ghi nhận dữ liệu ở những cấp độ khác nhau. Trước khi nối hoặc đối chiếu, cần xác định ý nghĩa của một dòng, khóa duy nhất và thời điểm ghi nhận ở từng nguồn. Finance GL là nguồn chuẩn kế toán đã khóa sổ; Sales Flash là nguồn doanh số nhanh để tính chênh lệch.

#### 1. Các bảng dữ liệu và mức chi tiết của từng bảng

<a id="bang-3"></a>

**Bảng 3. Tổng quan các bảng dữ liệu của dự án**

| Bảng           | Loại                 | Số dòng | Một dòng biểu diễn                       | Khóa định danh                                  |
| -------------- | -------------------- | ------- | ---------------------------------------- | ----------------------------------------------- |
| `Finance_GL`   | Sổ kế toán / sự kiện | 6.940   | Một bút toán doanh thu hoặc điều chỉnh   | `journal_id`                                    |
| `POS_Sales`    | Giao dịch chi tiết   | 17.124  | Một dòng hàng trên hóa đơn POS           | `receipt_no` + `line_no` (trước xử lý có trùng) |
| `WEB_Orders`   | Giao dịch đơn hàng   | 9.441   | Một đơn đặt hàng trực tuyến              | `web_order_id`                                  |
| `Sales_Flash`  | Tổng hợp định kỳ     | 156     | Một tháng × kênh × thị trường            | Tháng + Kênh + Thị trường                       |
| `Store_Master` | Tham chiếu           | 74      | Một mã cửa hàng POS / giai đoạn điểm bán | `pos_store_id`                                  |
| Calendar       | Tham chiếu thời gian | 427     | Một ngày dương lịch                      | date                                            |

<!-- Trang PDF: 8 -->

**Bảng 3 (tiếp)**

| Bảng           | Loại              | Số dòng | Một dòng biểu diễn    | Khóa định danh         |
| -------------- | ----------------- | ------- | --------------------- | ---------------------- |
| `Fx_daily`     | Tham chiếu tỷ giá | 2.135   | Một ngày × đồng tiền  | `rate_date` + currency |
| `Fx_month_end` | Tham chiếu tỷ giá | 70      | Một tháng × đồng tiền | period + currency      |

_Nguồn: Tổng hợp từ `Finance_GL_Revenue_FY2025.xlsx`, `POS_Sales_Export_2025.csv`, `WEB_Orders_Export.csv`, `Sales_Flash_Report_2025.xlsx` và `Nexa_Home_Master_Data.xlsx`._

Các bảng giao dịch giữ thông tin phát sinh theo đơn hoặc theo dòng; Finance GL giữ kết quả ghi nhận kế toán; Sales Flash là bảng tổng hợp phục vụ theo dõi nhanh, không chứa hóa đơn hoặc mã đơn. Các bảng tham chiếu được nối vào để chuẩn hóa định danh, thời gian và tỷ giá.

##### Loại bảng theo cách ghi nhận dữ liệu

Có bốn cách ghi nhận dữ liệu trong dự án: (i) giao dịch chi tiết, gồm POS Sales và WEB Orders; (ii) sổ kế toán, gồm Finance GL; (iii) báo cáo tổng hợp định kỳ, là Sales Flash; (iv) bảng tham chiếu, gồm Store Master, Calendar và hai bảng tỷ giá. Trong đó GL là nguồn số chuẩn đã khóa sổ, còn Flash là cơ sở để tính chênh lệch báo cáo nhanh.

##### Bảng `Finance_GL`

Bảng có 6.940 dòng và 13 cột; một dòng là một bút toán sổ cái. `journal_id` không trùng trong dữ liệu đã cung cấp. Sổ cái ghi nhận doanh thu theo `posting_date` và period, không nhất thiết theo ngày khách đặt hoặc mua hàng.

<a id="bang-4"></a>

**Bảng 4. Danh sách trường dữ liệu `Finance_GL`**

| Cột            | Kiểu    | Ô trống | Ý nghĩa / quy ước                                                  |
| -------------- | ------- | ------- | ------------------------------------------------------------------ |
| `journal_id`   | Chuỗi   | 0       | Mã bút toán; khóa chính và mã truy vết sang chứng từ.              |
| `posting_date` | Ngày    | 0       | Ngày ghi sổ; dùng đối chiếu theo ngày hạch toán.                   |
| period         | YYYY-MM | 0       | Kỳ kế toán; dùng khi cộng theo tháng và kiểm tra ngày ghi sổ.      |
| account        | Chuỗi   | 0       | Tài khoản 5111 (doanh thu) hoặc 5213 (hàng trả).                   |
| `journal_type` | Nhóm    | 0       | `POS_DAILY`, `WEB_DELIVERY`, `WEB_RETURN`, MANUAL, `POS_CATCHUP`.  |
| `store_code`   | Chuỗi   | 1       | Mã NX… cho cửa hàng; WEB cho online; trống với khoản chưa phân bổ. |
| channel        | Nhóm    | 0       | STORE, WEB hoặc UNALLOCATED; không bỏ nhóm thứ ba.                 |

<!-- Trang PDF: 9 -->

**Bảng 4 (tiếp)**

| Cột                 | Kiểu  | Ô trống | Ý nghĩa / quy ước                                               |
| ------------------- | ----- | ------- | --------------------------------------------------------------- |
| currency            | Chuỗi | 0       | Nguyên tệ: AUD, CAD, EUR, GBP hoặc USD.                         |
| `amount_local`      | Số    | 0       | Số tiền theo nguyên tệ và dấu kế toán gốc.                      |
| `fx_rate_month_end` | Số    | 0       | Tỷ giá chốt tháng, là số đơn vị nguyên tệ / 1 USD.              |
| `amount_usd`        | Số    | 0       | Số tiền USD theo dấu sổ cái; doanh thu báo cáo = −`amount_usd`. |
| description         | Chuỗi | 0       | Diễn giải bút toán, phục vụ truy vết ngoại lệ.                  |
| `source_ref`        | Chuỗi | 6.925   | Mã chứng từ: thường trống ở dòng hệ thống, có ở bút toán tay.   |

_Nguồn: `Finance_GL_Revenue_FY2025.xlsx`, sheet `GL_Revenue`._

<a id="bang-5"></a>

**Bảng 5. Phân loại bút toán trong `Finance_GL`**

| `journal_type` | Số dòng | Cách hiểu khi đối soát                                         |
| -------------- | ------- | -------------------------------------------------------------- |
| `POS_DAILY`    | 5.118   | Doanh thu cửa hàng theo ngày hạch toán.                        |
| `WEB_DELIVERY` | 1.647   | Doanh thu online theo ngày giao hàng.                          |
| `WEB_RETURN`   | 159     | Ghi giảm doanh thu khi nhận trả hàng.                          |
| MANUAL         | 15      | Điều chỉnh bằng tay; phân loại bằng diễn giải và `source_ref`. |
| `POS_CATCHUP`  | 1       | Bút toán bổ sung POS còn thiếu, cửa hàng NX057.                |

_Nguồn: `Finance_GL_Revenue_FY2025.xlsx`, sheet `GL_Revenue`._

Một số điều rút ra từ bảng: bút toán JE20251206231 thuộc `POS_CATCHUP`, ghi ngày 02/12/2025, số tiền `amount_usd` = −7.227,56 USD; diễn giải ghi bổ sung doanh thu POS của ngày 21/11/2025. Như vậy, tháng bán và tháng hạch toán có thể khác nhau. Một dòng MANUAL tháng 09/2025 với `source_ref` MJ-ADJ-2509 và mô tả ADJ-0925 có channel = UNALLOCATED, tương ứng khoản 1.250 USD cần giải thích.

DẤU DOANH THU. Finance GL ghi doanh thu thông thường bằng số âm; hàng trả bằng số dương. Tạo chỉ tiêu `revenue_usd` = −`amount_usd` cho tất cả các bút toán, không loại tài khoản 5213 hoặc dòng UNALLOCATED. Tổng `revenue_usd` năm 2025 là 28.698.496,23 USD.

##### Bảng `POS_Sales`

Bảng có 17.124 dòng, 11 cột, 7.130 mã `receipt_no` và 57 mã `store_id` xuất hiện. Một dòng là một mặt hàng của một hóa đơn bán tại cửa hàng, không phải một hóa đơn đầy đủ. Dữ liệu thô có 12 khóa (`receipt_no`, `line_no`) bị lặp thêm một lần; chỉ sau khi phát hiện và xử lý trùng mới có thể dùng cặp cột này làm khóa logic.

<!-- Trang PDF: 10 -->

<a id="bang-6"></a>

**Bảng 6. Danh sách trường dữ liệu `POS_Sales`**

| Cột               | Kiểu      | Ô trống | Ý nghĩa / quy ước                                                        |
| ----------------- | --------- | ------- | ------------------------------------------------------------------------ |
| `receipt_no`      | Chuỗi     | 0       | Mã hóa đơn; một hóa đơn có thể có nhiều dòng hàng.                       |
| `line_no`         | Số/chuỗi  | 0       | Số thứ tự dòng trên hóa đơn; khóa logic cùng `receipt_no` sau khử trùng. |
| `business_date`   | Ngày      | 0       | Ngày phát sinh bán hàng ở POS; không luôn trùng `GL.posting_date`.       |
| `store_id`        | Mã        | 0       | Mã POS; nối sang `Store_Master.pos_store_id` trước khi tìm mã NX.        |
| `product_id`      | Mã        | 0       | Mã sản phẩm trên dòng bán.                                               |
| qty               | Số        | 0       | Số lượng sản phẩm ở dòng.                                                |
| `unit_price`      | Số        | 0       | Đơn giá trước phần chiết khấu dòng.                                      |
| `discount_amount` | Số        | 0       | Khoản giảm giá của dòng, theo nguyên tệ.                                 |
| `line_amount`     | Số        | 0       | Thành tiền trước chiết khấu, theo nguyên tệ.                             |
| currency          | Chuỗi     | 0       | Đồng tiền thanh toán tại cửa hàng.                                       |
| `exported_at`     | Thời gian | 0       | Mốc hệ thống xuất dữ liệu POS; không phải ngày bán.                      |

_Nguồn: `POS_Sales_Export_2025.csv`._

<a id="bang-7"></a>

**Bảng 7. Ví dụ hai dòng hàng thuộc cùng một hóa đơn POS**

| `receipt_no` | `line_no` | `store_id` | qty | `unit_price` | `discount_amount` | `line_amount` |
| ------------ | --------- | ---------- | --- | ------------ | ----------------- | ------------- |
| R3289009     | 1         | 50         | 1   | 65,37        | 7,85              | 65,37         |
| R3289009     | 2         | 50         | 2   | 469,72       | 0                 | 939,44        |

_Nguồn: `POS_Sales_Export_2025.csv` (hóa đơn R3289009)._

Hai dòng đều thuộc hóa đơn R3289009 và ngày bán 01/01/2025, nhưng biểu diễn hai mặt hàng khác nhau. Tổng hóa đơn phải cộng theo dòng sau khi xử lý bản ghi trùng. Trong phạm vi đối soát, giá trị sau chiết khấu của một dòng được xác định bằng `line_amount` − `discount_amount`; trước khi so với GL còn phải chuẩn hóa mã cửa hàng, ngày và tỷ giá.

##### Bảng `WEB_Orders`

Bảng có 9.441 dòng và 10 cột; một dòng là một đơn online, định danh bằng `web_order_id` (không trùng). Có 9.121 đơn Delivered, 139 đơn Cancelled và 181 đơn Returned. Ngày đặt hàng có thể nằm từ 12/2024; ngày giao hoặc trả có thể nằm trong 01/2026, vì vậy không lọc toàn bộ dữ liệu chỉ bằng năm của `order_date`.

<!-- Trang PDF: 11 -->

<a id="bang-8"></a>

**Bảng 8. Danh sách trường dữ liệu `WEB_Orders`**

| Cột               | Kiểu  | Ô trống | Ý nghĩa / quy ước                                                 |
| ----------------- | ----- | ------- | ----------------------------------------------------------------- |
| `web_order_id`    | Chuỗi | 0       | Mã đơn online; khóa định danh mỗi dòng.                           |
| `order_date`      | Ngày  | 0       | Ngày khách đặt; là cơ sở kỳ Flash của đơn online.                 |
| `delivery_date`   | Ngày  | 139     | Ngày giao hàng; không có với đơn hủy, dùng khi ghi doanh thu.     |
| `order_status`    | Nhóm  | 0       | Delivered / Cancelled / Returned; quyết định xử lý ghi nhận.      |
| `return_date`     | Ngày  | 9.260   | Ngày hàng được trả; có với đơn Returned, còn lại để trống hợp lệ. |
| currency          | Chuỗi | 0       | Đồng tiền của đơn; không cộng nguyên tệ từ nhiều đồng tiền.       |
| `items_qty`       | Số    | 0       | Tổng số lượng hàng trong đơn.                                     |
| `gross_amount`    | Số    | 0       | Giá trị trước chiết khấu, theo nguyên tệ.                         |
| `discount_amount` | Số    | 0       | Tổng giảm giá của đơn, theo nguyên tệ.                            |
| `net_amount`      | Số    | 0       | Giá trị sau giảm giá; còn cần xử lý hủy, trả, kỳ ghi nhận.        |

_Nguồn: `WEB_Orders_Export.csv`._

<a id="bang-9"></a>

**Bảng 9. Ví dụ đơn hàng theo trạng thái trong `WEB_Orders`**

| Mã đơn   | Trạng thái | Ngày đặt   | Ngày giao  | Ngày trả   | `net_amount` (nguyên tệ) |
| -------- | ---------- | ---------- | ---------- | ---------- | ------------------------ |
| W3289048 | Delivered  | 01/01/2025 | 03/01/2025 | –          | 51,52 USD                |
| W3289066 | Returned   | 01/01/2025 | 07/01/2025 | 20/01/2025 | 541,08 USD               |
| W3290005 | Cancelled  | 02/01/2025 | –          | –          | 209,53 EUR               |

_Nguồn: `WEB_Orders_Export.csv`._

Đơn Cancelled vẫn có số tiền trong tệp đơn hàng, nhưng không được tự động coi là doanh thu GL. Đơn Returned đã giao có thể tạo ghi nhận doanh thu ở ngày giao và bút toán giảm doanh thu ở ngày trả, tức cùng một đơn có tác động tới nhiều kỳ. Không thể nối từng `web_order_id` trực tiếp sang `journal_id` vì GL đã được tổng hợp thành bút toán theo ngày và tiền tệ.

##### Bảng `Sales_Flash`

Báo cáo gồm 156 dòng chi tiết và một dòng TỔNG CỘNG; phần chi tiết có 12 tháng × 13 tổ hợp kênh – thị trường mỗi tháng. Một dòng mô tả tổng doanh số nhanh theo tháng, kênh và thị trường; không có mã hóa đơn hay mã đơn. Thông tin đầu file ghi báo cáo theo ngày đặt hàng, quy đổi USD theo tỷ giá ngày giao dịch và làm tròn đến USD.

<!-- Trang PDF: 12 -->

<a id="bang-10"></a>

**Bảng 10. Danh sách trường dữ liệu `Sales_Flash`**

| Cột            | Kiểu      | Ô trống | Ý nghĩa / quy ước                                                 |
| -------------- | --------- | ------- | ----------------------------------------------------------------- |
| Tháng          | YYYY-MM   | 0       | Tháng báo cáo, từ 2025-01 đến 2025-12.                            |
| Kênh           | Nhóm      | 0       | Cửa hàng / Online; cần ánh xạ thành STORE / WEB khi so GL.        |
| Thị trường     | Chuỗi     | 0       | Vùng báo cáo (ví dụ Eurozone), không luôn đồng nhất một quốc gia. |
| Số đơn         | Số nguyên | 0       | Số đơn theo quy tắc tổng hợp của Flash, không phải số dòng POS.   |
| Doanh số (USD) | Số nguyên | 0       | Doanh số báo cáo nhanh USD đã làm tròn đến đơn vị.                |

_Nguồn: `Sales_Flash_Report_2025.xlsx`, sheet Flash._

<a id="bang-11"></a>

**Bảng 11. Minh họa doanh số `Sales_Flash` tháng 01 và cả năm 2025**

| Tháng / mức tổng | Kênh        | Thị trường | Số đơn | Doanh số (USD) |
| ---------------- | ----------- | ---------- | ------ | -------------- |
| 2025-01          | Cửa hàng    | Australia  | 47     | 108.469        |
| Toàn năm         | Cửa hàng    | Tất cả     | —      | 14.060.500     |
| Toàn năm         | Online      | Tất cả     | —      | 17.063.901     |
| Toàn năm         | Cả hai kênh | Tất cả     | 15.709 | 31.124.401     |

_Nguồn: `Sales_Flash_Report_2025.xlsx`, sheet Flash._

Flash có tám thị trường của kênh cửa hàng (Australia, Canada, France, Germany, Italy, Netherlands, United Kingdom, United States) và năm thị trường online (Australia, Canada, Eurozone, United Kingdom, United States). Eurozone gộp thị trường, nên cần bảng ánh xạ riêng nếu muốn so sánh theo quốc gia. Khóa tổ hợp (Tháng, Kênh, Thị trường) có 156 giá trị khác nhau trong bản chi tiết; không tính dòng TỔNG CỘNG là bản ghi kinh doanh.

##### Các bảng tham chiếu (Dimension / Dim)

##### `Store_Master`

Có 74 dòng và 8 cột. Một dòng là một mã định danh điểm bán trong POS. Toàn bảng có 74 `pos_store_id` khác nhau nhưng chỉ 67 `finance_store_code` khác nhau: sáu mã NX003, NX007, NX025, NX046, NX058, NX060 gắn với nhiều mã POS qua các giai đoạn. Vì vậy `finance_store_code` không phải khóa duy nhất của bảng.

<!-- Trang PDF: 13 -->

<a id="bang-12"></a>

**Bảng 12. Danh sách trường dữ liệu `Store_Master`**

| Cột                  | Kiểu  | Ô trống | Ý nghĩa / quy ước                                                    |
| -------------------- | ----- | ------- | -------------------------------------------------------------------- |
| `pos_store_id`       | Mã    | 0       | Khóa duy nhất của bảng; nối tới `POS.store_id`.                      |
| `finance_store_code` | Mã    | 0       | Mã cửa hàng kế toán NX…; có thể lặp do tái cấu trúc.                 |
| country              | Chuỗi | 0       | Quốc gia của điểm bán.                                               |
| state                | Chuỗi | 0       | Bang / vùng của điểm bán.                                            |
| currency             | Chuỗi | 0       | Đồng tiền gắn với điểm bán.                                          |
| `open_date`          | Ngày  | 0       | Ngày bắt đầu giai đoạn hoạt động của mã POS.                         |
| `close_date`         | Ngày  | 58      | Ngày đóng mã POS, trống khi chưa có ngày kết thúc.                   |
| status               | Chuỗi | 59      | Trạng thái như Closed / Restructured; trống ở đa số mã đang sử dụng. |

_Nguồn: `Nexa_Home_Master_Data.xlsx`, sheet `store_master`._

Ví dụ: `finance_store_code` = NX007 xuất hiện ở ba mã POS 70, 72 và 74, ứng với các giai đoạn hoạt động khác nhau. Khi nối POS với `Store_Master` phải nối bằng `store_id` ↔ `pos_store_id`; khi phân tích theo mã NX thì gộp sau bước ánh xạ. Không lấy GL nối thẳng đến bảng `Store_Master` bằng `finance_store_code` rồi cộng doanh thu vì có thể nhân bản doanh thu trên các mã lặp.

##### Calendar

427 dòng và 6 cột; một dòng là một ngày. Khoảng ngày bao phủ từ 01/12/2024 đến 31/01/2026 để xử lý giao dịch rơi qua ranh giới hai năm. Calendar là bảng chuẩn hóa thời gian, không phải bảng giao dịch.

<a id="bang-13"></a>

**Bảng 13. Danh sách trường dữ liệu Calendar**

| Cột           | Kiểu    | Ô trống | Ý nghĩa / quy ước                                                    |
| ------------- | ------- | ------- | -------------------------------------------------------------------- |
| date          | Ngày    | 0       | Khóa ngày; dùng để đặt các vai trò ngày bán, đặt, giao, trả, ghi sổ. |
| year          | Số      | 0       | Năm dương lịch.                                                      |
| month         | Số      | 0       | Tháng trong năm (1–12).                                              |
| period        | YYYY-MM | 0       | Kỳ tháng để tổng hợp; không phải khóa duy nhất vì lặp theo ngày.     |
| `day_of_week` | Chuỗi   | 0       | Thứ trong tuần bằng tiếng Anh.                                       |
| `working_day` | 0/1     | 0       | Cờ ngày làm việc, theo lịch được cung cấp.                           |

_Nguồn: `Nexa_Home_Master_Data.xlsx`, sheet calendar._

Nếu phân tích nhiều thời điểm cùng lúc, sử dụng các vai trò ngày riêng hoặc xác định rõ quan hệ đang hoạt động: `POS.business_date`, `WEB.order_date`, `WEB.delivery_date`, `WEB.return_date`, `GL.posting_date`. Không nối 156 dòng Flash trực tiếp vào 427 dòng Calendar bằng period rồi SUM vì một tháng có nhiều ngày.

<!-- Trang PDF: 14 -->

##### `Fx_daily`

Có 2.135 dòng và ba cột, ứng với 427 ngày × năm đồng tiền. Một dòng là tỷ giá của một đồng tiền tại một ngày. Cặp (`rate_date`, currency) xuất hiện đúng một lần.

<a id="bang-14"></a>

**Bảng 14. Danh sách trường dữ liệu `Fx_daily`**

| Cột          | Kiểu  | Ô trống | Ý nghĩa / quy ước                                           |
| ------------ | ----- | ------- | ----------------------------------------------------------- |
| `rate_date`  | Ngày  | 0       | Ngày áp dụng tỷ giá; cùng ngày với giao dịch theo quy ước.  |
| currency     | Chuỗi | 0       | Đồng tiền nguyên tệ.                                        |
| `usd_to_ccy` | Số    | 0       | Số đơn vị nguyên tệ đổi được 1 USD; đổi USD bằng phép chia. |

_Nguồn: `Nexa_Home_Master_Data.xlsx`, sheet `fx_daily`._

##### `Fx_month_end`

Có 70 dòng và bốn cột, tương ứng 14 tháng (12/2024–01/2026) × năm đồng tiền. Cặp (period, currency) không trùng; dùng khi đối chiếu tỷ giá cuối kỳ mà GL sử dụng.

<a id="bang-15"></a>

**Bảng 15. Danh sách trường dữ liệu `Fx_month_end`**

| Cột          | Kiểu    | Ô trống | Ý nghĩa / quy ước                                    |
| ------------ | ------- | ------- | ---------------------------------------------------- |
| period       | YYYY-MM | 0       | Tháng dùng tỷ giá cuối kỳ; khóa tổ hợp với currency. |
| `rate_date`  | Ngày    | 0       | Ngày tham chiếu tỷ giá cuối tháng.                   |
| currency     | Chuỗi   | 0       | Đồng tiền của tỷ giá.                                |
| `usd_to_ccy` | Số      | 0       | Số đơn vị nguyên tệ / 1 USD vào cuối tháng.          |

_Nguồn: `Nexa_Home_Master_Data.xlsx`, sheet `fx_month_end`._

QUY TẮC TỶ GIÁ. Nếu số tiền là nguyên tệ, USD = `amount_local` ÷ `usd_to_ccy`. FX Daily dùng cho việc quy đổi theo ngày giao dịch; FX Month End dùng để đối chiếu số USD ghi nhận theo tỷ giá cuối tháng trong GL. Không chia `amount_usd` của GL thêm một lần nữa.

#### 2. Khóa chính và quan hệ giữa các bảng

##### Khóa định danh dòng của từng bảng

Khóa chính là một cột hoặc tổ hợp cột xác định duy nhất một dòng. Trong dữ liệu giao dịch có thể phân biệt “khóa logic sau làm sạch” và “khóa kỹ thuật của bản trích thô”: bản POS trước xử lý vẫn có 12 dòng trùng theo khóa logic. Bảng dưới đây là kết quả kiểm tra trên file được cung cấp, không phải chỉ dựa vào tên cột.

<!-- Trang PDF: 15 -->

<a id="bang-16"></a>

**Bảng 16. Kết quả kiểm tra tính duy nhất của khóa trên dữ liệu gốc**

| Bảng           | Khóa kiểm tra             | Dòng   | Giá trị khóa khác nhau | Kết luận                                |
| -------------- | ------------------------- | ------ | ---------------------- | --------------------------------------- |
| `Finance_GL`   | `journal_id`              | 6.940  | 6.940                  | Duy nhất.                               |
| `POS_Sales`    | `receipt_no` + `line_no`  | 17.124 | 17.112                 | 12 dòng trùng cần xử lý.                |
| `WEB_Orders`   | `web_order_id`            | 9.441  | 9.441                  | Duy nhất.                               |
| `Sales_Flash`  | Tháng + Kênh + Thị trường | 156    | 156                    | Duy nhất, trừ dòng tổng.                |
| `Store_Master` | `pos_store_id`            | 74     | 74                     | Duy nhất; mã NX không duy nhất (67 mã). |
| Calendar       | date                      | 427    | 427                    | Duy nhất.                               |
| `Fx_daily`     | `rate_date` + currency    | 2.135  | 2.135                  | Duy nhất.                               |
| `Fx_month_end` | period + currency         | 70     | 70                     | Duy nhất.                               |

Bản POS thô cần lưu được số dòng gốc và vị trí dòng trước khi loại trùng; nếu cần khóa kỹ thuật cho vùng staging, có thể tạo một mã thứ tự dòng tải vào. Mã này chỉ phục vụ truy vết bản trích, không thay khóa nghiệp vụ của hóa đơn. Không dùng riêng `receipt_no` để đếm số dòng hàng, không dùng riêng period để nối sang bảng tỷ giá.

##### Cột nối giữa các bảng

Một quan hệ chỉ an toàn khi bảng phía tham chiếu có đúng một dòng tương ứng với mỗi giá trị khóa ở phía chi tiết. Đối với dữ liệu dự án, còn phải đưa hai bên về cùng kỳ ghi nhận, mã thị trường và nguyên tệ trước khi so doanh số. Bảng 17 mô tả cách nối cần dùng khi làm Power Query hoặc mô hình Power BI.

<a id="bang-17"></a>

**Bảng 17. Khóa nối và điều kiện đối soát giữa các bảng**

| Nguồn / cột                         | Đích / cột                      | Quan hệ / cách dùng                     | Lưu ý bắt buộc                                                     |
| ----------------------------------- | ------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| `POS.store_id`                      | `Store_Master.pos_store_id`     | Nhiều POS : một mã POS trong Master     | Đồng nhất kiểu dữ liệu số/chuỗi; lấy `finance_store_code` sau nối. |
| `POS.business_date` + currency      | `Fx_daily.rate_date` + currency | Nhiều dòng POS : một tỷ giá ngày        | Quy đổi ở ngày bán và sau đó gộp theo mã NX / ngày / currency.     |
| `WEB.order_date` + currency         | `Fx_daily.rate_date` + currency | Nhiều đơn : một tỷ giá ngày             | Dùng cho cơ sở ngày đặt và bước giải thích chênh lệch với Flash.   |
| `WEB.delivery_date` / `return_date` | Calendar.date                   | Nhiều đơn : một ngày, theo từng vai trò | Không thay lẫn ngày giao / ngày trả khi xác định kỳ kế toán.       |

<!-- Trang PDF: 16 -->

**Bảng 17 (tiếp)**

| Nguồn / cột                               | Đích / cột                                         | Quan hệ / cách dùng                      | Lưu ý bắt buộc                                                                   |
| ----------------------------------------- | -------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------- |
| GL.period + currency                      | `Fx_month_end.period` + currency                   | Nhiều bút toán : một tỷ giá tháng        | Kiểm tra tỷ giá cuối tháng; GL đã có `amount_usd`.                               |
| POS tổng hợp theo mã NX × ngày × currency | GL `POS_DAILY` theo NX × `posting_date` × currency | Đối soát hai bảng đã tổng hợp cùng grain | Xét dịch ngày ghi sổ và `POS_CATCHUP`; không nối từng dòng POS với `journal_id`. |
| WEB tổng theo `delivery_date` × currency  | GL `WEB_DELIVERY` theo `posting_date` × currency   | So doanh thu giao online                 | Tách `WEB_RETURN` theo `return_date`, không gộp lẫn vào doanh thu giao.          |
| Flash theo tháng × kênh × thị trường      | GL tổng hợp theo kỳ × kênh / thị trường            | So ở cấp độ tổng hợp sau chuẩn hóa       | Cần ánh xạ Cửa hàng/Online và Eurozone; không nối trực tiếp từng dòng GL.        |

Thứ tự hợp lý cho cửa hàng: `POS_Sales` → bỏ trùng theo khóa logic → nối `Store_Master` bằng `store_id` → quy đổi tiền theo `Fx_daily` → gộp theo `finance_store_code`, ngày bán và tiền tệ → so với GL theo ngày hạch toán tương ứng. Cần xét các trường hợp dồn doanh thu sang kỳ sau trước khi kết luận là lỗi mất dữ liệu.

Thứ tự hợp lý cho online: `WEB_Orders` → xác định trạng thái (Delivered, Cancelled, Returned) → tách ngày đặt, ngày giao và ngày trả → quy đổi và tổng hợp theo từng loại sự kiện → so với bút toán `WEB_DELIVERY` và `WEB_RETURN` của GL. Nếu kiểm tra số trên Flash, phải quay về thời điểm đặt hàng và xử lý chênh lệch kỳ.

LỖI NỐI BẢNG DỄ MẮC. Một `finance_store_code` có thể thuộc nhiều `pos_store_id` khác nhau. Nếu lấy bảng GL (mã NX) nối trực tiếp với `Store_Master` rồi SUM, một bút toán có thể bị nhân 2–3 lần. Giải pháp: nối POS theo `pos_store_id`, kiểm soát phạm vi ngày hoạt động; so GL ở bảng tổng hợp mã NX đã bảo đảm duy nhất.

#### 3. Quy ước thời điểm chốt sổ, chênh lệch, sai số và tỷ giá

Các quy ước dưới đây là phần nhóm đã thống nhất trong `quy_uoc_chung.md` và `quy_uoc_so_cai.md`. Chúng quyết định cách dữ liệu được đọc và so sánh; không phải dữ liệu tự có trong từng cột nguồn.

<!-- Trang PDF: 17 -->

##### Thời điểm ghi nhận và nguồn chuẩn

<a id="bang-18"></a>

**Bảng 18. Thời điểm ghi nhận của từng nguồn dữ liệu**

| Nguồn                  | Ngày xác định kỳ        | Ý nghĩa khi so sánh                                        |
| ---------------------- | ----------------------- | ---------------------------------------------------------- |
| Finance GL             | `posting_date` / period | Kỳ kế toán đã khóa sổ; nguồn số chuẩn theo nhóm.           |
| POS Sales              | `business_date`         | Ngày bán ở điểm bán; có thể khác ngày hạch toán GL.        |
| WEB Orders – Flash     | `order_date`            | Ngày khách đặt đơn, dù giao ở kỳ sau.                      |
| WEB Orders – doanh thu | `delivery_date`         | Ngày giao: mốc đối soát với `WEB_DELIVERY`.                |
| WEB Orders – hàng trả  | `return_date`           | Ngày nhận trả: mốc đối soát với `WEB_RETURN`.              |
| Sales Flash            | Tháng                   | Tổng doanh số nhanh tháng theo nguồn đơn hàng / giao dịch. |

Theo quy ước nhóm, GL được chọn làm chuẩn do đã khóa sổ và có chứng từ. Vì khác ngày ghi nhận, chênh lệch tháng giữa GL và Flash có thể phát sinh mà không phải lỗi dữ liệu. Ví dụ đơn đặt cuối tháng 12/2025 và giao trong 01/2026 thuộc Flash năm 2025 nhưng không trở thành doanh thu GL năm 2025.

##### Công thức đối soát và ngưỡng sai số

<a id="bang-19"></a>

**Bảng 19. Quy ước tính chênh lệch và ngưỡng kiểm tra**

| Nội dung                       | Quy tắc / điều kiện                                                               |
| ------------------------------ | --------------------------------------------------------------------------------- |
| Chênh lệch tuyệt đối           | Chênh lệch = GL − Flash (USD). Âm nghĩa là GL thấp hơn Flash.                     |
| % KPI so với Flash             | Chênh lệch ÷ Flash × 100%; giữ nguyên dấu của chênh lệch.                         |
| % kiểm tra cửa hàng–tháng      | Chênh lệch ÷ \|GL\| × 100%; chỉ áp dụng ở mức cửa hàng × tháng.                   |
| Điều kiện đánh dấu vượt ngưỡng | \|Chênh lệch\| > 200 USD VÀ \|% so với GL\| > 1%, sau chuẩn hóa.                  |
| Sai số làm tròn                | ≤ 5 USD/tháng theo quy ước nhóm.                                                  |
| Kiểm tra bảng cầu nối          | Dòng kiểm tra lý tưởng = 0; chấp nhận sai lệch ≤ 1 USD.                           |
| Quy đổi tỷ giá                 | Các khoản trước dòng FX dùng tỷ giá ngày đặt/ngày bán; GL dùng tỷ giá cuối tháng. |

Ví dụ kiểm tra cả năm từ hai tệp nguồn: Flash = 31.124.401,00 USD; GL (đổi dấu) = 28.698.496,23 USD; chênh lệch GL − Flash = −2.425.904,77 USD, tương ứng −7,79% so với Flash. Tỷ lệ này là tỷ lệ KPI, không thay cho ngưỡng kiểm tra cửa hàng–tháng.

<!-- Trang PDF: 18 -->

##### Các khoản tạo chênh lệch và cách phân loại

Để giải thích chênh lệch, phải đưa dữ liệu về chung cách tính rồi mới đánh giá phần dư. Trình tự dưới đây giữ nguyên thứ tự nhóm đã thống nhất trong file quy ước chung; số tiền là bảng số chuẩn cả năm từ tài liệu nhóm (không phải 156 dòng Flash cung cấp sẵn từng khoản).

<a id="bang-20"></a>

**Bảng 20. Cầu nối doanh thu Sales Flash và Finance GL năm 2025 (USD)**

| Bước / khoản                | Số tiền (USD)  | Loại / lưu ý                     |
| --------------------------- | -------------- | -------------------------------- |
| Doanh số Sales Flash        | +31.124.401,00 | Điểm bắt đầu                     |
| Chiết khấu                  | −1.834.297,47  | Quy tắc ghi nhận                 |
| Dòng POS bị trùng           | −12.622,20     | Lỗi dữ liệu; giá sau giảm giá    |
| Đơn online bị hủy           | −215.658,92    | Quy tắc ghi nhận                 |
| Lệch thời điểm online       | −52.597,90     | Quy tắc ghi nhận                 |
| Lệch ngày ghi sổ cửa hàng   | 0,00           | Tổng năm tự bù trừ               |
| Lỗi chuyển dữ liệu POS → GL | 0,00           | Tháng 11/12 bù trừ               |
| Hàng trả                    | −349.148,23    | Theo tỷ giá ngày đặt             |
| Phí vận chuyển              | +94.766,95     | Bút toán tay MJ-SHIP             |
| Tỷ giá                      | −57.598,01     | Chênh giữa tỷ giá ngày / cuối kỳ |
| Làm tròn                    | +1,01          | Sai số chấp nhận được            |
| Chưa giải thích (ADJ-0925)  | +1.250,00      | Không nhập chung phí vận chuyển  |
| Doanh thu Finance GL        | 28.698.496,23  | Số chuẩn sau đổi dấu             |

Ở bảng cầu nối toàn công ty, bút toán MJ-RCL-2506 chuyển 3.480 USD từ cửa hàng NX019 sang online có tác động tổng bằng 0 nên không cần dòng riêng; nhưng ở bảng cầu nối theo kênh, phải tách riêng khoản chuyển kênh. Bút toán ADJ-0925 là khoản 1.250 USD chưa có căn cứ giải thích trong tài liệu nhóm, không được mặc định là phí vận chuyển hay sai số làm tròn.

Với hàng trả, nhóm dùng tỷ giá của ngày đặt hàng cho khoản điều chỉnh trong cầu nối. Giá trị hàng trả theo cách đó là −349.148,23 USD; trong GL, số ghi theo tỷ giá cuối tháng khác (−349.066,23 USD), phần khác nhau đi vào khoản tỷ giá. Cần phân biệt với tỷ giá ngày nhận hàng trả.

<a id="muc-vi"></a>

### VI. Làm sạch dữ liệu

#### 1. Chiến lược làm sạch dữ liệu

Nhóm sử dụng Power Query để tổ chức quy trình xử lý dữ liệu theo ba lớp: dữ liệu gốc (Raw Data), dữ liệu trung gian (Staging Data) và dữ liệu đã làm sạch (Clean Data). Dữ liệu gốc được bảo toàn nhằm hỗ trợ truy vết, trong khi các bước xử lý được thực hiện trên các truy vấn trung gian và truy vấn làm sạch.

Các quyết định xử lý được thực hiện theo nguyên tắc phân biệt giữa lỗi kỹ thuật và ngoại lệ nghiệp vụ. Những bản ghi không hợp lệ hoặc trùng lặp được xử lý theo quy tắc xác

<!-- Trang PDF: 19 -->

định trước; ngược lại, những giao dịch bất thường nhưng hợp lệ về cấu trúc được bảo toàn để phục vụ các bước kiểm tra và đối soát tiếp theo.

#### 2. Chuẩn hóa cấu trúc và định dạng

Việc làm sạch cấu trúc và định dạng tập trung vào chuẩn hóa dữ liệu, cấu trúc bảng và phương pháp biểu diễn các trường thông tin giữa các nguồn.

**Nhóm chỉ định dạng những thành phần quan trọng nhất khi nạp vào Power Query vì có thể ảnh hưởng đến các bước sau nếu định dạng hết, phần định dạng hết nhóm để ở phía sau vì làm vậy sẽ an toàn hơn. Cho nên:**

Đối với WEB Orders, các trường ngày được cung cấp theo định dạng tháng/ngày/năm (MM/DD/YYYY). Do đó, dữ liệu ngày cần được chuyển đổi theo locale English (United States) nhằm tránh nhầm lẫn giữa ngày và tháng trong quá trình phân tích.

Đối với Sales Flash, dữ liệu nguồn bao gồm các dòng thông tin tiêu đề và dòng tổng cộng bên cạnh các bản ghi doanh số chi tiết. Những dòng không đại diện cho một quan sát độc lập được loại khỏi bảng phân tích nhằm tránh việc tính trùng doanh số

Bên cạnh đó, các trường dữ liệu được chuẩn hóa về kiểu phù hợp với ý nghĩa sử dụng, bao gồm Date cho thời gian, Text cho mã định danh và trạng thái, cũng như kiểu số thích hợp cho các trường tiền tệ và số lượng.

Quá trình này giúp bảo đảm dữ liệu được diễn giải chính xác và tạo điều kiện cho các bước xử lý tiếp theo.

#### 3. Xử lý bản ghi trùng, thiếu và không hợp lệ

Một trong những vấn đề đáng chú ý của dữ liệu POS là sự tồn tại của các dòng hàng được xuất nhiều lần. Trong dữ liệu gốc, 17.124 bản ghi tương ứng với 17.112 tổ hợp khóa `receipt_no` + `line_no` khác nhau, cho thấy có 12 bản ghi xuất lặp.

Để xác định bản ghi cần sử dụng trong phép tính doanh thu, các dòng trùng khóa được phân biệt thông qua thời điểm xuất dữ liệu (`exported_at`). Theo quy tắc xử lý được đề xuất, bản xuất đầu tiên được ưu tiên, trong khi các bản xuất lặp được loại khỏi phép tính doanh thu và vẫn có thể truy vết từ dữ liệu gốc.

**Đối với giá trị thiếu (Missing Values), nhóm phân biệt giữa trường hợp thiếu dữ liệu bất thường và trường hợp giá trị trống phù hợp với trạng thái nghiệp vụ.**

Trong `WEB_Orders`, `delivery_date` có thể để trống đối với đơn hàng bị hủy, trong khi `return_Date` chỉ có giá trị đối với những đơn phát sinh hoàn trả. Tương tự, các bút toán hệ thống trong Finance GL không nhất thiết có `source_ref`, và một số mã cửa hàng còn hoạt động không có `close_date` trong `Store_Master`.

**Những giá trị trống hợp lệ này cần được giữ nguyên, thay vì tự động thay thế bằng một ngày hoặc mã giả định.**

**Đặc biệt, các bút toán GL chưa phân bổ cửa hàng hoặc thiếu chứng từ không được tự ý loại bỏ khi chúng vẫn là những bản ghi kế toán hợp lệ. Những trường hợp này được giữ lại để đánh giá và phân loại trong giai đoạn đối soát.**

<!-- Trang PDF: 20 -->

#### 4. Tổng hợp quyết định làm sạch

Các quyết định làm sạch được tổng hợp nhằm bảo đảm tính minh bạch và khả năng truy vết của quá trình chuẩn bị dữ liệu.

<a id="bang-21"></a>

**Bảng 21. Tổng hợp các quyết định làm sạch dữ liệu**

| Nguồn dữ liệu  | Vấn đề chất lượng dữ liệu                      | Quyết định xử lý                                                                           |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| POS Sales      | Trùng khóa giao dịch                           | Xác định bản xuất đầu tiên, loại bản lặp khỏi phép tính doanh thu và bảo lưu dữ liệu nguồn |
| WEB Orders     | Định dạng ngày MM/DD/YYYY                      | Chuyển đổi bằng locale English (United States)                                             |
| WEB Orders     | Ngày giao và trả hàng bị thiếu theo trạng thái | Giữ các giá trị null phù hợp với nghiệp vụ                                                 |
| Finance GL     | Các trường tham chiếu không đầy đủ             | Giữ bản ghi và phân biệt bút toán hệ thống với bút toán cần xác minh                       |
| Sales Flash    | Dòng metadata và tổng cộng                     | Loại khỏi bảng dữ liệu chi tiết                                                            |
| Reference Data | Khác biệt kiểu dữ liệu và định danh            | Chuẩn hóa định dạng, bảo toàn các ánh xạ hợp lệ                                            |

_Nguồn: Tổng hợp từ cấu trúc dữ liệu Nexa Home và các quy tắc xử lý của dự án_

Các bước làm sạch được thực hiện với mục tiêu tạo ra các bảng dữ liệu có cấu trúc nhất quán, bảo toàn thông tin giao dịch và duy trì khả năng truy vết về dữ liệu gốc.

Những bảng này được sử dụng làm đầu vào cho phần Data Transformation, trong đó nhóm tiếp tục áp dụng các quy tắc ghi nhận doanh thu, chuẩn hóa thời gian, quy đổi tiền tệ và tích hợp dữ liệu phục vụ đối soát.

**Kết quả nạp vào, làm sạch và chuyển đổi được đánh giá thông qua các phép kiểm tra chất lượng dữ liệu được trình bày tại mục VIII – Data Quality Validation.**

<a id="muc-vii"></a>

### VII. Chuyển đổi và tích hợp dữ liệu

Quá trình chuyển đổi dữ liệu (Data Transformation) được thiết kế nhằm chuẩn hóa giá trị doanh thu, thời điểm ghi nhận, đơn vị tiền tệ và mã định danh giữa các nguồn dữ liệu nghiệp vụ. Trên cơ sở dữ liệu đã được làm sạch, các quy tắc ghi nhận được áp dụng để xây dựng những bảng dữ liệu có cấu trúc thống nhất, phục vụ quá trình đối soát doanh thu giữa Sales Flash và Finance General Ledger (GL).

Khác với Data Cleaning, giai đoạn này tập trung vào việc áp dụng các quy tắc nghiệp vụ và chuyển đổi cấu trúc dữ liệu, thay vì xử lý những lỗi kỹ thuật trong dữ liệu nguồn.

#### 1. Chuẩn hóa doanh thu và trạng thái giao dịch

Do các nguồn dữ liệu sử dụng những phương pháp xác định doanh thu khác nhau, việc chuẩn hóa giá trị giao dịch là bước cần thiết trước khi thực hiện đối soát.

<!-- Trang PDF: 21 -->

Đối với POS Sales, dữ liệu được ghi nhận ở cấp độ dòng hàng trên hóa đơn, trong đó `line_amount` phản ánhh giá trị trước chiết khấu và `discount_amount` thể hiện khoản giảm giá tương ứng. Doanh thu thuần của mỗi dòng hàng được xác định theo công thức:

```text
Net Sales = line_amount − discount_amount
```

Phép tính được áp dụng cho các bản ghi hợp lệ sau khi xử lý trùng lặp nhằm tránh ghi nhận doanh thu nhiều lần từ cùng một giao dịch.

Đối với WEB Orders, trường `net_amount` đã phản ánhh giá trị đơn hàng sau khi trừ chiết khấu. Tuy nhiên, việc ghi nhận doanh thu còn phụ thuộc vào trạng thái và thời điểm xử lý đơn hàng.

Ba trạng thái chính gồm Delivered, Cancelled và Returned. Các đơn hàng đã giao được xem xét ghi nhận doanh thu tại thời điểm giao hàng, trong khi đơn bị hủy không tạo doanh thu kế toán. Đối với đơn hàng đã giao và sau đó được trả lại, khoản ghi giảm doanh thu được xác định tại thời điểm nhận trả.

Do đó, quá trình chuyển đổi phải phân biệt giá trị đơn hàng với các sự kiện ghi nhận doanh thu, bảo đảm không bỏ sót hoặc ghi nhận hai lần giá trị của đơn hàng.

Đối với Finance GL, các bút toán doanh thu, hoàn trả và điều chỉnh được bảo toàn để phản ánhh đầy đủ những khoản đã hạch toán. Trong khi đó, Sales Flash được giữ theo định nghĩa doanh số báo cáo nhanh, làm cơ sở tính toán các khoản điều chỉnh trong quá trình đối soát.

#### 2. Thống nhất ngày ghi nhận và kỳ kế toán

Một trong những khác biệt quan trọng giữa Sales Flash và Finance GL là thời điểm ghi nhận doanh thu. Vì vậy, nhóm cần xác định rõ các trường thời gian được sử dụng trong từng nguồn và bổ sung những thông tin cần thiết để đưa dữ liệu về cùng cơ sở so sánh.

Đối với POS Sales, `business_date` phản ánh ngày phát sinh giao dịch tại cửa hàng. Tuy nhiên, Finance GL ghi nhận doanh thu theo ngày hạch toán (`posting_date`). Với những giao dịch phát sinh vào ngày không làm việc, ngày hạch toán được xác định là ngày làm việc đầu tiên không sớm hơn ngày bán, dựa trên bảng Calendar.

Đối với WEB Orders, quá trình ghi nhận được phân biệt theo ba thời điểm: `order_date` phục vụ báo cáo doanh số theo ngày đặt hàng; `delivery_date` xác định thời điểm ghi nhận doanh thu khi giao thành công; và `return_date` xác định thời điểm ghi giảm doanh thu do hoàn trả.

Finance GL sử dụng `posting_date` và period để xác định kỳ kế toán. Trong khi đó, Sales Flash tổng hợp doanh số theo tháng báo cáo dựa trên thời điểm phát sinh giao dịch theo quy tắc của Sales.

Các trường ngày gốc được bảo toàn, đồng thời những trường ngày hoặc kỳ ghi nhận bổ sung được sử dụng để hỗ trợ so sánh giữa các phương pháp ghi nhận khác nhau.

Việc chuẩn hóa này cho phép phân biệt các khoản chênh lệch do chuyển kỳ với những sai lệch thực sự trong quá trình ghi nhận dữ liệu.

<!-- Trang PDF: 22 -->

#### 3. Quy đổi tiền tệ và chuẩn hóa dấu kế toán

Nexa Home sử dụng năm loại tiền tệ gồm AUD, CAD, EUR, GBP và USD. Để thực hiện phân tích doanh thu tổng hợp, các giao dịch cần được biểu diễn bằng một đơn vị tiền tệ thống nhất.

Dự án sử dụng hai bảng tỷ giá: `FX_Daily` và `FX_Month_End`, tương ứng với hai phương pháp quy đổi theo ngày giao dịch và tỷ giá cuối tháng.

Do tỷ giá được biểu diễn bằng số đơn vị nguyên tệ tương ứng với một USD, giá trị quy đổi được xác định như sau:

```text
USD Amount = Local Amount / Exchange Rate
```

Hai giá trị quy đổi được sử dụng theo mục đích đối chiếu:

- Giá trị USD theo tỷ giá ngày: Giá trị quy đổi theo tỷ giá ngày giao dịch, phục vụ tái tạo cơ sở ghi nhận của Sales Flash.

- Giá trị USD theo tỷ giá cuối tháng: Giá trị quy đổi theo tỷ giá cuối tháng của kỳ ghi nhận, phục vụ so sánh với Finance GL.

Việc duy trì hai phương pháp quy đổi cho phép xác định riêng ảnh hưởng của tỷ giá đến chênh lệch doanh thu, thay vì gộp chênh lệch tỷ giá vào những nguyên nhân khác.

Bên cạnh đó, Finance GL sử dụng quy ước dấu kế toán, trong đó doanh thu thông thường được ghi nhận bằng giá trị âm. Vì vậy, để thống nhất cách biểu diễn với các nguồn bán hàng, chỉ tiêu doanh thu GL được xác định:

```text
GL Revenue (USD) = −amount_usd
```

Phép chuyển đổi được áp dụng nhất quán cho các bút toán, bao gồm cả những khoản hoàn trả và điều chỉnh. Do trường `amount_usd` đã chứa giá trị quy đổi, không thực hiện quy đổi tỷ giá thêm lần nữa trên cột này.

#### 4. Ánh xạ mã định danh, kênh và thị trường

Các nguồn dữ liệu sử dụng hệ thống mã định danh và phân loại kênh bán hàng khác nhau. Vì vậy, quá trình tích hợp yêu cầu chuẩn hóa mã cửa hàng, kênh bán và thị trường trước khi đối chiếu.

Đối với POS, trường `store_id` được liên kết với `pos_store_id` trong `Store_Master` để xác định `finance_store_code`, là mã cửa hàng được sử dụng trong Finance GL.

Do một mã cửa hàng Finance có thể tương ứng với nhiều mã POS thuộc các giai đoạn hoạt động khác nhau, việc ánh xạ cần được thực hiện dựa trên khóa định danh POS và các thông tin liên quan, nhằm tránh tạo ra bản ghi hoặc giá trị doanh thu trùng lặp.

Ngoài ra, các nhãn kênh bán hàng được chuẩn hóa để bảo đảm tính nhất quán giữa STORE, WEB và những nhóm phân loại trong Sales Flash. Những bút toán chưa được phân bổ cho cửa hàng hoặc kênh cụ thể được giữ riêng dưới nhóm UNALLOCATED, thay vì tự động gán vào một trong hai kênh bán hàng.

<!-- Trang PDF: 23 -->

Đối với phân tích thị trường, cần xem xét những nhóm tổng hợp như Eurozone trong Sales Flash để tránh đối chiếu trực tiếp với các quốc gia riêng lẻ khi chưa có quy tắc ánh xạ phù hợp.

Các bước chuẩn hóa định danh tạo nền tảng cho việc tổng hợp và so sánh doanh thu ở những cấp độ tương thích.

#### 5. Tích hợp dữ liệu và tổng hợp phục vụ đối soát

Sau khi hoàn thành các bước chuẩn hóa, dữ liệu POS Sales và WEB Orders được tổ chức thành cấu trúc giao dịch chung (Unified Transaction Table), phục vụ việc tổng hợp và đối soát doanh thu đa nguồn.

Cấu trúc này cần bao gồm những thông tin chính như nguồn giao dịch, mã định danh, kênh bán, mã cửa hàng, ngày phát sinh, ngày ghi nhận, đơn vị tiền tệ, giá trị doanh thu thuần và các giá trị USD đã quy đổi.

Do POS và WEB có mức độ chi tiết cũng như cách ghi nhận khác nhau, quá trình tích hợp phải xác định rõ ý nghĩa của một dòng dữ liệu sau chuyển đổi, đặc biệt đối với những đơn hàng trực tuyến có cả sự kiện giao hàng và hoàn trả.

Từ dữ liệu giao dịch đã chuẩn hóa, nhóm xây dựng các bảng tổng hợp phục vụ đối soát theo những cấp độ phù hợp:

**Sau khi có bảng giao dịch chung rồi xây dựng thêm các bảng đối soát**

<a id="bang-22"></a>

**Bảng 22. Các cấu trúc dữ liệu phục vụ đối soát**

| Bảng đối soát                       | Cấp độ tổng hợp                     | Mục đích                                  |
| ----------------------------------- | ----------------------------------- | ----------------------------------------- |
| Đối soát doanh thu tại cửa hàng     | Cửa hàng x ngày hạch toán x tiền tệ | So sánh POS với các bút toán GL liên quan |
| Đối soát giao hàng trực tuyến       | Ngày giao x tiền tệ                 | So sánh doanh thu giao hàng với GL        |
| Đối soát hàng trả trực tuyến        | Ngày trả x tiền tệ                  | Đối chiếu các khoản hoàn trả với GL       |
| Dữ liệu đầu vào đối soát theo tháng | Tháng x kênh x thị trường phù hợp   | Hỗ trợ so sánh Sales Flash với Finance GL |

_Nguồn: Tổng hợp từ yêu cầu đối soát và cấu trúc dữ liệu dự án Nexa Home._

Việc tổng hợp theo cấp độ tương thích giúp hạn chế sai lệch phát sinh từ sự khác biệt về grain giữa các hệ thống, đồng thời tạo điều kiện truy vết từ chênh lệch tổng hợp xuống các giao dịch và bút toán liên quan.

Các bảng dữ liệu sau chuyển đổi được sử dụng làm đầu vào cho quá trình Data Quality Validation và các phân tích đối soát ở mục X. Kết quả chuyển đổi cần được kiểm tra về tính đầy đủ, quy ước ghi nhận và sự nhất quán của các giá trị tổng hợp trước khi sử dụng để giải thích chênh lệch doanh thu.

<!-- Trang PDF: 24 -->

<a id="muc-viii"></a>

### VIII. Kiểm tra chất lượng dữ liệu

Quá trình kiểm tra chất lượng dữ liệu (Data Quality Validation) nhằm đánh giá tính đầy đủ, chính xác và nhất quán của dữ liệu xuyên suốt các giai đoạn nạp, làm sạch và chuyển đổi. Đây là bước cần thiết để đảm bảo rằng các kết quả đối soát doanh thu được xây dựng trên những nguồn dữ liệu đáng tin cậy, đồng thời hạn chế những sai lệch phát sinh từ quá trình xử lý dữ liệu.

Việc kiểm tra được tổ chức thành ba lớp chính: xác nhận dữ liệu nguồn, kiểm tra tính toàn vẹn sau làm sạch và kiểm chứng các quy tắc chuyển đổi. Kết quả được tổng hợp nhằm đánh giá mức độ sẵn sàng của dữ liệu trước khi thực hiện phân tích chênh lệch giữa Sales Flash và Finance GL.

#### 1. Kiểm tra dữ liệu nguồn và tổng kiểm soát

Lớp kiểm tra đầu tiên tập trung vào việc xác nhận tính đầy đủ của dữ liệu được nạp từ các nguồn nghiệp vụ ban đầu. Các chỉ tiêu kiểm soát bao gồm số lượng bản ghi, số lượng giao dịch và tổng giá trị của những trường dữ liệu quan trọng.

Những chỉ tiêu này được đối chiếu với các giá trị tham chiếu trong tài liệu dự án nhằm phát hiện những trường hợp thiếu dữ liệu, nạp trùng hoặc đọc sai cấu trúc nguồn.

Các tổng giá trị `line_amount` của POS và `net_amount` của WEB được sử dụng như chỉ tiêu kỹ thuật để xác nhận việc nạp dữ liệu, không phải giá trị doanh thu USD có thể sử dụng trực tiếp trong phân tích do dữ liệu chứa nhiều loại tiền tệ.

#### 2. Kiểm tra tính toàn vẹn sau làm sạch

Sau khi thực hiện Data Cleaning, dữ liệu được kiểm tra nhằm bảo đảm các quyết định xử lý không làm mất những giao dịch hợp lệ hoặc tạo ra sai lệch ngoài dự kiến.

Đối với POS Sales, tính duy nhất của tổ hợp khóa `receipt_no` + `line_no` là một tiêu chí kiểm tra quan trọng. Dữ liệu nguồn chứa 17.124 dòng nhưng có 17.112 tổ hợp khóa khác nhau, tương ứng 12 bản ghi xuất lặp. Phép kiểm tra sau cleaning cần xác nhận rằng các bản xuất lặp này không tiếp tục đóng góp vào doanh thu khi tổng hợp.

Đối với WEB Orders, các trường ngày được kiểm tra về tính hợp lệ sau khi chuyển đổi định dạng MM/DD/YYYY. Đồng thời, những giá trị trống phù hợp với trạng thái đơn hàng, chẳng hạn `delivery_date` của đơn Cancelled, cần được bảo toàn.

Đối với Finance GL, các bút toán được kiểm tra thông qua khóa `journal_id`, đồng thời bảo đảm những bút toán điều chỉnh, hoàn trả và chưa phân bổ vẫn được giữ trong phạm vi dữ liệu phục vụ đối soát.

Sales Flash được kiểm tra nhằm xác nhận các dòng metadata và dòng tổng cộng không còn tham gia vào phép tính doanh số chi tiết.

Ngoài ra, các bảng tham chiếu được kiểm tra tính duy nhất của khóa và sự phù hợp của những trường bắt buộc để hỗ trợ các phép nối dữ liệu.

Kết quả các phép kiểm tra sau cleaning được ghi nhận trong bảng kiểm soát chất lượng, bao gồm số trường hợp phát hiện, số trường hợp đã xử lý và các vấn đề chưa được giải quyết nếu có.

<!-- Trang PDF: 25 -->

#### 3. Kiểm tra quy tắc chuyển đổi và nghiệp vụ

Sau khi dữ liệu được chuẩn hóa và tích hợp, quá trình validation tập trung đánh giá việc áp dụng các quy tắc nghiệp vụ có chính xác và bảo toàn giá trị giao dịch hay không.

##### Kiểm tra công thức doanh thu

Các công thức xác định doanh thu được kiểm tra theo quy tắc tương ứng với từng nguồn. Đối với POS, giá trị sau chiết khấu được xác định từ `line_amount` và `discount_amount`. Đối với WEB, giá trị `net_amount` được sử dụng cùng trạng thái đơn hàng để xác định những sự kiện ghi nhận phù hợp. Đối với Finance GL, phép đổi dấu `revenue_usd` = −`amount_usd` được kiểm tra để bảo đảm tác động của doanh thu, hoàn trả và điều chỉnh được giữ nhất quán.

##### Kiểm tra ngày và kỳ kế toán

Các trường ngày ghi nhận sau chuyển đổi được đối chiếu với Calendar và quy tắc của từng nguồn. Đối với POS, ngày hạch toán phải phù hợp với lịch làm việc được cung cấp. Đối với WEB, các sự kiện giao hàng và hoàn trả được liên kết với đúng thời điểm ghi nhận tương ứng.

Việc kiểm tra nhằm hạn chế những sai lệch phát sinh từ cách xác định kỳ kế toán không nhất quán.

##### Kiểm tra quy đổi tiền tệ

Các giá trị quy đổi USD được kiểm tra theo loại tiền tệ, ngày giao dịch và kỳ hạch toán. Phép tính sử dụng tỷ giá tương ứng từ `FX_Daily` hoặc `FX_Month_End` và tuân theo quy ước tỷ giá được cung cấp trong dự án.

Những giao dịch không tìm được tỷ giá tương ứng hoặc có kết quả quy đổi bất thường cần được xác định và ghi nhận để xử lý.

##### Kiểm tra ánh xạ và tích hợp dữ liệu

Việc liên kết POS với `Store_Master` được kiểm tra nhằm bảo đảm ánh xạ đúng mã cửa hàng Finance mà không tạo thêm bản ghi ngoài dự kiến. Đồng thời, dữ liệu được kiểm tra về tính đầy đủ của mã kênh, mã tiền tệ và các trường cần thiết cho việc tổng hợp.

Đối với những bảng đã được tích hợp, số lượng giao dịch và tổng giá trị được đối chiếu với các nguồn đầu vào theo cùng phạm vi và cách tính, nhằm phát hiện những trường hợp mất hoặc nhân bản dữ liệu do phép nối.

Các phép kiểm tra này tạo cơ sở để xác nhận tính nhất quán của các bảng dữ liệu sau chuyển đổi trước khi sử dụng trong phân tích đối soát.

#### 4. Tổng hợp kiểm tra và mức độ sẵn sàng đối soát

Kết quả Data Quality Validation được tổng hợp thành bảng QC Summary nhằm cung cấp cái nhìn chung về chất lượng dữ liệu sau toàn bộ quá trình chuẩn bị.

_Nguồn: Tổng hợp từ QC Summary và các phép kiểm tra dữ liệu của nhóm._

<!-- Trang PDF: 26 -->

Trên cơ sở kết quả kiểm tra, nhóm đánh giá mức độ đầy đủ và nhất quán của các bảng dữ liệu được sử dụng trong quá trình đối soát.

Việc dữ liệu đáp ứng các phép kiểm tra chất lượng không đồng nghĩa với việc Sales Flash và Finance GL có giá trị doanh thu bằng nhau. Những chênh lệch xuất phát từ quy tắc ghi nhận hoặc các sự kiện nghiệp vụ hợp lệ vẫn cần được bảo toàn và giải thích.

Các bảng dữ liệu đã qua kiểm tra tạo nền tảng cho quá trình Exploratory Analysis và Main Analysis, trong đó nhóm tiếp tục xác định, lượng hóa và phân loại những khoản chênh lệch doanh thu giữa các nguồn.

**Kết quả nêu trong bộ dữ liệu tham chiếu gồm 32/32 phép kiểm tra QC đạt PASS. Kết quả này không thay thế cho việc xác nhận riêng các phép kiểm tra trên dữ liệu xử lý của nhóm; đồng thời, Dashboard 4 vẫn ghi nhận ngoại lệ ở 3/7 phép kiểm tra nghiệp vụ. Vì vậy, kiểm tra kỹ thuật và kiểm soát đối soát phải được theo dõi tách biệt.**

<a id="muc-ix"></a>

### IX. Định nghĩa các chỉ số

Để bảo đảm tính nhất quán trong quá trình phân tích và đối soát doanh thu, nhóm xây dựng hệ thống các chỉ số đo lường (Metrics) dựa trên quy tắc ghi nhận, cấu trúc dữ liệu và phạm vi phân tích đã xác định.

Các chỉ số được phân thành bốn nhóm chính: chỉ số doanh thu, chỉ số chênh lệch đối soát, chỉ số điều chỉnh trong bảng cầu nối và chỉ số vận hành – chất lượng dữ liệu.

Mỗi chỉ số được định nghĩa theo mục đích sử dụng, công thức tính, nguồn dữ liệu và cấp độ tổng hợp tương ứng. Những quy ước này được sử dụng thống nhất trong quá trình xây dựng các bảng đối soát và báo cáo trực quan hóa.

#### 1. Chỉ số doanh số và doanh thu

Nhóm chỉ số doanh thu được sử dụng nhằm xác định và so sánh giá trị doanh số, doanh thu thuần và doanh thu đã ghi nhận giữa các hệ thống nghiệp vụ.

Do sự khác biệt về quy tắc ghi nhận giữa Sales Flash và Finance GL, các chỉ số cần được phân biệt rõ giữa giá trị giao dịch trước giảm giá, giá trị sau giảm giá và doanh thu được hạch toán.

<!-- Trang PDF: 27 -->

<a id="bang-23"></a>

**Bảng 23. Các chỉ số doanh thu chính**

| Chỉ số               | Định nghĩa hoặc cách tính                                                               | Nguồn dữ liệu |
| -------------------- | --------------------------------------------------------------------------------------- | ------------- |
| POS Gross Sales      | Tổng `line_amount` của các dòng POS hợp lệ                                              | POS Sales     |
| POS Net Sales        | Tổng `line_amount` − `discount_amount` của các dòng POS hợp lệ                          | POS Sales     |
| WEB Gross Sales      | Tổng `gross_amount` của các đơn thuộc phạm vi được lựa chọn                             | WEB Orders    |
| WEB Net Order Amount | Tổng `net_amount`, đã trừ chiết khấu nhưng chưa áp dụng đầy đủ quy tắc ghi nhận kế toán | WEB Orders    |
| Sales Flash Revenue  | Tổng doanh số USD của các dòng báo cáo Flash chi tiết                                   | Sales Flash   |
| Finance GL Revenue   | Tổng −`amount_usd` của các bút toán kế toán trong kỳ                                    | Finance GL    |

_Nguồn: Tổng hợp từ quy tắc ghi nhận và cấu trúc dữ liệu Nexa Home._

Sales Flash Revenue được sử dụng làm giá trị khởi đầu trong quá trình đối soát, trong khi Finance GL Revenue được lựa chọn làm giá trị tham chiếu kế toán sau khi thống nhất quy ước dấu.

Đối với các chỉ số giao dịch POS và WEB, giá trị doanh thu cần được xác định theo phạm vi bản ghi, trạng thái và thời điểm ghi nhận tương ứng. Đặc biệt, giá trị đơn hàng sau chiết khấu không mặc nhiên đồng nghĩa với doanh thu được ghi nhận trên Finance GL.

#### 2. Chỉ số chênh lệch và đối soát

Nhóm chỉ số đối soát được xây dựng nhằm định lượng mức chênh lệch giữa doanh số báo cáo nhanh và doanh thu kế toán, đồng thời hỗ trợ xác định những trường hợp vượt ngưỡng cần kiểm tra.

##### Chênh lệch doanh thu

Chênh lệch được xác định bằng doanh thu Finance GL trừ doanh số Sales Flash:

```text
∆ = Finance GL Revenue − Sales Flash Revenue
```

Theo quy ước này, giá trị ∆ âm thể hiện doanh thu Finance thấp hơn Sales Flash; ngược lại, giá trị dương thể hiện Finance cao hơn Sales Flash.

##### Tỷ lệ chênh lệch doanh thu

Tỷ lệ chênh lệch tổng quan được tính trên cơ sở doanh số Flash:

```text
Revenue Variance (%) = ∆ / |Sales Flash Revenue| × 100%
```

Chỉ số này phục vụ việc đánh giá quy mô tương đối của chênh lệch theo tháng, kênh bán hàng và toàn bộ năm tài chính.

<!-- Trang PDF: 28 -->

##### Chênh lệch cấp cửa hàng

Đối với quá trình đối soát chi tiết tại cửa hàng, chênh lệch được xác định bằng doanh thu GL tương ứng trừ doanh thu POS đã chuẩn hóa tại cùng cửa hàng và kỳ báo cáo.

```text
Store Variance = GL POS Revenue − Standardized POS Revenue
```

Tỷ lệ chênh lệch ở cấp cửa hàng được tính như sau:

```text
Store Variance (%) = Store Variance / |GL POS Revenue| × 100%
```

##### Ngưỡng đánh dấu ngoại lệ

Một cửa hàng trong một tháng được đánh dấu cần kiểm tra khi đồng thời đáp ứng hai điều kiện:

- Giá trị tuyệt đối của chênh lệch lớn hơn 200 USD.

- Giá trị tuyệt đối của tỷ lệ chênh lệch so với GL lớn hơn 1%.

Điều kiện này được áp dụng sau quá trình chuẩn hóa dữ liệu. Những trường hợp mẫu số bằng không cần được xử lý riêng nhằm tránh kết luận sai về tỷ lệ chênh lệch.

Các chỉ số trên hỗ trợ xác định những tháng, kênh và cửa hàng có mức chênh lệch đáng chú ý, làm cơ sở lựa chọn các trường hợp cần phân tích chi tiết.

#### 3. Chỉ số cầu nối và ngoại lệ

Nhóm chỉ số Revenue Bridge được sử dụng để lượng hóa những khoản điều chỉnh cần thiết nhằm giải thích sự khác biệt giữa Sales Flash và Finance GL.

Các khoản điều chỉnh được phân loại dựa trên nguyên nhân phát sinh và quy ước nghiệp vụ của dự án.

<a id="bang-24"></a>

**Bảng 24. Nhóm chỉ số cầu nối doanh thu và ngoại lệ**

| Nhóm chỉ số                      | Thành phần                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Điều chỉnh theo quy tắc ghi nhận | Discounts, Cancelled Orders, Timing Differences, Returns, Foreign Exchange Differences và các bút toán điều chỉnh hợp lệ |
| Điều chỉnh lỗi dữ liệu           | Duplicate POS Transactions, Missing GL Entries và các khoản sửa lỗi dữ liệu đã xác nhận                                  |
| Chênh lệch chưa giải thích       | Những khoản chênh lệch chưa đủ bằng chứng để xác định nguyên nhân                                                        |
| Chênh lệch làm tròn              | Sai số phát sinh từ phương pháp làm tròn giá trị doanh thu                                                               |
| Kiểm tra cầu nối                 | Kiểm tra tính đầy đủ của các khoản điều chỉnh                                                                            |

Theo quy ước của dự án, những khoản điều chỉnh làm doanh thu Finance thấp hơn Sales Flash được ghi nhận bằng giá trị âm; các khoản làm Finance cao hơn Flash được ghi nhận bằng giá trị dương.

<!-- Trang PDF: 29 -->

##### Các khoản điều chỉnh đã giải thích

Tổng các khoản điều chỉnh đã được xác định và có bằng chứng giải thích.

##### Chênh lệch chưa giải thích

Phần chênh lệch còn lại sau khi trừ tổng các khoản điều chỉnh đã được giải thích:

```text
Unexplained Difference = Revenue Difference − Explained Adjustments
```

Các khoản chưa giải thích phải được phân loại riêng, không tự động gộp vào nhóm sai số làm tròn hoặc những khoản điều chỉnh khác.

##### Kiểm tra cân bằng cầu nối doanh thu

Kiểm tra mức độ khớp giữa giá trị doanh thu Finance và kết quả Sales Flash sau khi cộng toàn bộ các khoản điều chỉnh:

```text
Bridge Check = Finance GL Revenue − (Sales Flash Revenue + Total Adjustments)
```

Trong đó, Total Adjustments bao gồm cả các khoản đã giải thích và khoản chưa giải thích được ghi nhận rõ ràng trong bảng cầu nối.

Giá trị kiểm tra lý tưởng bằng 0. Mức dung sai cần được áp dụng theo quy ước kiểm soát đã thống nhất và phải được công bố rõ khi trình bày kết quả.

Các chỉ số này là cơ sở xây dựng Revenue Reconciliation Bridge theo tháng, kênh bán hàng và toàn bộ năm tài chính.

#### 4. Chỉ số vận hành và chất lượng dữ liệu

Bên cạnh các chỉ số doanh thu và chênh lệch, dự án sử dụng các chỉ số vận hành và chất lượng dữ liệu để theo dõi hoạt động hoàn trả, hủy đơn, bút toán điều chỉnh và các vấn đề có thể ảnh hưởng đến độ tin cậy của quá trình đối soát.

<!-- Trang PDF: 30 -->

<a id="bang-25"></a>

**Bảng 25. Các chỉ số vận hành và chất lượng dữ liệu**

| Chỉ số                       | Định nghĩa                                                          |
| ---------------------------- | ------------------------------------------------------------------- |
| Return Amount                | Giá trị doanh thu bị hoàn trả trong phạm vi và kỳ ghi nhận xác định |
| Return Rate                  | Tỷ lệ hàng trả theo định nghĩa được nhóm lựa chọn và thống nhất     |
| Cancelled Orders             | Số đơn hàng có trạng thái Cancelled                                 |
| Duplicate POS Lines          | Số bản xuất POS lặp vượt quá một bản hợp lệ trên mỗi khóa giao dịch |
| Manual Journal Count         | Số bút toán có `journal_type` = MANUAL                              |
| Undocumented Manual Journals | Số bút toán tay không đáp ứng yêu cầu chứng từ tham chiếu           |
| QC Pass Rate                 | Số phép kiểm tra đạt chia cho tổng số phép kiểm tra được thực hiện  |

_Nguồn: Tổng hợp từ yêu cầu Dashboard 4 và các quy tắc kiểm tra dữ liệu của dự án._

Đối với Return Rate, cần xác định rõ chỉ số được tính theo số lượng đơn hàng hay theo giá trị hoàn trả, đồng thời thống nhất thời điểm ghi nhận và mẫu số trước khi sử dụng trong phân tích.

Tương tự, các chỉ số về dữ liệu trùng hoặc thiếu chứng từ cần được tính theo điều kiện xác định rõ ràng, thay vì chỉ dựa vào sự tồn tại của giá trị trống hay các giao dịch bất thường.

Các chỉ số vận hành và chất lượng dữ liệu hỗ trợ việc nhận diện các vấn đề cần kiểm soát, đánh giá mức độ ảnh hưởng của những ngoại lệ và đề xuất cải thiện quy trình đối soát trong các kỳ tiếp theo.

Toàn bộ định nghĩa chỉ số được áp dụng thống nhất giữa Excel, Power BI và báo cáo phân tích. Những công thức DAX hoặc Power Query chi tiết phục vụ tính toán có thể được trình bày trong phần phụ lục nhằm hỗ trợ việc kiểm tra và tái lập kết quả.

<!-- Trang PDF: 31 -->

<a id="muc-x"></a>

### X. Phân tích chính

#### 1. Sales Flash và Finance GL chênh lệch bao nhiêu, theo tháng và theo kênh?

Quy ước riêng trong tiểu mục này: D = Sales Flash − Finance GL; D dương nghĩa là Flash cao hơn GL. Tỷ lệ D% = D / Sales Flash. Đơn vị tiền tệ: USD. So với quy ước chung ∆ = GL − Flash, ta có D = −∆; vì vậy các giá trị trong tiểu mục này giữ chiều Flash − GL.

##### 1.1. Kết quả tổng quan

<a id="bang-26"></a>

**Bảng 26. Kết quả tổng quan**

| Chỉ tiêu                | FY2025        |
| ----------------------- | ------------- |
| Sales Flash             | 31.124.401,00 |
| Finance GL              | 28.698.496,23 |
| Chênh lệch (Flash − GL) | 2.425.904,77  |
| Chênh lệch so với Flash | 7,79%         |

Trong năm 2025, Sales Flash đạt 31.124.401 USD và Finance GL ghi nhận 28.698.496,23 USD. Flash cao hơn GL 2.425.904,77 USD, tương đương 7,79% doanh số Flash. Đây là chênh lệch giữa hai hệ thống ghi nhận, chưa đồng nghĩa với doanh thu thất thoát hoặc lỗi hạch toán.

##### 1.2. Phân tích theo tháng

**Hình 1. Chênh lệch Sales Flash − Finance GL theo tháng năm 2025 (nghìn USD). Nguồn: `fact_sales_flash` và `fact_gl_entry`.**

> **Chuyển biểu đồ sang văn bản:** Biểu đồ cột thể hiện chênh lệch Sales Flash − Finance GL trong 12 tháng, đơn vị nghìn USD. Tháng 3 âm; các tháng còn lại dương. Số liệu chính xác theo tháng được giữ đầy đủ tại [Bảng 27](#bang-27).

Sales Flash cao hơn Finance GL ở 11/12 tháng (Hình 1 và bảng tại mục X.1.3). Ba điểm cần chú ý:

- Tháng 3 đảo chiều: Finance GL cao hơn Flash 99.017,53 USD (D = Flash − GL = −99.017,53 USD; D% = −4,95%). Các khoản giảm giá, đơn hủy và hàng trả thường khiến Flash cao hơn GL; vì vậy cần kiểm tra những điều chỉnh ngược chiều, đặc biệt là chênh lệch thời điểm. Mục X.2 sẽ kiểm chứng nguyên nhân từ bảng cầu nối.

<!-- Trang PDF: 32 -->

- Độ lệch không đồng đều: tháng 4 cao nhất về tỷ lệ (+13,31%), trong khi tháng 2 cao nhất về giá trị tuyệt đối (+387.252,01 USD).

- Cả năm, Flash cao hơn GL 2.425.904,77 USD (+7,79% so với Flash).

##### 1.3. Bảng kiểm chứng theo tháng

<a id="bang-27"></a>

**Bảng 27. Bảng kiểm chứng theo tháng**

| Tháng   | Sales Flash  | Finance GL   | Flash − GL | D / Flash |
| ------- | ------------ | ------------ | ---------- | --------- |
| 01/2025 | 2.859.589,00 | 2.626.167,29 | 233.421,71 | 8,16%     |
| 02/2025 | 3.490.159,00 | 3.102.906,99 | 387.252,01 | 11,10%    |
| 03/2025 | 2.001.911,00 | 2.100.928,53 | -99.017,53 | -4,95%    |
| 04/2025 | 1.035.907,00 | 898.049,36   | 137.857,64 | 13,31%    |
| 05/2025 | 2.802.769,00 | 2.478.745,50 | 324.023,50 | 11,56%    |
| 06/2025 | 2.506.912,00 | 2.412.461,84 | 94.450,16  | 3,77%     |
| 07/2025 | 2.248.805,00 | 2.089.895,01 | 158.909,99 | 7,07%     |
| 08/2025 | 2.569.740,00 | 2.274.164,62 | 295.575,38 | 11,50%    |
| 09/2025 | 2.576.818,00 | 2.494.221,48 | 82.596,52  | 3,21%     |
| 10/2025 | 2.743.824,00 | 2.493.635,92 | 250.188,08 | 9,12%     |
| 11/2025 | 2.806.714,00 | 2.504.559,28 | 302.154,72 | 10,77%    |
| 12/2025 | 3.481.253,00 | 3.222.760,41 | 258.492,59 | 7,43%     |

##### 1.4. Phân tích theo kênh

<a id="bang-28"></a>

**Bảng 28. Phân tích theo kênh**

| Kênh             | Sales Flash   | Finance GL    | Flash − GL   |
| ---------------- | ------------- | ------------- | ------------ |
| Cửa hàng (STORE) | 14.060.500,00 | 13.181.898,25 | 878.601,75   |
| Online (WEB)     | 17.063.901,00 | 15.515.347,98 | 1.548.553,02 |
| Chưa phân bổ     | 0,00          | 1.250,00      | -1.250,00    |
| Toàn công ty     | 31.124.401,00 | 28.698.496,23 | 2.425.904,77 |

Kênh WEB tạo chênh lệch +1.548.553,02 USD (63,83% chênh lệch ròng toàn công ty), lớn hơn STORE (+878.601,75 USD). Điều này cho thấy nên ưu tiên phân tích nhánh WEB, nhưng chưa chứng minh WEB có lỗi dữ liệu. Bảng tại mục X.1.4 còn có 1.250,00 USD doanh thu GL chưa phân bổ kênh (ADJ-0925); cần giữ riêng để tổng theo kênh khớp tổng GL và chuyển Finance kiểm tra chứng từ.

##### 1.5. Điều chưa biết sau bước khám phá

Bảng tổng chỉ trả lời “lệch bao nhiêu”. Nó chưa trả lời lệch do đâu, phần nào hợp lệ, phần nào là lỗi, và vì sao tháng 3 đi ngược chiều. Mục X.2 tách chênh lệch thành từng khoản, bắt đầu từ mức chi tiết nhất: cửa hàng × ngày và đơn online × ngày giao.

<!-- Trang PDF: 33 -->

#### 2. Phân tích nguyên nhân chênh lệch

Phân tích nguyên nhân chênh lệch, đối soát chi tiết và xây dựng bảng cầu nối.

##### 2.1. Phương pháp

Đi từ trên xuống: tổng cả năm → tháng → kênh → cửa hàng × ngày và online × ngày × loại tiền. Sau khi chuẩn hóa quy tắc và tách các ngoại lệ dữ liệu ở tầng chi tiết, có thể phân biệt chênh lệch do định nghĩa với chênh lệch do lỗi dữ liệu ở các tầng tổng hợp.

Bảng cầu nối đi từ Flash đến GL theo thứ tự: chiết khấu → dòng POS trùng → đơn hủy → lệch thời điểm online → lệch ngày ghi sổ cửa hàng → lỗi chuyển dữ liệu → hàng trả → phí vận chuyển → tỷ giá → làm tròn → chưa giải thích.

USD của từng khoản tính theo tỷ giá ngày bán/ngày đặt (cùng cơ sở với Flash); dòng ”Tỷ giá” bù chênh giữa tỷ giá cuối tháng của GL và tỷ giá ngày. Dòng kiểm tra phải về 0 (sai lệch ≤ 1 USD).

Mỗi khoản xếp vào 1 trong 4 nhóm: quy tắc ghi nhận, lỗi dữ liệu, chưa giải thích được, sai số chấp nhận được. Không ép khớp: phần dư không được nhét vào khoản khác (ví dụ ADJ-0925 giữ riêng).

_Nguồn quy ước: docs/`quy_uoc`/`quy_uoc_chung.md`; slide 24–38._

##### 2.2. Bảng cầu nối cả năm 2025

**Hình 2. Cầu nối cả năm từ Flash đến GL.**

> **Chuyển biểu đồ sang văn bản:** Biểu đồ waterfall đi từ doanh số Flash đến doanh thu GL qua chiết khấu, POS trùng, đơn hủy, lệch thời điểm online, hàng trả, vận chuyển, tỷ giá và nhóm làm tròn + ADJ. Hình gốc hiển thị số làm tròn; số tiền chi tiết được giữ tại [Bảng 29](#bang-29).

<!-- Trang PDF: 34 -->

<a id="bang-29"></a>

**Bảng 29. Bảng cầu nối cả năm**

| Khoản                               | USD           | % của ∆ | Nhóm             | Cách xác định                                                                                 |
| ----------------------------------- | ------------- | ------- | ---------------- | --------------------------------------------------------------------------------------------- |
| Doanh số Flash                      | 31.124.401,00 |         |                  | Flash = doanh số trước giảm giá (mục IX.1)                                                    |
| Chiết khấu                          | −1.834.297,47 | 75,6%   | Quy tắc ghi nhận | Σ `discount_amount` POS 833.142,61 (gồm dòng trùng) + WEB 1.001.154,87, USD theo tỷ giá ngày  |
| Dòng POS trùng                      | −12.622,20    | 0,52%   | Lỗi dữ liệu      | 12 dòng trùng, NX007, 29/03, CAD; giá trị sau giảm giá ÷ tỷ giá ngày 1,35751                  |
| Đơn online bị hủy                   | −215.658,92   | 8,89%   | Quy tắc ghi nhận | 124 đơn hủy đặt 2025; `net_amount` ÷ tỷ giá ngày đặt                                          |
| Lệch thời điểm online               | −52.597,90    | 2,17%   | Quy tắc ghi nhận | Σ giao trong tháng − Σ đặt trong tháng, giữ tỷ giá ngày đặt                                   |
| Lệch ngày ghi sổ cửa hàng           | 0,00 cả năm   | 0,00    | Quy tắc ghi nhận | T5 −41.464,78 / T6 +41.464,78; T8 −75.240,30 / T9 +75.240,30; T11 −80.588,85 / T12 +80.588,85 |
| Lỗi chuyển dữ liệu POS → GL (NX057) | 0,00 cả năm   | 0,00    | Lỗi dữ liệu      | T11 −7.227,56 / T12 +7.227,56 (bút toán `POS_CATCHUP`)                                        |
| Hàng trả                            | −349.148,23   | 14,39%  | Quy tắc ghi nhận | 169 đơn có ngày trả trong 2025; `net_amount` ÷ tỷ giá ngày đặt                                |
| Phí vận chuyển                      | +94.766,95    | −3,91%  | Quy tắc ghi nhận | 12 bút toán MANUAL MJ-SHIP, kênh WEB (Flash không có)                                         |
| Tỷ giá                              | −57.598,01    | 2,37%   | Quy tắc ghi nhận | GL quy theo tỷ giá cuối tháng, Flash theo tỷ giá ngày                                         |
| Làm tròn                            | +1,01         | 0,00    | Sai số chấp nhận | Flash làm tròn đến USD; từng tháng < 5 USD                                                    |
| Chưa giải thích được                | +1.250,00     | −0,05%  | Chưa giải thích  | ADJ-0925 (MJ-ADJ-2509), 30/09, kênh UNALLOCATED, không rõ căn cứ                              |
| Doanh thu theo sổ cái (GL)          | 28.698.496,23 |         |                  | Dòng kiểm tra = 0 ở cả 12 tháng và cả năm                                                     |

Tính lại từ số tiền và tỷ giá gốc, giữ độ chính xác trước khi tổng hợp: tỷ giá −57.598,01 USD; làm tròn +1,01 USD. Tổng chiết khấu trước làm tròn là 1.834.297,47 USD; cộng riêng hai số POS và WEB đã làm tròn cho 1.834.297,48 USD, chênh 0,01 USD do cách làm tròn.

##### 2.3. Phân tích từng khoản

###### 2.3.1. Chiết khấu: −1.834.297,47 (75,6% của ∆), quy tắc ghi nhận

- Flash ghi giá niêm yết trước giảm giá, còn GL ghi doanh thu thực nhận sau giảm giá (VAS 14). Khoản này bằng tổng `discount_amount` của POS (833.142,61 USD, gồm 12 dòng trùng) cộng WEB (1.001.154,87 USD) quy USD theo tỷ giá ngày; tổng từ các giá trị chưa làm tròn là 1.834.297,47 USD; cộng riêng hai số thành phần đã làm tròn cho 1.834.297,48 USD (chênh 0,01 USD).

<!-- Trang PDF: 35 -->

- Tỷ lệ chiết khấu / Flash rất ổn định: 5,6% đến 6,5% mỗi tháng (bình quân 5,9%); POS 5,9% và WEB 5,9% của Flash từng kênh. Đây là khác biệt định nghĩa, không phải lỗi.

###### 2.3.2. Dòng POS trùng: −12.622,20 (0,52%), lỗi dữ liệu

- POS xuất lại cùng khóa `receipt_no` + `line_no`: 12 khóa → 24 dòng, giữ lần xuất đầu (còn 17.112 dòng). Toàn bộ nằm ở NX007 (POS 74) ngày 29/03/2025 (Thứ Bảy), hóa đơn R3376006 và R3376008, tiền CAD.

- Flash tính từ POS có cả dòng trùng nên cao hơn GL đúng bằng giá trị sau giảm giá của 12 dòng đó (phần giảm giá đã nằm trong khoản chiết khấu nên không trừ hai lần). Nếu tính theo giá trước giảm giá thì −13.695,13. Chỉ ảnh hưởng tháng 3. GL đúng, Flash sai.

###### 2.3.3. Đơn online bị hủy: −215.658,92 (8,89%), quy tắc ghi nhận

Flash tính đơn theo ngày đặt và gồm cả đơn đã hủy; GL không ghi doanh thu đơn hủy. Có 139 đơn hủy: 124 đơn đặt năm 2025 và 15 đơn đặt tháng 12/2024 (ngoài Flash 2025 nên không ảnh hưởng). Giá trị = `net_amount` của 124 đơn ÷ tỷ giá ngày đặt = 215.658,92. Theo giá trị, T11 (32.411) và T12 (32.900) gần gấp đôi mức trung vị 17 nghìn, nhưng số đơn hủy và tỷ lệ hủy không tăng: T11 có 13 đơn (1,8% số đơn đặt), T12 có 14 đơn (1,6%), trong khi T4 là 2,5% và T10 là 2,3%. Giá trị tăng vì có vài đơn hủy lớn: một đơn 13.542 USD đặt ngày 07/11 (42% giá trị hủy của T11) và ba đơn 7.000–7.500 USD trong tháng 12. Lý do hủy (khách đổi ý, hết hàng, lỗi thanh toán…) không có trong dữ liệu.

###### 2.3.4. Hàng trả: −349.148,23 (14,39%), quy tắc ghi nhận

Flash giữ đơn trả ở ngày đặt, không trừ; GL ghi giảm doanh thu vào ngày trả. Có 169 đơn có ngày trả trong 2025, tổng net quy USD theo tỷ giá ngày đặt = 349.148,23, đúng từng tháng với bảng cầu nối. Tổng 181 đơn trả = 169 (trả 2025) + 7 (trả tháng 01/2026, chưa vào GL 2025) + 5 (trả tháng 12/2024). Số 169 trùng với dòng EX-07 trên slide 40 của đề. Giới hạn: 7 đơn trả tháng 01/2026 sẽ làm GL 2026 giảm, không nằm trong chênh lệch 2025.

###### 2.3.5. Lệch thời điểm online: −52.597,90 (2,17%), quy tắc ghi nhận

Flash tính theo ngày đặt, GL ghi doanh thu `WEB_DELIVERY` theo ngày giao. Với mỗi tháng, khoản lệch = (đơn đặt tháng trước, giao trong tháng này) − (đơn đặt tháng này, giao tháng sau). Nhóm dựng lại từ `WEB_Orders_Export` và ra đúng từng tháng của bảng cầu nối:

<a id="bang-30"></a>

**Bảng 30. Dựng lại lệch thời điểm online (USD, tỷ giá ngày đặt).**

| Tháng | Đặt tháng trước, giao tháng này (+) | Đặt tháng này, giao tháng sau (−) | Lệch thời điểm | Bảng cầu nối |
| ----- | ----------------------------------- | --------------------------------- | -------------- | ------------ |
| T1    | 122.108                             | 155.560                           | −33.452        | −33.452      |
| T2    | 155.560                             | 315.819                           | −160.259       | −160.259     |
| T3    | 315.819                             | 34.031                            | +281.788       | +281.788     |
| T4    | 34.031                              | 98.086                            | −64.055        | −64.055      |
| T5    | 98.086                              | 157.252                           | −59.166        | −59.166      |

<!-- Trang PDF: 36 -->

**Bảng 30 (tiếp)**

| Tháng | Đặt tháng trước, giao tháng này (+) | Đặt tháng này, giao tháng sau (−) | Lệch thời điểm | Bảng cầu nối |
| ----- | ----------------------------------- | --------------------------------- | -------------- | ------------ |
| T6    | 157.252                             | 107.947                           | +49.305        | +49.304      |
| T7    | 107.947                             | 95.355                            | +12.592        | +12.592      |
| T8    | 95.355                              | 102.451                           | −7.096         | −7.097       |
| T9    | 102.451                             | 104.534                           | −2.083         | −2.082       |
| 10    | 104.534                             | 156.117                           | −51.583        | −51.583      |
| 11    | 156.117                             | 126.362                           | +29.755        | +29.755      |
| 12    | 126.362                             | 174.706                           | −48.344        | −48.343      |
| Năm   |                                     |                                   | −52.598        | −52.598      |

Tháng 3 (+281.788): cuối tháng 2 có khối lượng đơn rất lớn (315.819 USD đặt ở T2 giao ở T3) trong khi cuối tháng 3 nhỏ (34.031). Độ trễ giao hàng ổn định (trung bình 2,9–3,1 ngày, tối đa ≤ 10 ngày ở mọi tháng) nên không phải do giao chậm. Vì sao cuối tháng 2 nhiều đơn như vậy (khuyến mãi?) thì dữ liệu chưa cho biết.

Cả năm chỉ −52.598 vì đây thuần là chuyển kỳ giữa các tháng; phần dư là hiệu ứng biên năm: 105 đơn đặt 2025 nhưng giao 2026 (−174.705,79) trừ 77 đơn đặt 12/2024 giao 2025 (+122.107,89) = −52.597,90. Khi so theo ngày giao thì online khớp 1.647/1.647 ô (mục X.2.6).

###### 2.3.6. Lệch ngày ghi sổ của cửa hàng: 0 cả năm (từng tháng khác 0), quy tắc ghi nhận

POS ghi doanh thu theo ngày bán; GL ghi vào ngày làm việc kế tiếp. Khi bán cuối tuần hoặc ngày lễ, doanh thu sang tháng sau nếu rơi cuối tháng. Ba cặp tháng bù trừ nhau:

<a id="bang-31"></a>

**Bảng 31. Ba cặp lệch ngày ghi sổ.**

| Cặp tháng | Ngày bán (thứ)                    | Ngày ghi sổ     | Số tiền (USD)           |
| --------- | --------------------------------- | --------------- | ----------------------- |
| T5 → T6   | 31/05 (Thứ Bảy)                   | 02/06 (Thứ Hai) | −41.464,78 / +41.464,78 |
| T8 → T9   | 30/08 (Thứ Bảy), 31/08 (Chủ nhật) | 02/09 (Thứ Ba)  | −75.240,30 / +75.240,30 |
| T11 → T12 | 29/11 (Thứ Bảy), 30/11 (Chủ nhật) | 01/12 (Thứ Hai) | −80.588,85 / +80.588,85 |

###### 2.3.7. Lỗi chuyển dữ liệu POS → GL (NX057): 0 cả năm (T11 −7.227,56; T12 +7.227,56), lỗi dữ liệu

Doanh thu ngày 21/11/2025 của NX057 (POS 570) có trong POS nhưng không có bút toán trong tháng 11; nó được ghi bổ sung bằng bút toán `POS_CATCHUP` JE20251206231 ngày 02/12 với đúng 7.227,56 USD. Đối soát cửa hàng×ngày bắt được chính xác hai ô: 21/11 ”chỉ có ở POS” và 02/12 ”chỉ có ở GL”, số tiền bằng nhau. Cả năm bù trừ về 0 nhưng báo cáo tháng 11 của NX057 sai (đề ghi −74,6%) và tháng 12 sai ngược lại. Đây là loại lỗi mà bảng cầu nối cả năm che mất, chỉ đối soát chi tiết mới thấy.

<!-- Trang PDF: 37 -->

###### 2.3.8. Phí vận chuyển: +94.766,95 (−3,91%), quy tắc ghi nhận

Mỗi tháng GL có một bút toán tay MJ-SHIP (kênh WEB) ghi doanh thu phí vận chuyển ”theo bảng kê hãng vận chuyển”; Flash chỉ gồm giá trị hàng nên không có khoản này. Tổng 12 bút toán = 94.766,95, khớp từng tháng với cầu nối. Trong nhóm quy tắc ghi nhận, đây là khoản có tác động dương lên cầu nối cả năm, làm tăng GL so với Flash và có tham chiếu chứng từ.

###### 2.3.9. Tỷ giá: −57.598,01 (2,37%), quy tắc ghi nhận

Flash quy USD theo tỷ giá ngày giao dịch, GL theo tỷ giá cuối tháng. Khoản này đổi dấu theo tháng (từ +15.709 ở T2 đến −27.081 ở T12) và cộng cả năm −57,6 nghìn USD, tức 0,18% doanh số Flash. Sheet `Chi_tiet` của file cầu nối cho thấy khoản này được tính từ dưới lên, từng dòng giao dịch: 14.566 dòng (9.619 cửa hàng, 4.947 online), mỗi dòng truy về một dòng POS hoặc WEB gốc và bằng số tiền gốc ÷ tỷ giá cuối tháng − số tiền gốc ÷ tỷ giá ngày. Nhóm kiểm lại phép tính của cả 14.566 dòng: đúng tuyệt đối, tổng −57.598.

###### 2.3.10. Làm tròn: +1,01, sai số chấp nhận được

Flash làm tròn đến USD, GL có hai chữ số thập phân; mọi tháng |lệch| ≤ 1,83 USD, dưới ngưỡng 5 USD/tháng. Giữ riêng, không gộp với ADJ.

###### 2.3.11. Chưa giải thích được: +1.250,00 (−0,05%)

Bút toán MJ-ADJ-2509 (”ADJ-0925 điều chỉnh theo yêu cầu”), JE20250904892, ngày 30/09/2025, kênh UNALLOCATED, không gắn cửa hàng, không rõ căn cứ. Nó làm GL cao hơn Flash 1.250 USD. Quy ước của nhóm là luôn giữ ở nhóm ”chưa giải thích được”, không nhét vào làm tròn hay vận chuyển. Nhỏ về tiền nhưng là điểm yếu kiểm soát nội bộ (bút toán tay thiếu chứng từ, thiếu kênh).

Ghi chú: bút toán MJ-RCL-2506 (STORE NX019 −3.480 / WEB +3.480, tháng 6) tổng bằng 0 nên không có dòng ở bảng cầu nối toàn công ty, nhưng bắt buộc có dòng riêng ở cầu nối theo kênh (mục X.2.5).

##### 2.4. Bảng cầu nối 12 tháng

<!-- Trang PDF: 38 -->

<a id="bang-32"></a>

**Bảng 32. Cầu nối 12 tháng (USD, làm tròn đến đơn vị; ô tô vàng: hai khoản gây biến động tháng).**

| Khoản                      | T1        | T2        | T3        | T4        | T5        | T6        | T7        | T8        | T9        | T10       | T11       | T12       | Cả năm     |
| -------------------------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | --------- | ---------- |
| Flash                      | 2.859.589 | 3.490.159 | 2.001.911 | 1.035.907 | 2.802.769 | 2.506.912 | 2.248.805 | 2.569.740 | 2.576.818 | 2.743.824 | 2.806.714 | 3.481.253 | 31.124.401 |
| Chiết khấu                 | −161.715  | −205.977  | −129.143  | −61.301   | −170.282  | −144.454  | −129.896  | −154.327  | −144.308  | −165.415  | −164.682  | −202.797  | −1.834.297 |
| Dòng POS trùng             | 0         | 0         | −12.622   | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | −12.622    |
| Đơn online hủy             | −15.070   | −17.352   | −20.144   | −9.072    | −16.603   | −15.324   | −4.314    | −18.480   | −14.230   | −19.759   | −32.411   | −32.900   | −215.659   |
| Lệch thời điểm online      | −33.452   | −160.259  | +281.788  | −64.055   | −59.166   | +49.304   | +12.592   | −7.097    | −2.082    | −51.583   | +29.755   | −48.343   | −52.598    |
| Lệch ngày ghi sổ CH        | 0         | 0         | 0         | 0         | −41.465   | +41.465   | 0         | −75.240   | +75.240   | 0         | −80.589   | +80.589   | 0          |
| Lỗi chuyển dữ liệu (NX057) | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | −7.228    | +7.228    | 0          |
| Hàng trả                   | −20.109   | −30.630   | −37.120   | −11.716   | −33.368   | −16.804   | −49.257   | −25.392   | −14.091   | −26.188   | −39.474   | −44.999   | −349.148   |
| Phí vận chuyển             | +8.531    | +11.259   | +8.002    | +2.730    | +8.285    | +8.866    | +7.033    | +7.684    | +7.356    | +7.764    | +7.444    | +9.810    | +94.767    |
| Tỷ giá                     | −11.607   | +15.709   | +8.255    | +5.555    | −11.426   | −17.503   | +4.931    | −22.725   | +8.271    | +4.994    | −14.971   | −27.081   | −57.598    |
| Làm tròn                   | +1        | −1        | +1        | +0        | +1        | +0        | +1        | +0        | −2        | −1        | −0        | +1        | +1         |
| Chưa giải thích            | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | +1.250    | 0         | 0         | 0         | +1.250     |
| Sổ cái (GL)                | 2.626.167 | 3.102.907 | 2.100.929 | 898.049   | 2.478.746 | 2.412.462 | 2.089.895 | 2.274.165 | 2.494.221 | 2.493.636 | 2.504.559 | 3.222.760 | 28.698.496 |
| Kiểm tra (= 0)             | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0         | 0          |

<!-- Trang PDF: 39 -->

Kiểm tra bằng 0 ở mọi tháng nhưng mới chứng minh bảng tự khép kín; độ tin cậy từng khoản dựa trên việc nhóm dựng lại độc lập 5 khoản (chiết khấu, hủy, lệch thời điểm, hàng trả, vận chuyển) từ dữ liệu giao dịch.

- Hai khoản định hình biến động theo tháng: lệch thời điểm online (tháng 3 +281.788) và lệch ngày ghi sổ cửa hàng (±41.465, ±75.240, ±80.589). Cả hai tự bù trừ trong năm (cửa hàng 0; online −52.598).

- Các khoản còn lại (chiết khấu 5,6–6,5% Flash, hủy, trả, vận chuyển, tỷ giá) là nền ổn định theo tháng.

- Tháng 3 dương vì lệch thời điểm +281.788 lớn hơn tổng các khoản âm khác, đồng thời là tháng duy nhất có dòng POS trùng (−12.622).

##### 2.5. Phân rã chênh lệch theo kênh

<a id="bang-33"></a>

**Bảng 33. Phân rã ∆ theo kênh. Cộng theo khoản × kênh từ sheet `Chi_tiet`; dòng ”Tỷ giá + làm tròn” gộp FX (cửa hàng −29.357,97; online −28.240,05) và làm tròn (+1,02; −0,01). Các thành phần hiển thị được làm tròn riêng, nên có thể lệch 0,01 USD so với dòng gộp. Tổng cột = ∆ cả năm.**

| Khoản                            | Cửa hàng    | Online        | Chưa gắn kênh | Tổng          |
| -------------------------------- | ----------- | ------------- | ------------- | ------------- |
| Chiết khấu                       | −833.142,61 | −1.001.154,87 |               | −1.834.297,48 |
| Dòng POS trùng                   | −12.622,20  |               |               | −12.622,20    |
| Đơn online bị hủy                |             | −215.658,92   |               | −215.658,92   |
| Lệch thời điểm online            |             | −52.597,90    |               | −52.597,90    |
| Hàng trả                         |             | −349.148,23   |               | −349.148,23   |
| Phí vận chuyển                   |             | +94.766,95    |               | +94.766,95    |
| Chuyển kênh MJ-RCL-2506          | −3.480,00   | +3.480,00     |               | 0,00          |
| Lệch ngày ghi sổ; NX057 (cả năm) | 0,00        |               |               | 0,00          |
| Tỷ giá + làm tròn (`Chi_tiet`)   | −29.356,94  | −28.240,06    |               | −57.597,00    |
| Chưa giải thích (ADJ-0925)       |             |               | +1.250,00     | +1.250,00     |
| ∆ = GL − Flash                   | −878.601,75 | −1.548.553,02 | +1.250,00     | −2.425.904,77 |

Chiết khấu gần như bằng nhau về tỷ lệ ở hai kênh (cửa hàng 5,9%; online 5,9% của Flash). Online lệch nhiều hơn vì có thêm ba khoản chỉ online mới có (hủy, trả, lệch thời điểm): tổng −617.405 USD, bằng 3,6% Flash online, được bù một phần bởi phí vận chuyển +94.767 (0,6%).

Cửa hàng chỉ có chiết khấu, dòng trùng, chuyển kênh MJ-RCL và tỷ giá; hai khoản chuyển kỳ (ngày ghi sổ, NX057) bằng 0 cả năm.

<!-- Trang PDF: 40 -->

##### 2.6. Đối soát chi tiết xác nhận ở mức giao dịch

Đối soát chi tiết (Trang 3 của dashboard) kiểm chứng rằng các khoản chuyển kỳ và lỗi dữ liệu ở bảng cầu nối đúng là chuyển kỳ và lỗi, không phải mất dữ liệu. Phương pháp: gộp POS về cửa hàng × ngày × tiền, ghép Full Outer với GL (chỉ các bút toán POS_*), so bằng nội tệ (tránh nhiễu tỷ giá), 4 trạng thái: Khớp / Chỉ có ở POS / Chỉ có ở GL / Lệch tiền. USD (tỷ giá cuối tháng) chỉ dùng cho ngưỡng cảnh báo ⚠ .

<a id="bang-34"></a>

**Bảng 34. Kết quả đối soát chi tiết**

| Cấp đối soát                                     | Chưa xử lý (thô)                                                                  | Sau khi đưa về cùng cách tính                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Cửa hàng × ngày                                  | POS theo ngày bán, giữ 12 dòng trùng: gần như mọi Thứ Bảy, Chủ nhật, ngày lễ lệch | POS theo ngày ghi sổ, bỏ dòng trùng: 5.118/5.120 ô khớp; 2 ô lệch đều của NX057 |
| Cửa hàng vượt ngưỡng ⚠ (\|∆\| > 200 USD và > 1%) | 137 lượt cửa hàng×tháng (42 cửa hàng); T11: 21 cửa hàng, T12: 20                  | Chỉ NX057 (T11 và T12)                                                          |
| Online × ngày × tiền                             | Theo ngày đặt: không ô nào khớp; 1.779 ô lệch (Đã giao + Đã trả)                  | Theo ngày giao: 1.647/1.647 ô khớp                                              |
| Hàng trả × ngày trả                              | –                                                                                 | 159 bút toán `WEB_RETURN` khớp 100%                                             |

Ghi chú định nghĩa: ∆ online ”thô” ở Trang 3 là thuần lệch thời điểm (GL chỉ lấy `WEB_DELIVERY`, WEB theo ngày đặt); hàng trả được tách riêng ở cầu nối và đối soát hàng trả.

##### 2.7. Nhật ký ngoại lệ

<a id="bang-35"></a>

**Bảng 35. Nhật ký ngoại lệ**

| Mã    | Mô tả                                            | USD         | Nhóm                 | Trạng thái    |
| ----- | ------------------------------------------------ | ----------- | -------------------- | ------------- |
| EX-01 | NX007, 29/03: 12 dòng POS trùng (CAD)            | −12.622,20  | Lỗi dữ liệu          | Cần sửa nguồn |
| EX-02 | WEB: đơn đặt và giao khác tháng; tháng 3 tăng    | +281.787,98 | Quy tắc ghi nhận     | Đã xác định   |
| EX-03 | POS 31/05 ghi sổ 02/06; cả năm tự bù             | −41.464,78  | Quy tắc ghi nhận     | Đã xác định   |
| EX-04 | POS 30–31/08 ghi sổ 02/09; cả năm tự bù          | −75.240,30  | Quy tắc ghi nhận     | Đã xác định   |
| EX-05 | MJ-ADJ-2509 (UNALLOCATED): chưa rõ căn cứ        | +1.250,00   | Chưa giải thích được | Cần chứng từ  |
| EX-06 | NX057 21/11: thiếu lên sổ tháng 11               | −7.227,56   | Lỗi dữ liệu          | Đã bổ sung    |
| EX-07 | MJ-RCL-2506: STORE (NX019) chuyển sang WEB       | 0,00        | Quy tắc ghi nhận     | Đã xác định   |
| EX-08 | `POS_CATCHUP`: bổ sung 21/11 của NX057 vào 02/12 | +7.227,56   | Lỗi dữ liệu          | Đã bổ sung    |

<!-- Trang PDF: 41 -->

**Bảng 35 (tiếp)**

| Mã    | Mô tả                                     | USD        | Nhóm             | Trạng thái   |
| ----- | ----------------------------------------- | ---------- | ---------------- | ------------ |
| EX-09 | POS 29–30/11 ghi sổ 01/12; cả năm tự bù   | −80.588,85 | Quy tắc ghi nhận | Đã xác định  |
| EX-10 | Flash/GL làm tròn khác mức (cả năm +1,01) | +1,01      | Sai số chấp nhận | Trong ngưỡng |

Đơn hủy và hàng trả được theo dõi riêng tại mục X.2.3.3 và X.2.3.4; nhật ký trên tập trung vào các trường hợp cần truy vết.

##### 2.8. Các giả thuyết đã kiểm tra và loại bỏ

<a id="bang-36"></a>

**Bảng 36. Các giả thuyết đã kiểm tra và loại bỏ**

| Giả thuyết                         | Kết quả | Bằng chứng                                                                                  |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| Chênh lệch chủ yếu do POS trùng    | Loại    | Chỉ −12.622,20 = 0,52% của ∆ (0,04% Flash)                                                  |
| Lệch ngày ghi sổ là mất doanh thu  | Loại    | Cả năm 0; ba cặp tháng bù trừ chính xác (Bảng 31)                                           |
| NX057 mất doanh thu                | Loại    | Ghi bổ sung 02/12, JE20251206231, đúng 7.227,56 USD                                         |
| Tỷ giá là nguyên nhân chính        | Loại    | Chỉ −57.598 = 2,4% của ∆                                                                    |
| Online lệch vì mất đơn / giao chậm | Loại    | Theo ngày giao khớp 1.647/1.647; độ trễ giao ổn định ~3 ngày; lệch thời điểm cả năm −52.598 |
| Lệch do một thị trường cụ thể      | Loại    | ∆% đồng đều −7,0% đến −9,2% ở mọi tiền tệ (đối chiếu Flash và GL theo tiền tệ)              |
| MJ-RCL-2506 làm lệch tổng          | Loại    | STORE −3.480 và WEB +3.480; tổng bằng 0                                                     |

##### 2.9. Tổng hợp theo bốn nhóm nguyên nhân

<a id="bang-37"></a>

**Bảng 37. Tổng hợp 4 nhóm. Số theo bảng cầu nối**

| Nhóm                  | USD           | % của ∆ | Gồm                                                                                                  |
| --------------------- | ------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| Quy tắc ghi nhận      | −2.414.533,58 | 99,53%  | Chiết khấu, đơn hủy, lệch thời điểm online, hàng trả, phí vận chuyển, tỷ giá (+ lệch ngày ghi sổ: 0) |
| Lỗi dữ liệu           | −12.622,20    | 0,52%   | POS trùng (+ NX057: ±7.227,56 bù trừ về 0)                                                           |
| Chưa giải thích được  | +1.250,00     | −0,05%  | ADJ-0925                                                                                             |
| Sai số chấp nhận được | +1,01         | 0,00%   | Làm tròn                                                                                             |
| Tổng ∆                | −2.425.904,77 | 100,00% |                                                                                                      |

<!-- Trang PDF: 42 -->

#### 3. Cải thiện quy trình đối soát doanh thu

Nexa Home Năm tài chính 2025 Câu hỏi phân tích 3

Dựa trên các nguyên nhân chênh lệch đã xác định, cần cải thiện những bước nào trong quy trình ghi nhận, kiểm tra và đối soát để nâng cao hiệu quả và độ tin cậy của các kỳ báo cáo tiếp theo?

Nexa Home cần kiểm tra dữ liệu ngay khi nạp, xác nhận đủ bút toán trước khi khóa sổ và theo dõi riêng các khoản còn chờ chứng từ. Năm 2025, sổ cái (GL) thấp hơn báo cáo nhanh (Flash) 2.425.904,77 USD, tương đương 7,79% doanh số Flash. Chiết khấu là khoản điều chỉnh lớn nhất trong cầu nối, khoảng 1,83 triệu USD.

##### 3.1. Thống nhất quy tắc ghi nhận

Flash tính doanh số trước chiết khấu theo ngày bán POS hoặc ngày đặt online, kể cả đơn hủy. GL dùng giá sau chiết khấu, ghi doanh thu online khi giao và ghi giảm khi nhận trả. Sales và Finance cần lưu riêng trạng thái và từng mốc ngày. Bảng cầu nối cần tách đơn hủy, hàng trả, lệch kỳ và tác động của việc chuyển từ tỷ giá ngày bán hoặc ngày đặt sang tỷ giá cuối kỳ.

**Hình 3. Tỷ lệ hàng trả đạt đỉnh tháng 7 và số đơn hủy đạt đỉnh tháng 10**

**Số liệu đọc trực tiếp từ nhãn trong Hình 3:**

| Chỉ tiêu               | Kỳ       | Giá trị |
| ---------------------- | -------- | ------- |
| Tỷ lệ giá trị hàng trả | Cả năm   | 2,21%   |
| Tỷ lệ giá trị hàng trả | Tháng 7  | 4,20%   |
| Tỷ lệ giá trị hàng trả | Tháng 11 | 3,18%   |

| Tháng đặt hàng năm 2025 | Số đơn hủy |
| ----------------------- | ---------- |
| 01                      | 8          |
| 02                      | 14         |
| 03                      | 5          |
| 04                      | 7          |
| 05                      | 13         |
| 06                      | 8          |
| 07                      | 9          |
| 08                      | 9          |
| 09                      | 6          |
| 10                      | 18         |
| 11                      | 13         |
| 12                      | 14         |

> Hình gốc không ghi số chính xác tại mọi điểm của đường tỷ lệ hàng trả; bản Markdown chỉ chép các giá trị có nhãn, không suy đoán các điểm còn lại.

Tỷ lệ hàng trả bằng giá trị nhận trả trong tháng chia cho giá trị giao trong tháng, gồm cả đơn về sau được trả. Hai vế dùng giá sau chiết khấu và tỷ giá ngày đặt. Nguồn số liệu là `q_WEB_Raw`, `q_FX_Daily` và `fact_WEB_final`.

Hàng trả. Năm 2025 có 169 đơn được nhận trả, trị giá 349.148,23 USD (2,21%). Trong đó, 90 đơn được nhận trả khác tháng giao. Tách hai sự kiện khi tổng hợp giúp ghi khoản giảm trừ vào đúng kỳ.

Đơn hủy. 124 đơn hủy tương ứng 215.658,92 USD sau chiết khấu. Tháng 10 có 18 đơn hủy (2,30% số đơn đặt). Tháng 4 có tỷ lệ hủy cao nhất (2,51% với 7 đơn). Quý IV chiếm 39,45% giá trị hủy cả năm. Theo dõi cả ba chỉ số để nhận diện tháng cần rà soát.

<!-- Trang PDF: 43 -->

Giao hàng qua kỳ. 77 đơn đặt từ năm 2024 giao trong 2025 làm tăng 122.107,89 USD, còn 105 đơn giao sang 2026 làm giảm 174.705,79 USD. Tác động ròng đến cầu nối là −52.597,90 USD. Finance nên đối chiếu đơn chưa giao tại ngày chốt với danh sách giao đầu kỳ sau.

##### 3.2. Kiểm tra dữ liệu POS khi nạp

Trong 17.124 dòng POS nguồn có 12 dòng xuất lặp, tương ứng 12.622,20 USD sau chiết khấu theo tỷ giá ngày bán. Cả 12 dòng thuộc hai hóa đơn của NX007 bán ngày 29/03. Nội dung theo từng khóa giống nhau và thời điểm xuất lần hai là 08:42 ngày 30/03, sau lần đầu 9 giờ 27 phút.

<a id="bang-38"></a>

**Bảng 38. Hai hóa đơn POS được xuất lại cùng thời điểm**

| Mã hóa đơn | Số dòng lặp | Giá trị lặp (USD) |
| ---------- | ----------- | ----------------- |
| R3376006   | 6           | 8.167,11          |
| R3376008   | 6           | 4.455,09          |
| Tổng       | 12          | 12.622,20         |

Giá trị lặp bằng thành tiền trừ chiết khấu, quy đổi theo tỷ giá ngày bán. Nguồn số liệu là `q_POS_Raw`, `q_Store` và `q_FX_Daily`.

`q_POS_Cleaning` và phần POS của `Giao_Dich_Chung` có 17.112 dòng duy nhất. `fact_POS_final` vẫn giữ đủ 17.124 dòng. Khi làm mới báo cáo, nhóm dữ liệu nên lấy doanh thu từ bảng đã lọc trùng hoặc giữ `export_seq` = 1 sau khi xác nhận các bản sao theo khóa `receipt_no` + `line_no`. Lưu số dòng và giá trị loại bỏ theo đợt. Chuyển các trường hợp cùng khóa khác nội dung cho bộ phận vận hành POS xác minh.

##### 3.3. Đối chiếu POS với sổ cái trước khi khóa sổ

Đối chiếu theo cửa hàng × ngày hạch toán × tiền tệ cho thấy 5.118 trong 5.119 nhóm POS khớp với `POS_DAILY`. Ngoại lệ là hóa đơn R3613017 của NX057 ngày 21/11, gồm 7 dòng trị giá 7.227,56 USD. GL bổ sung khoản này ngày 02/12 qua bút toán `POS_CATCHUP` JE20251206231.

**Hình 4. Khoản ghi muộn của NX057 bù trừ khi cộng cả năm**

**Số liệu trong Hình 4 — Doanh thu GL trừ POS đã chuẩn hóa (USD):**

| Kỳ       | Chênh lệch của NX057 |
| -------- | -------------------- |
| Tháng 11 | −7.227,56            |
| Tháng 12 | +7.227,56            |
| Cả năm   | 0                    |

Đối chiếu POS đã lọc trùng và quy đổi theo tỷ giá cuối tháng với GL gồm `POS_DAILY` và `POS_CATCHUP`. Nguồn số liệu là `q_POS_Cleaning`, `q_Calendar`, `q_FX_MonthEnd`, `Doi_Soat_Chi_Tiet` và `fact_GL_final`.

<!-- Trang PDF: 44 -->

Mức lệch tuyệt đối bằng 74,55% GL tháng 11 và 20,16% GL tháng 12. Riêng theo lịch làm việc, 267 dòng POS có tháng hạch toán khác tháng bán. Trước khi khóa sổ, Finance cần đối chiếu hai chiều theo mã cửa hàng đã ánh xạ và ngày hạch toán dự kiến. Bút toán bổ sung cần liên kết với ngày, kỳ và mã ngoại lệ gốc.

##### 3.4. Rà soát bút toán tay và chứng từ

Phí vận chuyển chiếm 12 trong 15 bút toán tay. Tách nhóm này khỏi các khoản chuyển kênh và khoản điều chỉnh còn chờ xác minh để đối chiếu đúng theo mục đích.

<a id="bang-39"></a>

**Bảng 39. Tác động của bút toán tay theo mục đích ghi nhận**

| Nhóm bút toán                            | Số bút toán | Tác động ròng (USD) |
| ---------------------------------------- | ----------- | ------------------- |
| Phí vận chuyển (MJ-SHIP)                 | 12          | +94.766,95          |
| Chuyển doanh thu giữa kênh (MJ-RCL-2506) | 2           | 0,00                |
| Điều chỉnh chưa xác minh (MJ-ADJ-2509)   | 1           | +1.250,00           |
| Tổng                                     | 15          | +96.016,95          |

Tác động trình bày theo dấu doanh thu. Nguồn số liệu là `fact_GL_final`.

Cặp bút toán MJ-RCL-2506 giảm 3.480 USD ở STORE (NX019) và tăng cùng số tiền ở WEB. Cầu nối theo kênh cần giữ cả hai vế. Bút toán ADJ-0925 ngày 30/09 có mã tham chiếu MJ-ADJ-2509. Hồ sơ đối soát còn thiếu chứng từ gốc để xác minh mục đích và phân bổ. Giữ 1.250 USD trong GL và theo dõi riêng tại UNALLOCATED cho tới khi Finance xác minh.

Finance cần lưu liên kết chứng từ, mục đích, kỳ, cửa hàng hoặc kênh và người duyệt cho từng bút toán tay. Với khoản chuyển kênh, kiểm tra hai vế cùng mã tham chiếu và tổng bằng 0.

##### 3.5. Chốt bảng cầu nối và theo dõi ngoại lệ

Dashboard 4 phát hiện ngoại lệ ở 3/7 phép kiểm tra. Bốn phép còn lại kiểm tra đơn hủy có ngày giao, giao trước ngày đặt, trả trước ngày giao và POS tại cửa hàng đã đóng cửa. Nhóm dữ liệu nên chạy tự động bảy phép kiểm tra trong Power Query trên toàn kỳ trước khi áp bộ lọc hiển thị.

Trong `QC_Summary`, khoảng ngày POS bị đánh dấu Fail vì ô kỳ vọng trống, dù ngày bán nhỏ nhất là 01/01 và lớn nhất là 31/12/2025. Khai báo phạm vi kỳ vọng theo kỳ xuất tệp và so sánh trực tiếp các trường ngày.

Sửa cột Difference trong `q_Reconciliation` từ Flash − GL thành GL − Flash. Dùng dòng WEB tháng 02 để kiểm thử, với kết quả kỳ vọng −319.026,11 USD. Sai số kiểm tra tổng cầu nối sau điều chỉnh cần trong 1 USD.

Ở cấp cửa hàng × tháng, đánh dấu khi |GL − POS chuẩn hóa| vượt 200 USD và vượt 1% của |GL|. Theo dõi riêng các nhóm thiếu bút toán, thiếu chứng từ hoặc có mẫu số GL bằng 0. Nhật ký cần ghi kỳ gốc, giá trị, bằng chứng, người phụ trách, hạn và trạng thái xử lý. Finance duyệt các khoản còn mở trước khi phát hành và tiếp tục theo dõi ở kỳ sau.

<!-- Trang PDF: 45 -->

Đo hiệu quả qua các kỳ báo cáo. Ghi đường cơ sở ở kỳ đầu và so sánh qua các kỳ tiếp theo bằng thời gian từ chốt dữ liệu đến duyệt báo cáo, số ngoại lệ còn mở và tổng giá trị tuyệt đối chưa giải thích.

<a id="muc-xi"></a>

### XI. Phát hiện chính và hàm ý

#### 1. Chênh lệch theo tháng và kênh

01 — Ưu tiên theo đồng thời quy mô và tỷ lệ. Tháng 2 dẫn đầu về giá trị lệch tuyệt đối, nhưng tháng 4 cao nhất theo tỷ lệ. Dashboard và bảng đối soát cần cho phép xem cả |D| và D% trước khi chọn tháng để truy vết.

02 — Kiểm tra tháng đảo chiều thay vì suy đoán lỗi. Tháng 3 là ngoại lệ duy nhất khi Finance GL cao hơn Flash. Cần đi tiếp từ tháng → kênh → khoản điều chỉnh trong cầu nối và ngày ghi nhận để xác định lý do; riêng dấu âm không đủ chứng minh sai sót.

03 — Ưu tiên nhánh WEB trong bước drill-down. WEB đóng góp phần lớn chênh lệch ròng cả năm, vì vậy việc đối chiếu ngày đặt với ngày giao/nhận trả và đơn hủy là bước cần làm trong phần nguyên nhân; không kết luận ngay rằng WEB bị lỗi dữ liệu.

04 — Giữ nguyên khoản chưa phân bổ. Khoản 1.250 USD trong GL không thuộc STORE/WEB cần được báo cáo riêng và chuyển sang nhật ký ngoại lệ để Finance yêu cầu chứng từ, thay vì gán cưỡng ép vào một kênh.

#### 2. Nguyên nhân chênh lệch và lỗi dữ liệu

##### 2.1. Trả lời ngắn

- Chênh lệch −2.425.904,77 USD gồm 11 khoản (Bảng 29). 99,5% (−2.414.533,58) là chênh lệch do hai báo cáo định nghĩa doanh thu khác nhau (chiết khấu −1.834.297,47; hàng trả −349.148,23; đơn hủy −215.658,92; tỷ giá −57.598,01; lệch thời điểm online −52.597,90; trừ phí vận chuyển +94.766,95): đây không phải lỗi.

- Lỗi dữ liệu thật chỉ có một khoản vĩnh viễn: 12 dòng POS trùng −12.622,20 (0,5%); thêm một lỗi chuyển dữ liệu của NX057 (±7.227,56) tự bù về 0 trong năm. Một khoản chưa giải thích được: ADJ-0925, +1.250. Làm tròn +1,01.

- Lệch ngày ghi sổ chỉ dịch chuyển kỳ; MJ-RCL chỉ chuyển doanh thu giữa các kênh. Cả hai có tác động ròng bằng 0 khi cộng cả năm ở cấp toàn công ty. Phần cần xử lý như ”lỗi hoặc bất thường” là 12.622,20 + 1.250 = 13.872,20 USD, tương đương 0,57% |∆| và 0,04% Flash.

<!-- Trang PDF: 46 -->

##### 2.2. Bảng tóm tắt

<a id="bang-40"></a>

**Bảng 40. Tóm tắt trả lời câu hỏi 2. Tổng: −2.425.904,77 USD. Nguồn: Bảng 29.**

| Khoản                 | USD           | % của ∆ | Nhóm            | Có phải lỗi? | Bằng chứng chính                                                            |
| --------------------- | ------------- | ------- | --------------- | ------------ | --------------------------------------------------------------------------- |
| Chiết khấu            | −1.834.297,47 | 75,61%  | Quy tắc         | Không        | Flash = giá trước giảm giá (mục IX.1); Σ discount tái tính                  |
| Hàng trả              | −349.148,23   | 14,39%  | Quy tắc         | Không        | 169 đơn trả 2025, tái tính đúng từng tháng                                  |
| Đơn online hủy        | −215.658,92   | 8,89%   | Quy tắc         | Không        | 124 đơn; Flash gồm đơn hủy (mục X.2.3.3)                                    |
| Tỷ giá                | −57.598,01    | 2,37%   | Quy tắc         | Không        | Tỷ giá cuối tháng so với tỷ giá ngày; đã kiểm lại 14.566 dòng (mục X.2.3.9) |
| Lệch thời điểm online | −52.597,90    | 2,17%   | Quy tắc         | Không        | Dựng lại đúng từng tháng (Bảng 30)                                          |
| Phí vận chuyển        | +94.766,95    | −3,91%  | Quy tắc         | Không        | 12 bút toán MJ-SHIP, tái tính đúng                                          |
| Dòng POS trùng        | −12.622,20    | 0,52%   | Lỗi dữ liệu     | Có           | EX-01: NX007, 29/03, 12 dòng                                                |
| Lệch ngày ghi sổ CH   | 0,00          | 0,00%   | Quy tắc         | Không        | 3 cặp bù trừ (Bảng 31)                                                      |
| Lỗi chuyển NX057      | 0,00          | 0,00%   | Lỗi dữ liệu     | Có (tự bù)   | ±7.227,56; JE20251206231                                                    |
| Làm tròn              | +1,01         | 0,00%   | Sai số          | Không        | Mỗi tháng < 5 USD                                                           |
| ADJ-0925              | +1.250,00     | −0,05%  | Chưa giải thích | Chưa rõ      | Bút toán tay, UNALLOCATED, thiếu căn cứ                                     |

##### 2.3. Diễn giải các phát hiện

##### Phát hiện 1. Chênh lệch chủ yếu là chênh lệch định nghĩa, không phải thất thoát.

- Ý nghĩa: Flash là doanh số trước giảm giá, theo ngày đặt, gồm hủy/trả; GL là doanh thu đã ghi nhận. Hai bộ phận đang nói về hai ”doanh thu” khác nhau mà không ghi rõ.

- Bằng chứng: Tái dựng Flash khớp ≤ 2 USD/tháng (đối chiếu từ POS và WEB); mỗi khoản có dòng giao dịch trong sheet `Chi_tiet` (DISCOUNT 17.376 dòng, CANCEL 124, RETURN 169, SHIP 12…); 99,5% ∆ thuộc nhóm quy tắc (Bảng 37).

##### Phát hiện 2. Chiết khấu một mình chiếm 75,6% ∆ và rất ổn định (5,6–6,5% Flash mỗi tháng).

- Ý nghĩa: Cách nhanh nhất để thu hẹp khoảng cách là đưa doanh thu sau giảm giá vào Flash; không cần sửa dữ liệu nguồn.

<!-- Trang PDF: 47 -->

- Bằng chứng: Bảng 32 (dòng chiết khấu), mục X.2.3.1.

##### Phát hiện 3. Đơn hủy và hàng trả cộng lại chiếm 23,3% ∆ (564.807 USD); giá trị hủy ở T11–T12 cao do vài đơn lớn, không do tỷ lệ hủy tăng.

- Ý nghĩa: Hai khoản này vừa gây chênh lệch vừa là chỉ số vận hành: Flash tính cả đơn không thành doanh thu. Nên theo dõi cả số đơn lẫn giá trị đơn hủy; riêng các đơn lớn cần chú ý vì một đơn 13.542 USD đã bằng 42% giá trị hủy của tháng 11.

- Bằng chứng: mục X.2.3.3, X.2.3.4; T11: 13 đơn hủy (1,8%), đơn lớn nhất 13.542 USD; T12: 14 đơn (1,6%), ba đơn trên 7.000 USD. Lý do hủy: [CẦN XÁC NHẬN].

##### Phát hiện 4. Biến động theo tháng chủ yếu là chuyển kỳ và tự bù trừ.

- Ý nghĩa: Không nên kết luận ”tháng 3 tốt” hay ”tháng 11 thiếu 302 nghìn” từ ∆ tháng. Tháng 3 dương do đơn cuối T2 giao T3 (+281.788); T11 âm do hàng cuối tuần ghi sang T12 (−80.589). Cần so cùng cơ sở trước khi đánh giá.

- Bằng chứng: Bảng 30, 31; cả năm: ngày ghi sổ 0, online −52.598.

##### Phát hiện 5. Lỗi dữ liệu thật rất nhỏ về tiền nhưng cho thấy lỗ hổng quy trình.

- Ý nghĩa: POS xuất trùng (NX007, 12 dòng) và lỗi chuyển POS → GL ở NX057 (bỏ sót 11 ngày: 21/11 đến 02/12) chỉ lộ ra khi đối soát chi tiết cửa hàng × ngày; bảng cầu nối cả năm không thấy NX057 vì tự bù về 0. Do đó đối soát phải chạy ở mức chi tiết và theo tháng, không chỉ tổng năm.

- Bằng chứng: mục X.2.3.2, X.2.3.7, X.2.6; EX-01, EX-06, EX-08.

##### Phát hiện 6. ADJ-0925 (1.250 USD) nhỏ về tiền nhưng là điểm yếu kiểm soát.

- Ý nghĩa: Một bút toán tay thiếu căn cứ và thiếu kênh/cửa hàng; chỉ lộ ra khi kiểm tra tổng các kênh bằng tổng GL. Cần checklist trước khóa sổ: mọi bút toán tay phải có chứng từ và kênh.

- Bằng chứng: mục X.2.3.11; EX-05.

##### Phát hiện 7. Phí vận chuyển bù trừ một phần chênh lệch giữa GL và Flash.

- Ý nghĩa: Theo phạm vi hiện tại, Flash chưa bao gồm doanh thu phí vận chuyển (94.767 USD/năm, có chứng từ). Định nghĩa Flash nếu được viết lại cần quyết định có gồm phí vận chuyển hay không.

- Bằng chứng: mục X.2.3.8; 12 bút toán MJ-SHIP.

<!-- Trang PDF: 48 -->

##### Phát hiện 8. Online gây 63,8% ∆ vì có thêm ba khoản chỉ online mới có (hủy, trả, lệch thời điểm).

- Ý nghĩa: ∆ từng kênh là số đo trực tiếp (Flash so với GL). Phần giải thích: chiết khấu cùng tỷ lệ 5,9% ở hai kênh, nên khoảng cách ∆% (online −9,1%, cửa hàng −6,2%) đến từ hủy, trả, lệch thời điểm (tổng −617.405, 3,6% Flash online), được bù một phần bởi phí vận chuyển (+0,6%). Online lệch gấp 1,8 lần cửa hàng (−1.548.553 so với −878.602) nên nên ưu tiên chuẩn hóa định nghĩa ở kênh online trước.

- Bằng chứng: Bảng 33 khớp sheet `Chi_tiet` (cột Kenh); hủy, trả, lệch thời điểm, vận chuyển, chiết khấu tái tính

#### 3. Kiểm soát và cải thiện quy trình

Quy tắc ghi nhận giải thích phần lớn chênh lệch. Chiết khấu làm giảm 1,83 triệu USD trong cầu nối, tương đương khoảng 76% độ lớn chênh lệch ròng giữa Flash và GL.

Sai lệch POS lộ ra ở cấp chi tiết. Hai hóa đơn NX007 có 12 dòng xuất lặp. Tại NX057, khoản 7.227,56 USD thiếu tháng 11 và bù tháng 12, nên POS đã chuẩn hóa và GL khớp khi cộng cả năm.

Cầu nối khớp số vẫn có thể chứa khoản cần xác minh. ADJ-0925 đã ghi 1.250 USD vào GL. Mã tham chiếu giúp tìm bút toán, còn mục đích và căn cứ phân bổ vẫn cần chứng từ gốc.

Cờ Fail có thể phản ánh cách đặt phép kiểm tra. `QC_Summary` báo Fail về khoảng ngày POS vì ô kỳ vọng trống. Ba trong bảy phép kiểm tra trên Dashboard 4 phát hiện ngoại lệ nghiệp vụ.

Nguồn phân tích chính là `Nexa_Home_Recon_Dataset.xlsx`, đối chiếu với các tệp nguồn POS, WEB, GL và Flash. Quy ước ghi nhận và ngưỡng kiểm tra theo Bộ quy tắc ghi nhận, mục C.1–C.3. Mốc trích xuất là 15/01/2026.

<!-- Trang PDF: 49 -->

<a id="muc-xii"></a>

### XII. Khuyến nghị cải thiện quy trình

<a id="bang-41"></a>

**Bảng 41. Kế hoạch cải thiện theo từng bước**

| Bước     | Nguyên nhân | Thay đổi đề xuất | Phụ trách / thời hạn | Chỉ số kiểm tra |
| -------- | ----------- | ---------------- | -------------------- | --------------- |
| Ghi nhận | [Điền]      | [Điền]           | [Điền]               | [Điền]          |
| Kiểm tra | [Điền]      | [Điền]           | [Điền]               | [Điền]          |
| Đối soát | [Điền]      | [Điền]           | [Điền]               | [Điền]          |

[Xếp thứ tự triển khai và ghi mốc so sánh cho kỳ sau, chẳng hạn tỷ lệ khớp, ngoại lệ còn mở hoặc thời gian hoàn tất đối soát.]

<a id="muc-xiii"></a>

### XIII. Hạn chế và bước tiếp theo

[Ghi dữ liệu hoặc bằng chứng còn thiếu, phạm vi kết luận và những việc cần kiểm tra lại trong kỳ tiếp theo.]

<!-- Trang PDF: 50 -->

<a id="muc-xiv"></a>

### XIV. Tài liệu tham khảo

- [Tên bộ dữ liệu, phiên bản và ngày trích xuất.]

- [Tên tệp đối soát hoặc dashboard, phiên bản và vị trí lưu.]

- [Tài liệu mô tả quy tắc doanh thu, tỷ giá hoặc quy trình chốt kỳ.]

##### Phụ lục

[Đính kèm từ điển trường, quy tắc ghép khóa, bảng kiểm tra chất lượng hoặc danh sách ngoại lệ cần truy vết.]
