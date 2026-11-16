import { InformationNote } from '@/components/PageInformation'
import { ConventionDocumentView } from '@/components/conventions/ConventionDocument'
import {
  ReferenceChecks,
  ReferenceHeading,
  ReferencePeriodControl,
  type ReferenceViewProps,
} from './ReferencePrimitives'

export function ReferenceMethodology(props: ReferenceViewProps) {
  const { workbook, period } = props
  return (
    <div className="excel-reference-view viewport-workspace reference-methodology">
      <ReferenceHeading
        title="Quy tắc & Mô hình dữ liệu"
        description="Tài liệu quy ước ghi nhận và đối soát. Nguồn kết quả hiện tại là workbook tham chiếu Excel."
      />
      <ReferencePeriodControl {...props} />
      <InformationNote title="Workbook đang dùng">
        {workbook.fileName}
      </InformationNote>
      <InformationNote title="Tài liệu quy ước">
        Mục 1–5 là quy ước theo Báo cáo đối soát doanh thu và có thể chỉnh sửa
        trong phiên; mục 6 đọc trực tiếp từ workbook. Chỉnh sửa tài liệu không
        làm thay đổi kết quả tính toán; xuất JSON để giữ bản đã sửa.
      </InformationNote>
      <InformationNote title="Phạm vi tham chiếu và Raw">
        Các quy tắc xử lý Raw, trạng thái kiểm tra Flash và hồ sơ kế toán được
        giữ nguyên. Tắt xem thử để trở lại mô hình và bằng chứng của luồng Raw.
      </InformationNote>
      <ConventionDocumentView
        expandable
        context={{ mode: 'excel', workbook, period }}
      />
      <ReferenceChecks {...props} />
    </div>
  )
}
