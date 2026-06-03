import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createFolder as apiCreateFolder,
  deleteFile as apiDeleteFile,
  deleteFiles as apiDeleteFiles,
  getSignedUrl,
  listFiles,
  moveFile as apiMoveFile,
  uploadFiles as apiUploadFiles,
} from '@data/sunday/filesClient'

/**
 * Manages file listing, upload, delete, and navigation for a Supabase Storage bucket.
 * Tracks the current folder path as a stack for breadcrumb navigation.
 */
export function useFiles() {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [currentPath, setCurrentPath] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState(new Set())
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(
    async path => {
      const target = path ?? currentPath
      try {
        setLoading(true)
        const items = await listFiles(target)
        if (!mountedRef.current) return
        setFiles(items.filter(f => f.name !== '.keep'))
        setError(null)
      } catch (err) {
        if (mountedRef.current) setError(err?.message ?? String(err))
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [currentPath]
  )

  useEffect(() => {
    refresh(currentPath)
  }, [currentPath, refresh])

  const navigateToFolder = useCallback(folderName => {
    setSelectedFiles(new Set())
    setCurrentPath(prev => (prev ? `${prev}/${folderName}` : folderName))
  }, [])

  const navigateUp = useCallback(() => {
    setSelectedFiles(new Set())
    setCurrentPath(prev => {
      const parts = prev.split('/').filter(Boolean)
      parts.pop()
      return parts.join('/')
    })
  }, [])

  const navigateToPath = useCallback(path => {
    setSelectedFiles(new Set())
    setCurrentPath(path)
  }, [])

  const breadcrumbs = currentPath
    ? currentPath
        .split('/')
        .filter(Boolean)
        .map((segment, i, arr) => ({
          label: segment,
          path: arr.slice(0, i + 1).join('/'),
        }))
    : []

  const upload = useCallback(
    async fileList => {
      if (!fileList?.length) return
      setUploading(true)
      try {
        const results = await apiUploadFiles(currentPath, Array.from(fileList))
        const failures = results.filter(r => !r.success)
        if (failures.length > 0) {
          setError(`Failed to upload: ${failures.map(f => f.name).join(', ')}`)
        }
        await refresh(currentPath)
      } catch (err) {
        setError(err?.message ?? String(err))
      } finally {
        if (mountedRef.current) setUploading(false)
      }
    },
    [currentPath, refresh]
  )

  const removeFile = useCallback(
    async fullPath => {
      setFiles(prev => prev.filter(f => f.fullPath !== fullPath))
      try {
        await apiDeleteFile(fullPath)
      } catch (err) {
        setError(err?.message ?? String(err))
        await refresh(currentPath)
      }
    },
    [currentPath, refresh]
  )

  const removeSelected = useCallback(async () => {
    if (selectedFiles.size === 0) return
    const paths = Array.from(selectedFiles)
    setFiles(prev => prev.filter(f => !selectedFiles.has(f.fullPath)))
    setSelectedFiles(new Set())
    try {
      await apiDeleteFiles(paths)
    } catch (err) {
      setError(err?.message ?? String(err))
      await refresh(currentPath)
    }
  }, [selectedFiles, currentPath, refresh])

  const createFolder = useCallback(
    async name => {
      if (!name?.trim()) return
      const folderPath = currentPath ? `${currentPath}/${name.trim()}` : name.trim()
      try {
        await apiCreateFolder(folderPath)
        await refresh(currentPath)
      } catch (err) {
        setError(err?.message ?? String(err))
      }
    },
    [currentPath, refresh]
  )

  const rename = useCallback(
    async (oldPath, newName) => {
      const parts = oldPath.split('/')
      parts[parts.length - 1] = newName
      const newPath = parts.join('/')
      try {
        await apiMoveFile(oldPath, newPath)
        await refresh(currentPath)
      } catch (err) {
        setError(err?.message ?? String(err))
      }
    },
    [currentPath, refresh]
  )

  const getDownloadUrl = useCallback(async fullPath => {
    try {
      return await getSignedUrl(fullPath)
    } catch (err) {
      setError(err?.message ?? String(err))
      return null
    }
  }, [])

  const toggleSelect = useCallback(fullPath => {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(fullPath)) next.delete(fullPath)
      else next.add(fullPath)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    const nonFolders = files.filter(f => !f.isFolder)
    setSelectedFiles(new Set(nonFolders.map(f => f.fullPath)))
  }, [files])

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set())
  }, [])

  return {
    files,
    loading,
    error,
    currentPath,
    breadcrumbs,
    uploading,
    selectedFiles,
    refresh: () => refresh(currentPath),
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
  }
}
