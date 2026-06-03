import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  Eye,
  File,
  FileAudio,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  FolderOpen,
  FolderPlus,
  Grid3X3,
  List,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { useFiles } from '@hooks/sunday/useFiles'
import { fileCategory, formatFileSize } from '@data/sunday/filesClient'
import { formatRelative } from '@utils/sundayTime'

const VIEW_STORAGE_KEY = 'sunday.files.view'

const CATEGORY_ICONS = {
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  code: FileCode,
  archive: Package,
  other: File,
}

export default function SundayFiles() {
  const {
    files,
    loading,
    error,
    currentPath,
    breadcrumbs,
    uploading,
    selectedFiles,
    refresh,
    navigateToFolder,
    navigateUp,
    navigateToPath,
    upload,
    removeFile,
    removeSelected,
    createFolder,
    rename,
    getDownloadUrl,
    toggleSelect,
    selectAll,
    clearSelection,
  } = useFiles()

  const [viewMode, setViewMode] = useState(() => localStorage.getItem(VIEW_STORAGE_KEY) || 'grid')
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewName, setPreviewName] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [renamingFile, setRenamingFile] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)

  useEffect(() => {
    localStorage.setItem(VIEW_STORAGE_KEY, viewMode)
  }, [viewMode])

  const handleDragOver = useCallback(e => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(e => {
    e.preventDefault()
    e.stopPropagation()
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget)) {
      setDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    e => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)
      const droppedFiles = e.dataTransfer?.files
      if (droppedFiles?.length) upload(droppedFiles)
    },
    [upload]
  )

  const handleFileSelect = useCallback(
    e => {
      const selectedInputFiles = e.target?.files
      if (selectedInputFiles?.length) upload(selectedInputFiles)
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    [upload]
  )

  async function handlePreview(file) {
    const url = await getDownloadUrl(file.fullPath)
    if (url) {
      setPreviewUrl(url)
      setPreviewName(file.name)
    }
  }

  async function handleDownload(file) {
    const url = await getDownloadUrl(file.fullPath)
    if (!url) return
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = file.name
    anchor.click()
  }

  function handleDelete(file) {
    if (window.confirm(`Delete "${file.name}"?`)) {
      removeFile(file.fullPath)
    }
  }

  function handleDeleteSelected() {
    if (window.confirm(`Delete ${selectedFiles.size} file(s)?`)) {
      removeSelected()
    }
  }

  async function handleCreateFolder(e) {
    e?.preventDefault()
    if (!newFolderName.trim()) return
    await createFolder(newFolderName.trim())
    setNewFolderName('')
    setShowNewFolder(false)
  }

  async function handleRename(e) {
    e?.preventDefault()
    if (!renameValue.trim() || !renamingFile) return
    await rename(renamingFile, renameValue.trim())
    setRenamingFile(null)
    setRenameValue('')
  }

  function startRename(file) {
    setRenamingFile(file.fullPath)
    setRenameValue(file.name)
  }

  const folders = files.filter(f => f.isFolder)
  const regularFiles = files.filter(f => !f.isFolder)

  return (
    <div
      ref={dropZoneRef}
      className="relative flex h-full flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* drag overlay */}
      {dragOver && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed"
          style={{
            background: 'rgba(0,0,0,0.6)',
            borderColor: 'var(--sunday-accent)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="text-center">
            <Upload
              size={40}
              strokeWidth={1.5}
              className="mx-auto mb-3"
              style={{ color: 'var(--sunday-accent-bright)' }}
            />
            <p className="text-[15px] font-semibold" style={{ color: 'var(--sunday-text)' }}>
              Drop files to upload
            </p>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--sunday-text-muted)' }}>
              {currentPath ? `Into /${currentPath}` : 'Into root folder'}
            </p>
          </div>
        </div>
      )}

      <div className="w-full space-y-5 px-8 py-8">
        {/* header */}
        <header className="sunday-fade-up space-y-2.5">
          <h1
            className="text-[28px] font-semibold leading-tight tracking-tight"
            style={{ color: 'var(--sunday-text)' }}
          >
            Files
          </h1>
          <p
            className="max-w-2xl text-[13.5px] leading-relaxed"
            style={{ color: 'var(--sunday-text-muted)' }}
          >
            Store and manage files, images, documents, and any assets. Drag and drop to upload.
          </p>
        </header>

        {/* toolbar */}
        <div
          className="sunday-fade-up flex flex-wrap items-center gap-2"
          style={{ animationDelay: '40ms' }}
        >
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="primary"
            size="md"
            disabled={uploading}
          >
            <Upload size={13} strokeWidth={2.2} />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          <Button onClick={() => setShowNewFolder(prev => !prev)} variant="secondary" size="md">
            <FolderPlus size={13} strokeWidth={2.2} />
            New folder
          </Button>

          <Button onClick={refresh} variant="ghost" size="icon" aria-label="Refresh">
            <RefreshCw size={13} strokeWidth={2.2} />
          </Button>

          <div className="flex-1" />

          {selectedFiles.size > 0 && (
            <div className="flex items-center gap-2">
              <span
                className="text-[12px] font-medium tabular-nums"
                style={{ color: 'var(--sunday-text-muted)' }}
              >
                {selectedFiles.size} selected
              </span>
              <Button onClick={handleDeleteSelected} variant="danger" size="sm">
                <Trash2 size={11} strokeWidth={2.2} />
                Delete
              </Button>
              <Button onClick={clearSelection} variant="ghost" size="sm">
                Clear
              </Button>
            </div>
          )}

          {regularFiles.length > 0 && selectedFiles.size === 0 && (
            <Button onClick={selectAll} variant="ghost" size="sm">
              Select all
            </Button>
          )}

          <div
            className="flex items-center gap-0.5 rounded-md border p-0.5"
            style={{
              borderColor: 'var(--sunday-border-strong)',
              background: 'var(--sunday-surface)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className="sunday-press rounded p-1.5"
              style={{
                background: viewMode === 'grid' ? 'var(--sunday-surface-2)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--sunday-text)' : 'var(--sunday-text-faint)',
              }}
              aria-label="Grid view"
            >
              <Grid3X3 size={13} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className="sunday-press rounded p-1.5"
              style={{
                background: viewMode === 'list' ? 'var(--sunday-surface-2)' : 'transparent',
                color: viewMode === 'list' ? 'var(--sunday-text)' : 'var(--sunday-text-faint)',
              }}
              aria-label="List view"
            >
              <List size={13} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* new folder inline form */}
        {showNewFolder && (
          <form onSubmit={handleCreateFolder} className="sunday-fade-up flex items-center gap-2">
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Folder name..."
              size="md"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setShowNewFolder(false)
                  setNewFolderName('')
                }
              }}
              className="max-w-xs"
            />
            <Button type="submit" variant="primary" size="sm" disabled={!newFolderName.trim()}>
              <Plus size={12} strokeWidth={2.4} />
              Create
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowNewFolder(false)
                setNewFolderName('')
              }}
            >
              Cancel
            </Button>
          </form>
        )}

        {/* breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <nav
            className="sunday-fade-up flex items-center gap-1 text-[12.5px]"
            style={{ animationDelay: '60ms' }}
            aria-label="File path"
          >
            <button
              type="button"
              onClick={() => navigateToPath('')}
              className="sunday-press flex items-center gap-1 rounded px-1.5 py-0.5 font-medium"
              style={{ color: 'var(--sunday-accent-bright)' }}
            >
              <ArrowLeft size={11} strokeWidth={2.2} />
              Root
            </button>
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1">
                <ChevronRight
                  size={11}
                  strokeWidth={2}
                  style={{ color: 'var(--sunday-text-faint)' }}
                />
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-medium" style={{ color: 'var(--sunday-text)' }}>
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigateToPath(crumb.path)}
                    className="sunday-press rounded px-1.5 py-0.5 font-medium"
                    style={{ color: 'var(--sunday-accent-bright)' }}
                  >
                    {crumb.label}
                  </button>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* error */}
        {error && (
          <div
            className="rounded-md border px-3 py-2 text-[12.5px]"
            style={{
              background: 'rgba(248, 113, 113, 0.08)',
              borderColor: 'rgba(248, 113, 113, 0.3)',
              color: 'var(--sunday-danger)',
            }}
          >
            {error}
          </div>
        )}

        {/* loading skeleton */}
        {loading && files.length === 0 ? (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                : 'space-y-2'
            }
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`sunday-skeleton ${viewMode === 'grid' ? 'h-32' : 'h-12'} w-full rounded-lg`}
              />
            ))}
          </div>
        ) : files.length === 0 ? (
          <EmptyState onUpload={() => fileInputRef.current?.click()} />
        ) : (
          <>
            {/* folders */}
            {folders.length > 0 && (
              <div className="space-y-2">
                <p className="sunday-eyebrow">Folders</p>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                      : 'space-y-1'
                  }
                >
                  {folders.map((folder, i) => (
                    <FolderItem
                      key={folder.name}
                      folder={folder}
                      viewMode={viewMode}
                      onNavigate={() => navigateToFolder(folder.name)}
                      animationDelay={`${Math.min(i * 30, 150)}ms`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* files */}
            {regularFiles.length > 0 && (
              <div className="space-y-2">
                <p className="sunday-eyebrow">Files</p>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                      : 'space-y-1'
                  }
                >
                  {regularFiles.map((file, i) => (
                    <FileItem
                      key={file.fullPath}
                      file={file}
                      viewMode={viewMode}
                      selected={selectedFiles.has(file.fullPath)}
                      renaming={renamingFile === file.fullPath}
                      renameValue={renameValue}
                      onRenameChange={setRenameValue}
                      onRenameSubmit={handleRename}
                      onRenameCancel={() => {
                        setRenamingFile(null)
                        setRenameValue('')
                      }}
                      onToggleSelect={() => toggleSelect(file.fullPath)}
                      onPreview={() => handlePreview(file)}
                      onDownload={() => handleDownload(file)}
                      onDelete={() => handleDelete(file)}
                      onRename={() => startRename(file)}
                      animationDelay={`${Math.min((folders.length + i) * 30, 300)}ms`}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* image preview modal */}
      {previewUrl && (
        <PreviewModal
          url={previewUrl}
          name={previewName}
          onClose={() => {
            setPreviewUrl(null)
            setPreviewName('')
          }}
        />
      )}
    </div>
  )
}

/* ---- Folder item ---- */

function FolderItem({ folder, viewMode, onNavigate, animationDelay }) {
  if (viewMode === 'list') {
    return (
      <button
        type="button"
        onClick={onNavigate}
        className="sunday-card-alive sunday-fade-up flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left"
        style={{
          background: 'var(--sunday-surface)',
          borderColor: 'var(--sunday-border-strong)',
          animationDelay,
        }}
      >
        <FolderOpen
          size={16}
          strokeWidth={1.8}
          style={{ color: 'var(--sunday-accent-bright)' }}
          className="shrink-0"
        />
        <span
          className="min-w-0 flex-1 truncate text-[13px] font-medium"
          style={{ color: 'var(--sunday-text)' }}
        >
          {folder.name}
        </span>
        <ChevronRight size={13} strokeWidth={2} style={{ color: 'var(--sunday-text-faint)' }} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onNavigate}
      className="sunday-card-alive sunday-fade-up flex flex-col items-center justify-center gap-2 rounded-lg border px-3 py-5 text-center"
      style={{
        background: 'var(--sunday-surface)',
        borderColor: 'var(--sunday-border-strong)',
        animationDelay,
      }}
    >
      <FolderOpen size={28} strokeWidth={1.5} style={{ color: 'var(--sunday-accent-bright)' }} />
      <span
        className="w-full truncate text-[12px] font-medium"
        style={{ color: 'var(--sunday-text)' }}
      >
        {folder.name}
      </span>
    </button>
  )
}

/* ---- File item ---- */

function FileItem({
  file,
  viewMode,
  selected,
  renaming,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onToggleSelect,
  onPreview,
  onDownload,
  onDelete,
  onRename,
  animationDelay,
}) {
  const category = fileCategory(file.name)
  const Icon = CATEGORY_ICONS[category] || File
  const isPreviewable = category === 'image'
  const sizeLabel = formatFileSize(file.metadata?.size)
  const dateLabel = file.updated_at ? formatRelative(file.updated_at) : ''

  if (viewMode === 'list') {
    return (
      <div
        className={`sunday-card-alive sunday-fade-up group flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
          selected ? 'ring-2 ring-[var(--sunday-accent)]' : ''
        }`}
        style={{
          background: selected ? 'var(--sunday-accent-softer)' : 'var(--sunday-surface)',
          borderColor: selected ? 'var(--sunday-accent-soft)' : 'var(--sunday-border-strong)',
          animationDelay,
        }}
      >
        <button
          type="button"
          onClick={onToggleSelect}
          className="sunday-press flex h-5 w-5 shrink-0 items-center justify-center rounded border"
          style={{
            borderColor: selected ? 'var(--sunday-accent)' : 'var(--sunday-border-input)',
            background: selected ? 'var(--sunday-accent)' : 'transparent',
          }}
          aria-label={selected ? 'Deselect' : 'Select'}
        >
          {selected && (
            <Check size={11} strokeWidth={3} style={{ color: 'var(--sunday-on-accent)' }} />
          )}
        </button>

        <Icon
          size={16}
          strokeWidth={1.8}
          className="shrink-0"
          style={{ color: categoryColor(category) }}
        />

        {renaming ? (
          <form onSubmit={onRenameSubmit} className="flex min-w-0 flex-1 items-center gap-2">
            <Input
              value={renameValue}
              onChange={e => onRenameChange(e.target.value)}
              size="sm"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Escape') onRenameCancel()
              }}
              className="max-w-xs"
            />
            <Button type="submit" variant="primary" size="xs">
              Save
            </Button>
            <Button type="button" variant="ghost" size="xs" onClick={onRenameCancel}>
              Cancel
            </Button>
          </form>
        ) : (
          <span
            className="min-w-0 flex-1 truncate text-[13px] font-medium"
            style={{ color: 'var(--sunday-text)' }}
          >
            {file.name}
          </span>
        )}

        <span
          className="hidden shrink-0 font-mono text-[10.5px] tabular-nums sm:inline"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          {sizeLabel}
        </span>
        <span
          className="hidden shrink-0 font-mono text-[10.5px] tabular-nums md:inline"
          style={{ color: 'var(--sunday-text-faint)' }}
        >
          {dateLabel}
        </span>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {isPreviewable && (
            <Button onClick={onPreview} variant="ghost" size="icon" aria-label="Preview">
              <Eye size={12} strokeWidth={2} />
            </Button>
          )}
          <Button onClick={onDownload} variant="ghost" size="icon" aria-label="Download">
            <Download size={12} strokeWidth={2} />
          </Button>
          <Button onClick={onRename} variant="ghost" size="icon" aria-label="Rename">
            <Pencil size={12} strokeWidth={2} />
          </Button>
          <Button onClick={onDelete} variant="ghost" size="icon" aria-label="Delete">
            <Trash2 size={12} strokeWidth={2} />
          </Button>
        </div>
      </div>
    )
  }

  // grid view
  return (
    <div
      className={`sunday-card-alive sunday-fade-up group relative flex flex-col rounded-lg border ${
        selected ? 'ring-2 ring-[var(--sunday-accent)]' : ''
      }`}
      style={{
        background: selected ? 'var(--sunday-accent-softer)' : 'var(--sunday-surface)',
        borderColor: selected ? 'var(--sunday-accent-soft)' : 'var(--sunday-border-strong)',
        animationDelay,
      }}
    >
      {/* select checkbox */}
      <button
        type="button"
        onClick={onToggleSelect}
        className="sunday-press absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{
          borderColor: selected ? 'var(--sunday-accent)' : 'var(--sunday-border-input)',
          background: selected ? 'var(--sunday-accent)' : 'var(--sunday-surface-2)',
          opacity: selected ? 1 : undefined,
        }}
        aria-label={selected ? 'Deselect' : 'Select'}
      >
        {selected && (
          <Check size={11} strokeWidth={3} style={{ color: 'var(--sunday-on-accent)' }} />
        )}
      </button>

      {/* hover actions */}
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {isPreviewable && (
          <Button
            onClick={onPreview}
            variant="ghost"
            size="icon"
            aria-label="Preview"
            className="h-6 w-6"
          >
            <Eye size={11} strokeWidth={2} />
          </Button>
        )}
        <Button
          onClick={onDownload}
          variant="ghost"
          size="icon"
          aria-label="Download"
          className="h-6 w-6"
        >
          <Download size={11} strokeWidth={2} />
        </Button>
        <Button
          onClick={onRename}
          variant="ghost"
          size="icon"
          aria-label="Rename"
          className="h-6 w-6"
        >
          <Pencil size={11} strokeWidth={2} />
        </Button>
        <Button
          onClick={onDelete}
          variant="ghost"
          size="icon"
          aria-label="Delete"
          className="h-6 w-6"
        >
          <Trash2 size={11} strokeWidth={2} />
        </Button>
      </div>

      {/* icon area */}
      <div className="flex items-center justify-center px-3 pb-1 pt-6">
        <Icon size={32} strokeWidth={1.3} style={{ color: categoryColor(category) }} />
      </div>

      {/* file info */}
      <div className="flex flex-col items-center gap-0.5 px-2 pb-3 pt-1">
        {renaming ? (
          <form onSubmit={onRenameSubmit} className="flex w-full flex-col items-center gap-1">
            <Input
              value={renameValue}
              onChange={e => onRenameChange(e.target.value)}
              size="sm"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Escape') onRenameCancel()
              }}
              className="w-full text-center text-[11px]"
            />
            <div className="flex gap-1">
              <Button type="submit" variant="primary" size="xs">
                Save
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={onRenameCancel}>
                <X size={10} />
              </Button>
            </div>
          </form>
        ) : (
          <>
            <span
              className="w-full truncate text-center text-[11.5px] font-medium leading-tight"
              style={{ color: 'var(--sunday-text)' }}
              title={file.name}
            >
              {file.name}
            </span>
            <span
              className="font-mono text-[9.5px] tabular-nums"
              style={{ color: 'var(--sunday-text-faint)' }}
            >
              {sizeLabel}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

/* ---- Preview modal ---- */

function PreviewModal({ url, name, onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-8"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${name}`}
    >
      <div
        className="relative max-h-full max-w-4xl overflow-hidden rounded-xl border"
        style={{
          background: 'var(--sunday-surface)',
          borderColor: 'var(--sunday-border-strong)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-2.5"
          style={{ borderColor: 'var(--sunday-border)' }}
        >
          <span
            className="min-w-0 flex-1 truncate text-[13px] font-medium"
            style={{ color: 'var(--sunday-text)' }}
          >
            {name}
          </span>
          <div className="flex items-center gap-1.5">
            <a
              href={url}
              download={name}
              className="sunday-press inline-flex h-7 w-7 items-center justify-center rounded-md"
              style={{ color: 'var(--sunday-text-muted)' }}
              aria-label="Download"
            >
              <Download size={13} strokeWidth={2} />
            </a>
            <Button onClick={onClose} variant="ghost" size="icon" aria-label="Close">
              <X size={14} strokeWidth={2} />
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-center p-4">
          <img
            src={url}
            alt={name}
            className="max-h-[70vh] max-w-full rounded-md object-contain"
            style={{ background: 'var(--sunday-surface-2)' }}
          />
        </div>
      </div>
    </div>
  )
}

/* ---- Empty state ---- */

function EmptyState({ onUpload }) {
  return (
    <div
      className="sunday-fade-up flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center"
      style={{
        borderColor: 'var(--sunday-border-strong)',
        background: 'var(--sunday-surface)',
      }}
    >
      <Upload size={36} strokeWidth={1.3} style={{ color: 'var(--sunday-text-faint)' }} />
      <div>
        <p className="text-[14px] font-medium" style={{ color: 'var(--sunday-text)' }}>
          No files yet
        </p>
        <p
          className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed"
          style={{ color: 'var(--sunday-text-muted)' }}
        >
          Drag and drop files here, or click the upload button to get started.
        </p>
      </div>
      <Button onClick={onUpload} variant="primary" size="md">
        <Upload size={13} strokeWidth={2.2} />
        Upload files
      </Button>
    </div>
  )
}

/* ---- Helpers ---- */

function categoryColor(category) {
  const colors = {
    image: 'var(--sunday-accent-bright)',
    video: 'var(--sunday-warning)',
    audio: 'var(--sunday-positive)',
    document: 'var(--sunday-text-muted)',
    code: 'var(--sunday-accent-bright)',
    archive: 'var(--sunday-warning)',
    other: 'var(--sunday-text-faint)',
  }
  return colors[category] ?? 'var(--sunday-text-faint)'
}
