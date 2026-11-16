import { displayOnboardingSteps as ONBOARDING_STEPS } from '@/lib/localized-model'
import { vi, vt } from '@/lib/i18n'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  LoaderCircle,
  Plus,
  Files,
  ArrowUpRight,
} from 'lucide-react'
import { PageHeading } from '@/components/layout/AppLayout'
import { SourceIcon } from '@/components/SourceIcon'
import { Button } from '@/components/ui/button'

import { sourceStatus } from '@/lib/source-status'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { InformationNote } from '@/components/PageInformation'

const roles = {
  POS: 'Receipt lines, discounts and duplicate exports.',
  WEB: 'Orders, deliveries, cancellations and returns.',
  GL: 'Signed revenue journals from your finance ledger.',
  Flash: 'Monthly gross revenue. The bridge starts here.',
  Dim: 'Store, calendar and FX reference worksheets.',
}

export function DataIngestion() {
  const {
    files,
    mappingDrafts,
    openOnboarding,
    openSourceOnboarding,
    isProcessing,
    confirmedMappings,
  } = useAppStore()
  const readyCount = ONBOARDING_STEPS.slice(0, 4).filter(
    (step) => sourceStatus(step.source, files, mappingDrafts).state === 'ready',
  ).length
  return (
    <>
      <PageHeading
        eyebrow={vi('Source management')}
        title={vi('Data sources')}
        description={vi(
          'Bring your sales and ledger exports into one traceable reconciliation.',
        )}
        actions={
          <Button data-tour="ingestion-import" onClick={openOnboarding}>
            <Plus className="size-4" />
            {files.length ? 'Continue import' : 'Import data'}
          </Button>
        }
      />
      <InformationNote title="Vai trò các nguồn dữ liệu">
        <dl>
          {ONBOARDING_STEPS.map((step) => (
            <div key={step.source}>
              <dt>{step.label}</dt>
              <dd>{vi(roles[step.source])}</dd>
            </div>
          ))}
        </dl>
        <p>
          {files.length} tệp đã chọn. Master là nguồn tham chiếu tùy chọn. Định
          dạng hỗ trợ: CSV / XLSX.
        </p>
        <p>
          {vi(
            'Mappings confirmed. Editing a file or mapping requires a new confirmation before the next run.',
          )}
        </p>
      </InformationNote>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
            <Files className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[13px] font-semibold">
              {readyCount}
              {' ' + vi('of 4 required sources mapped') + ' '}
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-1.5"
          aria-label={vt`${readyCount} of 4 required sources ready`}
        >
          {Array.from({ length: 4 }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 w-10 rounded-full',
                i < readyCount ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>
      {isProcessing && (
        <div role="status" className="notice mb-5 border-primary/20 bg-accent">
          <LoaderCircle className="mt-0.5 size-4 shrink-0 motion-safe:animate-spin text-primary" />
          <span>{vi('Reconciliation is running.')}</span>
          <Link
            to="/"
            className="ml-auto inline-flex items-center gap-1 font-medium text-primary"
          >
            {' ' + vi('View progress') + ' '}
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
      {confirmedMappings && !isProcessing && (
        <div className="notice mb-5">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
          Cấu hình đã xác nhận
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {ONBOARDING_STEPS.map((step) => {
          const info = sourceStatus(step.source, files, mappingDrafts)
          const Icon =
            info.state === 'ready'
              ? CheckCircle2
              : info.state === 'error' || info.state === 'mapping'
                ? AlertCircle
                : info.state === 'reading'
                  ? LoaderCircle
                  : Circle
          return (
            <section
              key={step.source}
              className={cn(
                'panel flex flex-col',
                info.state === 'error' && 'border-destructive/30',
              )}
            >
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-5 flex items-center justify-between">
                  <SourceIcon
                    source={step.source}
                    className="size-10 [&_svg]:size-[18px]"
                  />
                  <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                    {step.source === 'Dim' ? vi('Optional') : vi('Required')}
                  </span>
                </div>
                <h2 className="section-title">{step.label}</h2>
                <div className="my-4 min-h-12 rounded-lg bg-muted/70 px-3 py-2.5 text-xs">
                  {info.files.length ? (
                    <>
                      <p
                        className="truncate font-medium"
                        title={info.files
                          .map((file) => file.file.name)
                          .join(', ')}
                      >
                        {info.files[0].file.name}
                        {info.files.length > 1
                          ? ` +${info.files.length - 1} more`
                          : ''}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {info.readyCount} / {info.files.length}{' '}
                        {step.source === 'Dim'
                          ? vi('files previewed')
                          : vi('files mapped')}
                      </p>
                    </>
                  ) : (
                    <p className="py-1 text-muted-foreground">
                      {' ' + vi('No file selected') + ' '}
                    </p>
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  <span
                    role="status"
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs font-medium',
                      info.state === 'ready'
                        ? 'text-primary'
                        : info.state === 'error'
                          ? 'text-destructive'
                          : info.state === 'mapping'
                            ? 'text-warning'
                            : 'text-muted-foreground',
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-3.5',
                        info.state === 'reading' && 'motion-safe:animate-spin',
                      )}
                      aria-hidden="true"
                    />
                    {vi(info.label)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-primary"
                    onClick={() => openSourceOnboarding(step.source)}
                    aria-label={`${info.files.length ? vi('Review') : vi('Add')} ${step.label}`}
                  >
                    {info.files.length ? vi('Review') : vi('Add file')}
                    <ArrowUpRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            </section>
          )
        })}
      </div>
      <InformationNote title="Giới hạn nhập dữ liệu">
        <p>Tối đa 20 tệp, 50 MiB mỗi tệp và 200 MiB mỗi lần nhập.</p>
      </InformationNote>
    </>
  )
}
