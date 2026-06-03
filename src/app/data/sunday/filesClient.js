import { supabase } from '@data/supabaseClient'

const BUCKET = 'sunday-files'

/**
 * List all objects under a given folder path in the sunday-files bucket.
 * Returns flat file metadata (no nested folder recursion).
 */
export async function listFiles(folderPath = '') {
  const prefix = folderPath ? folderPath.replace(/\/+$/, '') : ''
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix || undefined, {
    limit: 500,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) throw error
  return (data ?? []).map(item => ({
    ...item,
    fullPath: prefix ? `${prefix}/${item.name}` : item.name,
    isFolder: item.id === null,
  }))
}

/**
 * Upload a file to the bucket at the given path.
 * Upserts by default so re-uploading the same name overwrites.
 */
export async function uploadFile(fullPath, file) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fullPath, file, { upsert: true, cacheControl: '3600' })
  if (error) throw error
  return data
}

/**
 * Upload multiple files into a folder.
 * Returns an array of { path, error? } results.
 */
export async function uploadFiles(folderPath, files) {
  const prefix = folderPath ? folderPath.replace(/\/+$/, '') : ''
  const results = await Promise.allSettled(
    files.map(file => {
      const dest = prefix ? `${prefix}/${file.name}` : file.name
      return uploadFile(dest, file)
    })
  )
  return results.map((r, i) => ({
    name: files[i].name,
    success: r.status === 'fulfilled',
    error: r.status === 'rejected' ? r.reason?.message : null,
  }))
}

/** Delete a single file by its full path. */
export async function deleteFile(fullPath) {
  const { error } = await supabase.storage.from(BUCKET).remove([fullPath])
  if (error) throw error
}

/** Delete multiple files by their full paths. */
export async function deleteFiles(paths) {
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) throw error
}

/** Create a folder by uploading a zero-byte .keep placeholder. */
export async function createFolder(folderPath) {
  const path = `${folderPath.replace(/\/+$/, '')}/.keep`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, new Blob(['']), { upsert: true })
  if (error) throw error
}

/** Get a signed download URL valid for 1 hour. */
export async function getSignedUrl(fullPath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(fullPath, 3600)
  if (error) throw error
  return data.signedUrl
}

/** Get the public URL (only works if bucket is public). */
export function getPublicUrl(fullPath) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fullPath)
  return data.publicUrl
}

/** Rename/move a file by copying + deleting the original. */
export async function moveFile(fromPath, toPath) {
  const { error } = await supabase.storage.from(BUCKET).move(fromPath, toPath)
  if (error) throw error
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'])
const DOC_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'json',
  'xml',
  'md',
])
const CODE_EXTENSIONS = new Set([
  'js',
  'jsx',
  'ts',
  'tsx',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'h',
  'css',
  'html',
  'sql',
  'sh',
  'yaml',
  'yml',
  'toml',
])

/** Determine a file category from its extension. */
export function fileCategory(filename) {
  const ext = (filename ?? '').split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  if (AUDIO_EXTENSIONS.has(ext)) return 'audio'
  if (DOC_EXTENSIONS.has(ext)) return 'document'
  if (CODE_EXTENSIONS.has(ext)) return 'code'
  if (ext === 'zip' || ext === 'tar' || ext === 'gz' || ext === 'rar' || ext === '7z')
    return 'archive'
  return 'other'
}

/** Human-readable file size. */
export function formatFileSize(bytes) {
  if (bytes == null || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, i)
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}
