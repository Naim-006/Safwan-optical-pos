export async function uploadShopLogo(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch('/api/settings/upload', {
    method: 'POST',
    body: formData,
  })

  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error || 'Upload failed')
  return data.url
}
