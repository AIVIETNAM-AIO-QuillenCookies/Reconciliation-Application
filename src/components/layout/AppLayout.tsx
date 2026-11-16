import { LocalizedError } from '@/components/LocalizedError'
import { vi } from '@/lib/i18n'
import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  ChevronRight,
  FileInput,
  Network,
  LayoutDashboard,
  ListFilter,
  Menu,
  Settings2,
  Workflow,
  ClipboardCheck,
  FileSpreadsheet,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useDuckDB } from '@/hooks/useDuckDB'
import { useConventionUnloadGuard } from '@/hooks/useConventionUnloadGuard'
import { cn } from '@/lib/utils'
import { OnboardingWizard } from '@/components/ingestion/OnboardingWizard'
import { ProcessingDialog } from '@/components/processing/ProcessingDialog'
import { useAppStore } from '@/lib/store'
import '@/dashboard-workspace.css'
import '@/review-layout.css'
import {
  GuideLauncher,
  GuideSessionBanner,
  GuideWorkspaceContent,
} from '@/components/guide/InteractiveGuide'
import {
  ExcelReferenceButton,
  ExcelReferenceDialog,
} from '@/components/excel-reference/ExcelReferenceControls'
import {
  InformationNote,
  PageInformationButton,
  PageInformationProvider,
} from '@/components/PageInformation'

const navigation = [
  { to: '/', label: vi('Overview'), icon: LayoutDashboard },
  { to: '/ingestion', label: vi('Data sources'), icon: FileInput },
  { to: '/processing', label: 'Xử lý dữ liệu', icon: Workflow },
  { to: '/accounting-review', label: 'Rà soát kế toán', icon: ClipboardCheck },
  { to: '/exceptions', label: vi('Exception log'), icon: ListFilter },
  { to: '/methodology', label: vi('Rules & Data Model'), icon: Network },
  { to: '/settings', label: vi('Settings'), icon: Settings2 },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { status } = useDuckDB()
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-forest text-white">
      <Link
        to="/"
        onClick={onNavigate}
        className="flex h-20 items-center gap-2.5 px-6"
        aria-label={vi('Reconcile home')}
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 text-sidebar-accent">
          <ArrowLeftRight className="size-5" aria-hidden="true" />
        </span>
        <span className="text-[26px] font-semibold tracking-[-0.055em]">
          reconcile<span className="text-sidebar-accent">.</span>
        </span>
      </Link>
      <div className="mx-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-active text-xs font-semibold text-forest">
          FW
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-medium">{vi('Finance workspace')}</p>
        </div>
      </div>
      <nav aria-label={vi('Main navigation')} className="mt-8 space-y-1 px-3">
        <p className="mb-3 px-3 text-[11px] font-medium text-sidebar-muted">
          {' ' + vi('Workspace') + ' '}
        </p>
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 text-[13px] font-medium transition-colors duration-150',
                isActive
                  ? 'bg-sidebar-active text-forest'
                  : 'text-sidebar-text hover:bg-white/8 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                {label}
                {isActive && (
                  <ChevronRight
                    className="ml-auto size-4 shrink-0"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto px-6 pb-6 pt-10">
        <div
          className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-sidebar-text"
          role="status"
        >
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              status === 'ready'
                ? 'bg-sidebar-accent'
                : status === 'error'
                  ? 'bg-red-300'
                  : 'bg-amber-300 motion-safe:animate-pulse',
            )}
          />
          {status === 'ready'
            ? vi('Local engine ready')
            : status === 'error'
              ? vi('Engine unavailable')
              : vi('Starting local engine…')}
        </div>
      </div>
    </div>
  )
}

export function AppLayout() {
  return (
    <PageInformationProvider>
      <AppLayoutContent />
    </PageInformationProvider>
  )
}

function AppLayoutContent() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { pathname } = useLocation()
  const currentPage =
    navigation.find((item) => item.to === pathname)?.label ?? vi('Overview')
  const { status, error, retry } = useDuckDB()
  const store = useAppStore()
  useConventionUnloadGuard(store.conventions)
  const isReviewWorkspace =
    pathname === '/accounting-review' || pathname === '/exceptions'
  const isWorkspace =
    pathname === '/' ||
    pathname === '/methodology' ||
    pathname === '/processing' ||
    pathname === '/accounting-review' ||
    pathname === '/exceptions'
  const compactWorkspace =
    (isWorkspace && pathname !== '/') || pathname === '/settings'
  const active = store.activeResult
  return (
    <div className="min-h-svh">
      <InformationNote title="Nguồn dữ liệu đang xem">
        {active.source === 'excel' ? (
          <>
            <p>Kết quả tham chiếu Excel · {active.workbook.fileName}.</p>
            <p>
              Giá trị USD được đọc từ workbook. Trạng thái ngoại lệ, bằng chứng
              và quyết định Raw được giữ riêng; xem Excel không xác nhận hoặc
              đóng hồ sơ Raw.
            </p>
          </>
        ) : (
          <p>
            Kết quả được tính từ nguồn Raw đã nhập và cấu hình của phiên hiện
            tại.
          </p>
        )}
      </InformationNote>
      <InformationNote title="Phiên làm việc và quyền riêng tư">
        <p>
          Dữ liệu được xử lý trong trình duyệt này, không gửi lên máy chủ. Tải
          lại trang sẽ xóa dữ liệu của phiên.
        </p>
        {status === 'error' && active.source === 'excel' && (
          <p>
            Engine Raw chưa sẵn sàng: {error.message}. Kết quả tham chiếu Excel
            vẫn có thể xem độc lập.
          </p>
        )}
      </InformationNote>
      <OnboardingWizard />
      <ProcessingDialog />
      <ExcelReferenceDialog />
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {' ' + vi('Skip to content') + ' '}
      </a>
      <aside className="app-sidebar fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">
        <Sidebar />
      </aside>
      <div className="min-w-0 lg:pl-60">
        <header className="app-header flex h-14 items-center justify-between gap-3 border-b bg-white/80 px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5 text-xs">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label={vi('Open navigation')}
                >
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 gap-0 border-0 p-0 [&>button]:text-white"
              >
                <SheetTitle className="sr-only">{vi('Navigation')}</SheetTitle>
                <SheetDescription className="sr-only">
                  {' ' + vi('Finance workspace navigation') + ' '}
                </SheetDescription>
                <Sidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="hidden text-muted-foreground sm:inline">
              {' ' + vi('Workspace') + ' '}
            </span>
            <ChevronRight
              className="hidden size-3 text-muted-foreground sm:block"
              aria-hidden="true"
            />
            <span className="truncate font-medium">{currentPage}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <GuideLauncher />
            {(store.pipelineProgress || store.excelReference.enabled) && (
              <Button
                variant="outline"
                size="sm"
                data-progress-trigger
                onClick={
                  store.excelReference.enabled
                    ? store.openExcelReference
                    : store.openProcessingPanel
                }
              >
                <Workflow className="size-3.5" />
                <span className="hidden sm:inline">Tiến trình</span>
              </Button>
            )}
            {!store.excelReference.enabled && <ExcelReferenceButton compact />}
            {store.excelReference.enabled && (
              <div className="app-source-controls">
                <Button
                  variant="outline"
                  size="sm"
                  className="app-excel-source"
                  onClick={store.openExcelReference}
                  aria-label="Workbook Excel đang xem"
                >
                  <FileSpreadsheet size={15} aria-hidden="true" />
                  <span>Excel</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="app-raw-return"
                  onClick={store.disableExcelReference}
                  aria-label="Tắt xem thử · Quay lại xử lý Raw"
                  title="Quay lại xử lý Raw"
                >
                  <ArrowLeft size={14} aria-hidden="true" />
                  <span>Quay lại Raw</span>
                </Button>
              </div>
            )}
            <PageInformationButton
              page={currentPage}
              scope={`${pathname}-${active.source}`}
            />
            <span className="h-5 border-l" />
            <span
              className="flex size-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-primary"
              aria-hidden="true"
            >
              FW
            </span>
            <span className="hidden font-medium md:block">
              {' ' + vi('Finance workspace') + ' '}
            </span>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            'app-main mx-auto min-w-0 max-w-[1680px] px-4 py-5 outline-none sm:px-5',
            isWorkspace && 'app-workspace-main',
            isReviewWorkspace && 'review-workspace-main',
            pathname === '/' && 'dashboard-suite-main',
            store.excelReference.enabled && isWorkspace && 'excel-source-main',
            compactWorkspace && 'app-compact-workspace',
          )}
        >
          {status === 'error' && !store.excelReference.enabled && (
            <div
              role="alert"
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-red-50 p-4 text-sm text-destructive"
            >
              <div>
                <p className="font-medium">
                  {' ' + vi('The local data engine could not start.') + ' '}
                </p>
                <div className="mt-1 break-all text-xs">
                  <LocalizedError message={error.message} />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={retry}>
                {' ' + vi('Retry engine') + ' '}
              </Button>
            </div>
          )}
          <GuideSessionBanner />
          <GuideWorkspaceContent />
          {store.excelReference.enabled ? (
            <div className="excel-reference-outlet">
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="app-page-heading">
      <InformationNote title={eyebrow}>{description}</InformationNote>
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.04em] sm:text-[30px]">
          {title}
        </h1>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
