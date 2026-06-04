export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null

  try {
    const query = encodeURIComponent(address)
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ua`

    const res = await fetch(url, {
      headers: { 'Accept-Language': 'uk', 'User-Agent': 'BuildRadar/1.0' },
    })
    if (!res.ok) return null

    const data = await res.json()
    if (!data.length) return null

    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}
