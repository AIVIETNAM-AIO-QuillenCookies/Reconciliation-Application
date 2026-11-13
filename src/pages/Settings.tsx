import { vi } from '@/lib/i18n'
import { Database, HardDrive, LoaderCircle, ShieldCheck } from 'lucide-react'
import { PageHeading } from '@/components/layout/AppLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDuckDB } from '@/hooks/useDuckDB'
import { useAppStore } from '@/lib/store'

export function Settings() {
  const { status, retry } = useDuckDB()
  const { files, setFiles } = useAppStore()
  return (
    <>
      <PageHeading
        eyebrow={vi('Workspace preferences')}
        title={vi('Workspace settings')}
        description={vi(
          'The essentials behind your private reconciliation workspace.',
        )}
      />
      <div className="grid max-w-6xl gap-5 xl:grid-cols-2">
        <Card className="gap-0 py-0 shadow-none">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              {' ' + vi('Local data engine') + ' '}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-5">
            <div className="flex items-center justify-between gap-3 py-5">
              <div>
                <p className="text-[13px] font-medium">DuckDB-WASM</p>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  {' ' +
                    vi('An in-memory database running in your browser.') +
                    ' '}
                </p>
              </div>
              <Badge variant="outline" className="gap-1.5 text-[11px]">
                {status === 'loading' && (
                  <LoaderCircle className="size-3 motion-safe:animate-spin" />
                )}
                {status === 'ready'
                  ? vi('Connected')
                  : status === 'error'
                    ? vi('Unavailable')
                    : vi('Starting…')}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3 py-5">
              <div>
                <p className="text-[13px] font-medium">{vi('Storage mode')}</p>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  {' ' +
                    vi(
                      'Session only. Refreshing clears selected files and the database.',
                    ) +
                    ' '}
                </p>
              </div>
              <HardDrive
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            {status === 'error' && (
              <div className="py-4">
                <Button variant="outline" size="sm" onClick={retry}>
                  {' ' + vi('Retry engine initialization') + ' '}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="gap-0 py-0 shadow-none">
          <CardHeader className="border-b px-5 py-4">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              {' ' + vi('Data & privacy') + ' '}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <div className="py-5">
              <p className="text-[13px] font-medium">
                {vi('Private by design')}
              </p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {' ' +
                  vi(
                    'Selected financial files stay in this browser tab. There is no server upload or account connection in this workspace.',
                  ) +
                  ' '}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t py-5">
              <div>
                <p role="status" className="text-[13px] font-medium">
                  {files.length} {vi('files')} {' ' + vi('selected') + ' '}
                </p>
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  {' ' +
                    vi(
                      'Clear the selection to start a new session. Your original files are unaffected.',
                    ) +
                    ' '}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={!files.length}
                onClick={() => setFiles([])}
              >
                {' ' + vi('Clear selected files') + ' '}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
