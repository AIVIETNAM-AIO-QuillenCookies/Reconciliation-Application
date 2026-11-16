import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  LayoutDashboard,
  MonitorPlay,
  Route,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useGuideWorkspace } from '@/components/guide/GuideWorkspace'
import { AppStoreContext } from '@/lib/store'
import { allowReferenceSwitch } from '@/lib/excel-reference-session'
import { money, percent } from '@/lib/dashboard-format'
import {
  INTRO_PHASES,
  INTRO_SAMPLE,
  INTRO_STEPS,
  introSourceRowTotal,
  introStepIndex,
  introVarianceOfFlash,
  introVarianceOfGL,
  introVarianceUSD,
} from '@/lib/product-intro'
import { ProductIntroContext } from './intro-context'
import { IntroShots } from './IntroShots'
import '@/product-intro.css'

export interface ProductIntroProps {
  open: boolean
  /** Close button, Esc, “Bỏ qua giới thiệu” or “Vào ứng dụng”. */
  onClose: () => void
  /** Start the guided practice session with the Nexa Home sample. */
  onStartPractice: () => void
  /** Open a screen of the app with the bundled workbook (“Tạm xem theo Excel”). */
  onOpenInApp: (route: string) => void
  /** Open the source import wizard. */
  onImport: () => void
}

/**
 * Mounted in App.tsx outside the hash router and imported after the pages, so
 * its stylesheet joins the end of the CSS bundle. App navigation from here
 * goes through the URL hash.
 */
export function ProductIntroProvider({ children }: { children: ReactNode }) {
  const workspace = useGuideWorkspace()
  const store = useContext(AppStoreContext)!
  const [open, setOpen] = useState(false)
  const controls = useMemo(() => ({ open: () => setOpen(true) }), [])
  const leave = (then?: () => void) => {
    setOpen(false)
    then?.()
  }
  const navigateApp = (route: string) => {
    window.location.hash = `#${route}`
  }
  return (
    <ProductIntroContext.Provider value={controls}>
      {children}
      <ProductIntro
        open={open && !workspace.session}
        onClose={() => leave()}
        onStartPractice={() => leave(workspace.start)}
        onOpenInApp={(route) =>
          leave(() => {
            if (!allowReferenceSwitch()) return
            navigateApp(route)
            void store.actions.loadExcelReference().then(() => {
              // The visitor already watched the workbook load in the introduction.
              if (store.getState().excelReference.status === 'ready')
                store.actions.closeExcelReference()
            })
          })
        }
        onImport={() => leave(store.actions.openOnboarding)}
      />
    </ProductIntroContext.Provider>
  )
}

/**
 * A large dialog over the blurred app, like the dashboard's expanded widgets.
 * Its content unmounts with the dialog, so every opening starts on page 1 and
 * releases the preview workbook.
 */
export function ProductIntro(props: ProductIntroProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) props.onClose()
      }}
    >
      <DialogContent
        className="product-intro"
        closeLabel="Đóng giới thiệu"
        data-tour="product-intro"
      >
        <header className="pi-heading">
          <DialogTitle>
            Giới thiệu Reconcile - Dự án Báo cáo đối soát doanh thu
          </DialogTitle>
          <DialogDescription>Team eDA_Sale, We Analyze</DialogDescription>
        </header>
        <IntroBody {...props} />
      </DialogContent>
    </Dialog>
  )
}

function IntroBody({
  onClose,
  onStartPractice,
  onOpenInApp,
  onImport,
}: ProductIntroProps) {
  const [index, setIndex] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const shownIndex = useRef(index)
  const last = INTRO_STEPS.length - 1
  const step = INTRO_STEPS[index]
  const go = (next: number) => setIndex(Math.max(0, Math.min(last, next)))

  useEffect(() => {
    if (shownIndex.current === index) return
    shownIndex.current = index
    headingRef.current?.focus({ preventScroll: true })
  }, [index])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const target = event.target as HTMLElement
    // Arrow keys stay with the zoomed image, form fields and composite widgets.
    if (
      target.closest(
        '.pi-zoom, input, textarea, select, [contenteditable="true"], [role="tablist"], [role="radiogroup"], [role="slider"], [role="listbox"], [role="menu"], [role="grid"]',
      )
    )
      return
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      go(index + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      go(index - 1)
    }
  }

  return (
    <div className="pi-body" onKeyDown={onKeyDown}>
      <nav className="pi-rail" aria-label="Các bước giới thiệu">
        <ol className="pi-steps">
          {INTRO_STEPS.map((item, position) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={position === index ? 'step' : undefined}
                data-done={position < index || undefined}
                data-tour={`intro-nav-${item.id}`}
                onClick={() => go(position)}
              >
                <span className="pi-step-number">{position + 1}</span>
                <span className="pi-step-label">{item.label}</span>
                {item.shots && (
                  <MonitorPlay
                    size={14}
                    className="pi-step-live"
                    aria-label="Ảnh màn hình"
                  />
                )}
              </button>
            </li>
          ))}
        </ol>
        <div className="pi-rail-footer">
          <p>
            Bước có <MonitorPlay size={13} aria-label="biểu tượng màn hình" />{' '}
            là ảnh chụp màn hình thật với workbook mẫu. Bấm “Mở trong ứng dụng”
            để tự thao tác; dữ liệu của bạn không bị thay đổi.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-tour="guide-defer"
          >
            Bỏ qua giới thiệu
          </Button>
        </div>
      </nav>
      <div className="pi-main" data-tour="intro-content" data-section={step.id}>
        <header className="pi-step-header">
          <div className="pi-step-copy">
            <p className="pi-eyebrow">
              Bước {index + 1}/{INTRO_STEPS.length}
              {step.screen && ` · Màn hình ${step.screen}`}
            </p>
            <h2 ref={headingRef} tabIndex={-1} className="pi-step-title">
              {step.title}
            </h2>
            <p className="pi-step-description">{step.description}</p>
          </div>
          {/* The welcome page moves on with its own “Xem quy trình” button. */}
          {index > 0 && (
            <div className="pi-step-actions">
              {step.route && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenInApp(step.route!)}
                  data-tour="intro-open-in-app"
                >
                  <ArrowUpRight size={14} />
                  Mở trong ứng dụng
                </Button>
              )}
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => go(index - 1)}
                aria-label="Bước trước"
                title="Bước trước"
                data-tour="intro-previous"
              >
                <ArrowLeft size={14} />
              </Button>
              {index < last ? (
                <Button
                  size="sm"
                  onClick={() => go(index + 1)}
                  data-tour="intro-next"
                >
                  {/* One flex item, so the button gap never splits “Tiếp: …”. */}
                  <span>
                    Tiếp
                    <span className="pi-next-label">
                      : {INTRO_STEPS[index + 1].label}
                    </span>
                  </span>
                  <ArrowRight size={14} />
                </Button>
              ) : (
                <Button size="sm" onClick={onClose} data-tour="intro-finish">
                  Vào ứng dụng
                  <ArrowRight size={14} />
                </Button>
              )}
            </div>
          )}
        </header>
        {step.shots ? (
          <div className="pi-content pi-content-shots">
            <IntroShots key={step.id} shots={step.shots} />
          </div>
        ) : (
          <div className="pi-content">
            {step.id === 'welcome' && <WelcomeSection onNext={() => go(1)} />}
            {step.id === 'workflow' && (
              <WorkflowSection onOpenStep={(id) => go(introStepIndex(id))} />
            )}
            {step.id === 'start' && (
              <StartSection
                onOpenSample={() => onOpenInApp('/')}
                onStartPractice={onStartPractice}
                onImport={onImport}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function WelcomeSection({ onNext }: { onNext: () => void }) {
  const sample = INTRO_SAMPLE
  return (
    <section className="pi-section pi-welcome">
      <div>
        <p className="pi-lead">
          Sales Flash là báo cáo doanh số nhanh của bộ phận Kinh doanh; Finance
          GL là doanh thu trên sổ cái. Hai con số thường lệch nhau vì khác quy
          tắc và thời điểm ghi nhận. Ứng dụng tách khoản lệch hợp lệ khỏi lỗi dữ
          liệu cần sửa.
        </p>
        <ol className="pi-questions" aria-label="Ba câu hỏi ứng dụng trả lời">
          <li>
            <span>1</span>
            <div>
              <strong>Lệch bao nhiêu?</strong>
              <p>Giá trị và tỷ lệ chênh lệch theo tháng, theo kênh.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Vì sao lệch?</strong>
              <p>
                Tách thành quy tắc ghi nhận, lỗi dữ liệu, khoản chưa giải thích
                và làm tròn.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Cần cải thiện gì?</strong>
              <p>
                Rà soát bút toán, theo dõi ngoại lệ và chứng từ trước khi khóa
                sổ.
              </p>
            </div>
          </li>
        </ol>
        <p className="pi-note">
          <ShieldCheck size={15} aria-hidden="true" />
          Dữ liệu được xử lý ngay trong trình duyệt, không gửi lên máy chủ.
        </p>
        <Button onClick={onNext} data-tour="intro-welcome-next">
          Xem quy trình
          <ArrowRight size={15} />
        </Button>
      </div>
      <div className="pi-case" aria-label="Ví dụ từ bộ dữ liệu mẫu">
        <p className="pi-case-title">
          Bộ dữ liệu mẫu · {sample.company} FY{sample.fiscalYear}
        </p>
        <p className="pi-muted">
          {sample.stores} cửa hàng tại {sample.countries} quốc gia và một kênh
          online ·{' '}
          {new Intl.NumberFormat('vi-VN').format(introSourceRowTotal())} dòng
          chi tiết
        </p>
        <div className="pi-hero">
          <span>Chênh lệch GL − Flash</span>
          <strong>{money(introVarianceUSD())}</strong>
          <span>
            USD · {percent(introVarianceOfFlash())} so với Sales Flash ·{' '}
            {percent(introVarianceOfGL())} so với GL
          </span>
        </div>
        <dl className="pi-case-pair">
          <div>
            <dt>Doanh số Sales Flash</dt>
            <dd>{money(sample.flashUSD)} USD</dd>
          </div>
          <div>
            <dt>Doanh thu Finance GL</dt>
            <dd>{money(sample.glUSD)} USD</dd>
          </div>
        </dl>
        <p className="pi-case-note">
          Chênh lệch giữa hai hệ thống ghi nhận chưa đồng nghĩa doanh thu thất
          thoát hay lỗi hạch toán. Các bước sau cho thấy ứng dụng giải thích
          từng khoản.
        </p>
      </div>
    </section>
  )
}

function WorkflowSection({
  onOpenStep,
}: {
  onOpenStep: (step: (typeof INTRO_PHASES)[number]['step']) => void
}) {
  return (
    <section className="pi-section">
      <ol className="pi-phases" data-tour="intro-workflow">
        {INTRO_PHASES.map((phase, position) => {
          const step = INTRO_STEPS[introStepIndex(phase.step)]
          return (
            <li key={phase.step} className="pi-phase">
              <span className="pi-phase-number" aria-hidden="true">
                {position + 1}
              </span>
              <div className="pi-phase-body">
                <div className="pi-phase-head">
                  <div>
                    <strong>{phase.title}</strong>
                    <p>{phase.summary}</p>
                  </div>
                  <button
                    type="button"
                    className="pi-link"
                    onClick={() => onOpenStep(phase.step)}
                  >
                    Xem màn hình {step.screen}
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                </div>
                <ul>
                  {phase.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="pi-note pi-own-data">
        <UploadCloud size={15} aria-hidden="true" />
        Với dữ liệu của bạn: nhập POS, WEB, Finance GL, Sales Flash và
        Master/Dim ở Nguồn dữ liệu, ánh xạ cột rồi chạy xử lý Raw. Các bước sau
        dùng chung những màn hình này.
      </p>
    </section>
  )
}

function StartSection({
  onOpenSample,
  onStartPractice,
  onImport,
}: {
  onOpenSample: () => void
  onStartPractice: () => void
  onImport: () => void
}) {
  return (
    <section className="pi-section">
      <div className="pi-start">
        <button
          type="button"
          className="pi-start-card pi-start-primary"
          onClick={onOpenSample}
          data-tour="intro-open-sample"
        >
          <span className="pi-card-icon" aria-hidden="true">
            <LayoutDashboard size={19} />
          </span>
          <strong>Xem dữ liệu mẫu trong ứng dụng</strong>
          <span>
            Mở workbook Nexa Home ở chế độ Tạm xem theo Excel, đúng như các màn
            hình vừa xem. Có thể quay lại Raw bất cứ lúc nào.
          </span>
        </button>
        <button
          type="button"
          className="pi-start-card"
          onClick={onStartPractice}
          data-tour="guide-start-guided"
        >
          <span className="pi-card-icon" aria-hidden="true">
            <Route size={19} />
          </span>
          <strong>Thực hành có hướng dẫn</strong>
          <span>
            Tự thao tác 9 chương với dữ liệu mẫu: nhập, ánh xạ, xử lý, rà soát
            và dashboard. Hướng dẫn kiểm tra từng bước trước khi cho đi tiếp.
          </span>
          <small className="pi-consent">
            <ShieldCheck size={14} aria-hidden="true" />
            Chọn bắt đầu là đồng ý sử dụng dữ liệu mẫu trong một phiên minh họa
            riêng. Bạn có thể quay về không gian làm việc ban đầu.
          </small>
        </button>
        <button
          type="button"
          className="pi-start-card"
          onClick={onImport}
          data-tour="intro-import"
        >
          <span className="pi-card-icon" aria-hidden="true">
            <UploadCloud size={19} />
          </span>
          <strong>Nhập dữ liệu của tôi</strong>
          <span>
            Mở trình nhập POS, WEB, Finance GL, Sales Flash và Master/Dim để đối
            soát dữ liệu của bạn.
          </span>
        </button>
      </div>
    </section>
  )
}
