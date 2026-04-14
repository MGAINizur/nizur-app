'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import { TopBar } from '@/components/TopBar'

type CanonicalInsured = { legal_name?: string; country?: string }
type CanonicalPlacement = { period?: { from?: string; to?: string }; ramo?: string }
type CanonicalJson = { insured?: CanonicalInsured; placement?: CanonicalPlacement }

type Submission = {
  id: string
  subject: string
  source_email: string
  source_name: string
  ramo: string
  status: string
  sum_insured: number
  estimated_premium: number
  policy_start: string
  policy_end: string
  created_at: string
  // Pipeline visibility fields
  processing_status: string | null
  processing_stage: string | null
  extraction_confidence: number | null
  canonical_json: CanonicalJson | null
  spe_output: Record<string, unknown> | null
  documents?: SubmissionDoc[]
}

type SubmissionDoc = {
  id: string
  file_name: string
  storage_path: string
  document_role: string
  mime_type: string
  file_size: number
}

function fileIcon(mime: string, name: string) {
  if (mime?.includes('pdf') || name?.endsWith('.pdf')) return '📄'
  if (mime?.includes('word') || name?.endsWith('.docx') || name?.endsWith('.doc')) return '📝'
  if (mime?.includes('excel') || name?.endsWith('.xlsx') || name?.endsWith('.xls')) return '📊'
  if (mime?.includes('image') || name?.match(/\.(png|jpg|jpeg|gif)$/i)) return '🖼️'
  return '📎'
}

function fmtSize(bytes: number) {
  if (!bytes) return ''
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtUSD(n: number) {
  if (!n) return '—'
  return `USD ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

const PROC_STATUS_COLORS: Record<string, string> = {
  completed:  'bg-green-500/20 text-green-300',
  failed:     'bg-red-500/20 text-red-300',
  processing: 'bg-yellow-500/20 text-yellow-300',
  pending:    'bg-slate-600/20 text-slate-400',
}

const STATUS_COLORS: Record<string, string> = {
  received:   'bg-blue-500/20 text-blue-300',
  processing: 'bg-yellow-500/20 text-yellow-300',
  processed:  'bg-green-500/20 text-green-300',
  failed:     'bg-red-500/20 text-red-300',
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-500 text-xs">—</span>
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-white">{value}%</span>
    </div>
  )
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [docLoading, setDocLoading] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    const sb = createClient()
    sb.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setLoading(false); return }
      sb.from('submissions')
        .select([
          'id, subject, source_email, source_name, ramo, status',
          'sum_insured, estimated_premium, policy_start, policy_end, created_at',
          'processing_status, processing_stage, extraction_confidence',
          'canonical_json, spe_output',
        ].join(', '))
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) console.error(error)
          setSubmissions((data as unknown as Submission[]) || [])
          setLoading(false)
        })
    })
  }, [])

  async function loadDocs(submissionId: string) {
    if (expanded === submissionId) { setExpanded(null); return }
    setExpanded(submissionId)
    setDocLoading(submissionId)

    const sb = createClient()
    const { data: docs } = await sb
      .from('submission_documents')
      .select('id, file_name, storage_path, document_role, mime_type, file_size')
      .eq('submission_id', submissionId)

    if (docs?.length) {
      const urls: Record<string, string> = {}
      await Promise.all(docs.map(async (doc) => {
        const { data } = await sb.storage.from('submission-files').createSignedUrl(doc.storage_path, 3600)
        if (data?.signedUrl) urls[doc.id] = data.signedUrl
      }))
      setSignedUrls(prev => ({ ...prev, ...urls }))
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, documents: docs } : s))
    } else {
      setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, documents: [] } : s))
    }
    setDocLoading(null)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar title="Submissions" />
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-[1200px] mx-auto space-y-3">

          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-400 text-xs">Submissions recibidos por <span className="text-blue-400">flow@nizur.io</span></p>
            <span className="text-slate-500 text-xs">{submissions.length} submissions</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center text-slate-400 py-16">
              <div className="text-3xl mb-2">📥</div>
              <div className="text-sm">Sin submissions aún</div>
            </div>
          ) : (
            submissions.map((sub, i) => {
              const canonical = sub.canonical_json
              const insuredName = canonical?.insured?.legal_name
              const country = canonical?.insured?.country
              const period = canonical?.placement?.period
              const ramo = canonical?.placement?.ramo || sub.ramo
              const hasSPE = !!sub.spe_output

              return (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden"
                >
                  {/* Header row */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-700/30 transition"
                    onClick={() => loadDocs(sub.id)}
                  >
                    <div className="flex-1 min-w-0">
                      {/* Status badges */}
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        {sub.processing_status && (
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${PROC_STATUS_COLORS[sub.processing_status] || 'bg-slate-600/20 text-slate-400'}`}>
                            {sub.processing_status}
                          </span>
                        )}
                        {sub.processing_stage && (
                          <span className="text-slate-500 text-xs font-mono">{sub.processing_stage}</span>
                        )}
                        {ramo && <span className="text-slate-500 text-xs">{ramo}</span>}
                        {hasSPE && <span className="text-xs text-purple-400 font-medium">SPE ✓</span>}
                      </div>
                      <div className="text-white font-medium text-sm truncate">
                        {insuredName || sub.subject || '(sin asunto)'}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        {sub.source_email} · {fmtDate(sub.created_at)}
                        {country && <> · <span className="text-slate-400">{country}</span></>}
                        {period?.from && period?.to && (
                          <> · <span className="text-slate-400">{period.from} – {period.to}</span></>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      {sub.sum_insured > 0 && (
                        <div className="text-slate-300 text-xs">{fmtUSD(sub.sum_insured)} TIV</div>
                      )}
                      {sub.estimated_premium > 0 && (
                        <div className="text-green-400 text-xs">{fmtUSD(sub.estimated_premium)} prima</div>
                      )}
                      <ConfidenceBar value={sub.extraction_confidence} />
                    </div>
                    <div className="text-slate-500 text-sm shrink-0">
                      {expanded === sub.id ? '▲' : '▼'}
                    </div>
                  </div>

                  {/* Docs + canonical detail panel */}
                  <AnimatePresence>
                    {expanded === sub.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-slate-700/60 overflow-hidden"
                      >
                        <div className="p-4 bg-slate-900/40 space-y-4">
                          {/* Canonical fields (if extracted) */}
                          {canonical && (
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                              <div className="text-slate-500 font-semibold uppercase tracking-wider col-span-2 mb-1">Canonical</div>
                              {insuredName && <><span className="text-slate-400">Asegurado</span><span className="text-white truncate">{insuredName}</span></>}
                              {country && <><span className="text-slate-400">País</span><span className="text-white">{country}</span></>}
                              {ramo && <><span className="text-slate-400">Ramo</span><span className="text-white">{ramo}</span></>}
                              {period?.from && <><span className="text-slate-400">Desde</span><span className="text-white">{period.from}</span></>}
                              {period?.to && <><span className="text-slate-400">Hasta</span><span className="text-white">{period.to}</span></>}
                              {sub.sum_insured > 0 && <><span className="text-slate-400">TIV</span><span className="text-white">{fmtUSD(sub.sum_insured)}</span></>}
                            </div>
                          )}

                          {/* Docs */}
                          {docLoading === sub.id ? (
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              Cargando archivos...
                            </div>
                          ) : sub.documents?.length === 0 ? (
                            <div className="text-slate-500 text-sm">Sin archivos adjuntos</div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-slate-400 text-xs font-medium">
                                {sub.documents?.length} archivo{(sub.documents?.length || 0) !== 1 ? 's' : ''}
                              </div>
                              {sub.documents?.map(doc => (
                                <div key={doc.id} className="flex items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2 hover:bg-slate-700/50 transition">
                                  <span className="text-lg">{fileIcon(doc.mime_type, doc.file_name)}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-white text-xs font-medium truncate">{doc.file_name}</div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {doc.document_role && doc.document_role !== 'unknown' && (
                                        <span className="text-purple-400 text-xs">{doc.document_role}</span>
                                      )}
                                      {doc.file_size > 0 && <span className="text-slate-500 text-xs">{fmtSize(doc.file_size)}</span>}
                                    </div>
                                  </div>
                                  {signedUrls[doc.id] ? (
                                    <a
                                      href={signedUrls[doc.id]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg transition shrink-0"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      Descargar
                                    </a>
                                  ) : (
                                    <span className="text-slate-600 text-xs">Sin URL</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
