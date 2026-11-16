export const GUIDE_CHAPTERS = [
  'Làm quen với Tổng quan',
  'Nhập dữ liệu mẫu',
  'Ánh xạ các nguồn',
  'Master/Dim và phép nối',
  'Chạy và quan sát xử lý',
  'Rà soát bút toán và chứng từ',
  'Nhật ký ngoại lệ',
  'Trường hợp ghi muộn',
  'Khám phá 4 dashboard',
] as const
export interface GuideStep {
  id: string
  chapter: number
  title: string
  screen: string
  selector: string
  why: string
  instruction: string
  result: string
  action: string
  wait: string
  verify: string
}
const step = (
  id: string,
  chapter: number,
  title: string,
  screen: string,
  target: string,
  why: string,
  instruction: string,
  result: string,
  action = id,
): GuideStep => ({
  id,
  chapter,
  title,
  screen,
  selector: `[data-tour="${target}"]`,
  why,
  instruction,
  result,
  action,
  wait: `${id}:trạng thái thực tế`,
  verify: `${id}:store/DOM`,
})
export const GUIDE_STEPS: GuideStep[] = [
  step(
    'overview',
    1,
    'Bắt đầu từ Tổng quan',
    '/',
    'dashboard-import',
    'Nguồn dữ liệu → Tiến trình → Xử lý dữ liệu → Rà soát kế toán → Nhật ký ngoại lệ → Dashboard là các màn hình dùng trong quy trình.',
    'Bấm Nhập dữ liệu để mở cấu hình nguồn.',
    'Đã mở luồng nhập dữ liệu thật.',
  ),
  step(
    'load',
    2,
    'Nạp workbook Nexa Home',
    '/ingestion',
    'guide-load',
    'Một workbook cung cấp 4 nguồn giao dịch và 4 bảng tham chiếu.',
    'Bấm Nạp workbook mẫu. File chỉ tải khi bạn bắt đầu.',
    'Đã đọc workbook một lần, giữ cả WEB giao thời và 7 ngoại lệ gốc.',
  ),
  ...(['POS', 'WEB', 'GL', 'Flash'] as const).map((source) =>
    step(
      `map-${source}`,
      3,
      `Chọn sheet và ánh xạ ${source}`,
      '/ingestion',
      `source-sheet-${source}`,
      source === 'POS'
        ? 'receipt_no + line_no xác định dòng hóa đơn; doanh thu thuần được tính từ gộp trừ chiết khấu.'
        : source === 'WEB'
          ? 'Ngày đặt, ngày giao và ngày trả phục vụ các kỳ ghi nhận khác nhau. Không loại bỏ đơn ngoài năm 2025 khi nhập.'
          : source === 'GL'
            ? 'Giữ amount_usd có dấu sổ cái; doanh thu = −amount_usd. Không quy đổi lại USD và không thêm 15 MANUAL.'
            : '“Tháng” là nhãn kỳ báo cáo. Khi cần ngày, dùng ngày cuối đúng tháng và giữ nhãn nguồn.',
      'Chọn sheet nguồn đúng vai trò, rà soát từng trường trên form rồi xác nhận ánh xạ mẫu.',
      'Sheet và các trường đã được kiểm tra theo preset Nexa Home.',
    ),
  ),
  ...(['store', 'calendar', 'fxDaily', 'fxMonthEnd'] as const).map((role) =>
    step(
      `master-${role}`,
      4,
      role === 'store'
        ? 'Nối mã cửa hàng'
        : role === 'calendar'
          ? 'Nối lịch'
          : role === 'fxDaily'
            ? 'Nối FX ngày'
            : 'Nối FX tháng',
      '/ingestion',
      `master-role-${role}`,
      role === 'store'
        ? 'POS store_id → pos_store_id → finance_store_code.'
        : role === 'calendar'
          ? 'Ngày bán nối Calendar date; cờ ngày làm việc không tự tạo ngày ghi sổ.'
          : role === 'fxDaily'
            ? 'Khóa ghép ngày + tiền tệ, tỷ giá nội tệ cho 1 USD.'
            : 'Khóa ghép kỳ + tiền tệ. Cột USD sẵn có không được quy đổi thêm.',
      'Chọn vai trò và áp dụng preset Nexa Home; vẫn có thể tự sửa sheet, cột và quan hệ trên form.',
      'Đã cấu hình sheet, cột và khóa nối cho vai trò.',
    ),
  ),
  step(
    'validate',
    4,
    'Kiểm tra quan hệ tham chiếu',
    '/ingestion',
    'master-validate',
    'Kiểm tra khóa trống, khóa trùng, số dòng sau nối và khóa không khớp trên dữ liệu thật.',
    'Bấm Kiểm tra cấu hình và chờ kết quả thật.',
    'Chỉ hoàn thành khi kiểm tra tham chiếu trả về passed.',
  ),
  step(
    'raw-run',
    5,
    'Chạy luồng Raw và kiểm tra giới hạn',
    '/processing',
    'guide-action',
    'WEB nguồn dùng nội tệ; Raw hiện chỉ đổi FX cho POS. Không thể coi nội tệ WEB là USD.',
    'Chạy kiểm tra Raw. Nếu bị chặn, xem chẩn đoán và chọn rõ chế độ tham chiếu Excel để tiếp tục.',
    'Không tạo kết quả Raw giả. Nguồn tham chiếu chỉ bật khi bạn chọn.',
  ),
  step(
    'excel-opt-in',
    5,
    'Chọn tiếp tục với kết quả Excel',
    '/processing',
    'guide-action',
    'Bước tiếp theo đọc đầu ra chuẩn hóa của workbook. Đây là chế độ tham chiếu Excel, chưa chứng minh Raw xử lý xong.',
    'Bấm Chuyển sang tham chiếu Excel để xem các bảng kết quả và dashboard.',
    'Đã bật nguồn Excel được ghi nhãn rõ ràng; cấu hình Raw được giữ riêng.',
  ),
  ...[
    ['raw', 'Raw và phạm vi nhập'],
    ['normalized', 'Chuẩn hóa và cột USD'],
    ['duplicates', 'POS xuất trùng 74/NX007 ngày 29/03'],
    ['joins', 'Kết quả nối tham chiếu'],
    ['unified', 'Bảng giao dịch chung'],
    ['qc', 'Kiểm tra và đối soát'],
  ].map(([key, title]) =>
    step(
      `table-${key}`,
      5,
      title,
      '/processing',
      'guide-evidence',
      key === 'duplicates'
        ? '17.124 dòng POS gồm 12 nhóm trùng / 24 dòng trong nhóm / 12 bản dư. 02a giữ bản lặp để audit; bảng chung chỉ dùng 17.112 khóa duy nhất.'
        : key === 'qc'
          ? 'Ô QC_Summary chưa có kết quả phải giữ là chưa đánh giá.'
          : 'Đối chiếu dữ liệu với các sheet đầu ra Excel; nguồn tham chiếu luôn hiển thị.',
      'Mở và xem bảng bằng chứng của bước hiện tại.',
      'Đã mở bảng thực của workbook, với phạm vi và tên sheet nguồn.',
    ),
  ),
  step(
    'manual',
    6,
    'Lọc 15 bút toán MANUAL',
    '/accounting-review',
    'accounting-journal-type',
    'Các bút toán đã có trong GL; màn hình rà soát không cộng thêm doanh thu.',
    'Mở Bộ lọc, chọn loại MANUAL và phạm vi tất cả.',
    'Bộ lọc đang hiển thị MANUAL của snapshot GL thật.',
  ),
  step(
    'shipping',
    6,
    'Xem phí vận chuyển',
    '/accounting-review',
    'accounting-journal-JE20250100572',
    '12 tham chiếu MJ-SHIP-2501…2512 có doanh thu 94.766,95 USD; JE20250100572 là 8.531,49 USD.',
    'Mở JE20250100572 và kiểm tra mã tham chiếu.',
    'Đã mở bút toán gốc; chưa xác minh chứng từ.',
  ),
  step(
    'transfer',
    6,
    'Xem hai vế phân loại lại',
    '/accounting-review',
    'accounting-journal-JE20250603115',
    'MJ-RCL-2506 giảm STORE 3.480 USD và tăng WEB 3.480 USD. Tổng công ty bằng 0, ảnh hưởng kênh vẫn giữ.',
    'Mở bút toán JE20250603115 và hồ sơ có cả JE20250603117.',
    'Đã giữ cả hai vế chuyển kênh; không thêm điều chỉnh.',
  ),
  step(
    'adjustment',
    6,
    'Khoản ADJ chưa giải thích',
    '/accounting-review',
    'accounting-journal-JE20250904892',
    'Ngày 30/09, MJ-ADJ-2509: amount_usd −1.250, doanh thu +1.250 USD, UNALLOCATED.',
    'Mở JE20250904892.',
    'Khoản ADJ vẫn chưa giải thích, chưa gắn cửa hàng.',
  ),
  step(
    'notes',
    6,
    'Ghi chú rà soát',
    '/accounting-review',
    'accounting-notes',
    'source_ref giúp truy vết nhưng không phải bản gốc chứng từ.',
    'Mở tab Chứng từ, nhập ghi chú và lưu; ghi rõ yêu cầu Finance bổ sung.',
    'Đã lưu ghi chú trong phiên mẫu, chưa xác nhận chứng từ.',
  ),
  step(
    'evidence',
    6,
    'Tạo yêu cầu bổ sung chứng từ',
    '/accounting-review',
    'accounting-request-evidence',
    'Workbook không có chứng từ gốc. ADJ phải tiếp tục ở trạng thái chưa giải thích.',
    'Bấm Yêu cầu bổ sung chứng từ. Đây là công việc nội bộ của phiên, chưa gửi email.',
    'Đã tạo một yêu cầu, không tạo lại khi thử lại.',
  ),
  step(
    'exceptions',
    7,
    'Đọc đúng 7 ngoại lệ gốc',
    '/exceptions',
    'guide-source-exceptions',
    'Giữ mô tả, ảnh hưởng, kỳ, phân loại, hướng xử lý, người phụ trách và trạng thái từ 05_Nhat_ky_ngoai_le.',
    'Xem nhật ký gốc và liên kết đến hồ sơ đã có; không tạo thêm ngoại lệ trùng.',
    '7 dòng gốc được giữ nguyên; số tham chiếu tách khỏi số tính lại.',
  ),
  step(
    'late',
    8,
    'Truy vết EX-06 ghi muộn',
    '/exceptions',
    'guide-exception-EX-06',
    'POS 21/11/2025 tại 570/NX057: 7.227,56 USD. GL đã có JE20251206231 ngày 02/12/2025.',
    'Mở EX-06, xem hai ô cửa hàng–ngày lệch và bút toán đã ghi.',
    'Tự bù trong năm; vẫn ảnh hưởng tháng/ngày. Không thêm catch-up hoặc sửa ngày nguồn.',
  ),
  step(
    'dash-overview',
    9,
    'Dashboard · Tổng quan',
    '/?tab=overview&from=2025-12&to=2025-12',
    'dashboard-kpis',
    'KPI, xu hướng và chênh lệch dùng cùng snapshot, lọc tháng 12/2025.',
    'Chọn tab Tổng quan và tháng 12/2025.',
    'Đã mở Tổng quan tháng 12/2025.',
  ),
  step(
    'dash-bridge',
    9,
    'Dashboard · Cầu nối chênh lệch',
    '/?tab=bridge&from=2025-12&to=2025-12',
    'dashboard-tab-bridge',
    'Cầu nối giải thích các khoản từ Flash đến GL, giữ kỳ tháng 12/2025.',
    'Mở tab Cầu nối và một khoản mục chi tiết.',
    'Đã mở chi tiết của khoản cầu nối.',
  ),
  step(
    'dash-detail',
    9,
    'Dashboard · Đối soát chi tiết',
    '/?tab=detail&from=2025-01&to=2025-12',
    'dashboard-tab-detail',
    'Phạm vi cả năm 2025 vẫn giữ hai ô cửa hàng–ngày của trường hợp ghi muộn.',
    'Mở Đối soát chi tiết; so sánh thô và chuẩn hóa.',
    'Đã mở đối soát cả năm.',
  ),
  step(
    'dash-quality',
    9,
    'Dashboard · Hoàn trả, hủy và chất lượng',
    '/?tab=quality&from=2025-01&to=2025-12',
    'dashboard-quality',
    '139 đơn Cancelled toàn file; 124 đơn theo ngày đặt năm 2025. 12 bản POS dư và 15 MANUAL là các phạm vi riêng.',
    'Mở tab chất lượng, giữ cả năm 2025.',
    'Đã mở trang chất lượng; ADJ 1.250 USD vẫn thiếu căn cứ.',
  ),
  step(
    'expand',
    9,
    'Phóng to bảng/biểu đồ',
    '/?tab=quality&from=2025-01&to=2025-12',
    'dashboard-quality',
    'Phóng to dùng chức năng dashboard đã có, giữ nguyên snapshot và bộ lọc.',
    'Bấm Phóng to bảng đơn hủy và xem nội dung.',
    'Đã mở widget phóng to; snapshot và bộ lọc được giữ.',
  ),
  step(
    'close-expand',
    9,
    'Đóng widget và hoàn thành',
    '/?tab=quality&from=2025-01&to=2025-12',
    'dashboard-expanded',
    'Đóng cửa sổ phóng to quay về đúng tab và bộ lọc vừa xem.',
    'Bấm đóng widget để xem bảng tổng kết hướng dẫn.',
    'Đã đóng widget; cả 4 dashboard đã được xem trong cùng phiên mẫu.',
  ),
]
