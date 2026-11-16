# Hướng dẫn tương tác Nexa Home

Hướng dẫn thao tác trên các màn hình và form của ứng dụng, trong một phiên mẫu riêng. Mỗi lần mở hoặc tải lại trang, **màn hình giới thiệu** tự hiện (mục bên dưới); trang cuối có **Xem dữ liệu mẫu trong ứng dụng**, **Thực hành có hướng dẫn**, **Nhập dữ liệu của tôi** và **Bỏ qua giới thiệu**. Nút **Hướng dẫn sử dụng** mở lại màn hình giới thiệu. Chọn thực hành thể hiện đồng ý dùng dữ liệu mẫu.

Từ 15/11/2026 không còn **trình diễn tự động**: hướng dẫn chỉ còn chế độ tự làm, trong đó người dùng thao tác trên màn hình thật và hướng dẫn kiểm tra kết quả.

## Màn hình giới thiệu

`src/components/intro/ProductIntro.tsx` là hộp thoại lớn trên nền ứng dụng làm mờ, cùng kiểu với vùng **Phóng to** của dashboard (96vw × 92dvh), tiêu đề **Giới thiệu Reconcile - Dự án Báo cáo đối soát doanh thu**, dòng phụ là chip **Team eDA_Sale** kèm khẩu hiệu **We Analyze**. Bên trái là danh sách 8 bước theo thứ tự của quy trình:

| Bước          | Nội dung                                                                                                                                                                                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Giới thiệu | Bài toán Sales Flash ↔ Finance GL; chênh lệch −2.425.904,77 USD, ghi cả hai quy ước: −7,79% so với Flash (dashboard, workbook) và −8,45% so với GL (báo cáo).                                                                                                   |
| 2. Quy trình  | Năm bước: nạp workbook → rà soát kế toán → nhật ký ngoại lệ → quy tắc ghi nhận → dashboard, kèm số liệu Nexa Home; mỗi bước mở màn hình tương ứng.                                                                                                              |
| 3–7           | Ảnh chụp màn hình thật ở chế độ Excel tham chiếu, có chú thích đánh số: **Nạp workbook** (tiến trình nạp, bảng Xử lý dữ liệu), **Rà soát kế toán**, **Nhật ký ngoại lệ**, **Quy tắc ghi nhận** (tài liệu quy ước, thời điểm ghi nhận), **Dashboard** (4 trang). |
| 8. Bắt đầu    | **Xem dữ liệu mẫu trong ứng dụng** (nhãn **Khuyến nghị**, nút **Bắt đầu tại đây**), **Thực hành có hướng dẫn**, **Nhập dữ liệu của tôi**.                                                                                                                       |

Chuyển bước bằng danh sách bên trái, nút Trước/Tiếp hoặc phím ←/→; trang Giới thiệu không có nút trên đầu mà dùng nút **Xem quy trình**. Esc, nút đóng, **Bỏ qua giới thiệu** hoặc bất kỳ lựa chọn nào cũng đóng giới thiệu cho đến lần tải trang sau.

Bước 3–7 (`IntroShots.tsx`) hiển thị ảnh WebP trong `src/assets/intro/`, chụp ở 1280 × 800 điểm ảnh CSS, mật độ 2×. Ảnh và 3–5 chú thích đánh số bên cạnh được co theo khoảng trống còn lại của hộp thoại (container query `cqw`/`cqh`), nên các bước này không phải cuộn; trên cửa sổ rất thấp chỉ danh sách chú thích cuộn bên trong. Bước có nhiều ảnh dùng nhãn ngắn trên một hàng. Trỏ chuột, focus hoặc bấm vào chú thích hay số trên ảnh sẽ làm nổi bật vùng tương ứng và làm mờ phần còn lại; bấm lần nữa để bỏ. Bước có nhiều ảnh có nút chọn màn hình; **Phóng to ảnh** (hoặc bấm vào ảnh) mở ảnh lớn trong hộp thoại riêng, Esc chỉ đóng ảnh. Phần giới thiệu không tải workbook. **Mở trong ứng dụng** mở đúng màn hình đó với dữ liệu mẫu để tự thao tác.

Khi giao diện các màn hình thay đổi, chụp lại ảnh:

```sh
npm run build
npx vite preview --port 4319 --strictPort
node scripts/capture-intro-shots.mjs http://localhost:4319/
```

Script mở chế độ **Tạm xem theo Excel** bằng Chrome hoặc Edge headless (`CHROME_PATH` nếu không tìm thấy), ghi đè 10 ảnh và lưu vị trí các vùng giao diện vào `tmp/intro-shot-boxes.json`. Nếu bố cục đổi, cập nhật tọa độ `box` (phần trăm của ảnh) trong `src/lib/product-intro.ts`.

`ProductIntroProvider` nằm trong `App.tsx`, ngoài `HashRouter`, và được import sau các trang nên stylesheet của nó nằm cuối bundle CSS. Hướng dẫn tương tác mở giới thiệu qua `intro-context.ts`. **Mở trong ứng dụng** và **Xem dữ liệu mẫu trong ứng dụng** gọi `allowReferenceSwitch()`, đổi hash URL rồi `loadExcelReference()` trên store chính; bảng tiến trình tự đóng khi workbook sẵn sàng.

Mọi số trong trang Giới thiệu, Quy trình và các chú thích nằm trong `INTRO_SAMPLE` của `src/lib/product-intro.ts`. `tests/product-intro.test.mjs` đối chiếu từng số với `docs/source/Nexa_Home_Recon_Dataset_Final.xlsx` và với dashboard dựng từ workbook đi kèm (`parseExcelReference`, `buildDashboardModel`). Test cũng kiểm tra kích thước từng ảnh và kiểm tra các vùng chú thích nằm trong ảnh.

## Phiên mẫu và điều khiển

Nhãn **Đang thực hành với dữ liệu mẫu Nexa Home** giúp nhận biết phiên minh họa. `GuideWorkspace` cấp store và DuckDB riêng cho mẫu; store gốc tiếp tục tồn tại. Thoát trả lại URL/không gian ban đầu. Chạy lại chỉ hủy và tạo lại phiên mẫu. Không lưu file, kết quả tài chính hoặc hồ sơ vào localStorage.

Màn hình giới thiệu tự mở một lần trong mỗi lần tải trang, ở bất kỳ màn hình nào trang mở ra (`claimIntroAutoOpen()` trong `src/lib/product-intro.ts`, gọi từ `InteractiveGuideProvider`). Trạng thái này nằm trong bộ nhớ module, không lưu vào localStorage. Tải lại trang thì giới thiệu hiện lại. Chuyển màn hình, bắt đầu hoặc thoát phiên thực hành trong cùng lần tải thì không hiện lại. Khóa `GUIDE_STORAGE_KEY` cũ không còn được đọc hay ghi.

Khung hướng dẫn có highlight, tiến độ chương, bước trước/tiếp, Thử lại, Về cấu hình, chạy lại và thoát. Mỗi bước mở màn hình tương ứng một lần, rồi kiểm tra state/DOM thực tế trước khi cho đi tiếp. Các bước có nút riêng (nạp workbook mẫu, áp dụng preset Master/Dim, chạy Raw, chọn Excel tham chiếu) chỉ chạy khi người dùng bấm. Bỏ qua hướng dẫn không bỏ qua validation nguồn.

Khung điều khiển giữ vị trí trong mỗi bước; highlight đi theo trường hiện tại. Overlay chỉ đo vị trí, không cuộn trang hoặc chuyển vào popup chọn trường.

## Nguồn dữ liệu

Nguồn chuẩn là `docs/source/Nexa_Home_Recon_Dataset_Final.xlsx`, được đóng gói nguyên bản tại `public/demo/Nexa_Home_Recon_Dataset_Final.xlsx`. Bộ mẫu chỉ tải từ `${BASE_URL}demo/Nexa_Home_Recon_Dataset_Final.xlsx` sau khi người dùng bắt đầu; URL không chứa `public` hoặc đường dẫn máy cá nhân. `guide-sample.ts` đọc workbook một lần, chia sẻ workbook trong cache cho các vai trò, tạo `File` và đưa qua cơ chế nhập/preview/ánh xạ hiện có. Workbook tham chiếu cũ gồm 3 sheet và 10 ngoại lệ vẫn là chế độ riêng.

| Vai trò           | Sheet nguồn              |
| ----------------- | ------------------------ |
| POS               | `01a_Nguon_POS`          |
| WEB               | `01b_Nguon_WEB`          |
| GL                | `01c_Nguon_GL`           |
| Sales Flash       | `01d_Nguon_Flash`        |
| Danh mục cửa hàng | `01e_Master_Cua_Hang`    |
| Lịch              | `01f_Master_Lich`        |
| FX ngày           | `01g_Master_TyGia_Ngay`  |
| FX tháng          | `01h_Master_TyGia_Thang` |

Các sheet `02_Giao_Dich_Chung`, `02a_POS_chuan_hoa`, `02b_Web_chuan_hoa`, `02c_GL_chuan_hoa`, `02d_Flash_chuan_hoa`, `03a_Doi_soat_Cua_hang`, `03b_Doi_soat_Online`, `03c_POS_Dong_trung`, `QC_Summary`, `04a_Cau_noi_Flash_GL`, `04b_Truy_vet`, `04c_So_sanh_ty_gia` và `05_Nhat_ky_ngoai_le` là bằng chứng đầu ra Excel. Xem các sheet này không chứng minh pipeline Raw đã tái tạo được kết quả.

Các mốc kiểm tra lấy từ workbook:

| Phạm vi                     | Kết quả                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| POS nguồn                   | 17.124 dòng; 17.112 khóa `receipt_no + line_no`                     |
| POS trùng                   | 12 nhóm; 24 dòng trong nhóm; 12 bản xuất dư                         |
| POS chuẩn hóa và bảng chung | `02a` giữ bản lặp để audit; phần POS của bảng chung giữ 17.112 khóa |
| WEB                         | 9.441 đơn; 139 Cancelled toàn file; 124 theo ngày đặt năm 2025      |
| GL                          | 6.940 bút toán, gồm 15 MANUAL đã có trong tổng GL                   |
| Flash                       | 156 dòng chi tiết; 31.124.401 USD                                   |
| Doanh thu GL năm 2025       | 28.698.496,23 USD sau đổi dấu sổ cái                                |

Giữ WEB giao thời giữa các năm để phân biệt ngày đặt, ngày giao và ngày trả. Flash dùng tháng nguồn làm nhãn kỳ; khi cần ngày cuối tháng, chuyển về cuối đúng kỳ. GL giữ USD gốc và dấu sổ cái, biểu diễn doanh thu riêng; không quy đổi FX thêm.

## Các chương và điều kiện chuyển bước

Mỗi bước khai báo mã, chương, màn hình, selector ổn định, lý do, thao tác, kết quả, hành động, điều kiện chờ và cách xác minh. Nội dung ở `src/lib/interactive-guide.ts`; lớp thao tác DOM ở `src/lib/guide-dom.ts`. Selector dùng `data-tour`, không dùng tọa độ hay thứ tự phần tử.

| Chương        | Nội dung và điều kiện                                                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Tổng quan  | Mở luồng Nhập dữ liệu thật; chỉ hoàn thành sau khi cấu hình nguồn đã mở.                                                                                                                 |
| 2. Nhập mẫu   | Tải và đọc workbook thành công; kiểm tra sheet; giữ tên nguồn và phạm vi dữ liệu.                                                                                                        |
| 3. Ánh xạ     | Chọn sheet cho POS/WEB/GL/Flash và rà soát các trường trên form; xác minh mapping hiện tại theo preset Nexa Home.                                                                        |
| 4. Master/Dim | Chọn sheet/cột/khóa cho cửa hàng, lịch, FX ngày/tháng; chờ validation quan hệ thực tế trả về hợp lệ. Preset được ghi rõ và có thể chỉnh trên form.                                       |
| 5. Xử lý      | Chạy kiểm tra Raw; dừng ở giới hạn được phát hiện. Chỉ đọc đầu ra Excel sau lựa chọn chuyển chế độ rõ ràng. Xem Raw, chuẩn hóa, bản POS giữ/loại, nối tham chiếu, USD, bảng chung và QC. |
| 6. Rà soát    | Dùng snapshot GL được chuẩn hóa bằng dịch vụ GL thật; lọc MANUAL, mở SHIP/RCL/ADJ, nhập và lưu ghi chú, tạo yêu cầu chứng từ trong phiên. Xác minh quyết định/history đã lưu.            |
| 7. Ngoại lệ   | Hiển thị đúng 7 dòng gốc, giữ trường/trạng thái, liên kết hồ sơ đã có; không tạo lại bút toán hoặc ngoại lệ.                                                                             |
| 8. Ghi muộn   | Mở EX-06 và truy vết POS 21/11/2025, 570/NX057, 7.227,56 USD; GL `JE20251206231` đã ghi 02/12/2025. Giữ ảnh hưởng từng tháng/ngày.                                                       |
| 9. Dashboard  | Mở Tổng quan và Cầu nối tháng 12/2025; mở chi tiết khoản mục; mở Đối soát chi tiết và Chất lượng cả năm 2025; phóng to rồi đóng bằng chức năng dashboard hiện có, giữ bộ lọc.            |

## Chế độ Raw và tham chiếu Excel

Raw thực hiện nhập, projection và các bước POS/GL thật trước khi gặp kiểm soát WEB. Raw hiện chưa quy đổi đủ WEB nội tệ theo các ngày đặt/giao/trả. Lịch master cũng chưa tái tạo đầy đủ ngày ghi sổ kế tiếp và mọi trường hợp chuyển kỳ của workbook. Hướng dẫn dừng có giải thích; không coi số WEB nội tệ là USD và không đánh dấu Raw đã hoàn tất. Lựa chọn chuyển sang **tham chiếu Excel** luôn cần người dùng bấm riêng.

`guide-reference.ts` tạo một view tương thích trong bộ nhớ từ workbook đã đọc, rồi gọi `loadExcelReference(file, { expectedExceptionCount: 7 })` hiện có:

- `Cau_noi` sao chép nhãn và toàn bộ cached values tại `04a_Cau_noi_Flash_GL!B7:O22`, gồm dòng tiêu đề và 15 dòng khoản mục (kể cả dòng kiểm tra); giữ số lẻ và chênh lệch.
- `Nhat_ky_ngoai_le` giữ đủ 7 dòng từ `05_Nhat_ky_ngoai_le`. Chuỗi kỳ như `2025-05 → 06` có dạng chuẩn để lọc; cột **Kỳ nguồn** vẫn giữ nguyên chuỗi Excel.
- `Chi_tiet` dùng dòng chuẩn hóa thật cho 124 đơn hủy theo ngày đặt năm 2025, 12 bản POS xuất dư, hàng trả theo ngày trả, 12 SHIP và ADJ. Các khoản DISCOUNT, WEB_TIMING, POS_TIMING, INTERFACE, FX, ROUND giữ hạt **tổng hợp tháng** từ ô cầu nối, mã giao dịch để trống và ghi rõ không phải từng giao dịch. Các cột provenance chỉ đến sheet/dòng/ô gốc.

Không bổ sung khoản cân bằng. Cầu nối gốc có phần dư cả năm khoảng **−0,03182728 USD**. Workbook dùng ngưỡng **0,10 USD** tại `04a_Cau_noi_Flash_GL!C26`; bộ kiểm tra tham chiếu hiện có dùng **0,01 USD**, nên một số dòng kiểm tra vẫn báo cần xem lại. Đây là khác biệt ngưỡng, không được sửa số nguồn để làm phép kiểm tra đạt. Ô chưa có kết quả trong `QC_Summary` vẫn là chưa đánh giá.

Dashboard tham chiếu hiện chưa có đủ snapshot cửa hàng–ngày hoặc phân bổ kênh/quốc gia để tái tạo mọi biểu đồ chi tiết Raw. Những vùng thiếu dữ liệu tiếp tục hiển thị lý do trên dashboard. Bảng bằng chứng nguồn và EX-06 cho phép xem dữ liệu workbook liên quan; hướng dẫn không tự suy ra USD từ số nội tệ của bảng đối soát. KPI 124 đơn hủy và 12 bản POS dư có bằng chứng chi tiết; 15 MANUAL được kiểm tra trong snapshot GL riêng.

## Chứng từ và ngoại lệ

15 MANUAL không được nhập/cộng thêm. Nhóm SHIP gồm `MJ-SHIP-2501` đến `MJ-SHIP-2512`, tổng 94.766,95 USD; `JE20250100572` là 8.531,49 USD. Hai bút toán `JE20250603115`/`JE20250603117` cùng `MJ-RCL-2506`, STORE giảm và WEB tăng 3.480 USD; tổng công ty bằng 0. ADJ `JE20250904892`, `MJ-ADJ-2509`, ngày 30/09/2025, amount_usd −1.250 và doanh thu +1.250, vẫn chưa giải thích.

| Mã gốc | Trạng thái gốc                                 |
| ------ | ---------------------------------------------- |
| EX-01  | Cần sửa nguồn                                  |
| EX-02  | Cần đối chiếu                                  |
| EX-03  | Cần đối chiếu                                  |
| EX-04  | Cần đối chiếu                                  |
| EX-05  | Chưa giải thích                                |
| EX-06  | Cần xác minh                                   |
| EX-07  | Đã xác định nguyên nhân, cần xác nhận chứng từ |

Không có bản gốc chứng từ trong workbook. `source_ref` không xác nhận đã xem chứng từ. Yêu cầu bổ sung bằng chứng là công việc trong tab, không gửi email hay ghi ERP. Hướng dẫn không thêm catch-up cho EX-06 hoặc thay ngày nguồn. Các số làm tròn của nhật ký vẫn tách khỏi số tính tại cầu nối. Không dùng EX-08 đến EX-10 của bộ tham chiếu mở rộng như ngoại lệ gốc Nexa Home.

Kết thúc hiển thị các bước hoàn thành/có giới hạn và ngoại lệ còn mở. **Hoàn thành hướng dẫn không đồng nghĩa đã xác nhận đủ chứng từ hoặc đóng toàn bộ ngoại lệ.**

## Cập nhật và kiểm tra

Khi thay mẫu, giữ workbook nguồn và kiểm tra lại cấu trúc, cached values, công thức và phạm vi. Sửa `GUIDE_SOURCE_SHEETS`, `GUIDE_MASTER_SHEETS`, `GUIDE_COLUMNS` cùng preset trong `guide-sample.ts`; cập nhật nhãn, thao tác và điều kiện xác minh tương ứng. Không thay mapping chỉ để bỏ qua validation. Khi đổi DOM, giữ `data-tour` hoặc đổi cả script và test cùng lúc. Giữ tính lặp an toàn của thao tác nhập/lưu/yêu cầu chứng từ; thao tác hướng dẫn thuộc lịch sử phiên mẫu.

Kiểm tra tự động có thể chạy:

```sh
npm run typecheck
npm test
npm run build
npm run test:production
```

`tests/guide-reference.test.mjs` đối chiếu tất cả giá trị cầu nối với ô nguồn, 7 ngoại lệ và trường gốc, 139/124 đơn hủy, 12 bản dư, SHIP/ADJ, phần dư, provenance và lỗi thiếu cached value. Test UI dashboard/rà soát/tiến trình kiểm tra các handler và phóng to hiện có. Production check phải xác minh workbook mẫu trả về byte ZIP và không trả HTML.

Kết quả kiểm tra triển khai ngày 14/11/2026: toàn bộ **242/242 test đạt**, TypeScript và build production đạt; lint hoàn tất với cảnh báo. `guide-assets.test.mjs` kiểm tra nạp lười qua HTTP dev với base `/reconcile-check/`, đúng URL `demo/...`, 21 sheet, 7 ngoại lệ và SHA-256 trùng file trong `docs/source/`. Production HTTP check xác nhận workbook mẫu ZIP và đủ 21 sheet. Test tương tác đi qua 33 bước, gồm các form Master/Dim thật, rà soát GL, EX-06, cả 4 dashboard, bộ lọc, chi tiết cầu nối, phóng to/đóng, pause/resume/replay và bảo toàn store gốc. Trong test điều phối, biên chạy Raw/validation được tiêm kết quả; test DuckDB riêng chạy toàn bộ workbook thật đến giới hạn WEB FX. Chưa kiểm tra bố cục trên trình duyệt thật vì môi trường không có trình duyệt khả dụng.

Kết quả kiểm tra ngày 16/11/2026 (bỏ trình diễn tự động; màn hình giới thiệu dạng hộp thoại, bước 3–7 là ảnh màn hình có chú thích): **261/261 test đạt**, gồm 4 test trong `tests/product-intro.test.mjs` (số liệu so với workbook; số liệu màn hình so với dashboard; ảnh, kích thước và vùng chú thích; giao diện trong jsdom, gồm làm nổi bật, phóng to và không tải workbook). TypeScript, build production và `test:production` đạt; lint không có cảnh báo mới. Test tương tác đi qua 33 bước ở chế độ tự làm, test đóng vai người dùng; thoát khi đang tải mẫu hủy việc tải. CSS production chỉ bỏ các rule con trỏ/tốc độ và thêm các rule `.product-intro`/`.pi-*` ở cuối bundle; thứ tự các rule còn lại giữ nguyên. Chrome headless ở 1920×1000, 1440×900 và 390×844: không tràn ngang, không lỗi console, không tải workbook khi xem giới thiệu; ảnh hiển thị gần đúng kích thước gốc ở 1920×1000.

QA trình duyệt cần đi hết màn hình giới thiệu và chế độ tự làm trên bản production: lần đầu/Bỏ qua/mở lại; 8 bước giới thiệu, phím ←/→, chú thích và phóng to ảnh, Mở trong ứng dụng; trước/tiếp/chạy lại; báo lỗi/thử lại; sheet/trường/quan hệ; opt-in tham chiếu; lưu ghi chú và yêu cầu chứng từ; các ngoại lệ và ADJ còn mở; 4 dashboard/bộ lọc/phóng to. Thử desktop, màn hình nhỏ, cuộn, resize và dialog. Nạp dữ liệu làm việc trước khi bắt đầu và so sánh sau khi thoát để xác nhận không mất dữ liệu. HTTP và jsdom không thay thế việc kiểm tra này trong trình duyệt thật.
