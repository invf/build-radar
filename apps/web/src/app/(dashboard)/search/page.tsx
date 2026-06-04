import { Suspense } from 'react'
import { SearchPageInner } from './search-inner'

// Server component — awaits searchParams so initialQ is consistent
// between SSR and client hydration (no disabled-prop mismatch).
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  return (
    <Suspense>
      <SearchPageInner initialQ={q} />
    </Suspense>
  )
}
