import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        background: '#09090b',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
      }}
    >
      {/* Building silhouette */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
        {/* Radar ping dot */}
        <div style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: '#60a5fa',
          marginBottom: '1px',
        }} />
        {/* Floors: narrow → wide, darkening toward base */}
        <div style={{ width: '10px', height: '3px', background: '#60a5fa', borderRadius: '1px' }} />
        <div style={{ width: '14px', height: '3px', background: '#3b82f6', borderRadius: '1px' }} />
        <div style={{ width: '18px', height: '3px', background: '#2563eb', borderRadius: '1px' }} />
        {/* Base */}
        <div style={{ width: '20px', height: '2px', background: '#1d4ed8', borderRadius: '1px' }} />
      </div>
    </div>,
    { ...size },
  )
}
